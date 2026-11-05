/**
 * Lightweight i18n system for H26RDK.
 * No third-party dependencies — React context + Zustand for persistence.
 *
 * Usage:
 *   const { t } = useI18n();
 *   <span>{t("common.connect")}</span>
 *   <span>{t("motor.toolbar.scanFound", { n: 3, list: "ID=1, ID=2, ID=3" })}</span>
 */
import { createContext, useContext, type ReactNode } from "react";
import { create } from "zustand";
import { zh, type I18nKeys } from "./zh";
import { en } from "./en";

export type Lang = "zh" | "en";

const TRANSLATIONS: Record<Lang, Record<I18nKeys, string>> = { zh, en };
const STORAGE_KEY = "h26rdk_lang";

// ── Global language store (Zustand) ────────────────────────────────────────

interface LangStore {
  lang: Lang;
  setLang: (l: Lang) => void;
  toggle: () => void;
}

export const useLangStore = create<LangStore>((set, get) => ({
  lang: (localStorage.getItem(STORAGE_KEY) as Lang | null) ?? "zh",
  setLang: (lang) => {
    localStorage.setItem(STORAGE_KEY, lang);
    set({ lang });
  },
  toggle: () => get().setLang(get().lang === "zh" ? "en" : "zh"),
}));

// ── Translation function ────────────────────────────────────────────────────

/**
 * Translate a key with optional variable interpolation.
 * Variables are written as {name} in the translation string.
 *
 * @example
 *   translate("zh", "motor.toolbar.scanFound", { n: 2, list: "ID=1, ID=2" })
 *   // → "发现 2 个电机：ID=1, ID=2"
 */
export function translate(
  lang: Lang,
  key: I18nKeys,
  vars?: Record<string, string | number>
): string {
  const dict = TRANSLATIONS[lang];
  let str: string = dict[key] ?? zh[key] ?? key;

  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.split(`{${k}}`).join(String(v));
    }
  }

  return str;
}

// ── React context ───────────────────────────────────────────────────────────

interface I18nContextValue {
  lang: Lang;
  t: (key: I18nKeys, vars?: Record<string, string | number>) => string;
  toggle: () => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const { lang, toggle } = useLangStore();
  const t = (key: I18nKeys, vars?: Record<string, string | number>) =>
    translate(lang, key, vars);

  return (
    <I18nContext.Provider value={{ lang, t, toggle }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}
