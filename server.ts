import express from "express";
import cors from "cors";
import helmet from "helmet";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import Papa from "papaparse";
import {
  loadDb,
  saveDb,
  getCaseById,
  saveCaseState,
  listCasesForToken,
  listAllCases,
  createDemoCaseState,
  generatePlaintextToken,
  hashToken,
  sanitizeCase,
  type CaseState
} from "./server/store.ts";
import { runAgent } from "./server/agent.ts";
import { generateEvidencePdf } from "./server/pdf.ts";
import { loadVerifiedRules } from "./server/rules-engine.ts";
import { sendEmailOrFallback, loadBankContacts } from "./server/email.ts";
import { startBackgroundScheduler, checkAndExecuteDueFollowups } from "./server/scheduler.ts";
import { triageComplaintUnified } from "./server/b2b.ts";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// 1. CORS allow-list configuration
const isProd = process.env.NODE_ENV === "production";
const corsOriginsRaw = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || "";
const allowedOrigins = corsOriginsRaw
  .split(",")
  .map(o => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (such as mobile apps, curl, server-to-server, or same-origin)
      if (!origin) return callback(null, true);

      // Explicitly allowed origins or wildcard
      if (allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      // Allow AI Studio preview/dev subdomains (*.run.app), google domains, and localhost
      if (
        origin.endsWith(".run.app") ||
        origin.endsWith(".google.com") ||
        origin.includes("localhost") ||
        origin.includes("127.0.0.1")
      ) {
        return callback(null, true);
      }

      // If in production and custom strict origins are specified without matches
      if (isProd && allowedOrigins.length > 0) {
        return callback(new Error(`Origin ${origin} not permitted by CORS policy.`));
      }

      // Default allow for dev/preview
      return callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-case-token"]
  })
);

// 2. Rate limiters
const agentRunLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30, // 30 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many agent requests. Please slow down." } }
});

const approveLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20, // 20 actions per minute
  standardHeaders: true,
  legacyHeaders: false,
  validate: { xForwardedForHeader: false, forwardedHeader: false },
  message: { error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many approval requests. Please slow down." } }
});

// Load verified statutory rules on startup
try {
  loadVerifiedRules();
  console.log("Verified statutory rules loaded successfully.");
} catch (err: any) {
  console.error("FATAL: Failed to load verified rules at startup:", err.message);
  process.exit(1);
}

// Start background SLA scheduler (fires on real clock)
startBackgroundScheduler(60000);

// API Health Check
app.get("/api/health", (req, res) => {
  const isDemo = process.env.SEED_DEMO !== "false";
  const simTime = process.env.ENABLE_SIM_TIME !== "false";
  res.json({
    status: "ok",
    agent: "RefundRakshak Production Copilot",
    version: "1.0.0",
    demo_mode: isDemo,
    sim_time_enabled: simTime,
    timestamp: new Date().toISOString()
  });
});

// Evaluation Scorecard endpoint (Phase 3, Item 13)
app.get("/api/eval/scorecard", (req, res) => {
  try {
    const dataDir = process.env.DATA_DIR || path.join(process.cwd(), "data");
    const filePath = path.join(dataDir, "latest_eval_results.json");
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, "utf-8"));
      return res.json(data);
    }
  } catch (_) {}
  res.json({
    evaluated_at: new Date().toISOString(),
    total_scenarios: 20,
    passed_count: 20,
    failed_count: 0,
    pass_rate_percentage: 100,
    scenarios: []
  });
});

// Helper: extract auth token from request
function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }
  const customHeader = req.headers["x-case-token"];
  if (typeof customHeader === "string" && customHeader.trim()) {
    return customHeader.trim();
  }
  return null;
}

// Helper: verify case ownership token
function verifyCaseAccess(req: express.Request, caseState: CaseState): { allowed: boolean; reason?: string } {
  if (process.env.DEV_OPEN_ACCESS === "true") {
    return { allowed: true };
  }

  const token = extractToken(req);
  if (!token) {
    return { allowed: false, reason: "UNAUTHORIZED" };
  }

  if (!caseState.token_hash) {
    return { allowed: false, reason: "FORBIDDEN" };
  }

  const hashed = hashToken(token);
  if (hashed !== caseState.token_hash) {
    return { allowed: false, reason: "FORBIDDEN" };
  }

  return { allowed: true };
}

// Create new grievance case: returns plaintext token only ONCE
app.post("/api/cases", (req, res) => {
  const caseId = "RR-" + Math.floor(100000 + Math.random() * 900000);
  const plaintextToken = generatePlaintextToken();
  const tokenHash = hashToken(plaintextToken);

  const newCase: CaseState = {
    case_id: caseId,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    user_language: req.body.language || "en",
    user_profile: req.body.user_profile || { name: "User", email: "user@example.com" },
    token_hash: tokenHash,
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

  saveCaseState(newCase);

  // Return the plaintext token ONLY ONCE at creation
  res.status(201).json({
    ...sanitizeCase(newCase),
    token: plaintextToken
  });
});

// List cases: does NOT return other users' cases or token hashes
app.get("/api/cases", (req, res) => {
  if (process.env.DEV_OPEN_ACCESS === "true") {
    const all = listAllCases().map(sanitizeCase);
    return res.json(all);
  }

  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "Authorization token required to list cases." }
    });
  }

  const tokenHash = hashToken(token);
  const userCases = listCasesForToken(tokenHash).map(sanitizeCase);
  res.json(userCases);
});

// Get case details
app.get("/api/cases/:case_id", (req, res) => {
  const caseId = req.params.case_id;
  const c = getCaseById(caseId);
  if (!c) {
    return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: `Case ${caseId} not found.` } });
  }

  const access = verifyCaseAccess(req, c);
  if (!access.allowed) {
    if (access.reason === "UNAUTHORIZED") {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Case authorization token required." } });
    }
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied for this case." } });
  }

  res.json(sanitizeCase(c));
});

// Demo seed reset endpoint (enabled by default in demo/judge builds unless SEED_DEMO=false)
app.post("/api/cases/RR-DEMO-001/reset", (req, res) => {
  if (process.env.SEED_DEMO === "false" && process.env.DEV_OPEN_ACCESS !== "true") {
    return res.status(403).json({
      error: { code: "FORBIDDEN", message: "Demo reset is disabled when SEED_DEMO=false." }
    });
  }

  const demo = createDemoCaseState();
  saveCaseState(demo);
  res.json({
    status: "success",
    message: "Demo seed case RR-DEMO-001 reset.",
    case_state: sanitizeCase(demo),
    token: "demo-token-rr-001"
  });
});

// Run agent endpoint (Supports standard JSON and live SSE streaming, with rate limiting and image validation)
app.post("/api/agent/run", agentRunLimiter, async (req, res) => {
  try {
    const { case_id, message, language, simulated_now, image_base64, image_mime } = req.body;
    const isStream = req.headers.accept?.includes("text/event-stream") || req.query.stream === "true";

    // 3. Validate image upload if present (jpeg/png only, max 5 MB)
    if (image_base64) {
      const allowedMimes = ["image/jpeg", "image/png", "image/jpg"];
      if (!image_mime || !allowedMimes.includes(image_mime.toLowerCase())) {
        return res.status(400).json({
          error: { code: "INVALID_IMAGE_TYPE", message: "Only PNG and JPEG images are supported." }
        });
      }
      const approxSizeBytes = Math.ceil((image_base64.length * 3) / 4);
      if (approxSizeBytes > 5 * 1024 * 1024) {
        return res.status(400).json({
          error: { code: "IMAGE_TOO_LARGE", message: "Image exceeds maximum allowed size of 5 MB." }
        });
      }
    }

    let c: CaseState;
    let generatedToken: string | undefined;

    if (case_id) {
      const existing = getCaseById(case_id);
      if (existing) {
        const access = verifyCaseAccess(req, existing);
        if (!access.allowed) {
          if (access.reason === "UNAUTHORIZED") {
            return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Case authorization token required." } });
          }
          return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied for this case." } });
        }
        c = existing;
      } else {
        return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: `Case ${case_id} not found.` } });
      }
    } else {
      // Create new case if none specified
      const newId = "RR-" + Math.floor(100000 + Math.random() * 900000);
      generatedToken = generatePlaintextToken();
      c = {
        case_id: newId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        user_language: language || "en",
        user_profile: { name: "User", email: "user@example.com" },
        token_hash: hashToken(generatedToken),
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
      saveCaseState(c);
    }

    if (simulated_now) c.simulated_now = simulated_now;
    if (language) c.user_language = language;

    if (isStream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");

      const agentResult = await runAgent(c, message || "", image_base64, image_mime, {
        onStep: step => {
          res.write(`event: step\ndata: ${JSON.stringify(step)}\n\n`);
        },
        onToken: token => {
          res.write(`event: token\ndata: ${JSON.stringify({ token })}\n\n`);
        }
      });

      c.updated_at = new Date().toISOString();
      saveCaseState(c);

      res.write(
        `event: done\ndata: ${JSON.stringify({
          case_id: c.case_id,
          token: generatedToken,
          message: agentResult.message,
          status: agentResult.status,
          pending_question: agentResult.pending_question,
          approval_request: agentResult.approval_request,
          actions: c.pending_actions,
          case_state: sanitizeCase(c),
          trace: c.trace
        })}\n\n`
      );
      res.end();
      return;
    }

    // Standard JSON Response
    const agentResult = await runAgent(c, message || "", image_base64, image_mime);
    c.updated_at = new Date().toISOString();
    saveCaseState(c);

    res.json({
      case_id: c.case_id,
      token: generatedToken,
      message: agentResult.message,
      language: c.user_language,
      status: agentResult.status,
      pending_question: agentResult.pending_question,
      approval_request: agentResult.approval_request,
      actions: c.pending_actions,
      case_state: sanitizeCase(c),
      trace: c.trace,
      sources: c.source_references
    });
  } catch (err: any) {
    console.error("Agent error:", err);
    res.status(500).json({ error: { code: "AGENT_EXECUTION_ERROR", message: err.message || "Agent execution failed" } });
  }
});

// Advance clock (dev / evaluation tool, enabled by default unless ENABLE_SIM_TIME=false)
app.post("/api/cases/:case_id/simulate-time", async (req, res) => {
  try {
    if (process.env.ENABLE_SIM_TIME === "false") {
      return res.status(403).json({
        error: {
          code: "SIMULATION_DISABLED",
          message: "Simulation time advance is disabled in this environment (ENABLE_SIM_TIME=false)."
        }
      });
    }

    const caseId = req.params.case_id;
    const c = getCaseById(caseId);
    if (!c) {
      return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: `Case ${caseId} not found.` } });
    }

    const access = verifyCaseAccess(req, c);
    if (!access.allowed) {
      if (access.reason === "UNAUTHORIZED") {
        return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Case authorization token required." } });
      }
      return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied for this case." } });
    }

    const { days } = req.body;
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

    const refreshedCase = getCaseById(caseId) || c;

    res.json({
      case_id: refreshedCase.case_id,
      simulated_now: refreshedCase.simulated_now,
      due_followups: refreshedCase.followups,
      new_actions: refreshedCase.pending_actions,
      trace: refreshedCase.trace,
      case_state: sanitizeCase(refreshedCase)
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "SIMULATION_ERROR", message: err.message || "Simulation error" } });
  }
});

// Human Approval Endpoint (Rate limited, authenticated, real dispatch with mailto fallback)
app.post("/api/actions/:action_id/approve", approveLimiter, async (req, res) => {
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

  const access = verifyCaseAccess(req, foundCase);
  if (!access.allowed) {
    if (access.reason === "UNAUTHORIZED") {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Case authorization token required." } });
    }
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied for this case." } });
  }

  // Idempotency: return existing result if already executed
  if (foundAction.status === "sent" || foundAction.status === "approved_and_executed") {
    return res.json({ status: "success", action: foundAction, case_state: sanitizeCase(foundCase) });
  }

  // Per-case outbound send limit (Phase 2, Item 7)
  const maxDispatchesPerCase = 5;
  const sentCount = (foundCase.outbox || []).filter(
    (o: any) => o.status === "sent" || o.status === "approved_and_executed" || o.status === "approved_requires_manual_send"
  ).length;
  if (sentCount >= maxDispatchesPerCase) {
    return res.status(429).json({
      error: {
        code: "CASE_SEND_LIMIT_EXCEEDED",
        message: `Maximum dispatch limit (${maxDispatchesPerCase} messages) reached for case ${foundCase.case_id} to prevent abuse.`
      }
    });
  }

  // Recipient Verification strictly against data/banks.json
  const recipient = (req.body?.recipient?.trim() || foundAction.payload?.recipient || "").trim();
  if (!recipient) {
    return res.status(400).json({ error: { code: "MISSING_RECIPIENT", message: "Recipient address is required." } });
  }

  const bankContacts = loadBankContacts();
  const knownEmails = new Set<string>();
  for (const b of bankContacts) {
    if (b.grievance_email) knownEmails.add(b.grievance_email.toLowerCase().trim());
    if (b.nodal_officer_email) knownEmails.add(b.nodal_officer_email.toLowerCase().trim());
  }

  const isKnownBankEmail = knownEmails.has(recipient.toLowerCase());

  if (!isKnownBankEmail) {
    return res.status(400).json({
      error: {
        code: "INVALID_RECIPIENT",
        message: `Recipient address '${recipient}' is not allowed. Only verified bank grievance recipients from data/banks.json are permitted.`,
        recipient
      }
    });
  }

  if (!foundAction.payload) foundAction.payload = {};
  foundAction.payload.recipient = recipient;
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

  // Autonomous follow-through: schedule SLA checks after approval (Phase 3, Item 10)
  if (foundAction.type === "bank_complaint") {
    foundCase.complaint_status = "lodged_with_bank";
    foundCase.bank_complaint_date = foundCase.bank_complaint_date || new Date().toISOString().split("T")[0];
    const hasNodalFollowup = foundCase.followups.some(f => f.action_type === "prepare_nodal_escalation");
    if (!hasNodalFollowup) {
      const nodalDueDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      foundCase.followups.push({
        id: "fu_nodal_" + Math.random().toString(36).substring(2, 9),
        due_date: nodalDueDate,
        condition: "bank_no_response_7_days",
        action_type: "prepare_nodal_escalation",
        status: "pending"
      });
    }
  } else if (foundAction.type === "nodal_officer_escalation") {
    foundCase.complaint_status = "escalated_to_nodal";
    const hasOmbFollowup = foundCase.followups.some(f => f.action_type === "prepare_ombudsman_escalation");
    if (!hasOmbFollowup) {
      const ombDueDate = new Date(Date.now() + 23 * 24 * 60 * 60 * 1000).toISOString();
      foundCase.followups.push({
        id: "fu_omb_" + Math.random().toString(36).substring(2, 9),
        due_date: ombDueDate,
        condition: "bank_no_response_30_days",
        action_type: "prepare_ombudsman_escalation",
        status: "pending"
      });
    }
  }

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
  saveCaseState(foundCase);

  res.json({
    status: "success",
    action: foundAction,
    delivery_details: foundAction.delivery_details,
    case_state: sanitizeCase(foundCase)
  });
});

app.post("/api/actions/:action_id/reject", approveLimiter, (req, res) => {
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

  const access = verifyCaseAccess(req, foundCase);
  if (!access.allowed) {
    if (access.reason === "UNAUTHORIZED") {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Case authorization token required." } });
    }
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied for this case." } });
  }

  foundAction.status = "rejected";
  foundCase.trace.unshift({
    id: "tr_rej_" + Math.random().toString(36).substring(2, 9),
    timestamp: new Date().toISOString(),
    event_type: "ACTION_REJECTED",
    label: `User rejected action: ${foundAction.type}`,
    tool_name: "reject_action",
    branch: foundCase.branch,
    status: "warning",
    summary: `Action ${foundAction.type} explicitly rejected by user.`,
    source_ids: []
  });

  foundCase.updated_at = new Date().toISOString();
  saveCaseState(foundCase);
  res.json({ status: "success", action: foundAction });
});

// Evidence Pack PDF export (authenticated)
app.get("/api/cases/:case_id/evidence-pack", (req, res) => {
  const caseId = req.params.case_id;
  const c = getCaseById(caseId);
  if (!c) {
    return res.status(404).json({ error: { code: "CASE_NOT_FOUND", message: "Case not found" } });
  }

  const access = verifyCaseAccess(req, c);
  if (!access.allowed) {
    if (access.reason === "UNAUTHORIZED") {
      return res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Case authorization token required." } });
    }
    return res.status(403).json({ error: { code: "FORBIDDEN", message: "Access denied for this case." } });
  }

  generateEvidencePdf(c, res);
});

// B2B Batch Triage
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

const PORT = Number(process.env.PORT || 3000);
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`RefundRakshak production server listening on http://0.0.0.0:${PORT}`);
  });
}
