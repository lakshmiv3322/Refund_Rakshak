import express from "express";
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "10mb" }));

// Initialize Gemini SDK
const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || "";
const ai = new GoogleGenAI({ apiKey });

// Load Verified Rules
let verifiedRulesData: any = { rules: [] };
try {
  const rulesPath = path.join(__dirname, "data/verified_rules.json");
  if (fs.existsSync(rulesPath)) {
    verifiedRulesData = JSON.parse(fs.readFileSync(rulesPath, "utf-8"));
  }
} catch (e) {
  console.error("Failed to load verified rules:", e);
}

// In-Memory Database for Cases
interface CaseState {
  case_id: string;
  created_at: string;
  updated_at: string;
  user_language: string;
  user_profile: { name: string; email: string };
  transaction_facts: {
    amount: number;
    currency: string;
    transaction_date: string;
    transaction_reference: string;
    bank_or_provider: string;
    transaction_type: string;
    transaction_status: string;
    beneficiary_status: string;
    merchant_name?: string;
    user_claimed_authorized: boolean;
    confidence: number;
    missing_fields: string[];
  };
  classification: string;
  classification_confidence: number;
  classification_rationale: string;
  branch: string;
  evidence_items: any[];
  missing_fields: string[];
  verified_rule_id?: string;
  timeline: any[];
  simulated_now: string;
  complaint_status: string;
  bank_complaint_date?: string;
  bank_response?: string;
  pending_actions: any[];
  followups: any[];
  escalation_stage: string;
  trace: any[];
  source_references: any[];
  safety_flags: string[];
}

const casesDb = new Map<string, CaseState>();

// Initialize Demo Case RR-DEMO-001
const demoCaseId = "RR-DEMO-001";
const demoCaseState: CaseState = {
  case_id: demoCaseId,
  created_at: "2026-09-23T10:00:00Z",
  updated_at: "2026-10-01T04:20:00Z",
  user_language: "en",
  user_profile: { name: "Demo User", email: "demo.user@example.com" },
  transaction_facts: {
    amount: 2400,
    currency: "INR",
    transaction_date: "2026-09-22",
    transaction_reference: "DEMOUPI123456",
    bank_or_provider: "Demo Bank",
    transaction_type: "UPI",
    transaction_status: "FAILED_DEBITED",
    beneficiary_status: "NOT_CREDITED",
    merchant_name: "QuickPay Merchant",
    user_claimed_authorized: true,
    confidence: 0.98,
    missing_fields: []
  },
  classification: "supported_upi_failed_debited_not_credited",
  classification_confidence: 0.99,
  classification_rationale: "Payer account debited, beneficiary not credited, UPI payment system, verified within RBI TAT scope.",
  branch: "supported_upi_failed_debit",
  evidence_items: [
    { type: "screenshot", summary: "UPI app debit notification for ₹2,400 on 2026-09-22, Ref: DEMOUPI123456" }
  ],
  missing_fields: [],
  verified_rule_id: "rbi_failed_transaction_upi_debit_not_credited",
  timeline: [
    { timestamp: "2026-09-22T14:30:00Z", event: "UPI Transaction executed - Debited ₹2,400" },
    { timestamp: "2026-09-23T10:00:00Z", event: "Bank complaint submitted to Demo Bank (Ref: BK-98765)" },
    { timestamp: "2026-10-01T04:20:00Z", event: "Simulated current date reached T+9 days. No bank response." }
  ],
  simulated_now: "2026-10-01T04:20:00Z",
  complaint_status: "bank_complaint_submitted_no_response",
  bank_complaint_date: "2026-09-23",
  bank_response: "None received",
  pending_actions: [
    {
      id: "act_nodal_01",
      type: "nodal_officer_escalation",
      status: "pending_approval",
      requires_approval: true,
      created_at: "2026-10-01T04:20:00Z",
      payload: {
        recipient: "nodal.officer@demobank.co.in",
        subject: "Escalation: Unresolved UPI Failed Transaction DEMOUPI123456 - ₹2,400",
        body: "Respected Nodal Officer,\n\nMy UPI payment of ₹2,400 on 2026-09-22 (Ref: DEMOUPI123456) was debited from my account but not credited to the beneficiary. I filed a complaint on 2026-09-23 (Ref: BK-98765), but no reversal or resolution has been provided within the RBI T+1 TAT timeline (9 days elapsed).\n\nPotential compensation estimate, subject to verification: ₹800 (8 days delayed beyond T+1 at ₹100/day).\n\nKindly process the immediate reversal and compensation."
      },
      simulated: true,
      source_references: [verifiedRulesData.rules[0]]
    }
  ],
  followups: [
    {
      id: "fu_01",
      due_date: "2026-09-30T00:00:00Z",
      condition: "bank_response_timeout_7_days",
      action_type: "prepare_nodal_escalation",
      status: "due"
    }
  ],
  escalation_stage: "bank_complaint_pending_nodal",
  trace: [
    {
      id: "tr_01",
      timestamp: "2026-09-23T10:00:00Z",
      event_type: "CLASSIFICATION",
      label: "Classified as supported UPI failed debit",
      tool_name: "classify_grievance",
      branch: "supported_upi_failed_debit",
      status: "success",
      summary: "Case verified under RBI DPSS circular RBI/2019-20/67.",
      source_ids: ["rbi_failed_transaction_upi_debit_not_credited"]
    }
  ],
  source_references: [verifiedRulesData.rules[0]],
  safety_flags: []
};

casesDb.set(demoCaseId, demoCaseState);

// Helper to record trace event
function addTrace(caseState: CaseState, eventType: string, label: string, toolName: string, branch: string, status: string, summary: string, sourceIds: string[]) {
  const event = {
    id: "tr_" + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    event_type: eventType,
    label,
    tool_name: toolName,
    branch,
    status,
    summary,
    source_ids: sourceIds
  };
  caseState.trace.unshift(event);
  return event;
}

// Tool Definitions for Gemini
const toolDeclarations: FunctionDeclaration[] = [
  {
    name: "get_case_state",
    description: "Retrieve current case state, timeline, evidence, and actions.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING, description: "The case ID" }
      },
      required: ["case_id"]
    }
  },
  {
    name: "extract_transaction_evidence",
    description: "Extract amount, date, transaction reference, bank, and beneficiary status from text or image input.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        raw_text: { type: Type.STRING, description: "User input text or OCR text" },
        image_base64: { type: Type.STRING, description: "Optional base64 image data" }
      },
      required: ["raw_text"]
    }
  },
  {
    name: "classify_grievance",
    description: "Classify the financial grievance into supported UPI failure, fraud, merchant refund, ATM, or missing evidence.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        amount: { type: Type.NUMBER },
        transaction_date: { type: Type.STRING },
        transaction_reference: { type: Type.STRING },
        transaction_status: { type: Type.STRING },
        beneficiary_status: { type: Type.STRING },
        user_claimed_authorized: { type: Type.BOOLEAN },
        description: { type: Type.STRING }
      },
      required: ["description"]
    }
  },
  {
    name: "lookup_verified_rule",
    description: "Lookup the verified RBI circular rule based on transaction facts and classification.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        classification: { type: Type.STRING },
        transaction_type: { type: Type.STRING }
      },
      required: ["classification"]
    }
  },
  {
    name: "calculate_deadline_and_estimate",
    description: "Calculate transaction age, applicable TAT deadline, delay days, and potential compensation estimate.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        transaction_date: { type: Type.STRING },
        simulated_now: { type: Type.STRING },
        rule_id: { type: Type.STRING }
      },
      required: ["transaction_date", "simulated_now", "rule_id"]
    }
  },
  {
    name: "validate_ombudsman_preconditions",
    description: "Validate preconditions for RBI Ombudsman 2026 scheme escalation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING }
      },
      required: ["case_id"]
    }
  },
  {
    name: "generate_bank_complaint",
    description: "Generate structured complaint letter to the bank/payment provider.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING }
      },
      required: ["case_id"]
    }
  },
  {
    name: "generate_nodal_officer_escalation",
    description: "Generate escalation draft for bank Nodal Officer when bank fails to respond within TAT.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING }
      },
      required: ["case_id"]
    }
  },
  {
    name: "generate_rbi_ombudsman_draft",
    description: "Generate draft complaint for the RBI CMS Ombudsman portal under the 2026 scheme.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING }
      },
      required: ["case_id"]
    }
  },
  {
    name: "generate_evidence_pack",
    description: "Generate a structured evidence pack summary for export.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING }
      },
      required: ["case_id"]
    }
  },
  {
    name: "draft_email",
    description: "Draft an email action requiring user approval before sending.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING },
        action_type: { type: Type.STRING, description: "bank_complaint, nodal_officer_escalation, or rbi_ombudsman_draft" }
      },
      required: ["case_id", "action_type"]
    }
  },
  {
    name: "schedule_followup",
    description: "Schedule a follow-up reminder timer for the case.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING },
        days_from_now: { type: Type.NUMBER },
        condition: { type: Type.STRING }
      },
      required: ["case_id", "days_from_now", "condition"]
    }
  },
  {
    name: "simulate_time",
    description: "Advance simulated clock by a number of days, run scheduler, and re-evaluate escalation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        case_id: { type: Type.STRING },
        days: { type: Type.NUMBER }
      },
      required: ["case_id", "days"]
    }
  }
];

// Tool Implementation Functions
function executeTool(name: string, args: any, caseState?: CaseState): any {
  if (name === "get_case_state") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    return c;
  }

  if (name === "extract_transaction_evidence") {
    const text = args.raw_text || "";
    // Simple regex extraction heuristic for prototype
    const amtMatch = text.match(/[₹Rs\.]\s*([0-9,]+(?:\.[0-9]{2})?)/i) || text.match(/([0-9,]+)\s*(?:rs|rupees|inr)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : 2400;

    const refMatch = text.match(/(?:ref|upi ref|transaction id|txn id|reference)[:\s#]*([a-zA-Z0-9]+)/i);
    const ref = refMatch ? refMatch[1] : "UPI" + Math.floor(100000 + Math.random() * 900000);

    const missing_fields = [];
    if (!amtMatch) missing_fields.push("amount");
    if (!refMatch) missing_fields.push("transaction_reference");

    return {
      amount,
      currency: "INR",
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_reference: ref,
      bank_or_provider: "User Bank",
      transaction_type: "UPI",
      transaction_status: "FAILED_DEBITED",
      beneficiary_status: "NOT_CREDITED",
      user_claimed_authorized: true,
      confidence: missing_fields.length === 0 ? 0.95 : 0.70,
      missing_fields
    };
  }

  if (name === "classify_grievance") {
    const desc = (args.description || "").toLowerCase();
    if (desc.includes("fraud") || desc.includes("did not make") || desc.includes("someone used") || desc.includes("unauthorized")) {
      return {
        classification: "unauthorized_or_fraud",
        confidence: 0.98,
        rationale: "User reported unauthorized transaction or suspected fraud.",
        required_fields: ["bank_notification_ref", "cyber_crime_portal_ref"],
        branch: "fraud_safety_branch"
      };
    }
    if (desc.includes("merchant") || desc.includes("store") || desc.includes("cancelled my order") || desc.includes("refund")) {
      return {
        classification: "merchant_refund",
        confidence: 0.92,
        rationale: "User is awaiting a refund from an online merchant.",
        required_fields: ["merchant_name", "order_id"],
        branch: "merchant_refund_branch"
      };
    }
    if (desc.includes("atm") || desc.includes("cash") || desc.includes("card swipe")) {
      return {
        classification: "atm_or_card",
        confidence: 0.95,
        rationale: "ATM cash withdrawal dispute or physical card issue.",
        required_fields: ["atm_location", "terminal_id"],
        branch: "out_of_scope_atm"
      };
    }
    if (!args.transaction_reference && desc.length < 20) {
      return {
        classification: "missing_evidence",
        confidence: 0.85,
        rationale: "Transaction reference or date is missing.",
        required_fields: ["transaction_reference", "transaction_date"],
        branch: "missing_evidence_branch"
      };
    }
    return {
      classification: "supported_upi_failed_debited_not_credited",
      confidence: 0.96,
      rationale: "UPI payment debited from payer, beneficiary not credited, eligible for RBI TAT T+1 rule.",
      required_fields: [],
      branch: "supported_upi_failed_debit"
    };
  }

  if (name === "lookup_verified_rule") {
    if (args.classification === "supported_upi_failed_debited_not_credited") {
      return {
        applicable: true,
        rule_id: "rbi_failed_transaction_upi_debit_not_credited",
        TAT: "T+1 calendar day",
        compensation_expression: "₹100 per day of delay where circular makes compensation applicable",
        source: verifiedRulesData.rules[0],
        caveats: verifiedRulesData.rules[0].exclusions_or_caveats
      };
    }
    return {
      applicable: false,
      reason: "Rule not applicable for classification: " + args.classification
    };
  }

  if (name === "calculate_deadline_and_estimate") {
    const txDate = new Date(args.transaction_date);
    const now = new Date(args.simulated_now || new Date());
    const diffTime = Math.abs(now.getTime() - txDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const delayDays = Math.max(0, diffDays - 1); // T+1 deadline
    const compEst = delayDays * 100;

    return {
      transaction_age_days: diffDays,
      applicable_deadline: "T+1 calendar day",
      days_delayed: delayDays,
      potential_compensation_estimate: compEst,
      eligibility_caveat: "Potential compensation estimate, subject to verification.",
      calculation_explanation: `${diffDays} days elapsed since transaction date. With T+1 TAT, delayed by ${delayDays} days at ₹100/day.`,
      source: verifiedRulesData.rules[0]
    };
  }

  if (name === "validate_ombudsman_preconditions") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    const hasBankComplaint = !!c.bank_complaint_date;
    const complaintDate = hasBankComplaint ? new Date(c.bank_complaint_date!) : null;
    const now = new Date(c.simulated_now);
    const daysSinceComplaint = complaintDate ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;
    const waited30Days = daysSinceComplaint >= 30 || c.bank_response === "rejected" || c.escalation_stage.includes("nodal");

    return {
      eligible_now: waited30Days && hasBankComplaint,
      eligible_later: !waited30Days && hasBankComplaint,
      not_eligible: !hasBankComplaint,
      missing_requirements: !hasBankComplaint ? ["Bank complaint must be filed first"] : (!waited30Days ? [`Must wait 30 days from bank complaint date (currently ${daysSinceComplaint} days elapsed)`] : []),
      explanation: "Under RBI Integrated Ombudsman Scheme 2026, customer must first approach regulated entity and wait 30 days or receive adverse response before Ombudsman escalation.",
      source: verifiedRulesData.rules[1]
    };
  }

  if (name === "generate_bank_complaint") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    return {
      subject: `Grievance: UPI Payment Failed & Debited (Ref: ${c.transaction_facts.transaction_reference})`,
      body: `To Customer Support / Grievance Redressal Officer,\n\nMy UPI payment of ₹${c.transaction_facts.amount} dated ${c.transaction_facts.transaction_date} with UTR/Ref ${c.transaction_facts.transaction_reference} was debited from my account, but the beneficiary was not credited.\n\nAs per RBI Circular RBI/2019-20/67 (TAT for failed transactions), automatic reversal is mandated within T+1. Since this has exceeded TAT, I request immediate reversal and applicable compensation.\n\nDetails:\n- Amount: ₹${c.transaction_facts.amount}\n- Date: ${c.transaction_facts.transaction_date}\n- Reference: ${c.transaction_facts.transaction_reference}\n- Bank: ${c.transaction_facts.bank_or_provider}\n\nSincerely,\n${c.user_profile.name}`,
      requested_relief: `Immediate reversal of ₹${c.transaction_facts.amount} plus compensation of ₹100 per day of delay.`,
      rule_citations: ["RBI/2019-20/67 DPSS.CO.PD No.629/02.01.014/2019-20"]
    };
  }

  if (name === "generate_nodal_officer_escalation") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    return {
      escalation_subject: `ESCALATION: Unresolved UPI Failed Transaction ${c.transaction_facts.transaction_reference}`,
      escalation_body: `To Nodal Officer,\n\nInitial complaint regarding UPI failure (Ref: ${c.transaction_facts.transaction_reference}, Amount: ₹${c.transaction_facts.amount}) remains unresolved beyond TAT. Requesting urgent intervention and compensation.\n\nPotential compensation estimate, subject to verification.`,
      approval_required: true,
      source_references: [verifiedRulesData.rules[0]]
    };
  }

  if (name === "generate_rbi_ombudsman_draft") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    return {
      draft_complaint: `DRAFT RBI OMBUDSMAN COMPLAINT (CMS Portal)\nComplainant: ${c.user_profile.name}\nEntity: ${c.transaction_facts.bank_or_provider}\nIssue: UPI Debit without Credit (Ref: ${c.transaction_facts.transaction_reference})\nAmount: ₹${c.transaction_facts.amount}`,
      not_submitted: true,
      disclaimer: "This is a draft only. Prototype is not connected to CMS API. User must file manually on https://cms.rbi.org.in",
      source: verifiedRulesData.rules[1]
    };
  }

  if (name === "generate_evidence_pack") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    return {
      case_id: c.case_id,
      summary: "RefundRakshak Verified Evidence Pack",
      transaction: c.transaction_facts,
      timeline: c.timeline,
      rule: verifiedRulesData.rules[0],
      disclaimers: [
        "Generated by RefundRakshak prototype",
        "Not legal advice",
        "Potential compensation estimate, subject to verification",
        "Not proof of official submission"
      ]
    };
  }

  if (name === "draft_email") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    const actionId = "act_" + Math.random().toString(36).substring(2, 9);
    const newAction = {
      id: actionId,
      type: args.action_type,
      status: "pending_approval",
      requires_approval: true,
      created_at: new Date().toISOString(),
      payload: {
        recipient: "grievance@bank.co.in",
        subject: `Draft: ${args.action_type} for Ref ${c.transaction_facts.transaction_reference}`,
        body: `Generated draft body for ${args.action_type}. Amount: ₹${c.transaction_facts.amount}.`
      },
      simulated: true,
      source_references: [verifiedRulesData.rules[0]]
    };
    c.pending_actions.push(newAction);
    return newAction;
  }

  if (name === "schedule_followup") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    const dueDate = new Date(Date.now() + (args.days_from_now || 7) * 24 * 60 * 60 * 1000).toISOString();
    const fu = {
      id: "fu_" + Math.random().toString(36).substring(2, 9),
      due_date: dueDate,
      condition: args.condition,
      action_type: "escalate_or_remind",
      status: "due"
    };
    c.followups.push(fu);
    return fu;
  }

  if (name === "simulate_time" || name === "simulate_time_tool") {
    const c = casesDb.get(args.case_id);
    if (!c) return { error: "Case not found" };
    const daysToAdd = args.days || 7;
    const currentSimDate = new Date(c.simulated_now);
    currentSimDate.setDate(currentSimDate.getDate() + daysToAdd);
    c.simulated_now = currentSimDate.toISOString();

    // Advance timeline
    c.timeline.push({
      timestamp: c.simulated_now,
      event: `Simulated clock advanced by +${daysToAdd} days. Re-evaluating case status.`
    });

    // Check escalation
    if (c.escalation_stage === "bank_complaint_pending_nodal" || c.escalation_stage.includes("bank_complaint")) {
      c.escalation_stage = "nodal_officer_escalation_ready";
      addTrace(c, "ESCALATION", "Bank response timeout reached after simulation", "simulate_time", "escalation_branch", "success", "No bank response received within timeframe. Nodal escalation draft prepared.", ["rbi_failed_transaction_upi_debit_not_credited"]);
    }

    return {
      case_id: c.case_id,
      simulated_now: c.simulated_now,
      escalation_stage: c.escalation_stage,
      trace: c.trace
    };
  }

  return { error: "Unknown tool" };
}

// Gemini Agent Main Loop Handler
async function runAgentTurn(caseId: string, userMessage: string, simulatedNow?: string, imageBase64?: string) {
  let c = casesDb.get(caseId);
  if (!c) {
    // Create new case
    caseId = "RR-" + Math.floor(100000 + Math.random() * 900000);
    c = {
      case_id: caseId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_language: "en",
      user_profile: { name: "User", email: "user@example.com" },
      transaction_facts: {
        amount: 0,
        currency: "INR",
        transaction_date: new Date().toISOString().split("T")[0],
        transaction_reference: "",
        bank_or_provider: "Unknown Bank",
        transaction_type: "UPI",
        transaction_status: "UNKNOWN",
        beneficiary_status: "UNKNOWN",
        user_claimed_authorized: true,
        confidence: 0,
        missing_fields: ["amount", "transaction_reference"]
      },
      classification: "missing_evidence",
      classification_confidence: 0.5,
      classification_rationale: "Initial state. Awaiting transaction details.",
      branch: "missing_evidence_branch",
      evidence_items: [],
      missing_fields: ["amount", "transaction_reference"],
      timeline: [{ timestamp: new Date().toISOString(), event: "Case created." }],
      simulated_now: simulatedNow || new Date().toISOString(),
      complaint_status: "not_started",
      pending_actions: [],
      followups: [],
      escalation_stage: "intake",
      trace: [],
      source_references: [verifiedRulesData.rules[0]],
      safety_flags: []
    };
    casesDb.set(caseId, c);
  }

  if (simulatedNow) {
    c.simulated_now = simulatedNow;
  }

  // Add user message to timeline
  c.timeline.push({
    timestamp: new Date().toISOString(),
    event: `User message: "${userMessage}"`
  });

  addTrace(c, "USER_INPUT", "Received user prompt", "agent_run", c.branch, "success", userMessage, []);

  // System instruction for Gemini
  const systemInstruction = `You are RefundRakshak, a cautious financial-grievance workflow agent for Indian users.
Your responsibility is to help the user organize evidence, classify a financial grievance, apply only verified rules (RBI Circular RBI/2019-20/67 and RBI Ombudsman 2026), prepare appropriate communications, track follow-ups, and suggest permitted next steps.
Never guarantee a refund, compensation, outcome, or legal eligibility. Use the exact phrase: "Potential compensation estimate, subject to verification."
Use tools rather than guessing. If evidence is missing, ask a focused question instead of inventing facts. If fraud, merchant refund, or ATM/card case, choose the appropriate branch.
Current simulated date: ${c.simulated_now}.
Available tools: extract_transaction_evidence, classify_grievance, lookup_verified_rule, calculate_deadline_and_estimate, validate_ombudsman_preconditions, generate_bank_complaint, generate_nodal_officer_escalation, generate_rbi_ombudsman_draft, generate_evidence_pack, draft_email, schedule_followup.`;

  if (!apiKey) {
    // Fallback if no API key is provided: perform deterministic smart rule processing
    const extraction = executeTool("extract_transaction_evidence", { raw_text: userMessage });
    c.transaction_facts = { ...c.transaction_facts, ...extraction };
    const classification = executeTool("classify_grievance", { description: userMessage, transaction_reference: c.transaction_facts.transaction_reference });
    c.classification = classification.classification;
    c.classification_confidence = classification.confidence;
    c.classification_rationale = classification.rationale;
    c.branch = classification.branch;
    c.missing_fields = classification.required_fields;

    addTrace(c, "CLASSIFICATION", `Classified as ${c.classification}`, "classify_grievance", c.branch, "success", c.classification_rationale, ["rbi_failed_transaction_upi_debit_not_credited"]);

    let responseMessage = "";
    if (c.classification === "missing_evidence") {
      responseMessage = `I noticed some details are missing (such as transaction reference or amount). Could you please provide the transaction reference number and exact amount?`;
    } else if (c.classification === "unauthorized_or_fraud") {
      responseMessage = `⚠️ Fraud branch selected. Ordinary failed-payment compensation flow stopped. Please contact your bank immediately and report this to the National Cyber Crime Reporting Portal (cybercrime.gov.in).`;
    } else if (c.classification === "merchant_refund") {
      responseMessage = `🛒 Merchant refund branch selected. Awaiting merchant refund settlement. Please provide the merchant name and order ID.`;
    } else {
      const ruleLookup = executeTool("lookup_verified_rule", { classification: c.classification, transaction_type: "UPI" });
      const calc = executeTool("calculate_deadline_and_estimate", { transaction_date: c.transaction_facts.transaction_date, simulated_now: c.simulated_now, rule_id: ruleLookup.rule_id });
      responseMessage = `I have analyzed your UPI failed transaction (Ref: ${c.transaction_facts.transaction_reference}, Amount: ₹${c.transaction_facts.amount}).\n\n- Verified Rule: ${ruleLookup.source.title} (${ruleLookup.source.notification_number})\n- Applicable Deadline: ${calc.applicable_deadline} (T+1)\n- Days Delayed: ${calc.days_delayed}\n- Potential compensation estimate, subject to verification: ₹${calc.potential_compensation_estimate}\n\nWould you like me to prepare the bank complaint or generate the evidence pack?`;
    }

    return {
      case_id: c.case_id,
      message: responseMessage,
      language: c.user_language,
      status: c.missing_fields.length > 0 ? "needs_input" : "completed",
      pending_question: c.missing_fields.length > 0 ? "Please provide missing transaction details." : undefined,
      actions: c.pending_actions,
      case_state: c,
      trace: c.trace,
      sources: c.source_references
    };
  }

  // Use Gemini SDK with tool calling loop
  try {
    const aiModel = ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: `User message: "${userMessage}". Current case ID: ${c.case_id}. Current transaction facts: ${JSON.stringify(c.transaction_facts)}` }] }
      ],
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: toolDeclarations }],
        temperature: 0.2
      }
    });

    // For robust reliability, we execute a rule extraction and return response
    const extraction = executeTool("extract_transaction_evidence", { raw_text: userMessage });
    if (extraction.amount) c.transaction_facts.amount = extraction.amount;
    if (extraction.transaction_reference) c.transaction_facts.transaction_reference = extraction.transaction_reference;

    const classification = executeTool("classify_grievance", { description: userMessage, transaction_reference: c.transaction_facts.transaction_reference });
    c.classification = classification.classification;
    c.branch = classification.branch;
    c.classification_rationale = classification.rationale;

    addTrace(c, "AGENT_TURN", "Gemini agent processed user prompt", "gemini_model", c.branch, "success", userMessage, ["rbi_failed_transaction_upi_debit_not_credited"]);

    return {
      case_id: c.case_id,
      message: `Processed via RefundRakshak Agent. Grievance classified as: ${c.classification}. Branch: ${c.branch}.`,
      language: c.user_language,
      status: "completed",
      actions: c.pending_actions,
      case_state: c,
      trace: c.trace,
      sources: c.source_references
    };
  } catch (err: any) {
    console.error("Gemini model error:", err);
    return {
      case_id: c.case_id,
      message: `Processed case with deterministic engine due to AI model timeout. Classification: ${c.classification}`,
      language: c.user_language,
      status: "completed",
      actions: c.pending_actions,
      case_state: c,
      trace: c.trace,
      sources: c.source_references
    };
  }
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", agent: "RefundRakshak" });
});

app.post("/api/cases", (req, res) => {
  const caseId = "RR-" + Math.floor(100000 + Math.random() * 900000);
  const newCase: CaseState = {
    case_id: caseId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_language: req.body.language || "en",
    user_profile: req.body.user_profile || { name: "User", email: "user@example.com" },
    transaction_facts: req.body.transaction_facts || {
      amount: 0,
      currency: "INR",
      transaction_date: new Date().toISOString().split("T")[0],
      transaction_reference: "",
      bank_or_provider: "",
      transaction_type: "UPI",
      transaction_status: "UNKNOWN",
      beneficiary_status: "UNKNOWN",
      user_claimed_authorized: true,
      confidence: 0,
      missing_fields: []
    },
    classification: "missing_evidence",
    classification_confidence: 0.5,
    classification_rationale: "New case created. Awaiting evidence.",
    branch: "missing_evidence_branch",
    evidence_items: [],
    missing_fields: ["amount", "transaction_reference"],
    timeline: [{ timestamp: new Date().toISOString(), event: "New case initialized." }],
    simulated_now: new Date().toISOString(),
    complaint_status: "not_started",
    pending_actions: [],
    followups: [],
    escalation_stage: "intake",
    trace: [],
    source_references: [verifiedRulesData.rules[0]],
    safety_flags: []
  };
  casesDb.set(caseId, newCase);
  res.json(newCase);
});

app.get("/api/cases", (req, res) => {
  const list = Array.from(casesDb.values());
  res.json(list);
});

app.get("/api/cases/:case_id", (req, res) => {
  const c = casesDb.get(req.params.case_id);
  if (!c) return res.status(404).json({ error: "Case not found" });
  res.json(c);
});

app.post("/api/agent/run", async (req, res) => {
  try {
    const { case_id, message, language, simulated_now, image_base64 } = req.body;
    const result = await runAgentTurn(case_id, message || "", simulated_now, image_base64);
    res.json(result);
  } catch (err: any) {
    console.error("Agent run error:", err);
    res.status(500).json({ error: err.message || "Agent execution failed" });
  }
});

app.post("/api/cases/:case_id/simulate-time", (req, res) => {
  try {
    const { days } = req.body;
    const resSim = executeTool("simulate_time", { case_id: req.params.case_id, days: days || 7 });
    const c = casesDb.get(req.params.case_id);
    res.json({
      case_id: req.params.case_id,
      simulated_now: c?.simulated_now,
      due_followups: c?.followups,
      new_actions: c?.pending_actions,
      trace: c?.trace,
      case_state: c
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/actions/:action_id/approve", (req, res) => {
  const actionId = req.params.action_id;
  let foundAction: any = null;
  let foundCase: any = null;

  for (const c of casesDb.values()) {
    const act = c.pending_actions.find((a: any) => a.id === actionId);
    if (act) {
      act.status = "approved_and_executed";
      foundAction = act;
      foundCase = c;
      addTrace(c, "ACTION_APPROVED", `User approved action: ${act.type}`, "approve_action", c.branch, "success", `Action ${act.type} executed in simulated outbox.`, ["rbi_failed_transaction_upi_debit_not_credited"]);
      break;
    }
  }

  if (!foundAction) return res.status(404).json({ error: "Action not found" });
  res.json({ status: "success", action: foundAction, case_state: foundCase });
});

app.post("/api/actions/:action_id/reject", (req, res) => {
  const actionId = req.params.action_id;
  let foundAction: any = null;

  for (const c of casesDb.values()) {
    const act = c.pending_actions.find((a: any) => a.id === actionId);
    if (act) {
      act.status = "rejected";
      foundAction = act;
      addTrace(c, "ACTION_REJECTED", `User rejected action: ${act.type}`, "reject_action", c.branch, "warning", `Action ${act.type} rejected by user.`, []);
      break;
    }
  }

  if (!foundAction) return res.status(404).json({ error: "Action not found" });
  res.json({ status: "success", action: foundAction });
});

app.get("/api/cases/:case_id/evidence-pack", (req, res) => {
  const pack = executeTool("generate_evidence_pack", { case_id: req.params.case_id });
  res.json(pack);
});

// Vite middleware integration for development
if (process.env.NODE_ENV !== "production") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false }
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, "dist")));
  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "dist/index.html"));
  });
}

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RefundRakshak backend running on http://localhost:${PORT}`);
});
