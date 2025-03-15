import typescript from "rollup-plugin-typescript2";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import banner from "rollup-plugin-banner2";

export default {
    input: "src/main.ts", // The entry point of your application
    output: {
        file: "build/default-burst-emojis.plugin.js", // The output bundled file
        format: "commonjs" // The output format ('module', 'commonjs', 'iife', 'umd', 'amd', 'system')
    },
    external: [],
    plugins: [
        resolve(), // Allows Rollup to resolve modules
        commonjs(), // Converts CommonJS modules to ES6
        typescript({
            tsconfig: "tsconfig.json"
        }),
        banner(() => [
            "/**",
            " * @name DefaultBurtEmojis",
            " * @author gassastsina",
            " * @description Set shortcut emojis and emojis picker has burst by default",
            " * @authorId 292388871381975040",
            " * @version 1.0.0",
            " */"
        ].join("\n") + '\n')
    ]
};
