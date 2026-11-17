import { fetchDocument } from '@singi/utils';

class CartDrawer extends HTMLElement {
  #fresh;

  render(html) {
    this.querySelector('cart-items').replaceChildren(...new DOMParser().parseFromString(html, 'text/html').querySelector('cart-items').childNodes);
    const { count, variants } = this.querySelector('[data-count]').dataset;
    return { item_count: Number(count), items: variants ? variants.split(',').map((id) => ({ variant_id: Number(id) })) : [] };
  }

  connectedCallback() {
    const dialog = this.querySelector('dialog');
    const items = () => this.querySelector('cart-items');
    document.addEventListener('click', (e) => {
      const a = e.target.closest('a[data-cart-link]');
      if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || a.pathname === location.pathname) return;
      e.preventDefault();
      dialog.showModal();
    });
    dialog.addEventListener('click', (e) => {
      if (!e.defaultPrevented && (e.target === dialog || e.target.closest('[data-close], a[href]'))) dialog.close();
    });
    document.addEventListener('singi:navigate', () => dialog.close());
    document.addEventListener('singi:cart', (e) => {
      if (e.detail.item_count != items().querySelector('[data-count]').dataset.count) {
        this.#fresh = fetchDocument(`${this.dataset.url}?section_id=${this.dataset.sectionId}`)
          .then((d) => items().replaceChildren(...d.querySelector('cart-items').childNodes), () => {});
      }
    });
    document.addEventListener('singi:cart-add', async () => {
      await this.#fresh;
      dialog.open || dialog.showModal();
    });
  }
}

customElements.define('cart-drawer', CartDrawer);
