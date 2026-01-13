# remark-obsidian-mdx

> This plugin is inspired by [remark-obsidian](https://github.com/johackim/remark-obsidian)

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
- `![[Embed]]` to user-provided MDX JSX nodes (note/image/video renderers)

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

### Example

```js
import remarkObsidianMdx from "remark-obsidian-mdx";

remark().use(remarkObsidianMdx, {
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
  contentRoot: "/vault",
  contentRootUrlPrefix: "/blog",
  embedRendering: {
    note: ({ target }) => ({
      type: "mdxJsxFlowElement",
      name: "EmbedNote",
      attributes: [
        { type: "mdxJsxAttribute", name: "page", value: target.page },
      ],
      children: [],
    }),
    image: ({ target, resolvedUrl, imageWidth, imageHeight }) => ({
      type: "image",
      url: resolvedUrl ?? target.page,
      alt: target.page,
      data: {
        hProperties: {
          width: imageWidth ?? 640,
          height: imageHeight ?? 480,
        },
      },
    }),
    video: ({ target, resolvedUrl }) => ({
      type: "mdxJsxFlowElement",
      name: "video",
      attributes: [
        { type: "mdxJsxAttribute", name: "src", value: resolvedUrl ?? target.page },
      ],
      children: [],
    }),
  },
  embedingPathTransform: ({ kind, resolvedUrl }) => {
    if (kind === "image" || kind === "video") {
      return resolvedUrl ?? null;
    }
    return null;
  },
  wikiLinkPathTransform: ({ resolvedUrl }) => {
    if (!resolvedUrl) {
      return null;
    }
    return resolvedUrl.replace("/notes/", "/docs/");
  },
});
```

### callout

- `typeMap` fully replaces the default mapping when provided.
- `typeMap` keys are normalized to lowercase.
- Empty mapped values fall back to `defaultType`.

### contentRoot

- Required. Builds an on-disk index for resolving `[[...]]` and `![[...]]`.
- Also passed to embed rendering for resolution checks.

### contentRootUrlPrefix

- Prepends a URL prefix for resolved paths without changing `contentRoot`.
- Example: `contentRoot: "/vault/.content"` with `contentRootUrlPrefix: "/blog"` resolves `[[ai-revolution]]` to `/blog/ai-revolution`.

### embedRendering

- Controls how `![[...]]` is rendered. Heading (`#`) and block (`^`) embeds are ignored.
- Unsupported embed types (non-note/image/video files) are ignored.
- Receives `resolvedUrl` and `imageWidth`/`imageHeight` when available.
- For embeds, `resolvedUrl` includes extensions by default.
- If a target cannot be resolved under `contentRoot`, the default output is a plain text fallback. You can override this with `embedRendering.notFound`.
- If `embedRendering.image` is omitted, the plugin emits a standard `image` node with `data.hProperties.width/height` inferred from the file.
- If `embedRendering.video` is omitted, it emits a `video` MDX JSX node.

### embedingPathTransform

- Overrides resolved URLs for embeds based on embed kind.
- Returning a string overrides `resolvedUrl`.

### wikiLinkPathTransform

- Overrides resolved URLs for `[[...]]` links.
- Returning a string overrides `resolvedUrl`.
- For wiki links, `resolvedUrl` excludes extensions by default.

### Next.js Image mapping
If your vault stores images under `vault/assets/images`, you should serve them via a route like `app/assets/[[slug]].tsx` so the resolved URLs can be fetched by the app.

```tsx
import Image from "next/image";
import defaultMdxComponents from "fumadocs-ui/mdx";

export function getMDXComponents(components?: Record<string, any>) {
  return {
    ...defaultMdxComponents,
    img: (props: any) => {
      const width =
        typeof props.width === "string" ? Number(props.width) : props.width;
      const height =
        typeof props.height === "string" ? Number(props.height) : props.height;
      return <Image {...props} width={width} height={height} />;
    },
    ...components,
  };
}
```

## License

This project is licensed under the GNU GPL v3.0 - see the [LICENSE.txt](https://raw.githubusercontent.com/mym0404/remark-obsidian-mdx/master/LICENSE.txt) file for details.
