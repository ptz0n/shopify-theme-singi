# Checkout branding sync

How `scripts/checkout-branding.mjs` keeps the store's checkout visually aligned with the theme: what it reads, what it maps, how to run it safely, its limits, and how to extend it. Read it before changing checkout appearance or the script. **The script is the source of truth**; if this document and the script disagree, trust the script and fix this file.

## What it does

The script reads the theme's visual settings and sends them to the Admin GraphQL `checkoutAndAccountsConfigurationUpdate` mutation (API 2026-07). The older `checkoutBrandingUpsert` mutation is deprecated in favour of it. Both operations the script uses were validated against the 2026-07 Admin schema.

1. Reads `config/settings_data.json` (`current` values) and falls back to the defaults in `config/settings_schema.json` for any setting the editor has not changed.
2. Maps theme settings to checkout branding fields (below).
3. Prints the plan: each theme setting, the checkout field it feeds, the value, and the exact GraphQL variables.
4. Only with `--apply` does it send anything to the store.

The default is a dry run. `npm run checkout:plan` never contacts the store. `npm run checkout:apply` changes the store's checkout configuration, and a published configuration shows the change immediately. Only apply on request, and read the plan first.

## One look for the whole customer journey

A single configuration styles checkout, the order status page, customer accounts and the sign-in page. Design tokens (fonts, corner radius) and the shared components (buttons, controls) apply to all of them. The script also writes the same colors explicitly to each surface (`surfaces.checkout`, `surfaces.customerAccounts`, `surfaces.signIn`: `main`, plus `header` and `footer` where the surface has them), so no surface falls back to a different default. Customer accounts here means Shopify's new customer accounts; the older Liquid account pages are the theme's own templates.

Not mapped yet: logos, header and footer layout, section borders and shadows on customer accounts, and the sign-in background image. The Admin API accepts all of them; add them in `buildConfiguration` when a design asks for it.

## Mapping

All field paths are under `configuration.branding`.

| Theme setting | Checkout field | Notes |
| --- | --- | --- |
| `font_body` | `designTokens.typography.primary` and `.secondary` as `shopifyFontGroup` | `baseFontHandle` is the setting value (default `inter_n4`). `boldFontHandle` is the same family at weight 6 (`inter_n6`), matching the theme's strong weight. Override with `--bold-weight 7`. `loadingStrategy` is `SWAP`. |
| (fixed) | `designTokens.typography.size.base` | 16 |
| `radius` | `designTokens.cornerRadius` `base`, `small`, `large` | `base` is the radius, `small` is half (minimum 1), `large` is double (minimum 2). A radius of 0 sets components to `NONE` (square corners). |
| `{scheme}_background`, `_foreground`, `_border`, `_accent` | `components.main.colors.base` | `background`, `text`, `border`, `accent`, `icon` (foreground), `decorative` (accent). |
| same | `components.main.colors.control` | Form fields: background, text, border, accent. |
| `{scheme}_foreground` on `{scheme}_background` | `components.main.colors.primaryButton` | Inverted: background is the foreground color, text is the background color. |
| `{scheme}_border` | `components.main.colors.secondaryButton` | Background, text and border colors. |
| `{scheme}_*` colors | `surfaces.checkout`, `surfaces.customerAccounts` and `surfaces.signIn` components | The same colors as `components.main`, so every surface agrees. |
| `radius` | `components.primaryButton`, `components.secondaryButton`, `components.control` | `cornerRadius` is `BASE` or `NONE`. Buttons use `blockPadding: BASE` and bold primary font. Primary has no border, secondary has a full border. |

`{scheme}` is `light` by default. Pass `--scheme dark` to map the dark colors instead.

Not mapped:

- Dark mode. Checkout branding in this API is a single scheme, so the script maps one scheme. Light is the default.
- `light_surface` and `light_muted`. The order summary and secondary text roles are not assigned yet.
- The monospace font (`font_mono`). Checkout does not use it.
- Logo, header and footer layout, favicon, spacing and anything from section or block settings.
- The `designTokens.colors.palette` field. The script uses the per-component color roles instead.

## Fonts

Checkout takes fonts from Shopify's font library by handle (for example `inter_n4`). singi only allows `font_picker` fonts, so the theme's handles are valid for checkout. If `font_body` is not a handle with a weight suffix (for example a system font), the script skips typography and prints a warning. Custom or hosted fonts are not supported.

## Running it

```bash
# Safe: print the plan and variables, contact nothing
npm run checkout:plan

# Print only the variables JSON
node scripts/checkout-branding.mjs --json

# One time per store: authenticate the CLI with the scopes this needs
shopify store auth --store your-store.myshopify.com \
  --scopes read_checkout_and_accounts_configurations,write_checkout_and_accounts_configurations,read_checkout_settings,write_checkout_settings

# Change the store (only when asked)
npm run checkout:apply
```

Flags: `--apply`, `--store <domain>` (default `$SINGI_STORE`), `--config-id <gid>` (default: the published configuration, found with a query), `--scheme light|dark`, `--bold-weight 6|7`, `--json`.

Authentication goes through Shopify CLI (`shopify store execute`), so no API tokens are stored in the repo or environment. The scopes above are the ones the validator reported for the two operations.

## Requirements and limits

- The store must be on Shopify Plus or a development store plan, and the user must be allowed to change checkout and accounts settings.
- Checkout branding controls colors, typography, corner radius, buttons, form fields and some layout options. It cannot reproduce arbitrary CSS, so the match is close, not pixel-identical.
- The script sends only the fields it maps. Fields it does not map keep the store's current values.
- Not yet run against a store. Treat the first apply on the dev store as the test, and check the checkout visually afterwards.

## Extending the mapping

1. Add the theme setting to `config/settings_schema.json` if it does not exist.
2. Find the target field in the Admin GraphQL reference under `CheckoutAndAccountsConfigurationBranding*` input types.
3. Add it in `buildConfiguration` in `scripts/checkout-branding.mjs` and call `note(...)` so it shows in the plan. Keep fonts restricted to library handles.
4. Run `npm run checkout:plan` and read the variables.
5. If you change an operation, validate it against the Admin schema before running it.
6. Apply on the dev store, check the checkout, and update the mapping table above.
