import { useGame } from "../game/useGame";
import type { Dispatch } from "react";
import type { Action, GuildBossS, Stats } from "../game/types";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { GUILD_BOSS_CONFIG } from "../game/data";
import { useState, useEffect, useCallback, useRef } from "react";

// --- Вспомогательный компонент: летающий урон ---
function DamageNumber({ dmg, y, opacity }: { dmg: number; y: number; opacity: number }) {
  return (
    <div
      className="fixed pointer-events-none font-display font-bold select-none"
      style={{
        left: "50%",
        top: `${y}px`,
        transform: "translateX(-50%)",
        opacity,
        fontSize: "22px",
        color: "#ff4444",
        textShadow: "0 0 8px #ff000088, 0 2px 4px #0008",
        transition: "all 0.8s ease-out",
        zIndex: 100,
      }}
    >
      -{fmt(dmg)}
    </div>
  );
}

// --- Вспомогательный компонент: вспышка экрана ---
function ScreenFlash({ color, duration }: { color: string; duration: number }) {
  if (!color || duration <= 0) return null;
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[90]"
      style={{
        background: color,
        opacity: 0.35,
        animation: `gb-flash ${duration}s ease-out forwards`,
      }}
    />
  );
}

// --- Вспомогательный компонент: оверлей победы/поражения ---
function BossResultOverlay({ type }: { type: "victory" | "defeat" }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-[95] pointer-events-none">
      <div style={{ animation: "gb-fade-in 1.2s ease-out" }}>
        <div className="text-7xl mb-4">{type === "victory" ? "🏆" : "💀"}</div>
        <h2 className="text-4xl font-display font-bold tracking-widest"
          style={{
            color: type === "victory" ? "#fbbf24" : "#ef4444",
            textShadow: `0 0 30px ${type === "victory" ? "#fbbf2466" : "#ef444466"}`,
          }}
        >
          {type === "victory" ? "БОСС ПОРЖЁН!" : "ВЫ ПАЛИ!"}
        </h2>
        <p className="text-lg text-dim mt-2">
          {type === "victory"
            ? "Награда доступна для получения"
            : "Попробуйте вернуться позже"}
        </p>
      </div>
    </div>
  );
}

export function GuildBossScreen() {
  const { s, d, stats } = useGame();
  const gb = s.guildBoss;

  if (!gb) {
    return (
      <div className="panel p-8 text-center">
        <Icon n="skull" className="w-16 h-16 text-dim mx-auto mb-4" />
        <h2 className="text-lg font-display text-fog">Гильдейский босс</h2>
        <p className="text-[11px] text-dim mt-2">Босс не активирован</p>
        <button
          onClick={() => d({ type: "GUILD_BOSS_START" })}
          className="mt-4 px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-lg font-bold transition-all"
        >
          НАЧАТЬ РЕЙД
        </button>
      </div>
    );
  }

  // Бой живёт в отдельном компоненте: там gb гарантированно не null, поэтому
  // хуки не читают поля отсутствующего босса (иначе экран падал с TypeError).
  return <ActiveGuildBoss gb={gb} d={d} stats={stats} />;
}

function ActiveGuildBoss({ gb, d, stats }: { gb: GuildBossS; d: Dispatch<Action>; stats: Stats }) {
  // --- Визуальное состояние ---
  const [floatingDmg, setFloatingDmg] = useState<{ id: number; dmg: number; y: number; opacity: number }[]>([]);
  const [flash, setFlash] = useState<{ color: string; duration: number } | null>(null);
  const [bossAttacking, setBossAttacking] = useState(false);
  const [shakeAmount, setShakeAmount] = useState(0);
  const [comboCount, setComboCount] = useState(0);
  const [comboTimer, setComboTimer] = useState(0);
  const [heroHit, setHeroHit] = useState(false);
  const nextId = useRef(0);
  const prevHpRef = useRef(gb.heroHp);
  const prevBossHpRef = useRef(gb.bossHp);
  const flashTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const comboTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Добавить летающий урон ---
  const addFloatingDmg = useCallback((dmg: number) => {
    const id = nextId.current++;
    setFloatingDmg(prev => [...prev, { id, dmg, y: 40 + Math.random() * 200, opacity: 1 }]);
    setTimeout(() => {
      setFloatingDmg(prev => prev.filter(f => f.id !== id));
    }, 1000);
  }, []);

  // --- Экранная вспышка ---
  const triggerFlash = useCallback((color: string, duration = 0.3) => {
    if (flashTimeoutRef.current) clearTimeout(flashTimeoutRef.current);
    setFlash({ color, duration });
    flashTimeoutRef.current = setTimeout(() => setFlash(null), duration * 1000 + 100);
  }, []);

  // --- Тряска экрана ---
  const triggerShake = useCallback((amount = 5) => {
    if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
    setShakeAmount(amount);
    shakeTimeoutRef.current = setTimeout(() => setShakeAmount(0), 200);
  }, []);

  // --- Combo ---
  useEffect(() => {
    if (comboCount > 0 && comboTimer > 0) {
      comboTimeoutRef.current = setTimeout(() => {
        setComboCount(c => c > 1 ? c - 1 : 0);
        setComboTimer(0);
      }, 1000);
      return () => { if (comboTimeoutRef.current) clearTimeout(comboTimeoutRef.current); };
    }
  }, [comboTimer]);

  // --- Обработчик атаки героя ---
  const handleHeroAttack = useCallback(() => {
    d({ type: "GUILD_BOSS_ATTACK" });
    const dmg = Math.round(stats.dmg * (1 + stats.dmgPct / 100) * GUILD_BOSS_CONFIG.playerDamageMultiplier);
    addFloatingDmg(dmg);
    triggerFlash("rgba(255, 100, 100, 0.15)", 0.2);
    triggerShake(3);
    setComboCount(c => c + 1);
    setComboTimer(Date.now());
    setHeroHit(true);
    setTimeout(() => setHeroHit(false), 150);
  }, [d, stats, addFloatingDmg, triggerFlash, triggerShake]);

  // --- Слушаем изменения HP для визуальных эффектов ---
  useEffect(() => {
    // Босс получил урон от героя
    if (prevBossHpRef.current > gb.bossHp && gb.bossHp > 0 && gb.isFighting) {
      const dmg = prevBossHpRef.current - gb.bossHp;
      addFloatingDmg(dmg);
      triggerShake(2);
    }
    // Герой получил урон от босса
    if (prevHpRef.current > gb.heroHp && gb.heroHp > 0 && gb.isFighting && !heroHit) {
      const dmg = prevHpRef.current - gb.heroHp;
      addFloatingDmg(dmg);
      triggerFlash("rgba(255, 0, 0, 0.25)", 0.4);
      triggerShake(8);
      setBossAttacking(true);
      setTimeout(() => setBossAttacking(false), 600);
    }
    prevHpRef.current = gb.heroHp;
    prevBossHpRef.current = gb.bossHp;
  }, [gb.hp, gb.bossHp, gb.heroHp, gb.isFighting, heroHit, addFloatingDmg, triggerFlash, triggerShake]);

  // --- Расчёты ---
  const hpPct = gb.maxHp > 0 ? (gb.hp / gb.maxHp) * 100 : 0;
  const heroHpPct = gb.heroMaxHp > 0 ? (gb.heroHp / gb.heroMaxHp) * 100 : 0;
  const canAttack = gb.isFighting && gb.heroHp > 0 && gb.hp > 0;
  const canClaim = gb.rewardPending && !gb.rewardClaimed;
  const isBossDead = gb.hp <= 0;
  const isHeroDead = gb.heroHp <= 0;
  const bossNextAttack = gb.bossAttackT > 0 ? GUILD_BOSS_CONFIG.bossAttackInterval - gb.bossAttackT : 0;
  const playerDps = Math.round(stats.dmg * (1 + stats.dmgPct / 100) * GUILD_BOSS_CONFIG.playerDamageMultiplier);
  const timeLeft = Math.max(0, 24 * 3600 - gb.timeElapsed);
  const hoursLeft = Math.floor(timeLeft / 3600);
  const minutesLeft = Math.floor((timeLeft % 3600) / 60);
  const secondsLeft = Math.floor(timeLeft % 60);
  const timeIsLow = timeLeft < 3600;
  const timeIsCritical = timeLeft < 600;

  return (
    <div className="space-y-4 relative">
      {/* CSS Анимации */}
      <style>{`
        @keyframes gb-flash {
          0% { opacity: 0.4; }
          100% { opacity: 0; }
        }
        @keyframes gb-boss-swing {
          0% { transform: rotate(-30deg) scale(0.5); opacity: 0; }
          30% { transform: rotate(10deg) scale(1.2); opacity: 1; }
          60% { transform: rotate(-5deg) scale(1); opacity: 1; }
          100% { transform: rotate(0deg) scale(1); opacity: 0; }
        }
        @keyframes gb-fade-in {
          0% { opacity: 0; transform: scale(0.5); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes gb-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        @keyframes gb-combo-pop {
          0% { transform: translateX(-50%) scale(0.5); opacity: 0; }
          50% { transform: translateX(-50%) scale(1.3); opacity: 1; }
          100% { transform: translateX(-50%) scale(1); opacity: 1; }
        }
        @keyframes gb-heartbeat {
          0%, 100% { transform: scale(1); }
          14% { transform: scale(1.1); }
          28% { transform: scale(1); }
          42% { transform: scale(1.05); }
          56% { transform: scale(1); }
        }
        .gb-combo-text { animation: gb-combo-pop 0.5s ease-out; }
        .gb-heartbeat { animation: gb-heartbeat 1.5s infinite; }
      `}</style>

      {/* Вспышки экрана */}
      <ScreenFlash color={flash?.color ?? ""} duration={flash?.duration ?? 0} />

      {/* Удар босса — индикатор */}
      {bossAttacking && (
        <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[85]">
          <div className="text-7xl" style={{ animation: "gb-boss-swing 0.6s ease-out", filter: "drop-shadow(0 0 40px #ff0000aa)" }}>⚔️</div>
        </div>
      )}

      {/* Результат: поражение */}
      {isHeroDead && <BossResultOverlay type="defeat" />}
      {/* Результат: победа */}
      {isBossDead && <BossResultOverlay type="victory" />}

      {/* Летающие числа урона */}
      {floatingDmg.map(f => (
        <DamageNumber key={f.id} dmg={f.dmg} y={f.y} opacity={f.opacity} />
      ))}

      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/20 to-transparent" />
        <div className="relative">
          <h2 className={`text-xl font-display text-red-400 tracking-widest ${isHeroDead ? "gb-heartbeat" : ""}`}>
            {gb.isFighting ? "РЕЙД БОССА" : "РЕЙД БОССА"}
          </h2>
          <p className="text-[10px] text-dim mt-1">
            {gb.isFighting ? "Бой идётся! Босс атакует каждые 5 сек" : "Вместе мы сильнее!"}
          </p>
          {/* Combo counter */}
          {comboCount >= 2 && (
            <div className="mt-2 inline-block px-3 py-1 bg-red-500/20 border border-red-500/50 rounded-full">
              <span className="text-sm font-display font-bold text-red-300 gb-combo-text">🔥 x{comboCount} COMBO!</span>
            </div>
          )}
        </div>
      </div>

      {/* Timer */}
      <div className={`panel px-4 py-2 flex items-center justify-between text-[10px] transition-all ${
        timeIsCritical ? "bg-red-900/30 border border-red-500/50 animate-pulse" :
        timeIsLow ? "bg-red-900/15 border border-red-500/20" : "text-dim"
      }`}>
        <span className={timeIsCritical ? "text-red-400 animate-pulse" : ""}>
          ⏱ До конца рейда: {hoursLeft}ч {minutesLeft}м {secondsLeft}с
        </span>
        <span className="text-dim">Ур. босса: {gb.level}</span>
      </div>

      {/* Boss HP */}
      <div className="panel p-4 relative overflow-hidden"
        style={{ transform: `translateX(${gb.hp < prevBossHpRef.current ? -shakeAmount : shakeAmount}px`, transition: shakeAmount > 0 ? "transform 0.1s ease-out" : "transform 0.3s" }}>
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-transparent" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-lg font-bold text-red-400">{gb.name}</span>
            <span className="text-[10px] text-dim">
              {isBossDead ? "💀 Повержен" : `${fmt(gb.hp)} / ${fmt(gb.maxHp)}`}
            </span>
          </div>
          <div className="relative h-5 rounded-full bg-black/60 overflow-hidden border border-red-500/30">
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                isBossDead ? "bg-gray-600" : "bg-gradient-to-b from-red-600 to-orange-500"
              }`}
              style={{ width: `${Math.max(0, hpPct)}%` }}
            />
            {/* HP low warning */}
            {hpPct < 25 && hpPct > 0 && !isBossDead && (
              <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
            )}
            <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-white leading-none">
              {hpPct.toFixed(1)}%
            </span>
          </div>
        </div>
      </div>

      {/* Hero HP (during fight) */}
      {gb.isFighting && (
        <div className={`panel p-4 border-arc/30 ${isHeroDead ? "border-blood/50 animate-pulse" : ""}`}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-bold text-arc">⚔️ Ваш герой</span>
            <span className="text-[10px] text-dim">
              {isHeroDead ? "💀 Повержен" : `${fmt(gb.heroHp)} / ${fmt(gb.heroMaxHp)}`}
            </span>
          </div>
          <div className="relative h-4 rounded-full bg-black/55 overflow-hidden border border-arc/20">
            <div
              className={`absolute inset-y-0 left-0 transition-all duration-300 ${
                isHeroDead ? "bg-gray-600" : "bg-gradient-to-b from-arc to-green-400"
              }`}
              style={{ width: `${Math.max(0, heroHpPct)}%` }}
            />
            {/* Hero low HP warning */}
            {heroHpPct < 25 && heroHpPct > 0 && !isHeroDead && (
              <div className="absolute inset-0 bg-red-500/20 animate-pulse" />
            )}
            <span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-white leading-none">
              {heroHpPct.toFixed(1)}%
            </span>
          </div>
          {isHeroDead && (
            <div className="text-[10px] text-blood mt-1">Вы пали! Попробуйте позже.</div>
          )}
        </div>
      )}

      {/* Combat info */}
      {gb.isFighting && !isHeroDead && (
        <div className="panel p-3 text-center">
          <div className="flex items-center justify-center gap-4 text-[10px] text-dim">
            <span>🕐 Удар босса через: {bossNextAttack.toFixed(1)}с</span>
            <span>⚔️ Ваш DPS: {fmt(playerDps)}</span>
            {comboCount >= 2 && <span className="text-red-400">🔥 x{comboCount}</span>}
          </div>
          <p className="text-[9px] text-dim mt-1">
            Босс атакует каждые {GUILD_BOSS_CONFIG.bossAttackInterval}с. Наносит {fmt(gb.bossDmg)} урона.
          </p>
        </div>
      )}

      {/* Attack Button */}
      {canAttack && (
        <button
          onClick={handleHeroAttack}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-red-500/10 transition-all border-red-500/30 group active:scale-[0.98]"
          style={{
            boxShadow: "0 0 20px #ff000022, inset 0 0 20px #ff000008",
            animation: "gb-heartbeat 2s infinite",
          }}
        >
          <Icon n="sword" className="w-6 h-6 text-red-400 group-hover:text-red-300" />
          <span className="text-lg font-display text-fog group-hover:text-red-300">АТАКОВАТЬ</span>
          <span className="text-[10px] text-dim">(+{fmt(Math.round(stats.dmg * (1 + stats.dmgPct / 100) * GUILD_BOSS_CONFIG.playerDamageMultiplier))} урона)</span>
        </button>
      )}

      {/* Claim Reward */}
      {canClaim && (
        <button
          onClick={() => d({ type: "GUILD_BOSS_CLAIM" })}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-gold/10 transition-all border-gold/50 animate-pulse"
        >
          <Icon n="bag" className="w-6 h-6 text-gold" />
          <span className="text-lg font-display text-gold">ЗАБРАТЬ НАГРАДУ</span>
          {gb.rewardRuneId && (
            <span className="text-[9px] text-gold/70 ml-2">🎁 + руна!</span>
          )}
        </button>
      )}

      {/* Leaderboard */}
      {gb.leaderboard.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
            <Icon n="crown" className="w-4 h-4 text-gold" />
            Топ урона
          </h3>
          <div className="space-y-2">
            {gb.leaderboard.slice(0, 5).map((entry, idx) => (
              <div
                key={idx}
                className={`flex items-center justify-between p-2 rounded-lg ${
                  idx === 0 ? "bg-gold/10 border border-gold/30" :
                  idx === 1 ? "bg-slate-500/10 border border-slate-400/30" :
                  idx === 2 ? "bg-orange-500/10 border border-orange-400/30" :
                  "bg-black/10 border border-white/5"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-bold w-4 ${
                    idx === 0 ? "text-gold" : idx === 1 ? "text-slate-300" :
                    idx === 2 ? "text-orange-300" : "text-dim"
                  }`}>#{idx + 1}</span>
                  <span className="text-[10px] text-fog">{entry.name}</span>
                </div>
                <span className="text-[9px] text-dim">{fmt(entry.damage)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Босс атакует каждые {GUILD_BOSS_CONFIG.bossAttackInterval}с. Ваш урон: stats.dmg × (1+dmgPct/100) × {GUILD_BOSS_CONFIG.playerDamageMultiplier}
        </p>
        <p className="text-[9px] text-dim mt-1">
          🔄 Руны и сетовые бонусы работают! БП набирает XP за убийства. ✨ Руны выпадают с боссом!
        </p>
      </div>
    </div>
  );
}
