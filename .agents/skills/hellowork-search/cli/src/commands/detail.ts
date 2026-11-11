import { detailUrl, htmlFetch, parseJobDetail, writeError } from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

/** Accept a raw offer ID or a hellowork.com /fr-fr/emplois/{id}.html URL. */
export function normalizeId(input: string): string | null {
  const url = input.match(/emplois\/(\d+)\.html/)
  if (url) return url[1]
  const bare = input.match(/^\d{4,}$/)
  if (bare) return input
  return null
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const id = normalizeId(opts.id)
  if (!id) {
    writeError(`Could not parse an offer ID from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const html = await htmlFetch(detailUrl(id))
    if (!html) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = parseJobDetail(html, id)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"} · ${job.contract || "—"}`,
        job.salary ? `Salary: ${job.salary}` : "",
        job.tags.length > 0 ? `Tags: ${job.tags.join(", ")}` : "",
        job.date ? `Published: ${job.date}` : "",
        "",
        job.description || "(no description)",
        "",
        `URL: ${job.url}`,
      ].filter((l) => l !== "")
      process.stdout.write(lines.join("\n") + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
