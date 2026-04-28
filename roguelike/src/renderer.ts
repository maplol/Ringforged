import type {
  Enemy, Projectile, Particle, DamageNumber, XpOrb,
  PlayerState, Room, ComboEffect, Camera, Obstacle, DoorSide,
} from "./types";
import { ElementType } from "./types";
import {
  WALL_THICKNESS, DOOR_WIDTH, viewportW, viewportH,
  ELEMENT_COLORS, ENEMY_TEMPLATES, BOSS_TEMPLATES, MINIBOSS_TEMPLATES, PLAYER_RADIUS,
} from "./constants";

function resetShadow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowBlur = 0;
  ctx.shadowColor = "transparent";
}

// ============================
//    SPRITE LOADING SYSTEM
// ============================
const spriteCache = new Map<string, HTMLImageElement>();
const spriteLoading = new Set<string>();

function loadSprite(path: string): HTMLImageElement | null {
  const cached = spriteCache.get(path);
  if (cached && cached.complete && cached.naturalWidth > 0) return cached;
  if (spriteLoading.has(path)) return null;
  spriteLoading.add(path);
  const img = new Image();
  img.src = path;
  img.onload = () => { spriteCache.set(path, img); spriteLoading.delete(path); };
  img.onerror = () => { spriteLoading.delete(path); };
  return null;
}

const SPRITE_DIR = "/sprites/";

const PLAYER_SPRITE = SPRITE_DIR + "vlad_v2.png";

const ENEMY_SPRITE_MAP: Record<string, string> = {
  ignis_soldier: "ignis_soldier.png",
  ignis_archer: "ignis_archer.png",
  ignis_berserker: "ignis_berserker.png",
  ignis_sniper: "ignis_sniper.png",
  tektron_enforcer: "tektron_enforcer.png",
  tektron_drone: "tektron_drone.png",
  water_guardian: "water_guardian.png",
  aurumgard_guard: "aurumgard_guard.png",
  cultist: "cultist.png",
  cultist_tank: "cultist_tank.png",
  necromancer: "healer.png",
  marauder: "marauder.png",
  mercenary: "mercenary.png",
  smuggler: "smuggler.png",
  magnetist: "magnetist.png",
  illusionist: "illusionist.png",
  levitator: "levitator.png",
  bombardier: "bombardier.png",
  pirate: "pirate.png",
  ghost_mage: "ghost_mage.png",
  elite_cultist: "elite_cultist.png",
  elite_berserker: "elite_berserker.png",
  void_sentinel: "void_sentinel.png",
  iron_golem: "iron_golem.png",
};

const BOSS_SPRITE_MAP: Record<string, string> = {
  general: "boss_general.png",
  director_ignis: "boss_general.png",
  captain_dol: "boss_general.png",
  tyren_river: "water_guardian.png",
  ferrum_tektron: "tektron_enforcer.png",
  guard_captain_aurum: "aurumgard_guard.png",
  lord_port: "pirate.png",
  admiral_oblivion: "cultist_tank.png",
  morven: "boss_morven.png",
  kael: "boss_kael.png",
  surrogate_smith: "boss_kael.png",
};

const SPRITE_DEFAULT_FACING_LEFT = new Set([
  "ignis_soldier",
  "ignis_berserker",
  "ignis_sniper",
  "cultist_tank",
  "necromancer",
  "magnetist",
  "illusionist",
  "bombardier",
  "ghost_mage",
  "elite_berserker",
  "void_sentinel",
  "general",
  "director_ignis",
  "captain_dol",
  "admiral_oblivion",
]);

const PLAYER_SPRITE_DEFAULT_FACING_RIGHT = true;

function getEnemySprite(e: Enemy): HTMLImageElement | null {
  const fileName = ENEMY_SPRITE_MAP[e.type] ?? BOSS_SPRITE_MAP[e.type];
  if (!fileName) return null;
  return loadSprite(SPRITE_DIR + fileName);
}

function shouldFlipEnemy(enemyType: string, playerIsLeft: boolean): boolean {
  const defaultLeft = SPRITE_DEFAULT_FACING_LEFT.has(enemyType);
  if (defaultLeft) {
    return !playerIsLeft;
  }
  return playerIsLeft;
}

function drawSpriteAt(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  drawSize: number,
  bob: number,
  flipX: boolean,
) {
  ctx.save();
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(img, -drawSize / 2, -drawSize / 2 + bob, drawSize, drawSize);
  ctx.restore();
}

// ============================
//    SPRITESHEET ANIMATION
// ============================
interface SpritesheetDef {
  path: string;
  frameCount: number;
  frameW: number;
  frameH: number;
  fps: number;
  pingPong?: boolean;
}

const PLAYER_ANIMS: Record<string, SpritesheetDef> = {
  idle: { path: SPRITE_DIR + "vlad_idle.webp", frameCount: 4, frameW: 200, frameH: 200, fps: 8, pingPong: true },
  walk: { path: SPRITE_DIR + "vlad_walk.webp", frameCount: 6, frameW: 200, frameH: 200, fps: 10 },
  attack: { path: SPRITE_DIR + "vlad_attack.webp", frameCount: 4, frameW: 200, frameH: 200, fps: 12 },
};

const BOSS_IDLE_ANIMS: Record<string, SpritesheetDef> = {
  general: { path: SPRITE_DIR + "boss_general_idle.webp", frameCount: 4, frameW: 216, frameH: 216, fps: 8, pingPong: true },
  director_ignis: { path: SPRITE_DIR + "boss_general_idle.webp", frameCount: 4, frameW: 216, frameH: 216, fps: 8, pingPong: true },
  captain_dol: { path: SPRITE_DIR + "boss_general_idle.webp", frameCount: 4, frameW: 216, frameH: 216, fps: 8, pingPong: true },
  morven: { path: SPRITE_DIR + "boss_morven_idle.webp", frameCount: 4, frameW: 208, frameH: 208, fps: 8, pingPong: true },
  kael: { path: SPRITE_DIR + "boss_kael_idle.webp", frameCount: 4, frameW: 210, frameH: 210, fps: 8, pingPong: true },
  surrogate_smith: { path: SPRITE_DIR + "boss_kael_idle.webp", frameCount: 4, frameW: 210, frameH: 210, fps: 8, pingPong: true },
};

function drawSpritesheetFrame(
  ctx: CanvasRenderingContext2D,
  sheet: HTMLImageElement,
  def: SpritesheetDef,
  t: number,
  drawSize: number,
  bob: number,
  flipX: boolean,
) {
  const totalFrames = def.pingPong ? def.frameCount * 2 - 2 : def.frameCount;
  let idx = Math.floor(t * def.fps) % Math.max(totalFrames, 1);
  if (def.pingPong && idx >= def.frameCount) {
    idx = def.frameCount * 2 - 2 - idx;
  }
  const sx = idx * def.frameW;
  ctx.save();
  if (flipX) ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, 0, def.frameW, def.frameH, -drawSize / 2, -drawSize / 2 + bob, drawSize, drawSize);
  ctx.restore();
}

// preload all sprites on module init
[PLAYER_SPRITE,
  ...Object.values(ENEMY_SPRITE_MAP).map(f => SPRITE_DIR + f),
  ...Object.values(BOSS_SPRITE_MAP).map(f => SPRITE_DIR + f),
  ...Object.values(PLAYER_ANIMS).map(a => a.path),
  ...Object.values(BOSS_IDLE_ANIMS).map(a => a.path),
].forEach(p => loadSprite(p));

let _prevPlayerX = 0;
let _prevPlayerY = 0;
let _playerIsMoving = false;
let _playerFacingLeft = false;

export function renderFrame(
  ctx: CanvasRenderingContext2D,
  cam: Camera,
  player: PlayerState,
  enemies: Enemy[],
  projectiles: Projectile[],
  particles: Particle[],
  damageNumbers: DamageNumber[],
  xpOrbs: XpOrb[],
  room: Room | undefined,
  stageIndex: number,
  combo: ComboEffect | null,
  gameTime: number,
  enteredFrom: DoorSide | null,
  aimWorldX?: number,
  aimWorldY?: number,
): void {
  const dx = player.x - _prevPlayerX;
  const dy = player.y - _prevPlayerY;
  _playerIsMoving = dx * dx + dy * dy > 1;
  _prevPlayerX = player.x;
  _prevPlayerY = player.y;

  if (aimWorldX !== undefined) {
    _playerFacingLeft = aimWorldX < player.x;
  } else if (_playerIsMoving) {
    _playerFacingLeft = dx < -0.5;
  }

  ctx.clearRect(0, 0, viewportW, viewportH);
  ctx.save();
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x + (cam.shakeX ?? 0), -cam.y + (cam.shakeY ?? 0));

  drawRoom(ctx, room, stageIndex, gameTime);
  if (room) drawObstacles(ctx, room.obstacles, gameTime);
  drawXpOrbs(ctx, xpOrbs, gameTime);
  drawProjectiles(ctx, projectiles, gameTime);
  drawEnemies(ctx, enemies, player, gameTime);
  drawPlayer(ctx, player, gameTime);
  drawParticles(ctx, particles);
  drawDamageNumbers(ctx, damageNumbers);
  if (room && room.cleared) drawDoorArrows(ctx, player, room, enteredFrom, gameTime);

  ctx.restore();
}

// ============================
//         ROOM
// ============================
function drawRoom(ctx: CanvasRenderingContext2D, room: Room | undefined, _si: number, t: number): void {
  if (!room) return;
  const w = room.width;
  const h = room.height;
  const WT = WALL_THICKNESS;

  // Void behind walls
  ctx.fillStyle = "#050508";
  ctx.fillRect(0, 0, w, h);

  // Stone floor with detailed tiles
  const tileSize = 48;
  const floorX = WT;
  const floorY = WT;
  const floorW = w - WT * 2;
  const floorH = h - WT * 2;

  for (let tx = floorX; tx < floorX + floorW; tx += tileSize) {
    for (let ty = floorY; ty < floorY + floorH; ty += tileSize) {
      const tw = Math.min(tileSize, floorX + floorW - tx);
      const th = Math.min(tileSize, floorY + floorH - ty);
      const seed = (tx * 73 + ty * 137) % 256;
      const brightness = 22 + (seed % 8);
      ctx.fillStyle = `rgb(${brightness},${brightness},${brightness + 12})`;
      ctx.fillRect(tx, ty, tw, th);
      // Grout lines
      ctx.strokeStyle = `rgba(10,10,15,0.7)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(tx + 0.5, ty + 0.5, tw - 1, th - 1);
      // Random stone variation
      if (seed % 5 === 0) {
        ctx.fillStyle = `rgba(255,255,255,0.02)`;
        ctx.fillRect(tx + 4, ty + 4, tw - 8, th - 8);
      }
      if (seed % 7 === 0) {
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(tx + tw * 0.2, ty + th * 0.3);
        ctx.lineTo(tx + tw * 0.6, ty + th * 0.5);
        ctx.lineTo(tx + tw * 0.4, ty + th * 0.8);
        ctx.stroke();
      }
    }
  }

  // (vignette removed — dynamic lighting overlay handles darkness)

  // Stone brick walls
  drawBrickWall(ctx, 0, 0, w, WT, "h", t);
  drawBrickWall(ctx, 0, h - WT, w, WT, "h", t);
  drawBrickWall(ctx, 0, WT, WT, h - WT * 2, "v", t);
  drawBrickWall(ctx, w - WT, WT, WT, h - WT * 2, "v", t);

  // Wall inner shadow
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(WT, WT, floorW, 6);
  ctx.fillRect(WT, h - WT - 6, floorW, 6);
  ctx.fillRect(WT, WT, 6, floorH);
  ctx.fillRect(w - WT - 6, WT, 6, floorH);

  // Corner decorations
  drawCornerDeco(ctx, WT + 3, WT + 3);
  drawCornerDeco(ctx, w - WT - 3, WT + 3);
  drawCornerDeco(ctx, WT + 3, h - WT - 3);
  drawCornerDeco(ctx, w - WT - 3, h - WT - 3);

  const cx = w / 2;
  const cy = h / 2;

  // Doors
  if (room.doors.top) { drawDoor(ctx, cx - DOOR_WIDTH / 2, 0, DOOR_WIDTH, WT, room.cleared, "h", t); }
  if (room.doors.bottom) { drawDoor(ctx, cx - DOOR_WIDTH / 2, h - WT, DOOR_WIDTH, WT, room.cleared, "h", t); }
  if (room.doors.left) { drawDoor(ctx, 0, cy - DOOR_WIDTH / 2, WT, DOOR_WIDTH, room.cleared, "v", t); }
  if (room.doors.right) { drawDoor(ctx, w - WT, cy - DOOR_WIDTH / 2, WT, DOOR_WIDTH, room.cleared, "v", t); }

  // Torches at corners and beside doors
  const cornerOff = 40;
  drawTorch(ctx, WT + cornerOff, WT + 4, t, 0.1);
  drawTorch(ctx, w - WT - cornerOff, WT + 4, t, 0.7);
  drawTorch(ctx, WT + cornerOff, h - WT - 4, t, 1.3);
  drawTorch(ctx, w - WT - cornerOff, h - WT - 4, t, 1.9);
  drawTorch(ctx, WT + 4, WT + cornerOff, t, 2.5);
  drawTorch(ctx, WT + 4, h - WT - cornerOff, t, 3.1);
  drawTorch(ctx, w - WT - 4, WT + cornerOff, t, 3.7);
  drawTorch(ctx, w - WT - 4, h - WT - cornerOff, t, 4.3);
  if (room.doors.top) {
    drawTorch(ctx, cx - DOOR_WIDTH / 2 - 20, WT + 4, t, 5.0);
    drawTorch(ctx, cx + DOOR_WIDTH / 2 + 20, WT + 4, t, 5.5);
  }
  if (room.doors.bottom) {
    drawTorch(ctx, cx - DOOR_WIDTH / 2 - 20, h - WT - 4, t, 6.0);
    drawTorch(ctx, cx + DOOR_WIDTH / 2 + 20, h - WT - 4, t, 6.5);
  }
  if (room.doors.left) {
    drawTorch(ctx, WT + 4, cy - DOOR_WIDTH / 2 - 20, t, 7.0);
    drawTorch(ctx, WT + 4, cy + DOOR_WIDTH / 2 + 20, t, 7.5);
  }
  if (room.doors.right) {
    drawTorch(ctx, w - WT - 4, cy - DOOR_WIDTH / 2 - 20, t, 8.0);
    drawTorch(ctx, w - WT - 4, cy + DOOR_WIDTH / 2 + 20, t, 8.5);
  }

  // Hanging braziers / floor braziers in center
  if (floorW > 600 && floorH > 400 && (room.type === "normal" || room.type === "elite" || room.type === "event")) {
    drawBrazier(ctx, cx, cy, t, 0);
    if (floorW > 1000) {
      drawBrazier(ctx, cx - floorW * 0.25, cy, t, 1.5);
      drawBrazier(ctx, cx + floorW * 0.25, cy, t, 3.0);
    }
    if (floorH > 800) {
      drawBrazier(ctx, cx, cy - floorH * 0.25, t, 4.5);
      drawBrazier(ctx, cx, cy + floorH * 0.25, t, 6.0);
    }
  }
  if (room.type === "boss") {
    drawBrazier(ctx, cx, cy, t, 0);
    drawBrazier(ctx, cx - floorW * 0.3, cy - floorH * 0.3, t, 1.2);
    drawBrazier(ctx, cx + floorW * 0.3, cy - floorH * 0.3, t, 2.4);
    drawBrazier(ctx, cx - floorW * 0.3, cy + floorH * 0.3, t, 3.6);
    drawBrazier(ctx, cx + floorW * 0.3, cy + floorH * 0.3, t, 4.8);
  }
  if (room.type === "treasure") {
    drawBrazier(ctx, cx, cy, t, 7.0);
  }

  // Room type atmosphere
  if (room.type === "boss") {
    // Red ominous glow
    ctx.fillStyle = `rgba(127,29,29,${0.06 + Math.sin(t * 1.5) * 0.03})`;
    ctx.fillRect(WT, WT, floorW, floorH);
    // Pulsing border
    ctx.strokeStyle = `rgba(220,38,38,${0.2 + Math.sin(t * 2) * 0.1})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.lineDashOffset = t * 30;
    ctx.strokeRect(WT + 8, WT + 8, floorW - 16, floorH - 16);
    ctx.setLineDash([]);
    // Skull marks in corners
    drawSkullMark(ctx, WT + 40, WT + 40, t);
    drawSkullMark(ctx, w - WT - 40, WT + 40, t);
    drawSkullMark(ctx, WT + 40, h - WT - 40, t);
    drawSkullMark(ctx, w - WT - 40, h - WT - 40, t);
  }
  if (room.type === "treasure") {
    ctx.fillStyle = `rgba(251,191,36,${0.04 + Math.sin(t * 3) * 0.02})`;
    ctx.fillRect(WT, WT, floorW, floorH);
    // Golden sparkle particles
    for (let i = 0; i < 5; i++) {
      const sx = WT + 50 + Math.sin(t * 1.2 + i * 1.8) * (floorW * 0.4);
      const sy = WT + 50 + Math.cos(t * 0.9 + i * 2.3) * (floorH * 0.4);
      ctx.fillStyle = `rgba(251,191,36,${0.3 + Math.sin(t * 4 + i) * 0.2})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (room.type === "elite") {
    ctx.fillStyle = `rgba(120,53,15,${0.04 + Math.sin(t * 2) * 0.02})`;
    ctx.fillRect(WT, WT, floorW, floorH);
  }
  if (room.type === "event") {
    ctx.fillStyle = `rgba(74,222,128,${0.03 + Math.sin(t * 2.5) * 0.02})`;
    ctx.fillRect(WT, WT, floorW, floorH);
    const eventType = room.event?.type;
    if (room.event?.active) {
      const label = eventType === "altar" ? "⛩ АЛТАРЬ"
        : eventType === "merchant" ? "🏪 ТОРГОВЕЦ"
        : eventType === "trap" ? "⚠ ЛОВУШКА"
        : eventType === "chest" ? "📦 СУНДУК"
        : eventType === "speed_trial" ? "⏱ ИСПЫТАНИЕ" : "❓ СОБЫТИЕ";
      ctx.fillStyle = "#ccfbf1";
      ctx.font = "bold 16px 'Inter', sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.globalAlpha = 0.6 + Math.sin(t * 3) * 0.2;
      ctx.fillText(label, cx, cy - 50);
      ctx.globalAlpha = 1;
      const eventGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 80);
      eventGlow.addColorStop(0, "rgba(74,222,128,0.15)");
      eventGlow.addColorStop(1, "rgba(74,222,128,0)");
      ctx.fillStyle = eventGlow;
      ctx.beginPath(); ctx.arc(cx, cy, 80, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (room.type === "exit") {
    // Swirling portal in center
    ctx.save();
    ctx.translate(cx, cy);

    // Outer glow
    const portalR = 60 + Math.sin(t * 2) * 8;
    ctx.fillStyle = `rgba(45,212,191,${0.06 + Math.sin(t * 3) * 0.03})`;
    ctx.beginPath(); ctx.arc(0, 0, portalR + 40, 0, Math.PI * 2); ctx.fill();

    // Swirl rings
    for (let i = 0; i < 3; i++) {
      const ringR = portalR - i * 15;
      const alpha = 0.3 - i * 0.08;
      ctx.strokeStyle = `rgba(45,212,191,${alpha})`;
      ctx.lineWidth = 3 - i * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, ringR, t * (1.5 + i * 0.5), t * (1.5 + i * 0.5) + Math.PI * 1.5);
      ctx.stroke();
    }

    // Core
    const coreGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, portalR * 0.6);
    coreGrad.addColorStop(0, "rgba(45,212,191,0.4)");
    coreGrad.addColorStop(0.5, "rgba(20,184,166,0.15)");
    coreGrad.addColorStop(1, "rgba(45,212,191,0)");
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(0, 0, portalR * 0.6, 0, Math.PI * 2); ctx.fill();

    // Sparkles
    for (let i = 0; i < 6; i++) {
      const a = t * 2 + i * (Math.PI / 3);
      const sr = portalR * (0.5 + Math.sin(t * 4 + i) * 0.2);
      const sx = Math.cos(a) * sr;
      const sy = Math.sin(a) * sr;
      ctx.fillStyle = `rgba(204,251,241,${0.5 + Math.sin(t * 5 + i) * 0.3})`;
      ctx.beginPath(); ctx.arc(sx, sy, 2, 0, Math.PI * 2); ctx.fill();
    }

    // Label
    ctx.fillStyle = "#ccfbf1";
    ctx.font = "bold 14px 'Inter', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.globalAlpha = 0.7 + Math.sin(t * 3) * 0.2;
    ctx.fillText("▶ СЛЕДУЮЩИЙ ЭТАЖ", 0, portalR + 30);
    ctx.globalAlpha = 1;

    ctx.restore();
  }
}

function drawBrickWall(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, dir: "h" | "v", _t: number) {
  // Base wall
  const wallGrad = ctx.createLinearGradient(x, y, dir === "h" ? x : x + w, dir === "h" ? y + h : y);
  wallGrad.addColorStop(0, "#2a2a38");
  wallGrad.addColorStop(0.5, "#33333f");
  wallGrad.addColorStop(1, "#252530");
  ctx.fillStyle = wallGrad;
  ctx.fillRect(x, y, w, h);

  // Brick pattern
  const brickW = dir === "h" ? 24 : h;
  const brickH = dir === "h" ? h : 24;
  ctx.strokeStyle = "rgba(0,0,0,0.3)";
  ctx.lineWidth = 1;
  if (dir === "h") {
    for (let bx = x; bx < x + w; bx += brickW) {
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2); ctx.stroke();
  } else {
    for (let by = y; by < y + h; by += brickH) {
      ctx.beginPath(); ctx.moveTo(x, by); ctx.lineTo(x + w, by); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h); ctx.stroke();
  }

  // Top highlight
  ctx.fillStyle = "rgba(255,255,255,0.04)";
  ctx.fillRect(x, y, w, dir === "h" ? 2 : h);
  // Bottom shadow
  ctx.fillStyle = "rgba(0,0,0,0.2)";
  if (dir === "h") ctx.fillRect(x, y + h - 2, w, 2);
  else ctx.fillRect(x + w - 2, y, 2, h);
}

function drawDoor(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, open: boolean, dir: "h" | "v", t: number) {
  if (open) {
    // Open doorway with green glow
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 2, x + w / 2, y + h / 2, Math.max(w, h));
    glow.addColorStop(0, "rgba(74,222,128,0.3)");
    glow.addColorStop(0.5, "rgba(74,222,128,0.1)");
    glow.addColorStop(1, "rgba(74,222,128,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#1a2e1a";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    // Arrow
    ctx.fillStyle = `rgba(74,222,128,${0.5 + Math.sin(t * 4) * 0.2})`;
    ctx.beginPath();
    const acx = x + w / 2, acy = y + h / 2;
    const s = 7;
    if (dir === "h") {
      if (y < 20) { ctx.moveTo(acx, acy - s); ctx.lineTo(acx - s, acy + s * 0.5); ctx.lineTo(acx + s, acy + s * 0.5); }
      else { ctx.moveTo(acx, acy + s); ctx.lineTo(acx - s, acy - s * 0.5); ctx.lineTo(acx + s, acy - s * 0.5); }
    } else {
      if (x < 20) { ctx.moveTo(acx - s, acy); ctx.lineTo(acx + s * 0.5, acy - s); ctx.lineTo(acx + s * 0.5, acy + s); }
      else { ctx.moveTo(acx + s, acy); ctx.lineTo(acx - s * 0.5, acy - s); ctx.lineTo(acx - s * 0.5, acy + s); }
    }
    ctx.closePath(); ctx.fill();
  } else {
    // Locked door: iron bars
    ctx.fillStyle = "#12121a";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "#3a3a4a";
    ctx.lineWidth = 3;
    if (dir === "h") {
      for (let bx = x + 12; bx < x + w - 8; bx += 15) {
        ctx.beginPath(); ctx.moveTo(bx, y + 2); ctx.lineTo(bx, y + h - 2); ctx.stroke();
      }
    } else {
      for (let by = y + 12; by < y + h - 8; by += 15) {
        ctx.beginPath(); ctx.moveTo(x + 2, by); ctx.lineTo(x + w - 2, by); ctx.stroke();
      }
    }
  }
}

function drawTorch(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number) {
  // Bracket
  ctx.fillStyle = "#555568";
  ctx.fillRect(x - 1.5, y - 2, 3, 6);
  // Flame
  const flicker = Math.sin(t * 8 + seed) * 1.5;
  const flicker2 = Math.cos(t * 11 + seed * 2) * 1;
  // Glow
  const glowR = 35 + Math.sin(t * 6 + seed) * 8;
  const glow = ctx.createRadialGradient(x + flicker2, y - 4, 1, x, y - 2, glowR);
  glow.addColorStop(0, "rgba(251,191,36,0.12)");
  glow.addColorStop(0.5, "rgba(234,88,12,0.04)");
  glow.addColorStop(1, "rgba(234,88,12,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y - 2, glowR, 0, Math.PI * 2); ctx.fill();
  // Flame body
  ctx.fillStyle = `rgba(251,146,60,${0.8 + Math.sin(t * 7 + seed) * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 8 + flicker);
  ctx.quadraticCurveTo(x + 3 + flicker2, y - 5, x + 2.5, y);
  ctx.lineTo(x - 2.5, y);
  ctx.quadraticCurveTo(x - 3 - flicker2, y - 5, x, y - 8 + flicker);
  ctx.fill();
  // Inner flame
  ctx.fillStyle = `rgba(254,215,170,${0.6 + Math.sin(t * 10 + seed) * 0.2})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 6 + flicker * 0.7);
  ctx.quadraticCurveTo(x + 1.5 + flicker2 * 0.5, y - 3.5, x + 1.2, y);
  ctx.lineTo(x - 1.2, y);
  ctx.quadraticCurveTo(x - 1.5 - flicker2 * 0.5, y - 3.5, x, y - 6 + flicker * 0.7);
  ctx.fill();
}

function drawBrazier(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, seed: number) {
  const flicker = Math.sin(t * 7 + seed) * 1.5;
  const flicker2 = Math.cos(t * 10 + seed * 1.7) * 1;

  // Ground glow
  const glowR = 55 + Math.sin(t * 5 + seed) * 10;
  const glow = ctx.createRadialGradient(x, y, 2, x, y, glowR);
  glow.addColorStop(0, "rgba(251,191,36,0.09)");
  glow.addColorStop(0.4, "rgba(234,88,12,0.04)");
  glow.addColorStop(1, "rgba(234,88,12,0)");
  ctx.fillStyle = glow;
  ctx.beginPath(); ctx.arc(x, y, glowR, 0, Math.PI * 2); ctx.fill();

  // Base — iron bowl
  ctx.fillStyle = "#3a3a42";
  ctx.beginPath();
  ctx.moveTo(x - 8, y + 2);
  ctx.lineTo(x - 6, y - 4);
  ctx.lineTo(x + 6, y - 4);
  ctx.lineTo(x + 8, y + 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#555";
  ctx.lineWidth = 0.5;
  ctx.stroke();

  // Legs
  ctx.fillStyle = "#2a2a30";
  ctx.fillRect(x - 7, y + 2, 2, 4);
  ctx.fillRect(x + 5, y + 2, 2, 4);

  // Coals glow
  ctx.fillStyle = `rgba(234,88,12,${0.6 + Math.sin(t * 8 + seed) * 0.2})`;
  ctx.beginPath();
  ctx.ellipse(x, y - 3, 5, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Flames
  ctx.fillStyle = `rgba(251,146,60,${0.75 + Math.sin(t * 6 + seed) * 0.15})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 14 + flicker);
  ctx.quadraticCurveTo(x + 4 + flicker2, y - 8, x + 3, y - 3);
  ctx.lineTo(x - 3, y - 3);
  ctx.quadraticCurveTo(x - 4 - flicker2, y - 8, x, y - 14 + flicker);
  ctx.fill();

  // Inner bright flame
  ctx.fillStyle = `rgba(254,215,170,${0.5 + Math.sin(t * 9 + seed) * 0.2})`;
  ctx.beginPath();
  ctx.moveTo(x, y - 11 + flicker * 0.6);
  ctx.quadraticCurveTo(x + 2 + flicker2 * 0.4, y - 7, x + 1.5, y - 3);
  ctx.lineTo(x - 1.5, y - 3);
  ctx.quadraticCurveTo(x - 2 - flicker2 * 0.4, y - 7, x, y - 11 + flicker * 0.6);
  ctx.fill();

  // Sparks
  for (let i = 0; i < 2; i++) {
    const sparkT = (t * 3 + seed + i * 2.1) % 3;
    if (sparkT < 1.5) {
      const sy = y - 14 - sparkT * 12;
      const sx = x + Math.sin(sparkT * 4 + i * 1.5 + seed) * 5;
      ctx.fillStyle = `rgba(251,191,36,${0.7 - sparkT * 0.45})`;
      ctx.beginPath(); ctx.arc(sx, sy, 0.8, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawCornerDeco(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.strokeStyle = "rgba(100,100,120,0.2)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(x, y, 8, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(x, y, 3, 0, Math.PI * 2);
  ctx.stroke();
}

function drawSkullMark(ctx: CanvasRenderingContext2D, x: number, y: number, t: number) {
  ctx.globalAlpha = 0.12 + Math.sin(t * 2 + x * 0.1) * 0.05;
  ctx.fillStyle = "#dc2626";
  ctx.font = "bold 20px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("☠", x, y);
  ctx.globalAlpha = 1;
}

// ============================
//        OBSTACLES
// ============================
function drawObstacles(ctx: CanvasRenderingContext2D, obstacles: Obstacle[], t: number): void {
  for (const obs of obstacles) {
    if (obs.destroyed) continue;
    ctx.save();
    ctx.translate(obs.x, obs.y);

    switch (obs.type) {
      case "pillar": {
        const r = obs.radius;
        // Shadow at base
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 1.1, r * 0.4, 0, 0, Math.PI * 2); ctx.fill();
        // Column base (wider)
        ctx.fillStyle = "#484858";
        ctx.beginPath();
        ctx.moveTo(-r * 1.1, r * 0.15);
        ctx.lineTo(-r * 0.9, -r * 0.9);
        ctx.lineTo(r * 0.9, -r * 0.9);
        ctx.lineTo(r * 1.1, r * 0.15);
        ctx.closePath();
        ctx.fill();
        // Stone texture gradient
        const g = ctx.createLinearGradient(-r, 0, r, 0);
        g.addColorStop(0, "#3a3a4a");
        g.addColorStop(0.3, "#5a5a6a");
        g.addColorStop(0.7, "#5a5a6a");
        g.addColorStop(1, "#3a3a4a");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(-r * 0.85, r * 0.1);
        ctx.lineTo(-r * 0.75, -r * 0.85);
        ctx.lineTo(r * 0.75, -r * 0.85);
        ctx.lineTo(r * 0.85, r * 0.1);
        ctx.closePath();
        ctx.fill();
        // Highlight
        ctx.fillStyle = "rgba(255,255,255,0.05)";
        ctx.fillRect(-r * 0.2, -r * 0.8, r * 0.3, r * 0.85);
        // Top cap
        ctx.fillStyle = "#555568";
        ctx.fillRect(-r * 0.9, -r * 0.95, r * 1.8, r * 0.12);
        // Cracks
        ctx.strokeStyle = "rgba(20,20,30,0.4)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(-r * 0.3, -r * 0.6);
        ctx.lineTo(r * 0.05, -r * 0.1);
        ctx.lineTo(-r * 0.15, r * 0.05);
        ctx.stroke();
        break;
      }
      case "barrel": {
        const r = obs.radius;
        // Shadow
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.9, r * 0.35, 0, 0, Math.PI * 2); ctx.fill();
        // Barrel body (wooden gradient)
        const bGrad = ctx.createLinearGradient(-r, 0, r, 0);
        bGrad.addColorStop(0, "#6b3410");
        bGrad.addColorStop(0.3, "#a85820");
        bGrad.addColorStop(0.5, "#b8682a");
        bGrad.addColorStop(0.7, "#a85820");
        bGrad.addColorStop(1, "#6b3410");
        ctx.fillStyle = bGrad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        // Wood planks
        ctx.strokeStyle = "rgba(50,20,5,0.3)";
        ctx.lineWidth = 1;
        for (let i = -2; i <= 2; i++) {
          const lx = i * r * 0.35;
          ctx.beginPath(); ctx.moveTo(lx, -r * 0.9); ctx.lineTo(lx, r * 0.9); ctx.stroke();
        }
        // Metal bands
        ctx.strokeStyle = "#78716c";
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.55, 0, Math.PI * 2); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.88, 0, Math.PI * 2); ctx.stroke();
        // Band highlights
        ctx.strokeStyle = "rgba(255,255,255,0.08)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, r * 0.55, -0.5, 0.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(0, 0, r * 0.88, -0.5, 0.5); ctx.stroke();
        // Explosive warning
        ctx.fillStyle = "rgba(251,191,36,0.8)";
        ctx.font = `bold ${r * 0.7}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 1);
        // HP bar
        if (obs.hp < obs.maxHp) {
          const barW = r * 2.5;
          ctx.fillStyle = "rgba(0,0,0,0.6)"; ctx.fillRect(-barW / 2, -r - 12, barW, 5);
          ctx.fillStyle = "#f97316"; ctx.fillRect(-barW / 2, -r - 12, barW * (obs.hp / obs.maxHp), 5);
          ctx.strokeStyle = "rgba(0,0,0,0.4)"; ctx.lineWidth = 0.5; ctx.strokeRect(-barW / 2, -r - 12, barW, 5);
        }
        break;
      }
      case "lava": {
        drawLavaCrack(ctx, obs.radius, t, obs.x, obs.y);
        break;
      }
      case "crystal": {
        const r = obs.radius;
        const color = obs.element ? ELEMENT_COLORS[obs.element] : "#8b5cf6";
        // Ground glow
        const glowR = r * 2 + Math.sin(t * 3 + obs.x * 0.1) * r * 0.3;
        const gGlow = ctx.createRadialGradient(0, r * 0.2, 0, 0, r * 0.2, glowR);
        gGlow.addColorStop(0, hexToRgba(color, 0.12));
        gGlow.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = gGlow;
        ctx.beginPath(); ctx.arc(0, r * 0.2, glowR, 0, Math.PI * 2); ctx.fill();

        ctx.shadowColor = color;
        ctx.shadowBlur = 12 + Math.sin(t * 4 + obs.x * 0.1) * 6;
        // Main crystal body
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(0, -r * 1.4);
        ctx.lineTo(r * 0.45, -r * 0.4);
        ctx.lineTo(r * 0.65, r * 0.35);
        ctx.lineTo(r * 0.2, r * 0.8);
        ctx.lineTo(-r * 0.2, r * 0.8);
        ctx.lineTo(-r * 0.65, r * 0.35);
        ctx.lineTo(-r * 0.45, -r * 0.4);
        ctx.closePath();
        ctx.fill();
        // Side shard
        ctx.globalAlpha = 0.65;
        ctx.beginPath();
        ctx.moveTo(r * 0.3, -r * 0.6);
        ctx.lineTo(r * 0.8, -r * 0.9);
        ctx.lineTo(r * 0.6, -r * 0.2);
        ctx.closePath();
        ctx.fill();
        // Inner light facets
        ctx.globalAlpha = 0.2;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, -r * 1.2);
        ctx.lineTo(r * 0.15, -r * 0.5);
        ctx.lineTo(-r * 0.3, -r * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        break;
      }
    }
    ctx.restore();
  }
}

// ============================
//     LAVA CRACK (RIFT)
// ============================
function drawLavaCrack(ctx: CanvasRenderingContext2D, radius: number, t: number, seedX: number, seedY: number) {
  const seed = seedX * 73.37 + seedY * 91.17;
  const seededRand = (i: number) => ((Math.sin(seed + i * 127.1) * 43758.5453) % 1 + 1) % 1;

  // Dark scorched ground around the crack
  ctx.fillStyle = `rgba(50,20,10,${0.5 + Math.sin(t * 1.5 + seed) * 0.08})`;
  ctx.beginPath();
  const crackLen = radius * 2.2;
  const crackW = radius * 0.7;
  const baseAngle = seededRand(0) * Math.PI;
  ctx.save();
  ctx.rotate(baseAngle);

  // Jagged scorched area
  ctx.beginPath();
  const pts = 10;
  for (let i = 0; i <= pts; i++) {
    const frac = i / pts;
    const lx = -crackLen / 2 + crackLen * frac;
    const jag = (seededRand(i + 10) - 0.5) * crackW * 0.6;
    const wy = crackW * (0.6 + seededRand(i + 20) * 0.4) + Math.sin(frac * Math.PI) * crackW * 0.3;
    if (i === 0) ctx.moveTo(lx, -wy + jag);
    else ctx.lineTo(lx, -wy + jag);
  }
  for (let i = pts; i >= 0; i--) {
    const frac = i / pts;
    const lx = -crackLen / 2 + crackLen * frac;
    const jag = (seededRand(i + 30) - 0.5) * crackW * 0.6;
    const wy = crackW * (0.6 + seededRand(i + 40) * 0.4) + Math.sin(frac * Math.PI) * crackW * 0.3;
    ctx.lineTo(lx, wy + jag);
  }
  ctx.closePath();
  ctx.fill();

  // Main lava crack — jagged bright line
  const crackSegs = 8;
  const mainW = radius * 0.22;
  ctx.shadowColor = "#f97316";
  ctx.shadowBlur = 8 + Math.sin(t * 3 + seed) * 3;

  // Outer glow stroke
  ctx.strokeStyle = `rgba(234,88,12,${0.5 + Math.sin(t * 2.5 + seed) * 0.15})`;
  ctx.lineWidth = mainW * 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= crackSegs; i++) {
    const frac = i / crackSegs;
    const lx = -crackLen / 2 + crackLen * frac;
    const jag = (seededRand(i + 50) - 0.5) * crackW * 0.5 + Math.sin(t * 1.5 + i * 1.3) * 2;
    if (i === 0) ctx.moveTo(lx, jag); else ctx.lineTo(lx, jag);
  }
  ctx.stroke();

  // Inner bright core
  ctx.strokeStyle = `rgba(251,146,60,${0.7 + Math.sin(t * 3.5 + seed) * 0.2})`;
  ctx.lineWidth = mainW;
  ctx.beginPath();
  for (let i = 0; i <= crackSegs; i++) {
    const frac = i / crackSegs;
    const lx = -crackLen / 2 + crackLen * frac;
    const jag = (seededRand(i + 50) - 0.5) * crackW * 0.5 + Math.sin(t * 1.5 + i * 1.3) * 2;
    if (i === 0) ctx.moveTo(lx, jag); else ctx.lineTo(lx, jag);
  }
  ctx.stroke();

  // Hottest center line
  ctx.strokeStyle = `rgba(254,215,170,${0.5 + Math.sin(t * 4 + seed) * 0.2})`;
  ctx.lineWidth = mainW * 0.35;
  ctx.beginPath();
  for (let i = 0; i <= crackSegs; i++) {
    const frac = i / crackSegs;
    const lx = -crackLen / 2 + crackLen * frac;
    const jag = (seededRand(i + 50) - 0.5) * crackW * 0.5 + Math.sin(t * 1.5 + i * 1.3) * 2;
    if (i === 0) ctx.moveTo(lx, jag); else ctx.lineTo(lx, jag);
  }
  ctx.stroke();

  ctx.shadowBlur = 0;

  // Branch cracks
  for (let b = 0; b < 3; b++) {
    const bFrac = 0.2 + seededRand(b + 60) * 0.6;
    const bx = -crackLen / 2 + crackLen * bFrac;
    const mainJag = (seededRand(Math.floor(bFrac * crackSegs) + 50) - 0.5) * crackW * 0.5;
    const bAngle = (seededRand(b + 70) - 0.5) * 1.5;
    const bLen = radius * (0.3 + seededRand(b + 80) * 0.4);

    ctx.strokeStyle = `rgba(234,88,12,${0.35 + Math.sin(t * 3 + b * 2) * 0.1})`;
    ctx.lineWidth = mainW * 0.6;
    ctx.beginPath();
    ctx.moveTo(bx, mainJag);
    const bex = bx + Math.cos(bAngle + Math.PI / 2) * bLen;
    const bey = mainJag + Math.sin(bAngle + Math.PI / 2) * bLen;
    const bmx = (bx + bex) / 2 + (seededRand(b + 90) - 0.5) * radius * 0.2;
    const bmy = (mainJag + bey) / 2 + (seededRand(b + 95) - 0.5) * radius * 0.2;
    ctx.quadraticCurveTo(bmx, bmy, bex, bey);
    ctx.stroke();
  }

  // Embers / sparks
  for (let i = 0; i < 4; i++) {
    const eFrac = seededRand(i + 100);
    const ex = -crackLen / 2 + crackLen * eFrac;
    const ey = (seededRand(i + 110) - 0.5) * crackW * 0.4;
    const eUp = Math.sin(t * 4 + i * 1.7 + seed) * 4 - 3;
    const eAlpha = 0.4 + Math.sin(t * 6 + i * 2.3) * 0.3;
    ctx.fillStyle = `rgba(251,191,36,${eAlpha})`;
    ctx.beginPath(); ctx.arc(ex, ey + eUp, 1.5 + Math.sin(t * 5 + i) * 0.5, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ============================
//        PLAYER
// ============================
// ============================
//    DYNAMIC SHADOW SYSTEM
// ============================
export interface LightSource {
  x: number;
  y: number;
  radius: number;
  intensity: number;
}

let _cachedLights: LightSource[] = [];
let _cachedLightsRoomKey = "";

export function collectLightSources(room: Room): LightSource[] {
  let aliveCount = 0;
  for (const o of room.obstacles) if (!o.destroyed) aliveCount++;
  const key = `${room.width},${room.height},${aliveCount}`;
  if (key === _cachedLightsRoomKey && _cachedLights.length > 0) return _cachedLights;
  _cachedLightsRoomKey = key;

  const lights: LightSource[] = [];
  const w = room.width;
  const h = room.height;
  const WT = WALL_THICKNESS;
  const cx = w / 2;
  const cy = h / 2;
  const cornerOff = 40;
  const TORCH_R = 220;
  const TORCH_I = 0.8;

  lights.push({ x: WT + cornerOff, y: WT + 4, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: w - WT - cornerOff, y: WT + 4, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: WT + cornerOff, y: h - WT - 4, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: w - WT - cornerOff, y: h - WT - 4, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: WT + 4, y: WT + cornerOff, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: WT + 4, y: h - WT - cornerOff, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: w - WT - 4, y: WT + cornerOff, radius: TORCH_R, intensity: TORCH_I });
  lights.push({ x: w - WT - 4, y: h - WT - cornerOff, radius: TORCH_R, intensity: TORCH_I });

  if (room.doors.top) {
    lights.push({ x: cx - DOOR_WIDTH / 2 - 20, y: WT + 4, radius: TORCH_R, intensity: TORCH_I });
    lights.push({ x: cx + DOOR_WIDTH / 2 + 20, y: WT + 4, radius: TORCH_R, intensity: TORCH_I });
  }
  if (room.doors.bottom) {
    lights.push({ x: cx - DOOR_WIDTH / 2 - 20, y: h - WT - 4, radius: TORCH_R, intensity: TORCH_I });
    lights.push({ x: cx + DOOR_WIDTH / 2 + 20, y: h - WT - 4, radius: TORCH_R, intensity: TORCH_I });
  }
  if (room.doors.left) {
    lights.push({ x: WT + 4, y: cy - DOOR_WIDTH / 2 - 20, radius: TORCH_R, intensity: TORCH_I });
    lights.push({ x: WT + 4, y: cy + DOOR_WIDTH / 2 + 20, radius: TORCH_R, intensity: TORCH_I });
  }
  if (room.doors.right) {
    lights.push({ x: w - WT - 4, y: cy - DOOR_WIDTH / 2 - 20, radius: TORCH_R, intensity: TORCH_I });
    lights.push({ x: w - WT - 4, y: cy + DOOR_WIDTH / 2 + 20, radius: TORCH_R, intensity: TORCH_I });
  }

  // Ambient ceiling lights / hanging braziers in larger rooms
  const floorW = w - WT * 2;
  const floorH = h - WT * 2;
  const AMBIENT_R = 280;
  const AMBIENT_I = 0.6;
  if (floorW > 600 && floorH > 400) {
    if (room.type === "normal" || room.type === "elite" || room.type === "event") {
      lights.push({ x: cx, y: cy, radius: AMBIENT_R, intensity: AMBIENT_I });
    }
    if (floorW > 1000) {
      lights.push({ x: cx - floorW * 0.25, y: cy, radius: AMBIENT_R * 0.8, intensity: AMBIENT_I * 0.7 });
      lights.push({ x: cx + floorW * 0.25, y: cy, radius: AMBIENT_R * 0.8, intensity: AMBIENT_I * 0.7 });
    }
    if (floorH > 800) {
      lights.push({ x: cx, y: cy - floorH * 0.25, radius: AMBIENT_R * 0.7, intensity: AMBIENT_I * 0.6 });
      lights.push({ x: cx, y: cy + floorH * 0.25, radius: AMBIENT_R * 0.7, intensity: AMBIENT_I * 0.6 });
    }
  }

  if (room.type === "boss") {
    lights.push({ x: cx, y: cy, radius: 350, intensity: 0.7 });
    lights.push({ x: cx - floorW * 0.3, y: cy - floorH * 0.3, radius: 200, intensity: 0.5 });
    lights.push({ x: cx + floorW * 0.3, y: cy - floorH * 0.3, radius: 200, intensity: 0.5 });
    lights.push({ x: cx - floorW * 0.3, y: cy + floorH * 0.3, radius: 200, intensity: 0.5 });
    lights.push({ x: cx + floorW * 0.3, y: cy + floorH * 0.3, radius: 200, intensity: 0.5 });
  }

  if (room.type === "treasure") {
    lights.push({ x: cx, y: cy, radius: 200, intensity: 0.9 });
  }

  for (const obs of room.obstacles) {
    if (obs.destroyed) continue;
    if (obs.type === "lava") {
      lights.push({ x: obs.x, y: obs.y, radius: 200, intensity: 0.9 });
    } else if (obs.type === "crystal") {
      lights.push({ x: obs.x, y: obs.y, radius: 160, intensity: 0.6 });
    } else if (obs.type === "barrel") {
      lights.push({ x: obs.x, y: obs.y, radius: 80, intensity: 0.3 });
    }
  }

  if (room.type === "exit") {
    lights.push({ x: cx, y: cy, radius: 350, intensity: 1.0 });
  }

  _cachedLights = lights;
  return lights;
}


function drawPlayer(ctx: CanvasRenderingContext2D, p: PlayerState, t: number): void {
  ctx.save();
  ctx.translate(p.x, p.y);

  const activeElement = p.rings.find(r => r !== null)?.element;
  const glowColor = activeElement ? ELEMENT_COLORS[activeElement] : "#2dd4bf";

  const flipX = _playerFacingLeft;

  // Dash trail afterimages
  if (p.isDashing) {
    const sprite = loadSprite(PLAYER_SPRITE);
    if (sprite) {
      ctx.globalAlpha = 0.12;
      drawSpriteAt(ctx, sprite, 42, 0, flipX);
      ctx.globalAlpha = 0.06;
      ctx.save();
      ctx.translate(-p.dashVx * 0.03, -p.dashVy * 0.03);
      drawSpriteAt(ctx, sprite, 40, 0, flipX);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  // Animated sprite (idle / walk / attack)
  const isAttacking = p.attackAnim > 0;
  const isMoving = p.isDashing || _playerIsMoving;
  const animKey = isAttacking ? "attack" : isMoving ? "walk" : "idle";
  const animDef = PLAYER_ANIMS[animKey];
  const animSheet = animDef ? loadSprite(animDef.path) : null;
  if (animSheet && animDef) {
    drawSpritesheetFrame(ctx, animSheet, animDef, t, 44, 0, flipX);
  } else {
    const playerSprite = loadSprite(PLAYER_SPRITE);
    if (playerSprite) {
      drawSpriteAt(ctx, playerSprite, 44, 0, flipX);
    } else {
      ctx.fillStyle = "#334155";
      ctx.beginPath(); ctx.arc(0, 0, PLAYER_RADIUS, 0, Math.PI * 2); ctx.fill();
    }
  }

  // Orbiting element rings
  const ringCount = p.rings.filter(r => r !== null).length;
  if (ringCount > 0) {
    const step = (Math.PI * 2) / ringCount;
    let idx = 0;
    for (const ring of p.rings) {
      if (!ring) continue;
      const angle = t * 1.5 + step * idx;
      const rx = Math.cos(angle) * 26;
      const ry = Math.sin(angle) * 26;
      const rc = ELEMENT_COLORS[ring.element];
      ctx.fillStyle = rc;
      ctx.shadowColor = rc;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.arc(rx, ry, 3 + ring.level * 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.5;
      ctx.stroke();
      ctx.shadowBlur = 0;
      idx++;
    }
  }

  // Invincibility shield / damage flash
  if (p.invincibleTimer > 0) {
    const alpha = Math.min(1, p.invincibleTimer * 2);
    if (p.invincibleTimer > 0.35) {
      ctx.fillStyle = `rgba(239,68,68,${(p.invincibleTimer - 0.35) * 2})`;
      ctx.beginPath(); ctx.arc(0, 0, 22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 24 + Math.sin(t * 12) * 1, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = `rgba(45,212,191,${alpha * 0.2})`;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(0, 0, 27, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.restore();
}

// ============================
//        ENEMIES
// ============================
function drawEnemies(ctx: CanvasRenderingContext2D, enemies: Enemy[], player: PlayerState, t: number): void {
  for (const e of enemies) {
    if (e.dead) continue;
    const tmpl = ENEMY_TEMPLATES[e.type] ?? BOSS_TEMPLATES[e.type] ?? MINIBOSS_TEMPLATES[e.type];
    const color = tmpl?.color ?? "#999";
    const glow = tmpl?.glowColor;

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.stunTimer > 0) ctx.globalAlpha = 0.5 + Math.sin(t * 20) * 0.3;
    if (e.slowTimer > 0) { ctx.shadowColor = "#60a5fa"; ctx.shadowBlur = 8; }
    if (e.burnTimer > 0) { ctx.shadowColor = "#f87171"; ctx.shadowBlur = 10; }

    const isBoss = e.behavior.startsWith("boss");

    // Hit flash — shift position slightly
    const isHit = e.hitFlash > 0;
    if (isHit) {
      ctx.translate((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3);
    }

    const playerIsLeft = player.x < e.x;
    const enemyFlipX = shouldFlipEnemy(e.type, playerIsLeft);

    // Try animated spritesheet for bosses, then static sprite, then procedural
    const bossAnim = isBoss ? BOSS_IDLE_ANIMS[e.type] : undefined;
    const bossAnimSheet = bossAnim ? loadSprite(bossAnim.path) : null;
    const sprite = getEnemySprite(e);
    const spriteSize = isBoss ? e.radius * 3.5 : e.radius * 2.8;
    if (bossAnimSheet && bossAnim) {
      drawSpritesheetFrame(ctx, bossAnimSheet, bossAnim, t, spriteSize, 0, enemyFlipX);
    } else if (sprite) {
      drawSpriteAt(ctx, sprite, spriteSize, 0, enemyFlipX);
    } else {
      const beh = e.behavior;
      if (beh === "chase") drawChaseEnemy(ctx, e, color, t);
      else if (beh === "shooter" || beh === "sniper") drawShooterEnemy(ctx, e, color, glow, t);
      else if (beh === "dasher") drawDasherEnemy(ctx, e, color, t);
      else if (beh === "tank") drawTankEnemy(ctx, e, color, glow, t);
      else if (beh === "bomber") drawBomberEnemy(ctx, e, color, glow, t);
      else if (beh === "healer") drawHealerEnemy(ctx, e, color, glow, t);
      else if (beh === "summoner") drawSummonerEnemy(ctx, e, color, glow, t);
      else if (beh === "teleporter") drawTeleporterEnemy(ctx, e, color, glow, t);
      else if (beh === "miniboss") drawMinibossEnemy(ctx, e, color, glow, t);
      else if (beh.startsWith("boss")) drawBossEnemy(ctx, e, color, glow, t);
    }

    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;

    // Hit flash white overlay
    if (isHit) {
      const sz = isBoss ? e.radius * 2 : e.radius * 1.5;
      ctx.globalCompositeOperation = "source-atop";
      ctx.fillStyle = `rgba(255,255,255,${e.hitFlash * 5})`;
      ctx.fillRect(-sz, -sz, sz * 2, sz * 2);
      ctx.globalCompositeOperation = "source-over";
    }

    // HP bar
    const hpRatio = e.hp / e.maxHp;
    if (hpRatio < 1) {
      const barW = Math.max(e.radius * 2, 24);
      const barY = -e.radius - 12;
      ctx.fillStyle = "#1a1a1a";
      ctx.fillRect(-barW / 2 - 1, barY - 1, barW + 2, 5);
      ctx.fillStyle = hpRatio > 0.5 ? "#4ade80" : hpRatio > 0.25 ? "#fbbf24" : "#f87171";
      ctx.fillRect(-barW / 2, barY, barW * hpRatio, 3);
    }

    // Dash trail
    if (e.isDashing) {
      ctx.strokeStyle = "rgba(255,50,50,0.35)";
      ctx.lineWidth = 2;
      ctx.setLineDash([3, 3]);
      ctx.beginPath(); ctx.arc(0, 0, e.radius + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
    }

    ctx.restore();
  }
}

// --- CHASE (soldier): humanoid with helmet and sword ---
function drawChaseEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, t: number) {
  const r = e.radius;
  const bob = Math.sin(t * 5) * 1;
  const atkProg = Math.min(1, (e.attackAnim ?? 0) / 0.25);
  // Body
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.45, -r * 0.2 + bob, r * 0.9, r * 1.1);
  // Legs
  ctx.fillStyle = darken(color, 30);
  const legSpread = Math.sin(t * 6) * 2;
  ctx.fillRect(-r * 0.35 + legSpread, r * 0.8 + bob, r * 0.25, r * 0.5);
  ctx.fillRect(r * 0.1 - legSpread, r * 0.8 + bob, r * 0.25, r * 0.5);
  // Arm with sword (attack = swing forward)
  ctx.save();
  ctx.translate(r * 0.5, -r * 0.1 + bob);
  ctx.rotate(0.2 + Math.sin(t * 4) * 0.15 - atkProg * 1.2);
  ctx.fillStyle = darken(color, 20);
  ctx.fillRect(-2, 0, 4, r * 0.7);
  // Sword
  ctx.fillStyle = "#d4d4d8";
  ctx.fillRect(-1, r * 0.6, 2, r * 0.8 + atkProg * r * 0.3);
  ctx.fillStyle = "#fbbf24";
  ctx.fillRect(-3, r * 0.55, 6, 3);
  ctx.restore();
  // Attack swing arc indicator
  if (atkProg > 0.3) {
    ctx.strokeStyle = `rgba(255,255,255,${atkProg * 0.3})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, bob, r * 1.4, -0.8, 0.3);
    ctx.stroke();
  }
  // Head with helmet
  ctx.fillStyle = "#d4d4d4";
  ctx.beginPath(); ctx.arc(0, -r * 0.5 + bob, r * 0.45, 0, Math.PI * 2); ctx.fill();
  // Helmet
  ctx.fillStyle = darken(color, 15);
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.45 + bob);
  ctx.lineTo(0, -r * 1.0 + bob);
  ctx.lineTo(r * 0.5, -r * 0.45 + bob);
  ctx.closePath();
  ctx.fill();
  // Eyes (glow brighter when attacking)
  ctx.fillStyle = atkProg > 0 ? "#fbbf24" : "#ef4444";
  ctx.shadowColor = atkProg > 0 ? "#fbbf24" : "#ef4444";
  ctx.shadowBlur = atkProg > 0 ? 5 : 0;
  ctx.beginPath();
  ctx.arc(-r * 0.15, -r * 0.55 + bob, 1.5, 0, Math.PI * 2);
  ctx.arc(r * 0.15, -r * 0.55 + bob, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// --- SHOOTER (archer/cultist): hooded figure with staff ---
function drawShooterEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const bob = Math.sin(t * 3) * 0.8;
  const atkProg = Math.min(1, (e.attackAnim ?? 0) / 0.3);
  // Robe body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.3 + bob);
  ctx.lineTo(-r * 0.6, r * 1.1 + bob);
  ctx.lineTo(r * 0.6, r * 1.1 + bob);
  ctx.lineTo(r * 0.5, -r * 0.3 + bob);
  ctx.closePath();
  ctx.fill();
  // Staff (thrusts forward on attack)
  const staffX = r * 0.6 + atkProg * r * 0.3;
  ctx.strokeStyle = "#8b6914";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(staffX, -r * 0.8 + bob - atkProg * r * 0.3);
  ctx.lineTo(staffX, r * 1.0 + bob);
  ctx.stroke();
  // Staff orb (larger + brighter on attack)
  if (glow) {
    const orbSize = 3.5 + atkProg * 4;
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6 + Math.sin(t * 5) * 3 + atkProg * 12;
    ctx.beginPath(); ctx.arc(staffX, -r * 0.9 + bob - atkProg * r * 0.3, orbSize, 0, Math.PI * 2); ctx.fill();
    // Charging ring around orb
    if (atkProg > 0.2) {
      ctx.strokeStyle = glow;
      ctx.globalAlpha = atkProg * 0.5;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(staffX, -r * 0.9 + bob - atkProg * r * 0.3, orbSize + 5, t * 8, t * 8 + Math.PI * 1.5); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0;
  }
  // Hood / Head
  ctx.fillStyle = darken(color, 20);
  ctx.beginPath(); ctx.arc(0, -r * 0.55 + bob, r * 0.45, 0, Math.PI * 2); ctx.fill();
  // Hood peak
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.35 + bob);
  ctx.lineTo(0, -r * 1.15 + bob);
  ctx.lineTo(r * 0.5, -r * 0.35 + bob);
  ctx.quadraticCurveTo(0, -r * 0.6 + bob, -r * 0.5, -r * 0.35 + bob);
  ctx.fill();
  // Glowing eyes (intensify on attack)
  const eyeColor = glow ?? "#fff";
  ctx.fillStyle = eyeColor;
  ctx.shadowColor = eyeColor;
  ctx.shadowBlur = 3 + atkProg * 6;
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.55 + bob, 1.5 + atkProg, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.55 + bob, 1.5 + atkProg, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
}

// --- DASHER (berserker): crouched muscular form ---
function drawDasherEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, t: number) {
  const r = e.radius;
  const atkProg = Math.min(1, (e.attackAnim ?? 0) / 0.35);
  const lean = e.isDashing ? 0.3 : 0;
  ctx.rotate(lean);

  // Pre-dash warning glow
  if (atkProg > 0 && !e.isDashing) {
    ctx.strokeStyle = `rgba(239,68,68,${atkProg * 0.6})`;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Body (hunched)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.1);
  ctx.quadraticCurveTo(-r * 0.7, r * 0.5, -r * 0.3, r * 0.9);
  ctx.lineTo(r * 0.3, r * 0.9);
  ctx.quadraticCurveTo(r * 0.7, r * 0.5, r * 0.6, -r * 0.1);
  ctx.closePath();
  ctx.fill();
  // Arms (swing wide on attack)
  const armAnim = Math.sin(t * 8) * 0.2;
  const clawSpread = atkProg * 0.8;
  ctx.save();
  ctx.translate(-r * 0.65, 0);
  ctx.rotate(-0.5 + armAnim - clawSpread);
  ctx.fillStyle = darken(color, 15);
  ctx.fillRect(-3, 0, 5, r * 0.8);
  ctx.fillStyle = "#d4d4d8";
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(i * 2 - 0.5, r * 0.75, 1.5, 4 + atkProg * 3);
  }
  ctx.restore();
  ctx.save();
  ctx.translate(r * 0.65, 0);
  ctx.rotate(0.5 - armAnim + clawSpread);
  ctx.fillStyle = darken(color, 15);
  ctx.fillRect(-2, 0, 5, r * 0.8);
  ctx.fillStyle = "#d4d4d8";
  for (let i = -1; i <= 1; i++) {
    ctx.fillRect(i * 2 - 0.5, r * 0.75, 1.5, 4 + atkProg * 3);
  }
  ctx.restore();
  // Head (small, angry)
  ctx.fillStyle = darken(color, 10);
  ctx.beginPath(); ctx.arc(0, -r * 0.4, r * 0.35, 0, Math.PI * 2); ctx.fill();
  // Rage eyes (glow on attack)
  ctx.fillStyle = atkProg > 0 ? "#ef4444" : "#fbbf24";
  ctx.shadowColor = atkProg > 0 ? "#ef4444" : "#fbbf24";
  ctx.shadowBlur = atkProg * 6;
  ctx.beginPath();
  ctx.arc(-r * 0.12, -r * 0.45, 2 + atkProg, 0, Math.PI * 2);
  ctx.arc(r * 0.12, -r * 0.45, 2 + atkProg, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  // Mouth (open growl)
  ctx.strokeStyle = "#fbbf24";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -r * 0.3, r * 0.15, 0.2, Math.PI - 0.2);
  ctx.stroke();
  // Dash flame trail
  if (e.isDashing) {
    ctx.fillStyle = `rgba(239,68,68,${0.3 + Math.sin(t * 15) * 0.2})`;
    ctx.beginPath(); ctx.arc(-r * 0.2, r * 0.6, r * 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(251,146,60,${0.2 + Math.sin(t * 18) * 0.15})`;
    ctx.beginPath(); ctx.arc(r * 0.1, r * 0.8, r * 0.25, 0, Math.PI * 2); ctx.fill();
  }
}

// --- TANK (uroboros guard): big armored shield-bearer ---
function drawTankEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const bob = Math.sin(t * 2) * 0.5;
  // Big body armor
  ctx.fillStyle = color;
  ctx.fillRect(-r * 0.7, -r * 0.5 + bob, r * 1.4, r * 1.3);
  // Armor plates
  ctx.strokeStyle = glow ?? "#555";
  ctx.lineWidth = 1.5;
  ctx.strokeRect(-r * 0.65, -r * 0.45 + bob, r * 1.3, r * 1.2);
  ctx.beginPath();
  ctx.moveTo(-r * 0.65, r * 0.1 + bob);
  ctx.lineTo(r * 0.65, r * 0.1 + bob);
  ctx.stroke();
  // Shield (left hand)
  ctx.fillStyle = darken(color, 20);
  ctx.strokeStyle = glow ?? "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.9, -r * 0.5 + bob);
  ctx.lineTo(-r * 1.1, 0 + bob);
  ctx.lineTo(-r * 0.9, r * 0.5 + bob);
  ctx.lineTo(-r * 0.7, r * 0.5 + bob);
  ctx.lineTo(-r * 0.7, -r * 0.5 + bob);
  ctx.closePath();
  ctx.fill(); ctx.stroke();
  // Shield emblem
  if (glow) {
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.arc(-r * 0.85, bob, r * 0.15, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // Legs
  ctx.fillStyle = darken(color, 30);
  ctx.fillRect(-r * 0.4, r * 0.7 + bob, r * 0.3, r * 0.5);
  ctx.fillRect(r * 0.1, r * 0.7 + bob, r * 0.3, r * 0.5);
  // Helmet head
  ctx.fillStyle = darken(color, 10);
  ctx.beginPath(); ctx.arc(0, -r * 0.7 + bob, r * 0.4, 0, Math.PI * 2); ctx.fill();
  // Helmet visor
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(-r * 0.25, -r * 0.8 + bob, r * 0.5, r * 0.15);
  // Eyes behind visor
  if (glow) {
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.75 + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(r * 0.1, -r * 0.75 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// --- BOSS: massive armored warlord ---
function drawBossEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const breathe = Math.sin(t * 1.5) * 1.5;
  const atkProg = Math.min(1, (e.attackAnim ?? 0) / 0.4);

  // Aura (pulses on attack)
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.15 + Math.sin(t * 2) * 0.08 + atkProg * 0.15;
    ctx.lineWidth = 3 + atkProg * 2;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.6 + Math.sin(t * 3) * 4 + atkProg * 10, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Cape
  ctx.fillStyle = darken(color, 25);
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.3 + breathe);
  const capeSway = Math.sin(t * 2) * 4;
  ctx.quadraticCurveTo(-r * 0.8 + capeSway, r * 0.6, -r * 0.5 + capeSway * 0.5, r * 1.4);
  ctx.lineTo(r * 0.5 - capeSway * 0.5, r * 1.4);
  ctx.quadraticCurveTo(r * 0.8 - capeSway, r * 0.6, r * 0.6, -r * 0.3 + breathe);
  ctx.closePath();
  ctx.fill();

  // Body (massive torso)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.7, -r * 0.3 + breathe);
  ctx.lineTo(-r * 0.6, r * 0.7 + breathe);
  ctx.lineTo(r * 0.6, r * 0.7 + breathe);
  ctx.lineTo(r * 0.7, -r * 0.3 + breathe);
  ctx.closePath();
  ctx.fill();

  // Armor cross / insignia
  ctx.strokeStyle = glow ?? "#888";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -r * 0.15 + breathe);
  ctx.lineTo(0, r * 0.55 + breathe);
  ctx.moveTo(-r * 0.35, r * 0.2 + breathe);
  ctx.lineTo(r * 0.35, r * 0.2 + breathe);
  ctx.stroke();

  // Shoulder pads
  ctx.fillStyle = darken(color, 15);
  ctx.beginPath(); ctx.arc(-r * 0.75, -r * 0.25 + breathe, r * 0.25, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(r * 0.75, -r * 0.25 + breathe, r * 0.25, 0, Math.PI * 2); ctx.fill();
  // Spikes on shoulders
  ctx.fillStyle = glow ?? "#888";
  drawSpike(ctx, -r * 0.85, -r * 0.45 + breathe, 4, 10, -0.3);
  drawSpike(ctx, r * 0.85, -r * 0.45 + breathe, 4, 10, 0.3);

  // Legs
  ctx.fillStyle = darken(color, 30);
  ctx.fillRect(-r * 0.35, r * 0.6 + breathe, r * 0.25, r * 0.5);
  ctx.fillRect(r * 0.1, r * 0.6 + breathe, r * 0.25, r * 0.5);

  // Arms / Weapon (attack = big swing)
  ctx.save();
  ctx.translate(r * 0.75, r * 0.1 + breathe);
  ctx.rotate(Math.sin(t * 2.5) * 0.12 - atkProg * 1.5);
  ctx.fillStyle = darken(color, 15);
  ctx.fillRect(-3, 0, 6, r * 0.7);
  // Big sword / axe (extends on attack)
  ctx.fillStyle = "#94a3b8";
  if (atkProg > 0) {
    ctx.shadowColor = glow ?? "#f00";
    ctx.shadowBlur = atkProg * 10;
  }
  ctx.beginPath();
  ctx.moveTo(0, r * 0.6);
  ctx.lineTo(-6 - atkProg * 3, r * 1.1 + atkProg * r * 0.3);
  ctx.lineTo(0, r * 1.3 + atkProg * r * 0.4);
  ctx.lineTo(6 + atkProg * 3, r * 1.1 + atkProg * r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.restore();
  // Attack arc slash effect
  if (atkProg > 0.3) {
    ctx.strokeStyle = `rgba(255,255,255,${atkProg * 0.4})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, breathe, r * 1.8, -1.2, 0.5);
    ctx.stroke();
  }

  // Head (crowned/horned helmet)
  ctx.fillStyle = darken(color, 10);
  ctx.beginPath(); ctx.arc(0, -r * 0.6 + breathe, r * 0.38, 0, Math.PI * 2); ctx.fill();
  // Crown / Horns
  ctx.fillStyle = glow ?? "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, -r * 0.7 + breathe);
  ctx.lineTo(-r * 0.45, -r * 1.15 + breathe);
  ctx.lineTo(-r * 0.2, -r * 0.85 + breathe);
  ctx.lineTo(0, -r * 1.2 + breathe);
  ctx.lineTo(r * 0.2, -r * 0.85 + breathe);
  ctx.lineTo(r * 0.45, -r * 1.15 + breathe);
  ctx.lineTo(r * 0.35, -r * 0.7 + breathe);
  ctx.closePath();
  ctx.fill();

  // Visor / glowing eyes
  ctx.fillStyle = "#0a0a0f";
  ctx.fillRect(-r * 0.22, -r * 0.68 + breathe, r * 0.44, r * 0.12);
  if (glow) {
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.65 + breathe, 2, 0, Math.PI * 2);
    ctx.arc(r * 0.1, -r * 0.65 + breathe, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Phase indicator
  if (e.phase > 0) {
    ctx.strokeStyle = glow ?? "#f00";
    ctx.globalAlpha = 0.2 + e.phase * 0.1;
    ctx.lineWidth = 2;
    for (let i = 0; i < e.phase; i++) {
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.3 + i * 6, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }
}

function drawSpike(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, angle: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(-w / 2, 0);
  ctx.lineTo(w / 2, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ============================
//      DOOR ARROWS
// ============================
function drawDoorArrows(
  ctx: CanvasRenderingContext2D,
  player: PlayerState,
  room: Room,
  enteredFrom: DoorSide | null,
  t: number,
): void {
  const doors = room.doors;
  const sides: { side: DoorSide; active: boolean; dx: number; dy: number }[] = [
    { side: "top",    active: doors.top,    dx: room.width / 2, dy: WALL_THICKNESS + 25 },
    { side: "bottom", active: doors.bottom, dx: room.width / 2, dy: room.height - WALL_THICKNESS - 25 },
    { side: "left",   active: doors.left,   dx: WALL_THICKNESS + 25, dy: room.height / 2 },
    { side: "right",  active: doors.right,  dx: room.width - WALL_THICKNESS - 25, dy: room.height / 2 },
  ];

  for (const { side, active, dx: doorX, dy: doorY } of sides) {
    if (!active) continue;

    const isEntrance = side === enteredFrom;
    const arrowColor = isEntrance ? "rgba(239,68,68," : "rgba(74,222,128,";

    const toX = doorX - player.x;
    const toY = doorY - player.y;
    const toDist = Math.sqrt(toX * toX + toY * toY);
    if (toDist < 60) continue;

    const nx = toX / toDist;
    const ny = toY / toDist;
    const arrowDist = Math.min(toDist - 30, 70);
    const ax = player.x + nx * arrowDist;
    const ay = player.y + ny * arrowDist;
    const angle = Math.atan2(ny, nx);

    const pulse = 0.35 + Math.sin(t * 3 + side.charCodeAt(0)) * 0.1;
    const arrowSize = 10;

    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(angle);

    ctx.fillStyle = arrowColor + pulse + ")";
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.5, -arrowSize * 0.6);
    ctx.lineTo(-arrowSize * 0.2, 0);
    ctx.lineTo(-arrowSize * 0.5, arrowSize * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = arrowColor + (pulse * 0.7) + ")";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(arrowSize, 0);
    ctx.lineTo(-arrowSize * 0.5, -arrowSize * 0.6);
    ctx.lineTo(-arrowSize * 0.2, 0);
    ctx.lineTo(-arrowSize * 0.5, arrowSize * 0.6);
    ctx.closePath();
    ctx.stroke();

    ctx.restore();
  }
}

// --- BOMBER: round body with fuse ---
function drawBomberEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const bob = Math.sin(t * 3.5) * 1;
  const atkProg = Math.min(1, (e.attackAnim ?? 0) / 0.35);
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, bob, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = darken(color, 20);
  ctx.beginPath(); ctx.arc(0, bob, r * 0.6, 0, Math.PI * 2); ctx.fill();
  if (glow) {
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 4 + atkProg * 8;
    ctx.beginPath(); ctx.arc(0, -r * 0.8 + bob, 3 + atkProg * 2, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.strokeStyle = "#78716c";
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(0, -r * 0.5 + bob); ctx.lineTo(0, -r * 0.9 + bob); ctx.stroke();
  ctx.fillStyle = "#fbbf24";
  ctx.font = `bold ${r * 0.6}px sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText("💣", 0, bob);
}

// --- HEALER: glowing cross figure ---
function drawHealerEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const pulse = Math.sin(t * 4) * 2;
  if (glow) {
    ctx.fillStyle = glow;
    ctx.globalAlpha = 0.1 + Math.sin(t * 3) * 0.05;
    ctx.beginPath(); ctx.arc(0, 0, r * 2 + pulse, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = glow ?? "#4ade80";
  ctx.shadowColor = glow ?? "#4ade80";
  ctx.shadowBlur = 6;
  ctx.fillRect(-r * 0.15, -r * 0.5, r * 0.3, r);
  ctx.fillRect(-r * 0.5, -r * 0.15, r, r * 0.3);
  ctx.shadowBlur = 0;
  ctx.fillStyle = glow ?? "#4ade80";
  ctx.beginPath();
  ctx.arc(-r * 0.2, -r * 0.3, 1.5, 0, Math.PI * 2);
  ctx.arc(r * 0.2, -r * 0.3, 1.5, 0, Math.PI * 2);
  ctx.fill();
}

// --- SUMMONER: hooded with orbiting spirits ---
function drawSummonerEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const bob = Math.sin(t * 2.5) * 1;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.5, -r * 0.2 + bob);
  ctx.lineTo(-r * 0.65, r * 1.1 + bob);
  ctx.lineTo(r * 0.65, r * 1.1 + bob);
  ctx.lineTo(r * 0.5, -r * 0.2 + bob);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = darken(color, 20);
  ctx.beginPath(); ctx.arc(0, -r * 0.4 + bob, r * 0.4, 0, Math.PI * 2); ctx.fill();
  if (glow) {
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + i * (Math.PI * 2 / 3);
      const ox = Math.cos(a) * r * 1.3;
      const oy = Math.sin(a) * r * 1.3;
      ctx.fillStyle = glow;
      ctx.globalAlpha = 0.4 + Math.sin(t * 5 + i) * 0.2;
      ctx.beginPath(); ctx.arc(ox, oy, 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  if (glow) {
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 3;
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.45 + bob, 1.5, 0, Math.PI * 2);
    ctx.arc(r * 0.12, -r * 0.45 + bob, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// --- TELEPORTER: ghostly shifting figure ---
function drawTeleporterEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const flicker = Math.sin(t * 10) * 0.15;
  ctx.globalAlpha = 0.6 + flicker;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = t * 20;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.4, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.fillStyle = darken(color, 15);
  ctx.beginPath(); ctx.arc(0, -r * 0.3, r * 0.4, 0, Math.PI * 2); ctx.fill();
  if (glow) {
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.arc(-r * 0.12, -r * 0.35, 2, 0, Math.PI * 2);
    ctx.arc(r * 0.12, -r * 0.35, 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
  ctx.globalAlpha = 1;
}

// --- MINIBOSS: larger armored elite ---
function drawMinibossEnemy(ctx: CanvasRenderingContext2D, e: Enemy, color: string, glow: string | undefined, t: number) {
  const r = e.radius;
  const breathe = Math.sin(t * 2) * 1;
  if (glow) {
    ctx.strokeStyle = glow;
    ctx.globalAlpha = 0.15 + Math.sin(t * 2.5) * 0.08;
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(0, 0, r * 1.4 + Math.sin(t * 3) * 3, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-r * 0.6, -r * 0.3 + breathe);
  ctx.lineTo(-r * 0.5, r * 0.8 + breathe);
  ctx.lineTo(r * 0.5, r * 0.8 + breathe);
  ctx.lineTo(r * 0.6, -r * 0.3 + breathe);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = darken(color, 10);
  ctx.beginPath(); ctx.arc(0, -r * 0.55 + breathe, r * 0.35, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = glow ?? "#fbbf24";
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.65 + breathe);
  ctx.lineTo(-r * 0.4, -r * 1.0 + breathe);
  ctx.lineTo(-r * 0.15, -r * 0.8 + breathe);
  ctx.lineTo(0, -r * 1.05 + breathe);
  ctx.lineTo(r * 0.15, -r * 0.8 + breathe);
  ctx.lineTo(r * 0.4, -r * 1.0 + breathe);
  ctx.lineTo(r * 0.3, -r * 0.65 + breathe);
  ctx.closePath(); ctx.fill();
  if (glow) {
    ctx.fillStyle = glow;
    ctx.shadowColor = glow;
    ctx.shadowBlur = 4;
    ctx.beginPath();
    ctx.arc(-r * 0.1, -r * 0.6 + breathe, 1.5, 0, Math.PI * 2);
    ctx.arc(r * 0.1, -r * 0.6 + breathe, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ============================
//       PROJECTILES
// ============================
function drawProjectiles(ctx: CanvasRenderingContext2D, projectiles: Projectile[], t: number): void {
  for (const p of projectiles) {
    if (p.hp <= 0) continue;

    if (p.owner === "player") {
      const color = p.element ? ELEMENT_COLORS[p.element] : "#2dd4bf";

      if (p.radius > 30) {
        // Aura pulse
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.12;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.25;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius * 0.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        ctx.strokeStyle = color;
        ctx.globalAlpha = 0.4;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        continue;
      }

      ctx.save();
      ctx.translate(p.x, p.y);
      const angle = Math.atan2(p.vy, p.vx);
      ctx.rotate(angle);

      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;

      // Elemental projectile shapes
      switch (p.element) {
        case ElementType.Fire:
          // Flame bolt
          ctx.beginPath();
          ctx.moveTo(p.radius * 1.5, 0);
          ctx.quadraticCurveTo(p.radius * 0.5, -p.radius * 0.8, -p.radius, -p.radius * 0.3);
          ctx.quadraticCurveTo(-p.radius * 0.5, 0, -p.radius, p.radius * 0.3);
          ctx.quadraticCurveTo(p.radius * 0.5, p.radius * 0.8, p.radius * 1.5, 0);
          ctx.fill();
          break;
        case ElementType.Ice:
          // Crystal shard
          ctx.beginPath();
          ctx.moveTo(p.radius * 1.3, 0);
          ctx.lineTo(0, -p.radius * 0.6);
          ctx.lineTo(-p.radius, 0);
          ctx.lineTo(0, p.radius * 0.6);
          ctx.closePath();
          ctx.fill();
          break;
        case ElementType.Electricity:
          // Lightning bolt
          ctx.beginPath();
          ctx.moveTo(p.radius * 1.2, 0);
          ctx.lineTo(p.radius * 0.3, -p.radius * 0.5);
          ctx.lineTo(p.radius * 0.5, -p.radius * 0.1);
          ctx.lineTo(-p.radius, -p.radius * 0.3);
          ctx.lineTo(-p.radius * 0.3, p.radius * 0.1);
          ctx.lineTo(-p.radius * 0.5, p.radius * 0.5);
          ctx.closePath();
          ctx.fill();
          break;
        case ElementType.Wind:
          // Crescent / air blade
          ctx.beginPath();
          ctx.arc(0, 0, p.radius, -0.8, 0.8);
          ctx.quadraticCurveTo(p.radius * 0.3, 0, 0, 0);
          ctx.fill();
          break;
        case ElementType.Darkness:
          // Dark orb with tendrils
          ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          for (let i = 0; i < 3; i++) {
            const a = t * 3 + i * 2.1;
            ctx.beginPath();
            ctx.moveTo(Math.cos(a) * p.radius, Math.sin(a) * p.radius);
            ctx.lineTo(Math.cos(a) * p.radius * 2, Math.sin(a) * p.radius * 2);
            ctx.stroke();
          }
          break;
        default:
          // Default: elongated energy bolt
          ctx.beginPath();
          ctx.ellipse(0, 0, p.radius * 1.3, p.radius * 0.6, 0, 0, Math.PI * 2);
          ctx.fill();
          // Trail
          ctx.globalAlpha = 0.3;
          ctx.beginPath();
          ctx.ellipse(-p.radius, 0, p.radius * 0.8, p.radius * 0.4, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.globalAlpha = 1;
      }

      ctx.shadowBlur = 0;
      ctx.restore();
    } else {
      // Enemy projectile: red energy ball with trail
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.fillStyle = "#f87171";
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 6;
      ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
      // Inner core
      ctx.fillStyle = "#fca5a5";
      ctx.beginPath(); ctx.arc(0, 0, p.radius * 0.4, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  }
}

// ============================
//       PARTICLES
// ============================
function drawParticles(ctx: CanvasRenderingContext2D, particles: Particle[]): void {
  for (const p of particles) {
    if (p.life <= 0) continue;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;

    if (p.size < 2) {
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
    } else if (p.size < 4) {
      // Soft glow dot
      ctx.shadowColor = p.color;
      ctx.shadowBlur = p.size * 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
    } else {
      drawSpark(ctx, p.x, p.y, p.size * alpha);
    }
  }
  ctx.globalAlpha = 1;
}

function drawSpark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s * 0.3, y - s * 0.3);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x + s * 0.3, y + s * 0.3);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s * 0.3, y + s * 0.3);
  ctx.lineTo(x - s, y);
  ctx.lineTo(x - s * 0.3, y - s * 0.3);
  ctx.closePath();
  ctx.fill();
}

// ============================
//      DAMAGE NUMBERS
// ============================
function drawDamageNumbers(ctx: CanvasRenderingContext2D, nums: DamageNumber[]): void {
  ctx.textAlign = "center";
  for (const n of nums) {
    if (n.life <= 0) continue;
    const progress = (0.7 - n.life) / 0.7;
    const scale = 1 + (1 - progress) * 0.3;
    const yOff = n.y - progress * 45;
    ctx.globalAlpha = Math.min(1, n.life / 0.4);

    ctx.save();
    ctx.translate(n.x, yOff);
    ctx.scale(scale, scale);

    const isBig = n.value >= 50;
    ctx.font = isBig ? "bold 18px 'Inter', sans-serif" : "bold 14px 'Inter', sans-serif";

    // Outline
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 3;
    ctx.lineJoin = "round";
    ctx.strokeText(`${n.value}`, 0, 0);

    // Fill
    ctx.fillStyle = n.color;
    if (isBig) {
      ctx.shadowColor = n.color;
      ctx.shadowBlur = 6;
    }
    ctx.fillText(`${n.value}`, 0, 0);
    ctx.shadowBlur = 0;

    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ============================
//        XP ORBS
// ============================
function drawXpOrbs(ctx: CanvasRenderingContext2D, orbs: XpOrb[], t: number): void {
  for (const orb of orbs) {
    if (orb.collected) continue;
    const pulse = 1 + Math.sin(t * 6 + orb.x * 0.1) * 0.15;
    const hover = Math.sin(t * 3 + orb.y * 0.05) * 2;

    // Soft glow
    const glow = ctx.createRadialGradient(orb.x, orb.y + hover, 0, orb.x, orb.y + hover, 12 * pulse);
    glow.addColorStop(0, "rgba(167,139,250,0.25)");
    glow.addColorStop(1, "rgba(167,139,250,0)");
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(orb.x, orb.y + hover, 12 * pulse, 0, Math.PI * 2); ctx.fill();

    // Orb body
    ctx.fillStyle = "#a78bfa";
    ctx.shadowColor = "#a78bfa";
    ctx.shadowBlur = 8;
    ctx.beginPath(); ctx.arc(orb.x, orb.y + hover, 4 * pulse, 0, Math.PI * 2); ctx.fill();

    // Inner highlight
    ctx.fillStyle = "#ddd6fe";
    ctx.beginPath(); ctx.arc(orb.x - 1, orb.y + hover - 1, 1.5 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }
}

// ============================
//        HELPERS
// ============================
function hexToRgba(hex: string, alpha: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  return `rgba(${(num >> 16) & 0xff},${(num >> 8) & 0xff},${num & 0xff},${alpha})`;
}

function darken(hex: string, amount: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max(0, (num >> 16) - amount);
  const g = Math.max(0, ((num >> 8) & 0xff) - amount);
  const b = Math.max(0, (num & 0xff) - amount);
  return `rgb(${r},${g},${b})`;
}
