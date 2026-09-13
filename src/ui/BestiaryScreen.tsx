import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { BESTIARY_BONUSES } from "../game/data";

export function BestiaryScreen() {
  const { s, d } = useGame();
  const { bestiary } = s;

  // Mock entries for now - will be populated by game logic
  const mockEntries = [
    { key: "bandit", name: "Бандит", icon: "user", category: "humanoid" },
    { key: "wolf", name: "Волк", icon: "paw", category: "beast" },
    { key: "skeleton", name: "Скелет", icon: "skull", category: "undead" },
    { key: "demon", name: "Демон", icon: "flame", category: "demon" },
    { key: "golem", name: "Голем", icon: "gear", category: "elemental" },
  ];

  const totalEntries = mockEntries.length;
  const discoveredCount = Object.entries(bestiary.entries).filter(([_, e]) => e.discovered).length;
  const completionPct = Math.floor((discoveredCount / Math.max(totalEntries, discoveredCount)) * 100);

  // Group by category
  const byCategory = mockEntries.reduce((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-red-400 tracking-widest">БЕСТИАРИЙ</h2>
          <p className="text-[10px] text-dim mt-1">Коллекция поверженных врагов</p>
        </div>
      </div>

      {/* Progress */}
      <div className="panel p-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-dim uppercase tracking-wider">Прогресс коллекции</span>
          <span className="text-[10px] text-fog">{discoveredCount}/{totalEntries}</span>
        </div>
        <div className="relative h-2 rounded-full bg-black/50 overflow-hidden">
          <div 
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-red-500 to-orange-500 transition-all duration-500"
            style={{ width: completionPct + "%" }}
          />
        </div>
        <div className="text-[9px] text-center text-dim mt-1">{completionPct}% завершено</div>
      </div>

      {/* Categories */}
      {Object.entries(byCategory).map(([category, entries]) => (
        <div key={category} className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 capitalize flex items-center gap-2">
            <Icon n="skull" className="w-4 h-4 text-red-400" />
            {category === "humanoid" ? "Гуманоиды" :
             category === "beast" ? "Звери" :
             category === "undead" ? "Нежить" :
             category === "demon" ? "Демоны" :
             category === "elemental" ? "Элементали" : category}
          </h3>
          <div className="grid grid-cols-3 gap-2">
            {entries.map(({ key, name, icon, minLevel }) => {
              const entry = bestiary.entries[key];
              const discovered = entry?.discovered || false;
              const kills = entry?.kills || 0;
              const maxKills = bestiary.maxKills[key] || 0;
              const canClaim = entry?.canClaim && !entry.claimed;
              
              return (
                <button
                  key={key}
                  disabled={!discovered && !canClaim}
                  onClick={() => canClaim && d({ type: "BESTIARY_CLAIM", mobKey: key })}
                  className={`aspect-square rounded-xl border-2 flex flex-col items-center justify-center gap-1 transition-all ${
                    discovered
                      ? canClaim
                        ? "border-gold/50 bg-gold/10 animate-pulse"
                        : "border-red-400/30 bg-red-400/5"
                      : "border-white/5 bg-black/20 opacity-50"
                  }`}
                >
                  {discovered ? (
                    <>
                      <Icon n={icon as any} className="w-6 h-6 text-red-300" />
                      <span className="text-[8px] text-fog text-center leading-tight line-clamp-2">{name}</span>
                      <span className="text-[7px] text-dim">{kills} уб.</span>
                    </>
                  ) : (
                    <>
                      <Icon n="question" className="w-6 h-6 text-dim" />
                      <span className="text-[7px] text-dim text-center">???</span>
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      {/* Collection Bonuses */}
      {bestiary.bonuses.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
            <Icon n="crown" className="w-4 h-4 text-gold" />
            Бонусы коллекции
          </h3>
          <div className="space-y-2">
            {bestiary.bonuses.map((bonus, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gold/5 border border-gold/20">
                <span className="text-[10px] text-fog">{bonus.description}</span>
                <span className="text-[10px] text-gold font-bold">+{bonus.value}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Milestones */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3">Награды за коллекцию</h3>
        <div className="space-y-2">
          {[10, 25, 50, 75, 100].map(milestone => {
            const claimed = bestiary.milestones.includes(milestone);
            const reached = discoveredCount >= milestone;
            return (
              <div 
                key={milestone} 
                className={`flex items-center justify-between p-2 rounded-lg border ${
                  claimed ? "border-gold/30 bg-gold/5" : 
                  reached ? "border-purple-400/30 bg-purple-400/5" : 
                  "border-white/5 bg-black/10 opacity-50"
                }`}
              >
                <span className="text-[10px] text-fog">{milestone} существ</span>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-dim">
                    {milestone === 10 ? "500 💰" :
                     milestone === 25 ? "10 💎" :
                     milestone === 50 ? "Легендарный предмет" :
                     milestone === 75 ? "50 💎" : "Уникальная аура"}
                  </span>
                  {claimed && <Icon n="check" className="w-4 h-4 text-gold" />}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
