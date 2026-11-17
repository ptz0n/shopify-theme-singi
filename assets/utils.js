/** Fetch a page and parse it into a document. Throws the status code as the message when the response is not ok.
 * @param {string} url
 * @param {{ signal?: AbortSignal }} [options]
 * @returns {Promise<Document>} */
export const fetchDocument = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal, headers: { 'X-Requested-With': 'fetch' } });
  if (!response.ok) throw new Error(String(response.status));
  return new DOMParser().parseFromString(await response.text(), 'text/html');
};

/** POST a JSON body and return the parsed JSON, throwing Shopify's error description on failure.
 * @param {string} url
 * @param {unknown} body
 * @returns {Promise<any>} */
export const postJSON = async (url, body) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data.description || data.message || String(response.status));
  return data;
};

/** Write the cart count into every cart badge.
 * @param {number} count */
export const setCartCount = (count) => {
  for (const el of /** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll('[data-cart-count]'))) {
    el.dataset.count = String(count);
    el.textContent = String(count);
  }
};

/** Update the badges and announce `singi:cart` with the cart as the detail.
 * @param {{ item_count: number }} cart */
export const cartChanged = (cart) => {
  setCartCount(cart.item_count);
  document.dispatchEvent(new CustomEvent('singi:cart', { detail: cart }));
};

/** Put focus back on the element with this id inside a swapped region, if it is still there.
 * @param {ParentNode} root
 * @param {string | null | undefined} id */
export const restoreFocus = (root, id) => {
  if (id) /** @type {HTMLElement | null} */ (root.querySelector(`#${CSS.escape(id)}`))?.focus({ preventScroll: true });
};
