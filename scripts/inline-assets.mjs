import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve('dist');
const htmlPath = resolve(root, 'index.html');
let html = await readFile(htmlPath, 'utf8');

const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);

if (scriptMatch) {
  const script = await readFile(resolve(root, scriptMatch[1].replace(/^\//, '')), 'utf8');
  html = html.replace(scriptMatch[0], `<script type="module">${script}</script>`);
}
if (styleMatch) {
  const style = await readFile(resolve(root, styleMatch[1].replace(/^\//, '')), 'utf8');
  html = html.replace(styleMatch[0], `<style>${style}</style>`);
}

await writeFile(htmlPath, html);
