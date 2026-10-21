import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const BUNDLE = ['SKILL.md', 'README.md', 'README.en.md', 'LICENSE', 'NOTICE.md', 'SECURITY.md', 'CONTRIBUTING.md', 'catalog.json', 'catalog.js', 'gallery.html', 'gallery.css', 'gallery.js', 'references', 'docs', 'assets', 'scripts'];
export const defaultSourceRoot = fileURLToPath(new URL('../', import.meta.url));

async function stat(file) {
  try { return await fs.lstat(file); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

// Reject links at every existing component, including junctions on Windows.
export async function noSymlinkAncestors(file) {
  let current = path.resolve(file);
  for (;;) {
    if ((await stat(current))?.isSymbolicLink()) throw new Error(`Symlink refused: ${current}`);
    const parent = path.dirname(current);
    if (parent === current) break;
    current = parent;
  }
}

export async function bundleFiles(sourceRoot) {
  await noSymlinkAncestors(sourceRoot);
  if (!(await stat(sourceRoot))?.isDirectory()) throw new Error(`Source directory required: ${sourceRoot}`);
  const files = [];
  async function visit(relative) {
    const absolute = path.join(sourceRoot, relative);
    const entry = await stat(absolute);
    if (!entry) return;
    if (entry.isSymbolicLink()) throw new Error(`Symlink refused: ${absolute}`);
    if (entry.isDirectory()) {
      files.push({ relative, directory: true });
      for (const name of (await fs.readdir(absolute)).sort()) await visit(path.join(relative, name));
    } else if (entry.isFile()) files.push({ relative, directory: false });
    else throw new Error(`Unsupported file type: ${absolute}`);
  }
  for (const item of BUNDLE) await visit(item);
  if (!files.some(item => item.relative === 'SKILL.md' && !item.directory)) throw new Error(`Missing SKILL.md: ${sourceRoot}`);
  return files;
}

function contains(parent, child) {
  const relative = path.relative(parent, child);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

export async function install({ target, sourceRoot = defaultSourceRoot, replace = false, dryRun = false } = {}) {
  if (typeof target !== 'string' || !path.isAbsolute(target)) throw new Error('Target must be an explicit absolute skill directory');
  target = path.resolve(target);
  sourceRoot = path.resolve(sourceRoot);
  await noSymlinkAncestors(target);
  await noSymlinkAncestors(sourceRoot);
  // realpath also accounts for platform aliases/case at existing source components.
  sourceRoot = await fs.realpath(sourceRoot);
  let ancestor = target;
  const tail = [];
  while (!(await stat(ancestor))) { tail.unshift(path.basename(ancestor)); ancestor = path.dirname(ancestor); }
  target = path.join(await fs.realpath(ancestor), ...tail);
  if (contains(sourceRoot, target) || contains(target, sourceRoot)) throw new Error('Source and target overlap');
  const existing = await stat(target);
  if (existing && !replace) throw new Error(`Target exists: ${target}`);
  if (existing && !existing.isDirectory()) throw new Error(`Target must be a directory: ${target}`);
  const files = await bundleFiles(sourceRoot);
  if (dryRun) return { target, backup: null, dryRun: true };
  const parent = path.dirname(target);
  await fs.mkdir(parent, { recursive: true });
  const stage = await fs.mkdtemp(path.join(parent, '.' + path.basename(target) + '.stage-'));
  let backup = null;
  try {
    for (const { relative, directory } of files) {
      const from = path.join(sourceRoot, relative);
      const to = path.join(stage, relative);
      // Recheck before copy: never intentionally dereference a source link.
      const entry = await fs.lstat(from);
      if (entry.isSymbolicLink() || entry.isDirectory() !== directory) throw new Error(`Source changed: ${from}`);
      if (directory) await fs.mkdir(to, { recursive: true });
      else { await fs.mkdir(path.dirname(to), { recursive: true }); await fs.copyFile(from, to); }
    }
    await noSymlinkAncestors(target);
    if (existing) {
      backup = target + '.backup-' + new Date().toISOString().replace(/[:.]/g, '-') + '-' + randomUUID();
      await fs.rename(target, backup);
    } else if (await stat(target)) throw new Error(`Target exists: ${target}`);
    try { await fs.rename(stage, target); }
    catch (error) {
      if (backup && !(await stat(target))) {
        try { await fs.rename(backup, target); backup = null; }
        catch { throw new Error(`Replacement failed; existing data preserved at backup: ${backup}`); }
      }
      throw new Error(`Replacement failed: ${target}${backup ? `; backup: ${backup}` : ''}`, { cause: error });
    }
    return { target, backup, dryRun: false };
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--help') {
    console.log('Usage: node scripts/install.mjs --target <absolute-skill-directory> [--replace] [--dry-run]');
    console.log('Target is the full explicit directory where SKILL.md will live. Replacement preserves the existing directory in an adjacent backup. Dry-run writes nothing.');
    return;
  }
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--target' && !options.target && args[index + 1] && !args[index + 1].startsWith('--')) options.target = args[++index];
    else if (arg === '--replace' && !options.replace) options.replace = true;
    else if (arg === '--dry-run' && !options.dryRun) options.dryRun = true;
    else throw new Error('Usage: node scripts/install.mjs --target <absolute-skill-directory> [--replace] [--dry-run]');
  }
  const result = await install(options);
  console.log(`${result.dryRun ? 'Dry-run target' : 'Target'}: ${result.target}`);
  if (result.backup) console.log(`Backup: ${result.backup}`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
