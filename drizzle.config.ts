import { config } from "dotenv";
import { resolve } from "path";
import { defineConfig } from "drizzle-kit";

// Ensure .env is loaded when running drizzle-kit CLI (it doesn't load it by default in some setups).
config({ path: resolve(process.cwd(), ".env") });

// Prefer direct URL when set and resolvable (db.*.supabase.co). Else use pooler.
// Use pooler URL exactly as in Supabase Dashboard (Session or Transaction mode).
const dbUrl = process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL;
if (!dbUrl) {
  throw new Error(
    "Set DATABASE_URL or DATABASE_URL_DIRECT in .env for drizzle-kit"
  );
}

export default defineConfig({
  schema: "./db/schema/index.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: dbUrl,
  },
});
