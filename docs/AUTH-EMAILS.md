# Auth emails (templates in this repo)

Signup and password-reset emails are **designed in the Next.js app** and sent when Supabase calls our **Send Email** hook. You do not paste HTML into the Supabase dashboard.

## Where templates live

| File | Purpose |
|------|---------|
| `lib/emails/layout.ts` | Shared card layout (IMPACT / Logistics branding) |
| `lib/emails/templates/confirm-signup.ts` | Signup confirmation |
| `lib/emails/templates/reset-password.ts` | Password reset |
| `lib/emails/templates/magic-link.ts` | Magic link sign-in |
| `lib/emails/handle-send-email-hook.ts` | Hook handler + Brevo send |
| `app/api/auth/hooks/send-email/route.ts` | HTTPS endpoint for Supabase |

Edit those files to change copy, colors, or layout. Deploy the app for changes to reach users.

## One-time Supabase setup

1. Deploy the app (or expose local dev with [ngrok](https://ngrok.com/) — Supabase must reach your URL over HTTPS).
2. Supabase Dashboard → **Authentication** → **Hooks** → **Send Email** → **Create hook**.
3. Type: **HTTPS**
4. URL: `https://YOUR_APP_URL/api/auth/hooks/send-email`
5. Click **Generate secret** and copy it to `.env` as `SEND_EMAIL_HOOK_SECRET` (include the full value, e.g. `v1,whsec_...`).
6. Save the hook. When the hook is **enabled**, Supabase stops using dashboard email templates and SMTP for auth mail; this app sends via Brevo API instead.

## Environment variables

```env
# Brevo transactional API (SMTP & API → create API key — not the SMTP password)
BREVO_API_KEY=xkeysib-...
BREVO_SENDER_EMAIL=noreply@yourdomain.com
BREVO_SENDER_NAME=Impact Logistics

# From Auth Hooks → Send Email → Generate secret
SEND_EMAIL_HOOK_SECRET=v1,whsec_...

NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

## Test

1. Set env vars and redeploy (or restart `npm run dev` with ngrok URL in the hook).
2. Sign up at `/signup`.
3. Inbox should show the branded Impact Logistics email from your Brevo sender.

## Legacy dashboard templates

The HTML files under `docs/supabase-email-templates/` are only needed if you **do not** use the Send Email hook and still send via Supabase SMTP + dashboard templates.
