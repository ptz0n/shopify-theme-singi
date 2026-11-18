/**
 * The strings of the cookie dialog, one small JSON file per language of the theme (assets/consent-strings-<code>.json, about 1 KB).
 * The dialog fetches the one it needs only when the visitor picks a language other than the page's, so the labels, the buttons and the
 * text all speak the chosen language, not a mix (decision 046). Liquid can only translate into the language of the
 * request, so this is generated from locales/*.json by `npm run docs`, and `npm run check` fails when it is stale.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
/** short name in the JSON -> key in the locale file */
const KEYS = {
  title: 'consent.title', body: 'consent.body', privacy: 'consent.privacy', accept: 'consent.accept', reject: 'consent.reject',
  customize: 'consent.customize', save: 'consent.save', essential: 'consent.essential', essential_note: 'consent.essential_note',
  analytics: 'consent.analytics', analytics_note: 'consent.analytics_note', marketing: 'consent.marketing', marketing_note: 'consent.marketing_note',
  preferences: 'consent.preferences', preferences_note: 'consent.preferences_note',
  country: 'localization.country', language: 'localization.language', close: 'general.close',
};
const get = (data, path) => path.split('.').reduce((value, part) => value?.[part], data);

/** { 'consent-strings-sv.json': '...', ... } */
export const build = () => {
  const out = {};
  for (const file of readdirSync(join(root, 'locales')).filter((f) => f.endsWith('.json') && !f.endsWith('.schema.json')).sort()) {
    const data = JSON.parse(readFileSync(join(root, 'locales', file), 'utf8'));
    const code = file === 'en.default.json' ? 'en' : file.replace('.json', '');
    out[`consent-strings-${code}.json`] = `${JSON.stringify(Object.fromEntries(Object.entries(KEYS).map(([name, path]) => [name, get(data, path)])))}\n`;
  }
  return out;
};
