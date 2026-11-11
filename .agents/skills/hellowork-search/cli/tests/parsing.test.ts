import { describe, test, expect } from "bun:test";
import {
  parseJobCards,
  parseJobDetail,
  parseTotalCount,
  relativeFrDateToISO,
  jobageToDateFacet,
} from "../src/helpers";
import { buildUrl } from "../src/commands/search";
import { normalizeId } from "../src/commands/detail";

// Fixture snippets condensed from a real search-results page
// (/fr-fr/emploi/recherche.html?k=développeur&l=Paris, July 2026) preserving
// the exact anchors the parsers rely on: data-id-storage-item-id, the
// hide-offer form's hidden inputs, and the data-cy card attributes.
const SEARCH_FIXTURE = `
<h1 class="typo-m">2&nbsp;025 offres d'emploi</h1>
<ul>
<li data-id-storage-target="item"
    data-hide-offer-target="item"
    data-id-storage-item-id="79737515"
    data-hide-offer-item-id-value="79737515">
  <form action="/fr-fr/searchoffers/hideoffermodalframeview" method="GET">
    <input type="hidden" name="offerId" value="79737515">
    <input type="hidden" name="title" value="D&#xE9;veloppeur Back-End H/F">
    <input type="hidden" name="company" value="">
  </form>
  <div data-cy="serpCard">
    <a href="/fr-fr/emplois/79737515.html" data-cy="offerTitle">
      <h3><p>D&#xE9;veloppeur Back-End H/F</p></h3>
    </a>
    <p class="typo-s text-grey-500">Cette entreprise souhaite rester anonyme</p>
    <div class="readonly tag-secondary-s w-fit border-0" data-cy="localisationCard">
      Paris 9e - 75
    </div>
    <div class="readonly tag-secondary-s w-fit border-0" data-cy="contractCard">
      CDI
    </div>
    <div class="readonly tag-secondary-s typo-s-bold w-fit border-0">45&#x202F;000 - 55&#x202F;000 &#x20AC; / an</div>
    <div class="typo-s text-grey-500 pl-1 pt-1">il y a 5 jours</div>
  </div>
</li>
<li data-id-storage-target="item"
    data-hide-offer-target="item"
    data-id-storage-item-id="81018490"
    data-hide-offer-item-id-value="81018490">
  <form action="/fr-fr/searchoffers/hideoffermodalframeview" method="GET">
    <input type="hidden" name="offerId" value="81018490">
    <input type="hidden" name="title" value="D&#xE9;veloppeur Salesforce H/F">
    <input type="hidden" name="company" value="Akkodis">
  </form>
  <div data-cy="serpCard">
    <a href="/fr-fr/emplois/81018490.html" data-cy="offerTitle">
      <h3><p>D&#xE9;veloppeur Salesforce H/F</p></h3>
    </a>
    <div class="readonly tag-secondary-s w-fit border-0" data-cy="localisationCard">
      Paris - 75
    </div>
    <div class="readonly tag-secondary-s w-fit border-0" data-cy="contractCard">
      CDI
    </div>
    <div class="typo-s text-grey-500 pl-1 pt-1">il y a 2 jours</div>
  </div>
</li>
</ul>
`;

// Fixture condensed from a real detail page (/fr-fr/emplois/81018490.html)
// preserving jobTitle, the entreprises link, the mt-3 meta list, the salary
// button, tag list items, the dataLayer date, and the description containers.
const DETAIL_FIXTURE = `
<script> window.dataLayer.push({"idOffre":"81018490","contrat":"CDI","datePublicationOffre":"20260706","Nom-Entreprise":"akkodis"}); </script>
<h1 id="main-content" class="inline">
  <span class="block typo-xl sm:typo-2xl mb-3" data-cy="jobTitle">D&#xE9;veloppeur Salesforce H/F</span>
  <span class="flex items-center gap-2">
    <a href="/fr-fr/entreprises/akkodis-5159.html" class="typo-s sm:typo-m link-underline" title="Akkodis recrutement">
      Akkodis
    </a>
  </span>
</h1>
<ul class="mt-3 inline-flex">
  <li class="typo-long-m-bold flex">Paris - 75</li>
  <li class="typo-long-m-bold flex">CDI</li>
</ul>
<ul class="flex flex-wrap gap-3">
  <li>
    <button class="tag-border" data-cy="salary-tag-button">
      <span class="truncate max-w-[250px]">
        45&#x202F;000 - 55&#x202F;000 &#x20AC; / an
      </span>
    </button>
  </li>
  <li class="tag-secondary-s border-0 readonly">
    T&#xE9;l&#xE9;travail partiel
  </li>
  <li class="block tag-secondary-s border-0 readonly">
    Bac &#x2B;5
  </li>
  <li class="block tag-secondary-s border-0 readonly">
    Exp. 5 ans
  </li>
</ul>
<section>
  <h2><div><span class="text-left typo-m-bold sm:typo-long-2m-bold">Les missions du poste</span></div></h2>
  <div data-controller="truncate-text">
    <div id="1a0" class="leading-relaxed mb-4 typo-long-m" data-truncate-text-target="content">
      <p>Akkodis recrute un D&#xE9;veloppeur Salesforce H/F en CDI &#xE0; La D&#xE9;fense.<br /><br />Responsabilit&#xE9;s :<br /> * Concevoir des solutions Apex.<br /> * Int&#xE9;grer via REST et SOAP APIs.</p>
    </div>
  </div>
</section>
<details open>
  <summary data-cy="profileCollapseButton">
    <h2><span class="text-left typo-m-bold sm:typo-long-2m-bold">Le profil recherch&#xE9;</span></h2>
  </summary>
  <div class="mt-2">
    <div class="typo-long-m break-words">
      <p class="do-html-p-margin"><strong class="font-semibold">Alors si :</strong></p><ul class="ml-6 list-disc mb-4"><li>Tu as un profil dynamique</li><li>Tu es passionn&#xE9;(e)</li></ul>
    </div>
  </div>
</details>
<p class="block mt-8 typo-xs text-grey-500 break-words">Publi&#xE9;e le 06/07/2026 - R&#xE9;f : 12345</p>
`;

describe("parseTotalCount", () => {
  test("reads the offer total from the h1", () => {
    expect(parseTotalCount(SEARCH_FIXTURE)).toBe(2025);
  });
  test("returns null when absent", () => {
    expect(parseTotalCount("<html><body>nope</body></html>")).toBeNull();
  });
});

describe("parseJobCards", () => {
  const cards = parseJobCards(SEARCH_FIXTURE);

  test("finds both cards", () => {
    expect(cards.length).toBe(2);
  });

  test("parses an anonymous-company card with salary", () => {
    const c = cards[0];
    expect(c.id).toBe("79737515");
    expect(c.title).toBe("Développeur Back-End H/F");
    expect(c.company).toBeNull();
    expect(c.location).toBe("Paris 9e - 75");
    expect(c.contract).toBe("CDI");
    expect(c.salary).toBe("45 000 - 55 000 € / an");
    expect(c.url).toBe("https://www.hellowork.com/fr-fr/emplois/79737515.html");
    expect(c.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  test("parses a named-company card without salary", () => {
    const c = cards[1];
    expect(c.id).toBe("81018490");
    expect(c.title).toBe("Développeur Salesforce H/F");
    expect(c.company).toBe("Akkodis");
    expect(c.salary).toBeNull();
  });

  test("a malformed card does not break the rest", () => {
    const broken = SEARCH_FIXTURE.replace('name="title" value="D&#xE9;veloppeur Back-End H/F"', "");
    const rest = parseJobCards(broken);
    expect(rest.length).toBe(1);
    expect(rest[0].id).toBe("81018490");
  });
});

describe("parseJobDetail", () => {
  const job = parseJobDetail(DETAIL_FIXTURE, "81018490");

  test("core fields", () => {
    expect(job.id).toBe("81018490");
    expect(job.title).toBe("Développeur Salesforce H/F");
    expect(job.company).toBe("Akkodis");
    expect(job.location).toBe("Paris - 75");
    expect(job.contract).toBe("CDI");
    expect(job.salary).toBe("45 000 - 55 000 € / an");
    expect(job.date).toBe("2026-07-06");
    expect(job.url).toBe("https://www.hellowork.com/fr-fr/emplois/81018490.html");
  });

  test("tags", () => {
    expect(job.tags).toEqual(["Télétravail partiel", "Bac +5", "Exp. 5 ans"]);
  });

  test("description keeps section headings and list items", () => {
    expect(job.description).toContain("## Les missions du poste");
    expect(job.description).toContain("Akkodis recrute un Développeur Salesforce H/F");
    expect(job.description).toContain("## Le profil recherché");
    expect(job.description).toContain("- Tu as un profil dynamique");
    expect(job.description).not.toContain("<");
  });
});

describe("relativeFrDateToISO", () => {
  const now = new Date("2026-07-09T12:00:00Z");
  test("il y a N jours", () => {
    expect(relativeFrDateToISO("il y a 5 jours", now)).toBe("2026-07-04");
    expect(relativeFrDateToISO("il y a 1 jour", now)).toBe("2026-07-08");
  });
  test("hours and today map to today", () => {
    expect(relativeFrDateToISO("il y a 3 heures", now)).toBe("2026-07-09");
    expect(relativeFrDateToISO("à l'instant", now)).toBe("2026-07-09");
  });
  test("hier", () => {
    expect(relativeFrDateToISO("hier", now)).toBe("2026-07-08");
  });
  test("unknown label passes through", () => {
    expect(relativeFrDateToISO("bientôt", now)).toBe("bientôt");
  });
  test("empty is null", () => {
    expect(relativeFrDateToISO("", now)).toBeNull();
  });
});

describe("jobageToDateFacet", () => {
  test("maps day ranges to HelloWork facet values", () => {
    expect(jobageToDateFacet(1)).toBe("h");
    expect(jobageToDateFacet(3)).toBe("d");
    expect(jobageToDateFacet(7)).toBe("w");
    expect(jobageToDateFacet(30)).toBe("m");
    expect(jobageToDateFacet(90)).toBeNull();
    expect(jobageToDateFacet(9999)).toBeNull();
  });
});

describe("buildUrl", () => {
  test("encodes k, l, d, p", () => {
    const url = buildUrl({ query: "développeur", location: "Paris", jobage: 7, page: 2, format: "json" });
    expect(url).toContain("k=d%C3%A9veloppeur");
    expect(url).toContain("l=Paris");
    expect(url).toContain("d=w");
    expect(url).toContain("p=2");
  });
  test("omits p on page 1 and d when jobage unset", () => {
    const url = buildUrl({ query: "data", jobage: 9999, page: 1, format: "json" });
    expect(url).not.toContain("p=");
    expect(url).not.toContain("d=");
  });
});

describe("normalizeId", () => {
  test("bare id", () => {
    expect(normalizeId("79737515")).toBe("79737515");
  });
  test("full URL", () => {
    expect(normalizeId("https://www.hellowork.com/fr-fr/emplois/79737515.html")).toBe("79737515");
  });
  test("garbage is null", () => {
    expect(normalizeId("not-an-id!")).toBeNull();
  });
});
