import { describe, it, expect } from "vitest";
import { calculateTATDeadlineAndCompensation, toISTDateString, getCalendarDayDiff } from "../server/rules-engine.ts";
import { redactSecrets, maskReference, executeToolCall } from "../server/tools.ts";
import { triageComplaintUnified } from "../server/b2b.ts";
import { createDemoCaseState } from "../server/store.ts";

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
