import {
  DETAIL_ENDPOINT,
  jsonFetch,
  mapDetail,
  normalizeNumeroOffre,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string
  format: "json" | "plain"
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const numero = normalizeNumeroOffre(opts.id)
  if (!numero) {
    writeError(`Could not parse an APEC offer number from "${opts.id}"`, "BAD_ID")
    return 1
  }
  try {
    const params = new URLSearchParams({ numeroOffre: numero })
    const raw = await jsonFetch(`${DETAIL_ENDPOINT}?${params.toString()}`)
    if (raw === null) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }
    const job = mapDetail(raw, numero)

    if (opts.format === "plain") {
      const lines = [
        job.title,
        `${job.company || "—"} · ${job.location || "—"} · ${job.contract || "—"}`,
        job.salary ? `Salary: ${job.salary}` : "",
        job.skills.length > 0 ? `Skills: ${job.skills.join(", ")}` : "",
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
