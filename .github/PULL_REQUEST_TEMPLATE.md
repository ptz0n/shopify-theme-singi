## What and why

<!-- One or two sentences. Link the issue: Fixes #123 -->

## Checklist

- [ ] `npm run check` passes (theme check + repo rules)
- [ ] `npm run docs` run if LiquidDoc or schema changed (`docs/reference/` is up to date)
- [ ] New strings are in `locales/en.default.json` and every other locale
- [ ] No hardcoded colors or fonts; tokens only (see [AGENTS.md](../AGENTS.md))
- [ ] Non-obvious choices have a record in `docs/decisions/` (new or updated)
- [ ] No placeholder copy or demo images shipped
- [ ] Works without JavaScript, in dark mode and in RTL
- [ ] Measured, not guessed: attach Lighthouse or screenshots for visual or performance changes
- [ ] I wrote this code or have the right to license it under MIT
