import { Link } from "react-router-dom";
import { FiSliders, FiList, FiArrowRight } from "react-icons/fi";
import { useI18n } from "../../i18n";
import type { I18nKeys } from "../../i18n/zh";

interface ModeOption {
  titleKey: I18nKeys;
  descriptionKey: I18nKeys;
  path: string;
  icon: React.ReactNode;
}

const modes: ModeOption[] = [
  {
    titleKey: "remote.select.mapped.title",
    descriptionKey: "remote.select.mapped.desc",
    path: "/remote-debug/mapped",
    icon: <FiSliders className="w-6 h-6" />,
  },
  {
    titleKey: "remote.select.raw.title",
    descriptionKey: "remote.select.raw.desc",
    path: "/remote-debug/raw",
    icon: <FiList className="w-6 h-6" />,
  },
];

export function RemoteSelectPage() {
  const { t } = useI18n();

  return (
    <div className="flex-1 overflow-auto p-8">
      <div className="max-w-3xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">{t("remote.select.title")}</h1>
        <p className="mt-1 text-zinc-400 text-sm">{t("remote.select.subtitle")}</p>
      </div>

      <div className="max-w-3xl mx-auto space-y-3">
        {modes.map((m) => (
          <Link key={m.path} to={m.path} className="no-underline block">
            <div className="group flex items-center justify-between rounded-xl border border-zinc-700 bg-zinc-900 hover:border-zinc-500 hover:bg-zinc-800/80 cursor-pointer p-5 transition-all">
              <div className="flex items-start gap-4">
                <div className="mt-0.5 text-zinc-400">{m.icon}</div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-sm font-semibold text-zinc-100">{t(m.titleKey)}</h2>
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                      {t("common.status.ready")}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-500 leading-relaxed">{t(m.descriptionKey)}</p>
                </div>
              </div>
              <FiArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-zinc-300 transition-colors shrink-0 ml-4" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
