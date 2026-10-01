import { GoogleGenAI } from "@google/genai";
import type { CaseState } from "./store.ts";
import { toolDeclarations, executeToolCall, redactSecrets } from "./tools.ts";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  return new GoogleGenAI({
    apiKey: apiKey || undefined,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build"
      }
    }
  });
}

export interface RunAgentStep {
  type: "plan" | "tool_execution" | "token" | "completion";
  plan?: string[];
  tool?: string;
  args?: any;
  result?: any;
  status?: string;
  summary?: string;
  timestamp?: string;
}

export interface RunAgentOptions {
  onPlan?: (plan: string[]) => void;
  onStep?: (step: RunAgentStep) => void;
  onToken?: (token: string) => void;
}

export async function runAgent(
  caseState: CaseState,
  userMessage: string,
  imageBase64?: string,
  imageMime?: string,
  options?: RunAgentOptions
): Promise<{
  message: string;
  status: string;
  pending_question?: string;
  approval_request?: any;
  plan?: string[];
  steps?: RunAgentStep[];
}> {
  const primaryModel = process.env.GEMINI_MODEL || "gemini-3.8-flash";
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || "gemini-3.1-flash-lite";

  // Formulate agent plan before execution (Phase 3, Item 9)
  const isImageAttached = Boolean(imageBase64);
  const plan: string[] = isImageAttached
    ? [
        "1. Extract evidence: Run Gemini Vision OCR with structured schema to parse amount, date, UTR, and bank",
        "2. Classify grievance: Analyze dialogue for fraud / unauthorized safety boundaries",
        "3. Match verified rule: Lookup RBI Circular RBI/2019-20/67 scenario table",
        "4. Calculate statutory TAT: Evaluate T+1 / T+5 reversal deadline and ₹100/day compensation",
        "5. Formulate redressal action: Draft official bank or nodal officer communication for user authorization",
        "6. Autonomous SLA monitoring: Schedule follow-up checks against statutory time limits"
      ]
    : [
        "1. Validate evidence: Check transaction amount, IST date, UTR reference, and bank provider",
        "2. Classify grievance: Perform structured safety evaluation (fraud vs legitimate failed debit)",
        "3. Match verified rule: Verify applicability under RBI Circular RBI/2019-20/67",
        "4. Calculate statutory timeline: Determine reversal deadline and compute potential ₹100/day compensation",
        "5. Prepare grievance draft: Generate structured dispute submission requiring explicit human approval",
        "6. Schedule autonomous follow-up: Register periodic SLA checks for bank responsiveness"
      ];

  (caseState as any).active_plan = plan;
  if (!Array.isArray((caseState as any).agent_steps)) {
    (caseState as any).agent_steps = [];
  }

  const initialPlanStep: RunAgentStep = {
    type: "plan",
    plan,
    summary: `Formulated 6-stage grievance resolution plan (${isImageAttached ? "Vision OCR Mode" : "Text Query Mode"})`,
    timestamp: new Date().toISOString()
  };

  (caseState as any).agent_steps.push(initialPlanStep);
  if (options?.onPlan) options.onPlan(plan);
  if (options?.onStep) options.onStep(initialPlanStep);

  // Redact secrets BEFORE storing or sending to the model
  const { redactedText, foundSecrets, secretTypes } = redactSecrets(userMessage);
  let userWarningPrefix = "";
  if (foundSecrets) {
    caseState.safety_flags.push(`secret_redacted:${secretTypes.join(",")}`);
    userWarningPrefix = `⚠️ Security Notice: We detected and automatically redacted sensitive information (${secretTypes.join(", ")}). Never share your UPI PIN, OTP, password, or CVV with anyone.\n\n`;
  }

  // Store redacted text in chat history
  caseState.chat_history.push({
    role: "user",
    text: redactedText,
    timestamp: new Date().toISOString()
  });

  // Keep last 20 turns of chat history
  if (caseState.chat_history.length > 20) {
    caseState.chat_history = caseState.chat_history.slice(-20);
  }

  // Compact case snapshot JSON for system instruction
  const caseSnapshot = {
    case_id: caseState.case_id,
    transaction_facts: caseState.transaction_facts,
    missing_fields: caseState.missing_fields,
    classification: caseState.classification,
    escalation_stage: caseState.escalation_stage,
    simulated_now: caseState.simulated_now,
    followups: caseState.followups,
    pending_actions: caseState.pending_actions
  };

  const systemInstruction = `You are RefundRakshak, a cautious, production-grade financial-grievance copilot for Indian payment users (UPI, IMPS, Cards).
Reply in the SAME language as the user's latest message (English, Hindi, Tamil, Telugu, Marathi, etc.); keep statutory rule IDs, rupee amounts, and references unchanged.
Always respond directly to the user's actual message: restate the specific facts they gave (amount, date, bank, reference), state what you did, and state what is needed next. Never paste generic boilerplate.
Use tools; never guess. Classify from the whole conversation context by meaning.
Ask ONE clear message listing all missing fields (amount, transaction date, transaction reference, bank or provider, whether receiver was credited) and stop.
Convert relative dates (e.g. '9 days ago', 'yesterday') into YYYY-MM-DD using simulated_now from the snapshot before calling update_case_facts.
Only the verified rule engine may produce TAT, reversal deadline or compensation figures; never compute or state them yourself.
Genuine unauthorized/compromise claims -> safety branch (report to 1930 / cybercrime.gov.in), no compensation. Merchant order refunds -> merchant branch. ATM/card -> out of scope with evidence checklist. Vague messages -> ask a clarifying question.
Never ask for or accept UPI PIN, OTP, CVV, passwords or full card numbers.
You cannot send anything directly: you only draft; the user must explicitly inspect and approve. Label all actions clearly.
Always include the phrase 'Potential compensation estimate, subject to verification.' (also translated if communicating in regional language) whenever presenting an estimate.
You are not a lawyer and cannot guarantee refunds.

CURRENT CASE SNAPSHOT:
${JSON.stringify(caseSnapshot, null, 2)}`;

  const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
  if (!apiKey) {
    return {
      message: "RefundRakshak agent is unavailable: GEMINI_API_KEY is not configured.",
      status: "agent_unavailable"
    };
  }
  const ai = getGenAI();

  // Format chat contents for Gemini
  const contents: any[] = caseState.chat_history.map(turn => ({
    role: turn.role === "user" ? "user" : "model",
    parts: [{ text: turn.text }]
  }));

  if (imageBase64 && imageMime) {
    contents.push({
      role: "user",
      parts: [
        { text: "[Attached Transaction Screenshot Evidence]" },
        { inlineData: { data: imageBase64, mimeType: imageMime } }
      ]
    });
  }

  let modelToUse = primaryModel;
  let response: any = null;

  // Retry loop with exponential backoff on 429/5xx and fallback model
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 25000);

    try {
      response = await ai.models.generateContent({
        model: modelToUse,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
          temperature: 0.2,
          abortSignal: abortController.signal
        }
      });
      clearTimeout(timeoutId);
      break;
    } catch (err: any) {
      clearTimeout(timeoutId);
      const isRateOrServer =
        err.name === "AbortError" ||
        (err.message && (err.message.includes("429") || err.message.includes("503") || err.message.includes("500") || err.message.includes("RESOURCE_EXHAUSTED")));

      console.warn(`Gemini call error on ${modelToUse} (attempt ${attempt}/${maxAttempts}):`, err.message);

      if (attempt < maxAttempts) {
        const backoffMs = attempt === 1 ? 2000 : 5000;
        await new Promise(r => setTimeout(r, backoffMs));
        modelToUse = fallbackModel;
      } else {
        caseState.trace.unshift({
          id: "tr_err_" + Math.random().toString(36).substring(2, 9),
          timestamp: new Date().toISOString(),
          event_type: "ERROR",
          label: "Agent invocation failed after retries",
          tool_name: "runAgent",
          branch: caseState.branch,
          status: "error",
          summary: err.message || "Network / quota error",
          source_ids: []
        });
        return {
          message: "The grievance agent is temporarily unavailable due to upstream connectivity or quota limits. Please try again shortly.",
          status: "agent_unavailable"
        };
      }
    }
  }

  // Multi-turn Function Calling Loop (Max 8 iterations)
  // Execute ALL function calls returned in response.functionCalls, in order
  let iterations = 0;
  let finalStatus = "completed";
  let pendingQuestion: string | undefined;
  let approvalRequest: any;

  while (response && response.functionCalls && response.functionCalls.length > 0 && iterations < 8) {
    iterations++;
    const functionCalls = response.functionCalls;

    // Add model turn containing function calls (preserving thought_signatures from candidates)
    if (response.candidates?.[0]?.content) {
      contents.push(response.candidates[0].content);
    } else {
      contents.push({
        role: "model",
        parts: functionCalls.map((fc: any) => ({ functionCall: fc }))
      });
    }

    const responseParts: any[] = [];
    let shouldStop = false;

    for (const fc of functionCalls) {
      const toolName = fc.name;
      const toolArgs = fc.args || {};

      let execRes: any;
      try {
        execRes = await executeToolCall(toolName, toolArgs, caseState, { imageBase64, imageMime });
      } catch (toolErr: any) {
        execRes = { result: { error: toolErr.message } };
      }

      let stepSummary = "";
      if (toolName === "extract_transaction_evidence") {
        stepSummary = execRes.result?.merged_fields?.join(", ") || "Extracted structured facts from screenshot";
      } else if (toolName === "update_case_facts") {
        stepSummary = `Updated facts: Amount ₹${caseState.transaction_facts.amount || "N/A"}, Date ${caseState.transaction_facts.transaction_date || "N/A"}`;
      } else if (toolName === "record_classification") {
        stepSummary = `Classified as ${execRes.result?.classification} (${execRes.result?.branch})`;
      } else if (toolName === "lookup_verified_rule") {
        stepSummary = `Matched ${execRes.result?.rule_id || "RBI Circular RBI/2019-20/67"}`;
      } else if (toolName === "calculate_deadline_and_estimate") {
        stepSummary = `Calculated TAT: ${execRes.result?.deadline_date || "T+1"} (Delayed: ${execRes.result?.days_delayed} days, ₹${execRes.result?.potential_compensation_estimate})`;
      } else if (toolName === "verify_bank_contact") {
        stepSummary = `Verified contact for ${toolArgs.bank_name || "bank"} with Google Search`;
      } else if (toolName === "generate_bank_complaint") {
        stepSummary = `Drafted formal complaint to ${execRes.result?.payload?.bank_name || "Bank"}`;
      } else if (toolName === "generate_nodal_escalation") {
        stepSummary = `Drafted Principal Nodal Officer escalation notice`;
      } else if (toolName === "generate_ombudsman_draft") {
        stepSummary = `Prepared RBI Ombudsman complaint submission pack`;
      } else {
        stepSummary = execRes.result?.summary || `Executed ${toolName}`;
      }

      const toolStep: RunAgentStep = {
        type: "tool_execution",
        tool: toolName,
        args: toolArgs,
        result: execRes.result,
        status: execRes.status || "success",
        summary: stepSummary,
        timestamp: new Date().toISOString()
      };

      (caseState as any).agent_steps.push(toolStep);
      if (options?.onStep) {
        options.onStep(toolStep);
      }

      responseParts.push({
        functionResponse: {
          name: toolName,
          response: execRes.result
        }
      });

      if (execRes.stop) {
        shouldStop = true;
        finalStatus = execRes.status || "completed";
        if (execRes.result?.confirmation_prompt) {
          pendingQuestion = execRes.result.confirmation_prompt;
        } else if (execRes.result?.question) {
          pendingQuestion = execRes.result.question;
        }
        if (caseState.pending_actions.length > 0) {
          approvalRequest = caseState.pending_actions[caseState.pending_actions.length - 1];
        }
      }
    }

    contents.push({
      role: "user",
      parts: responseParts
    });

    if (shouldStop) {
      break;
    }

    // Call model again with the function responses
    try {
      const abortController = new AbortController();
      const timeoutId = setTimeout(() => abortController.abort(), 25000);

      response = await ai.models.generateContent({
        model: modelToUse,
        contents,
        config: {
          systemInstruction,
          tools: [{ functionDeclarations: toolDeclarations }],
          temperature: 0.2,
          abortSignal: abortController.signal
        }
      });
      clearTimeout(timeoutId);
    } catch (e: any) {
      console.warn("Follow-up function response generation failed:", e.message);
      break;
    }
  }

  const rawText = response?.text || (pendingQuestion ? pendingQuestion : "I have processed your grievance using verified RBI rules.");
  const { redactedText: cleanModelText } = redactSecrets(rawText);
  const finalMessage = userWarningPrefix + cleanModelText;

  if (options?.onToken) {
    options.onToken(finalMessage);
  }

  caseState.chat_history.push({
    role: "model",
    text: finalMessage,
    timestamp: new Date().toISOString()
  });

  return {
    message: finalMessage,
    status: finalStatus,
    pending_question: pendingQuestion,
    approval_request: approvalRequest,
    plan,
    steps: (caseState as any).agent_steps
  };
}
