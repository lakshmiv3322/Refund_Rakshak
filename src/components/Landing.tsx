import React, { useState } from "react";
import {
  ShieldCheck,
  ArrowRight,
  Upload,
  Scale,
  Clock,
  Lock,
  ExternalLink,
  PhoneCall,
  CheckCircle2,
  FileText
} from "lucide-react";
import { type Translations } from "../i18n/translations";

interface LandingProps {
  t: Translations;
  onStartGrievance: () => void;
  onViewDashboard?: () => void;
  onViewSafety?: () => void;
  isDark?: boolean;
}

export const Landing: React.FC<LandingProps> = ({
  t,
  onStartGrievance,
  onViewDashboard,
  onViewSafety
}) => {
  const [hasConsent, setHasConsent] = useState(true);

  return (
    <div className="space-y-12 pb-12 max-w-4xl mx-auto">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-blue-50/70 via-white to-slate-50 dark:from-slate-900/90 dark:via-slate-950 dark:to-slate-900 p-8 sm:p-12 shadow-sm text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/70 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>RBI Circular RBI/2019-20/67 • Verified TAT & Compensation</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            Money debited but not received? Get it back.
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            Track official statutory turnaround deadlines, compute your ₹100/day delayed-period compensation under RBI rules, and generate formal bank and RBI Ombudsman complaint packages with your explicit 1-click approval.
          </p>

          {/* Consent Checkbox (DPDP-style) */}
          <div className="pt-2 text-left max-w-lg mx-auto bg-white dark:bg-slate-900/90 p-4 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs">
            <label className="flex items-start space-x-3 cursor-pointer text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={hasConsent}
                onChange={(e) => setHasConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 dark:border-slate-700"
              />
              <span className="leading-snug">
                {t.dpdpConsent || "I consent to RefundRakshak processing my transaction details solely for grievance resolution under Digital Personal Data Protection (DPDP) principles."}
              </span>
            </label>
          </div>

          {/* Primary Action Button */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onStartGrievance}
              disabled={!hasConsent}
              className="w-full sm:w-auto min-h-[48px] px-8 py-3.5 rounded-xl font-bold text-sm text-white bg-blue-700 hover:bg-blue-800 shadow-md shadow-blue-700/20 transition-all flex items-center justify-center space-x-2 transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span>{t.startGrievance || "Start my complaint"}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            {onViewDashboard && (
              <button
                onClick={onViewDashboard}
                className="w-full sm:w-auto min-h-[48px] px-6 py-3.5 rounded-xl font-semibold text-sm text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 transition flex items-center justify-center space-x-2"
              >
                <FileText className="w-4 h-4 text-slate-500" />
                <span>My Cases & Follow-ups</span>
              </button>
            )}
          </div>
        </div>
      </section>

      {/* 3 Steps Section */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-1">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            How RefundRakshak Works
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            A simple, transparent 3-step process to recover your debited funds.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-400 font-bold">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.step1Title || "1. Upload Evidence or Describe Failure"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.step1Desc || "Upload your transaction receipt screenshot or describe what happened. Our vision engine extracts the amount, date, UTR reference, and bank."}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-400 font-bold">
              <Scale className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.step2Title || "2. Verify RBI Statutory Turnaround Rules"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.step2Desc || "Applies verified RBI circulars (T+1 for P2P, T+5 for P2M/ATM) and computes statutory ₹100/day delayed-period compensation."}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs space-y-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400 font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              {t.step3Title || "3. 1-Click Approved Dispute Redressal"}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.step3Desc || "Generate formal complaints to your bank, track the 7-day nodal timeline, and escalate to the official RBI Ombudsman if unresolved."}
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Guarantee Highlights */}
      <section className="bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 space-y-4">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider text-center">
          Consumer Protection Guarantees
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <Lock className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white mb-0.5">Zero Sensitive Credentials</div>
              <div className="text-slate-500 dark:text-slate-400">
                We never ask for or accept UPI PINs, OTPs, CVVs, or bank passwords. All text is automatically redacted.
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white mb-0.5">Human In The Loop</div>
              <div className="text-slate-500 dark:text-slate-400">
                No email or complaint is ever sent without your explicit review and authorization. You control every transmission.
              </div>
            </div>
          </div>

          <div className="flex items-start space-x-3 bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-800">
            <Scale className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-slate-900 dark:text-white mb-0.5">Verified Legal Figures</div>
              <div className="text-slate-500 dark:text-slate-400">
                Every timeline and compensation calculation is grounded strictly in official Reserve Bank of India circulars.
              </div>
            </div>
          </div>
        </div>

        <div className="text-center pt-2">
          <p className="text-[11px] text-slate-500 dark:text-slate-400">
            {t.retentionPolicy || "Active case data retained for 90 days following resolution, then purged. You can delete or export your records at any time."}
          </p>
        </div>
      </section>
    </div>
  );
};
