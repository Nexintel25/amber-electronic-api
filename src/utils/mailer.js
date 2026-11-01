import nodemailer from "nodemailer";

// Every mail (complaint, OTP) goes out from ONE sender, read only from the environment:
// SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS + MAIL_FROM_NAME / MAIL_FROM_EMAIL / MAIL_REPLY_TO.
// The brand columns of mail_profiles are not used for sending.
let transporter = null;

const sender = () => {
  const fromEmail = process.env.MAIL_FROM_EMAIL || process.env.SMTP_USER;
  if (!process.env.SMTP_HOST || !fromEmail) {
    throw new Error("SMTP / MAIL_FROM_EMAIL is not configured");
  }
  return {
    fromName: process.env.MAIL_FROM_NAME || "",
    fromEmail,
    replyTo: process.env.MAIL_REPLY_TO || undefined,
  };
};

const getTransporter = () => {
  if (!transporter) {
    const port = Number(process.env.SMTP_PORT) || 587;
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465, // 465 = SSL from the start, any other port = STARTTLS
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
};

// name shown at the bottom of every mail
export const mailBrandName = () => process.env.MAIL_FROM_NAME || "";

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

// OTP mail (profile edit). The OTP is only ever put into the mail, never logged.
export const otpMail = ({ toName, otp, minutes, purpose, brandName }) => {
  const subject = `${otp} is your OTP to ${purpose}`;
  const greeting = toName ? `Hello ${toName},` : "Hello,";
  const note = `This OTP is valid for ${minutes} minutes and can be used once. If you did not ask for it, ignore this mail; nothing will change.`;

  const text = [greeting, "", `Your OTP to ${purpose} is ${otp}`, "", note, "", brandName || ""]
    .join("\n")
    .trim();

  const html = `<!doctype html>
<html><body style="margin:0;padding:24px;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;color:#1f2933">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:8px;padding:24px">
    <p style="margin:0 0 12px">${escapeHtml(greeting)}</p>
    <p style="margin:0 0 12px">Your OTP to ${escapeHtml(purpose)} is</p>
    <p style="margin:0 0 20px;font-size:28px;font-weight:bold;letter-spacing:6px">${escapeHtml(otp)}</p>
    <p style="margin:0 0 20px;color:#4b5563;font-size:13px">${escapeHtml(note)}</p>
    <p style="margin:0;color:#6b7280;font-size:12px">${escapeHtml(brandName || "")}</p>
  </div>
</body></html>`;

  return { subject, text, html };
};

// Sends one mail from the env sender. The from address never comes from user input or the database.
export const sendMail = async ({ to, subject, text, html }) => {
  const { fromName, fromEmail, replyTo } = sender();

  return getTransporter().sendMail({
    from: fromName ? { name: fromName, address: fromEmail } : fromEmail,
    replyTo,
    to,
    subject,
    text,
    html,
  });
};
