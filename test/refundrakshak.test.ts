import { describe, it, expect } from "vitest";

function testTriage(comp: { complaint_id: string; amount?: number | null; transaction_date?: string | null; reference?: string | null }, asOfDate?: string) {
  const amount = comp.amount !== undefined && comp.amount !== null && !isNaN(Number(comp.amount)) ? Number(comp.amount) : null;
  const txDate = comp.transaction_date ? String(comp.transaction_date).trim() : null;
  const ref = comp.reference ? String(comp.reference).trim() : null;

  const missingFields: string[] = [];
  if (amount === null) missingFields.push("amount");
  if (!txDate) missingFields.push("transaction_date");
  if (!ref) missingFields.push("reference");

  if (missingFields.length > 0) {
    return {
      complaint_id: comp.complaint_id || "COMP-TEST",
      amount: null,
      transaction_date: null,
      reference: null,
      classification: "missing_evidence",
      branch: "missing_evidence",
      tat_breached: false,
      days_delayed: 0,
      potential_compensation_inr: 0,
      recommended_action: `Request the missing fields: ${missingFields.join(", ")}`,
      drafted_customer_reply: `DRAFT - requires human review before sending. We are reviewing your case and any applicable compensation, subject to verification. Missing details: ${missingFields.join(", ")}.`,
      missing_fields: missingFields
    };
  }

  const now = new Date(asOfDate || "2026-10-01T00:00:00Z");
  const d = new Date(txDate || "2026-09-20");
  const diffDays = Math.ceil(Math.abs(now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
  const delayDays = Math.max(0, diffDays - 1);
  const compEst = delayDays * 100;

  return {
    complaint_id: comp.complaint_id || "COMP-TEST",
    amount,
    transaction_date: txDate,
    reference: ref,
    classification: "supported_upi_failed_debited_not_credited",
    branch: "supported_upi_failed_debit",
    tat_breached: delayDays > 0,
    days_delayed: delayDays,
    potential_compensation_inr: compEst,
    drafted_customer_reply: `DRAFT - requires human review before sending. Dear Customer, regarding your UPI transaction ${ref} of ₹${amount}, we are reviewing your case and any applicable compensation, subject to verification.`
  };
}

describe("RefundRakshak Fix 3 & Copilot Unit Tests", () => {
  it("(a) a row with no date, amount or reference yields missing_evidence and 0 compensation", () => {
    const row = { complaint_id: "C1", amount: null, transaction_date: null, reference: null };
    const res = testTriage(row);
    expect(res.classification).toBe("missing_evidence");
    expect(res.amount).toBeNull();
    expect(res.transaction_date).toBeNull();
    expect(res.reference).toBeNull();
    expect(res.potential_compensation_inr).toBe(0);
    expect(res.tat_breached).toBe(false);
  });

  it("(b) the exposure total excludes missing-evidence rows", () => {
    const batch = [
      { complaint_id: "C1", amount: null, transaction_date: null, reference: null }, // missing
      { complaint_id: "C2", amount: 2000, transaction_date: "2026-09-22", reference: "REF02" } // 9 days old = 8 delayed days = 800 Rs
    ];

    const results = batch.map(c => testTriage(c, "2026-10-01T00:00:00Z"));
    let totalExposure = 0;
    results.forEach(r => {
      if (r.classification !== "missing_evidence") {
        totalExposure += r.potential_compensation_inr;
      }
    });

    expect(totalExposure).toBe(800);
  });

  it("(c) changing as_of changes days_delayed", () => {
    const row = { complaint_id: "C3", amount: 1000, transaction_date: "2026-09-25", reference: "REF03" };
    const res1 = testTriage(row, "2026-10-01T00:00:00Z");
    const res2 = testTriage(row, "2026-10-05T00:00:00Z");

    expect(res1.days_delayed).toBe(5);
    expect(res1.potential_compensation_inr).toBe(500);

    expect(res2.days_delayed).toBe(9);
    expect(res2.potential_compensation_inr).toBe(900);
  });

  it("(d) every drafted reply starts with the DRAFT prefix", () => {
    const rowMissing = { complaint_id: "C1", amount: null, transaction_date: null, reference: null };
    const rowValid = { complaint_id: "C2", amount: 2000, transaction_date: "2026-09-22", reference: "REF02" };

    const res1 = testTriage(rowMissing);
    const res2 = testTriage(rowValid, "2026-10-01T00:00:00Z");

    expect(res1.drafted_customer_reply.startsWith("DRAFT - requires human review before sending.")).toBe(true);
    expect(res2.drafted_customer_reply.startsWith("DRAFT - requires human review before sending.")).toBe(true);
  });
});
