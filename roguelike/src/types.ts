export enum ElementType {
  Wind = "Wind",
  Fire = "Fire",
  Water = "Water",
  Earth = "Earth",
  Electricity = "Electricity",
  Ice = "Ice",
  Nature = "Nature",
  Gravity = "Gravity",
  Light = "Light",
  Darkness = "Darkness",
}

export enum RingRank {
  Lower = "Lower",
  Middle = "Middle",
  Higher = "Higher",
  Legendary = "Legendary",
}

export enum Rarity {
  Common = "common",
  Uncommon = "uncommon",
  Rare = "rare",
  Epic = "epic",
  Legendary = "legendary",
}

export type SlotType = "projectile_lmb" | "projectile_rmb" | "aura" | "core";

export type AttackType = "projectile" | "aura" | "melee";

export interface Ring {
  id: string;
  element: ElementType;
  secondElement?: ElementType;
  comboName?: string;
  rank: RingRank;
  name: string;
  level: number;
  attackType: AttackType;
  slotType: SlotType;
}

export interface ElementalCore {
  element: ElementType;
  damageBonus: number;
  uniqueBonus: string;
}

export type EnemyBehavior =
  | "chase" | "shooter" | "dasher" | "tank"
  | "sniper" | "bomber" | "healer" | "summoner" | "teleporter"
  | "boss" | "boss_captain" | "boss_general" | "boss_mage"
  | "boss_tank" | "boss_summoner" | "boss_gravity"
  | "boss_illusionist" | "boss_pirate" | "boss_morven"
  | "boss_kael" | "boss_final"
  | "miniboss";

export interface Enemy {
  id: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  type: string;
  behavior: EnemyBehavior;
  speed: number;
  damage: number;
  radius: number;
  shootCooldown: number;
  shootTimer: number;
  dashCooldown: number;
  dashTimer: number;
  isDashing: boolean;
  dashVx: number;
  dashVy: number;
  phase: number;
  summonTimer: number;
  teleportTimer: number;
  healTimer: number;
  specialTimer: number;
  slowTimer: number;
  burnTimer: number;
  burnDamage: number;
  stunTimer: number;
  hitFlash: number;
  attackAnim: number;
  dead: boolean;
}

export interface Projectile {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  owner: "player" | "enemy";
  damage: number;
  element?: ElementType;
  hp: number;
  lifeTime: number;
  radius: number;
  piercing: boolean;
  chainCount: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface DamageNumber {
  x: number;
  y: number;
  value: number;
  life: number;
  color: string;
}

export interface XpOrb {
  id: string;
  x: number;
  y: number;
  value: number;
  collected: boolean;
}

export type ObstacleType = "pillar" | "barrel" | "lava" | "crystal";

export interface Obstacle {
  id: string;
  x: number;
  y: number;
  type: ObstacleType;
  radius: number;
  hp: number;
  maxHp: number;
  destroyed: boolean;
  element?: ElementType;
}

export interface Room {
  x: number;
  y: number;
  cleared: boolean;
  visited: boolean;
  type: "start" | "normal" | "elite" | "boss" | "treasure" | "exit" | "event";
  event?: RoomEvent;
  doors: { top: boolean; bottom: boolean; left: boolean; right: boolean };
  width: number;
  height: number;
  obstacles: Obstacle[];
  preSpawnedEnemies?: Enemy[];
}

export interface Camera {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
  shakeTimer: number;
}

export interface ComboEffect {
  name: string;
  description: string;
  type:
    | "aoe_radius"
    | "slow"
    | "dot"
    | "chain"
    | "pull"
    | "regen"
    | "stun"
    | "pierce"
    | "explosive"
    | "lifesteal";
  value: number;
}

export type RoomEventType = "altar" | "merchant" | "trap" | "chest" | "speed_trial";

export interface RoomEvent {
  type: RoomEventType;
  active: boolean;
  timer?: number;
}

export type StatKey =
  | "hp" | "atk" | "spd" | "projSpd" | "projCnt" | "staminaMax"
  | "dashCharges" | "dashDamage" | "dashCostReduce" | "dashRegenSpd"
  | "xpMagnet" | "lifesteal" | "projReflect" | "rage" | "auraCdr";

export interface Upgrade {
  id: string;
  name: string;
  description: string;
  type: "stat" | "ring" | "ringLevelUp" | "core" | "dash" | "passive";
  statKey?: StatKey;
  value?: number;
  ring?: Ring;
  icon: string;
  rarity: Rarity;
  possibleCombo?: {
    comboName: string;
    comboDesc: string;
    partnerElement: ElementType;
  };
}

export interface PlayerBuff {
  type: "damage" | "speed" | "regen";
  value: number;
  remaining: number;
}

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  stamina: number;
  maxStamina: number;
  rings: (Ring | null)[];
  attackSpeed: number;
  damageMult: number;
  projectileSpeedMult: number;
  projectileCount: number;
  xp: number;
  maxXp: number;
  playerLevel: number;
  invincibleTimer: number;
  regenRate: number;
  elementalCore: ElementalCore | null;
  buffs: PlayerBuff[];
  dashTimer: number;
  dashCooldown: number;
  dashVx: number;
  dashVy: number;
  isDashing: boolean;
  dashCharges: number;
  dashMaxCharges: number;
  dashChargeTimer: number;
  dashChargeRegenTime: number;
  dashDistance: number;
  dashDamage: number;
  dashCostMult: number;
  passiveXpMagnet: number;
  passiveLifesteal: number;
  passiveProjReflect: number;
  passiveRage: number;
  passiveAuraCdr: number;
  attackAnim: number;
}

export type DoorSide = "top" | "bottom" | "left" | "right";

export interface GameState {
  screen: "start" | "ringChoice" | "playing" | "upgrade" | "gameover";
  level: number;
  killsTotal: number;
  player: PlayerState;
  map: Record<string, Room>;
  currentRoom: { x: number; y: number };
  enteredFrom: DoorSide | null;
  enemies: Enemy[];
  projectiles: Projectile[];
  particles: Particle[];
  damageNumbers: DamageNumber[];
  activeCombo: ComboEffect | null;
  availableUpgrades: Upgrade[];
  xpOrbs: XpOrb[];
  gameTime: number;
  camera: Camera;
}
