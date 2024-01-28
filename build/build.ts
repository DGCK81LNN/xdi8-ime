import path from "node:path"
import esbuild from "esbuild"
import importCSS from "./plugins/import-css"
import htmlMinifier from "./plugins/html-minifier"

process.chdir(path.join(__dirname, ".."))

esbuild.build({
  entryPoints: ["site/test.mjs"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: "site/test.bundle.min.js",
  platform: "browser",
  target: ["es2015", "chrome51", "edge15", "safari10", "firefox54", "opera38"],
  supported: {
    // safari10 is by default considered to not support const
    "const-and-let": true,
  },
  charset: "utf8",
  plugins: [
    importCSS({
      asString: true,
    }),
    htmlMinifier({
      collapseWhitespace: true,
      collapseInlineTagWhitespace: true,
      decodeEntities: true,
      //removeAttributeQuotes: true,
      removeComments: true,
      sortAttributes: true,
      sortClassName: true,
    }),
  ],
  logLevel: "info",
})
