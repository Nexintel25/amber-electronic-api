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

const BRAND_COLOR = "#1f6feb";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,Helvetica,sans-serif";

// Shared frame for every mail: brand header, white card, footer.
// Tables + inline styles so it renders the same in Gmail, Outlook and phone clients.
// preheader = the grey preview line inboxes show next to the subject.
const mailLayout = ({ preheader, brandName, body }) => {
  const brand = escapeHtml(brandName || "");
  const year = new Date().getFullYear();

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${brand}</title>
</head>
<body style="margin:0;padding:0;background:#f1f3f6;font-family:${FONT};color:#1f2933;-webkit-text-size-adjust:100%">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader || "")}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1f3f6">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
        ${
          brand
            ? `<tr><td style="padding:0 4px 16px;font-size:18px;font-weight:700;color:${BRAND_COLOR};letter-spacing:.2px">${brand}</td></tr>`
            : ""
        }
        <tr><td style="background:#ffffff;border-radius:12px;border-top:4px solid ${BRAND_COLOR};box-shadow:0 1px 3px rgba(16,24,40,.08);padding:32px 28px;font-size:15px;line-height:1.6">
          ${body}
        </td></tr>
        <tr><td style="padding:20px 4px 0;font-size:12px;line-height:1.5;color:#8a94a3;text-align:center">
          This is an automated message, please do not reply to it.<br>
          ${brand ? `&copy; ${year} ${brand}` : ""}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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

  const body = `
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#8a94a3">Complaint update</p>
          <h1 style="margin:0 0 20px;font-size:20px;line-height:1.35;color:#111827">${escapeHtml(subject)}</h1>
          <p style="margin:0 0 16px">${escapeHtml(greeting)}</p>
          <div style="margin:0 0 24px;padding:16px 18px;background:#f7f9fc;border-left:3px solid ${BRAND_COLOR};border-radius:6px;white-space:pre-line;color:#374151">${escapeHtml(message)}</div>
          ${
            link
              ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px"><tr>
            <td style="border-radius:8px;background:${BRAND_COLOR}">
              <a href="${escapeHtml(link)}" style="display:inline-block;padding:12px 24px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:8px">View complaint</a>
            </td></tr></table>
          <p style="margin:0 0 24px;font-size:12px;color:#8a94a3;word-break:break-all">Or open this link: <a href="${escapeHtml(link)}" style="color:${BRAND_COLOR}">${escapeHtml(link)}</a></p>`
              : ""
          }
          <p style="margin:0;color:#4b5563">Thanks,<br><strong>${escapeHtml(brandName || "Support team")}</strong></p>`;

  const html = mailLayout({ preheader: message, brandName, body });

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

  const body = `
          <h1 style="margin:0 0 20px;font-size:20px;line-height:1.35;color:#111827">Verification code</h1>
          <p style="margin:0 0 8px">${escapeHtml(greeting)}</p>
          <p style="margin:0 0 20px">Use the code below to ${escapeHtml(purpose)}.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px"><tr>
            <td align="center" style="padding:20px;background:#f7f9fc;border:1px dashed #c9d3e0;border-radius:10px">
              <span style="font-family:'SFMono-Regular',Consolas,'Courier New',monospace;font-size:32px;font-weight:700;letter-spacing:10px;color:#111827">${escapeHtml(otp)}</span>
            </td></tr></table>
          <p style="margin:0 0 6px;font-size:13px;color:#4b5563">&#9201; Valid for <strong>${escapeHtml(minutes)} minutes</strong>, single use only.</p>
          <p style="margin:0 0 24px;font-size:13px;color:#4b5563">Never share this code with anyone. If you did not ask for it, ignore this mail; nothing will change.</p>
          <p style="margin:0;color:#4b5563">Thanks,<br><strong>${escapeHtml(brandName || "Support team")}</strong></p>`;

  const html = mailLayout({ preheader: `Your code is ${otp}. ${note}`, brandName, body });

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
