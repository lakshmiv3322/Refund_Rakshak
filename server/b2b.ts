import { calculateTATDeadlineAndCompensation } from "./rules-engine.ts";

export interface B2BComplaintInput {
  complaint_id: string;
  text?: string;
  amount?: number | null;
  transaction_date?: string | null;
  bank?: string | null;
  reference?: string | null;
}

export function triageComplaintUnified(comp: B2BComplaintInput, asOfDate?: string) {
  const amount = comp.amount !== undefined && comp.amount !== null && !isNaN(Number(comp.amount)) ? Number(comp.amount) : null;
  const txDate = comp.transaction_date ? String(comp.transaction_date).trim() : null;
  const ref = comp.reference ? String(comp.reference).trim() : null;

  const fullText = (comp.text || `Failed payment ₹${amount ?? ""} on ${txDate ?? ""} ref ${ref ?? ""}`).toLowerCase();

  // 1. Classify FIRST based on meaning
  let classification = "supported_upi_failed_debited_not_credited";
  let branch = "supported_upi_failed_debit";

  if (fullText.includes("fraud") || fullText.includes("unauthorized") || fullText.includes("did not make") || fullText.includes("hacked") || fullText.includes("stolen")) {
    classification = "unauthorized_or_fraud";
    branch = "fraud_safety_branch";
  } else if (fullText.includes("merchant") || fullText.includes("store refund") || fullText.includes("order cancelled") || fullText.includes("amazon") || fullText.includes("flipkart")) {
    classification = "merchant_refund";
    branch = "merchant_refund_branch";
  } else if (fullText.includes("atm") || fullText.includes("cash dispense") || fullText.includes("card swipe")) {
    classification = "atm_or_card";
    branch = "out_of_scope_atm";
  }

  // 2. Missing-evidence check applies to supported/unknown rows (Fraud/ATM/Merchant keep their branch)
  const missingFields: string[] = [];
  if (amount === null) missingFields.push("amount");
  if (!txDate) missingFields.push("transaction_date");
  if (!ref) missingFields.push("reference");

  if (classification === "supported_upi_failed_debited_not_credited" && missingFields.length > 0) {
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
      recommended_action: `Request missing fields: ${missingFields.join(", ")}`,
      drafted_customer_reply: `DRAFT - requires human review before sending. We are reviewing your case and any applicable compensation, subject to verification. Missing details: ${missingFields.join(", ")}.`,
      priority: "medium",
      missing_fields: missingFields
    };
  }

  let tatBreached = false;
  let daysDelayed = 0;
  let potentialComp = 0;
  let recommendedAction = "Process standard reversal within T+1";
  let draftedReply = "DRAFT - requires human review before sending. We are reviewing your case and any applicable compensation, subject to verification.";
  let priority = "medium";

  if (classification === "supported_upi_failed_debited_not_credited" && txDate) {
    try {
      const calc = calculateTATDeadlineAndCompensation(txDate, asOfDate || new Date().toISOString());
      daysDelayed = calc.days_delayed;
      tatBreached = daysDelayed > 0;
      potentialComp = calc.potential_compensation_estimate;
      priority = daysDelayed > 5 ? "high" : (daysDelayed > 0 ? "medium" : "low");
      recommendedAction = tatBreached ? `Immediate reversal + pay ₹${potentialComp} compensation` : `Process reversal within T+1 TAT`;
      draftedReply = `DRAFT - requires human review before sending. Dear Customer, regarding your UPI transaction ${ref} of ₹${amount}, we are reviewing your case and any applicable compensation, subject to verification.`;
    } catch (_) {}
  } else if (classification === "unauthorized_or_fraud") {
    priority = "high";
    recommendedAction = "Route to Fraud Risk Ops & Cyber Cell (1930) reporting";
    draftedReply = `DRAFT - requires human review before sending. Dear Customer, we have noted your report regarding transaction ${ref ?? ""}. Please report this immediately to the National Cyber Crime Portal (cybercrime.gov.in). We are reviewing your case, subject to verification.`;
  } else if (classification === "merchant_refund") {
    priority = "low";
    recommendedAction = "Verify merchant settlement status with gateway";
    draftedReply = `DRAFT - requires human review before sending. Dear Customer, regarding your merchant refund for transaction ${ref ?? ""}, we are coordinating with the merchant settlement gateway, subject to verification.`;
  } else if (classification === "atm_or_card") {
    priority = "medium";
    recommendedAction = "Verify ATM journal log with switch";
    draftedReply = `DRAFT - requires human review before sending. Dear Customer, regarding your ATM cash dispute, we are retrieving the ATM switch logs, subject to verification.`;
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
    caveat: "Potential compensation estimate, subject to verification.",
    recommended_action: recommendedAction,
    drafted_customer_reply: draftedReply,
    priority,
    missing_fields: missingFields
  };
}
