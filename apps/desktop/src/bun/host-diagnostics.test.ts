import { describe, expect, test } from "bun:test";

import { coerceHostDiagnostics } from "../shared/host-diagnostics";

describe("coerceHostDiagnostics", () => {
	test("normalizes load averages into a fixed tuple", () => {
		const diagnostics = coerceHostDiagnostics({
			shellVersion: "0.4.2",
			bunVersion: "1.2.0",
			nodeVersion: "24.2.0",
			platform: "darwin",
			release: "25.0.0",
			hostname: "cartridge-dev",
			arch: "arm64",
			uptimeSeconds: 3600,
			totalMemoryBytes: 64_000,
			freeMemoryBytes: 32_000,
			processResidentBytes: 16_000,
			cpuModel: "Apple M4",
			cpuCount: 10,
			loadAverage: [1.25],
			cookieCount: 7,
			rpcPort: 41721,
			primaryDisplay: {
				width: 3024,
				height: 1964,
				workAreaWidth: 3024,
				workAreaHeight: 1888,
				scaleFactor: 2,
			},
		});

		expect(diagnostics.loadAverage).toEqual([1.25, 0, 0]);
		expect(diagnostics.primaryDisplay?.scaleFactor).toBe(2);
		expect(diagnostics.shellVersion).toBe("0.4.2");
	});
});
