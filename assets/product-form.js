import { cartChanged, fetchDocument } from '@singi/utils';

const RECENT = 'singi-recent'; /* read by assets/recently-viewed.js */
const OPTIONS = 'singi-options'; /* { "type|option": "value" }, this visit */

const saved = (patch) => {
  try {
    const all = JSON.parse(sessionStorage.getItem(OPTIONS)) ?? {};
    if (patch) sessionStorage.setItem(OPTIONS, JSON.stringify({ ...all, ...patch }));
    return all;
  } catch {
    return {};
  }
};

class ProductForm extends HTMLElement {
  #controller;

  /* Saved for the Recently viewed block: newest first, no duplicates, 12 at most. */
  #remember() {
    const handle = this.dataset.handle;
    try {
      const list = JSON.parse(localStorage.getItem(RECENT) ?? '[]').filter((item) => item !== handle);
      localStorage.setItem(RECENT, JSON.stringify([handle, ...list].slice(0, 12)));
    } catch {}
  }

  connectedCallback() {
    this.#remember();
    this.addEventListener('submit', (event) => {
      if (!event.target.matches('form[data-add-to-cart]')) return;
      event.preventDefault();
      this.#add(event.target);
    });
    this.addEventListener('change', (event) => {
      if (!event.target.matches('[data-option-url]')) return;
      const key = this.#key(event.target);
      if (key) saved({ [key]: event.target.value });
      this.#changeVariant(event.target);
    });
    this.#restoreOption();
  }

  /* Decision 035: a picked size is remembered for the visit, per product type and option. */
  #key(input) {
    const set = input.closest('fieldset[data-remember]');
    return set && this.dataset.type ? `${this.dataset.type}|${set.dataset.option}`.toLowerCase() : null;
  }

  /* One option only: each option's address assumes the others as rendered. */
  #restoreOption() {
    if (location.search.includes('variant=')) return;
    const all = saved();
    [...this.querySelectorAll('input[data-option-url]:not(:checked)')].find((i) => all[this.#key(i)] === i.value && i.dataset.available !== 'false' && !i.disabled)?.click();
  }

  /* What the chosen option already tells us, applied at once. The buy box is never disabled
     or dimmed: the hidden variant id is set first, so a quick click adds the right variant. */
  #optimistic(input) {
    const form = this.querySelector('form[data-add-to-cart]');
    if (input.dataset.variantId) {
      form.querySelector('[name="id"]').value = input.dataset.variantId;
      const heart = this.querySelector('[data-wishlist]');
      if (heart) heart.dataset.variant = input.dataset.variantId;
      document.dispatchEvent(new CustomEvent('singi:variant'));
    }
    input.closest('fieldset').querySelector('[data-selected]').textContent = input.value;
    const available = input.dataset.available !== 'false';
    const button = form.querySelector('[type="submit"]');
    button.disabled = !available;
    button.querySelector('span').textContent = available ? this.dataset.labelAdd : this.dataset.labelSoldOut;
    this.querySelector('[data-payment]')?.toggleAttribute('hidden', !available);
    const price = this.querySelector('[data-swap="price"] .price');
    if (price && input.dataset.price) (price.children.length ? price.querySelector('.price__now') : price)?.replaceChildren(input.dataset.price);
    const unit = this.querySelector('.product-price__unit');
    if (unit && input.dataset.unitPrice) {
      const [shown, label] = unit.children;
      shown.textContent = input.dataset.unitPrice.replaceAll(' ', '\u00a0');
      label.textContent = input.dataset.unitLabel;
    }
    if (!this.closest('dialog')) history.replaceState(history.state, '', input.dataset.optionUrl);
  }

  /* The rest comes from the server: price block, meta, other options' availability. Only what
     changed is touched, so focus, quantity and the payment button are not replaced. */
  #reconcile(next) {
    for (const target of this.querySelectorAll('[data-swap]')) {
      const source = next.querySelector(`[data-swap="${target.dataset.swap}"]`);
      /* The quantity block is replaced only when this variant's limits differ, so a typed quantity survives a size change. */
      const rules = (el) => el.querySelector('quantity-input')?.dataset.rules;
      if (source && !(target.dataset.swap === 'quantity' && rules(target) === rules(source))) target.replaceChildren(...source.childNodes);
    }
    for (const input of this.querySelectorAll('input[data-option-url]')) {
      const source = next.querySelector(`#${CSS.escape(input.id)}`);
      if (!source) continue;
      for (const name of ['data-option-url', 'data-variant-id', 'data-available', 'data-price', 'data-unit-price', 'data-unit-label']) input.setAttribute(name, source.getAttribute(name) ?? '');
      input.disabled = source.disabled;
      const label = this.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      const sourceLabel = next.querySelector(`label[for="${CSS.escape(input.id)}"]`);
      if (label && sourceLabel) label.classList.toggle('chip--unavailable', sourceLabel.classList.contains('chip--unavailable'));
    }
    const form = this.querySelector('form[data-add-to-cart]');
    const source = next.querySelector('form[data-add-to-cart]');
    form.querySelector('[name="id"]').value = source.querySelector('[name="id"]').value;
    const button = form.querySelector('[type="submit"]');
    const sourceButton = source.querySelector('[type="submit"]');
    button.disabled = sourceButton.disabled;
    button.querySelector('span').textContent = sourceButton.querySelector('span').textContent;
    this.querySelector('[data-payment]')?.toggleAttribute('hidden', next.querySelector('[data-payment]')?.hidden ?? true);
    window.Shopify?.PaymentButton?.init?.();
    if (next.dataset.item) this.dataset.item = next.dataset.item;
    const media = next.dataset.variantMedia;
    this.dataset.variantMedia = media ?? '';
    if (media) document.getElementById(`media-${media}`)?.scrollIntoView({ block: 'nearest', inline: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }

  async #changeVariant(input) {
    this.#controller?.abort();
    const controller = (this.#controller = new AbortController());
    this.#optimistic(input);
    const url = new URL(input.dataset.optionUrl, location.origin);
    url.searchParams.set('section_id', this.dataset.sectionId);
    try {
      const doc = await fetchDocument(url, { signal: controller.signal });
      const next = doc.querySelector('product-form');
      if (!next) throw new Error('missing');
      this.#reconcile(next);
    } catch (error) {
      if (error.name !== 'AbortError') location.assign(input.dataset.optionUrl);
    }
  }

  async #add(form) {
    const button = form.querySelector('[type="submit"]');
    const status = this.querySelector('[data-status]');
    if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    status.hidden = true;

    try {
      const drawer = document.querySelector('cart-drawer');
      const body = new FormData(form);
      if (drawer) body.set('sections', drawer.dataset.sectionId);
      const response = await fetch(form.action, { method: 'POST', headers: { Accept: 'application/json' }, body });
      const data = await response.json();
      if (!response.ok) throw new Error(data.description || data.message);
      const html = drawer && data.sections?.[drawer.dataset.sectionId];
      cartChanged(html ? drawer.render(html) : await (await fetch(`${this.dataset.cartUrl}.js`)).json());
      document.dispatchEvent(new CustomEvent('singi:cart-add', { detail: { element: this, quantity: Number(form.querySelector('[name="quantity"]')?.value) || 1 } }));
      status.querySelector('[data-message]').textContent = this.dataset.added;
      status.querySelector('a').hidden = false;
    } catch (error) {
      status.querySelector('[data-message]').textContent = error.message || this.dataset.error;
      status.querySelector('a').hidden = true;
    } finally {
      status.hidden = false;
      button.removeAttribute('aria-disabled');
    }
  }
}

customElements.define('product-form', ProductForm);
