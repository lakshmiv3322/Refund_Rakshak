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
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

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

// Configurable DATA_DIR persistence store (default ./data)
const dataDir = process.env.DATA_DIR || path.join(__dirname, "data");
const dbFilePath = path.join(dataDir, "db.json");

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

interface DBStructure {
  cases: Record<string, CaseState>;
  latestBatchSummary: any;
  batchResults: any[];
}

function loadDb(): DBStructure {
  try {
    if (fs.existsSync(dbFilePath)) {
      const content = fs.readFileSync(dbFilePath, "utf-8");
      return JSON.parse(content);
    }
  } catch (e) {
    console.error("Error loading db.json:", e);
  }

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

  const initialDb: DBStructure = {
    cases: { [demoCaseId]: demoCaseState },
    latestBatchSummary: null,
    batchResults: []
  };

  saveDb(initialDb);
  return initialDb;
}

function saveDb(data: DBStructure) {
  try {
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    fs.writeFileSync(dbFilePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Error saving db.json:", e);
  }
}

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

function executeTool(name: string, args: any, caseState?: CaseState): any {
  if (name === "get_case_state") {
    const db = loadDb();
    const c = db.cases[args.case_id];
    if (!c) return { error: "Case not found" };
    return c;
  }

  if (name === "extract_transaction_evidence") {
    const text = args.raw_text || "";
    const amtMatch = text.match(/[₹Rs\.]\s*([0-9,]+(?:\.[0-9]{2})?)/i) || text.match(/([0-9,]+)\s*(?:rs|rupees|inr)/i);
    const amount = amtMatch ? parseFloat(amtMatch[1].replace(/,/g, "")) : null;

    const refMatch = text.match(/(?:ref|upi ref|transaction id|txn id|reference)[:\s#]*([a-zA-Z0-9]+)/i);
    const ref = refMatch ? refMatch[1] : null;

    const missing_fields = [];
    if (amount === null) missing_fields.push("amount");
    if (!ref) missing_fields.push("transaction_reference");

    return {
      amount,
      currency: "INR",
      transaction_date: null,
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
    if (desc.includes("fraud") || desc.includes("did not make") || desc.includes("someone used") || desc.includes("unauthorized") || desc.includes("hacked")) {
      return {
        classification: "unauthorized_or_fraud",
        confidence: 0.98,
        rationale: "User reported unauthorized transaction or suspected fraud.",
        required_fields: ["bank_notification_ref", "cyber_crime_portal_ref"],
        branch: "fraud_safety_branch"
      };
    }
    if (desc.includes("merchant") || desc.includes("store") || desc.includes("cancelled my order") || desc.includes("refund") || desc.includes("flipkart") || desc.includes("amazon")) {
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
    const delayDays = Math.max(0, diffDays - 1);
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

  if (name === "simulate_time") {
    const db = loadDb();
    const c = db.cases[args.case_id];
    if (!c) return { error: "Case not found" };
    const daysToAdd = args.days || 7;
    const currentSimDate = new Date(c.simulated_now);
    currentSimDate.setDate(currentSimDate.getDate() + daysToAdd);
    c.simulated_now = currentSimDate.toISOString();

    c.timeline.push({
      timestamp: c.simulated_now,
      event: `Simulated clock advanced by +${daysToAdd} days. Re-evaluating case status.`
    });

    if (c.escalation_stage === "bank_complaint_pending_nodal" || c.escalation_stage.includes("bank_complaint")) {
      c.escalation_stage = "nodal_officer_escalation_ready";
      const nodalActionId = "act_nodal_" + Math.random().toString(36).substring(2, 9);
      c.pending_actions.push({
        id: nodalActionId,
        type: "nodal_officer_escalation",
        status: "pending_approval",
        requires_approval: true,
        created_at: c.simulated_now,
        payload: {
          recipient: "nodal.officer@bank.co.in",
          subject: `ESCALATION: Unresolved UPI Failed Transaction ${c.transaction_facts.transaction_reference}`,
          body: `Respected Nodal Officer,\n\nInitial complaint regarding UPI failure (Ref: ${c.transaction_facts.transaction_reference}, Amount: ₹${c.transaction_facts.amount}) remains unresolved beyond TAT after 7+ days. Requesting urgent intervention and compensation.\n\nPotential compensation estimate, subject to verification.`
        },
        simulated: true,
        source_references: [verifiedRulesData.rules[0]]
      });

      addTrace(c, "ESCALATION", "Bank response timeout reached after simulation", "simulate_time", "escalation_branch", "success", "No bank response received within timeframe. Nodal escalation draft prepared.", ["rbi_failed_transaction_upi_debit_not_credited"]);
    }

    db.cases[args.case_id] = c;
    saveDb(db);

    return {
      case_id: c.case_id,
      simulated_now: c.simulated_now,
      escalation_stage: c.escalation_stage,
      trace: c.trace
    };
  }

  return { error: "Unknown tool" };
}

// B2B Batch Triage Processor with Strict Data-Integrity Fix 3
function triageSingleComplaint(comp: { complaint_id: string; text?: string; amount?: number; transaction_date?: string; bank?: string; reference?: string; status?: string }, asOfDate?: string) {
  const amount = comp.amount !== undefined && comp.amount !== null && !isNaN(Number(comp.amount)) ? Number(comp.amount) : null;
  const txDate = comp.transaction_date ? String(comp.transaction_date).trim() : null;
  const ref = comp.reference ? String(comp.reference).trim() : null;

  const missingFields: string[] = [];
  if (amount === null) missingFields.push("amount");
  if (!txDate) missingFields.push("transaction_date");
  if (!ref) missingFields.push("reference");

  if (missingFields.length > 0) {
    return {
      complaint_id: comp.complaint_id || "COMP-" + Math.floor(1000 + Math.random() * 9000),
      amount: null,
      transaction_date: null,
      reference: null,
      classification: "missing_evidence",
      branch: "missing_evidence",
      tat_breached: false,
      days_delayed: 0,
      potential_compensation_inr: 0,
      caveat: "Potential compensation estimate, subject to verification.",
      recommended_action: `Request the missing fields: ${missingFields.join(", ")}`,
      drafted_customer_reply: `DRAFT - requires human review before sending. We are reviewing your case and any applicable compensation, subject to verification. Missing details: ${missingFields.join(", ")}.`,
      priority: "medium",
      missing_fields: missingFields
    };
  }

  const fullText = comp.text || `Failed payment of ₹${amount} on ${txDate} ref ${ref}`;
  const classificationRes = executeTool("classify_grievance", { description: fullText, transaction_reference: ref });
  const classification = classificationRes.classification;
  const branch = classificationRes.branch;

  let tatBreached = false;
  let daysDelayed = 0;
  let potentialComp = 0;
  let caveat = "Potential compensation estimate, subject to verification.";
  let recommendedAction = "Process standard reversal within T+1";
  let draftedReply = "DRAFT - requires human review before sending. We are reviewing your case and any applicable compensation, subject to verification.";
  let priority = "medium";

  if (classification === "supported_upi_failed_debited_not_credited") {
    const calc = executeTool("calculate_deadline_and_estimate", {
      transaction_date: txDate,
      simulated_now: asOfDate || new Date().toISOString(),
      rule_id: "rbi_failed_transaction_upi_debit_not_credited"
    });
    daysDelayed = calc.days_delayed;
    tatBreached = daysDelayed > 0;
    potentialComp = calc.potential_compensation_estimate ?? (daysDelayed * 100);
    priority = daysDelayed > 5 ? "high" : (daysDelayed > 0 ? "medium" : "low");
    recommendedAction = tatBreached ? `Immediate reversal + pay ₹${potentialComp} compensation` : `Process reversal within T+1 TAT`;
    draftedReply = `DRAFT - requires human review before sending. Dear Customer, regarding your UPI transaction ${ref} of ₹${amount}, we are reviewing your case and any applicable compensation, subject to verification.`;
  } else if (classification === "unauthorized_or_fraud") {
    priority = "high";
    recommendedAction = "Route to Fraud Risk Ops & Cyber Cell reporting";
    draftedReply = `DRAFT - requires human review before sending. Dear Customer, we have noted your fraud report regarding transaction ${ref}. Please contact your bank immediately and file a cybercrime report at cybercrime.gov.in. We are reviewing your case and any applicable compensation, subject to verification.`;
  } else if (classification === "merchant_refund") {
    priority = "low";
    recommendedAction = "Verify merchant settlement status with acquirer";
    draftedReply = `DRAFT - requires human review before sending. Dear Customer, regarding your merchant refund for transaction ${ref}, we are coordinating with the merchant settlement gateway and reviewing your case, subject to verification.`;
  }

  return {
    complaint_id: comp.complaint_id || "COMP-" + Math.floor(1000 + Math.random() * 9000),
    amount,
    transaction_date: txDate,
    reference: ref,
    classification,
    branch,
    tat_breached: tatBreached,
    days_delayed: daysDelayed,
    potential_compensation_inr: potentialComp,
    caveat,
    recommended_action: recommendedAction,
    drafted_customer_reply: draftedReply,
    priority,
    missing_fields: []
  };
}

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", agent: "RefundRakshak B2B & Consumer Copilot" });
});

app.post("/api/cases", (req, res) => {
  const db = loadDb();
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
  db.cases[caseId] = newCase;
  saveDb(db);
  res.json(newCase);
});

app.get("/api/cases", (req, res) => {
  const db = loadDb();
  res.json(Object.values(db.cases));
});

app.get("/api/cases/:case_id", (req, res) => {
  const db = loadDb();
  const c = db.cases[req.params.case_id];
  if (!c) return res.status(404).json({ error: "Case not found" });
  res.json(c);
});

app.post("/api/agent/run", async (req, res) => {
  try {
    const { case_id, message, simulated_now } = req.body;
    const db = loadDb();
    let c = db.cases[case_id];
    if (!c) {
      return res.status(404).json({ error: "Case not found" });
    }
    if (simulated_now) c.simulated_now = simulated_now;

    c.timeline.push({
      timestamp: new Date().toISOString(),
      event: `User message: "${message}"`
    });

    addTrace(c, "USER_INPUT", "Received user prompt", "agent_run", c.branch, "success", message, []);

    const extraction = executeTool("extract_transaction_evidence", { raw_text: message });
    if (extraction.amount !== null) c.transaction_facts.amount = extraction.amount;
    if (extraction.transaction_reference) c.transaction_facts.transaction_reference = extraction.transaction_reference;

    const classification = executeTool("classify_grievance", { description: message, transaction_reference: c.transaction_facts.transaction_reference });
    c.classification = classification.classification;
    c.branch = classification.branch;
    c.classification_rationale = classification.rationale;
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

    db.cases[case_id] = c;
    saveDb(db);

    res.json({
      case_id: c.case_id,
      message: responseMessage,
      language: c.user_language,
      status: c.missing_fields.length > 0 ? "needs_input" : "completed",
      actions: c.pending_actions,
      case_state: c,
      trace: c.trace,
      sources: c.source_references
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Agent execution failed" });
  }
});

app.post("/api/cases/:case_id/simulate-time", (req, res) => {
  try {
    const db = loadDb();
    const caseId = req.params.case_id;
    if (!db.cases[caseId]) {
      db.cases[caseId] = db.cases["RR-DEMO-001"] || Object.values(db.cases)[0];
      if (!db.cases[caseId]) {
        return res.status(404).json({ error: "Case not found" });
      }
      db.cases[caseId].case_id = caseId;
      saveDb(db);
    }
    const { days } = req.body;
    const resSim = executeTool("simulate_time", { case_id: caseId, days: days || 7 });
    const updatedDb = loadDb();
    const c = updatedDb.cases[caseId];
    res.json({
      case_id: caseId,
      simulated_now: c?.simulated_now,
      due_followups: c?.followups,
      new_actions: c?.pending_actions,
      trace: c?.trace,
      case_state: c
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Simulation error" });
  }
});

app.post("/api/actions/:action_id/approve", (req, res) => {
  const actionId = req.params.action_id;
  const db = loadDb();
  let foundAction: any = null;
  let foundCase: any = null;

  for (const c of Object.values(db.cases)) {
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
  saveDb(db);
  res.json({ status: "success", action: foundAction, case_state: foundCase });
});

app.post("/api/actions/:action_id/reject", (req, res) => {
  const actionId = req.params.action_id;
  const db = loadDb();
  let foundAction: any = null;

  for (const c of Object.values(db.cases)) {
    const act = c.pending_actions.find((a: any) => a.id === actionId);
    if (act) {
      act.status = "rejected";
      foundAction = act;
      addTrace(c, "ACTION_REJECTED", `User rejected action: ${act.type}`, "reject_action", c.branch, "warning", `Action ${act.type} rejected by user.`, []);
      break;
    }
  }

  if (!foundAction) return res.status(404).json({ error: "Action not found" });
  saveDb(db);
  res.json({ status: "success", action: foundAction });
});

app.get("/api/cases/:case_id/evidence-pack", (req, res) => {
  const pack = executeTool("generate_evidence_pack", { case_id: req.params.case_id });
  res.json(pack);
});

// B2B Endpoints with as_of support & strict integrity
app.post("/api/b2b/triage-batch", (req, res) => {
  try {
    let complaints = req.body.complaints || [];
    const asOf = req.body.as_of;

    if (typeof req.body === "string" || req.body.csv_text) {
      const csvText = typeof req.body === "string" ? req.body : req.body.csv_text;
      const lines = csvText.split("\n").filter((l: string) => l.trim().length > 0);
      complaints = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(",").map((p: string) => p.trim());
        if (parts.length >= 2) {
          complaints.push({
            complaint_id: parts[0] || `COMP-${i}`,
            text: parts[1] || "UPI failed debit",
            amount: parts[2] ? parseFloat(parts[2]) : undefined,
            transaction_date: parts[3] || undefined,
            reference: parts[4] || undefined
          });
        }
      }
    }

    if (!Array.isArray(complaints) || complaints.length === 0) {
      return res.status(400).json({ error: "No complaints provided in batch." });
    }

    const results = complaints.map((c: any) => triageSingleComplaint(c, asOf));

    let totalComplaints = results.length;
    let needsInfoCount = 0;
    let breachedCount = 0;
    let totalExposure = 0;
    const classificationCounts: Record<string, number> = {};

    results.forEach((r: any) => {
      classificationCounts[r.classification] = (classificationCounts[r.classification] || 0) + 1;
      if (r.classification === "missing_evidence") {
        needsInfoCount++;
      } else {
        if (r.tat_breached) breachedCount++;
        totalExposure += r.potential_compensation_inr;
      }
    });

    const topPriorityCases = [...results].filter(r => r.classification !== "missing_evidence").sort((a, b) => b.potential_compensation_inr - a.potential_compensation_inr).slice(0, 5);

    const summary = {
      total_complaints: totalComplaints,
      classification_counts: classificationCounts,
      needs_info_count: needsInfoCount,
      breached_count: breachedCount,
      total_compensation_exposure: totalExposure,
      top_priority_cases: topPriorityCases
    };

    const db = loadDb();
    db.latestBatchSummary = summary;
    db.batchResults = results;
    saveDb(db);

    res.json({
      summary,
      results
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || "Batch triage failed" });
  }
});

app.get("/api/b2b/exposure-report", (req, res) => {
  const db = loadDb();
  const format = req.query.format || "json";

  if (format === "csv") {
    let csv = "ComplaintID,Amount,Date,Reference,Classification,Branch,TATBreached,DaysDelayed,CompensationINR,Priority,RecommendedAction\n";
    (db.batchResults || []).forEach((r: any) => {
      csv += `${r.complaint_id},${r.amount !== null ? r.amount : ""},${r.transaction_date !== null ? r.transaction_date : ""},${r.reference !== null ? r.reference : ""},${r.classification},${r.branch},${r.tat_breached},${r.days_delayed},${r.potential_compensation_inr},${r.priority},"${r.recommended_action}"\n`;
    });
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=refundrakshak_exposure_report.csv");
    return res.send(csv);
  }

  res.json({
    summary: db.latestBatchSummary || { total_complaints: 0, total_compensation_exposure: 0 },
    results: db.batchResults || []
  });
});

// Vite middleware integration for development / Static file serving for production
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

const PORT = Number(process.env.PORT || 8000);
app.listen(PORT, "0.0.0.0", () => {
  console.log(`RefundRakshak backend running on http://0.0.0.0:${PORT}`);
});
