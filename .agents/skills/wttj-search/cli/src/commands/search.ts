import {
  JOBS_INDEX,
  JOBS_INDEX_BY_DATE,
  algoliaQuery,
  hitToResult,
  withinDays,
  writeError,
  type AlgoliaRequest,
  type JobResult,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number // 9999 = no age filter
  page: number // 1-indexed
  limit?: number
  format: "json" | "table" | "plain"
}

export const PAGE_SIZE = 30

/**
 * Build the Algolia request for a search. Location matches the `offices.city`
 * OR `offices.state` facet (inner array = OR in Algolia facetFilters), so both
 * "Lyon" and "Ile-de-France" work. Facet-value matching is case-insensitive.
 * When --jobage is set we query the date-sorted replica so client-side date
 * filtering sees the newest postings first.
 */
export function buildSearchRequest(opts: SearchOpts): AlgoliaRequest {
  const params = new URLSearchParams()
  params.set("query", opts.query ?? "")
  params.set("hitsPerPage", String(PAGE_SIZE))
  params.set("page", String(opts.page - 1)) // Algolia pages are 0-indexed
  params.set(
    "attributesToRetrieve",
    [
      "objectID",
      "name",
      "slug",
      "organization.name",
      "organization.slug",
      "offices",
      "office",
      "published_at",
      "contract_type",
      "contract_type_names",
      "remote",
      "salary_minimum",
      "salary_maximum",
      "salary_currency",
      "salary_period",
    ].join(","),
  )
  params.set("attributesToHighlight", "")
  params.set("attributesToSnippet", "")
  if (opts.location) {
    const loc = opts.location
    params.set(
      "facetFilters",
      JSON.stringify([[
        `offices.city:${loc}`,
        `offices.state:${loc}`,
        `offices.country:${loc}`,
      ]]),
    )
  }
  const useDateReplica = opts.jobage > 0 && opts.jobage < 9999
  return {
    indexName: useDateReplica ? JOBS_INDEX_BY_DATE : JOBS_INDEX,
    params: params.toString(),
  }
}

export function renderTable(results: JobResult[]): string {
  if (results.length === 0) return "No results."
  const rows = results.map((r) => {
    const title = (r.title || "").slice(0, 40).padEnd(40)
    const company = (r.company || "—").slice(0, 22).padEnd(22)
    const loc = (r.location || "—").slice(0, 22).padEnd(22)
    const contract = (r.contract || "—").slice(0, 12).padEnd(12)
    const date = r.date ? r.date.slice(0, 10) : "—"
    return `${r.id.padEnd(9)} ${title} ${company} ${loc} ${contract} ${date}`
  })
  const header =
    "ID".padEnd(9) +
    " " +
    "TITLE".padEnd(40) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "CONTRACT".padEnd(12) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export function renderPlain(results: JobResult[]): string {
  if (results.length === 0) return "No results."
  return results
    .map(
      (r) =>
        `${r.title}\n  ${r.company || "—"} · ${r.location || "—"} · ${r.contract || "—"} · ${
          r.date ? r.date.slice(0, 10) : "—"
        }${r.salary ? ` · ${r.salary}` : ""}\n  id: ${r.id}\n  ${r.url || "—"}`,
    )
    .join("\n\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    const [res] = await algoliaQuery([buildSearchRequest(opts)])
    if (res?.message) throw new Error(`Algolia error: ${res.message}`)

    let results = ((res?.hits as any[]) ?? [])
      .map(hitToResult)
      .filter((r): r is JobResult => r !== null)

    // No numeric timestamp attribute exists on the index, so --jobage is a
    // client-side filter over the (date-sorted) page we fetched.
    if (opts.jobage > 0 && opts.jobage < 9999) {
      results = results.filter((r) => withinDays(r.date, opts.jobage))
    }
    if (opts.limit !== undefined && opts.limit >= 0) results = results.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(results) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(renderPlain(results) + "\n")
    } else {
      process.stdout.write(
        JSON.stringify(
          {
            meta: {
              count: results.length,
              page: opts.page,
              totalHits: res?.nbHits ?? null,
              totalPages: res?.nbPages ?? null,
            },
            results,
          },
          null,
          2,
        ) + "\n",
      )
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "SEARCH_FAILED")
    return 1
  }
}
