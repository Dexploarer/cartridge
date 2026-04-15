import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "../styles/globals.css";

function UiVitePreview() {
	return (
		<div className="bg-background text-foreground min-h-screen p-8 font-sans text-sm">
			<p>
				Electrobun loads <code className="rounded bg-muted px-1 py-0.5">src/mainview/</code>; use{" "}
				<code className="rounded bg-muted px-1 py-0.5">bun run ui:dev</code> for isolated component work.
			</p>
		</div>
	);
}

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<UiVitePreview />
	</StrictMode>,
);
