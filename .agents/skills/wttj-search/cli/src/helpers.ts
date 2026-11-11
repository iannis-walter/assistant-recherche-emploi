// Data source: Welcome to the Jungle's public Algolia search index (the same
// one the browser queries from welcometothejungle.com/fr/jobs) plus the
// unauthenticated REST API used by the job pages for full postings.
//
// The Algolia application ID and API key below are PUBLIC, search-only
// credentials shipped to every browser in the site's JS bundle — they grant
// read-only search access and nothing else. See ../url-reference.md.

export const ALGOLIA_HOST = "https://csekhvms53-dsn.algolia.net"
export const ALGOLIA_APP_ID = "CSEKHVMS53"
export const ALGOLIA_API_KEY = "4bd8f6215d0cc52b26430765769e65a0" // public search-only key
export const JOBS_INDEX = "wk_cms_jobs_production"
export const JOBS_INDEX_BY_DATE = "wk_cms_jobs_production_published_at_desc"
export const DETAIL_API = "https://api.welcometothejungle.com/api/v1/organizations"
export const SITE_BASE = "https://www.welcometothejungle.com"

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * Fetch with exponential backoff + jitter on 429/5xx (max 6 retries).
 * Returns `null` on a 404 instead of throwing.
 */
async function fetchWithBackoff(url: string, init: RequestInit): Promise<Response | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init)
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new Error(`Request failed: ${response.status} ${response.statusText}`)
      }
      const jitter = Math.floor(Math.random() * 500)
      await new Promise((r) => setTimeout(r, delay + jitter))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    if (response.status === 404) return null
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response
  }
  throw new Error("Request failed after max retries")
}

// The Algolia key is referer-restricted: requests must carry the site's
// origin/referer or the API answers 403 "Method not allowed with this referer".
const ALGOLIA_HEADERS = {
  "User-Agent": UA,
  "x-algolia-application-id": ALGOLIA_APP_ID,
  "x-algolia-api-key": ALGOLIA_API_KEY,
  origin: SITE_BASE,
  referer: `${SITE_BASE}/`,
}

export interface AlgoliaRequest {
  indexName: string
  params: string // URL-encoded query string, e.g. "query=python&page=0"
}

/** POST one or more queries to Algolia's multi-query endpoint. */
export async function algoliaQuery(requests: AlgoliaRequest[]): Promise<any[]> {
  const response = await fetchWithBackoff(`${ALGOLIA_HOST}/1/indexes/*/queries`, {
    method: "POST",
    headers: { ...ALGOLIA_HEADERS, "content-type": "application/x-www-form-urlencoded" },
    body: JSON.stringify({ requests }),
  })
  if (!response) throw new Error("Algolia endpoint returned 404")
  const data = (await response.json()) as { results?: any[] }
  if (!Array.isArray(data.results)) throw new Error("Unexpected Algolia response shape")
  return data.results
}

/** GET a single record by objectID. Returns null when the object is gone. */
export async function algoliaGetObject(
  objectID: string,
  attributes: string[],
): Promise<any | null> {
  const qs = new URLSearchParams({ attributesToRetrieve: attributes.join(",") })
  const response = await fetchWithBackoff(
    `${ALGOLIA_HOST}/1/indexes/${JOBS_INDEX}/${encodeURIComponent(objectID)}?${qs}`,
    { headers: ALGOLIA_HEADERS },
  )
  return response ? response.json() : null
}

/** GET a JSON document from the WTTJ REST API. Returns null on 404. */
export async function restGet(url: string): Promise<any | null> {
  const response = await fetchWithBackoff(url, {
    headers: { "User-Agent": UA, Accept: "application/json" },
  })
  return response ? response.json() : null
}

// ---------------------------------------------------------------------------
// HTML-to-text (detail descriptions are HTML fragments)
// ---------------------------------------------------------------------------

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

/** Convert an HTML fragment to readable plain text, keeping paragraph breaks. */
export function htmlToText(html: string | null | undefined): string | null {
  if (!html) return null
  const withBreaks = html
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d|blockquote|tr)>/gi, "\n")
  const text = decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return text || null
}

// ---------------------------------------------------------------------------
// Result shaping
// ---------------------------------------------------------------------------

export interface JobResult {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  contract: string | null
  remote: string | null
  salary: string | null
}

/** Build the public posting URL from the org and job slugs. */
export function jobUrl(orgSlug: string | null | undefined, jobSlug: string | null | undefined): string | null {
  if (!orgSlug || !jobSlug) return null
  return `${SITE_BASE}/fr/companies/${orgSlug}/jobs/${jobSlug}`
}

/** "City, Country" from an offices entry (or the singular office field). */
export function officeLabel(office: { city?: string | null; country?: string | null } | null | undefined): string | null {
  if (!office) return null
  const parts = [office.city, office.country].filter((p): p is string => !!p)
  return parts.length ? parts.join(", ") : null
}

export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined,
  currency: string | null | undefined,
  period: string | null | undefined,
): string | null {
  if (min == null && max == null) return null
  const range = min != null && max != null && min !== max ? `${min}–${max}` : `${min ?? max}`
  const cur = currency ? ` ${currency}` : ""
  const per = period ? `/${period}` : ""
  return `${range}${cur}${per}`
}

/** Map one Algolia hit from the jobs index to the shared result shape. */
export function hitToResult(hit: any): JobResult | null {
  if (!hit || !hit.objectID || !hit.name) return null
  const office = (Array.isArray(hit.offices) && hit.offices[0]) || hit.office || null
  const contractName =
    hit.contract_type_names?.fr ?? hit.contract_type_names?.en ?? hit.contract_type ?? null
  return {
    id: String(hit.objectID),
    title: String(hit.name),
    company: hit.organization?.name ?? null,
    location: officeLabel(office),
    date: hit.published_at ?? null,
    url: jobUrl(hit.organization?.slug, hit.slug),
    contract: contractName,
    remote: hit.remote ?? null,
    salary: formatSalary(
      hit.salary_minimum,
      hit.salary_maximum,
      hit.salary_currency,
      hit.salary_period,
    ),
  }
}

/** True when the ISO date is within the last `days` days of `now`. */
export function withinDays(iso: string | null, days: number, now: Date = new Date()): boolean {
  if (!iso) return false
  const t = Date.parse(iso)
  if (isNaN(t)) return false
  return now.getTime() - t <= days * 86400_000
}

// ---------------------------------------------------------------------------
// Detail-input normalization
// ---------------------------------------------------------------------------

export type DetailRef =
  | { kind: "id"; id: string }
  | { kind: "slugs"; org: string; job: string }

/**
 * Accept a numeric Algolia objectID (from `search` results) or a public
 * posting URL like https://www.welcometothejungle.com/fr/companies/<org>/jobs/<slug>.
 */
export function normalizeDetailInput(input: string): DetailRef | null {
  const trimmed = input.trim()
  if (/^\d{3,}$/.test(trimmed)) return { kind: "id", id: trimmed }
  const m = trimmed.match(
    /welcometothejungle\.com\/(?:[a-z]{2}(?:-[A-Za-z]{2})?\/)?companies\/([^\/?#]+)\/jobs\/([^\/?#]+)/i,
  )
  if (m) return { kind: "slugs", org: m[1], job: m[2] }
  return null
}
