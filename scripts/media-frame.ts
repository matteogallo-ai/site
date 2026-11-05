// Writes the stills of the demo recordings shown on the home page: one pinned frame of each
// recording, fetched at the pinned commit and checked against its sha256. The animations
// would break the 200 kB home budget on their own; a still keeps the real output, and the
// card links to the recording.
//
// --check (CI) compares decoded pixels, not PNG bytes: the PNG encoder's output may differ
// between platforms for the same image. The frame from the recording and the committed
// PNG must both decode to the pixels pinned in media.json.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import sharp, { type Sharp } from "sharp";

interface Still {
  id: string;
  file: string;
  from?: { repo: string; commit: string; path: string; sha256: string; pixels_sha256: string; frame?: number };
}

const check = process.argv.includes("--check");
const hash = (data: Uint8Array) => createHash("sha256").update(data).digest("hex");
// PromptLang's recording is 352 frames of 1280x980: above sharp's default pixel limit for the whole animation.
const options = { limitInputPixels: false } as const;
const pixels = async (image: Sharp) => hash((await image.ensureAlpha().raw().toBuffer({ resolveWithObject: true })).data);

const media = JSON.parse(readFileSync(new URL("../src/data/media.json", import.meta.url), "utf8")) as { media: Still[] };
let failed = false;
for (const still of media.media.filter((m) => m.from?.frame !== undefined)) {
  const { repo, commit, path, sha256, pixels_sha256, frame: index } = still.from as Required<NonNullable<Still["from"]>>;
  const response = await fetch(`https://raw.githubusercontent.com/${repo}/${commit}/${path}`, { signal: AbortSignal.timeout(60_000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  const gif = Buffer.from(await response.arrayBuffer());
  if (hash(gif) !== sha256) throw new Error(`${path}: sha256 ${hash(gif)} != pinned ${sha256}`);
  const { pages } = await sharp(gif, { ...options, animated: true }).metadata();
  if (!pages || index >= pages) throw new Error(`${path}: no frame ${index} in ${pages ?? 0} frames`);
  const frame = () => sharp(gif, { ...options, page: index });
  const file = new URL(`../${still.file}`, import.meta.url);
  if (!check) {
    writeFileSync(file, await frame().png({ compressionLevel: 9 }).toBuffer());
    console.log(`${still.file}: frame ${index} of ${pages}, pixels ${await pixels(frame())}`);
    continue;
  }
  const fromRecording = await pixels(frame());
  const committed = await pixels(sharp(readFileSync(file)));
  for (const [what, got] of [[`frame ${index} of the recording`, fromRecording], [still.file, committed]] as const) {
    if (got !== pixels_sha256) {
      console.error(`${what}: pixels ${got} != pinned ${pixels_sha256}`);
      failed = true;
    }
  }
}
if (failed) process.exit(1);
if (check) console.log("recording stills: pixels match the pinned recordings");
