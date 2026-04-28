import { ElementType, Rarity, ComboEffect, EnemyBehavior } from "./types";

// --- Viewport (mutable, updated on resize) ---
export let viewportW = 800;
export let viewportH = 600;
export function setViewportSize(w: number, h: number) {
  viewportW = w;
  viewportH = h;
}

export const WALL_THICKNESS = 20;
export const DOOR_WIDTH = 120;

// --- Gameplay tuning ---
export const PLAYER_RADIUS = 14;
export const PLAYER_MOVE_SPEED = 220;
export const PLAYER_DASH_SPEED = 900;
export const PLAYER_DASH_COST = 25;
export const PLAYER_DASH_COOLDOWN = 0.8;
export const PLAYER_DASH_IFRAMES = 0.2;
export const PLAYER_DASH_DECAY = 0.88;
export const PLAYER_STAMINA_REGEN = 12;
export const PLAYER_BASE_ATTACK_COOLDOWN = 0.35;
export const PROJECTILE_BASE_SPEED = 340;
export const PROJECTILE_BASE_DAMAGE = 10;
export const PROJECTILE_DAMAGE_PER_LEVEL = 5;
export const XP_ORB_MAGNET_RADIUS = 50;
export const XP_ORB_COLLECT_RADIUS = 18;
export const XP_ORB_MAGNET_SPEED = 300;
export const BARREL_EXPLOSION_RADIUS = 80;
export const PORTAL_INTERACT_RADIUS = 50;
export const ENEMY_PROJECTILE_SPEED = 220;
export const ENEMY_CONTACT_DAMAGE_MULT = 0.5;
export const PLAYER_IFRAMES_DURATION = 0.5;

export const PLAYER_DASH_CHARGE_REGEN = 3.0;

// --- Room sizes by type ---
export const ROOM_SIZES: Record<string, { minW: number; maxW: number; minH: number; maxH: number }> = {
  start:    { minW: 1000, maxW: 1000, minH: 750,  maxH: 750 },
  treasure: { minW: 900,  maxW: 900,  minH: 700,  maxH: 700 },
  normal:   { minW: 1200, maxW: 1600, minH: 900,  maxH: 1200 },
  elite:    { minW: 1600, maxW: 2000, minH: 1200, maxH: 1500 },
  boss:     { minW: 2000, maxW: 2400, minH: 1500, maxH: 1800 },
  exit:     { minW: 800,  maxW: 800,  minH: 600,  maxH: 600 },
  event:    { minW: 1000, maxW: 1200, minH: 800,  maxH: 900 },
};

// --- Element colors ---
export const ELEMENT_COLORS: Record<ElementType, string> = {
  [ElementType.Wind]: "#2dd4bf",
  [ElementType.Fire]: "#f87171",
  [ElementType.Water]: "#60a5fa",
  [ElementType.Earth]: "#a78bfa",
  [ElementType.Electricity]: "#fbbf24",
  [ElementType.Ice]: "#93c5fd",
  [ElementType.Nature]: "#4ade80",
  [ElementType.Gravity]: "#818cf8",
  [ElementType.Light]: "#fef3c7",
  [ElementType.Darkness]: "#4b5563",
};

export const ELEMENT_NAMES_RU: Record<ElementType, string> = {
  [ElementType.Wind]: "Ветер",
  [ElementType.Fire]: "Огонь",
  [ElementType.Water]: "Вода",
  [ElementType.Earth]: "Земля",
  [ElementType.Electricity]: "Молния",
  [ElementType.Ice]: "Лёд",
  [ElementType.Nature]: "Природа",
  [ElementType.Gravity]: "Гравитация",
  [ElementType.Light]: "Свет",
  [ElementType.Darkness]: "Тьма",
};

export const RING_NAMES_RU: Record<ElementType, string> = {
  [ElementType.Wind]: "Кольцо Порыва",
  [ElementType.Fire]: "Кольцо Искры",
  [ElementType.Water]: "Кольцо Потока",
  [ElementType.Earth]: "Кольцо Камня",
  [ElementType.Electricity]: "Кольцо Разряда",
  [ElementType.Ice]: "Кольцо Инея",
  [ElementType.Nature]: "Кольцо Ростка",
  [ElementType.Gravity]: "Кольцо Притяжения",
  [ElementType.Light]: "Кольцо Сияния",
  [ElementType.Darkness]: "Кольцо Тени",
};

// --- Rarity ---
export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.Common]: "#94a3b8",
  [Rarity.Uncommon]: "#4ade80",
  [Rarity.Rare]: "#60a5fa",
  [Rarity.Epic]: "#a855f7",
  [Rarity.Legendary]: "#fbbf24",
};

export const RARITY_NAMES_RU: Record<Rarity, string> = {
  [Rarity.Common]: "Обычный",
  [Rarity.Uncommon]: "Необычный",
  [Rarity.Rare]: "Редкий",
  [Rarity.Epic]: "Эпический",
  [Rarity.Legendary]: "Легендарный",
};

export const RARITY_WEIGHTS: { rarity: Rarity; weight: number }[] = [
  { rarity: Rarity.Common, weight: 45 },
  { rarity: Rarity.Uncommon, weight: 28 },
  { rarity: Rarity.Rare, weight: 17 },
  { rarity: Rarity.Epic, weight: 8 },
  { rarity: Rarity.Legendary, weight: 2 },
];

export const RARITY_MULTIPLIERS: Record<Rarity, number> = {
  [Rarity.Common]: 1,
  [Rarity.Uncommon]: 1.3,
  [Rarity.Rare]: 1.6,
  [Rarity.Epic]: 2,
  [Rarity.Legendary]: 3,
};

// --- Elemental Core bonuses ---
export const CORE_BONUSES: Record<ElementType, { bonus: string; nameRu: string; descRu: string }> = {
  [ElementType.Fire]:        { bonus: "explosive_chance", nameRu: "Ядро Пламени",     descRu: "15% шанс взрыва при попадании" },
  [ElementType.Water]:       { bonus: "slow_enhance",     nameRu: "Ядро Потока",      descRu: "+40% длительность замедления" },
  [ElementType.Wind]:        { bonus: "proj_speed",       nameRu: "Ядро Ветра",       descRu: "+30% скорость снарядов" },
  [ElementType.Earth]:       { bonus: "aoe_radius",       nameRu: "Ядро Камня",       descRu: "+35% радиус AoE" },
  [ElementType.Electricity]: { bonus: "chain",            nameRu: "Ядро Молнии",      descRu: "Снаряды прыгают по 1 доп. цели" },
  [ElementType.Ice]:         { bonus: "freeze",           nameRu: "Ядро Льда",        descRu: "10% шанс заморозки на 1с" },
  [ElementType.Nature]:      { bonus: "regen",            nameRu: "Ядро Жизни",       descRu: "+3 HP/сек регенерация" },
  [ElementType.Gravity]:     { bonus: "pull",             nameRu: "Ядро Гравитации",  descRu: "Снаряды притягивают врагов" },
  [ElementType.Light]:       { bonus: "blind",            nameRu: "Ядро Сияния",      descRu: "Враги слепнут на 0.3с (стан)" },
  [ElementType.Darkness]:    { bonus: "lifesteal",        nameRu: "Ядро Тьмы",        descRu: "10% вампиризм от урона" },
};

export const CORE_DAMAGE_BONUS = 0.25;

// --- Enemy templates ---
export interface EnemyTemplate {
  type: string;
  nameRu: string;
  behavior: EnemyBehavior;
  baseHp: number;
  baseDamage: number;
  baseSpeed: number;
  radius: number;
  shootCooldown: number;
  dashCooldown: number;
  color: string;
  glowColor?: string;
}

export const ENEMY_TEMPLATES: Record<string, EnemyTemplate> = {
  ignis_soldier: {
    type: "ignis_soldier", nameRu: "Солдат Игнис", behavior: "chase",
    baseHp: 50, baseDamage: 12, baseSpeed: 110, radius: 12,
    shootCooldown: 0, dashCooldown: 0, color: "#78716c",
  },
  ignis_archer: {
    type: "ignis_archer", nameRu: "Стрелок Игнис", behavior: "shooter",
    baseHp: 35, baseDamage: 15, baseSpeed: 70, radius: 11,
    shootCooldown: 2.0, dashCooldown: 0, color: "#b45309", glowColor: "#f87171",
  },
  ignis_berserker: {
    type: "ignis_berserker", nameRu: "Берсерк Игнис", behavior: "dasher",
    baseHp: 70, baseDamage: 25, baseSpeed: 90, radius: 14,
    shootCooldown: 0, dashCooldown: 3.0, color: "#dc2626", glowColor: "#f87171",
  },
  marauder: {
    type: "marauder", nameRu: "Мародёр", behavior: "chase",
    baseHp: 40, baseDamage: 10, baseSpeed: 130, radius: 11,
    shootCooldown: 0, dashCooldown: 0, color: "#6b7280",
  },
  mercenary: {
    type: "mercenary", nameRu: "Наёмник", behavior: "dasher",
    baseHp: 55, baseDamage: 18, baseSpeed: 100, radius: 12,
    shootCooldown: 0, dashCooldown: 2.5, color: "#7c3aed", glowColor: "#a78bfa",
  },
  smuggler: {
    type: "smuggler", nameRu: "Контрабандист", behavior: "shooter",
    baseHp: 30, baseDamage: 14, baseSpeed: 90, radius: 10,
    shootCooldown: 1.8, dashCooldown: 0, color: "#854d0e", glowColor: "#fbbf24",
  },
  water_guardian: {
    type: "water_guardian", nameRu: "Страж Воды", behavior: "tank",
    baseHp: 120, baseDamage: 16, baseSpeed: 55, radius: 18,
    shootCooldown: 0, dashCooldown: 0, color: "#0369a1", glowColor: "#38bdf8",
  },
  tektron_drone: {
    type: "tektron_drone", nameRu: "Дрон Тектрона", behavior: "sniper",
    baseHp: 25, baseDamage: 30, baseSpeed: 50, radius: 10,
    shootCooldown: 3.0, dashCooldown: 0, color: "#06b6d4", glowColor: "#67e8f9",
  },
  tektron_enforcer: {
    type: "tektron_enforcer", nameRu: "Инфорсер Тектрона", behavior: "shooter",
    baseHp: 60, baseDamage: 20, baseSpeed: 75, radius: 14,
    shootCooldown: 1.2, dashCooldown: 0, color: "#0891b2", glowColor: "#22d3ee",
  },
  magnetist: {
    type: "magnetist", nameRu: "Магнетист", behavior: "healer",
    baseHp: 45, baseDamage: 8, baseSpeed: 60, radius: 12,
    shootCooldown: 0, dashCooldown: 0, color: "#818cf8", glowColor: "#a5b4fc",
  },
  ignis_sniper: {
    type: "ignis_sniper", nameRu: "Снайпер Игнис", behavior: "sniper",
    baseHp: 30, baseDamage: 35, baseSpeed: 40, radius: 11,
    shootCooldown: 3.5, dashCooldown: 0, color: "#ef4444", glowColor: "#fca5a5",
  },
  illusionist: {
    type: "illusionist", nameRu: "Иллюзионист", behavior: "teleporter",
    baseHp: 40, baseDamage: 15, baseSpeed: 70, radius: 11,
    shootCooldown: 2.0, dashCooldown: 0, color: "#7c3aed", glowColor: "#c084fc",
  },
  levitator: {
    type: "levitator", nameRu: "Левитатор", behavior: "bomber",
    baseHp: 50, baseDamage: 22, baseSpeed: 65, radius: 13,
    shootCooldown: 2.5, dashCooldown: 0, color: "#818cf8", glowColor: "#a5b4fc",
  },
  aurumgard_guard: {
    type: "aurumgard_guard", nameRu: "Гвардеец Аурумгарда", behavior: "chase",
    baseHp: 80, baseDamage: 15, baseSpeed: 60, radius: 16,
    shootCooldown: 0, dashCooldown: 0, color: "#ca8a04", glowColor: "#fbbf24",
  },
  bombardier: {
    type: "bombardier", nameRu: "Бомбардир", behavior: "bomber",
    baseHp: 55, baseDamage: 28, baseSpeed: 55, radius: 14,
    shootCooldown: 3.0, dashCooldown: 0, color: "#ea580c", glowColor: "#fb923c",
  },
  necromancer: {
    type: "necromancer", nameRu: "Некромант", behavior: "summoner",
    baseHp: 60, baseDamage: 10, baseSpeed: 50, radius: 13,
    shootCooldown: 1.5, dashCooldown: 0, color: "#4c1d95", glowColor: "#8b5cf6",
  },
  pirate: {
    type: "pirate", nameRu: "Пират", behavior: "dasher",
    baseHp: 65, baseDamage: 20, baseSpeed: 105, radius: 13,
    shootCooldown: 0, dashCooldown: 2.0, color: "#92400e", glowColor: "#fbbf24",
  },
  ghost_mage: {
    type: "ghost_mage", nameRu: "Призрачный Маг", behavior: "teleporter",
    baseHp: 35, baseDamage: 20, baseSpeed: 60, radius: 11,
    shootCooldown: 1.8, dashCooldown: 0, color: "#3b0764", glowColor: "#a855f7",
  },
  cultist: {
    type: "cultist", nameRu: "Культист Омега", behavior: "shooter",
    baseHp: 45, baseDamage: 18, baseSpeed: 80, radius: 12,
    shootCooldown: 1.5, dashCooldown: 0, color: "#581c87", glowColor: "#a855f7",
  },
  cultist_tank: {
    type: "cultist_tank", nameRu: "Страж Уробороса", behavior: "tank",
    baseHp: 150, baseDamage: 20, baseSpeed: 50, radius: 20,
    shootCooldown: 0, dashCooldown: 0, color: "#1e1b4b", glowColor: "#6366f1",
  },
  elite_cultist: {
    type: "elite_cultist", nameRu: "Элитный Культист", behavior: "summoner",
    baseHp: 70, baseDamage: 15, baseSpeed: 65, radius: 14,
    shootCooldown: 2.0, dashCooldown: 0, color: "#3b0764", glowColor: "#c084fc",
  },
};

export const BOSS_TEMPLATES: Record<string, EnemyTemplate> = {
  captain_dol: {
    type: "captain_dol", nameRu: "Капитан Стражи Дола", behavior: "boss_captain",
    baseHp: 400, baseDamage: 22, baseSpeed: 90, radius: 24,
    shootCooldown: 2.0, dashCooldown: 3.5, color: "#78716c", glowColor: "#d4d4d8",
  },
  general: {
    type: "general", nameRu: "Генерал Огня", behavior: "boss_general",
    baseHp: 600, baseDamage: 30, baseSpeed: 80, radius: 28,
    shootCooldown: 1.5, dashCooldown: 4.0, color: "#be123c", glowColor: "#f43f5e",
  },
  tyren_river: {
    type: "tyren_river", nameRu: "Тирен, Лорд Рек", behavior: "boss_mage",
    baseHp: 550, baseDamage: 25, baseSpeed: 70, radius: 24,
    shootCooldown: 1.0, dashCooldown: 0, color: "#0369a1", glowColor: "#38bdf8",
  },
  ferrum_tektron: {
    type: "ferrum_tektron", nameRu: "Феррум, Железный Кулак", behavior: "boss_tank",
    baseHp: 900, baseDamage: 35, baseSpeed: 55, radius: 32,
    shootCooldown: 2.5, dashCooldown: 5.0, color: "#0891b2", glowColor: "#22d3ee",
  },
  director_ignis: {
    type: "director_ignis", nameRu: "Директор Карательного Корпуса", behavior: "boss_summoner",
    baseHp: 700, baseDamage: 28, baseSpeed: 75, radius: 26,
    shootCooldown: 1.8, dashCooldown: 0, color: "#dc2626", glowColor: "#f87171",
  },
  guard_captain_aurum: {
    type: "guard_captain_aurum", nameRu: "Капитан Золотой Стражи", behavior: "boss_gravity",
    baseHp: 800, baseDamage: 32, baseSpeed: 65, radius: 28,
    shootCooldown: 1.5, dashCooldown: 3.0, color: "#ca8a04", glowColor: "#fbbf24",
  },
  lord_port: {
    type: "lord_port", nameRu: "Лорд Порта", behavior: "boss_pirate",
    baseHp: 650, baseDamage: 28, baseSpeed: 95, radius: 24,
    shootCooldown: 1.2, dashCooldown: 2.0, color: "#92400e", glowColor: "#fbbf24",
  },
  admiral_oblivion: {
    type: "admiral_oblivion", nameRu: "Адмирал Острова Забвения", behavior: "boss_illusionist",
    baseHp: 750, baseDamage: 30, baseSpeed: 80, radius: 26,
    shootCooldown: 1.0, dashCooldown: 0, color: "#4c1d95", glowColor: "#a855f7",
  },
  morven: {
    type: "morven", nameRu: "Морвен, Советник Тени", behavior: "boss_morven",
    baseHp: 1000, baseDamage: 35, baseSpeed: 90, radius: 26,
    shootCooldown: 0.8, dashCooldown: 2.5, color: "#581c87", glowColor: "#a855f7",
  },
  kael: {
    type: "kael", nameRu: "Каэль Тишайший", behavior: "boss_kael",
    baseHp: 1200, baseDamage: 38, baseSpeed: 100, radius: 28,
    shootCooldown: 0.7, dashCooldown: 2.0, color: "#1c1917", glowColor: "#d4d4d8",
  },
  surrogate_smith: {
    type: "surrogate_smith", nameRu: "Суррогат Кузнеца", behavior: "boss_final",
    baseHp: 2000, baseDamage: 45, baseSpeed: 85, radius: 32,
    shootCooldown: 0.6, dashCooldown: 2.5, color: "#0f172a", glowColor: "#fbbf24",
  },
};

export const MINIBOSS_TEMPLATES: Record<string, EnemyTemplate> = {
  elite_berserker: {
    type: "elite_berserker", nameRu: "Элитный Берсерк", behavior: "miniboss",
    baseHp: 250, baseDamage: 22, baseSpeed: 100, radius: 18,
    shootCooldown: 0, dashCooldown: 2.5, color: "#dc2626", glowColor: "#fca5a5",
  },
  void_sentinel: {
    type: "void_sentinel", nameRu: "Страж Пустоты", behavior: "miniboss",
    baseHp: 350, baseDamage: 18, baseSpeed: 60, radius: 22,
    shootCooldown: 1.5, dashCooldown: 0, color: "#3b0764", glowColor: "#c084fc",
  },
  iron_golem: {
    type: "iron_golem", nameRu: "Железный Голем", behavior: "miniboss",
    baseHp: 500, baseDamage: 30, baseSpeed: 40, radius: 26,
    shootCooldown: 0, dashCooldown: 4.0, color: "#475569", glowColor: "#94a3b8",
  },
};

// --- Stages ---
export interface StageConfig {
  name: string;
  nameRu: string;
  description: string;
  normalEnemies: string[];
  boss: string;
  roomCount: number;
}

export const STAGES: StageConfig[] = [
  {
    name: "wandering_dol",
    nameRu: "Блуждающий Дол",
    description: "Мирный город-караван. Первые признаки беды.",
    normalEnemies: ["marauder", "marauder", "smuggler"],
    boss: "captain_dol",
    roomCount: 6,
  },
  {
    name: "ruined_dol",
    nameRu: "Руины Дола",
    description: "Дол пал. Солдаты Игнис прочёсывают пепелище.",
    normalEnemies: ["ignis_soldier", "ignis_soldier", "ignis_archer", "marauder"],
    boss: "general",
    roomCount: 8,
  },
  {
    name: "river_coalition",
    nameRu: "Коалиция Рек",
    description: "Водные просторы Аква-Гранда. Наёмники на каждом берегу.",
    normalEnemies: ["mercenary", "water_guardian", "smuggler", "ignis_archer"],
    boss: "tyren_river",
    roomCount: 9,
  },
  {
    name: "desert_tektron",
    nameRu: "Пустыня Тектрона",
    description: "Ржавые пустоши. Дроны и инфорсеры контролируют территорию.",
    normalEnemies: ["tektron_enforcer", "tektron_drone", "ignis_berserker", "magnetist"],
    boss: "ferrum_tektron",
    roomCount: 10,
  },
  {
    name: "fire_ignis",
    nameRu: "Огненный Игнис",
    description: "Багровый Горн. Сердце Империи пылает.",
    normalEnemies: ["ignis_soldier", "ignis_berserker", "ignis_sniper", "ignis_archer", "bombardier"],
    boss: "director_ignis",
    roomCount: 11,
  },
  {
    name: "gravity_aurumgard",
    nameRu: "Аурумгард Небесный",
    description: "Золотой замок парит над трущобами. Гравитация нестабильна.",
    normalEnemies: ["aurumgard_guard", "levitator", "magnetist", "illusionist"],
    boss: "guard_captain_aurum",
    roomCount: 12,
  },
  {
    name: "journey_to_port",
    nameRu: "Путь к Порту",
    description: "Дорога к побережью полна пиратов и засад.",
    normalEnemies: ["pirate", "smuggler", "mercenary", "bombardier"],
    boss: "lord_port",
    roomCount: 11,
  },
  {
    name: "island_oblivion",
    nameRu: "Остров Забвения",
    description: "Фиолетовый туман. Культ Омега правит здесь.",
    normalEnemies: ["cultist", "ghost_mage", "necromancer", "elite_cultist"],
    boss: "admiral_oblivion",
    roomCount: 13,
  },
  {
    name: "borderland",
    nameRu: "Пограничье",
    description: "Зеркальная гладь. Границы реальности истончаются.",
    normalEnemies: ["cultist", "cultist_tank", "ghost_mage", "illusionist", "elite_cultist"],
    boss: "morven",
    roomCount: 14,
  },
  {
    name: "shadow_descent",
    nameRu: "Нисхождение Тени",
    description: "Морвен повержен, но его тень ведёт глубже.",
    normalEnemies: ["cultist_tank", "elite_cultist", "necromancer", "ghost_mage", "levitator"],
    boss: "kael",
    roomCount: 15,
  },
  {
    name: "dead_zone",
    nameRu: "Мёртвая Зона",
    description: "Каэль был лишь инструментом. Истинный враг впереди.",
    normalEnemies: ["elite_cultist", "cultist_tank", "ignis_berserker", "tektron_drone", "bombardier"],
    boss: "surrogate_smith",
    roomCount: 16,
  },
  {
    name: "forge_of_doom",
    nameRu: "Кузня Судьбы",
    description: "Центр мира. Наковальня Мудреца. Финал.",
    normalEnemies: ["elite_cultist", "cultist_tank", "necromancer", "ghost_mage", "illusionist", "bombardier"],
    boss: "surrogate_smith",
    roomCount: 18,
  },
];

// --- Combos ---
export const COMBO_EFFECTS: Record<string, ComboEffect> = {
  "Wind+Water": { name: "Шторм", description: "+40% радиус атак", type: "aoe_radius", value: 0.4 },
  "Wind+Fire": { name: "Огненный Шторм", description: "Поджигает врагов", type: "dot", value: 8 },
  "Water+Ice": { name: "Метель", description: "Замедляет врагов на 40%", type: "slow", value: 0.4 },
  "Electricity+Water": { name: "Проводимость", description: "Молния прыгает по 2 целям", type: "chain", value: 2 },
  "Earth+Fire": { name: "Лава", description: "Поджигает на 12 ед/сек", type: "dot", value: 12 },
  "Gravity+Darkness": { name: "Чёрная Дыра", description: "Сильное притяжение врагов", type: "pull", value: 400 },
  "Light+Nature": { name: "Фотосинтез", description: "+5 HP/сек регенерация", type: "regen", value: 5 },
  "Fire+Electricity": { name: "Плазма", description: "Снаряды взрываются", type: "explosive", value: 60 },
  "Earth+Gravity": { name: "Метеор", description: "Снаряды пробивают насквозь", type: "pierce", value: 1 },
  "Darkness+Ice": { name: "Бездонный Мороз", description: "Вампиризм 15%", type: "lifesteal", value: 0.15 },
  "Light+Electricity": { name: "Священная Молния", description: "Оглушение на 0.5с", type: "stun", value: 0.5 },
  "Wind+Gravity": { name: "Небесный Ход", description: "+30% скорость игрока", type: "aoe_radius", value: 0.3 },
  "Nature+Wind": { name: "Бритвенный Лист", description: "Поджигает на 6 ед/сек", type: "dot", value: 6 },
  "Water+Nature": { name: "Цветение", description: "+3 HP/сек регенерация", type: "regen", value: 3 },
};

export function getCombo(e1: ElementType, e2: ElementType): ComboEffect | null {
  return COMBO_EFFECTS[`${e1}+${e2}`] || COMBO_EFFECTS[`${e2}+${e1}`] || null;
}

// --- Upgrade names ---
export const UPGRADE_NAMES_RU: Record<string, { name: string; desc: string; category: "stat" | "dash" | "passive" }> = {
  hp: { name: "Ядро Живучести", desc: "+25 макс. HP", category: "stat" },
  atk: { name: "Всплеск Силы", desc: "+20% урон", category: "stat" },
  spd: { name: "Ускорение", desc: "+15% скорость атаки", category: "stat" },
  projSpd: { name: "Попутный Ветер", desc: "+20% скорость снарядов", category: "stat" },
  projCnt: { name: "Мультикаст", desc: "+1 снаряд", category: "stat" },
  staminaMax: { name: "Выносливость", desc: "+30 макс. стамины", category: "stat" },
  dashCharges: { name: "Двойной Рывок", desc: "+1 заряд рывка", category: "dash" },
  dashDamage: { name: "Ударный Рывок", desc: "Рывок наносит 15 урона", category: "dash" },
  dashCostReduce: { name: "Лёгкость", desc: "-30% стоимость рывка", category: "dash" },
  dashRegenSpd: { name: "Быстрая Перезарядка", desc: "-25% время восстановления рывка", category: "dash" },
  xpMagnet: { name: "Притяжение Опыта", desc: "+50% радиус сбора XP", category: "passive" },
  lifesteal: { name: "Вампиризм", desc: "+5% вампиризм от урона", category: "passive" },
  projReflect: { name: "Отражение", desc: "8% шанс отразить вражеский снаряд", category: "passive" },
  rage: { name: "Ярость", desc: "+1% урон за каждые 5% потерянного HP", category: "passive" },
  auraCdr: { name: "Стихийный Поток", desc: "+15% скорость аур", category: "passive" },
};
