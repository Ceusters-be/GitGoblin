# GitGoblin

A Windows-first Git desktop application with Fork-inspired workflows, a restrained T3 Code-style interface, and shared T3 Code conversations. Built with Tauri, Rust, Nuxt, Vue, and TypeScript.

## Development

Requires Node 22+, npm, Git, Rust stable, and (Windows) Visual Studio C++ build tools with a Windows SDK and WebView2.

```sh
npm install
npm run desktop
```

`npm run dev` opens the UI in a browser; native filesystem and Git commands require the desktop app. The browser offers an explicitly labeled example workspace for UI review.

`npm run desktop` launches **GitGoblin (development)** from this checkout. UI edits reload live; Rust edits rebuild and restart the desktop app automatically. Keep the dev process running while using it. A Windows shortcut can run this command from the repository folder; launching the installed release still opens the packaged version. Development and release builds share saved repositories and pairing.

```sh
npm run typecheck
npm run test
npm run native:test
npm run native:smoke # after building a debug desktop binary
npm run desktop:build
```

## UI components

Use Reka UI primitives for interactive controls and unprefixed Tailwind utilities for all styling. Shared controls include `AppSelect`, `AppDialog`, `ContextMenu`, and `WorkingFolderPicker`; Reka owns selection, keyboard navigation, focus, dismissal, and popup positioning. Chat tabs use Reka Tabs while retaining application-specific drag reordering and close shortcuts.

`app/assets/tailwind.css` contains the Tailwind import and shared theme tokens only. Reuse `AppButton` (`variant="primary"`, `size="icon"`), `AppInput`, `AppTextarea`, and the dialog panel/header/footer components. Component classes can override their defaults. The lightweight functional primitives preserve native template refs and forward attributes and events; inputs use Vue's native model directives, including composition and checkbox handling. Keep one-off utilities in templates. Inline values are reserved for runtime geometry such as resizable panes, virtualized rows, and graph positions.

### File icons

Use official SVGs from [vscode-icons](https://github.com/vscode-icons/vscode-icons/tree/814aab8318900f47efeae6f1c4691494ae764199/icons). Copy the SVG unchanged into [app/assets/file-icons](app/assets/file-icons) and keep the bundled [license](app/assets/file-icons/LICENSE). For example, save `file_type_handlebars.svg` as `handlebars.svg`. The component automatically picks it up for files ending in `.handlebars`.

When several types share an icon, reuse the asset through `aliases` in [FileTypeIcon.vue](app/components/FileTypeIcon.vue), as `xlsx` and `xls` both use `table.svg`. Use `filenames` for exact names such as `.env.example`. Lookup is case-insensitive and checks the filename first, then the extension alias, then the extension itself. Missing assets fall back to `default.svg`.

To verify a change, compare the copied SVG with its upstream source and check a representative filename in the changed-files list.

## Releases

Run `npm run release:version -- X.Y.Z`, commit the version changes, and push a matching `vX.Y.Z` tag. The workflow tests and builds Windows, macOS (Apple Silicon and Intel), and Linux, then publishes only after validating every signed updater asset.

The app downloads updates in the background and offers **Restart to update**. See [release and signing setup](docs/releases.md) for secrets, platform packages, and first-install requirements.

## Product contract

GitGoblin is intended to replace Fork, including history, branches, remotes, tags, stashes, search, blame, file history, file/hunk/line staging, commits, fetch/pull/push, interactive rebase, cherry-pick, revert, reset, amend, recovery, and an integrated conflict editor.

T3 Code owns conversations and agent execution. GitGoblin connects as a paired client, associates chats with repositories/worktrees, and supports shared instructions, approvals, and live review. Chats in the same worktree share changes; Git does not attribute edits to individual chats. Ordinary code editing remains in an external editor. Git actions that change a worktree need explicit confirmation while a known agent is active.

The left sidebar switches between Git navigation and Chat. The main review area stays visible in both modes. Chat keeps its connection, drafts, and scroll position while hidden; the mode switch indicates running tasks and pending requests in the selected conversation. The last mode is restored on startup.

Dedicated submodule, LFS, signing, WSL, remote-host, and public plugin interfaces are deferred. Existing Git configuration is preserved.

## Integration boundary

T3 integration uses an internal, version-sensitive protocol. It must be tested against the running server; source compatibility alone is not a successful connection proof. Pair through T3's connection settings. Credentials must never be committed, printed, or placed in browser localStorage. Git functions must remain usable without T3.

Recent repositories are saved in `repositories.json` in Tauri's per-user app data directory (`%APPDATA%/dev.gitgoblin.desktop` on Windows). Development and packaged builds share this location; startup reopens the most recent repository. Existing browser-storage history is imported when no native history exists.

T3 pairing is saved in the OS credential store (Windows Credential Manager on Windows) and restored on startup. Disconnecting forgets the saved pairing. Expired or revoked tokens require pairing again; rebuilding the app does not. Pair once with this version to persist a previously memory-only connection.

See [implementation status](docs/STATUS.md) for verified capabilities and remaining work.

The native launch scripts also find Rust in the usual per-user `.cargo/bin` directory, so an editor opened before installing Rust can still run them. Installing the Windows C++ workload requires an elevated Visual Studio Installer.
