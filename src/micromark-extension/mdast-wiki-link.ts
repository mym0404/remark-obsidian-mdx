type WikiLinkNode = {
	type: "wikiLink";
	value?: string;
	data?: {
		alias?: string;
		embed?: boolean;
	};
};

const top = (stack: any[]) => stack[stack.length - 1];

export const wikiLinkFromMarkdown = () => {
	let node: WikiLinkNode | null = null;

	const enterWikiLink = function (this: any, token: any) {
		node = {
			type: "wikiLink",
			value: "",
			data: {
				alias: "",
				embed: Boolean(token?._embed),
			},
		};
		this.enter(node, token);
	};

	const exitWikiLinkAlias = function (this: any, token: any) {
		const alias = this.sliceSerialize(token);
		const current = top(this.stack) as WikiLinkNode;
		if (current.data) {
			current.data.alias = alias;
		}
	};

	const exitWikiLinkTarget = function (this: any, token: any) {
		const target = this.sliceSerialize(token);
		const current = top(this.stack) as WikiLinkNode;
		current.value = target;
	};

	const exitWikiLink = function (this: any, token: any) {
		this.exit(token);
	};

	return {
		enter: {
			wikiLink: enterWikiLink,
		},
		exit: {
			wikiLinkTarget: exitWikiLinkTarget,
			wikiLinkAlias: exitWikiLinkAlias,
			wikiLink: exitWikiLink,
		},
	};
};
