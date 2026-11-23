import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

// Edge middleware (not Next 16 `proxy.ts`): OpenNext on Cloudflare Workers fully supports
// edge middleware, while Node-runtime proxy.ts is still experimental there.
export async function middleware(request: NextRequest) {
  return updateSession(request);
}

// Organiser routes only. Never /s/*, /play, /board or assets — the team flow must keep
// working even if Supabase Auth is slow.
export const config = {
  matcher: ["/admin/:path*", "/judge/:path*", "/print/:path*"],
};
