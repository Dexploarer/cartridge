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

export function trimHistory<T>(items: readonly T[], maxItems: number): T[] {
	return items.slice(-maxItems);
}
