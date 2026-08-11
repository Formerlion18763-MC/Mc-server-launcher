import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Standard Tauri + Vite setup: fixed dev port Tauri expects, and it ignores
// src-tauri/ so Rust rebuilds don't trigger a frontend reload loop.
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    watch: { ignored: ["**/src-tauri/**"] },
  },
});
