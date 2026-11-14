// netlify/edge-functions/admin-guard.ts
// Server-side password gate for /admin. Runs BEFORE the page is served,
// so the admin HTML is never sent to anyone who isn't logged in.
// Credentials come from Netlify environment variables (never stored in the repo):
//   ADMIN_PASSWORD  (required, 12+ characters)
//   ADMIN_USER      (optional, defaults to "admin")
import type { Context } from "https://edge.netlify.com";

export const config = { path: ["/admin", "/admin/*", "/admin.html"] };

const MAX_FAILS = 5;                 // wrong attempts allowed...
const WINDOW_MS = 15 * 60 * 1000;    // ...per 15 minutes, per IP (best effort)
const fails = new Map<string, { n: number; t: number }>();

const enc = new TextEncoder();
const sha = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));

// Constant-time comparison (hashes first so length differences leak nothing)
async function safeEqual(a: string, b: string) {
  const [x, y] = await Promise.all([sha(a), sha(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}

const SECURITY_HEADERS: Record<string, string> = {
  "Cache-Control": "no-store, private",
  "X-Robots-Tag": "noindex, nofollow",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Content-Security-Policy":
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; " +
    "img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
};

const deny = (status: number, body: string, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { ...SECURITY_HEADERS, "Content-Type": "text/plain; charset=utf-8", ...extra } });

export default async (req: Request, ctx: Context) => {
  const user = Netlify.env.get("ADMIN_USER") || "admin";
  const pass = Netlify.env.get("ADMIN_PASSWORD");
  // Fail closed: if the password isn't configured, nobody gets in.
  if (!pass || pass.length < 12) return deny(503, "Admin is not configured.");

  const ip = ctx.ip || "unknown";
  const rec = fails.get(ip);
  if (rec && Date.now() - rec.t > WINDOW_MS) fails.delete(ip);
  const cur = fails.get(ip);
  if (cur && cur.n >= MAX_FAILS) return deny(429, "Too many attempts. Try again in 15 minutes.", { "Retry-After": "900" });

  const m = /^Basic (.+)$/.exec(req.headers.get("authorization") || "");
  let ok = false;
  if (m) {
    try {
      const dec = atob(m[1]);
      const i = dec.indexOf(":");
      if (i > -1) {
        const [a, b] = await Promise.all([safeEqual(dec.slice(0, i), user), safeEqual(dec.slice(i + 1), pass)]);
        ok = a && b;
      }
    } catch { /* malformed header -> treated as failure */ }
  }

  if (!ok) {
    await new Promise((r) => setTimeout(r, 1000)); // slow down guessing
    if (m) { const r = fails.get(ip); fails.set(ip, { n: (r?.n ?? 0) + 1, t: r?.t ?? Date.now() }); }
    return deny(401, "Authentication required.", { "WWW-Authenticate": 'Basic realm="TechFix Admin", charset="UTF-8"' });
  }

  fails.delete(ip);
  const res = await ctx.next();
  const h = new Headers(res.headers);
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) h.set(k, v);
  return new Response(res.body, { status: res.status, headers: h });
};
