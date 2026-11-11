import { describe, test, expect } from "bun:test";
import {
  htmlToText,
  hitToResult,
  withinDays,
  normalizeDetailInput,
  jobUrl,
  officeLabel,
  formatSalary,
  JOBS_INDEX,
  JOBS_INDEX_BY_DATE,
} from "../src/helpers";
import { buildSearchRequest, renderTable, type SearchOpts } from "../src/commands/search";
import { restJobToDetail } from "../src/commands/detail";

// Fixture condensed from a real Algolia hit on wk_cms_jobs_production
// (query "développeur python", July 2026), preserving the exact field paths
// the mapper relies on.
const HIT_FIXTURE = {
  objectID: "3870114",
  name: "Développeur Senior Python |  Practice SE MARGO",
  slug: "developpeur-senior-python-practice-se-margo_paris",
  published_at: "2026-07-09T08:00:00.000+02:00",
  contract_type: "FULL_TIME",
  contract_type_names: { fr: "CDI", en: "Permanent contract" },
  remote: "partial",
  salary_minimum: null,
  salary_maximum: null,
  salary_currency: null,
  salary_period: null,
  organization: { name: "MARGO", slug: "margo" },
  offices: [{ city: "Paris", state: "Ile-de-France", country: "France", country_code: "FR" }],
  office: { city: "Paris", country: "France" },
};

const baseOpts: SearchOpts = { query: "python", jobage: 9999, page: 1, format: "json" };

describe("hitToResult", () => {
  test("maps a real Algolia hit to the shared result shape", () => {
    const r = hitToResult(HIT_FIXTURE);
    expect(r).not.toBeNull();
    expect(r!.id).toBe("3870114");
    expect(r!.title).toBe("Développeur Senior Python |  Practice SE MARGO");
    expect(r!.company).toBe("MARGO");
    expect(r!.location).toBe("Paris, France");
    expect(r!.date).toBe("2026-07-09T08:00:00.000+02:00");
    expect(r!.url).toBe(
      "https://www.welcometothejungle.com/fr/companies/margo/jobs/developpeur-senior-python-practice-se-margo_paris",
    );
    expect(r!.contract).toBe("CDI");
    expect(r!.remote).toBe("partial");
    expect(r!.salary).toBeNull();
  });

  test("missing fields become null, never omitted", () => {
    const r = hitToResult({ objectID: "1", name: "X" })!;
    for (const key of ["company", "location", "date", "url", "contract", "remote", "salary"]) {
      expect(r).toHaveProperty(key, null);
    }
  });

  test("malformed hits return null instead of throwing", () => {
    expect(hitToResult(null)).toBeNull();
    expect(hitToResult({})).toBeNull();
    expect(hitToResult({ objectID: "1" })).toBeNull(); // no title
  });
});

describe("buildSearchRequest", () => {
  test("query, 0-indexed page, and page size", () => {
    const req = buildSearchRequest({ ...baseOpts, page: 2 });
    const params = new URLSearchParams(req.params);
    expect(req.indexName).toBe(JOBS_INDEX);
    expect(params.get("query")).toBe("python");
    expect(params.get("page")).toBe("1"); // CLI page 2 -> Algolia page 1
    expect(params.get("hitsPerPage")).toBe("30");
    expect(params.get("facetFilters")).toBeNull();
  });

  test("location becomes an OR facetFilters group over city/state/country", () => {
    const req = buildSearchRequest({ ...baseOpts, location: "Lyon" });
    const facetFilters = JSON.parse(new URLSearchParams(req.params).get("facetFilters")!);
    expect(facetFilters).toEqual([
      ["offices.city:Lyon", "offices.state:Lyon", "offices.country:Lyon"],
    ]);
  });

  test("--jobage switches to the date-sorted replica index", () => {
    expect(buildSearchRequest({ ...baseOpts, jobage: 7 }).indexName).toBe(JOBS_INDEX_BY_DATE);
    expect(buildSearchRequest(baseOpts).indexName).toBe(JOBS_INDEX);
  });
});

describe("withinDays", () => {
  const now = new Date("2026-07-09T12:00:00Z");
  test("keeps recent dates, drops old ones", () => {
    expect(withinDays("2026-07-08T00:00:00Z", 7, now)).toBe(true);
    expect(withinDays("2026-06-01T00:00:00Z", 7, now)).toBe(false);
  });
  test("null or garbage dates are excluded", () => {
    expect(withinDays(null, 7, now)).toBe(false);
    expect(withinDays("not-a-date", 7, now)).toBe(false);
  });
});

describe("normalizeDetailInput", () => {
  test("numeric objectID", () => {
    expect(normalizeDetailInput("3870114")).toEqual({ kind: "id", id: "3870114" });
  });
  test("fr posting URL", () => {
    expect(
      normalizeDetailInput(
        "https://www.welcometothejungle.com/fr/companies/margo/jobs/developpeur-senior-python-practice-se-margo_paris",
      ),
    ).toEqual({
      kind: "slugs",
      org: "margo",
      job: "developpeur-senior-python-practice-se-margo_paris",
    });
  });
  test("en posting URL with query string", () => {
    expect(
      normalizeDetailInput("https://www.welcometothejungle.com/en/companies/alan/jobs/some-job?q=x"),
    ).toEqual({ kind: "slugs", org: "alan", job: "some-job" });
  });
  test("garbage returns null", () => {
    expect(normalizeDetailInput("not-an-id!")).toBeNull();
    expect(normalizeDetailInput("https://example.com/jobs/1")).toBeNull();
  });
});

describe("htmlToText", () => {
  test("strips tags, decodes entities, keeps paragraph breaks and bullets", () => {
    const html =
      "<p><strong>Qui sommes&#8209;nous&nbsp;?</strong></p><p>Chez MARGO &amp; co.</p><ul><li>Python</li><li>Django</li></ul>";
    const text = htmlToText(html)!;
    expect(text).toContain("Qui sommes‑nous ?");
    expect(text).toContain("Chez MARGO & co.");
    expect(text).toContain("- Python");
    expect(text).toContain("- Django");
    expect(text).not.toMatch(/<[^>]+>/);
  });
  test("empty input returns null", () => {
    expect(htmlToText("")).toBeNull();
    expect(htmlToText(null)).toBeNull();
    expect(htmlToText("<p>  </p>")).toBeNull();
  });
});

describe("small formatters", () => {
  test("jobUrl needs both slugs", () => {
    expect(jobUrl("margo", "x")).toBe("https://www.welcometothejungle.com/fr/companies/margo/jobs/x");
    expect(jobUrl(null, "x")).toBeNull();
    expect(jobUrl("margo", null)).toBeNull();
  });
  test("officeLabel", () => {
    expect(officeLabel({ city: "Paris", country: "France" })).toBe("Paris, France");
    expect(officeLabel({ city: "Paris" })).toBe("Paris");
    expect(officeLabel(null)).toBeNull();
    expect(officeLabel({})).toBeNull();
  });
  test("formatSalary", () => {
    expect(formatSalary(40000, 55000, "EUR", "yearly")).toBe("40000–55000 EUR/yearly");
    expect(formatSalary(40000, null, "EUR", null)).toBe("40000 EUR");
    expect(formatSalary(null, null, null, null)).toBeNull();
  });
  test("renderTable handles empty results", () => {
    expect(renderTable([])).toBe("No results.");
  });
});

describe("restJobToDetail", () => {
  // Condensed from a real api.welcometothejungle.com job payload (July 2026).
  const REST_FIXTURE = {
    name: "Développeur Senior Python |  Practice SE MARGO",
    slug: "developpeur-senior-python-practice-se-margo_paris",
    published_at: "2026-07-09T06:28:48Z",
    contract_type: "full_time",
    remote: "partial",
    apply_url: "https://jobs.lever.co/margo-group/xyz/apply",
    reference: "MARGO_0ljkMQz",
    description: "<p><strong>Qui sommes nous ?</strong></p><p>Chez MARGO…</p>",
    profile: "<p>Nous recrutons un <b>Senior Software Engineer Python</b>.</p>",
    recruitment_process: null,
    company_description: null,
    salary_min: null,
    salary_max: null,
    salary_currency: null,
    salary_period: null,
    experience_level: null,
    education_level: null,
    organization: { name: "MARGO", slug: "margo" },
    offices: [{ city: "Paris", country: "France" }],
  };

  test("maps the REST payload", () => {
    const d = restJobToDetail(REST_FIXTURE, "margo", "3870114");
    expect(d.id).toBe("3870114");
    expect(d.title).toBe("Développeur Senior Python |  Practice SE MARGO");
    expect(d.company).toBe("MARGO");
    expect(d.location).toBe("Paris, France");
    expect(d.url).toBe(
      "https://www.welcometothejungle.com/fr/companies/margo/jobs/developpeur-senior-python-practice-se-margo_paris",
    );
    expect(d.description).toContain("Qui sommes nous ?");
    expect(d.profile).toContain("Senior Software Engineer Python");
    expect(d.applyUrl).toBe("https://jobs.lever.co/margo-group/xyz/apply");
    expect(d.recruitmentProcess).toBeNull();
  });

  test("falls back to the reference when no numeric id is known", () => {
    const d = restJobToDetail(REST_FIXTURE, "margo", null);
    expect(d.id).toBe("MARGO_0ljkMQz");
  });
});
