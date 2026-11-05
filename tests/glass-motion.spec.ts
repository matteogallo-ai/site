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
      const a = card.querySelector(".a")!;
      const unwritten = a.querySelector(".unwritten");
      const first = card.querySelector(".checks li");
      frames.push({ written: unwritten ? a.firstElementChild!.textContent! : a.textContent!, checks: first ? getComputedStyle(first).visibility === "visible" : true });
      if (frames.length < 120) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, panel);
}

test("the answer writes itself word by word, then its checks appear", async ({ page }) => {
  await page.goto("/");
  await refusalTab(page).click();
  await recordWriting(page, "verity-panel-answer");
  await answerTab(page).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { frames_: unknown[] }).frames_.length), { timeout: 5000 }).toBe(120);
  const frames = await page.evaluate(() => (window as unknown as { frames_: { written: string; checks: boolean }[] }).frames_);
  const full = await page.locator("#verity-panel-answer .a").textContent();
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

test("under reduced motion the answer is shown whole at once", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  // Read in the same task as the click: a retrying assertion would also pass on writing that
  // merely ends fast (the motion tokens are 0.01ms under reduced motion).
  const state = await page.evaluate(() => {
    document.querySelector<HTMLElement>("#verity-tab-refusal")!.click();
    const panel = document.getElementById("verity-panel-refusal")!;
    return { unwritten: panel.querySelectorAll(".unwritten").length, writing: "writing" in panel.dataset, text: panel.querySelector(".a")!.textContent };
  });
  expect(state).toEqual({ unwritten: 0, writing: false, text: "I don't know based on the provided documents." });
});

const glassOf = (page: Page) =>
  page.evaluate(() => ({
    nav: getComputedStyle(document.querySelector("nav ul")!).backdropFilter,
    card: getComputedStyle(document.querySelector("#verity-panel-answer")!).backdropFilter,
    lens: getComputedStyle(document.querySelector(".lens-glass")!).filter,
    fill: getComputedStyle(document.querySelector("#verity-panel-answer")!).backgroundColor,
  }));

test("glass: refracted in Chromium", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-refraction", "");
  const glass = await glassOf(page);
  expect(glass.nav).toBe('url("#glass-refraction") blur(14px)');
  expect(glass.card).toBe('url("#glass-refraction") blur(14px)');
  expect(glass.lens).toBe('url("#lens-refraction")');
});

test("glass: frosted, without refraction, where the engine cannot refract", async ({ page }) => {
  // Other engines have no navigator.userAgentData.
  await page.addInitScript(() => delete (Navigator.prototype as { userAgentData?: unknown }).userAgentData);
  await page.goto("/");
  await expect(page.locator("html")).not.toHaveAttribute("data-refraction");
  const glass = await glassOf(page);
  expect(glass.nav).toBe("blur(14px)");
  expect(glass.card).toBe("blur(14px)");
  expect(glass.lens).toBe("none");
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
