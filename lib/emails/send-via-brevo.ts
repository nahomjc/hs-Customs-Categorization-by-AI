export async function sendViaBrevo(params: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = process.env.BREVO_SENDER_EMAIL;
  const fromName = process.env.BREVO_SENDER_NAME ?? "Impact Logistics";

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
    throw new Error(`Brevo API error (${response.status}): ${detail}`);
  }
}
