// =============================================================
// page.tsx：FAMILY QUESTのメイン画面。
// STEP1では1ページの中で「保護者モード⇔子どもモード」を切り替える構成。
// STEP2で「保護者によるミッション設定（追加・編集・削除）」を追加した。
// STEP3で、環境変数が設定されていればSupabaseと連携して保存するようにした
// （設定されていなければ、これまで通りブラウザの中だけで完結する）。
// STEP4で下部ナビの全タブ（CALENDAR/QUEST/REWARD/CHILDREN/SETTINGS）を
// 実際に動く画面にした。
//
// 状態（family, mode, activeView, editingChildId）はすべてここで管理し、
// 下の階層にはprops経由でデータと更新用の関数だけを渡している。
// =============================================================

"use client";

import { useEffect, useRef, useState } from "react";
import BottomNav from "../components/bottom-nav";
import CalendarScreen from "../components/calendar-screen";
import ChildHome from "../components/child-home";
import ChildrenScreen from "../components/children-screen";
import ChildSettingsView from "../components/child-settings-view";
import FamilyDashboard from "../components/family-dashboard";
import FamilyQuestScreen from "../components/family-quest-screen";
import MissionEditor from "../components/mission-editor";
import ModeSwitcher from "../components/mode-switcher";
import QuestScreen from "../components/quest-screen";
import RewardScreen from "../components/reward-screen";
import SettingsScreen from "../components/settings-screen";
import {
  ChildId,
  initialFamily,
  Mission,
  Mode,
  NewMissionInput,
  ProfileUpdateInput,
} from "../lib/dummy-data";
import {
  deleteMissionRow,
  insertMission,
  loadFamily,
  saveChildProfile,
  saveChildXp,
  saveMissionCompleted,
  updateMissionRow,
} from "../lib/family-repository";
import {
  loadFamilyFromLocalStorage,
  saveFamilyToLocalStorage,
} from "../lib/local-storage";
import { isSupabaseConfigured } from "../lib/supabase";
import { applyAccentColor, loadAccentColorId } from "../lib/theme";
import {
  createMissionId,
  getXpDelta,
  getXpDeltaForDelete,
  getXpDeltaForEdit,
} from "../lib/utils";

// 下部ナビで切り替える画面の種類。BottomNavの各ボタンのkeyと一致させている
type ActiveView = "home" | "calendar" | "quest" | "reward" | "children" | "settings";

export default function Page() {
  // 家族全員分のデータ（ミッションの完了状態・XPなど）
  // 初期値はダミーデータにしておき、Supabaseが設定されていれば
  // マウント後に読み込み直す（未設定の環境ではこのままダミーデータで動く）
  const [family, setFamily] = useState(initialFamily);
  // 今どのモードを見ているか（初期表示は保護者モード）
  const [mode, setMode] = useState<Mode>("parent");
  // 下部ナビで今どの画面を表示しているか（初期表示はHOME）
  const [activeView, setActiveView] = useState<ActiveView>("home");
  // 下部ナビのHOME以外をタップしたときの案内メッセージ（共有ボタンなどで使用）
  const [notice, setNotice] = useState<string | null>(null);
  // 保護者モードで「ミッション設定」画面を開いている子どものID（開いていなければnull）
  const [editingChildId, setEditingChildId] = useState<ChildId | null>(null);
  // 保護者HOMEの「Family Quest」カードから、詳細画面を開いているかどうか
  const [showFamilyQuest, setShowFamilyQuest] = useState(false);
  // 初回の読み込みが終わるまでは、localStorageへの保存を行わないためのフラグ
  const isFirstRender = useRef(true);

  // マウント時に、保存されているテーマカラー（アクセントカラー）を反映する
  useEffect(() => {
    applyAccentColor(loadAccentColorId());
  }, []);

  // マウント時に、Supabase（設定されていれば）またはlocalStorage（家族共用の1台で使う場合）から読み込む
  useEffect(() => {
    if (isSupabaseConfigured) {
      loadFamily().then(setFamily);
      return;
    }
    const saved = loadFamilyFromLocalStorage();
    if (saved) setFamily(saved);
  }, []);

  // familyが変わるたびに、Supabase未設定であればlocalStorageに保存する
  // （＝家族共用の1台の端末で使う場合、リロードしても状態が消えないようにする）
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (!isSupabaseConfigured) {
      saveFamilyToLocalStorage(family);
    }
  }, [family]);

  function showNotice(message: string) {
    setNotice(message);
    // 3秒後に自動で消す
    window.setTimeout(() => setNotice(null), 3000);
  }

  // モードを切り替えるときは、開いている画面を閉じてHOMEに戻す
  function handleChangeMode(nextMode: Mode) {
    setEditingChildId(null);
    setShowFamilyQuest(false);
    setActiveView("home");
    setMode(nextMode);
  }

  // 下部ナビのタブをタップしたときの処理
  function handleNavigate(key: string) {
    setEditingChildId(null);
    setShowFamilyQuest(false);
    setActiveView(key as ActiveView);
  }

  /** 子ども（＝モード切替タブ）の並び順を1つ上下に入れ替える */
  function handleMoveChild(childId: ChildId, direction: "up" | "down") {
    setFamily((prevFamily) => {
      const index = prevFamily.findIndex((c) => c.id === childId);
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (index === -1 || targetIndex < 0 || targetIndex >= prevFamily.length) {
        return prevFamily;
      }
      const next = [...prevFamily];
      [next[index], next[targetIndex]] = [next[targetIndex], next[index]];
      return next;
    });
  }

  // 特定の子どものミッションを1件だけ更新するための共通処理
  function updateChildMissions(
    childId: ChildId,
    xpDelta: number,
    updateMissions: (missions: Mission[]) => Mission[]
  ) {
    setFamily((prevFamily) =>
      prevFamily.map((child) =>
        child.id === childId
          ? {
              ...child,
              xp: child.xp + xpDelta,
              missions: updateMissions(child.missions),
            }
          : child
      )
    );
  }

  /**
   * ミッションの完了/未完了を切り替える。
   * 子どもモードのときだけ呼ばれる想定（保護者モードでは変更不可）。
   * 現在のXPを基準に、そのミッション分のXPを加算・減算する。
   */
  function handleToggleMission(childId: ChildId, missionId: string) {
    const child = family.find((c) => c.id === childId);
    const targetMission = child?.missions.find((m) => m.id === missionId);
    if (!child || !targetMission) return;

    const xpDelta = getXpDelta(targetMission);
    const nextCompleted = !targetMission.completed;

    updateChildMissions(childId, xpDelta, (missions) =>
      missions.map((mission) =>
        mission.id === missionId
          ? { ...mission, completed: nextCompleted }
          : mission
      )
    );

    // Supabase未設定のときは何もしない（family-repository内で判定される）
    saveMissionCompleted(missionId, nextCompleted);
    saveChildXp(childId, child.xp + xpDelta);
  }

  /** 保護者がミッションを新規追加する（追加直後は必ず未完了） */
  function handleAddMission(childId: ChildId, input: NewMissionInput) {
    const newMission: Mission = {
      id: createMissionId(childId),
      completed: false,
      ...input,
    };
    updateChildMissions(childId, 0, (missions) => [...missions, newMission]);
    insertMission(childId, newMission.id, input);
  }

  /** 保護者がミッションの内容を編集する（完了状態はここでは変更しない） */
  function handleUpdateMission(
    childId: ChildId,
    missionId: string,
    input: NewMissionInput
  ) {
    const child = family.find((c) => c.id === childId);
    const targetMission = child?.missions.find((m) => m.id === missionId);
    if (!child || !targetMission) return;

    const xpDelta = getXpDeltaForEdit(targetMission, input.xp);

    updateChildMissions(childId, xpDelta, (missions) =>
      missions.map((mission) =>
        mission.id === missionId ? { ...mission, ...input } : mission
      )
    );

    updateMissionRow(missionId, input);
    if (xpDelta !== 0) saveChildXp(childId, child.xp + xpDelta);
  }

  /** 保護者が子どものプロフィール（名前・目標・試験日）を編集する */
  function handleUpdateProfile(childId: ChildId, input: ProfileUpdateInput) {
    setFamily((prevFamily) =>
      prevFamily.map((child) =>
        child.id === childId ? { ...child, ...input } : child
      )
    );
    saveChildProfile(childId, input);
  }

  /** 保護者がミッションを削除する */
  function handleDeleteMission(childId: ChildId, missionId: string) {
    const child = family.find((c) => c.id === childId);
    const targetMission = child?.missions.find((m) => m.id === missionId);
    if (!child || !targetMission) return;

    const xpDelta = getXpDeltaForDelete(targetMission);

    updateChildMissions(childId, xpDelta, (missions) =>
      missions.filter((mission) => mission.id !== missionId)
    );

    deleteMissionRow(missionId);
    if (xpDelta !== 0) saveChildXp(childId, child.xp + xpDelta);
  }

  const currentChild =
    mode !== "parent" ? family.find((c) => c.id === mode) ?? null : null;
  const editingChild = editingChildId
    ? family.find((c) => c.id === editingChildId) ?? null
    : null;

  return (
    <div className="min-h-screen bg-black">
      <ModeSwitcher
        family={family}
        currentMode={mode}
        onChangeMode={handleChangeMode}
      />

      {mode === "parent" && editingChild && (
        <MissionEditor
          child={editingChild}
          onAddMission={(input) => handleAddMission(editingChild.id, input)}
          onUpdateMission={(missionId, input) =>
            handleUpdateMission(editingChild.id, missionId, input)
          }
          onDeleteMission={(missionId) =>
            handleDeleteMission(editingChild.id, missionId)
          }
          onUpdateProfile={(input) =>
            handleUpdateProfile(editingChild.id, input)
          }
          onClose={() => setEditingChildId(null)}
        />
      )}

      {mode === "parent" && !editingChild && activeView === "settings" && (
        <SettingsScreen
          family={family}
          onUpdateProfile={handleUpdateProfile}
          onMoveChild={handleMoveChild}
          onClose={() => setActiveView("home")}
        />
      )}

      {mode === "parent" && !editingChild && activeView === "children" && (
        <ChildrenScreen
          family={family}
          onViewChild={(childId) => setMode(childId)}
          onClose={() => setActiveView("home")}
        />
      )}

      {mode === "parent" && !editingChild && activeView === "calendar" && (
        <CalendarScreen
          family={family}
          initialChildId={family[0].id}
          allowChildSwitch
          onClose={() => setActiveView("home")}
        />
      )}

      {mode === "parent" && !editingChild && activeView === "reward" && (
        <RewardScreen family={family} onClose={() => setActiveView("home")} />
      )}

      {mode === "parent" &&
        !editingChild &&
        activeView === "home" &&
        showFamilyQuest && (
          <FamilyQuestScreen
            family={family}
            onClose={() => setShowFamilyQuest(false)}
          />
        )}

      {mode === "parent" &&
        !editingChild &&
        activeView === "home" &&
        !showFamilyQuest && (
          <FamilyDashboard
            family={family}
            onViewChild={(childId) => setMode(childId)}
            onEditMissions={(childId) => setEditingChildId(childId)}
            onOpenFamilyQuest={() => setShowFamilyQuest(true)}
            onShare={() => showNotice("この画面は次のSTEPで実装します")}
          />
        )}

      {mode !== "parent" && currentChild && activeView === "settings" && (
        <ChildSettingsView
          child={currentChild}
          onClose={() => setActiveView("home")}
        />
      )}

      {mode !== "parent" && currentChild && activeView === "quest" && (
        <QuestScreen
          child={currentChild}
          onToggleMission={(missionId) =>
            handleToggleMission(currentChild.id, missionId)
          }
          onClose={() => setActiveView("home")}
        />
      )}

      {mode !== "parent" && currentChild && activeView === "calendar" && (
        <CalendarScreen
          family={[currentChild]}
          initialChildId={currentChild.id}
          allowChildSwitch={false}
          onClose={() => setActiveView("home")}
        />
      )}

      {mode !== "parent" && currentChild && activeView === "reward" && (
        <RewardScreen
          family={[currentChild]}
          onClose={() => setActiveView("home")}
        />
      )}

      {mode !== "parent" && currentChild && activeView === "home" && (
        <ChildHome
          child={currentChild}
          onToggleMission={(missionId) =>
            handleToggleMission(currentChild.id, missionId)
          }
        />
      )}

      {notice && (
        <div className="fixed inset-x-0 bottom-20 z-20 flex justify-center px-4">
          <div className="rounded-full bg-neutral-800 px-4 py-2 text-xs text-gray-100 shadow-lg">
            {notice}
          </div>
        </div>
      )}

      <BottomNav mode={mode} activeKey={activeView} onNavigate={handleNavigate} />
    </div>
  );
}
