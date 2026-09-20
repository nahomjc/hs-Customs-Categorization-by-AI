import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL!;

// Neon pooler: disable prepared statements; allow a longer connect for cold starts.
const client = postgres(connectionString, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 30,
  prepare: false,
});

export const db = drizzle(client, { schema });
