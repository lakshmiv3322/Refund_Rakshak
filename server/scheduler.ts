import { loadDb, saveDb, CaseState } from "./store.ts";
import { calculateTATDeadlineAndCompensation } from "./rules-engine.ts";
import { sendUserDueFollowupNotification } from "./email.ts";

let schedulerInterval: NodeJS.Timeout | null = null;

export function checkAndExecuteDueFollowups(nowIso?: string): { executedCount: number; updatedCases: string[] } {
  const db = loadDb();
  // Scheduler always fires from real clock; nowIso is only passed for deterministic unit testing
  const now = nowIso ? new Date(nowIso) : new Date();
  const nowString = now.toISOString();

  let changed = false;
  let executedCount = 0;
  const updatedCases: string[] = [];

  for (const c of Object.values(db.cases)) {
    let caseChanged = false;

    // 1. Update latest compensation estimate and days delayed on the case
    if (c.transaction_facts.transaction_date && c.classification === "supported_upi_failed_debited_not_credited") {
      try {
        const calc = calculateTATDeadlineAndCompensation(c.transaction_facts.transaction_date, nowString);
        if (c.latest_compensation_estimate !== calc.potential_compensation_estimate || c.latest_days_delayed !== calc.days_delayed) {
          c.latest_compensation_estimate = calc.potential_compensation_estimate;
          c.latest_days_delayed = calc.days_delayed;
          c.updated_at = nowString;
          caseChanged = true;
        }
      } catch (_) {}
    }

    // 2. Process pending follow-ups
    for (const fu of c.followups) {
      if (fu.status === "pending") {
        const dueDate = new Date(fu.due_date);
        if (dueDate <= now) {
          fu.status = "due";
          caseChanged = true;

          const complaintDate = c.bank_complaint_date ? new Date(c.bank_complaint_date) : null;
          const daysSinceComplaint = complaintDate
            ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24))
            : 0;

          // 7-day nodal step: explicitly labeled as 'recommended wait', not an RBI requirement
          if (complaintDate && !c.bank_response && daysSinceComplaint >= 7) {
            fu.status = "executed";
            c.escalation_stage = "nodal_escalation_ready";
            executedCount++;

            // Idempotency: verify if nodal action already exists
            const existingNodalAction = c.pending_actions.find(a => a.type === "nodal_officer_escalation");
            if (!existingNodalAction) {
              const compText = c.latest_compensation_estimate && c.latest_compensation_estimate > 0
                ? `Potential compensation estimate, subject to verification: ₹${c.latest_compensation_estimate} (${c.latest_days_delayed} days delayed beyond T+1 at ₹100/day).`
                : "Potential compensation estimate, subject to verification.";

              c.pending_actions.push({
                id: "act_nodal_" + Math.random().toString(36).substring(2, 9),
                type: "nodal_officer_escalation",
                status: "pending_approval",
                requires_approval: true,
                created_at: nowString,
                payload: {
                  subject: `ESCALATION: Unresolved Failed UPI Debit - Ref ${c.transaction_facts.transaction_reference || "N/A"}`,
                  body: `Respected Principal Nodal Officer,\n\nMy initial bank complaint dated ${c.bank_complaint_date} (Ref: ${c.transaction_facts.transaction_reference || "N/A"}) regarding failed UPI debit of ₹${c.transaction_facts.amount || "N/A"} remains unresolved after ${daysSinceComplaint} days.\n\nNote: The 7-day wait period before nodal escalation is an industry-standard recommended wait period, not an RBI statutory clause. (Statutory Ombudsman escalation eligibility requires a 30-day wait under the RBI Integrated Ombudsman Scheme).\n\n${compText}\n\nKindly process immediate reversal and credit of statutory delayed-period compensation.`
                },
                simulated: false,
                source_references: c.source_references
              });
            }

            // Send notification email to user if not already sent
            if (!fu.notification_sent && c.user_profile?.email) {
              fu.notification_sent = true;
              fu.notification_sent_at = nowString;
              sendUserDueFollowupNotification({
                userEmail: c.user_profile.email,
                caseId: c.case_id,
                followupId: fu.id,
                compensationEstimate: c.latest_compensation_estimate
              }).catch(err => console.warn(`Could not dispatch notification email for case ${c.case_id}:`, err.message));
            }

            c.trace.unshift({
              id: "tr_sched_" + Math.random().toString(36).substring(2, 9),
              timestamp: nowString,
              event_type: "SCHEDULER",
              label: "Automated escalation check",
              tool_name: "scheduler",
              branch: c.branch,
              status: "success",
              summary: `Follow-up ${fu.id} executed: 7-day recommended wait elapsed without bank response. Nodal escalation draft prepared.`,
              source_ids: []
            });
          }
        }
      }
    }

    if (caseChanged) {
      c.updated_at = nowString;
      changed = true;
      updatedCases.push(c.case_id);
    }
  }

  if (changed) {
    saveDb(db);
  }

  return { executedCount, updatedCases };
}

export function startBackgroundScheduler(intervalMs = 60000) {
  if (schedulerInterval) return;
  console.log("Background grievance SLA scheduler started (real-time interval: " + intervalMs + "ms).");
  schedulerInterval = setInterval(() => {
    try {
      checkAndExecuteDueFollowups();
    } catch (err: any) {
      console.error("Error in background scheduler cycle:", err.message);
    }
  }, intervalMs);
}

export function stopBackgroundScheduler() {
  if (schedulerInterval) {
    clearInterval(schedulerInterval);
    schedulerInterval = null;
  }
}
