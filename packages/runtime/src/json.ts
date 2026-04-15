export type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
	readonly [key: string]: JsonValue | undefined;
}

export interface JsonArray extends ReadonlyArray<JsonPrimitive | JsonObject | JsonArray> {}

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;

export function isJsonObject(value: JsonValue | null | undefined): value is JsonObject {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export async function readJsonResponse(res: Response): Promise<JsonValue> {
	try {
		return (await res.json()) as JsonValue;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(`Invalid JSON response: ${message}`);
	}
}

export function readString(value: JsonValue | undefined, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

export function readNumber(value: JsonValue | undefined, fallback: number): number {
	if (typeof value === "number" && !Number.isNaN(value)) {
		return value;
	}
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isNaN(n) ? fallback : n;
	}
	return fallback;
}

export function readBoolean(value: JsonValue | undefined, fallback: boolean): boolean {
	if (value === undefined) {
		return fallback;
	}
	return value === true || value === "true" || value === 1 || value === "1";
}

export function readArrayProperty(source: JsonObject, keys: readonly string[]): JsonArray | null {
	for (const key of keys) {
		const value = source[key];
		if (Array.isArray(value)) {
			return value as JsonArray;
		}
	}
	return null;
}
