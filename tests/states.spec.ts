import { expect, type Locator, type Page, test } from "@playwright/test";

// Every interactive element answers the pointer and the keyboard (CRAFT spec §2): its hover style
// differs from its rest style, keyboard focus draws a ring, and what changes is under a declared
// transition, never "transition: all".

const PROPS = ["color", "background-color", "border-color", "border-bottom-style", "text-decoration-color", "box-shadow", "transform", "opacity", "outline-style"] as const;

/**
 * The styles that can show a state, on the element, its ::before and ::after, its descendants and
 * the ancestors that draw it as a card (a stretched link lights its whole card). Each entry also
 * says whether the node declares a non-zero transition.
 */
async function look(target: Locator) {
  return target.evaluate((el, props) => {
    const nodes: Element[] = [el, ...el.querySelectorAll("*")];
    const card = el.closest("li, .card, .project");
    if (card && card !== el) nodes.push(card);
    const read = (n: Element, pseudo?: string) => {
      const c = getComputedStyle(n, pseudo);
      const durations = c.transitionDuration.split(",").map((d) => Number.parseFloat(d));
      return {
        values: props.map((p) => c.getPropertyValue(p)).join("|"),
        transition: durations.some((d) => d > 0) ? c.transitionProperty : "",
      };
    };
    return nodes.flatMap((n) => [read(n), read(n, "::before"), read(n, "::after")]);
  }, PROPS as unknown as string[]);
}

/** The interactive elements of the home page, by a name used in the test titles. */
const ELEMENTS: Record<string, (page: Page) => Locator> = {
  "nav link": (p) => p.locator(".nav a").first(),
  "primary button": (p) => p.getByRole("link", { name: "Voir les projets" }),
  "secondary button": (p) => p.getByRole("link", { name: "Écrire un e-mail" }),
  "demo tab (not selected)": (p) => p.getByRole("tab", { name: "Refuse, faute de preuve" }),
  "run source link": (p) => p.getByRole("link", { name: "Source du run" }),
  "figure in the band": (p) => p.locator(".band a.figure").first(),
  "figure in a card": (p) => p.locator(".project a.figure").first(),
  "project text link": (p) => p.locator(".project .links a").first(),
  "method card": (p) => p.locator("#methode .rules .links a").first(),
  "how-i-build link": (p) => p.getByRole("link", { name: /how-i-build/ }),
  "bio toggle (not pressed)": (p) => p.getByRole("button", { name: "Détaillé" }),
  "e-mail address": (p) => p.getByRole("button", { name: "matteogallo.office@gmail.com" }),
  "write button": (p) => p.getByRole("link", { name: "Écrire", exact: true }),
  "LinkedIn button": (p) => p.getByRole("link", { name: "LinkedIn" }),
  "footer link": (p) => p.locator(".footer a").first(),
};

for (const [name, find] of Object.entries(ELEMENTS)) {
  test(`states: ${name} changes on hover under a declared transition, and shows keyboard focus`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/");
    await page.evaluate(() => document.fonts.ready);
    const el = find(page);
    await el.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const rest = await look(el);
    await el.hover();
    // The longest hover transition (the nav underline, --dur-move) has ended.
    await page.waitForTimeout(400);
    const hover = await look(el);
    const changed = hover.map((h, i) => ({ ...h, was: rest[i]!.values })).filter((h) => h.values !== h.was);
    expect(changed.length, "no style changes on hover").toBeGreaterThan(0);
    expect(
      changed.some((c) => c.transition !== ""),
      "what changes on hover has no transition",
    ).toBe(true);

    await page.mouse.move(0, 0);
    await page.waitForTimeout(400);
    const before = await look(el);
    await el.focus();
    await page.waitForTimeout(300);
    const focused = await look(el);
    const ring = await el.evaluate((e) => {
      const card = e.closest("li");
      return [e, card].some((n) => n && getComputedStyle(n).outlineStyle !== "none" && e.matches(":focus-visible"));
    });
    expect(ring, "no focus ring").toBe(true);
    expect(focused).not.toEqual(before);
  });
}

test("states: no element declares transition: all, and the pointer cursor marks exactly what is clickable", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const report = await page.evaluate(() => {
    const all = [...document.querySelectorAll("body *")];
    const transitionAll = all
      .filter((e) => {
        const c = getComputedStyle(e);
        const durations = c.transitionDuration.split(",").map((d) => Number.parseFloat(d));
        return c.transitionProperty.split(",").some((p, i) => p.trim() === "all" && (durations[i] ?? durations[0]!) > 0);
      })
      .map((e) => e.outerHTML.slice(0, 80));
    const clickable = (e: Element) => e.closest("a[href], button, [role='tab'], summary, label") !== null;
    const pointerOnInert = all.filter((e) => getComputedStyle(e).cursor === "pointer" && !clickable(e)).map((e) => e.outerHTML.slice(0, 80));
    const clickableWithout = all
      .filter((e) => e.matches("a[href], button") && e.getClientRects().length > 0 && getComputedStyle(e).cursor !== "pointer")
      .map((e) => e.outerHTML.slice(0, 80));
    return { transitionAll, pointerOnInert, clickableWithout };
  });
  expect(report).toEqual({ transitionAll: [], pointerOnInert: [], clickableWithout: [] });
});

test("states: the demo tabs and the bio toggle slide one pill, and the demo card keeps its height", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const pill = (sel: string) => page.locator(sel).evaluate((e) => ({ transform: getComputedStyle(e, "::before").transform, transition: getComputedStyle(e, "::before").transitionProperty }));
  const tabsAt0 = await pill(".tabs.segmented");
  expect(tabsAt0.transition).toBe("transform");
  const cards = page.locator(".cards");
  const height = await cards.evaluate((e) => e.getBoundingClientRect().height);
  const below = await page.locator(".band").evaluate((e) => e.getBoundingClientRect().top);
  await page.getByRole("tab", { name: "Refuse, faute de preuve" }).click();
  await expect.poll(async () => (await pill(".tabs.segmented")).transform).not.toBe(tabsAt0.transform);
  // Switching modes moves nothing: the cards' cell and what follows the demo stay put.
  expect(await cards.evaluate((e) => e.getBoundingClientRect().height)).toBe(height);
  expect(await page.locator(".band").evaluate((e) => e.getBoundingClientRect().top)).toBe(below);

  const bioAt0 = await pill(".toggle.segmented");
  expect(bioAt0.transition).toBe("transform");
  await page.getByRole("button", { name: "Détaillé" }).click();
  await expect.poll(async () => (await pill(".toggle.segmented")).transform).not.toBe(bioAt0.transform);
});

test("states: the e-mail address copies itself and says so to assistive tech, then clears", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const address = page.getByRole("button", { name: "matteogallo.office@gmail.com" });
  await address.click();
  await expect(page.getByRole("status")).toHaveText("Copié ✓");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("matteogallo.office@gmail.com");
  await expect(page.getByRole("status")).toHaveText("", { timeout: 2500 });
  await expect(page.getByRole("link", { name: "Écrire", exact: true })).toHaveAttribute("href", "mailto:matteogallo.office@gmail.com");
});

test.describe("without JavaScript", () => {
  test.use({ javaScriptEnabled: false });
  test("the e-mail address stays a mailto link and the copy hint is hidden", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("link", { name: "matteogallo.office@gmail.com" })).toHaveAttribute("href", "mailto:matteogallo.office@gmail.com");
    await expect(page.locator("[data-copy-hint]")).toBeHidden();
  });
});

test("states under reduced motion: colours still change on hover, briefly, and nothing travels or scales", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const primary = page.getByRole("link", { name: "Voir les projets" });
  const tab = page.getByRole("tab", { name: "Refuse, faute de preuve" });
  for (const el of [primary, tab]) {
    const ms = await el.evaluate((e) => Math.max(...getComputedStyle(e).transitionDuration.split(",").map((d) => Number.parseFloat(d) * 1000)));
    expect(ms).toBeGreaterThan(0);
    expect(ms).toBeLessThanOrEqual(120);
  }
  await primary.hover();
  await page.waitForTimeout(200);
  expect(await primary.evaluate((e) => getComputedStyle(e).transform)).toBe("none");
  const nav = page.locator(".nav a").first();
  await nav.hover();
  // The underline appears at once: no scale in between.
  expect(await nav.evaluate((e) => getComputedStyle(e, "::after").transitionDuration)).toBe("0s");
});

test("states: the navigation marks the section in view, and none on the first screen", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");
  const current = () => page.locator('.nav a[aria-current="location"]');
  await expect(current()).toHaveCount(0);
  await expect(page.locator("[data-spy-dot]")).toBeHidden();
  await page.locator("#methode").evaluate((s) => s.scrollIntoView({ block: "start" }));
  await expect(current()).toHaveText("Méthode");
  await expect(page.locator("[data-spy-dot]")).toBeVisible();
  await page.evaluate(() => scrollTo(0, 0));
  await expect(current()).toHaveCount(0);
});
