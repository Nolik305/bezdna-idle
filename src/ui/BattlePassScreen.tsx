import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { BATTLE_PASS_REWARDS_FREE, BATTLE_PASS_REWARDS_PREMIUM } from "../game/data";

export function BattlePassScreen() {
  const { s, d } = useGame();
  const { battlePass } = s;

  // Защита от неинициализированных данных
  if (!battlePass || !Array.isArray(battlePass.weeklyQuests)) {
    return (
      <div className="space-y-4">
        <div className="panel p-4 text-center relative overflow-hidden bg-gradient-to-b from-purple-900/30 to-transparent">
          <h2 className="text-xl font-display text-purple-300 tracking-widest">БОЕВОЙ ПРОПУСК</h2>
          <p className="text-[10px] text-dim mt-1">Загрузка...</p>
        </div>
      </div>
    );
  }

  const daysLeft = Math.max(0, Math.ceil((battlePass.seasonEnd - Date.now()) / (1000 * 60 * 60 * 24)));
  const progressPct = (battlePass.level / 50) * 100;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden bg-gradient-to-b from-purple-900/30 to-transparent">
        <h2 className="text-xl font-display text-purple-300 tracking-widest">БОЕВОЙ ПРОПУСК</h2>
        <p className="text-[10px] text-dim mt-1">Сезон #{battlePass.season}</p>
        <div className="flex items-center justify-center gap-2 mt-2 text-[9px] text-dim">
          <Icon n="clock" className="w-3 h-3" />
          <span>До конца сезона: {daysLeft} дн.</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-dim uppercase">Уровень {battlePass.level}/50</span>
          <span className="text-[10px] text-fog">{battlePass.xp} / {battlePass.level * 1000} XP</span>
        </div>
        <div className="relative h-3 rounded-full bg-black/60 overflow-hidden border border-purple-500/30">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-purple-500 to-pink-500 transition-all duration-500"
            style={{ width: progressPct + "%" }}
          />
        </div>
        {!battlePass.premium && (
          <button
            onClick={() => d({ type: "BATTLE_PASS_BUY_PREMIUM" })}
            className="w-full mt-3 py-2 rounded-lg text-[10px] font-display text-gold border border-gold/50 hover:bg-gold/10 transition-all"
          >
            Купить премиум за 499 💎
          </button>
        )}
      </div>

      {/* Weekly Quests */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="scroll" className="w-4 h-4 text-purple-400" />
          Еженедельные задания
        </h3>
        <div className="space-y-2">
          {battlePass.weeklyQuests.map((quest, idx) => (
            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center gap-2">
                <Icon n={quest.icon as any} className="w-4 h-4 text-purple-300" />
                <div>
                  <div className="text-[9px] text-fog">{quest.description}</div>
                  <div className="text-[8px] text-dim">{quest.progress} / {quest.target}</div>
                </div>
              </div>
              <span className="text-[9px] text-gold">+{quest.xpReward} XP</span>
            </div>
          ))}
        </div>
      </div>

      {/* Rewards Track */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3">Награды сезона</h3>
        
        {/* Free Track */}
        <div className="mb-4">
          <h4 className="text-[10px] text-dim uppercase mb-2">Бесплатный трек</h4>
          <div className="grid grid-cols-5 gap-1">
            {BATTLE_PASS_REWARDS_FREE.map((reward, idx) => {
              const claimed = battlePass.claimedFree.includes(idx + 1);
              const reachable = battlePass.level >= idx + 1;
              return (
                <button
                  key={idx}
                  disabled={!reachable || claimed}
                  onClick={() => d({ type: "BATTLE_PASS_CLAIM_FREE", tier: idx + 1 })}
                  className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 ${
                    claimed ? "border-gold/30 bg-gold/5 opacity-50" :
                    reachable ? "border-purple-400/50 bg-purple-400/10 hover:bg-purple-400/20" :
                    "border-white/5 bg-black/20 opacity-30"
                  }`}
                >
                  <Icon n={reward.icon as any} className="w-4 h-4 text-purple-300" />
                  <span className="text-[7px] text-dim">{idx + 1}</span>
                  {claimed && <Icon n="check" className="w-3 h-3 text-gold absolute top-0 right-0" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Premium Track */}
        {battlePass.premium && (
          <div>
            <h4 className="text-[10px] text-dim uppercase mb-2 flex items-center gap-1">
              <Icon n="crown" className="w-3 h-3 text-gold" />
              Премиум трек
            </h4>
            <div className="grid grid-cols-5 gap-1">
              {BATTLE_PASS_REWARDS_PREMIUM.map((reward, idx) => {
                const claimed = battlePass.claimedPremium.includes(idx + 1);
                const reachable = battlePass.level >= idx + 1;
                return (
                  <button
                    key={idx}
                    disabled={!reachable || claimed}
                    onClick={() => d({ type: "BATTLE_PASS_CLAIM_PREMIUM", tier: idx + 1 })}
                    className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-0.5 ${
                      claimed ? "border-gold/30 bg-gold/5 opacity-50" :
                      reachable ? "border-gold/50 bg-gold/10 hover:bg-gold/20" :
                      "border-white/5 bg-black/20 opacity-30"
                    }`}
                  >
                    <Icon n={reward.icon as any} className="w-4 h-4 text-gold" />
                    <span className="text-[7px] text-dim">{idx + 1}</span>
                    {claimed && <Icon n="check" className="w-3 h-3 text-gold absolute top-0 right-0" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Выполняйте задания для получения XP и повышения уровня пропуска
        </p>
      </div>
    </div>
  );
}
