import React from "react";
import {
  ShieldCheck,
  Zap,
  ArrowRight,
  Upload,
  Scale,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  FileText,
  Lock
} from "lucide-react";
import { type Translations } from "../i18n/translations";

interface LandingProps {
  t: Translations;
  onStartGrievance: () => void;
  onSelectDemoScenario: (type: "upi" | "fraud" | "merchant") => void;
  onSwitchToB2B: () => void;
  onViewSafety: () => void;
  isDark: boolean;
}

export const Landing: React.FC<LandingProps> = ({
  t,
  onStartGrievance,
  onSelectDemoScenario,
  onSwitchToB2B,
  onViewSafety,
  isDark
}) => {
  return (
    <div className="space-y-12 pb-16">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-b from-blue-50/80 via-white to-slate-50 dark:from-slate-900/90 dark:via-slate-950 dark:to-slate-900 p-8 sm:p-12 shadow-xl shadow-blue-500/5">
        <div className="max-w-3xl space-y-6">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950/80 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span>BharatAgentic Hackathon • Live Production Prototype</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 dark:text-white leading-tight">
            {t.heroHeadline}
          </h1>

          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed font-normal">
            {t.heroSubtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={onStartGrievance}
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3.5 rounded-xl font-bold text-sm shadow-lg shadow-blue-700/25 transition-all flex items-center space-x-2 transform hover:-translate-y-0.5"
            >
              <span>{t.startGrievance}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              onClick={onSwitchToB2B}
              className="bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-300 dark:border-slate-700 px-5 py-3.5 rounded-xl font-semibold text-sm transition"
            >
              {t.b2bMode}
            </button>

            <button
              onClick={onViewSafety}
              className="text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 px-3 py-2 flex items-center space-x-1"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Safety & Audit Scorecard</span>
            </button>
          </div>
        </div>

        {/* Impact KPI Strip */}
        <div className="mt-12 pt-8 border-t border-slate-200 dark:border-slate-800 grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
          <div className="bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-2xl sm:text-3xl font-black text-blue-700 dark:text-blue-400 font-mono">
              {t.impactSpeed}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t.impactSpeedLabel}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-2xl sm:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
              {t.impactTools}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t.impactToolsLabel}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-2xl sm:text-3xl font-black text-amber-600 dark:text-amber-400 font-mono">
              {t.impactIdentified}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t.impactIdentifiedLabel}
            </div>
          </div>

          <div className="bg-white/70 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-2xl p-4">
            <div className="text-2xl sm:text-3xl font-black text-indigo-600 dark:text-indigo-400 font-mono">
              {t.impactLanguages}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">
              {t.impactLanguagesLabel}
            </div>
          </div>
        </div>
      </section>

      {/* 3 Steps Section */}
      <section className="space-y-6">
        <div className="text-center max-w-xl mx-auto space-y-2">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
            How RefundRakshak Works
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            From failed debit to statutory RBI escalation in three autonomous steps.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-400 mb-4 font-bold">
              <Upload className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {t.step1Title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.step1Desc}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-950 flex items-center justify-center text-amber-700 dark:text-amber-400 mb-4 font-bold">
              <Scale className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {t.step2Title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.step2Desc}
            </p>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm hover:shadow-md transition">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center text-emerald-700 dark:text-emerald-400 mb-4 font-bold">
              <Clock className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-2">
              {t.step3Title}
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              {t.step3Desc}
            </p>
          </div>
        </div>
      </section>

      {/* One-Click Demo Scenarios for Judges */}
      <section className="space-y-4 bg-slate-100/70 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-amber-500" />
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {t.demoScenariosTitle}
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Click any scenario to see full agent reasoning, tool calls, and statutory actions in under 60 seconds.
            </p>
          </div>
          <span className="text-[11px] font-mono px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 font-semibold self-start sm:self-auto">
            Interactive Test Harness
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          {/* Scenario 1 */}
          <button
            onClick={() => onSelectDemoScenario("upi")}
            className="text-left bg-white dark:bg-slate-900 hover:border-blue-500 dark:hover:border-blue-500 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-blue-700 dark:text-blue-400 flex items-center space-x-1">
                  <Zap className="w-3.5 h-3.5" />
                  <span>Scenario 1</span>
                </span>
                <span className="text-[10px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-mono font-semibold">
                  T+1 Reversal
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition">
                {t.demoUpiTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.demoUpiDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-blue-600 dark:text-blue-400">
              <span>Run Scenario</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
            </div>
          </button>

          {/* Scenario 2 */}
          <button
            onClick={() => onSelectDemoScenario("fraud")}
            className="text-left bg-white dark:bg-slate-900 hover:border-rose-500 dark:hover:border-rose-500 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center space-x-1">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>Scenario 2</span>
                </span>
                <span className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-mono font-semibold">
                  Safety Boundary
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition">
                {t.demoFraudTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.demoFraudDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-rose-600 dark:text-rose-400">
              <span>Run Scenario</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
            </div>
          </button>

          {/* Scenario 3 */}
          <button
            onClick={() => onSelectDemoScenario("merchant")}
            className="text-left bg-white dark:bg-slate-900 hover:border-amber-500 dark:hover:border-amber-500 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm hover:shadow transition group flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center space-x-1">
                  <ShoppingBag className="w-3.5 h-3.5" />
                  <span>Scenario 3</span>
                </span>
                <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-0.5 rounded font-mono font-semibold">
                  Reconciliation
                </span>
              </div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-amber-600 dark:group-hover:text-amber-400 transition">
                {t.demoMerchantTitle}
              </h4>
              <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                {t.demoMerchantDesc}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-semibold text-amber-600 dark:text-amber-400">
              <span>Run Scenario</span>
              <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition" />
            </div>
          </button>
        </div>
      </section>

      {/* Trust & Privacy Notice */}
      <div className="flex items-center justify-center space-x-2 text-xs text-slate-500 dark:text-slate-400 text-center">
        <Lock className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
        <span>
          Zero-credential policy: We never ask for or store UPI PINs, OTPs, CVVs, or full card numbers. All sensitive credentials are automatically redacted.
        </span>
      </div>
    </div>
  );
};
