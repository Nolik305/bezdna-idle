import { PETS } from "../data";
import type { GameState, Action } from "../types";

export function handlePetUnlock(s: GameState, a: Action): GameState {
  const pet = PETS.find(p => p.id === a.petId);
  if (!pet || s.pet.owned.includes(a.petId)) return s;
  // Бесплатных питомцев можно разблокировать сразу, платных — через Battle Pass или магазин
  if (!pet.free && !s.battlePass.premium) return s;
  return {
    ...s,
    pet: {
      ...s.pet,
      unlocked: true,
      owned: [...s.pet.owned, a.petId],
      pets: {
        ...s.pet.pets,
        [a.petId]: { level: 1, xp: 0, stars: 0 },
      },
    },
  };
}

export function handlePetEquip(s: GameState, a: Action): GameState {
  const pet = PETS.find(p => p.id === a.petId);
  if (!pet || !s.pet.owned.includes(a.petId)) return s;
  return {
    ...s,
    pet: { ...s.pet, equipped: a.petId },
  };
}

export function handlePetLevelUp(s: GameState, a: Action): GameState {
  const petDef = PETS.find(p => p.id === a.petId);
  const petData = s.pet.pets[a.petId];
  if (!petDef || !petData) return s;
  // Проверяем уровень героя (питомца нельзя улучшать ниже его уровня разблокировки)
  if (s.hero.level < petDef.unlockLevel) return s;
  const cost = petDef.levelUpCost * petData.level;
  if (s.hero.gems < cost) return s;
  const xpNeeded = petData.level * 500;
  if (petData.xp < xpNeeded) return s;
  return {
    ...s,
    hero: { ...s.hero, gems: s.hero.gems - cost },
    pet: {
      ...s.pet,
      pets: {
        ...s.pet.pets,
        [a.petId]: { ...petData, level: petData.level + 1, xp: petData.xp - xpNeeded },
      },
    },
  };
}

export function handlePetFeed(s: GameState, a: Action): GameState {
  const petDef = PETS.find(p => p.id === a.petId);
  const petData = s.pet.pets[a.petId];
  const item = s.inv.find(i => i.uid === a.itemId);
  if (!petDef || !petData || !item) return s;
  // Удаляем предмет из инвентаря
  const newInv = s.inv.filter(i => i.uid !== a.itemId);
  // Даём XP питомцу: зависит от редкости предмета
  const xpGain = [50, 100, 200, 400, 800, 1500][item.rarity] || 50;
  return {
    ...s,
    inv: newInv,
    pet: {
      ...s.pet,
      pets: {
        ...s.pet.pets,
        [a.petId]: { ...petData, xp: petData.xp + xpGain },
      },
    },
  };
}
