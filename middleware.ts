import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  const response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          response.cookies.set(name, value)
        );
      },
    },
  });

  try {
    await supabase.auth.getUser();
  } catch (err) {
    // Invalid/expired JWT (e.g. "Invalid Compact JWS") – clear auth cookies and continue
    const msg = err instanceof Error ? err.message : String(err);
    if (/compact jws|jwt|jose/i.test(msg)) {
      const all = request.cookies.getAll();
      all.forEach(({ name }) => {
        if (name.startsWith("sb-") && name.includes("auth-token")) {
          response.cookies.set(name, "", { maxAge: 0, path: "/" });
        }
      });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Run auth for pages; skip static assets and /api/upload (avoids JWT errors on upload)
    "/((?!_next/static|_next/image|favicon.ico|api/upload|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
