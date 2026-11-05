import { readFileSync } from "node:fs";
import { expect, type Page, test } from "@playwright/test";

const read = (name: string) => JSON.parse(readFileSync(new URL(`../src/data/demo/${name}.json`, import.meta.url), "utf8"));
const answer = read("answer");
const sla: string = read("sla").text;

// The target text is found in the rendered page by its words, independently of the
// offsets the page used to cut its spans.
const TARGETS = {
  answer: answer.citations.find((c: { document_id: string }) => c.document_id === Object.keys(answer.documents).find((id) => answer.documents[id] === "datasets/corpus/sla.md")).quote as string,
  refusal: sla.slice(sla.indexOf("Priority 1"), sla.indexOf("business day.") + "business day.".length).replaceAll("\n- ", ""),
};
const MAX_DISTANCE = 8;

/** Centre of the rendered words `text` inside the contract, and centre of the lens. */
async function centres(page: Page, text: string) {
  return page.evaluate((wanted) => {
    const doc = document.querySelector("[data-sheet] article")!;
    const walker = document.createTreeWalker(doc, NodeFilter.SHOW_TEXT);
    const nodes: Text[] = [];
    for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
    const all = nodes.map((n) => n.data).join("");
    const at = all.indexOf(wanted);
    if (at < 0) throw new Error(`target not on the page: ${wanted}`);
    const locate = (offset: number): [Text, number] => {
      let o = offset;
      for (const n of nodes) {
        if (o <= n.data.length) return [n, o];
        o -= n.data.length;
      }
      throw new Error("offset past the end");
    };
    // The words' own text boxes: a Range across list items would also return the whole box of
    // each item it contains, as wide as the line. (unionBox in lens.ts, rewritten here because
    // this function runs in the page, where the test's imports do not exist.)
    const union = (rects: DOMRect[]) => {
      const left = Math.min(...rects.map((r) => r.left));
      const top = Math.min(...rects.map((r) => r.top));
      const right = Math.max(...rects.map((r) => r.right));
      const bottom = Math.max(...rects.map((r) => r.bottom));
      return new DOMRect(left, top, right - left, bottom - top);
    };
    const [startNode, startOffset] = locate(at);
    const [endNode, endOffset] = locate(at + wanted.length);
    const textRects: DOMRect[] = [];
    for (let i = nodes.indexOf(startNode); i <= nodes.indexOf(endNode); i++) {
      const n = nodes[i]!;
      const r = document.createRange();
      r.setStart(n, n === startNode ? startOffset : 0);
      r.setEnd(n, n === endNode ? endOffset : n.data.length);
      textRects.push(...[...r.getClientRects()].filter((x) => x.width > 0));
    }
    const t = union(textRects);
    const l = document.querySelector("[data-lens]")!.getBoundingClientRect();
    const box = (r: DOMRect) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width });
    return {
      target: { x: t.left + t.width / 2, y: t.top + t.height / 2 },
      lens: { x: l.left + l.width / 2, y: l.top + l.height / 2 },
      boxes: { target: box(t), lens: box(l) },
    };
  }, text);
}

type Centres = Awaited<ReturnType<typeof centres>>;
const pair = (c: Centres) => [c.lens, c.target] as const;
const distance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

for (const width of [375, 1024, 1440]) {
  for (const mode of ["answer", "refusal"] as const) {
    test(`magnifier: ${mode} at ${width}px is centred on its words and holds them whole`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto("/");
      await page.evaluate(() => document.fonts.ready);
      if (mode === "refusal") await page.getByRole("tab", { name: "Refuse, faute de preuve" }).click();
      await expect(page.locator("[data-lens]")).toBeVisible();
      await expect(page.locator("[data-verity-demo]")).toHaveAttribute("data-mode", mode);
      // The lens glides to its target: measure once it has arrived.
      await expect.poll(async () => distance(...pair(await centres(page, TARGETS[mode])))).toBeLessThan(MAX_DISTANCE);
      const c = await centres(page, TARGETS[mode]);
      expect(distance(c.lens, c.target)).toBeLessThan(MAX_DISTANCE);
      // The words are whole inside the lens, first and last letters included, at every width.
      expect(c.boxes.lens.top).toBeLessThanOrEqual(c.boxes.target.top);
      expect(c.boxes.lens.bottom).toBeGreaterThanOrEqual(c.boxes.target.bottom);
      expect(c.boxes.lens.left).toBeLessThanOrEqual(c.boxes.target.left);
      expect(c.boxes.lens.right).toBeGreaterThanOrEqual(c.boxes.target.right);
      // No horizontal scroll: an overhanging lens is clipped, not added to the page width.
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
    });
  }
}

for (const mode of ["answer", "refusal"] as const) {
  test(`magnifier: ${mode} follows its words when the width changes, with motion on`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    if (mode === "refusal") await page.getByRole("tab", { name: "Refuse, faute de preuve" }).click();
    await page.setViewportSize({ width: 390, height: 900 });
    await expect.poll(async () => distance(...pair(await centres(page, TARGETS[mode]))), { timeout: 5000 }).toBeLessThan(MAX_DISTANCE);
  });
}

for (const mode of ["answer", "refusal"] as const) {
  test(`spotlight: ${mode} keeps its passage in ink and dims the rest of the contract`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    if (mode === "refusal") await page.getByRole("tab", { name: "Refuse, faute de preuve" }).click();
    await expect(page.locator("[data-lens]")).toBeVisible();
    const read = () =>
      page.evaluate((m) => {
        const ink = getComputedStyle(document.body).color;
        const spans = [...document.querySelectorAll<HTMLElement>("[data-sheet] article [data-o]")];
        const of = (target: boolean) => [...new Set(spans.filter((s) => s.matches(`[data-mark~="${m}"]`) === target).map((s) => getComputedStyle(s).color))];
        return { ink, target: of(true), rest: of(false) };
      }, mode);
    // The colours cross-fade on a change of mode (a frame even under reduced motion).
    await expect.poll(async () => {
      const c = await read();
      return c.target.length === 1 && c.target[0] === c.ink;
    }).toBe(true);
    const colours = await read();
    expect(colours.rest).toHaveLength(1);
    expect(colours.rest[0]).not.toBe(colours.ink);
  });
}

test("figures: the proof path shows on focus without widening the page, and Escape dismisses it", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 800 });
  await page.goto("/");
  const figures = page.locator("a.figure");
  const count = await figures.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const figure = figures.nth(i);
    await figure.focus();
    await expect(figure.locator(".path")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  }
  await page.keyboard.press("Escape");
  await expect(figures.nth(count - 1).locator(".path")).toBeHidden();
});

test("demo tabs: an ARIA tablist operated from the keyboard", async ({ page }) => {
  await page.goto("/");
  const answerTab = page.getByRole("tab", { name: "Répond, en citant" });
  const refusalTab = page.getByRole("tab", { name: "Refuse, faute de preuve" });
  await expect(page.getByRole("tablist", { name: "Mode de Verity" })).toBeVisible();
  await expect(answerTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel", { name: "Répond, en citant" })).toBeVisible();
  await expect(page.locator("#verity-panel-refusal")).toBeHidden();

  await answerTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(refusalTab).toBeFocused();
  await expect(refusalTab).toHaveAttribute("aria-selected", "true");
  await expect(answerTab).toHaveAttribute("tabindex", "-1");
  await expect(page.getByRole("tabpanel", { name: "Refuse, faute de preuve" })).toContainText("Refus du modèle · confiance 0,97");
  await expect(page.locator("#verity-panel-answer")).toBeHidden();

  await page.keyboard.press("Home");
  await expect(answerTab).toBeFocused();
  await expect(answerTab).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowLeft");
  await expect(refusalTab).toBeFocused();
});

test("refusal card carries no threshold check", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Refuse, faute de preuve" }).click();
  const panel = page.locator("#verity-panel-refusal");
  await expect(panel).not.toContainText(/seuil|✓/);
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("both demo cards and the detailed bio are readable, with no inert control shown", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#verity-panel-answer")).toBeVisible();
    await expect(page.locator("#verity-panel-refusal")).toBeVisible();
    await expect(page.getByRole("tablist")).toBeHidden();
    await expect(page.locator('[data-bio-version="long"]')).toBeVisible();
    await expect(page.locator("[data-bio] .toggle")).toBeHidden();
  });
});
