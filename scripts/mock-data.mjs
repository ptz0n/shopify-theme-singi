/**
 * Mock content for the dev store. Data only: scripts/mock-content.mjs creates
 * it. Everything here uses the `mock-` handle prefix and the `singi-mock` tag so
 * it can be found and removed (`npm run mock:clean`) without touching real data.
 *
 * Products cover the edge cases the theme must handle: many options, sale
 * prices, sold out, single variant, no image, very long titles, RTL and CJK
 * titles, large prices.
 */
export const TAG = 'singi-mock';


const sizes = ['S', 'M', 'L', 'XL'];
const colors = ['Black', 'Off-white', 'Moss', 'Clay'];

const withOptions = (options) => options;

export const PRODUCTS = [
  {
    handle: 'mock-classic-tee',
    title: 'Classic Tee',
    type: 'Tops',
    vendor: 'Singi',
    price: '39.00',
    description: '<p>A heavyweight cotton tee with a relaxed fit. Two options, twelve variants.</p><ul><li>240 gsm organic cotton</li><li>Pre-washed</li><li>Made to last</li></ul>',
    options: withOptions([
      { name: 'Color', values: colors.slice(0, 3) },
      { name: 'Size', values: sizes.slice(0, 3) },
    ]),
    images: ['tee-1', 'tee-2', 'tee-3'],
    collections: ['mock-new-arrivals'],
  },
  {
    handle: 'mock-everyday-hoodie',
    title: 'Everyday Hoodie',
    type: 'Tops',
    vendor: 'Singi',
    price: '79.00',
    compareAt: '99.00',
    description: '<p>Brushed fleece, double-lined hood. On sale to exercise compare-at pricing.</p>',
    options: withOptions([{ name: 'Size', values: sizes }]),
    images: ['hoodie-1', 'hoodie-2'],
    collections: ['mock-new-arrivals', 'mock-sale'],
  },
  {
    handle: 'mock-single-bottle',
    title: 'Steel Bottle',
    type: 'Accessories',
    vendor: 'Singi',
    price: '24.00',
    description: '<p>A single-variant product with no options.</p>',
    options: [],
    images: ['bottle-1'],
    collections: ['mock-new-arrivals'],
  },
  {
    handle: 'mock-limited-poster',
    title: 'Limited Print, Sold Out',
    type: 'Prints',
    vendor: 'Singi Editions',
    price: '60.00',
    description: '<p>Tracked inventory with no stock, to exercise the sold-out state.</p>',
    options: [],
    soldOut: true,
    images: ['poster-1'],
    collections: ['mock-edge-cases'],
  },
  {
    handle: 'mock-long-title-product',
    title: 'The Extra Long Product Title That Keeps Going Across Several Lines to Test Cards, Headings and Wrapping Gracefully',
    type: 'Edge cases',
    vendor: 'A Vendor With a Fairly Long Name Ltd',
    price: '19.50',
    description: '<p>Long title, long vendor.</p>',
    options: [],
    images: ['long-1'],
    collections: ['mock-edge-cases'],
  },
  {
    handle: 'mock-no-image',
    title: 'Product Without an Image',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '15.00',
    description: '<p>No media at all. Cards and the gallery must cope.</p>',
    options: [],
    images: [],
    collections: ['mock-edge-cases'],
  },
  {
    handle: 'mock-arabic-title',
    title: 'قميص قطني كلاسيكي',
    type: 'قمصان',
    vendor: 'سنجي',
    price: '45.00',
    description: '<p dir="rtl">قميص قطني ثقيل بقصة مريحة. للتحقق من دعم الكتابة من اليمين إلى اليسار.</p>',
    options: withOptions([{ name: 'المقاس', values: ['S', 'M', 'L'] }]),
    images: ['arabic-1'],
    collections: ['mock-edge-cases'],
  },
  {
    handle: 'mock-japanese-title',
    title: 'シンプルなコットンTシャツ',
    type: 'トップス',
    vendor: 'シンジ',
    price: '4200.00',
    description: '<p>厚手のコットンを使った、ゆったりとしたシルエットのTシャツです。</p>',
    options: withOptions([{ name: 'サイズ', values: ['S', 'M', 'L'] }]),
    images: ['jp-1'],
    collections: ['mock-edge-cases'],
  },
  {
    handle: 'mock-high-price',
    title: 'Studio Chair',
    type: 'Furniture',
    vendor: 'Singi Home',
    price: '1299.00',
    description: '<p>A large price, to check formatting and layout.</p>',
    options: [],
    images: ['chair-1', 'chair-2'],
    collections: ['mock-new-arrivals'],
  },
  {
    handle: 'mock-many-options',
    title: 'Overshirt, Many Options',
    type: 'Outerwear',
    vendor: 'Singi',
    price: '129.00',
    description: '<p>Three options and thirty-two variants, to exercise the variant picker and Liquid cost.</p>',
    options: withOptions([
      { name: 'Color', values: colors },
      { name: 'Size', values: sizes },
      { name: 'Material', values: ['Cotton', 'Linen'] },
    ]),
    images: ['overshirt-1', 'overshirt-2', 'overshirt-3'],
    collections: ['mock-new-arrivals'],
  },
];

/* ---------- media edge cases: many images, variant images, odd ratios ----------
   `variantImages` assigns images to variants after creation: { option, values: { value: image index } }.
   Indexes point into `images` (0-based). An option value left out gets no image. */
const seeds = (prefix, count) => Array.from({ length: count }, (_, i) => `${prefix}-${i + 1}`);

PRODUCTS.push(
  {
    handle: 'mock-gallery-24',
    title: 'Gallery Stress Test, 24 Images',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '58.00',
    description: '<p>Twenty-four images and no variant images, to exercise a very long gallery: lazy loading, thumbnails, keyboard and swipe navigation.</p>',
    options: withOptions([{ name: 'Size', values: sizes.slice(0, 3) }]),
    images: seeds('gallery', 24),
    collections: ['mock-media'],
  },
  {
    handle: 'mock-color-images',
    title: 'Color Images, Every Variant',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '64.00',
    description: '<p>Four colors with three images each. Every color variant has its own image, and the three sizes of a color share it. Switching color must change the gallery to that color.</p>',
    options: withOptions([
      { name: 'Color', values: colors },
      { name: 'Size', values: sizes.slice(0, 3) },
    ]),
    images: [...seeds('black', 3), ...seeds('offwhite', 3), ...seeds('moss', 3), ...seeds('clay', 3)],
    variantImages: { option: 'Color', values: { Black: 0, 'Off-white': 3, Moss: 6, Clay: 9 } },
    collections: ['mock-media'],
  },
  {
    handle: 'mock-partial-variant-images',
    title: 'Partial Variant Images',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '49.00',
    description: '<p>Only two of four colors have an assigned image. The others must keep the current gallery image, not go blank.</p>',
    options: withOptions([{ name: 'Color', values: colors }]),
    images: seeds('partial', 5),
    variantImages: { option: 'Color', values: { Black: 1, Moss: 3 } },
    collections: ['mock-media'],
  },
  {
    handle: 'mock-variant-images-only',
    title: 'Variant Images Only, Six Colors',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '33.00',
    description: '<p>One image per variant and nothing else: six colors, six images. The gallery has exactly the variant images.</p>',
    options: withOptions([{ name: 'Color', values: ['Black', 'Off-white', 'Moss', 'Clay', 'Navy', 'Rust'] }]),
    images: seeds('single', 6),
    variantImages: { option: 'Color', values: { Black: 0, 'Off-white': 1, Moss: 2, Clay: 3, Navy: 4, Rust: 5 } },
    collections: ['mock-media'],
  },
  {
    handle: 'mock-video-gallery',
    title: 'Gallery With Video',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '72.00',
    description: '<p>Images plus an embedded video in the middle of the gallery. The video must not be the LCP candidate and must keep its aspect ratio.</p>',
    options: [],
    images: seeds('video', 3),
    externalVideo: { url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', position: 1, alt: 'Product video' },
    collections: ['mock-media'],
  },
  {
    handle: 'mock-mixed-ratios',
    title: 'Mixed Aspect Ratios',
    type: 'Edge cases',
    vendor: 'Singi',
    price: '88.00',
    description: '<p>Portrait, landscape, square, a tall image and a panorama in one gallery. The layout must not jump and no image may be cropped unexpectedly.</p>',
    options: [],
    images: ['portrait-1', 'wide-1', 'square-1', 'tall-1', 'pano-1', 'portrait-2'],
    collections: ['mock-media'],
  },
);

export const COLLECTIONS = [
  { handle: 'mock-new-arrivals', title: 'New Arrivals', description: '<p>The latest, to exercise a collection with filters and several products.</p>' },
  { handle: 'mock-sale', title: 'Sale', description: '<p>Items with a compare-at price.</p>' },
  { handle: 'mock-edge-cases', title: 'Edge Cases', description: '<p>Long titles, no image, sold out, right-to-left and CJK text.</p>' },
];

/* ---------- bulk products for testing pagination, filters and sorting ----------
   Deterministic (no Math.random): the same catalog every run. Stored in their own
   collection, mock-bulk. Change BULK_COUNT to make more or fewer. */
export const BULK_COUNT = 40;

const rnd = (n) => {
  let x = Math.imul(n ^ 0x9e3779b9, 2654435761) >>> 0;
  x ^= x >>> 15;
  x = Math.imul(x, 2246822519) >>> 0;
  return (x >>> 0) / 4294967296;
};
const pick = (list, n) => list[Math.floor(rnd(n) * list.length)];

const ADJECTIVES = ['Relaxed', 'Heavy', 'Light', 'Classic', 'Soft', 'Washed', 'Boxy', 'Slim', 'Everyday', 'Studio'];
const NOUNS = [
  ['Tee', 'Tops'],
  ['Hoodie', 'Tops'],
  ['Shirt', 'Tops'],
  ['Trouser', 'Bottoms'],
  ['Short', 'Bottoms'],
  ['Jacket', 'Outerwear'],
  ['Cap', 'Accessories'],
  ['Tote', 'Accessories'],
  ['Sock', 'Accessories'],
  ['Sneaker', 'Footwear'],
];
const VENDORS = ['Singi', 'Singi Home', 'Singi Editions'];
const POOL = ['bulk-a', 'bulk-b', 'bulk-c', 'bulk-d', 'bulk-e', 'bulk-f', 'bulk-g', 'bulk-h'];

for (let i = 1; i <= BULK_COUNT; i += 1) {
  const [noun, type] = pick(NOUNS, i * 11);
  const dollars = 9 + Math.floor(rnd(i * 3) * 240);
  const price = `${dollars}.${rnd(i * 13) < 0.5 ? '00' : '50'}`;
  const onSale = rnd(i * 5) < 0.25;
  const soldOut = rnd(i * 7) < 0.1;
  const sized = rnd(i * 17) < 0.5;
  PRODUCTS.push({
    handle: `mock-bulk-${String(i).padStart(3, '0')}`,
    title: `${pick(ADJECTIVES, i * 19)} ${noun} ${String(i).padStart(3, '0')}`,
    type,
    vendor: pick(VENDORS, i * 23),
    price,
    ...(onSale ? { compareAt: `${Math.round(dollars * 1.25)}.00` } : {}),
    ...(soldOut ? { soldOut: true } : {}),
    description: `<p>Bulk test product ${i} of ${BULK_COUNT}, for pagination, filters and sorting.</p>`,
    options: sized ? [{ name: 'Size', values: ['S', 'M', 'L'] }] : [],
    images: [POOL[i % POOL.length], ...(rnd(i * 29) < 0.3 ? [POOL[(i + 3) % POOL.length]] : [])],
    collections: ['mock-bulk'],
  });
}
COLLECTIONS.push({
  handle: 'mock-media',
  title: 'Media Edge Cases',
  description: '<p>Products with many images, variant images and mixed aspect ratios.</p>',
});
COLLECTIONS.push({
  handle: 'mock-bulk',
  title: 'Bulk (pagination test)',
  description: `<p>${BULK_COUNT} generated products, for testing show more, filters and sorting.</p>`,
});

export const PAGES = [
  {
    handle: 'mock-about',
    title: 'About',
    body: '<h2>Our story</h2><p>A page with rich content to exercise the prose styles: headings, lists, tables, quotes and links.</p><h3>What we value</h3><ul><li>Speed</li><li>Craft</li><li>Clarity</li></ul><blockquote><p>Good design is as little design as possible.</p></blockquote><table><thead><tr><th>Size</th><th>Chest</th></tr></thead><tbody><tr><td>S</td><td>96 cm</td></tr><tr><td>M</td><td>102 cm</td></tr></tbody></table><p><a href="/collections/mock-new-arrivals">Shop new arrivals</a></p>',
  },
];

PAGES.push({
  handle: 'mock-styleguide',
  title: 'Component library',
  template: 'styleguide',
  body: '',
});

export const BLOG = {
  handle: 'mock-journal',
  title: 'Journal',
  articles: [
    {
      handle: 'mock-first-post',
      title: 'Designing for speed',
      author: 'Singi',
      tags: [TAG],
      image: 'journal-1',
      body: '<p>An article with a featured image and several paragraphs.</p><h2>Why it matters</h2><p>Fast pages convert better and rank better.</p><p>Second paragraph to give the page some length for the typography.</p>',
    },
    {
      handle: 'mock-second-post',
      title: 'A very long article title that wraps across lines to test the blog grid and article header layouts',
      author: 'Singi',
      tags: [TAG],
      image: 'journal-2',
      body: '<p>Another article.</p><p>Short.</p>',
    },
    {
      handle: 'mock-third-post',
      title: 'No image post',
      author: 'Singi',
      tags: [TAG],
      body: '<p>An article without a featured image.</p>',
    },
  ],
};

/** Seed prefixes set the shape: journal and wide are landscape, square, tall and pano are what they say, anything else is 4:5 portrait. */
export const imageSize = (seed) => {
  if (seed.startsWith('journal') || seed.startsWith('wide')) return [1600, 1000];
  if (seed.startsWith('square')) return [1200, 1200];
  if (seed.startsWith('tall')) return [800, 1600];
  if (seed.startsWith('pano')) return [2400, 800];
  return [1000, 1250];
};
