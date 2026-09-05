import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // The API runs separately (make api). Proxying keeps the browser on one
  // origin, so there is no CORS configuration to get wrong. Both dev and
  // preview need it — preview does not inherit the dev server config.
  // MapLibre parses GeoJSON in a web worker that the dep optimizer does not
  // carry across: with it pre-bundled, raster tiles draw and the road never
  // does. Left un-optimised, the worker resolves from the package itself.
  optimizeDeps: { exclude: ["maplibre-gl"] },
  server: { proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } },
  preview: { proxy: { "/api": { target: "http://127.0.0.1:8000", changeOrigin: true } } },
});
