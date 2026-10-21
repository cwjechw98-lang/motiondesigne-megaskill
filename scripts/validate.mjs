import * as fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { bundleFiles, defaultSourceRoot, noSymlinkAncestors } from './install.mjs';

const secretName = /^(?:\.env(?:\..*)?|\.npmrc|\.pypirc|credentials(?:\..*)?|secrets?(?:\..*)?|id_(?:rsa|ed25519|ecdsa)(?:\.pub)?|.*\.(?:pem|p12|pfx|key))$/i;
const machinePath = /(?:\b[A-Za-z]:[\\/]|\/(?:Users|home)\/[^\s/]+\/|file:\/\/\/|\\\\[A-Za-z0-9_.-]+\\[A-Za-z0-9_$.-]+)/;
const privateKey = /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/;

function safeRelative(value) {
  return typeof value === 'string' && value.length > 0 && !value.includes('\\') && !value.includes('\0') && !value.includes(':') && !value.startsWith('/') && value.split('/').every(part => part !== '..' && part !== '.' && part !== '');
}

export async function validate({ sourceRoot = defaultSourceRoot } = {}) {
  sourceRoot = path.resolve(sourceRoot);
  const errors = [];
  const fail = message => errors.push(message);
  let files;
  try { files = await bundleFiles(sourceRoot); }
  catch (error) { return [error.message]; }
  // Scan names throughout the release checkout, excluding VCS internals. Never read secret files.
  async function scanNames(relative = '') {
    for (const entry of await fs.readdir(path.join(sourceRoot, relative), { withFileTypes: true })) {
      if (entry.name === '.git') continue;
      const name = path.join(relative, entry.name);
      if (secretName.test(entry.name)) { fail(`Secret file forbidden: ${name}`); continue; }
      if (entry.isSymbolicLink()) fail(`Symlink forbidden: ${name}`);
      else if (entry.isDirectory()) await scanNames(name);
    }
  }
  await scanNames();
  async function localFile(relative, label) {
    if (!safeRelative(relative)) { fail(`${label}: unsafe local path`); return false; }
    try {
      const absolute = path.join(sourceRoot, relative);
      await noSymlinkAncestors(absolute);
      if (!(await fs.lstat(absolute)).isFile()) throw new Error('not file');
      return true;
    } catch { fail(`${label}: missing or unsafe file ${relative}`); return false; }
  }
  let catalog;
  try { catalog = JSON.parse(await fs.readFile(path.join(sourceRoot, 'catalog.json'), 'utf8')); }
  catch { fail('catalog.json: missing or invalid JSON'); }
  if (catalog) {
    if (!Array.isArray(catalog.styles)) fail('catalog.json: styles must be an array');
    if (!Array.isArray(catalog.depths)) fail('catalog.json: depths must be an array');
    const ids = new Set();
    for (const [index, style] of (Array.isArray(catalog.styles) ? catalog.styles : []).entries()) {
      const label = `styles[${index}]`;
      if (!style || typeof style !== 'object' || Array.isArray(style)) { fail(`${label}: object required`); continue; }
      for (const key of ['id', 'name', 'description', 'image', 'collection', 'previewKind']) {
        if (typeof style[key] !== 'string' || !style[key].trim()) fail(`${label}: ${key} must be a nonempty string`);
      }
      if (ids.has(style.id)) fail(`${label}: duplicate id`);
      ids.add(style.id);
      if (!Array.isArray(style.sources)) fail(`${label}: sources must be an array`);
      if (!safeRelative(style.image) || !style.image.startsWith('assets/presets/')) fail(`${label}: image must be a safe local assets/presets path`);
      else await localFile(style.image, `${label} image`);
    }
    try {
      // Data only: accept a single assignment containing JSON, never evaluate JavaScript.
      const js = await fs.readFile(path.join(sourceRoot, 'catalog.js'), 'utf8');
      const match = js.match(/^\s*(?:\/\/[^\n]*\n\s*)*window\.MOTION_LIBRARY\s*=\s*([\s\S]*?)\s*;?\s*$/);
      if (!match || !isDeepStrictEqual(JSON.parse(match[1]), catalog)) fail('catalog.js: window.MOTION_LIBRARY does not equal catalog.json');
    } catch { fail('catalog.js: missing or not a single JSON assignment matching catalog.json'); }
  }
  for (const { relative, directory } of files) {
    if (directory || secretName.test(path.basename(relative))) continue;
    if (!/\.(?:md|json|js|mjs|html|css|txt|svg)$/.test(relative)) continue;
    const content = await fs.readFile(path.join(sourceRoot, relative), 'utf8');
    if (machinePath.test(content)) fail(`Machine-specific path forbidden: ${relative}`);
    if (privateKey.test(content)) fail(`Private key material forbidden: ${relative}`);
    if (relative === 'SKILL.md') {
      const frontmatter = content.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
      if (!frontmatter || !/^name:\s*\S.+$/m.test(frontmatter[1]) || !/^description:\s*\S.+$/m.test(frontmatter[1])) fail('SKILL.md: basic frontmatter requires name and description');
    }
    if (relative.endsWith('.md')) {
      // ponytail: validate ordinary inline/reference Markdown destinations, not a full Markdown parser.
      const destinations = [...content.matchAll(/\]\(\s*(<[^>]+>|[^\s)]+)(?:\s+[^)]*)?\)/g)].map(match => match[1]);
      destinations.push(...[...content.matchAll(/^\s*\[[^\]]+\]:\s*(<[^>]+>|\S+)/gm)].map(match => match[1]));
      for (let destination of destinations) {
        destination = destination.replace(/^<|>$/g, '');
        if (/^(?:https?:|mailto:)/i.test(destination) || destination.startsWith('#')) continue;
        try { destination = decodeURIComponent(destination.split(/[?#]/)[0]); }
        catch { fail(`${relative}: invalid link encoding`); continue; }
        if (!destination || destination.includes('\\') || destination.includes(':') || destination.startsWith('/')) { fail(`${relative}: unsafe relative link`); continue; }
        const resolved = path.relative(sourceRoot, path.resolve(sourceRoot, path.dirname(relative), destination)).split(path.sep).join('/');
        await localFile(resolved, `${relative} link`);
      }
    }
  }
  return errors;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  validate().then(errors => {
    if (errors.length) { for (const error of errors) console.error(error); process.exitCode = 1; }
    else console.log('Validation passed.');
  }).catch(() => { console.error('Validation failed: unable to inspect local release files.'); process.exitCode = 1; });
}
