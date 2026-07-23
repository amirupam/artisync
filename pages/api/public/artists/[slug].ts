import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabaseClient";
import { mapPublicArtistRow } from "@/lib/publicApiMapper";
import { checkRateLimit } from "@/lib/rateLimit";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const rate = checkRateLimit(`public-artist:${ip}`);
  res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  const slug = req.query.slug;
  if (typeof slug !== "string" || !slug) {
    return res.status(400).json({ error: "A slug is required." });
  }

  const { data, error } = await supabase.from("artists_public").select("*").eq("slug", slug).maybeSingle();
  if (error) {
    return res.status(500).json({ error: "Could not load artist." });
  }
  if (!data) {
    return res.status(404).json({ error: "Artist not found." });
  }

  res.setHeader("Cache-Control", "public, s-maxage=300, stale-while-revalidate=1800");
  return res.status(200).json({ result: mapPublicArtistRow(data) });
}
