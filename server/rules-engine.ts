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
  status: string;
}

export function loadVerifiedRules(): { rules: VerifiedRule[] } {
  const rulesPath = process.env.RULES_PATH || path.join(process.cwd(), "data", "verified_rules.json");
  try {
    if (!fs.existsSync(rulesPath)) {
      throw new Error(`Verified rules file not found at ${rulesPath}`);
    }
    const content = fs.readFileSync(rulesPath, "utf-8");
    if (!content.trim()) {
      throw new Error(`Verified rules file at ${rulesPath} is empty`);
    }
    return JSON.parse(content);
  } catch (err: any) {
    console.error("FATAL: Failed to load verified rules:", err.message);
    throw err;
  }
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
 * Pure deterministic calculation according to RBI Circular RBI/2019-20/67:
 * - TAT for UPI debit-not-credited: T + 1 calendar day.
 * - Compensation: ₹100 per day of delay beyond T + 1 calendar day.
 */
export function calculateTATDeadlineAndCompensation(transactionDateInput: string, simulatedNowInput: string) {
  const txDateStr = toISTDateString(transactionDateInput);
  const nowStr = toISTDateString(simulatedNowInput);

  const diffDays = getCalendarDayDiff(txDateStr, nowStr);
  if (diffDays < 0) {
    throw new Error(`Transaction date ${txDateStr} cannot be in the future relative to ${nowStr}.`);
  }

  // T + 1 calendar day deadline
  const deadlineStr = addCalendarDays(txDateStr, 1);
  const daysDelayed = Math.max(0, diffDays - 1);
  const potentialCompensation = daysDelayed * 100;

  return {
    transaction_date: txDateStr,
    deadline_date: deadlineStr,
    simulated_as_of: nowStr,
    calendar_days_elapsed: diffDays,
    days_delayed: daysDelayed,
    potential_compensation_estimate: potentialCompensation,
    caveat: "Potential compensation estimate, subject to verification.",
    explanation: `Transaction date ${txDateStr} (T). Under RBI Circular RBI/2019-20/67, reversal TAT is T+1 calendar day (${deadlineStr}). As of ${nowStr}, transaction has been delayed by ${daysDelayed} day(s) beyond T+1 at statutory rate of ₹100/day.`
  };
}
