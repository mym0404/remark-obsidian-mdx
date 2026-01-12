import type { toString as mdastToString } from "mdast-util-to-string";
import { visit } from "unist-util-visit";

export type MarkdownNode = Parameters<typeof mdastToString>[0];

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

export type VisitTreeNode = Parameters<typeof visit>[0];

export type VisitTree = VisitTreeNode & {
	children: VisitTreeNode[];
};
