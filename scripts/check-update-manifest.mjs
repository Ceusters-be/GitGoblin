import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
export function validateManifest(manifest, tag, release) {
const repository = 'GoblinAssembly/GitGoblin';
if (release) assert.equal(release.tag_name, tag, 'Release tag mismatch');
const prefix = `https://github.com/${repository}/releases/download/${encodeURIComponent(tag)}/`;
const apiPrefix = `https://api.github.com/repos/${repository}/releases/assets/`;
assert.equal(manifest.version.replace(/^v/, ''), tag.replace(/^v/, ''));
for (const platform of ['windows-x86_64', 'darwin-aarch64', 'darwin-x86_64', 'linux-x86_64'])
  assert.ok(manifest.platforms?.[platform], `Missing platform ${platform}`);
for (const [platform, artifact] of Object.entries(manifest.platforms)) {
  assert.ok(artifact?.signature?.trim(), `Missing signature for ${platform}`);
  const url = new URL(artifact.url);
  assert.ok(!url.username && !url.password && !url.search && !url.hash, `Invalid URL for ${platform}`);
  const browserUrl = artifact.url.startsWith(prefix) && artifact.url.length > prefix.length;
  const apiUrl = artifact.url.startsWith(apiPrefix) && /^\d+$/.test(artifact.url.slice(apiPrefix.length));
  assert.ok(browserUrl || apiUrl, `Invalid URL for ${platform}`);
  if (apiUrl) assert.ok(release, 'Release metadata is required to validate API asset URLs');
  if (release) assert.ok(release.assets.some(asset => asset.url === artifact.url || `${prefix}${encodeURIComponent(asset.name)}` === artifact.url), `Asset for ${platform} does not belong to ${tag}`);
}
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
const manifest = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const tag = process.argv[3];
const release = process.argv[4] ? JSON.parse(readFileSync(process.argv[4], 'utf8')) : undefined;
validateManifest(manifest, tag, release);
console.log('All four updater platforms are present and signed');
}
