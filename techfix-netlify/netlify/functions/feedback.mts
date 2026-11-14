// Public: receives "was this helpful?" votes from every device. Stores only guide title, yes/no and time.
import { getStore } from "@netlify/blobs";
import { json } from "./lib/auth.mts";
export const config = { path: "/api/feedback" };
const hits = new Map<string, { n: number; t: number }>(); // best-effort rate limit: 30 votes/hour/IP
export default async (req: Request, ctx: { ip?: string }) => {
  if (req.method !== "POST") return json({ error: "method" }, 405);
  const ip = ctx?.ip || "x", now = Date.now(), h = hits.get(ip);
  if (h && now - h.t < 3600e3 && h.n >= 30) return json({ error: "rate" }, 429);
  hits.set(ip, h && now - h.t < 3600e3 ? { n: h.n + 1, t: h.t } : { n: 1, t: now });
  const raw = await req.text();
  if (raw.length > 600) return json({ error: "size" }, 413);
  let b: any;
  try { b = JSON.parse(raw); } catch { return json({ error: "json" }, 400); }
  const title = typeof b?.title === "string" ? b.title.trim().slice(0, 100) : "";
  if (!title || typeof b.yes !== "boolean") return json({ error: "invalid" }, 400);
  await getStore({ name: "techfix", consistency: "strong" })
    .setJSON(`fb/${now}-${crypto.randomUUID().slice(0, 8)}`, { title, yes: b.yes, at: new Date(now).toISOString() });
  return json({ ok: true });
};
