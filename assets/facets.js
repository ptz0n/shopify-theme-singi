import { fetchDocument } from '@singi/utils';

class FacetsForm extends HTMLElement {
  #controller;

  connectedCallback() {
    /* One filter panel open at a time. Native <details name> does this in modern
       browsers; this covers the rest, and adds Escape and outside-click dismissal. */
    this.addEventListener(
      'toggle',
      (event) => {
        if (!event.target.matches('details.facet') || !event.target.open) return;
        for (const other of this.querySelectorAll('details.facet[open]')) if (other !== event.target) other.open = false;
      },
      true,
    );
    this.addEventListener('keydown', (event) => {
      if (event.key !== 'Escape') return;
      const open = this.querySelector('details.facet[open]');
      if (!open) return;
      open.open = false;
      open.querySelector('summary')?.focus();
    });
    document.addEventListener('click', (event) => {
      if (event.target.closest('details.facet')) return;
      for (const open of this.querySelectorAll('details.facet[open]')) open.open = false;
    });
    this.addEventListener('change', (event) => {
      if (event.target.closest('form[data-facets]')) this.#apply();
    });
    this.addEventListener('submit', (event) => {
      if (!event.target.matches('form[data-facets]')) return;
      event.preventDefault();
      this.#apply();
    });
    this.addEventListener('click', (event) => {
      const link = event.target.closest('a[data-facet-link]');
      if (!link || event.metaKey || event.ctrlKey || event.shiftKey) return;
      event.preventDefault();
      this.#apply(link.href);
    });
  }

  #urlFromForm() {
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(this.querySelector('form[data-facets]'))) {
      if (value !== '') params.append(key, value);
    }
    return `${location.pathname}?${params}`;
  }

  async #apply(href) {
    this.#controller?.abort();
    const controller = (this.#controller = new AbortController());
    const target = href ? new URL(href, location.origin) : new URL(this.#urlFromForm(), location.origin);
    const request = new URL(target);
    request.searchParams.set('section_id', this.dataset.sectionId);
    this.setAttribute('aria-busy', 'true');

    try {
      const doc = await fetchDocument(request, { signal: controller.signal });
      const next = doc.querySelector('facets-form');
      const open = new Set([...this.querySelectorAll('details[open][id]')].map((el) => el.id));
      const focusId = document.activeElement?.id;
      this.replaceChildren(...next.childNodes);
      for (const id of open) this.querySelector(`details#${CSS.escape(id)}`)?.setAttribute('open', '');
      if (focusId) this.querySelector(`#${CSS.escape(focusId)}`)?.focus({ preventScroll: true });
      history.pushState({}, '', target.pathname + target.search);
      const announcer = document.getElementById('route-announcer');
      const count = this.querySelector('.collection__count');
      if (announcer && count) announcer.textContent = count.textContent;
      document.dispatchEvent(new CustomEvent('singi:facets', { detail: { url: target.href } }));
    } catch (error) {
      if (error.name !== 'AbortError') location.assign(target);
    } finally {
      this.removeAttribute('aria-busy');
    }
  }
}

customElements.define('facets-form', FacetsForm);
