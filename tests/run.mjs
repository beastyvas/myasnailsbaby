/**
 * `npm test` — run every tests/*.test.mjs.
 *
 * Each suite runs in its own process. That isolates the module-resolve hook
 * the route tests install, and means a suite that crashes outright is one red
 * line rather than the end of the run.
 *
 * Exits non-zero if anything failed, so it can gate a commit or a workflow.
 */
import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DIR = fileURLToPath(new URL(".", import.meta.url));

const suites = readdirSync(DIR)
  .filter((f) => f.endsWith(".test.mjs"))
  .sort();

if (suites.length === 0) {
  console.log("No test suites found in tests/.");
  process.exit(1);
}

let failed = 0;

for (const file of suites) {
  const r = spawnSync(process.execPath, [DIR + file], {
    encoding: "utf8",
    // The route suites register a loader; keep node's own notices out of the
    // report so a green run is genuinely one line per suite.
    env: { ...process.env, NODE_NO_WARNINGS: "1" },
  });

  const out = (r.stdout || "").trimEnd();
  if (out) console.log(out);

  if (r.status !== 0) {
    failed++;
    // A suite that died before reporting (syntax error, bad import) prints
    // nothing useful above, so surface stderr rather than swallowing it.
    if (!out.startsWith("FAIL")) {
      console.log(`FAIL ${file} — exited ${r.status}`);
      const err = (r.stderr || "").trim();
      if (err) console.log(err.split("\n").slice(0, 12).map((l) => `       ${l}`).join("\n"));
    }
  }
}

console.log("");
if (failed) {
  console.log(`${failed} of ${suites.length} suites failed.`);
  process.exit(1);
}
console.log(`All ${suites.length} suites passed.`);
