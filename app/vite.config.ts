import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  // Relative asset paths so the build works at a domain root OR a subpath.
  base: "./",
  plugins: [react()],
});
