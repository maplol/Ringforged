import type { Upgrade, Ring, PlayerState, SlotType, ElementalCore, StatKey } from "./types";
import { ElementType, RingRank, Rarity } from "./types";
import {
  RING_NAMES_RU,
  ELEMENT_NAMES_RU,
  UPGRADE_NAMES_RU,
  RARITY_WEIGHTS,
  RARITY_MULTIPLIERS,
  CORE_BONUSES,
  CORE_DAMAGE_BONUS,
  getCombo,
} from "./constants";
import { uid, pick, shuffle } from "./utils";

function rollRarity(): Rarity {
  const total = RARITY_WEIGHTS.reduce((s, w) => s + w.weight, 0);
  let r = Math.random() * total;
  for (const { rarity, weight } of RARITY_WEIGHTS) {
    r -= weight;
    if (r <= 0) return rarity;
  }
  return Rarity.Common;
}

function nextFreeSlot(rings: (Ring | null)[]): { index: number; slotType: SlotType } | null {
  if (rings[0] === null) return { index: 0, slotType: "projectile_lmb" };
  if (rings[1] === null) return { index: 1, slotType: "projectile_rmb" };
  if (rings[2] === null) return { index: 2, slotType: "aura" };
  if (rings[3] === null) return { index: 3, slotType: "aura" };
  if (rings[4] === null) return { index: 4, slotType: "core" };
  return null;
}

function attackTypeForSlot(slotType: SlotType): Ring["attackType"] {
  if (slotType === "projectile_lmb" || slotType === "projectile_rmb") return "projectile";
  if (slotType === "aura") return "aura";
  return "aura";
}

function makeRing(element: ElementType, slotType: SlotType): Ring {
  return {
    id: uid(),
    element,
    rank: RingRank.Lower,
    name: RING_NAMES_RU[element],
    level: 1,
    attackType: attackTypeForSlot(slotType),
    slotType,
  };
}

function findPossibleCombo(element: ElementType, player: PlayerState) {
  const owned = player.rings.filter((r): r is Ring => r !== null);
  for (const r of owned) {
    // Skip already-merged combo rings — they can't merge again
    if (r.comboName || r.secondElement) continue;
    // Skip core slot
    if (r.slotType === "core") continue;
    const combo = getCombo(element, r.element);
    if (combo) {
      return { comboName: combo.name, comboDesc: combo.description, partnerElement: r.element };
    }
  }
  return undefined;
}

function getAllOwnedElements(rings: (Ring | null)[]): Set<ElementType> {
  const set = new Set<ElementType>();
  for (const r of rings) {
    if (!r) continue;
    set.add(r.element);
    if (r.secondElement) set.add(r.secondElement);
  }
  return set;
}

export function generateUpgrades(player: PlayerState, _stageIndex: number): Upgrade[] {
  const ups: Upgrade[] = [];
  const slot = nextFreeSlot(player.rings);
  const ownedElements = getAllOwnedElements(player.rings);

  if (slot) {
    if (slot.slotType === "core") {
      const available = Object.values(ElementType).filter(e => ownedElements.has(e));
      if (available.length > 0) {
        const chosen = shuffle(available).slice(0, 2);
        for (const el of chosen) {
          const coreInfo = CORE_BONUSES[el];
          const rarity = rollRarity();
          ups.push({
            id: uid(),
            name: coreInfo.nameRu,
            description: `+${Math.round(CORE_DAMAGE_BONUS * 100 * RARITY_MULTIPLIERS[rarity])}% урон ${ELEMENT_NAMES_RU[el]}. ${coreInfo.descRu}`,
            type: "core",
            ring: makeRing(el, "core"),
            icon: "💠",
            rarity,
          });
        }
      }
    } else {
      const available = Object.values(ElementType).filter(e => !ownedElements.has(e));
      if (available.length > 0) {
        const chosen = shuffle(available).slice(0, 2);
        for (const el of chosen) {
          const ring = makeRing(el, slot.slotType);
          const rarity = rollRarity();
          const slotLabel = slot.slotType === "projectile_lmb" ? "Слот ЛКМ — снаряд"
            : slot.slotType === "projectile_rmb" ? "Слот ПКМ — снаряд"
            : "Слот ауры — авто-активация";
          const dmgInfo = `${Math.round((10 + 1 * 5) * RARITY_MULTIPLIERS[rarity])} урона`;
          const mechDesc = slot.slotType === "aura"
            ? `Авто-аура ${ELEMENT_NAMES_RU[el]}: наносит ${dmgInfo} каждые 2с вокруг игрока`
            : `Снаряд ${ELEMENT_NAMES_RU[el]}: ${dmgInfo} за попадание`;
          ups.push({
            id: uid(),
            name: ring.name,
            description: `${slotLabel}\n${mechDesc}`,
            type: "ring",
            ring,
            icon: "💍",
            rarity,
            possibleCombo: findPossibleCombo(el, player),
          });
        }
      }
    }
  }

  // Ring level-up: only non-core rings with level < 5
  const upgradeable = player.rings.filter(r => r && r.level < 5 && r.slotType !== "core") as Ring[];
  if (upgradeable.length > 0) {
    const r = pick(upgradeable);
    const rarity = rollRarity();
    const nextLevel = r.level + 1;
    const nextRank = nextLevel >= 5 ? "Легендарный" : nextLevel >= 4 ? "Высший" : nextLevel >= 3 ? "Средний" : "Низший";
    const dmgBonus = `+${Math.round(5 * RARITY_MULTIPLIERS[rarity])} урона`;
    const displayName = r.comboName ?? r.name;
    const elemLabel = r.secondElement
      ? `${ELEMENT_NAMES_RU[r.element]}+${ELEMENT_NAMES_RU[r.secondElement]}`
      : ELEMENT_NAMES_RU[r.element];
    ups.push({
      id: uid(),
      name: `${displayName} +${nextLevel}`,
      description: `Усилить ${elemLabel} кольцо до ур. ${nextLevel}\nРанг: ${nextRank} • ${dmgBonus} за удар`,
      type: "ringLevelUp",
      ring: r,
      icon: "⬆️",
      rarity,
    });
  }

  const STAT_ICONS: Record<string, string> = {
    hp: "❤️", atk: "⚔️", spd: "🏃", projSpd: "💨", projCnt: "🔮", staminaMax: "🛡️",
    dashCharges: "⚡", dashDamage: "💥", dashCostReduce: "🪶", dashRegenSpd: "🔄",
    xpMagnet: "🧲", lifesteal: "🩸", projReflect: "🪞", rage: "🔥", auraCdr: "🌀",
  };
  const STAT_BASE_VALUES: Record<string, number> = {
    hp: 25, atk: 0.2, spd: 0.15, projSpd: 0.2, projCnt: 1, staminaMax: 30,
    dashCharges: 1, dashDamage: 15, dashCostReduce: 0.3, dashRegenSpd: 0.25,
    xpMagnet: 0.5, lifesteal: 0.05, projReflect: 0.08, rage: 0.01, auraCdr: 0.15,
  };

  const statEntries = Object.entries(UPGRADE_NAMES_RU).filter(([, d]) => d.category === "stat");
  const dashEntries = Object.entries(UPGRADE_NAMES_RU).filter(([, d]) => d.category === "dash");
  const passiveEntries = Object.entries(UPGRADE_NAMES_RU).filter(([, d]) => d.category === "passive");

  const statPool = shuffle(statEntries).slice(0, 1);
  const specialPool = shuffle([...dashEntries, ...passiveEntries]).slice(0, 1);
  const combinedPool = [...statPool, ...specialPool];

  for (const [key, data] of combinedPool) {
    const rarity = rollRarity();
    const mult = RARITY_MULTIPLIERS[rarity];
    const baseVal = STAT_BASE_VALUES[key] ?? 0;
    const val = (key === "projCnt" || key === "dashCharges") ? baseVal : Math.round(baseVal * mult * 100) / 100;
    const upgradeType = data.category === "dash" ? "dash" as const : data.category === "passive" ? "passive" as const : "stat" as const;
    ups.push({
      id: uid(),
      name: data.name,
      description: `${data.desc}${mult > 1 ? ` (x${mult})` : ""}`,
      type: upgradeType,
      statKey: key as StatKey,
      value: val,
      icon: STAT_ICONS[key] ?? "⬆️",
      rarity,
    });
  }

  return shuffle(ups).slice(0, 4);
}

export function applyUpgrade(player: PlayerState, upgrade: Upgrade, mergeCombo: boolean): void {
  switch (upgrade.type) {
    case "ring": {
      if (!upgrade.ring) break;
      if (mergeCombo && upgrade.possibleCombo) {
        const partnerIdx = player.rings.findIndex(
          r => r !== null && r.element === upgrade.possibleCombo!.partnerElement
        );
        if (partnerIdx !== -1) {
          const partner = player.rings[partnerIdx]!;
          const combo = getCombo(upgrade.ring.element, partner.element);
          const merged: Ring = {
            id: uid(),
            element: upgrade.ring.element,
            secondElement: partner.element,
            comboName: combo?.name,
            rank: partner.rank,
            name: combo?.name ?? `${RING_NAMES_RU[upgrade.ring.element]}+${RING_NAMES_RU[partner.element]}`,
            level: Math.max(partner.level, 1),
            attackType: partner.attackType,
            slotType: partner.slotType,
          };
          player.rings[partnerIdx] = merged;
          break;
        }
      }
      const slot = nextFreeSlot(player.rings);
      if (slot) {
        player.rings[slot.index] = { ...upgrade.ring };
      }
      break;
    }
    case "core": {
      if (!upgrade.ring) break;
      const el = upgrade.ring.element;
      const coreInfo = CORE_BONUSES[el];
      const mult = RARITY_MULTIPLIERS[upgrade.rarity];
      player.elementalCore = {
        element: el,
        damageBonus: CORE_DAMAGE_BONUS * mult,
        uniqueBonus: coreInfo.bonus,
      };
      player.rings[4] = { ...upgrade.ring };
      break;
    }
    case "ringLevelUp": {
      if (!upgrade.ring) break;
      const target = player.rings.find(r => r && r.id === upgrade.ring!.id);
      if (target) {
        target.level = Math.min(5, target.level + 1);
        if (target.level >= 3) target.rank = RingRank.Middle;
        if (target.level >= 4) target.rank = RingRank.Higher;
        if (target.level >= 5) target.rank = RingRank.Legendary;
      }
      break;
    }
    case "stat": {
      const val = upgrade.value ?? 0;
      switch (upgrade.statKey) {
        case "hp": player.maxHp += val; player.hp += val; break;
        case "atk": player.damageMult += val; break;
        case "spd": player.attackSpeed *= 1 + val; break;
        case "projSpd": player.projectileSpeedMult += val; break;
        case "projCnt": player.projectileCount += val; break;
        case "staminaMax": player.maxStamina += val; player.stamina += val; break;
      }
      break;
    }
    case "dash": {
      const val = upgrade.value ?? 0;
      switch (upgrade.statKey) {
        case "dashCharges": player.dashMaxCharges += val; player.dashCharges += val; break;
        case "dashDamage": player.dashDamage += val; break;
        case "dashCostReduce": player.dashCostMult = Math.max(0.1, player.dashCostMult - val); break;
        case "dashRegenSpd": player.dashChargeRegenTime = Math.max(0.5, player.dashChargeRegenTime * (1 - val)); break;
      }
      break;
    }
    case "passive": {
      const val = upgrade.value ?? 0;
      switch (upgrade.statKey) {
        case "xpMagnet": player.passiveXpMagnet += val; break;
        case "lifesteal": player.passiveLifesteal += val; break;
        case "projReflect": player.passiveProjReflect += val; break;
        case "rage": player.passiveRage += val; break;
        case "auraCdr": player.passiveAuraCdr += val; break;
      }
      break;
    }
  }
}
