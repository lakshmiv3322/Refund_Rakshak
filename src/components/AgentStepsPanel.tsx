import React from "react";
import {
  ListOrdered,
  Cpu,
  CheckCircle2,
  Clock,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { type Translations } from "../i18n/translations";

export interface AgentStepItem {
  type: "plan" | "tool_execution" | "token" | "completion";
  plan?: string[];
  tool?: string;
  args?: any;
  result?: any;
  status?: string;
  summary?: string;
  timestamp?: string;
}

interface AgentStepsPanelProps {
  t: Translations;
  activePlan: string[];
  steps: AgentStepItem[];
  loading: boolean;
  isDark: boolean;
}

export const AgentStepsPanel: React.FC<AgentStepsPanelProps> = ({
  t,
  activePlan,
  steps,
  loading,
  isDark
}) => {
  const [isExpanded, setIsExpanded] = React.useState(true);
  const [selectedStepDetail, setSelectedStepDetail] = React.useState<number | null>(null);

  const defaultPlan = [
    "1. Extract evidence & validate transaction facts",
    "2. Classify grievance & verify fraud safety boundary",
    "3. Match verified RBI circular (RBI/2019-20/67)",
    "4. Calculate statutory TAT deadline & compensation",
    "5. Draft grievance complaint & request human authorization",
    "6. Autonomous SLA monitoring: Schedule follow-up"
  ];

  const displayPlan = activePlan && activePlan.length > 0 ? activePlan : defaultPlan;

  // Determine current active plan stage index based on executed tools
  const getCompletedPlanIndex = () => {
    if (!steps || steps.length === 0) return 0;
    const tools = steps.map(s => s.tool).filter(Boolean);
    if (tools.includes("schedule_followup")) return 6;
    if (tools.includes("generate_bank_complaint") || tools.includes("generate_nodal_escalation") || tools.includes("generate_ombudsman_draft")) return 5;
    if (tools.includes("calculate_deadline_and_estimate")) return 4;
    if (tools.includes("lookup_verified_rule")) return 3;
    if (tools.includes("record_classification") || tools.includes("stop_branch")) return 2;
    if (tools.includes("extract_transaction_evidence") || tools.includes("update_case_facts")) return 1;
    return 1;
  };

  const currentStage = getCompletedPlanIndex();

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden transition">
      {/* Header */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        className="px-4 py-3 bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between cursor-pointer select-none"
      >
        <div className="flex items-center space-x-2.5">
          <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center text-blue-700 dark:text-blue-400">
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center space-x-2">
              <span>{t.whatAgentIsDoing}</span>
              {loading && (
                <span className="flex items-center space-x-1 text-[10px] font-normal text-blue-600 dark:text-blue-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-ping"></span>
                  <span>Executing Plan...</span>
                </span>
              )}
            </h3>
          </div>
        </div>
        <div className="flex items-center space-x-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
          <span className="text-[10px] font-mono font-medium">Stage {currentStage}/6</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-4 space-y-4">
          {/* Plan Roadmap */}
          <div className="space-y-1.5">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              {t.agentPlanTitle}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {displayPlan.map((stageText, idx) => {
                const stageNumber = idx + 1;
                const isDone = stageNumber <= currentStage && !loading;
                const isActive = stageNumber === currentStage && loading;
                return (
                  <div
                    key={idx}
                    className={`flex items-start space-x-2 p-2 rounded-xl border text-[11px] transition ${
                      isActive
                        ? "bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800 text-blue-900 dark:text-blue-200 font-semibold"
                        : isDone
                        ? "bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-900/40 text-emerald-800 dark:text-emerald-300 font-medium"
                        : "bg-slate-50/60 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400"
                    }`}
                  >
                    <div className="mt-0.5">
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                      ) : isActive ? (
                        <span className="w-3.5 h-3.5 rounded-full border-2 border-blue-600 border-t-transparent animate-spin inline-block" />
                      ) : (
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                      )}
                    </div>
                    <span className="leading-tight">{stageText}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Live Executed Steps */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between text-[10px] uppercase font-bold tracking-wider text-slate-400">
              <span>Live Tool Invocations ({steps?.length || 0})</span>
              <span className="font-mono text-slate-400">Stream: Active</span>
            </div>

            {steps && steps.length > 0 ? (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {steps.map((st, idx) => {
                  if (st.type === "plan") return null;
                  const isSelected = selectedStepDetail === idx;
                  return (
                    <div
                      key={idx}
                      className="bg-slate-50 dark:bg-slate-950/70 border border-slate-200 dark:border-slate-800 rounded-xl p-2.5 text-xs space-y-1.5 hover:border-slate-300 dark:hover:border-slate-700 transition"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1.5">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300">
                            {st.tool || "agent"}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {st.timestamp ? new Date(st.timestamp).toLocaleTimeString() : ""}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedStepDetail(isSelected ? null : idx)}
                          className="text-[10px] text-blue-600 dark:text-blue-400 hover:underline flex items-center space-x-0.5"
                        >
                          <Eye className="w-3 h-3" />
                          <span>{isSelected ? "Hide" : "Payload"}</span>
                        </button>
                      </div>

                      <p className="text-slate-700 dark:text-slate-300 text-[11px] leading-relaxed">
                        {st.summary || "Completed tool operation"}
                      </p>

                      {isSelected && (
                        <div className="pt-2 mt-1 border-t border-slate-200 dark:border-slate-800 text-[10px] font-mono space-y-1 bg-white dark:bg-slate-900 p-2 rounded-lg">
                          <div>
                            <span className="text-slate-400">Inputs: </span>
                            <span className="text-slate-700 dark:text-slate-300">{JSON.stringify(st.args || {})}</span>
                          </div>
                          <div>
                            <span className="text-slate-400">Result: </span>
                            <span className="text-slate-700 dark:text-slate-300">{JSON.stringify(st.result || {})}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-4 text-xs text-slate-400 font-medium">
                No tool executions yet. Start a grievance or click a demo scenario to see live tool reasoning.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
