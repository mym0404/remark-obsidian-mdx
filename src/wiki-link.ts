import slugify from "slugify";
import { isRecord } from "./util";

type WikiLinkNode = {
	type: "wikiLink";
	value?: string;
	data?: {
		alias?: string;
		embed?: boolean;
	};
};

const isWikiLinkNode = (value: unknown): value is WikiLinkNode =>
	isRecord(value) && value.type === "wikiLink";

const getWikiLinkValue = ({ node }: { node: WikiLinkNode }) => {
	const value = typeof node.value === "string" ? node.value.trim() : "";
	return value;
};

const getWikiLinkAlias = ({ node }: { node: WikiLinkNode }) => {
	const alias =
		typeof node.data?.alias === "string" ? node.data.alias.trim() : "";
	return alias;
};

export const getWikiLinkEmbed = ({ node }: { node: unknown }) => {
	if (!isWikiLinkNode(node)) {
		return false;
	}

	return Boolean(node.data?.embed);
};

export type WikiAnchorType = "" | "#" | "^";

export type WikiLinkTarget = { value: string } & ReturnType<
	typeof parseWikiTarget
>;

export type WikiLinkPathTransformContext = {
	target: WikiLinkTarget;
	contentRoot: string;
	resolvedUrl?: string;
};

export const parseWikiTarget = ({ value }: { value: string }) => {
	const headingIndex = value.indexOf("#");
	const blockIndex = value.indexOf("^");

	const hasHeading = headingIndex !== -1;
	const hasBlock = blockIndex !== -1;

	if (!hasHeading && !hasBlock) {
		return { page: value, anchor: "", anchorType: "" as WikiAnchorType };
	}

	const useHeading = hasHeading && (!hasBlock || headingIndex < blockIndex);
	const index = useHeading ? headingIndex : blockIndex;
	const anchorType = (useHeading ? "#" : "^") as WikiAnchorType;

	const page = value.slice(0, index).trim();
	const anchor = value.slice(index + 1).trim();

	return { page, anchor, anchorType };
};

export const getWikiLinkTarget = ({ node }: { node: unknown }) => {
	if (!isWikiLinkNode(node)) {
		return null;
	}

	const value = getWikiLinkValue({ node });

	if (!value) {
		return null;
	}

	return { value, ...parseWikiTarget({ value }) };
};

const resolvePageUrl = ({ page }: { page: string }) =>
	`/${slugify(page, { lower: true })}`;

const resolveAnchor = ({
	anchor,
	anchorType,
	isHeadingOnly,
}: {
	anchor: string;
	anchorType: string;
	isHeadingOnly: boolean;
}) => {
	if (!anchor) {
		return "";
	}

	if (anchorType === "^") {
		return `#^${anchor}`;
	}

	const slug = isHeadingOnly
		? slugify(anchor, { remove: /[.,]/g, lower: true })
		: slugify(anchor, { lower: true });

	return `#${slug}`;
};

const resolveLinkText = ({
	alias,
	page,
	anchor,
	hasAlias,
}: {
	alias: string;
	page: string;
	anchor: string;
	hasAlias: boolean;
}) => {
	if (hasAlias && alias) {
		return alias;
	}

	if (page) {
		return page;
	}

	return anchor;
};

export const createLinkFromWikiLink = ({
	node,
	resolvedUrl,
}: {
	node: unknown;
	resolvedUrl?: string;
}) => {
	if (!isWikiLinkNode(node)) {
		return null;
	}

	const value = getWikiLinkValue({ node });

	if (!value) {
		return null;
	}

	const alias = getWikiLinkAlias({ node });
	const hasAlias = alias.length > 0 && alias !== value;
	const { page, anchor, anchorType } = parseWikiTarget({ value });
	const isHeadingOnly = !page && anchorType === "#";

	const linkText = resolveLinkText({
		alias,
		page,
		anchor,
		hasAlias,
	});

	const anchorHash = resolveAnchor({
		anchor,
		anchorType,
		isHeadingOnly,
	});

	if (!page) {
		return {
			type: "link",
			url: anchorHash || "#",
			title: linkText || undefined,
			children: linkText ? [{ type: "text", value: linkText }] : [],
		};
	}

	const pageUrl = resolvedUrl ?? resolvePageUrl({ page });
	const url = `${pageUrl}${anchorHash}`;

	return {
		type: "link",
		url,
		title: linkText || undefined,
		children: linkText ? [{ type: "text", value: linkText }] : [],
	};
};
