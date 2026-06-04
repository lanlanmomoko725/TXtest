import devServer from "@hono/vite-dev-server";
import path from "path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const __dirname = import.meta.dirname;

export default defineConfig(({ command }) => ({
  plugins: [
    command === "serve" ? devServer({ entry: "api/boot.ts", exclude: [/^\/(?!api\/).*$/] }) : null,
    react(),
  ].filter(Boolean),
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "@contracts": path.resolve(__dirname, "./contracts"),
      "@db": path.resolve(__dirname, "./db"),
      "db": path.resolve(__dirname, "./db"),
    },
  },
  envDir: path.resolve(__dirname),
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) return "react";
          if (id.includes("@tanstack") || id.includes("@trpc") || id.includes("superjson")) return "data";
          if (id.includes("@radix-ui") || id.includes("lucide-react") || id.includes("sonner")) return "ui";
          if (id.includes("recharts") || id.includes("embla-carousel")) return "charts";
        },
      },
    },
  },
}));
