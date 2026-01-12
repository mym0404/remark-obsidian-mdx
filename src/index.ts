import { gfmFootnoteToMarkdown } from "mdast-util-gfm-footnote";
import { gfmStrikethroughToMarkdown } from "mdast-util-gfm-strikethrough";
import { toMarkdown } from "mdast-util-to-markdown";
import { toString as mdastToString } from "mdast-util-to-string";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import remarkParse from "remark-parse";
import slugify from "slugify";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import {
	hasChildren,
	hasInlineCode,
	isMarkdownNode,
	isStrongNode,
	removeChildren,
} from "./ast";
import { type CalloutOptions, createCalloutNode } from "./callout";
import {
	BRACKET_LINK_REGEX,
	EMBED_LINK_REGEX,
	HEADING_REGEX,
} from "./constants";

type MarkdownFile = {
	file: string;
	permalink?: string;
	content?: string;
};

type PluginOptions = {
	baseUrl?: string;
	markdownFiles?: MarkdownFile[];
	callout?: CalloutOptions;
};

type VisitTreeNode = Parameters<typeof visit>[0];

type VisitTree = VisitTreeNode & {
	children: VisitTreeNode[];
};

const plugin = (options?: PluginOptions) => (tree: VisitTree) => {
	const { baseUrl = "", markdownFiles } = options || {};

	const titleToUrl = (title: string) => {
		const file = markdownFiles?.find((entry) => entry.file === `${title}.md`);

		if (file?.permalink) {
			return `/${file.permalink}`;
		}

		return `/${slugify(title, { lower: true })}`;
	};

	visit<VisitTree, string>(tree, "paragraph", (node) => {
		if (!isMarkdownNode(node) || !hasChildren(node)) {
			return;
		}

		const markdown = toMarkdown(node, {
			extensions: [gfmFootnoteToMarkdown(), gfmStrikethroughToMarkdown],
		});
		const paragraph = String(
			unified().use(remarkParse).use(remarkHtml).processSync(markdown),
		).replace(/&#x26;|&#38;/g, "&");
		const children = node.children ?? [];

		if (paragraph.match(EMBED_LINK_REGEX)) {
			const html = paragraph.replace(EMBED_LINK_REGEX, (embedLink, link) => {
				if (hasInlineCode({ children, value: embedLink })) {
					return embedLink;
				}

				const file = markdownFiles?.find(
					(entry) => entry.file === `${link}.md`,
				);

				if (file?.content) {
					const content = remark()
						.use(remarkFrontmatter)
						.use(remarkGfm)
						.use(remarkHtml)
						.processSync(file.content);
					return `<div class="embed-note">${content}</div>`;
				}

				return '<div class="embed-note not-found">Note not found</div>';
			});

			if (html === paragraph) {
				return;
			}

			removeChildren({ node });

			Object.assign(node, { type: "html", value: html });
			return;
		}

		if (paragraph.match(BRACKET_LINK_REGEX)) {
			const html = paragraph.replace(
				BRACKET_LINK_REGEX,
				// eslint-disable-next-line complexity
				(bracketLink, link, heading, text) => {
					const href = titleToUrl(link);
					const fullHref = baseUrl + href;
					const isNotFound =
						markdownFiles &&
						!markdownFiles.find((entry) => entry.file === `${link}.md`);

					if (hasInlineCode({ children, value: bracketLink })) {
						return bracketLink;
					}

					if (heading && text) {
						return `<a href="${fullHref}#${slugify(heading, { lower: true })}" title="${text}"${isNotFound ? ' class="not-found"' : ""}>${text}</a>`;
					}

					if (heading) {
						return `<a href="${fullHref}#${slugify(heading, { lower: true })}" title="${link}"${isNotFound ? ' class="not-found"' : ""}>${link}</a>`;
					}

					if (text) {
						return `<a href="${fullHref}" title="${text}"${isNotFound ? ' class="not-found"' : ""}>${text}</a>`;
					}

					return `<a href="${fullHref}" title="${link}"${isNotFound ? ' class="not-found"' : ""}>${link}</a>`;
				},
			);

			if (html === paragraph) {
				return;
			}

			removeChildren({ node });

			Object.assign(node, { type: "html", value: html });
			return;
		}

		if (paragraph.match(HEADING_REGEX)) {
			const match = HEADING_REGEX.exec(paragraph);

			if (match?.[1]) {
				const heading = match[1];
				const html = `<a href="#${slugify(heading, { remove: /[.,]/g, lower: true })}" title="${heading}">${heading}</a>`;
				removeChildren({ node });
				Object.assign(node, { type: "html", value: html });
				return;
			}
		}

		return;
	});

	visit<VisitTree, string>(tree, "blockquote", (node, index, parent) => {
		if (!parent || !hasChildren(parent) || typeof index !== "number") {
			return;
		}

		const callout = createCalloutNode({
			blockquote: node,
			options: options?.callout,
		});

		if (!callout) {
			return;
		}

		parent.children.splice(index, 1, callout);

		return;
	});

	visit<VisitTree, string>(tree, "paragraph", (node) => {
		const paragraph = mdastToString(node);
		const highlightRegex = /==(.*)==/g;

		if (paragraph.match(highlightRegex)) {
			if (!hasChildren(node)) {
				return;
			}

			const children = node.children ?? [];
			const html = paragraph.replace(highlightRegex, (markdown, text) => {
				if (hasInlineCode({ children, value: markdown })) {
					return markdown;
				}

				if (
					children.some(
						(child) => isStrongNode(child) && text === mdastToString(child),
					)
				) {
					return `<mark><b>${text}</b></mark>`;
				}

				return `<mark>${text}</mark>`;
			});

			if (html === paragraph) {
				return;
			}

			removeChildren({ node });

			Object.assign(node, { type: "html", value: `<p>${html}</p>` });
			return;
		}

		return;
	});
};

export default plugin;
