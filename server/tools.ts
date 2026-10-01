import { z } from "zod";
import { type FunctionDeclaration, Type } from "@google/genai";
import { type CaseState, loadDb, saveDb } from "./store.ts";
import { loadVerifiedRules, calculateTATDeadlineAndCompensation } from "./rules-engine.ts";
import { findBankContact, loadBankContacts } from "./email.ts";

// Secret Redaction & Masking (no stateful regex lastIndex bug)
export function redactSecrets(text: string): { redactedText: string; foundSecrets: boolean; secretTypes: string[] } {
  if (!text) return { redactedText: "", foundSecrets: false, secretTypes: [] };

  let foundSecrets = false;
  const secretTypes: string[] = [];
  let clean = text;

  // Redact UPI PIN / MPIN (e.g. "my upi pin is 1234", "pin: 5678", "mpin 123456")
  const pinRegex = /\b(?:upi\s*pin|mpin|atm\s*pin|pin)\b(?:\s+(?:is|was|code|number|:|=|-))*\s*([0-9]{4,6})\b/i;
  if (pinRegex.test(clean)) {
    foundSecrets = true;
    secretTypes.push("PIN");
    clean = clean.replace(/\b(?:upi\s*pin|mpin|atm\s*pin|pin)\b(?:\s+(?:is|was|code|number|:|=|-))*\s*([0-9]{4,6})\b/gi, "[REDACTED_PIN]");
  }

  // Redact OTP (e.g. "Your OTP is 894321", "otp: 4839")
  const otpRegex = /\b(?:otp|one\s*time\s*password)\b(?:\s+(?:is|was|code|number|:|=|-))*\s*([0-9]{4,8})\b/i;
  if (otpRegex.test(clean)) {
    foundSecrets = true;
    secretTypes.push("OTP");
    clean = clean.replace(/\b(?:otp|one\s*time\s*password)\b(?:\s+(?:is|was|code|number|:|=|-))*\s*([0-9]{4,8})\b/gi, "[REDACTED_OTP]");
  }

  // Redact CVV
  const cvvRegex = /\b(?:cvv|cvc)[\s:=_-]*([0-9]{3,4})/i;
  if (cvvRegex.test(clean)) {
    foundSecrets = true;
    secretTypes.push("CVV");
    clean = clean.replace(/\b(?:cvv|cvc)[\s:=_-]*([0-9]{3,4})/gi, "CVV: [REDACTED_CVV]");
  }

  // Redact Passwords
  const passRegex = /\b(?:password|passcode)[\s:=_-]*([^\s,]{4,20})/i;
  if (passRegex.test(clean)) {
    foundSecrets = true;
    secretTypes.push("Password");
    clean = clean.replace(/\b(?:password|passcode)[\s:=_-]*([^\s,]{4,20})/gi, "Password: [REDACTED_PASSWORD]");
  }

  // Redact 16-digit card numbers
  const cardRegex = /\b(?:\d{4}[-\s]?){3}\d{4}\b/;
  if (cardRegex.test(clean)) {
    foundSecrets = true;
    secretTypes.push("CardNumber");
    clean = clean.replace(/\b(?:\d{4}[-\s]?){3}\d{4}\b/g, "[REDACTED_CARD_NUMBER]");
  }

  // Redact 12-digit Aadhaar numbers
  const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
  if (aadhaarRegex.test(clean)) {
    foundSecrets = true;
    secretTypes.push("Aadhaar");
    clean = clean.replace(/\b\d{4}\s?\d{4}\s?\d{4}\b/g, "[REDACTED_AADHAAR]");
  }

  return { redactedText: clean, foundSecrets, secretTypes };
}

export function maskReference(ref: string | null | undefined): string {
  if (!ref) return "N/A";
  const trimmed = ref.trim();
  if (trimmed.length <= 4) return "****";
  return "****" + trimmed.slice(-4);
}

// Zod Schemas for Tool Arguments
export const updateCaseFactsSchema = z.object({
  amount: z.number().positive().optional().nullable(),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  transaction_reference: z.string().min(3).optional().nullable(),
  bank_or_provider: z.string().optional().nullable(),
  transaction_status: z.string().optional().nullable(),
  beneficiary_status: z.string().optional().nullable(),
  merchant_name: z.string().optional().nullable(),
  bank_complaint_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
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
    description: "Extract evidence from attached image or text.",
    parameters: { type: Type.OBJECT, properties: {} }
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
    description: "Calculate deterministic statutory TAT reversal deadline and potential delay compensation.",
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: "validate_ombudsman_preconditions",
    description: "Validate preconditions under the RBI Integrated Ombudsman Scheme (30-day waiting period from initial bank complaint).",
    parameters: { type: Type.OBJECT, properties: {} }
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

// Tool Execution Handler
export function executeToolCall(toolName: string, rawArgs: any, caseState: CaseState): { result: any; stop?: boolean; status?: string } {
  const rulesData = loadVerifiedRules();

  const addToolTrace = (label: string, status: string, summary: string) => {
    caseState.trace.unshift({
      id: "tr_" + Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString(),
      event_type: "TOOL_CALL",
      label,
      tool_name: toolName,
      branch: caseState.branch,
      status,
      summary,
      source_ids: caseState.source_references.map((s: any) => s.rule_id)
    });
  };

  try {
    if (toolName === "get_case_state") {
      addToolTrace("Retrieved case state", "success", `Case ID ${caseState.case_id}`);
      return { result: caseState };
    }

    if (toolName === "update_case_facts") {
      const parsed = updateCaseFactsSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return { result: { error: "Invalid arguments", details: parsed.error.format() } };
      }
      const args = parsed.data;

      if (args.transaction_date) {
        const d = new Date(args.transaction_date);
        const now = new Date(caseState.simulated_now || new Date());
        if (d > now) {
          return { result: { error: "Transaction date cannot be in the future relative to current date." } };
        }
        caseState.transaction_facts.transaction_date = args.transaction_date;
      }
      if (args.amount !== undefined && args.amount !== null) {
        if (args.amount <= 0) return { result: { error: "Amount must be a positive number." } };
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

      addToolTrace("Updated case facts", "success", `Amount: ₹${f.amount}, Ref: ${maskReference(f.transaction_reference)}, Missing: ${missing.join(", ")}`);
      return { result: { facts: caseState.transaction_facts, missing_fields: missing } };
    }

    if (toolName === "record_classification") {
      const parsed = recordClassificationSchema.safeParse(rawArgs);
      if (!parsed.success) {
        return { result: { error: "Invalid classification arguments", details: parsed.error.format() } };
      }
      const args = parsed.data;

      // High-precision safety check: genuine unauthorized/fraud claims
      let classification = args.classification;
      const chatText = caseState.chat_history.map(c => c.text).join(" ").toLowerCase();
      const isGenuineUnauthorized =
        chatText.includes("did not make this transaction") ||
        chatText.includes("unauthorized transaction") ||
        chatText.includes("unauthorized debit") ||
        chatText.includes("account was hacked") ||
        chatText.includes("account hacked") ||
        chatText.includes("someone used my account") ||
        chatText.includes("stolen money") ||
        chatText.includes("fraudulent transaction");

      if (isGenuineUnauthorized) {
        classification = "unauthorized_or_fraud";
        caseState.safety_flags.push("genuine_unauthorized_transaction_safety_override");
        addToolTrace("Safety override applied", "warning", "Classified as unauthorized_or_fraud due to explicit account compromise / theft claim.");
      }

      caseState.classification = classification;
      caseState.classification_confidence = args.confidence;
      caseState.classification_rationale = args.rationale;
      caseState.branch = classification === "unauthorized_or_fraud"
        ? "fraud_safety_branch"
        : (classification === "merchant_refund"
          ? "merchant_refund_branch"
          : (classification === "atm_or_card"
            ? "out_of_scope_atm"
            : "supported_upi_failed_debit"));

      addToolTrace(`Classified grievance as ${classification}`, "success", args.rationale);
      return { result: { classification, branch: caseState.branch, confidence: args.confidence } };
    }

    if (toolName === "lookup_verified_rule") {
      const f = caseState.transaction_facts;
      if (!f.amount || !f.transaction_date || !f.transaction_reference || !f.bank_or_provider) {
        return {
          result: {
            applicable: false,
            reason: "insufficient_evidence",
            missing: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"].filter(k => !(f as any)[k])
          }
        };
      }

      if (caseState.classification === "supported_upi_failed_debited_not_credited") {
        caseState.verified_rule_id = "rbi_failed_transaction_upi_debit_not_credited";
        caseState.source_references = [rulesData.rules[0]];
        addToolTrace("Lookup verified rule success", "success", "Matched RBI Circular RBI/2019-20/67.");
        return {
          result: {
            applicable: true,
            rule_id: "rbi_failed_transaction_upi_debit_not_credited",
            source: rulesData.rules[0]
          }
        };
      }

      return { result: { applicable: false, reason: "Rule not applicable for classification: " + caseState.classification } };
    }

    if (toolName === "calculate_deadline_and_estimate") {
      const f = caseState.transaction_facts;
      if (!f.transaction_date) {
        return { result: { error: "Missing transaction date for statutory calculation." } };
      }
      try {
        const calc = calculateTATDeadlineAndCompensation(f.transaction_date, caseState.simulated_now || new Date().toISOString());
        addToolTrace("Calculated statutory TAT and compensation", "success", calc.explanation);
        return { result: calc };
      } catch (e: any) {
        return { result: { error: e.message } };
      }
    }

    if (toolName === "validate_ombudsman_preconditions") {
      const hasBankComplaint = !!caseState.bank_complaint_date;
      const complaintDate = hasBankComplaint ? new Date(caseState.bank_complaint_date!) : null;
      const now = new Date(caseState.simulated_now || new Date());
      const daysSinceComplaint = complaintDate ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      const waited30Days = daysSinceComplaint >= 30 || caseState.bank_response === "rejected" || caseState.escalation_stage.includes("nodal");

      const eligibleNow = waited30Days && hasBankComplaint;
      addToolTrace("Validated RBI Ombudsman preconditions", "success", `Eligible now: ${eligibleNow}, Days since complaint: ${daysSinceComplaint}`);
      return {
        result: {
          eligible_now: eligibleNow,
          eligible_later: !waited30Days && hasBankComplaint,
          not_eligible: !hasBankComplaint,
          days_since_complaint: daysSinceComplaint,
          source: rulesData.rules[1]
        }
      };
    }

    if (toolName === "generate_bank_complaint") {
      const f = caseState.transaction_facts;
      const bankInfo = findBankContact(f.bank_or_provider);
      const recipientEmail = bankInfo ? bankInfo.grievance_email : `support@${(f.bank_or_provider || "bank").toLowerCase().replace(/[^a-z0-9]/g, "")}.co.in`;

      const act = {
        id: "act_" + Math.random().toString(36).substring(2, 9),
        type: "bank_complaint",
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          recipient: recipientEmail,
          bank_name: bankInfo ? bankInfo.name : f.bank_or_provider,
          bank_verified: !!bankInfo,
          subject: `Grievance Redressal: UPI Failed & Debited (Ref: ${maskReference(f.transaction_reference)})`,
          body: `To Customer Support / Grievance Redressal Officer,\n${bankInfo ? bankInfo.name : (f.bank_or_provider || "Bank")}\n\nMy UPI transaction of ₹${f.amount} executed on ${f.transaction_date} (Transaction Reference: ${maskReference(f.transaction_reference)}) was debited from my account, but beneficiary account was not credited.\n\nAs mandated under RBI Circular RBI/2019-20/67 (Harmonisation of Turn Around Time and customer compensation for failed transactions), automatic reversal is required within T+1 calendar day.\n\nKindly investigate and confirm reversal. Potential compensation estimate, subject to verification.`
        },
        simulated: false,
        source_references: caseState.source_references
      };
      caseState.pending_actions.push(act);
      addToolTrace("Generated bank complaint draft", "success", act.payload.subject);
      return { result: act };
    }

    if (toolName === "generate_nodal_escalation") {
      const f = caseState.transaction_facts;
      const bankInfo = findBankContact(f.bank_or_provider);
      const recipientEmail = bankInfo ? bankInfo.nodal_officer_email : `nodal@${(f.bank_or_provider || "bank").toLowerCase().replace(/[^a-z0-9]/g, "")}.co.in`;

      const act = {
        id: "act_" + Math.random().toString(36).substring(2, 9),
        type: "nodal_officer_escalation",
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          recipient: recipientEmail,
          bank_name: bankInfo ? bankInfo.name : f.bank_or_provider,
          bank_verified: !!bankInfo,
          subject: `ESCALATION: Unresolved UPI Dispute Beyond TAT (Ref: ${maskReference(f.transaction_reference)})`,
          body: `To Principal Nodal Officer,\n${bankInfo ? bankInfo.name : (f.bank_or_provider || "Bank")}\n\nInitial complaint regarding UPI failure (Amount: ₹${f.amount}, Ref: ${maskReference(f.transaction_reference)}) remains unresolved beyond the statutory TAT window.\n\nUnder RBI Circular RBI/2019-20/67, customer is entitled to delayed reversal compensation of ₹100 per day beyond T+1. Potential compensation estimate, subject to verification.\n\nKindly intervene to effect immediate resolution.`
        },
        simulated: false,
        source_references: caseState.source_references
      };
      caseState.pending_actions.push(act);
      addToolTrace("Generated Nodal escalation draft", "success", act.payload.subject);
      return { result: act };
    }

    if (toolName === "generate_ombudsman_draft") {
      const hasBankComplaint = !!caseState.bank_complaint_date;
      const complaintDate = hasBankComplaint ? new Date(caseState.bank_complaint_date!) : null;
      const now = new Date(caseState.simulated_now || new Date());
      const days = complaintDate ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
      if (!hasBankComplaint || (days < 30 && caseState.bank_response !== "rejected")) {
        return { result: { error: "Ombudsman escalation blocked: must have bank complaint and wait 30 days or receive adverse response." } };
      }

      const f = caseState.transaction_facts;
      const act = {
        id: "act_" + Math.random().toString(36).substring(2, 9),
        type: "rbi_ombudsman_draft",
        status: "pending_approval",
        requires_approval: true,
        created_at: new Date().toISOString(),
        payload: {
          portal_url: "https://cms.rbi.org.in",
          subject: `RBI Ombudsman Grievance Submission Pack - Ref ${maskReference(f.transaction_reference)}`,
          body: `=== RBI COMPLAINT MANAGEMENT SYSTEM (CMS) PACK ===\nRegulated Entity: ${f.bank_or_provider || "Bank"}\nTransaction Date: ${f.transaction_date}\nAmount: ₹${f.amount}\nReference: ${maskReference(f.transaction_reference)}\nInitial Complaint Date: ${caseState.bank_complaint_date}\nDays Elapsed: ${days}\n\nRelief Claimed: Full reversal of ₹${f.amount} plus statutory delay compensation under RBI Circular RBI/2019-20/67.\n\nNOTE: Submission happens on the official Reserve Bank of India CMS portal at https://cms.rbi.org.in. This pack contains structured details for direct entry.`
        },
        simulated: false,
        source_references: [rulesData.rules[1]]
      };
      caseState.pending_actions.push(act);
      addToolTrace("Generated RBI Ombudsman submission package", "success", act.payload.subject);
      return { result: act };
    }

    if (toolName === "generate_evidence_pack") {
      addToolTrace("Generated evidence pack link", "success", `Evidence pack generated for case ${caseState.case_id}`);
      return { result: { download_url: `/api/cases/${caseState.case_id}/evidence-pack` } };
    }

    if (toolName === "draft_email") {
      const parsed = draftEmailSchema.safeParse(rawArgs);
      if (!parsed.success) return { result: { error: "Invalid email draft type" } };
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
      return { result: act, stop: true, status: "approval_required" };
    }

    if (toolName === "schedule_followup") {
      const parsed = scheduleFollowupSchema.safeParse(rawArgs);
      if (!parsed.success) return { result: { error: "Invalid followup args" } };
      const { days_from_now, condition, action_type } = parsed.data;

      const exists = caseState.followups.some(f => f.condition === condition && f.action_type === action_type);
      if (!exists) {
        const dueDate = new Date(new Date(caseState.simulated_now || new Date()).getTime() + days_from_now * 24 * 60 * 60 * 1000).toISOString();
        caseState.followups.push({
          id: "fu_" + Math.random().toString(36).substring(2, 9),
          due_date: dueDate,
          condition,
          action_type,
          status: "pending"
        });
      }
      addToolTrace("Scheduled followup", "success", `Condition: ${condition}, in ${days_from_now} days`);
      return { result: { scheduled: true } };
    }

    if (toolName === "ask_user") {
      const parsed = askUserSchema.safeParse(rawArgs);
      if (!parsed.success) return { result: { error: "Invalid ask_user args" } };
      addToolTrace("Requested missing information", "success", parsed.data.question);
      return { result: { question: parsed.data.question, missing_fields: parsed.data.missing_fields }, stop: true, status: "needs_input" };
    }

    if (toolName === "stop_branch") {
      const parsed = stopBranchSchema.safeParse(rawArgs);
      if (!parsed.success) return { result: { error: "Invalid stop_branch args" } };
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
      return { result: { branch, reason, checklist }, stop: true, status: branch.includes("fraud") ? "safety_stop" : "out_of_scope" };
    }

    return { result: { error: "Unknown tool: " + toolName } };
  } catch (err: any) {
    addToolTrace(`Tool execution error (${toolName})`, "error", err.message);
    return { result: { error: err.message } };
  }
}
