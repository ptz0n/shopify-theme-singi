class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-step]');
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      const { min, max } = this.#limits();
      const current = Number(this.input.value) || min;
      const value = Math.min(max, Math.max(min, current + Number(button.dataset.step)));
      if (value === current) return;
      this.input.value = value;
      this.input.dispatchEvent(new Event('change', { bubbles: true }));
      const live = this.querySelector('[data-qty-live]');
      if (live) live.textContent = value;
    });
    this.input.addEventListener('input', () => this.#sync());
    this.addEventListener('change', () => this.#sync());
    this.#sync();
  }

  #limits() {
    return { min: Number(this.dataset.min ?? 1), max: this.input.max ? Number(this.input.max) : Infinity };
  }

  #sync() {
    const { min, max } = this.#limits();
    const value = Number(this.input.value);
    const [minus, plus] = this.querySelectorAll('[data-step]');
    minus.setAttribute('aria-disabled', String(value <= min));
    plus.setAttribute('aria-disabled', String(value >= max));
  }
}

customElements.define('quantity-input', QuantityInput);
