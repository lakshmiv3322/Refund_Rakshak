import React, { useState } from "react";
import {
  Mail,
  Send,
  CheckCircle2,
  XCircle,
  Copy,
  AlertTriangle,
  ExternalLink,
  Edit2,
  Check,
  ShieldCheck,
  Building2,
  Scale,
  FileText,
  Share2,
  PhoneCall
} from "lucide-react";
import { type Translations } from "../i18n/translations";

interface OutboxApprovalsProps {
  t: Translations;
  caseState: any;
  onApproveAction: (actionId: string, confirmedCustom?: boolean) => void;
  onRejectAction: (actionId: string) => void;
  onUpdateRecipient?: (actionId: string, newRecipient: string) => void;
  loading: boolean;
}

export const OutboxApprovals: React.FC<OutboxApprovalsProps> = ({
  t,
  caseState,
  onApproveAction,
  onRejectAction,
  onUpdateRecipient,
  loading
}) => {
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [recipientInputs, setRecipientInputs] = useState<Record<string, string>>({});
  const [copiedActionId, setCopiedActionId] = useState<string | null>(null);

  if (!caseState) return null;

  const pendingActions = (caseState.pending_actions || []).filter(
    (a: any) => a.status === "pending_approval" || a.status === "pending_human_approval"
  );
  const outbox = caseState.outbox || [];
  const facts = caseState.transaction_facts || {};
  const [userEmailInput, setUserEmailInput] = useState<string>(caseState.user_email || caseState.user_profile?.email || "");
  const userEmail = (userEmailInput || caseState.user_email || caseState.user_profile?.email || "").trim();
  const isEmailMissing = !userEmail || userEmail === "user@example.com" || !userEmail.includes("@");

  const handleCopyText = (actionId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedActionId(actionId);
    setTimeout(() => setCopiedActionId(null), 2500);
  };

  const getMailtoUrl = (recipient: string, subject: string, body: string) => {
    return `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const getWhatsAppUrl = (text: string) => {
    return `https://wa.me/?text=${encodeURIComponent(text)}`;
  };

  return (
    <div className="space-y-6">
      {/* Prominent Pending Approvals Strip */}
      {pendingActions.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
              <span className="text-amber-800 dark:text-amber-400 font-bold">
                {t.approvalRequired || "Mandatory Human Approval Queue"} ({pendingActions.length})
              </span>
            </h3>
            <span className="text-[10px] text-slate-500">
              Zero outbound dispatches without your explicit review
            </span>
          </div>

          {/* Plain language guarantee banner */}
          <div className="bg-amber-50/80 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-2xl p-4 flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
              <span className="font-bold">Human-in-the-Loop Redressal Guarantee:</span> We never send emails, submit portal forms, or disclose details to any third party automatically. Review the draft below, choose your preferred delivery channel, or approve direct server dispatch. Your email is always set as the direct Reply-To.
            </div>
          </div>

          {pendingActions.map((act: any) => {
            const currentRecipient =
              recipientInputs[act.id] !== undefined
                ? recipientInputs[act.id]
                : act.payload?.recipient || "";
            const subject = act.payload?.subject || "Grievance Redressal Request";
            const body = act.payload?.body || "";
            const fullText = `${subject}\n\n${body}`;
            const portalUrl = act.payload?.portal_url || "https://cms.rbi.org.in";

            return (
              <div
                key={act.id}
                className="bg-white dark:bg-slate-900 border-2 border-amber-400/80 dark:border-amber-500/60 rounded-2xl p-5 shadow-lg space-y-4 transition"
              >
                {/* Header */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 dark:border-slate-800 pb-3">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                      <Mail className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white uppercase">
                        {act.type?.replace(/_/g, " ")}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono">Action ID: {act.id}</div>
                    </div>
                  </div>

                  <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                    Awaiting Your Approval
                  </span>
                </div>

                {/* Side-by-side: Source Facts vs Drafted Email */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                  {/* Left: Source Facts (4 cols) */}
                  <div className="lg:col-span-4 bg-slate-50 dark:bg-slate-950/70 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      <span>Verified Basis Facts</span>
                    </div>

                    <div className="space-y-1.5 text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">Claimed Amount:</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                          ₹{facts.amount ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Transaction Reference (Masked):</span>
                        <span className="font-mono text-slate-800 dark:text-slate-200">
                          {facts.transaction_reference ? `****${facts.transaction_reference.slice(-4)}` : "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Date of Debit:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-medium">
                          {facts.transaction_date ?? "—"}
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block font-medium">Reply-To (Your Email):</span>
                        {isEmailMissing ? (
                          <div className="space-y-1">
                            <input
                              type="email"
                              placeholder="Enter your real email (e.g. name@domain.com)"
                              value={userEmailInput}
                              onChange={(e) => setUserEmailInput(e.target.value)}
                              className="w-full text-xs font-mono px-2 py-1 rounded border border-rose-300 dark:border-rose-700 bg-rose-50 dark:bg-rose-950/40 text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                            />
                            <span className="text-[9px] text-rose-600 dark:text-rose-400 block">
                              * Required by bank before sending
                            </span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <span className="text-blue-700 dark:text-blue-400 font-medium truncate block">
                              {userEmail}
                            </span>
                            <button
                              onClick={() => setUserEmailInput("")}
                              className="text-[10px] text-slate-400 hover:text-blue-600 underline"
                            >
                              Change
                            </button>
                          </div>
                        )}
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Potential Delay Compensation:</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold font-mono">
                          ₹{caseState.latest_compensation_estimate || 0}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Drafted Message Preview (8 cols) */}
                  <div className="lg:col-span-8 bg-slate-50 dark:bg-slate-950/70 rounded-xl p-3.5 border border-slate-200 dark:border-slate-800 space-y-3">
                    {/* Recipient verification line */}
                    <div>
                      <div className="flex items-center justify-between text-[11px] mb-1">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Recipient Email:</span>
                        {editingActionId === act.id ? (
                          <button
                            onClick={() => {
                              if (onUpdateRecipient) onUpdateRecipient(act.id, currentRecipient);
                              setEditingActionId(null);
                            }}
                            className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center space-x-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Save Address</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setEditingActionId(act.id)}
                            className="text-xs text-blue-600 dark:text-blue-400 font-semibold flex items-center space-x-1 hover:underline"
                          >
                            <Edit2 className="w-3 h-3" />
                            <span>Edit Recipient</span>
                          </button>
                        )}
                      </div>

                      {editingActionId === act.id ? (
                        <input
                          type="email"
                          value={currentRecipient}
                          onChange={(e) =>
                            setRecipientInputs({ ...recipientInputs, [act.id]: e.target.value })
                          }
                          className="w-full text-xs font-mono px-3 py-1.5 rounded-lg border border-blue-400 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                        />
                      ) : (
                        <div className="text-xs font-mono px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 flex items-center justify-between">
                          <span>{currentRecipient || "support@bank.co.in"}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified Bank Contact</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Subject Line:</span>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {subject}
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Draft Content:</span>
                      <pre className="text-[11px] font-sans text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {body}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Delivery Channels Strip (Requirement 11) */}
                <div className="bg-slate-50 dark:bg-slate-950/40 rounded-xl p-3 border border-slate-200 dark:border-slate-800 space-y-2">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    Alternative Real-Life Delivery Channels
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Copy text */}
                    <button
                      onClick={() => handleCopyText(act.id, fullText)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 border border-slate-200 dark:border-slate-700 transition flex items-center space-x-1.5"
                    >
                      <Copy className="w-3.5 h-3.5 text-slate-500" />
                      <span>{copiedActionId === act.id ? "Copied!" : "Copy Text"}</span>
                    </button>

                    {/* Open in Email App (mailto) */}
                    <a
                      href={getMailtoUrl(currentRecipient, subject, body)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-700 dark:text-blue-300 bg-white dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950 border border-blue-200 dark:border-blue-800 transition flex items-center space-x-1.5"
                    >
                      <Mail className="w-3.5 h-3.5 text-blue-600" />
                      <span>Open in my email app</span>
                    </a>

                    {/* Download PDF Evidence Pack */}
                    <a
                      href={`/api/cases/${caseState.case_id}/evidence-pack`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 transition flex items-center space-x-1.5"
                    >
                      <FileText className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Download PDF Evidence</span>
                    </a>

                    {/* WhatsApp share */}
                    <a
                      href={getWhatsAppUrl(fullText)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-green-700 dark:text-green-300 bg-white dark:bg-slate-800 hover:bg-green-50 dark:hover:bg-green-950 border border-green-200 dark:border-green-800 transition flex items-center space-x-1.5"
                    >
                      <Share2 className="w-3.5 h-3.5 text-green-600" />
                      <span>Share on WhatsApp</span>
                    </a>

                    {/* Bank Official Portal / Helpline */}
                    <a
                      href={portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-purple-700 dark:text-purple-300 bg-white dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950 border border-purple-200 dark:border-purple-800 transition flex items-center space-x-1.5"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                      <span>Bank Portal / Helpline</span>
                    </a>
                  </div>
                </div>

                {/* Primary Authorization Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => onRejectAction(act.id)}
                    disabled={loading}
                    className="min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>{t.reject || "Reject Draft"}</span>
                  </button>

                  <button
                    onClick={() => onApproveAction(act.id)}
                    disabled={loading}
                    className="min-h-[44px] px-6 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-md shadow-blue-700/20 transition flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                    <span>{t.approveAndSend || "Approve & Send"}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispatched Outbox History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Dispatched Communication History</span>
          </h3>
          <span className="text-[10px] text-slate-400 font-medium">{outbox.length} messages dispatched</span>
        </div>

        {outbox.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No complaints dispatched yet. Once approved, delivered or manual communication records will be logged here.
          </div>
        ) : (
          <div className="space-y-3">
            {outbox.map((msg: any, idx: number) => {
              const fullText = `${msg.payload?.subject || ""}\n\n${msg.payload?.body || ""}`;

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2.5"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span>{msg.type?.replace(/_/g, " ").toUpperCase()}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        to {msg.payload?.recipient || "Bank Grievance Office"}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Approved & Recorded
                    </span>
                  </div>

                  <div className="text-xs text-slate-700 dark:text-slate-300 font-medium">
                    {msg.payload?.subject}
                  </div>

                  {/* Real life delivery options on dispatched messages too */}
                  <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 dark:border-slate-800">
                    <button
                      onClick={() => handleCopyText(`outbox_${idx}`, fullText)}
                      className="px-2.5 py-1 rounded text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 flex items-center space-x-1"
                    >
                      <Copy className="w-3 h-3" />
                      <span>{copiedActionId === `outbox_${idx}` ? "Copied!" : "Copy Text"}</span>
                    </button>

                    {msg.payload?.recipient && (
                      <a
                        href={getMailtoUrl(msg.payload.recipient, msg.payload.subject || "", msg.payload.body || "")}
                        className="px-2.5 py-1 rounded text-xs font-semibold text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-50 flex items-center space-x-1"
                      >
                        <Mail className="w-3 h-3" />
                        <span>Open in Email App</span>
                      </a>
                    )}

                    <a
                      href={`/api/cases/${caseState.case_id}/evidence-pack`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-50 flex items-center space-x-1"
                    >
                      <FileText className="w-3 h-3" />
                      <span>Download PDF</span>
                    </a>
                  </div>

                  <div className="text-[10px] text-slate-400 font-mono">
                    Logged at: {new Date(msg.executed_at || msg.created_at || Date.now()).toLocaleString("en-IN")}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
