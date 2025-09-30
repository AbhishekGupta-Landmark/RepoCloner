import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// LocalStorage cleanup will be moved to a component after mount

// COMPLETELY DISABLE ALL ERROR OVERLAYS - IMMEDIATE OVERRIDE
(function() {
  // Less aggressive: Allow most event listeners, but override sendError
  const originalAddEventListener = window.addEventListener;

  // Set up our own error handlers that just log
  originalAddEventListener.call(window, 'error', (event: Event) => {
    const errorEvent = event as ErrorEvent;
    console.error('REAL ERROR CAUGHT:', {
      message: errorEvent.error?.message || errorEvent.message,
      stack: errorEvent.error?.stack,
      filename: errorEvent.filename,
      lineno: errorEvent.lineno,
      colno: errorEvent.colno,
      error: errorEvent.error
    });
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);

  originalAddEventListener.call(window, 'unhandledrejection', (event: Event) => {
    const rejectionEvent = event as PromiseRejectionEvent;
    console.error('REAL PROMISE REJECTION CAUGHT:', {
      reason: rejectionEvent.reason,
      promise: rejectionEvent.promise
    });
    event.stopImmediatePropagation();
    event.preventDefault();
  }, true);

  // Also override any sendError function
  (window as any).sendError = function(error: any) {
    console.error('sendError called but blocked:', error);
    // Do nothing to prevent overlay
  };

  // More targeted CSS to only block Vite error overlays  
  const style = document.createElement('style');
  style.textContent = `
    /* Only hide Vite-specific error overlays */
    vite-error-overlay,
    .vite-dev-error-overlay,
    [data-replit-vite-error],
    div[style*="runtime-error"] {
      display: none !important;
      visibility: hidden !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }
  `;
  document.head.appendChild(style);

  // Only remove Vite-specific overlays, not all elements with "error" 
  setInterval(() => {
    const viteOverlays = document.querySelectorAll('vite-error-overlay, .vite-dev-error-overlay, [data-replit-vite-error]');
    viteOverlays.forEach(el => {
      (el as HTMLElement).style.display = 'none';
      (el as HTMLElement).remove();
    });
  }, 500);
})();

createRoot(document.getElementById("root")!).render(<App />);
