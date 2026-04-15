import { formatErrorMessage } from "@cartridge/shared";

type JsonPrimitive = string | number | boolean | null;

export interface JsonObject {
	readonly [key: string]: JsonValue | undefined;
}

interface JsonArray extends ReadonlyArray<JsonValue> {}

export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export type JsonInput = JsonValue | undefined;

function isJsonPrimitive(value: unknown): value is JsonPrimitive {
	return (
		value === null ||
		typeof value === "string" ||
		typeof value === "number" ||
		typeof value === "boolean"
	);
}

export function isJsonObject(value: unknown): value is JsonObject {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isJsonArray(value: unknown): value is JsonArray {
	return Array.isArray(value) && value.every(isJsonValue);
}

export function isJsonValue(value: unknown): value is JsonValue {
	return isJsonPrimitive(value) || isJsonObject(value) || isJsonArray(value);
}

export async function readJsonResponse(res: Response): Promise<JsonValue> {
	try {
		const parsed: unknown = await res.json();
		if (!isJsonValue(parsed)) {
			throw new Error("Response did not contain valid JSON");
		}
		return parsed;
	} catch (error: unknown) {
		throw new Error(`Invalid JSON response: ${formatErrorMessage(error)}`);
	}
}

export function readString(value: JsonInput, fallback: string): string {
	return typeof value === "string" ? value : fallback;
}

export function readNumber(value: JsonInput, fallback: number): number {
	if (typeof value === "number" && !Number.isNaN(value)) {
		return value;
	}
	if (typeof value === "string") {
		const n = Number(value);
		return Number.isNaN(n) ? fallback : n;
	}
	return fallback;
}

export function readBoolean(value: JsonInput, fallback: boolean): boolean {
	if (value === undefined) {
		return fallback;
	}
	return value === true || value === "true" || value === 1 || value === "1";
}

export function readArrayProperty(source: JsonObject, keys: readonly string[]): JsonArray | null {
	for (const key of keys) {
		const value = source[key];
		if (isJsonArray(value)) {
			return value;
		}
	}
	return null;
}
