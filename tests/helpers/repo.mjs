/**
 * Where the repo is, worked out from this file's own location.
 *
 * The suites used to hardcode an absolute path, which meant they only ran on
 * the one machine they were written on. Deriving it from import.meta.url is
 * what lets `npm test` work on a fresh clone, in CI, or on anyone's laptop.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

/** Repo root, with a trailing slash. */
export const ROOT = fileURLToPath(new URL("../../", import.meta.url));

/** Read a repo file as text, e.g. read("pages/index.js"). */
export function read(relPath) {
  return readFileSync(ROOT + relPath, "utf8");
}

/** Import a repo module fresh, bypassing the module cache. */
export function load(relPath) {
  return import(new URL(`../../${relPath}`, import.meta.url).href + `?v=${Math.random()}`);
}
