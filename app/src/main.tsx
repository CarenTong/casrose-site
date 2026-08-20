import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

// Fonts embedded via @fontsource (never CDN-linked) per the Casrose Design Reference.
// Cormorant Garamond — wordmark. Jost — nav / tagline / CTA / hint.
import "@fontsource/cormorant-garamond/500.css";
import "@fontsource/jost/400.css";

import App from "./App.tsx";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
