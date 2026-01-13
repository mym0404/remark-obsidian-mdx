const codes = {
	horizontalTab: -2,
	virtualSpace: -1,
	nul: 0,
	eof: null,
	space: 32,
	exclamation: 33,
	leftSquareBracket: 91,
};

const markdownLineEndingOrSpace = (code: number | null) =>
	code !== null && (code < codes.nul || code === codes.space);

const markdownLineEnding = (code: number | null) =>
	code !== null && code < codes.horizontalTab;

export const wikiLinkSyntax = (opts: { aliasDivider?: string } = {}) => {
	const aliasDivider = opts.aliasDivider ?? ":";

	const aliasMarker = aliasDivider;
	const startMarker = "[[";
	const endMarker = "]]";

	const tokenize = (effects: any, ok: any, nok: any) => {
		let data = false;
		let alias = false;
		let embed = false;

		let aliasCursor = 0;
		let startMarkerCursor = 0;
		let endMarkerCursor = 0;
		let wikiLinkToken: any;

		return start;

		function start(code: number | null) {
			if (code === codes.exclamation) {
				embed = true;
				wikiLinkToken = effects.enter("wikiLink");
				wikiLinkToken._embed = true;
				effects.enter("wikiLinkEmbedMarker");
				effects.consume(code);
				effects.exit("wikiLinkEmbedMarker");
				return startAfterEmbed;
			}

			if (code !== startMarker.charCodeAt(startMarkerCursor)) {
				return nok(code);
			}

			wikiLinkToken = effects.enter("wikiLink");
			effects.enter("wikiLinkMarker");
			return consumeStart(code);
		}

		function startAfterEmbed(code: number | null) {
			if (code !== startMarker.charCodeAt(startMarkerCursor)) {
				return nok(code);
			}

			effects.enter("wikiLinkMarker");
			return consumeStart(code);
		}

		function consumeStart(code: number | null) {
			if (startMarkerCursor === startMarker.length) {
				effects.exit("wikiLinkMarker");
				return consumeData(code);
			}

			if (code !== startMarker.charCodeAt(startMarkerCursor)) {
				return nok(code);
			}

			effects.consume(code);
			startMarkerCursor += 1;

			return consumeStart;
		}

		function consumeData(code: number | null) {
			if (markdownLineEnding(code) || code === codes.eof) {
				return nok(code);
			}

			effects.enter("wikiLinkData");
			effects.enter("wikiLinkTarget");
			return consumeTarget(code);
		}

		function consumeTarget(code: number | null) {
			if (code === aliasMarker.charCodeAt(aliasCursor)) {
				if (!data) {
					return nok(code);
				}
				effects.exit("wikiLinkTarget");
				effects.enter("wikiLinkAliasMarker");
				return consumeAliasMarker(code);
			}

			if (code === endMarker.charCodeAt(endMarkerCursor)) {
				if (!data) {
					return nok(code);
				}
				effects.exit("wikiLinkTarget");
				effects.exit("wikiLinkData");
				effects.enter("wikiLinkMarker");
				return consumeEnd(code);
			}

			if (markdownLineEnding(code) || code === codes.eof) {
				return nok(code);
			}

			if (!markdownLineEndingOrSpace(code)) {
				data = true;
			}

			effects.consume(code);

			return consumeTarget;
		}

		function consumeAliasMarker(code: number | null) {
			if (aliasCursor === aliasMarker.length) {
				effects.exit("wikiLinkAliasMarker");
				effects.enter("wikiLinkAlias");
				return consumeAlias(code);
			}

			if (code !== aliasMarker.charCodeAt(aliasCursor)) {
				return nok(code);
			}

			effects.consume(code);
			aliasCursor += 1;

			return consumeAliasMarker;
		}

		function consumeAlias(code: number | null) {
			if (code === endMarker.charCodeAt(endMarkerCursor)) {
				if (!alias) {
					return nok(code);
				}
				effects.exit("wikiLinkAlias");
				effects.exit("wikiLinkData");
				effects.enter("wikiLinkMarker");
				return consumeEnd(code);
			}

			if (markdownLineEnding(code) || code === codes.eof) {
				return nok(code);
			}

			if (!markdownLineEndingOrSpace(code)) {
				alias = true;
			}

			effects.consume(code);

			return consumeAlias;
		}

		function consumeEnd(code: number | null) {
			if (endMarkerCursor === endMarker.length) {
				effects.exit("wikiLinkMarker");
				effects.exit("wikiLink");
				return ok(code);
			}

			if (code !== endMarker.charCodeAt(endMarkerCursor)) {
				return nok(code);
			}

			effects.consume(code);
			endMarkerCursor += 1;

			return consumeEnd;
		}
	};

	const call = { tokenize };

	return {
		text: {
			[codes.leftSquareBracket]: call,
			[codes.exclamation]: call,
		},
	};
};
