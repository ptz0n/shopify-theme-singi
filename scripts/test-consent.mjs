#!/usr/bin/env node
/**
 * Tests the theme's cookie dialog (decision 046) in headless Chrome. The dev store has no consent region, so Shopify's Customer
 * Privacy API is replaced by a stub that records every setTrackingConsent call; what the real API does (region rules, cookies,
 * timing) is NOT tested here. Default mode (the setting "Show the theme's cookie dialog" off): no dialog, no footer button, no
 * script. SINGI_CONSENT=on (npm run test:all sets the setting for this run):
 *   - a visitor the API says must be asked and who has not answered gets a modal dialog (the page behind is inert and does not
 *     scroll, focus starts on the title and stays inside, Escape does not dismiss it) and no consent is recorded before a click; Accept all and Reject all are the same size and look, 44px tall or more; contrast is at least 4.5:1;
 *   - Accept all, Reject all and Preferences then Save record exactly the right choices (sale_of_data follows marketing);
 *   - nothing shows when the API says not to ask, or when the visitor already answered;
 *   - the footer Cookie settings button appears once the API is ready, reopens the dialog with the current choices, and Escape
 *     closes it without recording anything;
 *   - a phone (16px side inset, no horizontal scroll), right to left, and dark mode.
 *
 *   npm run dev                      (in one terminal)
 *   npm run test:consent             (in another)
 * Env and setup as for npm run test:media.
 */
import { readFileSync } from 'node:fs';
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const on = process.env.SINGI_CONSENT === 'on';
let puppeteer;
try {
  puppeteer = (await import('puppeteer-core')).default;
} catch {
  console.error('puppeteer-core is missing. Run: npm install --no-save puppeteer-core');
  process.exit(2);
}
const browser = signed(await puppeteer.launch({
  executablePath: process.env.SINGI_CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  /* No --disable-web-security here (the other tests use it): with it a module import that a real browser blocks as cross-origin on the dev server goes unnoticed, which is how this dialog once failed to run. */
}), base);
let failures = 0;
let checks = 0;
const ok = (condition, message) => {
  checks += 1;
  if (!condition) {
    failures += 1;
    console.log(`  FAIL  ${message}`);
  }
};
const lum = (rgb) => { const [r, g, b] = rgb.match(/[\d.]+/g).slice(0, 3).map((v) => { const c = Number(v) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const contrast = (a, b) => (Math.max(lum(a), lum(b)) + 0.05) / (Math.min(lum(a), lum(b)) + 0.05);
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/* A page with the Customer Privacy API replaced by a stub: banner = what shouldShowBanner() says, consent = what the visitor answered. */
const open = async ({ fake = null, banner = true, consent = { analytics: '', marketing: '', preferences: '', sale_of_data: '' }, width = 1200, scheme = 'light', stub = true } = {}) => {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 800 });
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
  if (stub) {
    await page.evaluateOnNewDocument((state) => {
      window.Shopify = window.Shopify || {};
      window.__consent = [];
      window.Shopify.customerPrivacy = { shouldShowBanner: () => state.banner, currentVisitorConsent: () => state.consent, setTrackingConsent: (value, callback) => { window.__consent.push(value); if (callback) callback(); } };
    }, { banner, consent });
  }
  if (fake) {
    /* the dev server cannot make the Storefront API and suggestion calls (decision 046), so the test opts in and answers them itself */
    await page.evaluateOnNewDocument((data) => {
      window.singiConsentLive = true;
      window.__calls = [];
      const real = window.fetch.bind(window);
      const reply = (body, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }));
      window.fetch = (url, init) => {
        const target = String(url);
        if (target.includes('/browsing_context_suggestions.json')) {
          window.__calls.push('suggestion');
          return data.suggestion ? reply(data.suggestion) : reply({}, 404);
        }
        if (target.includes('/api/unstable/graphql.json')) {
          const { variables } = JSON.parse(init.body);
          window.__calls.push(`storefront ${variables.language} ${variables.country}`);
          if (!data.storefront) return reply({}, 400);
          const copy = data.copy[variables.language] ?? data.copy.EN;
          return reply({ data: { localization: { availableCountries: data.countries }, consentManagement: { banner: copy } } });
        }
        return real(url, init);
      };
    }, fake);
  }
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
  return page;
};
const banner = (title, accept) => ({ title, text: `${title}: we use cookies. Learn more in our `, policyLinkText: 'Policy', buttonPrefsOpenText: 'Prefs', preferences: { buttonAcceptText: accept, buttonDeclineText: `No ${accept}`, buttonSaveText: 'Save it', buttonCloseText: 'Shut', purposes: { essentialName: 'Must', essentialDesc: 'Must desc', performanceName: 'Stats', performanceDesc: 'Stats desc', preferencesName: 'Prefs name', preferencesDesc: 'Prefs desc', marketingName: 'Ads', marketingDesc: 'Ads desc' } } });
const FAKE = {
  suggestion: { detected_values: { country: { handle: 'SE' } }, suggestions: [{ parts: { country: { handle: 'SE', options: { CA: 'Canada', SE: 'Sweden', US: 'United States' } } } }] },
  storefront: true,
  countries: [
    { isoCode: 'CA', availableLanguages: [{ isoCode: 'EN', endonymName: 'English' }, { isoCode: 'FR', endonymName: 'Français' }] },
    { isoCode: 'SE', availableLanguages: [{ isoCode: 'SV', endonymName: 'Svenska' }, { isoCode: 'EN', endonymName: 'English' }] },
    { isoCode: 'US', availableLanguages: [{ isoCode: 'EN', endonymName: 'English' }] },
  ],
  copy: { EN: banner('Cookie consent', 'Accept all'), SV: banner('Cookie-samtycke', 'Godkänn alla'), FR: banner('Consentement', 'Tout accepter') },
};
/* open, and the 0.2s entrance finished (a measurement mid-animation is off by a few pixels) */
const shown = (page) => page.waitForFunction(() => document.querySelector('dialog.consent')?.open, { timeout: 5000 }).then(() => wait(400)).then(() => true, () => false);
const calls = (page) => page.evaluate(() => window.__consent);
const rect = (page, selector) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); const cs = getComputedStyle(document.querySelector(s)); return { x: r.left, y: r.top, w: r.width, h: r.height, right: innerWidth - r.right, bottom: innerHeight - r.bottom, bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight, font: cs.fontSize }; }, selector);
/* The dev server keeps one storefront session for every browser, so a test that changes the market changes it for everyone after it:
   put the country back with the same form post (the localization form wants these fields). */
const restoreCountry = async (code) => {
  const page = await browser.newPage();
  await page.goto(`${base}/`, { waitUntil: 'load', timeout: 60000 });
  await page.evaluate(async (country) => {
    const form = new FormData();
    for (const [key, value] of Object.entries({ country_code: country, return_to: '/', form_type: 'localization', _method: 'put', utf8: '✓' })) form.set(key, value);
    await fetch('/localization', { method: 'POST', body: form });
  }, code);
  await page.close();
};
const all = (value) => ({ analytics: value, marketing: value, preferences: value, sale_of_data: value });

try {
  if (!on) {
    const page = await open({ stub: false });
    ok(await page.evaluate(() => !document.querySelector('consent-dialog, dialog.consent, .consent-open')), 'setting off: no dialog and no footer button in the page');
    ok(await page.evaluate(() => ![...document.scripts].some((s) => /consent\.js/.test(s.src))), 'setting off: consent.js is not loaded');
    await page.close();
  } else {
    /* 1. a visitor who must be asked */
    let page = await open();
    ok(await shown(page), 'a visitor who must be asked sees the dialog');
    ok(await page.evaluate(() => document.querySelector('dialog.consent').matches(':modal') && getComputedStyle(document.documentElement).overflow === 'hidden'), 'the dialog is modal and the page behind does not scroll');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('dialog.consent'), '::backdrop').backgroundColor === 'rgba(0, 0, 0, 0.6)'), 'the page behind sits under the scrim token');
    const active = await page.evaluate(() => { const a = document.activeElement; return `${a?.tagName}#${a?.id}.${a?.className}`; });
    ok(active.includes('#consent-title'), `focus starts on the title (${active})`);
    for (let i = 0; i < 14; i += 1) await page.keyboard.press('Tab');
    ok(await page.evaluate(() => !!document.activeElement?.closest('dialog.consent')), 'Tab stays inside the dialog');
    ok(await page.evaluate(() => { const weight = (q) => getComputedStyle(document.querySelector(q)).fontWeight; return weight('.consent__row small') === getComputedStyle(document.body).fontWeight && Number(weight('.consent__row strong')) > Number(weight('.consent__row small')); }), 'in Preferences the name is bold and the description regular');
    for (let press = 0; press < 3; press++) await page.keyboard.press('Escape');
    ok(await page.evaluate(() => document.querySelector('dialog.consent').open) && (await calls(page)).length === 0, 'Escape, pressed three times, does not dismiss the first ask and records nothing');
    ok(await page.evaluate(() => { const card = document.querySelector('.consent').getBoundingClientRect(); const x = card.left - 10; const y = card.top + 20; document.elementFromPoint(x, y)?.click(); return document.querySelector('dialog.consent').open; }), 'a click on the scrim does not dismiss it either');
    ok(await page.evaluate(() => { const link = document.querySelector('[data-copy="policy"]'); return !link || new URL(link.href).origin === location.origin; }), 'the privacy link stays on this store, at the page\'s own address (Shopify\'s link for a language is not always a valid path of the market)');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-consent-close]')).display === 'none' || document.querySelector('[data-consent-close]').hidden), 'the first ask has no close button');
    ok((await calls(page)).length === 0, 'nothing is recorded before a click');
    ok(await page.evaluate(() => { const d = document.querySelector('dialog.consent'); return d.getAttribute('aria-labelledby') === 'consent-title' && !!document.getElementById('consent-title')?.textContent.trim(); }), 'the dialog is named by its title');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-consent-close]')).display === 'none'), 'on the first ask there is no close button (the visitor answers, or nothing is recorded)');
    const accept = await rect(page, '[data-consent="accept"]');
    const reject = await rect(page, '[data-consent="reject"]');
    ok(Math.abs(accept.w - reject.w) <= 1 && Math.abs(accept.h - reject.h) <= 1 && accept.h >= 44, `Accept all and Reject all are the same size, 44px tall or more (${Math.round(accept.w)}x${Math.round(accept.h)} and ${Math.round(reject.w)}x${Math.round(reject.h)})`);
    ok(accept.bg === reject.bg && accept.color === reject.color && accept.weight === reject.weight && accept.font === reject.font, `Accept all and Reject all look the same (${accept.bg} / ${reject.bg})`);
    const card = await rect(page, 'dialog.consent');
    ok(Math.abs(card.x - (1200 - 416) / 2) <= 1 && Math.abs(card.w - 416) <= 1 && Math.abs(card.y - 0.12 * 800) <= 2, `desktop: a 26rem card centered across, anchored 12% from the top (${JSON.stringify({ x: card.x, y: card.y, bottom: card.bottom, w: card.w })})`);
    const body = await rect(page, '.consent__body');
    ok(contrast(card.bg, card.color) >= 4.5 && contrast(card.bg, body.color) >= 4.5, `text has contrast of at least 4.5:1 (${contrast(card.bg, body.color).toFixed(1)}:1 for the note)`);
    ok(await page.evaluate(() => { const r = document.querySelector('dialog.consent').getBoundingClientRect(); const top = document.elementFromPoint(r.left + r.width / 2, r.top + 8); return !!top?.closest('dialog.consent'); }), 'the dialog is above the page (the sticky header and bars)');
    const ready = await page.evaluate(() => 'consentReady' in document.documentElement.dataset && getComputedStyle(document.querySelector('.consent-open')).display !== 'none');
    ok(ready, 'the footer Cookie settings button shows once the API is ready');

    /* 2. Accept all */
    await page.click('[data-consent="accept"]');
    ok(JSON.stringify(await calls(page)) === JSON.stringify([all(true)]), `Accept all records every category as true (${JSON.stringify(await calls(page))})`);
    ok(await page.evaluate(() => !document.querySelector('dialog.consent').open && document.activeElement === document.getElementById('main')), 'the dialog closes and focus goes to the main content');
    await page.close();

    /* 3. Reject all */
    page = await open();
    await shown(page);
    await page.click('[data-consent="reject"]');
    ok(JSON.stringify(await calls(page)) === JSON.stringify([all(false)]), `Reject all records every category as false (${JSON.stringify(await calls(page))})`);
    await page.close();

    /* 4. Preferences and save. A click that is not on a choice (opening Preferences, the text, the card) records nothing. */
    page = await open();
    await shown(page);
    await page.click('.consent__body');
    await page.click('.consent__more summary');
    ok((await calls(page)).length === 0 && (await page.evaluate(() => document.querySelector('dialog.consent').open)), 'a click that is not on a choice (the text, Preferences) records nothing and keeps the dialog open');
    await page.click('.consent__more summary');
    ok(await page.evaluate(() => !document.querySelector('.consent__more').open), 'the choices are folded away until Preferences is pressed');
    await page.click('.consent__more summary');
    const boxes = await page.evaluate(() => [...document.querySelectorAll('.consent__choices input')].map((i) => ({ name: i.name, checked: i.checked, disabled: i.disabled })));
    ok(boxes.length === 4 && boxes[0].disabled && boxes[0].checked && boxes.slice(1).every((b) => !b.checked && !b.disabled), `Essential is on and locked, the other three start off (${JSON.stringify(boxes)})`);
    ok(await page.evaluate(() => { const style = (q) => getComputedStyle(document.querySelector(q)).backgroundColor; return style('.consent__save') === style('[data-consent="accept"]') && getComputedStyle(document.querySelector('.consent__actions')).display === 'none'; }), 'with Preferences open Save choices is the one primary button: Accept all and Reject all are hidden');
    await page.click('input[name="analytics"]');
    /* the same edge as everywhere else in the card: the last button sits one panel padding above the card's edge, with Preferences open or closed */
    ok(await page.evaluate(() => { const card = document.querySelector('.consent').getBoundingClientRect(); const save = document.querySelector('.consent__save').getBoundingClientRect(); const pad = parseFloat(getComputedStyle(document.querySelector('.consent__panel')).paddingBottom); return Math.abs(card.bottom - 1 - save.bottom - pad) <= 1; }), 'below Save choices the space is the panel padding, like below the other buttons');
    await page.click('.consent__save');
    ok(JSON.stringify(await calls(page)) === JSON.stringify([{ analytics: true, marketing: false, preferences: false, sale_of_data: false }]), `Save records only what was ticked (${JSON.stringify(await calls(page))})`);
    await page.close();
    page = await open();
    await shown(page);
    await page.click('.consent__more summary');
    await page.click('input[name="marketing"]');
    await page.click('.consent__save');
    ok((await calls(page))[0]?.marketing === true && (await calls(page))[0]?.sale_of_data === true && (await calls(page))[0]?.analytics === false, 'sale_of_data follows marketing');
    await page.close();

    /* 5. nothing to ask */
    page = await open({ banner: false });
    await wait(3500);
    ok(await page.evaluate(() => !document.querySelector('dialog.consent').open), 'the dialog stays closed when the API says not to ask');
    ok(await page.evaluate(() => 'consentReady' in document.documentElement.dataset), 'the footer button is still available there (to change a choice)');
    await page.close();
    page = await open({ consent: { analytics: 'yes', marketing: 'no', preferences: 'yes', sale_of_data: '' } });
    await wait(3500);
    ok(await page.evaluate(() => !document.querySelector('dialog.consent').open), 'the dialog stays closed for a visitor who already answered');

    /* 6. reopen from the footer */
    await page.evaluate(() => document.querySelector('.consent-open').scrollIntoView());
    await page.click('.consent-open');
    ok(await shown(page), 'the footer button reopens the dialog');
    const reopened = await page.evaluate(() => ({ open: document.querySelector('.consent__more').open, boxes: [...document.querySelectorAll('.consent__choices input[name]')].map((i) => i.checked), closer: !document.querySelector('[data-consent-close]').hidden, focus: document.activeElement?.id }));
    ok(reopened.open && JSON.stringify(reopened.boxes) === JSON.stringify([true, false, true]) && reopened.closer && reopened.focus === 'consent-title', `it shows the current choices, a close button and moves focus to the title (${JSON.stringify(reopened)})`);
    ok(await page.evaluate(() => document.querySelector('dialog.consent').matches(':modal')), 'a reopened dialog is modal too');
    const small = await page.evaluate(() => Math.round(document.querySelector('.consent-open').getBoundingClientRect().height));
    ok(small >= 44, `the footer button is 44px tall or more (${small})`);
    await page.keyboard.press('Escape');
    ok(await page.evaluate(() => !document.querySelector('dialog.consent').open) && (await calls(page)).length === 0, 'Escape closes a reopened dialog without recording anything');
    ok(await page.evaluate(() => document.activeElement === document.querySelector('.consent-open')), 'focus goes back to the footer button that reopened it');
    await page.close();

    /* 7. phone, right to left, dark */
    page = await open({ width: 390 });
    await shown(page);
    await page.click('.consent__more summary');
    ok(await page.evaluate(() => { const q = (s) => document.querySelector(s).getBoundingClientRect(); const above = q('.consent__region').bottom - 1 - q('.consent__region .consent__fields').bottom; const below = q('.consent__head').top - q('.consent__region').bottom; const rem = parseFloat(getComputedStyle(document.documentElement).fontSize); return Math.abs(above - below) <= 1 && Math.abs(below - rem) <= 1 && Math.abs(q('.consent__body').top - q('.consent__head').bottom - rem) <= 1; }), 'phone: the same 1rem above and below the rule and between the title and the text');
    ok(await page.evaluate(() => ['.consent__more summary', '.consent__save', '[data-consent="accept"]'].every((q) => { const cs = getComputedStyle(document.querySelector(q)); return cs.userSelect === 'none' && cs.touchAction === 'manipulation'; })), 'summaries and buttons do not select their text on a double tap (and do not wait for a double-tap zoom)');
    ok(await page.evaluate(() => { const q = (s) => document.querySelector(s).getBoundingClientRect(); const range = document.createRange(); range.selectNodeContents(document.querySelector('.consent__more summary span')); const text = range.getBoundingClientRect(); return Math.abs((text.top - q('.consent__body').bottom) - (q('.consent__row input').top - text.bottom)) <= 2; }), 'phone: the space above and below Preferences is the same, open');
    ok(await page.evaluate(() => [...document.querySelectorAll('.consent__row')].every((row) => { const r = row.getBoundingClientRect(); const d = row.querySelector('small').getBoundingClientRect(); const box = row.querySelector('input').getBoundingClientRect(); return Math.abs(d.left - r.left) <= 1 && d.top >= box.bottom - 1; })), 'phone: each description runs from the row\'s edge, under the checkbox and the name');
    await page.click('.consent__more summary');
    const phone = await rect(page, 'dialog.consent');
    ok(Math.abs(phone.x - 16) <= 1 && Math.abs(phone.right - 16) <= 1 && phone.y >= 16, `phone: 16px from the left and right, below the top inset (${JSON.stringify({ x: phone.x, right: phone.right, y: phone.y })})`);
    ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'phone: no horizontal scroll');
    await page.close();
    page = await open();
    await shown(page);
    await page.evaluate(() => { document.documentElement.dir = 'rtl'; });
    const rtl = await rect(page, 'dialog.consent');
    ok(Math.abs(rtl.x - rtl.right) <= 1 && await page.evaluate(() => getComputedStyle(document.querySelector('.consent__title')).direction === 'rtl'), `right to left: the card stays centered and reads right to left (${rtl.x} / ${rtl.right})`);
    await page.close();
    page = await open({ scheme: 'dark' });
    await shown(page);
    const dark = await rect(page, 'dialog.consent');
    ok(lum(dark.bg) < 0.2 && contrast(dark.bg, dark.color) >= 4.5, `dark: a dark card with readable text (${dark.bg} / ${dark.color})`);
    await page.close();

    /* 8. the region in the same dialog (a store with more than one country or language; the dev store has two countries) */
    page = await open();
    await shown(page);
    const region = await page.evaluate(() => {
      const block = document.querySelector('[data-consent-region]');
      const country = block?.querySelector('select[name="country_code"]');
      const language = block?.querySelector('select[name="language_code"]');
      return { block: !!block, labels: block ? [...block.querySelectorAll('label > span:first-child')].map((l) => l.textContent.trim()) : [], visible: !!country && country.getBoundingClientRect().height > 0, countries: country ? [...country.options].map((o) => [o.value, o.selected]) : null, languages: language ? [...language.options].map((o) => [o.value, o.selected]) : null, linked: [country, language].filter(Boolean).every((s) => s.form?.id === 'consent-localization' && s.form.getAttribute('action')?.endsWith('/localization')) };
    });
    ok(region.block && region.visible && region.labels[0] === 'Country/region', `the first ask shows a labelled country select, not folded away (${JSON.stringify(region.labels)})`);
    ok(region.countries?.length >= 2 && region.countries.filter(([, selected]) => selected).length === 1 && region.linked, `the country select lists the countries with the current one chosen and posts to /localization (${JSON.stringify(region.countries)})`);
    /* unchanged: Accept all records consent and posts nothing to /localization */
    let posted = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/localization')) posted.push(request.postData()); });
    await page.click('[data-consent="accept"]');
    await wait(1800);
    ok(JSON.stringify(await calls(page)) === JSON.stringify([all(true)]) && posted.length === 0, `an unchanged region: Accept all records consent and posts no region (${JSON.stringify(posted)})`);
    await page.close();
    const originalCountry = region.countries?.find(([, selected]) => selected)?.[0];
    /* changed: the answer is recorded first, then the localization form is posted with the new country and this page as return_to */
    for (const [kind, expected] of [['accept', all(true)], ['reject', all(false)]]) {
      page = await open();
      await shown(page);
      const other = await page.evaluate(() => [...document.querySelector('select[name="country_code"]').options].find((o) => !o.selected).value);
      await page.select('select[name="country_code"]', other);
      posted = [];
      page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/localization')) posted.push(request.postData()); });
      await Promise.all([page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('/localization'), { timeout: 8000 }).catch(() => null), page.click(`[data-consent="${kind}"]`)]);
      ok(posted.length === 1 && new RegExp(`name="country_code"\\r\\n\\r\\n${other}\\r`).test(posted[0] ?? '') && /name="return_to"\r\n\r\n\/\r/.test(posted[0] ?? ''), `a changed country: ${kind} posts the new country and returns to this page (${JSON.stringify((posted[0] ?? '').match(/name="(country_code|return_to)"\r\n\r\n[^\r]*/g))})`);
      await page.close();
      await restoreCountry(originalCountry);
    }
    /* a changed language, when the store has more than one */
    page = await open();
    await shown(page);
    if (await page.evaluate(() => { const select = document.querySelector('select[name="language_code"]'); return !!select && !select.disabled; })) {
      const otherLanguage = await page.evaluate(() => [...document.querySelector('select[name="language_code"]').options].find((o) => !o.selected).value);
      await page.select('select[name="language_code"]', otherLanguage);
      posted = [];
      page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/localization')) posted.push(request.postData()); });
      await Promise.all([page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('/localization'), { timeout: 8000 }).catch(() => null), page.click('[data-consent="accept"]')]);
      ok(posted.length === 1 && new RegExp(`name="language_code"\\r\\n\\r\\n${otherLanguage}\\r`).test(posted[0] ?? ''), `a changed language is posted with Accept all (${JSON.stringify(posted)})`);
    } else {
      console.log('  note  the store has one language: the language select is not checked');
    }
    await page.close();
    /* reopened from the footer: consent only, the footer selector is the way to change the region */
    page = await open({ consent: { analytics: 'yes', marketing: 'no', preferences: 'yes', sale_of_data: '' } });
    await wait(1200);
    await page.evaluate(() => document.querySelector('.consent-open').scrollIntoView());
    await page.click('.consent-open');
    await shown(page);
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-consent-region]')).display === 'none'), 'reopened from the footer the dialog shows no region (consent only)');
    await page.close();

    /* 8b. Shopify's suggestion, copy and the language select (stubbed: the dev server cannot make these calls, a real store host does) */
    page = await open({ fake: FAKE });
    ok(await shown(page), 'with the suggestion and copy available the dialog still shows');
    let seen = await page.evaluate(() => ({ calls: window.__calls, country: document.querySelector('select[name="country_code"]').value, language: document.querySelector('select[name="language_code"]').value, labelHidden: document.querySelector('[data-consent-language]').hidden, disabled: document.querySelector('select[name="language_code"]').disabled, options: [...document.querySelector('select[name="language_code"]').options].map((o) => o.value), title: document.getElementById('consent-title').textContent, accept: document.querySelector('[data-consent="accept"]').textContent.trim(), lang: document.querySelector('dialog.consent').lang, label: document.querySelector('[data-consent-language]').textContent.replace(/\s+/g, ' ').trim() }));
    ok(seen.calls[0] === 'suggestion' && seen.country === 'SE', `the country is preselected from Shopify's suggestion (${seen.country}, ${JSON.stringify(seen.calls)})`);
    ok(!seen.labelHidden && !seen.disabled && JSON.stringify(seen.options) === JSON.stringify(['sv', 'en']) && /Language/.test(seen.label), `a country with two languages lists a secondary select labeled Language (${JSON.stringify(seen.options)}, "${seen.label.slice(0, 30)}")`);
    ok(seen.language === 'en', `with no language suggested the browser's language is preselected (${seen.language})`);
    ok(seen.title === 'Cookie consent' && seen.accept === 'Accept', `the title is Shopify's cookie copy and the short Accept button is the theme's (${seen.title} / ${seen.accept})`);
    ok(await page.evaluate(() => !document.querySelector('.consent__region details, .consent__region summary') && [...document.querySelectorAll('.consent__region label')].every((l) => l.hidden || l.getBoundingClientRect().height > 0)), 'the country and language selects are always visible, with no expandable row or heading');
    /* the visitor picks Swedish: the dialog speaks it, and the card does not move: its title stays where it was (a layout shift otherwise) */
    const place = () => page.evaluate(() => { const rect = (q) => Math.round(document.querySelector(q).getBoundingClientRect().top * 10) / 10; return { title: rect('#consent-title'), card: rect('dialog.consent') }; });
    const before = await place();
    /* sample the paragraph and the card every frame while the language changes: each may change height at most once (no flash of a shorter paragraph) */
    await page.evaluate(() => { window.__heights = new Set(); const body = document.querySelector('.consent__body'); const card = document.querySelector('dialog.consent'); const tick = () => { window.__heights.add(`${Math.round(body.getBoundingClientRect().height)}/${Math.round(card.getBoundingClientRect().height)}`); window.__raf = requestAnimationFrame(tick); }; tick(); });
    await page.select('select[name="language_code"]', 'sv');
    await wait(500);
    const sampled = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return [...window.__heights]; });
    ok(sampled.length <= 2, `the paragraph and the card settle in one step when the language changes, with no shorter state in between (${JSON.stringify(sampled)})`);
    const after = await place();
    ok(before.title === after.title && before.card === after.card, `switching language does not move the card or its title (${JSON.stringify(before)} then ${JSON.stringify(after)})`);
    /* the real Swedish and French words can be longer than these: whatever the height of the content, the top of the card stays put */
    const grown = await page.evaluate(() => { const filler = document.createElement('p'); filler.style.height = '90px'; filler.className = 'filler'; document.querySelector('.consent__body').append(filler); const rect = (q) => Math.round(document.querySelector(q).getBoundingClientRect().top * 10) / 10; const out = { title: rect('#consent-title'), card: rect('dialog.consent') }; filler.remove(); return out; });
    ok(grown.title === after.title && grown.card === after.card, `a taller card grows downwards: its top and title stay put (${JSON.stringify(after)} then ${JSON.stringify(grown)})`);
    seen = await page.evaluate(() => ({ title: document.getElementById('consent-title').textContent, accept: document.querySelector('[data-consent="accept"]').textContent.trim(), lang: document.querySelector('dialog.consent').lang, calls: window.__calls }));
    ok(seen.title === 'Cookie-samtycke' && seen.accept === 'Godkänn' && seen.lang === 'sv', `picking Swedish makes the dialog speak Swedish (${seen.title} / ${seen.accept} / ${seen.lang}, ${JSON.stringify(seen.calls.slice(-1))})`);
    /* the labels, the Preferences row and the text are in the chosen language too, not a mix; going back restores the page's */
    const sv = JSON.parse(readFileSync(new URL('../assets/consent-strings-sv.json', import.meta.url), 'utf8'));
    seen = await page.evaluate(() => ({ country: document.querySelector('[data-copy="country"]').textContent, language: document.querySelector('[data-copy="language"]').textContent, prefs: document.querySelector('.consent__more summary span').textContent, dir: document.querySelector('dialog.consent').dir }));
    ok(seen.country === sv.country && seen.language === sv.language && seen.prefs === sv.customize && seen.dir === 'ltr', `in Swedish the labels and the Preferences row are Swedish too (${JSON.stringify(seen)})`);
    await page.evaluate(() => { window.__titleChanges = 0; new MutationObserver((list) => { window.__titleChanges += list.length; }).observe(document.getElementById('consent-title'), { childList: true, characterData: true, subtree: true }); });
    await page.select('select[name="language_code"]', 'en');
    await wait(500);
    ok((await page.evaluate(() => window.__titleChanges)) === 1, 'switching language changes the title once (no flash of the theme words before Shopify\'s)');
    seen = await page.evaluate(() => ({ country: document.querySelector('[data-copy="country"]').textContent, prefs: document.querySelector('.consent__more summary span').textContent }));
    ok(seen.country === 'Country/region' && seen.prefs === 'Preferences', `back in English the labels are English again (${JSON.stringify(seen)})`);
    /* a country with one language hides the select and posts no language */
    await page.select('select[name="country_code"]', 'US');
    seen = await page.evaluate(() => ({ hidden: document.querySelector('[data-consent-language]').hidden, disabled: document.querySelector('select[name="language_code"]').disabled  }));
    ok(seen.hidden && seen.disabled, 'a country with one language hides the language select (and it is not posted)');
    await page.select('select[name="country_code"]', 'CA');
    seen = await page.evaluate(() => [...document.querySelector('select[name="language_code"]').options].map((o) => o.value));
    ok(JSON.stringify(seen) === JSON.stringify(['en', 'fr']), `Canada lists English and French (${JSON.stringify(seen)})`);
    /* Swedish in Sweden, then Accept all posts both */
    await page.select('select[name="country_code"]', 'SE');
    await page.select('select[name="language_code"]', 'sv');
    posted = [];
    page.on('request', (request) => { if (request.method() === 'POST' && request.url().includes('/localization')) posted.push(request.postData()); });
    await Promise.all([page.waitForRequest((request) => request.method() === 'POST' && request.url().includes('/localization'), { timeout: 8000 }).catch(() => null), page.click('[data-consent="accept"]')]);
    ok(posted.length === 1 && /name="country_code"\r\n\r\nSE\r/.test(posted[0] ?? '') && /name="language_code"\r\n\r\nsv\r/.test(posted[0] ?? ''), 'Accept all posts the chosen country and language together with the consent');
    await page.close();
    await restoreCountry(originalCountry);
    /* a suggested language is preselected over the browser's */
    page = await open({ fake: { ...FAKE, suggestion: { detected_values: { country: { handle: 'SE' } }, suggestions: [{ parts: { country: { handle: 'SE' }, language: { handle: 'SV' } } }] } } });
    await shown(page);
    seen = await page.evaluate(() => ({ language: document.querySelector('select[name="language_code"]').value, title: document.getElementById('consent-title').textContent, calls: window.__calls }));
    ok(seen.language === 'sv' && seen.title === 'Cookie-samtycke', `a language Shopify suggests is preselected and its copy shown (${seen.language}, ${seen.title}, ${JSON.stringify(seen.calls)})`);
    await page.close();
    /* nothing from Shopify: the theme's own words and the page's market */
    page = await open({ fake: { suggestion: null, storefront: false, countries: [], copy: {} } });
    await shown(page);
    seen = await page.evaluate(() => ({ title: document.getElementById('consent-title').textContent, country: document.querySelector('select[name="country_code"]').value, labelHidden: document.querySelector('[data-consent-language]').hidden }));
    ok(seen.title === 'Cookies' && seen.country === 'US' && seen.labelHidden, `with no suggestion and no copy it falls back to the theme's text and the page's market (${JSON.stringify(seen)})`);
    await page.close();
    ok(await (async () => { page = await open(); await shown(page); const calls = await page.evaluate(() => window.__calls ?? []); await page.close(); return calls.length === 0; })(), 'on the dev server (no live opt-in) no Shopify call is made');

    /* 9. the review URL: ?consent_preview shows the dialog with no API at all, and an answer records nothing */
    page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    const logs = [];
    page.on('console', (message) => logs.push(message.text()));
    await page.goto(`${base}/?consent_preview=1`, { waitUntil: 'load', timeout: 60000 });
    ok(await shown(page), '?consent_preview shows the dialog on a page with no consent API');
    await page.click('[data-consent="reject"]');
    ok(logs.some((line) => line.includes('nothing is recorded')) && await page.evaluate(() => !window.Shopify?.customerPrivacy), 'in the preview an answer is only logged and the real API is never touched');
    ok(await page.evaluate(() => !document.querySelector('dialog.consent').open), 'and closes the dialog');
    await page.close();
    page = await open({ stub: false });
    await wait(3500);
    /* no stub, no preview: the real Customer Privacy API decides. The dev store now has Sweden as a consent region, so it may well ask. */
    const live = await page.evaluate(() => {
      const api = window.Shopify?.customerPrivacy;
      const answered = api ? ['analytics', 'marketing', 'preferences'].some((key) => ['yes', 'no'].includes(api.currentVisitorConsent()[key])) : true;
      return { api: !!api, ask: !!api?.shouldShowBanner?.() && !answered, open: !!document.querySelector('dialog.consent')?.open };
    });
    ok(live.open === live.ask, `without ?consent_preview the dialog shows by itself exactly when Shopify's real API says to ask (API ${live.api}, ask ${live.ask}, open ${live.open})`);
    await page.close();

    /* 9a. when what Shopify detected is the market the page already is, there is nothing to check */
    page = await open({ fake: { ...FAKE, suggestion: { detected_values: { country: { handle: 'US' } }, suggestions: [{ parts: { country: { handle: 'US' }, language: { handle: 'EN' } } }] } } });
    ok(await shown(page), 'with a suggestion that matches the market the dialog shows');
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-consent-region]')).display === 'none'), 'the detected country and language are the current market: the country and language are not shown');
    ok(await page.evaluate(() => { const card = document.querySelector('.consent').getBoundingClientRect(); const title = document.querySelector('.consent__head').getBoundingClientRect(); const pad = parseFloat(getComputedStyle(document.querySelector('.consent__panel')).paddingTop); return Math.abs(title.top - card.top - 1 - pad) <= 1 && ![...document.querySelectorAll('.consent *')].some((el) => el.offsetParent && getComputedStyle(el).borderBlockEndWidth === '1px' && el.closest('.consent__panel') && el.matches('.consent__region')); }), 'and with them goes the rule: the title starts at the card\'s padding');
    await page.close();
    page = await open({ fake: FAKE });
    await shown(page);
    ok(await page.evaluate(() => getComputedStyle(document.querySelector('[data-consent-region]')).display !== 'none'), 'when the detection differs from the market they are shown');
    await page.close();

    /* 9b. the page the dialog links to stays readable */
    page = await open();
    ok(await shown(page), 'a normal page asks');
    await page.goto(`${base}/policies/privacy-policy`, { waitUntil: 'load', timeout: 60000 });
    await wait(3500);
    ok(await page.evaluate(() => !document.querySelector('dialog.consent').open && 'consentReady' in document.documentElement.dataset), 'on a policy page the dialog does not open, so the policy can be read');
    await page.close();

    /* 10. no API at all */
    page = await open({ stub: false });
    await wait(3500);
    const real = await page.evaluate(() => !!window.Shopify?.customerPrivacy);
    if (!real) ok(await page.evaluate(() => !document.querySelector('dialog.consent').open && getComputedStyle(document.querySelector('.consent-open')).display === 'none'), 'without the API nothing shows (no dialog, no footer button)');
    await page.close();
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed${on ? '' : ' (setting off)'}.`);
process.exit(failures ? 1 : 0);
