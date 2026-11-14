/**
 * GA4 checkout funnel for Shopify Customer Events.
 *
 * The theme cannot track checkout: Shopify hosts it outside the theme. Paste
 * this file into Shopify admin > Settings > Customer events > Add custom pixel,
 * set GTM_ID, and under Customer privacy require the permissions your legal
 * team needs (typically Analytics and Marketing). Shopify only runs the pixel
 * when those permissions are granted.
 *
 * Events: begin_checkout, add_shipping_info, add_payment_info, purchase.
 * The theme (assets/tracking.js) sends everything before checkout, so there is
 * no double counting: the theme never sends begin_checkout or purchase.
 *
 * Item shape and item_id (the product ID) match the theme's items, so GA4
 * funnels line up across storefront and checkout.
 */
const GTM_ID = 'GTM-XXXXXXX';

window.dataLayer = window.dataLayer || [];

(function (w, d, s, l, i) {
  w[l].push({ 'gtm.start': Date.now(), event: 'gtm.js' });
  const f = d.getElementsByTagName(s)[0];
  const j = d.createElement(s);
  j.async = true;
  j.src = `https://www.googletagmanager.com/gtm.js?id=${i}`;
  f.parentNode.insertBefore(j, f);
})(window, document, 'script', 'dataLayer', GTM_ID);

const amount = (money) => Number(money?.amount ?? 0);

const toItems = (lineItems = []) =>
  lineItems.map((line, index) => {
    const variant = line.variant ?? {};
    const product = variant.product ?? {};
    const discount = (line.discountAllocations ?? []).reduce((sum, allocation) => sum + amount(allocation.amount), 0);
    return {
      item_id: String(product.id ?? ''),
      item_name: product.title ?? line.title,
      item_brand: product.vendor,
      item_category: product.type,
      item_variant: variant.title && variant.title !== 'Default Title' ? variant.title : undefined,
      price: amount(variant.price),
      discount: Number(discount.toFixed(2)),
      quantity: line.quantity,
      variant_id: String(variant.id ?? ''),
      sku: variant.sku,
      index: index + 1,
    };
  });

const coupon = (checkout) =>
  (checkout.discountApplications ?? [])
    .filter((discount) => discount.type === 'DISCOUNT_CODE')
    .map((discount) => discount.title)
    .join(',') || undefined;

const push = (event, checkout, extra = {}) => {
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({
    event,
    ecommerce: {
      currency: checkout.currencyCode,
      value: amount(checkout.subtotalPrice),
      coupon: coupon(checkout),
      items: toItems(checkout.lineItems),
      ...extra,
    },
  });
};

analytics.subscribe('checkout_started', (event) => push('begin_checkout', event.data.checkout));

analytics.subscribe('checkout_shipping_info_submitted', (event) => {
  const checkout = event.data.checkout;
  push('add_shipping_info', checkout, {
    shipping_tier: checkout.delivery?.selectedDeliveryOptions?.[0]?.title,
  });
});

analytics.subscribe('payment_info_submitted', (event) => {
  const checkout = event.data.checkout;
  push('add_payment_info', checkout, {
    payment_type: checkout.transactions?.[0]?.gateway,
  });
});

analytics.subscribe('checkout_completed', (event) => {
  const checkout = event.data.checkout;
  push('purchase', checkout, {
    transaction_id: checkout.order?.id ?? checkout.token,
    value: amount(checkout.totalPrice),
    tax: amount(checkout.totalTax),
    shipping: amount(checkout.shippingLine?.price),
  });
});
