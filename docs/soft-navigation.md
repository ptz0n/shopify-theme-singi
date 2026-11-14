# Soft navigation

How `assets/soft-nav.js` turns link clicks into client-side page swaps with skeletons, what it caches, what it deliberately leaves alone, the events it fires, and the analytics caveat. Read it before touching client-side navigation, skeletons or head syncing. It is off by default.

## Enabling

Theme settings > Performance > "Enable soft navigation with skeletons" (`settings.soft_navigation`, default off). When on, `layout/theme.liquid` adds `data-soft-nav` and `data-soft-nav-skip` to `<html>`, renders `snippets/skeletons.liquid` and loads `assets/soft-nav.js` as a module. The speculation-rules prefetch is then disabled so pages are not fetched twice. Cross-fade transitions are a separate setting (`settings.view_transitions`).

Soft navigation is progressive enhancement: with JavaScript off, or on any failure, links navigate normally.

## Analytics caveat (read before enabling)

A soft navigation does not reload the document, so Shopify's page-load analytics, consent handling and any third-party tags that fire on page load do not run for the new page. Page views, ad pixels and consent state can be under-counted or stale. The module dispatches a `singi:navigate` event on `document` after each swap so an integration can report the view, but no analytics adapter is included and none has been verified. Keep it off until your analytics and consent setup have been checked on the dev store. Enabling it on a store with paid advertising without that check can corrupt attribution.

## What a navigation does

1. **Eligibility** (`eligible()`): a plain left click on a same-origin `<a href>` with no modifier keys, no `target` other than `_self`, no `download`, no `data-no-soft-nav`, no `rel="external"`, and a different path or query than the current page. Hash-only changes are left to the browser. Paths listed in `data-soft-nav-skip` are excluded: the cart URL, account URL, `/checkout`, `/apps`, `/cdn`, `/password`, `/challenge` (and their sub-paths).
2. **Intent prefetch**: on `pointerover` (after 65 ms of hover), `touchstart` and `focusin`, the page HTML is fetched with `fetch` into an in-memory cache. Skipped when the browser reports `saveData`.
3. **Cache**: a `Map` keyed by path and query, 30 second TTL, at most 24 entries, in-flight requests are shared, failed requests are evicted. The cache is cleared whenever `singi:cart` fires so cart-dependent pages are not stale.
4. **Click**: `preventDefault`, remember the scroll position, then `go(url, { push: true })`.
5. **Skeleton**: if the page is not ready within 90 ms, `<main>` content is replaced with a clone of the matching `<template>` from `snippets/skeletons.liquid` and `aria-busy="true"` is set. If the page is cached or arrives quickly, no skeleton appears.
6. **Validation**: the response must be OK HTML, contain `#main`, and have the same `data-layout` as the current document. Otherwise it does a hard navigation with `location.assign`.
7. **History**: the current entry is updated with the saved scroll position, then `history.pushState` uses the final response URL (redirects respected) plus the hash. `history.scrollRestoration` is set to `manual`.
8. **Head sync** (`syncHead`): updates `document.title`, replaces these managed elements from the new document: `meta[name=description]`, `meta[name=robots]`, `link[rel=canonical]`, `meta[property^=og:]`, `meta[name^=twitter:]`, `meta[property^=product:]` and every `script[type="application/ld+json"]`. New `<link rel="stylesheet">` elements not already present (Shopify's compiled component stylesheet differs per page) are appended and awaited, up to 3 seconds, so there is no flash of unstyled content.
9. **Swap** (`swap`): replaces the children of `<main id="main">` only. The header, footer, import map, tokens and everything else stay mounted, so nothing re-renders and open state persists. It also updates `data-template` on `<html>`.
10. **Script revival** (`revive`): scripts inserted by parsing are inert, so each script in the new content (except JSON-LD) is recreated so it executes. A module script whose `src` is already on the page is dropped, since modules run once. Custom elements upgrade automatically when inserted.
11. **Navigation state**: sets `aria-current="page"` on matching header links and closes the mobile popover menu.
12. **Scroll and focus**: scrolls to the hash target if present, otherwise to the top (or the saved position on back/forward). Moves focus to `<main>` (`tabindex="-1"`, no scroll) and writes the new title into the `#route-announcer` live region for screen readers.
13. **Event**: dispatches `singi:navigate` with `detail.url`.
14. **View transitions**: if `data-view-transitions` is set, the browser supports `document.startViewTransition` and the user has not requested reduced motion, the swap runs inside a view transition.

### Back and forward

`popstate` compares the new location to the current one. If the path and query changed it calls `go(url, { push: false, scrollY: event.state.y })`, which swaps without pushing. Scroll position is stored in `history.state.y` on navigation and on `pagehide`.

### Concurrency

A token increments on each navigation. Responses and skeleton timers from superseded navigations are ignored.

## Events

| Event | Target | Detail | When |
| --- | --- | --- | --- |
| `singi:navigate` | `document` | `{ url }` | After a soft navigation swap. Hook analytics here. |
| `singi:cart` | `document` | the cart JSON | After add to cart or cart change (`cartChanged` in `assets/utils.js`). Clears the soft-nav cache. |
| `singi:facets` | `document` | `{ url }` | After the collection filter update (`assets/facets.js`). |

Example listener:

```js
document.addEventListener('singi:navigate', (event) => {
  // report a page view with event.detail.url
});
```

## Writing code that survives swaps

- Put behaviour in custom elements and attach handlers to the element or by delegation. See [AGENTS.md](../AGENTS.md).
- Do not rely on `DOMContentLoaded` or `load` in content inside `<main>`.
- Do not put behaviour in the header or footer that depends on being re-created per page; they persist.
- Avoid inline scripts in `<main>`. They are revived, but they re-run on every swap.

## Add a skeleton

1. Add `<template id="skeleton-<name>">` to `snippets/skeletons.liquid`, with classes from its `{% stylesheet %}`. Use `aria-hidden="true"` and match the real page geometry (aspect ratios, grid columns) so the swap does not shift layout.
2. Map the route in `skeletonFor()` in `assets/soft-nav.js` (current mapping: `/products/` is `product`, `/collections/<handle>` and `/search` are `collection`, everything else is `page`).
3. Test with throttled network.

## Exclude a route

- Per link: add `data-no-soft-nav` to the `<a>`.
- Per path: add the path to the `data-soft-nav-skip` string in `layout/theme.liquid` (space separated, matches the path and its sub-paths).
- For a page that must not be swapped into (for example one with a different layout), give it a different `data-layout` on `<html>`; the swap then falls back to a hard navigation.

## Limitations

- Pages are fetched with a plain `fetch`, so any content that Shopify personalises per request is as fresh as the cache TTL.
- Third-party content in `<main>` that depends on a full page load will not initialise after a swap.
- Rendered output has not been verified against a live store yet. Test per [testing.md](testing.md#soft-navigation).
