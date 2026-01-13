import fs from "node:fs";
import { imageSize } from "image-size";
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

export type EmbedRenderContext = {
	target: EmbedTarget;
	contentRoot?: string;
	resolvedPath?: string;
	resolvedUrl?: string;
	resolvedUrlWithExtension?: string;
	imageWidth?: number;
	imageHeight?: number;
	kind: "note" | "image" | "video";
	isResolved: boolean;
};

export type EmbedPathTransformContext = {
	kind: ReturnType<typeof getEmbedKind>;
	target: EmbedTarget;
	contentRoot?: string;
	resolvedPath?: string;
	resolvedUrl?: string;
	resolvedUrlWithExtension?: string;
};

export type EmbedRenderingOptions = {
	note?: (context: EmbedRenderContext) => EmbedRenderResult | null;
	image?: (context: EmbedRenderContext) => EmbedRenderResult | null;
	video?: (context: EmbedRenderContext) => EmbedRenderResult | null;
	notFound?: (context: EmbedRenderContext) => EmbedRenderResult | null;
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

const normalizePath = (value: string) =>
	value.replace(/\\/g, "/").replace(/\/+/g, "/").trim();

const toContentUrl = ({
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

const shouldKeepExtension = (target?: EmbedTarget) => {
	if (!target) {
		return false;
	}

	const kind = getEmbedKind(target);
	return kind === "image" || kind === "video";
};

export const resolveEmbedUrls = ({
	target,
	contentRoot,
	resolvedPath,
	pathTransform,
}: {
	target: EmbedTarget;
	contentRoot?: string;
	resolvedPath?: string;
	pathTransform?: (
		context: EmbedPathTransformContext,
	) =>
		| string
		| {
				resolvedUrl?: string;
				resolvedUrlWithExtension?: string;
		  }
		| null
		| undefined;
}) => {
	const resolvedUrl = resolvedPath
		? toContentUrl({
				resolvedPath,
				contentRoot,
			})
		: undefined;
	const resolvedUrlWithExtension = resolvedPath
		? toContentUrl({
				resolvedPath,
				contentRoot,
				withExtension: true,
			})
		: undefined;
	let transformedResolvedUrl = resolvedUrl;
	let transformedResolvedUrlWithExtension = resolvedUrlWithExtension;

	const kind = getEmbedKind(target);
	const transformed = pathTransform?.({
		kind,
		target,
		contentRoot,
		resolvedPath,
		resolvedUrl,
		resolvedUrlWithExtension,
	});
	if (typeof transformed === "string") {
		transformedResolvedUrl = transformed;
		transformedResolvedUrlWithExtension = transformed;
	} else if (transformed) {
		if (typeof transformed.resolvedUrl === "string") {
			transformedResolvedUrl = transformed.resolvedUrl;
		}
		if (typeof transformed.resolvedUrlWithExtension === "string") {
			transformedResolvedUrlWithExtension =
				transformed.resolvedUrlWithExtension;
		}
	}

	const preferExtension = shouldKeepExtension(target);
	const resolvedUrlPreferred = preferExtension
		? transformedResolvedUrlWithExtension ?? transformedResolvedUrl
		: transformedResolvedUrl;

	return {
		resolvedUrl: resolvedUrlPreferred,
		resolvedUrlWithExtension: transformedResolvedUrlWithExtension,
	};
};

const buildImageNode = ({
	target,
	resolvedPath,
	resolvedUrl,
	imageWidth,
	imageHeight,
}: {
	target: EmbedTarget;
	resolvedPath?: string;
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
		alt: target.page,
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
	type: "text",
	value: `Embed not found: ${target.page}`,
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
	resolvedUrlWithExtension,
}: {
	target: EmbedTarget;
	embedRendering?: EmbedRenderingOptions;
	contentRoot?: string;
	resolvedPath?: string;
	resolvedUrl?: string;
	resolvedUrlWithExtension?: string;
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
			resolvedPath,
			resolvedUrl,
			resolvedUrlWithExtension,
			imageWidth,
			imageHeight,
			kind,
			isResolved,
		});
	}
	if (!isResolved) {
		return buildNotFoundNode(target);
	}

	const render =
		embedRendering?.[kind] ??
		(kind === "image"
			? (context: EmbedRenderContext) =>
					buildImageNode({
						target: context.target,
						resolvedPath: context.resolvedPath,
						resolvedUrl: context.resolvedUrl,
						imageWidth: context.imageWidth,
						imageHeight: context.imageHeight,
					})
			: kind === "video"
				? (context: EmbedRenderContext) =>
						buildVideoNode({
							target: context.target,
							resolvedUrl: context.resolvedUrl,
						})
				: undefined);

	if (!render) {
		return null;
	}

	return render({
		target,
		contentRoot,
		resolvedPath,
		resolvedUrl,
		resolvedUrlWithExtension,
		imageWidth,
		imageHeight,
		kind,
		isResolved,
	});
};
