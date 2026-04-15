export function createId(prefix: string): string {
	return `${prefix}-${Date.now().toString(36)}-${Math.random()
		.toString(36)
		.slice(2, 8)}`;
}

export function isoNow(): string {
	return new Date().toISOString();
}

export function clone<T>(value: T): T {
	return structuredClone(value);
}

export function cloneItems<T>(items: readonly T[]): T[] {
	return items.map((item) => clone(item));
}

export function trimHistory<T>(items: readonly T[], maxItems: number): T[] {
	return items.slice(-maxItems);
}

export function appendTrimmedHistory<T>(
	items: readonly T[],
	nextItems: readonly T[],
	maxItems: number,
): T[] {
	return trimHistory([...items, ...nextItems], maxItems);
}

export function formatErrorMessage(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
