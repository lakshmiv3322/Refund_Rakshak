import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateTATDeadlineAndCompensation,
  toISTDateString,
  getCalendarDayDiff,
  loadVerifiedRules,
  getScenarioById,
  getAllScenarios,
  checkUpiScenarioAmbiguity
} from "../server/rules-engine.ts";
import { redactSecrets, maskReference, executeToolCall } from "../server/tools.ts";
import { triageComplaintUnified } from "../server/b2b.ts";
import { findBankContact, loadBankContacts } from "../server/email.ts";
import {
  createDemoCaseState,
  generatePlaintextToken,
  hashToken,
  sanitizeCase,
  saveCaseState,
  getCaseById,
  listCasesForToken,
  getDatabase,
  type CaseState
} from "../server/store.ts";
import { checkAndExecuteDueFollowups } from "../server/scheduler.ts";

describe("RefundRakshak Production Rule Engine (RBI Circular RBI/2019-20/67)", () => {
  it("calculates T+1 calendar deadline and ₹100/day compensation correctly (9 days old -> 8 days delayed -> ₹800)", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-22", "2026-10-01");
    expect(calc.calendar_days_elapsed).toBe(9);
    expect(calc.days_delayed).toBe(8);
    expect(calc.potential_compensation_estimate).toBe(800);
    expect(calc.caveat).toContain("Potential compensation estimate, subject to verification.");
  });

  it("handles boundary: same day transaction (delay = 0, compensation = 0)", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-22", "2026-09-22");
    expect(calc.calendar_days_elapsed).toBe(0);
    expect(calc.days_delayed).toBe(0);
    expect(calc.potential_compensation_estimate).toBe(0);
  });

  it("handles boundary: exact T+1 day (delay = 0, compensation = 0)", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-22", "2026-09-23");
    expect(calc.calendar_days_elapsed).toBe(1);
    expect(calc.days_delayed).toBe(0);
    expect(calc.potential_compensation_estimate).toBe(0);
  });

  it("handles boundary: T+2 days (delay = 1 day, compensation = ₹100)", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-22", "2026-09-24");
    expect(calc.calendar_days_elapsed).toBe(2);
    expect(calc.days_delayed).toBe(1);
    expect(calc.potential_compensation_estimate).toBe(100);
  });

  it("handles month-end boundaries (e.g. Sept 30 to Oct 1)", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-30", "2026-10-01");
    expect(calc.calendar_days_elapsed).toBe(1);
    expect(calc.days_delayed).toBe(0);

    const calc2 = calculateTATDeadlineAndCompensation("2026-09-30", "2026-10-02");
    expect(calc2.calendar_days_elapsed).toBe(2);
    expect(calc2.days_delayed).toBe(1);
    expect(calc2.potential_compensation_estimate).toBe(100);
  });

  it("rejects future dates with descriptive error", () => {
    expect(() => calculateTATDeadlineAndCompensation("2026-10-05", "2026-10-01")).toThrow("cannot be in the future");
  });

  it("converts timestamps into consistent IST calendar dates", () => {
    const istDate = toISTDateString("2026-09-22T20:30:00.000Z");
    expect(istDate).toBe("2026-09-23"); // 20:30 UTC is 02:00 next day IST
  });
});

describe("Secret Redaction & Financial Masking", () => {
  it("redacts 4-6 digit UPI PINs", () => {
    const res = redactSecrets("My UPI PIN is 1234 and mpin is 987654");
    expect(res.foundSecrets).toBe(true);
    expect(res.redactedText).toContain("[REDACTED_PIN]");
    expect(res.redactedText).not.toContain("1234");
  });

  it("redacts OTPs", () => {
    const res = redactSecrets("Your OTP is 894321 for transaction");
    expect(res.foundSecrets).toBe(true);
    expect(res.redactedText).toContain("[REDACTED_OTP]");
    expect(res.redactedText).not.toContain("894321");
  });

  it("redacts CVVs and passwords", () => {
    const res = redactSecrets("CVV: 987 and password: secretPass123");
    expect(res.foundSecrets).toBe(true);
    expect(res.redactedText).toContain("[REDACTED_CVV]");
    expect(res.redactedText).toContain("[REDACTED_PASSWORD]");
  });

  it("redacts 16-digit card numbers", () => {
    const res = redactSecrets("Card used was 4111 2222 3333 4444");
    expect(res.foundSecrets).toBe(true);
    expect(res.redactedText).toContain("[REDACTED_CARD_NUMBER]");
  });

  it("redacts 12-digit Aadhaar numbers", () => {
    const res = redactSecrets("Aadhaar id is 1234 5678 9012");
    expect(res.foundSecrets).toBe(true);
    expect(res.redactedText).toContain("[REDACTED_AADHAAR]");
  });

  it("masks transaction reference to last 4 characters", () => {
    expect(maskReference("DEMOUPI123456")).toBe("****3456");
    expect(maskReference(null)).toBe("N/A");
  });
});

describe("Unified B2B Batch Triage", () => {
  it("classifies fraud row and retains branch even if reference is missing", () => {
    const comp = { complaint_id: "F1", text: "Unauthorized transaction someone hacked account", amount: 5000, transaction_date: "2026-09-25", reference: null };
    const res = triageComplaintUnified(comp, "2026-10-01");
    expect(res.classification).toBe("unauthorized_or_fraud");
    expect(res.branch).toBe("fraud_safety_branch");
    expect(res.potential_compensation_inr).toBe(0);
    expect(res.tat_breached).toBe(false);
  });

  it("classifies ATM dispute and retains branch even without reference", () => {
    const comp = { complaint_id: "A1", text: "ATM cash dispense failed card debited", amount: 2000, transaction_date: "2026-09-25", reference: null };
    const res = triageComplaintUnified(comp, "2026-10-01");
    expect(res.classification).toBe("atm_or_card");
    expect(res.branch).toBe("out_of_scope_atm");
  });

  it("classifies supported UPI failure with missing reference as missing_evidence (0 compensation)", () => {
    const comp = { complaint_id: "S1", text: "Money debited from account", amount: 1500, transaction_date: "2026-09-25", reference: null };
    const res = triageComplaintUnified(comp, "2026-10-01");
    expect(res.classification).toBe("missing_evidence");
    expect(res.branch).toBe("missing_evidence");
    expect(res.potential_compensation_inr).toBe(0);
  });

  it("calculates correct delay and compensation for complete supported row", () => {
    const comp = { complaint_id: "S2", text: "UPI failed debit", amount: 2400, transaction_date: "2026-09-22", reference: "UPI123456" };
    const res = triageComplaintUnified(comp, "2026-10-01");
    expect(res.classification).toBe("supported_upi_failed_debited_not_credited");
    expect(res.tat_breached).toBe(true);
    expect(res.days_delayed).toBe(8);
    expect(res.potential_compensation_inr).toBe(800);
    expect(res.drafted_customer_reply.startsWith("DRAFT - requires human review before sending.")).toBe(true);
  });
});

describe("Deterministic Tool Calling & State Hygiene", () => {
  it("blocks Ombudsman draft if bank complaint has not waited 30 days", () => {
    const demo = createDemoCaseState();
    demo.bank_complaint_date = "2026-09-23";
    demo.simulated_now = "2026-09-25T09:00:00Z"; // 2 days elapsed
    demo.bank_response = null;

    const res = executeToolCall("generate_ombudsman_draft", {}, demo);
    expect(res.result.error).toContain("must have bank complaint and wait 30 days");
  });

  it("allows Ombudsman draft if 30 days elapsed from bank complaint", () => {
    const demo = createDemoCaseState();
    demo.bank_complaint_date = "2026-08-20";
    demo.simulated_now = "2026-10-01T09:00:00Z"; // > 40 days elapsed
    demo.bank_response = null;

    const res = executeToolCall("generate_ombudsman_draft", {}, demo);
    expect(res.result.payload?.portal_url).toBe("https://cms.rbi.org.in");
    expect(res.result.status).toBe("pending_approval");
  });

  it("refuses rule lookup when required facts are missing", () => {
    const demo = createDemoCaseState();
    demo.transaction_facts.amount = null; // missing amount
    const res = executeToolCall("lookup_verified_rule", {}, demo);
    expect(res.result.applicable).toBe(false);
    expect(res.result.reason).toBe("insufficient_evidence");
  });
});

describe("Access Control & Token Isolation (Requirement 2)", () => {
  it("generates 48-char hex tokens and validates hashes", () => {
    const rawToken = generatePlaintextToken();
    expect(rawToken.length).toBe(48);
    const hashed = hashToken(rawToken);
    expect(hashed.length).toBe(64); // sha256 hex
    expect(hashToken(rawToken)).toBe(hashed); // deterministic
  });

  it("proves Case A's token cannot read Case B", () => {
    const tokenA = generatePlaintextToken();
    const tokenB = generatePlaintextToken();

    const caseA: CaseState = {
      ...createDemoCaseState(),
      case_id: "CASE-USER-A",
      token_hash: hashToken(tokenA)
    };

    const caseB: CaseState = {
      ...createDemoCaseState(),
      case_id: "CASE-USER-B",
      token_hash: hashToken(tokenB)
    };

    saveCaseState(caseA);
    saveCaseState(caseB);

    // Attempting to authenticate with Token A against Case B
    const hashA = hashToken(tokenA);
    expect(hashA).not.toBe(caseB.token_hash);

    // Querying cases for User A returns Case A only, never Case B
    const userACases = listCasesForToken(hashA);
    expect(userACases.some(c => c.case_id === "CASE-USER-A")).toBe(true);
    expect(userACases.some(c => c.case_id === "CASE-USER-B")).toBe(false);
  });

  it("sanitizes cases by stripping token_hash and auth_token", () => {
    const rawToken = generatePlaintextToken();
    const testCase: CaseState = {
      ...createDemoCaseState(),
      auth_token: "secret_legacy_token",
      token_hash: hashToken(rawToken)
    };

    const sanitized = sanitizeCase(testCase);
    expect((sanitized as any).auth_token).toBeUndefined();
    expect((sanitized as any).token_hash).toBeUndefined();
    expect(sanitized.case_id).toBe(testCase.case_id);
  });
});

describe("SQLite Persistence & Atomic Storage (Requirement 7)", () => {
  it("initializes SQLite with schema versioning", () => {
    const db = getDatabase();
    const versionRow = db.prepare("SELECT MAX(version) as version FROM schema_version").get() as { version: number };
    expect(versionRow.version).toBeGreaterThanOrEqual(1);
  });

  it("persists and retrieves cases from SQLite atomically", () => {
    const id = "SQLITE-TEST-" + Math.floor(Math.random() * 10000);
    const token = generatePlaintextToken();
    const newCase: CaseState = {
      ...createDemoCaseState(),
      case_id: id,
      token_hash: hashToken(token),
      transaction_facts: {
        ...createDemoCaseState().transaction_facts,
        amount: 8888,
        transaction_reference: "REF-SQLITE-8888"
      }
    };

    saveCaseState(newCase);
    const loaded = getCaseById(id);
    expect(loaded).not.toBeNull();
    expect(loaded?.transaction_facts.amount).toBe(8888);
    expect(loaded?.transaction_facts.transaction_reference).toBe("REF-SQLITE-8888");
  });
});

describe("Scheduler Idempotency, Real Time & Recommended Wait (Requirement 6)", () => {
  it("updates latest estimate and creates nodal action with recommended wait phrasing", () => {
    const schedCaseId = "SCHED-TEST-" + Math.floor(Math.random() * 10000);
    const token = generatePlaintextToken();

    const schedCase: CaseState = {
      ...createDemoCaseState(),
      case_id: schedCaseId,
      token_hash: hashToken(token),
      classification: "supported_upi_failed_debited_not_credited",
      transaction_facts: {
        ...createDemoCaseState().transaction_facts,
        amount: 3000,
        transaction_date: "2026-09-20"
      },
      bank_complaint_date: "2026-09-21",
      bank_response: null,
      pending_actions: [],
      followups: [
        {
          id: "fu_sched_1",
          due_date: "2026-09-28T00:00:00Z",
          condition: "bank_no_response_7_days",
          action_type: "prepare_nodal_escalation",
          status: "pending"
        }
      ]
    };

    saveCaseState(schedCase);

    // Run scheduler at simulated date 2026-10-01 (10 days after bank complaint)
    const result1 = checkAndExecuteDueFollowups("2026-10-01T12:00:00Z");
    const updated1 = getCaseById(schedCaseId)!;

    // Followup executed
    expect(updated1.followups[0].status).toBe("executed");
    expect(updated1.escalation_stage).toBe("nodal_escalation_ready");

    // Action created
    expect(updated1.pending_actions.length).toBe(1);
    const nodalAction = updated1.pending_actions[0];
    expect(nodalAction.type).toBe("nodal_officer_escalation");
    // Phrasing test: "recommended wait", not an RBI requirement
    expect(nodalAction.payload.body).toContain("industry-standard recommended wait period, not an RBI statutory clause");

    // Estimate stored on case
    expect(updated1.latest_compensation_estimate).toBeGreaterThan(0);

    // Idempotency: run scheduler again at same date
    const result2 = checkAndExecuteDueFollowups("2026-10-01T12:00:00Z");
    const updated2 = getCaseById(schedCaseId)!;
    // Must NOT create duplicate nodal actions
    expect(updated2.pending_actions.length).toBe(1);
  });
});

describe("Verified Scenario Table & Ambiguity Resolution (Phase 2, Requirement 5)", () => {
  it("loads scenario table from data/verified_rules.json with verified circular references", () => {
    const scenarios = getAllScenarios();
    expect(scenarios.length).toBeGreaterThanOrEqual(4);

    const upiP2P = getScenarioById("upi_p2p_debit_not_credited");
    expect(upiP2P).toBeDefined();
    expect(upiP2P?.tat_days).toBe(1);
    expect(upiP2P?.day_basis).toBe("calendar");
    expect(upiP2P?.circular_row).toContain("Item 4(a)");
    expect(upiP2P?.status_label).toContain("RBI Circular RBI/2019-20/67");

    const upiP2M = getScenarioById("upi_p2m_merchant_debit_failed");
    expect(upiP2M).toBeDefined();
    expect(upiP2M?.tat_days).toBe(5);
    expect(upiP2M?.day_basis).toBe("calendar");
    expect(upiP2M?.circular_row).toContain("Item 4(b)");
  });

  it("calculates TAT and delayed compensation for UPI P2M merchant scenario (T+5)", () => {
    // 9 calendar days elapsed, T+5 deadline -> 4 days delayed -> ₹400
    const calc = calculateTATDeadlineAndCompensation("2026-09-22", "2026-10-01", "upi_p2m_merchant_debit_failed");
    expect(calc.tat_days).toBe(5);
    expect(calc.calendar_days_elapsed).toBe(9);
    expect(calc.days_delayed).toBe(4);
    expect(calc.potential_compensation_estimate).toBe(400);
    expect(calc.circular_row).toContain("Item 4(b)");
  });

  it("detects ambiguity when UPI transaction does not state P2P vs P2M and provides clarifying question", () => {
    const text = "My UPI payment failed and money was debited from my account.";
    const ambiguity = checkUpiScenarioAmbiguity(text, "2026-09-22", "2026-10-01");
    expect(ambiguity.isAmbiguous).toBe(true);
    expect(ambiguity.p2pCalculation.days_delayed).toBe(8);
    expect(ambiguity.p2mCalculation?.days_delayed).toBe(4);
    expect(ambiguity.clarifyingQuestion).toContain("Was this payment sent to an individual person (P2P");
    expect(ambiguity.clarifyingQuestion).toContain("or to a merchant/shopkeeper/online store (P2M");
  });

  it("resolves to P2M without ambiguity when merchant is mentioned", () => {
    const text = "My UPI payment to Swiggy store failed and debited.";
    const ambiguity = checkUpiScenarioAmbiguity(text, "2026-09-22", "2026-10-01", "Swiggy");
    expect(ambiguity.isAmbiguous).toBe(false);
    expect(ambiguity.selectedScenario).toBe("upi_p2m_merchant_debit_failed");
  });

  it("resolves to P2P without ambiguity when friend/personal transfer is mentioned", () => {
    const text = "Sent money to my friend via UPI, debited but not credited.";
    const ambiguity = checkUpiScenarioAmbiguity(text, "2026-09-22", "2026-10-01");
    expect(ambiguity.isAmbiguous).toBe(false);
    expect(ambiguity.selectedScenario).toBe("upi_p2p_debit_not_credited");
  });
});

describe("Bank Contact Directory & Recipient Verification (Phase 2, Requirements 7 & 8)", () => {
  it("loads bank contacts from data/banks.json and matches aliases", () => {
    const banks = loadBankContacts();
    expect(banks.length).toBeGreaterThanOrEqual(5);

    const sbi = findBankContact("SBI");
    expect(sbi).not.toBeNull();
    expect(sbi?.grievance_email).toBe("customercare@sbi.co.in");
    expect(sbi?.nodal_officer_email).toBe("nodalofficer@sbi.co.in");

    const hdfc = findBankContact("HDFC Bank");
    expect(hdfc).not.toBeNull();
    expect(hdfc?.nodal_officer_email).toBe("pno@hdfcbank.com");
  });

  it("verifies known bank grievance addresses", () => {
    const banks = loadBankContacts();
    const knownEmails = new Set<string>();
    banks.forEach(b => {
      knownEmails.add(b.grievance_email.toLowerCase());
      knownEmails.add(b.nodal_officer_email.toLowerCase());
    });

    expect(knownEmails.has("customercare@sbi.co.in")).toBe(true);
    expect(knownEmails.has("pno@hdfcbank.com")).toBe(true);
    expect(knownEmails.has("random_attacker@evil.com")).toBe(false);
  });
});

describe("Expanded Incident Scenarios & Safety Rules", () => {
  it("calculates ATM non-dispensation TAT (T+5, Item 1(a))", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-20", "2026-10-01", "atm_cash_not_dispensed");
    expect(calc.tat_days).toBe(5);
    expect(calc.days_delayed).toBe(6);
    expect(calc.potential_compensation_estimate).toBe(600);
    expect(calc.circular_row).toContain("Item 1(a)");
  });

  it("calculates delayed merchant refund TAT (T+5, Item 4(c))", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-20", "2026-10-01", "delayed_merchant_refund");
    expect(calc.tat_days).toBe(5);
    expect(calc.days_delayed).toBe(6);
    expect(calc.potential_compensation_estimate).toBe(600);
    expect(calc.circular_row).toContain("4(c)");
  });

  it("handles wrong recipient UPI with 0 delay compensation and recall advice", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-20", "2026-10-01", "upi_wrong_recipient");
    expect(calc.potential_compensation_estimate).toBe(0);
    expect(calc.explanation).toContain("Daily delay compensation does not apply");
  });

  it("handles unauthorized cyber fraud with 0 delay compensation and customer liability circular", () => {
    const calc = calculateTATDeadlineAndCompensation("2026-09-28", "2026-10-01", "unauthorized_fraud_golden_hour");
    expect(calc.potential_compensation_estimate).toBe(0);
    expect(calc.circular_reference).toContain("DBR.No.Leg.BC.78");
  });

  it("redacts Indian PAN card numbers", () => {
    const res = redactSecrets("My PAN number is ABCDE1234F for verification");
    expect(res.foundSecrets).toBe(true);
    expect(res.redactedText).toContain("[REDACTED_PAN]");
    expect(res.redactedText).not.toContain("ABCDE1234F");
  });
});

