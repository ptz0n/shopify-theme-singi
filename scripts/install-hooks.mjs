#!/usr/bin/env node
/**
 * Points git at the repo's own hooks (.githooks/), with no dependency: `npm run hooks`, and automatically on `npm install`
 * (the `prepare` script). Quiet and harmless where there is no git (a tarball): it only sets one local config value.
 * Undo it with `git config --unset core.hooksPath`. See docs/tooling.md#git-hooks.
 */
import { execFileSync } from 'node:child_process';
try {
  execFileSync('git', ['config', 'core.hooksPath', '.githooks'], { stdio: 'ignore' });
  if (process.argv.includes('--verbose')) console.log('git hooks: core.hooksPath = .githooks');
} catch {
  /* not a git checkout: nothing to do */
}
