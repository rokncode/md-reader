import { createContext, memo, useContext, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { toJsxRuntime, type Components } from "hast-util-to-jsx-runtime";
import type { Root } from "hast";
import { Info, Lightbulb, MessageSquareWarning, TriangleAlert, OctagonAlert, Copy, Check } from "lucide-react";
import { useApp } from "../state/app";
import { platform } from "../platform";
import { isExternal, isInlineSrc, isMarkdown, resolveRel, splitHref } from "../lib/path";
import { translate } from "../i18n";
import { useSettings } from "../state/settings";
import type { AlertKind } from "./plugins";

const DocCtx = createContext<{ rel: string; docLang: "ar" | "en" }>({ rel: "", docLang: "ar" });

export function scrollToId(id: string, smooth = true) {
  const el = document.getElementById(id) ?? document.getElementById(decodeURIComponent(id));
  if (!el) return false;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: smooth && !reduce ? "smooth" : "auto", block: "start" });
  return true;
}

function Link({ href = "", children, ...rest }: ComponentProps<"a">) {
  const { rel } = useContext(DocCtx);
  const onClick = (e: React.MouseEvent) => {
    if (!href) return;
    e.preventDefault();
    if (href.startsWith("#")) {
      scrollToId(href.slice(1));
      return;
    }
    if (isExternal(href)) {
      void platform().openExternal(href);
      return;
    }
    const { path, hash } = splitHref(href);
    const target = resolveRel(rel, path);
    const { ws, openDoc } = useApp.getState();
    if (ws?.entries.some((x) => x.rel === target)) void openDoc(target, hash || undefined);
    else if (isMarkdown(target) && ws?.openRelative) {
      void ws.openRelative(target).then((next) => next && useApp.getState().openWorkspace(next, undefined, hash || undefined));
    } else if (!isMarkdown(target)) void ws?.openLocal?.(target);
  };
  return (
    <a href={href} onClick={onClick} title={isExternal(href) ? href : undefined} {...rest}>
      {children}
    </a>
  );
}

function Img({ src = "", alt = "", ...rest }: ComponentProps<"img">) {
  const { rel } = useContext(DocCtx);
  const [url, setUrl] = useState<string | undefined>(isInlineSrc(src) ? src : undefined);
  const [broken, setBroken] = useState(false);
  useEffect(() => {
    if (isInlineSrc(src)) {
      setUrl(src);
      return;
    }
    let alive = true;
    const ws = useApp.getState().ws;
    const target = resolveRel(rel, splitHref(src).path);
    ws?.assetUrl(target).then((u) => alive && (u ? setUrl(u) : setBroken(true)));
    return () => {
      alive = false;
    };
  }, [src, rel]);
  return (
    <img
      {...rest}
      src={url}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={false}
      data-broken={broken || undefined}
      onError={() => setBroken(true)}
    />
  );
}

function Pre({ children, ...rest }: ComponentProps<"pre">) {
  const ref = useRef<HTMLPreElement>(null);
  const [copied, setCopied] = useState(false);
  const lang = useSettings((s) => s.lang);
  const language = (rest as Record<string, unknown>)["data-language"] as string | undefined;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(ref.current?.innerText ?? "");
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      /* clipboard denied */
    }
  };
  return (
    <div className="codeblock">
      <pre ref={ref} {...rest}>
        {children}
      </pre>
      <button className="copy glass" onClick={copy} aria-label={translate(lang, "copy")}>
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {translate(lang, copied ? "copied" : "copy")}
      </button>
      {language && language !== "text" ? <span className="lang">{language}</span> : null}
    </div>
  );
}

function Table(props: ComponentProps<"table">) {
  return (
    <div className="table-wrap">
      <table {...props} />
    </div>
  );
}

const ALERT_ICON: Record<AlertKind, ReactNode> = {
  note: <Info />,
  tip: <Lightbulb />,
  important: <MessageSquareWarning />,
  warning: <TriangleAlert />,
  caution: <OctagonAlert />,
};
const ALERT_LABEL: Record<AlertKind, [string, string]> = {
  note: ["ملاحظة", "Note"],
  tip: ["نصيحة", "Tip"],
  important: ["مهم", "Important"],
  warning: ["تحذير", "Warning"],
  caution: ["تنبيه", "Caution"],
};

function AlertTitle({ kind }: { kind: AlertKind }) {
  const { docLang } = useContext(DocCtx);
  return (
    <div className="alert-title" dir="auto">
      {ALERT_ICON[kind]}
      <span>{ALERT_LABEL[kind]?.[docLang === "ar" ? 0 : 1]}</span>
    </div>
  );
}

let mermaidId = 0;
function Mermaid({ code }: { code: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    const dark = document.documentElement.dataset.theme === "dark";
    import("mermaid")
      .then(async ({ default: mermaid }) => {
        mermaid.initialize({ startOnLoad: false, securityLevel: "strict", theme: dark ? "dark" : "neutral", fontFamily: "inherit" });
        const { svg } = await mermaid.render(`qari-mermaid-${++mermaidId}`, code);
        if (alive && ref.current) ref.current.innerHTML = svg;
      })
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [code]);
  if (failed)
    return (
      <pre dir="ltr">
        <code>{code}</code>
      </pre>
    );
  return <div className="mermaid" ref={ref} />;
}

const components = {
  a: Link,
  img: Img,
  pre: Pre,
  table: Table,
  "alert-title": AlertTitle,
  "mermaid-diagram": Mermaid,
} as unknown as Components;

export const Content = memo(function Content({ tree, rel, docLang }: { tree: Root; rel: string; docLang: "ar" | "en" }) {
  const node = toJsxRuntime(tree, { Fragment, jsx, jsxs, components, ignoreInvalidStyle: true, passKeys: true, passNode: false });
  return <DocCtx.Provider value={{ rel, docLang }}>{node}</DocCtx.Provider>;
});
