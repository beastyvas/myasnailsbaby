/**
 * A module resolve hook, so an actual Next API route can be imported by a
 * bare `node` process.
 *
 * Two things stand in the way: Next's "@/" path alias, which node knows
 * nothing about, and @supabase/supabase-js, which would try to reach a real
 * server. This maps the first to the repo and swaps the second for a stub
 * that records calls.
 *
 * Worth the small amount of machinery: it means the route tests exercise the
 * real handler rather than a copy of its logic, so a guard that gets deleted
 * from the route actually fails a test.
 */
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const STUB = new URL("./supabaseStub.mjs", import.meta.url).href;

export async function resolve(specifier, context, next) {
  if (specifier === "@supabase/supabase-js") return { url: STUB, shortCircuit: true };

  if (specifier.startsWith("@/")) {
    let p = ROOT + specifier.slice(2);
    // Routes import "@/utils/inspo" with no extension.
    if (!/\.[a-z]+$/.test(p)) p += ".js";
    return { url: pathToFileURL(p).href, shortCircuit: true };
  }

  return next(specifier, context);
}
