// Run with: node generate-map.js
// Generates fractal world geography for planet Aurax
// Two main continents separated by a strait, internal sea, rivers, lakes

const fs = require('fs');

function seededRandom(seed) {
  let s = seed;
  return function() {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function subdivide(points, roughness, iterations, rng) {
  let pts = [...points];
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    const scale = roughness / Math.pow(2, iter * 0.65);
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      next.push(a);
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.5) { continue; }
      const nx = -dy / len;
      const ny = dx / len;
      const offset = (rng() - 0.5) * scale * len;
      next.push([
        Math.round((mx + nx * offset) * 10) / 10,
        Math.round((my + ny * offset) * 10) / 10
      ]);
    }
    pts = next;
  }
  return pts;
}

function makeIsland(cx, cy, baseR, points, irregularity, seed) {
  const rng = seededRandom(seed);
  const base = [];
  for (let i = 0; i < points; i++) {
    const angle = (i / points) * Math.PI * 2;
    const r = baseR * (1 + (rng() - 0.5) * irregularity);
    base.push([
      Math.round((cx + Math.cos(angle) * r) * 10) / 10,
      Math.round((cy + Math.sin(angle) * r) * 10) / 10
    ]);
  }
  return subdivide(base, 0.35, 4, rng);
}

function makeLine(pts, roughness, iterations, seed) {
  const rng = seededRandom(seed);
  let line = [...pts];
  for (let iter = 0; iter < iterations; iter++) {
    const next = [];
    const scale = roughness / Math.pow(2, iter * 0.7);
    for (let i = 0; i < line.length - 1; i++) {
      const a = line[i];
      const b = line[i + 1];
      next.push(a);
      const mx = (a[0] + b[0]) / 2;
      const my = (a[1] + b[1]) / 2;
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len < 0.5) continue;
      const nx = -dy / len;
      const ny = dx / len;
      const offset = (rng() - 0.5) * scale * len;
      next.push([
        Math.round((mx + nx * offset) * 10) / 10,
        Math.round((my + ny * offset) * 10) / 10
      ]);
    }
    next.push(line[line.length - 1]);
    line = next;
  }
  return line;
}

// viewBox: 0 0 900 520
// WESTERN CONTINENT (Блуждающий Дол + Лазурные Реки + Игнис) — left side
const westContBase = [
  [55, 135], [72, 108], [95, 82], [120, 62], [150, 48], [180, 38],
  [210, 34], [240, 32], [268, 36], [292, 44], [312, 55], [328, 68],
  // strait top (gap between continents ~340-370)
  [338, 80], [342, 95], [340, 118], [336, 142], [334, 165],
  [338, 185], [344, 200], [350, 218],
  // south shore of strait entrance
  [348, 240], [342, 260], [338, 282], [340, 305],
  // SW coast
  [338, 325], [332, 345], [322, 362], [308, 378], [290, 392],
  [268, 402], [244, 408], [218, 412], [192, 414], [166, 412],
  [142, 406], [120, 396], [100, 382], [84, 364], [72, 344],
  [64, 320], [58, 294], [54, 268], [52, 240], [50, 212],
  [50, 184], [52, 158]
];

// EASTERN CONTINENT (Аурумгард + Тектрон + Побережье) — right side
const eastContBase = [
  // strait bottom
  [372, 225], [380, 208], [386, 190], [390, 172], [388, 152],
  [382, 134], [378, 115], [376, 96], [378, 78],
  // NE coast
  [385, 62], [398, 48], [418, 38], [442, 30], [470, 26],
  [500, 24], [530, 22], [560, 24], [590, 28], [618, 36],
  [642, 48], [662, 62], [678, 80], [690, 102], [698, 126],
  [702, 152], [704, 180], [702, 208],
  // east bay
  [698, 232], [694, 255], [696, 278], [700, 302],
  // SE peninsula
  [702, 328], [698, 352], [690, 374], [678, 392],
  [662, 408], [642, 420], [618, 428], [592, 432],
  [565, 434], [538, 432], [512, 428], [488, 420],
  [468, 410], [450, 396], [436, 378], [426, 358],
  [420, 336], [416, 312], [414, 288], [410, 265],
  [404, 248], [396, 235], [384, 228]
];

// CENTRAL ISLAND / DEAD ZONE — sits in the internal sea between continents
const deadIslandBase = [
  [355, 158], [368, 148], [382, 142], [392, 148],
  [398, 162], [400, 180], [398, 198], [392, 212],
  [382, 222], [370, 226], [358, 222], [348, 212],
  [342, 198], [340, 180], [342, 165]
];

// IGNIS PENINSULA — extension from SW of western continent
const ignisBase = [
  [142, 406], [166, 412], [192, 414],
  [218, 412], [244, 408], [268, 402],
  [280, 416], [288, 434], [290, 454],
  [286, 470], [276, 482], [262, 490],
  [244, 494], [224, 496], [204, 494],
  [184, 488], [166, 478], [150, 464],
  [138, 448], [130, 430], [128, 414], [134, 408]
];

const rngW = seededRandom(42);
const rngE = seededRandom(77);
const rngDead = seededRandom(333);
const rngIgnis = seededRandom(555);

const westCont = subdivide(westContBase, 0.26, 4, rngW);
const eastCont = subdivide(eastContBase, 0.26, 4, rngE);
const deadIsland = subdivide(deadIslandBase, 0.22, 4, rngDead);
const ignisPeninsula = subdivide(ignisBase, 0.22, 4, rngIgnis);

// REGIONS (within continents)
const daleBase = [
  [55, 135], [72, 108], [95, 82], [120, 62], [150, 48], [180, 38],
  [210, 34], [240, 32], [252, 50], [258, 75], [260, 105],
  [256, 135], [248, 162], [238, 185], [228, 205],
  [215, 218], [198, 225], [178, 226], [158, 224],
  [138, 218], [118, 208], [100, 194], [85, 178],
  [72, 160], [60, 145]
];

const azureBase = [
  [240, 32], [268, 36], [292, 44], [312, 55], [328, 68],
  [338, 80], [342, 95], [340, 118], [336, 142],
  [328, 158], [316, 172], [300, 182], [282, 188],
  [264, 190], [248, 186], [236, 178], [228, 165],
  [238, 148], [248, 128], [256, 108], [260, 86],
  [258, 65], [252, 48]
];

const ignisRegBase = [
  [52, 240], [54, 268], [58, 294], [64, 320],
  [72, 344], [84, 364], [100, 382], [120, 396],
  [142, 406], [134, 408], [128, 414], [130, 430],
  [138, 448], [150, 464], [166, 478], [184, 488],
  [204, 494], [224, 496], [244, 494], [262, 490],
  [276, 482], [288, 468], [290, 452], [288, 434],
  [280, 416], [268, 402], [244, 408], [218, 412],
  [192, 414], [166, 412],
  [142, 406], [120, 396],
  // back across coast
  [108, 380], [96, 358], [84, 338],
  [74, 312], [66, 288], [58, 262]
];

const aurumBase = [
  [378, 78], [385, 62], [398, 48], [418, 38], [442, 30],
  [470, 26], [500, 24], [530, 22], [560, 24],
  [568, 48], [572, 78], [570, 110], [564, 138],
  [554, 162], [540, 182], [522, 196],
  [502, 206], [480, 210], [458, 208],
  [438, 200], [420, 188], [406, 172],
  [396, 154], [390, 135], [386, 115],
  [382, 98]
];

const tektronBase = [
  [560, 24], [590, 28], [618, 36], [642, 48],
  [662, 62], [678, 80], [690, 102], [698, 126],
  [702, 152], [704, 180], [702, 208],
  [698, 232], [694, 255], [696, 278], [700, 302],
  [702, 328], [698, 352], [690, 374], [678, 392],
  [662, 408], [642, 420], [618, 428],
  // west edge goes back inward
  [602, 420], [586, 408], [572, 392],
  [560, 372], [552, 350], [546, 326],
  [544, 300], [544, 272], [548, 244],
  [554, 218], [558, 192], [560, 168],
  [560, 142], [562, 115], [564, 88],
  [564, 62], [564, 42]
];

const borderBase = [
  [338, 325], [332, 345], [322, 362], [308, 378],
  [290, 392], [268, 402],
  [284, 382], [298, 365], [310, 350],
  [320, 330], [326, 310], [330, 290],
  [334, 272], [338, 255], [340, 240]
];

const rD1 = seededRandom(100), rD2 = seededRandom(200), rD3 = seededRandom(300);
const rD4 = seededRandom(400), rD5 = seededRandom(500), rD6 = seededRandom(600);
const rD7 = seededRandom(700), rD8 = seededRandom(800);

// INTERNAL SEA polygon (water body between the two continents)
const internalSeaBase = [
  [340, 118], [342, 95], [338, 80],
  [345, 72], [358, 65], [370, 62], [378, 68], [382, 78],
  [386, 96], [388, 115], [390, 135], [392, 155],
  [396, 175], [400, 195], [404, 215],
  [410, 235], [414, 255], [416, 275],
  [414, 290], [408, 305], [398, 318],
  [385, 328], [370, 334], [355, 338],
  [342, 334], [336, 322], [334, 305],
  [336, 288], [338, 268], [340, 250],
  [344, 232], [348, 215], [350, 198],
  [348, 178], [344, 158], [340, 138]
];

// LAKES
const lakeMirrorBase = makeIsland(180, 150, 14, 8, 0.4, 901);
const lakeFireBase = makeIsland(220, 460, 10, 7, 0.45, 902);
const lakeGlassBase = makeIsland(530, 280, 12, 8, 0.35, 903);

// RIVERS (lines, not polygons)
const river1 = makeLine([[180, 136],[190, 115],[205, 92],[222, 72],[240, 55],[252, 48]], 0.15, 3, 1001);
const river2 = makeLine([[180, 164],[175, 185],[172, 210],[170, 228],[178, 226]], 0.12, 3, 1002);
const river3 = makeLine([[530, 268],[518, 245],[505, 224],[500, 210],[502, 206]], 0.12, 3, 1003);
const river4 = makeLine([[530, 292],[545, 315],[558, 340],[568, 362],[572, 380]], 0.12, 3, 1004);
const river5 = makeLine([[220, 450],[230, 430],[242, 412],[250, 400]], 0.1, 3, 1005);

// RANDOM ISLANDS — chaotic placement, varied sizes
const globalRng = seededRandom(7777);
const islands = [];
const islandDefs = [
  // scattered NW
  { cx: 30, cy: 85, r: 7 },
  { cx: 22, cy: 125, r: 4 },
  { cx: 18, cy: 200, r: 9 },
  // scattered W
  { cx: 28, cy: 310, r: 5 },
  { cx: 15, cy: 370, r: 6 },
  // scattered SW
  { cx: 62, cy: 488, r: 8 },
  { cx: 108, cy: 505, r: 5 },
  { cx: 185, cy: 510, r: 4 },
  // scattered S (in strait mouth)
  { cx: 335, cy: 365, r: 3 },
  { cx: 358, cy: 358, r: 4 },
  { cx: 390, cy: 368, r: 3 },
  // scattered SE
  { cx: 435, cy: 452, r: 6 },
  { cx: 528, cy: 458, r: 10 },
  { cx: 620, cy: 448, r: 5 },
  { cx: 680, cy: 438, r: 4 },
  // scattered E
  { cx: 725, cy: 370, r: 7 },
  { cx: 732, cy: 280, r: 3 },
  { cx: 728, cy: 195, r: 5 },
  { cx: 722, cy: 115, r: 6 },
  // scattered NE
  { cx: 710, cy: 48, r: 4 },
  { cx: 665, cy: 22, r: 5 },
  // scattered N
  { cx: 520, cy: 8, r: 6 },
  { cx: 415, cy: 12, r: 4 },
  { cx: 310, cy: 18, r: 3 },
  { cx: 195, cy: 15, r: 7 },
  // strait islands
  { cx: 360, cy: 108, r: 4 },
  { cx: 354, cy: 280, r: 3 },
];

islandDefs.forEach((def, i) => {
  const pts = 5 + Math.floor(globalRng() * 5);
  const irreg = 0.35 + globalRng() * 0.35;
  islands.push(makeIsland(def.cx, def.cy, def.r, pts, irreg, 5000 + i));
});

// Oblivion Island — far east, separate
const oblivionBase = makeIsland(808, 260, 28, 14, 0.5, 666);

// ASSEMBLE FEATURES
const rngSea = seededRandom(444);
const internalSea = subdivide(internalSeaBase, 0.12, 3, rngSea);

const features = [
  // Landmasses
  { properties: { id: "west-continent", name: "Западный материк", type: "landmass" }, geometry: { type: "Polygon", coordinates: [westCont] } },
  { properties: { id: "east-continent", name: "Восточный материк", type: "landmass" }, geometry: { type: "Polygon", coordinates: [eastCont] } },
  { properties: { id: "ignis-peninsula", name: "Полуостров Игнис", type: "landmass" }, geometry: { type: "Polygon", coordinates: [ignisPeninsula] } },
  { properties: { id: "dead-island", name: "Мёртвая земля", type: "landmass" }, geometry: { type: "Polygon", coordinates: [deadIsland] } },

  // Small islands
  ...islands.map((pts, i) => ({
    properties: { id: `islet-${i}`, name: "", type: "islet" },
    geometry: { type: "Polygon", coordinates: [pts] }
  })),

  // Internal sea (water, drawn ON TOP of land)
  { properties: { id: "internal-sea", name: "Пролив Кузнеца", type: "sea", color: "#7daec8" }, geometry: { type: "Polygon", coordinates: [internalSea] } },

  // Lakes
  { properties: { id: "lake-mirror", name: "Озеро Зеркал", type: "lake", color: "#8dbdd6" }, geometry: { type: "Polygon", coordinates: [lakeMirrorBase] } },
  { properties: { id: "lake-fire", name: "Лавовое Озеро", type: "lake", color: "#c88868" }, geometry: { type: "Polygon", coordinates: [lakeFireBase] } },
  { properties: { id: "lake-glass", name: "Стеклянное Озеро", type: "lake", color: "#a8b8c8" }, geometry: { type: "Polygon", coordinates: [lakeGlassBase] } },

  // Rivers
  { properties: { id: "river-mirror-n", name: "Река Лазури (сев.)", type: "river" }, geometry: { type: "LineString", coordinates: river1 } },
  { properties: { id: "river-mirror-s", name: "Река Лазури (юж.)", type: "river" }, geometry: { type: "LineString", coordinates: river2 } },
  { properties: { id: "river-glass-n", name: "Река Стали (сев.)", type: "river" }, geometry: { type: "LineString", coordinates: river3 } },
  { properties: { id: "river-glass-s", name: "Река Стали (юж.)", type: "river" }, geometry: { type: "LineString", coordinates: river4 } },
  { properties: { id: "river-lava", name: "Река Пепла", type: "river" }, geometry: { type: "LineString", coordinates: river5 } },

  // Regions
  { properties: { id: "wandering-dale", name: "Земли Блуждающего Дола", type: "region", biome: "Зелёные равнины, степи, ветряные потоки", color: "#8cc294", strokeColor: "#6aa278", tom: 1 }, geometry: { type: "Polygon", coordinates: [subdivide(daleBase, 0.16, 3, rD1)] } },
  { properties: { id: "azure-rivers", name: "Коалиция Лазурных Рек", type: "region", biome: "Водопады, ущелья, ледяные мосты", color: "#92c8e2", strokeColor: "#72a8c2", tom: 2 }, geometry: { type: "Polygon", coordinates: [subdivide(azureBase, 0.16, 3, rD2)] } },
  { properties: { id: "ignis-empire", name: "Империя Игнис", type: "region", biome: "Вулканы, пепел, лава, обсидиановые крепости", color: "#e2a898", strokeColor: "#c28878", tom: 4 }, geometry: { type: "Polygon", coordinates: [subdivide(ignisRegBase, 0.14, 3, rD3)] } },
  { properties: { id: "aurumgard", name: "Аурумгард", type: "region", biome: "Парящий замок, горные перевалы, вечная тень", color: "#e2d498", strokeColor: "#c2b478", tom: 5 }, geometry: { type: "Polygon", coordinates: [subdivide(aurumBase, 0.16, 3, rD4)] } },
  { properties: { id: "tektron", name: "Тектрон", type: "region", biome: "Пустыня, каньоны, металлолом, техно-грозы", color: "#e2c8a0", strokeColor: "#c2a880", tom: 3 }, geometry: { type: "Polygon", coordinates: [subdivide(tektronBase, 0.16, 3, rD5)] } },
  { properties: { id: "dead-zone", name: "Мёртвая Зона", type: "anomaly", biome: "Стеклянный кратер, аномалии, магические штормы", color: "#b8b8c8", strokeColor: "#9898a8", tom: 8 }, geometry: { type: "Polygon", coordinates: [deadIsland] } },

  // Oblivion Island
  { properties: { id: "oblivion-island", name: "Остров Забвения", type: "island", biome: "Мёртвая природа, фиолетовый туман", color: "#c8a8d8", strokeColor: "#a888b8", tom: 6, hidden: true }, geometry: { type: "Polygon", coordinates: [oblivionBase] } },
];

const geojson = {
  type: "FeatureCollection",
  name: "aurax_regions",
  features: features.map(f => ({ type: "Feature", ...f }))
};

fs.writeFileSync('aurax-regions.geojson', JSON.stringify(geojson, null, 2));
console.log(`Generated ${features.length} features`);
features.forEach(f => {
  const pts = f.geometry.type === "Polygon" ? f.geometry.coordinates[0]?.length : f.geometry.coordinates?.length;
  console.log(`  ${f.properties.id} (${f.properties.type}): ${pts} points`);
});
