import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // During local development, proxy /api calls to the FastAPI backend
    // so you avoid CORS issues. The frontend code uses VITE_API_URL
    // (see api.js) which defaults to http://localhost:8000 in dev,
    // so this proxy isn't strictly needed — but it's here as a fallback.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
