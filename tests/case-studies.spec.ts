import { expect, test } from "@playwright/test";
import { type Lang, twin } from "../src/lib/i18n.ts";
import { interval, measure } from "../src/lib/measures.ts";
import { plain } from "../scripts/typography.ts";

// SPEC §3.2, in its order: problem, what I built (one SVG diagram), measures, what did not
// work, three decisions (ADR), how it is built, what comes next.
const SECTIONS: Record<Lang, string[]> = {
  fr: ["Le problème", "Ce que j’ai construit", "Mesures", "Limites connues et prochaines étapes", "Trois décisions", "Comment c’est construit", "La suite"],
  en: ["The problem", "What I built", "Results", "Known limits and next steps", "Three decisions", "How it is built", "What comes next"],
};
const BRIEF: Record<Lang, { title: string; terms: string[] }> = {
  fr: { title: "En bref", terms: ["Ce que ça fait", "Ce qui est mesuré", "Limite principale"] },
  en: { title: "In brief", terms: ["What it does", "What is measured", "Main limit"] },
};
const CASES = ["verity", "promptlang", "praxis"];
const LIMIT_LABELS: Record<Lang, string[]> = { fr: ["Périmètre", "Limite connue", "Prochaine étape"], en: ["Scope", "Known limit", "Next step"] };
// Words a recruiter would have to look up; each page says it in plain words instead. Code,
// links and verbatim quotes keep their own words. A list catches only the words on it: terms
// the pages keep and explain where they first appear (kappa, RAG, API, JSON, README, ADR)
// cannot be listed, and whether each is explained is the reviewer's to check. "Run" is jargon
// in French only: in English it is the plain word for an execution.
const JARGON: Record<Lang, RegExp> = {
  fr: /\b(split|runs?|baseline|fixtures?|pipeline|LLM|lexer|parser|runtime|semver)\b/i,
  en: /\b(split|baseline|fixtures?|pipeline|LLM|lexer|parser|runtime|semver)\b/i,
};
const PINNED = (repo: string) => new RegExp(`^https://github\\.com/matteogallo-ai/${repo}/blob/[0-9a-f]{40}/`);

// Numbers a reader sees outside a measure must not be figures. Skipped, each for a reason:
// - .figure, [data-measure], [data-label]: a measure's value, interval and label, read from
//   measures.json (measures-lib checks every number of a label against its evidence; the
//   interval and label texts are compared with the measure below);
// - a, code, .mono: identifiers, not quantities (ADR and PR numbers, commits, model ids,
//   calibre numbers);
// - .ci-level: the interval level, named in the column header and in the note above the tables;
// - blockquote > p: verbatim quotes, read by the page from data that check:sources compares
//   with GitHub (the demo trace, a measure's evidence); the quote's footer is checked.
// The check reads digits only: a figure written in words is the reviewer's to catch.
// Anything else with a digit fails here.
const IDENTIFIERS = ".figure, [data-measure], [data-label], a, code, .mono, .ci-level, blockquote > p";

/** Runs in the page: text with a digit under main, outside `skip`, the SVG's title and desc included. */
function strayNumbers(skip: string): string[] {
  const found: string[] = [];
  const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const parent = node.parentElement!;
    if (parent.closest("style, script")) continue;
    // Title and desc are what a screen reader announces for the diagram: checked, never skipped.
    if (!parent.closest("title, desc") && parent.closest(skip)) continue;
    if (/\d/.test(node.textContent ?? "")) found.push(`${parent.tagName.toLowerCase()}: ${node.textContent!.trim()}`);
  }
  return found;
}

for (const [lang, slug] of (["fr", "en"] as const).flatMap((l) => CASES.map((c) => [l, c] as const))) {
  const path = lang === "fr" ? `/projets/${slug}/` : twin(`/projets/${slug}/`);

  test(`${path}: the seven sections of SPEC §3.2, in order`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator(".case-section > h2")).toHaveText(SECTIONS[lang]);
  });

  test(`${path}: the brief first, three plain lines and three figures, the main defect among them`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main h2").first()).toHaveText(BRIEF[lang].title);
    const brief = page.locator(".brief");
    await expect(brief.locator("dt")).toHaveText(BRIEF[lang].terms);
    for (const dd of await brief.locator("dd").all()) await expect(dd).toHaveText(/\S/);
    await expect(brief.locator(".big .figure")).toHaveCount(3);
    // Praxis has two: the blind comparison and the sourcing flag.
    expect(await brief.locator(".big .figure.defect").count()).toBeGreaterThanOrEqual(1);
    for (const href of await brief.locator(".figure").evaluateAll((els) => els.map((a) => a.getAttribute("href")))) expect(href).toMatch(PINNED(slug));
  });

  test(`${path}: every section opens with a sentence saying what it gives the reader`, async ({ page }) => {
    await page.goto(path);
    const firsts = await page.locator(".case-section > h2").evaluateAll((hs) => hs.map((h) => [h.nextElementSibling?.className ?? "", h.nextElementSibling?.textContent?.trim() ?? ""]));
    expect(firsts).toHaveLength(SECTIONS[lang].length);
    for (const [cls, text] of firsts) {
      expect(cls).toContain("lead");
      expect(text).toMatch(/\S.*[.:]$/);
    }
  });

  test(`${path}: no unexplained jargon in the running text`, async ({ page }) => {
    await page.goto(path);
    const words = await page.evaluate((source) => {
      const re = new RegExp(source, "i");
      const found: string[] = [];
      const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (parent.closest("style, script, a, code, blockquote")) continue;
        const m = re.exec(node.textContent ?? "");
        if (m) found.push(`${m[0]} in: ${node.textContent!.trim().slice(0, 80)}`);
      }
      return found;
    }, JARGON[lang].source);
    expect(words).toEqual([]);
  });

  test(`${path}: the measures tables are folded, and open as stacked cards on a 375 px screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    const detail = page.locator("#mesures details.measures-detail");
    await expect(detail).toHaveCount(1);
    await expect(detail.locator("table").first()).toBeHidden();
    await detail.locator("summary").click();
    await expect(detail.locator("table").first()).toBeVisible();
    for (const row of await detail.locator("tbody tr").all()) {
      expect(await row.evaluate((r) => getComputedStyle(r).display)).toBe("block");
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    for (const table of await detail.locator("table").all()) {
      expect(await table.evaluate((t) => t.scrollWidth - t.clientWidth)).toBeLessThanOrEqual(0);
    }
  });

  test(`${path}: one SVG diagram, named, in "what I built"`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("main svg")).toHaveCount(1);
    const diagram = page.locator("#construit svg[role='img']");
    await expect(diagram).toHaveCount(1);
    expect(((await diagram.getAttribute("aria-labelledby")) ?? "").split(" ")).toHaveLength(2);
    await expect(page.locator("#construit").getByRole("img", { name: /\S/ })).toHaveCount(1);
    for (const id of ((await diagram.getAttribute("aria-labelledby")) ?? "").split(" ")) await expect(page.locator(`#${id}`)).toHaveText(/\S/);
  });

  test(`${path}: the diagram's smallest text renders at 12 px or more on a 375 px screen`, async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(path);
    // Rendered size = font-size in user units x the scale of the viewBox to the drawn width.
    const smallest = await page.locator("#construit svg").evaluate((svg: SVGSVGElement) => {
      const scale = svg.getBoundingClientRect().width / svg.viewBox.baseVal.width;
      return Math.min(...[...svg.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")) * scale));
    });
    expect(smallest).toBeGreaterThanOrEqual(12);
  });

  test(`${path}: every figure links to its artefact at a pinned commit, every interval is its measure's`, async ({ page }) => {
    await page.goto(path);
    await page.locator("#mesures summary").click();
    const rows = page.locator("#mesures tbody tr");
    expect(await rows.count()).toBeGreaterThanOrEqual(2);
    for (const href of await page.locator("#mesures .figure").evaluateAll((els) => els.map((a) => a.getAttribute("href")))) {
      expect(href).toMatch(PINNED(slug));
    }
    for (const row of await rows.all()) await expect(row.locator(".figure").first()).toBeVisible();
    const intervals = await page.locator("[data-measure]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-measure")!, e.textContent!.trim()]));
    // Every interval cell is its measure's interval or a written reason for having none. Praxis
    // publishes no interval, so its tables hold reasons only; the other case studies show some.
    const cells = await page.locator("#mesures td.ci").count();
    expect(cells).toBeGreaterThan(0);
    expect(intervals.length + (await page.locator("#mesures td.ci.reason").count())).toBe(cells);
    if (slug !== "praxis") expect(intervals.length).toBeGreaterThan(0);
    for (const [id, text] of intervals) expect(plain(text!), id).toBe(plain(interval(measure(id!), lang)));
    const labels = await page.locator("[data-label]").evaluateAll((els) => els.map((e) => [e.getAttribute("data-label")!, e.textContent!.trim()]));
    for (const [id, text] of labels) expect(plain(text!), id).toBe(plain(measure(id!).label[lang]));
    // SPEC §6: defects at the same level as measures, in the same table.
    await expect(page.locator("#mesures tbody .figure.defect")).not.toHaveCount(0);
  });

  // Each known limit reads as engineering: its scope, the limit, the next step, labelled as such; the
  // template phrase « Ce que j’en ai fait » / "What I did about it" is gone.
  test(`${path}: each known limit states its scope, the limit and the next step`, async ({ page }) => {
    await page.goto(path);
    const labels = LIMIT_LABELS[lang];
    const limits = page.locator("#echecs .limit-steps");
    expect(await limits.count()).toBeGreaterThanOrEqual(1);
    for (const limit of await limits.all()) await expect(limit.locator("dt")).toHaveText(labels);
    expect(await page.locator("main").innerText()).not.toMatch(lang === "fr" ? /Ce que j.(en )?ai fait/ : /What I did/);
  });

  // The blind comparison with a single model call is Praxis's main result: it is a known limit,
  // with its cost ratio as a measure and the reviewer's grades at the pinned commit.
  if (path.endsWith("/praxis/")) {
    test(`${path}: the blind comparison with a single call is a known limit, with its grades`, async ({ page }) => {
      await page.goto(path);
      const limit = page.locator("#echecs h3", { hasText: lang === "fr" ? "appel unique" : "single call" });
      await expect(limit).toHaveCount(1);
      const steps = limit.locator("xpath=following-sibling::dl[1]");
      await expect(steps.locator('.figure[data-id="praxis.q12_cost_ratio"]')).toHaveCount(1);
      await expect(steps.locator('a[href$="/benchmarks/review/q12/grades.md"]')).toHaveAttribute("href", PINNED("praxis"));
    });
  }

  // Praxis's brief leads with its result, the blind comparison; the completion count is not in the
  // brief but in the measures, with the reason it has no interval.
  if (path.endsWith("/praxis/")) {
    test(`${path}: the brief leads with the blind comparison, the completion count stays in the measures`, async ({ page }) => {
      await page.goto(path);
      const big = page.locator(".brief .big .figure");
      await expect(big.first()).toHaveAttribute("data-id", "praxis.q12_cost_ratio");
      await expect(page.locator('.brief .figure[data-id="praxis.live_completed"]')).toHaveCount(0);
      await page.locator("#mesures summary").click();
      const row = page.locator("#mesures tbody tr", { has: page.locator('.figure[data-id="praxis.live_completed"]') });
      await expect(row.locator("td.ci.reason")).toHaveText(/\S/);
    });
  }

  test(`${path}: three decisions, each linking to its ADR at a pinned commit`, async ({ page }) => {
    await page.goto(path);
    await expect(page.locator("#decisions .decisions > li")).toHaveCount(3);
    const hrefs = await page.locator("#decisions .decisions > li a").evaluateAll((els) => els.map((a) => a.getAttribute("href")!));
    expect(hrefs).toHaveLength(3);
    for (const href of hrefs) expect(href).toMatch(new RegExp(`${PINNED(slug).source}docs/adr/\\d{4}-[a-z0-9-]+\\.md$`));
  });

  test(`${path}: no digit outside a measure, an identifier or a verified quote`, async ({ page }) => {
    await page.goto(path);
    const stray = await page.evaluate(strayNumbers, IDENTIFIERS);
    expect(stray).toEqual([]);
  });
}

test("the number check reports a figure typed into the prose, and one inside a link is not its concern", async ({ page }) => {
  await page.goto("/projets/verity/");
  expect(await page.evaluate(strayNumbers, IDENTIFIERS)).toEqual([]);
  await page.evaluate(() => {
    const prose = document.querySelector("#probleme > p:not(.rule-label)")!;
    prose.append(" 17 sur 20.");
    const link = document.createElement("a");
    link.textContent = "ADR 0009";
    prose.append(link);
    document.querySelector("#construit svg desc")!.append(" 8 passages.");
  });
  const stray = await page.evaluate(strayNumbers, IDENTIFIERS);
  expect(stray).toHaveLength(2);
  expect(stray[0]).toMatch(/^p: .*17 sur 20\.$/s);
  expect(stray[1]).toMatch(/^desc: .*8 passages\.$/);
});

// PromptLang says first what it is technically, in the same words on its card and under its title.
for (const [path, sentence] of [
  ["/projets/promptlang/", "Compilateur pour un langage typé de prompts : génère du code TypeScript et Python, publié sur npm."],
  ["/en/projects/promptlang/", "A compiler for a typed prompt language: generates TypeScript and Python, published on npm."],
] as const) {
  test(`${path}: the first sentence names what PromptLang is technically`, async ({ page }) => {
    await page.goto(path);
    expect(plain(await page.locator(".summary").innerText())).toBe(plain(sentence));
  });
}
