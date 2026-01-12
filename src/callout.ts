import { toString as mdastToString } from "mdast-util-to-string";
import {
	hasChildren,
	isMarkdownNode,
	isParagraphNode,
	isTextNode,
	type MarkdownNode,
	type ParagraphNode,
} from "./ast";
import { CALLOUT_REGEX } from "./constants";

export type CalloutOptions = {
	componentName?: string;
	typeMap?: Record<string, string>;
	typePropName?: string;
	defaultType?: string;
};

type MdxJsxAttribute = {
	type: "mdxJsxAttribute";
	name: string;
	value: string;
};

const DEFAULT_CALLOUT_TYPE_MAP = {
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
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

const isMdxJsxAttribute = (value: unknown): value is MdxJsxAttribute =>
	isRecord(value) &&
	value.type === "mdxJsxAttribute" &&
	typeof value.name === "string" &&
	typeof value.value === "string";

const parseCalloutMarker = ({ text }: { text: string }) => {
	const match = text.match(CALLOUT_REGEX);

	if (!match?.groups?.type) {
		return null;
	}

	const rawType = match.groups.type.toLowerCase();
	const title = match.groups.title?.trim();

	return {
		rawType,
		title: title || undefined,
	};
};

const normalizeTypeMap = ({
	typeMap,
}: {
	typeMap?: Record<string, string>;
}) => {
	if (!typeMap) {
		return DEFAULT_CALLOUT_TYPE_MAP;
	}

	const entries = Object.entries(typeMap)
		.filter(([, value]) => typeof value === "string")
		.map(([key, value]) => [key.toLowerCase(), value.trim()]);

	return Object.fromEntries(entries);
};

const resolveCalloutType = ({
	rawType,
	typeMap,
	defaultType,
}: {
	rawType: string;
	typeMap: Record<string, string>;
	defaultType: string;
}) => {
	const mapped = typeMap[rawType];
	const normalized = typeof mapped === "string" ? mapped.trim() : "";
	return normalized || defaultType;
};

const getParagraphFirstLine = ({ paragraph }: { paragraph: ParagraphNode }) => {
	const text = mdastToString(paragraph);
	return text.split("\n")[0] ?? "";
};

const getCalloutBodyParagraph = ({
	paragraph,
}: {
	paragraph: ParagraphNode;
}) => {
	const [firstChild] = paragraph.children;

	if (!isTextNode(firstChild)) {
		return null;
	}

	const [, ...restLines] = firstChild.value.split("\n");

	if (restLines.length === 0) {
		return null;
	}

	const restText = restLines.join("\n");

	if (!restText.trim()) {
		return null;
	}

	paragraph.children = [{ type: "text", value: restText }];

	return paragraph;
};

const buildCalloutAttributes = ({
	calloutType,
	title,
	typePropName,
}: {
	calloutType: string;
	title?: string;
	typePropName: string;
}) =>
	[
		{ type: "mdxJsxAttribute", name: typePropName, value: calloutType },
		title ? { type: "mdxJsxAttribute", name: "title", value: title } : null,
	].filter(isMdxJsxAttribute);

const getBlockquoteChildren = ({
	blockquote,
}: {
	blockquote: MarkdownNode;
}) => {
	if (!hasChildren(blockquote)) {
		return null;
	}

	return blockquote.children.filter(isMarkdownNode);
};

export const createCalloutNode = ({
	blockquote,
	options,
}: {
	blockquote: unknown;
	options?: CalloutOptions;
}) => {
	if (!isMarkdownNode(blockquote)) {
		return null;
	}

	const children = getBlockquoteChildren({ blockquote });

	if (!children?.length) {
		return null;
	}

	const firstChild = children[0];

	if (!isParagraphNode(firstChild)) {
		return null;
	}

	const marker = parseCalloutMarker({
		text: getParagraphFirstLine({ paragraph: firstChild }),
	});

	if (!marker) {
		return null;
	}

	const typeMap = normalizeTypeMap({ typeMap: options?.typeMap });
	const defaultType = options?.defaultType ?? "info";
	const typePropName = options?.typePropName ?? "type";
	const componentName = options?.componentName ?? "Callout";
	const calloutType = resolveCalloutType({
		rawType: marker.rawType,
		typeMap,
		defaultType,
	});
	const restChildren = children.slice(1);
	const bodyParagraph = getCalloutBodyParagraph({ paragraph: firstChild });

	const calloutChildren = bodyParagraph
		? [bodyParagraph, ...restChildren]
		: restChildren;

	return {
		type: "mdxJsxFlowElement",
		name: componentName,
		attributes: buildCalloutAttributes({
			calloutType,
			title: marker.title,
			typePropName,
		}),
		children: calloutChildren,
	};
};
