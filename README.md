# قارئ — Qari

A calm, **Arabic-first** Markdown reader for **macOS**, **Windows** and the **web (PWA)**, built with Tauri 2 + React.

- Open a single `.md` file or a whole folder. There's no sidebar: the document fills the window and the chrome floats above it.
- **macOS:** real Liquid Glass via [`tauri-plugin-liquid-glass`](https://github.com/hkandala/tauri-plugin-liquid-glass) on macOS 26+, falling back to NSVisualEffectView on older systems. Also a native localized menu bar and Finder "Open With".
- **Windows 11:** Mica window material, a Fluent title bar, single-instance, and file associations.
- **PWA:** offline, installable, opens `.md` files from the OS (`file_handlers`), uses the File System Access API with a fallback for Safari and Firefox.
- **Arabic UI by default (RTL)** with English as a second language. Each block of a document picks its own direction (`dir="auto"`).
- **Fonts, bundled offline:**
  - Arabic: Noto Sans Arabic (default), Tajawal, Rubik, IBM Plex Sans Arabic, Vazirmatn
  - English: System (SF / Segoe), Inter, IBM Plex Sans, Rubik
- **Markdown support:** GFM tables, task lists, footnotes, alerts, Shiki highlighting, KaTeX math and Mermaid diagrams. Raw HTML is sanitized.

## Develop

```sh
pnpm install
pnpm tauri dev      # desktop
pnpm dev            # browser / PWA (http://localhost:1420)
```

## Build

```sh
pnpm tauri build    # .app/.dmg on macOS, .msi/.exe on Windows (build on each OS, or use CI)
pnpm build          # PWA → dist/ (deploy to any static host)
```

Try the documents in `samples/` (Arabic, English, mixed text, math, diagrams, relative links and images).

## Shortcuts

| Action | macOS | Windows / Web |
|---|---|---|
| Open file / folder | ⌘O / ⇧⌘O | Ctrl+O / Ctrl+Shift+O |
| Quick open | ⌘P | Ctrl+P |
| Find | ⌘F | Ctrl+F |
| Outline | ⇧⌘T | Ctrl+Shift+T |
| Focus mode | ⌘. | Ctrl+. |
| Previous / next file | ⌘[ / ⌘] | Ctrl+[ / Ctrl+] |
| Text size | ⌘+ / ⌘− / ⌘0 | Ctrl+ + / − / 0 |
| Switch language | ⇧⌘L | Ctrl+Shift+L |
