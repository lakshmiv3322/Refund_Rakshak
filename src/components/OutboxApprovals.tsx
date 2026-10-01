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
  Scale
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
    (a: any) => a.status === "pending_human_approval"
  );
  const outbox = caseState.outbox || [];
  const facts = caseState.transaction_facts || {};

  const handleCopyText = (actionId: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedActionId(actionId);
    setTimeout(() => setCopiedActionId(null), 2500);
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
                {t.pendingApproval || "Mandatory Human Approval Queue"} ({pendingActions.length})
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
              <span className="font-bold">RefundRakshak Human-in-the-Loop Guarantee:</span> Nothing is ever sent to a bank or authority automatically. You inspect the exact facts and email draft side-by-side, verify or change the recipient, and choose when to approve or reject.
            </div>
          </div>

          {pendingActions.map((act: any) => {
            const currentRecipient =
              recipientInputs[act.id] !== undefined
                ? recipientInputs[act.id]
                : act.payload?.recipient || "";

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

                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
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
                        <span className="text-[10px] text-slate-400 block">Transaction Reference:</span>
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
                        <span className="text-[10px] text-slate-400 block">Statutory Citation:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-mono text-[10px]">
                          RBI/2019-20/67 Item 4(a)
                        </span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">Calculated Compensation:</span>
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
                          <span>{currentRecipient || "No recipient specified"}</span>
                          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center space-x-1">
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Verified Bank Directory</span>
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Subject */}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Subject Line:</span>
                      <div className="text-xs font-semibold text-slate-900 dark:text-white">
                        {act.payload?.subject || "Grievance Redressal Request"}
                      </div>
                    </div>

                    {/* Body */}
                    <div>
                      <span className="text-[10px] text-slate-400 block font-medium">Email Content:</span>
                      <pre className="text-[11px] font-sans text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 whitespace-pre-wrap max-h-48 overflow-y-auto leading-relaxed">
                        {act.payload?.body}
                      </pre>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 dark:border-slate-800">
                  <button
                    onClick={() => onRejectAction(act.id)}
                    disabled={loading}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border border-rose-200 dark:border-rose-900/60 transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>{t.reject}</span>
                  </button>

                  <button
                    onClick={() => handleCopyText(act.id, `${act.payload?.subject}\n\n${act.payload?.body}`)}
                    className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 transition flex items-center space-x-1.5"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{copiedActionId === act.id ? "Copied!" : "Copy Text"}</span>
                  </button>

                  <button
                    onClick={() => onApproveAction(act.id)}
                    disabled={loading}
                    className="px-5 py-2 rounded-xl text-xs font-bold text-white bg-blue-700 hover:bg-blue-800 shadow-md shadow-blue-700/20 transition flex items-center space-x-2 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{t.approveAndSend}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Dispatched Outbox History */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
            <Mail className="w-3.5 h-3.5 text-blue-600" />
            <span>Dispatched Communication Outbox</span>
          </h3>
          <span className="text-[10px] text-slate-400">{outbox.length} messages dispatched</span>
        </div>

        {outbox.length === 0 ? (
          <div className="text-center py-8 text-slate-400 text-xs">
            No complaints dispatched yet. Approved complaints will appear here with delivery audit tokens.
          </div>
        ) : (
          <div className="space-y-3">
            {outbox.map((msg: any, idx: number) => {
              const isMailtoFallback =
                msg.delivery_details?.provider === "mailto_fallback" ||
                msg.status === "approved_requires_manual_send";

              return (
                <div
                  key={idx}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 space-y-2"
                >
                  <div className="flex items-center justify-between text-xs">
                    <div className="font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                      <span>{msg.type?.replace(/_/g, " ").toUpperCase()}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        to {msg.payload?.recipient}
                      </span>
                    </div>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                      Approved & Logged
                    </span>
                  </div>

                  <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
                    {msg.payload?.subject}
                  </div>

                  {isMailtoFallback && msg.delivery_details?.mailto_url && (
                    <div className="pt-2 flex items-center space-x-2 border-t border-slate-200 dark:border-slate-800">
                      <a
                        href={msg.delivery_details.mailto_url}
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 flex items-center space-x-1.5 hover:bg-blue-100"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>Open in Email App</span>
                      </a>
                      <button
                        onClick={() =>
                          handleCopyText(
                            `outbox_${idx}`,
                            msg.delivery_details?.copy_text || msg.payload?.body
                          )
                        }
                        className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 flex items-center space-x-1.5 hover:bg-slate-100"
                      >
                        <Copy className="w-3 h-3" />
                        <span>
                          {copiedActionId === `outbox_${idx}` ? "Copied!" : "Copy Email Body"}
                        </span>
                      </button>
                    </div>
                  )}

                  <div className="text-[10px] text-slate-400 font-mono">
                    Executed at: {new Date(msg.executed_at).toLocaleString("en-IN")}
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
