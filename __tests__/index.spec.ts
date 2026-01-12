import { toString as mdastToString } from "mdast-util-to-string";
import { remark } from "remark";
import remarkHtml from "remark-html";
import { expect, test } from "vitest";
import plugin from "../src/index";
import type {
	MarkdownNode,
	MdxJsxAttribute,
	MdxJsxFlowElement,
	RootNode,
} from "../src/types";

const isRecord = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null;

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

test("Should support ==highlight text==", async () => {
	const text = "==highlight text==";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain("<p><mark>highlight text</mark></p>");
});

test("Should support ==**highlight text**==", async () => {
	const text = "==**highlight text**==";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain("<p><mark><b>highlight text</b></mark></p>");
});

test("Should support [[Internal link]]", async () => {
	const text = "[[Internal link]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link" title="Internal link">Internal link</a>',
	);
});

test("Should support **bold text** with an [[Internal link]]", async () => {
	const text = "**bold text** with [[Internal link]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link" title="Internal link">Internal link</a>',
	);
	expect(output).toContain("<strong>bold text</strong>");
});

test("Should support [[Internal link]] with text around", async () => {
	const text = "start [[Internal link]] end";
	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link" title="Internal link">Internal link</a>',
	);
});

test("Should support [[Internal link|With custom text]]", async () => {
	const text = "[[Internal link|With custom text]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link" title="With custom text">With custom text</a>',
	);
});

test("Should support multiple [[Internal link]] on the same paragraph", async () => {
	const text = "start [[Internal link]] [[Second link]] end";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link" title="Internal link">Internal link</a>',
	);
	expect(output).toContain(
		'<a href="/second-link" title="Second link">Second link</a>',
	);
});

test("Should support [[Internal link#heading]]", async () => {
	const text = "[[Internal link#heading]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link#heading" title="Internal link">Internal link</a>',
	);
});

test("Should support [[Internal link#heading|With custom text]]", async () => {
	const text = "[[Internal link#heading|With custom text]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/internal-link#heading" title="With custom text">With custom text</a>',
	);
});

test("Should support french accents", async () => {
	const text = "[[Productivité]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(
		'<a href="/productivite" title="Productivité">Productivité</a>',
	);
});

test("Should ignore bracket links inside code blocks", async () => {
	const text = "`[[Internal Link]]`";

	const output = String(
		await remark().use(remarkHtml).use(plugin).process(text),
	);

	expect(output).toContain("<code>[[Internal Link]]</code>");
});

test("Should ignore highlights inside code blocks", async () => {
	const text = "`==Highlight==`";

	const output = String(
		await remark().use(remarkHtml).use(plugin).process(text),
	);

	expect(output).toContain("<code>==Highlight==</code>");
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

	const output = String(await remark().use(plugin, options).process(text));

	expect(output).toContain(
		'<a href="/foo/internal-link" title="Internal link">Internal link</a>',
	);
});

test("Should support [[#Heading]]", async () => {
	const text = "[[#Heading]]";

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain('<a href="#heading" title="Heading">Heading</a>');
});

test("Should resolve wikilinks using frontmatter permalink when markdownFiles list is provided", async () => {
	const text = "Go to [[myfile]]";
	const options = {
		markdownFiles: [{ file: "myfile.md", permalink: "custom-link" }],
	};

	const output = String(await remark().use(plugin, options).process(text));

	expect(output).toContain('<a href="/custom-link" title="myfile">myfile</a>');
});

test("Should add not-found class to links that are not available on markdownFiles", async () => {
	const text = "[[Internal link]]";
	const options = { markdownFiles: [] };

	const output = String(await remark().use(plugin, options).process(text));

	expect(output).toContain(
		'<a href="/internal-link" title="Internal link" class="not-found">Internal link</a>',
	);
});

test("Should ignore embed links inside code blocks", async () => {
	const text = "`![[Embed Link]]`";

	const output = String(
		await remark().use(remarkHtml).use(plugin).process(text),
	);

	expect(output).toContain("<code>![[Embed Link]]</code>");
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

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain('<a href="/a-and-b" title="A & B">A & B</a>');
});

test("Should ignore directive", async () => {
	const text = `:::tip
hello
:::`.trim();

	const output = String(await remark().use(plugin).process(text));

	expect(output).toContain(text);
});
