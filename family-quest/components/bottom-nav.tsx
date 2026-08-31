// =============================================================
// BottomNav：画面下部のナビゲーション。
// STEP1で実際に動くのはHOMEだけ。それ以外は「次のSTEPで実装します」と
// 案内するだけにしている（onSelectNonHomeで親に伝える）。
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
  onSelectNonHome: () => void;
  onHome?: () => void;
};

export default function BottomNav({
  mode,
  onSelectNonHome,
  onHome,
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
          const isHome = item.key === "home";
          return (
            <button
              key={item.key}
              type="button"
              aria-label={item.label}
              onClick={() => {
                if (isHome) {
                  onHome?.();
                } else {
                  onSelectNonHome();
                }
              }}
              className={`flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium ${
                isHome ? "text-accent" : "text-gray-500"
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
