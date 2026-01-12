type MarkdownCompiler = {
	enter: (node: unknown, token: unknown) => void;
	exit: (token: unknown) => void;
};

type FromMarkdownHandle = (this: MarkdownCompiler, token: unknown) => void;

const enterMark: FromMarkdownHandle = function (token) {
	this.enter({ type: "mark", children: [] }, token);
};

const exitMark: FromMarkdownHandle = function (token) {
	this.exit(token);
};

export const markFromMarkdown = {
	canContainEols: ["mark"],
	enter: { mark: enterMark },
	exit: { mark: exitMark },
};
