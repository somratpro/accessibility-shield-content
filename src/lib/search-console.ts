import crypto from "crypto";
import { requireStudioConfig } from "./studio-config";

/**
 * Minimal Google Search Console client using a service account (no googleapis dependency).
 *
 * Setup: create a service account in Google Cloud, enable the "Google Search Console API",
 * then add the service account email as a user (Restricted is enough) on the property in
 * Search Console. Set GSC_CLIENT_EMAIL, GSC_PRIVATE_KEY and GSC_SITE_URL in .env.
 */

export interface PagePerformance {
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface SearchPerformance {
  configured: boolean;
  error?: string;
  startDate?: string;
  endDate?: string;
  /** Keyed by blog slug */
  pages: Record<string, PagePerformance>;
}

const CACHE_MS = 60 * 60 * 1000;
let cache: { at: number; data: SearchPerformance } | null = null;

function config() {
  const clientEmail = process.env.GSC_CLIENT_EMAIL?.trim();
  const privateKey = process.env.GSC_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  // "sc-domain:example.com" for a domain property, or the URL-prefix form.
  const siteUrl = process.env.GSC_SITE_URL?.trim();
  return clientEmail && privateKey && siteUrl ? { clientEmail, privateKey, siteUrl } : null;
}

const base64url = (input: string | Buffer) => Buffer.from(input).toString("base64url");

async function getAccessToken(clientEmail: string, privateKey: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: "https://www.googleapis.com/auth/webmasters.readonly",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const signature = crypto
    .createSign("RSA-SHA256")
    .update(`${header}.${claims}`)
    .sign(privateKey)
    .toString("base64url");

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${signature}`,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.error || "Google auth failed");
  return data.access_token;
}

const isoDay = (d: Date) => d.toISOString().split("T")[0];
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Clicks, impressions, CTR and average position per blog post over the last 28 days. */
export async function getBlogSearchPerformance(): Promise<SearchPerformance> {
  const cfg = config();
  if (!cfg) return { configured: false, pages: {} };
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.data;

  // Posts live at BLOG_PATH/<slug> ("" = the site root).
  const { blogPath } = requireStudioConfig().site;
  const slugPattern = new RegExp(`^${escapeRegex(blogPath)}/([^/]+)/?$`);

  // Search Console data lags by ~2 days.
  const end = new Date();
  end.setUTCDate(end.getUTCDate() - 2);
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 27);

  try {
    const token = await getAccessToken(cfg.clientEmail, cfg.privateKey);
    const res = await fetch(
      `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(cfg.siteUrl)}/searchAnalytics/query`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: isoDay(start),
          endDate: isoDay(end),
          dimensions: ["page"],
          dimensionFilterGroups: blogPath
            ? [{ filters: [{ dimension: "page", operator: "contains", expression: `${blogPath}/` }] }]
            : undefined,
          rowLimit: 1000,
        }),
      },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data.error?.message || "Search Console request failed");

    const pages: Record<string, PagePerformance> = {};
    for (const row of data.rows || []) {
      const slug = new URL(row.keys[0]).pathname.match(slugPattern)?.[1];
      if (!slug) continue;
      pages[slug] = {
        clicks: row.clicks,
        impressions: row.impressions,
        ctr: row.ctr,
        position: row.position,
      };
    }

    const result = { configured: true, startDate: isoDay(start), endDate: isoDay(end), pages };
    cache = { at: Date.now(), data: result };
    return result;
  } catch (err: any) {
    return { configured: true, error: err?.message || "Search Console request failed", pages: {} };
  }
}
