import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/globals.css";

function Placeholder() {
	return (
		<div className="bg-background text-foreground min-h-screen p-8 font-sans text-sm">
			<p>
				Vite + shadcn workspace. Use <code className="rounded bg-muted px-1 py-0.5">bun run ui:dev</code> for
				component dev; Electrobun uses <code className="rounded bg-muted px-1 py-0.5">src/mainview/</code>.
			</p>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<Placeholder />
	</StrictMode>,
);
