import esbuild from "esbuild"
import fs from "node:fs"

export interface Options {
  asString?: boolean
}

export default (options: Options = {}): esbuild.Plugin => ({
  name: "import-css",
  setup(build: esbuild.PluginBuild) {
    const { charset, legalComments, target, supported } = build.initialOptions

    build.onLoad(
      { namespace: "file", filter: /\.css$/ },
      async ({ path, with: withO }) => {
        const sourceBuf = await fs.promises.readFile(path)
        const { code, warnings } = await esbuild.transform(sourceBuf, {
          loader: "css",
          minify: true,
          charset,
          legalComments,
          target,
          supported,
          logLevel: "silent",
        })

        if (options.asString && !("type" in withO))
          return {
            loader: "text",
            contents: code,
            warnings,
          }
        if (withO.type !== "css") return {}
        return {
          loader: "js",
          contents:
            `var sheet = new CSSStyleSheet();\n` +
            `sheet.replaceSync(${JSON.stringify(code)});\n` +
            `export default sheet;`,
          warnings,
        }
      }
    )
  },
})
