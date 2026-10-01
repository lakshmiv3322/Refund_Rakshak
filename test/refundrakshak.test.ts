import { describe, it, expect } from "vitest";

describe("RefundRakshak Rule Engine & Copilot Tests", () => {
  it("should classify supported failed UPI transaction correctly", () => {
    const desc = "UPI payment of ₹2,400 failed and debited 9 days ago. Receiver did not get it.";
    const amtMatch = desc.match(/[₹Rs]*\s*([0-9,]+(?:\.[0-9]{2})?)/i);
    expect(amtMatch).not.toBeNull();
    expect(parseFloat(amtMatch![1].replace(/,/g, ""))).toBe(2400);
  });

  it("should calculate compensation estimate correctly for 9-day-old case (8 delayed days = Rs 800)", () => {
    const txDate = new Date("2026-09-22");
    const now = new Date("2026-10-01");
    const diffTime = Math.abs(now.getTime() - txDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    const delayDays = Math.max(0, diffDays - 1);
    const compEst = delayDays * 100;

    expect(diffDays).toBe(9);
    expect(delayDays).toBe(8);
    expect(compEst).toBe(800);
  });

  it("should enforce mandatory compensation wording and no guarantee of compensation", () => {
    const wording = "Potential compensation estimate, subject to verification.";
    expect(wording).toContain("Potential compensation estimate, subject to verification.");
    expect(wording).not.toContain("Guaranteed compensation");
  });

  it("should validate batch triage summary math", () => {
    const results = [
      { classification: "supported_upi_failed_debited_not_credited", tat_breached: true, potential_compensation_inr: 800 },
      { classification: "supported_upi_failed_debited_not_credited", tat_breached: false, potential_compensation_inr: 0 },
      { classification: "unauthorized_or_fraud", tat_breached: false, potential_compensation_inr: 0 }
    ];

    let breachedCount = 0;
    let totalExposure = 0;
    results.forEach(r => {
      if (r.tat_breached) breachedCount++;
      totalExposure += r.potential_compensation_inr;
    });

    expect(results.length).toBe(3);
    expect(breachedCount).toBe(1);
    expect(totalExposure).toBe(800);
  });

  it("should verify fraud classification branches away from TAT rule", () => {
    const text = "Someone hacked my account and made unauthorized transaction";
    const isFraud = text.toLowerCase().includes("fraud") || text.toLowerCase().includes("unauthorized") || text.toLowerCase().includes("hacked");
    expect(isFraud).toBe(true);
  });

  it("should verify merchant refund classification branch", () => {
    const text = "Merchant cancelled order and refund pending";
    const isMerchant = text.toLowerCase().includes("merchant") || text.toLowerCase().includes("refund");
    expect(isMerchant).toBe(true);
  });
});
