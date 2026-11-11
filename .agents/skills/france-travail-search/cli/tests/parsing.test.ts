import { describe, test, expect } from "bun:test";
import {
  buildRange,
  jobageToPublieeDepuis,
  mapOffre,
  mapOffreDetail,
  parseTotal,
  publicUrl,
  resolveLocation,
} from "../src/helpers";
import { buildQuery, pageSize, renderTable, renderPlain } from "../src/commands/search";
import { normalizeId } from "../src/commands/detail";

// Pure-function unit tests — no network, no credentials.

// A trimmed real-shaped `Offre` object as returned by the v2 API.
const SAMPLE_OFFRE = {
  id: "197XKRB",
  intitule: "Développeur / Développeuse Python (H/F)",
  description: "Vos missions :\n- développer des services backend\n- écrire des tests",
  dateCreation: "2026-07-08T09:15:30.000Z",
  lieuTravail: { libelle: "33 - BORDEAUX", codePostal: "33000", commune: "33063" },
  entreprise: { nom: "ACME TECH" },
  typeContrat: "CDI",
  typeContratLibelle: "Contrat à durée indéterminée",
  experienceLibelle: "2 An(s)",
  romeLibelle: "Études et développement informatique",
  dureeTravailLibelle: "35H/semaine",
  alternance: false,
  salaire: { libelle: "Annuel de 40000.0 Euros à 50000.0 Euros" },
  contact: { urlPostulation: "https://example.com/postuler" },
  origineOffre: {
    origine: "1",
    urlOrigine: "https://candidat.francetravail.fr/offres/recherche/detail/197XKRB",
  },
};

describe("jobageToPublieeDepuis", () => {
  test("rounds up to the API's supported values 1/3/7/14/31", () => {
    expect(jobageToPublieeDepuis(1)).toBe(1);
    expect(jobageToPublieeDepuis(2)).toBe(3);
    expect(jobageToPublieeDepuis(3)).toBe(3);
    expect(jobageToPublieeDepuis(5)).toBe(7);
    expect(jobageToPublieeDepuis(8)).toBe(14);
    expect(jobageToPublieeDepuis(20)).toBe(31);
    expect(jobageToPublieeDepuis(31)).toBe(31);
  });

  test("out-of-range ages mean no filter", () => {
    expect(jobageToPublieeDepuis(0)).toBeNull();
    expect(jobageToPublieeDepuis(-4)).toBeNull();
    expect(jobageToPublieeDepuis(32)).toBeNull();
    expect(jobageToPublieeDepuis(9999)).toBeNull();
  });
});

describe("resolveLocation", () => {
  test("5-digit INSEE code maps to commune", () => {
    expect(resolveLocation("33063")).toEqual({ param: "commune", value: "33063" });
  });

  test("department numbers map to departement (incl. Corsica and DOM)", () => {
    expect(resolveLocation("75")).toEqual({ param: "departement", value: "75" });
    expect(resolveLocation("2a")).toEqual({ param: "departement", value: "2A" });
    expect(resolveLocation("972")).toEqual({ param: "departement", value: "972" });
  });

  test("explicit prefixes force the parameter", () => {
    expect(resolveLocation("commune:69123")).toEqual({ param: "commune", value: "69123" });
    expect(resolveLocation("departement:33")).toEqual({ param: "departement", value: "33" });
    expect(resolveLocation("dept:33")).toEqual({ param: "departement", value: "33" });
    expect(resolveLocation("region:75")).toEqual({ param: "region", value: "75" });
  });

  test("major city names resolve to their INSEE commune codes", () => {
    expect(resolveLocation("Paris")).toEqual({ param: "commune", value: "75056" });
    expect(resolveLocation("BORDEAUX")).toEqual({ param: "commune", value: "33063" });
    expect(resolveLocation("Nîmes")).toEqual({ param: "commune", value: "30189" });
    expect(resolveLocation("saint-étienne")).toEqual({ param: "commune", value: "42218" });
  });

  test("unknown locations throw BAD_LOCATION", () => {
    expect(() => resolveLocation("Trifouillis")).toThrow(/INSEE/);
  });
});

describe("pagination", () => {
  test("buildRange is 0-indexed p-d", () => {
    expect(buildRange(1, 20)).toBe("0-19");
    expect(buildRange(2, 20)).toBe("20-39");
    expect(buildRange(3, 50)).toBe("100-149");
  });

  test("pageSize follows --limit, capped at the API max of 150", () => {
    expect(pageSize(undefined)).toBe(20);
    expect(pageSize(5)).toBe(5);
    expect(pageSize(150)).toBe(150);
    expect(pageSize(500)).toBe(150);
  });

  test("parseTotal reads the Content-Range total", () => {
    expect(parseTotal("offres 0-19/1234")).toBe(1234);
    expect(parseTotal(null)).toBeNull();
    expect(parseTotal("garbage")).toBeNull();
  });
});

describe("buildQuery", () => {
  test("maps the contract flags to the API's parameter names", () => {
    const qs = new URLSearchParams(
      buildQuery({
        query: "python, django",
        location: "Paris",
        jobage: 5,
        page: 2,
        limit: 10,
        format: "json",
      }),
    );
    expect(qs.get("motsCles")).toBe("python, django");
    expect(qs.get("commune")).toBe("75056");
    expect(qs.get("publieeDepuis")).toBe("7");
    expect(qs.get("range")).toBe("10-19");
  });

  test("omits unset filters", () => {
    const qs = new URLSearchParams(
      buildQuery({ query: "python", jobage: 9999, page: 1, format: "json" }),
    );
    expect(qs.get("publieeDepuis")).toBeNull();
    expect(qs.get("commune")).toBeNull();
    expect(qs.get("departement")).toBeNull();
    expect(qs.get("range")).toBe("0-19");
  });
});

describe("mapOffre", () => {
  test("maps a full offer to the shared result shape", () => {
    const r = mapOffre(SAMPLE_OFFRE);
    expect(r).toEqual({
      id: "197XKRB",
      title: "Développeur / Développeuse Python (H/F)",
      company: "ACME TECH",
      location: "33 - BORDEAUX",
      date: "2026-07-08T09:15:30.000Z",
      url: "https://candidat.francetravail.fr/offres/recherche/detail/197XKRB",
      contract: "CDI",
      salary: "Annuel de 40000.0 Euros à 50000.0 Euros",
    });
  });

  test("missing fields become null, never omitted", () => {
    const r = mapOffre({ id: "123ABCD" });
    expect(r.title).toBeNull();
    expect(r.company).toBeNull();
    expect(r.location).toBeNull();
    expect(r.date).toBeNull();
    expect(r.contract).toBeNull();
    expect(r.salary).toBeNull();
    // url is always constructible from the id.
    expect(r.url).toBe(publicUrl("123ABCD"));
    expect(Object.keys(r).sort()).toEqual(
      ["company", "contract", "date", "id", "location", "salary", "title", "url"].sort(),
    );
  });

  test("mapOffreDetail adds description, experience, and applyUrl", () => {
    const d = mapOffreDetail(SAMPLE_OFFRE);
    expect(d.description).toMatch(/backend/);
    expect(d.experience).toBe("2 An(s)");
    expect(d.romeLibelle).toMatch(/développement informatique/);
    expect(d.alternance).toBe(false);
    expect(d.applyUrl).toBe("https://example.com/postuler");
  });
});

describe("output formatting", () => {
  const results = [mapOffre(SAMPLE_OFFRE), mapOffre({ id: "123ABCD" })];

  test("renderTable shows a header and one row per result", () => {
    const table = renderTable(results);
    const lines = table.split("\n");
    expect(lines[0]).toMatch(/ID\s+TITLE\s+COMPANY\s+LOCATION\s+TYPE\s+DATE/);
    expect(lines.length).toBe(2 + results.length);
    expect(table).toMatch(/197XKRB/);
    expect(table).toMatch(/ACME TECH/);
    expect(table).toMatch(/CDI/);
    // Missing values render as em dashes, not "null".
    expect(table).not.toMatch(/null/);
  });

  test("renderTable with no results says so", () => {
    expect(renderTable([])).toBe("No results.");
  });

  test("renderPlain includes id and url for each result", () => {
    const plain = renderPlain(results);
    expect(plain).toMatch(/id: 197XKRB/);
    expect(plain).toMatch(/candidat\.francetravail\.fr\/offres\/recherche\/detail\/197XKRB/);
    expect(plain).toMatch(/id: 123ABCD/);
  });
});

describe("normalizeId", () => {
  test("accepts bare alphanumeric ids and uppercases them", () => {
    expect(normalizeId("197XKRB")).toBe("197XKRB");
    expect(normalizeId("197xkrb")).toBe("197XKRB");
  });

  test("accepts public posting URLs", () => {
    expect(
      normalizeId("https://candidat.francetravail.fr/offres/recherche/detail/197XKRB"),
    ).toBe("197XKRB");
    expect(
      normalizeId("https://candidat.francetravail.fr/offres/recherche/detail/197xkrb?at_campaign=x"),
    ).toBe("197XKRB");
  });

  test("rejects garbage", () => {
    expect(normalizeId("not an id!!")).toBeNull();
    expect(normalizeId("https://example.com/foo")).toBeNull();
  });
});
