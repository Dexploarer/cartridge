import { formatErrorMessage, type DataStoreRecord, type KnowledgeDocument } from "@cartridge/shared";
import { readEnvVar } from "./env";
import {
	isJsonObject,
	readArrayProperty,
	readBoolean,
	readJsonResponse,
	readNumber,
	readString,
	type JsonObject,
	type JsonValue,
} from "./json";

function readObject(value: JsonValue | undefined): JsonObject | null {
	return isJsonObject(value) ? value : null;
}

function isKnowledgeSource(value: string): value is KnowledgeDocument["source"] {
	return (
		value === "cartridge-memory" ||
		value === "session" ||
		value === "agent" ||
		value === "catalog"
	);
}

function isDataStoreKind(value: string): value is DataStoreRecord["kind"] {
	return value === "vector" || value === "graph" || value === "relational" || value === "kv";
}

function isDataStoreStatus(value: string): value is DataStoreRecord["status"] {
	return value === "ready" || value === "migrating" || value === "readonly" || value === "degraded";
}

function normalizeCollectionPayload<T>(
	json: JsonValue | null,
	keys: readonly string[],
	normalize: (raw: JsonValue | null, index: number) => T,
): T[] {
	if (Array.isArray(json)) {
		return json.map(normalize);
	}
	const root = readObject(json ?? undefined);
	if (!root) {
		return [];
	}

	const arr = readArrayProperty(root, keys);
	return arr ? arr.map(normalize) : [];
}

function normalizeKnowledgePayload(json: JsonValue | null): KnowledgeDocument[] {
	return normalizeCollectionPayload(json, ["documents"], normalizeKnowledgeDoc);
}

function normalizeKnowledgeDoc(raw: JsonValue | null, index: number): KnowledgeDocument {
	const o = readObject(raw ?? undefined);
	const id = readString(o?.["docId"] ?? o?.["id"] ?? o?.["documentId"], `remote-${index}`);
	const title = readString(o?.["title"] ?? o?.["name"], "Untitled document");
	const sourceRaw = readString(o?.["source"], "cartridge-memory").toLowerCase();
	const source = isKnowledgeSource(sourceRaw) ? sourceRaw : "cartridge-memory";
	const scope = readString(o?.["scope"] ?? o?.["namespace"], "platform");
	const excerpt = readString(o?.["excerpt"] ?? o?.["summary"] ?? o?.["body"], "");
	const tokensApprox = readNumber(o?.["tokensApprox"] ?? o?.["tokens"] ?? o?.["tokenCount"], 0);
	const lastIndexedAt = readString(o?.["lastIndexedAt"] ?? o?.["updatedAt"], new Date().toISOString());
	const embeddingModel = readString(o?.["embeddingModel"] ?? o?.["model"], "remote");

	return {
		docId: id,
		title,
		source,
		scope,
		excerpt,
		tokensApprox,
		lastIndexedAt,
		embeddingModel,
	};
}

function normalizeDataStoresPayload(json: JsonValue | null): DataStoreRecord[] {
	return normalizeCollectionPayload(json, ["stores"], normalizeDataStore);
}

function normalizeDataStore(raw: JsonValue | null, index: number): DataStoreRecord {
	const o = readObject(raw ?? undefined);
	const storeId = readString(o?.["storeId"] ?? o?.["id"], `remote-store-${index}`);
	const label = readString(o?.["label"] ?? o?.["name"], "Store");
	const kindRaw = readString(o?.["kind"], "kv").toLowerCase();
	const kind = isDataStoreKind(kindRaw) ? kindRaw : "kv";
	const statusRaw = readString(o?.["status"], "ready").toLowerCase();
	const status = isDataStoreStatus(statusRaw) ? statusRaw : "ready";
	const region = readString(o?.["region"], "remote");
	const recordsApprox = readNumber(o?.["recordsApprox"] ?? o?.["rowCount"] ?? o?.["count"], 0);
	const syncedWithCartridge = readBoolean(o?.["syncedWithCartridge"], true);

	return {
		storeId,
		label,
		kind,
		status,
		region,
		recordsApprox,
		syncedWithCartridge,
	};
}

type RemoteDataPlaneResult = {
	knowledge: KnowledgeDocument[] | null;
	dataStores: DataStoreRecord[] | null;
	error: string | null;
};

export async function fetchRemoteDataPlane(): Promise<RemoteDataPlaneResult> {
	const token = readEnvVar("CARTRIDGE_API_TOKEN");
	const knowledgeUrl = readEnvVar("CARTRIDGE_KNOWLEDGE_API_URL");
	const dataUrl = readEnvVar("CARTRIDGE_DATA_PLANE_API_URL");
	const headers = new Headers({ Accept: "application/json" });
	if (token) {
		headers.set("Authorization", `Bearer ${token}`);
	}

	let knowledge: KnowledgeDocument[] | null = null;
	let dataStores: DataStoreRecord[] | null = null;
	const errors: string[] = [];

	try {
		if (knowledgeUrl) {
			const res = await fetch(knowledgeUrl, { headers });
			if (!res.ok) {
				errors.push(`knowledge HTTP ${res.status}`);
			} else {
				const json = await readJsonResponse(res);
				const docs = normalizeKnowledgePayload(json);
				knowledge = docs.length > 0 ? docs : null;
			}
		}
	} catch (e) {
		errors.push(`knowledge: ${formatErrorMessage(e)}`);
	}

	try {
		if (dataUrl) {
			const res = await fetch(dataUrl, { headers });
			if (!res.ok) {
				errors.push(`data-plane HTTP ${res.status}`);
			} else {
				const json = await readJsonResponse(res);
				const stores = normalizeDataStoresPayload(json);
				dataStores = stores.length > 0 ? stores : null;
			}
		}
	} catch (e) {
		errors.push(`data-plane: ${formatErrorMessage(e)}`);
	}

	return {
		knowledge,
		dataStores,
		error: errors.length > 0 ? errors.join(" · ") : null,
	};
}
