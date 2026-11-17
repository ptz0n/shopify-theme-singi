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
  ...[
    ['black', 'Black', '#1d1d1f'],
    ['sand', 'Sand', '#d8c7a5'],
    ['moss', 'Moss', '#6b7a4f'],
    ['clay', 'Clay', '#b5654a'],
    ['stripe', 'Striped', '#1d1d1f'],
    ['harbor', 'Harbor', '#1d3b5c'],
  ].map(([slug, name]) => ({
    handle: `mock-shirt-${slug}`,
    title: `Studio Shirt, ${name}`,
    type: 'Tops',
    vendor: 'Singi',
    price: '69.00',
    description: `<p>A color sibling: the same shirt as its sibling products, in ${name}. Each color is its own product, linked through the singi.color_siblings metafield.</p>`,
    options: withOptions([{ name: 'Size', values: sizes.slice(0, 3) }]),
    images: [`shirt-${slug}-1`, `shirt-${slug}-2`],
    collections: ['mock-new-arrivals'],
    /* The last color is sold out, to exercise an unavailable sibling. */
    soldOut: slug === 'clay',
  })),
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
    handle: 'mock-card-video',
    title: 'Video Preview, Hover Me',
    type: 'Prints',
    vendor: 'Singi Editions',
    price: '38.00',
    description: '<p>A short hosted video, to exercise the preview on product cards (hover or focus). Needs ffmpeg to create the clip when the mock content is applied; without it the product has no video.</p>',
    options: [],
    video: true,
    images: ['poster-1'],
    collections: ['mock-new-arrivals'],
  },
  {
    handle: 'mock-3d-model',
    title: '3D Model, Skipped in the Gallery',
    type: 'Prints',
    vendor: 'Singi Editions',
    price: '52.00',
    description: '<p>A product with one image and one 3D model (a cube, made by scripts/lib/mock-model.mjs), to check that the gallery and the zoom skip the model and leave no empty cell. The theme has no 3D viewer (docs/media.md).</p>',
    options: [],
    model: true,
    images: ['poster-1'],
    collections: ['mock-edge-cases'],
  },
  {
    handle: 'mock-limited-stock',
    title: 'Limited Stock, Three Left',
    type: 'Prints',
    vendor: 'Singi Editions',
    price: '45.00',
    description: '<p>Tracked inventory of three, oversell denied, no shipping required, to exercise the quantity cap on the product page.</p>',
    options: [],
    stock: 3,
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
    template: 'order',
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

/* Products linked as color siblings, both ways, with each product's swatch color. See scripts/lib/siblings.mjs. */
export const SIBLING_GROUPS = [
  [
    { handle: 'mock-shirt-black', color: '#1d1d1f', name: 'Black' },
    { handle: 'mock-shirt-sand', color: '#d8c7a5', name: 'Sand' },
    { handle: 'mock-shirt-moss', color: '#6b7a4f', name: 'Moss' },
    { handle: 'mock-shirt-clay', color: '#b5654a', name: 'Clay' },
    { handle: 'mock-shirt-stripe', color: ['#1d1d1f', '#f2efe8'], name: 'Striped' },
    { handle: 'mock-shirt-harbor', color: ['#1d3b5c', '#f2efe8', '#b5654a'] },
  ],
];

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

PAGES.push({
  handle: 'mock-sitemap',
  title: 'Sitemap',
  template: 'sitemap',
  body: '',
});

PAGES.push({
  handle: 'mock-blocks',
  title: 'Content blocks',
  template: 'blocks',
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

/* ---------- Niche catalog ----------
   Two products per merchant niche, with the data each shopper persona needs (see docs/mock-catalog.md):
   unit prices, measurement and text metafields (namespace "custom"), per-variant dimensions,
   sold-out sizes, long option ranges and personalization fields. The copy reads like a real
   store on purpose, so screenshots and reviews of the theme are not full of test text.
   Option extras: prices { value: price }, units { value: unit price measurement },
   variantMetafields { value: [metafield] }. Product extras: soldOutValues { option: [values] },
   metafields [{ key, type, value }]. */

/* Measurement metafield value. Units: dimension cm, mm; weight kg, g; area square_meters (Shopify rejects m2). Block settings can only be connected to weight, volume, dimension, rating and money measurements, so power is a plain number. */
const measure = (value, unit) => JSON.stringify({ value, unit });
/* One item per line: a list metafield arrives joined without separators when connected to a block setting, a multi-line text keeps its lines. */
const lines = (...values) => values.join('\n');

export const NICHE_DEFINITIONS = [
  { ownerType: 'PRODUCT', key: 'fit_notes', name: 'Fit notes', type: 'single_line_text_field', description: 'How the product fits, for example "Regular fit. Model is 185 cm and wears size M."' },
  { ownerType: 'PRODUCT', key: 'size_chart', name: 'Size chart', type: 'multi_line_text_field', description: 'A plain-text size chart, one row per size.' },
  { ownerType: 'PRODUCT', key: 'material', name: 'Material', type: 'single_line_text_field', description: 'Main material or composition.' },
  { ownerType: 'PRODUCT', key: 'care', name: 'Care', type: 'multi_line_text_field', description: 'Care instructions.' },
  { ownerType: 'PRODUCT', key: 'ingredients', name: 'Ingredients', type: 'multi_line_text_field', description: 'Full ingredient list (INCI for cosmetics).' },
  { ownerType: 'PRODUCT', key: 'allergens', name: 'Allergens', type: 'multi_line_text_field', description: 'Allergens the product contains or may contain, one per line.' },
  { ownerType: 'PRODUCT', key: 'compatible_with', name: 'Compatible with', type: 'multi_line_text_field', description: 'Devices or systems the product works with, one per line.' },
  { ownerType: 'PRODUCT', key: 'weight', name: 'Weight', type: 'weight', description: 'Product weight.' },
  { ownerType: 'PRODUCT', key: 'packed_length', name: 'Packed length', type: 'dimension', description: 'Packed length.' },
  { ownerType: 'PRODUCT', key: 'power_watts', name: 'Power (W)', type: 'number_integer', description: 'Rated power in watts.' },
  { ownerType: 'PRODUCT', key: 'battery_hours', name: 'Battery life (hours)', type: 'number_integer', description: 'Battery life in hours.' },
  { ownerType: 'PRODUCT', key: 'waterproof_mm', name: 'Waterproof rating (mm)', type: 'number_integer', description: 'Hydrostatic head in millimetres.' },
  { ownerType: 'PRODUCT', key: 'warranty', name: 'Warranty', type: 'single_line_text_field', description: 'Warranty terms in one line.' },
  { ownerType: 'PRODUCT', key: 'case_diameter', name: 'Case diameter', type: 'dimension', description: 'Watch case diameter.' },
  { ownerType: 'PRODUCT', key: 'production_days', name: 'Production time (days)', type: 'number_integer', description: 'Working days to make a made-to-order product, before shipping.' },
  { ownerType: 'PRODUCT', key: 'returns_note', name: 'Returns note', type: 'multi_line_text_field', description: 'Product-specific return terms, shown near the buy button, for example for personalized items.' },
  { ownerType: 'PRODUCT', key: 'edition', name: 'Edition', type: 'single_line_text_field', description: 'Edition information for prints and art.' },
  { ownerType: 'PRODUCT', key: 'personalization_label', name: 'Personalization label', type: 'single_line_text_field', description: 'Label of the personalization field, for example "Engraving".' },
  { ownerType: 'PRODUCT', key: 'personalization_max_length', name: 'Personalization max length', type: 'number_integer', description: 'Maximum characters in the personalization text.' },
  { ownerType: 'PRODUCTVARIANT', key: 'width', name: 'Width', type: 'dimension', description: 'Width of this variant.' },
  { ownerType: 'PRODUCTVARIANT', key: 'depth', name: 'Depth', type: 'dimension', description: 'Depth of this variant.' },
  { ownerType: 'PRODUCTVARIANT', key: 'height', name: 'Height', type: 'dimension', description: 'Height of this variant.' },
  { ownerType: 'PRODUCTVARIANT', key: 'area', name: 'Area', type: 'area', description: 'Area covered by this variant.' },
].map((d) => ({ namespace: 'custom', ...d }));

const SHADES = ['Fair', 'Light', 'Medium', 'Tan', 'Deep', 'Rich'].flatMap((tone) => ['Cool', 'Neutral', 'Warm', 'Olive'].map((undertone) => `${tone} ${undertone}`));
const apparelSizes = ['XS', 'S', 'M', 'L', 'XL'];
const dimsFor = (w, d, h) => [
  { key: 'width', type: 'dimension', value: measure(w, 'cm') },
  { key: 'depth', type: 'dimension', value: measure(d, 'cm') },
  { key: 'height', type: 'dimension', value: measure(h, 'cm') },
];
const niche = (slug, fields) => ({ handle: `mock-${slug}`, vendor: 'Singi', template: 'demo', images: [`niche-${slug}-1`, `niche-${slug}-2`], ...fields });

PRODUCTS.push(
  /* Fashion */
  niche('merino-sweater', {
    title: 'Merino Crew Sweater',
    type: 'Knitwear',
    price: '129.00',
    description: '<p>A fine-gauge merino sweater that sits close without clinging. Soft against the skin and warm without bulk.</p><ul><li>100% extra-fine merino wool</li><li>Ribbed neck, cuffs and hem</li><li>Machine washable at 30 degrees</li></ul>',
    options: [
      { name: 'Color', values: ['Navy', 'Oat', 'Moss'] },
      { name: 'Size', values: apparelSizes },
    ],
    soldOutValues: { Size: ['XL'] },
    collections: ['mock-fashion', 'mock-new-arrivals'],
    metafields: [
      { key: 'returns_note', type: 'multi_line_text_field', value: 'Free returns within 30 days.' },
      { key: 'fit_notes', type: 'single_line_text_field', value: 'Regular fit. Model is 185 cm and wears size M.' },
      { key: 'material', type: 'single_line_text_field', value: '100% extra-fine merino wool' },
      { key: 'care', type: 'multi_line_text_field', value: 'Machine wash at 30 degrees, wool cycle.\nReshape and dry flat.\nDo not tumble dry.' },
      { key: 'size_chart', type: 'multi_line_text_field', value: 'XS: chest 88 cm\nS: chest 94 cm\nM: chest 100 cm\nL: chest 106 cm\nXL: chest 112 cm' },
    ],
  }),
  niche('leather-boot', {
    title: 'Leather Ankle Boot',
    type: 'Footwear',
    price: '249.00',
    description: '<p>A resoleable ankle boot in full-grain leather with a Goodyear welt. Breaks in within a week and lasts for years.</p>',
    options: [
      { name: 'Color', values: ['Black', 'Tan'] },
      { name: 'Size', values: ['EU 38', 'EU 39', 'EU 40', 'EU 41', 'EU 42', 'EU 43'] },
    ],
    soldOutValues: { Size: ['EU 40', 'EU 41'] },
    collections: ['mock-fashion'],
    metafields: [
      { key: 'returns_note', type: 'multi_line_text_field', value: 'Free returns within 30 days.' },
      { key: 'fit_notes', type: 'single_line_text_field', value: 'Runs half a size large. Order your usual size or half a size down.' },
      { key: 'material', type: 'single_line_text_field', value: 'Full-grain calf leather, leather lining, rubber sole' },
    ],
  }),
  /* Jewelry and watches */
  niche('signet-ring', {
    title: 'Signet Ring',
    type: 'Rings',
    price: '189.00',
    description: '<p>A solid signet ring with a flat oval face, cast and finished by hand. Wear it on the little finger or stack it.</p>',
    options: [
      { name: 'Metal', values: ['Gold', 'Silver'], prices: { Gold: '189.00', Silver: '119.00' } },
      { name: 'Ring size', values: ['48', '50', '52', '54', '56', '58', '60'] },
    ],
    soldOutValues: { 'Ring size': ['60'] },
    images: ['square-signet-ring-1', 'square-signet-ring-2'],
    collections: ['mock-jewelry'],
    metafields: [
      { key: 'returns_note', type: 'multi_line_text_field', value: 'Personalized items are made for you and cannot be returned unless faulty.' },
      { key: 'material', type: 'single_line_text_field', value: '9 carat solid gold, or sterling silver 925' },
      { key: 'warranty', type: 'single_line_text_field', value: 'Lifetime warranty on materials and workmanship' },
      { key: 'production_days', type: 'number_integer', value: '4' },
      { key: 'personalization_label', type: 'single_line_text_field', value: 'Engraving (inside the band)' },
      { key: 'personalization_max_length', type: 'number_integer', value: '16' },
    ],
  }),
  niche('field-watch', {
    title: 'Field Watch 38 mm',
    type: 'Watches',
    price: '245.00',
    description: '<p>A simple three-hand field watch with a sapphire crystal and an automatic movement. Legible at a glance, built for daily wear.</p>',
    options: [{ name: 'Strap', values: ['Leather', 'Steel bracelet', 'NATO'], prices: { Leather: '245.00', 'Steel bracelet': '275.00', NATO: '225.00' } }],
    images: ['square-field-watch-1', 'square-field-watch-2'],
    collections: ['mock-jewelry'],
    metafields: [
      { key: 'case_diameter', type: 'dimension', value: measure(38, 'mm') },
      { key: 'weight', type: 'weight', value: measure(62, 'g') },
      { key: 'waterproof_mm', type: 'number_integer', value: '100' },
      { key: 'warranty', type: 'single_line_text_field', value: '5 years international warranty' },
      { key: 'material', type: 'single_line_text_field', value: 'Stainless steel case, sapphire crystal, automatic movement' },
    ],
  }),
  /* Beauty */
  niche('skin-tint', {
    title: 'Skin Tint Foundation',
    type: 'Complexion',
    price: '34.00',
    description: '<p>A light, buildable skin tint with a natural finish. Twenty-four shades, matched by tone and undertone, with SPF 20.</p>',
    options: [{ name: 'Shade', values: SHADES }],
    collections: ['mock-beauty'],
    metafields: [
      { key: 'ingredients', type: 'multi_line_text_field', value: 'Aqua, Caprylic/Capric Triglyceride, Glycerin, Zinc Oxide, Titanium Dioxide, Squalane, Niacinamide, Tocopherol, Mica, Iron Oxides (CI 77491, CI 77492, CI 77499).' },
      { key: 'care', type: 'multi_line_text_field', value: 'Shake well. Apply with fingertips or a damp sponge. Use within 12 months of opening.' },
    ],
  }),
  niche('barrier-serum', {
    title: 'Barrier Repair Serum',
    type: 'Skincare',
    price: '28.00',
    description: '<p>A fragrance-free serum with ceramides, niacinamide and panthenol. Supports the skin barrier and calms redness.</p>',
    options: [
      {
        name: 'Size',
        values: ['30 ml', '50 ml'],
        prices: { '30 ml': '28.00', '50 ml': '39.00' },
        units: {
          '30 ml': { quantityValue: 30, quantityUnit: 'ML', referenceValue: 100, referenceUnit: 'ML' },
          '50 ml': { quantityValue: 50, quantityUnit: 'ML', referenceValue: 100, referenceUnit: 'ML' },
        },
      },
    ],
    collections: ['mock-beauty'],
    metafields: [
      { key: 'ingredients', type: 'multi_line_text_field', value: 'Aqua, Glycerin, Niacinamide, Panthenol, Ceramide NP, Ceramide AP, Ceramide EOP, Phytosphingosine, Cholesterol, Sodium Hyaluronate, Allantoin, Xanthan Gum, Phenoxyethanol.' },
      { key: 'allergens', type: 'multi_line_text_field', value: lines('Fragrance-free') },
    ],
  }),
  /* Food and drink */
  niche('coffee-beans', {
    title: 'Single-Origin Coffee, Huila',
    type: 'Coffee',
    price: '14.00',
    description: '<p>A washed Colombian coffee from smallholders in Huila. Red apple, caramel and a clean finish. Roasted to order and shipped within two days.</p>',
    options: [
      {
        name: 'Size',
        values: ['250 g', '1 kg'],
        prices: { '250 g': '14.00', '1 kg': '48.00' },
        units: {
          '250 g': { quantityValue: 250, quantityUnit: 'G', referenceValue: 1, referenceUnit: 'KG' },
          '1 kg': { quantityValue: 1, quantityUnit: 'KG', referenceValue: 1, referenceUnit: 'KG' },
        },
      },
      { name: 'Grind', values: ['Whole bean', 'Espresso', 'Filter'] },
    ],
    images: ['square-coffee-beans-1', 'square-coffee-beans-2'],
    collections: ['mock-food'],
    metafields: [
      { key: 'ingredients', type: 'multi_line_text_field', value: '100% Arabica coffee beans.' },
      { key: 'allergens', type: 'multi_line_text_field', value: lines('Packed in a facility that also handles nuts and milk') },
      { key: 'care', type: 'multi_line_text_field', value: 'Store airtight, away from light and heat. Best within 6 weeks of the roast date.' },
    ],
  }),
  niche('olive-oil', {
    title: 'Cold-Pressed Olive Oil',
    type: 'Pantry',
    price: '16.00',
    description: '<p>An early-harvest extra virgin olive oil from a single family estate. Peppery, green and fresh.</p>',
    options: [
      {
        name: 'Size',
        values: ['500 ml', '750 ml', '3 L'],
        prices: { '500 ml': '16.00', '750 ml': '22.00', '3 L': '72.00' },
        units: {
          '500 ml': { quantityValue: 500, quantityUnit: 'ML', referenceValue: 1, referenceUnit: 'L' },
          '750 ml': { quantityValue: 750, quantityUnit: 'ML', referenceValue: 1, referenceUnit: 'L' },
          '3 L': { quantityValue: 3, quantityUnit: 'L', referenceValue: 1, referenceUnit: 'L' },
        },
      },
    ],
    images: ['square-olive-oil-1', 'square-olive-oil-2'],
    collections: ['mock-food'],
    metafields: [
      { key: 'ingredients', type: 'multi_line_text_field', value: 'Extra virgin olive oil, early harvest.' },
      { key: 'allergens', type: 'multi_line_text_field', value: lines('No allergens') },
    ],
  }),
  /* Electronics */
  niche('headphones', {
    title: 'Noise-Cancelling Headphones',
    type: 'Audio',
    price: '299.00',
    description: '<p>Over-ear headphones with adaptive noise cancelling, multipoint Bluetooth and a battery that lasts the week.</p>',
    options: [{ name: 'Color', values: ['Black', 'Silver'] }],
    collections: ['mock-electronics', 'mock-new-arrivals'],
    metafields: [
      { key: 'weight', type: 'weight', value: measure(254, 'g') },
      { key: 'battery_hours', type: 'number_integer', value: '40' },
      { key: 'warranty', type: 'single_line_text_field', value: '2 years' },
      { key: 'compatible_with', type: 'multi_line_text_field', value: lines('iPhone and iPad', 'Android 8 and newer', 'Mac and Windows', 'Bluetooth 5.3 and multipoint') },
    ],
  }),
  niche('usb-charger', {
    title: 'USB-C GaN Charger 65 W',
    type: 'Chargers',
    price: '49.00',
    description: '<p>A compact two-port GaN charger that powers a laptop and a phone at the same time.</p>',
    options: [],
    collections: ['mock-electronics'],
    metafields: [
      { key: 'power_watts', type: 'number_integer', value: '65' },
      { key: 'weight', type: 'weight', value: measure(112, 'g') },
      { key: 'warranty', type: 'single_line_text_field', value: '2 years' },
      { key: 'compatible_with', type: 'multi_line_text_field', value: lines('MacBook Air and Pro (USB-C)', 'iPhone 15 and newer', 'Pixel 8 and newer', 'Nintendo Switch and Steam Deck') },
    ],
  }),
  /* Home and furniture */
  niche('oak-table', {
    title: 'Oak Dining Table',
    type: 'Tables',
    price: '890.00',
    description: '<p>A solid oak dining table with a hand-oiled finish and a slim trestle base. Delivered flat-packed with the legs ready to fit in minutes.</p>',
    options: [
      {
        name: 'Size',
        values: ['160 cm', '200 cm', '240 cm'],
        prices: { '160 cm': '890.00', '200 cm': '1090.00', '240 cm': '1290.00' },
        variantMetafields: { '160 cm': dimsFor(160, 90, 75), '200 cm': dimsFor(200, 95, 75), '240 cm': dimsFor(240, 100, 75) },
      },
    ],
    images: ['wide-oak-table-1', 'wide-oak-table-2'],
    collections: ['mock-home'],
    metafields: [
      { key: 'material', type: 'single_line_text_field', value: 'Solid European oak, hand-oiled' },
      { key: 'weight', type: 'weight', value: measure(48, 'kg') },
      { key: 'production_days', type: 'number_integer', value: '15' },
      { key: 'care', type: 'multi_line_text_field', value: 'Wipe with a damp cloth. Re-oil once a year.' },
    ],
  }),
  niche('wool-rug', {
    title: 'Hand-Knotted Wool Rug',
    type: 'Rugs',
    price: '420.00',
    description: '<p>A dense hand-knotted wool rug in an undyed natural palette. Each piece varies slightly, which is the point.</p>',
    options: [
      {
        name: 'Size',
        values: ['170 x 240 cm', '200 x 300 cm'],
        prices: { '170 x 240 cm': '420.00', '200 x 300 cm': '690.00' },
        variantMetafields: {
          '170 x 240 cm': [{ key: 'area', type: 'area', value: measure(4.08, 'square_meters') }],
          '200 x 300 cm': [{ key: 'area', type: 'area', value: measure(6, 'square_meters') }],
        },
      },
    ],
    images: ['wide-wool-rug-1', 'wide-wool-rug-2'],
    collections: ['mock-home'],
    metafields: [
      { key: 'material', type: 'single_line_text_field', value: '100% New Zealand wool, cotton foundation' },
      { key: 'production_days', type: 'number_integer', value: '10' },
    ],
  }),
  /* Outdoor and sports */
  niche('trail-tent', {
    title: 'Three-Season Trail Tent, 2 Person',
    type: 'Tents',
    price: '389.00',
    description: '<p>A freestanding two-person tent that packs small and pitches in under five minutes. Two doors, two vestibules, and room for the gear.</p>',
    options: [{ name: 'Color', values: ['Forest', 'Dusk'] }],
    images: ['wide-trail-tent-1', 'wide-trail-tent-2'],
    collections: ['mock-outdoor'],
    metafields: [
      { key: 'weight', type: 'weight', value: measure(2.1, 'kg') },
      { key: 'packed_length', type: 'dimension', value: measure(46, 'cm') },
      { key: 'waterproof_mm', type: 'number_integer', value: '3000' },
      { key: 'warranty', type: 'single_line_text_field', value: '3 years, repairs for life' },
    ],
  }),
  niche('shell-jacket', {
    title: 'Waterproof Shell Jacket',
    type: 'Jackets',
    price: '279.00',
    description: '<p>A three-layer waterproof shell for wet days on the trail. Fully taped seams, a helmet-compatible hood and pit zips.</p>',
    options: [
      { name: 'Color', values: ['Black', 'Rust'] },
      { name: 'Size', values: apparelSizes },
    ],
    soldOutValues: { Size: ['XS'] },
    collections: ['mock-outdoor', 'mock-fashion'],
    metafields: [
      { key: 'fit_notes', type: 'single_line_text_field', value: 'Regular fit with room for a mid-layer. Model is 180 cm and wears size M.' },
      { key: 'waterproof_mm', type: 'number_integer', value: '20000' },
      { key: 'weight', type: 'weight', value: measure(410, 'g') },
      { key: 'size_chart', type: 'multi_line_text_field', value: 'XS: chest 86 cm\nS: chest 92 cm\nM: chest 98 cm\nL: chest 104 cm\nXL: chest 110 cm' },
      { key: 'care', type: 'multi_line_text_field', value: 'Wash at 30 degrees with a technical-fabric detergent. Tumble dry low to reactivate the water repellency.' },
    ],
  }),
  /* Art and made-to-order */
  niche('framed-print', {
    title: 'Personalized Star Map Print',
    type: 'Prints',
    price: '59.00',
    description: '<p>A print of the night sky from a date and place that matter to you. Printed on archival cotton paper and framed by hand.</p>',
    options: [
      { name: 'Size', values: ['30 x 40 cm', '50 x 70 cm', '70 x 100 cm'], prices: { '30 x 40 cm': '59.00', '50 x 70 cm': '99.00', '70 x 100 cm': '149.00' } },
      { name: 'Frame', values: ['No frame', 'Oak', 'Black'] },
    ],
    images: ['niche-framed-print-1', 'niche-framed-print-2'],
    collections: ['mock-made-to-order'],
    metafields: [
      { key: 'returns_note', type: 'multi_line_text_field', value: 'Personalized items are made for you and cannot be returned unless faulty.' },
      { key: 'production_days', type: 'number_integer', value: '5' },
      { key: 'personalization_label', type: 'single_line_text_field', value: 'Place and date, printed under the map' },
      { key: 'personalization_max_length', type: 'number_integer', value: '40' },
      { key: 'edition', type: 'single_line_text_field', value: 'Made to order, one print per order' },
    ],
  }),
  niche('cutting-board', {
    title: 'Engraved Walnut Cutting Board',
    type: 'Kitchen',
    price: '75.00',
    description: '<p>A solid walnut cutting board, oiled and ready to use. Add a name or a short message and we engrave it on the corner.</p>',
    options: [{ name: 'Size', values: ['Small', 'Large'], prices: { Small: '75.00', Large: '110.00' } }],
    images: ['niche-cutting-board-1', 'niche-cutting-board-2'],
    collections: ['mock-made-to-order', 'mock-home'],
    metafields: [
      { key: 'returns_note', type: 'multi_line_text_field', value: 'Personalized items are made for you and cannot be returned unless faulty.' },
      { key: 'material', type: 'single_line_text_field', value: 'Solid walnut, food-safe oil finish' },
      { key: 'production_days', type: 'number_integer', value: '3' },
      { key: 'personalization_label', type: 'single_line_text_field', value: 'Engraving' },
      { key: 'personalization_max_length', type: 'number_integer', value: '24' },
    ],
  }),
);

COLLECTIONS.push(
  { handle: 'mock-fashion', title: 'Fashion', description: '<p>Knitwear, footwear and technical layers, with the size and fit information you need before you order.</p>' },
  { handle: 'mock-jewelry', title: 'Jewelry and watches', description: '<p>Rings and watches in solid metals, with warranty on every piece.</p>' },
  { handle: 'mock-beauty', title: 'Beauty', description: '<p>Skincare and complexion, with full ingredient lists and shades matched by tone and undertone.</p>' },
  { handle: 'mock-food', title: 'Food and drink', description: '<p>Coffee and pantry staples, priced per kilo and per litre so sizes are easy to compare.</p>' },
  { handle: 'mock-electronics', title: 'Electronics', description: '<p>Audio and charging gear, with specs and compatibility spelled out.</p>' },
  { handle: 'mock-home', title: 'Home', description: '<p>Furniture and decor in natural materials, with exact dimensions for every size.</p>' },
  { handle: 'mock-outdoor', title: 'Outdoor', description: '<p>Tents and shell layers, with weights and waterproof ratings you can compare.</p>' },
  { handle: 'mock-made-to-order', title: 'Made to order', description: '<p>Personalized prints and engraved pieces, made in a few working days.</p>' },
);
