import React, { useState } from "react";
import {
  Building2,
  Upload,
  Download,
  BarChart3,
  AlertTriangle,
  CheckCircle2,
  Clock,
  TrendingUp,
  FileText,
  ChevronDown,
  ChevronUp,
  Copy,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { type Translations } from "../i18n/translations";

interface B2BDashboardProps {
  t: Translations;
  onTriageBatch: (csvText: string) => Promise<void>;
  summary: any;
  results: any[];
  loading: boolean;
}

export const B2BDashboard: React.FC<B2BDashboardProps> = ({
  t,
  onTriageBatch,
  summary,
  results,
  loading
}) => {
  const [filter, setFilter] = useState<"all" | "breached" | "within_tat" | "missing_info">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedBank, setSelectedBank] = useState("State Bank of India");

  const sampleCsvData = `ComplaintID,Amount,Date,Reference,Description
COMP-101,2400,2026-09-22,UTR9812458129,"Money debited from SBI account to friend via UPI, but friend never received it"
COMP-102,15000,2026-09-29,UTR8837192831,"Unauthorized transaction, someone accessed my account without permission"
COMP-103,850,2026-09-25,UTR7719284192,"Swiggy cancelled food order refund pending from merchant settlement"
COMP-104,3200,2026-09-20,UTR6619284193,"UPI payment to merchant grocery store debited twice but store received only once"
COMP-105,,2026-09-28,UTR5519284194,"Payment failed at fuel station, amount not mentioned"
COMP-106,5000,2026-09-15,UTR4419284195,"P2P UPI payment failed 16 days ago, still no reversal from bank"`;

  const handleLoadSampleCsv = () => {
    onTriageBatch(sampleCsvData);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) onTriageBatch(text);
    };
    reader.readAsText(file);
  };

  const filteredResults = (results || []).filter((r) => {
    if (filter === "breached") return r.tat_breached === true;
    if (filter === "within_tat") return r.tat_breached === false && r.classification !== "missing_evidence";
    if (filter === "missing_info") return r.classification === "missing_evidence";
    return true;
  });

  const handleCopyReply = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Compute Per-Day Exposure Trend
  const perDayTrend: Record<string, number> = {};
  (results || []).forEach((r) => {
    if (r.transaction_date && r.potential_compensation_inr > 0) {
      perDayTrend[r.transaction_date] = (perDayTrend[r.transaction_date] || 0) + r.potential_compensation_inr;
    }
  });

  const trendEntries = Object.entries(perDayTrend).sort((a, b) => a[0].localeCompare(b[0]));
  const maxExposureDay = Math.max(...trendEntries.map((e) => e[1]), 100);

  return (
    <div className="space-y-8">
      {/* Top Banner & Bank Selector */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300">
            <Building2 className="w-3.5 h-3.5" />
            <span>Regulated Entity Grievance Operations & SLA Copilot</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">
            Bank Grievance Triage & Exposure Dashboard
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl font-normal">
            Automates RBI Circular RBI/2019-20/67 compliance, identifies compensation liabilities at scale, and generates audit-ready replies for grievance officers.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={handleLoadSampleCsv}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/80 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold transition flex items-center space-x-2 shadow-sm disabled:opacity-50"
          >
            <Sparkles className="w-4 h-4 text-blue-600" />
            <span>Load Sample Batch CSV</span>
          </button>

          <label className="px-4 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold cursor-pointer transition flex items-center space-x-2 shadow-md shadow-blue-700/20">
            <Upload className="w-4 h-4" />
            <span>Upload Batch CSV</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>

          <a
            href="/api/b2b/exposure-report?format=csv"
            download="refundrakshak_exposure_report.csv"
            className="px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-semibold transition flex items-center space-x-2"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">Total Complaints Triaged</div>
          <div className="text-3xl font-black text-slate-900 dark:text-white font-mono mt-1">
            {summary?.total_complaints || results?.length || 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Batch workload processed</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center space-x-1">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>TAT Breached Complaints</span>
          </div>
          <div className="text-3xl font-black text-rose-600 dark:text-rose-400 font-mono mt-1">
            {summary?.breached_count ?? results?.filter((r) => r.tat_breached).length ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">SLA exceeded beyond T+1 / T+5</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center space-x-1">
            <TrendingUp className="w-3.5 h-3.5" />
            <span>Total Compensation Liability</span>
          </div>
          <div className="text-3xl font-black text-emerald-600 dark:text-emerald-400 font-mono mt-1">
            ₹{summary?.total_compensation_exposure ?? results?.reduce((acc, r) => acc + (r.potential_compensation_inr || 0), 0) ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Potential statutory payout @ ₹100/day</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
          <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">Needs Customer Info</div>
          <div className="text-3xl font-black text-amber-600 dark:text-amber-400 font-mono mt-1">
            {summary?.needs_info_count ?? results?.filter((r) => r.classification === "missing_evidence").length ?? 0}
          </div>
          <div className="text-[10px] text-slate-400 mt-1">Missing UTR, Date, or Amount</div>
        </div>
      </div>

      {/* Per-Day Exposure Trend Chart */}
      {trendEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <BarChart3 className="w-4 h-4 text-blue-600" />
              <span>Per-Day Compensation Exposure Trend (₹100/Day Delay)</span>
            </h3>
            <span className="text-[10px] text-slate-400 font-mono">By Transaction Date</span>
          </div>

          <div className="space-y-2 pt-2">
            {trendEntries.map(([date, exposure]) => {
              const pct = Math.min(100, Math.round((exposure / maxExposureDay) * 100));
              return (
                <div key={date} className="flex items-center space-x-3 text-xs">
                  <span className="w-24 font-mono text-slate-500 dark:text-slate-400 text-[11px]">
                    {date}
                  </span>
                  <div className="flex-1 h-5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex items-center">
                    <div
                      style={{ width: `${Math.max(5, pct)}%` }}
                      className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 rounded-full flex items-center justify-end pr-2 text-[10px] font-bold text-white transition-all duration-500"
                    >
                      {pct > 15 && `₹${exposure}`}
                    </div>
                  </div>
                  <span className="w-16 font-mono font-bold text-slate-900 dark:text-white text-right">
                    ₹{exposure}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Triaged Complaints Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden space-y-4 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Triaged Complaint Queue ({filteredResults.length})
            </h3>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center space-x-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs">
            <button
              onClick={() => setFilter("all")}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === "all" ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-sm" : "text-slate-500"
              }`}
            >
              All ({results?.length || 0})
            </button>
            <button
              onClick={() => setFilter("breached")}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === "breached" ? "bg-white dark:bg-slate-900 text-rose-600 shadow-sm" : "text-slate-500"
              }`}
            >
              Breached ({results?.filter((r) => r.tat_breached).length || 0})
            </button>
            <button
              onClick={() => setFilter("within_tat")}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === "within_tat" ? "bg-white dark:bg-slate-900 text-emerald-600 shadow-sm" : "text-slate-500"
              }`}
            >
              Within TAT
            </button>
            <button
              onClick={() => setFilter("missing_info")}
              className={`px-3 py-1 rounded-lg font-medium transition ${
                filter === "missing_info" ? "bg-white dark:bg-slate-900 text-amber-600 shadow-sm" : "text-slate-500"
              }`}
            >
              Missing Info
            </button>
          </div>
        </div>

        {filteredResults.length === 0 ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            No complaints match the selected filter. Click "Load Sample Batch CSV" above to test.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 dark:bg-slate-950/50">
                <tr>
                  <th className="py-3 px-3">Complaint ID</th>
                  <th className="py-3 px-3">Amount</th>
                  <th className="py-3 px-3">Date (T)</th>
                  <th className="py-3 px-3">Reference</th>
                  <th className="py-3 px-3">Classification</th>
                  <th className="py-3 px-3">TAT Status</th>
                  <th className="py-3 px-3">Compensation</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 font-sans">
                {filteredResults.map((row) => {
                  const isExpanded = expandedRow === row.complaint_id;
                  return (
                    <React.Fragment key={row.complaint_id}>
                      <tr className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          {row.complaint_id}
                        </td>
                        <td className="py-3 px-3 font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                          {row.amount !== null && row.amount !== undefined ? `₹${row.amount}` : "—"}
                        </td>
                        <td className="py-3 px-3 text-slate-600 dark:text-slate-300">
                          {row.transaction_date || "—"}
                        </td>
                        <td className="py-3 px-3 font-mono text-slate-500">
                          {row.reference ? `****${String(row.reference).slice(-4)}` : "—"}
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                            {row.classification?.replace(/_/g, " ")}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {row.tat_breached ? (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 flex items-center space-x-1 w-fit">
                              <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                              <span>Breached (+{row.days_delayed}d)</span>
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 w-fit block">
                              Within TAT
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 font-mono font-bold text-slate-900 dark:text-white">
                          ₹{row.potential_compensation_inr}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-bold uppercase ${
                              row.priority === "high"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300"
                                : row.priority === "medium"
                                ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                                : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                            }`}
                          >
                            {row.priority}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => setExpandedRow(isExpanded ? null : row.complaint_id)}
                            className="text-xs text-blue-600 dark:text-blue-400 font-semibold hover:underline flex items-center space-x-1 ml-auto"
                          >
                            <span>{isExpanded ? "Hide" : "Inspect"}</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Copilot Reply Box */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={9} className="p-4 bg-slate-50 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                                  Recommended Operational Redress Action
                                </span>
                                <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
                                  {row.recommended_action}
                                </div>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                    Drafted Customer Resolution Reply
                                  </span>
                                  <button
                                    onClick={() => handleCopyReply(row.complaint_id, row.drafted_customer_reply)}
                                    className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 flex items-center space-x-1"
                                  >
                                    <Copy className="w-3 h-3" />
                                    <span>{copiedId === row.complaint_id ? "Copied!" : "Copy Reply"}</span>
                                  </button>
                                </div>
                                <div className="text-xs text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200 dark:border-slate-800 font-sans leading-relaxed">
                                  {row.drafted_customer_reply}
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
