#!/usr/bin/env node
/**
 * Creates mock content on the dev store with the custom app token from `.env`:
 * products (edge cases, and a niche catalog, see docs/mock-catalog.md), collections, a page,
 * a blog with articles, and the header and footer menus. Idempotent: anything that already exists is skipped.
 *
 *   npm run mock:plan                      print what would be created (default, no network)
 *   npm run mock:apply                     create it
 *   npm run mock:clean                     delete only the mock content (apply to run)
 *   node scripts/mock-content.mjs --apply --only products,collections,pages,blog,menus
 *   (menus link to the collections, pages and blog, so list those parts with `menus`, or the menus fall back to a flat list)
 *
 * Everything uses the `mock-` handle prefix and the `singi-mock` tag (see
 * scripts/mock-data.mjs). Cleaning deletes by those handles and never touches
 * anything else. Menus are updated, not deleted: `main-menu` and `footer` are
 * overwritten on --apply (use --only to skip them) and are left as they are on clean.
 *
 * Required app scopes: write_products, write_publications, write_inventory,
 * write_content, write_online_store_pages, write_online_store_navigation.
 */
import { admin, domain, userErrors } from './lib/admin.mjs';
import { OPS } from './lib/mock-ops.mjs';
import { gradientPng } from './lib/png.mjs';
import { BLOG, COLLECTIONS, NICHE_DEFINITIONS, PAGES, PRODUCTS, SIBLING_GROUPS, TAG, imageSize } from './mock-data.mjs';
import { ensureDefinitions } from './lib/metafield-definitions.mjs';
import { defineMetafields, linkGroup } from './lib/siblings.mjs';

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const apply = flag('apply');
const clean = flag('clean');
const onlyIndex = argv.indexOf('--only');
const only = onlyIndex === -1 ? [] : (argv[onlyIndex + 1] ?? '').split(',').filter(Boolean);
const wants = (part) => !only.length || only.includes(part);

const results = { created: 0, skipped: 0, deleted: 0, failed: 0 };
const log = (status, kind, name, extra = '') => {
  console.log(`  ${status.padEnd(8)} ${kind.padEnd(11)} ${name}${extra ? `  ${extra}` : ''}`);
  if (status === 'created') results.created += 1;
  else if (status === 'exists') results.skipped += 1;
  else if (status === 'deleted') results.deleted += 1;
  else if (status === 'FAILED') results.failed += 1;
};

const attempt = async (kind, name, fn) => {
  try {
    await fn();
  } catch (error) {
    log('FAILED', kind, name, error.message.slice(0, 300));
  }
};

const check = (payload, label) => {
  const errors = userErrors(payload);
  if (errors.length) throw new Error(`${label}: ${errors.join('; ')}`);
};

/* ---------- plan ---------- */

if (!apply) {
  console.log(`Plan for ${domain} (nothing is sent; add --apply to ${clean ? 'delete' : 'create'}):\n`);
  if (clean) {
    console.log(`  delete products ${PRODUCTS.map((p) => p.handle).join(', ')}`);
    console.log(`  delete collections ${COLLECTIONS.map((c) => c.handle).join(', ')}`);
    console.log(`  delete pages ${PAGES.map((p) => p.handle).join(', ')}`);
    console.log(`  delete blog ${BLOG.handle} (and its articles)`);
  } else {
    for (const p of PRODUCTS) console.log(`  product    ${p.handle.padEnd(26)} ${p.options.reduce((n, o) => n * o.values.length, 1)} variant(s), ${p.images.length} image(s)${p.soldOut ? ', sold out' : ''}${p.compareAt ? ', on sale' : ''}`);
    for (const group of SIBLING_GROUPS) console.log(`  siblings   ${group.map((g) => g.handle.replace('mock-', '')).join(', ')} (linked both ways)`);
    for (const c of COLLECTIONS) console.log(`  collection ${c.handle}`);
    for (const p of PAGES) console.log(`  page       ${p.handle}`);
    console.log(`  blog       ${BLOG.handle} with ${BLOG.articles.length} articles`);
    console.log('  menus      main-menu and footer (overwritten)');
  }
  process.exit(0);
}

console.log(`${clean ? 'Cleaning' : 'Creating'} mock content on ${domain}\n`);

/* ---------- clean ---------- */

if (clean) {
  if (wants('products')) {
    for (const { handle } of PRODUCTS) {
      await attempt('product', handle, async () => {
        const { productByIdentifier: product } = await admin(OPS.productByHandle, { handle });
        if (!product) return log('absent', 'product', handle);
        if (!product.tags.includes(TAG)) return log('FAILED', 'product', handle, `not tagged ${TAG}: refusing to delete`);
        check(await admin(OPS.productDelete, { input: { id: product.id } }), handle);
        log('deleted', 'product', handle);
      });
    }
  }
  if (wants('collections')) {
    for (const { handle } of COLLECTIONS) {
      await attempt('collection', handle, async () => {
        const { collectionByIdentifier: collection } = await admin(OPS.collectionByHandle, { handle });
        if (!collection) return log('absent', 'collection', handle);
        check(await admin(OPS.collectionDelete, { input: { id: collection.id } }), handle);
        log('deleted', 'collection', handle);
      });
    }
  }
  if (wants('pages')) {
    for (const { handle } of PAGES) {
      await attempt('page', handle, async () => {
        const { pages } = await admin(OPS.pageByHandle, { query: `handle:${handle}` });
        const page = pages.nodes.find((n) => n.handle === handle);
        if (!page) return log('absent', 'page', handle);
        check(await admin(OPS.pageDelete, { id: page.id }), handle);
        log('deleted', 'page', handle);
      });
    }
  }
  if (wants('blog')) {
    await attempt('blog', BLOG.handle, async () => {
      const { blogs } = await admin(OPS.blogByHandle, { query: `handle:${BLOG.handle}` });
      const blog = blogs.nodes.find((n) => n.handle === BLOG.handle);
      if (!blog) return log('absent', 'blog', BLOG.handle);
      check(await admin(OPS.blogDelete, { id: blog.id }), BLOG.handle);
      log('deleted', 'blog', BLOG.handle);
    });
  }
  console.log(`\nDeleted ${results.deleted}, failed ${results.failed}. Menus are not reverted.`);
  process.exit(results.failed ? 1 : 0);
}

/* ---------- create ---------- */

const { publications } = await admin(OPS.publications);
const onlineStore = publications.nodes.find((n) => n.name === 'Online Store' || n.catalog?.title?.endsWith('for Online Store'));
if (!onlineStore) console.log('  warning: Online Store publication not found; items will not be published.\n');

const publish = async (id) => {
  if (onlineStore) check(await admin(OPS.publish, { id, input: [{ publicationId: onlineStore.id }] }), 'publish');
};

/* Images are generated locally and uploaded through staged uploads, because Shopify's fetcher cannot reliably pull from third-party placeholder hosts. */
const staged = new Map();
const stageImage = async (seed) => {
  if (staged.has(seed)) return staged.get(seed);
  const [width, height] = imageSize(seed);
  const filename = `${seed}.png`;
  const payload = await admin(OPS.stagedUploads, { input: [{ resource: 'PRODUCT_IMAGE', filename, mimeType: 'image/png', httpMethod: 'POST' }] });
  check(payload, `stage ${seed}`);
  const target = payload.stagedUploadsCreate.stagedTargets[0];
  const form = new FormData();
  for (const { name, value } of target.parameters) form.append(name, value);
  form.append('file', new Blob([gradientPng(width, height, seed)], { type: 'image/png' }), filename);
  const response = await fetch(target.url, { method: 'POST', body: form });
  if (!response.ok) throw new Error(`upload of ${seed} failed: HTTP ${response.status}`);
  staged.set(seed, target.resourceUrl);
  return target.resourceUrl;
};

/* One variant. Option extras from scripts/mock-data.mjs: prices, units (unit price measurement) and
   variantMetafields, keyed by option value; the product's soldOutValues make a variant unavailable. */
const variantInput = (p, options, optionValues, index) => {
  const extra = (key) => optionValues.map(({ optionName, name }) => options.find((o) => o.name === optionName)?.[key]?.[name]).filter(Boolean);
  const price = extra('prices').at(-1) ?? p.price;
  const [unit] = extra('units');
  const metafields = extra('variantMetafields').flat();
  const unavailable = p.soldOut || optionValues.some(({ optionName, name }) => p.soldOutValues?.[optionName]?.includes(name));
  return {
    optionValues,
    price,
    ...(p.compareAt ? { compareAtPrice: p.compareAt } : {}),
    sku: `${p.handle}-${index + 1}`,
    inventoryPolicy: unavailable ? 'DENY' : 'CONTINUE',
    ...(unavailable ? { inventoryItem: { tracked: true } } : {}),
    ...(unit ? { unitPriceMeasurement: unit, showUnitPrice: true } : {}),
    ...(metafields.length ? { metafields: metafields.map((m) => ({ namespace: 'custom', ...m })) } : {}),
  };
};

const productInput = async (p) => {
  const options = p.options.length ? p.options : [{ name: 'Title', values: ['Default Title'] }];
  const combos = options.reduce((acc, o) => acc.flatMap((combo) => o.values.map((name) => [...combo, { optionName: o.name, name }])), [[]]);
  return {
    title: p.title,
    handle: p.handle,
    descriptionHtml: p.description,
    ...(p.template ? { templateSuffix: p.template } : {}),
    vendor: p.vendor,
    productType: p.type,
    tags: [TAG],
    status: 'ACTIVE',
    productOptions: options.map((o) => ({ name: o.name, values: o.values.map((name) => ({ name })) })),
    ...(p.metafields?.length ? { metafields: p.metafields.map((m) => ({ namespace: 'custom', ...m })) } : {}),
    variants: combos.map((optionValues, i) => variantInput(p, options, optionValues, i)),
    files: [
      ...(await Promise.all(p.images.map(async (seed, i) => ({ originalSource: await stageImage(seed), contentType: 'IMAGE', alt: `${p.title} ${i + 1}` })))),
      ...(p.externalVideo ? [{ originalSource: p.externalVideo.url, contentType: 'EXTERNAL_VIDEO', alt: p.externalVideo.alt }] : []),
    ],
  };
};

/* Media comes back unordered, so images are matched by the number at the end of their alt text ("Title 4" is images[3]). */
const assignVariantImages = async (productId, p) => {
  let { product } = await admin(OPS.productMedia, { id: productId });
  /* Shopify cannot attach media that is still processing, so wait for all of it. */
  for (let tries = 0; tries < 40 && product.media.nodes.some((m) => m.status !== 'READY' && m.status !== 'FAILED'); tries += 1) {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    ({ product } = await admin(OPS.productMedia, { id: productId }));
  }
  if (product.media.nodes.some((m) => m.status !== 'READY')) throw new Error(`${p.handle}: media did not finish processing`);
  const mediaByIndex = new Map(product.media.nodes.map((m) => [Number(m.alt.match(/(\d+)$/)?.[1]) - 1, m.id]));
  const variantMedia = [];
  for (const variant of product.variants.nodes) {
    const value = variant.selectedOptions.find((o) => o.name === p.variantImages.option)?.value;
    const index = p.variantImages.values[value];
    const mediaId = mediaByIndex.get(index);
    if (index !== undefined && mediaId && !variant.media.nodes.length) variantMedia.push({ variantId: variant.id, mediaIds: [mediaId] });
  }
  if (variantMedia.length) check(await admin(OPS.variantAppendMedia, { productId, variantMedia }), `${p.handle} variant images`);
};

if (wants('products') && !clean) {
  await attempt('metafields', 'definitions', async () => {
    for (const row of await ensureDefinitions(NICHE_DEFINITIONS, { apply: true })) if (row.status !== 'exists') log(row.status === 'created' ? 'created' : 'FAILED', 'metafield', row.label, row.status === 'created' ? '' : row.status);
  });
}

const productIds = new Map();
if (wants('products') || wants('collections')) {
  for (const p of PRODUCTS) {
    await attempt('product', p.handle, async () => {
      const { productByIdentifier: existing } = await admin(OPS.productByHandle, { handle: p.handle });
      if (existing) {
        productIds.set(p.handle, existing.id);
        if (p.metafields?.length && wants('products')) check(await admin(OPS.metafieldsSet, { metafields: p.metafields.map((m) => ({ ownerId: existing.id, namespace: 'custom', ...m })) }), `${p.handle} metafields`);
        if (p.template && wants('products')) check(await admin(OPS.productTemplate, { product: { id: existing.id, templateSuffix: p.template } }), `${p.handle} template`);
        if (p.variantImages && wants('products')) await assignVariantImages(existing.id, p);
        if (wants('products')) await publish(existing.id);
        return log('exists', 'product', p.handle);
      }
      if (!wants('products')) return;
      const payload = await admin(OPS.productSet, { input: await productInput(p) });
      check(payload, p.handle);
      const id = payload.productSet.product.id;
      productIds.set(p.handle, id);
      if (p.variantImages) await assignVariantImages(id, p);
      await publish(id);
      log('created', 'product', p.handle);
    });
  }
}

if (wants('products') && !clean) {
  await attempt('siblings', 'definitions', async () => {
    for (const row of await defineMetafields({ apply: true })) log(row.status === 'created' ? 'created' : 'exists', 'metafield', `singi.${row.key}`);
  });
  for (const group of SIBLING_GROUPS) {
    await attempt('siblings', group[0].handle, async () => {
      const rows = await linkGroup(group, { apply: true });
      log('linked', 'siblings', rows.map((r) => r.handle.replace('mock-', '')).join(', '));
    });
  }
}

const collectionIds = new Map();
if (wants('collections')) {
  for (const c of COLLECTIONS) {
    await attempt('collection', c.handle, async () => {
      const { collectionByIdentifier: existing } = await admin(OPS.collectionByHandle, { handle: c.handle });
      if (existing) {
        collectionIds.set(c.handle, existing.id);
        /* Products added to the data later join an existing collection too. */
        const missing = PRODUCTS.filter((p) => p.collections.includes(c.handle)).map((p) => productIds.get(p.handle)).filter(Boolean);
        if (missing.length && wants('collections')) await admin(OPS.collectionAddProducts, { id: existing.id, productIds: missing });
        return log('exists', 'collection', c.handle);
      }
      const products = PRODUCTS.filter((p) => p.collections.includes(c.handle)).map((p) => productIds.get(p.handle)).filter(Boolean);
      const payload = await admin(OPS.collectionCreate, { collection: { title: c.title, handle: c.handle, descriptionHtml: c.description } });
      check(payload, c.handle);
      const id = payload.collectionCreate.collection.id;
      if (products.length) check(await admin(OPS.collectionAddProducts, { id, productIds: products }), `${c.handle} products`);
      collectionIds.set(c.handle, id);
      await publish(id);
      log('created', 'collection', c.handle, `${products.length} products`);
    });
  }
}

const pageIds = new Map();
if (wants('pages') || wants('menus')) {
  for (const p of PAGES) {
    await attempt('page', p.handle, async () => {
      const { pages } = await admin(OPS.pageByHandle, { query: `handle:${p.handle}` });
      const existing = pages.nodes.find((n) => n.handle === p.handle);
      if (existing) {
        pageIds.set(p.handle, existing.id);
        return log('exists', 'page', p.handle);
      }
      if (!wants('pages')) return;
      const payload = await admin(OPS.pageCreate, { page: { title: p.title, handle: p.handle, body: p.body, isPublished: true, ...(p.template ? { templateSuffix: p.template } : {}) } });
      check(payload, p.handle);
      pageIds.set(p.handle, payload.pageCreate.page.id);
      log('created', 'page', p.handle);
    });
  }
}

let blogId;
if (wants('blog') || wants('menus')) {
  await attempt('blog', BLOG.handle, async () => {
    const { blogs } = await admin(OPS.blogByHandle, { query: `handle:${BLOG.handle}` });
    const existing = blogs.nodes.find((n) => n.handle === BLOG.handle);
    if (existing) {
      blogId = existing.id;
      return log('exists', 'blog', BLOG.handle);
    }
    if (!wants('blog')) return;
    const payload = await admin(OPS.blogCreate, { blog: { title: BLOG.title, handle: BLOG.handle } });
    check(payload, BLOG.handle);
    blogId = payload.blogCreate.blog.id;
    log('created', 'blog', BLOG.handle);
    for (const a of BLOG.articles) {
      await attempt('article', a.handle, async () => {
        const article = {
          blogId,
          title: a.title,
          handle: a.handle,
          body: a.body,
          author: { name: a.author },
          tags: a.tags,
          isPublished: true,
          ...(a.image ? { image: { url: await stageImage(a.image), altText: a.title } } : {}),
        };
        check(await admin(OPS.articleCreate, { article }), a.handle);
        log('created', 'article', a.handle);
      });
    }
  });
}

if (wants('menus')) {
  await attempt('menus', 'main-menu, footer', async () => {
    const { menus } = await admin(OPS.menus);
    const byHandle = new Map(menus.nodes.map((m) => [m.handle, m]));
    const item = (title, type, resourceId, items) => ({ title, type, resourceId, ...(items ? { items } : {}) });
    const col = (handle) => collectionIds.get(handle);
    const definitions = {
      'main-menu': [
        ...(col('mock-new-arrivals')
          ? [item('Shop', 'COLLECTION', col('mock-new-arrivals'), [
              ...(col('mock-sale') ? [item('Sale', 'COLLECTION', col('mock-sale'))] : []),
              ...(col('mock-edge-cases') ? [item('Edge cases', 'COLLECTION', col('mock-edge-cases'))] : []),
              /* The blog and a page sit nested on purpose: it is what the breadcrumb lookup for blogs, articles and pages needs (npm run test:breadcrumbs). */
              ...(blogId ? [item('Journal', 'BLOG', blogId, pageIds.get('mock-about') ? [item('About', 'PAGE', pageIds.get('mock-about'))] : undefined)] : []),
            ])]
          : [
              ...(blogId ? [item('Journal', 'BLOG', blogId)] : []),
              ...(pageIds.get('mock-about') ? [item('About', 'PAGE', pageIds.get('mock-about'))] : []),
            ]),
      ],
      footer: [
        ...(pageIds.get('mock-about') ? [item('About', 'PAGE', pageIds.get('mock-about'))] : []),
        ...(blogId ? [item('Journal', 'BLOG', blogId)] : []),
        ...(col('mock-sale') ? [item('Sale', 'COLLECTION', col('mock-sale'))] : []),
      ],
    };
    for (const [handle, items] of Object.entries(definitions)) {
      const menu = byHandle.get(handle);
      if (!menu) {
        log('FAILED', 'menu', handle, 'menu not found on the store');
        continue;
      }
      if (!items.length) {
        log('exists', 'menu', handle, 'nothing to link yet');
        continue;
      }
      check(await admin(OPS.menuUpdate, { id: menu.id, title: menu.title, items }), handle);
      log('created', 'menu', handle, `${items.length} items (updated)`);
    }
  });
}

console.log(`\nCreated ${results.created}, already there ${results.skipped}, failed ${results.failed}.`);
process.exit(results.failed ? 1 : 0);
