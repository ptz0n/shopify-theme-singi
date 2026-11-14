/** GraphQL operations used by scripts/mock-content.mjs. Validated against the Admin API 2026-07 schema. */
export const OPS = {
  publications: 'query SingiPublications { publications(first: 20) { nodes { id name catalog { title } } } }',

  productByHandle: 'query SingiProductByHandle($handle: String!) { productByIdentifier(identifier: { handle: $handle }) { id handle tags } }',

  productSet:
    'mutation SingiProductSet($input: ProductSetInput!) { productSet(input: $input, synchronous: true) { product { id handle } userErrors { field message } } }',

  productMedia:
    'query SingiProductMedia($id: ID!) { product(id: $id) { media(first: 100) { nodes { id alt status } } variants(first: 100) { nodes { id media(first: 1) { nodes { id } } selectedOptions { name value } } } } }',

  variantAppendMedia:
    'mutation SingiVariantAppendMedia($productId: ID!, $variantMedia: [ProductVariantAppendMediaInput!]!) { productVariantAppendMedia(productId: $productId, variantMedia: $variantMedia) { userErrors { field message } } }',

  metafieldsSet:
    'mutation SingiSetMetafields($metafields: [MetafieldsSetInput!]!) { metafieldsSet(metafields: $metafields) { metafields { namespace key } userErrors { field message code } } }',

  productTemplate:
    'mutation SingiProductTemplate($product: ProductUpdateInput!) { productUpdate(product: $product) { product { id templateSuffix } userErrors { field message } } }',

  publish: 'mutation SingiPublish($id: ID!, $input: [PublicationInput!]!) { publishablePublish(id: $id, input: $input) { userErrors { field message } } }',

  stagedUploads:
    'mutation SingiStagedUploads($input: [StagedUploadInput!]!) { stagedUploadsCreate(input: $input) { stagedTargets { url resourceUrl parameters { name value } } userErrors { field message } } }',

  collectionAddProducts:
    'mutation SingiCollectionAddProducts($id: ID!, $productIds: [ID!]!) { collectionAddProducts(id: $id, productIds: $productIds) { collection { id } userErrors { field message } } }',

  collectionByHandle: 'query SingiCollectionByHandle($handle: String!) { collectionByIdentifier(identifier: { handle: $handle }) { id handle } }',

  collectionCreate:
    'mutation SingiCollectionCreate($collection: CollectionCreateInput!) { collectionCreate(collection: $collection) { collection { id handle } userErrors { field message } } }',

  locations: 'query SingiLocation { locations(first: 1) { nodes { id } } }',

  pageByHandle: 'query SingiPageByHandle($query: String!) { pages(first: 1, query: $query) { nodes { id handle } } }',

  pageCreate: 'mutation SingiPageCreate($page: PageCreateInput!) { pageCreate(page: $page) { page { id handle } userErrors { field message } } }',

  blogByHandle: 'query SingiBlogByHandle($query: String!) { blogs(first: 1, query: $query) { nodes { id handle } } }',

  blogCreate: 'mutation SingiBlogCreate($blog: BlogCreateInput!) { blogCreate(blog: $blog) { blog { id handle } userErrors { field message } } }',

  articleCreate:
    'mutation SingiArticleCreate($article: ArticleCreateInput!) { articleCreate(article: $article) { article { id handle } userErrors { field message } } }',

  menus: 'query SingiMenus { menus(first: 20) { nodes { id handle title } } }',

  menuUpdate:
    'mutation SingiMenuUpdate($id: ID!, $title: String!, $items: [MenuItemUpdateInput!]!) { menuUpdate(id: $id, title: $title, items: $items) { menu { id handle } userErrors { field message } } }',

  productDelete: 'mutation SingiProductDelete($input: ProductDeleteInput!) { productDelete(input: $input) { deletedProductId userErrors { field message } } }',

  collectionDelete:
    'mutation SingiCollectionDelete($input: CollectionDeleteInput!) { collectionDelete(input: $input) { deletedCollectionId userErrors { field message } } }',

  pageDelete: 'mutation SingiPageDelete($id: ID!) { pageDelete(id: $id) { deletedPageId userErrors { field message } } }',

  blogDelete: 'mutation SingiBlogDelete($id: ID!) { blogDelete(id: $id) { deletedBlogId userErrors { field message } } }',
};
