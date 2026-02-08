import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

console.log('main.tsx loaded');

try {
	createRoot(document.getElementById("root")!).render(<App />);
} catch (err) {
	// Surface errors both in the console and visibly on the page for easier debugging
	// eslint-disable-next-line no-console
	console.error('Render error:', err);
	const root = document.getElementById('root');
	if (root) {
		root.innerHTML = `<div style="padding:24px;font-family:sans-serif;color:#b91c1c;background:#fff6f6">Render error: ${String(err)}</div>`;
	}
}
