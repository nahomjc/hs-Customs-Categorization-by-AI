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

1. Set env vars and **redeploy Vercel** (the hook route must exist in production).
2. Confirm the endpoint responds (should **not** be 404):
   `POST https://YOUR_APP/api/auth/hooks/send-email`
3. Sign up at `/signup`.
4. Inbox should show the branded Impact Logistics email from your Brevo sender.

## Confirmation link goes to `localhost` instead of your live site

The email link uses whatever was sent at signup in `emailRedirectTo`. If you signed up on `http://localhost:3000`, the link points there.

**Do this:**

1. **Vercel** → Environment Variables → set `NEXT_PUBLIC_APP_URL` to your live URL (e.g. `https://hs-customs-categorization-by-ai.vercel.app`), **not** `http://localhost:3000`. Redeploy.
2. **Supabase** → **Authentication** → **URL Configuration**:
   - **Site URL**: `https://hs-customs-categorization-by-ai.vercel.app`
   - **Redirect URLs**: add  
     `https://hs-customs-categorization-by-ai.vercel.app/auth/callback`  
     `https://hs-customs-categorization-by-ai.vercel.app/reset-password`
3. Sign up again from the **production** site (not local dev). Old emails still have the old link.

The Send Email hook rewrites `localhost` redirects to `NEXT_PUBLIC_APP_URL` / Vercel URL when the app runs in production.

Confirmation links go to **your app** (`/auth/callback?token_hash=...&type=email`), not `*.supabase.co/auth/v1/verify`. The hosted verify URL often returns 500 for PKCE signup tokens.

## Troubleshooting

### `unexpected_failure` — hook returned 404

Supabase enabled the Send Email hook, but your deployed app does not have the API route yet (or the hook URL is wrong).

**Fix A (use in-repo emails):**

1. Deploy latest code to Vercel.
2. Vercel → Project → **Settings** → **Environment Variables**: add `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_SENDER_NAME`, `SEND_EMAIL_HOOK_SECRET`.
3. Supabase → **Authentication** → **Hooks** → Send Email → URL must be exactly:
   `https://hs-customs-categorization-by-ai.vercel.app/api/auth/hooks/send-email`
   (no trailing slash)
4. Redeploy after env changes.

**Fix B (fastest — no hook):**

1. Supabase → **Authentication** → **Hooks** → **disable** Send Email hook.
2. Use **SMTP** (Brevo) + paste templates from `docs/supabase-email-templates/` under **Email Templates**.

Signup works again as soon as Supabase is not calling a missing URL.

## Legacy dashboard templates

The HTML files under `docs/supabase-email-templates/` are only needed if you **do not** use the Send Email hook and still send via Supabase SMTP + dashboard templates.
