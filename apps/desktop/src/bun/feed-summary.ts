import { isJsonObject, type JsonValue } from "@cartridge/runtime";

type FeedEnvelope = {
	readonly data?: JsonValue;
};

export type FeedInput = JsonValue | FeedEnvelope;

function hasFeedEnvelope(value: unknown): value is FeedEnvelope {
	return isJsonObject(value) && value["data"] !== undefined;
}

export function summarizeForFeed(evt: FeedInput, max?: number): string;
export function summarizeForFeed(evt: unknown, max?: number): string;
export function summarizeForFeed(evt: unknown, max = 420): string {
	try {
		const payload = hasFeedEnvelope(evt) ? evt.data : evt;
		const raw = JSON.stringify(payload) ?? String(payload);
		return raw.length > max ? `${raw.slice(0, max)}…` : raw;
	} catch {
		return String(evt);
	}
}
