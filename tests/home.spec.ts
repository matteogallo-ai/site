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
    description: "Matteo Gallo, ingénieur logiciel et IA à Lausanne. Je construis des systèmes à base de LLM et je mesure s'ils tiennent leurs promesses : recherche documentaire qui cite ou refuse, langage typé pour prompts, pipelines d'analyse.",
    role: "Ingénieur logiciel & IA · Lausanne",
    status: "Disponible pour un poste",
    h1: "Je construis des systèmes à base de LLM, et je mesure s'ils tiennent leurs promesses.",
    message: "Recherche documentaire qui cite ou refuse, langage typé pour prompts, pipelines d'analyse : chaque résultat publié avec sa preuve.",
    actions: ["Voir les projets", "Écrire un e-mail"],
    projects: [
      [
        "Assistant de questions-réponses sur des documents d'entreprise : chaque réponse cite le passage source, et l'absence de preuve produit un refus.",
        "4/31 questions sans réponse traitées comme si elles en avaient une, contre 12/31 pour un RAG naïf (même recherche, sans contrôles ; test apparié, p = 0,023)",
      ],
      [
        "Langage typé pour écrire les consignes (prompts) des modèles de langage, compilé vers TypeScript et Python, publié sur npm.",
        "96,13 % des 1 914 mutants détectés par ses tests (erreurs introduites exprès dans la lecture du langage et le contrôle de version)",
      ],
    ],
    experiments: ["Expériences", "Praxis — pipeline d'analyse en 7 étapes ; comparé à l'aveugle à un appel unique 9,8× moins cher, il n'a pas fait mieux. Résultat publié.", "/projets/praxis/"],
    method: [
      ["Audit indépendant", "Audit à froid par un agent IA sans contexte. Sur PromptLang : 23 constats, chacun corrigé, réfuté ou laissé ouvert.", "PR promptlang#32"],
      ["Lecture des sorties réelles", "Les tests ne suffisent pas. La relecture d'un briefing Praxis a révélé des estimations présentées comme des faits ; le validateur a été corrigé.", "PR praxis#47"],
      ["Évaluation pré-enregistrée", "Échantillon tiré avec une graine fixe et enregistré dans le dépôt avant l'annotation. Le résultat est publié tel quel, même défavorable : 12/40.", "PR promptlang#39"],
    ],
    bio: [
      "Ingénieur logiciel et IA basé à Lausanne. Je construis des systèmes à base de LLM, avec leurs tests, leurs évaluations et leurs mesures publiées.",
      "Développement assisté par agents de code : je spécifie, je relis les PR et leurs tests, et je réponds de ce qui est fusionné.",
      "Formation d'automaticien à l'ETML (école des métiers), interrompue en deuxième année pour me consacrer au développement logiciel.",
      "Langues : français et italien (maternelles), anglais (intermédiaire), espagnol (notions).",
      "Ouvert à un poste d'ingénieur logiciel et IA en Suisse romande.",
      "En dehors du code, j'assemble des montres Seiko personnalisées et je joue du piano.",
    ],
    caption: "Démo : Verity sur un contrat de test",
    tabs: ["Il répond, en citant", "Il refuse, faute de preuve"],
  },
  en: {
    path: "/en/",
    title: "Matteo Gallo — Software & AI Engineer",
    description: "Matteo Gallo, software and AI engineer in Lausanne. I build LLM systems and measure whether they deliver: document search that cites or refuses, a typed language for prompts, analysis pipelines.",
    role: "Software & AI Engineer · Lausanne",
    status: "Available for a role",
    h1: "I build LLM systems and measure whether they deliver.",
    message: "Document search that cites or refuses, a typed language for prompts, analysis pipelines: every result published with its proof.",
    actions: ["See the projects", "Get in touch"],
    projects: [
      [
        "Question answering over company documents: every answer cites its source passage, and missing evidence produces a refusal.",
        "4/31 unanswerable questions answered as if they had an answer, against 12/31 for a naive RAG (same retrieval, no checks; paired test, p = 0.023)",
      ],
      [
        "A typed language for writing the instructions (prompts) given to language models, compiled to TypeScript and Python, published on npm.",
        "96.13% of 1,914 mutants detected by its tests (errors deliberately introduced into the language reader and the version check)",
      ],
    ],
    experiments: ["Experiments", "Praxis — a 7-stage analysis pipeline; compared blind with a single call 9.8× cheaper, it did no better. Result published.", "/en/projects/praxis/"],
    method: [
      ["Independent audit", "Cold audit by an AI agent with no prior context. On PromptLang: 23 findings, each fixed, refuted or left open.", "PR promptlang#32"],
      ["Reading real outputs", "Tests are not enough. Reviewing a Praxis briefing revealed estimates presented as facts; the validator was fixed.", "PR praxis#47"],
      ["Pre-registered evaluation", "Sample drawn with a fixed seed and committed before annotation. The result is published as is, even when unfavourable: 12/40.", "PR promptlang#39"],
    ],
    bio: [
      "Software and AI engineer based in Lausanne. I build LLM systems, with their tests, evaluations and published measurements.",
      "Built with coding agents: I write the specs, review the pull requests and their tests, and answer for what gets merged.",
      "Automation technician training at ETML (vocational school), left in the second year to focus on software development.",
      "Languages: French and Italian (native), English (intermediate), Spanish (basic).",
      "Open to a software and AI engineering role in French-speaking Switzerland.",
      "Outside of code, I build custom Seiko watches and play the piano.",
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
    expect(await texts(page, ".hero .status")).toEqual([w.status]);
    expect(await texts(page, "h1")).toEqual([w.h1]);
    expect(await texts(page, ".hero .message")).toEqual([w.message]);
    expect(await texts(page, ".hero .actions a")).toEqual([...w.actions]);
    expect(await texts(page, "[data-verity-demo] .caption")).toEqual([w.caption]);
    expect(await page.locator("[data-verity-demo] [role=tab]").evaluateAll((ts) => ts.map((t) => t.getAttribute("aria-label")))).toEqual([...w.tabs]);
    const cards = page.locator(".project");
    await expect(cards).toHaveCount(2);
    // A card is its sentence, one figure with what it is compared with, and its links: limits and
    // stack live on the case study.
    for (const [i, [sentence, figure]] of w.projects.entries()) {
      const card = cards.nth(i);
      expect(await texts(page, `.project:nth-child(${i + 1}) > p:not([class])`)).toEqual([sentence]);
      expect(plain(await card.locator(".figure-line").innerText()).replace(/\s+/g, " ")).toBe(figure);
      await expect(card.locator(".limit, .stack")).toHaveCount(0);
      await expect(card.locator(".links a")).toHaveText(lang === "fr" ? ["Lire l’étude de cas →", "Code sur GitHub"] : ["Read the case study →", "Code on GitHub"]);
    }
    // Praxis is no longer a project card: its blind comparison found no gain over a single call. It
    // stays on the page as one experiment, its line leading to its case study.
    await expect(page.locator(".project .wip")).toHaveCount(0);
    await expect(page.locator("#p-praxis")).toHaveCount(0);
    const [heading, line, study] = w.experiments;
    expect(await texts(page, ".experiments h3")).toEqual([heading]);
    expect(await texts(page, ".experiments li")).toEqual([line]);
    await expect(page.locator(".experiments li a").first()).toHaveAttribute("href", study);
    await expect(page.locator(".experiments li a").last()).toHaveAttribute("href", /^https:\/\/github\.com\/matteogallo-ai\/praxis\/blob\/[0-9a-f]{40}\/README\.md#status$/);
    await expect(page.locator(".rules > li")).toHaveCount(3);
    for (const [i, [title, body, pr]] of w.method.entries()) {
      const card = page.locator(".rules > li").nth(i);
      expect(plain(await card.locator("h3").innerText())).toBe(title);
      expect(plain(await card.locator("p:not(.links)").innerText()).replace(/\s+/g, " ")).toBe(body);
      // The PR leaves the site: its ↗ is drawn after it (tests/affordances.spec.ts).
      await expect(card.locator(".links a")).toHaveText(pr);
    }
    expect(await texts(page, ".bio p")).toEqual([...w.bio]);
    // The personal line closes the bio, set apart from the rest.
    await expect(page.locator(".bio p.personal")).toHaveCount(1);
    expect(await page.locator(".bio p").last().getAttribute("class")).toContain("personal");
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
    // Verity's figure is a comparison of three (its count, the baseline's, the test's p), PromptLang's
    // two (its score and the mutant count it is taken over), the Praxis experiment its stage count and
    // its cost ratio; two method cards.
    expect(figures.length).toBe(9);
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
  await expect(page.locator("details.original summary").first()).toHaveText("Original en anglais");
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
  await expect(page.locator("[data-verity-demo] .note")).toHaveText(/^Traduit d.une exécution réelle en anglais · Voir la trace originale$/);
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
