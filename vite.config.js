import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  // VK Hosting serves the app as a static bundle; relative assets also keep
  // the production build portable for the hosting preview.
  base: "./",
  plugins: [react(), tailwindcss()],
  server: {
    host: "0.0.0.0",
    port: 3000,
    strictPort: true,
    hmr: {
      port: 3000,
    },
  },
  test: {
    // Тесты лежат только в клиенте (src) и на сервере (server).
    // Иначе vitest подхватывал бы копии логики из удалённых каталогов
    // (shared/, game-fixes/) и прогонял одни и те же проверки трижды.
    include: ["src/**/*.test.ts", "src/**/*.test.tsx", "server/**/*.test.ts"],
  },
});
