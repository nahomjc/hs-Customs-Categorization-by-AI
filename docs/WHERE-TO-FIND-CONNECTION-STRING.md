# Where to Find Your Supabase Connection String

The connection string is **not** under Project Settings → Database in the way you might expect. Here’s where it is.

---

## Option 1: Connect button (recommended)

1. Go to **[Supabase Dashboard](https://supabase.com/dashboard)** and sign in.
2. **Click your project** (so you’re inside the project).
3. On the **main project page**, look at the **top** of the page for a **“Connect”** button or link.
4. Click **Connect**. A panel/section opens with connection options.
5. You’ll see choices like:
   - **Direct connection**
   - **Session** (pooler, port 5432)
   - **Transaction** (pooler, port 6543)
6. For **Transaction** (best for serverless/Node), copy the **URI** and replace `[YOUR-PASSWORD]` with your database password.

**Direct link** (opens Connect for your current project):  
[https://supabase.com/dashboard/project/dznvltvreyjgmkbtowef?showConnect=true](https://supabase.com/dashboard/project/dznvltvreyjgmkbtowef?showConnect=true)

Replace `dznvltvreyjgmkbtowef` with your project’s Reference ID if different.

---

## Option 2: Settings → Database

1. In the **left sidebar**, click the **gear icon** (⚙️) for **Project Settings**.
2. In the left menu under Project Settings, click **Database**.
3. Scroll down. You may see:
   - **Connection string** or **Connection info**, or
   - A **“Database password”** section and a link like **“Use connection pooling”** or **“Connection string”**.
4. If you see **Connection string**, open it and choose **URI** and **Transaction** (or Session), then copy and replace `[YOUR-PASSWORD]`.

**Note:** In some dashboard versions the connection string is only in the **Connect** panel (Option 1), not under Settings → Database.

---

## Option 3: From the browser address bar

When you’re in your project, the URL looks like:

`https://supabase.com/dashboard/project/dznvltvreyjgmkbtowef/...`

Add `?showConnect=true` to open the Connect panel:

`https://supabase.com/dashboard/project/dznvltvreyjgmkbtowef?showConnect=true`

Paste that in the address bar and press Enter.

---

## What to copy

- Choose **Transaction** (or **Session** if Transaction doesn’t work).
- Copy the **full URI** (starts with `postgres://` or `postgresql://`).
- Replace **only** `[YOUR-PASSWORD]` with your **database password** (from the same page or **Reset database password**).
- Put the result in `.env`:  
  `DATABASE_URL=paste_here`  
  (one line, no quotes, no spaces around `=`)
