import { describe, test, expect } from "bun:test";
import {
  jobageToAnciennete,
  normalizeNumeroOffre,
  contractLabel,
  decodeHtmlEntities,
  htmlToText,
  toIsoDate,
  mapSearchResult,
  mapDetail,
  publicUrl,
} from "../src/helpers";
import { buildBody, type SearchOpts } from "../src/commands/search";

// Network-free: fixtures mirror the live rechercheOffre / offre/public
// responses captured during reconnaissance (see ../../url-reference.md).

const SEARCH_RESULT_FIXTURE = {
  id: 179064883,
  numeroOffre: "179064883W",
  intitule: "Ingénieur de recherche - Informatique quantique R&D F/H",
  nomCommercial: "BULL SAS",
  lieuTexte: "Les Clayes-sous-Bois - 78",
  salaireTexte: "50 - 55 k€ brut annuel",
  texteOffre: "Votre profil : Titulaire obligatoirement d’une thèse…",
  datePublication: "2026-07-09T08:34:55.000+0000",
  typeContrat: 101888,
};

const DETAIL_FIXTURE = {
  numeroOffre: "179064883W",
  intitule: "Ingénieur de recherche - Informatique quantique R&D F/H",
  enseigne: "BULL SAS",
  nomCompteEtablissement: "BULL SAS",
  lieux: [{ idNomLieu: 592049, libelleLieu: "Les Clayes-sous-Bois - 78" }],
  datePublication: "2026-07-09T08:34:55.000+0000",
  datePremierePublication: "2026-07-09T08:34:55.000+0000",
  salaireTexte: "50 - 55 k€ brut annuel",
  idNomTypeContrat: 101888,
  texteHtml:
    "<p><strong>Votre profil :</strong></p><p>Titulaire d&rsquo;une th&egrave;se en physique quantique.</p><ul><li>C++</li><li>Python</li></ul>",
  texteHtmlProfil: "<p>Vous &ecirc;tes familier des projets ANR.</p>",
  texteHtmlEntreprise: "<p><strong>Bull</strong> c&rsquo;est une histoire.</p>",
  competences: [
    { libelle: "Anglais", type: "LANGUE" },
    { libelle: "C++", type: "SAVOIR_FAIRE" },
    { libelle: "Python", type: "SAVOIR_FAIRE" },
  ],
  offreConfidentielle: false,
};

describe("jobageToAnciennete", () => {
  test("maps day ranges to APEC nomenclature codes", () => {
    expect(jobageToAnciennete(1)).toBe(101850);
    expect(jobageToAnciennete(3)).toBe(101851);
    expect(jobageToAnciennete(7)).toBe(101851);
    expect(jobageToAnciennete(8)).toBe(101852);
    expect(jobageToAnciennete(30)).toBe(101852);
  });

  test("returns null for out-of-range values (all offers)", () => {
    expect(jobageToAnciennete(0)).toBeNull();
    expect(jobageToAnciennete(-1)).toBeNull();
    expect(jobageToAnciennete(31)).toBeNull();
    expect(jobageToAnciennete(9999)).toBeNull();
  });
});

describe("normalizeNumeroOffre", () => {
  test("keeps a full numeroOffre, uppercasing the suffix", () => {
    expect(normalizeNumeroOffre("179064883W")).toBe("179064883W");
    expect(normalizeNumeroOffre("179064883w")).toBe("179064883W");
  });

  test("appends the W the webservice requires to a bare numeric id", () => {
    expect(normalizeNumeroOffre("179064883")).toBe("179064883W");
  });

  test("extracts the numeroOffre from a public detail URL", () => {
    expect(
      normalizeNumeroOffre(
        "https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/179064883W",
      ),
    ).toBe("179064883W");
    expect(
      normalizeNumeroOffre(
        "https://www.apec.fr/candidat/recherche-emploi.html/emploi/detail-offre/179064883W?selectedIndex=0&page=0",
      ),
    ).toBe("179064883W");
  });

  test("returns null on garbage", () => {
    expect(normalizeNumeroOffre("not-an-id!")).toBeNull();
    expect(normalizeNumeroOffre("")).toBeNull();
  });
});

describe("contractLabel", () => {
  test("maps verified nomenclature codes", () => {
    expect(contractLabel(101888)).toBe("CDI");
    expect(contractLabel(101887)).toBe("CDD");
    expect(contractLabel(597171)).toBe("Stage");
  });

  test("returns null for unknown or absent codes", () => {
    expect(contractLabel(42)).toBeNull();
    expect(contractLabel(undefined)).toBeNull();
    expect(contractLabel("101888")).toBeNull();
  });
});

describe("HTML cleanup", () => {
  test("decodes the named entities APEC actually emits", () => {
    expect(decodeHtmlEntities("d&rsquo;une th&egrave;se &agrave; Paris")).toBe(
      "d’une thèse à Paris",
    );
    expect(decodeHtmlEntities("50 k&euro; &amp; plus")).toBe("50 k€ & plus");
    expect(decodeHtmlEntities("&#233;t&#xE9;")).toBe("été");
  });

  test("htmlToText keeps list structure and paragraph breaks", () => {
    const text = htmlToText(
      "<p>Intro.</p><ul><li>C++</li><li>Python</li></ul><p>Fin.</p>",
    );
    expect(text).toContain("Intro.");
    expect(text).toContain("- C++");
    expect(text).toContain("- Python");
    expect(text).toContain("Fin.");
  });
});

describe("toIsoDate", () => {
  test("truncates APEC timestamps to YYYY-MM-DD", () => {
    expect(toIsoDate("2026-07-09T08:34:55.000+0000")).toBe("2026-07-09");
  });
  test("returns null on absent/garbage input", () => {
    expect(toIsoDate(undefined)).toBeNull();
    expect(toIsoDate("hier")).toBeNull();
  });
});

describe("mapSearchResult", () => {
  test("maps a live-shaped result to the portal contract", () => {
    const card = mapSearchResult(SEARCH_RESULT_FIXTURE);
    expect(card).not.toBeNull();
    expect(card!.id).toBe("179064883W");
    expect(card!.title).toBe("Ingénieur de recherche - Informatique quantique R&D F/H");
    expect(card!.company).toBe("BULL SAS");
    expect(card!.location).toBe("Les Clayes-sous-Bois - 78");
    expect(card!.date).toBe("2026-07-09");
    expect(card!.url).toBe(publicUrl("179064883W"));
    expect(card!.salary).toBe("50 - 55 k€ brut annuel");
    expect(card!.contract).toBe("CDI");
  });

  test("missing fields become null, never omitted", () => {
    const card = mapSearchResult({ numeroOffre: "123456W", intitule: "X" });
    expect(card).not.toBeNull();
    expect(card!.company).toBeNull();
    expect(card!.location).toBeNull();
    expect(card!.date).toBeNull();
    expect(card!.salary).toBeNull();
    expect(card!.contract).toBeNull();
    expect(Object.keys(card!)).toContain("company");
    expect(Object.keys(card!)).toContain("date");
  });

  test("returns null for a result without id or title", () => {
    expect(mapSearchResult({})).toBeNull();
    expect(mapSearchResult({ numeroOffre: "123W" })).toBeNull();
  });
});

describe("mapDetail", () => {
  test("assembles description sections with headings, decoded", () => {
    const job = mapDetail(DETAIL_FIXTURE, "179064883W");
    expect(job.id).toBe("179064883W");
    expect(job.company).toBe("BULL SAS");
    expect(job.location).toBe("Les Clayes-sous-Bois - 78");
    expect(job.salary).toBe("50 - 55 k€ brut annuel");
    expect(job.contract).toBe("CDI");
    expect(job.date).toBe("2026-07-09");
    expect(job.skills).toEqual(["Anglais", "C++", "Python"]);
    expect(job.description).toContain("## Le poste");
    expect(job.description).toContain("## Le profil recherché");
    expect(job.description).toContain("## L'entreprise");
    expect(job.description).toContain("d’une thèse en physique quantique");
    expect(job.description).toContain("- C++");
    expect(job.description).not.toContain("&rsquo;");
    expect(job.description).not.toContain("<p>");
  });

  test("tolerates an empty payload", () => {
    const job = mapDetail({}, "42W");
    expect(job.id).toBe("42W");
    expect(job.title).toBe("(untitled)");
    expect(job.company).toBeNull();
    expect(job.description).toBeNull();
    expect(job.skills).toEqual([]);
  });
});

describe("buildBody", () => {
  const base: SearchOpts = { jobage: 9999, page: 1, format: "json" };

  test("builds the minimal verified body", () => {
    const body = buildBody({ ...base, query: "data engineer" }, []);
    expect(body.motsCles).toBe("data engineer");
    expect(body.pagination).toEqual({ range: 20, startIndex: 0 });
    expect(body.sorts).toEqual([{ type: "DATE", direction: "DESCENDING" }]);
    expect(body.activeFiltre).toBe(true);
    expect(body).not.toHaveProperty("lieux");
    expect(body).not.toHaveProperty("anciennetePublication");
  });

  test("pages are 1-indexed onto startIndex offsets", () => {
    const body = buildBody({ ...base, query: "x", page: 3 }, []);
    expect(body.pagination).toEqual({ range: 20, startIndex: 40 });
  });

  test("jobage and lieux land in the body when given", () => {
    const body = buildBody({ ...base, query: "x", jobage: 7 }, [75]);
    expect(body.anciennetePublication).toBe(101851);
    expect(body.lieux).toEqual([75]);
  });
});
