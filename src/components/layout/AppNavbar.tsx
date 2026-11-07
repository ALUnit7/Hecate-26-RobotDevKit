import { Link, useLocation } from "react-router-dom";
import { FiArrowLeft, FiHome, FiGlobe } from "react-icons/fi";
import { useI18n } from "../../i18n";
import { useLangStore } from "../../i18n";
import type { Lang } from "../../i18n";
import { RecordingWidget } from "./RecordingWidget";

export function AppNavbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";
  const { t } = useI18n();
  const { lang, setLang } = useLangStore();

  const switchLang = (l: Lang) => setLang(l);

  return (
    <div className="h-10 flex items-center px-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
      {!isHome && (
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mr-3"
          title={t("nav.home")}
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <FiHome className="w-3.5 h-3.5" />
        </Link>
      )}
      <span className="text-xs font-semibold text-zinc-300 tracking-wide">
        {t("app.title")}
      </span>
      {!isHome && (
        <span className="text-xs text-zinc-600 ml-2">
          / {location.pathname.slice(1).replace(/-/g, " ")}
        </span>
      )}

      {/* Recording widget (global, left of language switcher) */}
      <div className="ml-auto flex items-center gap-3">
        <RecordingWidget />

        {/* Language switcher */}
        <div className="flex items-center gap-1 bg-zinc-800 rounded p-0.5">
          <FiGlobe className="w-3 h-3 text-zinc-500 ml-1" />
          <button
            onClick={() => switchLang("zh")}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              lang === "zh" ? "bg-sky-500/30 text-sky-300" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            中
          </button>
          <button
            onClick={() => switchLang("en")}
            className={`px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors ${
              lang === "en" ? "bg-sky-500/30 text-sky-300" : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            EN
          </button>
        </div>
      </div>
    </div>
  );
}
