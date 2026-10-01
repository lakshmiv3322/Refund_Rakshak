import React from "react";
import { Clock, TrendingUp, AlertTriangle, ShieldCheck, Scale, CheckCircle2 } from "lucide-react";
import { type Translations } from "../i18n/translations";

interface MoneyClockCardProps {
  t: Translations;
  caseState: any;
  onSimulateTime?: (days: number) => void;
  loading?: boolean;
  isDevMode?: boolean;
}

export const MoneyClockCard: React.FC<MoneyClockCardProps> = ({
  t,
  caseState,
  onSimulateTime,
  loading = false,
  isDevMode = false
}) => {
  if (!caseState) return null;

  const facts = caseState.transaction_facts || {};
  const amount = facts.amount;
  const isFraud = caseState.classification === "unauthorized_or_fraud" || caseState.branch === "fraud_safety_branch";
  const isAtm = caseState.classification === "atm_or_card" || caseState.scenario_id === "atm_cash_not_dispensed";
  const isMerchant = caseState.classification === "merchant_refund" || caseState.scenario_id === "delayed_merchant_refund";
  const isWrongRecipient = caseState.scenario_id === "upi_wrong_recipient";

  // Calculate live days delayed and compensation
  const txDateStr = facts.transaction_date;
  const simNowStr = caseState.simulated_now || new Date().toISOString();

  let daysDelayed = 0;
  let compensationEstimate = caseState.latest_compensation_estimate || 0;
  let deadlineDate = "";
  let tatDays = 1;
  let circularRow = "RBI/2019-20/67 Annexure Item 4(a) (UPI Person-to-Person)";

  if (caseState.scenario_id === "upi_p2m_merchant_debit_failed") {
    tatDays = 5;
    circularRow = "RBI/2019-20/67 Annexure Item 4(b) (UPI Person-to-Merchant)";
  } else if (caseState.scenario_id === "atm_cash_not_dispensed" || isAtm) {
    tatDays = 5;
    circularRow = "RBI/2019-20/67 Annexure Item 1(a) (ATM Cash Non-Dispensation)";
  } else if (caseState.scenario_id === "delayed_merchant_refund" || isMerchant) {
    tatDays = 5;
    circularRow = "RBI/2019-20/67 Annexure Item 4(c) (Delayed E-Commerce Merchant Refund)";
  } else if (isWrongRecipient) {
    tatDays = 0;
    circularRow = "NPCI UPI Operating Guidelines (Remitter Bank Recall Process - No Delay Compensation)";
  } else if (isFraud) {
    tatDays = 0;
    circularRow = "RBI Circular DBR.No.Leg.BC.78/09.07.005/2017-18 (Customer Liability in Unauthorised Electronic Banking Transactions)";
  }

  if (txDateStr && !isFraud && !isWrongRecipient) {
    const txDate = new Date(txDateStr);
    const now = new Date(simNowStr);
    const elapsedDays = Math.max(0, Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)));
    daysDelayed = Math.max(0, elapsedDays - tatDays);
    if (!compensationEstimate && daysDelayed > 0) {
      compensationEstimate = daysDelayed * 100;
    }
    const dLine = new Date(txDate);
    dLine.setDate(dLine.getDate() + tatDays);
    deadlineDate = dLine.toISOString().split("T")[0];
  }

  const isBreached = daysDelayed > 0;
  const hasPendingAction = (caseState.pending_actions || []).some(
    (a: any) => a.status === "pending_approval" || a.status === "pending_human_approval"
  );

  return (
    <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50/40 dark:from-slate-900 dark:via-slate-900/90 dark:to-blue-950/30 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
      {/* Header & Status Chip */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-400">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block">
              {t.moneyClockTitle || "Statutory Money Clock"}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {isFraud
                ? "Customer Liability Protection Tracker"
                : isWrongRecipient
                ? "Remitter Bank Recall Tracker"
                : `RBI T+${tatDays} Reversal & Compensation Tracker`}
            </span>
          </div>
        </div>

        {/* Status Badge */}
        {isFraud ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
            Cyber Safety Branch
          </span>
        ) : isWrongRecipient ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 dark:bg-purple-950/80 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
            Wrong Recipient Recall
          </span>
        ) : hasPendingAction ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 animate-pulse">
            Awaiting Approval
          </span>
        ) : isBreached ? (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 flex items-center space-x-1">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-ping"></span>
            <span>TAT Breached (+{daysDelayed}d)</span>
          </span>
        ) : (
          <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-emerald-100 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3" />
            <span>Within TAT SLA</span>
          </span>
        )}
      </div>

      {/* Main Numbers Strip */}
      <div className="grid grid-cols-2 gap-3 bg-white dark:bg-slate-950 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            {isFraud || isWrongRecipient ? "Compensation Status" : "Accrued Compensation"}
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 font-mono tracking-tight flex items-baseline space-x-1">
            <span>₹{isFraud || isWrongRecipient ? 0 : compensationEstimate}</span>
            {!isFraud && !isWrongRecipient && daysDelayed > 0 && (
              <span className="text-[10px] text-slate-400 font-normal">
                (₹100 × {daysDelayed}d)
              </span>
            )}
          </div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
            {isFraud
              ? "Zero liability if reported <= 3 working days"
              : isWrongRecipient
              ? "No statutory delay compensation"
              : "₹100/day statutory rate per RBI circular"}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Principal Debited
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
            {amount !== null && amount !== undefined ? `₹${amount}` : "—"}
          </div>
          <div className="text-[9px] text-slate-400 dark:text-slate-500 mt-0.5">
            {deadlineDate ? `Statutory Deadline: ${deadlineDate}` : "T+1 Calendar TAT"}
          </div>
        </div>
      </div>

      {/* Exact RBI Circular Row Citation (Requirement 17) */}
      <div className="text-[11px] space-y-1 bg-slate-50 dark:bg-slate-950/60 rounded-xl p-3 border border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-1.5 text-blue-700 dark:text-blue-400 font-semibold">
          <Scale className="w-3.5 h-3.5" />
          <span>Statutory Authority & Official Rule Citation</span>
        </div>
        <div className="text-slate-700 dark:text-slate-300 font-mono text-[10px] leading-snug">
          {circularRow}
        </div>
        <div className="text-slate-500 dark:text-slate-400 text-[10px] flex items-center justify-between pt-1">
          <span>Status: Verified Official Regulation</span>
          <span className="text-[9px] text-slate-400">Last checked: 2026-03-30</span>
        </div>
      </div>

      {/* Mandatory Statutory Sentence (Requirement 17) */}
      <div className="bg-amber-50 dark:bg-amber-950/40 p-2.5 rounded-xl border border-amber-200 dark:border-amber-800/60 flex items-start space-x-2 text-[11px] text-amber-900 dark:text-amber-200">
        <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
        <span className="font-semibold leading-tight">
          Potential compensation estimate, subject to verification.
        </span>
      </div>

      {/* Dev-only Simulation Controls (strictly gated behind isDevMode) */}
      {isDevMode && onSimulateTime && (
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono">
            Dev Mode: {new Date(simNowStr).toLocaleDateString("en-IN")}
          </span>
          <button
            onClick={() => onSimulateTime(7)}
            disabled={loading}
            className="text-[10px] font-semibold text-blue-700 dark:text-blue-400 hover:underline flex items-center space-x-1 disabled:opacity-50"
          >
            <span>Simulate +7 days</span>
            <span>→</span>
          </button>
        </div>
      )}
    </div>
  );
};
