// =============================================================
// FAMILY QUEST - ブラウザのlocalStorageへの保存・読み込み
// =============================================================
// Supabase等の共有DBを使わず「家族共用の1台の端末だけで使う」場合に、
// ページをリロードしても今日のミッション状態が消えないようにするための仕組み。
// あくまで「その端末のブラウザだけ」に保存されるので、
// 別の端末とはデータは共有されない（共有したい場合はSupabase接続が必要）。
// =============================================================

import { Child } from "./dummy-data";

const STORAGE_KEY = "family-quest:family:v1";

/** 家族データをlocalStorageに保存する。失敗しても画面には影響させない */
export function saveFamilyToLocalStorage(family: Child[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(family));
  } catch (error) {
    console.error("localStorageへの保存に失敗しました", error);
  }
}

/**
 * localStorageから家族データを読み込む。
 * 保存されていない・壊れている場合はnullを返す（呼び出し側でダミーデータにフォールバックする）
 */
export function loadFamilyFromLocalStorage(): Child[] | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;
    return parsed as Child[];
  } catch (error) {
    console.error("localStorageからの読み込みに失敗しました", error);
    return null;
  }
}
