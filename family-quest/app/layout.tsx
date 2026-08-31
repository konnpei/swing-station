import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FAMILY QUEST",
  description: "家族でミッションに取り組むダッシュボード（STEP1: ダミーデータ版）",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
