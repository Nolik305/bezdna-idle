import { useGame } from "../game/useGame";
import { PETS, RARITY } from "../game/data";
import { Icon } from "./bits";

export function PetScreen() {
  const { s, d } = useGame();
  const { pet, hero, inv } = s;
  
  if (!pet || !Array.isArray(pet.owned)) {
    return (
      <div className="space-y-4">
        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent" />
          <div className="relative">
            <h2 className="text-xl font-display text-green-400 tracking-widest">ПИТОМЦЫ</h2>
            <p className="text-[10px] text-dim mt-1">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  const currentPetDef = pet.equipped ? PETS.find(p => p.id === pet.equipped) : null;
  const currentPetData = pet.equipped ? pet.pets[pet.equipped] : null;
  const currentLevel = currentPetData?.level || 1;
  const currentXp = currentPetData?.xp || 0;
  const xpNeeded = currentLevel * 500;
  const levelUpCost = currentPetDef ? currentPetDef.levelUpCost * currentLevel : 0;
  const feedableItems = inv.filter(i => i.rarity >= 0);

  // Функция для рендеринга SVG питомца
  const renderPetSvg = (petId: string, size: number = 96) => {
    const petDef = PETS.find(p => p.id === petId);
    if (!petDef?.svg) return null;
    return (
      <div 
        className="pet-svg-container"
        style={{ width: size, height: size }}
        dangerouslySetInnerHTML={{ __html: petDef.svg }}
      />
    );
  };

  return (
    <div className="space-y-4">
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-green-400 tracking-widest">ПИТОМЦЫ</h2>
          <p className="text-[10px] text-dim mt-1">Верные спутники в бою</p>
        </div>
      </div>

      {pet.equipped && currentPetDef && (
        <div className="panel p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-900/10 to-transparent" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-4 border-green-500/50 grid place-items-center mb-4 bg-green-500/10 overflow-hidden">
              {renderPetSvg(currentPetDef.id, 96)}
            </div>
            <h3 className="text-lg font-bold text-fog">{currentPetDef.name}</h3>
            <span className="text-[10px] text-green-300">Уровень {currentLevel}</span>
            
            <div className="w-full mt-3">
              <div className="flex items-center justify-between text-[8px] text-dim mb-1">
                <span>XP питомца</span>
                <span>{currentXp} / {xpNeeded}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-black/50 overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-300"
                  style={{ width: Math.min(100, (currentXp / xpNeeded) * 100) + "%" }}
                />
              </div>
            </div>

            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 w-full">
              <div className="text-[9px] text-green-300 text-center">{currentPetDef.bonusDescription}</div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 w-full">
              {Object.entries(currentPetDef.passiveBonus).map(([stat, value]) => (
                <div key={stat} className="text-[8px] text-green-200 text-center bg-green-500/5 rounded p-1">
                  +{(value * (1 + (currentLevel - 1) * 0.1)).toFixed(1)}% {stat === "dmgPct" ? "урон" : stat === "hpPct" ? "HP" : stat === "xpPct" ? "опыт" : stat === "goldPct" ? "золото" : stat === "crit" ? "крит" : stat === "critDmg" ? "крит. урон" : stat}
                </div>
              ))}
              {currentPetDef.lifesteal && (
                <div className="text-[8px] text-red-300 text-center bg-red-500/5 rounded p-1">
                  +{(currentPetDef.lifesteal * (1 + (currentLevel - 1) * 0.1)).toFixed(1)}% вампиризм
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {pet.equipped && currentPetData && currentXp >= xpNeeded && hero.gems >= levelUpCost && (
        <button
          onClick={() => d({ type: "PET_LEVEL_UP", petId: pet.equipped! })}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-green-500/10 transition-all border-green-500/30"
        >
          <Icon n="spark" className="w-6 h-6 text-green-400" />
          <span className="text-lg font-display text-fog">ПОВЫСИТЬ УРОВЕНЬ</span>
          <span className="text-[10px] text-gold">({levelUpCost} 💎)</span>
        </button>
      )}
      
      {pet.equipped && currentPetData && currentXp >= xpNeeded && hero.gems < levelUpCost && (
        <div className="panel p-3 text-center border-yellow-500/30 bg-yellow-500/5">
          <span className="text-[10px] text-yellow-300">Недостаточно кристаллов ({levelUpCost} 💎 нужно)</span>
        </div>
      )}

      {pet.equipped && feedableItems.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
            <Icon n="flask" className="w-4 h-4 text-purple-400" />
            Кормление (+XP)
          </h3>
          <div className="grid grid-cols-4 gap-2">
            {feedableItems.slice(0, 12).map((item) => {
              const xpGain = [50, 100, 200, 400, 800, 1500][item.rarity] || 50;
              return (
                <button
                  key={item.uid}
                  onClick={() => d({ type: "PET_FEED", petId: pet.equipped!, itemId: item.uid })}
                  className="p-2 rounded-lg border flex flex-col items-center gap-1 transition-all"
                  style={{ borderColor: RARITY[item.rarity]?.color || "#ffffff20" }}
                >
                  <Icon n="sword" className="w-5 h-5" style={{ color: RARITY[item.rarity]?.color }} />
                  <span className="text-[7px] text-dim">+{xpGain} XP</span>
                </button>
              );
            })}
          </div>
          {feedableItems.length > 12 && (
            <p className="text-[8px] text-dim mt-2 text-center">...и ещё {feedableItems.length - 12} предметов</p>
          )}
        </div>
      )}

      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <span className="text-green-400">🐾</span>
          Коллекция питомцев ({pet.owned.length}/{PETS.length})
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {PETS.map((config) => {
            const owned = pet.owned.includes(config.id);
            const equipped = pet.equipped === config.id;
            const canUnlock = config.free || (!config.free && s.battlePass.premium);
            
            return (
              <div
                key={config.id}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  equipped ? "border-green-500/50 bg-green-500/10" :
                  owned ? "border-white/10 bg-white/5 hover:bg-white/10" :
                  canUnlock ? "border-gold/30 bg-gold/5" :
                  "border-white/5 bg-black/20 opacity-50"
                }`}
              >
                <div className="w-12 h-12 rounded-full bg-white/5 overflow-hidden grid place-items-center">
                  {renderPetSvg(config.id, 48)}
                </div>
                <div className="text-center">
                  <div className="text-[10px] font-semibold text-fog">{config.name}</div>
                  <div className="text-[8px] text-dim">{config.bonusDescription}</div>
                </div>
                
                {equipped ? (
                  <span className="text-[7px] text-green-300 uppercase tracking-wider">Экипировано</span>
                ) : owned ? (
                  <button
                    onClick={() => d({ type: "PET_EQUIP", petId: config.id })}
                    className="text-[8px] px-2 py-1 rounded bg-green-500/20 text-green-300 hover:bg-green-500/30"
                  >
                    Выбрать
                  </button>
                ) : canUnlock ? (
                  <button
                    onClick={() => d({ type: "PET_UNLOCK", petId: config.id })}
                    className="text-[8px] px-2 py-1 rounded bg-gold/20 text-gold hover:bg-gold/30"
                  >
                    {config.free ? "Забрать" : "Разблокировать"}
                  </button>
                ) : (
                  <span className="text-[7px] text-dim">Нужен BP Premium</span>
                )}
                
                {!owned && config.free && <span className="text-[8px] text-gold">Бесплатно</span>}
                {!owned && !config.free && <span className="text-[8px] text-purple-300">Награда BP</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">💡 Питомцы дают пассивные бонусы, прокачиваются за кристаллы и предметы</p>
      </div>
    </div>
  );
}
