import fs from "fs";
import path from "path";
import { loadVerifiedRules } from "./rules-engine.ts";

export interface CaseState {
  case_id: string;
  created_at: string;
  updated_at: string;
  user_language: string;
  user_profile: { name: string; email: string };
  auth_token?: string;
  transaction_facts: {
    amount: number | null;
    currency: string;
    transaction_date: string | null;
    transaction_reference: string | null;
    bank_or_provider: string | null;
    transaction_type: string;
    transaction_status: string | null;
    beneficiary_status: string | null;
    merchant_name?: string | null;
    user_claimed_authorized: boolean;
    confidence: number;
    missing_fields: string[];
  };
  classification: string | null;
  classification_confidence: number;
  classification_rationale: string;
  branch: string;
  evidence_items: any[];
  missing_fields: string[];
  verified_rule_id?: string;
  timeline: any[];
  simulated_now: string;
  complaint_status: string;
  bank_complaint_date?: string | null;
  bank_response?: string | null;
  pending_actions: any[];
  outbox: any[];
  followups: any[];
  escalation_stage: string;
  trace: any[];
  chat_history: { role: "user" | "model"; text: string; timestamp: string }[];
  source_references: any[];
  safety_flags: string[];
}

export interface DBStructure {
  schema_version: number;
  cases: Record<string, CaseState>;
  latestBatchSummary: any;
  batchResults: any[];
}

export function getDataDir(): string {
  return process.env.DATA_DIR || path.join(process.cwd(), "data");
}

export function getDbFilePath(): string {
  return path.join(getDataDir(), "db.json");
}

export function getLockFilePath(): string {
  return path.join(getDataDir(), "db.json.lock");
}

export function createDemoCaseState(): CaseState {
  const rulesData = loadVerifiedRules();
  return {
    case_id: "RR-DEMO-001",
    created_at: "2026-09-23T10:00:00Z",
    updated_at: "2026-09-25T09:00:00Z",
    user_language: "en",
    user_profile: { name: "Demo User", email: "demo.user@example.com" },
    auth_token: "demo-token-rr-001",
    transaction_facts: {
      amount: 2400,
      currency: "INR",
      transaction_date: "2026-09-22",
      transaction_reference: "DEMOUPI123456",
      bank_or_provider: "Demo Bank",
      transaction_type: "UPI",
      transaction_status: "FAILED_DEBITED",
      beneficiary_status: "NOT_CREDITED",
      merchant_name: null,
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
      { timestamp: "2026-09-23T10:00:00Z", event: "Bank complaint submitted to Demo Bank (Ref: BK-98765)" }
    ],
    simulated_now: "2026-09-25T09:00:00Z",
    complaint_status: "bank_complaint_submitted_no_response",
    bank_complaint_date: "2026-09-23",
    bank_response: null,
    pending_actions: [],
    outbox: [
      {
        id: "out_bk_01",
        type: "bank_complaint",
        status: "approved_and_executed",
        requires_approval: false,
        created_at: "2026-09-23T10:00:00Z",
        payload: {
          recipient: "support@demobank.co.in",
          subject: "Complaint: UPI Failed & Debited (Ref: DEMOUPI123456)",
          body: "Initial bank complaint submitted."
        },
        simulated: true,
        label: "Simulated outbox - not delivered to the bank",
        source_references: [rulesData.rules[0]]
      }
    ],
    followups: [
      {
        id: "fu_01",
        due_date: "2026-09-30T00:00:00Z",
        condition: "bank_no_response_7_days",
        action_type: "prepare_nodal_escalation",
        status: "pending"
      }
    ],
    escalation_stage: "bank_complaint_pending",
    trace: [
      {
        id: "tr_01",
        timestamp: "2026-09-23T10:00:00Z",
        event_type: "CLASSIFICATION",
        label: "Classified as supported UPI failed debit",
        tool_name: "record_classification",
        branch: "supported_upi_failed_debit",
        status: "success",
        summary: "Case verified under RBI DPSS circular.",
        source_ids: ["rbi_failed_transaction_upi_debit_not_credited"]
      }
    ],
    chat_history: [
      { role: "user", text: "My UPI payment of ₹2,400 failed on 22 Sept. Money was debited.", timestamp: "2026-09-23T10:00:00Z" },
      { role: "model", text: "I have recorded your grievance and submitted a bank complaint to Demo Bank.", timestamp: "2026-09-23T10:00:00Z" }
    ],
    source_references: [rulesData.rules[0]],
    safety_flags: []
  };
}

/**
 * Migration runner: ensures schema versions are upgraded safely.
 */
function migrateSchema(data: any): DBStructure {
  if (!data || typeof data !== "object") {
    data = {};
  }
  if (!data.schema_version) {
    data.schema_version = 1;
  }
  if (!data.cases) {
    data.cases = {};
  }
  if (!data.batchResults) {
    data.batchResults = [];
  }
  return data as DBStructure;
}

export function loadDb(): DBStructure {
  const filePath = getDbFilePath();
  try {
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, "utf-8");
      if (content.trim()) {
        const parsed = JSON.parse(content);
        return migrateSchema(parsed);
      }
    }
  } catch (e) {
    console.error("Error loading db.json:", e);
  }

  // Remove hardcoded demo seed unless explicit SEED_DEMO=true flag
  const initialCases: Record<string, CaseState> = {};
  if (process.env.SEED_DEMO === "true") {
    const demoCase = createDemoCaseState();
    initialCases["RR-DEMO-001"] = demoCase;
  }

  const initialDb: DBStructure = {
    schema_version: 1,
    cases: initialCases,
    latestBatchSummary: null,
    batchResults: []
  };

  saveDb(initialDb);
  return initialDb;
}

/**
 * Atomic write with file sync and rename
 */
export function saveDb(data: DBStructure) {
  const dir = getDataDir();
  const filePath = getDbFilePath();
  const tempPath = `${filePath}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`;

  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const serialized = JSON.stringify(data, null, 2);
    fs.writeFileSync(tempPath, serialized, "utf-8");
    fs.renameSync(tempPath, filePath);
  } catch (e) {
    console.error("Error atomically saving db.json:", e);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch (_) {}
  }
}
