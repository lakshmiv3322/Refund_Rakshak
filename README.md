# RefundRakshak 🛡️💰
**"Get your money back, automatically."**

RefundRakshak is a multilingual, tool-using AI agent built for the **BharatAgentic Hackathon** powered by aiKart. It now operates as a **two-sided product**:
1. **Consumer Side (Free Copilot)**: Multilingual intake chat, transaction evidence extraction, rule matching, and escalation draft preparation.
2. **Business Side (B2B Complaint-Ops Copilot)**: Bulk complaint triage for regulated entities (banks and payment apps), TAT breach detection, compensation exposure calculation, and exposure report CSV generation.

---

### Business Model & Monetization
- **Consumer Intake**: Free for retail users to democratize access to financial grievance redressal.
- **Regulated Entities (B2B SaaS / Copilot)**: Paid subscription model (per-seat or per-complaint volume pricing) for banks, fintechs, and payment gateway operators.
  - **Value Proposition**: Reduces SLA breaches, minimizes potential RBI compensation liability and Ombudsman escalation risks, and accelerates resolution workflows.

---

### Rule Verification Checklist
Before production deployment, confirm the following official rows and figures against statutory sources:
1. **UPI Failed Transaction (Debit without Credit)**:
   - Source: RBI Circular `RBI/2019-20/67` (DPSS.CO.PD No.629/02.01.014/2019-20).
   - Figure to confirm: T+1 automatic reversal deadline and ₹100 per day compensation rule.
2. **RBI Integrated Ombudsman Scheme**:
   - Source: Reserve Bank–Integrated Ombudsman Scheme, 2026 (`SCHEME16012026_A.pdf`).
   - Figure to confirm: 30-day waiting period from initial bank complaint before CMS portal escalation (`https://cms.rbi.org.in`).

---

### API Endpoints
- `POST /api/agent/run` — Consumer agent turn & tool call loop.
- `POST /api/b2b/triage-batch` — Bulk complaint triage and exposure calculation.
- `GET /api/b2b/exposure-report?format=json|csv` — Downloadable exposure reports.
- `POST /api/cases/{case_id}/simulate-time` — Advance simulated time by $N$ days.
- `GET /api/health` — Health check endpoint.

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
3. Run tests:
   ```bash
   npm test
   ```
4. Run development server:
   ```bash
   npm run dev
   ```

---

### Docker & Docker Compose
```bash
docker-compose up --build
curl http://localhost:8000/api/health
```

---

### Safety & Disclaimers
- **"Potential compensation estimate, subject to verification."**
- This prototype is not legal advice and does not guarantee recovery.
- Sensitive financial data (UPI PINs, passwords, OTPs) is never requested or stored.
