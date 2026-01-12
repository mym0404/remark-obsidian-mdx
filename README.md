# remark-obsidian-mdx

> This plugin is built on [remark-obsidian](https://github.com/johackim/remark-obsidian)

[![Version](https://img.shields.io/github/tag/johackim/remark-obsidian.svg?label=Version&style=flat&colorA=2B323B&colorB=1e2329)](https://github.com/johackim/remark-obsidian/releases)
[![License](https://img.shields.io/badge/license-GPL%20v3%2B-yellow.svg?label=License&style=flat&colorA=2B323B&colorB=1e2329)](https://raw.githubusercontent.com/johackim/remark-obsidian/master/LICENSE.txt)

Remark plugin to support Obsidian markdown syntax.

## 📋 Requirements

- Nodejs >= 14

## ✨ Features

- [x] Support `> [!CALLOUT]`
- [x] Support `==highlight text==`
- [x] Support `[[Internal link]]`
- [x] Support `[[Internal link|With custom text]]`
- [x] Support `[[Internal link#heading]]`
- [x] Support `[[Internal link#heading|With custom text]]`
- [x] Support `![[Embed note]]`
- [ ] Support `![[Embed note#heading]]`

## 🚀 Installation

```bash
yarn add -D remark-obsidian-mdx
```

## 📦 Usage

With [remark](https://github.com/remarkjs/remark/) :

```js
import { remark } from 'remark';
import remarkObsidianMdx from 'remark-obsidian-mdx';

const html = String(await remark().use(remarkObsidianMdx).process('[[Hello world]]'));
console.log(html); // <a href="/hello-world">Hello world</a>
```

With [unified](https://github.com/unifiedjs/unified) :

```js
import { unified } from 'unified';
import remarkObsidianMdx from 'remark-obsidian-mdx';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

const { value } = unified()
    .use(remarkParse)
    .use(remarkObsidianMdx)
    .use(remarkRehype, {
      allowDangerousHtml: true,
      passThrough: [
        'mdxjsEsm',
        'mdxFlowExpression',
        'mdxJsxFlowElement',
        'mdxJsxTextElement',
        'mdxTextExpression',
      ],
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .processSync('[[Hello world]]');

console.log(value); // <a href="/hello-world">Hello world</a>
```

## Callout options

Callout parsing can be configured through the `callout` option.

```js
import remarkObsidianMdx from 'remark-obsidian-mdx';

remark().use(remarkObsidianMdx, {
  callout: {
    componentName: 'Callout',
    typePropName: 'type',
    defaultType: 'info',
    typeMap: {
      note: 'info',
      abstract: 'info',
      summary: 'info',
      tldr: 'info',
      info: 'info',
      todo: 'info',
      quote: 'info',
      tip: 'idea',
      hint: 'idea',
      example: 'idea',
      question: 'idea',
      warn: 'warn',
      warning: 'warn',
      caution: 'warn',
      attention: 'warn',
      danger: 'error',
      error: 'error',
      fail: 'error',
      failure: 'error',
      bug: 'error',
      success: 'success',
      done: 'success',
      check: 'success',
    },
  },
});
```

Notes:
- `typeMap` fully replaces the default mapping when provided.
- `typeMap` keys are normalized to lowercase.
- Empty mapped values fall back to `defaultType`.

## 📜 License

This project is licensed under the GNU GPL v3.0 - see the [LICENSE.txt](https://raw.githubusercontent.com/johackim/remark-obsidian/master/LICENSE.txt) file for details

**Free Software, Hell Yeah!**
