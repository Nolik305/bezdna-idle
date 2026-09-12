import { MOBS } from "../game/data";
import { mobSprite } from "../game/sprites";
import type { ClassId, Slot, Item } from "../game/types";

/* ============ MONSTERS ============ */
function Art({ k, c1, c2 }: { k: string; c1: string; c2: string }) {
  switch (k) {
    case "slime": return (<>
      <path d="M18 78 Q14 46 50 40 Q86 46 82 78 Q66 88 50 86 Q34 88 18 78 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <circle cx="30" cy="52" r="4" fill={c2} opacity=".45" /><circle cx="68" cy="54" r="3" fill={c2} opacity=".45" />
      <ellipse cx="38" cy="62" rx="6" ry="8" fill="#fff" /><circle cx="39" cy="64" r="3" fill="#22252c" />
      <ellipse cx="62" cy="62" rx="6" ry="8" fill="#fff" /><circle cx="61" cy="64" r="3" fill="#22252c" />
      <path d="M42 76 Q50 82 58 76" stroke="#22252c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>);
    case "shroom": return (<>
      <rect x="40" y="46" width="20" height="36" rx="9" fill="#e8d9b0" stroke="#8a7a55" strokeWidth="2.5" />
      <path d="M16 52 Q18 16 50 14 Q82 16 84 52 Q66 44 50 46 Q34 44 16 52 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <circle cx="34" cy="30" r="5" fill="#fff" opacity=".85" /><circle cx="58" cy="24" r="4" fill="#fff" opacity=".85" /><circle cx="70" cy="37" r="3.5" fill="#fff" opacity=".85" />
      <circle cx="45" cy="58" r="2.5" fill="#22252c" /><circle cx="55" cy="58" r="2.5" fill="#22252c" />
      <path d="M45 68 Q50 72 55 68" stroke="#22252c" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>);
    case "wolf": return (<>
      <path d="M20 62 Q18 42 34 36 L30 20 L45 31 Q50 30 55 31 L70 20 L66 36 Q82 42 80 62 Q80 82 50 84 Q20 82 20 62 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <path d="M34 50 L46 53 M66 50 L54 53" stroke="#22252c" strokeWidth="3" strokeLinecap="round" />
      <circle cx="42" cy="55" r="2.6" fill="#ffd166" /><circle cx="58" cy="55" r="2.6" fill="#ffd166" />
      <path d="M44 66 Q50 70 56 66" stroke="#22252c" strokeWidth="2.5" fill="none" />
      <path d="M45 68 L47 74 L49 68 Z M51 68 L53 74 L55 68 Z" fill="#fff" />
    </>);
    case "treant": return (<>
      <path d="M36 50 L16 36 M64 50 L84 36" stroke={c1} strokeWidth="9" strokeLinecap="round" />
      <rect x="34" y="36" width="32" height="48" rx="12" fill={c1} stroke={c2} strokeWidth="3" />
      <circle cx="38" cy="24" r="10" fill="#6f9e4a" /><circle cx="62" cy="24" r="10" fill="#6f9e4a" /><circle cx="50" cy="17" r="11" fill="#7db356" />
      <circle cx="44" cy="52" r="4" fill="#ffd166" /><circle cx="56" cy="52" r="4" fill="#ffd166" />
      <circle cx="44" cy="52" r="1.8" fill="#22252c" /><circle cx="56" cy="52" r="1.8" fill="#22252c" />
      <path d="M42 66 L46 62 L50 66 L54 62 L58 66" stroke="#2b1c10" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M40 44 v28 M60 42 v30" stroke={c2} strokeWidth="2" opacity=".6" />
    </>);
    case "skel": return (<>
      <circle cx="50" cy="34" r="19" fill={c1} stroke={c2} strokeWidth="3" />
      <ellipse cx="42" cy="32" rx="4.5" ry="6" fill="#22252c" /><ellipse cx="58" cy="32" rx="4.5" ry="6" fill="#22252c" />
      <path d="M50 40 l-2.5 5 h5 Z" fill="#22252c" />
      <rect x="41" y="50" width="18" height="9" rx="3.5" fill={c1} stroke={c2} strokeWidth="2.5" />
      <path d="M45 50 v9 M50 50 v9 M55 50 v9" stroke={c2} strokeWidth="1.5" />
      <path d="M36 68 h28 M39 76 h22 M42 84 h16" stroke={c1} strokeWidth="5" strokeLinecap="round" />
    </>);
    case "rat": return (<>
      <path d="M76 70 Q94 76 89 56" stroke={c2} strokeWidth="4" fill="none" strokeLinecap="round" />
      <circle cx="34" cy="42" r="9" fill={c1} stroke={c2} strokeWidth="2.5" /><circle cx="66" cy="42" r="9" fill={c1} stroke={c2} strokeWidth="2.5" />
      <circle cx="34" cy="42" r="4" fill="#e8a0a0" /><circle cx="66" cy="42" r="4" fill="#e8a0a0" />
      <ellipse cx="50" cy="64" rx="27" ry="21" fill={c1} stroke={c2} strokeWidth="3" />
      <circle cx="42" cy="58" r="2.6" fill="#22252c" /><circle cx="58" cy="58" r="2.6" fill="#22252c" />
      <path d="M50 64 l-3 4 h6 Z" fill="#e88" />
      <path d="M30 66 h-12 M31 72 h-10 M70 66 h12 M69 72 h10" stroke={c2} strokeWidth="1.5" />
      <path d="M47 71 v5 M53 71 v5" stroke="#fff" strokeWidth="2.5" />
    </>);
    case "bat": return (<>
      <path d="M50 48 Q32 26 8 40 Q20 43 16 56 Q28 53 27 66 Q38 60 50 64 Q62 60 73 66 Q72 53 84 56 Q80 43 92 40 Q68 26 50 48 Z" fill={c1} stroke={c2} strokeWidth="2.5" />
      <ellipse cx="50" cy="56" rx="12" ry="14" fill={c1} stroke={c2} strokeWidth="2.5" />
      <path d="M43 42 L40 34 L47 40 Z M57 42 L60 34 L53 40 Z" fill={c1} stroke={c2} strokeWidth="2" />
      <circle cx="45" cy="54" r="2.4" fill="#ff5a5a" /><circle cx="55" cy="54" r="2.4" fill="#ff5a5a" />
      <path d="M47 62 l2 4 2-4" fill="#fff" />
    </>);
    case "boneTyrant": return (<>
      <path d="M30 30 Q22 8 40 16 M70 30 Q78 8 60 16" stroke={c2} strokeWidth="6" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="42" r="24" fill={c1} stroke={c2} strokeWidth="3" />
      <ellipse cx="41" cy="40" rx="5.5" ry="7.5" fill="#3a0f12" /><ellipse cx="59" cy="40" rx="5.5" ry="7.5" fill="#3a0f12" />
      <circle cx="41" cy="40" r="2" fill="#ff5a5a" /><circle cx="59" cy="40" r="2" fill="#ff5a5a" />
      <rect x="39" y="60" width="22" height="10" rx="4" fill={c1} stroke={c2} strokeWidth="2.5" />
      <path d="M44 60 v10 M50 60 v10 M56 60 v10" stroke={c2} strokeWidth="1.5" />
      <path d="M34 76 h32 M38 84 h24" stroke={c1} strokeWidth="6" strokeLinecap="round" />
    </>);
    case "bandit": return (<>
      <path d="M28 80 Q22 40 50 30 Q78 40 72 80 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <rect x="35" y="56" width="30" height="15" rx="7" fill="#3a2a20" />
      <path d="M38 50 h9 M53 50 h9" stroke="#f5f0e6" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M76 62 L88 50 L90 58 L80 68 Z" fill="#c9d4de" stroke="#7c8ea0" strokeWidth="2" />
      <path d="M40 42 L45 38" stroke={c2} strokeWidth="2.5" />
    </>);
    case "thrower": return (<>
      <path d="M28 80 Q22 40 50 30 Q78 40 72 80 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <rect x="35" y="56" width="30" height="15" rx="7" fill="#2c3540" />
      <path d="M38 50 h9 M53 50 h9" stroke="#f5f0e6" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M14 46 l10-6 2 5 -10 6 Z M80 70 l12-4 0 6 -11 4 Z M12 66 l11-3 1 5 -11 3 Z" fill="#c9d4de" stroke="#7c8ea0" strokeWidth="1.5" />
    </>);
    case "ogre": return (<>
      <circle cx="50" cy="52" r="29" fill={c1} stroke={c2} strokeWidth="3" />
      <path d="M30 42 Q40 36 47 42 M70 42 Q60 36 53 42" stroke={c2} strokeWidth="5" strokeLinecap="round" />
      <circle cx="41" cy="48" r="3" fill="#22252c" /><circle cx="59" cy="48" r="3" fill="#22252c" />
      <circle cx="46" cy="60" r="2" fill={c2} /><circle cx="54" cy="60" r="2" fill={c2} />
      <path d="M38 68 Q50 76 62 68" stroke="#22252c" strokeWidth="3" fill="none" />
      <path d="M40 68 L44 58 L48 68 Z M52 68 L56 58 L60 68 Z" fill="#fff" />
    </>);
    case "ataman": return (<>
      <circle cx="50" cy="52" r="27" fill={c1} stroke={c2} strokeWidth="3" />
      <path d="M20 42 Q50 20 80 42 L80 48 L20 48 Z" fill="#5a3a1a" stroke="#3a2510" strokeWidth="2.5" />
      <rect x="16" y="46" width="68" height="6" rx="3" fill="#6e4a22" />
      <path d="M38 58 h8 M54 58 h8" stroke="#22252c" strokeWidth="4" strokeLinecap="round" />
      <path d="M60 44 L66 60" stroke="#a03a3a" strokeWidth="2.5" />
      <path d="M38 70 Q44 76 50 70 Q56 76 62 70" stroke="#3a2510" strokeWidth="4" fill="none" strokeLinecap="round" />
      <rect x="52" y="69" width="5" height="5" fill="#ffd166" />
    </>);
    case "wisp": return (<>
      <circle cx="50" cy="44" r="22" fill={c1} opacity=".28" />
      <circle cx="50" cy="44" r="14" fill={c1} opacity=".55" />
      <circle cx="50" cy="44" r="8" fill="#eafff9" />
      <circle cx="46" cy="42" r="2" fill="#22252c" /><circle cx="54" cy="42" r="2" fill="#22252c" />
      <path d="M50 58 Q44 74 54 86" stroke={c1} strokeWidth="6" fill="none" strokeLinecap="round" opacity=".6" />
    </>);
    case "golem": return (<>
      <rect x="14" y="40" width="12" height="30" rx="5" fill={c1} stroke={c2} strokeWidth="2.5" />
      <rect x="74" y="40" width="12" height="30" rx="5" fill={c1} stroke={c2} strokeWidth="2.5" />
      <rect x="34" y="80" width="13" height="12" rx="4" fill={c1} stroke={c2} strokeWidth="2.5" />
      <rect x="53" y="80" width="13" height="12" rx="4" fill={c1} stroke={c2} strokeWidth="2.5" />
      <rect x="27" y="30" width="46" height="48" rx="9" fill={c1} stroke={c2} strokeWidth="3" />
      <rect x="35" y="12" width="30" height="20" rx="6" fill={c1} stroke={c2} strokeWidth="3" />
      <rect x="41" y="19" width="7" height="4" rx="1.5" fill="#ffd166" /><rect x="52" y="19" width="7" height="4" rx="1.5" fill="#ffd166" />
      <path d="M50 44 L58 54 L50 64 L42 54 Z" fill="#ffd166" stroke="#8a5f22" strokeWidth="2" />
      <path d="M32 40 l8 6 M68 62 l-8 6" stroke={c2} strokeWidth="2" opacity=".7" />
    </>);
    case "acolyte": return (<>
      <path d="M32 84 Q28 44 50 34 Q72 44 68 84 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <ellipse cx="50" cy="48" rx="10" ry="11" fill="#1d1230" />
      <circle cx="46" cy="47" r="2" fill="#e8d0ff" /><circle cx="54" cy="47" r="2" fill="#e8d0ff" />
      <circle cx="24" cy="60" r="4" fill={c1} opacity=".7" /><circle cx="78" cy="52" r="3" fill={c1} opacity=".7" /><circle cx="74" cy="72" r="2.5" fill={c1} opacity=".7" />
      <path d="M40 70 h20" stroke={c2} strokeWidth="2.5" />
    </>);
    case "devourer": case "voidmaw": return (<>
      <path d="M28 84 Q20 92 16 86 M50 88 Q50 96 44 96 M72 84 Q80 92 84 86" stroke={c2} strokeWidth="5" fill="none" strokeLinecap="round" />
      <circle cx="50" cy="52" r="31" fill={c1} stroke={c2} strokeWidth="3" />
      {k === "voidmaw" && <path d="M50 18 l4 8 -8 0 Z M22 34 l8 5 -6 6 Z M78 34 l-8 5 6 6 Z" fill={c2} />}
      <circle cx="50" cy="58" r="17" fill="#22062e" />
      <path d="M34 56 l5-7 4 6 5-8 4 8 4-6 5 7" stroke="#fff" strokeWidth="2.5" fill="none" strokeLinejoin="round" />
      <circle cx="38" cy="34" r="3.5" fill="#ffd166" /><circle cx="50" cy="30" r="4.5" fill="#ffd166" /><circle cx="62" cy="34" r="3.5" fill="#ffd166" />
      <circle cx="38" cy="34" r="1.5" fill="#22062e" /><circle cx="50" cy="30" r="2" fill="#22062e" /><circle cx="62" cy="34" r="1.5" fill="#22062e" />
    </>);
    case "voidling": return (<>
      <path d="M50 20 Q74 32 70 60 Q68 76 60 84 L56 75 L50 85 L44 75 L40 84 Q32 76 30 60 Q26 32 50 20 Z" fill={c1} stroke={c2} strokeWidth="3" />
      <circle cx="43" cy="48" r="3" fill="#fff" /><circle cx="57" cy="48" r="3" fill="#fff" />
      <circle cx="43" cy="48" r="1.4" fill="#22062e" /><circle cx="57" cy="48" r="1.4" fill="#22062e" />
      <path d="M45 60 Q50 64 55 60" stroke="#22062e" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </>);
    default: return (<>
      <circle cx="50" cy="52" r="28" fill={c1} stroke={c2} strokeWidth="3" />
      <circle cx="41" cy="48" r="4" fill="#22252c" /><circle cx="59" cy="48" r="4" fill="#22252c" />
      <path d="M42 64 Q50 70 58 64" stroke="#22252c" strokeWidth="3" fill="none" strokeLinecap="round" />
    </>);
  }
}

export function MonsterArt({ k, boss, zone = 0, className = "w-full h-full" }: { k: string; boss?: boolean; zone?: number; className?: string }) {
  const m = MOBS[k] ?? MOBS.slime;
  const sprite = mobSprite(k, !!boss, zone);
  if (sprite) {
    return (
      <div className={`relative grid place-items-center ${className}`}>
        {boss && (
          <span className="absolute top-0 left-1/2 -translate-x-1/2 anim-float" aria-hidden>
            <svg viewBox="0 0 100 20" className="w-10 h-4"><path d="M32 13 L36 2 L43 9 L50 0 L57 9 L64 2 L68 13 Z" fill="#f0b429" stroke="#8a5f22" strokeWidth="2" /></svg>
          </span>
        )}
        <img src={sprite} alt={m.n} draggable={false} className={boss ? "anim-boss max-h-full max-w-full object-contain" : "anim-float max-h-full max-w-full object-contain"} />
      </div>
    );
  }
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      {boss && (
        <g className="anim-float">
          <path d="M32 13 L36 2 L43 9 L50 0 L57 9 L64 2 L68 13 Z" fill="#f0b429" stroke="#8a5f22" strokeWidth="2" />
        </g>
      )}
      <g className={boss ? "anim-boss" : ""}><Art k={k} c1={m.c1} c2={m.c2} /></g>
    </svg>
  );
}

/* ============ HEROES ============ */
function Sparkle({ x, y, c }: { x: number; y: number; c: string }) {
  return <path d={`M${x} ${y - 4} L${x + 1.6} ${y - 1.2} L${x + 4} ${y} L${x + 1.6} ${y + 1.2} L${x} ${y + 4} L${x - 1.6} ${y + 1.2} L${x - 4} ${y} L${x - 1.6} ${y - 1.2} Z`} fill={c} opacity="0.95" />;
}

export function HeroArt({ classId, equip, className = "w-full h-full" }: {
  classId: ClassId; equip?: Partial<Record<Slot, Item | null>>; className?: string;
}) {
  const has = (s: Slot) => !!equip?.[s];
  const legendary = Object.values(equip ?? {}).some(i => i && i.rarity === 4);
  const isMage = classId === "mage";
  const robe = isMage ? "#3b6fd4" : "#2f8a4d";
  const robeD = isMage ? "#24448a" : "#1d5c33";
  return (
    <svg viewBox="0 0 100 130" className={className} aria-hidden>
      {legendary && <ellipse cx="50" cy="108" rx="34" ry="10" fill="#fbbf24" opacity="0.18" />}
      <ellipse cx="50" cy="112" rx="30" ry="8" fill="#000" opacity="0.35" />
      {isMage ? (
        <>
          <path d="M50 46 L76 114 Q50 124 24 114 Z" fill={robe} stroke={robeD} strokeWidth="3" />
          <rect x="38" y="78" width="24" height="6" rx="3" fill={has("armor") ? "#f0b429" : robeD} />
          <path d="M80 34 L88 108" stroke="#7a5230" strokeWidth="5" strokeLinecap="round" />
          <circle cx="80" cy="30" r="8" fill={has("weapon") ? "#ffd166" : "#4cc3ff"} opacity="0.9">
            <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
          <circle cx="80" cy="30" r="4" fill="#fff" opacity="0.9" />
          <circle cx="50" cy="36" r="14" fill="#f0c89a" stroke="#b98d5a" strokeWidth="2.5" />
          <path d="M32 34 Q50 -10 68 34 Q50 26 32 34 Z" fill={has("helm") ? "#f0b429" : robe} stroke={robeD} strokeWidth="2.5" />
          <path d="M28 34 h44" stroke={robeD} strokeWidth="4" strokeLinecap="round" />
          <circle cx="45" cy="38" r="2" fill="#22252c" /><circle cx="55" cy="38" r="2" fill="#22252c" />
          <path d="M46 45 Q50 48 54 45" stroke="#22252c" strokeWidth="2" fill="none" strokeLinecap="round" />
          <path d="M30 92 L24 108 M70 92 L76 108" stroke={robe} strokeWidth="9" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d="M50 46 L74 114 Q50 124 26 114 Z" fill={robe} stroke={robeD} strokeWidth="3" />
          <path d="M62 50 L74 34 L79 38 L67 54 Z" fill="#7a5230" stroke="#4a3118" strokeWidth="2" />
          <path d="M71 33 l6-6 M74 37 l6-6" stroke="#c9d4de" strokeWidth="2" />
          <path d={has("weapon") ? "M22 48 Q6 80 22 112" : "M22 48 Q10 80 22 112"} stroke="#8a5f22" strokeWidth="5" fill="none" strokeLinecap="round" />
          <path d="M22 48 L22 112" stroke={has("weapon") ? "#ffd166" : "#c9d4de"} strokeWidth="1.5" />
          <circle cx="50" cy="36" r="14" fill="#f0c89a" stroke="#b98d5a" strokeWidth="2.5" />
          <path d="M36 32 Q38 18 50 18 Q62 18 64 32 Q58 24 50 26 Q42 24 36 32 Z" fill={has("helm") ? "#f0b429" : "#5a3a22"} stroke="#3a2510" strokeWidth="2" />
          <circle cx="45" cy="38" r="2" fill="#22252c" /><circle cx="55" cy="38" r="2" fill="#22252c" />
          <path d="M46 45 Q50 48 54 45" stroke="#22252c" strokeWidth="2" fill="none" strokeLinecap="round" />
          <rect x="38" y="76" width="24" height="7" rx="3" fill={has("armor") ? "#f0b429" : robeD} />
          <path d="M32 92 L26 108 M68 92 L74 108" stroke={robe} strokeWidth="9" strokeLinecap="round" />
        </>
      )}
      {has("boots") && <><rect x="36" y="112" width="12" height="7" rx="3" fill="#f0b429" /><rect x="52" y="112" width="12" height="7" rx="3" fill="#f0b429" /></>}
      {has("gloves") && <><circle cx="24" cy="108" r="5" fill="#f0b429" /><circle cx="76" cy="108" r="5" fill="#f0b429" /></>}
      {has("amulet") && <Sparkle x={50} y={60} c="#4cc3ff" />}
      {has("ring1") && <Sparkle x={24} y={100} c="#ffd166" />}
      {has("ring2") && <Sparkle x={76} y={100} c="#ffd166" />}
      {has("helm") && <Sparkle x={62} y={18} c="#ffd166" />}
    </svg>
  );
}
