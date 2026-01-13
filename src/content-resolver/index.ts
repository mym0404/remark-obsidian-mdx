import fs from "node:fs";
import path from "node:path";

export type PathEntry = {
	path: string;
	basename: string;
	ext: string;
};

export type ContentResolverIndex = {
	pathIndex: Map<string, PathEntry>;
	basenameIndex: Map<string, string[]>;
};

export type ParsedLink = {
	isEmbed: boolean;
	rawTarget: string;
	displayText?: string;
	pathHint?: string;
	name: string;
	ext?: string;
};

const normalizePath = (value: string) =>
	value.replace(/\\/g, "/").replace(/\/+/g, "/").trim();

const normalizeName = (value: string) =>
	value.trim().normalize("NFC").toLowerCase();

const splitPath = (value: string) => {
	const normalized = normalizePath(value);
	const lastSlash = normalized.lastIndexOf("/");
	const filename =
		lastSlash === -1 ? normalized : normalized.slice(lastSlash + 1);
	const dir = lastSlash === -1 ? "" : normalized.slice(0, lastSlash);
	return { dir, filename };
};

const splitBasename = (value: string) => {
	const lastDot = value.lastIndexOf(".");
	if (lastDot === -1) {
		return { basename: value, ext: "" };
	}

	return { basename: value.slice(0, lastDot), ext: value.slice(lastDot + 1) };
};

export const createContentResolverIndex = (): ContentResolverIndex => ({
	pathIndex: new Map(),
	basenameIndex: new Map(),
});

export const addFileToResolver = (
	index: ContentResolverIndex,
	filePath: string,
) => {
	const normalizedPath = normalizePath(filePath);
	const { filename } = splitPath(normalizedPath);
	const { basename, ext } = splitBasename(filename);
	const normalizedBasename = normalizeName(basename);

	const entry: PathEntry = { path: normalizedPath, basename, ext };
	index.pathIndex.set(normalizedPath, entry);

	const bucket = index.basenameIndex.get(normalizedBasename) ?? [];
	if (!bucket.includes(normalizedPath)) {
		bucket.push(normalizedPath);
		index.basenameIndex.set(normalizedBasename, bucket);
	}
};

export const removeFileFromResolver = (
	index: ContentResolverIndex,
	filePath: string,
) => {
	const normalizedPath = normalizePath(filePath);
	const entry = index.pathIndex.get(normalizedPath);

	if (!entry) {
		return;
	}

	index.pathIndex.delete(normalizedPath);

	const normalizedBasename = normalizeName(entry.basename);
	const bucket = index.basenameIndex.get(normalizedBasename);

	if (!bucket) {
		return;
	}

	const nextBucket = bucket.filter((item) => item !== normalizedPath);

	if (nextBucket.length === 0) {
		index.basenameIndex.delete(normalizedBasename);
		return;
	}

	index.basenameIndex.set(normalizedBasename, nextBucket);
};

export const buildContentResolver = (paths: string[]) => {
	const index = createContentResolverIndex();
	// biome-ignore lint/suspicious/useIterableCallbackReturn: asd
	paths.forEach((filePath) => addFileToResolver(index, filePath));
	return index;
};

const walkFiles = (root: string): string[] => {
	const entries = fs.readdirSync(root, { withFileTypes: true });
	const results: string[] = [];

	for (const entry of entries) {
		const nextPath = path.join(root, entry.name);
		if (entry.isDirectory()) {
			results.push(...walkFiles(nextPath));
			continue;
		}

		if (entry.isFile()) {
			results.push(nextPath);
		}
	}

	return results;
};

export const buildContentResolverFromRoot = (contentRoot: string) => {
	const normalizedRoot = normalizePath(contentRoot).replace(/\/$/, "");
	if (!fs.existsSync(normalizedRoot)) {
		return buildContentResolver([]);
	}
	const files = walkFiles(normalizedRoot);
	return buildContentResolver(files);
};

export const parseObsidianLink = (input: string): ParsedLink | null => {
	const trimmed = input.trim();
	const isEmbed = trimmed.startsWith("![[");
	const match = /^!?\[\[(.+)\]\]$/.exec(trimmed);

	if (!match) {
		return null;
	}

	const rawTarget = match[1].trim();
	if (!rawTarget) {
		return null;
	}

	const [target, displayText] = rawTarget.split("|");
	const targetValue = target?.trim() ?? "";
	const display = displayText?.trim();

	if (!targetValue) {
		return null;
	}

	const strippedTarget = targetValue.replace(/[.#^].*$/, "");
	const { dir, filename } = splitPath(strippedTarget);
	const { basename, ext } = splitBasename(filename);

	return {
		isEmbed,
		rawTarget: targetValue,
		displayText: display || undefined,
		pathHint: dir || undefined,
		name: basename,
		ext: ext || undefined,
	};
};

export const resolveLink = (
	index: ContentResolverIndex,
	target: ParsedLink,
) => {
	if (target.pathHint) {
		const extension = target.ext ?? "mdx";
		const hinted = normalizePath(
			`${target.pathHint}/${target.name}.${extension}`,
		);
		if (index.pathIndex.has(hinted)) {
			return hinted;
		}
	}

	const candidates = index.basenameIndex.get(normalizeName(target.name)) ?? [];

	const filteredCandidates = target.ext
		? candidates.filter((candidate) => {
				const entry = index.pathIndex.get(candidate);
				return entry?.ext.toLowerCase() === target.ext?.toLowerCase();
			})
		: candidates;

	if (filteredCandidates.length === 0) {
		return null;
	}

	if (filteredCandidates.length === 1) {
		return filteredCandidates[0];
	}

	const sorted = [...filteredCandidates].sort();
	return sorted[0];
};

export const resolveContentUrl = ({
	resolvedPath,
	contentRoot,
	contentRootUrlPrefix = "",
	withExtension,
}: {
	resolvedPath: string;
	contentRoot: string;
	contentRootUrlPrefix?: string;
	withExtension?: boolean;
}) => {
	const normalizedPath = normalizePath(resolvedPath);
	const normalizedPrefix = normalizePath(contentRootUrlPrefix).replace(
		/^\/+|\/+$/g,
		"",
	);
	const buildUrl = (value: string) => {
		const trimmedValue = value.replace(/^\/+/, "");
		if (!normalizedPrefix) {
			return `/${trimmedValue}`;
		}
		if (!trimmedValue) {
			return `/${normalizedPrefix}`;
		}
		return `/${normalizedPrefix}/${trimmedValue}`;
	};

	if (!contentRoot) {
		const withoutLeading = normalizedPath.replace(/^\/+/, "");
		if (withExtension) {
			return buildUrl(withoutLeading);
		}
		return buildUrl(withoutLeading.replace(/\.[^/.]+$/, ""));
	}

	const normalizedRoot = normalizePath(contentRoot).replace(/\/$/, "");
	const withoutRoot = normalizedPath.startsWith(normalizedRoot)
		? normalizedPath.slice(normalizedRoot.length)
		: normalizedPath;

	const trimmed = withoutRoot.replace(/^\//, "");
	if (withExtension) {
		return buildUrl(trimmed);
	}
	return buildUrl(trimmed.replace(/\.[^/.]+$/, ""));
};
