# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains the remark plugin implementation and helpers. Key files include `src/index.ts` (plugin entry), `src/callout.ts` (callout transform), and `src/ast.ts` / `src/types.ts` (shared utilities and types).
- `__tests__/` holds Vitest specs (e.g., `__tests__/index.spec.ts`).
- Config lives at the root (`tsconfig.json`, `vitest.config.ts`, `tsdown.config.ts`, `biome.json`).
- `README.md` documents usage and callout options.

## Build, Test, and Development Commands
Use `pnpm` (see `package.json`):
- `pnpm build`: bundle with `tsdown`.
- `pnpm watch`: rebuild on changes.
- `pnpm test`: run Vitest in CI mode.
- `pnpm typecheck`: run `tsc --noEmit`.
- `pnpm lint`: run Biome checks.
- `pnpm t`: shortcut for lint + typecheck.

## Coding Style & Naming Conventions
- TypeScript, ES modules, `const`/`let` (no `var`).
- Indentation: tabs (see existing source files).
- Prefer small, focused helpers; avoid hardcoded strings when a shared map/type exists.
- Use `type` aliases over `interface`.
- Formatting/linting: Biome (`pnpm lint`).

## Testing Guidelines
- Test runner: Vitest (`pnpm test`).
- Keep tests in `__tests__` and use `*.spec.ts`.
- Focus on observable outputs (MDX AST node shape, string output for HTML).

## Commit & Pull Request Guidelines
- Commit messages: Conventional Commits (e.g., `feat:`, `fix:`, `docs:`).
- Don’t commit, push, or open PRs unless explicitly requested.
- PRs should describe behavior changes and list any new/updated tests.

## Agent Notes
- Avoid running dev servers.
- Remove temporary test/debug files before finishing.
