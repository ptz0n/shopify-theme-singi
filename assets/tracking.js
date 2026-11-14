const cfg = JSON.parse(document.getElementById('tracking-config').textContent);
const layer = (window.dataLayer = window.dataLayer || []);
const gtag = function () {
  layer.push(arguments);
};
const root = document.documentElement;
const log = (...args) => cfg.debug && console.info('[singi:track]', ...args);
const gtmId = /^GTM-[A-Z0-9]+$/.test(cfg.gtm) ? cfg.gtm : '';
const ga4Id = !gtmId && /^G-[A-Z0-9]+$/.test(cfg.ga4) ? cfg.ga4 : '';

const emit = (event, payload = {}) => {
  const ecommerce = Array.isArray(payload.items);
  log(event, payload);
  if (ga4Id) {
    gtag('event', event, payload);
    return;
  }
  if (ecommerce) layer.push({ ecommerce: null });
  layer.push(ecommerce ? { event, ecommerce: payload } : { event, ...payload });
};

const total = (items) => Number(items.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));

/* Consent Mode v2, driven by Shopify's Customer Privacy API */
const privacy = () => window.Shopify?.customerPrivacy;
const syncConsent = () => {
  const api = privacy();
  if (!api?.analyticsProcessingAllowed) return;
  const analytics = api.analyticsProcessingAllowed();
  const marketing = api.marketingAllowed();
  const state = (allowed) => (allowed ? 'granted' : 'denied');
  gtag('consent', 'update', {
    analytics_storage: state(analytics),
    ad_storage: state(marketing),
    ad_user_data: state(marketing),
    ad_personalization: state(marketing),
  });
  log('consent', { analytics, marketing });
};

if (cfg.consent === 'shopify') {
  gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    wait_for_update: 1500,
  });
  document.addEventListener('visitorConsentCollected', syncConsent);
  document.addEventListener('shopifyCustomerPrivacyApiLoaded', syncConsent);
}

if (ga4Id) {
  gtag('js', new Date());
  gtag('config', ga4Id, { send_page_view: false });
}

/* Events rendered by the server as <script type="application/json" data-track="event_name"> */
const seen = new WeakSet();
const scan = (scope) => {
  for (const el of scope.querySelectorAll('script[data-track]')) {
    if (seen.has(el)) continue;
    seen.add(el);
    try {
      emit(el.dataset.track, JSON.parse(el.textContent));
    } catch (error) {
      log('bad payload', el.dataset.track, error);
    }
  }
};

const pageView = () =>
  emit('page_view', {
    page_location: location.href,
    page_title: document.title,
    page_type: root.dataset.template,
    language: root.lang,
    currency: cfg.currency,
  });

const ready = document.prerendering
  ? new Promise((resolve) => document.addEventListener('prerenderingchange', resolve, { once: true }))
  : Promise.resolve();
ready.then(() => {
  pageView();
  scan(document);
});

document.addEventListener('singi:navigate', () => {
  pageView();
  scan(document.getElementById('main'));
});
document.addEventListener('singi:facets', () => scan(document.getElementById('main')));

document.addEventListener('click', (event) => {
  const link = event.target.closest?.('.product-card__link');
  const id = link?.closest('[data-product-id]')?.dataset.productId;
  if (!id) return;
  for (const el of document.querySelectorAll('script[data-track="view_item_list"]')) {
    const list = JSON.parse(el.textContent);
    const item = list.items.find((candidate) => candidate.item_id === id);
    if (item) return emit('select_item', { item_list_id: list.item_list_id, item_list_name: list.item_list_name, items: [item] });
  }
});

document.addEventListener('singi:wishlist', ({ detail }) => {
  if (!detail.added) return;
  const card = detail.button.closest('[data-product-id]');
  let item;
  if (card) {
    for (const el of document.querySelectorAll('script[data-track="view_item_list"]')) {
      item = JSON.parse(el.textContent).items.find((candidate) => candidate.item_id === card.dataset.productId);
      if (item) break;
    }
  } else {
    const raw = document.querySelector('product-form')?.dataset.item;
    if (raw) item = JSON.parse(raw);
  }
  if (item) emit('add_to_wishlist', { currency: cfg.currency, value: item.price, items: [{ ...item, quantity: 1 }] });
});

document.addEventListener('singi:cart-add', ({ detail }) => {
  const raw = detail.element.dataset.item;
  if (!raw) return;
  const item = { ...JSON.parse(raw), quantity: detail.quantity };
  emit('add_to_cart', { currency: cfg.currency, value: total([item]), items: [item] });
});

document.addEventListener('singi:cart-diff', ({ detail: { before, after } }) => {
  const index = (cart) => new Map((cart?.items ?? []).map((item) => [item.variant_id, item]));
  const was = index(before);
  const now = index(after);
  const added = [];
  const removed = [];
  for (const [id, item] of was) {
    const delta = (now.get(id)?.quantity ?? 0) - item.quantity;
    if (delta < 0) removed.push({ ...item, quantity: -delta });
  }
  for (const [id, item] of now) {
    const delta = item.quantity - (was.get(id)?.quantity ?? 0);
    if (delta > 0) added.push({ ...item, quantity: delta });
  }
  for (const [event, items] of [['remove_from_cart', removed], ['add_to_cart', added]]) {
    if (items.length) emit(event, { currency: cfg.currency, value: total(items), items });
  }
});

/* Load GTM or gtag late, never in the critical path */
let loaded = false;
const load = () => {
  if (loaded) return;
  loaded = true;
  if (cfg.consent === 'shopify' && !privacy()) {
    window.Shopify?.loadFeatures?.([{ name: 'consent-tracking-api', version: '0.1' }], (error) => {
      if (!error) syncConsent();
    });
  } else {
    syncConsent();
  }
  const script = document.createElement('script');
  script.async = true;
  if (gtmId) {
    layer.push({ 'gtm.start': Date.now(), event: 'gtm.js' });
    script.src = `https://www.googletagmanager.com/gtm.js?id=${gtmId}`;
  } else if (ga4Id) {
    script.src = `https://www.googletagmanager.com/gtag/js?id=${ga4Id}`;
  } else {
    return;
  }
  document.head.append(script);
};

const schedule = () => {
  if (cfg.load === 'interaction') {
    for (const type of ['pointerdown', 'keydown', 'scroll', 'touchstart']) addEventListener(type, load, { once: true, passive: true });
  } else {
    (window.requestIdleCallback || ((fn) => setTimeout(fn, 2000)))(load, { timeout: 4000 });
  }
};
if (document.readyState === 'complete') schedule();
else addEventListener('load', schedule, { once: true });
