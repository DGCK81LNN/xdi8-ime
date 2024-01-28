import esbuild from "esbuild"
import fs from "node:fs"
import htmlMinifier from "html-minifier"

// TODO: could support minifying css & js with esbuild instead;
// html-minifier uses clean-css and uglify-js internally by default.
/*
export interface Options extends Omit<htmlMinifier.Options, "minifyCSS" | "minifyJS"> {
  // as of v4.0.4 @types/html-minifier does not recognize the type parameter to minifyCSS
  minifyCSS?: boolean | ((text: string, type?: string) => string)
  minifyJS?: boolean | ((text: string, inline?: boolean) => string)
}
function processOptions(options: Options): htmlMinifier.Options {
  throw new Error("not implemented")
}

// from https://github.com/kangax/html-minifier/blob/e15a892cd2f578aa281e766924fdd6f17f80f607/src/htmlminifier.js#L356-L380
function wrapCSS(text: string, type: string) {
  switch (type) {
    case "inline":
      return "*{" + text + "}"
    case "media":
      return "@media " + text + "{a{top:0}}"
    default:
      return text
  }
}
function unwrapCSS(text: string, type: string) {
  var matches: RegExpMatchArray
  switch (type) {
    case "inline":
      matches = text.match(/^\*\{([\s\S]*)\}$/)
      break
    case "media":
      matches = text.match(/^@media ([\s\S]*?)\s*{[\s\S]*}$/)
      break
  }
  return matches ? matches[1] : text
}*/

declare module "html-minifier" {
  interface Options {
    log?: (message: unknown) => void
  }
}

// note: minifyURLs option won't work with value true, you must pass { site: string }
// (see https://www.npmjs.com/package/relateurl#optionssite)

/**
 * @param options - see https://www.npmjs.com/package/html-minifier#options-quick-reference
 */
export default (options: htmlMinifier.Options = {}): esbuild.Plugin => ({
  name: "html-minifier",
  setup(build: esbuild.PluginBuild) {
    build.onLoad({ namespace: "file", filter: /\.html$/ }, async ({ path }) => {
      const source = (await fs.promises.readFile(path)).toString()
      const warnings: esbuild.PartialMessage[] = []
      const contents = htmlMinifier.minify(source, {
        ...options,
        log(message) {
          if (message instanceof Error)
            warnings.push({
              text: `Error minifying JS or URL in HTML: ${message.message}`,
              location: {
                file: path,
                suggestion:
                  "Check if any inlined JS (or URL in an HTML attribute or inlined CSS) in this file is invalid.",
              },
              detail: message,
            })
        },
      })
      return {
        loader: "text",
        contents,
        warnings,
      }
    })
  },
})
