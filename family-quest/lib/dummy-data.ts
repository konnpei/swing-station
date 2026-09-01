// =============================================================
// FAMILY QUEST - ダミーデータと型定義
// =============================================================
// STEP1ではSupabaseなどの本物のデータベースを使わず、
// このファイルの中だけでデータを完結させています。
// 将来Supabaseに接続するときは、この型定義をそのまま使い、
// データの取得元だけをここから置き換えるイメージです。
// =============================================================

/** 子どものID。保護者モード以外の「今どのモードか」にも使う */
export type ChildId = "eldest" | "eldest-daughter" | "youngest";

/** 画面の表示モード（保護者 or 子ども本人） */
export type Mode = "parent" | ChildId;

/** 1つのミッション（今日のタスク） */
export type Mission = {
  id: string;
  title: string; // 例：「漢字 10個」
  category: string; // 例：「学習」「学校」
  targetAmount: number; // 目標の量（例：10）
  unit: string; // 単位（例：「個」「分」「問」）
  xp: number; // 完了したときにもらえるXP
  completed: boolean; // 完了しているかどうか
  weekdays: number[]; // このミッションを表示する曜日（0=日,1=月,...6=土）。7つ全部で「毎日」
};

/** すべての曜日を表す配列（＝毎日のミッション用のデフォルト値） */
export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** 曜日選択UIで使う表示順（月始まり）と、実際の値（JSのgetDay()と同じ）の対応表 */
export const WEEKDAY_OPTIONS: { label: string; value: number }[] = [
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
  { label: "日", value: 0 },
];

/** ミッションを新規追加するときに入力する項目（idと完了状態は自動で決まるので含まない） */
export type NewMissionInput = {
  title: string;
  category: string;
  targetAmount: number;
  unit: string;
  xp: number;
  weekdays: number[];
};

/** 1週間分の達成記録（月〜日） */
export type WeeklyRecord = {
  day: string; // 曜日の表示（月・火・水...）
  completed: number; // その日の達成数
  total: number; // その日の全ミッション数
  isToday: boolean; // 今日かどうか
};

/** 子ども1人分のデータ */
export type Child = {
  id: ChildId;
  name: string;
  level: number;
  levelTitle: string; // レベルの称号（例：「習慣化中」）
  xp: number; // 現在の累計XP
  streak: number; // 学習継続日数
  monthlyDays: number; // 今月実施した日数
  bestStreak: number; // 自己ベストの継続日数
  goal: string; // 個人目標（例：「小山台高校」）
  examDate: string | null; // 試験日（YYYY-MM-DD）。ない場合はnull
  missions: Mission[];
  weeklyRecords: WeeklyRecord[]; // 今週（月〜日）の記録
};

// -------------------------------------------------------------
// 初期データ
// -------------------------------------------------------------
// 「今日」を含む1週間分のダミー記録を作るための曜日ラベル
const WEEKDAY_LABELS = WEEKDAY_OPTIONS.map((option) => option.label);

/**
 * 月曜はじまりの週内で、今日が何番目か（0=月, 6=日）を返す。
 * JSのDate#getDay()は日曜=0なので、月曜はじまりに変換している。
 */
function getTodayIndexMondayFirst(): number {
  const jsDay = new Date().getDay(); // 0(日)〜6(土)
  return jsDay === 0 ? 6 : jsDay - 1;
}

/**
 * 週の記録を作るヘルパー。todayの値だけは実際の完了数と連動させたいので、
 * ここでは「今日以外」のダミー値を受け取り、今日の枠はあとから
 * lib/utils.ts側で実データに差し替える前提にしている。
 */
function buildWeeklyRecords(
  otherDaysCompleted: number[],
  totalPerDay: number
): WeeklyRecord[] {
  const todayIndex = getTodayIndexMondayFirst();
  return WEEKDAY_LABELS.map((day, index) => ({
    day,
    completed: otherDaysCompleted[index] ?? 0,
    total: totalPerDay,
    isToday: index === todayIndex,
  }));
}

export const initialFamily: Child[] = [
  {
    id: "eldest",
    name: "長男",
    level: 5,
    levelTitle: "基礎固め",
    xp: 850,
    streak: 10,
    monthlyDays: 18,
    bestStreak: 14,
    goal: "小山台高校",
    examDate: "2025-12-01",
    missions: [
      {
        id: "eldest-homework",
        title: "学校宿題",
        category: "学校",
        targetAmount: 1,
        unit: "回",
        xp: 30,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "eldest-tablet",
        title: "タブレット学習 2講座",
        category: "学習",
        targetAmount: 2,
        unit: "講座",
        xp: 40,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "eldest-kanji",
        title: "漢字 10個",
        category: "学習",
        targetAmount: 10,
        unit: "個",
        xp: 20,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "eldest-eitango",
        title: "英単語 10個",
        category: "学習",
        targetAmount: 10,
        unit: "個",
        xp: 20,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "eldest-english",
        title: "英語 5問",
        category: "学習",
        targetAmount: 5,
        unit: "問",
        xp: 25,
        completed: false,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "eldest-math",
        title: "数学 5問",
        category: "学習",
        targetAmount: 5,
        unit: "問",
        xp: 25,
        completed: false,
        weekdays: ALL_WEEKDAYS,
      },
    ],
    weeklyRecords: buildWeeklyRecords([6, 5, 6, 4, 6, 5], 6),
  },
  {
    id: "eldest-daughter",
    name: "長女",
    level: 4,
    levelTitle: "継続の達人",
    xp: 620,
    streak: 7,
    monthlyDays: 15,
    bestStreak: 11,
    goal: "英語力アップ",
    examDate: null,
    missions: [
      {
        id: "daughter-homework",
        title: "学校宿題",
        category: "学校",
        targetAmount: 1,
        unit: "回",
        xp: 30,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "daughter-tablet",
        title: "タブレット学習 2講座",
        category: "学習",
        targetAmount: 2,
        unit: "講座",
        xp: 40,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "daughter-english",
        title: "英語 10分",
        category: "学習",
        targetAmount: 10,
        unit: "分",
        xp: 20,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "daughter-piano",
        title: "ピアノ 20分",
        category: "習い事",
        targetAmount: 20,
        unit: "分",
        xp: 20,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "daughter-reading",
        title: "読書 15分",
        category: "学習",
        targetAmount: 15,
        unit: "分",
        xp: 15,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
    ],
    weeklyRecords: buildWeeklyRecords([5, 5, 4, 5, 5, 4], 5),
  },
  {
    id: "youngest",
    name: "次男",
    level: 3,
    levelTitle: "習慣化中",
    xp: 410,
    streak: 5,
    monthlyDays: 12,
    bestStreak: 8,
    goal: "毎日少しずつ挑戦",
    examDate: null,
    missions: [
      {
        id: "youngest-homework",
        title: "学校宿題",
        category: "学校",
        targetAmount: 1,
        unit: "回",
        xp: 30,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "youngest-tablet",
        title: "タブレット学習 1講座",
        category: "学習",
        targetAmount: 1,
        unit: "講座",
        xp: 25,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "youngest-reading-aloud",
        title: "音読 10分",
        category: "学習",
        targetAmount: 10,
        unit: "分",
        xp: 15,
        completed: true,
        weekdays: ALL_WEEKDAYS,
      },
      {
        id: "youngest-kanji",
        title: "漢字 5個",
        category: "学習",
        targetAmount: 5,
        unit: "個",
        xp: 15,
        completed: false,
        weekdays: ALL_WEEKDAYS,
      },
    ],
    weeklyRecords: buildWeeklyRecords([4, 3, 4, 2, 4, 3], 4),
  },
];
