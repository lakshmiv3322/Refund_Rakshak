import fs from "fs";
import path from "path";
import crypto from "crypto";
import Database from "better-sqlite3";
import { loadVerifiedRules } from "./rules-engine.ts";

export interface CaseState {
  case_id: string;
  created_at: string;
  updated_at: string;
  user_language: string;
  user_profile: { name: string; email: string };
  auth_token?: string;
  token_hash?: string;
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
  latest_compensation_estimate?: number;
  latest_days_delayed?: number;
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
  return path.join(getDataDir(), "refundrakshak.sqlite");
}

// Token generation and hashing
export function generatePlaintextToken(): string {
  return crypto.randomBytes(24).toString("hex");
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}

export function sanitizeCase(c: CaseState): Omit<CaseState, "auth_token" | "token_hash"> {
  const copy = { ...c };
  delete copy.auth_token;
  delete copy.token_hash;
  return copy;
}

let dbInstance: Database.Database | null = null;

export function getDatabase(): Database.Database {
  if (dbInstance) return dbInstance;

  const dataDir = getDataDir();
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = getDbFilePath();
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  // Schema creation with version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_version (
      version INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS cases (
      case_id TEXT PRIMARY KEY,
      token_hash TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      classification TEXT,
      branch TEXT,
      data JSON NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_cases_token_hash ON cases(token_hash);
    CREATE INDEX IF NOT EXISTS idx_cases_updated_at ON cases(updated_at);

    CREATE TABLE IF NOT EXISTS batch_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      summary_json JSON NOT NULL,
      results_json JSON NOT NULL
    );
  `);

  const currentVersionRow = db.prepare("SELECT MAX(version) as version FROM schema_version").get() as { version: number | null };
  const currentVersion = currentVersionRow?.version || 0;

  if (currentVersion < 1) {
    db.prepare("INSERT INTO schema_version (version, applied_at) VALUES (?, ?)").run(1, new Date().toISOString());

    // Migrate from legacy db.json if present
    const legacyPath = path.join(dataDir, "db.json");
    if (fs.existsSync(legacyPath)) {
      try {
        const raw = fs.readFileSync(legacyPath, "utf-8");
        if (raw.trim()) {
          const parsed = JSON.parse(raw);
          if (parsed.cases && typeof parsed.cases === "object") {
            const insertStmt = db.prepare(`
              INSERT OR REPLACE INTO cases (case_id, token_hash, created_at, updated_at, classification, branch, data)
              VALUES (?, ?, ?, ?, ?, ?, ?)
            `);
            const migrationTx = db.transaction(() => {
              for (const [id, c] of Object.entries<CaseState>(parsed.cases)) {
                let tokenHash = c.token_hash;
                if (!tokenHash && c.auth_token) {
                  tokenHash = hashToken(c.auth_token);
                  c.token_hash = tokenHash;
                  delete c.auth_token;
                }
                insertStmt.run(
                  id,
                  tokenHash || null,
                  c.created_at || new Date().toISOString(),
                  c.updated_at || new Date().toISOString(),
                  c.classification || null,
                  c.branch || null,
                  JSON.stringify(c)
                );
              }
              if (parsed.latestBatchSummary && parsed.batchResults) {
                db.prepare(`
                  INSERT INTO batch_records (created_at, summary_json, results_json)
                  VALUES (?, ?, ?)
                `).run(
                  new Date().toISOString(),
                  JSON.stringify(parsed.latestBatchSummary),
                  JSON.stringify(parsed.batchResults)
                );
              }
            });
            migrationTx();
            console.log("Migrated legacy db.json into SQLite successfully.");
          }
        }
      } catch (err: any) {
        console.warn("Could not migrate legacy db.json:", err.message);
      }
    }
  }

  // Seed demo case only if explicit SEED_DEMO=true
  if (process.env.SEED_DEMO === "true") {
    const existing = db.prepare("SELECT case_id FROM cases WHERE case_id = ?").get("RR-DEMO-001");
    if (!existing) {
      const demo = createDemoCaseState();
      db.prepare(`
        INSERT OR REPLACE INTO cases (case_id, token_hash, created_at, updated_at, classification, branch, data)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        demo.case_id,
        demo.token_hash || null,
        demo.created_at,
        demo.updated_at,
        demo.classification,
        demo.branch,
        JSON.stringify(demo)
      );
    }
  }

  dbInstance = db;
  return db;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

// Single case query
export function getCaseById(caseId: string): CaseState | null {
  const db = getDatabase();
  const row = db.prepare("SELECT data FROM cases WHERE case_id = ?").get(caseId) as { data: string } | undefined;
  if (!row) return null;
  return JSON.parse(row.data) as CaseState;
}

// Save single case atomically
export function saveCaseState(c: CaseState): void {
  const db = getDatabase();
  const tokenHash = c.token_hash || null;
  db.prepare(`
    INSERT OR REPLACE INTO cases (case_id, token_hash, created_at, updated_at, classification, branch, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    c.case_id,
    tokenHash,
    c.created_at,
    c.updated_at,
    c.classification,
    c.branch,
    JSON.stringify(c)
  );
}

// List cases filtered by token hash
export function listCasesForToken(tokenHash: string | null): CaseState[] {
  const db = getDatabase();
  let rows: { data: string }[];
  if (!tokenHash) {
    return [];
  }
  rows = db.prepare("SELECT data FROM cases WHERE token_hash = ? ORDER BY updated_at DESC").all(tokenHash) as { data: string }[];
  return rows.map(r => JSON.parse(r.data) as CaseState);
}

// List all cases (used only when DEV_OPEN_ACCESS=true)
export function listAllCases(): CaseState[] {
  const db = getDatabase();
  const rows = db.prepare("SELECT data FROM cases ORDER BY updated_at DESC").all() as { data: string }[];
  return rows.map(r => JSON.parse(r.data) as CaseState);
}

// Delete single case
export function deleteCase(caseId: string): boolean {
  const db = getDatabase();
  const res = db.prepare("DELETE FROM cases WHERE case_id = ?").run(caseId);
  return res.changes > 0;
}

// Legacy DB compatibility interface
export function loadDb(): DBStructure {
  const db = getDatabase();
  const caseRows = db.prepare("SELECT case_id, data FROM cases").all() as { case_id: string; data: string }[];
  const cases: Record<string, CaseState> = {};
  for (const r of caseRows) {
    cases[r.case_id] = JSON.parse(r.data);
  }

  const batchRow = db.prepare("SELECT summary_json, results_json FROM batch_records ORDER BY id DESC LIMIT 1").get() as { summary_json: string; results_json: string } | undefined;

  let latestBatchSummary = null;
  let batchResults: any[] = [];
  if (batchRow) {
    try {
      latestBatchSummary = JSON.parse(batchRow.summary_json);
      batchResults = JSON.parse(batchRow.results_json);
    } catch (_) {}
  }

  return {
    schema_version: 1,
    cases,
    latestBatchSummary,
    batchResults
  };
}

export function saveDb(data: DBStructure): void {
  const db = getDatabase();
  const insertCase = db.prepare(`
    INSERT OR REPLACE INTO cases (case_id, token_hash, created_at, updated_at, classification, branch, data)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  const saveTx = db.transaction(() => {
    if (data.cases) {
      for (const [id, c] of Object.entries(data.cases)) {
        insertCase.run(
          id,
          c.token_hash || null,
          c.created_at,
          c.updated_at,
          c.classification,
          c.branch,
          JSON.stringify(c)
        );
      }
    }

    if (data.latestBatchSummary && data.batchResults) {
      db.prepare(`
        INSERT INTO batch_records (created_at, summary_json, results_json)
        VALUES (?, ?, ?)
      `).run(
        new Date().toISOString(),
        JSON.stringify(data.latestBatchSummary),
        JSON.stringify(data.batchResults)
      );
    }
  });

  saveTx();
}

export function createDemoCaseState(): CaseState {
  const rulesData = loadVerifiedRules();
  const rawToken = "demo-token-rr-001";
  return {
    case_id: "RR-DEMO-001",
    created_at: "2026-09-23T10:00:00Z",
    updated_at: "2026-09-25T09:00:00Z",
    user_language: "en",
    user_profile: { name: "Demo User", email: "demo.user@example.com" },
    token_hash: hashToken(rawToken),
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
