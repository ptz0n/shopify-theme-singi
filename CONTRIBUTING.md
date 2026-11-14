# Contributing to Singi

Thanks for helping. Singi is a performance-first Shopify theme, so the bar is "does it earn its bytes?". Small, measured, accessible changes merge fast.

By contributing you agree that your work is licensed under the [MIT license](LICENSE) and that you wrote it or have the right to submit it. Do not paste code from other themes or any code you cannot license under MIT.

## Before you start

- Bugs and small fixes: open a pull request directly.
- New sections, blocks or settings: open an issue first so we can agree on scope and budget.
- Security problems: see [SECURITY.md](SECURITY.md), never a public issue.

Coding agents (Claude Code, Cursor, Codex): read [AGENTS.md](AGENTS.md) first. The rules there apply to people too.

## Set up

Requirements: Node 20+, [Shopify CLI](https://shopify.dev/docs/api/shopify-cli) 3.x and a Shopify development store.

```bash
npm install
cp .env.example .env                                # set SINGI_STORE
cp shopify.theme.toml.example shopify.theme.toml    # Theme Access password
npm run dev                                         # hot reload against your dev store
```

Never commit `.env` or `shopify.theme.toml`. See [docs/tooling.md](docs/tooling.md).

## Make a change

1. Fork, branch from `main`, keep the pull request to one concern.
2. Follow the recipes in [docs/extending.md](docs/extending.md) and the rules in [AGENTS.md](AGENTS.md): tokens for colors and fonts, logical CSS properties, `{{ 'key' | t }}` for strings, LiquidDoc on snippets and blocks, no third-party scripts.
3. Run before you push:

```bash
npm run check   # shopify theme check + repo rules and budgets
npm run docs    # regenerate docs/reference when LiquidDoc or schema changed
```

4. Preview every component on one page with the [component library](docs/component-library.md) (`npm run mock:apply`, then `/pages/mock-styleguide`). Check the page in the browser: dark mode, RTL, no JavaScript, 44px touch targets, no horizontal scroll. [docs/testing.md](docs/testing.md) has the checklist.
5. Open the pull request and fill in the template. Visual or performance changes need before/after evidence.

## Decisions

Before changing how something works, read its record in [docs/decisions/](docs/decisions/README.md); the reasoning and the edge cases are there. If your change adds or reverses a non-obvious behavior, add or update a record in the same pull request.

## Commit messages and versions

Short imperative subject ("Fix breadcrumb fallback for collections"), details in the body if needed. User-facing changes get a line in [CHANGELOG.md](CHANGELOG.md) under Unreleased.

## Strings and languages

New strings go in `locales/en.default.json` and every other locale file. Machine translations are welcome but mark them for native review in the pull request. See [docs/i18n.md](docs/i18n.md).

## Name

Code is MIT. The name "Singi" and any logo identify the official project. Forks are welcome; please give a forked or commercial theme its own name, and do not imply it is the official Singi.

## Conduct

Be kind. Participation is covered by the [Code of Conduct](CODE_OF_CONDUCT.md).
