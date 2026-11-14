import { cartChanged, fetchDocument } from '@singi/utils';

const KEY = 'singi-wishlist';
const MAX = 50;
const SHOWN = 12;

/* Entries are { h: product handle, v: variant id or null }. Older entries are bare handle strings. */
const read = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value.map((e) => (typeof e === 'string' ? { h: e, v: null } : e)).filter((e) => e?.h) : [];
  } catch {
    return [];
  }
};
const write = (entries) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX)));
  } catch {}
};
const announce = (text) => {
  const el = document.getElementById('route-announcer');
  if (el && text) el.textContent = text;
};

/* A button with data-variant (the product page) is pressed only for that exact variant.
   A button without one (a card) is pressed when the product is saved at all. */
const sync = (scope = document) => {
  const saved = new Map(read().map((e) => [e.h, e]));
  for (const button of scope.querySelectorAll('[data-wishlist]')) {
    const entry = saved.get(button.dataset.wishlist);
    const variant = button.dataset.variant;
    button.setAttribute('aria-pressed', String(Boolean(entry) && (!variant || String(entry.v) === variant)));
  }
};

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-wishlist], [data-wishlist-remove]');
  if (!button) return;
  event.preventDefault();
  const removing = button.hasAttribute('data-wishlist-remove');
  const handle = button.dataset.wishlist ?? button.dataset.wishlistRemove;
  const variant = removing ? null : button.dataset.variant || null;
  const saved = read();
  const index = saved.findIndex((e) => e.h === handle);
  if (removing && index < 0) return;
  const same = index >= 0 && (removing || !variant || String(saved[index].v) === variant);
  if (index >= 0) saved.splice(index, 1);
  if (!same) saved.unshift({ h: handle, v: variant });
  write(saved);
  sync();
  const messages = document.getElementById('route-announcer')?.dataset;
  announce(same ? messages?.wishlistRemoved : messages?.wishlistSaved);
  document.dispatchEvent(new CustomEvent('singi:wishlist', { detail: { handle, variant, added: !same, button } }));
});

/* Primary add to cart in a saved row. Adds that exact variant, refreshes the cart lines on this
   page and lets tracking see the difference through the same view_cart payload the cart uses. */
const readCart = (scope) => {
  const el = scope.querySelector('script[data-track="view_cart"]');
  return el ? JSON.parse(el.textContent) : null;
};

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-wishlist-add]');
  if (!button || button.getAttribute('aria-busy') === 'true' || button.getAttribute('aria-disabled') === 'true') return;
  const host = button.closest('wishlist-list');
  button.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(host.dataset.addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: Number(button.dataset.wishlistAdd), quantity: 1 }),
    });
    if (!response.ok) throw new Error('add failed');
    cartChanged(await (await fetch(`${host.dataset.cartUrl}.js`)).json());
    const lines = document.querySelector('cart-items');
    if (lines) {
      const doc = await fetchDocument(`${host.dataset.cartUrl}?section_id=${lines.dataset.sectionId}`);
      const before = readCart(lines);
      lines.replaceChildren(...doc.querySelector('cart-items').childNodes);
      if (before) document.dispatchEvent(new CustomEvent('singi:cart-diff', { detail: { before, after: readCart(lines) } }));
    }
    announce(host.dataset.added);
  } catch {
    announce(host.dataset.error);
  } finally {
    button.removeAttribute('aria-busy');
  }
});

for (const type of ['singi:navigate', 'singi:facets', 'singi:variant']) document.addEventListener(type, () => sync());
addEventListener('pageshow', () => sync());
addEventListener('storage', (event) => {
  if (event.key !== KEY) return;
  sync();
  document.dispatchEvent(new CustomEvent('singi:wishlist', { detail: { added: null } }));
});
sync();

/* The saved list on the cart page. Rows are fetched server-rendered through the product.wishlist
   alternate template with the saved variant, so title, price, image and stock are always current. */
class WishlistList extends HTMLElement {
  #rows = new Map();
  #inCart = new Set();

  connectedCallback() {
    this.#inCart = new Set(this.dataset.inCart?.split(','));
    document.addEventListener('singi:wishlist', this.#onChange);
    document.addEventListener('singi:cart', this.#onCart);
    this.#render();
  }

  disconnectedCallback() {
    document.removeEventListener('singi:wishlist', this.#onChange);
    document.removeEventListener('singi:cart', this.#onCart);
  }

  #onCart = ({ detail }) => {
    this.#inCart = new Set(detail.items.map((item) => String(item.variant_id)));
    this.#paint();
  };

  #paint() {
    for (const button of this.querySelectorAll('[data-wishlist-add]')) {
      const added = this.#inCart.has(button.dataset.wishlistAdd);
      button.classList.toggle('button--secondary', added);
      button.setAttribute('aria-disabled', String(added));
      button.setAttribute('aria-label', added ? button.dataset.labelAdded : button.dataset.labelAdd);
    }
  }

  #onChange = ({ detail }) => {
    if (detail.added === false && detail.button && this.contains(detail.button)) {
      const item = detail.button.closest('li');
      const next = item.nextElementSibling ?? item.previousElementSibling;
      item.remove();
      if (this.querySelector('li')) next?.querySelector('a, button')?.focus();
      else {
        this.#empty();
        document.querySelector('main')?.focus({ preventScroll: true });
      }
    } else {
      this.#render();
    }
  };

  async #row({ h, v }) {
    const key = `${h}:${v}`;
    if (!this.#rows.has(key)) {
      const query = v ? `&variant=${encodeURIComponent(v)}` : '';
      const response = await fetch(`${this.dataset.root}products/${encodeURIComponent(h)}?view=wishlist${query}`).catch(() => null);
      let row = null;
      if (response?.ok) row = new DOMParser().parseFromString(await response.text(), 'text/html').querySelector('li.wishlist-item');
      if (response && !response.ok) write(read().filter((e) => e.h !== h));
      this.#rows.set(key, row);
    }
    return this.#rows.get(key)?.cloneNode(true) ?? null;
  }

  /* Nothing saved means nothing in the DOM: the host stays empty and hidden. */
  #empty() {
    this.replaceChildren();
    this.hidden = true;
  }

  async #render() {
    const rows = (await Promise.all(read().slice(0, SHOWN).map((entry) => this.#row(entry)))).filter(Boolean);
    if (!rows.length) return this.#empty();
    const heading = document.createElement('h2');
    heading.tabIndex = -1;
    heading.textContent = this.dataset.title;
    const list = document.createElement('ul');
    list.className = 'wishlist__items';
    list.setAttribute('role', 'list');
    list.append(...rows);
    this.replaceChildren(heading, list);
    this.hidden = false;
    sync(this);
    this.#paint();
  }
}

customElements.define('wishlist-list', WishlistList);
