import { expect, type Page, test } from "@playwright/test";

const refusalTab = (page: Page) => page.getByRole("tab", { name: "Refuse, faute de preuve" });
const answerTab = (page: Page) => page.getByRole("tab", { name: "Répond, en citant" });

/** Records, frame by frame, the written part of a card's answer and whether its checks show. */
async function recordWriting(page: Page, panel: string) {
  await page.evaluate((id) => {
    const card = document.getElementById(id)!;
    const frames: { written: string; checks: boolean }[] = [];
    (window as unknown as { frames_: typeof frames }).frames_ = frames;
    const tick = () => {
      // What the eye sees: the animated layer while it exists, the answer once it is gone.
      const layer = card.querySelector(".a-layer");
      const first = card.querySelector(".checks li");
      frames.push({ written: layer ? layer.firstElementChild!.textContent! : card.querySelector(".a-text")!.textContent!, checks: first ? getComputedStyle(first).opacity !== "0" : true });
      if (frames.length < 200) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, panel);
}

test("the answer writes itself word by word, then its checks appear", async ({ page }) => {
  await page.goto("/");
  await refusalTab(page).click();
  await recordWriting(page, "verity-panel-answer");
  await answerTab(page).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { frames_: unknown[] }).frames_.length), { timeout: 8000 }).toBe(200);
  const frames = await page.evaluate(() => (window as unknown as { frames_: { written: string; checks: boolean }[] }).frames_);
  const full = await page.locator("#verity-panel-answer .a-text").textContent();
  const partial = frames.filter((f) => f.written !== full);
  expect(partial.length, "some frames show a partial answer").toBeGreaterThan(2);
  for (const f of partial) {
    expect(full!.startsWith(f.written)).toBe(true);
    // Whole words only: the written part ends where a word ends.
    expect(f.written === "" || full![f.written.length] === " ").toBe(true);
    expect(f.checks, "checks wait for the answer").toBe(false);
  }
  // From the first frame of writing on (the frames before the click show the card as it was).
  const lengths = frames.slice(frames.indexOf(partial[0]!)).map((f) => f.written.length);
  expect(lengths).toEqual([...lengths].sort((a, b) => a - b));
  expect(frames.at(-1)).toEqual({ written: full, checks: true });
});

test("assistive tech gets the whole answer and its checks while the answer is being written", async ({ page }) => {
  await page.goto("/");
  await refusalTab(page).click();
  await answerTab(page).click();
  const panel = page.locator("#verity-panel-answer");
  await expect(panel).toHaveAttribute("data-writing", "");
  const full = (await panel.locator(".a-text").textContent())!;
  const tree = await panel.ariaSnapshot();
  // Taken mid-writing: the visual layer is still partial.
  await expect(panel).toHaveAttribute("data-writing", "");
  expect(tree).toContain(full);
  expect(tree).toContain("affirmations étayées par leur citation");
  expect(await panel.locator(".a-layer").getAttribute("aria-hidden")).toBe("true");
});

/** How long a card stays in its writing state, timed from inside the page. */
const writingTime = (page: Page, panel: string) =>
  page.evaluate(
    (id) =>
      new Promise<number>((resolve) => {
        const start = performance.now();
        const card = document.getElementById(id)!;
        const poll = () => ("writing" in card.dataset ? requestAnimationFrame(poll) : resolve(performance.now() - start));
        poll();
      }),
    panel,
  );

test("about 35 ms a word, at most 1.5 s, and a key or a click shows the answer whole", async ({ page }) => {
  await page.goto("/");
  const panel = page.locator("#verity-panel-answer");
  const words = async (id: string) => (await page.locator(`#${id} .a-text`).textContent())!.split(/\s+/).length;
  // Timed from after the click's round trip: the lower bounds leave room for it.
  // The answer (44 words) reaches the 1.5 s cap; the refusal (8 words) shows the pace itself.
  expect((await words("verity-panel-answer")) * 35).toBeGreaterThan(1500);
  await refusalTab(page).click();
  await answerTab(page).click();
  const answerTook = await writingTime(page, "verity-panel-answer");
  expect(answerTook).toBeGreaterThan(1500 * 0.8);
  expect(answerTook).toBeLessThan(1500 + 250);
  const refusalWords = await words("verity-panel-refusal");
  await refusalTab(page).click();
  const refusalTook = await writingTime(page, "verity-panel-refusal");
  expect(refusalTook).toBeGreaterThan(refusalWords * 35 * 0.5);
  expect(refusalTook).toBeLessThan(refusalWords * 35 + 250);

  for (const skip of [() => page.keyboard.press("Shift"), () => page.mouse.click(5, 5)]) {
    await refusalTab(page).click();
    await answerTab(page).click();
    await expect(panel).toHaveAttribute("data-writing", "");
    await skip();
    await expect(panel).toHaveAttribute("data-written", "", { timeout: 100 });
    await expect(panel.locator(".a-layer")).toHaveCount(0);
  }
});

test("under reduced motion the answer is shown whole at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // Read in the same task as the click: a retrying assertion would also pass on writing that
  // merely ends fast.
  const state = await page.evaluate(() => {
    document.querySelector<HTMLElement>("#verity-tab-refusal")!.click();
    const panel = document.getElementById("verity-panel-refusal")!;
    return { unwritten: panel.querySelectorAll(".unwritten").length, writing: "writing" in panel.dataset, text: panel.querySelector(".a")!.textContent };
  });
  expect(state).toEqual({ unwritten: 0, writing: false, text: "I don't know based on the provided documents." });
});

const glassOf = (page: Page) =>
  page.evaluate(() => ({
    nav: getComputedStyle(document.querySelector(".pill")!).backdropFilter,
    card: getComputedStyle(document.querySelector("#verity-panel-answer")!).backdropFilter,
    lens: getComputedStyle(document.querySelector("[data-lens] .ring")!).backdropFilter,
    fill: getComputedStyle(document.querySelector("#verity-panel-answer")!).backgroundColor,
    navFill: getComputedStyle(document.querySelector(".pill")!).backgroundColor,
  }));

/** The alpha of a computed rgb()/rgba() colour. */
const alpha = (colour: string) => Number(/rgba?\([^)]*?,\s*([\d.]+)\)$/.exec(colour)?.[1] ?? (colour.startsWith("rgb(") ? 1 : 0));

// The navigation floats over headings, images and code as the page scrolls: text under it must not
// read through. It is far more opaque and more blurred than the spotlight ring and the answer card.
for (const colorScheme of ["light", "dark"] as const) {
  test(`glass: the navigation hides what scrolls under it (${colorScheme})`, async ({ page }) => {
    await page.emulateMedia({ colorScheme });
    await page.goto("/");
    const glass = await glassOf(page);
    expect(alpha(glass.navFill)).toBeGreaterThanOrEqual(0.9);
    expect(glass.nav).toContain("blur(24px)");
  });
}

test("glass: refracted in Chromium", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-refraction", "");
  const glass = await glassOf(page);
  expect(glass.nav).toBe('url("#glass-refraction") blur(24px)');
  expect(glass.card).toBe('url("#glass-refraction") blur(14px)');
  expect(glass.lens).toBe('url("#glass-refraction") blur(14px)');
});

test("glass: frosted, without refraction, where the engine cannot refract", async ({ page }) => {
  // Other engines have no navigator.userAgentData.
  await page.addInitScript(() => delete (Navigator.prototype as { userAgentData?: unknown }).userAgentData);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-refraction");
  const glass = await glassOf(page);
  expect(glass.nav).toBe("blur(24px)");
  expect(glass.card).toBe("blur(14px)");
  expect(glass.lens).toBe("blur(14px)");
});

test("glass: opaque under prefers-reduced-transparency", async ({ page }) => {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setEmulatedMedia", { features: [{ name: "prefers-reduced-transparency", value: "reduce" }] });
  await page.goto("/");
  const glass = await glassOf(page);
  expect(glass.nav).toBe("none");
  expect(glass.card).toBe("none");
  expect(glass.lens).toBe("none");
  // The fill is the paper colour, fully opaque.
  expect(glass.fill).toMatch(/^rgb\(\d+, \d+, \d+\)$/);
});

test("an answer on screen at load stays as it is; one below the fold writes itself as it enters", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const card = page.locator("#verity-panel-answer");
  await page.waitForTimeout(500);
  await expect(card).not.toHaveAttribute("data-writing");
  await expect(card).not.toHaveAttribute("data-written");

  await page.setViewportSize({ width: 375, height: 700 });
  await page.goto("/");
  await expect(card).not.toHaveAttribute("data-written");
  // Bring the first line of the answer just into view: writing starts before it can be read whole.
  await page.evaluate(() => {
    const a = document.querySelector("#verity-panel-answer .a")!;
    window.scrollBy(0, a.getBoundingClientRect().top - window.innerHeight + 4);
  });
  await expect(card).toHaveAttribute("data-written", "", { timeout: 2000 });
});

test("an answer below the fold at load writes itself even when the page scrolls to it at once", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 700 });
  // Runs after the demo's module script has mounted, before any observer has reported.
  await page.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => {
      const a = document.querySelector("#verity-panel-answer .a")!;
      window.scrollBy(0, a.getBoundingClientRect().top - window.innerHeight + 4);
    }),
  );
  await page.goto("/");
  await expect(page.locator("#verity-panel-answer")).toHaveAttribute("data-written", "", { timeout: 3000 });
});

test("the band's figures count up as they come into view, over their real value kept in the page", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/");
  const value = page.locator(".band .value").nth(1);
  const final = (await value.evaluate((v) => v.firstChild!.textContent))!;
  await value.scrollIntoViewIfNeeded();
  await expect(value).toHaveAttribute("data-counting", "");
  // While it counts: the figure keeps its value for assistive tech; only the aria-hidden copy moves.
  const during = await value.evaluate((v) => ({ own: v.firstChild!.textContent, layer: v.querySelector(".count-layer")?.getAttribute("aria-hidden") }));
  expect(during).toEqual({ own: final, layer: "true" });
  await expect(value).not.toHaveAttribute("data-counting", { timeout: 2000 });
  await expect(value).toHaveText(final);
});

test("under reduced motion the figures do not count and the sections do not move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/");
  await page.locator(".band").scrollIntoViewIfNeeded();
  await page.waitForTimeout(300);
  expect(await page.locator(".band [data-counting], .count-layer").count()).toBe(0);
  // Sections below the screen are not held back: their children are in place before any scroll.
  const held = await page.evaluate(() =>
    [...document.querySelectorAll(".reveal > *")].filter((c) => getComputedStyle(c).opacity !== "1" || getComputedStyle(c).transform !== "none").length,
  );
  expect(held).toBe(0);
});

test("each section comes into place once, its children one after the other, and stays", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 800 });
  await page.goto("/");
  const ids = ["projets", "methode", "a-propos"];
  const children = (id: string) =>
    page.locator(`#${id}`).evaluate((s) =>
      [...s.children].filter((c) => c.tagName !== "SCRIPT").map((c) => ({ opacity: getComputedStyle(c).opacity, transform: getComputedStyle(c).transform, delay: getComputedStyle(c).transitionDelay.split(",")[0] })),
    );
  // At load all three are below the screen: their children wait, transparent and lower, with
  // delays 60 ms apart (at most 180 ms).
  for (const id of ids) {
    await expect.poll(async () => (await children(id)).every((c) => c.opacity === "0" && c.transform !== "none")).toBe(true);
    expect((await children(id)).map((c) => c.delay).slice(0, 4)).toEqual(["0s", "0.06s", "0.12s", "0.18s"].slice(0, (await children(id)).length));
  }
  for (const id of ids) {
    await page.locator(`#${id}`).evaluate((s) => s.scrollIntoView({ block: "start" }));
    await expect.poll(async () => (await children(id)).every((c) => c.opacity === "1" && c.transform === "none"), { timeout: 3000 }).toBe(true);
  }
  // Once: back at the top and down again, nothing is held back any more.
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(200);
  for (const id of ids) expect((await children(id)).every((c) => c.opacity === "1")).toBe(true);
});

test("figures already on screen at load do not count: nothing above the fold moves but the answer", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1400 });
  const counted: string[] = [];
  await page.exposeFunction("sawCounting", (v: string) => counted.push(v));
  await page.addInitScript(() => {
    new MutationObserver((records) => {
      for (const r of records) if (r.attributeName === "data-counting") (window as unknown as { sawCounting: (v: string) => void }).sawCounting((r.target as Element).textContent ?? "");
    }).observe(document, { attributes: true, subtree: true });
  });
  await page.goto("/");
  await expect(page.locator(".band")).toBeInViewport();
  await page.waitForTimeout(1200);
  expect(counted).toEqual([]);
});

test("on a change of mode the ring fades out before it moves: no frame shows it changing shape while visible", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  await expect(page.locator("[data-lens]")).toBeVisible();
  await page.waitForTimeout(500);
  const frames = await page.evaluate(
    () =>
      new Promise<{ box: string; opacity: number }[]>((done) => {
        const lens = document.querySelector<HTMLElement>("[data-lens]")!;
        const seen: { box: string; opacity: number }[] = [];
        const start = performance.now();
        const tick = () => {
          seen.push({ box: `${lens.style.getPropertyValue("--x")} ${lens.style.getPropertyValue("--y")} ${lens.style.width} ${lens.style.height}`, opacity: Number(getComputedStyle(lens).opacity) });
          if (performance.now() - start < 900) requestAnimationFrame(tick);
          else done(seen);
        };
        document.querySelector<HTMLElement>("#verity-tab-refusal")!.click();
        requestAnimationFrame(tick);
      }),
  );
  const first = frames[0]!.box;
  const moved = frames.findIndex((f) => f.box !== first);
  expect(moved, "the ring never moved").toBeGreaterThan(0);
  // The last frame before it moved shows it invisible: it moved unseen. (The frame of the move
  // can already show it fading back in, when frames are far apart.)
  expect(frames[moved - 1]!.opacity, JSON.stringify(frames.slice(0, moved + 1))).toBeLessThan(0.05);
});
