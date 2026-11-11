// Data source: the OFFICIAL France Travail "Offres d'emploi v2" API
// (francetravail.io). OAuth2 client_credentials, then plain JSON endpoints.
// Everything here was verified against the official OpenAPI spec (v2.01)
// published on francetravail.io — see ../../url-reference.md.

export const TOKEN_URL =
  "https://entreprise.francetravail.fr/connexion/oauth2/access_token?realm=%2Fpartenaire"
export const API_BASE = "https://api.francetravail.io/partenaire/offresdemploi/v2"
export const SCOPE = "api_offresdemploiv2 o2dsoffre"

/** Public posting URL on candidat.francetravail.fr for a given offer id. */
export function publicUrl(id: string): string {
  return `https://candidat.francetravail.fr/offres/recherche/detail/${id}`
}

/** Error carrying a machine-readable code for the stderr JSON contract. */
export class CliError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

// ---------------------------------------------------------------------------
// Credentials & OAuth token (cached in memory for the process lifetime)
// ---------------------------------------------------------------------------

export function getCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env.FRANCETRAVAIL_CLIENT_ID
  const clientSecret = process.env.FRANCETRAVAIL_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new CliError(
      "FRANCETRAVAIL_CLIENT_ID and FRANCETRAVAIL_CLIENT_SECRET must be set. " +
        "Register a free application on https://francetravail.io (create an account, " +
        'create an application, subscribe it to the "API Offres d\'emploi v2"), then ' +
        "export both variables. See the skill README for the step-by-step guide.",
      "MISSING_CREDENTIALS",
    )
  }
  return { clientId, clientSecret }
}

interface CachedToken {
  token: string
  expiresAt: number // epoch ms
}

let cachedToken: CachedToken | null = null

/** Fetch with exponential backoff + jitter on 429/5xx (max ~6 retries). */
async function backoffFetch(url: string, init: RequestInit): Promise<Response> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, init)
    if (response.status === 429 || response.status >= 500) {
      if (attempt === maxRetries) {
        throw new CliError(
          `Request failed after retries: ${response.status} ${response.statusText}`,
          response.status === 429 ? "RATE_LIMITED" : "SERVER_ERROR",
        )
      }
      const retryAfter = parseInt(response.headers.get("Retry-After") ?? "", 10)
      const jitter = Math.floor(Math.random() * 500)
      const wait = !isNaN(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : delay + jitter
      await new Promise((r) => setTimeout(r, wait))
      delay = Math.min(delay * 2, 8000)
      continue
    }
    return response
  }
  throw new CliError("Request failed after max retries", "SERVER_ERROR")
}

/**
 * Get an OAuth2 access token (client_credentials). Cached in memory for the
 * process run; the API issues tokens valid ~1500 s, far longer than a CLI
 * invocation, so no disk caching.
 */
export async function getToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) return cachedToken.token
  const { clientId, clientSecret } = getCredentials()
  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: SCOPE,
  })
  const response = await backoffFetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  })
  if (!response.ok) {
    let detail = ""
    try {
      const j = (await response.json()) as { error?: string; error_description?: string }
      detail = j.error_description || j.error || ""
    } catch {
      /* non-JSON error body */
    }
    throw new CliError(
      `Authentication failed (HTTP ${response.status}${detail ? `: ${detail}` : ""}). ` +
        "Check FRANCETRAVAIL_CLIENT_ID / FRANCETRAVAIL_CLIENT_SECRET and that your " +
        'application is subscribed to the "API Offres d\'emploi v2" on francetravail.io.',
      "AUTH_FAILED",
    )
  }
  const json = (await response.json()) as { access_token?: string; expires_in?: number }
  if (!json.access_token) throw new CliError("Token response had no access_token", "AUTH_FAILED")
  cachedToken = {
    token: json.access_token,
    // Refresh 60 s early to avoid using a token at the edge of expiry.
    expiresAt: Date.now() + Math.max((json.expires_in ?? 1499) - 60, 30) * 1000,
  }
  return cachedToken.token
}

// ---------------------------------------------------------------------------
// API fetch
// ---------------------------------------------------------------------------

export interface ApiResponse {
  status: number
  /** Parsed JSON body, or null when the API returned no content (204/404). */
  json: unknown | null
  /** Content-Range header, format `offres p-d/t` (t = total matches). */
  contentRange: string | null
}

/** GET an API path with a Bearer token. Returns json:null on 204/404. */
export async function apiGet(pathAndQuery: string): Promise<ApiResponse> {
  const token = await getToken()
  const response = await backoffFetch(`${API_BASE}${pathAndQuery}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  })
  // 204 = no matching offers / offer does not exist (the API's documented
  // "not found" signal); 404 kept for safety.
  if (response.status === 204 || response.status === 404) {
    return { status: response.status, json: null, contentRange: null }
  }
  if (!response.ok) {
    let detail = ""
    try {
      detail = (await response.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
    throw new CliError(
      `API request failed: ${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`,
      response.status === 400 ? "BAD_REQUEST" : "API_ERROR",
    )
  }
  return {
    status: response.status,
    json: await response.json(),
    contentRange: response.headers.get("Content-Range"),
  }
}

/** Extract the total match count from a `Content-Range: offres p-d/t` header. */
export function parseTotal(contentRange: string | null): number | null {
  if (!contentRange) return null
  const m = contentRange.match(/\/(\d+)\s*$/)
  return m ? parseInt(m[1], 10) : null
}

// ---------------------------------------------------------------------------
// Search parameter mapping
// ---------------------------------------------------------------------------

/**
 * Map a job age in days to the API's `publieeDepuis` parameter. The API
 * accepts 1, 3, 7, 14 or 31 — round up to the next supported value.
 * Ages > 31 (or <= 0) mean "no filter" and return null.
 */
export function jobageToPublieeDepuis(days: number): number | null {
  if (!days || days <= 0 || days > 31) return null
  for (const v of [1, 3, 7, 14, 31]) if (days <= v) return v
  return null
}

/** INSEE commune codes for major French cities, as a convenience mapping. */
export const CITY_CODES: Record<string, string> = {
  paris: "75056",
  marseille: "13055",
  lyon: "69123",
  toulouse: "31555",
  nice: "06088",
  nantes: "44109",
  montpellier: "34172",
  strasbourg: "67482",
  bordeaux: "33063",
  lille: "59350",
  rennes: "35238",
  reims: "51454",
  "saint-etienne": "42218",
  toulon: "83137",
  "le havre": "76351",
  grenoble: "38185",
  dijon: "21231",
  angers: "49007",
  nimes: "30189",
  "clermont-ferrand": "63113",
  "aix-en-provence": "13001",
  tours: "37261",
  limoges: "87085",
  amiens: "80021",
  annecy: "74010",
  metz: "57463",
  besancon: "25056",
  orleans: "45234",
  rouen: "76540",
  mulhouse: "68224",
  caen: "14118",
  nancy: "54395",
  brest: "29019",
  villeurbanne: "69266",
  avignon: "84007",
  poitiers: "86194",
  perpignan: "66136",
}

/** Strip accents and normalize a city name for CITY_CODES lookup. */
function normalizeCity(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bst[- ]/g, "saint-")
    .replace(/_/g, "-")
    .trim()
}

export interface LocationParam {
  param: "commune" | "departement" | "region"
  value: string
}

/**
 * Resolve the --location flag to an API location parameter. Accepted forms:
 * - 5-digit INSEE commune code ("33063") -> commune
 * - department number: 2 digits, 2A/2B (Corsica), or 971-976 (DOM) -> departement
 * - explicit prefixes: "commune:33063", "departement:33" (or "dept:33"), "region:75"
 * - a major French city name ("Paris", "Lyon", ...) via the built-in INSEE map
 */
export function resolveLocation(input: string): LocationParam {
  const raw = input.trim()
  const prefixed = raw.match(/^(commune|departement|dept|region)\s*:\s*(.+)$/i)
  if (prefixed) {
    const kind = prefixed[1].toLowerCase()
    const value = prefixed[2].trim()
    if (kind === "commune") return { param: "commune", value }
    if (kind === "region") return { param: "region", value }
    return { param: "departement", value }
  }
  if (/^\d{5}$/.test(raw)) return { param: "commune", value: raw }
  if (/^(\d{2}|2A|2B|97[1-6])$/i.test(raw)) {
    return { param: "departement", value: raw.toUpperCase() }
  }
  const city = CITY_CODES[normalizeCity(raw)]
  if (city) return { param: "commune", value: city }
  throw new CliError(
    `Could not resolve location "${input}". Use a 5-digit INSEE commune code ` +
      '(e.g. 33063 for Bordeaux), a department number (e.g. 33, 75, 2A, 972), an explicit ' +
      'prefix ("commune:33063", "departement:33", "region:75"), or a major French city ' +
      "name (Paris, Lyon, Marseille, ...). Full INSEE codes: the API's " +
      "/v2/referentiel/communes resource, or insee.fr.",
    "BAD_LOCATION",
  )
}

/** Build the API's 0-indexed `range` parameter (`p-d`) for a 1-indexed page. */
export function buildRange(page: number, size: number): string {
  const start = (page - 1) * size
  return `${start}-${start + size - 1}`
}

// ---------------------------------------------------------------------------
// Result mapping
// ---------------------------------------------------------------------------

export interface JobResult {
  id: string
  title: string | null
  company: string | null
  location: string | null
  date: string | null
  url: string
  contract: string | null
  salary: string | null
}

export interface JobDetail extends JobResult {
  description: string | null
  romeLibelle: string | null
  experience: string | null
  duration: string | null
  alternance: boolean | null
  applyUrl: string | null
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Map one raw API `Offre` object to the shared result shape. */
export function mapOffre(o: any): JobResult {
  const id = String(o?.id ?? "")
  return {
    id,
    title: o?.intitule ?? null,
    company: o?.entreprise?.nom ?? null,
    location: o?.lieuTravail?.libelle ?? null,
    date: o?.dateCreation ?? null,
    url: o?.origineOffre?.urlOrigine ?? publicUrl(id),
    contract: o?.typeContrat ?? null,
    salary: o?.salaire?.libelle ?? null,
  }
}

/** Map one raw API `Offre` object to the detail shape. */
export function mapOffreDetail(o: any): JobDetail {
  return {
    ...mapOffre(o),
    description: o?.description ?? null,
    romeLibelle: o?.romeLibelle ?? null,
    experience: o?.experienceLibelle ?? null,
    duration: o?.dureeTravailLibelle ?? null,
    alternance: typeof o?.alternance === "boolean" ? o.alternance : null,
    applyUrl: o?.contact?.urlPostulation ?? o?.origineOffre?.urlOrigine ?? null,
  }
}
