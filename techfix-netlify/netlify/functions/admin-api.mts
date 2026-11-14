// Admin only: publish guides, read/clear feedback. Checks the admin login itself,
// because functions can also be reached directly at /.netlify/functions/admin-api.
import { getStore } from "@netlify/blobs";
import { isAdmin, json } from "./lib/auth.mts";
export const config = { path: "/admin/api/*" };
const okGuides = (g: any) =>
  Array.isArray(g) && g.length > 0 && g.length <= 300 &&
  g.every((x) => Array.isArray(x) && x.length >= 9 && x.slice(0, 4).every((s: any) => typeof s === "string") &&
    Array.isArray(x[4]) && Array.isArray(x[5]) && [...x[4], ...x[5]].every((s: any) => typeof s === "string"));
export default async (req: Request) => {
  if (!(await isAdmin(req))) {
    await new Promise((r) => setTimeout(r, 800));
    return json({ error: "unauthorized" }, 401, { "WWW-Authenticate": 'Basic realm="TechFix Admin", charset="UTF-8"' });
  }
  const url = new URL(req.url);
  const origin = req.headers.get("origin");
  if (req.method !== "GET" && origin && origin !== url.origin) return json({ error: "forbidden" }, 403); // CSRF guard
  const store = getStore({ name: "techfix", consistency: "strong" });
  const p = url.pathname.replace(/\/+$/, "");
  if (p.endsWith("/guides")) {
    if (req.method === "GET") return json((await store.get("guides", { type: "json" })) ?? null);
    if (req.method === "PUT") {
      const raw = await req.text();
      if (raw.length > 400000) return json({ error: "too large" }, 413);
      let g: any;
      try { g = JSON.parse(raw); } catch { return json({ error: "bad json" }, 400); }
      if (!okGuides(g)) return json({ error: "invalid guides" }, 400);
      await store.setJSON("guides", g);
      return json({ ok: true, count: g.length });
    }
  }
  if (p.endsWith("/feedback")) {
    if (req.method === "GET") {
      const { blobs } = await store.list({ prefix: "fb/" });
      const keys = blobs.map((b) => b.key).sort().slice(-2000);
      return json((await Promise.all(keys.map((k) => store.get(k, { type: "json" })))).filter(Boolean));
    }
    if (req.method === "DELETE") {
      const { blobs } = await store.list({ prefix: "fb/" });
      await Promise.all(blobs.map((b) => store.delete(b.key)));
      return json({ ok: true });
    }
  }
  return json({ error: "not found" }, 404);
};
