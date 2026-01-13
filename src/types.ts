import type { Nodes } from "mdast";
import type { visit } from "unist-util-visit";

export type MarkdownNode = Nodes;

export type ChildrenNode = {
	children?: unknown[];
};

export type ChildrenNodeWithChildren = ChildrenNode & {
	children: unknown[];
};

export type ParagraphNode = MarkdownNode & {
	type: "paragraph";
	children: unknown[];
};

export type LinkNode = MarkdownNode & {
	type: "link";
	url: string;
	title?: string;
	children: unknown[];
	data?: {
		hProperties?: {
			className?: string[];
		};
	};
};

export type RootNode = {
	type: "root";
	children: unknown[];
};

export type MdxJsxAttribute = {
	type: "mdxJsxAttribute";
	name: string;
	value: string;
};

export type MdxJsxFlowElement = {
	type: "mdxJsxFlowElement";
	name: string;
	attributes: MdxJsxAttribute[];
	children: unknown[];
};

export type MdxJsxTextElement = {
	type: "mdxJsxTextElement";
	name: string;
	attributes: MdxJsxAttribute[];
	children: unknown[];
};

export type VisitTreeNode = Parameters<typeof visit>[0];

export type VisitTree = VisitTreeNode & {
	children: VisitTreeNode[];
};
