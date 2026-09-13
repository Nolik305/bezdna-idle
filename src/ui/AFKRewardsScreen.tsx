import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { AFK_REWARD_OPTIONS } from "../game/data";

export function AFKRewardsScreen() {
  const { s, d } = useGame();
  const { afkRewards } = s;

  if (!afkRewards.available) {
    const hours = Math.floor(afkRewards.offlineTime / 3600);
    const minutes = Math.floor((afkRewards.offlineTime % 3600) / 60);
    return (
      <div className="panel p-8 text-center">
        <Icon n="moon" className="w-16 h-16 text-dim mx-auto mb-4" />
        <h2 className="text-lg font-display text-fog">Награды за ожидание</h2>
        <p className="text-[11px] text-dim mt-2">
          Вы отсутствовали {hours}ч {minutes}м
        </p>
        <p className="text-[10px] text-dim mt-1">
          Минимум 5 минут офлайн для получения наград
        </p>
      </div>
    );
  }

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    return h > 0 ? `${h}ч ${m}м` : `${m}м`;
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center">
        <h2 className="text-xl font-display text-gold tracking-widest">AFK НАГРАДЫ</h2>
        <p className="text-[10px] text-dim mt-1">
          Выберите одну из наград за время в офлайне
        </p>
        <div className="text-[9px] text-purple-300 mt-2">
          Время офлайн: {formatTime(afkRewards.offlineTime)}
        </div>
      </div>

      {/* Reward Options */}
      <div className="grid grid-cols-1 gap-3">
        {afkRewards.options.map((option, idx) => (
          <button
            key={option.id}
            onClick={() => d({ type: "AFK_REWARDS_CLAIM", optionIndex: idx, multiply: false })}
            className="panel p-4 flex items-center justify-between hover:bg-white/5 transition-all relative overflow-hidden group"
          >
            {/* Background glow for rare items */}
            {option.rarity && option.rarity >= 3 && (
              <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-transparent" />
            )}
            
            <div className="flex items-center gap-4 relative z-10">
              <div className={`w-14 h-14 rounded-xl border-2 grid place-items-center ${
                option.type === "gold" ? "border-gold/50 bg-gold/10" :
                option.type === "xp" ? "border-blue-400/50 bg-blue-400/10" :
                option.type === "gems" ? "border-cyan-400/50 bg-cyan-400/10" :
                "border-purple-400/50 bg-purple-400/10"
              }`}>
                <Icon 
                  n={option.type === "gold" ? "coin" : 
                     option.type === "xp" ? "spark" : 
                     option.type === "gems" ? "gem" : "bag"} 
                  className={`w-7 h-7 ${
                    option.type === "gold" ? "text-gold" :
                    option.type === "xp" ? "text-blue-400" :
                    option.type === "gems" ? "text-cyan-400" : "text-purple-400"
                  }`} 
                />
              </div>
              <div className="text-left">
                <div className="text-[10px] text-dim uppercase tracking-wider">
                  {option.type === "gold" ? "Золото" :
                   option.type === "xp" ? "Опыт" :
                   option.type === "gems" ? "Кристаллы" : "Предмет"}
                </div>
                <div className="text-xl font-bold text-fog">
                  {option.type === "item" ? `Предмет T${option.itemId}` : "+" + fmt(option.amount)}
                </div>
                {option.rarity && (
                  <div className="text-[8px] text-purple-300 mt-0.5">
                    Редкость: {["Обычный", "Необычный", "Редкий", "Эпический", "Легендарный", "Бездна"][option.rarity]}
                  </div>
                )}
              </div>
            </div>

            {/* Multiply button */}
            {option.multiplyAvailable && !afkRewards.multiplied && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  // Здесь можно добавить логику просмотра рекламы
                  d({ type: "AFK_REWARDS_CLAIM", optionIndex: idx, multiply: true });
                }}
                className="relative z-10 px-3 py-1.5 rounded-lg text-[9px] font-display text-gold border border-gold/50 hover:bg-gold/10 transition-all"
              >
                x2
              </button>
            )}
          </button>
        ))}
      </div>

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Чем дольше вы офлайн, тем выше шанс редких наград
        </p>
        {afkRewards.multiplied && (
          <p className="text-[9px] text-gold mt-1">
            ✓ Награда удвоена рекламой
          </p>
        )}
      </div>
    </div>
  );
}
