import React from "react";
import {
  Clock,
  CheckCircle2,
  AlertCircle,
  Building2,
  Scale,
  Calendar,
  ArrowRight,
  ShieldAlert,
  Send
} from "lucide-react";
import { type Translations } from "../i18n/translations";

interface CaseTimelineProps {
  t: Translations;
  caseState: any;
  onSimulateTime?: (days: number) => void;
  loading?: boolean;
}

export const CaseTimeline: React.FC<CaseTimelineProps> = ({
  t,
  caseState,
  onSimulateTime,
  loading = false
}) => {
  if (!caseState) return null;

  const timeline = caseState.timeline || [];
  const followups = caseState.followups || [];
  const escalationStage = caseState.escalation_stage || "intake";

  const stages = [
    { id: "intake", label: "Evidence & Intake", icon: Calendar },
    { id: "bank_complaint", label: "Bank Level 1 (T+1 Reversal)", icon: Building2 },
    { id: "nodal_escalation_ready", label: "Nodal Officer (T+7)", icon: Send },
    { id: "ombudsman_eligible", label: "RBI Ombudsman (T+30)", icon: Scale }
  ];

  const getStageStatus = (stageId: string) => {
    const stageOrder = ["intake", "bank_complaint", "nodal_escalation_ready", "ombudsman_eligible"];
    const currentIndex = stageOrder.indexOf(escalationStage);
    const stageIndex = stageOrder.indexOf(stageId);

    if (stageIndex < currentIndex) return "completed";
    if (stageIndex === currentIndex) return "active";
    return "upcoming";
  };

  return (
    <div className="space-y-6">
      {/* Escalation Stage Stepper */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4 flex items-center justify-between">
          <span>Escalation Ladder</span>
          <span className="text-[10px] font-mono text-blue-600 dark:text-blue-400 normal-case font-semibold">
            Stage: {escalationStage.replace(/_/g, " ").toUpperCase()}
          </span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {stages.map((st, idx) => {
            const status = getStageStatus(st.id);
            const Icon = st.icon;
            return (
              <div
                key={st.id}
                className={`p-3 rounded-xl border transition ${
                  status === "completed"
                    ? "bg-emerald-50/60 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                    : status === "active"
                    ? "bg-blue-50 dark:bg-blue-950/40 border-blue-400 dark:border-blue-700 text-blue-900 dark:text-blue-200 ring-2 ring-blue-500/20"
                    : "bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-400"
                }`}
              >
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                      status === "completed"
                        ? "bg-emerald-200 dark:bg-emerald-900 text-emerald-800 dark:text-emerald-200"
                        : status === "active"
                        ? "bg-blue-200 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500"
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="text-xs font-semibold mt-2 leading-tight">{st.label}</div>
                <div className="text-[10px] mt-1 opacity-80">
                  {status === "completed" ? "Done" : status === "active" ? "In Progress" : "Pending SLA"}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Autonomous Follow-ups */}
      {followups.length > 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Autonomous Follow-Through Engine</span>
            </h3>
            <span className="text-[10px] bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full font-semibold">
              Proactive Monitoring Active
            </span>
          </div>

          <div className="space-y-2">
            {followups.map((fu: any) => (
              <div
                key={fu.id}
                className="flex items-start justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60"
              >
                <div className="space-y-1">
                  <div className="text-xs font-semibold text-slate-900 dark:text-white flex items-center space-x-2">
                    <span>{fu.action_type?.replace(/_/g, " ").toUpperCase()}</span>
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase ${
                        fu.status === "executed"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                      }`}
                    >
                      {fu.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    Trigger condition: <span className="font-mono">{fu.condition}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    Target Due Date: {new Date(fu.due_date).toLocaleString("en-IN")}
                  </div>
                </div>

                {fu.status === "pending" && onSimulateTime && (
                  <button
                    onClick={() => onSimulateTime(7)}
                    disabled={loading}
                    className="text-[11px] font-semibold text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/80 px-2.5 py-1 rounded-lg border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900 transition disabled:opacity-50"
                  >
                    Simulate Due
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chronological Event Log */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
          Case Event History
        </h3>

        {timeline.length === 0 ? (
          <div className="text-center py-6 text-slate-400 text-xs">No events recorded yet.</div>
        ) : (
          <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200 dark:before:bg-slate-800">
            {timeline.slice().reverse().map((ev: any, idx: number) => (
              <div key={idx} className="relative group">
                <div className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-blue-600 ring-4 ring-white dark:ring-slate-900" />
                <div className="text-xs font-semibold text-slate-900 dark:text-white">{ev.event}</div>
                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                  {new Date(ev.timestamp).toLocaleString("en-IN")}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
