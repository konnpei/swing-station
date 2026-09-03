// =============================================================
// FAMILY QUEST - アクセントカラー（テーマ色）の管理
// =============================================================
// 「完了状態=緑」「注意状態=黄色」はステータス表示用の色として固定し、
// ここで選べるのはUI全体のアクセントカラーだけにしている。
// 選んだ色はその端末のlocalStorageにだけ保存する（家族共通のデータではないため）。
// =============================================================

export type AccentColorOption = {
  id: string;
  label: string;
  /** TailwindのCSS変数に渡す "r g b" 形式 */
  rgb: string;
  /** SETTINGS画面のスウォッチ表示用 */
  previewHex: string;
};

export const ACCENT_COLOR_OPTIONS: AccentColorOption[] = [
  { id: "purple", label: "紫（初期設定）", rgb: "99 102 241", previewHex: "#6366f1" },
  { id: "blue", label: "青", rgb: "59 130 246", previewHex: "#3b82f6" },
  { id: "pink", label: "ピンク", rgb: "236 72 153", previewHex: "#ec4899" },
  { id: "orange", label: "オレンジ", rgb: "249 115 22", previewHex: "#f97316" },
  { id: "teal", label: "ティール", rgb: "20 184 166", previewHex: "#14b8a6" },
];

const DEFAULT_OPTION = ACCENT_COLOR_OPTIONS[0];
const STORAGE_KEY = "family-quest:accent-color";

/** 今保存されているアクセントカラーのIDを読み込む（無ければデフォルト） */
export function loadAccentColorId(): string {
  if (typeof window === "undefined") return DEFAULT_OPTION.id;
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? DEFAULT_OPTION.id;
  } catch (error) {
    console.error("アクセントカラーの読み込みに失敗しました", error);
    return DEFAULT_OPTION.id;
  }
}

/** アクセントカラーを画面に反映する（CSS変数を書き換えるだけ） */
export function applyAccentColor(colorId: string): void {
  if (typeof document === "undefined") return;
  const option =
    ACCENT_COLOR_OPTIONS.find((c) => c.id === colorId) ?? DEFAULT_OPTION;
  document.documentElement.style.setProperty(
    "--color-accent-rgb",
    option.rgb
  );
}

/** アクセントカラーを保存して、画面にも反映する */
export function saveAccentColor(colorId: string): void {
  applyAccentColor(colorId);
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, colorId);
  } catch (error) {
    console.error("アクセントカラーの保存に失敗しました", error);
  }
}
