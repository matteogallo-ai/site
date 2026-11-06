import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { icoEntries } from "./icons.ts";

test("favicon.ico holds the 16 and 32 px icons as PNG", async () => {
  const ico = readFileSync("public/favicon.ico");
  const entries = icoEntries(ico);
  assert.deepEqual(entries.map((e) => e.size), [16, 32]);
  for (const e of entries) {
    const meta = await sharp(ico.subarray(e.offset, e.offset + e.length)).metadata();
    assert.deepEqual([meta.format, meta.width, meta.height], ["png", e.size, e.size]);
  }
});

test("apple-touch-icon.png is an opaque 180 px square: iOS draws transparency black", async () => {
  const meta = await sharp(readFileSync("public/apple-touch-icon.png")).metadata();
  assert.deepEqual([meta.format, meta.width, meta.height, meta.hasAlpha], ["png", 180, 180, false]);
});

test("the SVG favicon uses the site's ink and paper, and swaps them in dark mode", () => {
  const svg = readFileSync("public/favicon.svg", "utf8");
  const tokens = readFileSync("src/styles/tokens.css", "utf8");
  const token = (name: string, dark: boolean) => {
    const block = dark ? tokens.slice(tokens.indexOf("prefers-color-scheme: dark")) : tokens;
    return new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`, "i").exec(block)![1]!.toLowerCase();
  };
  const [light, dark] = svg.toLowerCase().split("prefers-color-scheme:dark");
  assert.ok(light!.includes(`fill:${token("ink", false)}`) && light!.includes(`stroke:${token("paper", false)}`));
  assert.ok(dark!.includes(`fill:${token("ink", true)}`) && dark!.includes(`stroke:${token("paper", true)}`));
});
