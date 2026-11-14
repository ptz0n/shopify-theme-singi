# Security policy

## Reporting a vulnerability

Please do not open a public issue for a security problem. Report it privately with a
[GitHub security advisory](https://github.com/ptz0n/shopify-theme-singi/security/advisories/new).
You will get a reply within a few days.

## Scope

singi is a Shopify theme: Liquid, CSS and small ES modules served from Shopify's CDN. In scope:

- XSS or injection through theme output (for example unescaped Liquid output, `innerHTML` use in `assets/*.js`).
- Leaking customer or cart data to third parties.
- Scripts in `scripts/` that could touch a store the user did not configure.

Out of scope: vulnerabilities in Shopify itself (report those to Shopify) and in third-party apps.

## Secrets

Never commit a Theme Access password, Admin API token or storefront password. `.env` and
`shopify.theme.toml` are git-ignored. If you pushed one by mistake, revoke it in the Shopify
admin first, then tell us.
