import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { PRESTIGE_BONUSES, PRESTIGE_TALENTS } from "../game/data";

export function PrestigeScreen() {
  const { s, d } = useGame();
  const { prestige } = s;

  const totalBonus = Object.entries(prestige.bonuses).reduce((sum, [_, v]) => sum + v, 0);
  const essenceGain = Math.floor(s.totals.kills / 1000) + (s.zones * 10);
  const canPrestige = essenceGain > 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-purple-400 tracking-widest">ПРЕСТИЖ</h2>
          <p className="text-[10px] text-dim mt-1">Сбросьте прогресс ради вечной силы</p>
        </div>
      </div>

      {/* Essence Counter */}
      <div className="panel p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-purple-500/20 border border-purple-400/50 grid place-items-center">
            <Icon n="spark" className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <div className="text-[10px] text-dim uppercase tracking-wider">Эссенция Бездны</div>
            <div className="text-2xl font-bold text-purple-300">{fmt(prestige.essence)}</div>
          </div>
        </div>
        {canPrestige && (
          <button
            onClick={() => d({ type: "PRESTIGE_DO" })}
            className="px-4 py-2 rounded-xl font-display text-sm text-ink bg-purple-500 border border-purple-400/50 shadow-[0_0_16px_#a855f744] hover:shadow-[0_0_24px_#a855f766] transition-all"
          >
            Сброс (+{essenceGain})
          </button>
        )}
      </div>

      {/* Total Bonus */}
      <div className="panel p-3">
        <div className="text-[10px] text-dim uppercase tracking-wider mb-2">Общий бонус</div>
        <div className="text-lg font-bold text-gold">+{totalBonus}% ко всем характеристикам</div>
        <div className="text-[9px] text-dim mt-1">Престижей пройдено: {prestige.count}</div>
      </div>

      {/* Bonuses Tree */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="spark" className="w-4 h-4 text-purple-400" />
          Дерево бонусов
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(PRESTIGE_BONUSES).map(([key, config]) => {
            const current = prestige.bonuses[key] || 0;
            const cost = Math.floor(config.baseCost * Math.pow(1.5, current));
            const canBuy = prestige.essence >= cost && current < config.maxLevel;
            return (
              <button
                key={key}
                disabled={!canBuy}
                onClick={() => d({ type: "PRESTIGE_BUY_BONUS", stat: key })}
                className={`p-3 rounded-xl border text-left transition-all ${
                  canBuy
                    ? "border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20"
                    : "border-white/5 bg-black/20 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-fog">{config.name}</span>
                  <span className="text-[9px] text-purple-300">{current}/{config.maxLevel}</span>
                </div>
                <div className="text-[9px] text-dim mt-1">+{config.valuePerLevel}% / ур.</div>
                <div className="flex items-center gap-1 mt-2 text-[10px] text-purple-300">
                  <Icon n="spark" className="w-3 h-3" />
                  {fmt(cost)}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Talents Tree */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="crown" className="w-4 h-4 text-gold" />
          Таланты престижа
        </h3>
        <div className="space-y-2">
          {PRESTIGE_TALENTS.map((talent) => {
            const owned = prestige.talents.includes(talent.id);
            const canBuy = prestige.essence >= talent.cost && !owned && prestige.count >= talent.minPrestiges;
            return (
              <button
                key={talent.id}
                disabled={!canBuy && !owned}
                onClick={() => d({ type: "PRESTIGE_BUY_TALENT", talentId: talent.id })}
                className={`w-full p-3 rounded-xl border text-left transition-all ${
                  owned
                    ? "border-gold/50 bg-gold/10"
                    : canBuy
                    ? "border-purple-400/50 bg-purple-500/10 hover:bg-purple-500/20"
                    : "border-white/5 bg-black/20 opacity-50 cursor-not-allowed"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${owned ? "bg-gold" : "bg-purple-400"}`} />
                    <span className="text-[11px] font-semibold text-fog">{talent.name}</span>
                  </div>
                  {!owned && (
                    <div className="flex items-center gap-1 text-[10px] text-purple-300">
                      <Icon n="spark" className="w-3 h-3" />
                      {fmt(talent.cost)}
                    </div>
                  )}
                </div>
                <div className="text-[9px] text-dim mt-1 ml-4">{talent.description}</div>
                {talent.minPrestiges > 0 && !owned && (
                  <div className="text-[8px] text-dim mt-1 ml-4">
                    Требуется престижей: {prestige.count}/{talent.minPrestiges}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Aura Preview */}
      {prestige.count > 0 && (
        <div className="panel p-4 text-center">
          <div className="text-[10px] text-dim uppercase tracking-wider mb-2">Аура Бездны</div>
          <div
            className="w-20 h-20 mx-auto rounded-full border-2 grid place-items-center relative"
            style={{
              borderColor: `#${((prestige.count * 50) & 0xff).toString(16).padStart(2, '0')}88ff`,
              boxShadow: `0 0 20px #a855f7${Math.min(88, prestige.count * 11)}`,
              background: `linear-gradient(160deg, #a855f7${Math.min(40, prestige.count * 5)}, transparent)`,
            }}
          >
            <Icon n="user" className="w-8 h-8 text-purple-300" />
          </div>
          <div className="text-[9px] text-purple-300 mt-2">Уровень ауры: {prestige.count}</div>
        </div>
      )}
    </div>
  );
}
