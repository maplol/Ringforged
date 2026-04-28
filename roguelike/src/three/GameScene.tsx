import React, { useRef, useMemo, useEffect, Suspense } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { EffectComposer, SSAO, Vignette, Bloom } from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";
import * as THREE from "three";
import type {
  GameState, Room, Enemy, Projectile, Particle,
  DamageNumber, XpOrb, PlayerState, Obstacle,
} from "../types";
import { ElementType } from "../types";
import { WALL_THICKNESS, DOOR_WIDTH, ELEMENT_COLORS } from "../constants";

/* ================================================================
   COORDINATE SYSTEM
   Game: X right, Y down (2D top-down)
   Three.js: X right, Z "down" (forward into screen), Y up
   Mapping: threeX = gameX, threeZ = gameY, threeY = height
   ================================================================ */

function gameToThree(gx: number, gy: number, height = 0): [number, number, number] {
  return [gx, height, gy];
}

/* ================================================================
   SPRITE TEXTURE LOADING (shared with old renderer sprite paths)
   ================================================================ */
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
  "ignis_soldier", "ignis_berserker", "ignis_sniper",
  "cultist_tank", "necromancer", "magnetist", "illusionist",
  "bombardier", "ghost_mage", "elite_berserker", "void_sentinel",
  "general", "director_ignis", "captain_dol", "admiral_oblivion",
]);

const textureLoader = new THREE.TextureLoader();
const textureCache = new Map<string, THREE.Texture>();

const ALL_SPRITE_PATHS = [
  PLAYER_SPRITE,
  ...Object.values(ENEMY_SPRITE_MAP).map(f => SPRITE_DIR + f),
  ...Object.values(BOSS_SPRITE_MAP).map(f => SPRITE_DIR + f),
  SPRITE_DIR + "vlad_idle.webp",
  SPRITE_DIR + "vlad_walk.webp",
  SPRITE_DIR + "vlad_attack.webp",
  SPRITE_DIR + "boss_general_idle.webp",
  SPRITE_DIR + "boss_morven_idle.webp",
  SPRITE_DIR + "boss_kael_idle.webp",
];
const uniqueSpritePaths = [...new Set(ALL_SPRITE_PATHS)];

export function preloadAllTextures(): Promise<void> {
  getFloorTexture();
  getWallTexture();

  const promises = uniqueSpritePaths.map(path => {
    if (textureCache.has(path)) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const tex = textureLoader.load(path, () => resolve(), undefined, () => resolve());
      tex.minFilter = THREE.NearestFilter;
      tex.magFilter = THREE.NearestFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      textureCache.set(path, tex);
    });
  });
  return Promise.all(promises).then(() => {});
}

function getTexture(path: string): THREE.Texture {
  let tex = textureCache.get(path);
  if (tex) return tex;
  tex = textureLoader.load(path);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(path, tex);
  return tex;
}

function getEnemySpriteTexture(type: string, behavior: string): THREE.Texture | null {
  const isBoss = behavior.startsWith("boss");
  const map = isBoss ? BOSS_SPRITE_MAP : ENEMY_SPRITE_MAP;
  const file = map[type];
  if (!file) return null;
  return getTexture(SPRITE_DIR + file);
}

function hexToColor(hex: string): THREE.Color {
  return new THREE.Color(hex);
}

/* ================================================================
   LIGHT SOURCE GENERATION (adapted from renderer.ts collectLightSources)
   ================================================================ */

interface LightDef {
  x: number; y: number;
  radius: number; intensity: number;
  color: THREE.Color;
}

function collectLights(room: Room): LightDef[] {
  const lights: LightDef[] = [];
  const w = room.width, h = room.height;
  const WT = WALL_THICKNESS;
  const cx = w / 2, cy = h / 2;
  const cornerOff = 40;
  const TORCH_R = 220, TORCH_I = 0.8;
  const warm = new THREE.Color(1.0, 0.85, 0.6);

  const addTorch = (x: number, y: number) => {
    lights.push({ x, y, radius: TORCH_R, intensity: TORCH_I, color: warm.clone() });
  };

  addTorch(WT + cornerOff, WT + 4);
  addTorch(w - WT - cornerOff, WT + 4);
  addTorch(WT + cornerOff, h - WT - 4);
  addTorch(w - WT - cornerOff, h - WT - 4);
  addTorch(WT + 4, WT + cornerOff);
  addTorch(WT + 4, h - WT - cornerOff);
  addTorch(w - WT - 4, WT + cornerOff);
  addTorch(w - WT - 4, h - WT - cornerOff);

  if (room.doors.top) {
    addTorch(cx - DOOR_WIDTH / 2 - 20, WT + 4);
    addTorch(cx + DOOR_WIDTH / 2 + 20, WT + 4);
  }
  if (room.doors.bottom) {
    addTorch(cx - DOOR_WIDTH / 2 - 20, h - WT - 4);
    addTorch(cx + DOOR_WIDTH / 2 + 20, h - WT - 4);
  }
  if (room.doors.left) {
    addTorch(WT + 4, cy - DOOR_WIDTH / 2 - 20);
    addTorch(WT + 4, cy + DOOR_WIDTH / 2 + 20);
  }
  if (room.doors.right) {
    addTorch(w - WT - 4, cy - DOOR_WIDTH / 2 - 20);
    addTorch(w - WT - 4, cy + DOOR_WIDTH / 2 + 20);
  }

  const floorW = w - WT * 2, floorH = h - WT * 2;
  if (floorW > 600 && floorH > 400) {
    if (room.type === "normal" || room.type === "elite" || room.type === "event") {
      lights.push({ x: cx, y: cy, radius: 280, intensity: 0.6, color: warm.clone() });
    }
  }

  if (room.type === "boss") {
    lights.push({ x: cx, y: cy, radius: 350, intensity: 0.7, color: new THREE.Color(1.0, 0.3, 0.2) });
  }
  if (room.type === "treasure") {
    lights.push({ x: cx, y: cy, radius: 200, intensity: 0.9, color: new THREE.Color(1.0, 0.9, 0.4) });
  }
  if (room.type === "exit") {
    lights.push({ x: cx, y: cy, radius: 350, intensity: 1.0, color: new THREE.Color(0.5, 0.7, 1.0) });
  }

  for (const obs of room.obstacles) {
    if (obs.destroyed) continue;
    if (obs.type === "lava") {
      lights.push({ x: obs.x, y: obs.y, radius: 200, intensity: 0.9, color: new THREE.Color(1.0, 0.3, 0.1) });
    } else if (obs.type === "crystal") {
      lights.push({ x: obs.x, y: obs.y, radius: 160, intensity: 0.6, color: new THREE.Color(0.5, 0.85, 1.0) });
    }
  }

  return lights;
}

/* ================================================================
   REUSABLE GEOMETRIES & MATERIALS
   ================================================================ */

const _floorGeo = new THREE.PlaneGeometry(1, 1);
const _wallGeo = new THREE.BoxGeometry(1, 1, 1);
const _spriteGeo = new THREE.PlaneGeometry(1, 1);
const _sphereGeo = new THREE.SphereGeometry(1, 8, 6);
const _cylinderGeo = new THREE.CylinderGeometry(1, 1, 1, 12);
const _octaGeo = new THREE.OctahedronGeometry(1, 0);
const _trimGeo = new THREE.BoxGeometry(1, 1, 1);

function makeStoneFloorTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size; c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#6a5a4a";
  ctx.fillRect(0, 0, size, size);

  const tileSize = 64;
  for (let ty = 0; ty < size; ty += tileSize) {
    for (let tx = 0; tx < size; tx += tileSize) {
      const shade = 90 + Math.random() * 30;
      ctx.fillStyle = `rgb(${shade + 10},${shade},${shade - 10})`;
      ctx.fillRect(tx + 2, ty + 2, tileSize - 4, tileSize - 4);

      ctx.strokeStyle = `rgba(0,0,0,${0.15 + Math.random() * 0.1})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(tx + 1, ty + 1, tileSize - 2, tileSize - 2);

      if (Math.random() < 0.3) {
        ctx.strokeStyle = `rgba(40,30,20,${0.2 + Math.random() * 0.15})`;
        ctx.lineWidth = 1;
        ctx.beginPath();
        const cx = tx + 10 + Math.random() * (tileSize - 20);
        const cy = ty + 10 + Math.random() * (tileSize - 20);
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + (Math.random() - 0.5) * 30, cy + (Math.random() - 0.5) * 30);
        ctx.stroke();
      }

      if (Math.random() < 0.15) {
        ctx.fillStyle = `rgba(80,70,60,${0.3 + Math.random() * 0.2})`;
        ctx.beginPath();
        ctx.arc(tx + Math.random() * tileSize, ty + Math.random() * tileSize, 2 + Math.random() * 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}

function makeBrickWallTexture(): THREE.CanvasTexture {
  const w = 256, h = 128;
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = "#5a4d45";
  ctx.fillRect(0, 0, w, h);

  const brickW = 32, brickH = 16;
  for (let row = 0; row < h / brickH; row++) {
    const offsetX = row % 2 === 0 ? 0 : brickW / 2;
    for (let col = -1; col < w / brickW + 1; col++) {
      const bx = col * brickW + offsetX;
      const by = row * brickH;
      const shade = 75 + Math.random() * 25;
      ctx.fillStyle = `rgb(${shade + 5},${shade - 5},${shade - 15})`;
      ctx.fillRect(bx + 1, by + 1, brickW - 2, brickH - 2);
      ctx.strokeStyle = `rgba(30,20,15,0.4)`;
      ctx.lineWidth = 1;
      ctx.strokeRect(bx + 1, by + 1, brickW - 2, brickH - 2);
    }
  }

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

let _floorTex: THREE.CanvasTexture | null = null;
let _wallTex: THREE.CanvasTexture | null = null;

function getFloorTexture() {
  if (!_floorTex) _floorTex = makeStoneFloorTexture();
  return _floorTex;
}
function getWallTexture() {
  if (!_wallTex) _wallTex = makeBrickWallTexture();
  return _wallTex;
}

const _floorMat = (() => {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.0 });
  try {
    const tex = getFloorTexture();
    m.map = tex;
  } catch { m.color = new THREE.Color(0x6a5a4a); }
  return m;
})();

const _wallMat = (() => {
  const m = new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0.1 });
  try {
    const tex = getWallTexture();
    m.map = tex;
  } catch { m.color = new THREE.Color(0x5a4d45); }
  return m;
})();

const _trimMat = new THREE.MeshStandardMaterial({
  color: 0x3d3530,
  roughness: 0.9,
  metalness: 0.2,
});

const _doorOpenMat = new THREE.MeshStandardMaterial({
  color: 0x22c55e,
  emissive: 0x22c55e,
  emissiveIntensity: 0.5,
  transparent: true,
  opacity: 0.3,
});

const _pillarMat = new THREE.MeshStandardMaterial({ color: 0x6b6560, roughness: 0.8 });
const _barrelMat = new THREE.MeshStandardMaterial({ color: 0x8b6040, roughness: 0.7 });
const _lavaMat = new THREE.MeshStandardMaterial({
  color: 0xff4400,
  emissive: 0xff2200,
  emissiveIntensity: 1.5,
  roughness: 0.3,
});
const _crystalMat = new THREE.MeshStandardMaterial({
  color: 0x66bbff,
  emissive: 0x3388ff,
  emissiveIntensity: 0.8,
  roughness: 0.2,
  metalness: 0.4,
  transparent: true,
  opacity: 0.8,
});

/* ================================================================
   SPRITE ENTITY — a vertical plane with character texture
   Casts pixel-perfect shadows via alphaTest + customDistanceMaterial
   ================================================================ */

const _depthMatCache = new Map<string, THREE.MeshDepthMaterial>();
const _distMatCache = new Map<string, THREE.MeshDistanceMaterial>();

function SpriteEntity({ texturePath, x, z, size, flipX, opacity }: {
  texturePath: string;
  x: number; z: number;
  size: number;
  flipX: boolean;
  opacity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();
  const tex = useMemo(() => getTexture(texturePath), [texturePath]);

  const mat = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      map: tex,
      alphaTest: 0.5,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.0,
    });
  }, [tex]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    let depthMat = _depthMatCache.get(texturePath);
    if (!depthMat) {
      depthMat = new THREE.MeshDepthMaterial({
        map: tex,
        alphaTest: 0.5,
        depthPacking: THREE.RGBADepthPacking,
      });
      _depthMatCache.set(texturePath, depthMat);
    }
    mesh.customDepthMaterial = depthMat;

    let distMat = _distMatCache.get(texturePath);
    if (!distMat) {
      distMat = new THREE.MeshDistanceMaterial({
        map: tex,
        alphaTest: 0.5,
      });
      _distMatCache.set(texturePath, distMat);
    }
    mesh.customDistanceMaterial = distMat;
  }, [tex, texturePath]);

  const halfSize = size / 2;

  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    mesh.position.set(x, halfSize, z);

    const cx = camera.position.x;
    const cz = camera.position.z;
    const yAngle = Math.atan2(cx - x, cz - z);
    mesh.rotation.set(0, yAngle, 0);
    mesh.scale.set(flipX ? -size : size, size, 1);
  });

  return (
    <mesh
      ref={meshRef}
      geometry={_spriteGeo}
      material={mat}
      position={[x, halfSize, z]}
      scale={[flipX ? -size : size, size, 1]}
      castShadow
    />
  );
}

/* ================================================================
   ANIMATED SPRITE ENTITY — spritesheet UV animation on a vertical plane
   Uses horizontal strip: each frame = frameW × frameH, total frames horizontal
   ================================================================ */

interface AnimDef {
  path: string;
  frames: number;
  fps: number;
}

const PLAYER_ANIMS: Record<string, AnimDef> = {
  idle: { path: SPRITE_DIR + "vlad_idle.webp", frames: 4, fps: 8 },
  walk: { path: SPRITE_DIR + "vlad_walk.webp", frames: 6, fps: 10 },
  attack: { path: SPRITE_DIR + "vlad_attack.webp", frames: 4, fps: 12 },
};

const BOSS_ANIMS: Record<string, { idle: AnimDef }> = {
  general: { idle: { path: SPRITE_DIR + "boss_general_idle.webp", frames: 4, fps: 8 } },
  director_ignis: { idle: { path: SPRITE_DIR + "boss_general_idle.webp", frames: 4, fps: 8 } },
  captain_dol: { idle: { path: SPRITE_DIR + "boss_general_idle.webp", frames: 4, fps: 8 } },
  morven: { idle: { path: SPRITE_DIR + "boss_morven_idle.webp", frames: 4, fps: 8 } },
  kael: { idle: { path: SPRITE_DIR + "boss_kael_idle.webp", frames: 4, fps: 8 } },
  surrogate_smith: { idle: { path: SPRITE_DIR + "boss_kael_idle.webp", frames: 4, fps: 8 } },
};

function AnimatedSpriteEntity({ animKey, anims, x, z, size, flipX, opacity }: {
  animKey: string;
  anims: Record<string, AnimDef>;
  x: number; z: number;
  size: number;
  flipX: boolean;
  opacity?: number;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera } = useThree();

  const textures = useMemo(() => {
    const map: Record<string, THREE.Texture> = {};
    for (const [key, def] of Object.entries(anims)) {
      const t = getTexture(def.path).clone();
      t.wrapS = THREE.ClampToEdgeWrapping;
      t.wrapT = THREE.ClampToEdgeWrapping;
      t.repeat.set(1 / def.frames, 1);
      t.offset.set(0, 0);
      t.needsUpdate = true;
      map[key] = t;
    }
    return map;
  }, [anims]);

  const mat = useMemo(() => {
    const firstKey = Object.keys(textures)[0];
    return new THREE.MeshStandardMaterial({
      map: textures[firstKey],
      alphaTest: 0.5,
      transparent: true,
      side: THREE.DoubleSide,
      roughness: 0.8,
      metalness: 0.0,
      opacity: opacity ?? 1,
    });
  }, [textures, opacity]);

  const frameTimer = useRef(0);
  const currentFrame = useRef(0);
  const prevAnimKey = useRef(animKey);
  const halfSize = size / 2;

  useFrame((_, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;

    const def = anims[animKey];
    if (!def) return;

    if (prevAnimKey.current !== animKey) {
      prevAnimKey.current = animKey;
      currentFrame.current = 0;
      frameTimer.current = 0;
    }

    const tex = textures[animKey];
    if (tex && mat.map !== tex) {
      mat.map = tex;
      mat.needsUpdate = true;
    }

    frameTimer.current += delta;
    const frameDur = 1 / def.fps;
    if (frameTimer.current >= frameDur) {
      frameTimer.current -= frameDur;
      currentFrame.current = (currentFrame.current + 1) % def.frames;
    }
    if (tex) tex.offset.x = currentFrame.current / def.frames;

    mesh.position.set(x, halfSize, z);
    const cx = camera.position.x;
    const cz = camera.position.z;
    const yAngle = Math.atan2(cx - x, cz - z);
    mesh.rotation.set(0, yAngle, 0);
    mesh.scale.set(flipX ? -size : size, size, 1);
  });

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const firstTex = textures[Object.keys(textures)[0]];
    if (!firstTex) return;

    const depthMat = new THREE.MeshDepthMaterial({
      map: firstTex,
      alphaTest: 0.5,
      depthPacking: THREE.RGBADepthPacking,
    });
    mesh.customDepthMaterial = depthMat;

    const distMat = new THREE.MeshDistanceMaterial({
      map: firstTex,
      alphaTest: 0.5,
    });
    mesh.customDistanceMaterial = distMat;
  }, [textures]);

  return (
    <mesh
      ref={meshRef}
      geometry={_spriteGeo}
      material={mat}
      position={[x, halfSize, z]}
      scale={[flipX ? -size : size, size, 1]}
      castShadow
    />
  );
}

/* ================================================================
   ROOM FLOOR + WALLS
   ================================================================ */

function WallSegment({ pos, scale }: { pos: [number, number, number]; scale: [number, number, number] }) {
  const mat = useMemo(() => {
    const wTex = getWallTexture().clone();
    wTex.needsUpdate = true;
    const maxDim = Math.max(scale[0], scale[2]);
    const repeatX = maxDim / 32;
    const repeatY = scale[1] / 16;
    wTex.repeat.set(repeatX, repeatY);
    return new THREE.MeshStandardMaterial({ map: wTex, roughness: 0.85, metalness: 0.1 });
  }, [scale[0], scale[1], scale[2]]);

  return (
    <mesh geometry={_wallGeo} material={mat}
      position={pos} scale={scale}
      castShadow receiveShadow />
  );
}

const RoomMesh = React.memo(function RoomMesh({ room }: { room: Room }) {
  const w = room.width;
  const h = room.height;
  const wt = WALL_THICKNESS;
  const wallH = 60;
  const dw = DOOR_WIDTH;
  const trimH = 4;

  useMemo(() => {
    const ft = getFloorTexture();
    ft.repeat.set(w / 128, h / 128);
    ft.needsUpdate = true;
  }, [w, h]);

  const walls = useMemo(() => {
    const pieces: { pos: [number, number, number]; scale: [number, number, number] }[] = [];

    const addWall = (x: number, z: number, sx: number, sz: number) => {
      pieces.push({ pos: [x, wallH / 2, z], scale: [sx, wallH, sz] });
    };

    const cx = w / 2, cy = h / 2;

    if (room.doors.top) {
      addWall(cx - dw / 2 - (cx - dw / 2 - wt) / 2 - wt / 2, 0, cx - dw / 2 - wt, wt);
      addWall(cx + dw / 2 + (w - wt - cx - dw / 2) / 2, 0, w - wt - cx - dw / 2, wt);
    } else {
      addWall(w / 2, 0, w, wt);
    }

    if (room.doors.bottom) {
      addWall(cx - dw / 2 - (cx - dw / 2 - wt) / 2 - wt / 2, h, cx - dw / 2 - wt, wt);
      addWall(cx + dw / 2 + (w - wt - cx - dw / 2) / 2, h, w - wt - cx - dw / 2, wt);
    } else {
      addWall(w / 2, h, w, wt);
    }

    if (room.doors.left) {
      addWall(0, cy - dw / 2 - (cy - dw / 2 - wt) / 2 - wt / 2, wt, cy - dw / 2 - wt);
      addWall(0, cy + dw / 2 + (h - wt - cy - dw / 2) / 2, wt, h - wt - cy - dw / 2);
    } else {
      addWall(0, h / 2, wt, h);
    }

    if (room.doors.right) {
      addWall(w, cy - dw / 2 - (cy - dw / 2 - wt) / 2 - wt / 2, wt, cy - dw / 2 - wt);
      addWall(w, cy + dw / 2 + (h - wt - cy - dw / 2) / 2, wt, h - wt - cy - dw / 2);
    } else {
      addWall(w, h / 2, wt, h);
    }

    return pieces;
  }, [w, h, wt, dw, wallH, room.doors]);

  const trims = useMemo(() => {
    const t: { pos: [number, number, number]; scale: [number, number, number] }[] = [];
    t.push({ pos: [w / 2, trimH / 2, wt / 2], scale: [w, trimH, wt + 2] });
    t.push({ pos: [w / 2, trimH / 2, h - wt / 2], scale: [w, trimH, wt + 2] });
    t.push({ pos: [wt / 2, trimH / 2, h / 2], scale: [wt + 2, trimH, h] });
    t.push({ pos: [w - wt / 2, trimH / 2, h / 2], scale: [wt + 2, trimH, h] });
    return t;
  }, [w, h, wt, trimH]);

  const cornerPillars = useMemo(() => {
    const cp: [number, number][] = [
      [wt, wt], [w - wt, wt], [wt, h - wt], [w - wt, h - wt],
    ];
    return cp;
  }, [w, h, wt]);

  return (
    <group>
      {/* Floor with stone texture */}
      <mesh
        geometry={_floorGeo}
        material={_floorMat}
        position={[w / 2, -0.1, h / 2]}
        scale={[w, h, 1]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      />

      {/* Walls with brick texture */}
      {walls.map((wall, i) => (
        <WallSegment key={`w${i}`} pos={wall.pos} scale={wall.scale} />
      ))}

      {/* Wall base trim / moulding */}
      {trims.map((t, i) => (
        <mesh
          key={`t${i}`}
          geometry={_trimGeo}
          material={_trimMat}
          position={t.pos}
          scale={t.scale}
        />
      ))}

      {/* Decorative corner pillars */}
      {cornerPillars.map(([cx, cz], i) => (
        <mesh
          key={`cp${i}`}
          geometry={_cylinderGeo}
          material={_pillarMat}
          position={[cx, wallH / 2, cz]}
          scale={[6, wallH, 6]}
          castShadow
        />
      ))}

      {/* Wall top ledge */}
      <mesh geometry={_wallGeo} material={_trimMat}
        position={[w / 2, wallH, 0]} scale={[w + 4, 3, wt + 6]} />
      <mesh geometry={_wallGeo} material={_trimMat}
        position={[w / 2, wallH, h]} scale={[w + 4, 3, wt + 6]} />
      <mesh geometry={_wallGeo} material={_trimMat}
        position={[0, wallH, h / 2]} scale={[wt + 6, 3, h + 4]} />
      <mesh geometry={_wallGeo} material={_trimMat}
        position={[w, wallH, h / 2]} scale={[wt + 6, 3, h + 4]} />
    </group>
  );
});

/* ================================================================
   OBSTACLES (3D meshes)
   ================================================================ */

function ObstacleMesh({ obs }: { obs: Obstacle }) {
  const groupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    if (!groupRef.current) return;
    const [x, , z] = gameToThree(obs.x, obs.y);
    groupRef.current.position.x = x;
    groupRef.current.position.z = z;
    if (obs.type === "crystal") {
      groupRef.current.visible = !obs.destroyed;
    }
  });

  const [ix, , iz] = gameToThree(obs.x, obs.y);

  if (obs.type === "pillar") {
    return (
      <group ref={groupRef} position={[ix, 0, iz]}>
        <mesh geometry={_cylinderGeo} material={_trimMat}
          position={[0, 2, 0]} scale={[obs.radius * 1.3, 4, obs.radius * 1.3]}
          castShadow receiveShadow />
        <mesh geometry={_cylinderGeo} material={_pillarMat}
          position={[0, 27, 0]} scale={[obs.radius, 46, obs.radius]}
          castShadow receiveShadow />
        <mesh geometry={_cylinderGeo} material={_trimMat}
          position={[0, 51, 0]} scale={[obs.radius * 1.3, 4, obs.radius * 1.3]}
          castShadow />
      </group>
    );
  }

  if (obs.type === "barrel") {
    return (
      <group ref={groupRef} position={[ix, 0, iz]} visible={!obs.destroyed}>
        <mesh geometry={_cylinderGeo} material={_barrelMat}
          position={[0, 12, 0]} scale={[obs.radius, 24, obs.radius]}
          castShadow receiveShadow />
        <mesh geometry={_cylinderGeo} material={_trimMat}
          position={[0, 4, 0]} scale={[obs.radius + 0.5, 1.5, obs.radius + 0.5]} />
        <mesh geometry={_cylinderGeo} material={_trimMat}
          position={[0, 12, 0]} scale={[obs.radius + 0.5, 1.5, obs.radius + 0.5]} />
        <mesh geometry={_cylinderGeo} material={_trimMat}
          position={[0, 20, 0]} scale={[obs.radius + 0.5, 1.5, obs.radius + 0.5]} />
      </group>
    );
  }

  if (obs.type === "lava") {
    return (
      <group ref={groupRef} position={[ix, 1, iz]}>
        <mesh geometry={_floorGeo} material={_lavaMat}
          scale={[obs.radius * 2, obs.radius * 2, 1]}
          rotation={[-Math.PI / 2, 0, 0]} />
        <pointLight color={0xff3300} intensity={2} distance={200} decay={2}
          position={[0, 10, 0]} />
      </group>
    );
  }

  if (obs.type === "crystal") {
    return (
      <group ref={groupRef} position={[ix, 0, iz]} visible={!obs.destroyed}>
        <mesh geometry={_octaGeo} material={_crystalMat}
          position={[0, obs.radius, 0]}
          scale={[obs.radius * 0.8, obs.radius * 1.5, obs.radius * 0.8]} />
        <pointLight color={0x3388ff} intensity={1.5} distance={160} decay={2}
          position={[0, obs.radius, 0]} />
      </group>
    );
  }

  return null;
}

/* ================================================================
   ENEMY HP BAR — small bar above non-boss enemies
   ================================================================ */

function EnemyHpBar({ enemy }: { enemy: Enemy }) {
  const isBoss = enemy.behavior.startsWith("boss") || enemy.behavior === "miniboss";
  if (isBoss) return null;
  const pct = enemy.hp / enemy.maxHp;
  if (pct >= 1) return null;

  const barW = Math.max(24, enemy.radius * 2);
  const [x, , z] = gameToThree(enemy.x, enemy.y);
  const spriteH = Math.max(30, enemy.radius * 2.2);

  return (
    <Html
      position={[x, spriteH + 6, z]}
      center
      style={{ pointerEvents: "none", userSelect: "none" }}
    >
      <div style={{
        width: `${barW}px`, height: "4px",
        background: "rgba(0,0,0,0.6)", borderRadius: "2px",
        overflow: "hidden", border: "1px solid rgba(255,255,255,0.15)",
      }}>
        <div style={{
          width: `${pct * 100}%`, height: "100%",
          background: pct > 0.5 ? "#4ade80" : pct > 0.25 ? "#fbbf24" : "#ef4444",
          borderRadius: "2px",
          transition: "width 0.1s",
        }} />
      </div>
    </Html>
  );
}

/* ================================================================
   PROJECTILE (instanced spheres)
   ================================================================ */

function ProjectileMesh({ proj }: { proj: Projectile }) {
  const color = proj.element ? ELEMENT_COLORS[proj.element] : (proj.owner === "player" ? "#2dd4bf" : "#f87171");
  const [x, , z] = gameToThree(proj.x, proj.y);
  const r = proj.radius;

  return (
    <mesh position={[x, 8, z]} scale={[r, r, r]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={2}
        roughness={0.2}
      />
    </mesh>
  );
}

/* ================================================================
   XP ORB
   ================================================================ */

function XpOrbMesh({ orb, time }: { orb: XpOrb; time: number }) {
  const [x, , z] = gameToThree(orb.x, orb.y);
  const pulse = 1 + Math.sin(time * 4 + orb.x) * 0.2;
  const r = 4 * pulse;
  return (
    <mesh position={[x, 5 + Math.sin(time * 3 + orb.y) * 2, z]} scale={[r, r, r]}>
      <sphereGeometry args={[1, 6, 4]} />
      <meshStandardMaterial
        color="#a78bfa"
        emissive="#a78bfa"
        emissiveIntensity={1.5}
        roughness={0.3}
      />
    </mesh>
  );
}

/* ================================================================
   PARTICLE (simple small meshes)
   ================================================================ */

function parseParticleColor(c: string): string {
  const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    return `rgb(${r},${g},${b})`;
  }
  return c;
}

function ParticleMesh({ particle }: { particle: Particle }) {
  const [x, , z] = gameToThree(particle.x, particle.y);
  const alpha = particle.life / particle.maxLife;
  const s = particle.size * alpha;
  const col = parseParticleColor(particle.color);
  return (
    <mesh position={[x, 4, z]} scale={[s, s, s]}>
      <sphereGeometry args={[1, 4, 3]} />
      <meshBasicMaterial color={col} transparent opacity={alpha} />
    </mesh>
  );
}

/* ================================================================
   DAMAGE NUMBER (HTML overlay)
   ================================================================ */

function DamageNumberDisplay({ dn }: { dn: DamageNumber }) {
  const [x, , z] = gameToThree(dn.x, dn.y);
  const rise = (0.7 - dn.life) * 40;
  const alpha = Math.min(1, dn.life * 2);
  const scale = dn.value > 30 ? 1.3 : 1;
  return (
    <Html
      position={[x, 25 + rise, z]}
      center
      style={{
        color: dn.color,
        fontSize: `${14 * scale}px`,
        fontWeight: "bold",
        opacity: alpha,
        textShadow: "0 0 4px rgba(0,0,0,0.8)",
        pointerEvents: "none",
        whiteSpace: "nowrap",
        userSelect: "none",
      }}
    >
      {dn.value}
    </Html>
  );
}

/* ================================================================
   TORCH VISUAL MESH — emissive orb at light source position
   ================================================================ */

const _torchGeo = new THREE.SphereGeometry(1, 6, 4);
const _torchMat = new THREE.MeshBasicMaterial({
  color: 0xffcc66,
  transparent: true,
  opacity: 0.9,
});

const _torchBracketGeo = new THREE.BoxGeometry(1, 1, 1);
const _torchBracketMat = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.9, metalness: 0.5 });
const _flameMat = new THREE.MeshBasicMaterial({ color: 0xffaa33, transparent: true, opacity: 0.9 });

const TorchVisual = React.memo(function TorchVisual({ x, z, color, size, castShadow: cs }: {
  x: number; z: number; color: THREE.Color; size: number; castShadow?: boolean;
}) {
  return (
    <group position={[x, 0, z]}>
      <mesh geometry={_torchBracketGeo} material={_torchBracketMat}
        position={[0, 32, 0]} scale={[3, 6, 3]} />
      <mesh geometry={_torchGeo} position={[0, 38, 0]} scale={[size * 0.7, size * 1.2, size * 0.7]}>
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <mesh position={[0, 38, 0]} scale={[size * 2.5, size * 2.5, size * 2.5]}>
        <sphereGeometry args={[1, 8, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} />
      </mesh>
      <pointLight
        color={color}
        intensity={size * 120}
        distance={500}
        decay={2}
        position={[0, 38, 0]}
        castShadow={cs}
        shadow-mapSize-width={cs ? 512 : undefined}
        shadow-mapSize-height={cs ? 512 : undefined}
        shadow-bias={-0.003}
        shadow-camera-near={1}
        shadow-camera-far={cs ? 500 : undefined}
      />
    </group>
  );
});

/* ================================================================
   ROOM LIGHTS — nearest 2 PointLights cast shadows
   ================================================================ */

const MAX_SHADOW_TORCHES = 2;

function RoomLights({ room, stateRef }: { room: Room; stateRef: React.MutableRefObject<GameState> }) {
  const lightDefs = useMemo(() => collectLights(room), [
    room.width, room.height, room.type,
    room.doors.top, room.doors.bottom, room.doors.left, room.doors.right,
  ]);

  const shadowIndices = useRef(new Set<number>());
  const lastQuantX = useRef(0);
  const lastQuantZ = useRef(0);
  const lightsGroupRef = useRef<THREE.Group>(null);

  useFrame(() => {
    const p = stateRef.current.player;
    const qx = Math.round(p.x / 80);
    const qz = Math.round(p.y / 80);
    if (qx === lastQuantX.current && qz === lastQuantZ.current) return;
    lastQuantX.current = qx;
    lastQuantZ.current = qz;

    const dists = lightDefs.map((l, i) => ({
      i, d: Math.sqrt((l.x - p.x) ** 2 + (l.y - p.y) ** 2),
    }));
    dists.sort((a, b) => a.d - b.d);
    shadowIndices.current.clear();
    for (let j = 0; j < Math.min(MAX_SHADOW_TORCHES, dists.length); j++) {
      shadowIndices.current.add(dists[j].i);
    }

    const group = lightsGroupRef.current;
    if (!group) return;
    group.children.forEach((child, idx) => {
      const pl = child.children.find(c => (c as THREE.PointLight).isPointLight) as THREE.PointLight | undefined;
      if (pl) pl.castShadow = shadowIndices.current.has(idx);
    });
  });

  return (
    <group ref={lightsGroupRef}>
      {lightDefs.map((l, idx) => (
        <TorchVisual key={idx} x={l.x} z={l.y} color={l.color} size={4}
          castShadow={shadowIndices.current.has(idx)} />
      ))}
    </group>
  );
}

/* ================================================================
   PORTAL (exit room)
   ================================================================ */

function PortalMesh({ room }: { room: Room }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const timeRef = useRef(0);

  useFrame((_, delta) => {
    timeRef.current += delta;
    const mesh = ringRef.current;
    if (!mesh) return;
    const pulse = 1 + Math.sin(timeRef.current * 2) * 0.1;
    mesh.scale.set(pulse, pulse, 1);
  });

  if (room.type !== "exit") return null;
  const cx = room.width / 2, cy = room.height / 2;
  return (
    <group position={[cx, 0, cy]}>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]} position={[0, 1, 0]}>
        <ringGeometry args={[20, 30, 24]} />
        <meshStandardMaterial
          color="#6366f1"
          emissive="#6366f1"
          emissiveIntensity={2}
          side={THREE.DoubleSide}
          transparent
          opacity={0.7}
        />
      </mesh>
      <pointLight color={0x6366f1} intensity={60} distance={200} position={[0, 20, 0]} />
    </group>
  );
}

/* ================================================================
   ORBITAL CAMERA CONTROLLER
   Follows player, MMB to rotate orbit, scroll to zoom
   ================================================================ */

function OrbitalCamera({ stateRef, cameraAngleRef }: {
  stateRef: React.MutableRefObject<GameState>;
  cameraAngleRef?: React.MutableRefObject<number>;
}) {
  const { camera } = useThree();
  const orbitAngle = useRef(0);
  const orbitRadius = useRef(600);
  const orbitPhi = useRef(Math.PI / 3);
  const isDragging = useRef(false);
  const lastMouseX = useRef(0);
  const targetPos = useRef(new THREE.Vector3());
  const targetLookAt = useRef(new THREE.Vector3());

  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const step = 30;
      orbitRadius.current += e.deltaY > 0 ? step : -step;
      orbitRadius.current = Math.max(200, Math.min(1200, orbitRadius.current));
    };
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 1) {
        isDragging.current = true;
        lastMouseX.current = e.clientX;
        e.preventDefault();
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) {
        const dx = e.clientX - lastMouseX.current;
        orbitAngle.current += dx * 0.005;
        lastMouseX.current = e.clientX;
      }
    };
    const onMouseUp = (e: MouseEvent) => {
      if (e.button === 1) isDragging.current = false;
    };

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, []);

  useFrame((_, delta) => {
    const s = stateRef.current;
    if (s.screen !== "playing") return;

    if (cameraAngleRef) cameraAngleRef.current = orbitAngle.current;

    const px = s.player.x;
    const pz = s.player.y;
    const r = orbitRadius.current;
    const theta = orbitAngle.current;
    const phi = orbitPhi.current;

    const camX = px + r * Math.sin(phi) * Math.sin(theta);
    const camY = r * Math.cos(phi);
    const camZ = pz + r * Math.sin(phi) * Math.cos(theta);

    const shakeX = s.camera.shakeX * 0.5;
    const shakeZ = s.camera.shakeY * 0.5;

    targetPos.current.set(camX + shakeX, camY, camZ + shakeZ);
    targetLookAt.current.set(px, 0, pz);

    const smoothing = 12;
    const t = 1 - Math.exp(-smoothing * Math.min(delta, 0.05));
    camera.position.lerp(targetPos.current, t);
    camera.lookAt(targetLookAt.current.x, 0, targetLookAt.current.z);
  });

  return null;
}

/* ================================================================
   AIM RAYCASTER — projects screen mouse to world Y=0 plane
   ================================================================ */

const _aimRay = new THREE.Raycaster();
const _aimNDC = new THREE.Vector2();
const _aimPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _aimHit = new THREE.Vector3();

function AimRaycaster({ mouseScreenRef, aimWorldRef }: {
  mouseScreenRef: React.MutableRefObject<{ x: number; y: number }>;
  aimWorldRef: React.MutableRefObject<{ x: number; y: number }>;
}) {
  const { camera } = useThree();

  useFrame(() => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    _aimNDC.set(
      (mouseScreenRef.current.x / w) * 2 - 1,
      -(mouseScreenRef.current.y / h) * 2 + 1,
    );
    _aimRay.setFromCamera(_aimNDC, camera);
    if (_aimRay.ray.intersectPlane(_aimPlane, _aimHit)) {
      aimWorldRef.current.x = _aimHit.x;
      aimWorldRef.current.y = _aimHit.z;
    }
  });

  return null;
}

/* ================================================================
   MAIN GAME SCENE COMPONENT
   ================================================================ */

interface GameSceneProps {
  stateRef: React.MutableRefObject<GameState>;
  mouseScreenRef?: React.MutableRefObject<{ x: number; y: number }>;
  cameraAngleRef?: React.MutableRefObject<number>;
  aimWorldRef?: React.MutableRefObject<{ x: number; y: number }>;
}

export default function GameScene({ stateRef, mouseScreenRef, cameraAngleRef, aimWorldRef }: GameSceneProps) {
  const { gl } = useThree();

  useEffect(() => {
    gl.shadowMap.enabled = true;
    gl.shadowMap.type = THREE.PCFShadowMap;
    gl.toneMapping = THREE.LinearToneMapping;
    gl.toneMappingExposure = 1.2;
  }, [gl]);

  const snapshotRef = useRef<{
    room: Room | null;
    player: PlayerState;
    enemies: Enemy[];
    projectiles: Projectile[];
    particles: Particle[];
    damageNumbers: DamageNumber[];
    xpOrbs: XpOrb[];
    time: number;
    roomX: number;
    roomY: number;
  }>({
    room: null,
    player: stateRef.current.player,
    enemies: [],
    projectiles: [],
    particles: [],
    damageNumbers: [],
    xpOrbs: [],
    time: 0,
    roomX: 0,
    roomY: 0,
  });

  const prevRoomKeyRef = useRef("");
  const [roomVersion, setRoomVersion] = React.useState(0);

  useFrame(() => {
    const s = stateRef.current;
    if (s.screen !== "playing") return;

    const roomKey = `${s.currentRoom.x},${s.currentRoom.y}`;
    const room = s.map[roomKey] ?? null;

    const snap = snapshotRef.current;
    snap.room = room;
    snap.player = s.player;
    snap.enemies = s.enemies;
    snap.projectiles = s.projectiles;
    snap.particles = s.particles;
    snap.damageNumbers = s.damageNumbers;
    snap.xpOrbs = s.xpOrbs;
    snap.time = s.gameTime;
    snap.roomX = s.currentRoom.x;
    snap.roomY = s.currentRoom.y;

    if (prevRoomKeyRef.current !== roomKey) {
      prevRoomKeyRef.current = roomKey;
      setRoomVersion(v => v + 1);
    }
  });

  const snap = snapshotRef.current;
  const room = snap.room;

  const prevPlayerPos = useRef({ x: 0, y: 0 });
  const playerAnimRef = useRef<string>("idle");

  useFrame(() => {
    if (!snapshotRef.current.room) return;
    const p = snapshotRef.current.player;
    const dx = p.x - prevPlayerPos.current.x;
    const dy = p.y - prevPlayerPos.current.y;
    prevPlayerPos.current.x = p.x;
    prevPlayerPos.current.y = p.y;
    const speed = Math.sqrt(dx * dx + dy * dy);
    if (p.attackAnim > 0) playerAnimRef.current = "attack";
    else if (speed > 1.5 || p.isDashing) playerAnimRef.current = "walk";
    else playerAnimRef.current = "idle";
  });

  if (!room) return null;

  const roomKey = `${snap.roomX},${snap.roomY}`;

  return (
    <>
      <OrbitalCamera stateRef={stateRef} cameraAngleRef={cameraAngleRef} />
      {mouseScreenRef && aimWorldRef && (
        <AimRaycaster mouseScreenRef={mouseScreenRef} aimWorldRef={aimWorldRef} />
      )}

      <fog attach="fog" args={[0x1a1510, 600, 1800]} />
      <ambientLight intensity={0.5} color={0xccbbaa} />
      <hemisphereLight args={[0xffeedd, 0x332211, 0.3]} />

      {/* Static room layer — only re-renders on room change */}
      <StaticRoomLayer room={room} roomKey={roomKey} stateRef={stateRef} />

      {/* Dynamic entities — updated via useFrame, no React re-renders for positions */}
      <DynamicEntities snapshotRef={snapshotRef} aimWorldRef={aimWorldRef} playerAnimRef={playerAnimRef} />

      {/* Post-processing */}
      <Suspense fallback={null}>
        <EffectComposer multisampling={0}>
          <SSAO
            blendFunction={BlendFunction.MULTIPLY}
            samples={8}
            radius={4}
            intensity={15}
          />
          <Bloom
            intensity={0.15}
            luminanceThreshold={0.8}
            luminanceSmoothing={0.3}
          />
          <Vignette
            offset={0.3}
            darkness={0.6}
            blendFunction={BlendFunction.NORMAL}
          />
        </EffectComposer>
      </Suspense>
    </>
  );
}

/* ================================================================
   STATIC ROOM LAYER — memoized, only re-renders on room change
   ================================================================ */

const StaticRoomLayer = React.memo(function StaticRoomLayer({ room, roomKey, stateRef }: {
  room: Room; roomKey: string; stateRef: React.MutableRefObject<GameState>;
}) {
  return (
    <group>
      <RoomMesh room={room} />
      <RoomLights room={room} stateRef={stateRef} />
      <PortalMesh room={room} />
      {room.obstacles.map(obs => (
        <ObstacleMesh key={obs.id} obs={obs} />
      ))}
    </group>
  );
}, (prev, next) => prev.roomKey === next.roomKey);

/* ================================================================
   DYNAMIC ENTITIES — player, enemies, projectiles, particles, UI
   Uses setTick for list changes (new/dead enemies), useFrame for positions
   ================================================================ */

function DynamicEntities({ snapshotRef, aimWorldRef, playerAnimRef }: {
  snapshotRef: React.MutableRefObject<{
    room: Room | null;
    player: PlayerState;
    enemies: Enemy[];
    projectiles: Projectile[];
    particles: Particle[];
    damageNumbers: DamageNumber[];
    xpOrbs: XpOrb[];
    time: number;
  }>;
  aimWorldRef?: React.MutableRefObject<{ x: number; y: number }>;
  playerAnimRef: React.MutableRefObject<string>;
}) {
  const [, setDynTick] = React.useState(0);
  const tickCounter = useRef(0);

  useFrame(() => {
    tickCounter.current += 1;
    if (tickCounter.current % 4 === 0) {
      setDynTick(t => t + 1);
    }
  });

  const snap = snapshotRef.current;
  const player = snap.player;
  const playerAnim = playerAnimRef.current;

  const playerFlipX = (() => {
    if (!aimWorldRef) return false;
    return aimWorldRef.current.x < player.x;
  })();

  return (
    <group>
      {/* Player sprite */}
      <AnimatedSpriteEntity
        animKey={playerAnim}
        anims={PLAYER_ANIMS}
        x={player.x}
        z={player.y}
        size={44}
        flipX={playerFlipX}
      />

      {/* Enemies */}
      {snap.enemies.filter(e => !e.dead).map(e => {
        const isBoss = e.behavior.startsWith("boss") || e.behavior === "miniboss";
        const bossAnim = isBoss && BOSS_ANIMS[e.type] ? BOSS_ANIMS[e.type].idle : null;
        const spriteSize = isBoss ? e.radius * 3 : Math.max(30, e.radius * 2.2);

        const defaultLeft = SPRITE_DEFAULT_FACING_LEFT.has(e.type);
        const shouldFlip = (() => {
          const dx = player.x - e.x;
          const wantsRight = dx > 0;
          return defaultLeft ? !wantsRight : wantsRight;
        })();

        const texPath = (() => {
          const map = isBoss ? BOSS_SPRITE_MAP : ENEMY_SPRITE_MAP;
          return SPRITE_DIR + (map[e.type] ?? "ignis_soldier.png");
        })();

        return (
          <React.Fragment key={e.id}>
            {bossAnim ? (
              <AnimatedSpriteEntity
                animKey="idle"
                anims={{ idle: bossAnim }}
                x={e.x}
                z={e.y}
                size={spriteSize}
                flipX={shouldFlip}
                opacity={e.hitFlash > 0 ? 0.6 : 1}
              />
            ) : (
              <SpriteEntity
                texturePath={texPath}
                x={e.x}
                z={e.y}
                size={spriteSize}
                flipX={shouldFlip}
                opacity={e.hitFlash > 0 ? 0.6 : 1}
              />
            )}
            <EnemyHpBar enemy={e} />
          </React.Fragment>
        );
      })}

      {/* Projectiles */}
      {snap.projectiles.map(p => (
        <ProjectileMesh key={p.id} proj={p} />
      ))}

      {/* XP Orbs */}
      {snap.xpOrbs.filter(o => !o.collected).map(o => (
        <XpOrbMesh key={o.id} orb={o} time={snap.time} />
      ))}

      {/* Particles (limit for performance) */}
      {snap.particles.slice(0, 50).map((p, i) => (
        <ParticleMesh key={i} particle={p} />
      ))}

      {/* Damage numbers */}
      {snap.damageNumbers.map((dn, i) => (
        <DamageNumberDisplay key={i} dn={dn} />
      ))}
    </group>
  );
}
