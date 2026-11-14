const root = document.querySelector('[data-styleguide]');

if (root) {
  const $ = (selector) => root.querySelector(selector);
  const html = document.documentElement;

  /* ---------- controls ---------- */

  const dirButton = $('[data-sg-dir]');
  dirButton.addEventListener('click', () => {
    const rtl = root.dir !== 'rtl';
    root.dir = rtl ? 'rtl' : 'ltr';
    dirButton.setAttribute('aria-pressed', String(rtl));
    dirButton.textContent = `Direction: ${rtl ? 'RTL' : 'LTR'}`;
    run();
  });

  const zoomButton = $('[data-sg-zoom]');
  zoomButton.addEventListener('click', () => {
    const zoomed = zoomButton.getAttribute('aria-pressed') !== 'true';
    html.style.fontSize = zoomed ? '200%' : '';
    zoomButton.setAttribute('aria-pressed', String(zoomed));
    zoomButton.textContent = `Zoom: ${zoomed ? '200' : '100'}%`;
    run();
  });

  $('[data-sg-refresh]').addEventListener('click', () => run());

  /* ---------- helpers ---------- */

  const el = (tag, props = {}, ...children) => {
    const node = Object.assign(document.createElement(tag), props);
    node.append(...children);
    return node;
  };
  const visible = (node) => {
    const rect = node.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && getComputedStyle(node).visibility !== 'hidden';
  };
  const describe = (node) => {
    const id = node.id ? `#${node.id}` : '';
    const cls = typeof node.className === 'string' && node.className ? `.${node.className.trim().split(/\s+/)[0]}` : '';
    return `${node.tagName.toLowerCase()}${id}${cls}`;
  };

  /* ---------- contrast ---------- */

  const probe = el('span', { ariaHidden: 'true' });
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  root.append(probe);

  const rgbOf = (token) => {
    probe.style.color = `var(${token})`;
    const value = getComputedStyle(probe).color;
    const numbers = value.match(/-?[\d.]+(?:e-?\d+)?/g).map(Number);
    return value.startsWith('color(') ? numbers.slice(0, 3).map((n) => n * 255) : numbers.slice(0, 3);
  };
  const luminance = ([r, g, b]) => {
    const f = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => {
    const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
    return (high + 0.05) / (low + 0.05);
  };

  const PAIRS = [
    ['Text on background', '--color-fg', '--color-bg', 4.5],
    ['Muted text on background', '--color-muted', '--color-bg', 4.5],
    ['Muted text on surface', '--color-muted', '--color-surface', 4.5],
    ['Text on surface', '--color-fg', '--color-surface', 4.5],
    ['Accent (links) on background', '--color-accent', '--color-bg', 4.5],
    ['Accent on surface', '--color-accent', '--color-surface', 4.5],
    ['Button text on button', '--color-bg', '--color-fg', 4.5],
    ['Error text on background', '--color-danger', '--color-bg', 4.5],
    ['Control border on background', '--color-control', '--color-bg', 3],
    ['Focus ring on background', '--color-accent', '--color-bg', 3],
  ];

  const contrast = () => {
    const rows = PAIRS.map(([label, fg, bg, needs]) => {
      const value = ratio(rgbOf(fg), rgbOf(bg));
      const pass = value >= needs;
      return {
        label: `${label} (${fg} on ${bg})`,
        pass,
        row: el(
          'tr',
          {},
          el('th', { scope: 'row', textContent: label }),
          el('td', { className: 'mono', textContent: `${value.toFixed(2)}:1` }),
          el('td', { className: 'mono', textContent: `${needs}:1` }),
          el('td', { className: pass ? 'sg__pass' : 'sg__fail', textContent: pass ? 'Pass' : 'Fail' }),
        ),
      };
    });
    $('[data-sg-contrast]').replaceChildren(...rows.map((r) => r.row));
    return rows.filter((r) => !r.pass).map((r) => r.label);
  };

  /* ---------- accessibility audit ---------- */

  const audit = () => {
    const results = [];
    const check = (name, failures, { warn = false, note = '' } = {}) => results.push({ name, failures, warn, note });
    const main = document.getElementById('main') ?? document;

    check('Contrast meets WCAG AA in the current color mode', contrast());

    const interactive = [...main.querySelectorAll('a[href], button, input:not([type="hidden"]), select, textarea, summary, [role="button"]')].filter(visible);
    const stretched = (n) => {
      const after = getComputedStyle(n, '::after');
      return after.content !== 'none' && after.position === 'absolute';
    };
    const standalone = interactive.filter((n) => !n.closest('p, .prose, label.check') && !n.classList.contains('chip-input') && !stretched(n));
    const rect = (n) => n.getBoundingClientRect();
    check('Target size is at least 24x24 CSS px (WCAG 2.2 AA)', standalone.filter((n) => Math.min(rect(n).width, rect(n).height) < 24).map(describe));
    check('Target size is at least 44px tall (recommended)', standalone.filter((n) => rect(n).height < 44 && !n.matches('input[type="checkbox"], input[type="radio"]')).map(describe), { warn: true });

    const unlabeled = [...main.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea')].filter(
      (n) => !n.labels?.length && !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby') && !n.title,
    );
    check('Every form control has an accessible name', unlabeled.map(describe));

    const unnamed = [...main.querySelectorAll('button, a[href], [role="button"]')].filter(
      (n) => !n.textContent.trim() && !n.getAttribute('aria-label') && !n.getAttribute('aria-labelledby') && !n.title && !n.querySelector('img[alt]:not([alt=""])'),
    );
    check('Every button and link has an accessible name', unnamed.map(describe));

    check('Every image has an alt attribute', [...main.querySelectorAll('img:not([alt])')].map(describe));

    const headings = [...main.querySelectorAll('h1, h2, h3, h4, h5, h6')].filter(visible);
    const levels = headings.map((h) => Number(h.tagName[1]));
    const skipped = headings.filter((h, i) => i > 0 && levels[i] - levels[i - 1] > 1).map((h) => `${describe(h)} "${h.textContent.trim().slice(0, 40)}"`);
    check('Heading levels do not skip', skipped);
    check('Exactly one h1 on the page', document.querySelectorAll('h1').length === 1 ? [] : [`found ${document.querySelectorAll('h1').length}`]);

    const ids = [...document.querySelectorAll('[id]')].map((n) => n.id);
    check('No duplicate ids', [...new Set(ids.filter((id, i) => ids.indexOf(id) !== i))]);

    const landmarks = { banner: 'header, [role="banner"]', navigation: 'nav', main: 'main, [role="main"]', contentinfo: 'footer, [role="contentinfo"]' };
    check('Landmarks present: banner, navigation, main, contentinfo', Object.entries(landmarks).filter(([, selector]) => !document.querySelector(selector)).map(([name]) => `missing ${name}`));

    check('No positive tabindex values', [...document.querySelectorAll('[tabindex]')].filter((n) => Number(n.getAttribute('tabindex')) > 0).map(describe));
    check('The page declares a language', html.lang ? [] : ['html has no lang attribute']);
    check('Skip link is the first focusable element', document.querySelector('a[href]')?.classList.contains('skip-link') ? [] : ['first link is not the skip link']);

    const failed = results.filter((r) => r.failures.length && !r.warn).length;
    const warned = results.filter((r) => r.failures.length && r.warn).length;
    $('[data-sg-summary]').textContent = `${results.length - failed - warned} passed, ${failed} failed, ${warned} warnings. Color mode: ${getComputedStyle(html).colorScheme}, direction: ${root.dir || 'ltr'}.`;

    $('[data-sg-audit]').replaceChildren(
      ...results.map((r) => {
        const state = r.failures.length ? (r.warn ? 'warn' : 'fail') : 'pass';
        const label = { pass: 'Pass', fail: 'Fail', warn: 'Warn' }[state];
        const item = el('li', {}, el('strong', { className: `sg__${state}`, textContent: `${label}: ` }), r.name);
        if (r.failures.length) {
          const details = el('details', {}, el('summary', { textContent: `${r.failures.length} item(s)` }), el('ul', {}, ...r.failures.slice(0, 20).map((f) => el('li', { textContent: f }))));
          item.append(details);
        }
        return item;
      }),
    );
  };

  /* ---------- measurements ---------- */

  const vitals = { lcp: null, cls: 0, inp: 0, longTasks: 0, blocking: 0 };
  const observe = (type, callback, extra = {}) => {
    try {
      new PerformanceObserver((list) => callback(list.getEntries())).observe({ type, buffered: true, ...extra });
    } catch {}
  };
  observe('largest-contentful-paint', (entries) => (vitals.lcp = entries.at(-1)));
  observe('layout-shift', (entries) => entries.forEach((e) => !e.hadRecentInput && (vitals.cls += e.value)));
  observe('event', (entries) => entries.forEach((e) => e.interactionId && (vitals.inp = Math.max(vitals.inp, e.duration))), { durationThreshold: 16 });
  observe('longtask', (entries) =>
    entries.forEach((e) => {
      vitals.longTasks += 1;
      vitals.blocking += Math.max(0, e.duration - 50);
    }),
  );

  const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`;
  const measure = () => {
    const nav = performance.getEntriesByType('navigation')[0];
    const paint = performance.getEntriesByType('paint').find((p) => p.name === 'first-contentful-paint');
    const resources = performance.getEntriesByType('resource');
    const kind = (r) => (r.initiatorType === 'img' || /\.(png|jpe?g|webp|avif|gif|svg)/.test(r.name) ? 'img' : /\.(woff2?|ttf)/.test(r.name) ? 'font' : r.initiatorType === 'script' || /\.js(\?|$)/.test(r.name) ? 'js' : r.initiatorType === 'link' || /\.css(\?|$)/.test(r.name) ? 'css' : 'other');
    const groups = {};
    for (const r of resources) {
      const g = (groups[kind(r)] ??= { count: 0, bytes: 0 });
      g.count += 1;
      g.bytes += r.transferSize || 0;
    }
    const inlineCss = [...document.querySelectorAll('style')].reduce((sum, s) => sum + s.textContent.length, 0);
    const fonts = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);
    const nodes = document.getElementsByTagName('*').length;

    const rows = [
      ['TTFB', nav ? `${Math.round(nav.responseStart)} ms` : 'n/a', '≤ 800 ms', nav && nav.responseStart <= 800],
      ['First Contentful Paint', paint ? `${Math.round(paint.startTime)} ms` : 'n/a', '≤ 1800 ms', paint && paint.startTime <= 1800],
      ['Largest Contentful Paint', vitals.lcp ? `${Math.round(vitals.lcp.startTime)} ms (${vitals.lcp.element ? describe(vitals.lcp.element) : 'n/a'})` : 'n/a', '≤ 2500 ms', vitals.lcp && vitals.lcp.startTime <= 2500],
      ['Cumulative Layout Shift', vitals.cls.toFixed(3), '≤ 0.1', vitals.cls <= 0.1],
      ['Interaction to Next Paint (this session)', vitals.inp ? `${Math.round(vitals.inp)} ms` : 'interact first', '≤ 200 ms', vitals.inp ? vitals.inp <= 200 : null],
      ['Long tasks / blocking time', `${vitals.longTasks} / ${Math.round(vitals.blocking)} ms`, 'TBT ≤ 200 ms', vitals.blocking <= 200],
      ['DOM nodes', String(nodes), '≤ 1500', nodes <= 1500],
      ['Inline CSS', kb(inlineCss), '≤ 14 KB', inlineCss <= 14000],
      ['Stylesheets', String(document.styleSheets.length), 'few', document.styleSheets.length <= 6],
      ...Object.entries(groups).map(([name, g]) => [`${name} requests`, `${g.count} (${kb(g.bytes)})`, '', null]),
      ['Fonts loaded', fonts.join(', ') || 'none (system fonts)', '2 weights max', fonts.length <= 3],
      ['Protocol', nav?.nextHopProtocol ?? 'n/a', 'h2 or h3', nav ? /h2|h3/.test(nav.nextHopProtocol) : null],
    ];
    $('[data-sg-vitals]').replaceChildren(
      ...rows.map(([name, value, target, ok]) =>
        el('tr', {}, el('th', { scope: 'row', textContent: name }), el('td', { className: 'mono', textContent: value }), el('td', { className: 'mono', textContent: target }), el('td', { className: ok === null ? 'muted' : ok ? 'sg__pass' : 'sg__fail', textContent: ok === null ? 'Info' : ok ? 'Good' : 'Check' })),
      ),
    );
  };

  /* ---------- run ---------- */

  function run() {
    audit();
    measure();
  }

  new MutationObserver(run).observe(html, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', run);
  addEventListener('load', () => setTimeout(run, 400));
  if (document.readyState === 'complete') setTimeout(run, 400);
}
