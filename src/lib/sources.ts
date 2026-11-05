// The repositories' measures are pinned to one commit each (src/data/measures.json): a
// page linking to another file of the same repo (an ADR, an audit) links at that commit,
// so the text it describes is the text a reader opens.
import data from "../data/measures.json" with { type: "json" };
import { blobUrl, type MeasuresFile } from "../../scripts/measures-lib.ts";

const OWNER = "matteogallo-ai";

/** URL of `path` in `matteogallo-ai/<repo>` at the commit its measures are pinned to. */
export function pinned(repo: string, path: string): string {
  const full = `${OWNER}/${repo}`;
  if (!path || path.startsWith("/") || path.includes("..")) throw new Error(`${path}: path must be repo-relative`);
  const commits = new Set((data as MeasuresFile).measures.flatMap((m) => (m.status === "verified" && m.repo === full ? [m.commit] : [])));
  if (commits.size === 0) throw new Error(`no measure pins a commit of ${full}`);
  // Two commits would leave the link's commit a matter of which measure came first.
  if (commits.size > 1) throw new Error(`${full} measures are pinned to ${commits.size} commits: ${[...commits].join(", ")}`);
  return blobUrl({ repo: full, commit: [...commits][0]!, path });
}
