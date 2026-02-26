import * as esbuild from "esbuild";
import { readFileSync } from "fs";

const isWatch = process.argv.includes("--watch");

// Read version from package.json for banner
const pkg = JSON.parse(readFileSync("./package.json", "utf-8"));

// VS Code extension bundle - compatible with ALL VS Code-based editors
/** @type {import('esbuild').BuildOptions} */
const extensionConfig = {
    entryPoints: ["src/extension.ts"],
    outfile: "dist/extension.js",
    bundle: true,
    platform: "node",
    target: "node18",
    format: "cjs",
    sourcemap: true,
    minify: false,
    external: ["vscode"],
    banner: {
        js: `// ${pkg.displayName} v${pkg.version} - Compatible with VS Code, Cursor, Windsurf, VSCodium`,
    },
};

async function build() {
    if (isWatch) {
        const ctx = await esbuild.context(extensionConfig);
        await ctx.watch();
        console.log("[DevFlow] Watching for changes...");
    } else {
        await esbuild.build(extensionConfig);
        console.log("[DevFlow] Build complete.");
    }
}

build().catch((err) => {
    console.error(err);
    process.exit(1);
});
