export const fetchDocument = async (url, { signal } = {}) => {
  const response = await fetch(url, { signal, headers: { 'X-Requested-With': 'fetch' } });
  if (!response.ok) throw new Error(String(response.status));
  return new DOMParser().parseFromString(await response.text(), 'text/html');
};

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

export const setCartCount = (count) => {
  for (const el of document.querySelectorAll('[data-cart-count]')) {
    el.dataset.count = count;
    el.textContent = count;
  }
};

export const cartChanged = (cart) => {
  setCartCount(cart.item_count);
  document.dispatchEvent(new CustomEvent('singi:cart', { detail: cart }));
};

export const restoreFocus = (root, id) => {
  if (id) root.querySelector(`#${CSS.escape(id)}`)?.focus({ preventScroll: true });
};
