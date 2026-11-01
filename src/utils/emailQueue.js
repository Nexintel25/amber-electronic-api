import { waitUntil } from "@vercel/functions";
import {
  claimPendingEmails,
  markNotificationsEmailed,
} from "../models/emailModel.js";
import { complaintMail, sendMail } from "./mailer.js";

const BATCH_SIZE = 20;
const MAX_BATCHES = 5;

// one run at a time per instance; a second call while one runs just joins it
let running = null;

// Sends one claimed batch and reports every row back, sent or failed
const sendBatch = async (rows) => {
  const outcomes = await Promise.all(
    rows.map(async (row) => {
      try {
        if (!row.toEmail) throw new Error("recipient has no email");

        const mail = complaintMail({
          toName: row.toName,
          title: [row.complaintNo, row.complaintTitle].filter(Boolean).join(": ") || null,
          message: row.message,
          complaintId: row.complaintId,
          brandName: row.fromName,
        });

        await sendMail({
          envPrefix: row.envPrefix,
          fromName: row.fromName,
          fromEmail: row.fromEmail,
          replyTo: row.replyTo,
          to: row.toName ? { name: row.toName, address: row.toEmail } : row.toEmail,
          ...mail,
        });

        return { id: row.notificationId, ok: true, error: null };
      } catch (err) {
        // only the reason is stored, never credentials
        return { id: row.notificationId, ok: false, error: String(err.message || err).slice(0, 200) };
      }
    })
  );

  const marked = await markNotificationsEmailed({ results: outcomes });
  if (marked.code !== 0) throw new Error(marked.message);
  return outcomes;
};

const run = async () => {
  const totals = { sent: 0, failed: 0 };

  for (let i = 0; i < MAX_BATCHES; i += 1) {
    const rows = await claimPendingEmails({ limit: BATCH_SIZE });
    if (rows.length === 0) break;

    const outcomes = await sendBatch(rows);
    for (const outcome of outcomes) {
      if (outcome.ok) totals.sent += 1;
      else totals.failed += 1;
    }

    if (rows.length < BATCH_SIZE) break;
  }

  return totals;
};

// Sends everything pending (up to MAX_BATCHES x BATCH_SIZE). Used by the cron endpoint.
export const dispatchEmails = () => {
  if (!running) {
    running = run().finally(() => {
      running = null;
    });
  }
  return running;
};

// Call after a complaint SP succeeded, never await it: a mail failure must not break the response.
// waitUntil keeps a Vercel function alive until the mails are out; elsewhere it just runs.
// The cron (/api/internal/send-emails) is the safety net for anything missed here.
export const kickEmails = () => {
  const job = dispatchEmails().catch((err) => console.error("kickEmails error:", err));
  try {
    waitUntil(job);
  } catch {
    // not on Vercel: the promise keeps running on its own
  }
};
