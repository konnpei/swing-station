import { useEffect, useMemo, useRef, useState } from "react";
import Head from "next/head";
import * as THREE from "three";
import { Canvas, useFrame } from "@react-three/fiber";

/* Issue #29([L-010]) Market Universe — Phase EXP-1 モックデモ。
   CEO/ChatGPTの安全条件により、有料API・新規契約・Secrets・データ取得
   パイプライン・mainには一切触れない。独立ページ(/market-universe)として
   既存のBriefingView/MarketDashboard/SectorRankingとは完全に切り離してある。

   実データと mock の内訳(誠実性のため明記):
   - 実データ: 銘柄コード・会社名・セクター・当日騰落率・株価(jp_all_changes、
     既存/api/latestから取得。67銘柄)、日経平均騰落率(相対強度の基準値)
   - モック: 出来高急増率・PBR帯・売買代金相当サイズ・シグナル強度
     (現行データパイプラインにこれらの実データが無いため。Issue #29の
     監査コメント参照。is_mock相当の扱いとして、画面上に常時「MOCK」表示)

   InstancedMeshで全銘柄を1 draw callで描画(ChatGPT提案の定石通り)。
   OrbitControls等の追加ライブラリ(@react-three/drei)は導入せず、
   ポインタドラッグによる手動回転のみで最小実装している。 */

const BG = "#080D10";
const SURFACE = "#13161C";
const BORDER = "#1B1F26";
const TEXT = "#FFFFFF";
const SUB = "#A1A7B3";
const DIM = "#6B7280";
const ACCENT = "#FFB020";
const POSITIVE = "#00E0A3";
const NEGATIVE = "#ff5566";

// セクター名 → 疑似クラスター角度(ハッシュベース。物理シミュレーションではなく
// 「同じセクターは近い方向に集まる」という見た目上の近似)
function sectorAngle(sector) {
  let h = 0;
  for (let i = 0; i < sector.length; i++) h = (h * 31 + sector.charCodeAt(i)) % 360;
  return (h / 360) * Math.PI * 2;
}

// 銘柄コードから決定論的な擬似乱数を作る(毎回同じ見た目になるようにするため。
// Math.random()だと再読み込みのたびに配置が変わってしまう)
function seededRandom(seed) {
  let s = 0;
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) % 100000;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildUniverse(jpAllChanges, nikkeiPct) {
  const benchmarkPct = typeof nikkeiPct === "number" ? nikkeiPct : 0;
  return jpAllChanges.map((s) => {
    const rand = seededRandom(s.code);
    const relativeStrength = (s.pct || 0) - benchmarkPct;
    const angle = sectorAngle(s.sector || "その他");
    const radius = 3 + rand() * 5;
    const volumeSurge = 0.5 + rand() * 3; // モック(出来高急増率相当)
    const pbrBand = Math.floor(rand() * 4); // モック: 0=1倍未満 1=1〜3倍 2=3倍超 3=欠損
    const signalStrength = Math.min(1, (Math.abs(relativeStrength) / 5 + Math.abs(volumeSurge - 1) / 3) / 2);
    return {
      code: s.code,
      name: s.name,
      sector: s.sector,
      price: s.price,
      change_pct: s.pct,
      relative_strength: relativeStrength,
      volume_surge: volumeSurge,
      pbr_band: pbrBand,
      signal_strength: signalStrength,
      is_mock_fields: ["volume_surge", "pbr_band", "signal_strength"],
      // 3D座標: X=相対強度 Y=騰落率 Z=セクター角度×半径(疑似クラスター) + 出来高急増率で奥行きに散らす
      pos: [
        relativeStrength * 0.6,
        (s.pct || 0) * 0.5,
        Math.cos(angle) * radius + (volumeSurge - 1) * 1.2,
      ],
      posZ2: Math.sin(angle) * radius,
    };
  });
}

const PBR_COLORS = ["#00E0A3", "#FFB020", "#ff5566", "#4A5568"]; // 1倍未満/1-3倍/3倍超/欠損(モック配色)

function StarField({ points, onSelect }) {
  const meshRef = useRef();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const colorObj = useMemo(() => new THREE.Color(), []);

  useEffect(() => {
    if (!meshRef.current) return;
    points.forEach((p, i) => {
      dummy.position.set(p.pos[0], p.pos[1], p.posZ2);
      const scale = 0.12 + Math.min(0.5, Math.abs(p.change_pct || 0) * 0.04);
      dummy.scale.setScalar(scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
      colorObj.set(PBR_COLORS[p.pbr_band]);
      meshRef.current.setColorAt(i, colorObj);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
    if (meshRef.current.instanceColor) meshRef.current.instanceColor.needsUpdate = true;
  }, [points, dummy, colorObj]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[null, null, points.length]}
      onClick={(e) => {
        e.stopPropagation();
        if (e.instanceId !== undefined) onSelect(points[e.instanceId]);
      }}
    >
      <sphereGeometry args={[1, 12, 12]} />
      <meshStandardMaterial emissive="#111111" emissiveIntensity={0.4} />
    </instancedMesh>
  );
}

function Benchmarks() {
  // 中心ノード(日経/S&P500/SOX相当)。相対強度の基準そのものなので原点に固定表示。
  const labels = [{ label: "NIKKEI", color: ACCENT }];
  return labels.map((b, i) => (
    <mesh key={b.label} position={[0, 0, 0]}>
      <octahedronGeometry args={[0.35]} />
      <meshStandardMaterial color={b.color} emissive={b.color} emissiveIntensity={0.6} />
    </mesh>
  ));
}

function RotatingGroup({ children, dragRef }) {
  const groupRef = useRef();
  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.rotation.y = dragRef.current.rotY;
    groupRef.current.rotation.x = dragRef.current.rotX;
    if (!dragRef.current.dragging) dragRef.current.rotY += 0.0015; // 触っていない間は自動でゆっくり回転
  });
  return <group ref={groupRef}>{children}</group>;
}

export default function MarketUniversePage() {
  const [briefing, setBriefing] = useState(null);
  const [selected, setSelected] = useState(null);
  const dragRef = useRef({ dragging: false, lastX: 0, lastY: 0, rotY: 0.6, rotX: 0.3 });

  useEffect(() => {
    fetch("/api/latest").then((r) => r.json()).then(setBriefing).catch(() => {});
  }, []);

  const points = useMemo(() => {
    if (!briefing?.jp_all_changes) return [];
    return buildUniverse(briefing.jp_all_changes, briefing.nikkei_pct);
  }, [briefing]);

  const onPointerDown = (e) => {
    dragRef.current.dragging = true;
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };
  const onPointerMove = (e) => {
    if (!dragRef.current.dragging) return;
    const dx = e.clientX - dragRef.current.lastX;
    const dy = e.clientY - dragRef.current.lastY;
    dragRef.current.rotY += dx * 0.005;
    dragRef.current.rotX = Math.max(-1, Math.min(1, dragRef.current.rotX + dy * 0.005));
    dragRef.current.lastX = e.clientX;
    dragRef.current.lastY = e.clientY;
  };
  const onPointerUp = () => { dragRef.current.dragging = false; };

  return (
    <>
      <Head><title>Market Universe(実験)｜KabuBocchi</title></Head>
      <div style={{ position: "fixed", inset: 0, background: BG, color: SUB, fontFamily: "'JetBrains Mono','Courier New',monospace" }}>
        <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 2, display: "flex", justifyContent: "space-between", alignItems: "flex-start", pointerEvents: "none" }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>🌌 Market Universe</div>
            <div style={{ fontSize: 10, color: DIM, marginTop: 2 }}>実験ページ(Phase EXP-1)・{points.length}銘柄・ドラッグで回転</div>
          </div>
          <div style={{ background: ACCENT + "18", border: `1px solid ${ACCENT}66`, color: ACCENT, fontSize: 10, fontWeight: 700, padding: "3px 9px", borderRadius: 999 }}>
            MOCK DEMO
          </div>
        </div>

        <div
          style={{ position: "absolute", inset: 0 }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <Canvas camera={{ position: [0, 0, 14], fov: 55 }} dpr={[1, 1.5]}>
            <ambientLight intensity={0.5} />
            <pointLight position={[10, 10, 10]} intensity={1.2} />
            <RotatingGroup dragRef={dragRef}>
              <Benchmarks />
              {points.length > 0 && <StarField points={points} onSelect={setSelected} />}
            </RotatingGroup>
          </Canvas>
        </div>

        {selected && (
          <div style={{ position: "absolute", bottom: 70, left: 12, right: 12, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: "12px 14px", zIndex: 3 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: TEXT }}>{selected.name} <span style={{ color: DIM, fontWeight: 400 }}>({selected.code})</span></div>
              <button onClick={() => setSelected(null)} style={{ background: "none", border: "none", color: DIM, cursor: "pointer", fontSize: 14 }}>✕</button>
            </div>
            <div style={{ fontSize: 11, color: SUB, marginTop: 4 }}>{selected.sector} ・ ¥{selected.price?.toLocaleString?.() ?? selected.price}</div>
            <div style={{ display: "flex", gap: 14, marginTop: 8, fontSize: 11 }}>
              <span style={{ color: (selected.change_pct || 0) >= 0 ? POSITIVE : NEGATIVE }}>騰落率 {selected.change_pct >= 0 ? "+" : ""}{selected.change_pct}%</span>
              <span style={{ color: SUB }}>相対強度 {selected.relative_strength >= 0 ? "+" : ""}{selected.relative_strength.toFixed(2)}</span>
              <span style={{ color: DIM }}>出来高急増(mock) x{selected.volume_surge.toFixed(1)}</span>
            </div>
          </div>
        )}

        <div style={{ position: "absolute", bottom: 12, left: 12, right: 12, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 9.5, color: DIM, zIndex: 2, pointerEvents: "none" }}>
          <div style={{ display: "flex", gap: 10 }}>
            {["1倍未満", "1〜3倍", "3倍超", "欠損"].map((l, i) => (
              <span key={l} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: PBR_COLORS[i], display: "inline-block" }} />{l}(PBR・mock)
              </span>
            ))}
          </div>
          <a href="/" style={{ color: DIM, textDecoration: "underline", pointerEvents: "auto" }}>朝刊へ戻る</a>
        </div>
      </div>
    </>
  );
}
