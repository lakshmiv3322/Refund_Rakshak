import React, { useState, useEffect, useRef } from "react";
import {
  ShieldCheck,
  Building2,
  Clock,
  Sparkles,
  PlusCircle,
  FileText,
  Mail,
  Scale,
  Sun,
  Moon,
  MessageSquare,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  X,
  Check,
  Download,
  KeyRound,
  Trash2,
  Lock,
  PhoneCall,
  ExternalLink
} from "lucide-react";
import { translations, type SupportedLanguage } from "./i18n/translations";
import { Landing } from "./components/Landing";
import { UserCaseDashboard } from "./components/UserCaseDashboard";
import { ChatPanel } from "./components/ChatPanel";
import { AgentStepsPanel, type AgentStepItem } from "./components/AgentStepsPanel";
import { CaseTimeline } from "./components/CaseTimeline";
import { MoneyClockCard } from "./components/MoneyClockCard";
import { EvidenceUploader } from "./components/EvidenceUploader";
import { OutboxApprovals } from "./components/OutboxApprovals";
import { B2BDashboard } from "./components/B2BDashboard";
import { SafetyPage } from "./components/SafetyPage";

export default function App() {
  // Navigation & Theme
  const [currentView, setCurrentView] = useState<"landing" | "workspace" | "dashboard" | "b2b" | "safety">("landing");
  const [userLanguage, setUserLanguage] = useState<SupportedLanguage>("en");
  const [isDark, setIsDark] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"chat" | "timeline" | "evidence" | "outbox" | "rules">("chat");

  // Dev simulation flag: ONLY true if URL has ?dev=1 AND server reports sim_time_enabled
  const [isDevMode, setIsDevMode] = useState<boolean>(false);

  // User Identity & Session (Requirement 8)
  const [sessionToken, setSessionToken] = useState<string | null>(() => {
    try {
      return localStorage.getItem("refundrakshak_session_token");
    } catch {
      return null;
    }
  });
  const [sessionUser, setSessionUser] = useState<string | null>(() => {
    try {
      return localStorage.getItem("refundrakshak_session_user");
    } catch {
      return null;
    }
  });

  // Case State
  const [caseId, setCaseId] = useState<string>("");
  const [caseState, setCaseState] = useState<any>(null);
  const [casesList, setCasesList] = useState<any[]>([]);

  // Chat & Agent Reasoning
  const [messages, setMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    {
      role: "assistant",
      content:
        "Namaste! I am RefundRakshak, your production grievance copilot for Indian UPI & payment failures. I extract evidence, apply statutory RBI turnaround circulars, compute your ₹100/day compensation, and prepare escalation drafts with your explicit approval."
    }
  ]);
  const [inputMessage, setInputMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [agentSteps, setAgentSteps] = useState<AgentStepItem[]>([]);
  const [activePlan, setActivePlan] = useState<string[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamToken, setStreamToken] = useState("");

  // Evidence Attachment
  const [selectedImage, setSelectedImage] = useState<{ base64: string; mime: string; name: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tokens & Approvals
  const [caseTokens, setCaseTokens] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem("refundrakshak_tokens") || "{}");
    } catch {
      return {};
    }
  });
  const [recipientEdits, setRecipientEdits] = useState<Record<string, string>>({});
  const [confirmCustomModal, setConfirmCustomModal] = useState<{ actionId: string; recipient: string } | null>(null);

  // B2B State
  const [b2bSummary, setB2bSummary] = useState<any>(null);
  const [b2bResults, setB2bResults] = useState<any[]>([]);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  const t = translations[userLanguage] || translations.en;

  // Dark mode class sync
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [isDark]);

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

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
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (sessionToken) {
      headers["Authorization"] = `Bearer ${sessionToken}`;
      return headers;
    }
    const targetId = id || caseId;
    const token = caseTokens[targetId];
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["x-case-token"] = token;
    }
    return headers;
  };

  const fetchCasesList = async () => {
    try {
      const res = await fetch("/api/cases", { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setCasesList(data);
          if (!caseId && data.length > 0) {
            loadCase(data[0].case_id);
          }
        }
      }
    } catch (_) {}
  };

  const loadCase = async (id: string) => {
    if (!id) return;
    try {
      const res = await fetch(`/api/cases/${id}`, { headers: getAuthHeaders(id) });
      if (res.ok) {
        const data = await res.json();
        setCaseState(data);
        setCaseId(id);
        if (data.chat_history && data.chat_history.length > 0) {
          setMessages(
            data.chat_history.map((h: any) => ({
              role: h.role === "user" ? "user" : "assistant",
              content: h.text
            }))
          );
        }
        if (data.trace && data.trace.length > 0) {
          setAgentSteps(
            data.trace.map((tr: any) => ({
              type: "tool_execution",
              tool: tr.tool_name,
              summary: tr.summary,
              status: tr.status,
              timestamp: tr.timestamp
            }))
          );
        }
      }
    } catch (e) {
      console.warn("Could not load case:", e);
    }
  };

  // Initial load: check health and dev query param
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const devQuery = urlParams.get("dev") === "1";

    fetch("/api/health")
      .then((r) => r.json())
      .then((d) => {
        if (devQuery && d?.sim_time_enabled) {
          setIsDevMode(true);
        }
      })
      .catch(() => {});

    fetchCasesList();
  }, [sessionToken]);

  const handleCreateNewCase = async () => {
    try {
      const res = await fetch("/api/cases", {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify({ language: userLanguage, consent_given: true })
      });
      if (res.ok) {
        const newCase = await res.json();
        if (newCase.token) {
          saveTokenForCase(newCase.case_id, newCase.token);
        }
        setCaseId(newCase.case_id);
        setCaseState(newCase);
        setMessages([
          {
            role: "assistant",
            content: `Namaste! Case ${newCase.case_id} initialized. Please describe the payment failure or upload a screenshot.`
          }
        ]);
        setAgentSteps([]);
        setActivePlan([]);
        fetchCasesList();
        setCurrentView("workspace");
        showToast(`Created grievance case: ${newCase.case_id}`, "success");
      }
    } catch (e) {
      showToast("Error creating case", "error");
    }
  };

  // Image file handler
  const handleImageSelect = (file: File) => {
    if (!file.type.startsWith("image/")) {
      showToast("Please upload a PNG or JPEG screenshot image", "error");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showToast("Image must be smaller than 5MB", "error");
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
      showToast(`Attached receipt: ${file.name}`, "info");
    };
    reader.readAsDataURL(file);
  };

  // Send message to Agent with SSE live streaming support (Requirement 14)
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!inputMessage.trim() && !selectedImage) || loading) return;

    let targetCaseId = caseId;
    if (!targetCaseId) {
      await handleCreateNewCase();
      return;
    }

    const userText = inputMessage.trim();
    const imagePayload = selectedImage;

    setInputMessage("");
    setSelectedImage(null);

    setMessages((prev) => [...prev, { role: "user", content: userText || "[Uploaded Evidence Screenshot]" }]);
    setLoading(true);
    setIsStreaming(true);
    setStreamToken("");

    try {
      const res = await fetch("/api/agent/run?stream=true", {
        method: "POST",
        headers: {
          ...getAuthHeaders(targetCaseId),
          Accept: "text/event-stream"
        },
        body: JSON.stringify({
          case_id: targetCaseId,
          message: userText,
          language: userLanguage,
          simulated_now: caseState?.simulated_now,
          image_base64: imagePayload?.base64,
          image_mime: imagePayload?.mime
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || `Request failed with status ${res.status}`);
      }

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          let currentEvent = "";
          for (const line of lines) {
            if (line.startsWith("event:")) {
              currentEvent = line.replace("event:", "").trim();
            } else if (line.startsWith("data:")) {
              const dataStr = line.replace("data:", "").trim();
              try {
                const parsed = JSON.parse(dataStr);
                if (currentEvent === "token" && parsed.token) {
                  setStreamToken((prev) => prev + parsed.token);
                } else if (currentEvent === "step") {
                  if (parsed.type === "plan" && Array.isArray(parsed.plan)) {
                    setActivePlan(parsed.plan);
                  }
                  setAgentSteps((prev) => [...prev, parsed]);
                } else if (currentEvent === "done") {
                  if (parsed.token) {
                    saveTokenForCase(parsed.case_id, parsed.token);
                  }
                  if (parsed.case_state) {
                    setCaseState(parsed.case_state);
                    setCaseId(parsed.case_id);
                  }
                  if (parsed.message) {
                    setMessages((prev) => [...prev, { role: "assistant", content: parsed.message }]);
                  }
                  fetchCasesList();
                }
              } catch (_) {}
            }
          }
        }
      }
    } catch (err: any) {
      showToast(err.message || "Failed to process message", "error");
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "I encountered a processing issue. Please verify your connection or try again."
        }
      ]);
    } finally {
      setLoading(false);
      setIsStreaming(false);
      setStreamToken("");
    }
  };

  // Human Approval Handlers
  const handleApproveAction = async (actionId: string, confirmedCustom = false) => {
    setLoading(true);
    try {
      const customRecipient = recipientEdits[actionId];
      const res = await fetch(`/api/actions/${actionId}/approve`, {
        method: "POST",
        headers: getAuthHeaders(caseId),
        body: JSON.stringify({
          custom_recipient: customRecipient,
          confirmed_custom_recipient: confirmedCustom
        })
      });

      const data = await res.json();
      if (!res.ok) {
        if (data.requires_confirmation) {
          setConfirmCustomModal({ actionId, recipient: data.recipient });
          return;
        }
        throw new Error(data?.error?.message || "Failed to approve action");
      }

      showToast("Action approved and executed!", "success");
      loadCase(caseId);
      setActiveTab("outbox");
    } catch (err: any) {
      showToast(err.message || "Approval failed", "error");
    } finally {
      setLoading(false);
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
        loadCase(caseId);
      }
    } catch (_) {
      showToast("Failed to reject action", "error");
    }
  };

  // Record Bank Complaint Reference Number (Requirement 10)
  const handleRecordBankReference = async (targetCaseId: string, ref: string) => {
    try {
      const res = await fetch(`/api/cases/${targetCaseId}/bank-reference`, {
        method: "PATCH",
        headers: getAuthHeaders(targetCaseId),
        body: JSON.stringify({ bank_complaint_reference: ref })
      });
      if (res.ok) {
        showToast("Bank reference recorded successfully!", "success");
        loadCase(targetCaseId);
        fetchCasesList();
      } else {
        const err = await res.json().catch(() => null);
        showToast(err?.error?.message || "Failed to record reference", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Error recording reference", "error");
    }
  };

  // Resolve Case (Requirement 9)
  const handleResolveCase = async (targetCaseId: string, amount: number, outcome: string) => {
    try {
      const res = await fetch(`/api/cases/${targetCaseId}/resolve`, {
        method: "POST",
        headers: getAuthHeaders(targetCaseId),
        body: JSON.stringify({ amount_recovered: amount, outcome })
      });
      if (res.ok) {
        showToast("Case marked as resolved!", "success");
        loadCase(targetCaseId);
        fetchCasesList();
      } else {
        const err = await res.json().catch(() => null);
        showToast(err?.error?.message || "Failed to resolve case", "error");
      }
    } catch (e: any) {
      showToast(e.message || "Error resolving case", "error");
    }
  };

  // Export Case JSON (Requirement 8)
  const handleExportCase = (targetCaseId: string) => {
    window.open(`/api/cases/${targetCaseId}/export`, "_blank");
  };

  // Delete User Data (Requirement 8)
  const handleDeleteUserData = async () => {
    try {
      const res = await fetch("/api/user/data", {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (res.ok) {
        localStorage.removeItem("refundrakshak_tokens");
        localStorage.removeItem("refundrakshak_session_token");
        localStorage.removeItem("refundrakshak_session_user");
        setCaseTokens({});
        setSessionToken(null);
        setSessionUser(null);
        setCasesList([]);
        setCaseId("");
        setCaseState(null);
        showToast("All personal grievance data purged permanently.", "success");
        setCurrentView("landing");
      }
    } catch (e) {
      showToast("Error deleting user data", "error");
    }
  };

  // OTP Request & Verify (Requirement 8)
  const handleRequestOtp = async (identifier: string) => {
    const res = await fetch("/api/auth/request-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => null);
      throw new Error(err?.error?.message || "Failed to request code");
    }
    return await res.json();
  };

  const handleVerifyOtp = async (identifier: string, code: string) => {
    const res = await fetch("/api/auth/verify-otp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifier, code })
    });
    if (!res.ok) return false;
    const data = await res.json();
    if (data.session_token) {
      setSessionToken(data.session_token);
      setSessionUser(data.user);
      localStorage.setItem("refundrakshak_session_token", data.session_token);
      localStorage.setItem("refundrakshak_session_user", data.user);
      fetchCasesList();
      showToast(`Welcome back, ${data.user}!`, "success");
      return true;
    }
    return false;
  };

  const handleSignOut = () => {
    localStorage.removeItem("refundrakshak_session_token");
    localStorage.removeItem("refundrakshak_session_user");
    setSessionToken(null);
    setSessionUser(null);
    fetchCasesList();
    showToast("Signed out successfully", "info");
  };

  // Time simulation (dev mode only)
  const handleSimulateTime = async (days = 7) => {
    if (!caseId || !isDevMode) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/cases/${caseId}/simulate-time?dev=1`, {
        method: "POST",
        headers: getAuthHeaders(caseId),
        body: JSON.stringify({ days, dev: "1" })
      });
      if (res.ok) {
        const data = await res.json();
        setCaseState(data.case_state);
        showToast(`Dev clock advanced +${days} days. Checked follow-ups.`, "info");
      }
    } catch (_) {
      showToast("Time simulation failed", "error");
    } finally {
      setLoading(false);
    }
  };

  // B2B Batch Triage
  const handleTriageBatch = async (csvText: string) => {
    setLoading(true);
    try {
      const res = await fetch("/api/b2b/triage-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv_text: csvText })
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error?.message || "Batch triage failed");
      }
      const data = await res.json();
      setB2bSummary(data.summary);
      setB2bResults(data.results);
      showToast(`Successfully triaged ${data.results?.length || 0} complaints!`, "success");
    } catch (err: any) {
      showToast(err.message || "Batch triage failed", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={`min-h-screen flex flex-col font-sans transition-colors duration-200 ${isDark ? "bg-slate-950 text-slate-100" : "bg-slate-50 text-slate-900"}`}>
      {/* Hidden File Input for Evidence Upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/png,image/jpeg,image/jpg"
        className="hidden"
        onChange={(e) => {
          if (e.target.files && e.target.files[0]) {
            handleImageSelect(e.target.files[0]);
          }
        }}
      />

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center space-x-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-3 rounded-2xl shadow-2xl border border-slate-700 dark:border-slate-200 text-xs font-semibold animate-in slide-in-from-bottom-5">
          {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === "error" && <XCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === "info" && <AlertTriangle className="w-4 h-4 text-amber-400" />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-2 opacity-60 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Custom Recipient Confirmation Modal */}
      {confirmCustomModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center space-x-3 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="w-6 h-6 flex-shrink-0" />
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Confirm Custom Recipient Address
              </h3>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              The address <span className="font-mono font-bold text-slate-900 dark:text-white">"{confirmCustomModal.recipient}"</span> differs from our verified bank directory. To ensure delivery safety, please confirm you intend to dispatch to this address.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setConfirmCustomModal(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const actId = confirmCustomModal.actionId;
                  setConfirmCustomModal(null);
                  handleApproveAction(actId, true);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition shadow-md"
              >
                Confirm Address
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Navbar */}
      <header className="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur sticky top-0 z-40 px-4 sm:px-8 py-3 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div
            onClick={() => setCurrentView("landing")}
            className="w-10 h-10 rounded-xl bg-blue-700 flex items-center justify-center shadow-md shadow-blue-700/20 cursor-pointer text-white"
          >
            <ShieldCheck className="w-6 h-6" />
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <span
                onClick={() => setCurrentView("landing")}
                className="text-base sm:text-lg font-black tracking-tight cursor-pointer text-slate-900 dark:text-white"
              >
                RefundRakshak
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-900">
                RBI Statutory Agent
              </span>
              {isDevMode && (
                <span className="inline-flex items-center space-x-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300">
                  <span>?dev=1</span>
                </span>
              )}
            </div>
            <div className="text-[11px] text-slate-500 dark:text-slate-400 hidden sm:block">
              {t.tagline || "Autonomous Indian Payment Grievance Copilot"}
            </div>
          </div>
        </div>

        {/* View Switchers & Controls */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Main Navigation Tabs */}
          <nav className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl text-xs font-semibold">
            <button
              onClick={() => setCurrentView("landing")}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg transition ${
                currentView === "landing"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setCurrentView("dashboard")}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg transition ${
                currentView === "dashboard"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              My Cases
            </button>
            <button
              onClick={() => {
                if (!caseId && casesList.length === 0) {
                  handleCreateNewCase();
                } else {
                  setCurrentView("workspace");
                }
              }}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg transition ${
                currentView === "workspace"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Complaint Copilot
            </button>
            <button
              onClick={() => setCurrentView("b2b")}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg transition ${
                currentView === "b2b"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              B2B
            </button>
            <button
              onClick={() => setCurrentView("safety")}
              className={`min-h-[36px] px-3 py-1.5 rounded-lg transition ${
                currentView === "safety"
                  ? "bg-white dark:bg-slate-900 text-blue-700 dark:text-blue-400 shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
              }`}
            >
              Safety
            </button>
          </nav>

          {/* Language Selector (Includes Bengali) */}
          <select
            value={userLanguage}
            onChange={(e) => setUserLanguage(e.target.value as SupportedLanguage)}
            className="min-h-[36px] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs rounded-xl px-2.5 py-1.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-600 font-medium"
          >
            <option value="en">English (IN)</option>
            <option value="hi">हिंदी (Hindi)</option>
            <option value="ta">தமிழ் (Tamil)</option>
            <option value="te">తెలుగు (Telugu)</option>
            <option value="mr">मराठी (Marathi)</option>
            <option value="bn">বাংলা (Bengali)</option>
          </select>

          {/* Theme Toggle */}
          <button
            onClick={() => setIsDark(!isDark)}
            title="Toggle Light/Dark Theme"
            className="min-h-[36px] min-w-[36px] p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition flex items-center justify-center"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentView === "landing" && (
          <Landing
            t={t}
            onStartGrievance={() => {
              handleCreateNewCase();
            }}
            onViewDashboard={() => setCurrentView("dashboard")}
            onViewSafety={() => setCurrentView("safety")}
            isDark={isDark}
          />
        )}

        {currentView === "dashboard" && (
          <UserCaseDashboard
            t={t}
            cases={casesList}
            currentCaseId={caseId}
            onSelectCase={(id) => {
              loadCase(id);
              setCurrentView("workspace");
            }}
            onCreateNewCase={handleCreateNewCase}
            onRecordBankReference={handleRecordBankReference}
            onResolveCase={handleResolveCase}
            onExportCase={handleExportCase}
            onDeleteUserData={handleDeleteUserData}
            onRequestOtp={handleRequestOtp}
            onVerifyOtp={handleVerifyOtp}
            sessionUser={sessionUser}
            onSignOut={handleSignOut}
            loading={loading}
          />
        )}

        {currentView === "b2b" && (
          <B2BDashboard
            t={t}
            onTriageBatch={handleTriageBatch}
            summary={b2bSummary}
            results={b2bResults}
            loading={loading}
          />
        )}

        {currentView === "safety" && (
          <SafetyPage
            t={t}
            onBackToApp={() => setCurrentView("workspace")}
          />
        )}

        {currentView === "workspace" && (
          <div className="space-y-6">
            {/* Case Quick Bar */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    ACTIVE CASE:
                  </span>
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-900 text-xs">
                    {caseId || "Creating..."}
                  </span>

                  {casesList.length > 1 && (
                    <select
                      value={caseId}
                      onChange={(e) => loadCase(e.target.value)}
                      className="text-xs font-mono bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1 text-slate-700 dark:text-slate-300"
                    >
                      {casesList.map((c) => (
                        <option key={c.case_id} value={c.case_id}>
                          {c.case_id} (₹{c.transaction_facts?.amount ?? "—"})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleCreateNewCase}
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-blue-50 dark:bg-blue-950 hover:bg-blue-100 dark:hover:bg-blue-900 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-semibold flex items-center space-x-1.5 transition"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>New Case</span>
                  </button>

                  <a
                    href={`/api/cases/${caseId}/evidence-pack`}
                    target="_blank"
                    rel="noreferrer"
                    className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950 hover:bg-emerald-100 dark:hover:bg-emerald-900 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold flex items-center space-x-1.5 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Evidence PDF</span>
                  </a>
                </div>
              </div>

              {/* Status & Compensation Summary */}
              {(() => {
                const facts = caseState?.transaction_facts || {};
                const amountDisplay = facts.amount !== null && facts.amount !== undefined ? `₹${facts.amount}` : "Pending";
                const bankDisplay = facts.bank_or_provider || "Pending";
                const statusDisplay = caseState?.complaint_status ? caseState.complaint_status.replace(/_/g, " ") : (caseState?.escalation_stage || "Intake");

                let caseDaysDelayed = 0;
                let caseCompensation = caseState?.latest_compensation_estimate || 0;
                if (facts.transaction_date && caseState?.classification !== "unauthorized_or_fraud" && caseState?.branch !== "fraud_safety_branch") {
                  const txDate = new Date(facts.transaction_date);
                  const now = new Date(caseState?.simulated_now || new Date());
                  const elapsedDays = Math.max(0, Math.floor((now.getTime() - txDate.getTime()) / (1000 * 60 * 60 * 24)));
                  const tatDays = caseState?.scenario_id === "upi_p2m_merchant_debit_failed" ? 5 : 1;
                  caseDaysDelayed = Math.max(0, elapsedDays - tatDays);
                  if (!caseCompensation && caseDaysDelayed > 0) {
                    caseCompensation = caseDaysDelayed * 100;
                  }
                }

                return (
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300 flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span><strong className="text-slate-500 font-medium">Amount:</strong> <span className="font-semibold text-emerald-600 dark:text-emerald-400">{amountDisplay}</span></span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span><strong className="text-slate-500 font-medium">Bank:</strong> <span className="font-semibold">{bankDisplay}</span></span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span><strong className="text-slate-500 font-medium">Status:</strong> <span className="font-semibold capitalize">{statusDisplay}</span></span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span><strong className="text-slate-500 font-medium">Days Delayed:</strong> <span className="font-semibold">{caseDaysDelayed}d</span></span>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <span><strong className="text-slate-500 font-medium">Potential Comp:</strong> <span className="font-bold text-emerald-600 dark:text-emerald-400">₹{caseCompensation}</span></span>
                    <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium sm:ml-auto">
                      Potential compensation estimate, subject to verification.
                    </span>
                  </div>
                );
              })()}
            </div>

            {/* Main Copilot Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column (5 cols): Money Clock, Agent Steps */}
              <div className="lg:col-span-5 space-y-6">
                <MoneyClockCard
                  t={t}
                  caseState={caseState}
                  onSimulateTime={handleSimulateTime}
                  loading={loading}
                  isDevMode={isDevMode}
                />

                <AgentStepsPanel
                  t={t}
                  activePlan={activePlan}
                  steps={agentSteps}
                  loading={loading}
                  isDark={isDark}
                />
              </div>

              {/* Right Column (7 cols): Tabs for Dialogue, Timeline, Evidence, Outbox */}
              <div className="lg:col-span-7 space-y-4">
                {/* Secondary Tab Bar */}
                <div className="flex items-center space-x-2 border-b border-slate-200 dark:border-slate-800 pb-2">
                  <button
                    onClick={() => setActiveTab("chat")}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === "chat"
                        ? "bg-blue-700 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>{t.tabChat || "Complaint Assistant"}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("timeline")}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === "timeline"
                        ? "bg-blue-700 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Clock className="w-3.5 h-3.5" />
                    <span>{t.tabTimeline || "Milestones"}</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("evidence")}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === "evidence"
                        ? "bg-blue-700 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>Evidence</span>
                  </button>

                  <button
                    onClick={() => setActiveTab("outbox")}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                      activeTab === "outbox"
                        ? "bg-blue-700 text-white shadow-xs"
                        : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    <span>{t.tabOutbox || "Approvals"}</span>
                    {(caseState?.pending_actions || []).some(
                      (a: any) => a.status === "pending_approval" || a.status === "pending_human_approval"
                    ) && (
                      <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                    )}
                  </button>
                </div>

                {/* Tab Views */}
                {activeTab === "chat" && (
                  <ChatPanel
                    t={t}
                    messages={messages}
                    inputMessage={inputMessage}
                    setInputMessage={setInputMessage}
                    onSendMessage={handleSendMessage}
                    loading={loading}
                    selectedImage={selectedImage}
                    onImageClear={() => setSelectedImage(null)}
                    onOpenFileSelector={() => fileInputRef.current?.click()}
                    userLanguage={userLanguage}
                    isStreaming={isStreaming}
                    streamToken={streamToken}
                    caseState={caseState}
                    isDevMode={isDevMode}
                    onSelectSuggestion={(txt) => setInputMessage(txt)}
                  />
                )}

                {activeTab === "timeline" && (
                  <CaseTimeline
                    t={t}
                    caseState={caseState}
                    onSimulateTime={isDevMode ? handleSimulateTime : undefined}
                    loading={loading}
                  />
                )}

                {activeTab === "evidence" && (
                  <EvidenceUploader
                    t={t}
                    caseState={caseState}
                    selectedImage={selectedImage}
                    onImageSelect={handleImageSelect}
                    onImageClear={() => setSelectedImage(null)}
                    loading={loading}
                  />
                )}

                {activeTab === "outbox" && (
                  <OutboxApprovals
                    t={t}
                    caseState={caseState}
                    onApproveAction={handleApproveAction}
                    onRejectAction={handleRejectAction}
                    onUpdateRecipient={(actId, newRec) =>
                      setRecipientEdits((prev) => ({ ...prev, [actId]: newRec }))
                    }
                    loading={loading}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Persistent Official Footer (Requirement 13) */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur py-5 px-4 sm:px-8 mt-auto text-xs text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-center md:text-left">
          <div className="space-y-0.5">
            <div>
              <span className="font-semibold text-slate-700 dark:text-slate-300">Mandatory Notice:</span>{" "}
              {t.footerDisclaimer || "Not legal advice. We never ask for UPI PIN, OTP or passwords."}
            </div>
            <div className="text-[11px] text-slate-400">
              Timelines and compensation estimates are computed deterministically under Reserve Bank of India notifications (RBI/2019-20/67 & DBR.No.Leg.BC.78/09.07.005/2017-18).
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs font-semibold">
            <a
              href="https://cms.rbi.org.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <Scale className="w-3.5 h-3.5" />
              <span>RBI CMS Portal (cms.rbi.org.in)</span>
            </a>

            <a
              href="https://cybercrime.gov.in"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-1"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>cybercrime.gov.in</span>
            </a>

            <a
              href="tel:1930"
              className="text-rose-600 dark:text-rose-400 hover:underline flex items-center space-x-1 font-bold"
            >
              <PhoneCall className="w-3.5 h-3.5" />
              <span>Cyber Helpline 1930</span>
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
