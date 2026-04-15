export type TypedEventEnvelope<
	EventMap extends Record<string, object>,
	K extends keyof EventMap = keyof EventMap,
> = {
	type: K;
	payload: EventMap[K];
	occurredAt: string;
};

type EventHandler<
	EventMap extends Record<string, object>,
	K extends keyof EventMap,
> = (
	payload: EventMap[K],
	envelope: TypedEventEnvelope<EventMap, K>,
) => void;

type EventHandlerStore<EventMap extends Record<string, object>> = {
	[K in keyof EventMap]?: Set<EventHandler<EventMap, K>>;
};

export class TypedEventBus<EventMap extends Record<string, object>> {
	private readonly handlers: EventHandlerStore<EventMap> = {};
	private readonly history: Array<TypedEventEnvelope<EventMap>> = [];

	constructor(private readonly historyLimit = 100) {}

	emit<K extends keyof EventMap>(type: K, payload: EventMap[K]): void {
		const envelope: TypedEventEnvelope<EventMap, K> = {
			type,
			payload,
			occurredAt: new Date().toISOString(),
		};

		this.history.push(envelope);
		if (this.history.length > this.historyLimit) {
			this.history.shift();
		}

		const subscribers = this.handlers[type];
		if (!subscribers) {
			return;
		}

		for (const handler of subscribers) {
			handler(payload, envelope);
		}
	}

	subscribe<K extends keyof EventMap>(
		type: K,
		handler: EventHandler<EventMap, K>,
	): () => void {
		const subscribers = this.handlers[type] ?? new Set<EventHandler<EventMap, K>>();
		subscribers.add(handler);
		this.handlers[type] = subscribers;

		return () => {
			const current = this.handlers[type];
			current?.delete(handler);
			if (current && current.size === 0) {
				delete this.handlers[type];
			}
		};
	}

	getHistory(): Array<TypedEventEnvelope<EventMap>> {
		return [...this.history];
	}
}
