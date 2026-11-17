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

  /* The phone's gallery row has the page's side gutter at both ends: the first slide does not start at the screen edge (scroll-padding-inline) and the last one stops short of the other edge. */
  const slider = document.querySelector('.product__gallery[tabindex]');
  if (slider && innerWidth < 896) {
    const slides = gallery();
    await wait(300);
    ok(slider.scrollLeft === 0 || slider.scrollLeft < 2, `the gallery row starts scrolled by ${slider.scrollLeft}px`);
    const first = slides[0].getBoundingClientRect();
    ok(first.left >= 12, `the first gallery slide starts ${Math.round(first.left)}px from the screen edge, expected the page gutter`);
    /* the gap between slides equals the edge gutter, so on a middle slide only the next one peeks in (on the right), never the previous one */
    if (slides.length > 2) {
      const gap = slides[1].getBoundingClientRect().left - first.right;
      const gutter = first.left;
      ok(Math.abs(gap - gutter) <= 1, `the gap between slides is ${Math.round(gap)}px and the edge gutter ${Math.round(gutter)}px, expected the same`);
      slider.scrollTo({ left: slides[1].offsetLeft - slider.getBoundingClientRect().left - gutter + slider.scrollLeft, behavior: 'instant' });
      await wait(600);
      const before = slides[0].getBoundingClientRect();
      const current = slides[1].getBoundingClientRect();
      const after = slides[2].getBoundingClientRect();
      ok(Math.abs(current.left - gutter) <= 2, `the second slide is at ${Math.round(current.left)}px, expected the gutter (${Math.round(gutter)}px)`);
      ok(before.right <= 1, `the previous slide still shows ${Math.round(before.right)}px at the left edge: only the next one should peek in`);
      ok(after.left < innerWidth && after.left > innerWidth * 0.8, `the next slide peeks in from the right at ${Math.round(after.left)}px of ${innerWidth}px`);
      slider.scrollTo({ left: 0, behavior: 'instant' });
      await wait(300);
    }
    slider.scrollTo({ left: slider.scrollWidth, behavior: 'instant' });
    await wait(500);
    const last = slides[slides.length - 1].getBoundingClientRect();
    ok(innerWidth - last.right >= 12, `the last gallery slide ends ${Math.round(innerWidth - last.right)}px from the screen edge, expected the page gutter`);
    slider.scrollTo({ left: 0, behavior: 'instant' });
  }

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
      /* decision 043: every gallery image is cropped to the product image format, whatever its own shape */
      const [rw, rh] = getComputedStyle(document.documentElement).getPropertyValue('--ratio-product').split('/').map(Number);
      ok(Math.abs(rw / rh - shown) / (rw / rh) < 0.02, `image ${img.alt} is shown at ${shown.toFixed(2)}, expected the product image format ${(rw / rh).toFixed(2)} (its own shape is ${natural.toFixed(2)})`);
    }
    ok(ratios.size >= 4, `expected at least 4 different aspect ratios, found ${ratios.size}`);
  }

  if (path.endsWith('/mock-video-gallery')) {
    /* A YouTube video is a facade (poster and play button, decision 018) that fills the slot the gallery gives it. */
    const frame = document.querySelector('.product__media a.embed, .product__media iframe, .product__media video');
    ok(frame, 'the video is not rendered in the gallery');
    if (frame) {
      const box = frame.getBoundingClientRect();
      const slot = frame.closest('.product__media').getBoundingClientRect();
      ok(Math.abs(box.width - slot.width) <= 1 && Math.abs(box.height - slot.height) <= 1, `the video is ${Math.round(box.width)}x${Math.round(box.height)} in a slot of ${Math.round(slot.width)}x${Math.round(slot.height)}: it should fill it`);
      ok(frame.title || frame.getAttribute('aria-label'), 'the video has no accessible name');
    }
    ok(gallery().filter((m) => m.querySelector('img') && !m.querySelector('a.embed')).length === 3, 'expected 3 images next to the video');
  }

  return { page: path, passed, failed };
})();
