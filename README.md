# remark-obsidian-mdx

> This plugin is built on [remark-obsidian](https://github.com/johackim/remark-obsidian)

> [!IMPORTANT]
> This project is under developing.


[![Version](https://img.shields.io/github/tag/mym0404/remark-obsidian-mdx.svg?label=Version&style=flat&colorA=2B323B&colorB=1e2329)](https://github.com/mym0404/remark-obsidian-mdx/releases)
[![License](https://img.shields.io/badge/license-GPL%20v3%2B-yellow.svg?label=License&style=flat&colorA=2B323B&colorB=1e2329)](https://raw.githubusercontent.com/mym0404/remark-obsidian-mdx/master/LICENSE.txt)

Remark plugin to support Obsidian markdown syntax with MDX output.

## Requirements

- Node.js >= 14

## Features

- `> [!CALLOUT]` to `<Callout ...>` (MDX JSX flow element)
- `==highlight==` to `<mark>...</mark>` (MDX JSX text element)
- `[[Wiki link]]` to mdast `link` nodes (alias divider is `|`)
- `[[#Heading]]` uses a heading slug
- `![[Embed note]]` to raw HTML embed (requires `markdownFiles`)
- Not supported: `![[Embed note#heading]]`

## Installation

```bash
pnpm add -D remark-obsidian-mdx
```

## Usage

### MDX pipeline

```js
import { compile } from "@mdx-js/mdx";
import remarkObsidianMdx from "remark-obsidian-mdx";

const result = await compile(source, {
  remarkPlugins: [remarkObsidianMdx],
});
```

If your MDX runtime does not provide a default `Callout` component, register it in your components map (for example, `Callout` from Fumadocs).

### Unified to HTML

```js
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import remarkObsidianMdx from "remark-obsidian-mdx";

const { value } = unified()
  .use(remarkParse)
  .use(remarkObsidianMdx)
  .use(remarkRehype, {
    allowDangerousHtml: true,
    passThrough: [
      "mdxjsEsm",
      "mdxFlowExpression",
      "mdxJsxFlowElement",
      "mdxJsxTextElement",
      "mdxTextExpression",
    ],
  })
  .use(rehypeStringify, { allowDangerousHtml: true })
  .processSync("[[Hello world]]");
```

`passThrough` keeps MDX nodes intact when converting to HAST; without it, MDX JSX nodes are dropped.

## Options

```js
import remarkObsidianMdx from "remark-obsidian-mdx";

remark().use(remarkObsidianMdx, {
  baseUrl: "/docs",
  markdownFiles: [
    { file: "myfile.md", permalink: "custom-link" },
    { file: "My Note.md", content: "This is **embedded**." },
  ],
  callout: {
    componentName: "Callout",
    typePropName: "type",
    defaultType: "info",
    typeMap: {
      note: "info",
      abstract: "info",
      summary: "info",
      tldr: "info",
      info: "info",
      todo: "info",
      quote: "info",
      tip: "idea",
      hint: "idea",
      example: "idea",
      question: "idea",
      warn: "warn",
      warning: "warn",
      caution: "warn",
      attention: "warn",
      danger: "error",
      error: "error",
      fail: "error",
      failure: "error",
      bug: "error",
      success: "success",
      done: "success",
      check: "success",
    },
  },
});
```

Notes:
- `baseUrl` is prefixed to resolved wiki links.
- Wiki links and `==mark==` are parsed via micromark extensions injected by the plugin.
- `markdownFiles` resolves wiki links and embeds by filename. Missing entries add a `not-found` class.
- `typeMap` fully replaces the default mapping when provided.
- `typeMap` keys are normalized to lowercase.
- Empty mapped values fall back to `defaultType`.

## License

This project is licensed under the GNU GPL v3.0 - see the [LICENSE.txt](https://raw.githubusercontent.com/mym0404/remark-obsidian-mdx/master/LICENSE.txt) file for details.
