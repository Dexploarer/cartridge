import type { ElectrobunConfig } from "electrobun";

export default {
	app: {
		name: "cartridge-desktop",
		identifier: "com.cartridge.desktop.dev",
		version: "0.1.0",
		description: "Cartridge gaming shell on Electrobun",
		/** Deep links: `cartridge://…` — see `docs/deep-links.md`. macOS: install/register app for OS handlers. */
		urlSchemes: ["cartridge"],
	},
	build: {
		bun: {
			entrypoint: "src/bun/index.ts",
		},
		views: {
			mainview: {
				entrypoint: "src/mainview/index.ts",
			},
			childview: {
				entrypoint: "src/childview/index.ts",
			},
		},
		copy: {
			"src/mainview/index.html": "views/mainview/index.html",
			"src/mainview/index.css": "views/mainview/index.css",
			"src/mainview/shadcn-tw.css": "views/mainview/shadcn-tw.css",
			"src/childview/index.html": "views/childview/index.html",
			"src/childview/index.css": "views/childview/index.css",
		},
		/** Rebuild mainview when shared/runtime packages change during `electrobun dev --watch`. */
		watch: [
			"../../packages/shared/src",
			"../../packages/runtime/src",
			"src/components",
			"src/styles/shadcn-for-mainview.css",
		],
		mac: {
			bundleCEF: false,
			/** Dawn/WebGPU — required for GpuWindow / WGPUView (mini-map, HUD, overlays). */
			bundleWGPU: true,
			defaultRenderer: "native",
		},
		linux: {
			bundleCEF: false,
		},
		win: {
			bundleCEF: false,
		},
	},
} satisfies ElectrobunConfig;
