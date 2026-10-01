import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Clock,
  Send,
  FileText,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  RefreshCw,
  Zap,
  Building2,
  UserCheck,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Lock
} from "lucide-react";

export default function App() {
  const [caseId, setCaseId] = useState("RR-DEMO-001");
  const [caseState, setCaseState] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      content: "Namaste! I am RefundRakshak. I can help you pursue your UPI failed transaction, track RBI TAT deadlines, and prepare escalation drafts. Select the demo case or start a new claim below."
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "trace" | "evidence" | "outbox" | "rules">("chat");
  const [evidencePack, setEvidencePack] = useState<any>(null);

  // Fetch initial case state
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
        { role: "assistant", content: `⏱️ Simulated clock advanced by +${days} days. Current simulated time: ${new Date(data.simulated_now).toLocaleDateString()}. Re-evaluated escalation conditions.` }
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
                v1.0 AI Agent
              </span>
            </div>
            <p className="text-xs text-slate-400">Get your money back, automatically. (BharatAgentic Hackathon)</p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
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
      </header>

      {/* Main Layout */}
      <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Sidebar: Case & Branch Status */}
        <div className="lg:col-span-4 space-y-6">
          {/* Case Selector & Status Card */}
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
                  <div className="flex justify-between">
                    <span className="text-slate-400">Txn Date:</span>
                    <span>{caseState.transaction_facts.transaction_date || "2026-09-22"}</span>
                  </div>
                </div>

                {/* Branch Indicator */}
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

                {/* Potential Compensation Estimate Card */}
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

          {/* Pending Actions & Approvals */}
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

        {/* Right Main Area: Tabs (Chat / Trace / Evidence / Outbox / Rules) */}
        <div className="lg:col-span-8 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur overflow-hidden">
          {/* Navigation Tabs */}
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
              onClick={() => setActiveTab("outbox")}
              className={`px-4 py-2 rounded-xl text-xs font-medium transition flex items-center space-x-1.5 ${
                activeTab === "outbox" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Simulated Outbox</span>
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

          {/* Tab 1: Chat Area */}
          {activeTab === "chat" && (
            <div className="flex-1 flex flex-col h-[600px]">
              <div className="flex-1 p-4 overflow-y-auto space-y-4">
                {messages.map((m, idx) => (
                  <div
                    key={idx}
                    className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
                  >
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

              {/* Chat Input */}
              <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/40 flex space-x-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Describe your failed UPI payment or ask a question (e.g., 'My payment of ₹2,400 failed 9 days ago')..."
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

          {/* Tab 2: Agent Trace Panel */}
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
                    <div className="flex items-center space-x-2 pt-1 text-[11px] text-slate-500">
                      <span>Tool: <code className="text-cyan-400">{tr.tool_name}</code></span>
                      <span>•</span>
                      <span>Branch: <code className="text-indigo-300">{tr.branch}</code></span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-12 text-sm">No trace events recorded yet.</div>
              )}
            </div>
          )}

          {/* Tab 3: Evidence Pack */}
          {activeTab === "evidence" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-6">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Exportable Evidence Pack</h3>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 px-3 py-1 rounded-full border border-emerald-500/30">Verified Summary</span>
              </div>
              {evidencePack ? (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-5 space-y-4 text-xs font-mono">
                  <div className="text-emerald-400 font-bold text-sm">=== REFUNDRAKSHAK EVIDENCE PACK ===</div>
                  <div>Case ID: {evidencePack.case_id}</div>
                  <div>Transaction Amount: ₹{evidencePack.transaction?.amount}</div>
                  <div>Reference: {evidencePack.transaction?.transaction_reference}</div>
                  <div>Rule Citation: {evidencePack.rule?.title} ({evidencePack.rule?.notification_number})</div>
                  <div className="border-t border-slate-800 pt-3 text-slate-400">
                    {evidencePack.disclaimers?.map((d: string, idx: number) => (
                      <div key={idx}>• {d}</div>
                    ))}
                  </div>
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

          {/* Tab 4: Simulated Outbox */}
          {activeTab === "outbox" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Simulated Outbox & Communications</h3>
              {caseState?.pending_actions && caseState.pending_actions.length > 0 ? (
                caseState.pending_actions.map((act: any) => (
                  <div key={act.id} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-indigo-300">{act.type.toUpperCase()}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] ${act.status === 'approved_and_executed' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'}`}>
                        {act.status}
                      </span>
                    </div>
                    <div className="text-slate-300 font-medium">{act.payload?.subject}</div>
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 text-slate-400 whitespace-pre-wrap font-mono text-[11px]">
                      {act.payload?.body}
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-12 text-sm">No communications in simulated outbox.</div>
              )}
            </div>
          )}

          {/* Tab 5: Verified Rules */}
          {activeTab === "rules" && (
            <div className="flex-1 p-6 overflow-y-auto space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Verified Rule Repository</h3>
              <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3">
                <div className="text-sm font-bold text-emerald-400">RBI Circular: RBI/2019-20/67 (DPSS)</div>
                <p className="text-xs text-slate-300">
                  Harmonisation of Turn Around Time (TAT) and customer compensation for failed transactions using authorised Payment Systems.
                </p>
                <div className="text-xs text-slate-400">
                  <span className="text-indigo-400 font-semibold">TAT Rule:</span> T+1 automatic reversal. ₹100/day compensation for delay.
                </div>
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
    </div>
  );
}
