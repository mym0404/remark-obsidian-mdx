import { toString as mdastToString } from "mdast-util-to-string";

import { remark } from "remark";
import { expect, test } from "vitest";
import plugin from "../src/index";
import type {
	ChildrenNodeWithChildren,
	HtmlNode,
	LinkNode,
	MarkdownNode,
	MdxJsxAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
	RootNode,
} from "../src/types";
import { isRecord } from "../src/util";

const isMarkdownNode = (value: unknown): value is MarkdownNode =>
	isRecord(value) && "type" in value;

const isMdxJsxAttribute = (value: unknown): value is MdxJsxAttribute =>
	isRecord(value) &&
	value.type === "mdxJsxAttribute" &&
	typeof value.name === "string" &&
	typeof value.value === "string";

const isMdxJsxFlowElement = (value: unknown): value is MdxJsxFlowElement =>
	isRecord(value) &&
	value.type === "mdxJsxFlowElement" &&
	typeof value.name === "string" &&
	Array.isArray(value.attributes) &&
	value.attributes.every(isMdxJsxAttribute) &&
	Array.isArray(value.children);

const isRootNode = (value: unknown): value is RootNode =>
	isRecord(value) && value.type === "root" && Array.isArray(value.children);

const hasChildren = (value: unknown): value is ChildrenNodeWithChildren =>
	isRecord(value) && Array.isArray(value.children);

const isStrongNode = (value: unknown): value is { type: "strong" } =>
	isRecord(value) && value.type === "strong";

const isLinkNode = (value: unknown): value is LinkNode =>
	isRecord(value) &&
	value.type === "link" &&
	typeof value.url === "string" &&
	Array.isArray(value.children);

const isHtmlNode = (value: unknown): value is HtmlNode =>
	isRecord(value) && value.type === "html" && typeof value.value === "string";

const isMdxJsxTextElement = (value: unknown): value is MdxJsxTextElement =>
	isRecord(value) &&
	value.type === "mdxJsxTextElement" &&
	typeof value.name === "string" &&
	Array.isArray(value.children);

const collectNodes = <T>({
	node,
	isMatch,
}: {
	node: unknown;
	isMatch: (value: unknown) => value is T;
}) => {
	const results: T[] = [];

	const visitNode = (value: unknown) => {
		if (isMatch(value)) {
			results.push(value);
		}

		if (!hasChildren(value)) {
			return;
		}

		value.children.forEach(visitNode);
	};

	visitNode(node);

	return results;
};

const getTree = async ({
	text,
	options,
}: {
	text: string;
	options?: Parameters<typeof plugin>[0];
}) => {
	const processor = remark().use(plugin, options);
	return processor.run(processor.parse(text));
};

const findCalloutNode = ({ tree }: { tree: unknown }) => {
	if (!isRootNode(tree)) {
		return null;
	}

	const callout = tree.children.find(
		(node): node is MdxJsxFlowElement =>
			isMdxJsxFlowElement(node) && node.name === "Callout",
	);

	return callout ?? null;
};

const getCalloutText = ({ callout }: { callout: MdxJsxFlowElement }) =>
	callout.children
		.filter(isMarkdownNode)
		.map((child) => mdastToString(child))
		.join("\n");

const findLinkNodes = ({ tree }: { tree: unknown }) =>
	collectNodes<LinkNode>({ node: tree, isMatch: isLinkNode });

const findMarkNodes = ({ tree }: { tree: unknown }) =>
	collectNodes<MdxJsxTextElement>({
		node: tree,
		isMatch: (value): value is MdxJsxTextElement =>
			isMdxJsxTextElement(value) && value.name === "mark",
	});

const findHtmlNodes = ({ tree }: { tree: unknown }) =>
	collectNodes<HtmlNode>({ node: tree, isMatch: isHtmlNode });

const getNodeText = ({ node }: { node: ChildrenNodeWithChildren }) =>
	node.children
		.filter(isMarkdownNode)
		.map((child) => mdastToString(child))
		.join("");

test("Should support ==highlight text==", async () => {
	const text = "==highlight text==";

	const tree = await getTree({ text });
	const marks = findMarkNodes({ tree });

	expect(marks).toHaveLength(1);
	expect(getNodeText({ node: marks[0] })).toBe("highlight text");
});

test("Should support ==**highlight text**==", async () => {
	const text = "==**highlight text**==";

	const tree = await getTree({ text });
	const marks = findMarkNodes({ tree });

	expect(marks).toHaveLength(1);
	expect(getNodeText({ node: marks[0] })).toBe("highlight text");
	expect(marks[0].children.some(isStrongNode)).toBe(true);
});

test("Should support [[Internal link]]", async () => {
	const text = "[[Internal link]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/internal-link");
	expect(link.title).toBe("Internal link");
	expect(mdastToString(link)).toBe("Internal link");
});

test("Should support **bold text** with an [[Internal link]]", async () => {
	const text = "**bold text** with [[Internal link]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });

	expect(links).toHaveLength(1);
	expect(links[0].url).toBe("/internal-link");
	expect(collectNodes({ node: tree, isMatch: isStrongNode })).toHaveLength(1);
});

test("Should support [[Internal link]] with text around", async () => {
	const text = "start [[Internal link]] end";
	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });

	expect(links).toHaveLength(1);
	expect(links[0].url).toBe("/internal-link");
});

test("Should support [[Internal link|With custom text]]", async () => {
	const text = "[[Internal link|With custom text]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/internal-link");
	expect(link.title).toBe("With custom text");
	expect(mdastToString(link)).toBe("With custom text");
});

test("Should support multiple [[Internal link]] on the same paragraph", async () => {
	const text = "start [[Internal link]] [[Second link]] end";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });

	expect(links).toHaveLength(2);
	expect(links.map((link) => link.url)).toEqual([
		"/internal-link",
		"/second-link",
	]);
});

test("Should support [[Internal link#heading]]", async () => {
	const text = "[[Internal link#heading]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/internal-link#heading");
	expect(mdastToString(link)).toBe("Internal link");
});

test("Should support [[Internal link#heading|With custom text]]", async () => {
	const text = "[[Internal link#heading|With custom text]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/internal-link#heading");
	expect(link.title).toBe("With custom text");
	expect(mdastToString(link)).toBe("With custom text");
});

test("Should support french accents", async () => {
	const text = "[[Productivité]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/productivite");
	expect(mdastToString(link)).toBe("Productivité");
});

test("Should ignore bracket links inside code blocks", async () => {
	const text = "`[[Internal Link]]`";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });

	expect(links).toHaveLength(0);
});

test("Should ignore highlights inside code blocks", async () => {
	const text = "`==Highlight==`";

	const tree = await getTree({ text });
	const marks = findMarkNodes({ tree });

	expect(marks).toHaveLength(0);
});

test("Should support > [!CALLOUT]", async () => {
	const text = ["> [!NOTE]", "> This is a note"].join("\n");

	const processor = remark().use(plugin);
	const tree = await processor.run(processor.parse(text));
	const callout = findCalloutNode({ tree });

	if (!callout) {
		throw new Error("Callout not found");
	}

	expect(callout.attributes).toContainEqual({
		type: "mdxJsxAttribute",
		name: "type",
		value: "info",
	});
	expect(getCalloutText({ callout })).toContain("This is a note");
});

test("Should support > [!CALLOUT] with custom title", async () => {
	const text = ["> [!NOTE] Custom title", "> This is a note"].join("\n");

	const processor = remark().use(plugin);
	const tree = await processor.run(processor.parse(text));
	const callout = findCalloutNode({ tree });

	if (!callout) {
		throw new Error("Callout not found");
	}

	const titleAttribute = callout.attributes.find(
		(attribute) => attribute.name === "title",
	);

	expect(callout.attributes).toContainEqual({
		type: "mdxJsxAttribute",
		name: "type",
		value: "info",
	});
	expect(titleAttribute?.value).toBe("Custom title");
	expect(getCalloutText({ callout })).toContain("This is a note");
});

test("Should support > [!CALLOUT] with multiple lines", async () => {
	const text = ["> [!NOTE]", "> This is a note", "> with multiple lines"].join(
		"\n",
	);

	const processor = remark().use(plugin);
	const tree = await processor.run(processor.parse(text));
	const callout = findCalloutNode({ tree });

	if (!callout) {
		throw new Error("Callout not found");
	}

	const bodyText = getCalloutText({ callout });

	expect(callout.attributes).toContainEqual({
		type: "mdxJsxAttribute",
		name: "type",
		value: "info",
	});
	expect(bodyText).toContain("This is a note");
	expect(bodyText).toContain("with multiple lines");
});

test("Should support baseUrl option", async () => {
	const text = "[[Internal link]]";
	const options = { baseUrl: "/foo" };

	const tree = await getTree({ text, options });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/foo/internal-link");
});

test("Should support [[#Heading]]", async () => {
	const text = "[[#Heading]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("#heading");
	expect(mdastToString(link)).toBe("Heading");
});

test("Should resolve wikilinks using frontmatter permalink when markdownFiles list is provided", async () => {
	const text = "Go to [[myfile]]";
	const options = {
		markdownFiles: [{ file: "myfile.md", permalink: "custom-link" }],
	};

	const tree = await getTree({ text, options });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/custom-link");
	expect(mdastToString(link)).toBe("myfile");
});

test("Should add not-found class to links that are not available on markdownFiles", async () => {
	const text = "[[Internal link]]";
	const options = { markdownFiles: [] };

	const tree = await getTree({ text, options });
	const links = findLinkNodes({ tree });
	const [link] = links;
	const classNames = link.data?.hProperties?.className ?? [];

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/internal-link");
	expect(classNames).toContain("not-found");
});

test("Should ignore embed links inside code blocks", async () => {
	const text = "`![[Embed Link]]`";

	const tree = await getTree({ text });
	const htmlNodes = findHtmlNodes({ tree });

	expect(htmlNodes).toHaveLength(0);
});

test("Should support ![[Embed note]]", async () => {
	const text = "![[My Note]]";
	const options = {
		markdownFiles: [
			{ file: "My Note.md", content: "This is a note with **bold** text." },
		],
	};

	const output = String(await remark().use(plugin, options).process(text));

	expect(output).toContain(
		'<div class="embed-note"><p>This is a note with <strong>bold</strong> text.</p>\n</div>',
	);
});

test("Should add not-found class to embed links that are not available on markdownFiles", async () => {
	const text = "![[Another Note]]";
	const options = { markdownFiles: [] };

	const output = String(await remark().use(plugin, options).process(text));

	expect(output).toContain(
		'<div class="embed-note not-found">Note not found</div>',
	);
});

test("Should support [[A & B]]", async () => {
	const text = "[[A & B]]";

	const tree = await getTree({ text });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/a-and-b");
	expect(mdastToString(link)).toBe("A & B");
});

test("Should ignore directive", async () => {
	const text = `:::tip
hello
:::`.trim();

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(text);
});
