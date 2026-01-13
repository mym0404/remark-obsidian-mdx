import { highlightMark } from "micromark-extension-highlight-mark";
import { visit } from "unist-util-visit";
import { type CalloutOptions, createCalloutNode } from "./callout";
import {
	buildContentResolverFromRoot,
	parseObsidianLink,
	resolveLink,
} from "./content-resolver";
import {
	type EmbedRenderingOptions,
	type EmbedRenderResult,
	type EmbedTarget,
	type EmbedPathTransformContext,
	renderEmbedNode,
	resolveEmbedUrls,
} from "./embed";
import { markFromMarkdown } from "./mark";
import { wikiLinkFromMarkdown } from "./micromark-extension/mdast-wiki-link";
import { wikiLinkSyntax } from "./micromark-extension/micromark-extension-wiki-link";
import type { MdxJsxTextElement, VisitTree } from "./types";
import { hasChildren, isMarkdownNode } from "./util";
import {
	createLinkFromWikiLink,
	getWikiLinkEmbed,
	getWikiLinkTarget,
} from "./wiki-link";
export type PluginOptions = {
	callout?: CalloutOptions;
	embedRendering?: EmbedRenderingOptions;
	contentRoot?: string;
	resolvedUrlWithExtension?: boolean;
	embedingPathTransform?: (
		context: EmbedPathTransformContext,
	) =>
		| string
		| {
				resolvedUrl?: string;
				resolvedUrlWithExtension?: string;
		  }
		| null
		| undefined;
};

export {
	addFileToResolver,
	buildContentResolver,
	buildContentResolverFromRoot,
	createContentResolverIndex,
	parseObsidianLink,
	removeFileFromResolver,
	resolveLink,
} from "./content-resolver";
export type { ContentResolverIndex, ParsedLink, PathEntry } from "./content-resolver";
export type {
	EmbedRenderContext,
	EmbedRenderingOptions,
	EmbedRenderResult,
	EmbedTarget,
} from "./embed";

export type { EmbedPathTransformContext } from "./embed";

const normalizePath = (value: string) =>
	value.replace(/\\/g, "/").replace(/\/+/g, "/").trim();

const toLinkUrl = ({
	resolvedPath,
	contentRoot,
	withExtension,
}: {
	resolvedPath: string;
	contentRoot?: string;
	withExtension?: boolean;
}) => {
	const normalizedPath = normalizePath(resolvedPath);

	if (!contentRoot) {
		const withoutLeading = normalizedPath.replace(/^\/+/, "");
		if (withExtension) {
			return `/${withoutLeading}`;
		}
		return `/${withoutLeading.replace(/\.[^/.]+$/, "")}`;
	}

	const normalizedRoot = normalizePath(contentRoot).replace(/\/$/, "");
	const withoutRoot = normalizedPath.startsWith(normalizedRoot)
		? normalizedPath.slice(normalizedRoot.length)
		: normalizedPath;

	const trimmed = withoutRoot.replace(/^\//, "");
	if (withExtension) {
		return `/${trimmed}`;
	}
	return `/${trimmed.replace(/\.[^/.]+$/, "")}`;
};

const resolveTargetPath = ({
	target,
	resolver,
}: {
	target: EmbedTarget;
	resolver?: ReturnType<typeof buildContentResolverFromRoot>;
}) => {
	if (!resolver) {
		return null;
	}

	const parsed = parseObsidianLink(`[[${target.page}]]`);

	if (!parsed) {
		return null;
	}

	return resolveLink(resolver, parsed);
};

function plugin(this: any, options?: PluginOptions) {
	const data = this.data();

	(data.micromarkExtensions ??= []).push(
		wikiLinkSyntax({ aliasDivider: "|" }),
		highlightMark(),
	);
	(data.fromMarkdownExtensions ??= []).push(
		wikiLinkFromMarkdown(),
		markFromMarkdown,
	);

	return (tree: VisitTree) => {
		const {
			embedRendering,
			contentRoot,
			resolvedUrlWithExtension,
			embedingPathTransform,
		} = options || {};
		const resolver = contentRoot
			? buildContentResolverFromRoot(contentRoot)
			: undefined;

		const replaceNode = (index: number, parent: VisitTree, node: unknown) => {
			parent.children.splice(index, 1, node as VisitTree["children"][number]);
		};

		visit<VisitTree, string>(tree, "wikiLink", (node, index, parent) => {
			if (!parent || !hasChildren(parent) || typeof index !== "number") {
				return;
			}

			const target = getWikiLinkTarget({ node });

			if (getWikiLinkEmbed({ node })) {
				if (!target || target.anchor || target.anchorType) {
					return;
				}

				const resolvedPath = resolveTargetPath({
					target,
					resolver,
				});
				const { resolvedUrl, resolvedUrlWithExtension } = resolveEmbedUrls({
					target,
					contentRoot,
					resolvedPath: resolvedPath ?? undefined,
					pathTransform: embedingPathTransform,
				});

				const rendered = renderEmbedNode({
					target,
					embedRendering,
					contentRoot,
					resolvedPath: resolvedPath ?? undefined,
					resolvedUrl,
					resolvedUrlWithExtension,
				});

				if (rendered) {
					replaceNode(index, parent, rendered);
				}

				return;
			}

			if (!target) {
				return;
			}

			const resolvedPath = target.page
				? resolveTargetPath({
						target,
						resolver,
					})
				: null;
			const resolvedUrl = resolvedPath
				? toLinkUrl({
						resolvedPath,
						contentRoot,
						withExtension: resolvedUrlWithExtension,
					})
				: undefined;

			const linkNode = createLinkFromWikiLink({ node, resolvedUrl });

			if (linkNode) {
				replaceNode(index, parent, linkNode);
			}
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
