/**
 * Free-tier friendly providers.
 * - Brevo: ~300 emails/day free (best fit for ~2K over ~7 days)
 * - Resend: 100/day and 3,000/month free
 */

export function createProvider(name) {
  switch (name) {
    case "brevo":
      return brevoProvider();
    case "resend":
      return resendProvider();
    default:
      throw new Error(`Unknown PROVIDER "${name}". Use brevo or resend.`);
  }
}

function brevoProvider() {
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    throw new Error("Set BREVO_API_KEY in .env (Brevo → SMTP & API → API keys)");
  }

  return {
    name: "brevo",
    async send({ to, toName, fromEmail, fromName, subject, html, text }) {
      const body = {
        sender: { email: fromEmail, name: fromName },
        to: [{ email: to, ...(toName ? { name: toName } : {}) }],
        subject,
        htmlContent: html,
        textContent: text,
      };

      const res = await fetch("https://api.brevo.com/v3/smtp/email", {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || data.error || `Brevo HTTP ${res.status}`);
      }
      return { id: data.messageId || data.messageIds?.[0] || "ok" };
    },
  };
}

function resendProvider() {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Set RESEND_API_KEY in .env (Resend → API Keys)");
  }

  return {
    name: "resend",
    async send({ to, fromEmail, fromName, subject, html, text }) {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: [to],
          subject,
          html,
          text,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.message || `Resend HTTP ${res.status}`);
      }
      return { id: data.id || "ok" };
    },
  };
}
