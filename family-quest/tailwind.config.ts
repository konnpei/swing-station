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
        // ゲーム×家族×学習のテーマ用に、アクセントカラーだけ名前を付けています。
        accent: "#6366f1", // 紫寄りの青（メインのアクセント色）
        good: "#22c55e", // 完了状態（緑）
        warn: "#eab308", // 注意状態（黄色）
      },
    },
  },
  plugins: [],
};

export default config;
