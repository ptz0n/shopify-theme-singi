class StickyBuy extends HTMLElement {
  #update;

  connectedCallback() {
    const buy = document.querySelector(this.dataset.target);
    const footer = document.querySelector('footer');
    this.#update = () => this.toggleAttribute('data-show', buy.getBoundingClientRect().bottom < 0 && footer.getBoundingClientRect().top > innerHeight);
    addEventListener('scroll', this.#update, { passive: true });
    this.#update();
  }

  disconnectedCallback() {
    removeEventListener('scroll', this.#update);
  }
}

customElements.define('sticky-buy', StickyBuy);
