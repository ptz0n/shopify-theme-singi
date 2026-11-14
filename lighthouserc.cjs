/* Lighthouse CI config. Driven by scripts/lighthouse.mjs; see docs/tooling.md. */
const origin = (process.env.SINGI_URL || '').replace(/\/$/, '');
const themeId = process.env.SINGI_THEME_ID;

const withPreview = (path) => {
  const url = new URL(path, `${origin}/`);
  if (themeId) url.searchParams.set('preview_theme_id', themeId);
  return url.href;
};

const paths = ['/', process.env.SINGI_PRODUCT, process.env.SINGI_COLLECTION].filter(Boolean);
const min = (name, fallback) => Number(process.env[name] ?? fallback);

module.exports = {
  ci: {
    collect: {
      url: origin ? paths.map(withPreview) : [],
      numberOfRuns: Number(process.env.SINGI_RUNS || 3),
      puppeteerScript: process.env.SINGI_PASSWORD ? './scripts/lh-auth.cjs' : undefined,
      settings: {
        formFactor: 'mobile',
        onlyCategories: ['performance', 'accessibility', 'best-practices', 'seo'],
      },
    },
    assert: {
      assertions: {
        'categories:performance': ['error', { minScore: min('SINGI_MIN_PERF', 0.95) }],
        'categories:accessibility': ['error', { minScore: min('SINGI_MIN_A11Y', 0.98) }],
        'categories:best-practices': ['error', { minScore: min('SINGI_MIN_BP', 0.95) }],
        'categories:seo': ['error', { minScore: min('SINGI_MIN_SEO', 0.98) }],
        'largest-contentful-paint': ['warn', { maxNumericValue: 2000 }],
        'cumulative-layout-shift': ['error', { maxNumericValue: 0.02 }],
        'total-blocking-time': ['warn', { maxNumericValue: 150 }],
      },
    },
    upload: { target: 'filesystem', outputDir: '.lighthouseci/reports' },
  },
};
