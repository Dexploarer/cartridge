const ALLOWED_EXTERNAL_PROTOCOLS = new Set([
	"https:",
	"http:",
	"mailto:",
	"cartridge:",
]);

function readExternalUrlProtocol(url: string): string | null {
	const match = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.exec(url);
	return match ? match[0].toLowerCase() : null;
}

export function isAllowedExternalUrl(url: string): boolean {
	const protocol = readExternalUrlProtocol(url);
	return protocol !== null && ALLOWED_EXTERNAL_PROTOCOLS.has(protocol);
}
