# Releases and automatic updates

Run `npm run release:version -- X.Y.Z` to stamp all five version files, then commit them.
Push a matching stable `vX.Y.Z` tag. The release workflow checks versions,
creates a draft, tests and builds all platforms, then publishes only after every
build and the updater manifest validation succeed. Failed builds leave a draft;
rerun failed jobs to finish it. Never replace assets of an already published release.

Windows ships NSIS .exe and MSI installers. The updater prefers NSIS. macOS ships
separate Apple Silicon and Intel DMGs plus app archives for updates. Linux releases
are currently paused; the build configuration is commented out for later re-enabling.
When enabled, Linux ships
x64 AppImage, deb and rpm; use AppImage for in-app updates. deb/rpm installations
must be upgraded by installing a newer package.

The app checks on startup and every four hours, downloads signed updates, and
offers Restart to update in the top bar. Clicking it installs the update and restarts immediately. Save drafts you want to keep first.
Existing versions without the updater need one manual installation.

## Signing

Set the GitGoblin repository Actions secret `TAURI_SIGNING_PRIVATE_KEY` to the
contents of the private key file below before pushing the first release tag. The matching
public key is in tauri.conf.json. The initial private key backup is outside the
repository at `%USERPROFILE%\.gitgoblin-signing\updater.key`; back it up securely.
Do not regenerate or lose this key: installed versions trust its public key.
TAURI_SIGNING_PRIVATE_KEY_PASSWORD is optional for the initial unencrypted key.
Never commit the private key or include it in release artifacts.

Updater signatures are separate from operating system code signing. Builds work
without OS certificates, but first-time installations can show security warnings.
For macOS Developer ID signing and notarization, configure APPLE_CERTIFICATE
(base64 p12), APPLE_CERTIFICATE_PASSWORD, APPLE_SIGNING_IDENTITY, APPLE_ID,
APPLE_PASSWORD (app-specific password), and APPLE_TEAM_ID secrets. For Windows,
configure your organization's Authenticode certificate/signing provider in Tauri
and the release runner before public distribution; no certificate is bundled here.

## Validation before broad distribution

Install the first release on each OS, publish a higher test version, and verify
download, restart and preserved repositories, and signature verification end to end.
Check macOS Gatekeeper/notarization and Windows installation on clean machines.
Local tests cannot validate those platform installers or the hosted update path.
