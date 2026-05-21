# Legacy: Supabase dashboard email templates

**Prefer the in-repo flow:** see [AUTH-EMAILS.md](../AUTH-EMAILS.md). Templates live under `lib/emails/` and send automatically via `/api/auth/hooks/send-email`.

Use the HTML files in this folder **only if** you are **not** using the Send Email hook and still deliver mail through Supabase’s built-in SMTP + dashboard templates.
