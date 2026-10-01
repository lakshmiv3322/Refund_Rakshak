import React, { useState, useEffect, useRef } from "react";
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
  RefreshCw,
  Mail,
  Copy,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  Check,
  HelpCircle,
  PlusCircle,
  RotateCcw,
  SlidersHorizontal,
  X
} from "lucide-react";

export default function App() {
  const [appMode, setAppMode] = useState<"consumer" | "b2b">("consumer");
  const [casesList, setCasesList] = useState<any[]>([]);
  const [caseId, setCaseId] = useState<string>("RR-DEMO-001");
  const [caseState, setCaseState] = useState<any>(null);
  const [userLanguage, setUserLanguage] = useState<string>("en");
  const [messages, setMessages] = useState<any[]>([
    {
      role: "assistant",
      content: "Namaste! I am RefundRakshak, your production grievance copilot for Indian UPI & payment failures. I extract evidence, apply statutory RBI circulars, prepare escalation drafts, and help recover your money with your explicit approval."
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"chat" | "timeline" | "trace" | "evidence" | "outbox" | "rules">("chat");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Image Upload state
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Authentication & Access Control state
  const [caseTokens, setCaseTokens] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("refundrakshak_tokens") || "{}");
    } catch {
      return {};
    }
  });
  const [recipientEdits, setRecipientEdits] = useState<Record<string, string>>({});

  const saveTokenForCase = (id: string, token: string) => {
    setCaseTokens((prev) => {
      const updated = { ...prev, [id]: token };
      try {
        localStorage.setItem("refundrakshak_tokens", JSON.stringify(updated));
      } catch (_) {}
      return updated;
    });
  };

  const getAuthHeaders = (id?: string): Record<string, string> => {
    const targetId = id || caseId;
    const token = caseTokens[targetId];
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["x-case-token"] = token;
    }
    return headers;
  };

  // B2B state
  const [b2bSummary, setB2bSummary] = useState<any>(null);
  const [b2bResults, setB2bResults] = useState<any[]>([]);
  const [b2bFilter, setB2bFilter] = useState<"all" | "breached" | "within_tat" | "missing_info">("all");
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  useEffect(() => {
    fetchCasesList();
  }, []);

  useEffect(() => {
    if (caseId) {
      fetchCase(caseId);
    }
  }, [caseId]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const fetchCasesList = async () => {
    try {
      const res = await fetch("/api/cases", {
        headers: getAuthHeaders()
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const list = await res.json();
        setCasesList(list);
        if (list.length > 0) {
          if (!list.some((c: any) => c.case_id === caseId)) {
            setCaseId(list[0].case_id);
          }
        } else {
          // Auto-initialize first case if no cases exist
          handleCreateNewCase();
        }
      }
    } catch (e) {
      console.error("Failed to load cases list", e);
    }
  };

  const fetchCase = async (id: string) => {
    try {
      const res = await fetch(`/api/cases/${id}`, {
        headers: getAuthHeaders(id)
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        setCaseState(data);
        if (data.chat_history && data.chat_history.length > 0) {
          setMessages(data.chat_history.map((h: any) => ({
            role: h.role === "user" ? "user" : "assistant",
            content: h.text
          })));
        }
        if (data.user_language) {
          setUserLanguage(data.user_language);
        }
      } else if (res.status === 404) {
        showToast(`Case ${id} not found. Creating a fresh case.`, "info");
        handleCreateNewCase();
      }
    } catch (e) {
      console.error("Failed to fetch case", e);
    }
  };

  const handleCreateNewCase = async () => {
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: userLanguage })
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const newCase = await res.json();
        if (newCase.token) {
          saveTokenForCase(newCase.case_id, newCase.token);
        }
        setCaseId(newCase.case_id);
        setCaseState(newCase);
        setMessages([
          {
            role: "assistant",
            content: "New case initialized. Please describe what happened with your transaction or attach a screenshot."
          }
        ]);
        fetchCasesList();
        showToast(`Created new case: ${newCase.case_id}`, "success");
      }
    } catch (e) {
      showToast("Failed to initialize new case", "error");
    }
  };

  const handleResetDemo = async () => {
    try {
      const res = await fetch("/api/cases/RR-DEMO-001/reset", {
        method: "POST",
        headers: getAuthHeaders("RR-DEMO-001")
      });
      const contentType = res.headers.get("content-type") || "";
      if (res.ok && contentType.includes("application/json")) {
        const data = await res.json();
        if (data.token) {
          saveTokenForCase("RR-DEMO-001", data.token);
        }
        setCaseId("RR-DEMO-001");
        setCaseState(data.case_state);
        setMessages(data.case_state.chat_history.map((h: any) => ({
          role: h.role === "user" ? "user" : "assistant",
          content: h.text
        })));
        fetchCasesList();
        showToast("Demo case RR-DEMO-001 reset to verified seed state.", "success");
      } else {
        showToast("Demo reset unavailable without SEED_DEMO=true", "info");
      }
    } catch (e) {
      showToast("Error resetting demo case", "error");
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast("Please select a valid image file (PNG or JPEG)", "error");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      showToast("Image must be smaller than 4MB", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const base64Data = (reader.result as string).split(",")[1];
      setSelectedImage({
        base64: base64Data,
        mime: file.type,
        name: file.name
      });
      showToast(`Attached image: ${file.name}`, "info");
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedImage) || loading) return;

    const userText = inputMessage.trim();
    const imagePayload = selectedImage;

    setInputMessage("");
    setSelectedImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";

    setMessages((prev) => [...prev, { role: "user", content: userText || "[Uploaded Screenshot]" }]);
    setLoading(true);

    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: getAuthHeaders(caseId),
        body: JSON.stringify({
          case_id: caseId,
          message: userText,
          language: userLanguage,
          simulated_now: caseState?.simulated_now,
          image_base64: imagePayload?.base64,
          image_mime: imagePayload?.mime
        })
      });

      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = `Request failed with status ${res.status}`;
        if (contentType.includes("application/json")) {
          const errJson = await res.json().catch(() => null);
          if (errJson?.error?.message) errMsg = errJson.error.message;
        }
        throw new Error(errMsg);
      }

      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.token) {
          saveTokenForCase(data.case_id, data.token);
        }
        if (data.case_state) {
          setCaseState(data.case_state);
          setCaseId(data.case_id);
        }
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: data.message || "Processed grievance using verified RBI rules." }
        ]);
      }
    } catch (err: any) {
      showToast(err.message || "Error communicating with agent", "error");
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `⚠️ Error: ${err.message || "Unable to reach agent service."}` }
      ]);
    } finally {
      setLoading(false);
      fetchCasesList();
    }
  };

  const handleSimulateTime = async (days: number) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/simulate-time`, {
        method: "POST",
        headers: getAuthHeaders(caseId),
        body: JSON.stringify({ days })
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = `Simulation failed: ${res.status}`;
        if (contentType.includes("application/json")) {
          const errJson = await res.json().catch(() => null);
          if (errJson?.error?.message) errMsg = errJson.error.message;
        }
        throw new Error(errMsg);
      }
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.case_state) {
          setCaseState(data.case_state);
        }
        showToast(`Clock advanced by +${days} days. Checked statutory deadlines.`, "success");
      }
    } catch (err: any) {
      showToast(err.message || "Simulation error", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleApproveAction = async (actionId: string) => {
    try {
      const customRecipient = recipientEdits[actionId];
      const res = await fetch(`/api/actions/${actionId}/approve`, {
        method: "POST",
        headers: getAuthHeaders(caseId),
        body: JSON.stringify({ recipient: customRecipient })
      });
      const contentType = res.headers.get("content-type") || "";
      if (!res.ok) {
        let errMsg = "Approval failed";
        if (contentType.includes("application/json")) {
          const err = await res.json().catch(() => null);
          if (err?.error?.message) errMsg = err.error.message;
        }
        throw new Error(errMsg);
      }
      if (contentType.includes("application/json")) {
        const data = await res.json();
        if (data.case_state) {
          setCaseState(data.case_state);
        }
        if (data.delivery_details?.provider === "mailto_fallback") {
          showToast("Prepared email details. Use mailto or copy to send.", "info");
        } else {
          showToast(`Email dispatched successfully via ${data.delivery_details?.provider}!`, "success");
        }
      }
    } catch (e: any) {
      showToast(e.message || "Approval failed", "error");
    }
  };

  const handleRejectAction = async (actionId: string) => {
    try {
      const res = await fetch(`/api/actions/${actionId}/reject`, {
        method: "POST",
        headers: getAuthHeaders(caseId)
      });
      if (res.ok) {
        showToast("Action rejected.", "info");
        fetchCase(caseId);
      }
    } catch (e) {
      showToast("Error rejecting action", "error");
    }
  };

  const handleDownloadEvidencePack = async () => {
    try {
      const res = await fetch(`/api/cases/${caseId}/evidence-pack`, {
        headers: getAuthHeaders(caseId)
      });
      if (!res.ok) {
        throw new Error("Unauthorized or case not found");
      }
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `evidence_pack_${caseId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
      showToast("Evidence pack PDF downloaded successfully.", "success");
    } catch (e: any) {
      showToast(e.message || "Failed to download evidence pack", "error");
    }
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedActionId(id);
    showToast("Copied to clipboard!", "success");
    setTimeout(() => setCopiedActionId(null), 3000);
  };

  // Load 25 synthetic complaints for B2B testing
  const loadSyntheticComplaints = async () => {
    setLoading(true);
    const syntheticList = [
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

      // 3 Missing fields
      { complaint_id: "COMP-MISS-1", text: "Money deducted but no ref provided", amount: 1500, transaction_date: "2026-09-25", reference: null },
      { complaint_id: "COMP-MISS-2", text: "Payment failed without date", amount: 2000, transaction_date: null, reference: "UPI998" },
      { complaint_id: "COMP-MISS-3", text: "General debit failure", amount: null, transaction_date: "2026-09-27", reference: "UPI999" },

      // 3 Fraud / Unauthorized
      { complaint_id: "COMP-201", text: "I did not make this transaction. Someone hacked my account and stole money.", amount: 15000, transaction_date: "2026-09-29", reference: "FRD201" },
      { complaint_id: "COMP-202", text: "Unauthorized transaction of Rs 8500 done while phone was locked", amount: 8500, transaction_date: "2026-09-28", reference: "FRD202" },
      { complaint_id: "COMP-203", text: "Someone stole my money via fraudulent transaction", amount: 20000, transaction_date: "2026-09-27", reference: "FRD203" },

      // 3 Merchant refunds
      { complaint_id: "COMP-301", text: "Online store cancelled my order but merchant refund Rs 1200 has not arrived", amount: 1200, transaction_date: "2026-09-20", reference: "MRH301" },
      { complaint_id: "COMP-302", text: "Amazon refund of Rs 3500 pending for 10 days", amount: 3500, transaction_date: "2026-09-21", reference: "MRH302" },
      { complaint_id: "COMP-303", text: "Flipkart order cancelled, merchant refund Rs 2400 not credited yet", amount: 2400, transaction_date: "2026-09-22", reference: "MRH303" },

      // 2 ATM disputes
      { complaint_id: "COMP-401", text: "ATM cash dispense failed card debited", amount: 5000, transaction_date: "2026-09-25", reference: "ATM401" },
      { complaint_id: "COMP-402", text: "ATM machine did not dispense cash for Rs 2000", amount: 2000, transaction_date: "2026-09-26", reference: "ATM402" },

      // 4 General queries
      { complaint_id: "COMP-601", text: "General query about transaction charges", amount: 100, transaction_date: "2026-09-25", reference: "UNK601" },
      { complaint_id: "COMP-602", text: "Bank statement discrepancy", amount: 350, transaction_date: "2026-09-24", reference: "UNK602" },
      { complaint_id: "COMP-603", text: "App login issue and support", amount: 500, transaction_date: "2026-09-23", reference: "UNK603" },
      { complaint_id: "COMP-604", text: "Account balance enquiry", amount: 1200, transaction_date: "2026-09-22", reference: "UNK604" }
    ];

    try {
      const res = await fetch("/api/b2b/triage-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaints: syntheticList, as_of: "2026-10-01" })
      });
      const data = await res.json();
      setB2bSummary(data.summary);
      setB2bResults(data.results);
      showToast("Loaded 25 synthetic complaints with unified rules triage.", "success");
    } catch (e) {
      showToast("Batch triage failed", "error");
    } finally {
      setLoading(false);
    }
  };

  const filteredB2bResults = b2bResults.filter((r) => {
    if (b2bFilter === "breached") return r.tat_breached;
    if (b2bFilter === "within_tat") return !r.tat_breached && r.classification !== "missing_evidence";
    if (b2bFilter === "missing_info") return r.classification === "missing_evidence";
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Toast Notification (Replaces alerts) */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-3 px-4 py-3 rounded-xl border shadow-2xl backdrop-blur transition-all duration-300 animate-slide-up bg-slate-900/95 text-slate-100 border-slate-700">
          {toast.type === "success" && <CheckCircle2 className="w-5 h-5 text-emerald-400" />}
          {toast.type === "error" && <XCircle className="w-5 h-5 text-rose-400" />}
          {toast.type === "info" && <AlertTriangle className="w-5 h-5 text-amber-400" />}
          <span className="text-xs font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-40 px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-cyan-400 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight bg-gradient-to-r from-white via-slate-100 to-indigo-300 bg-clip-text text-transparent">
                RefundRakshak
              </h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-semibold">
                Production Copilot
              </span>
            </div>
            <p className="text-[11px] text-slate-400">Statutory RBI TAT compliance & autonomous escalation engine</p>
          </div>
        </div>

        {/* Mode Switcher & Controls */}
        <div className="flex items-center space-x-3">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-1 flex space-x-1">
            <button
              onClick={() => setAppMode("consumer")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                appMode === "consumer" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              Consumer Redressal
            </button>
            <button
              onClick={() => setAppMode("b2b")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                appMode === "b2b" ? "bg-indigo-600 text-white shadow" : "text-slate-400 hover:text-white"
              }`}
            >
              For Regulated Entities (B2B)
            </button>
          </div>

          {appMode === "consumer" && (
            <div className="flex items-center space-x-2">
              <select
                value={userLanguage}
                onChange={(e) => setUserLanguage(e.target.value)}
                className="bg-slate-900 border border-slate-800 text-xs rounded-xl px-2.5 py-1.5 text-slate-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="en">English</option>
                <option value="hi">हिंदी (Hindi)</option>
                <option value="ta">தமிழ் (Tamil)</option>
                <option value="te">తెలుగు (Telugu)</option>
                <option value="mr">मराठी (Marathi)</option>
              </select>

              <button
                onClick={() => handleSimulateTime(7)}
                disabled={loading}
                title="Dev Tool: Advance test clock by 7 days (available when ENABLE_SIM_TIME=true)"
                className="flex items-center space-x-1.5 bg-amber-950/40 hover:bg-amber-900/60 text-amber-200 border border-amber-600/40 px-2.5 py-1.5 rounded-xl text-xs font-medium transition disabled:opacity-50"
              >
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 px-1 py-0.5 rounded">DEV TOOL</span>
                <span className="hidden sm:inline">+7 Days</span>
              </button>

              <button
                onClick={handleResetDemo}
                title="Reset demo case RR-DEMO-001 for testing"
                className="flex items-center space-x-1 text-slate-400 hover:text-white px-2 py-1.5 rounded-xl text-xs transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reset Demo</span>
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      {appMode === "consumer" ? (
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Sidebar: Case Meta, Tasks, Approvals */}
          <div className="lg:col-span-4 space-y-5">
            {/* Active Case Card */}
            <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl backdrop-blur">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Active Case</span>
                  <span className="text-xs font-mono font-bold text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-800/40">
                    {caseId}
                  </span>
                </div>
                <button
                  onClick={handleCreateNewCase}
                  className="inline-flex items-center space-x-1 text-xs text-indigo-400 hover:text-indigo-300 font-medium"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>New Case</span>
                </button>
              </div>

              {caseState && (
                <div className="space-y-4 text-xs">
                  <div className="grid grid-cols-2 gap-3 bg-slate-950/70 rounded-xl p-3 border border-slate-800">
                    <div>
                      <div className="text-slate-400 text-[10px]">Amount</div>
                      <div className="text-base font-bold text-emerald-400">
                        {caseState.transaction_facts.amount !== null ? `₹${caseState.transaction_facts.amount}` : "Pending"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Reference</div>
                      <div className="font-mono text-slate-200 truncate">
                        {caseState.transaction_facts.transaction_reference
                          ? `****${caseState.transaction_facts.transaction_reference.slice(-4)}`
                          : "Not provided"}
                      </div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Date (T)</div>
                      <div className="text-slate-200">{caseState.transaction_facts.transaction_date || "Pending"}</div>
                    </div>
                    <div>
                      <div className="text-slate-400 text-[10px]">Provider / Bank</div>
                      <div className="text-slate-200 truncate">{caseState.transaction_facts.bank_or_provider || "Pending"}</div>
                    </div>
                  </div>

                  {/* Recommendation Card */}
                  <div className="bg-gradient-to-br from-indigo-950/40 to-slate-900 border border-indigo-500/30 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-300">
                      <span>Recommendation</span>
                      <span className="text-[10px] bg-indigo-500/20 px-1.5 py-0.5 rounded text-indigo-200">
                        {Math.round((caseState.classification_confidence || 0.95) * 100)}% Confidence
                      </span>
                    </div>
                    <div className="text-xs text-slate-200 font-medium">
                      {caseState.branch === "fraud_safety_branch"
                        ? "Report immediately to National Cyber Crime Portal (1930 / cybercrime.gov.in)"
                        : caseState.branch === "merchant_refund_branch"
                        ? "Verify merchant refund settlement reference with merchant gateway"
                        : caseState.branch === "out_of_scope_atm"
                        ? "ATM non-dispense dispute: lodge physical card dispute with issuer"
                        : "Lodge formal bank complaint citing RBI Circular RBI/2019-20/67"}
                    </div>
                  </div>

                  {/* Statutory Potential Compensation Meter */}
                  <div className="bg-gradient-to-br from-emerald-950/30 to-slate-900 border border-emerald-500/30 rounded-xl p-3.5 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-emerald-400 uppercase tracking-wide">
                        Statutory Delayed Compensation
                      </span>
                      <Zap className="w-3.5 h-3.5 text-emerald-400" />
                    </div>
                    <div className="text-2xl font-bold text-emerald-300">
                      {caseState.classification === "supported_upi_failed_debited_not_credited" && caseState.transaction_facts.transaction_date
                        ? `₹800`
                        : "₹0"}
                    </div>
                    <p className="text-[10px] text-slate-400 italic">
                      "Potential compensation estimate, subject to verification."
                    </p>
                    <p className="text-[9px] text-slate-500">
                      Calculated under RBI Circular RBI/2019-20/67 (T+1 calendar day reversal mandate). Prototype is not legal advice.
                    </p>
                  </div>

                  <button
                    onClick={handleDownloadEvidencePack}
                    className="w-full flex items-center justify-center space-x-2 bg-slate-800 hover:bg-slate-700 text-slate-200 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition"
                  >
                    <FileText className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Download Evidence Pack PDF</span>
                  </button>
                </div>
              )}
            </div>

            {/* Human Approval Cards (Replaces alerts) */}
            {caseState?.pending_actions && caseState.pending_actions.length > 0 && (
              <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-5 shadow-xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-xs font-semibold text-amber-300 uppercase tracking-wider">
                      Approval Required ({caseState.pending_actions.filter((a: any) => a.status === "pending_approval").length})
                    </h3>
                  </div>
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded font-medium">
                    Human Authorization
                  </span>
                </div>

                <div className="space-y-3">
                  {caseState.pending_actions.map((act: any) => (
                    <div key={act.id} className="bg-slate-950/90 rounded-xl p-3.5 border border-slate-800 space-y-2.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-200">{act.type.replace(/_/g, " ").toUpperCase()}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                          act.status === "sent" ? "bg-emerald-500/20 text-emerald-300" : (act.status === "pending_approval" ? "bg-amber-500/20 text-amber-300" : "bg-slate-800 text-slate-400")
                        }`}>
                          {act.status.replace(/_/g, " ")}
                        </span>
                      </div>

                      {act.status === "pending_approval" ? (
                        <div className="space-y-1">
                          <label className="text-[10px] text-slate-400 font-medium">Bank Contact Email (verify or enter official address):</label>
                          <input
                            type="email"
                            value={recipientEdits[act.id] !== undefined ? recipientEdits[act.id] : (act.payload?.recipient || "")}
                            onChange={(e) => setRecipientEdits({ ...recipientEdits, [act.id]: e.target.value })}
                            placeholder="e.g. nodal.officer@bank.co.in"
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-indigo-300 font-mono focus:outline-none focus:border-indigo-500"
                          />
                        </div>
                      ) : (
                        <div className="text-[11px] text-slate-300 font-medium">
                          To: <span className="font-mono text-indigo-300">{act.payload?.recipient || act.payload?.portal_url}</span>
                        </div>
                      )}

                      <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 max-h-28 overflow-y-auto whitespace-pre-wrap">
                        {act.payload?.body}
                      </div>

                      {act.status === "pending_approval" ? (
                        <div className="flex space-x-2 pt-1">
                          <button
                            onClick={() => handleApproveAction(act.id)}
                            className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white py-2 rounded-lg font-semibold text-xs shadow-md transition flex items-center justify-center space-x-1"
                          >
                            <Mail className="w-3.5 h-3.5" />
                            <span>Approve & Dispatch</span>
                          </button>
                          <button
                            onClick={() => handleRejectAction(act.id)}
                            className="bg-rose-950/60 hover:bg-rose-900 text-rose-300 border border-rose-800/40 px-3 py-2 rounded-lg font-medium text-xs transition"
                          >
                            Reject
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between pt-1">
                          <span className="text-emerald-400 text-[11px] font-medium flex items-center space-x-1">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Authorized</span>
                          </span>
                          {act.payload?.body && (
                            <button
                              onClick={() => copyToClipboard(act.payload.body, act.id)}
                              className="inline-flex items-center space-x-1 text-[11px] text-indigo-400 hover:text-indigo-300"
                            >
                              <Copy className="w-3 h-3" />
                              <span>{copiedActionId === act.id ? "Copied" : "Copy Draft"}</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Main Panel: Tabs, Chat, Timeline, Evidence */}
          <div className="lg:col-span-8 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur overflow-hidden">
            {/* Tab navigation */}
            <div className="flex border-b border-slate-800 bg-slate-950/40 px-4 py-2 space-x-1 overflow-x-auto">
              <button
                onClick={() => setActiveTab("chat")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === "chat" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Agent Dialogue</span>
              </button>
              <button
                onClick={() => setActiveTab("timeline")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === "timeline" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Escalation Timeline</span>
              </button>
              <button
                onClick={() => setActiveTab("trace")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === "trace" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Live Tool Trace ({caseState?.trace?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab("outbox")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === "outbox" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                }`}
              >
                <Mail className="w-3.5 h-3.5" />
                <span>Outbox ({caseState?.outbox?.length || 0})</span>
              </button>
              <button
                onClick={() => setActiveTab("rules")}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition flex items-center space-x-1.5 ${
                  activeTab === "rules" ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20" : "text-slate-400 hover:text-white"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>Verified Rules</span>
              </button>
            </div>

            {/* Chat View */}
            {activeTab === "chat" && (
              <div className="flex-1 flex flex-col h-[600px]">
                <div className="flex-1 p-5 overflow-y-auto space-y-4">
                  {messages.map((m, idx) => (
                    <div key={idx} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                          m.role === "user"
                            ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/20 rounded-br-none font-medium"
                            : "bg-slate-800/90 border border-slate-700/80 text-slate-100 rounded-bl-none shadow"
                        }`}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))}
                  {loading && (
                    <div className="flex justify-start">
                      <div className="bg-slate-800 border border-slate-700 rounded-2xl px-4 py-3 text-xs text-indigo-300 flex items-center space-x-2 animate-pulse">
                        <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                        <span>Evaluating grievance against statutory RBI rules...</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input box */}
                <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-950/60 space-y-2">
                  {selectedImage && (
                    <div className="flex items-center space-x-2 bg-indigo-950/40 border border-indigo-500/30 rounded-lg px-3 py-1.5 text-xs text-indigo-300">
                      <ImageIcon className="w-4 h-4" />
                      <span className="truncate flex-1">{selectedImage.name}</span>
                      <button type="button" onClick={() => setSelectedImage(null)} className="text-slate-400 hover:text-white">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  <div className="flex space-x-2">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleImageSelect}
                      accept="image/png,image/jpeg"
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 px-3 rounded-xl flex items-center justify-center transition"
                      title="Attach transaction screenshot"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </button>
                    <input
                      type="text"
                      value={inputMessage}
                      onChange={(e) => setInputMessage(e.target.value)}
                      placeholder="Describe your failed UPI transaction (Amount, Date, UTR, Bank)..."
                      className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                    />
                    <button
                      type="submit"
                      disabled={loading || (!inputMessage.trim() && !selectedImage)}
                      className="bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-xl text-xs font-semibold shadow-md shadow-indigo-600/30 transition flex items-center justify-center disabled:opacity-50"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Escalation Timeline View */}
            {activeTab === "timeline" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-6">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Statutory Escalation Timeline</h3>
                <div className="relative border-l border-slate-800 ml-4 space-y-6 pl-6 text-xs">
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-emerald-500 ring-4 ring-slate-950" />
                    <div className="font-semibold text-emerald-400">Step 1: Bank Grievance Redressal</div>
                    <p className="text-slate-300 mt-1">
                      Initial complaint lodged with bank customer care/support. Status: {caseState?.complaint_status || "Lodged"}
                    </p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-cyan-500 ring-4 ring-slate-950" />
                    <div className="font-semibold text-cyan-400">Step 2: RBI T+1 Reversal Mandate</div>
                    <p className="text-slate-300 mt-1">
                      Under RBI Circular RBI/2019-20/67, failed UPI debits must reverse within T+1 calendar day. Beyond T+1, statutory compensation is ₹100/day.
                    </p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-amber-500 ring-4 ring-slate-950" />
                    <div className="font-semibold text-amber-400">Step 3: Principal Nodal Officer Escalation</div>
                    <p className="text-slate-300 mt-1">
                      If bank provides no response within 7 business days, escalation draft is generated for the bank's Principal Nodal Officer.
                    </p>
                  </div>
                  <div className="relative">
                    <span className="absolute -left-[31px] top-0 w-3.5 h-3.5 rounded-full bg-indigo-500 ring-4 ring-slate-950" />
                    <div className="font-semibold text-indigo-400">Step 4: RBI Integrated Ombudsman (CMS Portal)</div>
                    <p className="text-slate-300 mt-1">
                      If dispute remains unresolved after 30 days or is rejected by bank, customer may file on the official RBI CMS portal (
                      <a href="https://cms.rbi.org.in" target="_blank" rel="noreferrer" className="text-cyan-400 underline">
                        cms.rbi.org.in
                      </a>
                      ).
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Live Tool Trace View */}
            {activeTab === "trace" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-3">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">Live Agent Tool Execution Trace</h3>
                {caseState?.trace && caseState.trace.length > 0 ? (
                  caseState.trace.map((tr: any) => (
                    <div key={tr.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-indigo-400 font-semibold">[{tr.tool_name}]</span>
                        <span className="text-[10px] text-slate-500">{new Date(tr.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div className="font-medium text-slate-200">{tr.label}</div>
                      <p className="text-slate-400 text-[11px]">{tr.summary}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-12 text-xs">No tool executions recorded yet.</div>
                )}
              </div>
            )}

            {/* Outbox View */}
            {activeTab === "outbox" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Dispatched Outbox</h3>
                {caseState?.outbox && caseState.outbox.length > 0 ? (
                  caseState.outbox.map((ob: any, i: number) => (
                    <div key={i} className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-emerald-400">{ob.type.toUpperCase()}</span>
                        <span className="text-[10px] text-slate-500">{new Date(ob.executed_at).toLocaleString()}</span>
                      </div>
                      <div className="text-slate-300">To: <span className="font-mono text-slate-100">{ob.payload?.recipient}</span></div>
                      <div className="text-slate-300 font-semibold">{ob.payload?.subject}</div>
                      <div className="bg-slate-900 p-2.5 rounded border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap">
                        {ob.payload?.body}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-slate-500 py-12 text-xs">No approved actions dispatched yet.</div>
                )}
              </div>
            )}

            {/* Verified Rules View */}
            {activeTab === "rules" && (
              <div className="flex-1 p-6 overflow-y-auto space-y-4">
                <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                  ⚠️ Notice: Rule not yet manually verified - confirm against the RBI circular before relying on figures.
                </div>
                <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <div className="font-bold text-emerald-400">RBI Circular: RBI/2019-20/67 (DPSS)</div>
                  <p className="text-slate-300 leading-relaxed">
                    Harmonisation of Turn Around Time (TAT) and customer compensation for failed transactions using authorised Payment Systems. Mandates T+1 calendar day automatic reversal and ₹100/day delay compensation.
                  </p>
                  <a
                    href="https://www.rbi.org.in/Commonperson/english/Scripts/Notification.aspx?Id=3074"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-cyan-400 hover:underline"
                  >
                    <span>Official RBI Circular Document</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* B2B Complaint-Ops View */
        <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center space-x-2">
                <Building2 className="w-5 h-5 text-indigo-400" />
                <span>Regulated Entity Grievance Triage & Exposure Dashboard</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Unified statutory TAT triage engine, batch breach detection, exposure calculations, and CSV reporting.
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={loadSyntheticComplaints}
                disabled={loading}
                className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 transition flex items-center space-x-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>Load 25 Synthetic Complaints</span>
              </button>
              <a
                href="/api/b2b/exposure-report?format=csv"
                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl text-xs font-semibold border border-slate-700 transition flex items-center space-x-1.5"
              >
                <Download className="w-4 h-4 text-emerald-400" />
                <span>Download Exposure CSV</span>
              </a>
            </div>
          </div>

          {/* B2B Summary KPI Cards */}
          {b2bSummary && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow">
                <div className="text-[11px] text-slate-400 uppercase font-medium">Total Complaints</div>
                <div className="text-2xl font-bold text-white mt-1">{b2bSummary.total_complaints}</div>
              </div>
              <div className="bg-slate-900/90 border border-rose-500/30 rounded-2xl p-4 shadow">
                <div className="text-[11px] text-rose-400 uppercase font-medium">TAT Breaches</div>
                <div className="text-2xl font-bold text-rose-400 mt-1">{b2bSummary.breached_count}</div>
              </div>
              <div className="bg-slate-900/90 border border-amber-500/30 rounded-2xl p-4 shadow">
                <div className="text-[11px] text-amber-400 uppercase font-medium">Compensation Exposure</div>
                <div className="text-2xl font-bold text-amber-300 mt-1">₹{b2bSummary.total_compensation_exposure?.toLocaleString()}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Subject to verification</div>
              </div>
              <div className="bg-slate-900/90 border border-cyan-500/30 rounded-2xl p-4 shadow">
                <div className="text-[11px] text-cyan-400 uppercase font-medium">Needs Info</div>
                <div className="text-2xl font-bold text-cyan-300 mt-1">{b2bSummary.needs_info_count}</div>
                <div className="text-[9px] text-slate-500 mt-0.5">Missing required fields</div>
              </div>
              <div className="bg-slate-900/90 border border-indigo-500/30 rounded-2xl p-4 shadow">
                <div className="text-[11px] text-indigo-400 uppercase font-medium">Classifications</div>
                <div className="text-[11px] text-slate-300 mt-1.5 space-y-0.5">
                  {Object.entries(b2bSummary.classification_counts || {}).map(([k, v]: any) => (
                    <div key={k} className="flex justify-between">
                      <span className="truncate max-w-[110px]">{k.replace(/_/g, " ")}:</span>
                      <span className="font-mono font-bold text-white">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Filter Bar */}
          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-400 font-medium">Filter rows:</span>
            <button
              onClick={() => setB2bFilter("all")}
              className={`px-3 py-1 rounded-lg ${b2bFilter === "all" ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              All ({b2bResults.length})
            </button>
            <button
              onClick={() => setB2bFilter("breached")}
              className={`px-3 py-1 rounded-lg ${b2bFilter === "breached" ? "bg-rose-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              Breached ({b2bResults.filter(r => r.tat_breached).length})
            </button>
            <button
              onClick={() => setB2bFilter("within_tat")}
              className={`px-3 py-1 rounded-lg ${b2bFilter === "within_tat" ? "bg-emerald-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              Within TAT ({b2bResults.filter(r => !r.tat_breached && r.classification !== "missing_evidence").length})
            </button>
            <button
              onClick={() => setB2bFilter("missing_info")}
              className={`px-3 py-1 rounded-lg ${b2bFilter === "missing_info" ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-300"}`}
            >
              Needs Info ({b2bResults.filter(r => r.classification === "missing_evidence").length})
            </button>
          </div>

          {/* Results Table */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
            {filteredB2bResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/70 text-slate-400 uppercase font-semibold border-b border-slate-800">
                    <tr>
                      <th className="px-5 py-3">ID & Ref</th>
                      <th className="px-5 py-3">Amount</th>
                      <th className="px-5 py-3">Date</th>
                      <th className="px-5 py-3">Classification</th>
                      <th className="px-5 py-3">Branch</th>
                      <th className="px-5 py-3">TAT Breached?</th>
                      <th className="px-5 py-3">Exposure (₹)</th>
                      <th className="px-5 py-3 text-right">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/80">
                    {filteredB2bResults.map((r: any) => (
                      <React.Fragment key={r.complaint_id}>
                        <tr className="hover:bg-slate-800/40 transition">
                          <td className="px-5 py-3.5 font-mono text-white">
                            <div>{r.complaint_id}</div>
                            <div className="text-[10px] text-slate-400">{r.reference || "-"}</div>
                          </td>
                          <td className="px-5 py-3.5 font-bold text-emerald-400">
                            {r.amount !== null ? `₹${r.amount}` : "-"}
                          </td>
                          <td className="px-5 py-3.5 text-slate-300">{r.transaction_date || "-"}</td>
                          <td className="px-5 py-3.5 text-slate-300">{r.classification.replace(/_/g, " ")}</td>
                          <td className="px-5 py-3.5">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              r.classification === "missing_evidence"
                                ? "bg-cyan-500/20 text-cyan-300 border-cyan-500/30"
                                : (r.tat_breached ? "bg-rose-500/20 text-rose-300 border-rose-500/30" : "bg-emerald-500/20 text-emerald-300 border-emerald-500/30")
                            }`}>
                              {r.branch}
                            </span>
                          </td>
                          <td className="px-5 py-3.5">
                            {r.tat_breached ? (
                              <span className="text-rose-400 font-bold">Yes ({r.days_delayed}d delay)</span>
                            ) : (
                              <span className="text-slate-400">No</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 font-mono font-semibold text-amber-300">
                            ₹{r.potential_compensation_inr}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <button
                              onClick={() => setExpandedRow(expandedRow === r.complaint_id ? null : r.complaint_id)}
                              className="text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center space-x-1"
                            >
                              <span>{expandedRow === r.complaint_id ? "Hide" : "Inspect"}</span>
                              {expandedRow === r.complaint_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </td>
                        </tr>
                        {expandedRow === r.complaint_id && (
                          <tr className="bg-slate-950/80">
                            <td colSpan={8} className="px-5 py-4 space-y-3">
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
              <div className="text-center py-16 text-slate-500 text-xs">
                <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-40" />
                <p>No complaints matching filter. Click "Load 25 Synthetic Complaints" above.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
