#!/usr/bin/env node
/**
 * Generic Admin GraphQL runner for the dev store, using the custom app token
 * from `.env`. Handy for agents and for one-off reads and changes.
 *
 *   npm run admin -- scopes
 *   npm run admin -- query '{ shop { name } }'
 *   npm run admin -- query 'mutation { ... }' --allow-mutations
 *   npm run admin -- file ./query.graphql --variables '{"id":"gid://..."}' --allow-mutations
 *
 * Mutations are refused unless --allow-mutations is passed. Only the stores in
 * SINGI_ALLOWED_STORES (default: SINGI_STORE) are accepted.
 */
import { readFileSync } from 'node:fs';
import { admin, domain } from './lib/admin.mjs';

const [command, ...rest] = process.argv.slice(2);
const flag = (name) => rest.includes(`--${name}`);
const option = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
};

const usage = () => {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0].replace(/^#!.*\n|^\/\*\*?\n?| \* ?/gm, ''));
  process.exit(command ? 1 : 0);
};

const SCOPES = '{ shop { name myshopifyDomain plan { displayName } } currentAppInstallation { app { title } accessScopes { handle } } }';

try {
  if (command === 'scopes') {
    const data = await admin(SCOPES);
    console.log(`${data.shop.name} (${data.shop.myshopifyDomain}), ${data.shop.plan.displayName}`);
    console.log(`App: ${data.currentAppInstallation.app.title}`);
    console.log(`Scopes: ${data.currentAppInstallation.accessScopes.map((s) => s.handle).join(', ')}`);
  } else if (command === 'query' || command === 'file') {
    const query = command === 'file' ? readFileSync(rest[0], 'utf8') : rest[0];
    if (!query) usage();
    if (/^\s*mutation\b/m.test(query) && !flag('allow-mutations')) {
      console.error('This is a mutation. Re-run with --allow-mutations to change the store.');
      process.exit(1);
    }
    const variables = option('variables') ? JSON.parse(option('variables')) : {};
    console.error(`# ${domain}`);
    console.log(JSON.stringify(await admin(query, variables), null, 2));
  } else {
    usage();
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
