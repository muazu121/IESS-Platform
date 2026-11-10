const nodemailer = require("nodemailer");

const DEFAULT_FIREBASE_API_KEY = "AIzaSyBjAtSFOpuMvbd9CyZQ_5MB8d1GTYqMkn4";
const DEFAULT_SENDER = "integratedpower.iess@gmail.com";
const WHATSAPP_INVITE =
  "https://chat.whatsapp.com/G0TCd8e0GkaFjOIWm6PYzJ?s=cl&p=i&mlu=4&ilr=4&iam=2";

function json(response, status, payload) {
  response.status(status).setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "private, no-store, max-age=0");
  response.send(JSON.stringify(payload));
}

function escapeHtml(value) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function approvalEmail({ firstName, applicationId }) {
  const safeName = escapeHtml(firstName || "Participant");
  const safeApplicationId = escapeHtml(applicationId);
  const safeInvite = escapeHtml(WHATSAPP_INVITE);
  const subject = "Congratulations — Your IESS Solar Training Application Is Approved";
  const text = [
    `Dear ${firstName || "Participant"},`,
    "",
    `Congratulations! Your application (${applicationId}) for the IESS Practical Solar Training Programme has been approved.`,
    "",
    "Training details:",
    "• Dates: 12–14 November 2026",
    "• Time: 8:00 PM – 9:30 PM West Africa Time (Nigeria)",
    "• Each session: 1 hour of training, 20 minutes of questions and answers, and 10 minutes for the quiz",
    "",
    "Please join the official IESS training WhatsApp group now for joining links, reminders and further communication:",
    WHATSAPP_INVITE,
    "",
    "You can access your participant dashboard and post-session quizzes at:",
    "https://iess-platform.vercel.app/portal",
    "",
    "We look forward to welcoming you to the training.",
    "",
    "Kind regards,",
    "IESS Training Team",
    "Integrated Energy & Smart Systems Ltd",
  ].join("\n");

  const html = `
    <div style="margin:0;padding:24px;background:#f4f7f5;font-family:Arial,'Segoe UI',sans-serif;color:#102536;">
      <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #d4e4d8;border-radius:14px;overflow:hidden;">
        <div style="background:#0c1e0f;padding:26px 30px;border-bottom:4px solid #c87d2a;">
          <div style="font-size:13px;letter-spacing:2px;color:#d4a93c;font-weight:700;">INTEGRATED ENERGY &amp; SMART SYSTEMS</div>
          <h1 style="margin:10px 0 0;font-size:28px;line-height:1.25;color:#ffffff;">Your IESS training application is approved</h1>
        </div>
        <div style="padding:30px;">
          <p style="margin-top:0;font-size:16px;">Dear ${safeName},</p>
          <p style="font-size:16px;line-height:1.65;">Congratulations! Your application <strong>${safeApplicationId}</strong> for the IESS Practical Solar Training Programme has been approved.</p>

          <div style="margin:24px 0;padding:20px;background:#f2f8f4;border-left:4px solid #1a5c2a;border-radius:8px;">
            <div style="font-size:12px;letter-spacing:1.5px;color:#1a5c2a;font-weight:800;margin-bottom:12px;">TRAINING DETAILS</div>
            <p style="margin:0 0 10px;font-size:15px;"><strong>Dates:</strong> 12–14 November 2026</p>
            <p style="margin:0 0 10px;font-size:15px;"><strong>Time:</strong> 8:00 PM – 9:30 PM West Africa Time (Nigeria)</p>
            <p style="margin:0;font-size:15px;line-height:1.6;"><strong>Each session:</strong> 1 hour of training, 20 minutes of questions and answers, and 10 minutes for the quiz</p>
          </div>

          <p style="font-size:16px;line-height:1.65;"><strong>Important:</strong> Join the official IESS training WhatsApp group now for joining links, reminders and further communication.</p>
          <p style="margin:24px 0;">
            <a href="${safeInvite}" style="display:inline-block;padding:14px 22px;background:#25d366;color:#082b14;text-decoration:none;border-radius:8px;font-size:15px;font-weight:800;">Join the IESS Training WhatsApp Group</a>
          </p>
          <p style="font-size:13px;line-height:1.6;color:#526778;word-break:break-all;">If the button does not open, use this link:<br><a href="${safeInvite}" style="color:#1a5c2a;">${safeInvite}</a></p>

          <p style="font-size:16px;line-height:1.65;">Your participant dashboard and post-session quizzes are available here:<br><a href="https://iess-platform.vercel.app/portal" style="color:#1a5c2a;font-weight:700;">https://iess-platform.vercel.app/portal</a></p>

          <p style="font-size:16px;line-height:1.65;margin-bottom:0;">We look forward to welcoming you to the training.</p>
          <p style="font-size:15px;line-height:1.65;margin-top:26px;">Kind regards,<br><strong>IESS Training Team</strong><br>Integrated Energy &amp; Smart Systems Ltd</p>
        </div>
      </div>
    </div>`;

  return { subject, text, html };
}

async function verifyApprovedStaff(request) {
  const authorization = String(request.headers.authorization || "");
  const token = authorization.startsWith("Bearer ") ? authorization.slice(7).trim() : "";
  if (!token) {
    const error = new Error("Missing staff authentication token.");
    error.statusCode = 401;
    throw error;
  }

  const apiKey = process.env.FIREBASE_WEB_API_KEY || DEFAULT_FIREBASE_API_KEY;
  const lookup = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    }
  );
  const lookupData = await lookup.json().catch(() => ({}));
  if (!lookup.ok || !lookupData.users?.length) {
    const error = new Error("Staff authentication could not be verified.");
    error.statusCode = 401;
    throw error;
  }

  const email = String(lookupData.users[0].email || "").toLowerCase();
  const configured = String(process.env.IESS_APPROVAL_EMAIL_STAFF || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  const allowed = configured.length
    ? configured
    : ["muazuogirima@gmail.com", "shaibusumaiya162@gmail.com"];

  if (!allowed.includes(email)) {
    const error = new Error("This staff account is not authorised to send approval emails.");
    error.statusCode = 403;
    throw error;
  }
  return { email };
}

module.exports = async function handler(request, response) {
  if (request.method === "GET") {
    json(response, 200, {
      ok: true,
      provider: "smtp",
      configured: Boolean(process.env.IESS_SMTP_PASS || process.env.GMAIL_APP_PASSWORD),
      sender: process.env.IESS_EMAIL_FROM || DEFAULT_SENDER,
    });
    return;
  }

  if (request.method !== "POST") {
    response.setHeader("Allow", "GET, POST");
    json(response, 405, { ok: false, error: "Method not allowed." });
    return;
  }

  try {
    await verifyApprovedStaff(request);

    const body = typeof request.body === "string" ? JSON.parse(request.body) : request.body || {};
    const recipient = String(body.recipient || "").trim().toLowerCase();
    const applicationId = String(body.applicationId || "").trim();
    const firstName = String(body.firstName || "Participant").trim().slice(0, 80);

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      json(response, 400, { ok: false, error: "A valid participant email is required." });
      return;
    }
    if (!/^[A-Za-z0-9_-]{4,80}$/.test(applicationId)) {
      json(response, 400, { ok: false, error: "A valid application ID is required." });
      return;
    }

    const smtpUser = process.env.IESS_SMTP_USER || DEFAULT_SENDER;
    const smtpPass = process.env.IESS_SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
    if (!smtpPass) {
      json(response, 503, {
        ok: false,
        configured: false,
        error:
          "Automatic email is not configured. Add IESS_SMTP_PASS (Gmail app password) to the Vercel project environment variables.",
      });
      return;
    }

    const port = Number(process.env.IESS_SMTP_PORT || 465);
    const transport = nodemailer.createTransport({
      host: process.env.IESS_SMTP_HOST || "smtp.gmail.com",
      port,
      secure: String(process.env.IESS_SMTP_SECURE || port === 465) !== "false",
      auth: { user: smtpUser, pass: smtpPass },
    });

    const email = approvalEmail({ firstName, applicationId });
    const from = process.env.IESS_EMAIL_FROM || smtpUser;
    const info = await transport.sendMail({
      from,
      to: recipient,
      replyTo: process.env.IESS_REPLY_TO || smtpUser,
      subject: email.subject,
      text: email.text,
      html: email.html,
    });

    json(response, 200, {
      ok: true,
      sent: true,
      messageId: info.messageId || "",
      recipient,
      applicationId,
    });
  } catch (error) {
    json(response, error.statusCode || 500, {
      ok: false,
      error: error instanceof Error ? error.message : "Approval email could not be sent.",
    });
  }
};
