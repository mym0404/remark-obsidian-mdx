import { fromMarkdown as wikiLinkFromMarkdown } from "mdast-util-wiki-link";
import { pandocMark } from "micromark-extension-mark";
// @ts-ignore
import { syntax as wikiLink } from "micromark-extension-wiki-link";
import { remark } from "remark";
import remarkFrontmatter from "remark-frontmatter";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { visit } from "unist-util-visit";
import { type CalloutOptions, createCalloutNode } from "./callout";
import { markFromMarkdown } from "./mark";
import type { MarkdownFile, MdxJsxTextElement, VisitTree } from "./types";
import {
	hasChildren,
	isMarkdownNode,
	isTextNode,
	removeChildren,
} from "./util";
import { createLinkFromWikiLink, getWikiLinkTarget } from "./wiki-link";

type PluginOptions = {
	baseUrl?: string;
	markdownFiles?: MarkdownFile[];
	callout?: CalloutOptions;
};

type WikiLinkTarget = NonNullable<ReturnType<typeof getWikiLinkTarget>>;

const getParagraphChildren = ({ node }: { node: unknown }) => {
	if (!isMarkdownNode(node) || !hasChildren(node)) {
		return null;
	}

	return node.children;
};

const normalizeParagraphChildren = ({ children }: { children: unknown[] }) =>
	children.filter(
		(child) => !(isTextNode(child) && child.value.trim().length === 0),
	);

const getEmbedTargetFromParagraph = ({ node }: { node: unknown }) => {
	const children = getParagraphChildren({ node });

	if (!children) {
		return null;
	}

	const normalized = normalizeParagraphChildren({ children });

	if (normalized.length !== 2) {
		return null;
	}

	const [first, second] = normalized;

	if (!isTextNode(first) || first.value.trim() !== "!") {
		return null;
	}

	const target = getWikiLinkTarget({ node: second });

	if (!target || !target.page || target.anchor || target.anchorType) {
		return null;
	}

	return target;
};

const createEmbedHtml = ({
	target,
	markdownFiles,
}: {
	target: WikiLinkTarget;
	markdownFiles?: MarkdownFile[];
}) => {
	const file = markdownFiles?.find(
		(entry) => entry.file === `${target.page}.md`,
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
};

function plugin(this: any, options?: PluginOptions) {
	const data = this.data();

	(data.micromarkExtensions ??= []).push(
		wikiLink({ aliasDivider: "|" }),
		pandocMark(),
	);
	(data.fromMarkdownExtensions ??= []).push(
		wikiLinkFromMarkdown(),
		markFromMarkdown,
	);

	return (tree: VisitTree) => {
		const { baseUrl = "", markdownFiles } = options || {};

		visit<VisitTree, string>(tree, "paragraph", (node) => {
			const target = getEmbedTargetFromParagraph({ node });

			if (!target) {
				return;
			}

			const html = createEmbedHtml({ target, markdownFiles });

			if (!hasChildren(node)) {
				return;
			}

			removeChildren({ node });
			Object.assign(node, { type: "html", value: html });
		});

		visit<VisitTree, string>(tree, "wikiLink", (node, index, parent) => {
			if (!parent || !hasChildren(parent) || typeof index !== "number") {
				return;
			}

			const linkNode = createLinkFromWikiLink({
				node,
				baseUrl,
				markdownFiles,
			});

			if (!linkNode) {
				return;
			}

			parent.children.splice(index, 1, linkNode);
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

		visit<VisitTree, string>(tree, "mark", (node, index, parent) => {
			if (!parent || !hasChildren(parent) || typeof index !== "number") {
				return;
			}

			if (!isMarkdownNode(node) || !hasChildren(node)) {
				return;
			}

			const markNode: MdxJsxTextElement = {
				type: "mdxJsxTextElement",
				name: "mark",
				attributes: [],
				children: node.children,
			};

			parent.children.splice(index, 1, markNode);
			return;
		});
	};
}

export default plugin;
