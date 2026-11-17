/*
  Order table (blocks/_variants-table.liquid, decision 019). The element counts the quantities as they change,
  clears them, and adds every row above 0 to the cart in one request. A request with several lines is all or
  nothing: when the store refuses one, nothing is added and its message is shown. A quantity that breaks the
  row's rule (step, minimum, maximum) is reported by the browser on the input before anything is sent.
*/
import { cartChanged } from '@singi/utils';

class OrderTable extends HTMLElement {
  connectedCallback() {
    this.count = this.querySelector('[data-order-count]');
    this.add = this.querySelector('[data-order-add]');
    this.reset = this.querySelector('[data-order-reset]');
    this.error = this.querySelector('[data-order-error]');
    this.addEventListener('input', () => this.#sync());
    this.addEventListener('change', () => this.#sync());
    this.reset.addEventListener('click', () => {
      for (const input of this.#inputs()) input.value = 0;
      this.#sync();
      this.dispatchEvent(new Event('change', { bubbles: true }));
    });
    this.add.addEventListener('click', () => this.#send());
    this.#sync();
  }

  #inputs() {
    return [...this.querySelectorAll('input[type="number"]')];
  }

  #total() {
    return this.#inputs().reduce((sum, input) => sum + (Number(input.value) || 0), 0);
  }

  #sync() {
    const total = this.#total();
    this.count.textContent = total;
    this.add.disabled = this.reset.disabled = total === 0;
    this.error.hidden = true;
  }

  async #send() {
    const invalid = this.#inputs().find((input) => !input.checkValidity());
    if (invalid) return invalid.reportValidity();
    const items = this.#inputs().filter((input) => Number(input.value) > 0).map((input) => ({ id: Number(input.name), quantity: Number(input.value) }));
    if (!items.length) return;
    this.add.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch(this.dataset.addUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ items }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.description || data.message);
      cartChanged(await (await fetch(`${this.dataset.cartUrl}.js`)).json());
      for (const input of this.#inputs()) input.value = 0;
      this.#sync();
      this.dispatchEvent(new Event('change', { bubbles: true }));
      this.error.textContent = '';
      document.getElementById('route-announcer').textContent = `${this.dataset.added}`;
    } catch (error) {
      this.error.textContent = error.message || this.dataset.error;
      this.error.hidden = false;
    } finally {
      this.add.removeAttribute('aria-busy');
    }
  }
}

customElements.define('order-table', OrderTable);
