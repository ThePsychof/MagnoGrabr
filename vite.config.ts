import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const isProd = mode === "production";
  const sharedBuild = {
    target: "es2022" as const,
    minify: (isProd ? "esbuild" : false) as "esbuild" | false,
    sourcemap: false, // no .map files
    emptyOutDir: false,
    outDir: "dist",
  };

  return {
    plugins: [react()],
    build:
      mode === "content"
        ? {
            ...sharedBuild,
            lib: {
              entry: path.resolve(__dirname, "src/content.ts"),
              name: "content",
              formats: ["iife"],
              fileName: () => "content.js",
            },
            rollupOptions: {
              output: {
                extend: true,
                inlineDynamicImports: true,
                format: "iife",
                name: "MagnoGrabrContent",
              },
            },
          }
        : mode === "background"
        ? {
            ...sharedBuild,
            lib: {
              entry: path.resolve(__dirname, "src/background.ts"),
              formats: ["es"],
              fileName: () => "background.js",
            },
            rollupOptions: {
              output: {
                inlineDynamicImports: true,
              },
            },
          }
        : {
            ...sharedBuild,
            rollupOptions: {
              input: {
                popup: path.resolve(__dirname, "src/popup/index.html"),
                options: path.resolve(__dirname, "src/options/index.html"),
              },
              output: {
                entryFileNames: "[name].js",
                chunkFileNames: "assets/chunks/[name].[hash].js",
                assetFileNames: (assetInfo) => {
                  if (assetInfo.name?.endsWith(".css")) {
                    if (assetInfo.name.includes("popup")) return "popup.css";
                    if (assetInfo.name.includes("options")) return "options.css";
                    // For any other CSS files, put them in assets
                    return "assets/[name][extname]";
                  }
                  if (/\.(png|svg|jpg)$/.test(assetInfo.name ?? ""))
                    return "icons/[name][extname]";
                  return "assets/[name][extname]";
                },
              },
            },
          },
  };
});
