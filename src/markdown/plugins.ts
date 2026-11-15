import type { Element, ElementContent, Root, RootContent, Text } from "hast";
import { visit, SKIP } from "unist-util-visit";

const BLOCKS = new Set([
  "p", "li", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "div",
  "table", "dt", "dd", "dl", "figcaption", "summary", "details", "section",
]);

export function textOf(node: Element | ElementContent | RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") {
    if (node.tagName === "pre" || node.tagName === "code" || node.tagName === "math") return " ";
    return node.children.map(textOf).join("");
  }
  return "";
}

/** All text, including code — for extracting source. */
export function rawText(node: Element | ElementContent | RootContent): string {
  if (node.type === "text") return node.value;
  if (node.type === "element") return node.children.map(rawText).join("");
  return "";
}

const RTL_CHAR = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LTR_CHAR = /[A-Za-z\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

/** Direction of the first strong character (Unicode bidi P2), or null if none. */
export function firstStrong(text: string): "rtl" | "ltr" | null {
  for (const ch of text) {
    if (RTL_CHAR.test(ch)) return "rtl";
    if (LTR_CHAR.test(ch)) return "ltr";
  }
  return null;
}

/**
 * Every block gets an explicit direction from its own first strong character,
 * so a mixed Arabic/English document reads naturally regardless of the UI
 * language — including containers (quotes, lists, alerts) whose markers and
 * borders must sit on the correct side. Code is always left-to-right.
 */
export function dirAuto(tree: Root) {
  visit(tree, "element", (el: Element) => {
    if (el.tagName === "pre" || el.tagName === "mermaid-diagram") {
      el.properties.dir = "ltr";
      return SKIP;
    }
    if (el.tagName === "code") {
      el.properties.dir = "ltr";
      return SKIP;
    }
    if (BLOCKS.has(el.tagName) && !el.properties.dir) {
      const d = firstStrong(textOf(el));
      if (d) el.properties.dir = d;
    }
  });
  return tree;
}

const ALERTS = ["note", "tip", "important", "warning", "caution"] as const;
export type AlertKind = (typeof ALERTS)[number];

/** GitHub alerts: `> [!NOTE]` → <div class="alert alert-note">. */
export function rehypeAlerts() {
  return (tree: Root) => {
    visit(tree, "element", (el: Element) => {
      if (el.tagName !== "blockquote") return;
      const firstP = el.children.find((c): c is Element => c.type === "element" && c.tagName === "p");
      const first = firstP?.children[0];
      if (!firstP || first?.type !== "text") return;
      const m = /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*\n?/i.exec(first.value);
      if (!m) return;
      const kind = m[1].toLowerCase() as AlertKind;
      (first as Text).value = first.value.slice(m[0].length);
      if (!first.value && firstP.children[1]?.type === "element" && (firstP.children[1] as Element).tagName === "br") {
        firstP.children.splice(1, 1);
      }
      if (firstP.children.every((c) => c.type === "text" && !c.value.trim())) {
        el.children.splice(el.children.indexOf(firstP), 1);
      }
      el.tagName = "div";
      el.properties = { className: ["alert", `alert-${kind}`], dataAlert: kind };
      el.children.unshift({
        type: "element",
        tagName: "alert-title",
        properties: { kind },
        children: [],
      });
    });
  };
}

/** ```mermaid blocks become a custom element rendered lazily on the client. */
export function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (el: Element, index, parent) => {
      if (el.tagName !== "pre" || !parent || index === undefined) return;
      const code = el.children.find((c): c is Element => c.type === "element" && c.tagName === "code");
      const cls = (code?.properties.className as string[] | undefined) ?? [];
      if (!code || !cls.includes("language-mermaid")) return;
      parent.children[index] = {
        type: "element",
        tagName: "mermaid-diagram",
        properties: { code: rawText(code) },
        children: [],
      };
      return SKIP;
    });
  };
}

export type Heading = { id: string; text: string; depth: number };

export function scan(tree: Root) {
  const headings: Heading[] = [];
  let math = false;
  let code = false;
  visit(tree, "element", (el: Element) => {
    const m = /^h([1-4])$/.exec(el.tagName);
    if (m && el.properties.id) headings.push({ id: String(el.properties.id), text: textOf(el).trim(), depth: Number(m[1]) });
    if (el.tagName === "code") {
      const cls = (el.properties.className as string[] | undefined) ?? [];
      if (cls.includes("language-math")) math = true;
      else if (cls.some((c) => c.startsWith("language-"))) code = true;
    }
  });
  return { headings, math, code };
}

/** Rough script detection to choose the article's base direction and footnote labels. */
export function detectLang(md: string): "ar" | "en" {
  const sample = md.slice(0, 4000).replace(/```[\s\S]*?```/g, "");
  const ar = (sample.match(/[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g) ?? []).length;
  const lat = (sample.match(/[A-Za-z]/g) ?? []).length;
  return ar >= lat * 0.35 && ar > 0 ? "ar" : "en";
}
