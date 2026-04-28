import type {
  Enemy, Projectile, Particle, DamageNumber, XpOrb,
  PlayerState, ComboEffect, Obstacle, Ring,
} from "./types";
import {
  ELEMENT_COLORS, ENEMY_TEMPLATES, BOSS_TEMPLATES, MINIBOSS_TEMPLATES, WALL_THICKNESS,
  XP_ORB_MAGNET_RADIUS, XP_ORB_COLLECT_RADIUS, XP_ORB_MAGNET_SPEED,
  PLAYER_RADIUS, ENEMY_CONTACT_DAMAGE_MULT, PLAYER_IFRAMES_DURATION,
  BARREL_EXPLOSION_RADIUS, ENEMY_PROJECTILE_SPEED,
} from "./constants";
import { uid, dist, normalize, randRange } from "./utils";
import { ElementType } from "./types";

export function applyCoreDamage(baseDmg: number, element: ElementType | undefined, player: PlayerState): number {
  const core = player.elementalCore;
  if (!core || !element || core.element !== element) return baseDmg;
  return baseDmg * (1 + core.damageBonus);
}

export function tickAuras(
  player: PlayerState,
  projectiles: Projectile[],
  auraTimers: { slot2: number; slot3: number },
  dt: number,
): { slot2: number; slot3: number } {
  const slots = [
    { ring: player.rings[2], timerKey: "slot2" as const, cooldown: 1.5 },
    { ring: player.rings[3], timerKey: "slot3" as const, cooldown: 1.8 },
  ];

  for (const { ring, timerKey, cooldown } of slots) {
    if (!ring) continue;
    auraTimers[timerKey] -= dt;
    if (auraTimers[timerKey] <= 0) {
      auraTimers[timerKey] = cooldown / player.attackSpeed;
      const dmg = (10 + ring.level * 5) * player.damageMult * 0.6;
      const finalDmg = applyCoreDamage(dmg, ring.element, player);
      projectiles.push({
        id: uid(),
        x: player.x,
        y: player.y,
        vx: 0,
        vy: 0,
        owner: "player",
        damage: finalDmg,
        element: ring.element,
        hp: 1,
        lifeTime: 0.4,
        radius: 55 + ring.level * 10,
        piercing: true,
        chainCount: 0,
      });
    }
  }
  return auraTimers;
}

export function updateEnemies(
  enemies: Enemy[],
  player: PlayerState,
  projectiles: Projectile[],
  roomW: number,
  roomH: number,
  dt: number,
): void {
  for (const e of enemies) {
    if (e.dead) continue;

    if (e.hitFlash > 0) e.hitFlash = Math.max(0, e.hitFlash - dt);
    if (e.attackAnim > 0) e.attackAnim = Math.max(0, e.attackAnim - dt);
    if (e.stunTimer > 0) { e.stunTimer -= dt; continue; }

    const slowFactor = e.slowTimer > 0 ? 0.6 : 1;
    e.slowTimer = Math.max(0, e.slowTimer - dt);
    if (e.burnTimer > 0) {
      e.burnTimer -= dt;
      e.hp -= e.burnDamage * dt;
      if (e.hp <= 0) { e.dead = true; continue; }
    }

    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const d = Math.sqrt(dx * dx + dy * dy);
    const [nx, ny] = d > 0 ? [dx / d, dy / d] : [0, 0];

    const isBossBehavior = e.behavior.startsWith("boss_") || e.behavior === "boss" || e.behavior === "miniboss";
    const hpRatio = e.hp / e.maxHp;
    if (isBossBehavior) e.phase = hpRatio < 0.3 ? 2 : hpRatio < 0.6 ? 1 : 0;

    switch (e.behavior) {
      case "chase":
      case "tank":
        e.x += nx * e.speed * slowFactor * dt;
        e.y += ny * e.speed * slowFactor * dt;
        break;

      case "shooter": {
        if (d > 250) {
          e.x += nx * e.speed * slowFactor * dt;
          e.y += ny * e.speed * slowFactor * dt;
        } else if (d < 140) {
          e.x -= nx * e.speed * slowFactor * dt * 0.5;
          e.y -= ny * e.speed * slowFactor * dt * 0.5;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.3;
          projectiles.push({
            id: uid(), x: e.x, y: e.y, vx: nx * ENEMY_PROJECTILE_SPEED, vy: ny * ENEMY_PROJECTILE_SPEED,
            owner: "enemy", damage: e.damage, hp: 1,
            lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
          });
        }
        break;
      }

      case "dasher": {
        e.dashTimer -= dt;
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.3) e.isDashing = false;
        } else if (e.dashTimer <= 0 && d < 350) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 4;
          e.dashVy = ny * e.speed * 4;
          e.attackAnim = 0.35;
        } else {
          e.x += nx * e.speed * slowFactor * dt * 0.6;
          e.y += ny * e.speed * slowFactor * dt * 0.6;
        }
        break;
      }

      case "sniper": {
        if (d < 300) {
          e.x -= nx * e.speed * slowFactor * dt;
          e.y -= ny * e.speed * slowFactor * dt;
        } else if (d > 450) {
          e.x += nx * e.speed * slowFactor * dt * 0.4;
          e.y += ny * e.speed * slowFactor * dt * 0.4;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.4;
          projectiles.push({
            id: uid(), x: e.x, y: e.y,
            vx: nx * ENEMY_PROJECTILE_SPEED * 1.8,
            vy: ny * ENEMY_PROJECTILE_SPEED * 1.8,
            owner: "enemy", damage: e.damage, hp: 1,
            lifeTime: 4, radius: 4, piercing: true, chainCount: 0,
          });
        }
        break;
      }

      case "bomber": {
        if (d > 200) {
          e.x += nx * e.speed * slowFactor * dt;
          e.y += ny * e.speed * slowFactor * dt;
        } else if (d < 120) {
          e.x -= nx * e.speed * slowFactor * dt * 0.6;
          e.y -= ny * e.speed * slowFactor * dt * 0.6;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.35;
          const bombCount = 3;
          for (let i = 0; i < bombCount; i++) {
            const angle = Math.atan2(ny, nx) + (i - 1) * 0.5;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(angle) * ENEMY_PROJECTILE_SPEED * 0.7,
              vy: Math.sin(angle) * ENEMY_PROJECTILE_SPEED * 0.7,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 1.5, radius: 8, piercing: false, chainCount: 0,
            });
          }
        }
        break;
      }

      case "healer": {
        if (d < 200) {
          e.x -= nx * e.speed * slowFactor * dt;
          e.y -= ny * e.speed * slowFactor * dt;
        } else {
          const orbitAngle = Math.atan2(ny, nx) + Math.PI / 2;
          e.x += Math.cos(orbitAngle) * e.speed * slowFactor * dt * 0.5;
          e.y += Math.sin(orbitAngle) * e.speed * slowFactor * dt * 0.5;
        }
        e.healTimer -= dt;
        if (e.healTimer <= 0) {
          e.healTimer = 3.0;
          for (const ally of enemies) {
            if (ally === e || ally.dead) continue;
            if (dist(e.x, e.y, ally.x, ally.y) < 150) {
              ally.hp = Math.min(ally.maxHp, ally.hp + e.damage * 2);
            }
          }
        }
        break;
      }

      case "summoner": {
        if (d < 250) {
          e.x -= nx * e.speed * slowFactor * dt * 0.5;
          e.y -= ny * e.speed * slowFactor * dt * 0.5;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.3;
          projectiles.push({
            id: uid(), x: e.x, y: e.y, vx: nx * ENEMY_PROJECTILE_SPEED * 0.8,
            vy: ny * ENEMY_PROJECTILE_SPEED * 0.8,
            owner: "enemy", damage: e.damage, hp: 1,
            lifeTime: 2.5, radius: 5, piercing: false, chainCount: 0,
          });
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0 && enemies.filter(en => !en.dead).length < 15) {
          e.summonTimer = 6.0;
          const spawnAngle = Math.random() * Math.PI * 2;
          const spawnDist = 60;
          const sx = e.x + Math.cos(spawnAngle) * spawnDist;
          const sy = e.y + Math.sin(spawnAngle) * spawnDist;
          enemies.push({
            id: uid(), x: sx, y: sy,
            hp: Math.round(30 + e.damage), maxHp: Math.round(30 + e.damage),
            type: "summoned", behavior: "chase",
            speed: 120, damage: Math.round(e.damage * 0.5), radius: 9,
            shootCooldown: 0, shootTimer: 0, dashCooldown: 0, dashTimer: 0,
            isDashing: false, dashVx: 0, dashVy: 0, phase: 0,
            summonTimer: 0, teleportTimer: 0, healTimer: 0, specialTimer: 0,
            slowTimer: 0, burnTimer: 0, burnDamage: 0, stunTimer: 0,
            hitFlash: 0, attackAnim: 0, dead: false,
          });
        }
        break;
      }

      case "teleporter": {
        if (d > 200) {
          e.x += nx * e.speed * slowFactor * dt;
          e.y += ny * e.speed * slowFactor * dt;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.3;
          projectiles.push({
            id: uid(), x: e.x, y: e.y, vx: nx * ENEMY_PROJECTILE_SPEED, vy: ny * ENEMY_PROJECTILE_SPEED,
            owner: "enemy", damage: e.damage, hp: 1,
            lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
          });
        }
        e.teleportTimer -= dt;
        if (e.teleportTimer <= 0 && d < 180) {
          e.teleportTimer = 4.0;
          const angle = Math.random() * Math.PI * 2;
          const tpDist = 150 + Math.random() * 100;
          e.x = player.x + Math.cos(angle) * tpDist;
          e.y = player.y + Math.sin(angle) * tpDist;
        }
        break;
      }

      case "miniboss": {
        e.x += nx * e.speed * slowFactor * dt;
        e.y += ny * e.speed * slowFactor * dt;
        e.shootTimer -= dt;
        if (e.shootTimer > 0) break;
        if (e.shootCooldown > 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.4;
          const count = 4;
          const baseAngle = Math.atan2(ny, nx);
          for (let i = 0; i < count; i++) {
            const a = baseAngle - 0.4 + (0.8 / (count - 1)) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * ENEMY_PROJECTILE_SPEED, vy: Math.sin(a) * ENEMY_PROJECTILE_SPEED,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 2.5, radius: 6, piercing: false, chainCount: 0,
            });
          }
        }
        e.dashTimer -= dt;
        if (e.dashCooldown > 0 && e.dashTimer <= 0 && d < 300) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 3.5;
          e.dashVy = ny * e.speed * 3.5;
          e.attackAnim = 0.35;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.3) e.isDashing = false;
        }
        break;
      }

      // =========================
      //    BOSS BEHAVIORS
      // =========================
      case "boss":
      case "boss_captain": {
        e.x += nx * e.speed * slowFactor * dt;
        e.y += ny * e.speed * slowFactor * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.4;
          const count = 3 + e.phase;
          const spread = Math.PI / 4;
          const baseAngle = Math.atan2(ny, nx);
          for (let i = 0; i < count; i++) {
            const a = baseAngle - spread / 2 + (spread / Math.max(1, count - 1)) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 260, vy: Math.sin(a) * 260,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 2.5, radius: 6, piercing: false, chainCount: 0,
            });
          }
        }
        e.dashTimer -= dt;
        if (e.dashTimer <= 0 && d < 300) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 3;
          e.dashVy = ny * e.speed * 3;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.35) e.isDashing = false;
        }
        break;
      }

      case "boss_general": {
        e.x += nx * e.speed * slowFactor * dt;
        e.y += ny * e.speed * slowFactor * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown / (1 + e.phase * 0.3);
          e.attackAnim = 0.4;
          const count = 4 + e.phase * 2;
          const spread = Math.PI / 3 + e.phase * 0.2;
          const baseAngle = Math.atan2(ny, nx);
          for (let i = 0; i < count; i++) {
            const a = baseAngle - spread / 2 + (spread / Math.max(1, count - 1)) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 280, vy: Math.sin(a) * 280,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 2.5, radius: 6, piercing: false, chainCount: 0,
            });
          }
        }
        e.dashTimer -= dt;
        if (e.dashTimer <= 0 && d < 350) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 3.5;
          e.dashVy = ny * e.speed * 3.5;
          e.attackAnim = 0.35;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.35) e.isDashing = false;
        }
        break;
      }

      case "boss_mage": {
        if (d > 300) {
          e.x += nx * e.speed * slowFactor * dt * 0.5;
          e.y += ny * e.speed * slowFactor * dt * 0.5;
        } else if (d < 180) {
          e.x -= nx * e.speed * slowFactor * dt * 0.6;
          e.y -= ny * e.speed * slowFactor * dt * 0.6;
        } else {
          const orbit = Math.atan2(ny, nx) + Math.PI / 2;
          e.x += Math.cos(orbit) * e.speed * slowFactor * dt * 0.4;
          e.y += Math.sin(orbit) * e.speed * slowFactor * dt * 0.4;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown / (1 + e.phase * 0.2);
          e.attackAnim = 0.35;
          if (e.phase >= 2) {
            const ringCount = 8;
            for (let i = 0; i < ringCount; i++) {
              const a = (Math.PI * 2 / ringCount) * i;
              projectiles.push({
                id: uid(), x: e.x, y: e.y,
                vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
                owner: "enemy", damage: e.damage * 0.7, hp: 1,
                lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
              });
            }
          } else {
            const burst = 3 + e.phase;
            const baseAngle = Math.atan2(ny, nx);
            for (let i = 0; i < burst; i++) {
              const a = baseAngle + (i - (burst - 1) / 2) * 0.25;
              projectiles.push({
                id: uid(), x: e.x, y: e.y,
                vx: Math.cos(a) * 240, vy: Math.sin(a) * 240,
                owner: "enemy", damage: e.damage, hp: 1,
                lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
              });
            }
          }
        }
        break;
      }

      case "boss_tank": {
        e.x += nx * e.speed * slowFactor * dt;
        e.y += ny * e.speed * slowFactor * dt;
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.5;
          const ringCount = 6 + e.phase * 2;
          for (let i = 0; i < ringCount; i++) {
            const a = (Math.PI * 2 / ringCount) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 180, vy: Math.sin(a) * 180,
              owner: "enemy", damage: e.damage * 0.8, hp: 1,
              lifeTime: 2, radius: 7, piercing: false, chainCount: 0,
            });
          }
        }
        e.dashTimer -= dt;
        if (e.dashTimer <= 0 && d < 250) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 4;
          e.dashVy = ny * e.speed * 4;
          e.attackAnim = 0.4;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.4) e.isDashing = false;
        }
        break;
      }

      case "boss_summoner": {
        if (d < 200) {
          e.x -= nx * e.speed * slowFactor * dt * 0.5;
          e.y -= ny * e.speed * slowFactor * dt * 0.5;
        } else {
          e.x += nx * e.speed * slowFactor * dt * 0.3;
          e.y += ny * e.speed * slowFactor * dt * 0.3;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.35;
          const count = 3;
          const baseAngle = Math.atan2(ny, nx);
          for (let i = 0; i < count; i++) {
            const a = baseAngle + (i - 1) * 0.3;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 250, vy: Math.sin(a) * 250,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 3, radius: 6, piercing: false, chainCount: 0,
            });
          }
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0 && enemies.filter(en => !en.dead).length < 12) {
          e.summonTimer = 5.0 - e.phase;
          for (let s = 0; s < 2 + e.phase; s++) {
            const sa = Math.random() * Math.PI * 2;
            const sd = 80 + Math.random() * 60;
            enemies.push({
              id: uid(), x: e.x + Math.cos(sa) * sd, y: e.y + Math.sin(sa) * sd,
              hp: Math.round(40 + e.damage * 0.5), maxHp: Math.round(40 + e.damage * 0.5),
              type: "summoned", behavior: "chase",
              speed: 110, damage: Math.round(e.damage * 0.4), radius: 10,
              shootCooldown: 0, shootTimer: 0, dashCooldown: 0, dashTimer: 0,
              isDashing: false, dashVx: 0, dashVy: 0, phase: 0,
              summonTimer: 0, teleportTimer: 0, healTimer: 0, specialTimer: 0,
              slowTimer: 0, burnTimer: 0, burnDamage: 0, stunTimer: 0,
              hitFlash: 0, attackAnim: 0, dead: false,
            });
          }
        }
        break;
      }

      case "boss_gravity": {
        e.x += nx * e.speed * slowFactor * dt;
        e.y += ny * e.speed * slowFactor * dt;
        e.specialTimer -= dt;
        if (e.specialTimer <= 0) {
          e.specialTimer = 3.0 - e.phase * 0.5;
          const pullStrength = 300 + e.phase * 100;
          for (const target of enemies) {
            if (target === e || target.dead) continue;
          }
          const pullDx = e.x - player.x;
          const pullDy = e.y - player.y;
          const pullDist = Math.sqrt(pullDx * pullDx + pullDy * pullDy);
          if (pullDist < 400 && pullDist > 0) {
            player.x += (pullDx / pullDist) * pullStrength * dt * 3;
            player.y += (pullDy / pullDist) * pullStrength * dt * 3;
          }
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.4;
          const count = 5 + e.phase;
          for (let i = 0; i < count; i++) {
            const a = (Math.PI * 2 / count) * i + e.phase * 0.3;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 220, vy: Math.sin(a) * 220,
              owner: "enemy", damage: e.damage * 0.7, hp: 1,
              lifeTime: 3, radius: 6, piercing: false, chainCount: 0,
            });
          }
        }
        e.dashTimer -= dt;
        if (e.dashTimer <= 0 && d < 250) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 3;
          e.dashVy = ny * e.speed * 3;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.35) e.isDashing = false;
        }
        break;
      }

      case "boss_illusionist": {
        if (d > 250) {
          e.x += nx * e.speed * slowFactor * dt * 0.5;
          e.y += ny * e.speed * slowFactor * dt * 0.5;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown / (1 + e.phase * 0.3);
          e.attackAnim = 0.35;
          const spiralCount = 5 + e.phase * 2;
          const spiralOffset = (Date.now() / 1000) * 2;
          for (let i = 0; i < spiralCount; i++) {
            const a = spiralOffset + (Math.PI * 2 / spiralCount) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 200, vy: Math.sin(a) * 200,
              owner: "enemy", damage: e.damage * 0.6, hp: 1,
              lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
            });
          }
        }
        e.teleportTimer -= dt;
        if (e.teleportTimer <= 0) {
          e.teleportTimer = 3.5 - e.phase * 0.5;
          const angle = Math.random() * Math.PI * 2;
          const tpDist = 200 + Math.random() * 100;
          e.x = player.x + Math.cos(angle) * tpDist;
          e.y = player.y + Math.sin(angle) * tpDist;
        }
        break;
      }

      case "boss_pirate": {
        e.dashTimer -= dt;
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.35) e.isDashing = false;
        } else if (e.dashTimer <= 0 && d < 400) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown / (1 + e.phase * 0.2);
          e.dashVx = nx * e.speed * 4;
          e.dashVy = ny * e.speed * 4;
          e.attackAnim = 0.35;
        } else {
          const orbitAngle = Math.atan2(ny, nx) + Math.PI / 2;
          e.x += Math.cos(orbitAngle) * e.speed * slowFactor * dt * 0.8;
          e.y += Math.sin(orbitAngle) * e.speed * slowFactor * dt * 0.8;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown;
          e.attackAnim = 0.3;
          const burst = 2 + e.phase;
          const baseAngle = Math.atan2(ny, nx);
          for (let i = 0; i < burst; i++) {
            const a = baseAngle + (i - (burst - 1) / 2) * 0.3;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 2.5, radius: 5, piercing: false, chainCount: 0,
            });
          }
        }
        break;
      }

      case "boss_morven": {
        if (d > 200) {
          e.x += nx * e.speed * slowFactor * dt * 0.6;
          e.y += ny * e.speed * slowFactor * dt * 0.6;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown / (1 + e.phase * 0.3);
          e.attackAnim = 0.4;
          const waves = 2 + e.phase;
          for (let w = 0; w < waves; w++) {
            const count = 6 + e.phase;
            const offset = w * 0.3;
            for (let i = 0; i < count; i++) {
              const a = offset + (Math.PI * 2 / count) * i;
              const speed = 180 + w * 40;
              projectiles.push({
                id: uid(), x: e.x, y: e.y,
                vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                owner: "enemy", damage: e.damage * 0.6, hp: 1,
                lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
              });
            }
          }
        }
        e.teleportTimer -= dt;
        if (e.teleportTimer <= 0 && d < 200) {
          e.teleportTimer = 4.0 - e.phase;
          const angle = Math.random() * Math.PI * 2;
          e.x = player.x + Math.cos(angle) * 300;
          e.y = player.y + Math.sin(angle) * 300;
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0 && e.phase >= 1 && enemies.filter(en => !en.dead).length < 10) {
          e.summonTimer = 7.0 - e.phase * 2;
          for (let s = 0; s < 2; s++) {
            const sa = Math.random() * Math.PI * 2;
            enemies.push({
              id: uid(), x: e.x + Math.cos(sa) * 70, y: e.y + Math.sin(sa) * 70,
              hp: Math.round(50 + e.damage), maxHp: Math.round(50 + e.damage),
              type: "summoned", behavior: "shooter",
              speed: 70, damage: Math.round(e.damage * 0.3), radius: 10,
              shootCooldown: 2.0, shootTimer: 2.0, dashCooldown: 0, dashTimer: 0,
              isDashing: false, dashVx: 0, dashVy: 0, phase: 0,
              summonTimer: 0, teleportTimer: 0, healTimer: 0, specialTimer: 0,
              slowTimer: 0, burnTimer: 0, burnDamage: 0, stunTimer: 0,
              hitFlash: 0, attackAnim: 0, dead: false,
            });
          }
        }
        break;
      }

      case "boss_kael": {
        const orbitSpeed = e.speed * slowFactor * (0.5 + e.phase * 0.2);
        const orbitAngle = Math.atan2(ny, nx) + Math.PI / 2;
        if (d > 350) {
          e.x += nx * orbitSpeed * dt;
          e.y += ny * orbitSpeed * dt;
        } else {
          e.x += Math.cos(orbitAngle) * orbitSpeed * dt;
          e.y += Math.sin(orbitAngle) * orbitSpeed * dt;
        }
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown / (1 + e.phase * 0.4);
          e.attackAnim = 0.4;
          const baseAngle = Math.atan2(ny, nx);
          const fanCount = 5 + e.phase * 2;
          const fanSpread = Math.PI / 2 + e.phase * 0.3;
          for (let i = 0; i < fanCount; i++) {
            const a = baseAngle - fanSpread / 2 + (fanSpread / (fanCount - 1)) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 280, vy: Math.sin(a) * 280,
              owner: "enemy", damage: e.damage * 0.8, hp: 1,
              lifeTime: 3, radius: 5, piercing: false, chainCount: 0,
            });
          }
          if (e.phase >= 1) {
            const ringCount = 8;
            for (let i = 0; i < ringCount; i++) {
              const a = (Math.PI * 2 / ringCount) * i;
              projectiles.push({
                id: uid(), x: e.x, y: e.y,
                vx: Math.cos(a) * 150, vy: Math.sin(a) * 150,
                owner: "enemy", damage: e.damage * 0.5, hp: 1,
                lifeTime: 4, radius: 4, piercing: false, chainCount: 0,
              });
            }
          }
        }
        e.dashTimer -= dt;
        if (e.dashTimer <= 0 && d < 300) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 4;
          e.dashVy = ny * e.speed * 4;
          e.attackAnim = 0.35;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.3) e.isDashing = false;
        }
        break;
      }

      case "boss_final": {
        e.x += nx * e.speed * slowFactor * dt * (0.6 + e.phase * 0.15);
        e.y += ny * e.speed * slowFactor * dt * (0.6 + e.phase * 0.15);
        e.shootTimer -= dt;
        if (e.shootTimer <= 0) {
          e.shootTimer = e.shootCooldown / (1 + e.phase * 0.5);
          e.attackAnim = 0.5;
          const baseAngle = Math.atan2(ny, nx);
          const fanCount = 5 + e.phase * 3;
          const fanSpread = Math.PI / 2 + e.phase * 0.4;
          for (let i = 0; i < fanCount; i++) {
            const a = baseAngle - fanSpread / 2 + (fanSpread / (fanCount - 1)) * i;
            projectiles.push({
              id: uid(), x: e.x, y: e.y,
              vx: Math.cos(a) * 300, vy: Math.sin(a) * 300,
              owner: "enemy", damage: e.damage, hp: 1,
              lifeTime: 3, radius: 6, piercing: false, chainCount: 0,
            });
          }
          if (e.phase >= 1) {
            const ringCount = 10 + e.phase * 2;
            const spiralOffset = (Date.now() / 1000) * 1.5;
            for (let i = 0; i < ringCount; i++) {
              const a = spiralOffset + (Math.PI * 2 / ringCount) * i;
              projectiles.push({
                id: uid(), x: e.x, y: e.y,
                vx: Math.cos(a) * 160, vy: Math.sin(a) * 160,
                owner: "enemy", damage: e.damage * 0.5, hp: 1,
                lifeTime: 4, radius: 5, piercing: false, chainCount: 0,
              });
            }
          }
        }
        e.dashTimer -= dt;
        if (e.dashTimer <= 0 && d < 350) {
          e.isDashing = true;
          e.dashTimer = e.dashCooldown;
          e.dashVx = nx * e.speed * 4;
          e.dashVy = ny * e.speed * 4;
          e.attackAnim = 0.4;
        }
        if (e.isDashing) {
          e.x += e.dashVx * dt;
          e.y += e.dashVy * dt;
          if (e.dashTimer <= e.dashCooldown - 0.4) e.isDashing = false;
        }
        e.summonTimer -= dt;
        if (e.summonTimer <= 0 && e.phase >= 1 && enemies.filter(en => !en.dead).length < 8) {
          e.summonTimer = 6.0 - e.phase * 1.5;
          for (let s = 0; s < 3; s++) {
            const sa = Math.random() * Math.PI * 2;
            const sd = 100;
            enemies.push({
              id: uid(), x: e.x + Math.cos(sa) * sd, y: e.y + Math.sin(sa) * sd,
              hp: Math.round(60 + e.damage * 0.5), maxHp: Math.round(60 + e.damage * 0.5),
              type: "summoned", behavior: "dasher",
              speed: 100, damage: Math.round(e.damage * 0.3), radius: 11,
              shootCooldown: 0, shootTimer: 0, dashCooldown: 2.5, dashTimer: 2.5,
              isDashing: false, dashVx: 0, dashVy: 0, phase: 0,
              summonTimer: 0, teleportTimer: 0, healTimer: 0, specialTimer: 0,
              slowTimer: 0, burnTimer: 0, burnDamage: 0, stunTimer: 0,
              hitFlash: 0, attackAnim: 0, dead: false,
            });
          }
        }
        break;
      }
    }

    const pad = WALL_THICKNESS + e.radius;
    e.x = Math.max(pad, Math.min(roomW - pad, e.x));
    e.y = Math.max(pad, Math.min(roomH - pad, e.y));
  }
}

export function updateProjectiles(projectiles: Projectile[], roomW: number, roomH: number, dt: number): void {
  for (const p of projectiles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.lifeTime -= dt;
    if (p.lifeTime <= 0) p.hp = 0;
    if (p.x < -50 || p.x > roomW + 50 || p.y < -50 || p.y > roomH + 50) p.hp = 0;
  }
}

export function checkCollisions(
  player: PlayerState,
  enemies: Enemy[],
  projectiles: Projectile[],
  particles: Particle[],
  damageNumbers: DamageNumber[],
  xpOrbs: XpOrb[],
  combo: ComboEffect | null,
): { kills: number; xpGained: number } {
  let kills = 0;
  let xpGained = 0;
  const playerRadius = PLAYER_RADIUS;

  for (const p of projectiles) {
    if (p.hp <= 0) continue;

    if (p.owner === "player") {
      for (const e of enemies) {
        if (e.dead) continue;
        if (dist(p.x, p.y, e.x, e.y) < p.radius + e.radius) {
          let dmg = p.damage;

          if (combo?.type === "aoe_radius") dmg *= 1 + combo.value;
          if (combo?.type === "slow" && e.slowTimer <= 0) e.slowTimer = 2;
          if (combo?.type === "dot" && e.burnTimer <= 0) { e.burnTimer = 3; e.burnDamage = combo.value; }
          if (combo?.type === "stun") e.stunTimer = Math.max(e.stunTimer, combo.value);
          if (combo?.type === "lifesteal") player.hp = Math.min(player.maxHp, player.hp + dmg * combo.value);

          // Core bonuses
          const core = player.elementalCore;
          if (core && p.element) {
            if (core.uniqueBonus === "freeze" && Math.random() < 0.1) e.stunTimer = Math.max(e.stunTimer, 1);
            if (core.uniqueBonus === "blind" && Math.random() < 0.08) e.stunTimer = Math.max(e.stunTimer, 0.3);
            if (core.uniqueBonus === "lifesteal") player.hp = Math.min(player.maxHp, player.hp + dmg * 0.1);
            if (core.uniqueBonus === "slow_enhance" && e.slowTimer > 0) e.slowTimer += 0.5;
            if (core.uniqueBonus === "explosive_chance" && Math.random() < 0.15) {
              for (const other of enemies) {
                if (other === e || other.dead) continue;
                if (dist(e.x, e.y, other.x, other.y) < BARREL_EXPLOSION_RADIUS) {
                  other.hp -= 25;
                  damageNumbers.push({ x: other.x, y: other.y - other.radius, value: 25, life: 0.7, color: "#f87171" });
                  if (other.hp <= 0) { other.dead = true; kills++; const xv = 10 + Math.floor(other.maxHp / 8); xpGained += xv; xpOrbs.push({ id: uid(), x: other.x, y: other.y, value: xv, collected: false }); }
                }
              }
            }
          }

          if (player.passiveLifesteal > 0) {
            player.hp = Math.min(player.maxHp, player.hp + dmg * player.passiveLifesteal);
          }

          e.hp -= dmg;
          e.hitFlash = 0.15;
          // Knockback
          const kbDir = normalize(e.x - p.x, e.y - p.y);
          const isBoss = e.behavior.startsWith("boss") || e.behavior === "miniboss";
          const kbForce = isBoss ? 2 : e.behavior === "tank" ? 4 : 8;
          e.x += kbDir[0] * kbForce;
          e.y += kbDir[1] * kbForce;
          spawnHitParticles(particles, p.x, p.y, p.element);
          damageNumbers.push({ x: e.x, y: e.y - e.radius, value: Math.round(dmg), life: 0.7, color: "#fff" });

          if (combo?.type === "explosive") {
            for (const other of enemies) {
              if (other === e || other.dead) continue;
              if (dist(e.x, e.y, other.x, other.y) < BARREL_EXPLOSION_RADIUS) {
                other.hp -= combo.value;
                damageNumbers.push({ x: other.x, y: other.y - other.radius, value: Math.round(combo.value), life: 0.7, color: "#fbbf24" });
                if (other.hp <= 0) { other.dead = true; kills++; const xv = 10 + Math.floor(Math.random() * 10); xpGained += xv; xpOrbs.push({ id: uid(), x: other.x, y: other.y, value: xv, collected: false }); }
              }
            }
          }

          if (combo?.type === "chain" && p.chainCount < combo.value) {
            const nearest = findNearest(enemies, e.x, e.y, e);
            if (nearest) {
              const [cnx, cny] = normalize(nearest.x - e.x, nearest.y - e.y);
              projectiles.push({
                id: uid(), x: e.x, y: e.y, vx: cnx * 350, vy: cny * 350,
                owner: "player", damage: p.damage * 0.7, element: p.element,
                hp: 1, lifeTime: 1, radius: p.radius,
                piercing: false, chainCount: p.chainCount + 1,
              });
            }
          }

          if (!p.piercing && !(combo?.type === "pierce")) p.hp = 0;

          if (e.hp <= 0) {
            e.dead = true;
            kills++;
            spawnDeathParticles(particles, e.x, e.y, e.type);
            const xv = 10 + Math.floor(e.maxHp / 8);
            xpGained += xv;
            xpOrbs.push({ id: uid(), x: e.x, y: e.y, value: xv, collected: false });
          }
          if (p.hp <= 0) break;
        }
      }
    }

    if (p.owner === "enemy" && player.invincibleTimer <= 0) {
      if (dist(p.x, p.y, player.x, player.y) < p.radius + playerRadius) {
        player.hp -= p.damage;
        player.invincibleTimer = 0.3;
        p.hp = 0;
        spawnHitParticles(particles, player.x, player.y);
        damageNumbers.push({ x: player.x, y: player.y - 20, value: Math.round(p.damage), life: 0.7, color: "#f87171" });
      }
    }
  }

  for (const e of enemies) {
    if (e.dead || player.invincibleTimer > 0) continue;
    if (dist(e.x, e.y, player.x, player.y) < e.radius + playerRadius) {
      const contactDmg = e.damage * ENEMY_CONTACT_DAMAGE_MULT;
      player.hp -= contactDmg;
      player.invincibleTimer = PLAYER_IFRAMES_DURATION;
      e.attackAnim = 0.25;
      damageNumbers.push({ x: player.x, y: player.y - 20, value: Math.round(contactDmg), life: 0.7, color: "#f87171" });
    }
  }

  return { kills, xpGained };
}

export function checkObstacleCollisions(
  projectiles: Projectile[],
  obstacles: Obstacle[],
  enemies: Enemy[],
  particles: Particle[],
  damageNumbers: DamageNumber[],
  xpOrbs: XpOrb[],
): number {
  let kills = 0;
  for (const p of projectiles) {
    if (p.hp <= 0 || p.owner === "enemy") continue;
    for (const obs of obstacles) {
      if (obs.destroyed) continue;
      if (obs.type === "lava") continue;
      if (dist(p.x, p.y, obs.x, obs.y) < p.radius + obs.radius) {
        if (obs.type === "pillar") {
          if (!p.piercing) p.hp = 0;
        } else {
          obs.hp--;
          spawnHitParticles(particles, p.x, p.y, p.element);
          if (!p.piercing) p.hp = 0;
          if (obs.hp <= 0) {
            obs.destroyed = true;
            if (obs.type === "barrel") {
              for (const e of enemies) {
                if (e.dead) continue;
                if (dist(obs.x, obs.y, e.x, e.y) < BARREL_EXPLOSION_RADIUS) {
                  e.hp -= 30;
                  damageNumbers.push({ x: e.x, y: e.y - e.radius, value: 30, life: 0.7, color: "#f97316" });
                  if (e.hp <= 0) {
                    e.dead = true;
                    kills++;
                    spawnDeathParticles(particles, e.x, e.y, e.type);
                    const xv = 10 + Math.floor(e.maxHp / 8);
                    xpOrbs.push({ id: uid(), x: e.x, y: e.y, value: xv, collected: false });
                  }
                }
              }
              spawnExplosionParticles(particles, obs.x, obs.y);
            }
          }
        }
        break;
      }
    }
  }
  return kills;
}

export function checkPlayerObstacles(
  player: PlayerState,
  obstacles: Obstacle[],
  enemies: Enemy[],
  dt: number,
): void {
  const playerRadius = PLAYER_RADIUS;
  for (const obs of obstacles) {
    if (obs.destroyed) continue;

    if (obs.type === "lava") {
      if (dist(player.x, player.y, obs.x, obs.y) < obs.radius + playerRadius) {
        player.hp -= 8 * dt;
      }
      for (const e of enemies) {
        if (e.dead) continue;
        if (dist(e.x, e.y, obs.x, obs.y) < obs.radius + e.radius) {
          e.hp -= 8 * dt;
          if (e.hp <= 0) e.dead = true;
        }
      }
    }

    if (obs.type === "pillar" || obs.type === "barrel") {
      const d = dist(player.x, player.y, obs.x, obs.y);
      const minDist = obs.radius + playerRadius;
      if (d < minDist && d > 0) {
        const [nx, ny] = normalize(player.x - obs.x, player.y - obs.y);
        if (obs.type === "barrel") {
          const overlap = minDist - d;
          const pushPlayer = 0.3;
          const pushBarrel = 0.7;
          player.x += nx * overlap * pushPlayer;
          player.y += ny * overlap * pushPlayer;
          obs.x -= nx * overlap * pushBarrel;
          obs.y -= ny * overlap * pushBarrel;
        } else {
          player.x = obs.x + nx * minDist;
          player.y = obs.y + ny * minDist;
        }
      }
      for (const e of enemies) {
        if (e.dead) continue;
        const ed = dist(e.x, e.y, obs.x, obs.y);
        const eMin = obs.radius + e.radius;
        if (ed < eMin && ed > 0) {
          const [enx, eny] = normalize(e.x - obs.x, e.y - obs.y);
          e.x = obs.x + enx * eMin;
          e.y = obs.y + eny * eMin;
        }
      }
    }
  }
}

export function updateParticles(particles: Particle[], dt: number): void {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    p.size *= 0.97;
  }
}

export function collectXpOrbs(player: PlayerState, orbs: XpOrb[], dt: number, magnetBonus: number = 0): void {
  const magnetRadius = XP_ORB_MAGNET_RADIUS * (1 + magnetBonus);
  for (const orb of orbs) {
    if (orb.collected) continue;
    if (dist(player.x, player.y, orb.x, orb.y) < magnetRadius) {
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 0) {
        orb.x += (dx / d) * XP_ORB_MAGNET_SPEED * dt;
        orb.y += (dy / d) * XP_ORB_MAGNET_SPEED * dt;
      }
      if (d < XP_ORB_COLLECT_RADIUS) {
        orb.collected = true;
        player.xp += orb.value;
      }
    }
  }
}

function findNearest(enemies: Enemy[], x: number, y: number, exclude: Enemy): Enemy | null {
  let best: Enemy | null = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (e === exclude || e.dead) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < bestDist && d < 250) { bestDist = d; best = e; }
  }
  return best;
}

function spawnHitParticles(particles: Particle[], x: number, y: number, element?: ElementType): void {
  const color = element ? ELEMENT_COLORS[element] : "#fff";
  // Element-colored sparks
  for (let i = 0; i < 8; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = randRange(60, 160);
    const life = randRange(0.2, 0.45);
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, maxLife: life, color, size: randRange(2, 5) });
  }
  // White flash core
  particles.push({ x, y, vx: 0, vy: 0, life: 0.1, maxLife: 0.1, color: "#fff", size: 8 });
}

function spawnDeathParticles(particles: Particle[], x: number, y: number, enemyType: string): void {
  const tmpl = ENEMY_TEMPLATES[enemyType] ?? BOSS_TEMPLATES[enemyType] ?? MINIBOSS_TEMPLATES[enemyType];
  const color = tmpl?.color ?? "#999";
  const isBoss = tmpl?.behavior?.startsWith("boss") || tmpl?.behavior === "miniboss";
  const count = isBoss ? 40 : 22;
  const maxSpd = isBoss ? 300 : 200;
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = randRange(40, maxSpd);
    const life = randRange(0.4, 0.9);
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life, maxLife: life, color, size: randRange(2, isBoss ? 10 : 6) });
  }
  // White flash particles
  for (let i = 0; i < 6; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = randRange(20, 80);
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.2, maxLife: 0.2, color: "#fff", size: randRange(4, 8) });
  }
  // Ember particles for bosses
  if (isBoss) {
    for (let i = 0; i < 15; i++) {
      const a = Math.random() * Math.PI * 2;
      const spd = randRange(20, 100);
      particles.push({ x: x + (Math.random() - 0.5) * 30, y: y + (Math.random() - 0.5) * 30, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - 60, life: 1.2, maxLife: 1.2, color: "#fbbf24", size: randRange(1, 3) });
    }
  }
}

function spawnExplosionParticles(particles: Particle[], x: number, y: number): void {
  for (let i = 0; i < 20; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = randRange(80, 250);
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd, life: 0.5, maxLife: 0.5, color: "#f97316", size: randRange(3, 8) });
  }
}
