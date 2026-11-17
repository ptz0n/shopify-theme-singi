# 041. JavaScript is typed with JSDoc and checked by `tsc`, with no build step

Status: accepted (supersedes the typed JS and build step rows of [decision 039](039-dev-tooling-stays-dependency-free.md) in part: typing is adopted, the build step stays declined)
Area: developer experience | JavaScript
Code: `tsconfig.json`, `types/globals.d.ts`, `package.json` (`typecheck`), `scripts/check.mjs` (JSDoc is not counted in budgets), `assets/utils.js`, `assets/soft-nav.js`

## Context

Decision 039 measured `tsc --checkJs` at 188 / 371 / 517 errors across the modules and declined it for the cost of about 190 annotations. The maintainer then chose to adopt typed JS and to keep it free of a build step: the files in `assets/` stay exactly what Shopify serves.

## Decision

- **Types live in JSDoc comments,** checked by `tsc --checkJs --noEmit` under `strict`. The runtime code is the same file; there is nothing to compile, so `shopify theme dev` and `theme push` are unchanged.
- **Coverage grows file by file.** `tsconfig.json` `include` lists the typed files; adding a module to that list is the unit of work. Typed now: `assets/utils.js` and `assets/soft-nav.js`. Next: `product-form.js` (62 errors under `strict`), then the rest.
- **Shared globals** (`window.singiPlaceholder`, `navigator.connection`, `singi:*` document events) are declared once in `types/globals.d.ts`, which is not uploaded (`.shopifyignore`).
- `npm run typecheck` is part of `npm run check` (so of the pre-push hook and CI).
- **Budgets ignore JSDoc.** `scripts/check.mjs` strips `/** ... */` before measuring JavaScript, because type comments cost visitors nothing once the CDN minifies, and a budget that counted them would punish typing. Numbers did not move.

## Why

- Interaction code (`soft-nav`, `product-form`, cart) is where regressions hide; the compiler finds a wrong property or a nullable DOM query before a browser test does.
- Contributors get editor hints and refactoring help in plain `.js`.
- No build step means the file a reader opens is the file that runs, and there is no second pipeline to keep in step with Shopify's.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| TypeScript sources compiled to `assets/` | A build step and committed generated output; see decision 039 (the CDN already minifies). |
| `// @ts-nocheck` on the modules not yet typed | A green check that checks nothing. Untyped files are simply not in `include`. |
| `strict: false` | Misses the null checks that find real bugs in DOM code. |

## Edge cases and dead ends

- Casts are written as JSDoc (`/** @type {HTMLElement} */ (x)`), never as runtime code: the typed files behave the same. `go()` and `swap()` keep their exact logic.
- `event.target` is `EventTarget` in the DOM lib; the single recurring pattern is casting it to `Element` before `closest()`.
- `Navigator.connection` is Chromium-only and declared optional, so the existing `?.` stays correct.
- Typing found no bug in these two files; its value is on the files that are not typed yet and on future edits.

## Trade-offs we accept

A dependency (`typescript`, pinned) and a growing list of files in `tsconfig.json`; casts that document, but do not prove, what the DOM contains.

## How to verify

`npm run typecheck` prints nothing and exits 0; `npm run check` passes; `npm run test:all` passes.

## Revisit when

Every module is typed (then `include` becomes `assets/*.js`), or a type error needs a cast so contrived that the code should change instead.
