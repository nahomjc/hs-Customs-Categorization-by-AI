# Fix "Tenant or user not found"

This error means the pooler rejected the connection. The **project reference ID** in the username must match exactly what Supabase expects.

## 1. Get the exact connection string from the dashboard

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and click your project.
2. Go to **Project Settings** (gear icon on left) → **Database**.
3. Scroll to **Connection string**.
4. Select **URI**.
5. You’ll see **Transaction** and **Session**. For **Session**, click the **Copy** button so you get the exact host and username Supabase uses.
6. The copied string will have `[YOUR-PASSWORD]`. Replace that (and only that) with your real database password.  
   If you’re unsure of the password: on the same page use **Reset database password**, set a new one, then use it in the string.
7. Paste the result into `.env` as `DATABASE_URL=...` (one line, no extra quotes or spaces).
8. If the copied string already ends with `?pgbouncer=true`, keep it. If not, you can add `?pgbouncer=true` at the end for Session mode.

## 2. Check project reference ID

- In **Project Settings** → **General**, find **Reference ID**. The connection string username must be `postgres.[REFERENCE-ID]` (same characters).
- If your dashboard shows a different ref than `dznvltvreyjgmkbtowef`, use the one from the dashboard in the connection string.

## 2. Put it in `.env`

```env
DATABASE_URL=postgresql://postgres.xxxxxxxx:YOUR_PASSWORD@aws-0-us-east-1.pooler.supabase.com:6543/postgres
```

- **No spaces** around `=`.
- If the password contains `@`, `#`, `%`, or other special characters, [URL-encode](https://developer.mozilla.org/en-US/docs/Glossary/Percent-encoding) them (e.g. `@` → `%40`).

## 3. Project paused (free tier)

If the project was inactive, Supabase may have **paused** it. In the dashboard, open the project and click **Restore project** if you see a pause message. Then try again.

## 4. Try Session mode if Transaction fails

In **Database** → **Connection string**, try the **Session** pooler (port `5432`) instead of Transaction:

```env
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:5432/postgres?pgbouncer=true
```

Then run `pnpm run db:introspect` (or your app) again.

---

## 5. "ENOTFOUND" with direct connection (`db.*.supabase.co`)

If you use the **direct** connection string and get `getaddrinfo ENOTFOUND db.xxxx.supabase.co`:

- Supabase’s direct database host is **IPv6-only** by default. Many networks (or Windows at home) don’t resolve or use IPv6, so the hostname lookup fails.
- **Fix:** Use the **pooler** connection string (Transaction or Session) instead of direct. The pooler host `aws-0-XX.pooler.supabase.com` works over IPv4.
- **Optional (paid):** On **Pro** plan you can enable the [IPv4 add-on](https://supabase.com/docs/guides/platform/ipv4-address) so the direct host works over IPv4.

---

## 6. Still "Tenant or user not found" with the pooler?

1. In **Project Settings** → **Database**, click **Copy** on the **Transaction** (port 6543) URI. Replace only `[YOUR-PASSWORD]` with your database password and set that as `DATABASE_URL`. Do not change anything else (no spaces, no extra quotes).
2. Confirm **Project Settings** → **General** → **Reference ID** matches the part after `postgres.` in the username.
3. If it still fails, contact [Supabase support](https://supabase.com/dashboard/support) or ask in [Supabase Discord](https://discord.supabase.com) with: “Tenant or user not found” when connecting via pooler with `postgres.[ref]` and correct password.
