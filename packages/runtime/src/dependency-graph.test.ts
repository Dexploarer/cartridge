import { describe, expect, test } from "bun:test";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "../..");
const TARGET_ROOTS = [
	path.resolve(ROOT, "apps/desktop/src"),
	path.resolve(ROOT, "packages/shared/src"),
	path.resolve(ROOT, "packages/app-platform/src"),
	path.resolve(ROOT, "packages/runtime/src"),
];
const PACKAGE_ENTRYPOINTS = new Map<string, string>([
	["@cartridge/shared", path.resolve(ROOT, "packages/shared/src/index.ts")],
	["@cartridge/app-platform", path.resolve(ROOT, "packages/app-platform/src/index.ts")],
	["@cartridge/runtime", path.resolve(ROOT, "packages/runtime/src/index.ts")],
]);
const SOURCE_EXTENSIONS = new Set([".ts", ".tsx", ".js", ".jsx", ".mts", ".cts"]);

function collectSourceFiles(dir: string): string[] {
	const files: string[] = [];
	const stack = [dir];

	while (stack.length > 0) {
		const current = stack.pop();
		if (!current) {
			continue;
		}

		for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
			const fullPath = path.join(current, entry.name);
			if (entry.isDirectory()) {
				stack.push(fullPath);
				continue;
			}

			if (!SOURCE_EXTENSIONS.has(path.extname(entry.name))) {
				continue;
			}

			if (entry.name.endsWith(".test.ts") || entry.name.endsWith(".test.tsx")) {
				continue;
			}

			files.push(fullPath);
		}
	}

	return files.sort();
}

function resolveRelativeImport(fromFile: string, specifier: string): string | null {
	const base = path.dirname(fromFile);
	const raw = path.resolve(base, specifier);
	const candidates = new Set<string>();

	if (path.extname(raw)) {
		candidates.add(raw);
	}

	for (const ext of SOURCE_EXTENSIONS) {
		candidates.add(`${raw}${ext}`);
		candidates.add(path.join(raw, `index${ext}`));
	}

	for (const candidate of candidates) {
		if (fs.existsSync(candidate)) {
			return candidate;
		}
	}

	return null;
}

function resolveImport(fromFile: string, specifier: string): string | null {
	if (specifier.startsWith(".")) {
		return resolveRelativeImport(fromFile, specifier);
	}

	return PACKAGE_ENTRYPOINTS.get(specifier) ?? null;
}

function extractDependencies(filePath: string): string[] {
	const text = fs.readFileSync(filePath, "utf8");
	const imports = new Set<string>();
	const importExportRe =
		/(?:import|export)\s+(?:type\s+)?(?:[^'"`;]+?\s+from\s+)?['"]([^'"]+)['"]/g;
	const sideEffectRe = /import\s+['"]([^'"]+)['"]/g;

	for (const matcher of [importExportRe, sideEffectRe]) {
		for (const match of text.matchAll(matcher)) {
			const resolved = resolveImport(filePath, match[1]);
			if (resolved) {
				imports.add(resolved);
			}
		}
	}

	return [...imports];
}

function buildDependencyGraph(): Map<string, string[]> {
	const graph = new Map<string, string[]>();

	for (const root of TARGET_ROOTS) {
		for (const file of collectSourceFiles(root)) {
			graph.set(file, extractDependencies(file));
		}
	}

	return graph;
}

function detectCycles(graph: Map<string, string[]>): string[][] {
	const cycles: string[][] = [];
	const visiting = new Set<string>();
	const visited = new Set<string>();
	const stack: string[] = [];

	function walk(node: string): void {
		if (visited.has(node)) {
			return;
		}

		if (visiting.has(node)) {
			const start = stack.indexOf(node);
			cycles.push([...stack.slice(start), node]);
			return;
		}

		visiting.add(node);
		stack.push(node);

		for (const dependency of graph.get(node) ?? []) {
			walk(dependency);
		}

		stack.pop();
		visiting.delete(node);
		visited.add(node);
	}

	for (const node of graph.keys()) {
		walk(node);
	}

	return cycles;
}

describe("dependency graph hygiene", () => {
	test("targeted source trees remain acyclic", () => {
		const graph = buildDependencyGraph();
		const cycles = detectCycles(graph);

		expect(cycles).toEqual([]);
	});
});
