declare module "micromark-extension-mark" {
	export const pandocMark: (options?: unknown) => unknown;
}

declare module "micromark-extension-wiki-link" {
	export const syntax: (options?: { aliasDivider?: string }) => unknown;
}

declare module "mdast-util-wiki-link" {
	export const fromMarkdown: (options?: {
		permalinks?: string[];
		pageResolver?: (name: string) => string[];
		newClassName?: string;
		wikiLinkClassName?: string;
		hrefTemplate?: (permalink: string) => string;
	}) => unknown;
}
