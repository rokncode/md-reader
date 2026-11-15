import { unified, type Processor } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import rehypeRaw from "rehype-raw";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema, type Options as SanitizeSchema } from "rehype-sanitize";
import type { Root } from "hast";
import { dirAuto, rehypeAlerts, rehypeMermaid, scan, detectLang, type Heading } from "./plugins";

const schema: SanitizeSchema = {
  ...defaultSchema,
  clobberPrefix: "",
  attributes: {
    ...defaultSchema.attributes,
    "*": [...(defaultSchema.attributes?.["*"] ?? []), "dir", "lang", "align"],
    code: [["className", /^language-./, "math-inline", "math-display"]],
    img: [...(defaultSchema.attributes?.img ?? []), "loading", "width", "height"],
  },
};

type Base = Processor<any, any, any, any, any>;
const bases = new Map<string, Base>();

function base(lang: "ar" | "en"): Base {
  let p = bases.get(lang);
  if (!p) {
    p = unified()
      .use(remarkParse)
      .use(remarkGfm)
      .use(remarkMath)
      .use(remarkRehype, {
        allowDangerousHtml: true,
        footnoteLabel: lang === "ar" ? "الحواشي" : "Footnotes",
        footnoteBackLabel: lang === "ar" ? "العودة إلى النص" : "Back to content",
      })
      .use(rehypeRaw)
      .use(rehypeSlug)
      .use(rehypeSanitize, schema)
      .use(rehypeAlerts)
      .use(rehypeMermaid) as unknown as Base;
    bases.set(lang, p);
  }
  return p;
}

let shiki: Promise<Base> | null = null;
function shikiProcessor() {
  shiki ??= import("@shikijs/rehype").then(
    ({ default: rehypeShiki }) =>
      unified().use(rehypeShiki, {
        themes: { light: "github-light", dark: "github-dark" },
        defaultColor: false,
        lazy: true,
        fallbackLanguage: "text",
        transformers: [
          {
            pre(node) {
              node.properties["data-language"] = this.options.lang;
            },
          },
        ],
      }) as unknown as Base,
  );
  return shiki;
}

let katex: Promise<Base> | null = null;
function katexProcessor() {
  katex ??= Promise.all([import("rehype-katex"), import("katex/dist/katex.min.css")]).then(
    ([{ default: rehypeKatex }]) => unified().use(rehypeKatex, { throwOnError: false, strict: "ignore" } as never) as unknown as Base,
  );
  return katex;
}

export type Rendered = { tree: Root; headings: Heading[]; lang: "ar" | "en" };

export async function renderMarkdown(md: string): Promise<Rendered> {
  const lang = detectLang(md);
  const proc = base(lang);
  let tree = (await proc.run(proc.parse(md))) as Root;
  const info = scan(tree);
  if (info.math) tree = (await (await katexProcessor()).run(tree)) as Root;
  if (info.code) {
    try {
      tree = (await (await shikiProcessor()).run(tree)) as Root;
    } catch {
      /* highlighting is decoration — never fail the render for it */
    }
  }
  dirAuto(tree);
  return { tree, headings: info.headings, lang };
}
