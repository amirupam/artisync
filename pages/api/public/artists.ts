import type { NextApiRequest, NextApiResponse } from "next";
import { supabase } from "@/lib/supabaseClient";
import { mapPublicArtistRow } from "@/lib/publicApiMapper";
import { checkRateLimit } from "@/lib/rateLimit";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

function firstString(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
  const rate = checkRateLimit(`public-artists:${ip}`);
  res.setHeader("X-RateLimit-Remaining", String(rate.remaining));
  if (!rate.allowed) {
    return res.status(429).json({ error: "Too many requests. Please slow down." });
  }

  const category = firstString(req.query.category);
  const city = firstString(req.query.city);
  const state = firstString(req.query.state);
  const locality = firstString(req.query.locality);
  const language = firstString(req.query.language);
  const eventType = firstString(req.query.eventType);
  const specialisation = firstString(req.query.specialisation);
  const genre = firstString(req.query.genre);
  const performanceMode = firstString(req.query.performanceMode);
  const willingToTravel = firstString(req.query.willingToTravel);
  const budgetMaxRaw = firstString(req.query.budgetMax);
  const budgetMax = budgetMaxRaw ? parseInt(budgetMaxRaw.replace(/[^\d]/g, ""), 10) : undefined;

  const pageRaw = firstString(req.query.page);
  const page = Math.max(1, parseInt(pageRaw ?? "1", 10) || 1);
  const pageSizeRaw = firstString(req.query.pageSize);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, parseInt(pageSizeRaw ?? String(DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));

  let query = supabase.from("artists_public").select("*", { count: "exact" });
  if (category) query = query.eq("art_form", category);
  if (city) query = query.eq("city", city);
  if (state) query = query.eq("state", state);
  if (locality) query = query.eq("area", locality);
  if (language) query = query.contains("languages", [language]);
  if (eventType) query = query.contains("event_types", [eventType]);
  if (specialisation) query = query.contains("art_sub_forms", [specialisation]);
  if (genre) query = query.contains("genres", [genre]);
  if (performanceMode) query = query.eq("work_mode", performanceMode);
  if (willingToTravel === "true") query = query.eq("travel_available", true);

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const { data, count, error } = await query.order("created_at", { ascending: false }).range(from, to);
  if (error) {
    return res.status(500).json({ error: "Could not load artists." });
  }

  let results = (data ?? []).map(mapPublicArtistRow);
  // budgetMax is a free-text field on the artist side, so it's filtered
  // in-memory after mapping rather than as a SQL predicate.
  if (budgetMax !== undefined && !Number.isNaN(budgetMax)) {
    results = results.filter((r) => {
      const price = parseInt(r.startingPrice.replace(/[^\d]/g, ""), 10);
      return Number.isNaN(price) || price <= budgetMax;
    });
  }

  res.setHeader("Cache-Control", "public, s-maxage=60, stale-while-revalidate=300");
  return res.status(200).json({
    results,
    pagination: { page, pageSize, total: count ?? results.length },
  });
}
