/* Globals the theme adds to the page, so `npm run typecheck` knows them. Types only: nothing here is shipped. */

interface Window {
  /** Set by assets/image-tone.js; called after a soft navigation swaps new images in. */
  singiPlaceholder?: () => void;
  Shopify?: { routes?: { root?: string }; country?: string; locale?: string };
}

interface Navigator {
  /** Network Information API (Chromium only). */
  connection?: { saveData?: boolean };
}

/** Events the theme dispatches on `document`. */
interface DocumentEventMap {
  'singi:cart': CustomEvent<{ item_count: number }>;
  'singi:navigate': CustomEvent<{ url: string }>;
}
