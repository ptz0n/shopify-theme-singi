/** GraphQL operations used by scripts/theme-settings.mjs. Validated against the Admin API 2026-07 schema. */
export const THEME_OPS = {
  readFile: 'query SingiThemeFile($id: ID!, $filenames: [String!]!) { theme(id: $id) { id name role files(filenames: $filenames, first: 1) { nodes { filename body { ... on OnlineStoreThemeFileBodyText { content } } } } } }',
  upsert:
    'mutation SingiThemeUpsert($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) { themeFilesUpsert(themeId: $themeId, files: $files) { upsertedThemeFiles { filename } userErrors { field message } } }',
};
