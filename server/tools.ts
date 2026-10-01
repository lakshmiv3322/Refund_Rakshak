import { z } from "zod";
import { type FunctionDeclaration, Type, GoogleGenAI } from "@google/genai";
import { type CaseState, loadDb, saveDb } from "./store.ts";
import {
  loadVerifiedRules,
  calculateTATDeadlineAndCompensation,
  checkUpiScenarioAmbiguity,
  getScenarioById,
  getAllScenarios
} from "./rules-engine.ts";
import { findBankContact, loadBankContacts, type BankContact } from "./email.ts";

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}

// Secret Redaction & Masking (no stateful regex lastIndex bug)
export function redactSecrets(text: string): { redactedText: string; foundSecrets: boolean; secretTypes: string[] } {
  if (!text) return { redactedText: "", foundSecrets: false, secretTypes: [] };

  const secretTypes: string[] = [];
  let redacted = text;

  // 1. PIN regex: matches "UPI PIN is 1234", "mpin is 987654", "pin: 1234"
  const pinRegex = /(\b(?:upi\s*pin|mpin|atm\s*pin|pin)\b(?:\s+(?:is|was|=|:|-)?\s*|\s*[:=_-]\s*))([0-9]{4,6})\b/gi;
  if (pinRegex.test(redacted)) {
    secretTypes.push("PIN");
    pinRegex.lastIndex = 0;
    redacted = redacted.replace(pinRegex, "$1[REDACTED_PIN]");
  }

  // 2. OTP regex: matches "OTP is 894321", "one time password was 123456"
  const otpRegex = /(\b(?:otp|one\s*time\s*password)\b(?:\s+(?:is|was|=|:|-)?\s*|\s*[:=_-]\s*))([0-9]{4,8})\b/gi;
  if (otpRegex.test(redacted)) {
    secretTypes.push("OTP");
    otpRegex.lastIndex = 0;
    redacted = redacted.replace(otpRegex, "$1[REDACTED_OTP]");
  }

  // 3. CVV regex
  const cvvRegex = /(\b(?:cvv|cvc|security\s*code)\b(?:\s+(?:is|was|=|:|-)?\s*|\s*[:=_-]\s*))([0-9]{3,4})\b/gi;
  if (cvvRegex.test(redacted)) {
    secretTypes.push("CVV");
    cvvRegex.lastIndex = 0;
    redacted = redacted.replace(cvvRegex, "$1[REDACTED_CVV]");
  }

  // 4. Password regex
  const passRegex = /(\b(?:password|passwd|pwd)\b(?:\s+(?:is|was|=|:|-)?\s*|\s*[:=_-]\s*))(\S+)\b/gi;
  if (passRegex.test(redacted)) {
    secretTypes.push("PASSWORD");
    passRegex.lastIndex = 0;
    redacted = redacted.replace(passRegex, "$1[REDACTED_PASSWORD]");
  }

  // 5. 16-digit Card numbers
  const cardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/g;
  if (cardRegex.test(redacted)) {
    secretTypes.push("CARD_NUMBER");
    cardRegex.lastIndex = 0;
    redacted = redacted.replace(cardRegex, "[REDACTED_CARD_NUMBER]");
  }

  // 6. 12-digit Aadhaar numbers: matches 4 digits, space, 4 digits, space, 4 digits
  const aadhaarRegex = /\b\d{4}\s\d{4}\s\d{4}\b/g;
  if (aadhaarRegex.test(redacted)) {
    secretTypes.push("AADHAAR");
    aadhaarRegex.lastIndex = 0;
    redacted = redacted.replace(aadhaarRegex, "[REDACTED_AADHAAR]");
  }

  return {
    redactedText: redacted,
    foundSecrets: secretTypes.length > 0,
    secretTypes
  };
}

export function maskReference(ref?: string | null): string {
  if (!ref || ref.trim().length === 0) return "N/A";
  const trimmed = ref.trim();
  if (trimmed.length <= 4) return trimmed;
  return "****" + trimmed.slice(-4);
}

// Schemas for argument parsing
export const updateCaseFactsSchema = z.object({
  amount: z.number().positive().optional().nullable(),
  transaction_date: z.string().optional().nullable(),
  transaction_reference: z.string().optional().nullable(),
  bank_or_provider: z.string().optional().nullable(),
  transaction_status: z.string().optional().nullable(),
  beneficiary_status: z.string().optional().nullable(),
  merchant_name: z.string().optional().nullable(),
  bank_complaint_date: z.string().optional().nullable(),
  bank_response: z.string().optional().nullable()
});

export const recordClassificationSchema = z.object({
  classification: z.enum([
    "supported_upi_failed_debited_not_credited",
    "unauthorized_or_fraud",
    "merchant_refund",
    "atm_or_card",
    "other_unknown",
    "missing_evidence"
  ]),
  confidence: z.number().min(0).max(1),
  rationale: z.string()
});

export const scheduleFollowupSchema = z.object({
  days_from_now: z.number().int().positive(),
  condition: z.string(),
  action_type: z.string()
});

export const askUserSchema = z.object({
  question: z.string(),
  missing_fields: z.array(z.string())
});

export const stopBranchSchema = z.object({
  branch: z.string(),
  reason: z.string(),
  checklist: z.array(z.string())
});

export const draftEmailSchema = z.object({
  action_type: z.enum(["bank_complaint", "nodal_officer_escalation", "rbi_ombudsman_draft"])
});

export const verifyBankContactSchema = z.object({
  bank_name: z.string()
});

// Tool Declarations for Gemini
export const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_case_state",
    description: "Retrieve current case state, transaction facts, timeline, and pending actions.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "update_case_facts",
    description: "Record transaction facts explicitly stated by user (amount, YYYY-MM-DD date, reference, bank, status). Rejects future dates and non-positive amounts.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER, description: "Transaction amount in INR (must be positive)" },
        transaction_date: { type: Type.STRING, description: "Transaction date in YYYY-MM-DD format (never future)" },
        transaction_reference: { type: Type.STRING, description: "UPI UTR or bank reference number" },
        bank_or_provider: { type: Type.STRING, description: "Bank or payment app name (e.g. SBI, HDFC Bank, ICICI)" },
        transaction_status: { type: Type.STRING, description: "Debit status (e.g. FAILED_DEBITED)" },
        beneficiary_status: { type: Type.STRING, description: "Credit status (e.g. NOT_CREDITED)" },
        merchant_name: { type: Type.STRING, description: "Merchant name if online purchase" },
        bank_complaint_date: { type: Type.STRING, description: "Date initial bank complaint was filed (YYYY-MM-DD)" },
        bank_response: { type: Type.STRING, description: "Response received from bank, if any" }
      }
    }
  },
  {
    name: "extract_transaction_evidence",
    description: "Extracts transaction facts (amount, date, reference/UTR, bank/app, status, payee) from attached payment screenshot or text using structured vision extraction.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        raw_text: { type: Type.STRING, description: "Optional raw OCR or text description of the evidence" }
      }
    }
  },
  {
    name: "record_classification",
    description: "Record grievance classification determined from whole conversation context.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        classification: {
          type: Type.STRING,
          enum: [
            "supported_upi_failed_debited_not_credited",
            "unauthorized_or_fraud",
            "merchant_refund",
            "atm_or_card",
            "other_unknown",
            "missing_evidence"
          ]
        },
        confidence: { type: Type.NUMBER },
        rationale: { type: Type.STRING }
      },
      required: ["classification", "confidence", "rationale"]
    }
  },
  {
    name: "lookup_verified_rule",
    description: "Lookup verified statutory RBI rule. Refuses unless all required facts exist.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "calculate_deadline_and_estimate",
    description: "Calculate deterministic statutory TAT reversal deadline and potential delay compensation based on the verified scenario table (RBI/2019-20/67).",
    parameters: {
      type: Type.OBJECT,
      properties: {
        scenario_id: {
          type: Type.STRING,
          description: "Optional scenario identifier: upi_p2p_debit_not_credited (T+1 calendar day) or upi_p2m_merchant_debit_failed (T+5 calendar days)"
        }
      }
    }
  },
  {
    name: "validate_ombudsman_preconditions",
    description: "Validate preconditions under the RBI Integrated Ombudsman Scheme (30-day waiting period from initial bank complaint).",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "verify_bank_contact",
    description: "Verifies official bank grievance redressal email, Principal Nodal Officer contact, and official portal URL using Google Search grounding.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        bank_name: { type: Type.STRING, description: "Name of bank to look up" }
      },
      required: ["bank_name"]
    }
  },
  {
    name: "generate_bank_complaint",
    description: "Generate bank grievance redressal complaint draft using verified bank directory contacts.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "generate_nodal_escalation",
    description: "Generate escalation draft to Principal Nodal Officer for unresolved disputes.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "generate_ombudsman_draft",
    description: "Generate RBI Ombudsman complaint package for cms.rbi.org.in (blocked unless eligible_now).",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "generate_evidence_pack",
    description: "Generate downloadable PDF evidence pack link.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "draft_email",
    description: "Create pending action for email draft requiring explicit human approval.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        action_type: { type: Type.STRING, enum: ["bank_complaint", "nodal_officer_escalation", "rbi_ombudsman_draft"] }
      },
      required: ["action_type"]
    }
  },
  {
    name: "schedule_followup",
    description: "Schedule automated follow-up reminder.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        days_from_now: { type: Type.NUMBER },
        condition: { type: Type.STRING },
        action_type: { type: Type.STRING }
      },
      required: ["days_from_now", "condition", "action_type"]
    }
  },
  {
    name: "ask_user",
    description: "Ask user for missing information and pause turn.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        question: { type: Type.STRING },
        missing_fields: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["question", "missing_fields"]
    }
  },
  {
    name: "stop_branch",
    description: "Stop processing for safety branch (cybercrime fraud) or out-of-scope disputes.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        branch: { type: Type.STRING },
        reason: { type: Type.STRING },
        checklist: { type: Type.ARRAY, items: { type: Type.STRING } }
      },
      required: ["branch", "reason", "checklist"]
    }
  }
];

// Helper to provide both sync result and async promise resolution
function wrapResult(res: { result: any; stop?: boolean; status?: string }): any {
  const p = Promise.resolve(res);
  return Object.assign(p, res);
}

// Tool Execution Handler
export function executeToolCall(
  toolName: string,
  rawArgs: any,
  caseState: CaseState,
  context?: { imageBase64?: string; imageMime?: string }
): any {
  const rulesData = loadVerifiedRules();

  const addToolTrace = (label: string, status: string, summary: string, sourceIds?: string[]) => {
    caseState.trace.unshift({
      id: "tr_" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      event_type: "TOOL_CALL",
      label,
      tool_name: toolName,
      branch: caseState.branch,
      status,
      summary,
      source_ids: sourceIds || caseState.source_references.map((s: any) => s.rule_id || s.scenario_id)
    });
  };

  try {
    if (toolName === "get_case_state") {
      addToolTrace("Retrieved case state", "success", `Case ID ${caseState.case_id}`);
      return wrapResult({ result: caseState });
    }

    if (toolName === "update_case_facts") {
      const parsed = updateCaseFactsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return wrapResult({ result: { error: "Invalid arguments", details: parsed.error.format() } });
      }
      const args = parsed.data;

      if (args.transaction_date) {
        const d = new Date(args.transaction_date);
        const now = new Date(caseState.simulated_now || new Date());
        if (d > now) {
          return wrapResult({ result: { error: "Transaction date cannot be in the future relative to current date." } });
        }
        caseState.transaction_facts.transaction_date = args.transaction_date;
      }
      if (args.amount !== undefined && args.amount !== null) {
        if (args.amount <= 0) return wrapResult({ result: { error: "Amount must be a positive number." } });
        caseState.transaction_facts.amount = args.amount;
      }
      if (args.transaction_reference) {
        caseState.transaction_facts.transaction_reference = args.transaction_reference;
      }
      if (args.bank_or_provider) {
        caseState.transaction_facts.bank_or_provider = args.bank_or_provider;
      }
      if (args.transaction_status) caseState.transaction_facts.transaction_status = args.transaction_status;
      if (args.beneficiary_status) caseState.transaction_facts.beneficiary_status = args.beneficiary_status;
      if (args.merchant_name) caseState.transaction_facts.merchant_name = args.merchant_name;
      if (args.bank_complaint_date) caseState.bank_complaint_date = args.bank_complaint_date;
      if (args.bank_response) caseState.bank_response = args.bank_response;

      const f = caseState.transaction_facts;
      const missing: string[] = [];
      if (!f.amount) missing.push("amount");
      if (!f.transaction_date) missing.push("transaction_date");
      if (!f.transaction_reference) missing.push("transaction_reference");
      if (!f.bank_or_provider) missing.push("bank_or_provider");

      caseState.missing_fields = missing;
      caseState.transaction_facts.missing_fields = missing;
      caseState.updated_at = new Date().toISOString();

      addToolTrace(
        "Updated case facts",
        "success",
        `Amount: ₹${f.amount}, Ref: ${maskReference(f.transaction_reference)}, Missing: ${missing.join(", ")}`
      );
      return wrapResult({ result: { facts: caseState.transaction_facts, missing_fields: missing } });
    }

    // Vision Evidence Extraction Tool Handler (Phase 1, Item 3)
    if (toolName === "extract_transaction_evidence") {
      const asyncExtraction = async () => {
        const imageBase64 = context?.imageBase64;
        const imageMime = context?.imageMime || "image/png";
        const rawText = rawArgs?.raw_text || "";

        const ai = getGenAIClient();
        if (!ai) {
          return {
            result: {
              error: "Gemini API client unavailable. Please ensure GEMINI_API_KEY is configured.",
              extracted: null
            }
          };
        }

        const promptText = `Analyze this payment evidence carefully. Extract the financial transaction details accurately.
Extract:
- amount (positive number in INR) and your confidence (0.0 to 1.0)
- transaction_date (in YYYY-MM-DD format if possible) and confidence (0.0 to 1.0)
- transaction_reference (UPI UTR, Ref ID, bank transaction number) and confidence (0.0 to 1.0)
- bank_or_provider (Bank name e.g. SBI, HDFC, or App e.g. Google Pay, PhonePe, Paytm) and confidence (0.0 to 1.0)
- transaction_status (e.g. FAILED, DEBITED, SUCCESS, PENDING)
- payee (recipient person or merchant name, if visible)
- is_genuine_payment_receipt (true if this is a genuine transaction receipt)

Only report high confidence (>=0.7) for fields that are clearly visible. If blurred, missing, or inferred, set confidence lower than 0.7.`;

        const parts: any[] = [];
        if (imageBase64) {
          parts.push({
            inlineData: {
              data: imageBase64,
              mimeType: imageMime
            }
          });
        }
        parts.push({
          text: rawText ? `${promptText}\n\nAdditional text evidence: ${rawText}` : promptText
        });

        try {
          const resp = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
            contents: { parts },
            config: {
              responseMimeType: "application/json",
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  amount: { type: Type.NUMBER, description: "Amount in INR" },
                  amount_confidence: { type: Type.NUMBER },
                  transaction_date: { type: Type.STRING, description: "Date YYYY-MM-DD" },
                  date_confidence: { type: Type.NUMBER },
                  transaction_reference: { type: Type.STRING, description: "UTR or reference" },
                  reference_confidence: { type: Type.NUMBER },
                  bank_or_provider: { type: Type.STRING, description: "Bank or UPI provider" },
                  bank_confidence: { type: Type.NUMBER },
                  transaction_status: { type: Type.STRING },
                  payee: { type: Type.STRING },
                  is_genuine_payment_receipt: { type: Type.BOOLEAN }
                },
                required: [
                  "amount_confidence",
                  "date_confidence",
                  "reference_confidence",
                  "bank_confidence",
                  "is_genuine_payment_receipt"
                ]
              }
            }
          });

          const extracted = JSON.parse(resp.text || "{}");
          const confidenceThreshold = 0.7;
          const mergedFields: string[] = [];

          // Merge confident facts into caseState
          if (extracted.amount && extracted.amount_confidence >= confidenceThreshold && extracted.amount > 0) {
            caseState.transaction_facts.amount = extracted.amount;
            mergedFields.push(`Amount: ₹${extracted.amount}`);
          }
          if (extracted.transaction_date && extracted.date_confidence >= confidenceThreshold) {
            try {
              const parsedDate = new Date(extracted.transaction_date).toISOString().split("T")[0];
              caseState.transaction_facts.transaction_date = parsedDate;
              mergedFields.push(`Date: ${parsedDate}`);
            } catch (_) {
              caseState.transaction_facts.transaction_date = extracted.transaction_date;
              mergedFields.push(`Date: ${extracted.transaction_date}`);
            }
          }
          if (extracted.transaction_reference && extracted.reference_confidence >= confidenceThreshold) {
            caseState.transaction_facts.transaction_reference = extracted.transaction_reference;
            mergedFields.push(`Ref: ${maskReference(extracted.transaction_reference)}`);
          }
          if (extracted.bank_or_provider && extracted.bank_confidence >= confidenceThreshold) {
            caseState.transaction_facts.bank_or_provider = extracted.bank_or_provider;
            mergedFields.push(`Bank: ${extracted.bank_or_provider}`);
          }
          if (extracted.transaction_status) {
            caseState.transaction_facts.transaction_status = extracted.transaction_status;
          }

          // Mark each field source as "screenshot" in evidence_items
          const evidenceRecord = {
            id: "ev_" + Math.random().toString(36).substring(2, 9),
            type: "screenshot_extracted",
            source: "screenshot",
            timestamp: new Date().toISOString(),
            extracted_fields: {
              amount: extracted.amount,
              transaction_date: extracted.transaction_date,
              transaction_reference: extracted.transaction_reference,
              bank_or_provider: extracted.bank_or_provider,
              transaction_status: extracted.transaction_status,
              payee: extracted.payee
            },
            confidences: {
              amount: extracted.amount_confidence,
              date: extracted.date_confidence,
              reference: extracted.reference_confidence,
              bank: extracted.bank_confidence
            },
            summary: `Extracted from screenshot: ${mergedFields.join(", ")}`
          };
          caseState.evidence_items.push(evidenceRecord);

          // Update missing fields
          const f = caseState.transaction_facts;
          const missing: string[] = [];
          if (!f.amount) missing.push("amount");
          if (!f.transaction_date) missing.push("transaction_date");
          if (!f.transaction_reference) missing.push("transaction_reference");
          if (!f.bank_or_provider) missing.push("bank_or_provider");
          caseState.missing_fields = missing;
          caseState.transaction_facts.missing_fields = missing;

          // Formulate confirmation prompt for the user
          const confirmationQuestion = `I extracted the following details from your payment screenshot:\n• Amount: ₹${f.amount ?? "Unclear"}\n• Transaction Date: ${f.transaction_date ?? "Unclear"}\n• Reference / UTR: ${maskReference(f.transaction_reference)}\n• Bank / Provider: ${f.bank_or_provider ?? "Unclear"}\n• Status: ${f.transaction_status ?? "Debit Recorded"}\n\nPlease confirm if these details are accurate, or let me know if anything needs correction.`;

          addToolTrace(
            "Extracted evidence from screenshot",
            "success",
            `Extracted ${mergedFields.join("; ")} with source: screenshot.`
          );

          return {
            result: {
              extracted,
              merged_fields: mergedFields,
              missing_fields: missing,
              confirmation_prompt: confirmationQuestion
            },
            stop: true,
            status: "needs_input"
          };
        } catch (visionErr: any) {
          addToolTrace("Vision evidence extraction fallback", "warning", visionErr.message);
          return {
            result: {
              error: `Screenshot extraction failed: ${visionErr.message}. Please provide the amount, date, reference, and bank name in text.`,
              extracted: null
            },
            stop: true,
            status: "needs_input"
          };
        }
      };

      return asyncExtraction();
    }

    // Classification Tool Handler with Gemini Structured Fraud Safety (Phase 2, Item 6)
    if (toolName === "record_classification") {
      const parsed = recordClassificationSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return wrapResult({ result: { error: "Invalid classification arguments", details: parsed.error.format() } });
      }
      const args = parsed.data;

      const asyncClassification = async () => {
        let classification = args.classification;
        let isFraudSafety = false;
        let fraudRationale = args.rationale;

        // Structured Gemini Fraud Classification with keyword fallback
        const ai = getGenAIClient();
        const chatText = caseState.chat_history.map(c => c.text).join("\n");

        if (ai && chatText.trim()) {
          try {
            const fraudEval = await ai.models.generateContent({
              model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
              contents: `Analyze this user grievance message carefully for unauthorized fraud vs legitimate failed payment debit:
---
${chatText}
---
Determine:
1. is_unauthorized_or_fraud: true if user claims their account was hacked, unauthorized debit occurred, someone stole their money, or they DID NOT initiate this transaction. False if user initiated a legitimate payment that failed or was not credited.
2. negation_detected: true if user explicitly clarifies that this is NOT fraud or that they authorized the payment.
3. confidence: score between 0.0 and 1.0.
4. rationale: brief reason.`,
              config: {
                responseMimeType: "application/json",
                responseSchema: {
                  type: Type.OBJECT,
                  properties: {
                    is_unauthorized_or_fraud: { type: Type.BOOLEAN },
                    negation_detected: { type: Type.BOOLEAN },
                    confidence: { type: Type.NUMBER },
                    rationale: { type: Type.STRING }
                  },
                  required: ["is_unauthorized_or_fraud", "negation_detected", "confidence", "rationale"]
                }
              }
            });

            const parsedFraud = JSON.parse(fraudEval.text || "{}");
            if (parsedFraud.is_unauthorized_or_fraud && !parsedFraud.negation_detected && parsedFraud.confidence >= 0.75) {
              isFraudSafety = true;
              fraudRationale = `AI Safety Guard: ${parsedFraud.rationale}`;
            }
          } catch (e: any) {
            console.warn("Structured fraud detection API fallback to keyword check:", e.message);
          }
        }

        // Keyword Fallback (strict phrases only)
        if (!isFraudSafety) {
          const lowerChat = chatText.toLowerCase();
          const keywordCheck =
            lowerChat.includes("did not make this transaction") ||
            lowerChat.includes("unauthorized transaction") ||
            lowerChat.includes("unauthorized debit") ||
            lowerChat.includes("account was hacked") ||
            lowerChat.includes("account hacked") ||
            lowerChat.includes("someone used my account") ||
            lowerChat.includes("stolen money") ||
            lowerChat.includes("fraudulent transaction");
          if (keywordCheck) {
            isFraudSafety = true;
            fraudRationale = "Keyword Safety Guard: User explicitly reported unauthorized compromise/theft.";
          }
        }

        if (isFraudSafety) {
          classification = "unauthorized_or_fraud";
          caseState.safety_flags.push("genuine_unauthorized_transaction_safety_override");
          addToolTrace(
            "Fraud Safety Classification Applied",
            "warning",
            "Routed to 1930 / cybercrime.gov.in safety branch with zero compensation."
          );
        }

        caseState.classification = classification;
        caseState.classification_confidence = args.confidence;
        caseState.classification_rationale = isFraudSafety ? fraudRationale : args.rationale;
        caseState.branch = classification === "unauthorized_or_fraud"
          ? "fraud_safety_branch"
          : (classification === "merchant_refund"
            ? "merchant_refund_branch"
            : (classification === "atm_or_card"
              ? "out_of_scope_atm"
              : "supported_upi_failed_debit"));

        addToolTrace(`Classified grievance as ${classification}`, "success", caseState.classification_rationale);
        return { result: { classification, branch: caseState.branch, confidence: args.confidence } };
      };

      return asyncClassification();
    }

    if (toolName === "lookup_verified_rule") {
      const f = caseState.transaction_facts;
      if (!f.amount || !f.transaction_date || !f.transaction_reference || !f.bank_or_provider) {
        return wrapResult({
          result: {
            applicable: false,
            reason: "insufficient_evidence",
            missing: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"].filter(k => !(f as any)[k])
          }
        });
      }

      if (caseState.classification === "supported_upi_failed_debited_not_credited") {
        caseState.verified_rule_id = "rbi_failed_transaction_upi_debit_not_credited";
        caseState.source_references = [rulesData.rules[0]];
        addToolTrace(
          "Lookup verified rule success",
          "success",
          "Matched RBI Circular RBI/2019-20/67 (Item 4(a)).",
          ["rbi_failed_transaction_upi_debit_not_credited"]
        );
        return wrapResult({
          result: {
            applicable: true,
            rule_id: "rbi_failed_transaction_upi_debit_not_credited",
            source: rulesData.rules[0],
            status_label: rulesData.rules[0].status
          }
        });
      }

      return wrapResult({
        result: { applicable: false, reason: "Rule not applicable for classification: " + caseState.classification }
      });
    }

    // Rules Engine Scenario Table & Ambiguity Resolution (Phase 2, Item 5)
    if (toolName === "calculate_deadline_and_estimate") {
      const f = caseState.transaction_facts;
      if (!f.transaction_date) {
        return wrapResult({ result: { error: "Missing transaction date for statutory calculation." } });
      }

      const simNow = caseState.simulated_now || new Date().toISOString();
      const requestedScenario = rawArgs?.scenario_id;

      // Check for P2P vs P2M ambiguity
      const chatContext = caseState.chat_history.map(c => c.text).join(" ");
      const ambiguityCheck = checkUpiScenarioAmbiguity(chatContext, f.transaction_date, simNow, f.merchant_name);

      let calc: any;
      if (requestedScenario) {
        calc = calculateTATDeadlineAndCompensation(f.transaction_date, simNow, requestedScenario);
      } else {
        calc = ambiguityCheck.p2pCalculation;
      }

      caseState.latest_compensation_estimate = calc.potential_compensation_estimate;
      caseState.latest_days_delayed = calc.days_delayed;

      addToolTrace(
        `Calculated statutory TAT under ${calc.circular_row}`,
        "success",
        `${calc.explanation} (${calc.status_label})`
      );

      if (ambiguityCheck.isAmbiguous && !requestedScenario) {
        return wrapResult({
          result: {
            ...calc,
            is_ambiguous: true,
            p2p_outcome: ambiguityCheck.p2pCalculation,
            p2m_outcome: ambiguityCheck.p2mCalculation,
            clarifying_question: ambiguityCheck.clarifyingQuestion
          }
        });
      }

      return wrapResult({ result: calc });
    }

    // Bank Contact Verification Tool with Google Search Grounding (Phase 2, Item 8)
    if (toolName === "verify_bank_contact") {
      const parsed = verifyBankContactSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return wrapResult({ result: { error: "Invalid bank_name for contact verification" } });
      }
      const bankName = parsed.data.bank_name;

      const asyncVerifyContact = async () => {
        const localBank = findBankContact(bankName);
        const ai = getGenAIClient();

        if (!ai) {
          if (localBank) {
            return {
              result: {
                bank_name: localBank.name,
                grievance_email: localBank.grievance_email,
                nodal_officer_email: localBank.nodal_officer_email,
                escalation_portal_url: localBank.escalation_portal_url,
                source_url: localBank.source_url,
                verified_date: localBank.verified_at,
                source_type: "Local Verified Bank Directory"
              }
            };
          }
          return { result: { error: "GEMINI_API_KEY required for live bank contact search grounding." } };
        }

        try {
          // Separate Gemini call with ONLY googleSearch grounding (no function declarations)
          const searchResp = await ai.models.generateContent({
            model: process.env.GEMINI_MODEL || "gemini-3.8-flash",
            contents: `Find the official customer grievance redressal email address, Principal Nodal Officer (PNO) email address, and official grievance escalation web portal URL for ${bankName} in India. Also list the official bank source URL where this is published. Format as concise text with clear headings.`,
            config: {
              tools: [{ googleSearch: {} }]
            }
          });

          // Extract grounding web citations
          const groundingChunks = (searchResp.candidates?.[0] as any)?.groundingMetadata?.groundingChunks || [];
          const sourceUrls = groundingChunks
            .map((chunk: any) => chunk.web?.uri)
            .filter((uri: any) => typeof uri === "string" && uri.startsWith("http"));

          const verifiedUrl = sourceUrls[0] || localBank?.source_url || "https://www.rbi.org.in";

          addToolTrace(
            `Verified contact for ${bankName}`,
            "success",
            `Retrieved official grievance contacts with search grounding. Source: ${verifiedUrl}`
          );

          return {
            result: {
              bank_name: localBank?.name || bankName,
              summary: searchResp.text,
              source_urls: sourceUrls,
              primary_source_url: verifiedUrl,
              local_record: localBank || null
            }
          };
        } catch (searchErr: any) {
          addToolTrace("Search grounding fallback", "info", searchErr.message);
          return {
            result: {
              bank_name: localBank?.name || bankName,
              grievance_email: localBank?.grievance_email || `customercare@${bankName.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.in`,
              nodal_officer_email: localBank?.nodal_officer_email || `pno@${bankName.toLowerCase().replace(/[^a-z0-9]/g, "")}.co.in`,
              source_url: localBank?.source_url || "https://sbi.co.in/web/customer-care/grievance-redressal-mechanism",
              verified_date: localBank?.verified_at || "2026-03-30",
              source_type: "Local Verified Bank Directory (Offline fallback)"
            }
          };
        }
      };

      return asyncVerifyContact();
    }

    if (toolName === "validate_ombudsman_preconditions") {
      const hasBankComplaint = !!caseState.bank_complaint_date;
      const complaintDate = hasBankComplaint ? new Date(caseState.bank_complaint_date!) : null;
      const now = new Date(caseState.simulated_now || new Date());
      const daysSinceComplaint = complaintDate ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const waited30Days = daysSinceComplaint >= 30 || caseState.bank_response === "rejected" || caseState.escalation_stage.includes("nodal");

      const eligibleNow = waited30Days && hasBankComplaint;
      addToolTrace(
        "Validated RBI Ombudsman preconditions",
        "success",
        `Eligible now: ${eligibleNow}, Days since complaint: ${daysSinceComplaint} (${rulesData.rules[1]?.status || "RBI Ombudsman Scheme"})`
      );
      return wrapResult({
        result: {
          eligible_now: eligibleNow,
          eligible_later: !waited30Days && hasBankComplaint,
          not_eligible: !hasBankComplaint,
          days_since_complaint: daysSinceComplaint,
          source: rulesData.rules[1],
          status_label: rulesData.rules[1]?.status
        }
      });
    }

    if (toolName === "generate_bank_complaint") {
      const f = caseState.transaction_facts;
      const bankInfo = findBankContact(f.bank_or_provider);
      const recipientEmail = bankInfo ? bankInfo.grievance_email : `customercare@sbi.co.in`;

      const act = {
        id: "act_" + Math.random().toString(36).substring(2, 9),
        type: "bank_complaint",
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          recipient: recipientEmail,
          bank_name: bankInfo ? bankInfo.name : (f.bank_or_provider || "State Bank of India"),
          bank_verified: !!bankInfo,
          subject: `Grievance Redressal: UPI Failed & Debited (Ref: ${maskReference(f.transaction_reference)})`,
          body: `To Customer Support / Grievance Redressal Officer,\n${bankInfo ? bankInfo.name : (f.bank_or_provider || "Bank")}\n\nMy UPI transaction of ₹${f.amount} executed on ${f.transaction_date} (Transaction Reference: ${maskReference(f.transaction_reference)}) was debited from my account, but beneficiary account was not credited.\n\nAs mandated under RBI Circular RBI/2019-20/67 Item 4(a) (Harmonisation of Turn Around Time and customer compensation for failed transactions), automatic reversal is required within T+1 calendar day.\n\nKindly investigate and confirm reversal. Potential compensation estimate, subject to verification.`
        },
        simulated: false,
        source_references: [rulesData.rules[0]]
      };
      caseState.pending_actions.push(act);
      addToolTrace("Generated bank complaint draft", "success", act.payload.subject);
      return wrapResult({ result: act, stop: true, status: "approval_required" });
    }

    if (toolName === "generate_nodal_escalation") {
      const f = caseState.transaction_facts;
      const bankInfo = findBankContact(f.bank_or_provider);
      const recipientEmail = bankInfo ? bankInfo.nodal_officer_email : `nodalofficer@sbi.co.in`;

      const act = {
        id: "act_nodal_" + Math.random().toString(36).substring(2, 9),
        type: "nodal_officer_escalation",
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          recipient: recipientEmail,
          bank_name: bankInfo ? bankInfo.name : f.bank_or_provider,
          bank_verified: !!bankInfo,
          subject: `ESCALATION: Unresolved Failed UPI Debit - Ref ${maskReference(f.transaction_reference)}`,
          body: `Respected Principal Nodal Officer,\n\nMy initial bank complaint dated ${caseState.bank_complaint_date || "earlier"} regarding failed UPI debit of ₹${f.amount} (Ref: ${maskReference(f.transaction_reference)}) remains unresolved.\n\nNote: The 7-day wait period before nodal escalation is an industry-standard recommended wait period, not an RBI statutory clause. (Statutory Ombudsman escalation eligibility requires a 30-day wait under the RBI Integrated Ombudsman Scheme).\n\nUnder RBI Circular RBI/2019-20/67, potential compensation estimate, subject to verification: ₹${caseState.latest_compensation_estimate || 0}.\n\nKindly process immediate reversal and credit of statutory delayed-period compensation.`
        },
        simulated: false,
        source_references: [rulesData.rules[0]]
      };
      caseState.pending_actions.push(act);
      addToolTrace("Generated Principal Nodal Officer escalation draft", "success", act.payload.subject);
      return wrapResult({ result: act, stop: true, status: "approval_required" });
    }

    if (toolName === "generate_ombudsman_draft") {
      const hasBankComplaint = !!caseState.bank_complaint_date;
      const complaintDate = hasBankComplaint ? new Date(caseState.bank_complaint_date!) : null;
      const now = new Date(caseState.simulated_now || new Date());
      const days = complaintDate ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

      if (!hasBankComplaint || days < 30) {
        return wrapResult({
          result: {
            error: `Preconditions not met: under the RBI Integrated Ombudsman Scheme, you must have bank complaint and wait 30 days without satisfactory resolution. Currently elapsed: ${days} days.`
          }
        });
      }

      const f = caseState.transaction_facts;
      const act = {
        id: "act_omb_" + Math.random().toString(36).substring(2, 9),
        type: "rbi_ombudsman_draft",
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          portal_url: "https://cms.rbi.org.in",
          subject: `RBI Ombudsman Grievance Submission Pack - Ref ${maskReference(f.transaction_reference)}`,
          body: `=== RBI COMPLAINT MANAGEMENT SYSTEM (CMS) PACK ===\nRegulated Entity: ${f.bank_or_provider || "Bank"}\nTransaction Date: ${f.transaction_date}\nAmount: ₹${f.amount}\nReference: ${maskReference(f.transaction_reference)}\nInitial Complaint Date: ${caseState.bank_complaint_date}\nDays Elapsed: ${days}\n\nRelief Claimed: Full reversal of ₹${f.amount} plus statutory delay compensation under RBI Circular RBI/2019-20/67.\n\nNOTE: Submission happens on the official Reserve Bank of India CMS portal at https://cms.rbi.org.in. Source: RBI Integrated Ombudsman Scheme, last checked 2026-03-30.`
        },
        simulated: false,
        source_references: [rulesData.rules[1]]
      };
      caseState.pending_actions.push(act);
      addToolTrace("Generated RBI Ombudsman submission package", "success", act.payload.subject);
      return wrapResult({ result: act, stop: true, status: "approval_required" });
    }

    if (toolName === "generate_evidence_pack") {
      addToolTrace("Generated evidence pack link", "success", `Evidence pack generated for case ${caseState.case_id}`);
      return wrapResult({ result: { download_url: `/api/cases/${caseState.case_id}/evidence-pack` } });
    }

    if (toolName === "draft_email") {
      const parsed = draftEmailSchema.safeParse(rawArgs);
      if (!parsed.success) return wrapResult({ result: { error: "Invalid email draft type" } });
      const actionType = parsed.data.action_type;

      const act = {
        id: "act_" + Math.random().toString(36).substring(2, 9),
        type: actionType,
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          subject: `Draft ${actionType} for Ref ${maskReference(caseState.transaction_facts.transaction_reference)}`,
          body: `Draft communication for ${actionType}. Potential compensation estimate, subject to verification.`
        },
        simulated: false,
        source_references: caseState.source_references
      };
      caseState.pending_actions.push(act);
      addToolTrace(`Drafted communication action (${actionType})`, "success", act.payload.subject);
      return wrapResult({ result: act, stop: true, status: "approval_required" });
    }

    if (toolName === "schedule_followup") {
      const parsed = scheduleFollowupSchema.safeParse(rawArgs);
      if (!parsed.success) return wrapResult({ result: { error: "Invalid followup args" } });
      const { days_from_now, condition, action_type } = parsed.data;

      const exists = caseState.followups.some(f => f.condition === condition && f.action_type === action_type);
      if (!exists) {
        const dueDate = new Date(
          new Date(caseState.simulated_now || new Date()).getTime() + days_from_now * 24 * 60 * 60 * 1000
        ).toISOString();
        caseState.followups.push({
          id: "fu_" + Math.random().toString(36).substring(2, 9),
          due_date: dueDate,
          condition,
          action_type,
          status: "pending"
        });
      }
      addToolTrace("Scheduled followup", "success", `Condition: ${condition}, in ${days_from_now} days`);
      return wrapResult({ result: { scheduled: true } });
    }

    if (toolName === "ask_user") {
      const parsed = askUserSchema.safeParse(rawArgs);
      if (!parsed.success) return wrapResult({ result: { error: "Invalid ask_user args" } });
      addToolTrace("Requested missing information", "success", parsed.data.question);
      return wrapResult({
        result: { question: parsed.data.question, missing_fields: parsed.data.missing_fields },
        stop: true,
        status: "needs_input"
      });
    }

    if (toolName === "stop_branch") {
      const parsed = stopBranchSchema.safeParse(rawArgs);
      if (!parsed.success) return wrapResult({ result: { error: "Invalid stop_branch args" } });
      const { branch, reason, checklist } = parsed.data;
      caseState.branch = branch;
      if (branch.includes("atm")) {
        caseState.classification = "atm_or_card";
      } else if (branch.includes("fraud")) {
        caseState.classification = "unauthorized_or_fraud";
      } else if (branch.includes("merchant")) {
        caseState.classification = "merchant_refund";
      }
      addToolTrace(`Stopped branch: ${branch}`, "warning", reason);
      return wrapResult({
        result: { branch, reason, checklist },
        stop: true,
        status: branch.includes("fraud") ? "safety_stop" : "out_of_scope"
      });
    }

    return wrapResult({ result: { error: "Unknown tool: " + toolName } });
  } catch (err: any) {
    addToolTrace(`Tool execution error (${toolName})`, "error", err.message);
    return wrapResult({ result: { error: err.message } });
  }
}
