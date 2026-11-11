import {
  DETAIL_API,
  algoliaGetObject,
  restGet,
  htmlToText,
  jobUrl,
  officeLabel,
  formatSalary,
  normalizeDetailInput,
  writeError,
} from "../helpers.js"

export interface DetailOpts {
  id: string // numeric objectID from search results, or a posting URL
  format: "json" | "plain"
}

export interface JobDetail {
  id: string
  title: string
  company: string | null
  location: string | null
  date: string | null
  url: string | null
  contract: string | null
  remote: string | null
  salary: string | null
  experience: string | null
  education: string | null
  description: string | null
  profile: string | null
  recruitmentProcess: string | null
  companyDescription: string | null
  applyUrl: string | null
  reference: string | null
}

/** Map the REST /organizations/{org}/jobs/{slug} payload to JobDetail. */
export function restJobToDetail(job: any, orgSlug: string, numericId: string | null): JobDetail {
  const office = (Array.isArray(job.offices) && job.offices[0]) || job.office || null
  return {
    id: numericId ?? (job.reference ? String(job.reference) : String(job.slug ?? "")),
    title: job.name ? String(job.name) : "(untitled)",
    company: job.organization?.name ?? null,
    location: officeLabel(office),
    date: job.published_at ?? null,
    url: jobUrl(orgSlug, job.slug),
    contract: job.contract_type ?? null,
    remote: job.remote ?? null,
    salary: formatSalary(job.salary_min, job.salary_max, job.salary_currency, job.salary_period),
    experience: job.experience_level ?? null,
    education: job.education_level ?? null,
    description: htmlToText(job.description),
    profile: htmlToText(job.profile),
    recruitmentProcess: htmlToText(job.recruitment_process),
    companyDescription: htmlToText(job.company_description),
    applyUrl: job.apply_url ?? null,
    reference: job.reference ?? null,
  }
}

function renderPlain(job: JobDetail): string {
  const section = (label: string, text: string | null): string[] =>
    text ? ["", `## ${label}`, text] : []
  const lines = [
    job.title,
    `${job.company || "—"} · ${job.location || "—"} · ${job.contract || "—"}${
      job.remote ? ` · remote: ${job.remote}` : ""
    }`,
    job.salary ? `Salary: ${job.salary}` : "",
    job.experience ? `Experience: ${job.experience}` : "",
    job.education ? `Education: ${job.education}` : "",
    job.date ? `Published: ${job.date}` : "",
    ...section("Descriptif du poste", job.description),
    ...section("Profil recherché", job.profile),
    ...section("Déroulement des entretiens", job.recruitmentProcess),
    "",
    `URL: ${job.url || "—"}`,
    job.applyUrl ? `Apply: ${job.applyUrl}` : "",
  ].filter((l) => l !== "")
  return lines.join("\n")
}

export async function runDetail(opts: DetailOpts): Promise<number> {
  const ref = normalizeDetailInput(opts.id)
  if (!ref) {
    writeError(
      `Could not parse a job ID or posting URL from "${opts.id}" (expected a numeric ID from search results or a welcometothejungle.com/.../companies/<org>/jobs/<slug> URL)`,
      "BAD_ID",
    )
    return 1
  }

  try {
    let orgSlug: string
    let jobSlug: string
    let numericId: string | null = null

    if (ref.kind === "id") {
      // Resolve the Algolia objectID to org + job slugs first.
      numericId = ref.id
      const obj = await algoliaGetObject(ref.id, ["slug", "organization.slug"])
      if (!obj || !obj.slug || !obj.organization?.slug) {
        writeError("Job not found", "NOT_FOUND")
        return 1
      }
      orgSlug = obj.organization.slug
      jobSlug = obj.slug
    } else {
      orgSlug = ref.org
      jobSlug = ref.job
    }

    const payload = await restGet(`${DETAIL_API}/${orgSlug}/jobs/${jobSlug}`)
    if (!payload || !payload.job) {
      writeError("Job not found", "NOT_FOUND")
      return 1
    }

    const job = restJobToDetail(payload.job, orgSlug, numericId)
    if (opts.format === "plain") {
      process.stdout.write(renderPlain(job) + "\n")
    } else {
      process.stdout.write(JSON.stringify(job, null, 2) + "\n")
    }
    return 0
  } catch (e) {
    writeError(e instanceof Error ? e.message : String(e), "DETAIL_FAILED")
    return 1
  }
}
