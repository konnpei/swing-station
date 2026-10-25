import type { Config } from "tailwindcss";

// Tailwindを適用する対象ファイルを指定する設定です。
// app配下とcomponents配下のtsx/tsファイルを対象にしています。
const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // アクセントカラーと、明暗テーマで切り替わる色はすべてCSS変数
        // （globals.cssで定義）を参照する形にしている。
        // bg-accent/20 のような透過指定もできるよう、この書き方にしている。
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        good: "#22c55e", // 完了状態（緑）
        warn: "#eab308", // 注意状態（黄色）

        // 明暗テーマ対応の色トークン。SETTINGS画面の明暗切り替えで
        // globals.css側の値（:root＝ライト、[data-theme="dark"]＝ダーク）が切り替わる。
        canvas: "rgb(var(--color-canvas-rgb) / <alpha-value>)", // ページ全体の背景
        surface: "rgb(var(--color-surface-rgb) / <alpha-value>)", // カードの背景
        "surface-muted": "rgb(var(--color-surface-muted-rgb) / <alpha-value>)", // カード内のへこんだ要素（入力欄など）
        "surface-strong": "rgb(var(--color-surface-strong-rgb) / <alpha-value>)", // チップ・ピルなど少し目立つ背景
        ink: "rgb(var(--color-ink-rgb) / <alpha-value>)", // 主要な文字色
        "ink-muted": "rgb(var(--color-ink-muted-rgb) / <alpha-value>)", // 補助的な文字色
        "ink-faint": "rgb(var(--color-ink-faint-rgb) / <alpha-value>)", // さらに控えめな文字色
        subtle: "rgb(var(--color-border-subtle-rgb) / <alpha-value>)", // カードの枠線
        strong: "rgb(var(--color-border-strong-rgb) / <alpha-value>)", // 入力欄・ボタンの枠線
      },
    },
  },
  plugins: [],
};

export default config;
