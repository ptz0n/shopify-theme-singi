class QuantityInput extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('input');
    this.addEventListener('click', (event) => {
      const button = event.target.closest('[data-step]');
      if (!button || button.getAttribute('aria-disabled') === 'true') return;
      const { min, max, step, zero } = this.#limits();
      const direction = Number(button.dataset.step);
      const current = Number(this.input.value) || 0;
      let value = current + direction * step;
      /* Below the minimum there is nothing (the cart removes the line) or the minimum itself; above the maximum, the last step that fits. */
      if (value < min) value = direction < 0 && zero ? 0 : min;
      if (value > max) value = min + Math.floor((max - min) / step) * step;
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
    return { min: Number(this.dataset.min ?? 1), max: this.input.max ? Number(this.input.max) : Infinity, step: Number(this.dataset.increment ?? 1), zero: 'zero' in this.dataset };
  }

  #sync() {
    const { min, max, step, zero } = this.#limits();
    const value = Number(this.input.value);
    const [minus, plus] = this.querySelectorAll('[data-step]');
    minus.setAttribute('aria-disabled', String(value <= (zero ? 0 : min)));
    plus.setAttribute('aria-disabled', String(value + step > max && value >= min));
  }
}

customElements.define('quantity-input', QuantityInput);
