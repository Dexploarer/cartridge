/** Knowledge index / RAG layer. */
export type KnowledgeDocument = {
	docId: string;
	title: string;
	source: "cartridge-memory" | "session" | "agent" | "catalog";
	scope: string;
	excerpt: string;
	tokensApprox: number;
	lastIndexedAt: string;
	embeddingModel: string;
};

/** Data-plane store record. */
export type DataStoreRecord = {
	storeId: string;
	label: string;
	kind: "vector" | "graph" | "relational" | "kv";
	status: "ready" | "migrating" | "readonly" | "degraded";
	region: string;
	recordsApprox: number;
	syncedWithCartridge: boolean;
};
