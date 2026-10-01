import React, { useState } from "react";
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Download,
  Trash2,
  ExternalLink,
  PlusCircle,
  ShieldCheck,
  Send,
  Building2,
  Scale,
  Lock,
  KeyRound,
  Mail,
  Phone
} from "lucide-react";
import { type Translations } from "../i18n/translations";

export interface UserCaseDashboardProps {
  t: Translations;
  cases: any[];
  currentCaseId: string;
  onSelectCase: (caseId: string) => void;
  onCreateNewCase: () => void;
  onRecordBankReference: (caseId: string, ref: string) => Promise<void>;
  onResolveCase: (caseId: string, amount: number, outcome: string) => Promise<void>;
  onExportCase: (caseId: string) => void;
  onDeleteUserData: () => Promise<void>;
  onRequestOtp: (identifier: string) => Promise<{ status: string; channel: string; dev_code?: string }>;
  onVerifyOtp: (identifier: string, code: string) => Promise<boolean>;
  sessionUser: string | null;
  onSignOut: () => void;
  loading: boolean;
}

export const UserCaseDashboard: React.FC<UserCaseDashboardProps> = ({
  t,
  cases,
  currentCaseId,
  onSelectCase,
  onCreateNewCase,
  onRecordBankReference,
  onResolveCase,
  onExportCase,
  onDeleteUserData,
  onRequestOtp,
  onVerifyOtp,
  sessionUser,
  onSignOut,
  loading
}) => {
  // Auth state modal
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [identifierInput, setIdentifierInput] = useState("");
  const [otpInput, setOtpInput] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);

  // Reference modal
  const [refModalCaseId, setRefModalCaseId] = useState<string | null>(null);
  const [referenceInput, setReferenceInput] = useState("");

  // Resolve modal
  const [resolveModalCase, setResolveModalCase] = useState<any | null>(null);
  const [recoveredAmount, setRecoveredAmount] = useState<string>("");
  const [resolutionOutcome, setResolutionOutcome] = useState("Full refund received from bank.");

  // Delete confirm
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Compute status chip and milestone countdown for a case
  const getCaseStatusInfo = (c: any) => {
    const isResolved = c.complaint_status === "resolved";
    const hasMissingFields = (c.missing_fields || []).length > 0;
    const hasBankComplaint = Boolean(c.bank_complaint_date);
    const complaintDate = hasBankComplaint ? new Date(c.bank_complaint_date) : null;
    const now = new Date(c.simulated_now || new Date());
    const daysSinceComplaint = complaintDate
      ? Math.max(0, Math.floor((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)))
      : 0;

    if (isResolved) {
      return {
        chip: "Resolved",
        chipColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-300",
        nextAction: `Completed — ₹${c.amount_recovered || c.transaction_facts?.amount || 0} recovered`,
        countdown: "Case Redressed"
      };
    }

    if (hasMissingFields) {
      return {
        chip: "Needs info",
        chipColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300",
        nextAction: `Provide missing facts (${c.missing_fields.join(", ")})`,
        countdown: "Awaiting user input"
      };
    }

    if (daysSinceComplaint >= 30) {
      return {
        chip: "Escalate now",
        chipColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-300",
        nextAction: c.bank_complaint_reference
          ? "Submit official RBI Ombudsman package"
          : "Record bank reference # to unlock Ombudsman",
        countdown: "Statutory 30-day window elapsed"
      };
    }

    if (daysSinceComplaint >= 7) {
      return {
        chip: "Escalate now",
        chipColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300",
        nextAction: "7 days elapsed without bank reply — Nodal escalation ready",
        countdown: `${30 - daysSinceComplaint} days until Ombudsman milestone`
      };
    }

    if (hasBankComplaint) {
      return {
        chip: "Waiting for bank",
        chipColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-300",
        nextAction: "Waiting for bank resolution or reply",
        countdown: `${7 - daysSinceComplaint} days until Nodal escalation milestone`
      };
    }

    return {
      chip: "Needs info",
      chipColor: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border-slate-300",
      nextAction: "Review and approve initial bank grievance draft",
      countdown: "Statutory reversal SLA running"
    };
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifierInput.trim()) return;
    setAuthError(null);
    try {
      const res = await onRequestOtp(identifierInput.trim());
      setOtpSent(true);
      if (res.dev_code) {
        setDevCode(res.dev_code);
      }
    } catch (err: any) {
      setAuthError(err.message || "Failed to send verification code");
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpInput.trim()) return;
    setAuthError(null);
    try {
      const ok = await onVerifyOtp(identifierInput.trim(), otpInput.trim());
      if (ok) {
        setShowAuthModal(false);
        setOtpSent(false);
        setOtpInput("");
        setDevCode(null);
      } else {
        setAuthError("Invalid or expired verification code.");
      }
    } catch (err: any) {
      setAuthError(err.message || "Verification failed");
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Top Banner / Account Identity Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <FileText className="w-5 h-5 text-blue-700 dark:text-blue-400" />
            <span>Grievance Case Dashboard</span>
          </h2>
          <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {sessionUser ? (
              <span>Signed in as <strong className="text-slate-800 dark:text-slate-200">{sessionUser}</strong></span>
            ) : (
              <span>Accessing local session cases. Sign in to sync across devices.</span>
            )}
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {sessionUser ? (
            <button
              onClick={onSignOut}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition"
            >
              Sign Out
            </button>
          ) : (
            <button
              onClick={() => {
                setShowAuthModal(true);
                setAuthError(null);
              }}
              className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/70 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 transition flex items-center space-x-1.5"
            >
              <KeyRound className="w-3.5 h-3.5" />
              <span>Sign In with Email / Phone</span>
            </button>
          )}

          <button
            onClick={onCreateNewCase}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-xs transition flex items-center space-x-1.5"
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>New Complaint</span>
          </button>
        </div>
      </div>

      {/* Cases List */}
      <div className="space-y-3">
        {cases.length === 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center space-y-3">
            <FileText className="w-10 h-10 text-slate-300 dark:text-slate-600 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">No grievance cases found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Start your first complaint by clicking below, or sign in to load your previous cases.
            </p>
            <button
              onClick={onCreateNewCase}
              className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition inline-flex items-center space-x-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Start my complaint</span>
            </button>
          </div>
        ) : (
          cases.map((c) => {
            const statusInfo = getCaseStatusInfo(c);
            const isSelected = c.case_id === currentCaseId;
            const facts = c.transaction_facts || {};

            return (
              <div
                key={c.case_id}
                className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs transition space-y-3 ${
                  isSelected
                    ? "border-blue-500 ring-2 ring-blue-500/10"
                    : "border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700"
                }`}
              >
                {/* Header row */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-3">
                    <span className="font-mono text-xs font-bold text-slate-900 dark:text-white">
                      {c.case_id}
                    </span>
                    <span
                      className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${statusInfo.chipColor}`}
                    >
                      {statusInfo.chip}
                    </span>
                    {c.bank_complaint_reference && (
                      <span className="text-[10px] text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                        Bank Ref: {c.bank_complaint_reference}
                      </span>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 font-medium">
                    {statusInfo.countdown}
                  </div>
                </div>

                {/* Case Details Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Amount Debited</span>
                    <span className="font-bold text-slate-900 dark:text-white font-mono">
                      {facts.amount ? `₹${facts.amount}` : "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Bank / Provider</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200 truncate block">
                      {facts.bank_or_provider || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Potential Compensation</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                      ₹{c.latest_compensation_estimate || 0}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-400 block">Next Required Step</span>
                    <span className="text-[11px] text-slate-700 dark:text-slate-300 font-medium truncate block">
                      {statusInfo.nextAction}
                    </span>
                  </div>
                </div>

                {/* Action buttons row */}
                <div className="pt-2 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Capture Bank Complaint Reference Number Button */}
                    {!c.bank_complaint_reference && c.complaint_status !== "resolved" && (
                      <button
                        onClick={() => {
                          setRefModalCaseId(c.case_id);
                          setReferenceInput("");
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 font-medium hover:bg-amber-100 transition"
                      >
                        + Add Bank Ref #
                      </button>
                    )}

                    {/* Mark as Resolved button */}
                    {c.complaint_status !== "resolved" && (
                      <button
                        onClick={() => {
                          setResolveModalCase(c);
                          setRecoveredAmount(String(facts.amount || ""));
                        }}
                        className="text-xs px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 font-medium hover:bg-emerald-100 transition flex items-center space-x-1"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Resolved — money received</span>
                      </button>
                    )}

                    {/* Export button */}
                    <button
                      onClick={() => onExportCase(c.case_id)}
                      className="text-xs px-2.5 py-1.5 rounded-lg text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Export</span>
                    </button>
                  </div>

                  <button
                    onClick={() => onSelectCase(c.case_id)}
                    className="text-xs px-4 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition flex items-center space-x-1 shadow-xs"
                  >
                    <span>Open Case</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Retention Policy & Data Deletion Strip */}
      <div className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs">
        <div className="space-y-1">
          <div className="font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1.5">
            <Lock className="w-3.5 h-3.5 text-emerald-600" />
            <span>Digital Personal Data Protection (DPDP) Privacy Guarantee</span>
          </div>
          <p className="text-slate-500 dark:text-slate-400">
            {t.retentionPolicy || "Active case data retained for 90 days following resolution, then purged. You can delete or export your records at any time."}
          </p>
        </div>

        <button
          onClick={() => setShowDeleteConfirm(true)}
          className="px-3.5 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 bg-white dark:bg-slate-900 hover:bg-rose-50 dark:hover:bg-rose-950/60 border border-rose-300 dark:border-rose-900 transition flex items-center space-x-1.5 flex-shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span>{t.deleteMyData || "Delete my data"}</span>
        </button>
      </div>

      {/* OTP Sign-In Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                <span>Sign In with Email or Phone OTP</span>
              </h3>
              <button
                onClick={() => setShowAuthModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Access your existing grievance cases from any phone or browser. No password required.
            </p>

            {authError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs">
                {authError}
              </div>
            )}

            {!otpSent ? (
              <form onSubmit={handleRequestOtp} className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Email Address or 10-Digit Mobile #
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. rahul@example.com or 9876543210"
                    value={identifierInput}
                    onChange={(e) => setIdentifierInput(e.target.value)}
                    className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-end space-x-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setShowAuthModal(false)}
                    className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition"
                  >
                    Send Verification Code
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <div className="text-xs text-slate-600 dark:text-slate-300">
                  Verification code sent to <strong>{identifierInput}</strong>.
                </div>

                {devCode && (
                  <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 text-amber-800 dark:text-amber-200 text-xs">
                    Verification code: <strong className="font-mono text-sm tracking-widest">{devCode}</strong>
                  </div>
                )}

                <div>
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                    Enter 6-Digit Code
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    placeholder="123456"
                    value={otpInput}
                    onChange={(e) => setOtpInput(e.target.value)}
                    className="w-full text-center tracking-widest font-mono text-base px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
                  />
                </div>

                <div className="flex items-center justify-between pt-1">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    Change Email/Phone
                  </button>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={() => setShowAuthModal(false)}
                      className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition"
                    >
                      Verify & Sign In
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Record Bank Reference Number Modal */}
      {refModalCaseId && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <span>Record Bank Complaint Reference #</span>
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              When you submit a complaint to your bank via app or email, they provide an official ticket / complaint reference number (e.g. <code>BK-987654</code>). This reference is required by RBI to escalate to the Banking Ombudsman.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Bank Complaint Reference Number
              </label>
              <input
                type="text"
                required
                placeholder="e.g. BK-987654 or SR-2026-9918"
                value={referenceInput}
                onChange={(e) => setReferenceInput(e.target.value)}
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-blue-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setRefModalCaseId(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                disabled={!referenceInput.trim()}
                onClick={async () => {
                  await onRecordBankReference(refModalCaseId, referenceInput.trim());
                  setRefModalCaseId(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 transition disabled:opacity-50"
              >
                Save Reference #
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Resolve Case Modal */}
      {resolveModalCase && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Mark Case as Resolved — Money Received</span>
            </h3>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Congratulations on recovering your funds! Record the amount received and outcome for your audit trail.
            </p>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Total Amount Recovered (₹ INR)
              </label>
              <input
                type="number"
                required
                value={recoveredAmount}
                onChange={(e) => setRecoveredAmount(e.target.value)}
                className="w-full text-xs font-mono px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Resolution Outcome Note
              </label>
              <input
                type="text"
                value={resolutionOutcome}
                onChange={(e) => setResolutionOutcome(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-white focus:outline-none focus:border-emerald-600"
              />
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setResolveModalCase(null)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onResolveCase(resolveModalCase.case_id, Number(recoveredAmount) || 0, resolutionOutcome);
                  setResolveModalCase(null);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition"
              >
                Confirm Resolution
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400 flex items-center space-x-2">
              <Trash2 className="w-4 h-4" />
              <span>Purge Personal Data</span>
            </h3>

            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              This will permanently delete all your grievance records, evidence items, and case history from this device and our servers under DPDP principles. This action cannot be undone.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  await onDeleteUserData();
                  setShowDeleteConfirm(false);
                }}
                className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 transition"
              >
                Yes, Purge My Data
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
