import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Read a built file from _site/<path>. */
export function loadSite(path) {
  return readFileSync(resolve(root, '_site', path), 'utf8');
}

/** Count regex matches in html (forces global flag). */
export function count(html, re) {
  const flags = re.flags.includes('g') ? re.flags : re.flags + 'g';
  return (html.match(new RegExp(re.source, flags)) || []).length;
}
