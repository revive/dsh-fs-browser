# dsh-fs-browser

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-plugin-4b32c3)](https://github.com/deepseek-ai/deepseek-harness)

[简体中文](README.zh-CN.md)

An out-of-tree [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) plugin that embeds a **workspace file browser in the right details column**, sharing the frame with the conversation: browse files while you chat, preview text with real syntax highlighting, preview images inline, and pick up exactly where you left off in every workspace.

The browser column is an *embedded* layout column, not a floating overlay — it collapses to the right, resizes up to half the viewport, and remembers per-workspace state (open directory + expanded/collapsed) across sessions and restarts.

## Features

- **Embedded right column, side by side with the chat** — registered in the layout's `details` seat; toggle from the session header（📁 文件）, collapse with the panel's ⏴; drag the column edge to widen up to half the viewport (see [Layout prerequisites](#layout-prerequisites))
- **Shiki syntax highlighting** — the same synchronous shiki core (JS-regex engine, css-variables theme) the product's read cards use; 23 grammars bundled (ts/js/jsx, bash, json, python, yaml, sql, c/cpp, cs, java, go, rust, css, html/xml, markdown, ruby, perl, lua, elisp, haskell, julia, php, toml, ini); unknown/absent languages degrade to a built-in lightweight tokenizer — never an error
- **Line numbers + copy-on-select** — line-number gutter that stays out of your selection; select text in the preview and a floating **复制** button appears; copies the exact visible text
- **Image preview** — inline preview for png/jpg/gif/webp/svg/bmp (≤2 MB base64 fallback, ≤8 MB via a same-origin HTTP route)
- **Per-workspace memory** — the open directory and whether the column is expanded are persisted in a durable storage **domain** (`~/.dsh/storages/fs_browser.json`, keyed by workspace id), restored when you enter that workspace's session
- **Prebuilt, dependency-free install** — the browser bundle ships with Shiki inlined (`lib/client.js`, prebuilt); the host half is plain JS whose only `@deepseek-ai` dependency is `storage-domain`

## Installation

### Option A: install the release tarball (recommended)

Download `dsh-fs-browser-<version>.tgz` from the [releases page](https://github.com/revive/dsh-fs-browser/releases) — the tarball ships the built browser bundle and the bundle patch layer, so no harness checkout or build step is needed — then install it into a profile with the `dsh` CLI:

```sh
dsh plugin --profile <name> add ./dsh-fs-browser-<version>.tgz
```

The package is a dsh **bundle**: `dsh.bundle.patch` points at the bundled `cordis.patch.yml`, which inserts the plugin row, and `dsh.client` registers the browser half. Verify the layer without booting:

```sh
dsh --profile <name> --dump-config    # look for "# == dsh-fs-browser"
```

> Installing a bundle does **not** hot-mount into a running GUI: bundle layers are composed at boot (HMR hot-applies only patch files), so restart the GUI process after `dsh plugin add`. After the restart, the session header shows the 📁 文件 toggle.

### Option B: install from a source checkout

The plugin is a pure add-on — the only harness-side touch is the optional layout geometry in the next section. Two entries under `~/.dsh` are enough:

1. Make the package resolvable from every profile (the runtime consults `~/.dsh/profiles/node_modules` as a shared flat fallback):

   ```sh
   cd ~/.dsh/profiles/web          # or your active profile
   pnpm add /path/to/dsh-fs-browser
   ```

2. Add the plugin row to the home-layer overlay `~/.dsh/cordis.patch.yml` (applies to every profile):

   ```yaml
   - insert:
       - id: dsh-fs-browser
         name: 'dsh-fs-browser'
   ```

Restart the GUI (`pnpm dsh web --no-open`) and open the freshly printed URL. Uninstalling = removing both entries (`pnpm remove` + the patch row).

> The browser half (`lib/client.js`) is a build artifact — after cloning, build it first (see [Development](#development)). The release tarball already contains it.

## Usage

Open the 📁 文件 toggle in the session header (or let it reopen automatically — the panel remembers whether it was expanded):

- **File list** — directories first, click to enter, `..` to go back, sizes shown; the current workspace is derived from the session's cwd (fallback: the workspace containing the session, then the first workspace)
- **Preview** — click a file: text renders with line numbers + Shiki highlighting below the list (drag the divider to adjust the split; default list height 1/3); images render inline; oversized/binary files show a clear notice
- **Copy** — select text in the preview, a floating 复制 button follows the selection; copies the raw text (line numbers excluded)
- **Width** — drag the column's left edge (the border between chat and the file column; a pill handle appears on hover) to resize up to half the viewport
- **Memory** — directory and expanded state are saved per workspace on every navigation/close; entering that workspace's session restores both

Supported text grammars (Shiki): TypeScript/JS/JSX/TSX, Bash/Shell, JSON, Python, YAML, SQL, C/C++, C#, Java, Go, Rust, CSS, HTML/XML, Markdown, Ruby, Perl, Lua, Emacs Lisp, Haskell, Julia, PHP, TOML, INI.

## Layout prerequisites

The "resize up to half the viewport" capability depends on one small harness-side geometry change in `@deepseek-ai/dsh-client-ui-layout` (`packages/client/ui-layout/src/client/columns.ts`):

- Details drag ceiling: `detailsMax(viewport) = max(520, floor(viewport / 2))` (replace the fixed `DETAILS_MAX = 520` clamp in `computeColumns`)
- Center-column floor: `CENTER_MIN = 480` (the shipped 640 leaves no headroom on typical laptop widths)

Then rebuild the client libraries: `pnpm run build:lib:client` (the served UI is composed from per-package `lib/` artifacts, not just `apps/web/dist`). Without this change the plugin still works — the column just caps at the default width.

## How it works

```
browser client bundle (Shiki inlined, ModuleLoader closure)
  │  same-origin fetch (cookie auth — the same channel as the product's assets)
  ├─ GET  /worx-file?p=<path>  ──> raw file bytes (image preview, ≤8 MB)
  └─ POST /worx-api            ──> { op: list | read | state, args }
                                      │
host lib/index.js (plain JS; only deps: storage-domain + zod)
  ├─ ctx.fs (fs-sandbox): listDir / readText+readBytes
  └─ ctx.storageDomain: domain 'fs_browser', table 'state'
       (durable backend writes ~/.dsh/storages/fs_browser.json — no sandbox policy)
per-workspace state keyed by workspace id. Legacy per-workspace .worx-state.json
  files are imported once at first boot, kept, and hidden from the listing.
```

- The client plugin (`dsh.client` + `exports["./client"]`) registers the `details` seat at `priority: -100` (shadows the built-in tool-details panel) and the header toggle
- The host row declares `inject: ['fs', 'webServer', 'storageDomain']` so it never activates before those services exist

## Development

Prerequisites: a clone of [deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (for `tsdown` and to resolve the private `@deepseek-ai/*` workspace packages) and a profile to test against (see Installation).

```sh
pnpm install              # pulls the dev toolchain (tsdown, shiki, typescript)
pnpm build                # build:host copies src/index.js → lib/index.js,
                          # then build:client bundles Shiki into lib/client.js
pnpm pack                 # -> dsh-fs-browser-<version>.tgz
```

- **Host half** (`src/index.js`) is hand-written plain JS — `pnpm run build:host` copies it to `lib/index.js`; edit `src/index.js`, never `lib/`
- **Client half** (`src/client.ts`) is TS built by tsdown: `react` stays an external (`require('react')` from the page), everything else (Shiki + grammars) is inlined
- The running GUI serves the client bundle from `lib/client.js` with a content-hash rev — after a rebuild, a page refresh (or a GUI restart) picks it up; host-side changes need a GUI restart
- For quick iteration you can build against any context that already has `shiki` installed (e.g., `packages/client/ui-primitives/node_modules`) — the bundle contents are identical

## Project structure

```
dsh-fs-browser/
  package.json            # dsh-fs-browser; dsh.bundle.patch -> cordis.patch.yml,
                          # dsh.client manifest + exports["./client"]
  cordis.patch.yml        # bundle patch layer (dsh.bundle.patch) — also the --patch overlay
  tsdown.config.ts        # self-contained client build (ModuleLoader closure wrapper)
  tsconfig.json           # client TS compilation options
  src/client.ts           # browser half: panel components + Shiki highlight
  src/index.js            # host half (hand-written plain JS): /worx-file + /worx-api routes
                          #   + the fs_browser storage domain; copied to lib/index.js by build:host
  lib/index.js            # build output (host copy, gitignored)
  lib/client.js           # build output (Shiki inlined, gitignored)
  .github/workflows/release.yml   # tag v* → cloud build + pack + release + tarball
  README.md / README.zh-CN.md
  LICENSE                 # MIT
```

## Publishing

The package is shaped as a dsh **bundle** — `dsh plugin --profile <name> add dsh-fs-browser` installs it and joins the profile's bundle layers. `peerDependencies` stays minimal (`react`, `@deepseek-ai/dsh-storage-domain`, `zod`): the two runtime packages resolve from the installation's shared flat fallback (`$DSH_HOME/profiles/node_modules`), and the browser half inlines its own Shiki.

**Every GitHub release attaches the packed tarball.** The included GitHub Action (`.github/workflows/release.yml`, on `v*` tags) makes this automatic: push a `v<version>` tag, and the workflow checks out the tag, sets `package.json` to the tag version, builds the browser bundle and host half, packs `dsh-fs-browser-<version>.tgz`, creates (or updates) the release and uploads the tarball — no local build required.

```sh
git tag v0.1.1 && git push origin v0.1.1   # workflow builds + releases dsh-fs-browser-0.1.1.tgz
```

Locally, the same steps are `pnpm build && pnpm pack`. Users install the tarball with:

```sh
dsh plugin --profile <name> add ./dsh-fs-browser-<version>.tgz
```

Verify a tarball locally before publishing: install it into a profile, boot the GUI, and check the session header shows 📁 文件 with the file column working.

## License

[MIT](LICENSE)