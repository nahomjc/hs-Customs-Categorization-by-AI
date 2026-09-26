export async function sendViaBrevo(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY?.trim();
  const fromEmail = process.env.BREVO_SENDER_EMAIL?.trim();
  const fromName =
    process.env.BREVO_SENDER_NAME?.trim() || "Impact Logistics";

  if (!apiKey || !fromEmail) {
    throw new Error(
      "BREVO_API_KEY and BREVO_SENDER_EMAIL must be set to send auth emails from the app"
    );
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: fromName, email: fromEmail },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    if (
      response.status === 400 &&
      /valid sender email required/i.test(detail)
    ) {
      throw new Error(
        `Brevo rejected sender "${fromEmail}". In Brevo → Senders & IP, add and verify this exact address (or use a domain-authenticated sender), then set BREVO_SENDER_EMAIL to match and redeploy.`
      );
    }
    throw new Error(`Brevo API error (${response.status}): ${detail}`);
  }
}
