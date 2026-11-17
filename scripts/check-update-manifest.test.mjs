import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateManifest } from './check-update-manifest.mjs';
const repo = 'GoblinAssembly/GitGoblin';
const platforms = ['windows-x86_64', 'darwin-aarch64', 'darwin-x86_64', 'linux-x86_64'];
function fixture(api = true) {
  const assets = platforms.map((name, i) => ({ name, url: `https://api.github.com/repos/${repo}/releases/assets/${i + 1}` }));
  return { release: { tag_name: 'v0.1.0', assets }, manifest: { version: '0.1.0', platforms: Object.fromEntries(assets.map(asset => [asset.name, { signature: 'signature', url: api ? asset.url : `https://github.com/${repo}/releases/download/v0.1.0/${asset.name}` }])) } };
}
test('accepts both API asset URLs and tagged browser URLs belonging to the release', () => {
  for (const api of [true, false]) {
    const { manifest, release } = fixture(api);
    validateManifest(manifest, 'v0.1.0', release);
  }
});
test('rejects unknown assets, other hosts, wrong tags, missing platforms and signatures', () => {
  for (const mutate of [
    m => m.platforms['windows-x86_64'].url += '999',
    m => m.platforms['windows-x86_64'].url = 'https://example.com/file.exe',
    m => delete m.platforms['darwin-aarch64'],
    m => m.platforms['windows-x86_64'].signature = '',
    m => m.version = '0.2.0',
  ]) {
    const { manifest, release } = fixture(); mutate(manifest);
    assert.throws(() => validateManifest(manifest, 'v0.1.0', release));
  }
  const { manifest } = fixture();
  assert.throws(() => validateManifest(manifest, 'v0.1.0'));
});
