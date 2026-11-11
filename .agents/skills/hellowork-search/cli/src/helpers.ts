// Data source: HelloWork (hellowork.com) public server-rendered pages.
// Search: /fr-fr/emploi/recherche.html (query params k, l, p, d).
// Detail: /fr-fr/emplois/{id}.html.
// No JSON API and no JobPosting JSON-LD are exposed, so we parse the HTML with
// regex anchored on stable data-cy attributes and hidden form inputs (offerId /
// title / company), splitting the results page into per-card chunks so one
// malformed card cannot break the rest.

export const BASE_URL = "https://www.hellowork.com"
export const SEARCH_URL = `${BASE_URL}/fr-fr/emploi/recherche.html`

export function detailUrl(id: string): string {
  return `${BASE_URL}/fr-fr/emplois/${id}.html`
}

export function writeError(error: string, code: string): void {
  process.stderr.write(JSON.stringify({ error, code }) + "\n")
}

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"

/** Fetch HTML with exponential backoff on 429/5xx. Returns "" on a 404. */
export async function htmlFetch(url: string): Promise<string> {
  const maxRetries = 6
  let delay = 500
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "fr-FR,fr;q=0.9,en;q=0.8",
      },
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
    if (response.status === 404) return ""
    if (!response.ok) {
      throw new Error(`Request failed: ${response.status} ${response.statusText}`)
    }
    return response.text()
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
  contract: string | null
  salary: string | null
}

export interface JobDetail extends JobCard {
  description: string | null
  tags: string[]
}

/**
 * Convert a Unicode code point to a string. Uses `fromCodePoint` so
 * supplementary-plane code points decode correctly, and drops out-of-range
 * values instead of throwing.
 */
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
    // Numeric character references: decimal (&#233;) and hexadecimal (&#xE9;).
    .replace(/&#(\d+);/g, (_, dec) => numericEntity(parseInt(dec, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, hex) => numericEntity(parseInt(hex, 16)))
    .replace(/&nbsp;/g, " ")
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
}

/** Strip tags, decode entities, normalize whitespace (incl. narrow NBSP). */
function clean(html: string): string {
  return decodeHtmlEntities(stripTags(html)).replace(/[  ]/g, " ").trim()
}

/**
 * Convert HelloWork's relative French date labels ("il y a 5 jours", "hier",
 * "il y a 3 heures") to an ISO YYYY-MM-DD date. Returns the raw label when the
 * format is unknown, or null on empty input.
 */
export function relativeFrDateToISO(label: string, now: Date = new Date()): string | null {
  const text = label.replace(/\s+/g, " ").trim().toLowerCase()
  if (!text) return null

  const iso = (d: Date): string => d.toISOString().slice(0, 10)
  const minus = (days: number): string => {
    const d = new Date(now.getTime() - days * 86400_000)
    return iso(d)
  }

  if (/aujourd|instant|minute|heure|\d+\s*h\b/.test(text)) return iso(now)
  if (/hier/.test(text)) return minus(1)
  const days = text.match(/il y a (\d+) jours?/)
  if (days) return minus(parseInt(days[1], 10))
  const months = text.match(/il y a (\d+) mois/)
  if (months) return minus(parseInt(months[1], 10) * 30)
  return label.trim()
}

/** Map --jobage days to HelloWork's `d` facet (h=24h, d=3 days, w=1 week, m=1 month). */
export function jobageToDateFacet(days: number): string | null {
  if (!days || days <= 0 || days >= 9999) return null
  if (days <= 1) return "h"
  if (days <= 3) return "d"
  if (days <= 7) return "w"
  if (days <= 31) return "m"
  return null
}

/** Total result count from the search page <h1> ("2 025 offres ..."). */
export function parseTotalCount(html: string): number | null {
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (!h1) return null
  const m = clean(h1[1]).match(/([\d ]+)\s*offres?/i)
  if (!m) return null
  const n = parseInt(m[1].replace(/\D/g, ""), 10)
  return isNaN(n) ? null : n
}

/**
 * Parse the search-results page. Each result <li> carries
 * data-id-storage-item-id="{id}" plus a hide-offer form whose hidden inputs
 * hold the exact title and company. We split on the id attribute and parse
 * each chunk independently.
 */
export function parseJobCards(html: string): JobCard[] {
  const results: JobCard[] = []
  const chunks = html.split(/data-id-storage-item-id="/).slice(1)

  for (const chunk of chunks) {
    const idMatch = chunk.match(/^(\d+)"/)
    if (!idMatch) continue
    const id = idMatch[1]

    const titleInput = chunk.match(/name="title"\s+value="([^"]*)"/i)
    const title = titleInput ? clean(titleInput[1]) : null
    if (!title) continue

    const companyInput = chunk.match(/name="company"\s+value="([^"]*)"/i)
    const company = companyInput ? clean(companyInput[1]) || null : null

    const loc = chunk.match(/data-cy="localisationCard"\s*>([\s\S]*?)<\/div>/i)
    const location = loc ? clean(loc[1]) || null : null

    const contractM = chunk.match(/data-cy="contractCard"\s*>([\s\S]*?)<\/div>/i)
    const contract = contractM ? clean(contractM[1]) || null : null

    const salaryM = chunk.match(
      /class="readonly tag-secondary-s typo-s-bold[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
    )
    const salary = salaryM ? clean(salaryM[1]) || null : null

    const dateM = chunk.match(/class="typo-s text-grey-500 pl-1 pt-1"[^>]*>([\s\S]*?)<\/div>/i)
    const date = dateM ? relativeFrDateToISO(clean(dateM[1])) : null

    results.push({
      id,
      title,
      company,
      location,
      date,
      url: detailUrl(id),
      contract,
      salary,
    })
  }

  return results
}

/** Extract the content of a <div ...> starting at `openIdx`, tracking nesting. */
function balancedDivContent(html: string, openIdx: number): string | null {
  const start = html.indexOf(">", openIdx)
  if (start === -1) return null
  let depth = 1
  const re = /<div\b|<\/div>/gi
  re.lastIndex = start + 1
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    depth += m[0] === "</div>" ? -1 : 1
    if (depth === 0) return html.slice(start + 1, m.index)
  }
  return null
}

/** Convert a description HTML fragment to readable plain text. */
function htmlToText(fragment: string): string {
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

/**
 * Parse the job detail page. Field anchors:
 * - title:       <span ... data-cy="jobTitle">
 * - company:     <a href="/fr-fr/entreprises/..."> inside the <h1> (absent for
 *                anonymous offers); fallback: dataLayer "Nom-Entreprise"
 * - loc/contract: <ul class="mt-3 inline-flex"> list items
 * - salary:      data-cy="salary-tag-button" span
 * - tags:        <li class="...tag-secondary-s border-0 readonly"> in the header tag list
 * - date:        dataLayer "datePublicationOffre":"YYYYMMDD"
 * - description: heading spans (text-left typo-m-bold) paired with the nearest
 *                following body: data-truncate-text-target="content" divs
 *                (sections) and typo-long-m break-words divs (details blocks)
 */
export function parseJobDetail(html: string, id: string): JobDetail {
  const titleM = html.match(/data-cy="jobTitle"[^>]*>([\s\S]*?)<\/span>/i)
  const title = titleM ? clean(titleM[1]) : "(untitled)"
  const titleIdx = titleM ? html.indexOf(titleM[0]) : 0

  // Company: the /fr-fr/entreprises/ link right after the title inside the <h1>.
  let company: string | null = null
  const headerZone = html.slice(titleIdx, titleIdx + 2500)
  const companyM = headerZone.match(
    /href="\/fr-fr\/entreprises\/[^"]*"[^>]*>([\s\S]*?)<\/a>/i,
  )
  if (companyM) company = clean(companyM[1]) || null
  if (!company) {
    const dl = html.match(/"Nom-Entreprise":"([^"]*)"/)
    if (dl && dl[1]) company = clean(dl[1]) || null
  }

  // Location + contract: the first <ul class="mt-3 inline-flex"> after the title.
  let location: string | null = null
  let contract: string | null = null
  const metaUl = headerZone.match(/<ul class="mt-3 inline-flex">([\s\S]*?)<\/ul>/i)
  if (metaUl) {
    const items = [...metaUl[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((m) =>
      clean(m[1]),
    )
    location = items[0] || null
    contract = items[1] || null
  }
  if (!contract) {
    const dl = html.match(/"contrat":"([^"]*)"/)
    if (dl && dl[1]) contract = clean(dl[1]) || null
  }

  // Salary + tags: the header tag list.
  let salary: string | null = null
  const salaryM = html.match(
    /data-cy="salary-tag-button"[\s\S]{0,600}?<span[^>]*>([\s\S]*?)<\/span>/i,
  )
  if (salaryM) salary = clean(salaryM[1]) || null

  const tags: string[] = []
  const tagZone = html.slice(titleIdx, titleIdx + 12000)
  for (const m of tagZone.matchAll(
    /<li class="[^"]*tag-secondary-s border-0 readonly[^"]*"[^>]*>([\s\S]*?)<\/li>/gi,
  )) {
    const t = clean(m[1])
    if (t) tags.push(t)
  }

  // Posting date from the analytics dataLayer (YYYYMMDD).
  let date: string | null = null
  const pub = html.match(/"datePublicationOffre":"(\d{4})(\d{2})(\d{2})"/)
  if (pub) date = `${pub[1]}-${pub[2]}-${pub[3]}`
  if (!date) {
    const visible = html.match(/Publi&#xE9;e le (\d{2})\/(\d{2})\/(\d{4})/i)
    if (visible) date = `${visible[3]}-${visible[2]}-${visible[1]}`
  }

  // Description: pair each body block with the nearest preceding section heading.
  const headings: { idx: number; text: string }[] = []
  for (const m of html.matchAll(
    /<span\s+class="text-left typo-m-bold[^"]*">([\s\S]*?)<\/span>/gi,
  )) {
    headings.push({ idx: m.index ?? 0, text: clean(m[1]) })
  }

  const bodies: { idx: number; text: string }[] = []
  const bodyAnchor =
    /<div[^>]*(?:data-truncate-text-target="content"|class="typo-long-m break-words")[^>]*>/gi
  let bm: RegExpExecArray | null
  while ((bm = bodyAnchor.exec(html)) !== null) {
    const content = balancedDivContent(html, bm.index)
    if (content) {
      const text = htmlToText(content)
      if (text) bodies.push({ idx: bm.index, text })
    }
  }

  let description: string | null = null
  if (bodies.length > 0) {
    const parts = bodies.map((b) => {
      const heading = [...headings].reverse().find((h) => h.idx < b.idx)
      return heading ? `## ${heading.text}\n\n${b.text}` : b.text
    })
    description = parts.join("\n\n")
  }
  if (!description) {
    const meta = html.match(/<meta name="description" content="([^"]*)"/i)
    if (meta) description = clean(meta[1]) || null
  }

  return {
    id,
    title,
    company,
    location,
    date,
    url: detailUrl(id),
    contract,
    salary,
    description,
    tags,
  }
}
