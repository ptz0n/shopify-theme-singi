/*
  Quick add on product cards (snippets/product-card.liquid, decision 012). One delegated click handler:
  posts the card's only variant to the cart, then refreshes the cart count through the same helper the
  product page uses and lets tracking see the add. The strings and URLs come from #route-announcer.
*/
import { cartChanged } from '@singi/utils';

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-quick-add]');
  if (!button || button.getAttribute('aria-busy') === 'true') return;
  const announcer = document.getElementById('route-announcer');
  const text = announcer.dataset;
  const title = button.closest('li').querySelector('.product-card__title').textContent.trim();
  button.setAttribute('aria-busy', 'true');
  try {
    const response = await fetch(text.addUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ id: Number(button.dataset.quickAdd), quantity: 1 }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.description || data.message);
    cartChanged(await (await fetch(`${text.cartUrl}.js`)).json());
    document.dispatchEvent(new CustomEvent('singi:cart-add', { detail: { element: button, quantity: 1 } }));
    button.setAttribute('data-added', '');
    setTimeout(() => button.removeAttribute('data-added'), 2000);
    announcer.textContent = `${title}: ${text.added}`;
  } catch (error) {
    announcer.textContent = `${title}: ${error.message || text.error}`;
  } finally {
    button.removeAttribute('aria-busy');
  }
});
