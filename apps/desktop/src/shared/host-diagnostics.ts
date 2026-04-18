export type HostDisplayDiagnostics = {
	width: number;
	height: number;
	workAreaWidth: number;
	workAreaHeight: number;
	scaleFactor: number;
};

export type HostDiagnosticsSource = {
	shellVersion: string;
	bunVersion: string;
	nodeVersion: string | null;
	platform: string;
	release: string;
	hostname: string;
	arch: string;
	uptimeSeconds: number;
	totalMemoryBytes: number;
	freeMemoryBytes: number;
	processResidentBytes: number;
	cpuModel: string;
	cpuCount: number;
	loadAverage: number[];
	cookieCount: number;
	rpcPort: number | null;
	primaryDisplay: HostDisplayDiagnostics | null;
};

export type HostDiagnostics = Omit<HostDiagnosticsSource, "loadAverage"> & {
	loadAverage: [number, number, number];
};

export function coerceHostDiagnostics(source: HostDiagnosticsSource): HostDiagnostics {
	const [one = 0, five = 0, fifteen = 0] = source.loadAverage;
	return {
		...source,
		loadAverage: [one, five, fifteen],
	};
}
