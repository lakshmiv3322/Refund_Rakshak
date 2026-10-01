import { loadDb, saveDb, type CaseState } from "./store.ts";
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

    // 1. Update latest compensation estimate and days delayed on the case using stored scenario_id
    if (c.transaction_facts.transaction_date && c.classification !== "unauthorized_or_fraud" && c.classification !== "missing_evidence") {
      try {
        const scenarioToUse = c.scenario_id || (c.branch === "upi_p2m_merchant_debit_failed" ? "upi_p2m_merchant_debit_failed" : "upi_p2p_debit_not_credited");
        const calc = calculateTATDeadlineAndCompensation(c.transaction_facts.transaction_date, nowString, scenarioToUse);
        if (c.latest_compensation_estimate !== calc.potential_compensation_estimate || c.latest_days_delayed !== calc.days_delayed) {
          c.latest_compensation_estimate = calc.potential_compensation_estimate;
          c.latest_days_delayed = calc.days_delayed;
          c.updated_at = nowString;
          caseChanged = true;
        }
      } catch (_) {}
    }

    // Calculate days elapsed from initial bank complaint
    const complaintDate = c.bank_complaint_date ? new Date(c.bank_complaint_date) : null;
    const daysSinceComplaint = complaintDate
      ? Math.ceil((now.getTime() - complaintDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // 2. Process pending follow-ups
    for (const fu of c.followups) {
      if (fu.status === "pending") {
        const dueDate = new Date(fu.due_date);
        if (dueDate <= now) {
          fu.status = "due";
          caseChanged = true;

          // 7-day nodal step: recommended wait period
          if (
            complaintDate &&
            !c.bank_response &&
            daysSinceComplaint >= 7 &&
            (fu.action_type === "prepare_nodal_escalation" || fu.condition === "bank_no_response_7_days")
          ) {
            fu.status = "executed";
            c.escalation_stage = "nodal_escalation_ready";
            executedCount++;

            // Idempotency: verify if nodal action already exists
            const existingNodalAction = c.pending_actions.find(a => a.type === "nodal_officer_escalation");
            if (!existingNodalAction) {
              const compText = c.latest_compensation_estimate && c.latest_compensation_estimate > 0
                ? `Potential compensation estimate, subject to verification: ₹${c.latest_compensation_estimate} (${c.latest_days_delayed} days delayed beyond TAT at ₹100/day).`
                : "Potential compensation estimate, subject to verification.";

              c.pending_actions.push({
                id: "act_nodal_" + Math.random().toString(36).substring(2, 9),
                type: "nodal_officer_escalation",
                status: "pending_approval",
                requires_approval: true,
                created_at: nowString,
                payload: {
                  subject: `ESCALATION: Unresolved Grievance - Ref ${c.bank_complaint_reference || c.transaction_facts.transaction_reference || "N/A"}`,
                  body: `Respected Principal Nodal Officer,\n\nMy initial bank complaint dated ${c.bank_complaint_date} (Bank Ref: ${c.bank_complaint_reference || "N/A"}, Tx Ref: ${c.transaction_facts.transaction_reference || "N/A"}) regarding failed debit of ₹${c.transaction_facts.amount || "N/A"} remains unresolved after ${daysSinceComplaint} days.\n\nNote: The 7-day wait period before nodal escalation is an industry-standard recommended wait period, not an RBI statutory clause. (Statutory Ombudsman escalation eligibility requires a 30-day wait under the RBI Integrated Ombudsman Scheme).\n\n${compText}\n\nKindly process immediate resolution and credit of statutory compensation.`
                },
                simulated: false,
                source_references: c.source_references
              });

              // Ensure 30-day Ombudsman check is registered
              const hasOmbudsmanFollowup = c.followups.some(f => f.action_type === "prepare_ombudsman_escalation");
              if (!hasOmbudsmanFollowup && complaintDate) {
                const ombudsmanDueDate = new Date(complaintDate.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
                c.followups.push({
                  id: "fu_omb_" + Math.random().toString(36).substring(2, 9),
                  due_date: ombudsmanDueDate,
                  condition: "bank_no_response_30_days",
                  action_type: "prepare_ombudsman_escalation",
                  status: "pending"
                });
              }
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

          // 30-day Ombudsman step: statutory eligibility under RBI Integrated Ombudsman Scheme
          // Block Ombudsman draft until bank complaint reference number exists (P1 Requirement 10)
          if (
            complaintDate &&
            daysSinceComplaint >= 30 &&
            (fu.action_type === "prepare_ombudsman_escalation" || fu.condition === "bank_no_response_30_days" || !c.bank_response)
          ) {
            fu.status = "executed";
            executedCount++;

            if (!c.bank_complaint_reference) {
              c.escalation_stage = "ombudsman_requires_bank_reference";
              const existingPrompt = c.pending_actions.find(a => a.type === "record_bank_complaint_reference");
              if (!existingPrompt) {
                c.pending_actions.push({
                  id: "act_ref_" + Math.random().toString(36).substring(2, 9),
                  type: "record_bank_complaint_reference",
                  status: "pending_input",
                  requires_approval: false,
                  created_at: nowString,
                  payload: {
                    note: "The 30-day statutory waiting period has elapsed. To prepare your official RBI Ombudsman filing on cms.rbi.org.in, your bank's original complaint acknowledgment number is required by RBI."
                  }
                });
              }
              c.trace.unshift({
                id: "tr_omb_block_" + Math.random().toString(36).substring(2, 9),
                timestamp: nowString,
                event_type: "SCHEDULER",
                label: "Ombudsman Blocked: Missing Bank Ref",
                tool_name: "scheduler",
                branch: c.branch,
                status: "warning",
                summary: `30 days elapsed, but Ombudsman filing is blocked pending bank complaint reference number.`,
                source_ids: []
              });
            } else {
              c.escalation_stage = "ombudsman_eligible";
              const existingOmbudsmanAction = c.pending_actions.find(a => a.type === "rbi_ombudsman_draft");
              if (!existingOmbudsmanAction) {
                const f = c.transaction_facts;
                c.pending_actions.push({
                  id: "act_omb_" + Math.random().toString(36).substring(2, 9),
                  type: "rbi_ombudsman_draft",
                  status: "pending_approval",
                  requires_approval: true,
                  created_at: nowString,
                  payload: {
                    portal_url: "https://cms.rbi.org.in",
                    subject: `RBI Ombudsman Grievance Submission Pack - Bank Ref ${c.bank_complaint_reference}`,
                    body: `=== RBI COMPLAINT MANAGEMENT SYSTEM (CMS) PACK ===\nRegulated Entity: ${f.bank_or_provider || "Bank"}\nBank Complaint Reference: ${c.bank_complaint_reference}\nTransaction Date: ${f.transaction_date}\nAmount: ₹${f.amount}\nTransaction Reference: ${f.transaction_reference || "N/A"}\nInitial Complaint Date: ${c.bank_complaint_date}\nDays Elapsed: ${daysSinceComplaint}\n\nRelief Claimed: Full reversal of ₹${f.amount} plus statutory delay compensation of ₹${c.latest_compensation_estimate || 0} under RBI Circular RBI/2019-20/67.\n\nNOTE: Submission happens on the official Reserve Bank of India CMS portal at https://cms.rbi.org.in. Source: RBI Integrated Ombudsman Scheme, last checked 2026-03-30.`
                  },
                  simulated: false,
                  source_references: c.source_references
                });
              }

              c.trace.unshift({
                id: "tr_omb_" + Math.random().toString(36).substring(2, 9),
                timestamp: nowString,
                event_type: "SCHEDULER",
                label: "RBI Ombudsman Preconditions Met",
                tool_name: "scheduler",
                branch: c.branch,
                status: "success",
                summary: `30-day statutory waiting period elapsed without resolution and bank reference ${c.bank_complaint_reference} verified. Prepared official RBI Ombudsman complaint package for cms.rbi.org.in.`,
                source_ids: []
              });
            }
          }
        }
      }
    }

    // Direct check for cases that reached 30 days without an explicit followup record
    if (complaintDate && daysSinceComplaint >= 30 && !c.bank_response && c.escalation_stage !== "ombudsman_eligible") {
      if (!c.bank_complaint_reference) {
        c.escalation_stage = "ombudsman_requires_bank_reference";
      } else {
        const existingOmb = c.pending_actions.find(a => a.type === "rbi_ombudsman_draft");
        if (!existingOmb) {
          c.escalation_stage = "ombudsman_eligible";
          const f = c.transaction_facts;
          c.pending_actions.push({
            id: "act_omb_" + Math.random().toString(36).substring(2, 9),
            type: "rbi_ombudsman_draft",
            status: "pending_approval",
            requires_approval: true,
            created_at: nowString,
            payload: {
              portal_url: "https://cms.rbi.org.in",
              subject: `RBI Ombudsman Grievance Submission Pack - Bank Ref ${c.bank_complaint_reference}`,
              body: `=== RBI COMPLAINT MANAGEMENT SYSTEM (CMS) PACK ===\nRegulated Entity: ${f.bank_or_provider || "Bank"}\nBank Complaint Reference: ${c.bank_complaint_reference}\nTransaction Date: ${f.transaction_date}\nAmount: ₹${f.amount}\nTransaction Reference: ${f.transaction_reference || "N/A"}\nInitial Complaint Date: ${c.bank_complaint_date}\nDays Elapsed: ${daysSinceComplaint}\n\nRelief Claimed: Full reversal of ₹${f.amount} plus statutory delay compensation of ₹${c.latest_compensation_estimate || 0} under RBI Circular RBI/2019-20/67.\n\nNOTE: Submission happens on the official Reserve Bank of India CMS portal at https://cms.rbi.org.in. Source: RBI Integrated Ombudsman Scheme, last checked 2026-03-30.`
            },
            simulated: false,
            source_references: c.source_references
          });
          caseChanged = true;
          executedCount++;
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
