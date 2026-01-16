# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

`remark-obsidian-mdx` is a remark plugin that transforms Obsidian markdown syntax into MDX-compatible output. It handles:
- Callouts (`> [!TYPE]`) → MDX JSX flow elements (`<Callout>`)
- Highlights (`==text==`) → `<mark>` elements
- Wiki links (`[[Page]]`, `[[Page|alias]]`) → standard markdown links
- Embeds (`![[image.png]]`, `![[note]]`) → image/video/note MDX nodes

## Commands

```bash
pnpm test              # Run tests once
pnpm test -- -t "pattern"  # Run specific test by name
pnpm build             # Build with tsdown (ESM + CJS)
pnpm typecheck         # TypeScript type checking
pnpm lint              # Biome linting
pnpm format            # Biome format with auto-fix
pnpm t                 # lint + typecheck + test (full validation)
```

## Architecture

### Core Plugin Flow (`src/index.ts`)
The plugin extends unified/remark with micromark extensions and performs AST transformations via `unist-util-visit`:
1. Registers `wikiLinkSyntax` and `highlightMark` micromark extensions
2. Registers `wikiLinkFromMarkdown` and `markFromMarkdown` mdast extensions
3. Traverses tree visiting: `paragraph` (for embeds), `wikiLink`, `blockquote` (for callouts), `mark`

### Content Resolution (`src/content-resolver/index.ts`)
Mimics Obsidian's link resolution algorithm:
- `buildContentResolverFromRoot(contentRoot)` - walks filesystem, builds basename/path indexes
- `parseObsidianLink(input)` - parses `[[target|alias]]` format
- `resolveLink(index, target)` - matches target to actual file path
- Supports partial path hints and extension inference

### Transformers
- `src/callout.ts` - Converts blockquotes with `[!TYPE]` markers to MDX Callout components
- `src/embed.ts` - Handles `![[...]]` embeds (note/image/video), reads image dimensions via `image-size`
- `src/wiki-link.ts` - Converts `[[...]]` to standard links, handles aliases and anchors
- `src/mark.ts` - Converts `==highlight==` to `<mark>` MDX elements

### Micromark Extensions (`src/micromark-extension/`)
- `micromark-extension-wiki-link.ts` - Tokenizes `[[...]]` and `![[...]]` syntax
- `mdast-wiki-link.ts` - Converts tokens to mdast `wikiLink` nodes

### Plugin Options (`PluginOptions` in `src/index.ts`)
- `contentRoot` - Required. Root directory for resolving links/embeds
- `contentRootUrlPrefix` - URL prefix for resolved paths
- `callout` - Component name, type mapping, prop names
- `embedRendering` - Custom renderers for note/image/video embeds
- `embedingPathTransform` / `wikiLinkPathTransform` - URL transformation hooks
