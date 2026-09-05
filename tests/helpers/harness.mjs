/**
 * A test harness in fifty lines.
 *
 * No framework on purpose. Adding jest or vitest to this project means a
 * build step, a config file and a few hundred megabytes of node_modules, to
 * get features these suites don't use. Everything here is plain node, so
 * `npm test` works on a fresh clone with nothing installed.
 *
 * Only failures print. A passing suite is one line, so a green run is
 * readable at a glance and a red one puts the failure at the bottom where
 * you're already looking.
 */

export function suite(name) {
  let passed = 0;
  const failures = [];

  const api = {
    /** Assert a condition. `detail` is printed only on failure. */
    ok(what, cond, detail = "") {
      if (cond) passed++;
      else failures.push(`${what}${detail ? ` — ${detail}` : ""}`);
      return !!cond;
    },

    /** Assert equality, reporting what was actually got. */
    eq(what, got, want) {
      const same = Object.is(got, want);
      if (same) passed++;
      else failures.push(`${what} — got ${fmt(got)}, want ${fmt(want)}`);
      return same;
    },

    /** Assert deep equality via JSON, which is enough for these shapes. */
    same(what, got, want) {
      const a = JSON.stringify(got);
      const b = JSON.stringify(want);
      if (a === b) passed++;
      else failures.push(`${what} — got ${a}, want ${b}`);
      return a === b;
    },

    /** Assert that a function throws. */
    throws(what, fn) {
      try {
        fn();
        failures.push(`${what} — expected a throw, got none`);
        return false;
      } catch {
        passed++;
        return true;
      }
    },

    /** Print the result and exit non-zero if anything failed. */
    done() {
      if (failures.length === 0) {
        console.log(`ok   ${name} — ${passed} assertions`);
        process.exit(0);
      }
      console.log(`FAIL ${name} — ${failures.length} failed, ${passed} passed`);
      for (const f of failures) console.log(`       ${f}`);
      process.exit(1);
    },
  };

  return api;
}

function fmt(v) {
  if (typeof v === "string") return JSON.stringify(v);
  return String(v);
}
