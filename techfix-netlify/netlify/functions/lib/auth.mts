// Shared helpers. A subfolder without index.* is NOT deployed as its own function.
const enc = new TextEncoder();
const sha = async (s: string) => new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)));
async function eq(a: string, b: string) {
  const [x, y] = await Promise.all([sha(a), sha(b)]);
  let d = 0;
  for (let i = 0; i < x.length; i++) d |= x[i] ^ y[i];
  return d === 0;
}
// Checks the admin login (same ADMIN_USER / ADMIN_PASSWORD as the /admin page guard).
export async function isAdmin(req: Request): Promise<boolean> {
  const pass = Netlify.env.get("ADMIN_PASSWORD");
  const user = Netlify.env.get("ADMIN_USER") || "admin";
  if (!pass || pass.length < 12) return false;
  const m = /^Basic (.+)$/.exec(req.headers.get("authorization") || "");
  if (!m) return false;
  try {
    const d = atob(m[1]);
    const i = d.indexOf(":");
    if (i < 0) return false;
    const [a, b] = await Promise.all([eq(d.slice(0, i), user), eq(d.slice(i + 1), pass)]);
    return a && b;
  } catch { return false; }
}
export const json = (data: unknown, status = 200, extra: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", ...extra },
  });
