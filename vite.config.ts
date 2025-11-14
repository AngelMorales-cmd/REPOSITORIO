import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      // Proxy para la API de RENIEC - evita problemas de CORS
      "/api/reniec": {
        target: "https://api.decolecta.com",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/reniec/, "/v1/reniec/dni"),
        configure: (proxy, _options) => {
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            // Agregar el token de autorización
            proxyReq.setHeader(
              "Authorization",
              "Bearer sk_11556.LWHDdBdpMmEvp7SlJdBcFXGRAZX5A5Rc"
            );
            proxyReq.setHeader("Accept", "application/json");
            proxyReq.setHeader("Content-Type", "application/json");
          });
        },
      },
    },
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
