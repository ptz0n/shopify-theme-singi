/*
  The "Recently viewed" block (blocks/recently-viewed.liquid).

  Reads the handles that assets/product-form.js saved in localStorage (key singi-recent, newest
  first), leaves out the product on screen, and when the block is about to scroll into view fetches
  one server-rendered card per handle from templates/product.recent.liquid. Skeleton cards reserve
  the space first so nothing jumps. If there is no history, or a request fails, the block stays
  hidden. The cards get their wishlist hearts in the right state through the `singi:facets`
  event, which assets/wishlist.js already listens to.
*/
const KEY = 'singi-recent';

const read = () => {
  try {
    const value = JSON.parse(localStorage.getItem(KEY));
    return Array.isArray(value) ? value.filter((handle) => typeof handle === 'string') : [];
  } catch {
    return [];
  }
};

class RecentlyViewed extends HTMLElement {
  connectedCallback() {
    const limit = Number(this.dataset.limit) || 4;
    const handles = read().filter((handle) => handle !== this.dataset.current).slice(0, limit);
    if (!handles.length) return;
    this.list = this.querySelector('ul');
    this.list.innerHTML = handles
      .map(() => '<li aria-hidden="true"><div class="skeleton" style="aspect-ratio:4/5"></div><div class="skeleton" style="height:3.5rem;margin-block-start:.5rem"></div></li>')
      .join('');
    this.hidden = false;
    this.observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      this.observer.disconnect();
      this.#load(handles);
    }, { rootMargin: '400px' });
    this.observer.observe(this);
  }

  disconnectedCallback() {
    this.observer?.disconnect();
  }

  async #load(handles) {
    const cards = await Promise.all(
      handles.map((handle) =>
        fetch(`${this.dataset.url}${encodeURIComponent(handle)}?view=recent`)
          .then((response) => (response.ok ? response.text() : ''))
          .catch(() => ''),
      ),
    );
    const html = cards.join('').trim();
    if (!html) {
      this.hidden = true;
      return;
    }
    this.list.innerHTML = html;
    document.dispatchEvent(new CustomEvent('singi:facets'));
  }
}

customElements.define('recently-viewed', RecentlyViewed);
