import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The API runs separately (make api). Proxying keeps the browser on one
  // origin, so there is no CORS configuration to get wrong. Both dev and
  // preview need it — preview does not inherit the dev server config.
  server: { proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } },
  preview: { proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } },
});
