import { NextResponse } from "next/server";
import { createClient } from "../../lib/supabase/server";

function getPublicOrigin(request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      return new URL(configuredSiteUrl).origin;
    } catch {
      // Fall through to Render's forwarded request headers.
    }
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.split(",")[0]?.trim();
  const protocol = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";

  return host ? `${protocol}://${host}` : new URL(request.url).origin;
}

export async function GET(request) {
  const url = new URL(request.url);
  const publicOrigin = getPublicOrigin(request);
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const requestedNext = url.searchParams.get("next") || "/looking-for-player";
  const next = requestedNext.startsWith("/") && !requestedNext.startsWith("//")
    ? requestedNext
    : "/looking-for-player";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, publicOrigin));
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) return NextResponse.redirect(new URL(next, publicOrigin));
  }

  return NextResponse.redirect(new URL("/signup?error=Unable%20to%20complete%20sign%20in", publicOrigin));
}
