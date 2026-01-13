import type {
	ChildrenNodeWithChildren,
	MarkdownNode,
	ParagraphNode,
} from "./types";

export const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

export const hasChildren = (
	value: unknown,
): value is ChildrenNodeWithChildren =>
	isRecord(value) && Array.isArray(value.children);

export const isMarkdownNode = (value: unknown): value is MarkdownNode =>
	isRecord(value) && "type" in value;

export const isParagraphNode = (value: unknown): value is ParagraphNode =>
	isMarkdownNode(value) && value.type === "paragraph" && hasChildren(value);

export const isTextNode = (
	value: unknown,
): value is { type: "text"; value: string } =>
	isRecord(value) && value.type === "text" && typeof value.value === "string";
