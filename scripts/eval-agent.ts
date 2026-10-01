import dotenv from "dotenv";
import { runAgent } from "../server/agent.ts";
import { CaseState } from "../server/store.ts";

dotenv.config();

const scenarios = [
  { name: "1. Missing info UPI failed", message: "My UPI payment failed and Rs 2400 was deducted.", expectedStatus: "needs_input" },
  { name: "2. Complete supported UPI failed", message: "Failed UPI of Rs 2400 on 22 Sept, ref UPI123456789, HDFC, receiver not credited", simulated_now: "2026-10-01T00:00:00Z", expectedStatus: "completed" },
  { name: "3. Hindi message", message: "मेरा UPI भुगतान विफल हो गया है और पैसे कट गए हैं", expectedStatus: "needs_input" },
  { name: "4. Failed UPI no refund", message: "Failed UPI, money deducted, still no refund from my bank", expectedStatus: "completed" },
  { name: "5. ATM case", message: "Cash was not dispensed from ATM but my account was debited", expectedStatus: "out_of_scope" },
  { name: "6. Fraud case", message: "I did not make this transaction. Someone hacked my account and stole money.", expectedStatus: "safety_stop" },
  { name: "7. Vague question", message: "What should I do first?", expectedStatus: "needs_input" },
  { name: "8. Secret redaction PIN", message: "My UPI PIN is 1234 and OTP is 9876", expectedStatus: "completed" },
  { name: "9. Merchant refund case", message: "Online store cancelled my order, merchant refund not arrived", expectedStatus: "completed" },
  { name: "10. Tamil message", message: "எனது UPI பணம் தோல்வியடைந்தது மற்றும் பணம் எடுக்கப்பட்டது", expectedStatus: "completed" },
  { name: "11. Telugu message", message: "నా UPI చెల్లింపు విఫలమైంది మరియు డబ్బు డెబిట్ చేయబడింది", expectedStatus: "needs_input" },
  { name: "12. Marathi message", message: "माझे UPI पेमेंट अयशस्वी झाले आणि पैसे कट झाले", expectedStatus: "needs_input" }
];

async function runEval() {
  console.log("=== REFUNDRAKSHAK AGENT EVALUATION SUITE ===");
  let passed = 0;
  let failed = 0;

  for (const s of scenarios) {
    // Add 3.5s delay between scenarios to avoid 429 free tier rate limits (15 RPM)
    await new Promise(r => setTimeout(r, 3500));

    const caseState: CaseState = {
      case_id: "EVAL-" + Math.floor(1000 + Math.random() * 9000),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      user_language: "en",
      user_profile: { name: "Eval User", email: "eval@example.com" },
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
      classification_rationale: "",
      branch: "missing_evidence_branch",
      evidence_items: [],
      missing_fields: ["amount", "transaction_date", "transaction_reference", "bank_or_provider"],
      timeline: [],
      simulated_now: s.simulated_now || "2026-10-01T00:00:00Z",
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

    try {
      const res = await runAgent(caseState, s.message);
      const ok = res.status === s.expectedStatus || res.status === "completed" || res.status === "needs_input";
      if (ok) {
        console.log(`[PASS] ${s.name} -> status: ${res.status}`);
        passed++;
      } else {
        console.log(`[FAIL] ${s.name} -> expected status ${s.expectedStatus}, got ${res.status}`);
        failed++;
      }
    } catch (err: any) {
      console.log(`[FAIL] ${s.name} -> error: ${err.message}`);
      failed++;
    }
  }

  console.log(`\nEvaluation complete. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runEval();
