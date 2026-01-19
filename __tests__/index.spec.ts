import path from "node:path";
import { toString as mdastToString } from "mdast-util-to-string";
import { remark } from "remark";
import { expect, test } from "vitest";
import type {
	EmbedPathTransformContext,
	EmbedRenderContext,
} from "../src/embed";
import plugin from "../src/index";
import type {
	ChildrenNodeWithChildren,
	LinkNode,
	MarkdownNode,
	MdxJsxAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
	RootNode,
} from "../src/types";
import { isRecord } from "../src/util";
import type { WikiLinkPathTransformContext } from "../src/wiki-link";

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

const isParagraphNode = (
	value: unknown,
): value is { type: "paragraph"; children: unknown[] } =>
	isRecord(value) &&
	value.type === "paragraph" &&
	Array.isArray(value.children);

const hasChildren = (value: unknown): value is ChildrenNodeWithChildren =>
	isRecord(value) && Array.isArray(value.children);

const isStrongNode = (value: unknown): value is { type: "strong" } =>
	isRecord(value) && value.type === "strong";

const isLinkNode = (value: unknown): value is LinkNode =>
	isRecord(value) &&
	value.type === "link" &&
	typeof value.url === "string" &&
	Array.isArray(value.children);

const isImageNode = (
	value: unknown,
): value is { type: "image"; url: string; alt: string } =>
	isRecord(value) &&
	value.type === "image" &&
	typeof value.url === "string" &&
	typeof value.alt === "string";

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

const defaultContentRoot = path.resolve(__dirname, "fixtures", "vault");

const getTree = async ({
	text,
	options,
}: {
	text: string;
	options?: Partial<Parameters<typeof plugin>[0]>;
}) => {
	const processor = remark().use(plugin, {
		contentRoot: defaultContentRoot,
		...options,
	});
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

const findImageNodes = ({ tree }: { tree: unknown }) =>
	collectNodes<{ type: "image"; url: string; alt: string }>({
		node: tree,
		isMatch: isImageNode,
	});

const findMarkNodes = ({ tree }: { tree: unknown }) =>
	collectNodes<MdxJsxTextElement>({
		node: tree,
		isMatch: (value): value is MdxJsxTextElement =>
			isMdxJsxTextElement(value) && value.name === "mark",
	});

const isEmbedNode = (value: unknown): value is MdxJsxFlowElement =>
	isMdxJsxFlowElement(value) &&
	["EmbedNote", "EmbedImage", "EmbedVideo", "video"].includes(value.name);

const findEmbedNodes = ({ tree }: { tree: unknown }) =>
	collectNodes<MdxJsxFlowElement>({ node: tree, isMatch: isEmbedNode });

const isDivFlowElement = (value: unknown): value is MdxJsxFlowElement =>
	isMdxJsxFlowElement(value) && value.name === "div";

const findDivFlowElements = ({ tree }: { tree: unknown }) =>
	collectNodes<MdxJsxFlowElement>({ node: tree, isMatch: isDivFlowElement });

const createEmbedNode = ({
	name,
	attributes,
}: {
	name: string;
	attributes: MdxJsxAttribute[];
}) => {
	const node: MdxJsxFlowElement = {
		type: "mdxJsxFlowElement",
		name,
		attributes,
		children: [],
	};

	return node;
};

const createTextNode = (value: string) =>
	({
		type: "text",
		value,
	}) as const;

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

	const processor = remark().use(plugin, { contentRoot: defaultContentRoot });
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

	const processor = remark().use(plugin, { contentRoot: defaultContentRoot });
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
	const text = [
		"> [!NOTE]",
		"> This is a note",
		">",
		"> with multiple lines",
	].join("\n");

	const processor = remark().use(plugin, { contentRoot: defaultContentRoot });
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

test("Should support > [!CALLOUT] with multiple lines and highlightings", async () => {
	const text = [
		"> [!NOTE]",
		"> This is a note",
		">",
		"> with multiple lines **bold** *italic*",
	].join("\n");

	const processor = remark().use(plugin, { contentRoot: defaultContentRoot });
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
	expect(bodyText).toContain("bold");
	expect(bodyText).toContain("italic");
});

test("Should support callout with inline formatting on same line as marker", async () => {
	const text =
		"> [!INFO] Info\n> I used to play *Mario Kart NDS* or Rhythm Hero";

	const processor = remark().use(plugin, { contentRoot: defaultContentRoot });
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
	expect(bodyText).toContain("I used to play");
	expect(bodyText).toContain("Mario Kart NDS");
	expect(bodyText).toContain("or Rhythm Hero");
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

test("Should ignore embed links inside code blocks", async () => {
	const text = "`![[Embed Link]]`";
	const options = {
		embedRendering: {
			note: ({ target }: EmbedRenderContext) =>
				createEmbedNode({
					name: "EmbedNote",
					attributes: [
						{
							type: "mdxJsxAttribute",
							name: "page",
							value: target.page,
						},
					],
				}),
		},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(0);
});

test("Should ignore note embeds with headings and block ids", async () => {
	const text = ["![[ProjectA#TODO]]", "![[ProjectA^block-id]]"].join("\n");
	const options = {
		embedRendering: {
			note: ({ target }: EmbedRenderContext) =>
				createEmbedNode({
					name: "EmbedNote",
					attributes: [
						{
							type: "mdxJsxAttribute",
							name: "page",
							value: target.page,
						},
					],
				}),
		},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(0);
});

test("Should support image embeds", async () => {
	const text = "![[image.png]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const [image] = findImageNodes({ tree });

	expect(image.url).toBe("/image.png");
});

test("Should support image embeds with alt text", async () => {
	const text = "![[image.png|Custom alt text]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const [image] = findImageNodes({ tree });

	expect(image.url).toBe("/image.png");
	expect(image.alt).toBe("Custom alt text");
});

test("Should have empty alt text for image embeds without alias", async () => {
	const text = "![[image.png]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const [image] = findImageNodes({ tree });

	expect(image.url).toBe("/image.png");
	expect(image.alt).toBe("");
});

test("Should support inline image embeds with alt text", async () => {
	const text = "hello ![[image.png|Inline alt]] world";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const [image] = findImageNodes({ tree });

	expect(image.url).toBe("/image.png");
	expect(image.alt).toBe("Inline alt");
});

test("Should support video embeds", async () => {
	const text = " hello ![[clip.mp4]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const [embed] = findEmbedNodes({ tree });

	expect(embed.name).toBe("video");
	expect(embed.attributes).toContainEqual({
		type: "mdxJsxAttribute",
		name: "src",
		value: "/clip.mp4",
	});
});

test("Should ignore unsupported embeds", async () => {
	const text = "![[diagram.excalidraw]]";
	const options = {
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(0);
});

test("Should resolve wiki links using content index", async () => {
	const text = "[[ProjectA]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
	};

	const tree = await getTree({ text, options });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/notes/ProjectA");
});

test("Should apply contentRootUrlPrefix to wiki links", async () => {
	const text = "[[ProjectA]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		contentRootUrlPrefix: "/docs",
	};

	const tree = await getTree({ text, options });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/docs/notes/ProjectA");
});

test("Should transform resolved wiki link urls", async () => {
	const text = "[[ProjectA]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		wikiLinkPathTransform: ({ resolvedUrl }: WikiLinkPathTransformContext) => {
			if (!resolvedUrl) {
				return null;
			}
			return resolvedUrl.replace("/notes/", "/docs/");
		},
	};

	const tree = await getTree({ text, options });
	const links = findLinkNodes({ tree });
	const [link] = links;

	expect(links).toHaveLength(1);
	expect(link.url).toBe("/docs/ProjectA");
});

test("Should pass resolved url to embed rendering", async () => {
	const text = "![[ProjectA]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	let receivedUrl: string | undefined;
	const options = {
		contentRoot,
		embedRendering: {
			note: (context: EmbedRenderContext) => {
				receivedUrl = context.resolvedUrl;
				return createEmbedNode({
					name: "EmbedNote",
					attributes: [
						{
							type: "mdxJsxAttribute",
							name: "page",
							value: context.target.page,
						},
					],
				});
			},
		},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(1);
	expect(receivedUrl).toBe("/notes/ProjectA.md");
});

test("Should pass embed alias to embed rendering", async () => {
	const text = "![[ProjectA|Alias]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	let receivedAlias: string | undefined;
	const options = {
		contentRoot,
		embedRendering: {
			note: (context: EmbedRenderContext) => {
				receivedAlias = context.alias;
				return createEmbedNode({
					name: "EmbedNote",
					attributes: [
						{
							type: "mdxJsxAttribute",
							name: "page",
							value: context.target.page,
						},
					],
				});
			},
		},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(1);
	expect(receivedAlias).toBe("Alias");
});

test("Should apply contentRootUrlPrefix to embed rendering urls", async () => {
	const text = "![[ProjectA]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	let receivedUrl: string | undefined;
	const options = {
		contentRoot,
		contentRootUrlPrefix: "/docs",
		embedRendering: {
			note: (context: EmbedRenderContext) => {
				receivedUrl = context.resolvedUrl;
				return createEmbedNode({
					name: "EmbedNote",
					attributes: [
						{
							type: "mdxJsxAttribute",
							name: "page",
							value: context.target.page,
						},
					],
				});
			},
		},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(1);
	expect(receivedUrl).toBe("/docs/notes/ProjectA.md");
});

test("Should support inline embeds", async () => {
	const text = "hello ![[ProjectA]] world";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {
			note: ({ target }: EmbedRenderContext) =>
				createEmbedNode({
					name: "EmbedNote",
					attributes: [
						{
							type: "mdxJsxAttribute",
							name: "page",
							value: target.page,
						},
					],
				}),
		},
	};

	const tree = await getTree({ text, options });
	const embedNodes = findEmbedNodes({ tree });

	expect(embedNodes).toHaveLength(1);
});

test("Should wrap note embeds as flow element when standalone", async () => {
	const text = "![[ProjectA]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {
			note: () => createTextNode("Note embed"),
		},
	};

	const tree = await getTree({ text, options });
	const divs = findDivFlowElements({ tree });

	expect(divs).toHaveLength(1);
	expect(divs[0].children).toContainEqual({
		type: "text",
		value: "Note embed",
	});
	expect(isRootNode(tree) && tree.children.some(isParagraphNode)).toBe(false);
});

test("Should wrap notFound embeds as flow element when standalone", async () => {
	const text = "![[Missing]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {
			notFound: () => createTextNode("Missing embed"),
		},
	};

	const tree = await getTree({ text, options });
	const divs = findDivFlowElements({ tree });

	expect(divs).toHaveLength(1);
	expect(divs[0].children).toContainEqual({
		type: "text",
		value: "Missing embed",
	});
	expect(isRootNode(tree) && tree.children.some(isParagraphNode)).toBe(false);
});

test("Should keep inline note embeds inside paragraph", async () => {
	const text = "hello ![[ProjectA]] world";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embedRendering: {
			note: () => createTextNode("Inline note"),
		},
	};

	const tree = await getTree({ text, options });
	const divs = findDivFlowElements({ tree });

	expect(divs).toHaveLength(0);
	expect(isRootNode(tree) && tree.children.some(isParagraphNode)).toBe(true);
});

test("Should transform resolved embed urls", async () => {
	const text = "![[photo.png]]";
	const contentRoot = path.resolve(__dirname, "fixtures", "vault");
	const options = {
		contentRoot,
		embeddingPathTransform: ({
			kind,
			resolvedUrl,
		}: EmbedPathTransformContext) => {
			if (kind === "image" && resolvedUrl) {
				return resolvedUrl.replace("/assets/images/", "/static/img/");
			}
			return null;
		},
		embedRendering: {},
	};

	const tree = await getTree({ text, options });
	const [image] = findImageNodes({ tree });

	expect(image.url).toBe("/static/img/photo.png");
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

	const output = String(
		await remark()
			.use(plugin, { contentRoot: defaultContentRoot })
			.process(text),
	);

	expect(output).toContain(text);
});
