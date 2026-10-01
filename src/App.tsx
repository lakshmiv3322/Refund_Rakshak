import React, { useState, useEffect } from "react";
import {
  ShieldCheck,
  Clock,
  Send,
  FileText,
  AlertTriangle,
  Zap,
  Building2,
  ExternalLink,
  Sparkles,
  Download,
  Upload,
  BarChart3,
  Users,
  ChevronDown,
  ChevronUp,
  RefreshCw
} from "lucide-react";

export default function App() {
  const [appMode, setAppMode] = useState<"consumer" | "b2b">("consumer");
  const [caseId, setCaseId] = useState("RR-DEMO-001");
  const [caseState, setCaseState] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      content: "Namaste! I am RefundRakshak. I can help you pursue your UPI failed transaction, track RBI TAT deadlines, and prepare escalation drafts."
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "trace" | "evidence" | "outbox" | "rules">("chat");
  const [evidencePack, setEvidencePack] = useState<any>(null);

  // B2B state
  const [b2bSummary, setB2bSummary] = useState<any>(null);
  const [b2bResults, setB2bResults] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [csvInput, setCsvInput] = useState("");

  useEffect(() => {
    fetchCase(caseId);
  }, [caseId]);

  const fetchCase = async (id: string) => {
    try {
      const res = await fetch(`/api/cases/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCaseState(data);
      }
    } catch (e) {
      console.error("Failed to fetch case", e);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;

    const userText = inputMessage;
    setInputMessage("");
    setMessages((prev) => [...prev, { role: "user", content: userText }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          message: userText,
          simulated_now: caseState?.simulated_now
        })
      });
      const data = await res.json();
      if (data.case_state) {
        setCaseState(data.case_state);
        setCaseId(data.case_id);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message || "Processed request successfully." }
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error communicating with RefundRakshak agent backend." }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleSimulateTime = async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/simulate-time`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      if (data.case_state) {
        setCaseState(data.case_state);
      }
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⏱️ Simulated clock advanced by +${days} days. Nodal officer escalation draft prepared if bank response timed out.` }
      ]);
    } catch (err) {
      console.error("Simulation error", err);
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/approve`, { method: "POST" });
      const data = await res.json();
      if (data.case_state) {
        setCaseState(data.case_state);
      }
      alert("Action approved and executed in simulated outbox.");
    } catch (e) {
      console.error("Approval error", e);
    }
  };

  const handleRejectAction = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/reject`, { method: "POST" });
      const data = await res.json();
      if (data.case_state) {
        setCaseState(data.case_state);
      }
      alert("Action rejected.");
    } catch (e) {
      console.error("Rejection error", e);
    }
  };

  const fetchEvidencePack = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence-pack`);
      const data = await res.json();
      setEvidencePack(data);
      setActiveTab("evidence");
    } catch (e) {
      console.error("Failed to load evidence pack", e);
    }
  };

  // Load 25 synthetic complaints
  const loadSyntheticComplaints = async () => {
    setLoading(true);
    const syntheticList = [
      // 12 Supported debited not credited with varied ages
      { complaint_id: "COMP-101", text: "UPI debit of 2400 failed 9 days ago", amount: 2400, transaction_date: "2026-09-22", reference: "UPI101" },
      { complaint_id: "COMP-102", text: "Money debited Rs 1500 not credited, 5 days ago", amount: 1500, transaction_date: "2026-09-26", reference: "UPI102" },
      { complaint_id: "COMP-103", text: "UPI payment Rs 5000 failed and debited 3 days ago", amount: 5000, transaction_date: "2026-09-28", reference: "UPI103" },
      { complaint_id: "COMP-104", text: "Rs 800 debited but receiver not credited 7 days ago", amount: 800, transaction_date: "2026-09-24", reference: "UPI104" },
      { complaint_id: "COMP-105", text: "UPI txn Rs 3200 debited not credited 12 days ago", amount: 3200, transaction_date: "2026-09-19", reference: "UPI105" },
      { complaint_id: "COMP-106", text: "Rs 10000 UPI transfer failed debited 4 days ago", amount: 10000, transaction_date: "2026-09-27", reference: "UPI106" },
      { complaint_id: "COMP-107", text: "UPI debit Rs 750 failed 8 days ago", amount: 750, transaction_date: "2026-09-23", reference: "UPI107" },
      { complaint_id: "COMP-108", text: "Rs 4500 debited via UPI not received by beneficiary 6 days ago", amount: 4500, transaction_date: "2026-09-25", reference: "UPI108" },
      { complaint_id: "COMP-109", text: "UPI failed debit Rs 1200 10 days ago", amount: 1200, transaction_date: "2026-09-21", reference: "UPI109" },
      { complaint_id: "COMP-110", text: "Rs 600 debited not credited 2 days ago", amount: 600, transaction_date: "2026-09-29", reference: "UPI110" },
      { complaint_id: "COMP-111", text: "UPI payment Rs 2200 debited failed 11 days ago", amount: 2200, transaction_date: "2026-09-20", reference: "UPI111" },
      { complaint_id: "COMP-112", text: "Rs 3000 UPI debit without credit 1 day ago", amount: 3000, transaction_date: "2026-09-30", reference: "UPI112" },

      // 3 Fraud / Unauthorized
      { complaint_id: "COMP-201", text: "I did not make this UPI payment of 15000. Someone used my account fraudulently.", amount: 15000, transaction_date: "2026-09-29", reference: "FRD201" },
      { complaint_id: "COMP-202", text: "Unauthorized transaction of Rs 8500 done while phone was locked", amount: 8500, transaction_date: "2026-09-28", reference: "FRD202" },
      { complaint_id: "COMP-203", text: "Someone hacked my UPI PIN and debited Rs 20000", amount: 20000, transaction_date: "2026-09-27", reference: "FRD203" },

      // 3 Merchant refund
      { complaint_id: "COMP-301", text: "Online store cancelled my order but merchant refund Rs 1200 has not arrived", amount: 1200, transaction_date: "2026-09-20", reference: "MRH301" },
      { complaint_id: "COMP-302", text: "Amazon refund of Rs 3500 pending for 10 days", amount: 3500, transaction_date: "2026-09-21", reference: "MRH302" },
      { complaint_id: "COMP-303", text: "Flipkart order cancelled, merchant refund Rs 2400 not credited yet", amount: 2400, transaction_date: "2026-09-22", reference: "MRH303" },

      // 2 ATM / Card
      { complaint_id: "COMP-401", text: "ATM cash withdrawal Rs 5000 failed but my card account was debited", amount: 5000, transaction_date: "2026-09-25", reference: "ATM401" },
      { complaint_id: "COMP-402", text: "ATM machine did not dispense cash for Rs 2000", amount: 2000, transaction_date: "2026-09-26", reference: "ATM402" },

      // 3 Missing Reference
      { complaint_id: "COMP-501", text: "Money deducted", amount: 1000, transaction_date: "2026-09-28", reference: "" },
      { complaint_id: "COMP-502", text: "Payment failed help", amount: 500, transaction_date: "2026-09-29", reference: "" },
      { complaint_id: "COMP-503", text: "Transaction stuck", amount: 1800, transaction_date: "2026-09-27", reference: "" },

      // 2 Unknown
      { complaint_id: "COMP-601", text: "General query about transaction charges", amount: 100, transaction_date: "2026-09-25", reference: "UNK601" },
      { complaint_id: "COMP-602", text: "Bank statement discrepancy", amount: 350, transaction_date: "2026-09-24", reference: "UNK602" }
    ];

    try {
      const res = await fetch("/api/b2b/triage-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaints: syntheticList })
      });
      const data = await res.json();
      setB2bSummary(data.summary);
      setB2bResults(data.results);
    } catch (e) {
      console.error("Batch triage failed", e);
    } finally {
      setLoading(false);
    }
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!csvInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/b2b/triage-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvInput })
      });
      const data = await res.json();
      setB2bSummary(data.summary);
      setB2bResults(data.results);
    } catch (e) {
      console.error("CSV triage failed", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
                RefundRakshak
              </h1>
              <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 font-medium">
                {appMode === "consumer" ? "Consumer Copilot" : "Regulated Entities B2B"}
              </span>
            </div>
            <p className="text-xs text-slate-400">Get your money back, automatically. (BharatAgentic Hackathon)</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex items-center space-x-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex space-x-1">
            <button
              onClick={() => setAppMode("consumer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                appMode === "consumer" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Consumer App
            </button>
            <button
              onClick={() => setAppMode("b2b")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                appMode === "b2b" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              For Banks / Payment Apps
            </button>
          </div>

          {appMode === "consumer" && (
            <div className="flex items-center space-x-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs text-slate-400">Simulated Clock</div>
                <div className="text-sm font-mono text-cyan-400 font-semibold">
                  {caseState?.simulated_now ? new Date(caseState.simulated_now).toLocaleDateString() : "2026-10-01"}
                </div>
              </div>
              <button
                onClick={() => handleSimulateTime(7)}
                disabled={loading}
                className="flex items-center space-x-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium shadow-lg shadow-cyan-600/25 transition-all transform active:scale-95 disabled:opacity-50"
              >
                <Clock className="w-4 h-4" />
                <span>Simulate +7 days</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main View: Consumer vs B2B */}
      {appMode === "consumer" ? (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Active Case</h2>
                <span className="text-xs font-mono bg-slate-800 text-indigo-300 px-2.5 py-1 rounded-lg border border-slate-700">
                  {caseId}
                </span>
              </div>

              {caseState && (
                <div className="space-y-4 text-sm">
                  <div className="bg-slate-950/60 rounded-xl p-3 border border-slate-800/80 space-y-2">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Amount:</span>
                      <span className="font-bold text-emerald-400">₹{caseState.transaction_facts.amount || 2400}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Reference:</span>
                      <span className="font-mono text-slate-200">{caseState.transaction_facts.transaction_reference || "DEMOUPI123456"}</span>
                    </div>
                  </div>

                  <div className="bg-indigo-950/30 border border-indigo-500/30 rounded-xl p-3">
                    <div className="text-xs text-indigo-300 font-semibold mb-1 flex items-center space-x-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                      <span>Active Branch & Classification</span>
                    </div>
                    <div className="text-xs font-mono text-slate-200 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-500/20">
                      {caseState.branch}
                    </div>
                    <p className="text-xs text-slate-400 mt-2">{caseState.classification_rationale}</p>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/30 rounded-xl p-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-emerald-400 uppercase">Compensation Estimate</span>
                      <Zap className="w-4 h-4 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-300">₹800</div>
                    <p className="text-[11px] text-slate-400 mt-1 italic">
                      "Potential compensation estimate, subject to verification."
                    </p>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      This prototype is not legal advice and does not guarantee recovery.
                    </p>
                  </div>

                  <button
                    onClick={fetchEvidencePack}
                    className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-medium border border-slate-700 transition"
                  >
                    <FileText className="w-4 h-4 text-indigo-400" />
                    <span>View Verified Evidence Pack</span>
                  </button>
                </div>
              )}
            </div>

            {caseState?.pending_actions && caseState.pending_actions.length > 0 && (
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-xl">
                <div className="flex items-center space-x-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-semibold text-amber-300">Pending Approvals ({caseState.pending_actions.length})</h3>
                </div>
                <div className="space-y-3">
                  {caseState.pending_actions.map((act: any) => (
                    <div key={act.id} className="bg-slate-950/80 rounded-xl p-3 border border-slate-800 space-y-2 text-xs">
                      <div className="font-semibold text-slate-200">{act.type.replace(/_/g, " ").toUpperCase()}</div>
                      <div className="text-slate-400 truncate">{act.payload?.subject}</div>
                      <div className="flex space-x-2 pt-1">
                        {act.status === "pending_approval" ? (
                          <>
                            <button
                              onClick={() => handleApproveAction(act.id)}
                              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-1.5 rounded-lg font-medium transition"
                            >
                              Approve & Send
                            </button>
                            <button
                              onClick={() => handleRejectAction(act.id)}
                              className="flex-1 bg-rose-900/50 hover:bg-rose-900 text-rose-200 py-1.5 rounded-lg font-medium transition"
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <span className="text-emerald-400 font-medium">✓ Executed in Simulated Outbox</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Main Area */}
          <div className="lg:col-span-8 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur overflow-hidden">
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 py-2 space-x-2 overflow-x-auto">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 ${
                  activeTab === "chat" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Agent Chat</span>
              </button>
              <button
                onClick={() => setActiveTab("trace")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 ${
                  activeTab === "trace" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Agent Trace ({caseState?.trace?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab("evidence")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 ${
                  activeTab === "evidence" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Evidence Pack</span>
              </button>
              <button
                onClick={() => setActiveTab("rules")}
                className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 ${
                  activeTab === "rules" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Verified Rules</span>
              </button>
            </div>

            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col h-[600px]">
                <div className="flex-1 p-4 overflow-y-auto space-y-4">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          m.role === "user"
                            ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 rounded-br-none"
                            : "bg-slate-800/90 border border-slate-700/80 text-slate-200 rounded-bl-none shadow"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-indigo-400 flex items-center space-x-2 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        <span>RefundRakshak agent is running tools and evaluating rules...</span>
                      </div>
                    </div>
                  )}
                </div>

                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/40 flex space-x-3">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    placeholder="Describe your failed UPI payment or ask a question..."
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                  />
                  <button
                    type="submit"
                    disabled={loading || !inputMessage.trim()}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-3 rounded-xl font-medium shadow-lg shadow-indigo-600/30 transition flex items-center justify-center disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </form>
              </div>
            )}

            {activeTab === "trace" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Visible Agent Execution Trace</h3>
                {caseState?.trace && caseState.trace.length > 0 ? (
                  caseState.trace.map((tr: any) => (
                    <div key={tr.id} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-indigo-400 font-semibold">[{tr.event_type}]</span>
                        <span className="text-slate-500">{new Date(tr.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-sm font-medium text-slate-200">{tr.label}</div>
                      <p className="text-xs text-slate-400">{tr.summary}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-12 text-sm">No trace events recorded yet.</div>
                )}
              </div>
            )}

            {activeTab === "evidence" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Exportable Evidence Pack</h3>
                {evidencePack ? (
                  <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4 text-xs font-mono">
                    <div className="text-emerald-400 font-bold text-sm">=== REFUNDRAKSHAK EVIDENCE PACK ===</div>
                    <div>Case ID: {evidencePack.case_id}</div>
                    <div>Transaction Amount: ₹{evidencePack.transaction?.amount}</div>
                    <div>Reference: {evidencePack.transaction?.transaction_reference}</div>
                    <div className="text-slate-400">{evidencePack.disclaimers?.join(" • ")}</div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <button onClick={fetchEvidencePack} className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-medium shadow">
                      Generate Evidence Pack Summary
                    </button>
                  </div>
                )}
              </div>
            )}

            {activeTab === "rules" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Verified Rule Repository</h3>
                <div className="bg-slate-950/80 border border-amber-500/30 rounded-xl p-4 space-y-3">
                  <div className="text-xs px-2.5 py-1 rounded bg-amber-500/20 text-amber-300 inline-block font-semibold">Status: Needs Manual Verification</div>
                  <div className="text-sm font-bold text-emerald-400">RBI Circular: RBI/2019-20/67 (DPSS)</div>
                  <p className="text-xs text-slate-300">
                    Harmonisation of Turn Around Time (TAT) and customer compensation for failed transactions using authorised Payment Systems. T+1 automatic reversal, ₹100/day compensation.
                  </p>
                  <a
                    href="https://www.rbi.org.in/Commonperson/english/Scripts/Notification.aspx?Id=3074"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-xs text-cyan-400 hover:underline pt-2"
                  >
                    <span>Official RBI Circular Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* B2B Mode: RefundRakshak for Regulated Entities */
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span>RefundRakshak for Regulated Entities — Complaint-Ops Copilot</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Triage failed-transaction complaints in bulk, flag TAT breaches, compute compensation exposure, and generate draft customer replies.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadSyntheticComplaints}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load 25 Synthetic Complaints</span>
              </button>
              <a
                href="/api/b2b/exposure-report?format=csv"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center space-x-2"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Exposure CSV</span>
              </a>
            </div>
          </div>

          {/* Summary KPI Cards */}
          {b2bSummary && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-lg">
                <div className="text-xs text-slate-400 uppercase font-medium">Total Complaints</div>
                <div className="text-3xl font-bold text-white mt-1">{b2bSummary.total_complaints}</div>
              </div>
              <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-5 shadow-lg">
                <div className="text-xs text-rose-400 uppercase font-medium">TAT Breaches</div>
                <div className="text-3xl font-bold text-rose-400 mt-1">{b2bSummary.breached_count}</div>
              </div>
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
                <div className="text-xs text-amber-400 uppercase font-medium">Compensation Exposure</div>
                <div className="text-3xl font-bold text-amber-300 mt-1">₹{b2bSummary.total_compensation_exposure.toLocaleString()}</div>
                <div className="text-[10px] text-slate-500 mt-1">Subject to verification</div>
              </div>
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-5 shadow-lg">
                <div className="text-xs text-indigo-400 uppercase font-medium">Classifications</div>
                <div className="text-xs text-slate-300 mt-2 space-y-1">
                  {Object.entries(b2bSummary.classification_counts || {}).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between">
                      <span className="truncate max-w-[140px]">{k}:</span>
                      <span className="font-mono font-bold text-white">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Complaints Results Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200">Triaged Complaints & Exposure Feed</h3>
              <span className="text-xs text-slate-400">Showing {b2bResults.length} processed items</span>
            </div>

            {b2bResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/60 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-6 py-3">ID & Ref</th>
                      <th className="px-6 py-3">Amount</th>
                      <th className="px-6 py-3">Classification</th>
                      <th className="px-6 py-3">Branch</th>
                      <th className="px-6 py-3">TAT Breached?</th>
                      <th className="px-6 py-3">Exposure (₹)</th>
                      <th className="px-6 py-3">Priority</th>
                      <th className="px-6 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {b2bResults.map((r: any) => (
                      <React.Fragment key={r.complaint_id}>
                        <tr className="hover:bg-slate-800/40 transition">
                          <td className="px-6 py-4 font-mono font-medium text-white">
                            <div>{r.complaint_id}</div>
                            <div className="text-[10px] text-slate-400">{r.reference}</div>
                          </td>
                          <td className="px-6 py-4 font-bold text-emerald-400">₹{r.amount}</td>
                          <td className="px-6 py-4 text-slate-300">{r.classification}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                              r.tat_breached ? 'bg-rose-500/20 text-rose-300 border-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            }`}>
                              {r.branch}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {r.tat_breached ? (
                              <span className="text-rose-400 font-bold">Yes ({r.days_delayed}d delayed)</span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono font-semibold text-amber-300">₹{r.potential_compensation_inr}</td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              r.priority === 'high' ? 'bg-rose-900/60 text-rose-200' : (r.priority === 'medium' ? 'bg-amber-900/60 text-amber-200' : 'bg-slate-800 text-slate-300')
                            }`}>
                              {r.priority.toUpperCase()}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              onClick={() => setExpandedRow(expandedRow === r.complaint_id ? null : r.complaint_id)}
                              className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1"
                            >
                              <span>{expandedRow === r.complaint_id ? "Hide Details" : "Inspect"}</span>
                              {expandedRow === r.complaint_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                        {expandedRow === r.complaint_id && (
                          <tr className="bg-slate-950/80">
                            <td colSpan={8} className="px-6 py-4 space-y-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                                  <div className="text-slate-400 font-semibold">Recommended Ops Action:</div>
                                  <div className="text-slate-200">{r.recommended_action}</div>
                                </div>
                                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1">
                                  <div className="text-slate-400 font-semibold">Drafted Customer Reply:</div>
                                  <div className="text-slate-300 font-mono text-[11px]">{r.drafted_customer_reply}</div>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-16 text-slate-500">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No complaints triaged yet. Click "Load 25 Synthetic Complaints" above to test bulk copilot triage.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
