"""
Архитектура системы баланса RPG:
1. Data-Driven кривые прогрессии.
2. Разделение базовых статов и множителей.
3. Масштабируемая система мобов.
"""

from dataclasses import dataclass, field
from typing import Dict, Callable
import math

# --- 1. Конфигурация кривых (Data-Driven) ---

@dataclass
class ProgressionConfig:
    """Настройки баланса, которые можно вынести в JSON."""
    # Формула опыта: Base * (Level ^ Exponent)
    xp_base: float = 100.0
    xp_exponent: float = 1.5
    
    # Формула золота: Base * Level * RandomFactor
    gold_base: float = 15.0
    
    # Рост статов героя
    hero_stat_gain_multiplier: float = 1.2
    
    # Множители для типов мобов
    mob_tier_multipliers: Dict[str, float] = field(default_factory=lambda: {
        "normal": 1.0,
        "elite": 2.5,
        "boss": 5.0
    })

# --- 2. Сервис расчета прогрессии ---

class ProgressionService:
    def __init__(self, config: ProgressionConfig):
        self.config = config

    def get_xp_required(self, current_level: int) -> int:
        """Расчет опыта, необходимого для следующего уровня."""
        if current_level <= 0:
            return 0
        # Экспоненциальный рост сложности
        val = self.config.xp_base * (current_level ** self.config.xp_exponent)
        return int(val)

    def get_gold_reward(self, mob_level: int, tier: str = "normal") -> int:
        """Расчет награды золотом в зависимости от уровня и типа моба."""
        multiplier = self.config.mob_tier_multipliers.get(tier, 1.0)
        base = self.config.gold_base * mob_level
        return int(base * multiplier)

    def calculate_stat_growth(self, base_stat: float, level: int, gain_per_level: float) -> float:
        """Расчет характеристики на определенном уровне."""
        # Линейный рост с базой
        return base_stat + (gain_per_level * (level - 1))

# --- 3. Сущности ---

@dataclass
class Stats:
    strength: float
    agility: float
    intelligence: float
    hp: float
    damage: float

    def __add__(self, other: 'Stats') -> 'Stats':
        return Stats(
            self.strength + other.strength,
            self.agility + other.agility,
            self.intelligence + other.intelligence,
            self.hp + other.hp,
            self.damage + other.damage
        )

class Character:
    def __init__(self, name: str, base_stats: Stats, stat_gains: Stats):
        self.name = name
        self.level = 1
        self.current_xp = 0
        self.gold = 0
        self.base_stats = base_stats
        self.stat_gains = stat_gains # Прирост статов за уровень
        self.current_stats = base_stats

    def add_xp(self, amount: int, service: ProgressionService):
        self.current_xp += amount
        leveled_up = False
        
        # Проверка повышения уровня (цикл для случаев получения большого количества XP)
        while True:
            required = service.get_xp_required(self.level)
            if self.current_xp >= required:
                self.current_xp -= required
                self.level_up(service)
                leveled_up = True
            else:
                break
        
        if leveled_up:
            print(f"[{self.name}] Уровень повышен! Теперь уровень: {self.level}")
            self._recalculate_stats(service)

    def level_up(self, service: ProgressionService):
        self.level += 1
        # Здесь можно добавить эффекты при повышении уровня

    def _recalculate_stats(self, service: ProgressionService):
        """Пересчет всех характеристик на основе нового уровня."""
        self.current_stats = Stats(
            strength=service.calculate_stat_growth(self.base_stats.strength, self.level, self.stat_gains.strength),
            agility=service.calculate_stat_growth(self.base_stats.agility, self.level, self.stat_gains.agility),
            intelligence=service.calculate_stat_growth(self.base_stats.intelligence, self.level, self.stat_gains.intelligence),
            # HP и Damage могут зависеть от других статов, здесь упрощено
            hp=service.calculate_stat_growth(self.base_stats.hp, self.level, self.stat_gains.hp),
            damage=service.calculate_stat_growth(self.base_stats.damage, self.level, self.stat_gains.damage)
        )

    def receive_gold(self, amount: int):
        self.gold += amount
        print(f"[{self.name}] Получено золота: {amount}. Всего: {self.gold}")

class Mob:
    def __init__(self, name: str, level: int, tier: str, base_hp: float, base_dmg: float):
        self.name = name
        self.level = level
        self.tier = tier
        self.base_hp = base_hp
        self.base_dmg = base_dmg
        self.current_hp = self._calculate_max_hp()
        self.damage = self._calculate_damage()

    def _apply_multiplier(self, value: float, service: ProgressionService) -> float:
        mult = service.config.mob_tier_multipliers.get(self.tier, 1.0)
        # Мобы тоже растут с уровнем (линейно или экспоненциально)
        level_factor = 1 + (self.level * 0.1) 
        return value * level_factor * mult

    def _calculate_max_hp(self):
        # Заглушка сервиса для примера, в реальности передавать через конструктор
        # Предположим базовый конфиг
        cfg = ProgressionConfig()
        mult = cfg.mob_tier_multipliers.get(self.tier, 1.0)
        level_factor = 1 + (self.level * 0.15)
        return int(self.base_hp * level_factor * mult)

    def _calculate_damage(self):
        cfg = ProgressionConfig()
        mult = cfg.mob_tier_multipliers.get(self.tier, 1.0)
        level_factor = 1 + (self.level * 0.08)
        return int(self.base_dmg * level_factor * mult)

    def get_rewards(self):
        """Возвращает награду за убийство."""
        cfg = ProgressionConfig()
        # Опыт обычно растет быстрее золота
        xp_reward = int(50 * (self.level ** 1.4) * cfg.mob_tier_multipliers[self.tier])
        gold_reward = int(cfg.gold_base * self.level * cfg.mob_tier_multipliers[self.tier])
        return xp_reward, gold_reward

# --- 4. Демонстрация работы ---

def main():
    # Инициализация конфигурации и сервисов
    config = ProgressionConfig(
        xp_base=150,
        xp_exponent=1.6,
        gold_base=20
    )
    service = ProgressionService(config)

    # Создание героя
    hero = Character(
        name="Warrior",
        base_stats=Stats(10, 8, 5, 100, 15),
        stat_gains=Stats(2.5, 1.5, 1.0, 20, 3.0)
    )

    print(f"Старт: {hero.name}, Ур: {hero.level}, Статы: STR={hero.current_stats.strength}")

    # Симуляция боя с мобами разных уровней и типов
    mobs_to_fight = [
        Mob("Goblin", 1, "normal", 50, 5),
        Mob("Orc", 3, "normal", 80, 8),
        Mob("Elite Guard", 5, "elite", 200, 15),
        Mob("Dragon Boss", 10, "boss", 1000, 50),
    ]

    for mob in mobs_to_fight:
        print(f"\n--- Бой с {mob.name} (Ур {mob.level}, {mob.tier}) ---")
        print(f"Характеристики моба: HP={mob.current_hp}, DMG={mob.damage}")
        
        xp, gold = mob.get_rewards()
        
        # Герой получает награду
        hero.add_xp(xp, service)
        hero.receive_gold(gold)
        
        print(f"Текущие статы героя после боя: STR={hero.current_stats.strength}, HP={hero.current_stats.hp}")

if __name__ == "__main__":
    main()
