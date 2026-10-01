# RefundRakshak 🛡️💰
**"Get your money back, automatically."**

RefundRakshak is a multilingual, tool-using AI agent built for the **BharatAgentic Hackathon** powered by aiKart. It helps Indian users pursue eligible financial-service grievances—starting with UPI failed debit transactions where money was debited but the beneficiary was not credited and reversal was delayed.

---

### Key Features
- **Multilingual Support**: English, Hindi, and Tamil conversational capabilities.
- **Gemini Function Calling**: Dynamic tool selection for evidence extraction, grievance classification, rule lookup, TAT calculation, and escalation drafting.
- **Deterministic Rule Engine**: Powered by verified RBI Circulars (RBI/2019-20/67) and the RBI Integrated Ombudsman Scheme 2026.
- **Simulated Time Control ("Simulate +7 days")**: Live simulation testing of escalation timelines and scheduler triggering.
- **Explicit User Approval**: Mandatory approval before sending emails or official communications.
- **Simulated Outbox & Evidence Pack**: Exportable case summaries and structured complaint histories.

---

### Agent Workflow
1. **Intake & Evidence Extraction**: Extracts amount, date, UTR, and status from text or screenshots.
2. **Grievance Classification**: Routes into supported UPI failed debit, fraud safety branch, merchant refund branch, or missing evidence branch.
3. **Verified Rule Application**: Matches transaction facts against RBI Turn Around Time (TAT) T+1 rule.
4. **Compensation & Deadline Calculation**: Computes days delayed and potential compensation estimate.
5. **Escalation Planning**: Generates bank complaints, Nodal Officer escalations, and RBI Ombudsman drafts.

---

### Tool List
- `get_case_state`
- `extract_transaction_evidence`
- `classify_grievance`
- `lookup_verified_rule`
- `calculate_deadline_and_estimate`
- `validate_ombudsman_preconditions`
- `generate_bank_complaint`
- `generate_nodal_officer_escalation`
- `generate_rbi_ombudsman_draft`
- `generate_evidence_pack`
- `draft_email`
- `send_email_with_confirmation`
- `schedule_followup`
- `simulate_time`

---

### Local Setup & Running
1. Install dependencies:
   ```bash
   npm install
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   # Add your GEMINI_API_KEY
   ```
3. Run development server:
   ```bash
   npm run dev
   ```
4. Access app at `http://localhost:3000`.

---

### Docker Setup
```bash
docker build -t refundrakshak .
docker run --env-file .env -p 3000:3000 refundrakshak
curl http://localhost:3000/api/health
```

---

### Disclaimers & Safety
- **Potential compensation estimate, subject to verification.**
- This prototype is not legal advice and does not guarantee recovery.
- External submissions are simulated unless configured.
- Sensitive financial data (UPI PINs, passwords, OTPs) is never requested or stored.
