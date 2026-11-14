# Tooling

All npm scripts, what they do, the environment variables they read, and the dev-store workflow including Theme Access password setup. Read it when you need to run, check, measure or deploy. `package.json` and the scripts in `scripts/` are the source of truth if this file disagrees. There is no CI configuration in this repo by design: run `npm run check` and `npm run docs:check` locally before every push.

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | `shopify theme dev` against the store in `SINGI_STORE` through `scripts/shopify.mjs`. Hot-reloads a development theme and prints the preview and editor URLs. |
| `npm run ship` | The end of an iteration in one command (about 5 seconds): theme check, repo rules, regenerate `docs/reference`, then push the live `singi` theme and `singi-dev` in parallel. Stops before pushing if a check fails. While `npm run dev` runs you do not need it to see a change. |
| `npm run test:media` | Gallery, variant image, video and card heart assertions on the mock pages, in headless Chrome. Defaults to the local `npm run dev` server at `127.0.0.1:9292`, which signs in to a password protected store for you. Needs `npm install --no-save puppeteer-core`. See [media.md](media.md#tests). |
| `npm run push` | Pushes to the theme in `shopify.theme.toml` (environment `DEV`, the live `singi` theme on the dev store). |
| `npm run theme:list` | Lists themes and ids on the dev store. |
| `npm run check` | Runs `check:theme` then `check:rules`. Run before finishing any change. |
| `npm run check:theme` | `shopify theme check --fail-level error`. Official Liquid, schema, translation and performance checks. `.theme-check.yml` is `extends: theme-check:recommended` with no overrides: fix the code, do not add exceptions. |
| `npm run check:rules` | `node scripts/check.mjs`. Repo rules: file size budgets, no remote assets, no literal `font-family` or font files, no physical CSS properties, no `{% javascript %}`, script tag rules, **placeholder guard rails** (see [guardrails.md](guardrails.md)) and locale key parity across `locales/*.json`. |
| `npm run docs` | `node scripts/gen-reference.mjs`. Generates `docs/reference/*.md` from LiquidDoc headers and `{% schema %}` blocks. Do not edit generated files by hand. |
| `npm run docs:check` | Fails if `docs/reference/` is out of date. |
| `npm run perf:lighthouse` | `node scripts/lighthouse.mjs`. Lighthouse CI, mobile, throttled. See below. |
| `npm run perf:liquid` | Passthrough to `shopify theme profile`. Pass flags after `--`, for example `npm run perf:liquid -- --url /products/example`. |
| `npm run checkout:plan` | Dry run of the checkout branding sync. Changes nothing. See [checkout-branding.md](checkout-branding.md). |
| `npm run checkout:apply` | Applies the plan to the store. Changes a checkout profile. Only run when asked. |

### perf:lighthouse

| Variable | Meaning |
| --- | --- |
| `SINGI_URL` | Store base URL, for example `https://your-store.myshopify.com`. Required. |
| `SINGI_THEME_ID` | Preview an unpublished theme by id. |
| `SINGI_PRODUCT` | Product path to test, for example `/products/example`. |
| `SINGI_COLLECTION` | Collection path to test, for example `/collections/all`. |
| `SINGI_PASSWORD` | **Storefront** password (the password page of a password-protected store). Not the Theme Access password. |

It tests the home, product and collection pages, several runs each, and reports performance, accessibility, best practices and SEO. Record the median in [testing.md](testing.md#results-template). Preview themes and the editor are not streamed by Shopify, so streaming behaviour only shows on a published theme.

## Dev-store workflow

The development store is the one in `SINGI_STORE` (for example `your-store`, admin at `https://admin.shopify.com/store/your-store`). It is required: the scripts have no default store.

All store commands go through `scripts/shopify.mjs`. It loads `.env`, sets the store, and runs the Shopify CLI. With a Theme Access password in `.env` there is no browser login.

### Theme Access password (no CLI login)

A Theme Access password lets the CLI push and pull themes for one store without a Shopify account session. A person has to create it; it cannot be scripted.

1. In the store admin, install the **Theme Access** app (Apps, search for Theme Access, free, by Shopify).
2. Open it and **Create password**. Enter a name and the email address that should receive it. Shopify emails the password once; it starts with `shptka_`.
3. Copy `.env.example` to `.env` and paste it:

   ```bash
   cp .env.example .env
   # then edit .env
   SHOPIFY_CLI_THEME_TOKEN=shptka_...
   ```

4. Put the store, password and theme id in `shopify.theme.toml` (environment `DEV`; copy `shopify.theme.toml.example`), then:

   ```bash
   npm run theme:list   # see themes and ids
   npm run push         # push to the DEV theme
   ```

`.env` is git-ignored and never uploaded to Shopify. Treat the password like a credential: one per person or machine, revoke it in the Theme Access app when it is no longer needed.

What it covers and what it does not:

- It covers `shopify theme` commands (push, pull, dev, list, profile, check). Passing it is the same as `--password` on a command.
- It does **not** cover `shopify store execute` or `shopify store auth`, which the checkout branding sync uses. Those need a normal Shopify login with the scopes listed in [checkout-branding.md](checkout-branding.md).
- Whether it avoids Shopify's identity verification challenge has not been confirmed on this store.

Without a token the wrapper warns and falls back to the normal CLI login. The login URL is printed in the terminal, so you can open it in any browser. The CLI holds one logged-in account at a time: `shopify auth logout` then `shopify auth login` switches accounts.

### Rules

- **The maintainer's dev store runs `singi` as its live theme**, on purpose: the store is not open to customers, and Shopify's CDN, caching and streamed HTML behave differently for live and preview themes, so profiling and Lighthouse only mean something on the live theme. `npm run push` therefore passes `--allow-live`, which the guard below only permits for stores listed in `SINGI_LIVE_STORES`. Contributors who do not want a live dev theme can use `npm run dev:push` (an unpublished theme) instead.
- The live-theme guard is scoped. `scripts/shopify.mjs` refuses `--live`, `--allow-live` and `theme publish` for every store except those in `SINGI_LIVE_STORES` (default: none, so no script can go live anywhere until you list your own dev store), unless `SINGI_ALLOW_LIVE=1` is set on purpose. Any other store, including a production store, stays protected.
- Because the dev store theme is live, every `npm run push` changes what the dev storefront shows immediately. Do not point `.env` or `shopify.theme.toml` at a production store.
- Do not push over a theme you did not create.
- `config/settings_data.json` is written by the theme editor. Pushing local settings can overwrite merchant changes: `shopify theme pull` first if the editor was used.

### Testing against the dev server

`npm run dev` serves the store at `http://127.0.0.1:9292` and handles the storefront password, so scripts need no password: `npm run test:media` uses it by default, and so can Lighthouse (`SINGI_URL=http://127.0.0.1:9292 npm run perf:lighthouse`). Lighthouse through this proxy is good for accessibility, SEO, layout shift and blocking time. Its performance score is pessimistic (an extra proxy hop, about 500 to 800 ms to first byte) and its best-practices score is wrong: the page is plain HTTP, and Shopify's own `shop.app` iframe and cookie are flagged. For real performance numbers use the storefront over HTTPS with `SINGI_PASSWORD` set.

### The password page on a development store

Shopify always shows its own password page to visitors of a development store; a theme's `layout/password.liquid` and `sections/main-password.liquid` cannot replace it (see the [password template docs](https://shopify.dev/docs/storefronts/themes/architecture/templates/password)). On `your-store` the Singi page is therefore only visible to the signed-in owner at `/password`, inside the normal theme layout, and a clean browser sees Shopify's page. To see the real standalone layout, use a store that is not a development store.

## Other useful CLI commands

| Command | Use |
| --- | --- |
| `shopify theme check -o json` | Machine-readable theme check output. |
| `shopify theme console` | Liquid REPL against the store. |
| `shopify theme package` | Zip the theme. |
| `shopify theme pull` | Download remote changes (editor edits). |

Run these through `node scripts/shopify.mjs theme ...` to use the stored password and store.

## Editor and agent setup

- Install the Shopify Liquid VS Code extension for syntax, theme check and docs hover.
- Agents: read [../AGENTS.md](../AGENTS.md). `CLAUDE.md` imports it.
