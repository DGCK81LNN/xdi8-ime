import path from "node:path"
import fs from "node:fs"
import htmlMinifier from "html-minifier"
import esbuild from "esbuild"

process.chdir(path.join(__dirname, ".."))

const keyboardHTML = htmlMinifier.minify(
  fs.readFileSync("src/keyboard/dom.html").toString(),
  {
    collapseWhitespace: true,
    collapseInlineTagWhitespace: true,
    decodeEntities: true,
    removeAttributeQuotes: true,
    removeComments: true,
    sortAttributes: true,
    sortClassName: true,
  }
)

const keyboardCSS = Buffer.from(
  esbuild.buildSync({
    entryPoints: ["src/keyboard/style.css"],
    minify: true,
    //sourcemap: "inline",
    write: false,
  }).outputFiles[0].contents
).toString("utf-8")

esbuild.buildSync({
  entryPoints: ["test.mjs"],
  bundle: true,
  minify: true,
  sourcemap: true,
  outfile: "test.bundle.min.js",
  platform: "browser",
  target: "es2015",
  define: {
    _KEYBOARD_HTML: JSON.stringify(keyboardHTML),
    _KEYBOARD_CSS: JSON.stringify(keyboardCSS),
  },
  logLevel: "info",
})
