export function readEnvVar(name: string): string | undefined {
	if (typeof Bun !== "undefined") {
		const value = Bun.env[name];
		return typeof value === "string" ? value : undefined;
	}
	if (typeof process !== "undefined" && process.env) {
		const value = process.env[name];
		return typeof value === "string" ? value : undefined;
	}
	return undefined;
}
