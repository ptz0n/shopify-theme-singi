import { fetchDocument } from '@singi/utils';

const announcer = () => document.getElementById('route-announcer');
const list = () => document.querySelector('[data-show-more-list]');

class ShowMore extends HTMLElement {
  connectedCallback() {
    const link = this.querySelector('a[rel="next"]');
    link?.addEventListener('click', (event) => {
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button) return;
      event.preventDefault();
      this.#load(link, event.detail === 0);
    });
    this.#restore();
  }

  async #fetch(href) {
    const url = new URL(href, location.origin);
    url.searchParams.set('section_id', this.dataset.sectionId);
    return fetchDocument(url);
  }

  /* Move the next page's items into the list and swap in its status and button. Returns the new element. */
  #append(doc, { focus = false, announce = true } = {}) {
    const target = list();
    const incoming = doc.querySelector('[data-show-more-list]');
    if (!target || !incoming) throw new Error('missing list');
    const before = target.children.length;
    for (const img of incoming.querySelectorAll('img')) {
      img.loading = 'lazy';
      img.removeAttribute('fetchpriority');
    }
    target.append(...incoming.children);

    const tracking = doc.querySelector('script[data-track="view_item_list"]');
    if (tracking) {
      const copy = document.createElement('script');
      copy.type = 'application/json';
      copy.dataset.track = 'view_item_list';
      copy.textContent = tracking.textContent;
      target.after(copy);
      document.dispatchEvent(new CustomEvent('singi:facets', { detail: { url: location.href } }));
    }

    const fresh = doc.querySelector('show-more');
    fresh?.querySelector('[rel="prev"]')?.remove();
    if (fresh) this.replaceWith(fresh);
    else this.remove();

    const status = fresh?.querySelector('.show-more__status');
    if (announce && status && announcer()) announcer().textContent = status.textContent;
    if (focus) target.children[before]?.querySelector('a')?.focus();
    return fresh;
  }

  async #load(link, focus) {
    link.setAttribute('aria-busy', 'true');
    try {
      this.#append(await this.#fetch(link.href), { focus });
      history.replaceState({ ...history.state, pages: (history.state?.pages ?? 1) + 1 }, '');
    } catch {
      location.assign(link.href);
    }
  }

  /* Back or forward: reload the pages that were showing and put the scroll back. */
  async #restore() {
    const target = list();
    const pages = history.state?.pages;
    if (!target || target.dataset.restored || !(pages > 1)) return;
    target.dataset.restored = 'true';
    let current = this;
    try {
      for (let page = 1; page < pages && current?.dataset.url; page += 1) {
        const doc = await current.#fetch(current.dataset.url);
        current = current.#append(doc, { announce: false });
      }
      scrollTo(0, history.state?.y ?? 0);
    } catch {}
  }
}

customElements.define('show-more', ShowMore);

addEventListener('pagehide', () => history.replaceState({ ...history.state, y: scrollY }, ''));
