const TTL = 30000;
const MAX_ENTRIES = 24;
const SKELETON_DELAY = 90;
const HOVER_INTENT = 65;

const root = document.documentElement;
const cache = new Map();
const skipPaths = (root.dataset.softNavSkip || '').split(/\s+/).filter(Boolean);
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const announcer = document.getElementById('route-announcer');

let current = location.pathname + location.search;
let token = 0;
let hoverTimer;

history.scrollRestoration = 'manual';

const main = () => document.getElementById('main');
const hardNavigate = (url) => location.assign(url);

const eligible = (event) => {
  if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const link = event.target.closest?.('a[href]');
  if (!link || (link.target && link.target !== '_self') || link.hasAttribute('download')) return;
  if (link.hasAttribute('data-no-soft-nav') || link.rel.includes('external')) return;
  const url = new URL(link.href, location.href);
  if (url.origin !== location.origin) return;
  if (url.pathname + url.search === current) return;
  if (skipPaths.some((path) => url.pathname === path || url.pathname.startsWith(`${path}/`))) return;
  return url;
};

const load = (url) => {
  const key = url.pathname + url.search;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.time < TTL) return hit.promise;

  const promise = fetch(url, { headers: { 'X-Requested-With': 'soft-nav' } })
    .then(async (response) => {
      if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) return null;
      return { html: await response.text(), url: response.url };
    })
    .catch(() => null);

  cache.set(key, { time: Date.now(), promise });
  if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value);
  promise.then((value) => value || cache.delete(key));
  return promise;
};

const skeletonFor = (url) => {
  const { pathname } = url;
  const id = pathname.includes('/products/')
    ? 'product'
    : /\/collections\/.+|\/search/.test(pathname)
      ? 'collection'
      : 'page';
  return document.getElementById(`skeleton-${id}`);
};

const MANAGED_HEAD = [
  'meta[name="description"]',
  'meta[name="robots"]',
  'link[rel="canonical"]',
  'meta[property^="og:"]',
  'meta[name^="twitter:"]',
  'meta[property^="product:"]',
  'script[type="application/ld+json"]',
];

const syncHead = async (doc) => {
  document.title = doc.title;
  const selector = MANAGED_HEAD.join(',');
  for (const el of document.head.querySelectorAll(selector)) el.remove();
  for (const el of doc.head.querySelectorAll(selector)) document.head.append(document.importNode(el, true));

  const pending = [];
  for (const link of doc.head.querySelectorAll('link[rel="stylesheet"]')) {
    if (document.head.querySelector(`link[rel="stylesheet"][href="${link.getAttribute('href')}"]`)) continue;
    const clone = document.importNode(link, true);
    pending.push(
      new Promise((resolve) => {
        clone.onload = clone.onerror = resolve;
        setTimeout(resolve, 3000);
      }),
    );
    document.head.append(clone);
  }
  await Promise.all(pending);
};

const revive = (scope) => {
  for (const old of scope.querySelectorAll('script:not([type="application/ld+json"])')) {
    const src = old.getAttribute('src');
    if (src && document.querySelector(`script[src="${src}"]`) && !scope.contains(document.querySelector(`script[src="${src}"]`))) {
      old.remove();
      continue;
    }
    const script = document.createElement('script');
    for (const { name, value } of old.attributes) script.setAttribute(name, value);
    script.textContent = old.textContent;
    old.replaceWith(script);
  }
};

const updateNavState = () => {
  for (const link of document.querySelectorAll('.header a[href]')) {
    const same = new URL(link.href, location.href).pathname === location.pathname;
    link.toggleAttribute('aria-current', same);
    if (same) link.setAttribute('aria-current', 'page');
  }
  try {
    document.getElementById('site-nav')?.hidePopover();
  } catch (e) {}
};

const swap = (doc, scrollY, hash) => {
  const next = doc.getElementById('main');
  const target = main();
  const run = () => {
    target.replaceChildren(...next.childNodes);
    target.removeAttribute('aria-busy');
    root.dataset.template = doc.documentElement.dataset.template;
    revive(target);
    window.singiPlaceholder?.();
    updateNavState();
    const anchor = hash && document.getElementById(decodeURIComponent(hash.slice(1)));
    if (anchor) anchor.scrollIntoView();
    else scrollTo(0, scrollY || 0);
    target.focus({ preventScroll: true });
    if (announcer) announcer.textContent = document.title;
  };
  if (document.startViewTransition && 'viewTransitions' in root.dataset && !reduceMotion.matches) {
    document.startViewTransition(run);
  } else {
    run();
  }
};

const go = async (url, { push, scrollY } = {}) => {
  const mine = ++token;
  const timer = setTimeout(() => {
    const template = skeletonFor(url);
    if (mine !== token || !template) return;
    main().replaceChildren(template.content.cloneNode(true));
    main().setAttribute('aria-busy', 'true');
    scrollTo(0, 0);
  }, SKELETON_DELAY);

  root.dataset.softNav = 'loading';
  const result = await load(url);
  clearTimeout(timer);
  if (mine !== token) return;
  root.dataset.softNav = '';

  const doc = result && new DOMParser().parseFromString(result.html, 'text/html');
  if (!doc?.getElementById('main') || doc.documentElement.dataset.layout !== root.dataset.layout) {
    return hardNavigate(url);
  }

  const finalUrl = new URL(result.url);
  if (push) {
    history.replaceState({ ...history.state, y: scrollY0 }, '');
    history.pushState({}, '', finalUrl.pathname + finalUrl.search + url.hash);
  }
  current = finalUrl.pathname + finalUrl.search;

  await syncHead(doc);
  swap(doc, scrollY, url.hash);
  document.dispatchEvent(new CustomEvent('singi:navigate', { detail: { url: finalUrl.href } }));
};

let scrollY0 = 0;

document.addEventListener('click', (event) => {
  const url = eligible(event);
  if (!url) return;
  event.preventDefault();
  scrollY0 = scrollY;
  go(url, { push: true, scrollY: 0 });
});

const prefetch = (event) => {
  clearTimeout(hoverTimer);
  if (navigator.connection?.saveData) return;
  const link = event.target.closest?.('a[href]');
  if (!link) return;
  const url = eligible({ target: link, button: 0 });
  if (!url) return;
  if (event.type === 'pointerover') hoverTimer = setTimeout(() => load(url), HOVER_INTENT);
  else load(url);
};

document.addEventListener('pointerover', prefetch, { passive: true });
document.addEventListener('pointerout', () => clearTimeout(hoverTimer), { passive: true });
document.addEventListener('touchstart', prefetch, { passive: true });
document.addEventListener('focusin', prefetch);

document.addEventListener('singi:cart', () => cache.clear());

addEventListener('popstate', (event) => {
  const url = new URL(location.href);
  if (url.pathname + url.search === current) return;
  scrollY0 = scrollY;
  go(url, { push: false, scrollY: event.state?.y });
});

addEventListener('pagehide', () => history.replaceState({ ...history.state, y: scrollY }, ''));
