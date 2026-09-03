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
        // アクセントカラーだけは、SETTINGS画面でユーザーが選べるようにするため
        // CSS変数（globals.cssで定義）を参照する形にしている。
        // bg-accent/20 のような透過指定もできるよう、この書き方にしている。
        accent: "rgb(var(--color-accent-rgb) / <alpha-value>)",
        good: "#22c55e", // 完了状態（緑）
        warn: "#eab308", // 注意状態（黄色）
      },
    },
  },
  plugins: [],
};

export default config;
