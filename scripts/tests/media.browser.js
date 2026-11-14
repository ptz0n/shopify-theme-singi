/*
  Storefront media assertions. Runs inside a page, so it works from Chrome devtools,
  the Claude in Chrome tool or scripts/test-media.mjs (headless). It looks at the
  page it is on and returns { page, passed, failed: [message] }.

  Pages understood (the mock-* products come from `npm run mock:apply`):
    /collections/mock-media            cards, adaptive hearts
    /products/mock-gallery-24          24 images all rendered
    /products/mock-color-images        every color variant points at a gallery image
    /products/mock-partial-variant-images   variants without an image never blank the gallery
    /products/mock-mixed-ratios        no image is stretched or cropped by the gallery
    /products/mock-video-gallery       the video is in the gallery and keeps its ratio
*/
(async () => {
  const failed = [];
  let passed = 0;
  const ok = (condition, message) => (condition ? passed++ : failed.push(message));
  const path = location.pathname;
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const overflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
  ok(overflow <= 0, `page scrolls horizontally by ${overflow}px`);

  const gallery = () => [...document.querySelectorAll('.product__media')];

  if (path.startsWith('/collections/')) {
    const cards = [...document.querySelectorAll('.product-card')];
    ok(cards.length > 0, 'collection has no product cards');
    for (const card of [...cards].slice(0, 12)) card.scrollIntoView({ block: 'center' });
    await wait(1500);
    const hearts = [...document.querySelectorAll('.product-card > .wishlist-heart')];
    const seen = hearts.filter((h) => h.dataset.heart);
    ok(hearts.length === 0 || seen.length > 0, 'no heart was given a tone (data-heart)');
    for (const heart of seen) ok(['white', 'black'].includes(heart.dataset.heart), `bad data-heart "${heart.dataset.heart}"`);
    for (const img of document.querySelectorAll('.product-card > img')) {
      if (hearts.length) ok(img.crossOrigin === 'anonymous', 'card image misses crossorigin, so its pixels cannot be read');
      ok(img.width && img.height, 'card image lacks width/height attributes (layout shift)');
    }
  }

  if (path.endsWith('/mock-gallery-24')) {
    ok(gallery().length === 24, `expected 24 gallery images, found ${gallery().length}`);
    ok(gallery().slice(1).every((m) => m.querySelector('img')?.loading === 'lazy'), 'images after the first must be lazy');
    ok(gallery()[0].querySelector('img')?.fetchPriority === 'high', 'first image should be the priority image');
  }

  if (['/mock-color-images', '/mock-partial-variant-images', '/mock-variant-images-only'].some((end) => path.endsWith(end))) {
    const form = document.querySelector('product-form');
    const id = form?.dataset.variantMedia;
    if (id) ok(document.getElementById(`media-${id}`), `selected variant's media-${id} is not in the gallery`);
    /* Option inputs are named option-1, option-2...; the fieldset legend carries the option's name. */
    const radios = [...document.querySelectorAll('input[type=radio]')].filter((r) => /colou?r/i.test(r.closest('fieldset')?.querySelector('legend')?.textContent ?? ''));
    ok(radios.length > 0, 'no color option inputs found');
    const before = gallery().length;
    for (const radio of radios) {
      radio.click();
      await wait(700);
      const media = document.querySelector('product-form')?.dataset.variantMedia;
      if (media) ok(document.getElementById(`media-${media}`), `after choosing ${radio.value}, media-${media} is missing`);
      ok(gallery().length === before, 'switching a variant changed the number of gallery images');
      ok(gallery().every((m) => m.querySelector('img')?.naturalWidth !== 0 || m.querySelector('img')?.loading === 'lazy'), 'a gallery image failed to load');
    }
  }

  if (path.endsWith('/mock-mixed-ratios')) {
    ok(gallery().length === 6, `expected 6 gallery images, found ${gallery().length}`);
    const ratios = new Set();
    for (const media of gallery()) {
      const img = media.querySelector('img');
      img.loading = 'eager';
      await img.decode().catch(() => {});
      const natural = img.naturalWidth / img.naturalHeight;
      const shown = img.getBoundingClientRect().width / img.getBoundingClientRect().height;
      ratios.add(natural.toFixed(2));
      ok(Math.abs(natural - shown) / natural < 0.02, `image ${img.alt} is shown at ${shown.toFixed(2)}, natural ${natural.toFixed(2)}`);
    }
    ok(ratios.size >= 4, `expected at least 4 different aspect ratios, found ${ratios.size}`);
  }

  if (path.endsWith('/mock-video-gallery')) {
    const frame = document.querySelector('.product__media iframe, .product__media video');
    ok(frame, 'the video is not rendered in the gallery');
    if (frame) {
      const box = frame.getBoundingClientRect();
      ok(Math.abs(box.width / box.height - 16 / 9) < 0.05, `video ratio is ${(box.width / box.height).toFixed(2)}, expected 1.78`);
      ok(frame.title || frame.getAttribute('aria-label'), 'the video has no accessible name');
    }
    ok(gallery().filter((m) => m.querySelector('img')).length === 3, 'expected 3 images next to the video');
  }

  return { page: path, passed, failed };
})();
