import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";

export function GuildBossScreen() {
  const { s, d } = useGame();
  const { guildBoss } = s;

  if (!guildBoss) {
    return (
      <div className="panel p-8 text-center">
        <Icon n="skull" className="w-16 h-16 text-dim mx-auto mb-4" />
        <h2 className="text-lg font-display text-fog">Гильдейский босс</h2>
        <p className="text-[11px] text-dim mt-2">Босс не активирован</p>
        <p className="text-[10px] text-dim mt-1">Попросите лидера гильдии начать рейд</p>
      </div>
    );
  }

  const hpPct = (guildBoss.hp / guildBoss.maxHp) * 100;
  const timeLeft = Math.max(0, 24 * 3600 - guildBoss.timeElapsed);
  const hoursLeft = Math.floor(timeLeft / 3600);
  const minutesLeft = Math.floor((timeLeft % 3600) / 60);
  const personalDps = fmt(guildBoss.personalDamage);
  const canAttack = guildBoss.attacksLeft > 0;
  const canClaim = guildBoss.rewardPending && !guildBoss.rewardClaimed;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/20 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-red-400 tracking-widest">РЕЙД БОССА</h2>
          <p className="text-[10px] text-dim mt-1">Вместе мы сильнее!</p>
        </div>
      </div>

      {/* Boss Display */}
      <div className="panel p-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-transparent" />
        <div className="relative z-10 flex flex-col items-center">
          {/* Boss Avatar */}
          <div className="w-24 h-24 rounded-full border-4 border-red-500/50 grid place-items-center relative mb-4">
            <div className="absolute inset-0 rounded-full animate-ping bg-red-500/20" />
            <Icon n="skull" className="w-12 h-12 text-red-400" />
          </div>
          
          {/* Boss Name & Level */}
          <h3 className="text-lg font-bold text-fog">{guildBoss.name}</h3>
          <span className="text-[10px] text-red-300">Уровень {guildBoss.level}</span>

          {/* HP Bar */}
          <div className="w-full mt-4">
            <div className="flex items-center justify-between text-[9px] text-dim mb-1">
              <span>HP босса</span>
              <span>{fmt(guildBoss.hp)} / {fmt(guildBoss.maxHp)}</span>
            </div>
            <div className="relative h-4 rounded-full bg-black/60 overflow-hidden border border-red-500/30">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-600 to-orange-500 transition-all duration-300"
                style={{ width: hpPct + "%" }}
              />
              <span className="absolute inset-0 grid place-items-center text-[9px] font-bold text-white leading-none">
                {hpPct.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Timer */}
          <div className="flex items-center gap-2 mt-4 text-[10px] text-dim">
            <Icon n="clock" className="w-3 h-3" />
            <span>До конца рейда: {hoursLeft}ч {minutesLeft}м</span>
          </div>
        </div>
      </div>

      {/* Personal Stats */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3">Ваш вклад</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="text-center p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <div className="text-[9px] text-dim uppercase">Урон нанесён</div>
            <div className="text-lg font-bold text-red-300">{personalDps}</div>
          </div>
          <div className="text-center p-3 rounded-lg bg-gold/5 border border-gold/20">
            <div className="text-[9px] text-dim uppercase">Атак осталось</div>
            <div className="text-lg font-bold text-gold">{guildBoss.attacksLeft}</div>
          </div>
        </div>
      </div>

      {/* Attack Button */}
      {canAttack && (
        <button
          onClick={() => d({ type: "GUILD_BOSS_ATTACK" })}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-red-500/10 transition-all border-red-500/30"
        >
          <Icon n="sword" className="w-6 h-6 text-red-400" />
          <span className="text-lg font-display text-fog">АТАКОВАТЬ</span>
          <span className="text-[10px] text-dim">({guildBoss.attacksLeft} раз)</span>
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
        </button>
      )}

      {/* Leaderboard */}
      {guildBoss.leaderboard.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
            <Icon n="crown" className="w-4 h-4 text-gold" />
            Топ урона
          </h3>
          <div className="space-y-2">
            {guildBoss.leaderboard.slice(0, 5).map((entry, idx) => (
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
                    idx === 0 ? "text-gold" :
                    idx === 1 ? "text-slate-300" :
                    idx === 2 ? "text-orange-300" :
                    "text-dim"
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
          💡 Награды распределяются пропорционально нанесённому урону
        </p>
      </div>
    </div>
  );
}
