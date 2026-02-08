import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Keep pool small to avoid "max clients reached" on Supabase Session mode (limited pool_size).
const client = postgres(connectionString, {
  max: 2,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });
