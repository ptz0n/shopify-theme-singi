/** The id of the unpublished development theme "singi-dev" (override with SINGI_DEV_THEME=<id>); refuses a MAIN theme. */
import { admin } from './admin.mjs';

export const devThemeId = async () => {
  if (process.env.SINGI_DEV_THEME) return process.env.SINGI_DEV_THEME;
  const { themes } = await admin('{ themes(first: 50) { nodes { id name role } } }');
  const theme = themes.nodes.find((t) => t.name === 'singi-dev');
  if (!theme) throw new Error('No theme named singi-dev. Create it with npm run dev:setup, or set SINGI_DEV_THEME=<id>.');
  if (theme.role === 'MAIN') throw new Error('singi-dev is the live theme: refusing to change its settings.');
  return theme.id.split('/').pop();
};
