class AnnouncementBar extends HTMLElement {
  connectedCallback() {
    this.querySelector('[data-dismiss]').addEventListener('click', () => {
      const root = document.documentElement;
      root.dataset.dismissed = `${root.dataset.dismissed} ${this.dataset.id}`.trim();
      try {
        localStorage.setItem('singi-dismissed', root.dataset.dismissed);
      } catch {}
      document.getElementById('main').focus({ preventScroll: true });
    });
  }
}

customElements.define('announcement-bar', AnnouncementBar);
