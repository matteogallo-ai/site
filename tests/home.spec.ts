import { expect, type Page, test } from "@playwright/test";
import { measure } from "../src/lib/measures.ts";
import { plain } from "../scripts/typography.ts";

// The home page a recruiter reads in thirty seconds: who, one sentence per project, one figure
// and one limit each, the method, the bio. The words are Matteo's, verbatim; the typography pass
// changes only spaces and quotes, which plain() undoes.
const WORDS = {
  fr: {
    path: "/",
    title: "Matteo Gallo — Ingénieur logiciel & IA",
    description: "Matteo Gallo, ingénieur logiciel et IA à Lausanne. Logiciels et systèmes d'IA conçus et mis en production de bout en bout, évalués et mesurés.",
    role: "Ingénieur logiciel & IA · Lausanne",
    h1: "Je conçois des logiciels et des systèmes d'IA, de l'idée à la production.",
    message: "Ma spécialité : mesurer ce qu'ils valent vraiment. Tests, évaluations, limites publiées.",
    actions: ["Voir les projets", "Écrire un e-mail"],
    projects: [
      [
        "Assistant de questions-réponses sur des documents d'entreprise : chaque réponse cite le passage source, et l'absence de preuve produit un refus.",
        "4/31 questions sans réponse traitées comme si elles en avaient une, contre 12/31 pour un RAG naïf (même recherche, sans contrôles ; test apparié, p = 0,023)",
        "Limite : 5 questions sans réponse ont reçu une réponse au lieu d'un refus.",
      ],
      [
        "Langage typé pour les prompts LLM, compilé vers TypeScript et Python, publié sur npm.",
        "96,13 % — score de mutation (lexer, parser, semver ; exécution locale, hors CI)",
        "Limite : Linter IA : 12 signalements justes sur 40 en revue humaine.",
      ],
      [
        "Pipeline qui transforme une question business en briefing d'analyse sourcé, avec relecture adverse automatique.",
        "3,29–4,75 $ — par briefing live terminé",
        "Limite : Les 6 briefings live terminés sont signalés insuffisamment sourcés par son propre contrôle.",
      ],
    ],
    method: [
      ["Audit indépendant", "Audit à froid par un agent IA sans contexte. Sur PromptLang : 23 constats, chacun corrigé, réfuté ou documenté.", "PR promptlang#32"],
      ["Lecture des sorties réelles", "Les tests ne suffisent pas. La relecture d'un briefing Praxis a révélé des estimations présentées comme des faits ; le validateur a été corrigé.", "PR praxis#47"],
      ["Évaluation pré-enregistrée", "Échantillon tiré avec une graine fixe et commité avant l'annotation. Le résultat est publié tel quel, même défavorable : 12/40.", "PR promptlang#39"],
    ],
    bio: [
      "Ingénieur logiciel et IA basé à Lausanne. Je conçois des produits IA de bout en bout : spécification, architecture, évaluation, mise en production.",
      "Je travaille avec des agents de code dans un cadre strict : ils écrivent l'essentiel du code ; je spécifie, je relis chaque changement et je réponds de ce qui est mergé. Tests, CI et mesures publiées sont obligatoires sur chaque projet.",
      "Formation d'automaticien à l'ETML, interrompue en deuxième année pour me consacrer au développement logiciel.",
      "Langues : français et italien (maternelles), anglais (intermédiaire), espagnol (notions).",
      "Ouvert à un poste d'ingénieur logiciel ou IA en Suisse romande.",
    ],
    caption: "Démo : Verity sur un contrat de test",
    tabs: ["Il répond, en citant", "Il refuse, faute de preuve"],
  },
  en: {
    path: "/en/",
    title: "Matteo Gallo — Software & AI Engineer",
    description: "Matteo Gallo, software and AI engineer in Lausanne. Software and AI systems designed and taken to production end to end, evaluated and measured.",
    role: "Software & AI Engineer · Lausanne",
    h1: "I build software and AI systems, from idea to production.",
    message: "My focus: measuring what they are actually worth. Tests, evaluations, published limits.",
    actions: ["See the projects", "Get in touch"],
    projects: [
      [
        "Question answering over company documents: every answer cites its source passage, and missing evidence produces a refusal.",
        "4/31 unanswerable questions answered as if they had an answer, against 12/31 for a naive RAG (same retrieval, no checks; paired test, p = 0.023)",
        "Limit: 5 unanswerable questions got an answer instead of a refusal.",
      ],
      ["A typed language for LLM prompts, compiled to TypeScript and Python, published on npm.", "96.13% — mutation score (lexer, parser, semver; local run, not in CI)", "Limit: AI linter, 12 of 40 findings correct in human review."],
      [
        "A pipeline that turns a business question into a sourced analysis briefing, with automatic adversarial review.",
        "$3.29–$4.75 — per completed live briefing",
        "Limit: all 6 completed live briefings are flagged as under-sourced by its own check.",
      ],
    ],
    method: [
      ["Independent audit", "Cold audit by an AI agent with no prior context. On PromptLang: 23 findings, each fixed, refuted or documented.", "PR promptlang#32"],
      ["Reading real outputs", "Tests are not enough. Reviewing a Praxis briefing revealed estimates presented as facts; the validator was fixed.", "PR praxis#47"],
      ["Pre-registered evaluation", "Sample drawn with a fixed seed and committed before annotation. The result is published as is, even when unfavourable: 12/40.", "PR promptlang#39"],
    ],
    bio: [
      "Software and AI engineer based in Lausanne. I design AI products end to end: specification, architecture, evaluation, production.",
      "I work with coding agents under strict rules: they write most of the code; I specify, review every change and answer for what gets merged. Tests, CI and published measurements are mandatory on every project.",
      "Automation-technician apprenticeship at ETML, left in the second year to focus on software development.",
      "Languages: French and Italian (native), English (intermediate), Spanish (basic).",
      "Open to a software or AI engineering role in French-speaking Switzerland.",
    ],
    caption: "Demo: Verity on a test contract",
    tabs: ["It answers, citing", "It refuses, for lack of evidence"],
  },
} as const;

const texts = async (page: Page, selector: string) => (await page.locator(selector).allInnerTexts()).map((t) => plain(t).replace(/\s+/g, " ").trim());

for (const [lang, w] of Object.entries(WORDS)) {
  test(`${w.path}: the words of the page, verbatim`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(w.path);
    expect(plain(await page.title())).toBe(plain(w.title));
    expect(plain((await page.locator('meta[name="description"]').getAttribute("content")) ?? "")).toBe(w.description);
    expect(await texts(page, ".hero .role")).toEqual([w.role]);
    expect(await texts(page, "h1")).toEqual([w.h1]);
    expect(await texts(page, ".hero .message")).toEqual([w.message]);
    expect(await texts(page, ".hero .actions a")).toEqual([...w.actions]);
    expect(await texts(page, "[data-verity-demo] .caption")).toEqual([w.caption]);
    expect(await page.locator("[data-verity-demo] [role=tab]").evaluateAll((ts) => ts.map((t) => t.getAttribute("aria-label")))).toEqual([...w.tabs]);
    const cards = page.locator(".project");
    await expect(cards).toHaveCount(3);
    for (const [i, [sentence, figure, limit]] of w.projects.entries()) {
      const card = cards.nth(i);
      expect(await texts(page, `.project:nth-child(${i + 1}) > p:not([class])`)).toEqual([sentence]);
      expect(plain(await card.locator(".figure-line").innerText())).toBe(figure);
      expect(plain(await card.locator(".limit").innerText()).replace(/\s+/g, " ")).toBe(limit);
      await expect(card.locator(".links a")).toHaveText(lang === "fr" ? ["Lire l’étude de cas →", "Code sur GitHub"] : ["Read the case study →", "Code on GitHub"]);
    }
    for (const [i, [title, body, pr]] of w.method.entries()) {
      const card = page.locator(".rules > li").nth(i);
      expect(plain(await card.locator("h3").innerText())).toBe(title);
      expect(plain(await card.locator("p:not(.links)").innerText()).replace(/\s+/g, " ")).toBe(body);
      // The PR leaves the site: its ↗ is drawn after it (tests/affordances.spec.ts).
      await expect(card.locator(".links a")).toHaveText(pr);
    }
    expect(await texts(page, ".bio p")).toEqual([...w.bio]);
  });

  test(`${w.path}: no band of figures, no project numbers, no bio toggle, no run-source block`, async ({ page }) => {
    await page.goto(w.path);
    await expect(page.locator(".band")).toHaveCount(0);
    await expect(page.locator(".project .no")).toHaveCount(0);
    expect(await page.locator(".projects").innerText()).not.toMatch(/N°|No\./);
    await expect(page.locator("[data-bio] .toggle, .bio button")).toHaveCount(0);
    await expect(page.locator("#verity-run-tip")).toHaveCount(0);
    // Kept on the case studies only.
    for (const id of ["verity.refusal_precision", "verity.judge_kappa_all", "verity.judge_kappa_real", "promptlang.linter_recall", "verity.hallucination_rate"]) {
      await expect(page.locator(`main .figure[data-id="${id}"]`)).toHaveCount(0);
    }
  });

  // Every number the page shows is a figure linked to its proof, or the demo's run, which the
  // build checks against the committed trace. Skipped, each for a reason: section ordinals
  // (.rule-label), version numbers (.stack), link texts naming a PR, identifiers in code (model ids,
  // versions in the image captions).
  test(`${w.path}: every figure resolves in measures.json and links to its proof; no other number`, async ({ page }) => {
    await page.goto(w.path);
    const figures = await page.locator("main .figure").evaluateAll((els) => els.map((a) => ({ id: a.getAttribute("data-id")!, href: a.getAttribute("href")!, value: (a.querySelector(".value") as HTMLElement).innerText })));
    // Three cards, a figure and a limit each, Verity's figure a comparison of three (its count, the
    // baseline's, the test's p); two method cards.
    expect(figures.length).toBe(10);
    for (const f of figures) {
      const m = measure(f.id);
      expect(f.href, f.id).toBe(m.url);
      expect(f.href).toMatch(/^https:\/\/github\.com\/matteogallo-ai\/[a-z-]+\/blob\/[0-9a-f]{40}\//);
      for (const n of plain(f.value).match(/\d+(?:[.,]\d+)?/g) ?? []) expect([String(m.k), String(m.n), ...(plain(m.display[lang as "fr" | "en"]).match(/\d+(?:[.,]\d+)?/g) ?? [])], `${f.id}: ${f.value}`).toContain(n);
    }
    const stray = await page.evaluate(() => {
      const found: string[] = [];
      const walker = document.createTreeWalker(document.querySelector("main")!, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const parent = node.parentElement!;
        if (parent.closest("style, script, noscript, .figure, [data-verity-demo], .rule-label, .stack, a, code")) continue;
        if (/\d/.test(node.textContent ?? "")) found.push(`${parent.tagName.toLowerCase()}: ${node.textContent!.trim()}`);
      }
      return found;
    });
    expect(stray).toEqual([]);
  });
}

// The French page reads in French: English appears only folded (the run's own words, the whole
// contract), marked lang="en". The check is tests/en.spec.ts the other way round: English known
// by its commonest short words, which French never uses alone.
const ENGLISH = /\b(?:the|and|of|to|is|with|for|from|by|this|that|are|was|be|not|its|what|which|every|answers?)\b/i;

/** Runs in the page: each English-looking text outside lang="en", and each lang="en" block a reader sees. */
function englishTexts(pattern: string): string[] {
  const re = new RegExp(pattern, "i");
  const marked = (e: Element) => e.closest("[lang='en'], code, script, style, noscript") !== null;
  const found: string[] = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!marked(node.parentElement!) && re.test(node.textContent ?? "")) found.push(`${node.parentElement!.tagName.toLowerCase()}: ${node.textContent!.trim()}`);
  }
  for (const el of document.querySelectorAll("[alt], [aria-label], [title]")) {
    if (marked(el)) continue;
    for (const name of ["alt", "aria-label", "title"]) {
      const value = el.getAttribute(name);
      if (value && re.test(value)) found.push(`${el.tagName.toLowerCase()}[${name}]: ${value}`);
    }
  }
  for (const meta of document.querySelectorAll("title, meta[name='description'], meta[property^='og:']")) {
    const value = meta.tagName === "TITLE" ? meta.textContent : meta.getAttribute("content");
    if (value && !/^https?:/.test(value) && re.test(value)) found.push(`${meta.tagName.toLowerCase()}: ${value}`);
  }
  // English kept for the record must be folded: inside a closed <details>, not on screen.
  for (const el of document.querySelectorAll("main [lang='en']")) {
    if (!el.closest("details:not([open])")) found.push(`visible lang=en: ${(el.textContent ?? "").trim().slice(0, 60)}`);
  }
  return found;
}

test("/: no English text a reader sees, outside the folded original and the folded contract", async ({ page }) => {
  await page.goto("/");
  expect(await page.evaluate(englishTexts, ENGLISH.source)).toEqual([]);
  // Both folds exist, closed, and hold the English.
  await expect(page.locator("details.original:not([open]) [lang='en']")).toHaveCount(2);
  await expect(page.locator("details.contract:not([open]) [lang='en']")).toHaveCount(1);
  await expect(page.locator("details.original summary").first()).toHaveText("Original anglais");
  await expect(page.locator("details.contract summary")).toHaveText("Voir le contrat complet (anglais)");
});

test("the English check finds an English sentence on the French page, and an unfolded original", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => {
    const p = document.createElement("p");
    p.textContent = "Every answer is checked.";
    document.querySelector("main")!.append(p);
    document.querySelector("details.original")!.setAttribute("open", "");
  });
  const found = await page.evaluate(englishTexts, ENGLISH.source);
  expect(found[0]).toBe("p: Every answer is checked.");
  expect(found[1]).toMatch(/^visible lang=en: /);
  expect(found).toHaveLength(2);
});

test("/: the demo shows the question, the passage and the answer in French, the note links the original run", async ({ page }) => {
  await page.goto("/");
  const card = page.locator("#verity-panel-answer");
  await expect(card.locator(".q")).toHaveText(/^Quel est le délai de réponse/);
  await expect(card.locator(".passage mark")).toHaveText(/^Priorité 1/);
  await expect(card.locator(".a-text")).toHaveText(/^Pour une demande de support/);
  await expect(card.locator(".checks")).toContainText("Citation retrouvée mot pour mot dans le document");
  await expect(page.locator("[data-verity-demo] .note")).toHaveText(/^Traduit d.un run réel en anglais · Voir la trace originale$/);
  expect(await page.locator("[data-verity-demo] .note a").getAttribute("href")).toMatch(/^https:\/\/github\.com\/matteogallo-ai\/verity\/blob\/[0-9a-f]{40}\//);
  // The contract opens on demand, its passage in the spotlight.
  await page.locator("details.contract summary").click();
  await expect(page.locator("[data-sheet]")).toBeVisible();
  await expect(page.locator("[data-lens]")).toBeVisible();
});

test("/: the demo holds on a 375 px screen, no sideways scroll, the page scrolls under the wheel", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  const demo = page.locator("[data-verity-demo]");
  expect(await demo.evaluate((d) => d.scrollWidth - d.clientWidth)).toBeLessThanOrEqual(0);
  await page.locator("details.contract summary").click();
  await page.locator("[data-sheet]").hover();
  const before = await page.evaluate(() => scrollY);
  await page.mouse.wheel(0, 300);
  await expect.poll(() => page.evaluate(() => scrollY)).toBeGreaterThan(before);
});
