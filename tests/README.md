# Tests

```bash
npm test
```

Plain node, no framework, no extra dependencies — it runs on a fresh clone
with nothing installed. Only failures print; a green suite is one line.

These lived in a scratch directory until now, and were lost once when the
machine they were on was rebuilt. That is why they are in the repo.

## What's covered

| Suite | What it protects |
|---|---|
| `clientSummary` | The money on Mya's dashboard. Headline case: the deposit only comes off when it was actually **paid** — appointments she adds herself are unpaid, and used to be discounted $20 she never took. |
| `inspo` | Photo paths, the Stripe metadata encoding, JPEG sniffing, and which files the cleanup is allowed to delete. |
| `inspoSweep` | The only code here that deletes a client's file. Written the paranoid way round — most of it asserts that **nothing** was deleted. |
| `uploadInspo` | The real upload route. Asserts bad input never reaches storage, not merely that it returns a 4xx. |
| `policy` | The client-facing promises. No page may promise a refund or a credit, the parked cancel flow stays off, and flipping the flag brings it back. |

## Writing one

Drop a `*.test.mjs` file in here. The runner picks it up automatically.

```js
import { suite } from "./helpers/harness.mjs";
const { ok, eq, throws, done } = suite("myThing");

ok("a true thing", 1 + 1 === 2);
eq("a value", got, want);

done();  // prints the result and sets the exit code
```

Helpers:

- `helpers/repo.mjs` — `read("pages/index.js")` and `load("utils/features.js")`,
  both resolved from the repo root so the suites run anywhere.
- `helpers/loader.mjs` — lets a test import a real Next API route by mapping
  the `@/` alias and swapping in a fake Supabase. Register it *before* the
  dynamic import of the route.
- `helpers/supabaseStub.mjs` — records every storage call, so a test can
  assert a rejected request wrote nothing.

## The habit worth keeping

Write the assertion that fails **before** the fix, especially for anything
touching money or deletion. Two of the worst bugs in this project — texts
reported as sent that never sent, and an alert whose own condition could
never fire — were both cases of something reporting success while doing
nothing. A test that never fails is that same bug wearing a lab coat.

Check yours can fail: break the line it guards, watch it go red, put it back.
