import { fetchDocument } from '@singi/utils';

class LocalizationSelector extends HTMLElement {
  connectedCallback() {
    const details = this.querySelector('details');
    details.addEventListener('toggle', () => {
      if (details.open) this.#load();
    });
  }

  async #load() {
    const list = this.querySelector('[data-localization-list]');
    if (list.dataset.loaded) return;
    list.dataset.loaded = 'pending';
    list.setAttribute('aria-busy', 'true');
    try {
      const doc = await fetchDocument(this.dataset.url);
      const next = doc.querySelector('[data-localization-list]');
      if (!next?.firstElementChild) throw new Error('empty');
      list.replaceChildren(...next.childNodes);
      const back = list.querySelector('input[name="return_to"]');
      if (back) back.value = location.pathname + location.search;
      list.dataset.loaded = 'true';
    } catch {
      list.textContent = this.dataset.error;
      delete list.dataset.loaded;
    } finally {
      list.removeAttribute('aria-busy');
    }
  }
}

customElements.define('localization-selector', LocalizationSelector);
