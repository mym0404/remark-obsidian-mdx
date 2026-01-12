import { toMarkdown } from "mdast-util-to-markdown";

export type MarkdownNode = Parameters<typeof toMarkdown>[0];

export type ChildrenNode = {
	children?: unknown[];
};

type ChildrenNodeWithChildren = {
	children: unknown[];
};

export type ParagraphNode = MarkdownNode &
	ChildrenNodeWithChildren & {
		type: "paragraph";
	};

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const hasChildren = (
	value: unknown,
): value is ChildrenNodeWithChildren =>
	isRecord(value) && Array.isArray(value.children);

export const isMarkdownNode = (value: unknown): value is MarkdownNode =>
	isRecord(value) && "type" in value;

export const isParagraphNode = (value: unknown): value is ParagraphNode =>
	isMarkdownNode(value) && value.type === "paragraph" && hasChildren(value);

export const isInlineCodeNode = (
	value: unknown,
): value is { type: "inlineCode"; value: string } =>
	isRecord(value) &&
	value.type === "inlineCode" &&
	typeof value.value === "string";

export const isStrongNode = (value: unknown): value is { type: "strong" } =>
	isRecord(value) && value.type === "strong";

export const isTextNode = (
	value: unknown,
): value is { type: "text"; value: string } =>
	isRecord(value) && value.type === "text" && typeof value.value === "string";

export const hasInlineCode = ({
	children,
	value,
}: {
	children: unknown[];
	value: string;
}) =>
	children.some((child) => isInlineCodeNode(child) && child.value === value);

export const removeChildren = ({ node }: { node: ChildrenNode }) => {
	delete node.children;
};
