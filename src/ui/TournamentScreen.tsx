import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";

export function TournamentScreen() {
  const { s, d } = useGame();
  const { tournament } = s;

  const daysLeft = Math.max(0, Math.ceil((tournament.endDate - Date.now()) / (1000 * 60 * 60 * 24)));
  const canFight = tournament.fightsLeft > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden bg-gradient-to-b from-orange-600/20 to-transparent">
        <h2 className="text-xl font-display text-orange-400 tracking-widest">TURNИР</h2>
        <p className="text-[10px] text-dim mt-1">Еженедельный PvP турнир</p>
        <div className="flex items-center justify-center gap-2 mt-2 text-[9px] text-dim">
          <Icon n="clock" className="w-3 h-3" />
          <span>До конца: {daysLeft} дн.</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="panel p-3 text-center">
          <div className="text-[8px] text-dim uppercase">Победы</div>
          <div className="text-lg font-bold text-green-400">{tournament.wins}</div>
        </div>
        <div className="panel p-3 text-center">
          <div className="text-[8px] text-dim uppercase">Поражения</div>
          <div className="text-lg font-bold text-red-400">{tournament.losses}</div>
        </div>
        <div className="panel p-3 text-center">
          <div className="text-[8px] text-dim uppercase">Бои</div>
          <div className="text-lg font-bold text-fog">{tournament.fightsLeft}</div>
        </div>
      </div>

      {/* Fight Button */}
      {canFight ? (
        <button
          onClick={() => d({ type: "TOURNAMENT_FIGHT" })}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-orange-500/10 transition-all border-orange-500/30"
        >
          <Icon n="crossed" className="w-6 h-6 text-orange-400" />
          <span className="text-lg font-display text-fog">В БОЙ</span>
          <span className="text-[10px] text-dim">({tournament.fightsLeft} осталось)</span>
        </button>
      ) : (
        <div className="panel p-4 text-center text-dim">
          <Icon n="moon" className="w-8 h-8 mx-auto mb-2" />
          <p className="text-[10px]">Бои исчерпаны на сегодня</p>
          <p className="text-[9px] text-dim mt-1">Вернитесь завтра за новыми боями</p>
        </div>
      )}

      {/* Leaderboard */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="crown" className="w-4 h-4 text-gold" />
          Топ игроков
        </h3>
        <div className="space-y-2">
          {tournament.leaderboard.slice(0, 10).map((entry, idx) => (
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
                <span className={`text-[10px] font-bold w-5 ${
                  idx === 0 ? "text-gold" :
                  idx === 1 ? "text-slate-300" :
                  idx === 2 ? "text-orange-300" :
                  "text-dim"
                }`}>#{idx + 1}</span>
                <span className="text-[10px] text-fog">{entry.name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[8px] text-dim">{entry.wins}п/{entry.losses}п</span>
                <span className="text-[9px] text-gold">{fmt(entry.rating)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3">Награды по итогу сезона</h3>
        <div className="space-y-2">
          {[
            { pos: "1", reward: "1000 💎 + Уникальный титул" },
            { pos: "2-3", reward: "500 💎 + Эксклюзивная аура" },
            { pos: "4-10", reward: "200 💎" },
            { pos: "11-50", reward: "100 💎" },
            { pos: "51-100", reward: "50 💎" },
          ].map((tier, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5">
              <span className="text-[10px] text-fog">Места {tier.pos}</span>
              <span className="text-[9px] text-gold">{tier.reward}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Claim Reward */}
      {tournament.canClaimReward && (
        <button
          onClick={() => d({ type: "TOURNAMENT_CLAIM_REWARD", position: tournament.lastSeasonRank })}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-gold/10 transition-all border-gold/50 animate-pulse"
        >
          <Icon n="bag" className="w-6 h-6 text-gold" />
          <span className="text-lg font-display text-gold">ЗАБРАТЬ НАГРАДУ</span>
        </button>
      )}

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Первые 10 боёв бесплатны, далее — 10 💎 за бой
        </p>
      </div>
    </div>
  );
}
