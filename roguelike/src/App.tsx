import React, { useRef, useEffect, useState, useCallback } from "react";
import { Canvas } from "@react-three/fiber";
import type { GameState, PlayerState, Projectile, Ring, Upgrade, Room, Camera, DoorSide } from "./types";
import { ElementType, RingRank, Rarity } from "./types";
import {
  WALL_THICKNESS, DOOR_WIDTH, setViewportSize,
  STAGES, ELEMENT_COLORS, ELEMENT_NAMES_RU, RARITY_COLORS, RARITY_NAMES_RU,
  BOSS_TEMPLATES, getCombo,
  PLAYER_MOVE_SPEED, PLAYER_DASH_SPEED, PLAYER_DASH_COST, PLAYER_DASH_DECAY,
  PLAYER_DASH_IFRAMES, PLAYER_STAMINA_REGEN, PLAYER_BASE_ATTACK_COOLDOWN,
  PLAYER_DASH_CHARGE_REGEN,
  PROJECTILE_BASE_SPEED, PROJECTILE_BASE_DAMAGE, PROJECTILE_DAMAGE_PER_LEVEL,
  PORTAL_INTERACT_RADIUS, PLAYER_RADIUS,
  XP_ORB_MAGNET_RADIUS,
} from "./constants";
import GameScene, { preloadAllTextures } from "./three/GameScene";
import {
  updateEnemies, updateProjectiles, checkCollisions,
  updateParticles, collectXpOrbs, tickAuras,
  checkObstacleCollisions, checkPlayerObstacles, applyCoreDamage,
} from "./combat";
import { spawnRoomEnemies } from "./spawner";
import { generateMap } from "./mapgen";
import { generateUpgrades, applyUpgrade } from "./upgrades";
import { uid, normalize, clamp } from "./utils";

function createPlayer(): PlayerState {
  return {
    x: 500, y: 375,
    hp: 100, maxHp: 100,
    stamina: 100, maxStamina: 100,
    rings: [null, null, null, null, null],
    attackSpeed: 1, damageMult: 1,
    projectileSpeedMult: 1, projectileCount: 1,
    xp: 0, maxXp: 40, playerLevel: 1,
    invincibleTimer: 0, regenRate: 0,
    elementalCore: null, buffs: [],
    dashTimer: 0, dashCooldown: 0.8, dashVx: 0, dashVy: 0, isDashing: false,
    dashCharges: 2, dashMaxCharges: 2,
    dashChargeTimer: 0, dashChargeRegenTime: PLAYER_DASH_CHARGE_REGEN,
    dashDistance: 1, dashDamage: 0, dashCostMult: 1,
    passiveXpMagnet: 0, passiveLifesteal: 0,
    passiveProjReflect: 0, passiveRage: 0, passiveAuraCdr: 0,
    attackAnim: 0,
  };
}

function createInitialState(): GameState {
  const map = generateMap(STAGES[0].roomCount);
  const startRoom = map["0,0"];
  return {
    screen: "start", level: 0, killsTotal: 0,
    player: createPlayer(),
    map, currentRoom: { x: 0, y: 0 }, enteredFrom: null,
    enemies: [], projectiles: [], particles: [],
    damageNumbers: [], activeCombo: null,
    availableUpgrades: [], xpOrbs: [],
    gameTime: 0,
    camera: { x: 0, y: 0, zoom: 1, shakeX: 0, shakeY: 0, shakeTimer: 0 },
  };
}

const SLOT_LABELS = ["ЛКМ", "ПКМ", "АВТО", "АВТО", "ЯДРО"];

export default function App() {
  const stateRef = useRef<GameState>(createInitialState());
  const keysRef = useRef<Set<string>>(new Set());
  const mouseScreenRef = useRef({ x: 0, y: 0 });
  const cameraAngleRef = useRef(0);
  const aimWorldRef = useRef({ x: 0, y: 0 });
  const lmbRef = useRef(false);
  const rmbRef = useRef(false);
  const lmbTimerRef = useRef(0);
  const rmbTimerRef = useRef(0);
  const auraTimersRef = useRef({ slot2: 0, slot3: 0 });
  const frameRef = useRef(0);

  const [screen, setScreen] = useState<GameState["screen"]>("start");
  const [upgrades, setUpgrades] = useState<Upgrade[]>([]);
  const [stageIndex, setStageIndex] = useState(0);
  const [cycle, setCycle] = useState(0);
  const [playerLevel, setPlayerLevel] = useState(1);
  const [selectedUpgrade, setSelectedUpgrade] = useState<Upgrade | null>(null);
  const [comboMerge, setComboMerge] = useState(false);
  const [activeRings, setActiveRings] = useState<(Ring | null)[]>([null, null, null, null, null]);
  const [comboName, setComboName] = useState<string | null>(null);
  const [comboDesc, setComboDesc] = useState<string | null>(null);
  const [showInventory, setShowInventory] = useState(false);
  const [appliedUpgrades, setAppliedUpgrades] = useState<Upgrade[]>([]);
  const [hpDisplay, setHpDisplay] = useState({ hp: 100, maxHp: 100 });
  const [staminaDisplay, setStaminaDisplay] = useState({ stamina: 100, maxStamina: 100 });
  const [xpDisplay, setXpDisplay] = useState({ xp: 0, maxXp: 40 });
  const [dashDisplay, setDashDisplay] = useState({ charges: 2, maxCharges: 2 });
  const [bossInfo, setBossInfo] = useState<{ name: string; hp: number; maxHp: number } | null>(null);
  const [mapState, setMapState] = useState<Record<string, { visited: boolean; type: string; current: boolean }>>({});
  const [killsTotal, setKillsTotal] = useState(0);
  const [startingRings, setStartingRings] = useState<Ring[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);

  const addLog = useCallback((_msg: string) => {}, []);

  const startGame = useCallback(() => {
    const s = createInitialState();
    s.screen = "ringChoice";
    const startRoom = s.map["0,0"];
    s.player.x = startRoom.width / 2;
    s.player.y = startRoom.height / 2;
    stateRef.current = s;
    setScreen("ringChoice");
    setStageIndex(0);
    setCycle(0);
    setPlayerLevel(1);
    setSelectedUpgrade(null);
    setComboMerge(false);
    setActiveRings([...s.player.rings]);
    setComboName(null);
    setComboDesc(null);
    setKillsTotal(0);
    setShowInventory(false);
    setAppliedUpgrades([]);

    // Generate 3 random starter rings
    const allElements = Object.values(ElementType);
    const picked = new Set<ElementType>();
    const choices: Ring[] = [];
    while (choices.length < 3) {
      const el = allElements[Math.floor(Math.random() * allElements.length)];
      if (picked.has(el)) continue;
      picked.add(el);
      choices.push({
        id: uid(), element: el, rank: RingRank.Lower,
        name: `Кольцо ${ELEMENT_NAMES_RU[el]}`, level: 1,
        attackType: "projectile", slotType: "projectile_lmb",
      });
    }
    setStartingRings(choices);
  }, []);

  const pickStartingRing = useCallback((ring: Ring) => {
    const s = stateRef.current;
    s.player.rings[0] = { ...ring };
    s.screen = "playing";
    setScreen("playing");
    setActiveRings([...s.player.rings]);
    setStartingRings([]);
    addLog(`Ты взял ${ring.name}. Вперёд, в тьму!`);
  }, [addLog]);

  function enterRoom(rx: number, ry: number) {
    const s = stateRef.current;
    const key = `${rx},${ry}`;
    const room = s.map[key];
    if (!room) return;

    s.currentRoom = { x: rx, y: ry };
    room.visited = true;
    s.enemies = [];
    s.projectiles = [];
    s.particles = [];
    s.xpOrbs = [];

    if (!room.cleared && room.type !== "start") {
      if (room.preSpawnedEnemies) {
        s.enemies = room.preSpawnedEnemies;
        room.preSpawnedEnemies = undefined;
      } else {
        s.enemies = spawnRoomEnemies(room, stageIndex % STAGES.length, s.level);
      }
      if (room.type === "boss") {
        addLog(`⚔ БОСС: ${STAGES[stageIndex % STAGES.length]?.nameRu ?? "???"}`);
      }
    }

    if (room.type === "treasure" && !room.cleared) {
      room.cleared = true;
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + 30);
      addLog("Сундук! +30 HP");
    }

    if (room.type === "event" && room.event?.active) {
      switch (room.event.type) {
        case "altar":
          s.player.hp = Math.min(s.player.maxHp, s.player.hp + 50);
          s.player.buffs.push({ type: "damage", value: 0.2, remaining: 30 });
          room.event.active = false;
          addLog("Алтарь Силы! +50 HP и +20% урон на 30с");
          break;
        case "merchant":
          s.player.maxHp += 15;
          s.player.hp += 15;
          s.player.maxStamina += 15;
          s.player.stamina += 15;
          room.event.active = false;
          addLog("Торговец! +15 макс. HP, +15 макс. стамины");
          break;
        case "chest":
          s.player.hp = s.player.maxHp;
          s.player.stamina = s.player.maxStamina;
          s.player.dashCharges = s.player.dashMaxCharges;
          room.event.active = false;
          addLog("Зачарованный Сундук! Полное восстановление!");
          break;
        case "trap":
          addLog("Ловушка! Выживи, чтобы получить награду!");
          break;
        case "speed_trial":
          room.event.timer = 15;
          addLog("Испытание скорости! Уничтожь всех за 15 секунд!");
          break;
      }
    }
  }

  function checkDoor(p: PlayerState, room: Room | undefined) {
    if (!room || !room.cleared) return;
    const s = stateRef.current;
    const cx = room.width / 2;
    const cy = room.height / 2;
    const dh = DOOR_WIDTH / 2;
    const threshold = WALL_THICKNESS + 5;

    if (room.doors.top && p.y < threshold && Math.abs(p.x - cx) < dh) {
      const target = s.map[`${s.currentRoom.x},${s.currentRoom.y - 1}`];
      if (target) { s.enteredFrom = "bottom"; enterRoom(s.currentRoom.x, s.currentRoom.y - 1); p.y = target.height - WALL_THICKNESS - 20; p.x = target.width / 2; return; }
    }
    if (room.doors.bottom && p.y > room.height - threshold && Math.abs(p.x - cx) < dh) {
      const target = s.map[`${s.currentRoom.x},${s.currentRoom.y + 1}`];
      if (target) { s.enteredFrom = "top"; enterRoom(s.currentRoom.x, s.currentRoom.y + 1); p.y = WALL_THICKNESS + 20; p.x = target.width / 2; return; }
    }
    if (room.doors.left && p.x < threshold && Math.abs(p.y - cy) < dh) {
      const target = s.map[`${s.currentRoom.x - 1},${s.currentRoom.y}`];
      if (target) { s.enteredFrom = "right"; enterRoom(s.currentRoom.x - 1, s.currentRoom.y); p.x = target.width - WALL_THICKNESS - 20; p.y = target.height / 2; return; }
    }
    if (room.doors.right && p.x > room.width - threshold && Math.abs(p.y - cy) < dh) {
      const target = s.map[`${s.currentRoom.x + 1},${s.currentRoom.y}`];
      if (target) { s.enteredFrom = "left"; enterRoom(s.currentRoom.x + 1, s.currentRoom.y); p.x = WALL_THICKNESS + 20; p.y = target.height / 2; return; }
    }
  }

  function fireSlotProjectile(
    player: PlayerState, projectiles: Projectile[], slotIndex: number,
    timerRef: React.MutableRefObject<number>, dt: number, mouseDown: boolean,
  ) {
    timerRef.current -= dt;
    if (!mouseDown || timerRef.current > 0) return;

    const ring = player.rings[slotIndex];
    if (!ring) return;

    const baseCooldown = PLAYER_BASE_ATTACK_COOLDOWN / player.attackSpeed;
    timerRef.current = baseCooldown;

    const aimX = aimWorldRef.current.x;
    const aimY = aimWorldRef.current.y;
    const dx = aimX - player.x;
    const dy = aimY - player.y;
    const [ndx, ndy] = normalize(dx, dy);
    const pSpeed = PROJECTILE_BASE_SPEED * player.projectileSpeedMult;
    const rageMult = player.passiveRage > 0
      ? 1 + player.passiveRage * Math.floor((1 - player.hp / player.maxHp) * 20)
      : 1;
    const baseDmg = (PROJECTILE_BASE_DAMAGE + ring.level * PROJECTILE_DAMAGE_PER_LEVEL) * player.damageMult * rageMult;
    const dmg = applyCoreDamage(baseDmg, ring.element, player);

    for (let i = 0; i < player.projectileCount; i++) {
      const spread = player.projectileCount > 1 ? (i - (player.projectileCount - 1) / 2) * 0.15 : 0;
      const angle = Math.atan2(ndy, ndx) + spread;
      projectiles.push({
        id: uid(), x: player.x, y: player.y,
        vx: Math.cos(angle) * pSpeed, vy: Math.sin(angle) * pSpeed,
        owner: "player", damage: dmg, element: ring.element,
        hp: 1, lifeTime: 2.2, radius: 5 + ring.level,
        piercing: false, chainCount: 0,
      });
    }
    player.stamina = Math.max(0, player.stamina - 2);
    player.attackAnim = 0.2;
  }

  useEffect(() => {
    setAssetsLoading(true);

    const s = stateRef.current;
    const si = stageIndex % STAGES.length;
    for (const key of Object.keys(s.map)) {
      const room = s.map[key];
      if (!room || room.cleared || room.type === "start" || room.type === "exit" || room.type === "treasure") continue;
      if (!room.preSpawnedEnemies) {
        room.preSpawnedEnemies = spawnRoomEnemies(room, si, s.level);
      }
    }

    preloadAllTextures().then(() => setAssetsLoading(false));
  }, [stageIndex]);

  useEffect(() => {
    function resize() {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setViewportSize(w, h);
    }
    resize();
    window.addEventListener("resize", resize);

    const handleKey = (e: KeyboardEvent, down: boolean) => {
      const key = e.key.toLowerCase();
      if (down) keysRef.current.add(key); else keysRef.current.delete(key);
      if ((key === "c" || key === "с") && down && stateRef.current.screen === "playing") {
        setShowInventory(prev => !prev);
      }
      if (key === "escape" && down) {
        setShowInventory(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => handleKey(e, true);
    const onKeyUp = (e: KeyboardEvent) => handleKey(e, false);
    const onMouseMove = (e: MouseEvent) => {
      mouseScreenRef.current.x = e.clientX;
      mouseScreenRef.current.y = e.clientY;
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) lmbRef.current = true;
      if (e.button === 2) rmbRef.current = true;
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 0) lmbRef.current = false;
      if (e.button === 2) rmbRef.current = false;
    };
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("contextmenu", onContextMenu);

    let lastTime = performance.now();

    function gameLoop(now: number) {
      frameRef.current = requestAnimationFrame(gameLoop);
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      const s = stateRef.current;
      const roomKey = `${s.currentRoom.x},${s.currentRoom.y}`;
      const room = s.map[roomKey];

      if (s.screen !== "playing") {
        return;
      }

      s.gameTime += dt;
      const player = s.player;
      const keys = keysRef.current;

      // Movement — rotated by camera angle so WASD is relative to camera view
      const moveSpeed = PLAYER_MOVE_SPEED;
      let rawX = 0, rawZ = 0;
      if (keys.has("w") || keys.has("ц")) rawZ -= 1;
      if (keys.has("s") || keys.has("ы")) rawZ += 1;
      if (keys.has("a") || keys.has("ф")) rawX -= 1;
      if (keys.has("d") || keys.has("в")) rawX += 1;

      const camTheta = cameraAngleRef.current;
      const cosT = Math.cos(camTheta);
      const sinT = Math.sin(camTheta);
      const mx = rawX * cosT + rawZ * sinT;
      const my = -rawX * sinT + rawZ * cosT;

      // Dash charge regen
      if (player.dashCharges < player.dashMaxCharges) {
        player.dashChargeTimer += dt;
        if (player.dashChargeTimer >= player.dashChargeRegenTime) {
          player.dashChargeTimer = 0;
          player.dashCharges = Math.min(player.dashMaxCharges, player.dashCharges + 1);
        }
      }

      // Dash mechanic (charge-based)
      player.dashTimer = Math.max(0, player.dashTimer - dt);
      const dashCost = Math.round(PLAYER_DASH_COST * player.dashCostMult);
      if (player.isDashing) {
        player.x += player.dashVx * dt;
        player.y += player.dashVy * dt;
        player.dashVx *= PLAYER_DASH_DECAY;
        player.dashVy *= PLAYER_DASH_DECAY;
        if (Math.abs(player.dashVx) < 30 && Math.abs(player.dashVy) < 30) {
          player.isDashing = false;
        }
        // Dash damage to enemies
        if (player.dashDamage > 0) {
          for (const e of s.enemies) {
            if (e.dead) continue;
            const dd = Math.sqrt((player.x - e.x) ** 2 + (player.y - e.y) ** 2);
            if (dd < PLAYER_RADIUS + e.radius + 10) {
              e.hp -= player.dashDamage;
              e.hitFlash = 0.15;
              s.damageNumbers.push({ x: e.x, y: e.y - e.radius, value: Math.round(player.dashDamage), life: 0.7, color: "#2dd4bf" });
              if (e.hp <= 0) e.dead = true;
            }
          }
        }
      } else if (keys.has("shift") && player.stamina >= dashCost && player.dashCharges > 0 && player.dashTimer <= 0 && (mx !== 0 || my !== 0)) {
        const [ndx, ndy] = normalize(mx, my);
        player.dashVx = ndx * PLAYER_DASH_SPEED * player.dashDistance;
        player.dashVy = ndy * PLAYER_DASH_SPEED * player.dashDistance;
        player.isDashing = true;
        player.dashTimer = 0.15;
        player.dashCharges -= 1;
        player.dashChargeTimer = 0;
        player.stamina -= dashCost;
        player.invincibleTimer = Math.max(player.invincibleTimer, PLAYER_DASH_IFRAMES);
        for (let i = 0; i < 8; i++) {
          s.particles.push({
            x: player.x + (Math.random() - 0.5) * 12,
            y: player.y + (Math.random() - 0.5) * 12,
            vx: -ndx * (80 + Math.random() * 60) + (Math.random() - 0.5) * 40,
            vy: -ndy * (80 + Math.random() * 60) + (Math.random() - 0.5) * 40,
            life: 0.25, maxLife: 0.25,
            color: "rgba(45,212,191,0.6)",
            size: 2 + Math.random() * 2,
          });
        }
      } else if (!player.isDashing && (mx !== 0 || my !== 0)) {
        const [nmx, nmy] = normalize(mx, my);
        player.x += nmx * moveSpeed * dt;
        player.y += nmy * moveSpeed * dt;
      }

      player.stamina = Math.min(player.maxStamina, player.stamina + PLAYER_STAMINA_REGEN * dt);
      player.invincibleTimer = Math.max(0, player.invincibleTimer - dt);
      player.attackAnim = Math.max(0, player.attackAnim - dt);

      // Buffs
      let buffRegen = player.regenRate;
      let buffDamageMult = 1;
      let buffSpeedMult = 1;
      for (let i = player.buffs.length - 1; i >= 0; i--) {
        const b = player.buffs[i];
        b.remaining -= dt;
        if (b.remaining <= 0) { player.buffs.splice(i, 1); continue; }
        if (b.type === "regen") buffRegen += b.value;
        if (b.type === "damage") buffDamageMult += b.value;
        if (b.type === "speed") buffSpeedMult += b.value;
      }
      if (buffRegen > 0) player.hp = Math.min(player.maxHp, player.hp + buffRegen * dt);

      // Core regen bonus
      if (player.elementalCore?.uniqueBonus === "regen") {
        player.hp = Math.min(player.maxHp, player.hp + 3 * dt);
      }

      // Clamp to room with door pass-through
      if (room) {
        const wallPad = WALL_THICKNESS + 14;
        const doorPad = WALL_THICKNESS - 2;
        const canPass = room.cleared;
        const rcx = room.width / 2;
        const rcy = room.height / 2;
        const inDoorH = Math.abs(player.x - rcx) < DOOR_WIDTH / 2 + 10;
        const inDoorV = Math.abs(player.y - rcy) < DOOR_WIDTH / 2 + 10;

        const minX = (canPass && room.doors.left && inDoorV) ? doorPad : wallPad;
        const maxX = (canPass && room.doors.right && inDoorV) ? room.width - doorPad : room.width - wallPad;
        const minY = (canPass && room.doors.top && inDoorH) ? doorPad : wallPad;
        const maxY = (canPass && room.doors.bottom && inDoorH) ? room.height - doorPad : room.height - wallPad;

        player.x = clamp(player.x, minX, maxX);
        player.y = clamp(player.y, minY, maxY);
      }

      // Combo — prioritize merged rings, then cross-ring pairs
      let activeCombo: import("./types").ComboEffect | null = null;
      const ownedRings = player.rings.filter((r): r is Ring => r !== null);
      for (const ring of ownedRings) {
        if (ring.secondElement) {
          const c = getCombo(ring.element, ring.secondElement);
          if (c) { activeCombo = c; break; }
        }
      }
      if (!activeCombo && ownedRings.length >= 2) {
        for (let i = 0; i < ownedRings.length && !activeCombo; i++) {
          for (let j = i + 1; j < ownedRings.length && !activeCombo; j++) {
            activeCombo = getCombo(ownedRings[i].element, ownedRings[j].element);
          }
        }
      }
      s.activeCombo = activeCombo;
      if (activeCombo?.type === "regen") player.regenRate = activeCombo.value;

      if (activeCombo?.type === "pull") {
        for (const e of s.enemies) {
          if (e.dead) continue;
          const d = Math.sqrt((player.x - e.x) ** 2 + (player.y - e.y) ** 2);
          if (d < 250 && d > 30) {
            const [nx, ny] = normalize(player.x - e.x, player.y - e.y);
            e.x += nx * activeCombo.value * dt * 0.3;
            e.y += ny * activeCombo.value * dt * 0.3;
          }
        }
      }

      // Fire
      fireSlotProjectile(player, s.projectiles, 0, lmbTimerRef, dt, lmbRef.current);
      fireSlotProjectile(player, s.projectiles, 1, rmbTimerRef, dt, rmbRef.current);

      // Auto-auras
      auraTimersRef.current = tickAuras(player, s.projectiles, auraTimersRef.current, dt);

      // Update
      const rw = room?.width ?? 1000;
      const rh = room?.height ?? 750;
      updateEnemies(s.enemies, player, s.projectiles, rw, rh, dt);
      updateProjectiles(s.projectiles, rw, rh, dt);
      const { kills } = checkCollisions(player, s.enemies, s.projectiles, s.particles, s.damageNumbers, s.xpOrbs, activeCombo);

      s.killsTotal += kills;
      if (kills > 0) {
        const isBossKill = s.enemies.some(e => e.dead && e.behavior === "boss" && e.hp <= 0);
        s.camera.shakeTimer = isBossKill ? 0.4 : 0.1;
      }

      if (room) {
        const obsKills = checkObstacleCollisions(s.projectiles, room.obstacles, s.enemies, s.particles, s.damageNumbers, s.xpOrbs);
        s.killsTotal += obsKills;
        checkPlayerObstacles(player, room.obstacles, s.enemies, dt);
      }

      collectXpOrbs(player, s.xpOrbs, dt, player.passiveXpMagnet);
      updateParticles(s.particles, dt);

      // Walking dust particles
      const isMoving = keys.has("w") || keys.has("ц") || keys.has("s") || keys.has("ы") || keys.has("a") || keys.has("ф") || keys.has("d") || keys.has("в");
      if (isMoving && Math.random() < 0.4) {
        s.particles.push({
          x: player.x + (Math.random() - 0.5) * 8,
          y: player.y + 14 + Math.random() * 4,
          vx: (Math.random() - 0.5) * 20,
          vy: -Math.random() * 15 - 5,
          life: 0.3 + Math.random() * 0.2,
          maxLife: 0.5,
          color: "rgba(120,120,120,0.5)",
          size: 1 + Math.random() * 2,
        });
      }

      // Ambient floating dust
      if (room && Math.random() < 0.08) {
        s.particles.push({
          x: room.width * Math.random(),
          y: room.height * Math.random(),
          vx: (Math.random() - 0.5) * 8,
          vy: -Math.random() * 4 - 1,
          life: 2 + Math.random(),
          maxLife: 3,
          color: "rgba(200,200,220,0.15)",
          size: 0.5 + Math.random(),
        });
      }

      for (const n of s.damageNumbers) n.life -= dt;
      s.damageNumbers = s.damageNumbers.filter(n => n.life > 0);
      s.particles = s.particles.filter(p => p.life > 0);
      s.projectiles = s.projectiles.filter(p => p.hp > 0);
      s.xpOrbs = s.xpOrbs.filter(o => !o.collected);

      // Level up
      if (player.xp >= player.maxXp) {
        player.xp -= player.maxXp;
        player.playerLevel += 1;
        player.maxXp = Math.round(player.maxXp * 1.35);
        const ups = generateUpgrades(player, stageIndex % STAGES.length);
        s.availableUpgrades = ups;
        s.screen = "upgrade";
        setScreen("upgrade");
        setUpgrades(ups);
        setPlayerLevel(player.playerLevel);
        addLog(`Уровень ${player.playerLevel}! Выбери улучшение.`);
      }

      // Room cleared
      const aliveEnemies = s.enemies.filter(e => !e.dead).length;
      if (aliveEnemies === 0 && room && !room.cleared && room.type !== "start" && room.type !== "treasure" && room.type !== "exit") {
        room.cleared = true;
        if (room.type === "boss") {
          addLog("Босс повержен! Дверь к порталу открыта.");
        }
        if (room.type === "event" && room.event) {
          if (room.event.type === "trap") {
            player.buffs.push({ type: "damage", value: 0.15, remaining: 60 });
            addLog("Ловушка пройдена! +15% урон на 60с.");
          }
          if (room.event.type === "speed_trial" && room.event.timer !== undefined && room.event.timer > 0) {
            player.buffs.push({ type: "speed", value: 0.3, remaining: 45 });
            addLog("Испытание пройдено! +30% скорость атаки на 45с!");
          }
          room.event.active = false;
        }
      }

      // Speed trial timer
      if (room?.type === "event" && room.event?.type === "speed_trial" && room.event.timer !== undefined && room.event.timer > 0 && !room.cleared) {
        room.event.timer -= dt;
        if (room.event.timer <= 0) {
          room.event.timer = 0;
          room.cleared = true;
          room.event.active = false;
          addLog("Время вышло! Испытание провалено.");
        }
      }

      // Exit portal — player steps into center of exit room
      if (room && room.type === "exit") {
        const portalX = room.width / 2;
        const portalY = room.height / 2;
        const distToPortal = Math.sqrt((player.x - portalX) ** 2 + (player.y - portalY) ** 2);
        if (distToPortal < PORTAL_INTERACT_RADIUS) {
          const nextStage = stageIndex + 1;
          const wrappedStage = nextStage % STAGES.length;
          const newCycle = Math.floor(nextStage / STAGES.length);
          s.level = nextStage;
          if (newCycle > cycle) {
            setCycle(newCycle);
          }
          setStageIndex(nextStage);
          const stageConf = STAGES[wrappedStage];
          s.map = generateMap(stageConf.roomCount + newCycle * 2);
          s.currentRoom = { x: 0, y: 0 };
          s.map["0,0"].visited = true;
          s.map["0,0"].cleared = true;
          s.enemies = [];
          s.projectiles = [];
          s.xpOrbs = [];
          s.particles = [];
          const newStart = s.map["0,0"];
          player.x = newStart.width / 2;
          player.y = newStart.height / 2;
          s.enteredFrom = null;
          enterRoom(0, 0);
          addLog(`— ${stageConf.nameRu}: ${stageConf.description}`);
        }
      }

      checkDoor(player, room);

      if (player.hp <= 0) {
        s.screen = "gameover";
        setScreen("gameover");
        addLog("Ветер стих. Ты пал.");
      }

      // Screen shake (used by 3D camera)
      const cam = s.camera;
      if (cam.shakeTimer > 0) {
        cam.shakeTimer -= dt;
        const intensity = cam.shakeTimer * 20;
        cam.shakeX = (Math.random() - 0.5) * intensity;
        cam.shakeY = (Math.random() - 0.5) * intensity;
      } else {
        cam.shakeX = 0;
        cam.shakeY = 0;
      }

      // HUD sync
      if (Math.floor(s.gameTime * 60) % 4 === 0) {
        setHpDisplay({ hp: Math.round(player.hp), maxHp: player.maxHp });
        setStaminaDisplay({ stamina: Math.round(player.stamina), maxStamina: player.maxStamina });
        setXpDisplay({ xp: player.xp, maxXp: player.maxXp });
        setDashDisplay({ charges: player.dashCharges, maxCharges: player.dashMaxCharges });
        setActiveRings([...player.rings]);
        setKillsTotal(s.killsTotal);

        const boss = s.enemies.find(e => !e.dead && (e.behavior.startsWith("boss") || e.behavior === "miniboss"));
        if (boss) {
          const bTmpl = BOSS_TEMPLATES[boss.type];
          const bName = bTmpl?.nameRu ?? boss.type;
          setBossInfo({ name: bName, hp: Math.round(boss.hp), maxHp: boss.maxHp });
        } else {
          setBossInfo(null);
        }

        const mm: Record<string, { visited: boolean; type: string; current: boolean }> = {};
        for (const k of Object.keys(s.map)) {
          const r = s.map[k];
          if (r.visited || isAdjacentToVisited(k, s.map)) {
            mm[k] = { visited: r.visited, type: r.type, current: k === `${s.currentRoom.x},${s.currentRoom.y}` };
          }
        }
        setMapState(mm);

        if (activeCombo) { setComboName(activeCombo.name); setComboDesc(activeCombo.description); }
        else { setComboName(null); setComboDesc(null); }
      }

    }

    function isAdjacentToVisited(key: string, map: Record<string, Room>): boolean {
      const [x, y] = key.split(",").map(Number);
      return (map[`${x-1},${y}`]?.visited || map[`${x+1},${y}`]?.visited || map[`${x},${y-1}`]?.visited || map[`${x},${y+1}`]?.visited) ?? false;
    }

    frameRef.current = requestAnimationFrame(gameLoop);

    return () => {
      cancelAnimationFrame(frameRef.current);
      window.removeEventListener("resize", resize);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("contextmenu", onContextMenu);
    };
  }, [stageIndex]);

  const handleSelectUpgrade = useCallback((upg: Upgrade) => {
    setSelectedUpgrade(upg);
    setComboMerge(false);
  }, []);

  const handleConfirmUpgrade = useCallback(() => {
    if (!selectedUpgrade) return;
    const s = stateRef.current;

    // Track which ring was the merge partner before apply
    const mergePartnerElement = comboMerge && selectedUpgrade.possibleCombo
      ? selectedUpgrade.possibleCombo.partnerElement : null;

    applyUpgrade(s.player, selectedUpgrade, comboMerge);

    if (comboMerge && mergePartnerElement && selectedUpgrade.possibleCombo) {
      // Remove old individual ring entries that were consumed in the merge
      setAppliedUpgrades(prev => {
        const cleaned = prev.filter(u => {
          if (u.type !== "ring" || !u.ring) return true;
          // Remove entry for the partner ring that was consumed
          return u.ring.element !== mergePartnerElement;
        });
        // Add merged combo entry
        const comboUpgrade: Upgrade = {
          ...selectedUpgrade,
          name: selectedUpgrade.possibleCombo!.comboName,
          description: `Слияние: ${ELEMENT_NAMES_RU[selectedUpgrade.ring!.element]} + ${ELEMENT_NAMES_RU[mergePartnerElement]}\n${selectedUpgrade.possibleCombo!.comboDesc}`,
          icon: "⚡",
        };
        return [...cleaned, comboUpgrade];
      });
    } else {
      setAppliedUpgrades(prev => [...prev, selectedUpgrade]);
    }

    s.screen = "playing";
    setScreen("playing");
    setSelectedUpgrade(null);
    setComboMerge(false);
    setActiveRings([...s.player.rings]);

    // Recompute active combo from merged rings
    let newCombo = null;
    for (const ring of s.player.rings) {
      if (!ring || !ring.secondElement) continue;
      const c = getCombo(ring.element, ring.secondElement);
      if (c) { newCombo = c; break; }
    }
    if (!newCombo) {
      // Fallback: check pairs of different rings
      const owned = s.player.rings.filter((r): r is Ring => r !== null);
      for (let i = 0; i < owned.length && !newCombo; i++) {
        for (let j = i + 1; j < owned.length && !newCombo; j++) {
          newCombo = getCombo(owned[i].element, owned[j].element);
        }
      }
    }
    if (newCombo) {
      s.activeCombo = newCombo;
      setComboName(newCombo.name);
      setComboDesc(newCombo.description);
      if (comboMerge) addLog(`Комбо: ${newCombo.name} — ${newCombo.description}`);
    }
  }, [addLog, selectedUpgrade, comboMerge]);

  // Minimap bounds
  const minimapBounds = (() => {
    const keys = Object.keys(mapState);
    if (keys.length === 0) return { minX: 0, maxX: 0, minY: 0, maxY: 0 };
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (const k of keys) {
      const [x, y] = k.split(",").map(Number);
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
    return { minX, maxX, minY, maxY };
  })();

  return (
    <div className="game-root">
      {/* === START SCREEN === */}
      {screen === "start" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0f]">
          <div className="flex flex-col items-center gap-6 animate-fadeIn">
            <h1 className="text-5xl font-bold tracking-widest" style={{ fontFamily: "'Cinzel', serif", textShadow: "0 0 30px #2dd4bf33" }}>
              RINGFORGED
            </h1>
            <p className="text-lg text-[#94a3b8] text-center max-w-md">
              Рогалик по вселенной «Повелитель Колец».<br />
              Выживай. Собирай кольца. Раскрой заговор.
            </p>
            <button onClick={startGame} className="px-8 py-3 rounded-lg bg-[#2dd4bf] text-[#0a0a0f] font-bold text-lg hover:bg-[#5eead4] transition-all hover:scale-105 active:scale-95">
              Начать
            </button>
            <div className="text-sm text-[#475569] mt-4">
              WASD — движение &nbsp;|&nbsp; ЛКМ — кольцо 1 &nbsp;|&nbsp; ПКМ — кольцо 2 &nbsp;|&nbsp; Shift — рывок &nbsp;|&nbsp; C — инвентарь
            </div>
          </div>
        </div>
      )}

      {/* === RING CHOICE === */}
      {screen === "ringChoice" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0a0a0f]">
          <div className="flex flex-col items-center gap-8 animate-fadeIn">
            <h2 className="text-3xl font-bold tracking-wide text-[#e2e8f0]">Выбери первое кольцо</h2>
            <p className="text-[#94a3b8] text-center max-w-md">Твоё оружие определит стиль боя. Выбирай мудро.</p>
            <div className="flex gap-6">
              {startingRings.map((ring) => (
                <button
                  key={ring.id}
                  onClick={() => pickStartingRing(ring)}
                  className="ring-choice-card group"
                  style={{ "--ring-color": ELEMENT_COLORS[ring.element] } as React.CSSProperties}
                >
                  <div className="ring-choice-icon" style={{ background: ELEMENT_COLORS[ring.element], boxShadow: `0 0 20px ${ELEMENT_COLORS[ring.element]}44` }}>
                    <span className="text-2xl">💍</span>
                  </div>
                  <div className="ring-choice-name" style={{ color: ELEMENT_COLORS[ring.element] }}>{ring.name}</div>
                  <div className="ring-choice-element">{ELEMENT_NAMES_RU[ring.element]}</div>
                  <div className="ring-choice-desc">Снаряд стихии {ELEMENT_NAMES_RU[ring.element]}<br/>ЛКМ для атаки</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === THREE.JS CANVAS (fullscreen) === */}
      <div className="game-canvas" style={{ cursor: screen === "playing" ? "crosshair" : "default" }}>
        <Canvas
          shadows
          camera={{ fov: 50, near: 1, far: 5000, position: [500, 600, 800] }}
          gl={{ antialias: true, toneMapping: 3, toneMappingExposure: 1.0 }}
          onContextMenu={(e) => e.preventDefault()}
          style={{ width: "100%", height: "100%" }}
        >
          <GameScene stateRef={stateRef} mouseScreenRef={mouseScreenRef} cameraAngleRef={cameraAngleRef} aimWorldRef={aimWorldRef} />
        </Canvas>
      </div>

      {/* === LOADING OVERLAY === */}
      {assetsLoading && screen === "playing" && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a14 100%)",
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: "16px",
        }}>
          <div style={{
            width: "200px", height: "6px", borderRadius: "3px",
            background: "rgba(255,255,255,0.1)", overflow: "hidden",
          }}>
            <div className="loading-bar-fill" style={{
              width: "60%", height: "100%", borderRadius: "3px",
              background: "linear-gradient(90deg, #fbbf24, #f59e0b)",
              animation: "loadingPulse 1.2s ease-in-out infinite",
            }} />
          </div>
          <span style={{
            color: "#a0a0b0", fontFamily: "Cinzel, serif",
            fontSize: "14px", letterSpacing: "2px",
          }}>Загрузка...</span>
        </div>
      )}

      {/* === HUD OVERLAY === */}
      {screen === "playing" && (
        <>
          {/* Top bar: stage + cycle + level */}
          <div className="hud-top-bar">
            <div className="flex items-center gap-2">
              <span className="stage-label">Этаж {stageIndex + 1}</span>
              {cycle > 0 && <span className="text-[10px] text-[#f87171] font-bold">Цикл {cycle + 1}</span>}
              <span className="text-xs font-bold text-[#fbbf24]">{STAGES[stageIndex % STAGES.length]?.nameRu}</span>
            </div>
            <span className="text-xs text-[#64748b]">Ур. {playerLevel}</span>
          </div>

          {/* Boss bar */}
          {bossInfo && (
            <div className="hud-boss-bar">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs font-bold text-[#f87171]">{bossInfo.name}</span>
                <span className="text-[10px] text-[#94a3b8]">{bossInfo.hp}/{bossInfo.maxHp}</span>
              </div>
              <div className="boss-bar-bg">
                <div className="boss-bar-fill" style={{ width: `${Math.max(0, (bossInfo.hp / bossInfo.maxHp) * 100)}%` }} />
              </div>
            </div>
          )}

          {/* Left bottom: rings + bars */}
          <div className="hud-bottom-left">
            <div className="hud-ring-column">
              {activeRings.map((ring, i) => {
                const color = ring ? ELEMENT_COLORS[ring.element] : "#334155";
                const isCombo = ring?.comboName;
                const color2 = ring?.secondElement ? ELEMENT_COLORS[ring.secondElement] : undefined;
                return (
                  <div key={i} className={`ring-slot ${ring ? "active" : ""} ${isCombo ? "combo" : ""}`}
                    style={{ "--ring-color": isCombo ? "#fbbf24" : color, "--glow-color": ring ? (isCombo ? "#fbbf2466" : color + "66") : "transparent" } as React.CSSProperties}
                    title={ring ? `${ring.name} (ур. ${ring.level})` : "Пусто"}>
                    <span className="ring-key">{SLOT_LABELS[i]}</span>
                    {ring ? (
                      <>
                        {isCombo ? (
                          <div className="ring-icon-combo">
                            <div className="ring-icon-half" style={{ background: color }} />
                            <div className="ring-icon-half" style={{ background: color2 }} />
                          </div>
                        ) : (
                          <div className="ring-icon" style={{ "--ring-color": color } as React.CSSProperties} />
                        )}
                        <span className="ring-level">{ring.level}</span>
                      </>
                    ) : (
                      <div className="w-5 h-5 rounded border border-dashed border-[#334155]" />
                    )}
                  </div>
                );
              })}
            </div>

            <div className="hud-bars">
              <div className="hud-bar-row">
                <span className="hud-bar-label hp">HP</span>
                <div className="hud-bar-bg hud-bar-hp">
                  <div className="hud-bar-fill" style={{ width: `${Math.max(0, (hpDisplay.hp / hpDisplay.maxHp) * 100)}%` }} />
                </div>
                <span className="hud-bar-val">{hpDisplay.hp}/{hpDisplay.maxHp}</span>
              </div>
              <div className="hud-bar-row">
                <span className="hud-bar-label sp">SP</span>
                <div className="hud-bar-bg hud-bar-stamina">
                  <div className="hud-bar-fill" style={{ width: `${Math.max(0, (staminaDisplay.stamina / staminaDisplay.maxStamina) * 100)}%` }} />
                </div>
                <span className="hud-bar-val">{staminaDisplay.stamina}/{staminaDisplay.maxStamina}</span>
                <span className="hud-dash-indicator" title="Рывок (Shift)">
                  {Array.from({ length: dashDisplay.maxCharges }).map((_, i) => (
                    <span key={i} style={{ opacity: i < dashDisplay.charges ? 1 : 0.25, marginLeft: 1 }}>⚡</span>
                  ))}
                </span>
              </div>
              <div className="hud-bar-row">
                <span className="hud-bar-label xp">XP</span>
                <div className="hud-bar-bg hud-bar-xp">
                  <div className="hud-bar-fill" style={{ width: `${Math.max(0, (xpDisplay.xp / xpDisplay.maxXp) * 100)}%` }} />
                </div>
                <span className="hud-bar-val">{xpDisplay.xp}/{xpDisplay.maxXp}</span>
              </div>
            </div>
          </div>

          {/* Minimap — top right */}
          <div className="hud-minimap">
            <div style={{ display: "grid", gridTemplateColumns: `repeat(${minimapBounds.maxX - minimapBounds.minX + 1}, 14px)`, gap: "2px" }}>
              {Array.from({ length: (minimapBounds.maxY - minimapBounds.minY + 1) * (minimapBounds.maxX - minimapBounds.minX + 1) }).map((_, i) => {
                const cols = minimapBounds.maxX - minimapBounds.minX + 1;
                const gx = minimapBounds.minX + (i % cols);
                const gy = minimapBounds.minY + Math.floor(i / cols);
                const key = `${gx},${gy}`;
                const cell = mapState[key];
                if (!cell) return <div key={key} className="minimap-cell unvisited" />;
                const cls = cell.current ? "current" :
                  cell.type === "boss" && cell.visited ? "boss" :
                  cell.type === "exit" && cell.visited ? "exit" :
                  cell.type === "elite" && cell.visited ? "elite" :
                  cell.type === "treasure" && cell.visited ? "treasure" :
                  cell.type === "event" && cell.visited ? "treasure" :
                  cell.visited ? "visited" : "unvisited";
                return <div key={key} className={`minimap-cell ${cls}`} />;
              })}
            </div>
          </div>

          {/* Bottom right: kills */}
          <div className="hud-bottom-right">
            <span className="text-[10px] text-[#64748b] uppercase tracking-wider">Убийства</span>
            <span className="text-lg font-bold text-[#f87171]">{killsTotal}</span>
          </div>

          {/* Combo badge — bottom center */}
          {comboName && (
            <div className="hud-combo">
              <div className="combo-badge">⚡ {comboName}</div>
            </div>
          )}

          {/* Inventory hint */}
          <div className="hud-inventory-hint">
            <span className="text-[10px] text-[#475569]">[C] Инвентарь</span>
          </div>

          {/* Inventory overlay */}
          {showInventory && (
            <div className="inventory-overlay animate-fadeIn" onClick={() => setShowInventory(false)}>
              <div className="inventory-panel" onClick={e => e.stopPropagation()}>
                <div className="inventory-header">
                  <h2 className="text-xl font-bold text-[#e2e8f0]" style={{ fontFamily: "'Cinzel', serif" }}>Инвентарь</h2>
                  <button className="inventory-close" onClick={() => setShowInventory(false)}>✕</button>
                </div>

                {/* Stats */}
                <div className="inventory-section">
                  <h3 className="inventory-section-title">Характеристики</h3>
                  <div className="inventory-stats-grid">
                    <div className="inv-stat"><span className="inv-stat-label">HP</span><span className="inv-stat-val text-[#ef4444]">{hpDisplay.hp}/{hpDisplay.maxHp}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Стамина</span><span className="inv-stat-val text-[#3b82f6]">{staminaDisplay.stamina}/{staminaDisplay.maxStamina}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Уровень</span><span className="inv-stat-val text-[#fbbf24]">{playerLevel}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Скорость атаки</span><span className="inv-stat-val">×{stateRef.current.player.attackSpeed.toFixed(2)}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Множитель урона</span><span className="inv-stat-val">×{stateRef.current.player.damageMult.toFixed(2)}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Скорость снарядов</span><span className="inv-stat-val">×{stateRef.current.player.projectileSpeedMult.toFixed(2)}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Кол-во снарядов</span><span className="inv-stat-val">{stateRef.current.player.projectileCount}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Регенерация</span><span className="inv-stat-val text-[#4ade80]">{stateRef.current.player.regenRate.toFixed(1)}/с</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">XP</span><span className="inv-stat-val text-[#a78bfa]">{xpDisplay.xp}/{xpDisplay.maxXp}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Убийства</span><span className="inv-stat-val text-[#f87171]">{killsTotal}</span></div>
                    <div className="inv-stat"><span className="inv-stat-label">Этаж</span><span className="inv-stat-val">{stageIndex + 1}{cycle > 0 ? ` (цикл ${cycle + 1})` : ""}</span></div>
                  </div>
                </div>

                {/* Elemental Core */}
                {stateRef.current.player.elementalCore && (
                  <div className="inventory-section">
                    <h3 className="inventory-section-title">Стихийное ядро</h3>
                    <div className="inv-core-card" style={{ "--core-color": ELEMENT_COLORS[stateRef.current.player.elementalCore.element] } as React.CSSProperties}>
                      <span className="inv-core-element">{ELEMENT_NAMES_RU[stateRef.current.player.elementalCore.element]}</span>
                      <span className="inv-core-bonus">+{(stateRef.current.player.elementalCore.damageBonus * 100).toFixed(0)}% урон стихии</span>
                    </div>
                  </div>
                )}

                {/* Rings */}
                <div className="inventory-section">
                  <h3 className="inventory-section-title">Кольца</h3>
                  <div className="inventory-rings">
                    {activeRings.map((ring, i) => (
                      <div key={i} className={`inv-ring-card ${ring ? "active" : ""}`}
                        style={ring ? { "--ring-color": ELEMENT_COLORS[ring.element] } as React.CSSProperties : undefined}>
                        <span className="inv-ring-slot">{SLOT_LABELS[i]}</span>
                        {ring ? (
                          <>
                            <span className="inv-ring-name" style={{ color: ring.comboName ? "#fbbf24" : ELEMENT_COLORS[ring.element] }}>
                              {ring.comboName ? `⚡ ${ring.name}` : ring.name}
                            </span>
                            <span className="inv-ring-detail">
                              ур. {ring.level} • {ELEMENT_NAMES_RU[ring.element]}
                              {ring.secondElement ? ` + ${ELEMENT_NAMES_RU[ring.secondElement]}` : ""}
                              {" • "}{ring.rank}
                            </span>
                          </>
                        ) : (
                          <span className="inv-ring-empty">Пусто</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active combo */}
                {comboName && (
                  <div className="inventory-section">
                    <h3 className="inventory-section-title">Активное комбо</h3>
                    <div className="inv-combo-card">
                      <span className="text-[#fbbf24] font-bold text-sm">⚡ {comboName}</span>
                      <span className="text-[#94a3b8] text-xs">{comboDesc}</span>
                    </div>
                  </div>
                )}

                {/* Applied upgrades history */}
                {appliedUpgrades.length > 0 && (
                  <div className="inventory-section">
                    <h3 className="inventory-section-title">Полученные улучшения ({appliedUpgrades.length})</h3>
                    <div className="inv-upgrades-list">
                      {appliedUpgrades.map((u, i) => (
                        <div key={i} className="inv-upgrade-item" style={{ "--rarity-color": RARITY_COLORS[u.rarity] } as React.CSSProperties}>
                          <span className="inv-upgrade-icon">{u.icon}</span>
                          <div className="inv-upgrade-info">
                            <span className="inv-upgrade-name">{u.name}</span>
                            <span className="inv-upgrade-desc">{u.description}</span>
                          </div>
                          <span className="inv-upgrade-rarity" style={{ color: RARITY_COLORS[u.rarity] }}>{RARITY_NAMES_RU[u.rarity]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Active buffs */}
                {stateRef.current.player.buffs.length > 0 && (
                  <div className="inventory-section">
                    <h3 className="inventory-section-title">Активные бафы</h3>
                    <div className="inv-buffs">
                      {stateRef.current.player.buffs.map((b, i) => (
                        <div key={i} className="inv-buff-item">
                          <span className="text-xs font-bold text-[#4ade80]">
                            {b.type === "damage" ? "⚔ Урон" : b.type === "speed" ? "💨 Скорость" : "❤ Реген"}
                          </span>
                          <span className="text-[10px] text-[#94a3b8]">+{(b.value * 100).toFixed(0)}% • {b.remaining.toFixed(1)}с</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* === UPGRADE SCREEN === */}
      {screen === "upgrade" && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center upgrade-backdrop animate-fadeIn">
          <div className="upgrade-vignette" />
          <div className="relative z-10 flex flex-col items-center gap-5">
            <div className="text-center">
              <div className="upgrade-level-badge">УР. {playerLevel}</div>
              <h2 className="text-2xl font-bold mt-2 tracking-wide" style={{ fontFamily: "'Cinzel', serif", color: "#fde68a" }}>
                Дар Кузнеца
              </h2>
              <p className="text-sm text-[#94a3b8] mt-1">Выбери улучшение</p>
            </div>

            <div className="flex gap-5">
              {upgrades.map(u => {
                const isSelected = selectedUpgrade?.id === u.id;
                const ringColor = u.ring ? ELEMENT_COLORS[u.ring.element] : undefined;
                const rarityColor = RARITY_COLORS[u.rarity];
                const typeAccent = u.type === "ring" || u.type === "core" ? ringColor : u.type === "ringLevelUp" ? "#fbbf24" : "#4ade80";
                const typeLabel = u.type === "ring" ? "КОЛЬЦО" : u.type === "core" ? "ЯДРО" : u.type === "ringLevelUp" ? "УСИЛЕНИЕ" : "СТАТ";

                return (
                  <button key={u.id} onClick={() => handleSelectUpgrade(u)}
                    className={`upgrade-card ${isSelected ? "selected" : ""} rarity-${u.rarity}`}
                    style={{ "--card-accent": typeAccent ?? "#2dd4bf", "--rarity-color": rarityColor } as React.CSSProperties}>

                    {/* Type badge */}
                    <div className="upgrade-card-type" style={{ background: typeAccent ?? "#2dd4bf" }}>{typeLabel}</div>

                    {/* Rarity */}
                    <div className="upgrade-card-rarity" style={{ color: rarityColor }}>{RARITY_NAMES_RU[u.rarity]}</div>

                    {/* Icon + element color ring */}
                    <div className="upgrade-card-icon-wrap" style={{ "--icon-glow": ringColor ?? typeAccent ?? "#2dd4bf" } as React.CSSProperties}>
                      <span className="upgrade-card-icon">{u.icon}</span>
                    </div>

                    {/* Name */}
                    <div className="upgrade-card-name">{u.name}</div>

                    {/* Element tag for rings */}
                    {u.ring && (
                      <div className="upgrade-card-element" style={{ color: ELEMENT_COLORS[u.ring.element], borderColor: ELEMENT_COLORS[u.ring.element] + "55" }}>
                        {ELEMENT_NAMES_RU[u.ring.element]}
                      </div>
                    )}

                    <div className="upgrade-card-divider" />

                    {/* Description — multiline support */}
                    <div className="upgrade-card-desc">
                      {u.description.split("\n").map((line, li) => (
                        <div key={li} className={li === 0 ? "text-[#94a3b8]" : "text-[#64748b]"}>{line}</div>
                      ))}
                    </div>

                    {/* Combo section — always visible, prominent */}
                    {u.type === "ring" && u.possibleCombo && (
                      <div className="upgrade-combo-section" onClick={e => e.stopPropagation()}>
                        <div className="upgrade-combo-header">
                          <span className="upgrade-combo-flash">⚡</span>
                          <span className="upgrade-combo-title">КОМБО ДОСТУПНО</span>
                        </div>
                        <div className="upgrade-combo-name">{u.possibleCombo.comboName}</div>
                        <div className="upgrade-combo-desc">{u.possibleCombo.comboDesc}</div>
                        <div className="upgrade-combo-explain">
                          Это кольцо + {ELEMENT_NAMES_RU[u.possibleCombo.partnerElement]} = пассивный эффект
                        </div>
                        <button
                          className={`upgrade-combo-btn ${isSelected && comboMerge ? "active" : ""}`}
                          onClick={e => {
                            e.stopPropagation();
                            handleSelectUpgrade(u);
                            setComboMerge(prev => !prev);
                          }}>
                          {isSelected && comboMerge ? "✓ Объединить" : "Объединить кольца"}
                        </button>
                        <div className="upgrade-combo-hint">
                          {isSelected && !comboMerge ? "Нажми, чтобы активировать комбо-эффект" : !isSelected ? "Выбери карточку для объединения" : "Комбо будет активировано!"}
                        </div>
                      </div>
                    )}

                    {u.type === "ring" && ringColor && (
                      <div className="upgrade-card-ring-glow" style={{ background: ringColor }} />
                    )}
                  </button>
                );
              })}
            </div>

            <button onClick={handleConfirmUpgrade} disabled={!selectedUpgrade}
              className={`upgrade-confirm-btn ${selectedUpgrade ? "ready" : ""}`}>
              {selectedUpgrade ? "Принять" : "Выбери улучшение"}
            </button>
          </div>
        </div>
      )}

      {/* === GAME OVER === */}
      {screen === "gameover" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fadeIn upgrade-backdrop">
          <div className="upgrade-vignette" />
          <div className="relative z-10 text-center">
            <h2 className="text-4xl font-bold text-[#f87171] mb-2" style={{ fontFamily: "'Cinzel', serif" }}>Поражение</h2>
            <p className="text-[#94a3b8] mb-4">Ветер стих. Но кольца помнят.</p>
            <div className="flex gap-6 justify-center mb-6 text-sm">
              <div className="text-center">
                <div className="text-2xl font-bold text-[#fbbf24]">{playerLevel}</div>
                <div className="text-[10px] text-[#64748b] uppercase tracking-wider">Уровень</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#2dd4bf]">{stageIndex + 1}</div>
                <div className="text-[10px] text-[#64748b] uppercase tracking-wider">Этаж</div>
              </div>
              {cycle > 0 && (
                <div className="text-center">
                  <div className="text-2xl font-bold text-[#f87171]">{cycle + 1}</div>
                  <div className="text-[10px] text-[#64748b] uppercase tracking-wider">Цикл</div>
                </div>
              )}
              <div className="text-center">
                <div className="text-2xl font-bold text-[#a78bfa]">{activeRings.filter(r => r).length}</div>
                <div className="text-[10px] text-[#64748b] uppercase tracking-wider">Колец</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-[#f97316]">{killsTotal}</div>
                <div className="text-[10px] text-[#64748b] uppercase tracking-wider">Убийств</div>
              </div>
            </div>
            <button onClick={startGame} className="px-8 py-3 rounded-lg bg-[#2dd4bf] text-[#0a0a0f] font-bold hover:bg-[#5eead4] transition-all">
              Заново
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
