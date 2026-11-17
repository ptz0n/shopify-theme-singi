# 039. Developer tooling stays dependency-free: native git hooks, a small CI, and no typechecker, build step or Liquid formatter

Status: accepted
Area: developer experience | CI | performance
Code: `.githooks/pre-commit`, `.githooks/pre-push`, `scripts/install-hooks.mjs`, `.github/workflows/check.yml`, `.vscode/extensions.json`, `package.json` (`prepare`, `hooks`)

## Context

The theme has no `dependencies` or `devDependencies` and no lockfile: Shopify CLI is installed globally, puppeteer with `--no-save`. Lint is already fast (Shopify Theme Check 0.9 s, repo rules 0.2 s, generated-docs check 0.1 s), and the browser suite runs in about two minutes with `npm run test:all`. The roadmap asked to evaluate a typed-JS spike, a build step, the programmatic Theme Check API, CI, git hooks and a Liquid formatter, adopting each only with measured gains. Everything below was measured with transient `npx` runs, so nothing was installed to evaluate.

## Decision

| Item | Decision | Evidence |
| --- | --- | --- |
| **Git hooks** | **Built, with no hook manager.** `core.hooksPath` points at a committed `.githooks/` of two shell scripts, set automatically by `npm install` (the `prepare` script) or by `npm run hooks`. Pre-commit runs the repo rules and the generated-docs check; pre-push runs everything `npm run check` runs. | 0.2 s and 1.1 s; the pre-commit hook was shown to block a real RTL violation (exit 1, the offending line). Lefthook, hk and prek are good tools but each would be the repo's first dependency, for two three-line scripts. |
| **CI** | **Built, small.** One GitHub Actions workflow runs `npm run check` and `npm run docs:check` on pull requests and pushes to `main`, with a cancelled-in-favour-of-newer concurrency group, read-only permissions and a 5 minute timeout. | The browser tests need a Shopify development store and its credentials, so they stay local (`npm run test:all`). |
| **Typed JS (`checkJs`)** | **Not adopted here; adopted later by [decision 041](041-typed-javascript-with-jsdoc-and-no-build-step.md)** (JSDoc, no build step). | `tsc --checkJs` over all 24 modules: 188 errors with no strictness, 371 with `strictNullChecks`, 517 with `strict`. After removing the pattern that dominates, no real bug remained: the errors are `event.target` typed as `EventTarget` (about 125), and plain scripts whose names collide with `lib.dom` globals (`stop`, `closed`, `current`, `scan`). A clean run needs about 190 casts and annotations; JSDoc counts toward the source-size budgets, which measure source. The two files the roadmap names: `soft-nav.js` 11 / 16 / 30 errors, `product-form.js` 21 / 51 / 62. |
| **Build step (esbuild)** | **Not adopted.** | Minifying all modules saves 39% raw and 27% brotli (27,466 to 20,046 bytes), but Shopify's CDN already minifies what it serves (30 to 45% observed, `AGENTS.md` rule 10), so visitors would gain nothing, and the budgets stay a safe upper bound on source. |
| **Programmatic Theme Check API** | **Not needed.** | No rule needs it: `scripts/check.mjs` expresses the repo rules and the CLI covers the standard ones. The package (`@shopify/theme-check-node`, a library without a command) would only be a way to rebuild what the CLI already does. |
| **Liquid formatter** (Prettier with `@shopify/prettier-plugin-liquid`) | **Not adopted here; adopted later by [decision 040](040-liquid-is-formatted-by-prettier.md)** with an ignore rule for `icon.liquid`. | On the 86 Liquid files (5,953 lines) it changes 82 and rewrites +4,574 / -1,538 lines, and it is not safe here: it adds a trailing newline to `snippets/icon.liquid`, which is deliberately written without one so an inline icon never gains a stray space before the text next to it. |
| **Editor integration** | **Recommended, not required:** `.vscode/extensions.json` suggests the Shopify Liquid and Theme Check extension and EditorConfig; `.editorconfig` already exists. | |

## Why

- **Nothing to maintain:** no lockfile to update, no hook manager's config format, no formatter diff on every pull request.
- **The fast checks are already fast:** the hooks and CI exist to run them where people forget, not to speed them up.
- **Each declined tool was measured,** so the decision can be revisited with numbers instead of taste.

## Alternatives rejected

| Alternative | Why not |
| --- | --- |
| Lefthook, hk, prek, Husky | A dependency or a binary to install for two short scripts; native hooks do the same with no setup beyond `npm install`. |
| A pre-commit hook that runs Theme Check | 0.9 s on every commit; the repo rules are enough at commit time, and the push hook plus CI run the full check. |
| Running the browser tests in CI | Needs a development store and credentials in the repository settings, and the suite hits a shared store. |
| Typechecking as a CI gate with `// @ts-nocheck` escapes | A gate full of escapes shows nothing. |

## Edge cases and dead ends

- **`prepare` runs on `npm install`,** which most contributors do once; a contributor who never installs has no hooks, so CI is the backstop and the hooks are not a security control.
- **`--no-verify` skips the hooks.** Use it only when justified; CI still runs the same checks.
- **The pre-push hook skips Theme Check without a `shopify` command** (it warns and runs the repo rules and docs checks); CI runs the full check.
- **CI uses `@shopify/cli@3`,** the same command as local; the install is the longest step of the job (about 80 MB). Its duration on GitHub's runners has not been measured: no workflow has run yet. The target from the roadmap is a pull request median under two minutes; record the first real runs here.
- **`tsc` against these files needs `paths` for `@singi/utils`** (the import map), and files without `import` or `export` are scripts that share the global scope with `lib.dom`; both were the first false positives.

## Trade-offs we accept

- **No type safety on the interaction code** beyond the browser tests (`npm run test:all`, 42 runs).
- **Hooks are per clone** and opt-out by `--no-verify`.

## How to verify

`npm run hooks`, then `sh .githooks/pre-commit` and `sh .githooks/pre-push`; `npm run check`; the workflow runs on the first pull request.

## Revisit when

The theme gains a dependency anyway (a hook manager then costs nothing), the budgets are measured on minified output (JSDoc types become free), Shopify stops minifying on the CDN, or a team wants format-on-save for Liquid (then evaluate Prettier's plugin again with the whitespace-control rules in mind).
