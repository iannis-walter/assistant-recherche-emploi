// Data source: APEC (apec.fr) public JSON webservices — the same XHR API the
// Angular search UI calls. No HTML parsing is needed:
//   Search:   POST /cms/webservices/rechercheOffre        (JSON body)
//   Detail:   GET  /cms/webservices/offre/public?numeroOffre={id}W
//   Location: GET  /cms/webservices/autocompletion/lieuautocomplete
// Endpoints, body shape, and nomenclature codes are documented in
// ../../url-reference.md.

export const BASE_URL = "https://www.apec.fr"
export const SEARCH_ENDPOINT = `${BASE_URL}/cms/webservices/rechercheOffre`
export const DETAIL_ENDPOINT = `${BASE_URL}/cms/webservices/offre/public`
export const LIEU_ENDPOINT = `${BASE_URL}/cms/webservices/autocompletion/lieuautocomplete`

/** Results per page — matches the range the apec.fr UI requests. */
export const PAGE_SIZE = 20

/** Public posting URL (Angular route detail-offre/:numeroOffre). */
export function publicUrl(numeroOffre: string): string {
  return `${BASE_URL}/candidat/recherche-emploi.html/emploi/detail-offre/${numeroOffre}`
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/**
 * Fetch JSON with exponential backoff + jitter on 429/5xx (max 6 retries).
 * Returns null on a 404 (APEC answers 404 for unknown numeroOffre).
 * The Accept header matters: some APEC webservices answer 406 without it.
 */
export async function jsonFetch(
  url: string,
  body?: unknown,
): Promise<unknown | null> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "User-Agent": UA,
        Accept: "application/json",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      redirect: "follow",
    })
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
    return response.json()
  }
  throw new Error("Request failed after max retries")
}

export interface JobCard {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  contract: string | null
  snippet: string | null
}

export interface JobDetail {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string
  salary: string | null
  contract: string | null
  description: string | null
  skills: string[]
}

/**
 * APEC posting-age codes (referentiel POSITION_DURATION_FILTERING_SERVICE_DOMAIN):
 * 101850 = last 24h, 101851 = last 7 days, 101852 = last 30 days.
 * Coarser than exact days; anything past 30 days means "all offers" (omit).
 */
export function jobageToAnciennete(days: number): number | null {
  if (!days || days <= 0 || days >= 9999) return null
  if (days <= 1) return 101850
  if (days <= 7) return 101851
  if (days <= 30) return 101852
  return null
}

/** Contract-type codes (referentiel RECHERCHE_OFFRE_TYPE_CONTRAT), verified live. */
export const CONTRACT_LABELS: Record<number, string> = {
  101888: "CDI",
  101887: "CDD",
  20053: "Alternance",
  101930: "Intérim",
  101889: "Mission d'intérim",
  597141: "CDI intérimaire",
  597137: "CDD - Alternance - Contrat d'apprentissage",
  597138: "CDD - Alternance - Contrat de professionnalisation",
  597139: "CDI - Alternance - Contrat d'apprentissage",
  597140: "CDI - Alternance - Contrat de professionnalisation",
  597171: "Stage",
}

export function contractLabel(code: unknown): string | null {
  if (typeof code !== "number") return null
  return CONTRACT_LABELS[code] ?? null
}

/**
 * Normalize a user-supplied offer reference to APEC's numeroOffre:
 * - "179064883W" (already a numeroOffre) -> as-is (uppercased)
 * - "179064883" (bare numeric id)        -> "179064883W" (the webservice 404s without the W)
 * - a full detail-offre URL              -> the numeroOffre segment
 * Returns null when nothing parseable is found.
 */
export function normalizeNumeroOffre(input: string): string | null {
  const fromUrl = input.match(/detail-offre\/(\d+)(w)?/i)
  if (fromUrl) return `${fromUrl[1]}W`
  const bare = input.trim().match(/^(\d{4,})(w)?$/i)
  if (bare) return `${bare[1]}W`
  return null
}

/** Named entities that APEC's HTML fields actually use, plus numeric refs. */
const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  hellip: "…",
  eacute: "é",
  egrave: "è",
  ecirc: "ê",
  euml: "ë",
  agrave: "à",
  acirc: "â",
  ugrave: "ù",
  ucirc: "û",
  ocirc: "ô",
  icirc: "î",
  iuml: "ï",
  ccedil: "ç",
  oelig: "œ",
  Eacute: "É",
  Egrave: "È",
  Agrave: "À",
  Ccedil: "Ç",
  euro: "€",
  deg: "°",
  laquo: "«",
  raquo: "»",
  ndash: "–",
  mdash: "—",
}

function numericEntity(cp: number): string {
  return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : ""
}

export function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&([a-zA-Z]+);/g, (m, name) => NAMED_ENTITIES[name] ?? m)
}

/** Convert an APEC HTML description fragment to readable plain text. */
export function htmlToText(fragment: string): string {
  const withBreaks = fragment
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/(p|li|ul|ol|div|h\d)>/gi, "\n")
  return decodeHtmlEntities(withBreaks.replace(/<[^>]+>/g, ""))
    .replace(/[  ]/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/ ?\n ?/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/** "2026-07-09T08:34:55.000+0000" -> "2026-07-09" (null on absent/garbage). */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== "string") return null
  const m = value.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : null
}

function cleanText(value: unknown): string | null {
  if (typeof value !== "string") return null
  const t = decodeHtmlEntities(value).replace(/[  ]/g, " ").replace(/\s+/g, " ").trim()
  return t || null
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Map one rechercheOffre result to the portal-contract card shape. */
export function mapSearchResult(raw: any): JobCard | null {
  const numero: string | undefined =
    typeof raw?.numeroOffre === "string" && raw.numeroOffre
      ? raw.numeroOffre
      : raw?.id != null
        ? `${raw.id}W`
        : undefined
  const title = cleanText(raw?.intitule)
  if (!numero || !title) return null
  return {
    id: numero,
    title,
    company: cleanText(raw?.nomCommercial),
    location: cleanText(raw?.lieuTexte),
    date: toIsoDate(raw?.datePublication),
    url: publicUrl(numero),
    salary: cleanText(raw?.salaireTexte),
    contract: contractLabel(raw?.typeContrat),
    snippet: cleanText(raw?.texteOffre),
  }
}

/** Map the offre/public response to the portal-contract detail shape. */
export function mapDetail(raw: any, numeroOffre: string): JobDetail {
  const numero: string =
    typeof raw?.numeroOffre === "string" && raw.numeroOffre ? raw.numeroOffre : numeroOffre

  const lieux = Array.isArray(raw?.lieux)
    ? raw.lieux.map((l: any) => cleanText(l?.libelleLieu)).filter(Boolean)
    : []

  const sections: string[] = []
  const push = (heading: string, html: unknown): void => {
    if (typeof html !== "string") return
    const text = htmlToText(html)
    if (text) sections.push(`## ${heading}\n\n${text}`)
  }
  push("Le poste", raw?.texteHtml)
  push("Le profil recherché", raw?.texteHtmlProfil)
  push("L'entreprise", raw?.texteHtmlEntreprise)

  const skills: string[] = Array.isArray(raw?.competences)
    ? raw.competences
        .map((c: any) => cleanText(c?.libelle))
        .filter((s: string | null): s is string => s !== null)
    : []

  return {
    id: numero,
    title: cleanText(raw?.intitule) ?? "(untitled)",
    company: cleanText(raw?.enseigne) ?? cleanText(raw?.nomCompteEtablissement),
    location: lieux.length > 0 ? lieux.join("; ") : null,
    date: toIsoDate(raw?.datePublication) ?? toIsoDate(raw?.datePremierePublication),
    url: publicUrl(numero),
    salary: cleanText(raw?.salaireTexte),
    contract: contractLabel(raw?.idNomTypeContrat),
    description: sections.length > 0 ? sections.join("\n\n") : null,
    skills,
  }
}

export interface LieuSuggestion {
  lieuId: number
  lieuDisplay: string
  lieuType: string
}

/**
 * Resolve a location text ("Paris", "Lyon", "Île-de-France") to APEC's lieuId
 * via the lieu autocomplete. byLeftAndRight=false gives prefix matching, so
 * the first suggestion is the expected one. Returns null when nothing matches.
 */
export async function resolveLieu(location: string): Promise<LieuSuggestion | null> {
  const params = new URLSearchParams({
    q: location,
    max: "10",
    byLeftAndRight: "false",
  })
  const data = await jsonFetch(`${LIEU_ENDPOINT}?${params.toString()}`)
  if (!Array.isArray(data) || data.length === 0) return null
  const first = data[0] as any
  if (typeof first?.lieuId !== "number") return null
  return {
    lieuId: first.lieuId,
    lieuDisplay: String(first.lieuDisplay ?? ""),
    lieuType: String(first.lieuType ?? ""),
  }
}
