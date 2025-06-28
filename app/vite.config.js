import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import path from "path";
export default defineConfig({
    plugins: [
        react(),
        nodePolyfills({
            exclude: [],
            globals: {
                Buffer: true,
                global: true,
                process: true,
            },
            protocolImports: true,
        }),
    ],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    server: {
        host: '0.0.0.0',
        port: 5173,
        allowedHosts: true,
    },
    preview: {
        host: '0.0.0.0',
        port: 4173,
        allowedHosts: ['wallet.fymoney.xyz'],
    },
});
