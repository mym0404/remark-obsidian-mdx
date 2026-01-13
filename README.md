# remark-obsidian-mdx

> This plugin is inspired by [remark-obsidian](https://github.com/johackim/remark-obsidian)

[![Version](https://img.shields.io/github/tag/mym0404/remark-obsidian-mdx.svg?label=Version&style=flat&colorA=2B323B&colorB=1e2329)](https://github.com/mym0404/remark-obsidian-mdx/releases)
[![License](https://img.shields.io/badge/license-GPL%20v3%2B-yellow.svg?label=License&style=flat&colorA=2B323B&colorB=1e2329)](https://raw.githubusercontent.com/mym0404/remark-obsidian-mdx/master/LICENSE.txt)

Remark plugin to support Obsidian markdown syntax with MDX output.

![preview](https://cdn.jsdelivr.net/gh/mym0404/image-archive/20260113195635356.png)


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

## Fumadocs ready-to-use setup

The examples below are taken from a working Fumadocs project and are ready to copy.

### 1) `source.config.ts`

```ts
import remarkObsidianMdx, { type PluginOptions } from "remark-obsidian-mdx";

export const docs = defineDocs({ ... });

export default defineConfig({
  mdxOptions: {
    remarkPlugins: [
      [
        remarkObsidianMdx,
        {
          contentRoot: "./content",
          contentRootUrlPrefix: "",
          wikiLinkPathTransform: ({ resolvedUrl }) =>
            resolvedUrl?.replace("/content", ""),
          embedingPathTransform: ({ resolvedUrl }) =>
            resolvedUrl?.replace("/content", ""),
          callout: {
            componentName: "Callout",
            typePropName: "type",
            defaultType: "info",
          },
          embedRendering: {},
        } satisfies PluginOptions,
      ],
      remarkMath,
    ],
    rehypePlugins: (v) => [rehypeKatex, ...v],
  },
});
```

### 2) Assets route (`content/assets/*` -> `/assets/*`)

```ts
import fs from "node:fs/promises";
import path from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const ASSET_ROUTE_PREFIX = "/assets/";
const ASSET_ROOT = path.resolve(process.cwd(), "content", "assets");

const toAssetPath = ({ pathname }: { pathname: string }) => {
  if (!pathname.startsWith(ASSET_ROUTE_PREFIX)) {
    return null;
  }

  const encodedPath = pathname.slice(ASSET_ROUTE_PREFIX.length);
  if (!encodedPath) {
    return null;
  }

  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(encodedPath);
  } catch {
    return null;
  }

  const resolvedPath = path.resolve(ASSET_ROOT, decodedPath);
  const withinRoot =
    resolvedPath === ASSET_ROOT || resolvedPath.startsWith(`${ASSET_ROOT}${path.sep}`);

  if (!withinRoot) {
    return null;
  }

  return resolvedPath;
};

const getContentType = ({ extension }: { extension: string }) => {
  switch (extension) {
    case "apng":
      return "image/apng";
    case "avif":
      return "image/avif";
    case "gif":
      return "image/gif";
    case "jpeg":
      return "image/jpeg";
    case "jpg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "svg":
      return "image/svg+xml";
    case "webp":
      return "image/webp";
    case "m4v":
      return "video/x-m4v";
    case "mov":
      return "video/quicktime";
    case "mp4":
      return "video/mp4";
    case "ogv":
      return "video/ogg";
    case "webm":
      return "video/webm";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
};

type ErrorWithCode = Error & { code?: string };

const isErrorWithCode = (value: unknown): value is ErrorWithCode =>
  value instanceof Error && "code" in value;

const createNotFoundResponse = () =>
  new Response("Not found", { status: 404 });

export const GET = async (request: NextRequest) => {
  const assetPath = toAssetPath({ pathname: request.nextUrl.pathname });
  if (!assetPath) {
    return createNotFoundResponse();
  }

  try {
    const file = await fs.readFile(assetPath);
    const extension = path.extname(assetPath).slice(1).toLowerCase();
    const contentType = getContentType({ extension });

    return new Response(file, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === "ENOENT") {
      return createNotFoundResponse();
    }

    return new Response("Failed to read asset", { status: 500 });
  }
};
```

### 3) Content layout

- `content/docs` for docs
- `content/blog` for blog posts
- `content/assets` for images/video/etc served under `/assets`

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
