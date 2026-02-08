import { createClient } from "@supabase/supabase-js";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    return Response.json(
      {
        success: false,
        message: "Supabase env missing",
        missing: [
          !url && "NEXT_PUBLIC_SUPABASE_URL",
          !anonKey && "NEXT_PUBLIC_SUPABASE_ANON_KEY",
        ].filter(Boolean),
      },
      { status: 500 }
    );
  }

  try {
    const supabase = createClient(url, anonKey);
    const { error } = await supabase.auth.getSession();
    if (error) throw error;

    return Response.json({
      success: true,
      message: "Supabase connection OK",
      url: url.replace(/\/$/, ""),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return Response.json(
      { success: false, message: "Supabase connection failed", error: message },
      { status: 500 }
    );
  }
}
