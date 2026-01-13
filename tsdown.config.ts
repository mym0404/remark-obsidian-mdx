import { defineConfig } from "tsdown";

export default defineConfig([
	{
		entry: ["src/index.ts"],
		format: "esm",
		outDir: "dist/esm",
		dts: true,
		unbundle: true,
		outExtensions: () => ({
			js: ".mjs",
			dts: ".d.ts",
		}),
	},
	{
		entry: ["src/index.ts"],
		format: "cjs",
		unbundle: true,

		outDir: "dist/cjs",
		outExtensions: () => ({
			js: ".cjs",
		}),
	},
]);
