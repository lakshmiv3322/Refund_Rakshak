import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import Papa from "papaparse";
import { loadDb, saveDb, createDemoCaseState, CaseState } from "./server/store.ts";
import { runAgent } from "./server/agent.ts";
import { generateEvidencePdf } from "./server/pdf.ts";
import { loadVerifiedRules, calculateTATDeadlineAndCompensation } from "./server/rules-engine.ts";
import { sendEmailOrFallback, findBankContact } from "./server/email.ts";
import { startBackgroundScheduler, checkAndExecuteDueFollowups } from "./server/scheduler.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(helmet({ contentSecurityPolicy: false })); // allow dev scripts
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// CORS configuration
const corsOrigin = process.env.CORS_ORIGIN || "*";
app.use(cors({ origin: corsOrigin }));

// Rate limiter: 60 req/min per IP
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();
app.use((req, res, next) => {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  let record = rateLimitMap.get(ip);
  if (!record || now > record.resetTime) {
    record = { count: 1, resetTime: now + 60000 };
    rateLimitMap.set(ip, record);
  } else {
    record.count++;
    if (record.count > 60) {
      return res.status(429).json({ error: { code: "RATE_LIMIT_EXCEEDED", message: "Maximum 60 requests per minute allowed." } });
    }
  }
  next();
});

// Load verified statutory rules on startup
try {
  loadVerifiedRules();
  console.log("Verified statutory rules loaded successfully.");
} catch (err: any) {
  console.error("FATAL: Failed to load verified rules at startup:", err.message);
  process.exit(1);
}

// Start background SLA scheduler
startBackgroundScheduler(60000);

// API Health Check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    agent: "RefundRakshak Production Copilot",
    version: "1.0.0",
    timestamp: new Date().toISOString()
  });
});

// Auth helper: verify session or case ownership
function verifyCaseAccess(req: express.Request, caseState: CaseState): boolean {
  if (process.env.NODE_ENV !== "production") return true;
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "") || req.headers["x-case-token"];
  if (!token) return true; // allow unauthenticated in demo mode
  return !caseState.auth_token || caseState.auth_token === token;
}

// Create new grievance case
app.post("/api/cases", (req, res) => {
  const db = loadDb();
  const caseId = "RR-" + Math.floor(100000 + Math.random() * 900000);
  const authToken = "tk_" + Math.random().toString(36).substring(2, 15);

  const newCase: CaseState = {
    case_id: caseId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_language: req.body.language || "en",
    user_profile: req.body.user_profile || { name: "User", email: "user@example.com" },
    auth_token: authToken,
    transaction_facts: {
      amount: null,
      currency: "INR",
      transaction_date: null,
      transaction_reference: null,
      bank_or_provider: null,
      transaction_type: "UPI",
      transaction_status: null,
      beneficiary_status: null,
      merchant_name: null,
      user_claimed_authorized: true,
      confidence: 0,
      missing_fields: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"]
    },
    classification: null,
    classification_confidence: 0,
    classification_rationale: "New case initialized. Awaiting evidence.",
    branch: "missing_evidence_branch",
    evidence_items: [],
    missing_fields: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"],
    timeline: [{ timestamp: new Date().toISOString(), event: "New grievance case created." }],
    simulated_now: req.body.simulated_now || new Date().toISOString(),
    complaint_status: "not_started",
    pending_actions: [],
    outbox: [],
    followups: [],
    escalation_stage: "intake",
    trace: [],
    chat_history: [],
    source_references: [],
    safety_flags: []
  };

  db.cases[caseId] = newCase;
  saveDb(db);

  res.status(201).json(newCase);
});

app.get("/api/cases", (req, res) => {
  const db = loadDb();
  res.json(Object.values(db.cases));
});

app.get("/api/cases/:case_id", (req, res) => {
  const db = loadDb();
  const c = db.cases[req.params.case_id];
  if (!c) {
    return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: `Case ${req.params.case_id} not found.` } });
  }
  if (!verifyCaseAccess(req, c)) {
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access token invalid for this case." } });
  }
  res.json(c);
});

// Demo reset endpoint (for judges and hackathon evaluators)
app.post("/api/cases/RR-DEMO-001/reset", (req, res) => {
  const db = loadDb();
  const demo = createDemoCaseState();
  db.cases["RR-DEMO-001"] = demo;
  saveDb(db);
  res.json({ status: "success", message: "Demo seed case RR-DEMO-001 reset.", case_state: demo });
});

// Agent execution endpoint (Supports standard JSON and live SSE streaming)
app.post("/api/agent/run", async (req, res) => {
  try {
    const { case_id, message, language, simulated_now, image_base64, image_mime } = req.body;
    const isStream = req.headers.accept?.includes("text/event-stream") || req.query.stream === "true";

    const db = loadDb();
    let c: CaseState;

    if (case_id && db.cases[case_id]) {
      c = db.cases[case_id];
    } else {
      const newId = case_id || "RR-" + Math.floor(100000 + Math.random() * 900000);
      c = {
        case_id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_language: language || "en",
        user_profile: { name: "User", email: "user@example.com" },
        auth_token: "tk_" + Math.random().toString(36).substring(2, 15),
        transaction_facts: {
          amount: null,
          currency: "INR",
          transaction_date: null,
          transaction_reference: null,
          bank_or_provider: null,
          transaction_type: "UPI",
          transaction_status: null,
          beneficiary_status: null,
          merchant_name: null,
          user_claimed_authorized: true,
          confidence: 0,
          missing_fields: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"]
        },
        classification: null,
        classification_confidence: 0,
        classification_rationale: "New case created. Awaiting evidence.",
        branch: "missing_evidence_branch",
        evidence_items: [],
        missing_fields: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"],
        timeline: [{ timestamp: new Date().toISOString(), event: "New case initialized." }],
        simulated_now: simulated_now || new Date().toISOString(),
        complaint_status: "not_started",
        pending_actions: [],
        outbox: [],
        followups: [],
        escalation_stage: "intake",
        trace: [],
        chat_history: [],
        source_references: [],
        safety_flags: []
      };
      db.cases[newId] = c;
    }

    if (simulated_now) c.simulated_now = simulated_now;
    if (language) c.user_language = language;

    if (isStream) {
      // Set headers for Server-Sent Events
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const agentResult = await runAgent(c, message || "", image_base64, image_mime, {
        onStep: (step) => {
          res.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`);
        },
        onToken: (token) => {
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      });

      c.updated_at = new Date().toISOString();
      db.cases[c.case_id] = c;
      saveDb(db);

      res.write(`event: done\ndata: ${JSON.stringify({
        case_id: c.case_id,
        message: agentResult.message,
        status: agentResult.status,
        pending_question: agentResult.pending_question,
        approval_request: agentResult.approval_request,
        actions: c.pending_actions,
        case_state: c,
        trace: c.trace
      })}\n\n`);
      res.end();
      return;
    }

    // Standard JSON Response
    const agentResult = await runAgent(c, message || "", image_base64, image_mime);
    c.updated_at = new Date().toISOString();
    db.cases[c.case_id] = c;
    saveDb(db);

    res.json({
      case_id: c.case_id,
      message: agentResult.message,
      language: c.user_language,
      status: agentResult.status,
      pending_question: agentResult.pending_question,
      approval_request: agentResult.approval_request,
      actions: c.pending_actions,
      case_state: c,
      trace: c.trace,
      sources: c.source_references
    });
  } catch (err: any) {
    console.error("Agent error:", err);
    res.status(500).json({ error: { code: "AGENT_EXECUTION_ERROR", message: err.message || "Agent execution failed" } });
  }
});

// Advance clock (dev / evaluation tool)
app.post("/api/cases/:case_id/simulate-time", async (req, res) => {
  try {
    const { days } = req.body;
    const caseId = req.params.case_id;
    const db = loadDb();
    let c = db.cases[caseId];

    if (!c) {
      if (caseId === "RR-DEMO-001" || Object.keys(db.cases).length === 0) {
        c = createDemoCaseState();
        c.case_id = caseId;
        db.cases[caseId] = c;
        saveDb(db);
      } else {
        return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: `Case ${caseId} not found.` } });
      }
    }

    const daysToAdd = days || 7;
    const currentSimDate = new Date(c.simulated_now || new Date());
    currentSimDate.setDate(currentSimDate.getDate() + daysToAdd);
    c.simulated_now = currentSimDate.toISOString();

    c.timeline.push({
      timestamp: c.simulated_now,
      event: `Simulated clock advanced by +${daysToAdd} days.`
    });

    // Check due follow-ups against updated simulated clock
    checkAndExecuteDueFollowups(c.simulated_now);

    const refreshedDb = loadDb();
    const refreshedCase = refreshedDb.cases[caseId] || c;

    res.json({
      case_id: refreshedCase.case_id,
      simulated_now: refreshedCase.simulated_now,
      due_followups: refreshedCase.followups,
      new_actions: refreshedCase.pending_actions,
      trace: refreshedCase.trace,
      case_state: refreshedCase
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SIMULATION_ERROR", message: err.message || "Simulation error" } });
  }
});

// Human Approval Endpoint (Real Email Sending with Mailto Fallback)
app.post("/api/actions/:action_id/approve", async (req, res) => {
  const actionId = req.params.action_id;
  const db = loadDb();
  let foundAction: any = null;
  let foundCase: CaseState | null = null;

  for (const c of Object.values(db.cases)) {
    const act = c.pending_actions.find((a: any) => a.id === actionId);
    if (act) {
      foundAction = act;
      foundCase = c;
      break;
    }
  }

  if (!foundAction || !foundCase) {
    return res.status(404).json({ error: { code: "ACTION_NOT_FOUND", message: "Action not found" } });
  }

  // Idempotency: return existing result if already executed
  if (foundAction.status === "sent" || foundAction.status === "approved_and_executed") {
    return res.json({ status: "success", action: foundAction, case_state: foundCase });
  }

  // Real Email Dispatch
  const recipient = foundAction.payload?.recipient || "customercare@bank.co.in";
  const subject = foundAction.payload?.subject || "Grievance Redressal Request";
  const body = foundAction.payload?.body || "Please process resolution.";

  const emailResult = await sendEmailOrFallback({
    to: recipient,
    subject,
    body,
    replyTo: foundCase.user_profile?.email
  });

  if (emailResult.sent) {
    foundAction.status = "sent";
    foundAction.delivery_details = {
      provider: emailResult.provider,
      message_id: emailResult.message_id,
      delivered_at: emailResult.delivered_at
    };
  } else {
    foundAction.status = "approved_requires_manual_send";
    foundAction.delivery_details = {
      provider: "mailto_fallback",
      mailto_url: emailResult.mailto_url,
      copy_text: emailResult.copy_text,
      note: "No SMTP/Resend credentials configured. Click mailto link or copy details to send manually."
    };
  }

  foundCase.outbox.push({
    ...foundAction,
    executed_at: new Date().toISOString()
  });

  foundCase.trace.unshift({
    id: "tr_exec_" + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    event_type: "ACTION_APPROVED",
    label: `Action approved: ${foundAction.type}`,
    tool_name: "approve_action",
    branch: foundCase.branch,
    status: emailResult.sent ? "success" : "info",
    summary: emailResult.sent
      ? `Dispatched via ${emailResult.provider} (MsgID: ${emailResult.message_id})`
      : `Prepared mailto fallback package for manual dispatch.`,
    source_ids: []
  });

  foundCase.updated_at = new Date().toISOString();
  saveDb(db);

  res.json({
    status: "success",
    action: foundAction,
    delivery_details: foundAction.delivery_details,
    case_state: foundCase
  });
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
      c.trace.unshift({
        id: "tr_rej_" + Math.random().toString(36).substring(2, 9),
        timestamp: new Date().toISOString(),
        event_type: "ACTION_REJECTED",
        label: `User rejected action: ${act.type}`,
        tool_name: "reject_action",
        branch: c.branch,
        status: "warning",
        summary: `Action ${act.type} explicitly rejected by user.`,
        source_ids: []
      });
      break;
    }
  }

  if (!foundAction) return res.status(404).json({ error: { code: "ACTION_NOT_FOUND", message: "Action not found" } });
  saveDb(db);
  res.json({ status: "success", action: foundAction });
});

// Evidence Pack PDF export
app.get("/api/cases/:case_id/evidence-pack", (req, res) => {
  const db = loadDb();
  const c = db.cases[req.params.case_id];
  if (!c) {
    return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: "Case not found" } });
  }
  generateEvidencePdf(c, res);
});

import { triageComplaintUnified } from "./server/b2b.ts";

// B2B Batch Triage (with Papa.parse CSV parsing and row validation)
app.post("/api/b2b/triage-batch", (req, res) => {
  try {
    let complaints: any[] = [];
    const asOf = req.body.as_of;
    const parseErrors: any[] = [];

    if (req.body.csv_text || typeof req.body === "string") {
      const csvStr = req.body.csv_text || req.body;
      const parsed = Papa.parse(csvStr, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true
      });

      if (parsed.errors && parsed.errors.length > 0) {
        parseErrors.push(...parsed.errors);
      }

      complaints = (parsed.data as any[]).map((row: any, idx: number) => ({
        complaint_id: row.ComplaintID || row.complaint_id || `CSV-ROW-${idx + 1}`,
        text: row.Description || row.text || row.Complaint || "",
        amount: row.Amount || row.amount,
        transaction_date: row.Date || row.transaction_date,
        reference: row.Reference || row.reference || row.UTR
      }));
    } else if (Array.isArray(req.body.complaints)) {
      complaints = req.body.complaints;
    }

    if (complaints.length === 0) {
      return res.status(400).json({ error: { code: "EMPTY_BATCH", message: "No valid complaints provided in batch." } });
    }

    const results = complaints.map(c => triageComplaintUnified(c, asOf));

    let needsInfoCount = 0;
    let breachedCount = 0;
    let totalExposure = 0;
    const classificationCounts: Record<string, number> = {};

    results.forEach(r => {
      classificationCounts[r.classification] = (classificationCounts[r.classification] || 0) + 1;
      if (r.classification === "missing_evidence") {
        needsInfoCount++;
      } else {
        if (r.tat_breached) breachedCount++;
        totalExposure += r.potential_compensation_inr;
      }
    });

    const summary = {
      total_complaints: results.length,
      classification_counts: classificationCounts,
      needs_info_count: needsInfoCount,
      breached_count: breachedCount,
      total_compensation_exposure: totalExposure,
      parse_errors: parseErrors,
      top_priority_cases: results
        .filter(r => r.classification !== "missing_evidence")
        .sort((a, b) => b.potential_compensation_inr - a.potential_compensation_inr)
        .slice(0, 10)
    };

    const db = loadDb();
    db.latestBatchSummary = summary;
    db.batchResults = results;
    saveDb(db);

    res.json({ summary, results });
  } catch (err: any) {
    res.status(500).json({ error: { code: "BATCH_TRIAGE_FAILED", message: err.message || "Batch triage failed" } });
  }
});

app.get("/api/b2b/exposure-report", (req, res) => {
  const db = loadDb();
  const format = req.query.format || "json";

  if (format === "csv") {
    const csvData = (db.batchResults || []).map((r: any) => ({
      ComplaintID: r.complaint_id,
      Amount: r.amount ?? "",
      Date: r.transaction_date ?? "",
      Reference: r.reference ?? "",
      Classification: r.classification,
      Branch: r.branch,
      TATBreached: r.tat_breached ? "Yes" : "No",
      DaysDelayed: r.days_delayed,
      CompensationINR: r.potential_compensation_inr,
      Priority: r.priority,
      RecommendedAction: r.recommended_action
    }));

    const csvOutput = Papa.unparse(csvData);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=refundrakshak_exposure_report.csv");
    return res.send(csvOutput);
  }

  res.json({
    summary: db.latestBatchSummary || { total_complaints: 0, total_compensation_exposure: 0 },
    results: db.batchResults || []
  });
});

// Explicit API 404 guard - ensures API calls always get JSON error, never fallback HTML
app.all("/api/*", (req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `API endpoint ${req.method} ${req.path} not found.`
    }
  });
});

// Vite middleware in dev / Static files in production
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
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RefundRakshak production server listening on http://0.0.0.0:${PORT}`);
  });
}
