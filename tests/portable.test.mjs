import test from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs/promises';
import mutableFs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { install } from '../scripts/install.mjs';
import { validate } from '../scripts/validate.mjs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

test('help prints usage without requiring a target', () => {
  const output = execFileSync(process.execPath, [fileURLToPath(new URL('../scripts/install.mjs', import.meta.url)), '--help'], { encoding: 'utf8' });
  assert.match(output, /--target/);
  assert.match(output, /--replace/);
  assert.match(output, /--dry-run/);
});

test('installed bundle retains documentation and relative reference links', async t => {
  const { source, target } = await fixture(t);
  await fs.mkdir(path.join(source, 'docs'));
  await fs.writeFile(path.join(source, 'docs/integration-contract.md'), '# Contract');
  await fs.writeFile(path.join(source, 'docs/INSTALLATION.md'), '# Installation');
  await fs.writeFile(path.join(source, 'docs/ARCHITECTURE.md'), '# Architecture');
  await fs.writeFile(path.join(source, 'SECURITY.md'), '# Security');
  await fs.writeFile(path.join(source, 'CONTRIBUTING.md'), '# Contributing');
  await fs.writeFile(path.join(source, 'README.md'), '[Install](docs/INSTALLATION.md) [Architecture](docs/ARCHITECTURE.md) [Security](SECURITY.md) [Contribute](CONTRIBUTING.md)');
  await fs.writeFile(path.join(source, 'references/guide.md'), '[Contract](../docs/integration-contract.md)');
  await install({ sourceRoot: source, target });
  assert.equal(await fs.readFile(path.join(target, 'docs/integration-contract.md'), 'utf8'), '# Contract');
  assert.deepEqual(await validate({ sourceRoot: target }), []);
});

test('validator accepts its own portable scripts without path-pattern false positives', async t => {
  const { source } = await fixture(t);
  await fs.copyFile(new URL('../scripts/validate.mjs', import.meta.url), path.join(source, 'scripts/validate.mjs'));
  await fs.copyFile(new URL('../scripts/install.mjs', import.meta.url), path.join(source, 'scripts/install.mjs'));
  assert.deepEqual(await validate({ sourceRoot: source }), []);
});

test('failed final rename restores whole previous target', async t => {
  const { source, target, base } = await fixture(t);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'keep'), 'safe');
  const before = await fs.readdir(base);
  const original = mutableFs.rename;
  t.mock.method(mutableFs, 'rename', async (from, to) => {
    if (path.basename(from).includes('.stage-')) throw new Error('Simulated final rename failure');
    return original(from, to);
  });
  await assert.rejects(install({ sourceRoot: source, target, replace: true }), /Replacement failed/);
  assert.equal(await fs.readFile(path.join(target, 'keep'), 'utf8'), 'safe');
  assert.deepEqual(await fs.readdir(base), before);
});

test('mid-copy failure preserves original target and removes staging', async t => {
  const { source, target, base } = await fixture(t);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'keep'), 'safe');
  const before = await fs.readdir(base);
  let copied = 0;
  const original = mutableFs.copyFile;
  t.mock.method(mutableFs, 'copyFile', async (...args) => {
    if (++copied === 2) throw new Error('Simulated copy failure');
    return original(...args);
  });
  await assert.rejects(install({ sourceRoot: source, target, replace: true }), /Simulated copy failure/);
  assert.equal(copied, 2);
  assert.equal(await fs.readFile(path.join(target, 'keep'), 'utf8'), 'safe');
  assert.deepEqual(await fs.readdir(base), before);
});

async function fixture(t) {
  // macOS exposes TMPDIR through /var -> /private/var. These fixtures test
  // ordinary physical directories; dedicated tests below still reject links.
  const base = await fs.mkdtemp(path.join(await fs.realpath(os.tmpdir()), 'motion-portable-'));
  t.after(() => fs.rm(base, { recursive: true, force: true }));
  const source = path.join(base, 'source');
  await fs.mkdir(path.join(source, 'assets/presets'), { recursive: true });
  await fs.mkdir(path.join(source, 'references'));
  await fs.mkdir(path.join(source, 'scripts'));
  await fs.writeFile(path.join(source, 'SKILL.md'), '---\nname: motion\ndescription: Local motion skill\n---\n# Motion\n[Guide](references/guide.md)\n');
  await fs.writeFile(path.join(source, 'references/guide.md'), '[Skill](../SKILL.md)');
  await fs.writeFile(path.join(source, 'assets/presets/a.svg'), '<svg/>');
  const catalog = { styles: [{ id: 'one', name: 'One', description: 'Style', image: 'assets/presets/a.svg', collection: 'core', previewKind: 'image', sources: [] }], depths: [] };
  await fs.writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
  await fs.writeFile(path.join(source, 'catalog.js'), 'window.MOTION_LIBRARY = ' + JSON.stringify(catalog) + ';\n');
  await fs.writeFile(path.join(source, 'scripts/tool.mjs'), '// local');
  await fs.writeFile(path.join(source, 'unlisted.txt'), 'not bundled');
  return { base, source, target: path.join(base, 'installed'), catalog };
}

test('ordinary fixture root is a physical path, not a system temp alias', async t => {
  const { base } = await fixture(t);
  assert.equal(base, await fs.realpath(base));
});

test('installs only allowlisted bundle; import has no CLI side effects', async t => {
  const { source, target } = await fixture(t);
  const result = await install({ sourceRoot: source, target });
  assert.equal(result.target, target);
  assert.equal(result.backup, null);
  assert.match(await fs.readFile(path.join(target, 'SKILL.md'), 'utf8'), /name: motion/);
  assert.equal(await fs.readFile(path.join(target, 'scripts/tool.mjs'), 'utf8'), '// local');
  await assert.rejects(fs.access(path.join(target, 'unlisted.txt')));
});

test('existing target always fails; replacement preserves whole prior directory', async t => {
  const { source, target } = await fixture(t);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'private-user-file'), 'prior data');
  await assert.rejects(install({ sourceRoot: source, target }), /exists/i);
  const { backup } = await install({ sourceRoot: source, target, replace: true });
  assert.equal(await fs.readFile(path.join(backup, 'private-user-file'), 'utf8'), 'prior data');
  await assert.rejects(fs.access(path.join(target, 'private-user-file')));
  assert.ok(backup.startsWith(target + '.backup-'));
});

test('dry-run writes nothing, including no staging or backup', async t => {
  const { base, source, target } = await fixture(t);
  const before = await fs.readdir(base);
  await install({ sourceRoot: source, target, dryRun: true });
  assert.deepEqual(await fs.readdir(base), before);
  await fs.mkdir(target);
  const again = await fs.readdir(base);
  await install({ sourceRoot: source, target, replace: true, dryRun: true });
  assert.deepEqual(await fs.readdir(base), again);
});

test('requires absolute explicit target; rejects all source overlaps', async t => {
  const { source, base } = await fixture(t);
  for (const target of [undefined, 'relative', source, path.join(source, 'nested'), base]) {
    await assert.rejects(install({ sourceRoot: source, target }), /target|overlap/i);
  }
});

test('refuses source symlinks before touching an existing target', async t => {
  const { source, target, base } = await fixture(t);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'keep'), 'safe');
  try { await fs.symlink(base, path.join(source, 'assets/escape'), 'junction'); }
  catch (error) { if (error.code === 'EPERM') return t.skip('OS denies symlink creation'); throw error; }
  await assert.rejects(install({ sourceRoot: source, target, replace: true }), /symlink/i);
  assert.equal(await fs.readFile(path.join(target, 'keep'), 'utf8'), 'safe');
});

test('refuses symlink target and symlink parent', async t => {
  const { source, base, target } = await fixture(t);
  const real = path.join(base, 'real');
  await fs.mkdir(real);
  try { await fs.symlink(real, target, 'junction'); }
  catch (error) { if (error.code === 'EPERM') return t.skip('OS denies symlink creation'); throw error; }
  await assert.rejects(install({ sourceRoot: source, target, replace: true }), /symlink/i);
  await assert.rejects(install({ sourceRoot: source, target: path.join(target, 'child') }), /symlink/i);
});

test('failed source validation preserves existing content without backup or staging', async t => {
  const { source, target, base } = await fixture(t);
  await fs.mkdir(target);
  await fs.writeFile(path.join(target, 'keep'), 'safe');
  await fs.unlink(path.join(source, 'SKILL.md'));
  const before = await fs.readdir(base);
  await assert.rejects(install({ sourceRoot: source, target, replace: true }));
  assert.deepEqual(await fs.readdir(base), before);
  assert.equal(await fs.readFile(path.join(target, 'keep'), 'utf8'), 'safe');
});

test('validates complete local fixture and does not execute catalog.js', async t => {
  const { source } = await fixture(t);
  assert.deepEqual(await validate({ sourceRoot: source }), []);
  await fs.appendFile(path.join(source, 'catalog.js'), 'throw new Error("must never execute");');
  assert.match((await validate({ sourceRoot: source })).join('\n'), /catalog.js/);
});

test('validator rejects duplicate IDs, unsafe/missing images and catalog mismatch', async t => {
  const { source, catalog } = await fixture(t);
  catalog.styles.push({ ...catalog.styles[0], image: '../escape.svg' });
  catalog.styles[0].image = 'assets/presets/missing.svg';
  await fs.writeFile(path.join(source, 'catalog.json'), JSON.stringify(catalog));
  const errors = (await validate({ sourceRoot: source })).join('\n');
  assert.match(errors, /duplicate/i);
  assert.match(errors, /image/i);
  assert.match(errors, /catalog.js/);
});

test('validator rejects bad frontmatter, broken references, secrets and host paths', async t => {
  const { source } = await fixture(t);
  await fs.writeFile(path.join(source, 'SKILL.md'), '# No frontmatter');
  await fs.writeFile(path.join(source, 'references/guide.md'), '[Missing](missing.md)\nC:\\Users\\Someone\\private');
  await fs.writeFile(path.join(source, 'assets/.env'), '');
  const errors = (await validate({ sourceRoot: source })).join('\n');
  assert.match(errors, /frontmatter/i);
  assert.match(errors, /missing.md/);
  assert.match(errors, /secret/i);
  assert.match(errors, /machine/i);
});
