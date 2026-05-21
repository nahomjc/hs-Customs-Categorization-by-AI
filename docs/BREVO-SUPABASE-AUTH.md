# Brevo + Supabase Auth setup

Auth emails (signup confirmation, password reset, magic links) are sent by **Supabase Auth** using **Brevo SMTP**. Your Next.js app uses Supabase for login/signup; you do not send those emails from app code.

## 1. Brevo (SMTP)

1. Create a [Brevo](https://www.brevo.com/) account.
2. **Authenticate your domain** (Senders & IP → Domains).
3. Create a **transactional sender** (verified email on your domain).
4. Open **SMTP & API** → [SMTP settings](https://app.brevo.com/settings/keys/smtp).
5. Create an **SMTP key** (not the REST API key).

| Setting | Value |
|--------|--------|
| Host | `smtp-relay.brevo.com` |
| Port | `587` (TLS) or `465` (SSL) |
| Username | Your Brevo login email |
| Password | SMTP key |

Docs: [Brevo SMTP](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP), [SMTP integration](https://developers.brevo.com/docs/smtp-integration).

## 2. Supabase (custom SMTP)

1. Supabase Dashboard → **Project Settings** → **Authentication** → [SMTP Settings](https://supabase.com/dashboard/project/_/auth/smtp).
2. Enable **Custom SMTP**.
3. Enter Brevo host, port, username, password.
4. **Sender email**: your verified Brevo sender (e.g. `noreply@yourdomain.com`).
5. **Sender name**: e.g. `HS Portal`.

Reference: [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## 3. Supabase Auth URLs

**Authentication** → **URL Configuration**:

| Field | Example (local) | Example (production) |
|-------|-----------------|----------------------|
| Site URL | `http://localhost:3000` | `https://your-app.vercel.app` |
| Redirect URLs | `http://localhost:3000/auth/callback` | `https://your-app.vercel.app/auth/callback` |

Add:

- `http://localhost:3000/auth/callback`
- `http://localhost:3000/reset-password`
- Your production URLs with the same paths

## 4. Email confirmation (recommended)

**Authentication** → **Providers** → **Email**:

- Enable **Confirm email** so new users must click the link (sent via Brevo).
- Minimum password length: 8+.

## 5. App environment

In `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://...

# Used for email redirect links in production
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional: tenant for new users (default: default-tenant)
DEFAULT_TENANT_ID=default-tenant
```

## 6. Database: `public.users`

Run the SQL from the previous step (users table + optional trigger on `auth.users`) in the Supabase SQL editor so profiles sync when users sign up.

## 7. Test flow

1. Open `/signup` → create account.
2. Check inbox for confirmation email (from Brevo sender).
3. Click link → `/auth/callback` → dashboard.
4. **Forgot password** → `/forgot-password` → reset email → set password on `/reset-password`.

## App routes

| Route | Purpose |
|-------|---------|
| `/login` | Email + password sign in |
| `/signup` | Register + confirmation email |
| `/forgot-password` | Request reset link |
| `/reset-password` | Set new password after link |
| `/auth/callback` | Exchange code / verify OTP (do not remove) |

Dashboard routes require a signed-in user (middleware).
