import { apiGet, CliError, mapOffreDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/**
 * Accept a raw offer id (e.g. "197XKRB", alphanumeric) or a public posting
 * URL (candidat.francetravail.fr/offres/recherche/detail/<id>).
 */
export function normalizeId(input: string): string | null {
  const fromUrl = input.match(/\/detail\/([0-9A-Za-z]{4,12})(?:[/?#]|$)/)
  if (fromUrl) return fromUrl[1].toUpperCase()
  const bare = input.match(/^[0-9A-Za-z]{4,12}$/)
  if (bare) return input.toUpperCase()
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse an offer ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const response = await apiGet(`/offres/${encodeURIComponent(id)}`)
    // The API answers 204 (empty body) when the offer does not exist.
    if (response.json === null) {
      writeError(`Offer ${id} not found`, "NOT_FOUND")
      return 1
    }
    const job = mapOffreDetail(response.json)

    if (opts.format === "plain") {
      const lines = [
        job.title || "(untitled)",
        `${job.company || "—"} · ${job.location || "—"} · ${job.contract || "—"}`,
        job.salary ? `Salary: ${job.salary}` : "",
        job.experience ? `Experience: ${job.experience}` : "",
        job.duration ? `Hours: ${job.duration}` : "",
        job.romeLibelle ? `ROME: ${job.romeLibelle}` : "",
        job.alternance ? "Alternance: yes" : "",
        job.date ? `Published: ${job.date}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
        job.applyUrl && job.applyUrl !== job.url ? `Apply: ${job.applyUrl}` : "",
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    if (e instanceof CliError) writeError(e.message, e.code)
    else writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
