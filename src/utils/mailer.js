import nodemailer from "nodemailer";

// One transporter per brand, keyed by env_prefix (AMBER -> AMBER_SMTP_HOST, AMBER_SMTP_PORT ...).
// A brand without its own block falls back to the plain SMTP_* block.
// SMTP passwords live only in the environment, never in the database.
const transporters = new Map();

const smtpConfig = (envPrefix) => {
  const read = (name) =>
    (envPrefix && process.env[`${envPrefix}_SMTP_${name}`]) || process.env[`SMTP_${name}`];

  const host = read("HOST");
  if (!host) return null;

  const port = Number(read("PORT")) || 587;
  return {
    host,
    port,
    secure: port === 465, // 465 = TLS from the start, 587 = STARTTLS
    auth: { user: read("USER"), pass: read("PASS") },
  };
};

const getTransporter = (envPrefix) => {
  const key = envPrefix || "DEFAULT";
  if (!transporters.has(key)) {
    const config = smtpConfig(envPrefix);
    if (!config) {
      throw new Error(`SMTP not configured for ${envPrefix ? `${envPrefix}_SMTP_*` : "SMTP_*"}`);
    }
    transporters.set(key, nodemailer.createTransport(config));
  }
  return transporters.get(key);
};

// all user text goes through this before it is put into HTML
export const escapeHtml = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const complaintLink = (complaintId) => {
  const base = (process.env.APP_URL || "").replace(/\/+$/, "");
  return base && complaintId ? `${base}/complaints/${complaintId}` : null;
};

// Mail for one notification row: the text is the notification message,
// plus an "Open complaint" link when APP_URL is set
export const complaintMail = ({ toName, title, message, complaintId, brandName }) => {
  const subject = title || (complaintId ? `Complaint #${complaintId} update` : "Complaint update");
  const link = complaintLink(complaintId);
  const greeting = toName ? `Hello ${toName},` : "Hello,";

  const text = [greeting, "", message, link ? `\nOpen complaint: ${link}` : "", "", brandName || ""]
    .join("\n")
    .trim();

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
    <h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(subject)}</h2>
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 20px;white-space:pre-line">${escapeHtml(message)}</p>
    ${
      link
        ? `<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#1f6feb;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px">Open complaint</a></p>`
        : ""
    }
    <p style="margin:0;color:#6b7280;font-size:12px">${escapeHtml(brandName || "")}</p>
  </div>
</body></html>`;

  return { subject, text, html };
};

// Sends one mail as the given brand. The from address always comes from the
// brand profile in the database, never from user input.
export const sendMail = async ({ envPrefix, fromName, fromEmail, replyTo, to, subject, text, html }) => {
  if (!fromEmail) throw new Error("no usable mail profile");

  return getTransporter(envPrefix).sendMail({
    from: fromName ? { name: fromName, address: fromEmail } : fromEmail,
    replyTo: replyTo || undefined,
    to,
    subject,
    text,
    html,
  });
};
