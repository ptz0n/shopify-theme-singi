/* Logs in to a password-protected storefront before Lighthouse CI collects. Used when SINGI_PASSWORD is set. */
module.exports = async (browser, context) => {
  const origin = new URL(context.url).origin;
  const page = await browser.newPage();
  await page.goto(`${origin}/password`, { waitUntil: 'networkidle0' });
  await page.type('#password-input', process.env.SINGI_PASSWORD);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('form[action$="/password"] button[type="submit"]')]);
  await page.close();
};
