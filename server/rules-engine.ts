import fs from "fs";
import path from "path";

export interface VerifiedRule {
  rule_id: string;
  title: string;
  issuer: string;
  circular_or_scheme_date: string;
  notification_number?: string;
  effective_date?: string;
  official_url: string;
  source_type: string;
  exact_rule_summary: string;
  applicability_conditions: any;
  exclusions_or_caveats: string[];
  verified_at: string | null;
  last_checked_date?: string;
  status: string;
}

export interface RuleScenario {
  scenario_id: string;
  name: string;
  category: string;
  circular_row: string;
  circular_reference: string;
  tat_days: number;
  day_basis: "calendar" | "working";
  compensation_per_day: number;
  auto_reversal: boolean;
  official_url: string;
  last_checked_date: string;
  status_label: string;
  description: string;
}

export interface VerifiedRulesData {
  rules: VerifiedRule[];
  scenarios: RuleScenario[];
}

let cachedRulesData: VerifiedRulesData | null = null;

export function loadVerifiedRules(): VerifiedRulesData {
  const rulesPath = process.env.RULES_PATH || path.join(process.cwd(), "data", "verified_rules.json");
  try {
    if (!fs.existsSync(rulesPath)) {
      throw new Error(`Verified rules file not found at ${rulesPath}`);
    }
    const content = fs.readFileSync(rulesPath, "utf-8");
    if (!content.trim()) {
      throw new Error(`Verified rules file at ${rulesPath} is empty`);
    }
    const parsed = JSON.parse(content);
    cachedRulesData = {
      rules: parsed.rules || [],
      scenarios: parsed.scenarios || []
    };
    return cachedRulesData;
  } catch (err: any) {
    console.error("FATAL: Failed to load verified rules:", err.message);
    throw err;
  }
}

export function getAllScenarios(): RuleScenario[] {
  const data = cachedRulesData || loadVerifiedRules();
  return data.scenarios;
}

export function getScenarioById(scenarioId: string): RuleScenario | undefined {
  const scenarios = getAllScenarios();
  return scenarios.find(s => s.scenario_id === scenarioId);
}

/**
 * Parses a date or ISO string into an IST calendar date string (YYYY-MM-DD).
 * IST is UTC+5:30.
 */
export function toISTDateString(input: string | Date): string {
  if (typeof input === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.trim())) {
    return input.trim();
  }
  const dateObj = new Date(input);
  if (isNaN(dateObj.getTime())) {
    throw new Error(`Invalid date value: ${input}`);
  }
  // Offset by 5.5 hours for Indian Standard Time
  const istOffsetMs = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(dateObj.getTime() + istOffsetMs);
  return istDate.toISOString().split("T")[0];
}

/**
 * Calculates calendar days between two YYYY-MM-DD dates in UTC/calendar sense.
 */
export function getCalendarDayDiff(fromDateStr: string, toDateStr: string): number {
  const [y1, m1, d1] = fromDateStr.split("-").map(Number);
  const [y2, m2, d2] = toDateStr.split("-").map(Number);

  const utc1 = Date.UTC(y1, m1 - 1, d1);
  const utc2 = Date.UTC(y2, m2 - 1, d2);

  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((utc2 - utc1) / msPerDay);
}

/**
 * Adds N calendar days to a YYYY-MM-DD string.
 */
export function addCalendarDays(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const res = new Date(utc);
  return res.toISOString().split("T")[0];
}

/**
 * Deterministic calculation based on verified scenario table from RBI Circular RBI/2019-20/67:
 * - Default scenario: upi_p2p_debit_not_credited (Item 4(a), T+1 calendar day, ₹100/day).
 * - Optional scenario: upi_p2m_merchant_debit_failed (Item 4(b), T+5 calendar days, ₹100/day).
 */
export function calculateTATDeadlineAndCompensation(
  transactionDateInput: string,
  simulatedNowInput: string,
  scenarioId = "upi_p2p_debit_not_credited"
) {
  const txDateStr = toISTDateString(transactionDateInput);
  const nowStr = toISTDateString(simulatedNowInput);

  const diffDays = getCalendarDayDiff(txDateStr, nowStr);
  if (diffDays < 0) {
    throw new Error(`Transaction date ${txDateStr} cannot be in the future relative to ${nowStr}.`);
  }

  const scenario = getScenarioById(scenarioId) || {
    scenario_id: "upi_p2p_debit_not_credited",
    name: "UPI Person-to-Person (P2P): Account debited, beneficiary not credited",
    category: "UPI",
    circular_row: "RBI/2019-20/67 Annexure Item 4(a)",
    circular_reference: "RBI/2019-20/67 DPSS.CO.PD No.629/02.01.014/2019-20 Item 4(a)",
    tat_days: 1,
    day_basis: "calendar" as const,
    compensation_per_day: 100,
    auto_reversal: true,
    official_url: "https://www.rbi.org.in/Commonperson/english/Scripts/Notification.aspx?Id=3074",
    last_checked_date: "2026-03-30",
    status_label: "Source: RBI Circular RBI/2019-20/67 Item 4(a), last checked 2026-03-30",
    description: "Customer account debited but beneficiary account not credited in a Person to Person (P2P) transaction."
  };

  const tatDays = scenario.tat_days;
  const deadlineStr = addCalendarDays(txDateStr, tatDays);
  const daysDelayed = Math.max(0, diffDays - tatDays);
  const potentialCompensation = scenario.compensation_per_day > 0
    ? daysDelayed * scenario.compensation_per_day
    : 0;

  let explanation = "";
  if (scenario.scenario_id === "unauthorized_fraud_golden_hour") {
    explanation = `Unauthorized transaction reported on ${txDateStr}. Under ${scenario.circular_reference}, customer notification to the bank within 3 working days establishes ZERO customer liability. Daily delay compensation does not apply to unauthorized fraud disputes.`;
  } else if (scenario.scenario_id === "upi_wrong_recipient") {
    explanation = `Wrong-recipient UPI transfer on ${txDateStr}. Under ${scenario.circular_reference}, recovery is processed via remitter bank chargeback/recall request to the beneficiary bank. Daily delay compensation does not apply to user input errors.`;
  } else {
    explanation = `Transaction date ${txDateStr} (T). Under ${scenario.circular_reference}, reversal TAT is T+${tatDays} ${scenario.day_basis} day(s) (${deadlineStr}). As of ${nowStr}, transaction has been delayed by ${daysDelayed} day(s) beyond T+${tatDays} at statutory rate of ₹${scenario.compensation_per_day}/day.`;
  }

  const goldenHourChecklist = scenario.scenario_id === "unauthorized_fraud_golden_hour"
    ? [
        "1. Call 1930 (National Cyber Crime Reporting Helpline) immediately to initiate emergency freeze.",
        "2. File a formal cybercrime complaint at https://cybercrime.gov.in within 24 hours.",
        "3. Block your card, UPI VPA, and net-banking access immediately through your bank mobile app or helpline.",
        "4. Submit a written dispute report to your bank within 3 working days for ZERO customer liability under RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18."
      ]
    : undefined;

  return {
    transaction_date: txDateStr,
    deadline_date: deadlineStr,
    simulated_as_of: nowStr,
    calendar_days_elapsed: diffDays,
    days_delayed: daysDelayed,
    potential_compensation_estimate: potentialCompensation,
    caveat: "Potential compensation estimate, subject to verification.",
    explanation,
    scenario_id: scenario.scenario_id,
    circular_row: scenario.circular_row,
    circular_reference: scenario.circular_reference,
    tat_days: scenario.tat_days,
    day_basis: scenario.day_basis,
    compensation_per_day: scenario.compensation_per_day,
    official_url: scenario.official_url,
    status_label: scenario.status_label,
    golden_hour_checklist: goldenHourChecklist
  };
}

/**
 * Checks if a UPI failure might be ambiguous between P2P (Item 4(a) - T+1) and P2M (Item 4(b) - T+5).
 * If ambiguous, computes both outcomes and formulates a clarifying question.
 */
export function checkUpiScenarioAmbiguity(
  text: string,
  txDate: string,
  simNow: string,
  merchantName?: string | null
): {
  isAmbiguous: boolean;
  selectedScenario: string;
  p2pCalculation: ReturnType<typeof calculateTATDeadlineAndCompensation>;
  p2mCalculation?: ReturnType<typeof calculateTATDeadlineAndCompensation>;
  clarifyingQuestion?: string;
} {
  const lower = (text || "").toLowerCase();
  const p2pCalc = calculateTATDeadlineAndCompensation(txDate, simNow, "upi_p2p_debit_not_credited");
  const p2mCalc = calculateTATDeadlineAndCompensation(txDate, simNow, "upi_p2m_merchant_debit_failed");

  // Clear merchant indicators
  const hasMerchantClues =
    Boolean(merchantName) ||
    lower.includes("merchant") ||
    lower.includes("store") ||
    lower.includes("shop") ||
    lower.includes("swiggy") ||
    lower.includes("zomato") ||
    lower.includes("amazon") ||
    lower.includes("flipkart") ||
    lower.includes("pos") ||
    lower.includes("qr code at counter");

  // Clear peer-to-peer clues
  const hasP2PClues =
    lower.includes("friend") ||
    lower.includes("brother") ||
    lower.includes("sister") ||
    lower.includes("family") ||
    lower.includes("p2p") ||
    lower.includes("sent to my") ||
    lower.includes("personal transfer");

  if (hasMerchantClues && !hasP2PClues) {
    return {
      isAmbiguous: false,
      selectedScenario: "upi_p2m_merchant_debit_failed",
      p2pCalculation: p2pCalc,
      p2mCalculation: p2mCalc
    };
  }

  if (hasP2PClues && !hasMerchantClues) {
    return {
      isAmbiguous: false,
      selectedScenario: "upi_p2p_debit_not_credited",
      p2pCalculation: p2pCalc,
      p2mCalculation: p2mCalc
    };
  }

  // Ambiguous: could be P2P (T+1) or P2M (T+5)
  return {
    isAmbiguous: true,
    selectedScenario: "upi_p2p_debit_not_credited", // default to P2P standard
    p2pCalculation: p2pCalc,
    p2mCalculation: p2mCalc,
    clarifyingQuestion: `Was this payment sent to an individual person (P2P: friend or family, where RBI reversal TAT is T+1 calendar day) or to a merchant/shopkeeper/online store (P2M: where RBI reversal TAT is T+5 calendar days)?`
  };
}
