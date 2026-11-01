import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  envDir: "../..",
  plugins: [react()],
  server: {
    host: true,
    allowedHosts: true,
    strictPort: false
  }
});
