import { loadDb, saveDb, CaseState } from "./store.ts";
import { runAgent } from "./agent.ts";
import { calculateTATDeadlineAndCompensation } from "./rules-engine.ts";

let schedulerInterval: NodeJS.Timeout | null = null;

export function checkAndExecuteDueFollowups(nowIso?: string) {
  const db = loadDb();
  const now = new Date(nowIso || new Date().toISOString());
  let changed = false;

  for (const c of Object.values(db.cases)) {
    for (const fu of c.followups) {
      if (fu.status === "pending") {
        const dueDate = new Date(fu.due_date);
        if (dueDate <= now) {
          fu.status = "due";
          changed = true;

          const complaintDate = c.bank_complaint_date ? new Date(c.bank_complaint_date) : null;
          const daysSinceComplaint = complaintDate ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

          // Escalate only if bank complaint date exists, no bank response, and days since complaint >= 7
          if (complaintDate && !c.bank_response && daysSinceComplaint >= 7) {
            fu.status = "executed";
            c.escalation_stage = "nodal_escalation_ready";
            // Check if nodal action already exists to ensure idempotency
            const hasNodalAction = c.pending_actions.some(a => a.type === "nodal_officer_escalation");
            if (!hasNodalAction) {
              c.pending_actions.push({
                id: "act_nodal_" + Math.random().toString(36).substring(2, 9),
                type: "nodal_officer_escalation",
                status: "pending_approval",
                requires_approval: true,
                created_at: now.toISOString(),
                payload: {
                  subject: `ESCALATION: Unresolved Failed UPI Debit - Ref ${c.transaction_facts.transaction_reference}`,
                  body: `To Nodal Officer,\n\nInitial bank complaint dated ${c.bank_complaint_date} (Ref: ${c.transaction_facts.transaction_reference}) regarding UPI payment failure of ₹${c.transaction_facts.amount} remains unresolved after 7+ days.\n\nPotential compensation estimate, subject to verification.`
                },
                simulated: false,
                source_references: c.source_references
              });
            }

            c.trace.unshift({
              id: "tr_sched_" + Math.random().toString(36).substring(2, 9),
              timestamp: now.toISOString(),
              event_type: "SCHEDULER",
              label: "Automated escalation trigger",
              tool_name: "scheduler",
              branch: c.branch,
              status: "success",
              summary: `Follow-up ${fu.id} triggered. Nodal escalation draft prepared after ${daysSinceComplaint} days without bank response.`,
              source_ids: []
            });
          } else {
            c.trace.unshift({
              id: "tr_sched_wait_" + Math.random().toString(36).substring(2, 9),
              timestamp: now.toISOString(),
              event_type: "SCHEDULER",
              label: "Follow-up checked",
              tool_name: "scheduler",
              branch: c.branch,
              status: "info",
              summary: `Follow-up ${fu.id} reached due date, waiting for 7-day bank response window (${daysSinceComplaint} days elapsed).`,
              source_ids: []
            });
          }
        }
      }
    }

    // Auto-update compensation estimates for open cases
    if (c.transaction_facts.transaction_date && c.classification === "supported_upi_failed_debited_not_credited") {
      try {
        const calc = calculateTATDeadlineAndCompensation(c.transaction_facts.transaction_date, now.toISOString());
        c.updated_at = now.toISOString();
      } catch (_) {}
    }
  }

  if (changed) {
    saveDb(db);
  }
}

export function startBackgroundScheduler(intervalMs = 60000) {
  if (schedulerInterval) return;
  console.log("Background grievance SLA scheduler started.");
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
