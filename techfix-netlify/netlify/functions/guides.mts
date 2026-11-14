// Public: returns the guides published from /admin (or null -> the site uses its built-in guides).
import { getStore } from "@netlify/blobs";
import { json } from "./lib/auth.mts";
export const config = { path: "/api/guides" };
export default async (req: Request) => {
  if (req.method !== "GET") return json({ error: "method" }, 405);
  const g = await getStore({ name: "techfix", consistency: "strong" }).get("guides", { type: "json" });
  return json(g ?? null, 200, { "Cache-Control": "public, max-age=30" });
};
