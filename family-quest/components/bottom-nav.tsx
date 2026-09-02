// =============================================================
// BottomNav：画面下部のナビゲーション。
// どのタブをタップしても、そのキー（"home" / "calendar" など）を
// onNavigateで親に伝えるだけのシンプルな作りにしている。
// 実際にどの画面を表示するかはpage.tsx側で決める。
// =============================================================

"use client";

import {
  Home,
  Users,
  CalendarDays,
  Gift,
  Settings,
  Target,
  LucideIcon,
} from "lucide-react";
import { Mode } from "../lib/dummy-data";

type NavItem = {
  key: string;
  label: string;
  icon: LucideIcon;
};

const PARENT_NAV_ITEMS: NavItem[] = [
  { key: "home", label: "HOME", icon: Home },
  { key: "children", label: "CHILDREN", icon: Users },
  { key: "calendar", label: "CALENDAR", icon: CalendarDays },
  { key: "reward", label: "REWARD", icon: Gift },
  { key: "settings", label: "SETTINGS", icon: Settings },
];

const CHILD_NAV_ITEMS: NavItem[] = [
  { key: "home", label: "HOME", icon: Home },
  { key: "calendar", label: "CALENDAR", icon: CalendarDays },
  { key: "quest", label: "QUEST", icon: Target },
  { key: "reward", label: "REWARD", icon: Gift },
  { key: "settings", label: "SETTINGS", icon: Settings },
];

type BottomNavProps = {
  mode: Mode;
  /** 今どの項目を選択中として表示するか（省略時は"home"） */
  activeKey?: string;
  /** タブをタップしたときに、そのキーを伝える */
  onNavigate: (key: string) => void;
};

export default function BottomNav({
  mode,
  activeKey = "home",
  onNavigate,
}: BottomNavProps) {
  const items = mode === "parent" ? PARENT_NAV_ITEMS : CHILD_NAV_ITEMS;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-neutral-800 bg-neutral-950/95 backdrop-blur"
      aria-label="下部ナビゲーション"
    >
      <div className="mx-auto flex max-w-md items-stretch justify-between px-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeKey;
          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              onClick={() => onNavigate(item.key)}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium ${
                isActive ? "text-accent" : "text-gray-500"
              }`}
            >
              <Icon size={22} />
              {item.label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
