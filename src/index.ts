import { highlightMark } from "micromark-extension-highlight-mark";
import { SKIP, visit } from "unist-util-visit";
import { type CalloutOptions, createCalloutNode } from "./callout";
import {
	buildContentResolverFromRoot,
	parseObsidianLink,
	resolveContentUrl,
	resolveLink,
} from "./content-resolver";
import {
	type EmbedPathTransformContext,
	type EmbedRenderingOptions,
	type EmbedRenderResult,
	type EmbedTarget,
	getEmbedKind,
	renderEmbedNode,
	resolveEmbedUrl,
} from "./embed";
import { markFromMarkdown } from "./mark";
import { wikiLinkFromMarkdown } from "./micromark-extension/mdast-wiki-link";
import { wikiLinkSyntax } from "./micromark-extension/micromark-extension-wiki-link";
import type { MdxJsxTextElement, VisitTree } from "./types";
import { hasChildren, isMarkdownNode } from "./util";
import {
	createLinkFromWikiLink,
	getWikiLinkAlias,
	getWikiLinkEmbed,
	getWikiLinkTarget,
	type WikiLinkPathTransformContext,
} from "./wiki-link";
export type PluginOptions = {
	callout?: CalloutOptions;
	embedRendering?: EmbedRenderingOptions;
	contentRoot: string;
	contentRootUrlPrefix?: string;
	embedingPathTransform?: (
		context: EmbedPathTransformContext,
	) => string | null | undefined;
	wikiLinkPathTransform?: (
		context: WikiLinkPathTransformContext,
	) => string | null | undefined;
};

export type {
	ContentResolverIndex,
	ParsedLink,
	PathEntry,
} from "./content-resolver";
export {
	addFileToResolver,
	buildContentResolver,
	buildContentResolverFromRoot,
	createContentResolverIndex,
	parseObsidianLink,
	removeFileFromResolver,
	resolveContentUrl,
	resolveLink,
} from "./content-resolver";
export type {
	EmbedPathTransformContext,
	EmbedRenderContext,
	EmbedRenderingOptions,
	EmbedRenderResult,
	EmbedTarget,
} from "./embed";
export type { WikiLinkPathTransformContext, WikiLinkTarget } from "./wiki-link";

const resolveTargetPath = ({
	target,
	resolver,
}: {
	target: EmbedTarget;
	resolver: ReturnType<typeof buildContentResolverFromRoot>;
}) => {
	const parsed = parseObsidianLink(`[[${target.page}]]`);

	if (!parsed) {
		return null;
	}

	return resolveLink(resolver, parsed);
};

const resolveWikiLinkUrl = ({
	target,
	contentRoot,
	contentRootUrlPrefix,
	resolvedPath,
	pathTransform,
}: {
	target: NonNullable<ReturnType<typeof getWikiLinkTarget>>;
	contentRoot: string;
	contentRootUrlPrefix?: string;
	resolvedPath?: string;
	pathTransform?: (
		context: WikiLinkPathTransformContext,
	) => string | null | undefined;
}) => {
	const resolvedUrl = resolvedPath
		? resolveContentUrl({
				resolvedPath,
				contentRoot,
				contentRootUrlPrefix,
				withExtension: false,
			})
		: undefined;

	const transformed = pathTransform?.({
		target,
		contentRoot,
		resolvedUrl,
	});
	if (typeof transformed === "string") {
		return transformed;
	}

	return resolvedUrl;
};

function plugin(this: any, options: PluginOptions) {
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
			contentRootUrlPrefix,
			embedingPathTransform,
			wikiLinkPathTransform,
		} = options;
		const resolver = buildContentResolverFromRoot(contentRoot);

		const replaceNode = (index: number, parent: VisitTree, node: unknown) => {
			parent.children.splice(index, 1, node as VisitTree["children"][number]);
		};

		const isMdxFlowElement = (node: { type?: string }) =>
			node.type === "mdxJsxFlowElement";

		const wrapAsFlowElement = (node: unknown) => ({
			type: "mdxJsxFlowElement",
			name: "div",
			attributes: [],
			children: [node],
		});

		visit<VisitTree, string>(tree, "paragraph", (node, index, parent) => {
			if (!parent || !hasChildren(parent) || typeof index !== "number") {
				return;
			}

			if (!hasChildren(node) || node.children.length !== 1) {
				return;
			}

			const [onlyChild] = node.children;
			if (!getWikiLinkEmbed({ node: onlyChild })) {
				return;
			}

			const target = getWikiLinkTarget({ node: onlyChild });
			if (!target || target.anchor || target.anchorType) {
				return;
			}
			const alias = getWikiLinkAlias({ node: onlyChild });

			const resolvedPath = resolveTargetPath({
				target,
				resolver,
			});
			const resolvedUrl = resolveEmbedUrl({
				target,
				contentRoot,
				contentRootUrlPrefix,
				resolvedPath: resolvedPath ?? undefined,
				pathTransform: embedingPathTransform,
			});
			const kind = getEmbedKind(target);
			const isResolved = Boolean(resolvedPath);

			if (kind !== "note" && isResolved) {
				return;
			}

			const rendered = renderEmbedNode({
				target,
				embedRendering,
				contentRoot,
				resolvedPath: resolvedPath ?? undefined,
				resolvedUrl,
				alias,
			});

			if (rendered) {
				const replacement = isMdxFlowElement(rendered)
					? rendered
					: wrapAsFlowElement(rendered);
				replaceNode(index, parent, replacement);
				return SKIP;
			}
		});

		visit<VisitTree, string>(tree, "wikiLink", (node, index, parent) => {
			if (!parent || !hasChildren(parent) || typeof index !== "number") {
				return;
			}

			const target = getWikiLinkTarget({ node });

			if (getWikiLinkEmbed({ node })) {
				if (!target || target.anchor || target.anchorType) {
					return;
				}
				const alias = getWikiLinkAlias({ node });

				const resolvedPath = resolveTargetPath({
					target,
					resolver,
				});
				const resolvedUrl = resolveEmbedUrl({
					target,
					contentRoot,
					contentRootUrlPrefix,
					resolvedPath: resolvedPath ?? undefined,
					pathTransform: embedingPathTransform,
				});

				const rendered = renderEmbedNode({
					target,
					embedRendering,
					contentRoot,
					resolvedPath: resolvedPath ?? undefined,
					resolvedUrl,
					alias,
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
			const resolvedUrl = resolveWikiLinkUrl({
				target,
				contentRoot,
				contentRootUrlPrefix,
				resolvedPath: resolvedPath ?? undefined,
				pathTransform: wikiLinkPathTransform,
			});

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
