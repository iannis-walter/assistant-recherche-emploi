import {
  apiGet,
  buildRange,
  CliError,
  jobageToPublieeDepuis,
  mapOffre,
  parseTotal,
  resolveLocation,
  writeError,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** Server page size: request exactly what --limit asks for (API max 150). */
export function pageSize(limit: number | undefined): number {
  if (limit !== undefined && limit > 0) return Math.min(limit, 150)
  return 20
}

export function buildQuery(opts: SearchOpts): string {
  const params = new URLSearchParams()
  if (opts.query) params.set("motsCles", opts.query)
  if (opts.location) {
    const loc = resolveLocation(opts.location)
    params.set(loc.param, loc.value)
  }
  const depuis = jobageToPublieeDepuis(opts.jobage)
  if (depuis !== null) params.set("publieeDepuis", String(depuis))
  params.set("range", buildRange(opts.page, pageSize(opts.limit)))
  return params.toString()
}

export function renderTable(results: JobResult[]): string {
  if (results.length === 0) return "No results."
  const rows = results.map((r) => {
    const id = (r.id || "—").slice(0, 10).padEnd(10)
    const title = (r.title || "—").slice(0, 40).padEnd(40)
    const company = (r.company || "—").slice(0, 24).padEnd(24)
    const loc = (r.location || "—").slice(0, 22).padEnd(22)
    const contract = (r.contract || "—").slice(0, 4).padEnd(4)
    const date = (r.date || "—").slice(0, 10)
    return `${id} ${title} ${company} ${loc} ${contract} ${date}`
  })
  const header =
    "ID".padEnd(10) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(24) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "TYPE".padEnd(4) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export function renderPlain(results: JobResult[]): string {
  if (results.length === 0) return "No results."
  return results
    .map(
      (r) =>
        `${r.title || "(untitled)"}\n  ${r.company || "—"} · ${r.location || "—"} · ${
          r.contract || "—"
        } · ${r.salary || "—"} · ${(r.date || "—").slice(0, 10)}\n  id: ${r.id}\n  ${r.url}`,
    )
    .join("\n\n")
}

interface RawSearchBody {
  resultats?: unknown[]
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const response = await apiGet(`/offres/search?${buildQuery(opts)}`)
    // 204 = no matching offers (empty body).
    const body = (response.json ?? {}) as RawSearchBody
    let results = (Array.isArray(body.resultats) ? body.resultats : []).map(mapOffre)
    if (opts.limit !== undefined && opts.limit >= 0) results = results.slice(0, opts.limit)
    const total = parseTotal(response.contentRange)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(results) + "\n")
    } else {
      const meta: { count: number; page: number; total?: number } = {
        count: results.length,
        page: opts.page,
      }
      if (total !== null) meta.total = total
      process.stdout.write(JSON.stringify({ meta, results }, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    if (e instanceof CliError) writeError(e.message, e.code)
    else writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
