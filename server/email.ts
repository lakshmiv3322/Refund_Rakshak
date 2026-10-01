import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

export interface BankContact {
  bank_id: string;
  name: string;
  aliases: string[];
  grievance_email: string;
  nodal_officer_email: string;
  escalation_portal_url: string;
  source_url: string;
  verified_at: string;
}

let cachedBanks: BankContact[] = [];

export function loadBankContacts(): BankContact[] {
  if (cachedBanks.length > 0) return cachedBanks;
  try {
    const banksPath = path.join(process.cwd(), "data", "banks.json");
    if (fs.existsSync(banksPath)) {
      const data = JSON.parse(fs.readFileSync(banksPath, "utf-8"));
      cachedBanks = data.banks || [];
    }
  } catch (err) {
    console.error("Failed to load data/banks.json:", err);
  }
  return cachedBanks;
}

export function findBankContact(bankOrProviderName?: string | null): BankContact | null {
  if (!bankOrProviderName) return null;
  const banks = loadBankContacts();
  const query = bankOrProviderName.trim().toLowerCase();

  for (const b of banks) {
    if (b.name.toLowerCase() === query || b.aliases.some(a => a.toLowerCase() === query || query.includes(a.toLowerCase()))) {
      return b;
    }
  }
  return null;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  body: string;
  replyTo?: string;
}

export interface SendEmailResult {
  sent: boolean;
  provider: "smtp" | "resend" | "mailto_fallback";
  message_id?: string;
  delivered_at?: string;
  mailto_url?: string;
  copy_text?: string;
  error?: string;
}

export async function sendEmailOrFallback(params: SendEmailParams): Promise<SendEmailResult> {
  const { to, subject, body, replyTo } = params;

  // Check if Resend API is configured
  const resendApiKey = process.env.RESEND_API_KEY;
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || "RefundRakshak <disputes@refundrakshak.in>",
          to: [to],
          reply_to: replyTo,
          subject,
          text: body
        })
      });
      const data = await res.json();
      if (res.ok && data.id) {
        return {
          sent: true,
          provider: "resend",
          message_id: data.id,
          delivered_at: new Date().toISOString()
        };
      }
    } catch (err: any) {
      console.warn("Resend email delivery failed, checking SMTP:", err.message);
    }
  }

  // Check if SMTP is configured
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT ? Number(process.env.SMTP_PORT) : 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass }
      });

      const info = await transporter.sendMail({
        from: process.env.EMAIL_FROM || smtpUser,
        to,
        subject,
        text: body,
        replyTo
      });

      return {
        sent: true,
        provider: "smtp",
        message_id: info.messageId,
        delivered_at: new Date().toISOString()
      };
    } catch (err: any) {
      console.warn("SMTP email delivery failed, falling back to mailto:", err.message);
    }
  }

  // Fallback to mailto link & copy-to-clipboard
  const mailtoUrl = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  const copyText = `To: ${to}\nSubject: ${subject}\n\n${body}`;

  return {
    sent: false,
    provider: "mailto_fallback",
    mailto_url: mailtoUrl,
    copy_text: copyText
  };
}
