/*
  Search as you type, in the header's search dropdown (sections/header.liquid).

  Typing asks Shopify's predictive search for suggestions, collections, products, pages and articles
  through the Section Rendering API (sections/predictive-search.liquid renders the
  markup). Requests are debounced, a newer keystroke aborts the older request, and results are
  cached per query: in memory, and in sessionStorage so they survive a page change. The
  cache is per tab and per session (search terms are personal, so nothing is kept longer),
  lasts 10 minutes (prices and stock change) and holds the 10 newest queries. When a page opens
  with terms already in the field (the search page), their results are fetched while the browser
  is idle, so the dropdown is ready before it is opened. The input is an ARIA combobox: the arrow keys move a highlight through the
  options (aria-activedescendant), Enter follows the highlighted result or submits the search,
  Escape closes the panel without clearing the field. The list stays visible and usable until the panel closes, whatever has focus.
  Tab goes from the field to the suggestions, then the matches and the button; the arrows move between them too. Without JavaScript the form is a normal GET to /search.
*/
const DELAY = 180;
/* The cache holds markup: bump the version in the key whenever snippets/search-results.liquid changes, or old lists linger. */
const STORE = 'singi-ps-v8';
const LIMIT = '4';
const TTL = 6e5;
const KEEP = 10;
const COMPLETE = 'search__more'; /* the last part of a full result: a cached list without it is partial or stale, and is ignored */
const idle = window.requestIdleCallback ?? ((callback) => setTimeout(callback, 400));

let disk;
const stored = () => {
  if (!disk) {
    try {
      disk = JSON.parse(sessionStorage.getItem(STORE)) ?? {};
    } catch {
      disk = {};
    }
  }
  return disk;
};

class PredictiveSearch extends HTMLElement {
  #cache = new Map();
  #controller;
  #timer;

  connectedCallback() {
    this.input = this.querySelector('input[type="search"]');
    this.results = this.querySelector('[data-results]');
    this.live = this.querySelector('[data-live]');
    this.input.addEventListener('input', () => {
      clearTimeout(this.#timer);
      this.#timer = setTimeout(() => this.#search(), DELAY);
    });
    this.input.addEventListener('keydown', (event) => this.#keys(event));
    /* Escape closes the panel from anywhere inside it. The field would otherwise clear itself on Escape, throwing away what was typed. */
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      this.hidePopover();
    });
    /* Focus on a result (Tab, or the arrows below) replaces the highlight the field was pointing at. Up and down move between results;
       up from the first and down from the last go back to the field. */
    this.results.addEventListener('focusin', () => this.#highlight(null));
    this.results.addEventListener('keydown', (event) => {
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const options = this.#options();
      const index = options.indexOf(document.activeElement);
      if (index < 0) return;
      event.preventDefault();
      (options[index + (event.key === 'ArrowDown' ? 1 : -1)] ?? this.input).focus();
    });
    this.input.addEventListener('focus', () => this.results.firstElementChild && this.#open());
    /* Opening the panel with terms already in the field (the search page pre-fills them): show their results now. */
    this.addEventListener('toggle', (event) => {
      /* The first time the panel opens, load the recently viewed products shown before anyone types (decision 013). */
      if (event.newState === 'open' && this.dataset.recent) import(this.dataset.recent).finally(() => delete this.dataset.recent);
      if (event.newState !== 'open' || !this.input.value.trim()) return;
      const end = this.input.value.length;
      this.input.setSelectionRange(end, end);
      if (this.results.firstElementChild) this.#open();
      else this.#search();
    });
    document.addEventListener('singi:navigate', () => this.#close());
    /* iOS Safari opens the keyboard only for a focus() made inside the tap itself, and the native popover opens (and fires `toggle`)
       after it. So the search button opens the panel here, synchronously, and focuses the field in the same breath. */
    document.addEventListener('click', (event) => {
      if (!event.target.closest(`[popovertarget="${this.id}"]`)) return;
      event.preventDefault();
      if (this.matches(':popover-open')) return this.hidePopover();
      this.showPopover();
      this.input.focus();
    });
    const terms = this.input.value.trim();
    if (terms) idle(() => this.#fetch(terms).catch(() => {}));
  }

  /* The markup for a query: memory, then sessionStorage, then the network (and remember it). */
  async #fetch(terms, signal) {
    const key = terms.toLowerCase();
    const memory = this.#cache.get(key);
    if (memory !== undefined) return memory;
    const saved = stored()[key];
    if (saved?.m.includes(COMPLETE) && Date.now() - saved.t < TTL) {
      this.#cache.set(key, saved.m);
      return saved.m;
    }
    const params = new URLSearchParams({ q: terms, section_id: 'predictive-search', 'options[prefix]': 'last' });
    params.set('resources[type]', 'query,collection,product,page,article');
    params.set('resources[limit]', LIMIT);
    params.set('resources[limit_scope]', 'each');
    params.set('resources[options][unavailable_products]', 'last');
    const response = await fetch(`${this.dataset.url}?${params}`, { signal });
    if (!response.ok) throw new Error(response.status);
    const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
    const markup = doc.querySelector('[role="listbox"]')?.outerHTML ?? '';
    this.#cache.set(key, markup);
    if (markup.includes(COMPLETE)) this.#remember(key, markup);
    return markup;
  }

  #remember(key, markup) {
    const now = Date.now();
    disk = Object.fromEntries(
      Object.entries({ ...stored(), [key]: { t: now, m: markup } })
        .filter(([, entry]) => now - entry.t < TTL)
        .sort((a, b) => b[1].t - a[1].t)
        .slice(0, KEEP),
    );
    try {
      sessionStorage.setItem(STORE, JSON.stringify(disk));
    } catch {}
  }

  async #search() {
    const terms = this.input.value.trim();
    if (!terms) return this.#close(true);
    this.#controller?.abort();
    const controller = (this.#controller = new AbortController());
    this.setAttribute('aria-busy', 'true');
    try {
      this.#render(await this.#fetch(terms, controller.signal));
    } catch (error) {
      if (error.name !== 'AbortError') this.#close(true);
    } finally {
      if (this.#controller === controller) this.removeAttribute('aria-busy');
    }
  }

  #render(markup) {
    if (!markup) return this.#close(true);
    this.results.innerHTML = markup;
    this.live.textContent = this.results.firstElementChild.dataset.status ?? '';
    this.#open();
  }

  #open() {
    this.results.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
  }

  #close(clear) {
    this.results.hidden = true;
    this.input.setAttribute('aria-expanded', 'false');
    this.input.removeAttribute('aria-activedescendant');
    if (clear) {
      this.results.replaceChildren();
      this.live.textContent = '';
    }
  }

  #options() {
    return [...this.results.querySelectorAll('[role="option"]')];
  }

  #active() {
    return this.results.querySelector('[aria-selected="true"]');
  }

  #highlight(option) {
    this.#active()?.setAttribute('aria-selected', 'false');
    if (option) {
      option.setAttribute('aria-selected', 'true');
      option.scrollIntoView({ block: 'nearest' });
      this.input.setAttribute('aria-activedescendant', option.id);
    } else {
      this.input.removeAttribute('aria-activedescendant');
    }
  }

  #keys(event) {
    const open = !this.results.hidden;
    if ((event.key === 'ArrowDown' || event.key === 'ArrowUp') && open) {
      event.preventDefault();
      const options = this.#options();
      const index = options.indexOf(this.#active());
      const step = event.key === 'ArrowDown' ? 1 : -1;
      this.#highlight(options[index < 0 ? (step > 0 ? 0 : options.length - 1) : (index + step + options.length) % options.length]);
    } else if (event.key === 'Enter' && open && this.#active()) {
      event.preventDefault();
      this.#active().click();
    }
  }
}

customElements.define('predictive-search', PredictiveSearch);

/* data-overlay panels (decision 009): swallow the click after a close; close when focus leaves. */
let closed = 0;
document.addEventListener('beforetoggle', (event) => {
  if (event.newState === 'closed' && event.target.hasAttribute('data-overlay')) closed = event.timeStamp;
}, true);
document.addEventListener('click', (event) => {
  if (event.isTrusted && event.timeStamp - closed < 250) {
    event.preventDefault();
    event.stopPropagation();
  }
}, true);
document.addEventListener('focusin', ({ target }) => {
  for (const panel of document.querySelectorAll('[data-overlay]:popover-open')) {
    if (!panel.contains(target) && !target.closest?.(`[popovertarget="${panel.id}"]`)) panel.hidePopover();
  }
});
