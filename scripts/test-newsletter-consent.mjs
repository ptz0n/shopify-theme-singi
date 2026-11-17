#!/usr/bin/env node
/**
 * Tests the newsletter consent note, checkbox and confirmation message (decision 029) in headless Chrome. The settings
 * are on the dev theme (never the MAIN theme). Two modes:
 *
 *   note only (default):
 *     npm run theme:set -- 'newsletter_note=By subscribing you agree to receive marketing emails. Read our <a href="/policies/privacy-policy">privacy policy</a>.' newsletter_checkbox=false 'newsletter_confirmation=Check your email to confirm.' --theme <singi-dev id> --apply
 *     npm run test:newsletter-consent
 *   checkbox:
 *     npm run theme:set -- newsletter_checkbox=true --theme <singi-dev id> --apply
 *     SINGI_CHECKBOX=1 npm run test:newsletter-consent
 *
 *  - note mode: a paragraph under the form (footer and, on the mock blocks page, the block) holding the merchant's
 *    link, described by the email input, small and muted, no checkbox, the form can be sent with a valid email;
 *  - checkbox mode: an unticked required checkbox whose label is the note, a row of at least 44px, the form is invalid
 *    and the browser stops the send until it is ticked, then valid; no separate paragraph;
 *  - both: the confirmation message replaces the standard one after a signup (checked on the page Shopify returns
 *    to, ?customer_posted=true, without posting anything); a phone and right to left do not scroll sideways.
 *
 * Env and setup as for npm run test:media.
 */
import { signed } from './lib/crawl-sign.mjs';
const base = (process.env.SINGI_URL || 'http://127.0.0.1:9292').replace(/\/$/, '');
const checkboxMode = process.env.SINGI_CHECKBOX === '1';
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
  args: ['--disable-web-security'],
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
const read = () => [...document.querySelectorAll('.newsletter')].map((n) => {
  const input = n.querySelector('input[type=email]');
  const note = n.querySelector('.newsletter__note');
  const consent = n.querySelector('.newsletter__consent');
  const box = consent?.querySelector('input[type=checkbox]');
  const form = n.querySelector('form');
  const described = (input.getAttribute('aria-describedby') || '').split(' ').filter(Boolean).map((id) => document.getElementById(id)?.textContent.trim());
  return {
    note: note?.textContent.trim() ?? null,
    noteLink: note?.querySelector('a')?.getAttribute('href') ?? consent?.querySelector('a')?.getAttribute('href') ?? null,
    noteSize: note ? parseFloat(getComputedStyle(note).fontSize) : null,
    described,
    consent: consent ? { text: consent.textContent.trim(), height: Math.round(consent.getBoundingClientRect().height), checked: box.checked, required: box.required, labelFor: consent.getAttribute('for') === box.id } : null,
    validBefore: (input.value = 'someone@example.com', form.checkValidity()),
    boxInvalid: box ? box.matches(':invalid') : null,
    status: n.querySelector('[role=status]')?.textContent.trim() ?? null,
    id: input.id,
  };
});

try {
  for (const [label, width, dir, url] of [['desktop', 1200, 'ltr', '/'], ['phone', 360, 'ltr', '/'], ['phone rtl', 360, 'rtl', '/'], ['blocks page', 1200, 'ltr', '/pages/mock-blocks']]) {
    const page = await browser.newPage();
    await page.setViewport({ width, height: 800, isMobile: width < 600, hasTouch: width < 600 });
    await page.goto(`${base}${url}`, { waitUntil: 'load', timeout: 60000 });
    await page.evaluate((d) => { document.documentElement.dir = d; }, dir);
    const forms = await page.evaluate(read);
    ok(forms.length >= 1, `${label}: ${forms.length} signup form(s)`);
    for (const [i, f] of forms.entries()) {
      const tag = `${label} form ${i + 1}`;
      if (!checkboxMode) {
        ok(f.note && /marketing emails/.test(f.note) && f.noteLink === '/policies/privacy-policy', `${tag}: the note and its link are shown (${f.note?.slice(0, 40)} ${f.noteLink}) - is the consent note set for the dev theme?`);
        ok(f.described.some((d) => d === f.note), `${tag}: the note describes the email input`);
        ok(f.noteSize <= 13.5, `${tag}: the note is small (${f.noteSize}px)`);
        ok(!f.consent, `${tag}: no checkbox in note mode`);
        ok(f.validBefore, `${tag}: a valid email can be sent`);
      } else {
        ok(f.consent && f.consent.required && !f.consent.checked && f.consent.labelFor, `${tag}: an unticked required checkbox labelled by the note (${JSON.stringify(f.consent)})`);
        ok(f.consent && /marketing emails/.test(f.consent.text) && f.noteLink === '/policies/privacy-policy', `${tag}: its label is the note with the link`);
        ok(f.consent && f.consent.height >= 44, `${tag}: the checkbox row is ${f.consent?.height}px tall`);
        ok(f.validBefore === false && f.boxInvalid === true, `${tag}: the form is not sendable until the box is ticked (valid ${f.validBefore}, box invalid ${f.boxInvalid})`);
        ok(f.note === null, `${tag}: no separate note paragraph`);
      }
    }
    if (checkboxMode && width > 600 && dir === 'ltr' && url === '/') {
      await page.click('.newsletter__consent input');
      ok(await page.evaluate(() => { const f = document.querySelector('.newsletter form'); f.querySelector('input[type=email]').value = 'someone@example.com'; return f.checkValidity(); }), `${label}: once ticked, the form is valid`);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    ok(overflow <= 0, `${label}: sideways overflow ${overflow}`);
    console.log(`  ${label}: ${forms.length} form(s)`);
    await page.close();
  }

  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800 });
    await page.goto(`${base}/?customer_posted=true`, { waitUntil: 'load', timeout: 60000 });
    const status = await page.evaluate(() => document.querySelector('.newsletter [role=status]')?.textContent.trim() ?? null);
    ok(status === 'Check your email to confirm.', `the confirmation message replaces the standard one (${status})`);
    await page.close();
    console.log('  confirmation message');
  }
} finally {
  await browser.close();
}
console.log(failures ? `\n${failures} of ${checks} checks failed.` : `\nAll ${checks} checks passed (${checkboxMode ? 'checkbox' : 'note'} mode).`);
process.exit(failures ? 1 : 0);
