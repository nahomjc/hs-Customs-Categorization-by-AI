# Supabase support: "Tenant or user not found" + ENOTFOUND

Copy the text below and send it to Supabase (Dashboard → Support, or [discord.supabase.com](https://discord.supabase.com)).

---

**Subject:** Cannot connect to database: "Tenant or user not found" (pooler) and ENOTFOUND (direct)

**Message:**

I cannot connect to my Postgres database from my local machine (Node.js / Drizzle).

- **Project ref:** dznvltvreyjgmkbtowef  
- **Region:** us-east-1 (aws-0-us-east-1.pooler.supabase.com)

**What I tried:**

1. **Pooler (Transaction mode)**  
   URI: `postgres://postgres.dznvltvreyjgmkbtowef:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres`  
   Result: **"PostgresError: Tenant or user not found"** (FATAL, code XX000).  
   I reset my database password and used the new one; same error.

2. **Direct connection**  
   URI: `postgres://postgres:[PASSWORD]@db.dznvltvreyjgmkbtowef.supabase.co:5432/postgres` (and :6543)  
   Result: **"getaddrinfo ENOTFOUND db.dznvltvreyjgmkbtowef.supabase.co"** (host does not resolve).

So: pooler rejects the connection; direct host does not resolve (likely IPv6 and my network doesn’t support it).

Can you confirm:
- Is the pooler configured correctly for this project?
- Is there a different connection string or step I should use to connect from a local Node.js app (e.g. correct username format or pooler URL)?

Thank you.

---

**Where to send:**  
- Supabase Dashboard → your project → **Support** (help icon or Settings → Support), or  
- Discord: [https://discord.supabase.com](https://discord.supabase.com) → share in the appropriate channel.
