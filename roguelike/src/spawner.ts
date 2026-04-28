import {
  ENEMY_TEMPLATES,
  BOSS_TEMPLATES,
  MINIBOSS_TEMPLATES,
  STAGES,
  WALL_THICKNESS,
} from "./constants";
import type { Enemy, Room } from "./types";
import { uid, randRange, pick } from "./utils";

function makeEnemy(templateKey: string, level: number, x: number, y: number): Enemy {
  const t = ENEMY_TEMPLATES[templateKey] ?? BOSS_TEMPLATES[templateKey] ?? MINIBOSS_TEMPLATES[templateKey];
  if (!t) throw new Error(`Unknown enemy template: ${templateKey}`);

  const scaling = 1 + level * 0.18;

  return {
    id: uid(),
    x,
    y,
    hp: Math.round(t.baseHp * scaling),
    maxHp: Math.round(t.baseHp * scaling),
    type: t.type,
    behavior: t.behavior,
    speed: t.baseSpeed,
    damage: Math.round(t.baseDamage * scaling),
    radius: t.radius,
    shootCooldown: t.shootCooldown,
    shootTimer: t.shootCooldown,
    dashCooldown: t.dashCooldown,
    dashTimer: t.dashCooldown,
    isDashing: false,
    dashVx: 0,
    dashVy: 0,
    phase: 0,
    summonTimer: 6,
    teleportTimer: 4,
    healTimer: 3,
    specialTimer: 3,
    slowTimer: 0,
    burnTimer: 0,
    burnDamage: 0,
    stunTimer: 0,
    hitFlash: 0,
    attackAnim: 0,
    dead: false,
  };
}

function randomSpawnPos(room: Room): [number, number] {
  const pad = WALL_THICKNESS + 40;
  return [
    randRange(pad, room.width - pad),
    randRange(pad, room.height - pad),
  ];
}

export function spawnRoomEnemies(room: Room, stageIndex: number, level: number): Enemy[] {
  const stage = STAGES[stageIndex] ?? STAGES[0];
  const enemies: Enemy[] = [];

  if (room.type === "boss") {
    const bx = room.width / 2;
    const by = room.height / 3;
    enemies.push(makeEnemy(stage.boss, level, bx, by));
    const guardCount = 2 + Math.floor(level / 3);
    for (let i = 0; i < guardCount; i++) {
      const [x, y] = randomSpawnPos(room);
      enemies.push(makeEnemy(pick(stage.normalEnemies), level, x, y));
    }
    return enemies;
  }

  if (room.type === "elite") {
    const count = 4 + Math.floor(level / 2);
    const heavyTemplate = stage.normalEnemies.length > 1
      ? stage.normalEnemies[stage.normalEnemies.length - 1]
      : stage.normalEnemies[0];

    if (Math.random() < 0.3) {
      const minibossKeys = Object.keys(MINIBOSS_TEMPLATES);
      const minibossKey = pick(minibossKeys);
      const [mbx, mby] = [room.width / 2, room.height / 2];
      enemies.push(makeEnemy(minibossKey, level, mbx, mby));
    }

    for (let i = 0; i < count; i++) {
      const [x, y] = randomSpawnPos(room);
      const tmpl = i < 2 ? heavyTemplate : pick(stage.normalEnemies);
      enemies.push(makeEnemy(tmpl, level + 1, x, y));
    }
    return enemies;
  }

  if (room.type === "normal") {
    const count = 3 + Math.floor(level * 0.8) + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const [x, y] = randomSpawnPos(room);
      enemies.push(makeEnemy(pick(stage.normalEnemies), level, x, y));
    }
    return enemies;
  }

  if (room.type === "event") {
    if (room.event?.type === "trap") {
      const count = 2 + Math.floor(level * 0.5);
      for (let i = 0; i < count; i++) {
        const [x, y] = randomSpawnPos(room);
        enemies.push(makeEnemy(pick(stage.normalEnemies), level + 1, x, y));
      }
    }
    if (room.event?.type === "speed_trial") {
      const count = 5 + Math.floor(level * 0.5);
      for (let i = 0; i < count; i++) {
        const [x, y] = randomSpawnPos(room);
        enemies.push(makeEnemy(pick(stage.normalEnemies), level, x, y));
      }
    }
    return enemies;
  }

  return enemies;
}
