import type { APIRoute } from "astro";
import { robots } from "../lib/sitemap.ts";

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("astro.config.mjs sets no site: robots.txt names the sitemap by its absolute URL");
  return new Response(robots(site.href), { headers: { "Content-Type": "text/plain; charset=utf-8" } });
};
