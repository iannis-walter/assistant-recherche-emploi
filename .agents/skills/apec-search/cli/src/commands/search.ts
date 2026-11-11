import {
  SEARCH_ENDPOINT,
  PAGE_SIZE,
  jsonFetch,
  jobageToAnciennete,
  mapSearchResult,
  resolveLieu,
  writeError,
  type JobCard,
} from "../helpers.js"

export interface SearchOpts {
  query?: string
  location?: string
  jobage: number
  page: number
  limit?: number
  format: "json" | "table" | "plain"
}

/** Minimal verified rechercheOffre body (see url-reference.md). */
export function buildBody(opts: SearchOpts, lieuIds: number[]): Record<string, unknown> {
  const body: Record<string, unknown> = {
    pagination: { range: PAGE_SIZE, startIndex: (opts.page - 1) * PAGE_SIZE },
    sorts: [{ type: "DATE", direction: "DESCENDING" }],
    activeFiltre: true,
  }
  if (opts.query) body.motsCles = opts.query
  if (lieuIds.length > 0) body.lieux = lieuIds
  const anciennete = jobageToAnciennete(opts.jobage)
  if (anciennete !== null) body.anciennetePublication = anciennete
  return body
}

function renderTable(cards: JobCard[]): string {
  if (cards.length === 0) return "No results."
  const rows = cards.map((c) => {
    const title = (c.title || "").slice(0, 42).padEnd(42)
    const company = (c.company || "—").slice(0, 22).padEnd(22)
    const loc = (c.location || "—").slice(0, 22).padEnd(22)
    const salary = (c.salary || "—").slice(0, 24).padEnd(24)
    const date = c.date || "—"
    return `${c.id.padEnd(11)} ${title} ${company} ${loc} ${salary} ${date}`
  })
  const header =
    "ID".padEnd(11) +
    " " +
    "TITLE".padEnd(42) +
    " " +
    "COMPANY".padEnd(22) +
    " " +
    "LOCATION".padEnd(22) +
    " " +
    "SALARY".padEnd(24) +
    " DATE"
  return [header, "-".repeat(header.length), ...rows].join("\n")
}

export async function runSearch(opts: SearchOpts): Promise<number> {
  try {
    let lieuIds: number[] = []
    if (opts.location) {
      const lieu = await resolveLieu(opts.location)
      if (!lieu) {
        writeError(
          `No APEC location matches "${opts.location}" (try a French city, département, or region name)`,
          "LOCATION_NOT_FOUND",
        )
        return 1
      }
      lieuIds = [lieu.lieuId]
    }

    const data = (await jsonFetch(SEARCH_ENDPOINT, buildBody(opts, lieuIds))) as {
      resultats?: unknown[]
      totalCount?: number
    } | null

    const raw = Array.isArray(data?.resultats) ? data.resultats : []
    let cards = raw
      .map(mapSearchResult)
      .filter((c): c is JobCard => c !== null)
    const total = typeof data?.totalCount === "number" ? data.totalCount : null
    if (opts.limit !== undefined && opts.limit >= 0) cards = cards.slice(0, opts.limit)

    if (opts.format === "table") {
      process.stdout.write(renderTable(cards) + "\n")
    } else if (opts.format === "plain") {
      process.stdout.write(
        cards
          .map(
            (c) =>
              `${c.title}\n  ${c.company || "—"} · ${c.location || "—"} · ${c.contract || "—"} · ${c.salary || "—"} · ${c.date || "—"}\n  id: ${c.id}\n  ${c.url}`,
          )
          .join("\n\n") + "\n",
      )
    } else {
      process.stdout.write(
        JSON.stringify(
          { meta: { count: cards.length, page: opts.page, total }, results: cards },
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
