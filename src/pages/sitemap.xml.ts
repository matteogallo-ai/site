import type { APIRoute } from "astro";
import { sitemap } from "../lib/sitemap.ts";

// Every .astro file under src/pages is a page; endpoints such as this one are .ts and stay out.
const files = Object.keys(import.meta.glob("./**/*.astro"));

export const GET: APIRoute = ({ site }) => {
  if (!site) throw new Error("astro.config.mjs sets no site: the sitemap needs absolute URLs");
  return new Response(sitemap(site.href, files), { headers: { "Content-Type": "application/xml; charset=utf-8" } });
};
