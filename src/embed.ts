import fs from "node:fs";
import { imageSize } from "image-size";
import { resolveContentUrl } from "./content-resolver";
import type {
	MarkdownNode,
	MdxJsxFlowElement,
	MdxJsxTextElement,
	RootNode,
} from "./types";
import { parseWikiTarget } from "./wiki-link";

export type EmbedTarget = { value: string } & ReturnType<
	typeof parseWikiTarget
>;

export type EmbedRenderResult =
	| Exclude<MarkdownNode, RootNode>
	| MdxJsxFlowElement
	| MdxJsxTextElement;

type EmbedRenderContextBase = {
	target: EmbedTarget;
	contentRoot?: string;
	resolvedUrl?: string;
	alias?: string;
};

type EmbedRenderNoteContext = EmbedRenderContextBase & {
	kind: "note";
	isResolved: true;
};

type EmbedRenderImageContext = EmbedRenderContextBase & {
	kind: "image";
	imageWidth?: number;
	imageHeight?: number;
	isResolved: true;
};

type EmbedRenderVideoContext = EmbedRenderContextBase & {
	kind: "video";
	isResolved: true;
};

type EmbedRenderNotFoundContext = EmbedRenderContextBase & {
	kind: "note" | "image" | "video";
	isResolved: false;
};

export type EmbedRenderContext =
	| EmbedRenderNoteContext
	| EmbedRenderImageContext
	| EmbedRenderVideoContext
	| EmbedRenderNotFoundContext;

export type EmbedPathTransformContext = {
	kind: ReturnType<typeof getEmbedKind>;
	target: EmbedTarget;
	contentRoot: string;
	resolvedUrl?: string;
};

export type EmbedRenderingOptions = {
	note?: (context: EmbedRenderNoteContext) => EmbedRenderResult | null;
	image?: (context: EmbedRenderImageContext) => EmbedRenderResult | null;
	video?: (context: EmbedRenderVideoContext) => EmbedRenderResult | null;
	notFound?: (context: EmbedRenderNotFoundContext) => EmbedRenderResult | null;
};

const IMAGE_EXTENSIONS = new Set([
	"apng",
	"avif",
	"gif",
	"jpeg",
	"jpg",
	"png",
	"svg",
	"webp",
]);

const VIDEO_EXTENSIONS = new Set(["m4v", "mov", "mp4", "ogv", "webm"]);

const getFileExtension = (value: string) => {
	const lastDotIndex = value.lastIndexOf(".");

	if (lastDotIndex <= 0 || lastDotIndex === value.length - 1) {
		return "";
	}

	return value.slice(lastDotIndex + 1).toLowerCase();
};

export const getEmbedKind = (target: EmbedTarget) => {
	const extension = getFileExtension(target.page);

	if (extension === "md" || extension === "mdx" || extension === "") {
		return "note";
	}

	if (IMAGE_EXTENSIONS.has(extension)) {
		return "image";
	}

	if (VIDEO_EXTENSIONS.has(extension)) {
		return "video";
	}

	return "unsupported";
};

export const resolveEmbedUrl = ({
	target,
	contentRoot,
	contentRootUrlPrefix,
	resolvedPath,
	pathTransform,
}: {
	target: EmbedTarget;
	contentRoot: string;
	contentRootUrlPrefix?: string;
	resolvedPath?: string;
	pathTransform?: (
		context: EmbedPathTransformContext,
	) => string | null | undefined;
}) => {
	const resolvedUrl = resolvedPath
		? resolveContentUrl({
				resolvedPath,
				contentRoot,
				contentRootUrlPrefix,
				withExtension: true,
			})
		: undefined;

	const kind = getEmbedKind(target);
	const transformed = pathTransform?.({
		kind,
		target,
		contentRoot,
		resolvedUrl,
	});
	if (typeof transformed === "string") {
		return transformed;
	}

	return resolvedUrl;
};

const buildImageNode = ({
	target,
	resolvedUrl,
	imageWidth,
	imageHeight,
}: {
	target: EmbedTarget;
	resolvedUrl?: string;
	imageWidth?: number;
	imageHeight?: number;
}) => {
	const url = resolvedUrl ?? target.page;
	const hProperties: { width?: number; height?: number } = {};

	if (typeof imageWidth === "number") {
		hProperties.width = imageWidth;
	}
	if (typeof imageHeight === "number") {
		hProperties.height = imageHeight;
	}

	return {
		type: "image",
		url,
		alt: "",
		title: undefined,
		data:
			hProperties.width || hProperties.height
				? {
						hProperties,
					}
				: undefined,
	};
};

const buildVideoNode = ({
	target,
	resolvedUrl,
}: {
	target: EmbedTarget;
	resolvedUrl?: string;
}) => {
	const url = resolvedUrl ?? target.page;
	return {
		type: "mdxJsxFlowElement",
		name: "video",
		attributes: [
			{
				type: "mdxJsxAttribute",
				name: "src",
				value: url,
			},
			{
				type: "mdxJsxAttribute",
				name: "controls",
				value: "true",
			},
		],
		children: [],
	};
};

const buildNotFoundNode = (target: EmbedTarget) => ({
	type: "mdxJsxFlowElement",
	name: "div",
	attributes: [],
	children: [
		{
			type: "text",
			value: `Embed not found: ${target.page}`,
		},
	],
});

const getImageDimensions = (resolvedPath?: string) => {
	if (!resolvedPath || !fs.existsSync(resolvedPath)) {
		return { width: undefined, height: undefined };
	}

	try {
		const { width, height } = imageSize(resolvedPath);
		return {
			width: typeof width === "number" ? width : undefined,
			height: typeof height === "number" ? height : undefined,
		};
	} catch {
		return { width: undefined, height: undefined };
	}
};

export const renderEmbedNode = ({
	target,
	embedRendering,
	contentRoot,
	resolvedPath,
	resolvedUrl,
	alias,
}: {
	target: EmbedTarget;
	embedRendering?: EmbedRenderingOptions;
	contentRoot?: string;
	resolvedPath?: string;
	resolvedUrl?: string;
	alias?: string;
}) => {
	const kind = getEmbedKind(target);
	if (kind === "unsupported") {
		return null;
	}

	const { width: imageWidth, height: imageHeight } =
		kind === "image"
			? getImageDimensions(resolvedPath)
			: { width: undefined, height: undefined };

	const isResolved = !contentRoot || Boolean(resolvedPath);
	if (!isResolved && embedRendering?.notFound) {
		return embedRendering.notFound({
			target,
			contentRoot,
			resolvedUrl,
			alias,
			kind,
			isResolved: false,
		});
	}
	if (!isResolved) {
		return buildNotFoundNode(target);
	}

	if (kind === "image") {
		const render =
			embedRendering?.image ??
			((context: EmbedRenderImageContext) =>
				buildImageNode({
					target: context.target,
					resolvedUrl: context.resolvedUrl,
					imageWidth: context.imageWidth,
					imageHeight: context.imageHeight,
				}));

		return render({
			target,
			contentRoot,
			resolvedUrl,
			alias,
			imageWidth,
			imageHeight,
			kind,
			isResolved: true,
		});
	}

	if (kind === "video") {
		const render =
			embedRendering?.video ??
			((context: EmbedRenderVideoContext) =>
				buildVideoNode({
					target: context.target,
					resolvedUrl: context.resolvedUrl,
				}));

		return render({
			target,
			contentRoot,
			resolvedUrl,
			alias,
			kind,
			isResolved: true,
		});
	}

	if (kind === "note") {
		const render = embedRendering?.note;
		if (!render) {
			return null;
		}

		return render({
			target,
			contentRoot,
			resolvedUrl,
			alias,
			kind,
			isResolved: true,
		});
	}

	return null;
};
