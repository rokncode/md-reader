import { useEffect, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { useT } from "../i18n";

/** Windows 11 caption buttons (Segoe Fluent Icons). Always on the physical right, like the OS. */
export function WinCaption() {
  const t = useT();
  const [max, setMax] = useState(false);
  useEffect(() => {
    const w = getCurrentWindow();
    let un: (() => void) | undefined;
    void w.isMaximized().then(setMax);
    void w
      .onResized(async () => setMax(await w.isMaximized()))
      .then((u) => {
        un = u;
      });
    return () => un?.();
  }, []);
  const w = getCurrentWindow();
  return (
    <div className="caption">
      <button aria-label={t("minimize")} title={t("minimize")} onClick={() => void w.minimize()}>
        {""}
      </button>
      <button aria-label={max ? t("restore") : t("maximize")} title={max ? t("restore") : t("maximize")} onClick={() => void w.toggleMaximize()}>
        {max ? "" : ""}
      </button>
      <button className="close" aria-label={t("close")} title={t("close")} onClick={() => void w.close()}>
        {""}
      </button>
    </div>
  );
}
