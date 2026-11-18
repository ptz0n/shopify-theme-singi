#!/usr/bin/env node
/**
 * Maintains the product badges on the dev store with the custom app token from `.env`
 * (docs/decisions/045-badges-are-a-metaobject-mapped-from-tags.md). Needs the scopes
 * read/write_metaobject_definitions and read/write_metaobjects.
 *
 *   npm run badges -- define [--apply]      create the metaobject definition badge
 *   npm run badges -- list                  show the entries
 *   npm run badges -- check                 report entries with missing fields or odd values (exit 1 on an error)
 *   npm run badges -- mock --apply          create the mock entries and tag the mock products the tests use (see scripts/mock-data.mjs)
 *   npm run badges -- clear --apply         delete every entry
 *
 * The merchant creates real entries in the admin (Content > Metaobjects > Badge) and tags products badge-<handle>.
 */
import { domain } from "./lib/admin.mjs";
import { checkEntries, defineDefinition, deleteEntry, listEntries, tagProduct, upsertEntry } from "./lib/badges.mjs";
import { BADGES, PRODUCTS } from "./mock-data.mjs";

const [command, ...rest] = process.argv.slice(2);
const apply = rest.includes("--apply");

try {
  if (command === "define") {
    console.log(
      `${apply ? "Defining" : "Plan for"} badge on ${domain}${apply ? "" : " (add --apply to create)"}: ${await defineDefinition({ apply })}`,
    );
  } else if (command === "list") {
    const entries = await listEntries();
    console.log(`${entries.length} entries on ${domain}:`);
    for (const e of entries)
      console.log(
        `  ${e.handle.padEnd(16)} ${(e.label ?? "(no label)").padEnd(14)} ${(e.color ?? "(no color)").padEnd(8)} on ${(e.show_on || "both").padEnd(8)} priority ${e.priority || 100}`,
      );
  } else if (command === "check") {
    const findings = checkEntries(await listEntries());
    for (const f of findings) console.log(`  ${f.level.padEnd(5)} ${f.handle}: ${f.message}`);
    const errors = findings.filter((f) => f.level === "error").length;
    console.log(errors ? `\n${errors} error(s).` : "\nNo errors.");
    process.exit(errors ? 1 : 0);
  } else if (command === "mock") {
    console.log(
      `${apply ? "Creating or updating" : "Plan for"} ${BADGES.length} mock badges on ${domain}${apply ? "" : " (add --apply to write)"}:`,
    );
    for (const b of BADGES) {
      console.log(`  ${b.handle.padEnd(16)} ${b.label.padEnd(14)} ${b.color} on ${b.showOn ?? "both"} priority ${b.priority ?? 100}`);
      if (apply) await upsertEntry(b);
    }
    for (const p of PRODUCTS.filter((x) => x.tags?.length)) {
      console.log(`  tags       ${p.handle.padEnd(26)} ${p.tags.join(", ")}`);
      if (apply && !(await tagProduct(p.handle, p.tags))) console.log(`             (${p.handle} does not exist: run npm run mock first)`);
    }
  } else if (command === "clear") {
    const entries = await listEntries();
    console.log(`${apply ? "Deleting" : "Would delete"} ${entries.length} entries on ${domain}${apply ? "" : " (add --apply)"}.`);
    if (apply) for (const e of entries) await deleteEntry(e.id);
  } else {
    console.log("Usage: npm run badges -- <define|list|check|mock|clear> [--apply]\nSee the header of scripts/badges.mjs.");
    process.exit(command ? 2 : 0);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
