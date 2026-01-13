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
  embedingPathTransform: ({ kind, resolvedUrlWithExtension }) => {
    if (kind === "image" || kind === "video") {
      return resolvedUrlWithExtension ?? null;
    }
    return null;
  },
});
```

Notes:
- Wiki links and `==mark==` are parsed via micromark extensions injected by the plugin.
- `typeMap` fully replaces the default mapping when provided.
- `typeMap` keys are normalized to lowercase.
- Empty mapped values fall back to `defaultType`.
- `embedRendering` controls how `![[...]]` is rendered. Heading (`#`) and block (`^`) embeds are ignored for now.
- Unsupported embed types (non-note/image/video files) are ignored.
- `contentRoot` is used to build an on-disk index for resolving `[[...]]` and `![[...]]`, and is also passed to embed rendering.
- `embedRendering` receives `resolvedPath`, `resolvedUrl`, `resolvedUrlWithExtension`, and `imageWidth`/`imageHeight` when an image target is found (for images/videos, `resolvedUrl` includes the extension by default).
- If a target cannot be resolved under `contentRoot`, the default output is a plain text fallback. You can override this with `embedRendering.notFound`.
- `resolvedUrlWithExtension` keeps the file extension in resolved URLs when set to true (default for image/video embeds).
- `embedingPathTransform` lets you override resolved URLs based on embed kind and resolved path (return a string to override both URLs).
- For embeds, `resolvedUrl` is preferred and already includes extensions for image/video.
- For Next.js, map `img` to `Image` and coerce width/height to numbers (see example below).
- If `embedRendering.image` is omitted, the plugin emits a standard `image` node with `data.hProperties.width/height` inferred from the file. If `embedRendering.video` is omitted, it emits a `video` MDX JSX node.

### Next.js Image mapping

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
