/* The cookie dialog (snippets/consent-dialog.liquid, decision 046). Shopify's Customer Privacy API says who must be asked and records
   the answer; this draws the question, in Shopify's own banner copy, with the country and language Shopify suggests preselected.
   Consent is recorded after a click, never automatically. No imports on purpose: the import map is blocked as cross-origin on the dev server. */
const FEATURE = [{ name: 'consent-tracking-api', version: '1.0' }];

/* ?consent_preview on any page of a store that has the dialog on: show it to review it, with a stand-in API that records nothing
   (the answers go to the console). The real API is never touched. */
const preview = new URLSearchParams(location.search).has('consent_preview');
const stand_in = {
  shouldShowBanner: () => true,
  currentVisitorConsent: () => ({ analytics: '', marketing: '', preferences: '', sale_of_data: '' }),
  setTrackingConsent: (value, callback) => {
    console.info('[singi:consent preview] nothing is recorded:', value);
    callback();
  },
};
const api = () => (preview ? stand_in : window.Shopify?.customerPrivacy);
const withApi = (callback) => {
  if (api()) return callback();
  window.Shopify?.loadFeatures?.(FEATURE, (error) => {
    if (!error && api()) callback();
  });
};
const everything = (value) => ({ analytics: value, marketing: value, preferences: value, sale_of_data: value });

/* Not on the dev server (a loopback host): the Shopify CLI cannot carry the store password into Storefront API calls, answers them with a
   400 "Online Store channel is locked" and then drops its session (decision 046). A test opts back in with window.singiConsentLive. */
const live = () => !/^(127\.0\.0\.1|localhost)$/.test(location.hostname) || window.singiConsentLive;
/* The Storefront API says EN and PT_BR, the localization form wants en and pt-BR. */
const code = (value) => {
  const [first, ...rest] = String(value).split(/[_-]/);
  return [first.toLowerCase(), ...rest.map((part) => part.toUpperCase())].join('-');
};
const QUERY = `query consent($language: LanguageCode!, $country: CountryCode!) @inContext(language: $language, country: $country) {
  localization { availableCountries { isoCode name currency { isoCode } availableLanguages { isoCode endonymName } } }
  consentManagement { banner { title text policyLinkText
    preferences { buttonAcceptText buttonDeclineText buttonSaveText buttonCloseText
      purposes { essentialName essentialDesc performanceName performanceDesc preferencesName preferencesDesc marketingName marketingDesc } } } }
}`;
const storefront = async (language, country) => {
  try {
    const token = JSON.parse(document.getElementById('shopify-features')?.textContent ?? '{}').accessToken;
    if (!token) return null;
    const response = await fetch('/api/unstable/graphql.json', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-shopify-storefront-access-token': token },
      body: JSON.stringify({ query: QUERY, variables: { language: language.replace('-', '_').toUpperCase(), country: country.toUpperCase() } }),
      signal: AbortSignal.timeout(2500),
    });
    return response.ok ? (await response.json()).data : null;
  } catch {
    return null;
  }
};
/* What Shopify detects for this visitor (undocumented endpoint, so every part is optional). */
const suggestion = async () => {
  try {
    const response = await fetch('/browsing_context_suggestions.json?country[enabled]=true&language[enabled]=true', { signal: AbortSignal.timeout(2500) });
    if (!response.ok) return {};
    const data = await response.json();
    const parts = data.suggestions?.[0]?.parts ?? {};
    return { country: String(parts.country?.handle ?? data.detected_values?.country?.handle ?? '').toUpperCase(), language: parts.language?.handle ? code(parts.language.handle) : '' };
  } catch {
    return {};
  }
};

class ConsentDialog extends HTMLElement {
  connectedCallback() {
    this.dialog = this.querySelector('dialog');
    this.form = this.querySelector('form');
    this.closer = this.querySelector('[data-consent-close]');
    this.title = this.querySelector('#consent-title');
    this.reopened = false;
    this.dialog.addEventListener('click', (event) => {
      const button = event.target.closest('button[data-consent]');
      if (button && button.dataset.consent !== 'custom') this.choose(button.dataset.consent === 'accept' ? everything(true) : everything(false));
      if (event.target.closest('[data-consent-close]')) this.close();
    });
    this.form.addEventListener('submit', (event) => {
      event.preventDefault();
      const data = new FormData(this.form);
      this.choose({ analytics: data.has('analytics'), marketing: data.has('marketing'), preferences: data.has('preferences'), sale_of_data: data.has('marketing') });
    });
    /* The first ask needs an answer, so neither Escape (however often it is pressed) nor anything else dismisses it; a reopened dialog closes with Escape or the close button. */
    this.dialog.addEventListener('cancel', (event) => {
      if (!this.reopened) event.preventDefault();
    });
    /* Chrome closes a modal on a second Escape when the first one was cancelled and nothing was clicked in between, so the key itself is stopped too. */
    this.dialog.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && !this.reopened) event.preventDefault();
    });
    this.dialog.addEventListener('close', () => this.#reset());
    document.addEventListener('click', (event) => {
      if (event.target.closest('[data-consent-open]')) this.reopen();
    });
    this.region = this.querySelector('[data-consent-region]');
    this.localization = document.getElementById('consent-localization');
    this.country = this.region?.querySelector('select[name="country_code"]');
    this.language = this.region?.querySelector('select[name="language_code"]');
    this.languageLabel = this.region?.querySelector('[data-consent-language]');
    this.here = this.language ? [...this.language.options].map((option) => ({ code: code(option.value), name: option.textContent.trim() })) : [];
    if (this.country?.hasAttribute('data-lazy')) {
      const load = () => this.#loadCountries();
      this.country.addEventListener('pointerdown', load, { once: true });
      this.country.addEventListener('focus', load, { once: true });
    }
    this.country?.addEventListener('change', () => {
      this.#syncLanguage();
      this.#retranslate();
    });
    this.language?.addEventListener('change', () => this.#retranslate());
    const start = () => withApi(() => this.ready());
    if ('requestIdleCallback' in window) requestIdleCallback(start, { timeout: 2000 });
    else setTimeout(start, 500);
  }

  /* Ask only a visitor Shopify's region rules say must be asked and who has not answered yet, and never on a policy page (the dialog links there; the footer button still opens it). */
  ready() {
    document.documentElement.dataset.consentReady = '';
    const consent = api().currentVisitorConsent();
    const answered = ['analytics', 'marketing', 'preferences'].some((key) => consent[key] === 'yes' || consent[key] === 'no');
    if (/\/policies\//.test(location.pathname)) return;
    if (api().shouldShowBanner() && !answered) this.#ask();
  }

  /* On a real store host, first preselect from Shopify's suggestion and take its copy, but never hold the question back more than 3 seconds. */
  async #ask() {
    if (live()) await Promise.race([this.#enrich().catch(() => {}), new Promise((resolve) => setTimeout(resolve, 3000))]);
    this.present();
  }

  async #enrich() {
    const hint = await suggestion();
    const country = hint.country && this.country?.querySelector(`option[value="${hint.country}"]`) ? hint.country : this.country?.value || this.dataset.country;
    if (this.country) this.country.value = country;
    const data = await storefront(this.dataset.language, country);
    if (!data) return;
    this.languages = new Map(data.localization.availableCountries.map((entry) => [entry.isoCode, entry.availableLanguages.map((l) => ({ code: code(l.isoCode), name: l.endonymName }))]));
    this.#syncLanguage(hint.language);
    /* Nothing to check when what Shopify detected is the market the page already is: the country and language show only when they differ (or nothing was detected). */
    if (hint.country && country === this.dataset.country && this.#chosenLanguage() === code(this.dataset.language) && this.region) this.region.hidden = true;
    const language = this.#chosenLanguage();
    const [words, copy] = await Promise.all([this.#theme(language), language === code(this.dataset.language) ? data : storefront(language, country)]);
    this.#paint(language, words, copy);
  }

  #chosenLanguage() {
    return this.language && !this.language.disabled ? code(this.language.value) : code(this.dataset.language);
  }

  /* The language select is for the chosen country: it shows only when that country has more than one language, preselected from
     Shopify's suggestion, then the browser's languages, then what was chosen, then the page's language. */
  #syncLanguage(preferred) {
    if (!this.language) return;
    const country = this.country?.value || this.dataset.country;
    const list = this.languages?.get(country) ?? (country === this.dataset.country ? this.here : []);
    const show = list.length > 1;
    this.languageLabel.hidden = !show;
    this.language.disabled = !show;
    if (show) {
      const codes = list.map((entry) => entry.code);
      const browser = (navigator.languages ?? []).map(code).flatMap((value) => [value, value.split('-')[0]]);
      const pick = [preferred, ...browser, code(this.language.value), code(this.dataset.language)].find((value) => value && codes.includes(value)) ?? codes[0];
      this.language.replaceChildren(
        ...list.map((entry) => {
          const option = new Option(entry.name, entry.code, false, entry.code === pick);
          option.lang = entry.code;
          return option;
        }),
      );
      this.language.value = pick;
    }
  }

  /* The theme's own words (the labels, the text, and the buttons when Shopify's copy is not there) in the chosen language, by name, from one small file
     per language (assets/consent-strings-<code>.json): Liquid can only translate into the language of the request. The page's own language is what
     the page rendered, so those words are put back from there. */
  async #theme(language) {
    this.originals ??= new Map([...this.querySelectorAll('[data-copy]')].map((element) => [element, element.dataset.copy === 'close' ? element.getAttribute('aria-label') : element.textContent]));
    if (language === code(this.dataset.language)) return Object.fromEntries([...this.originals].map(([element, text]) => [element.dataset.copy, text]));
    for (const name of [language, language.split('-')[0]]) {
      const words = await fetch(this.dataset.strings.replace('-en.json', `-${name}.json`), { signal: AbortSignal.timeout(2500) }).then((r) => (r.ok ? r.json() : null), () => null);
      if (words) return { ...words, text: words.body, policy: words.privacy };
    }
    return {};
  }

  /* Puts the words on the dialog in one pass, so the title changes once: the theme's words in the chosen language, with Shopify's copy over them
     (translated by Shopify; the title, Save, Close and the cookie categories; the paragraph and the Accept and Decline buttons stay the theme's, short on purpose) and the country names
     in the chosen language. */
  #paint(language, words, data) {
    for (const entry of data?.localization?.availableCountries ?? []) {
      const option = entry.name && this.country?.querySelector(`option[value="${entry.isoCode}"]`);
      if (option) option.textContent = `${entry.name} (${entry.currency.isoCode})`;
    }
    const banner = data?.consentManagement?.banner;
    const copy = { ...words };
    if (banner?.preferences) {
      const { preferences: p, preferences: { purposes: u } } = banner;
      Object.assign(copy, {
        title: banner.title, policy: banner.policyLinkText,
        save: p.buttonSaveText, close: p.buttonCloseText,
        essential: u.essentialName, essential_note: u.essentialDesc, analytics: u.performanceName, analytics_note: u.performanceDesc,
        marketing: u.marketingName, marketing_note: u.marketingDesc, preferences: u.preferencesName, preferences_note: u.preferencesDesc,
      });
    }
    for (const element of this.querySelectorAll('[data-copy]')) {
      const text = copy[element.dataset.copy];
      if (!text) continue;
      if (element.dataset.copy === 'close') element.setAttribute('aria-label', text);
      else element.textContent = text;
    }
    this.dialog.lang = language;
    this.dialog.dir = ['ar', 'fa', 'he', 'ur'].includes(language.split('-')[0]) ? 'rtl' : 'ltr';
  }

  /* The visitor picked another country or language: the dialog speaks it. */
  async #retranslate() {
    const language = this.#chosenLanguage();
    const [data, words] = await Promise.all([live() ? storefront(language, this.country?.value || this.dataset.country) : null, this.#theme(language)]);
    this.#paint(language, words, data);
  }

  /* Modal: the page behind is inert and focus stays inside until the visitor answers. Focus starts on the title, so a screen reader reads the question. */
  present() {
    this.dialog.showModal();
    this.title.focus({ preventScroll: true });
  }

  reopen() {
    withApi(() => {
      const consent = api().currentVisitorConsent();
      for (const key of ['analytics', 'marketing', 'preferences']) this.form.elements[key].checked = consent[key] === 'yes';
      this.querySelector('.consent__more').open = true;
      if (this.region) this.region.hidden = true;
      this.reopened = true;
      this.closer.hidden = false;
      this.opener = document.activeElement;
      this.dialog.showModal();
      this.title.focus({ preventScroll: true });
    });
  }

  /* Accept all and Reject all confirm the region shown with them: when the visitor changed the country or language (or Shopify's suggestion
     preselected another one), the answer is recorded first and then the localization form is posted (Shopify sets the market and comes back here). */
  choose(value) {
    const country = this.country?.value;
    const language = this.language && !this.language.disabled ? code(this.language.value) : '';
    const changed = !this.reopened && !!this.localization && ((country && country !== this.dataset.country) || (language && language !== code(this.dataset.language)));
    let sent = false;
    const apply = () => {
      if (sent) return;
      sent = true;
      for (const input of this.localization.querySelectorAll('[name="return_to"]')) input.value = location.pathname + location.search;
      this.localization.requestSubmit();
    };
    api().setTrackingConsent(value, changed ? apply : () => {});
    if (changed) setTimeout(apply, 1500);
    else this.close();
  }

  /* More than 12 countries are not in the page: fill the select from the footer selector's list on first use. */
  async #loadCountries() {
    const url = document.querySelector('localization-selector')?.dataset.url;
    if (!url) return;
    try {
      const doc = new DOMParser().parseFromString(await (await fetch(url)).text(), 'text/html');
      const current = this.country.value;
      const options = [...doc.querySelectorAll('button[name="country_code"]')].map((button) => new Option(button.textContent.trim(), button.value, false, button.value === current));
      if (options.length) this.country.replaceChildren(...options);
    } catch {
      /* the current country stays the only option */
    }
  }

  close() {
    this.dialog.close();
    this.#reset();
  }

  /* After it closes (by an answer, Escape or the close button): focus goes back to the button that reopened it, or to the main content. */
  #reset() {
    this.reopened = false;
    this.closer.hidden = true;
    if (this.region) this.region.hidden = false;
    const back = this.opener?.isConnected ? this.opener : document.getElementById('main');
    this.opener = null;
    back?.focus({ preventScroll: true });
  }
}

customElements.define('consent-dialog', ConsentDialog);
