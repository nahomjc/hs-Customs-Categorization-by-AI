declare module "@supabase/ssr" {
  import type { SupabaseClient } from "@supabase/supabase-js";

  export function createBrowserClient(
    supabaseUrl: string,
    supabaseKey: string
  ): SupabaseClient;

  export function createServerClient(
    supabaseUrl: string,
    supabaseKey: string,
    options: {
      cookies: {
        getAll(): { name: string; value: string }[];
        setAll(
          cookies: { name: string; value: string; options?: unknown }[]
        ): void;
      };
    }
  ): SupabaseClient;
}
