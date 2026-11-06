// Draws public/apple-touch-icon.png and public/favicon.ico from public/favicon.svg, its light
// colours: neither format follows the system's dark mode, the SVG does (browsers that read it).
// Run: npm run icons.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const at = (path: string) => fileURLToPath(new URL(`../${path}`, import.meta.url));

/** Each image of an ICO file: its size in pixels and where its bytes lie. */
export function icoEntries(ico: Uint8Array): { size: number; offset: number; length: number }[] {
  const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
  if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1) throw new Error("not an ICO file");
  return Array.from({ length: view.getUint16(4, true) }, (_, i) => {
    const entry = 6 + i * 16;
    return { size: view.getUint8(entry) || 256, length: view.getUint32(entry + 8, true), offset: view.getUint32(entry + 12, true) };
  });
}

/** An ICO file holding each PNG as is: every browser that still asks for favicon.ico reads PNG entries. */
function ico(pngs: { size: number; data: Buffer }[]): Buffer {
  const header = Buffer.alloc(6 + pngs.length * 16);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);
  let offset = header.length;
  pngs.forEach(({ size, data }, i) => {
    const entry = 6 + i * 16;
    header.writeUInt8(size, entry);
    header.writeUInt8(size, entry + 1);
    header.writeUInt16LE(1, entry + 4); // colour planes
    header.writeUInt16LE(32, entry + 6); // bits per pixel
    header.writeUInt32LE(data.length, entry + 8);
    header.writeUInt32LE(offset, entry + 12);
    offset += data.length;
  });
  return Buffer.concat([header, ...pngs.map((p) => p.data)]);
}

async function main(): Promise<void> {
  // The light colours only: sharp ignores the SVG's media query, so it is removed rather than trusted.
  const svg = Buffer.from(readFileSync(at("public/favicon.svg"), "utf8").replace(/@media[^{]*\{(?:[^{}]*\{[^}]*\})*[^}]*\}/, ""));
  const png = (size: number) => sharp(svg, { density: (72 * size) / 32 }).resize(size, size).png().toBuffer();
  // iOS rounds the corners itself and draws transparency black: a full square of ink.
  const square = Buffer.from(svg.toString().replace(/ rx="\d+"/, ""));
  const ink = /rect\{fill:(#[0-9a-f]{6})\}/i.exec(svg.toString())?.[1];
  if (!ink) throw new Error("favicon.svg: no rect fill to flatten the touch icon on");
  writeFileSync(at("public/apple-touch-icon.png"), await sharp(square, { density: (72 * 180) / 32 }).resize(180, 180).flatten({ background: ink }).png().toBuffer());
  writeFileSync(at("public/favicon.ico"), ico([{ size: 16, data: await png(16) }, { size: 32, data: await png(32) }]));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
