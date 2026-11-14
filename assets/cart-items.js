import { cartChanged, postJSON, restoreFocus } from '@singi/utils';

const readCart = (scope) => {
  const el = scope.querySelector('script[data-track="view_cart"]');
  return el ? JSON.parse(el.textContent) : null;
};

class CartItems extends HTMLElement {
  connectedCallback() {
    this.addEventListener('change', (event) => {
      if (event.target.matches('[data-quantity]')) this.#update(event.target.dataset.line, event.target.value);
    });
    this.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (!remove) return;
      event.preventDefault();
      this.#update(remove.dataset.line, 0);
    });
  }

  async #update(line, quantity) {
    const sectionId = this.dataset.sectionId;
    this.setAttribute('aria-busy', 'true');
    try {
      const cart = await postJSON(this.dataset.changeUrl, {
        line: Number(line),
        quantity: Number(quantity),
        sections: sectionId,
        sections_url: location.pathname,
      });
      const doc = new DOMParser().parseFromString(cart.sections[sectionId], 'text/html');
      const next = doc.querySelector('cart-items');
      const focusId = document.activeElement?.id;
      const removed = document.activeElement?.matches?.('[data-remove]');
      const before = readCart(this);
      this.replaceChildren(...next.childNodes);
      restoreFocus(this, focusId);
      if (removed) (this.querySelector('[data-remove]') ?? document.querySelector('main h1'))?.focus();
      cartChanged(cart);
      const announcer = document.getElementById('route-announcer');
      const subtotal = this.querySelector('.cart__subtotal');
      if (announcer && subtotal) announcer.textContent = subtotal.textContent.replace(/\s+/g, ' ').trim();
      if (before) document.dispatchEvent(new CustomEvent('singi:cart-diff', { detail: { before, after: readCart(this) } }));
    } catch (error) {
      const message = this.querySelector('[data-error]');
      message.textContent = error.message || this.dataset.error;
      message.hidden = false;
    } finally {
      this.removeAttribute('aria-busy');
    }
  }
}

customElements.define('cart-items', CartItems);
