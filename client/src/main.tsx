import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// LocalStorage cleanup will be moved to a component after mount

// Prevent Vite runtime error overlays from blocking UI
(function() {
  // Override Vite's sendError function to prevent overlay display
  (window as any).sendError = function() {
    // Block overlay display while preserving error logging
  };

  // CSS to hide any Vite error overlays that might still appear
  const style = document.createElement('style');
  style.textContent = `
    vite-error-overlay,
    .vite-dev-error-overlay,
    div[style*="runtime-error"] {
      display: none !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);
})();

createRoot(document.getElementById("root")!).render(<App />);
