import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tanstackStart(), react(), tailwindcss(), tsconfigPaths()],

  server: {
    host: true,
    port: 8087,
    allowedHosts: true,
  },

  preview: {
    host: true,
    port: 8087,
    allowedHosts: true,
  },
});
