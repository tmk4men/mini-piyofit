import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // キャッシュバスター：ビルドごとに かわる 版番号。画像・音の URL と SW の 保存名に つける
  define: { __BUILD__: JSON.stringify(Date.now().toString(36)) },
  server: {
    host: true,
    port: 5173,
  },
});
