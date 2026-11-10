import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

// Formulários públicos (/f/...) e webhooks não usam sessão e ficam fora do proxy.
export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|f/|api/webhooks/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
