import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@app": path.resolve(__dirname, "src/app"),
            "@pages": path.resolve(__dirname, "src/pages"),
            "@entities": path.resolve(__dirname, "src/entities"),
            "@shared": path.resolve(__dirname, "src/shared"),
            "@features": path.resolve(__dirname, "src/features"),
        },
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks: function (id) {
                    if (!id.includes("node_modules")) {
                        return undefined;
                    }
                    if (id.includes("node_modules/react-router") || id.includes("node_modules/@remix-run")) {
                        return "vendor-router";
                    }
                    if (id.includes("node_modules/react") ||
                        id.includes("node_modules/scheduler") ||
                        id.includes("node_modules/@mui") ||
                        id.includes("node_modules/@emotion")) {
                        return "vendor-framework";
                    }
                    if (id.includes("node_modules/react-hook-form") || id.includes("node_modules/@hookform") || id.includes("node_modules/zod")) {
                        return "vendor-forms";
                    }
                    return undefined;
                },
            },
        },
    },
    server: {
        port: 3000,
        host: true,
        proxy: {
            "/api": {
                target: "http://192.168.3.5:8010",
                changeOrigin: true,
            },
        },
    },
});
