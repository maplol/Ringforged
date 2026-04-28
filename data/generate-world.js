// node generate-world.js
// Reads splat-mask.png → extracts vector contours + faction regions
// No icons, no heightmap noise — pure coastline + political map
// Output: aurax-world.json, aurax-region-map.bin, heightmap-preview.png

const fs = require('fs');
const Jimp = require('jimp');

const VW = 4096, VH = 4096;
const SEA_THR = 0.50;
const SEED = 42;

// Value noise with smooth interpolation
function _grad(hash, x, y) {
  const h = hash & 3;
  return ((h & 1) ? -x : x) + ((h & 2) ? -y : y);
}
const _perm = new Uint8Array(512);
{ 
  const p = [];
  for (let i = 0; i < 256; i++) p[i] = i;
  let s = SEED;
  for (let i = 255; i > 0; i--) {
    s = (s * 16807 + 0) % 2147483647;
    const j = s % (i + 1);
    [p[i], p[j]] = [p[j], p[i]];
  }
  for (let i = 0; i < 512; i++) _perm[i] = p[i & 255];
}

function perlinNoise2D(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const aa = _perm[_perm[X] + Y], ab = _perm[_perm[X] + Y + 1];
  const ba = _perm[_perm[X + 1] + Y], bb = _perm[_perm[X + 1] + Y + 1];
  const x1 = _grad(aa, xf, yf) * (1 - u) + _grad(ba, xf - 1, yf) * u;
  const x2 = _grad(ab, xf, yf - 1) * (1 - u) + _grad(bb, xf - 1, yf - 1) * u;
  return x1 * (1 - v) + x2 * v;
}

function fbmNoise(x, y, octaves = 4) {
  let val = 0, amp = 1, freq = 1, maxAmp = 0;
  for (let i = 0; i < octaves; i++) {
    val += amp * perlinNoise2D(x * freq, y * freq);
    maxAmp += amp; amp *= 0.5; freq *= 2;
  }
  return val / maxAmp;
}

async function main() {
  console.log("=== Aurax Vector Map Generator ===\n");

  const maskOrig = await Jimp.read('splat-mask.png');
  const TARGET_SIZE = 4096;
  const mask = maskOrig.clone().resize(TARGET_SIZE, TARGET_SIZE, Jimp.RESIZE_BICUBIC);
  const W = mask.bitmap.width;
  const H = mask.bitmap.height;
  const SX = VW / W, SY = VH / H;
  console.log(`Mask: ${maskOrig.bitmap.width}x${maskOrig.bitmap.height} → upscaled to ${W}x${H}, SVG: ${VW}x${VH}`);

  // Step 1: Extract brightness as float array
  const bri = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = Jimp.intToRGBA(mask.getPixelColor(x, y));
    bri[y * W + x] = (c.r + c.g + c.b) / (3 * 255);
  }

  // Detect "circle" (Dead Zone / meteor crater) — brightness around 0.8-0.99 AND small round area center-ish
  // The white dot in the center is bright white, surrounded by black
  // We'll detect it as: bright pixel far from main landmasses

  // Step 2: Gaussian blur for smoother contours (3-pass box, r=3)
  console.log("Blurring for smooth contours...");
  let blurred = boxBlur(bri, W, H, 3);
  blurred = boxBlur(blurred, W, H, 3);
  blurred = boxBlur(blurred, W, H, 3);

  // Step 3: Land mask (binary)
  const landRaw = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    landRaw[i] = blurred[i] >= SEA_THR ? 1 : 0;
  }

  // Step 3b: Add coastline noise — displace pixels near shore for jagged edges
  console.log("Adding coastline noise...");
  const SHORE_DETECT = 8;
  const COAST_DISP = 18;
  const land = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) land[i] = landRaw[i];

  for (let y = COAST_DISP; y < H - COAST_DISP; y++) for (let x = COAST_DISP; x < W - COAST_DISP; x++) {
    const i = y * W + x;
    const cur = landRaw[i];
    let nearShore = false;
    for (let dy = -SHORE_DETECT; dy <= SHORE_DETECT; dy += 2) {
      for (let dx = -SHORE_DETECT; dx <= SHORE_DETECT; dx += 2) {
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && nx < W && ny >= 0 && ny < H && landRaw[ny * W + nx] !== cur) {
          nearShore = true; break;
        }
      }
      if (nearShore) break;
    }
    if (!nearShore) continue;
    const noiseX = Math.round(fbmNoise(x / 25 + 500, y / 25 + 500, 4) * COAST_DISP);
    const noiseY = Math.round(fbmNoise(y / 25 + 700, x / 25 + 700, 4) * COAST_DISP);
    const sx = Math.max(0, Math.min(W - 1, x + noiseX));
    const sy = Math.max(0, Math.min(H - 1, y + noiseY));
    land[i] = landRaw[sy * W + sx];
  }

  let landPx = 0;
  for (let i = 0; i < W * H; i++) if (land[i]) landPx++;
  console.log(`Land: ${(landPx / (W * H) * 100).toFixed(1)}%`);

  // Step 4: Extract coastline contours
  console.log("Extracting contours...");
  const coastContoursRaw = extractContours(land, W, H);
  const MIN_CONTOUR = 40;
  const coastContours = coastContoursRaw.filter(c => c.length >= MIN_CONTOUR);
  console.log(`  ${coastContoursRaw.length} raw → ${coastContours.length} coastline contours (min ${MIN_CONTOUR} pts)`);

  // Convert to SVG paths
  const coastPaths = coastContours.map(c => {
    const s = simplify(c, 0.8);
    return "M" + s.map(([x, y]) => `${(x * SX).toFixed(1)},${(y * SY).toFixed(1)}`).join("L") + "Z";
  });

  // Step 5: Cluster islands + assign regions
  console.log("Building faction regions...");
  const factions = [
    { id: "ignis-empire",    nx: 0.14, ny: 0.56, r: 180, g: 100, b: 90,  name: "Империя Игнис",        tom: 4, desc: "Юг левого материка" },
    { id: "wandering-dale",  nx: 0.19, ny: 0.35, r: 110, g: 160, b: 110, name: "Блуждающий Дол",        tom: 1, desc: "Центр левого материка" },
    { id: "azure-rivers",    nx: 0.24, ny: 0.15, r: 100, g: 160, b: 200, name: "Коалиция Лазурных Рек", tom: 2, desc: "Север левого материка" },
    { id: "aurumgard",       nx: 0.73, ny: 0.20, r: 200, g: 185, b: 110, name: "Аурумгард",             tom: 5, desc: "Север правого материка" },
    { id: "neutral-zone",    nx: 0.72, ny: 0.40, r: 170, g: 170, b: 160, name: "Нейтральные земли",     tom: 1, desc: "Центр правого материка" },
    { id: "tektron",         nx: 0.72, ny: 0.58, r: 200, g: 175, b: 120, name: "Тектрон",               tom: 3, desc: "Юг правого материка" },
    { id: "dead-zone",       nx: 0.48, ny: 0.47, r: 150, g: 150, b: 165, name: "Кузня Мудреца",         tom: 8, desc: "Кратер метеорита в центре", islandOnly: true },
    { id: "cult-island",     nx: 0.20, ny: 0.86, r: 140, g: 110, b: 160, name: "Остров Культа",          tom: 6, desc: "Юго-запад, культисты", hidden: true, islandOnly: true },
    { id: "oblivion-island", nx: 0.83, ny: 0.87, r: 160, g: 130, b: 180, name: "Остров Забвения",        tom: 6, desc: "Юго-восток", hidden: true, islandOnly: true },
  ];

  // 5a: Connected-component labeling (identify separate landmasses/islands)
  console.log("  Clustering landmasses...");
  const clusterMap = new Int32Array(W * H).fill(-1);
  const clusters = []; // {id, pixels, cx, cy, area}
  let clusterCount = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || clusterMap[i] >= 0) continue;
    const cid = clusterCount++;
    const q = [[x, y]]; clusterMap[i] = cid;
    let sx = 0, sy = 0, cnt = 0;
    while (q.length) {
      const [cx, cy] = q.pop();
      sx += cx; sy += cy; cnt++;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx+dx, ny = cy+dy;
        if (nx<0||nx>=W||ny<0||ny>=H) continue;
        const ni = ny*W+nx;
        if (land[ni] && clusterMap[ni] < 0) { clusterMap[ni] = cid; q.push([nx, ny]); }
      }
    }
    clusters.push({ id: cid, cx: sx/cnt, cy: sy/cnt, area: cnt });
  }
  console.log(`  ${clusters.length} landmasses found`);
  clusters.sort((a, b) => b.area - a.area);
  clusters.slice(0, 10).forEach(c => console.log(`    #${c.id}: ${c.area}px center=(${Math.round(c.cx*SX)},${Math.round(c.cy*SY)})`));

  // 5b: Determine which clusters are "continents" (have at least one non-islandOnly seed on them)
  const regionBuf = Buffer.alloc(W * H);
  regionBuf.fill(255);

  const continentClusters = new Set();
  for (let fi = 0; fi < factions.length; fi++) {
    if (factions[fi].islandOnly) continue;
    const sx = Math.round(factions[fi].nx * W), sy = Math.round(factions[fi].ny * H);
    const sr = 50;
    for (let dy = -sr; dy <= sr; dy++) for (let dx = -sr; dx <= sr; dx++) {
      const nx = sx+dx, ny = sy+dy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      const ni = ny*W+nx;
      if (land[ni] && clusterMap[ni] >= 0) { continentClusters.add(clusterMap[ni]); break; }
    }
  }
  console.log(`  ${continentClusters.size} continent cluster(s), ${clusters.length - continentClusters.size} island(s)`);

  // Multi-source BFS on continent land (skip islandOnly factions)
  const dist = new Float32Array(W * H); dist.fill(Infinity);
  const queue = [];
  let qHead = 0;
  for (let fi = 0; fi < factions.length; fi++) {
    if (factions[fi].islandOnly) continue;
    const sx = Math.round(factions[fi].nx * W), sy = Math.round(factions[fi].ny * H);
    let bx = sx, by = sy, bestD = Infinity;
    const sr = 40;
    for (let dy = -sr; dy <= sr; dy++) for (let dx = -sr; dx <= sr; dx++) {
      const nx = sx+dx, ny = sy+dy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      const ni = ny*W+nx;
      if (land[ni] && continentClusters.has(clusterMap[ni])) {
        const d = dx*dx + dy*dy;
        if (d < bestD) { bestD = d; bx = nx; by = ny; }
      }
    }
    if (bestD < Infinity) {
      const bi = by*W+bx;
      regionBuf[bi] = fi; dist[bi] = 0;
      queue.push(bx, by, fi, 0);
    }
  }

  while (qHead < queue.length) {
    const cx = queue[qHead], cy = queue[qHead+1], fi = queue[qHead+2], cd = queue[qHead+3];
    qHead += 4;
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = cx+dx, ny = cy+dy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      const ni = ny*W+nx;
      if (!land[ni]) continue;
      if (!continentClusters.has(clusterMap[ni])) continue;
      const nd = cd + 1;
      if (nd < dist[ni]) { dist[ni] = nd; regionBuf[ni] = fi; queue.push(nx, ny, fi, nd); }
    }
  }

  // Apply noise displacement near faction borders (multiple passes for organic look)
  console.log("  Applying noisy border displacement...");
  const borderBand = 30;
  for (let pass = 0; pass < 3; pass++) {
    const regionCopy = Buffer.from(regionBuf);
    for (let y = borderBand; y < H - borderBand; y++) for (let x = borderBand; x < W - borderBand; x++) {
      const i = y * W + x;
      if (!land[i] || regionBuf[i] === 255) continue;
      const cur = regionBuf[i];
      let minBorderDist = Infinity;
      const checkR = 3;
      for (let dy = -checkR; dy <= checkR; dy++) for (let dx = -checkR; dx <= checkR; dx++) {
        const ni = regionBuf[(y+dy)*W + (x+dx)];
        if (ni !== 255 && ni !== cur) { minBorderDist = 0; break; }
        if (minBorderDist === 0) break;
      }
      if (minBorderDist > 0) continue;
      const seed1 = pass * 73.7;
      const noiseX = Math.round(fbmNoise(x / 18 + seed1, y / 18 + seed1, 4) * borderBand);
      const noiseY = Math.round(fbmNoise(y / 18 + seed1 + 200, x / 18 + seed1 + 200, 4) * borderBand);
      const sx = Math.max(0, Math.min(W-1, x + noiseX));
      const sy = Math.max(0, Math.min(H-1, y + noiseY));
      const si = sy * W + sx;
      if (land[si] && regionBuf[si] !== 255) {
        regionCopy[i] = regionBuf[si];
      }
    }
    for (let i = 0; i < W * H; i++) if (land[i]) regionBuf[i] = regionCopy[i];
  }

  // 5c: For each island (non-continent), assign whole island to nearest faction seed
  for (const cl of clusters) {
    if (continentClusters.has(cl.id)) continue;
    const px = cl.cx / W, py = cl.cy / H;
    let minD = Infinity, minI = 0;
    factions.forEach((f, fi) => {
      const d = (px - f.nx) ** 2 + (py - f.ny) ** 2;
      if (d < minD) { minD = d; minI = fi; }
    });
    // Assign ENTIRE island to one faction
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (clusterMap[y*W+x] === cl.id) regionBuf[y*W+x] = minI;
    }
  }

  fs.writeFileSync('aurax-region-map.bin', regionBuf);

  const HIT_SIZE = 1024;
  const hitBuf = new Uint8Array(HIT_SIZE * HIT_SIZE);
  for (let y = 0; y < HIT_SIZE; y++) for (let x = 0; x < HIT_SIZE; x++) {
    const sx = Math.floor(x / HIT_SIZE * W), sy = Math.floor(y / HIT_SIZE * H);
    hitBuf[y * HIT_SIZE + x] = regionBuf[sy * W + sx];
  }
  fs.writeFileSync('aurax-hit.bin', Buffer.from(hitBuf));

  console.log("  Regions assigned.");

  // Step 6: Extract faction border lines
  console.log("Extracting faction borders...");
  const factionBorders = extractFactionBorders(regionBuf, land, W, H, SX, SY, factions.length);
  console.log(`  ${factionBorders.length} border segments`);

  // Step 7a: Generate region-map.png (color map for browser rendering)
  console.log("\nGenerating region-map.png...");
  const regionImg = new Jimp(W, H);
  const parchBase = [222, 218, 200];
  const mixAmt = 0.40;
  const oceanRGB = [58, 95, 140];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    const fi = regionBuf[i];
    let cr, cg, cb;
    if (fi === 255) {
      cr = oceanRGB[0]; cg = oceanRGB[1]; cb = oceanRGB[2];
    } else if (fi < factions.length) {
      const f = factions[fi];
      cr = Math.round(parchBase[0]*(1-mixAmt) + f.r*mixAmt);
      cg = Math.round(parchBase[1]*(1-mixAmt) + f.g*mixAmt);
      cb = Math.round(parchBase[2]*(1-mixAmt) + f.b*mixAmt);
    } else {
      cr = 180; cg = 180; cb = 170;
    }
    regionImg.setPixelColor(Jimp.rgbaToInt(cr, cg, cb, 255), x, y);
  }
  await regionImg.writeAsync('region-map.png');
  console.log(`  region-map.png: ${(fs.statSync('region-map.png').size / 1024).toFixed(0)} KB`);

  // Step 7b: Remove tiny land specks (noise artifacts) before shelf computation
  console.log("Cleaning tiny land specks...");
  const MIN_SPECK = 2000;
  const speckVisited = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || speckVisited[i]) continue;
    const pixels = [];
    const sq = [[x, y]]; speckVisited[i] = 1;
    while (sq.length) {
      const [cx, cy] = sq.pop(); pixels.push(cy * W + cx);
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx+dx, ny = cy+dy;
        if (nx<0||nx>=W||ny<0||ny>=H) continue;
        const ni = ny*W+nx;
        if (land[ni] && !speckVisited[ni]) { speckVisited[ni] = 1; sq.push([nx, ny]); }
      }
    }
    if (pixels.length < MIN_SPECK) {
      for (const pi of pixels) { land[pi] = 0; regionBuf[pi] = 255; }
    }
  }

  // Build shelf-source land (only large landmasses contribute to shelf)
  const SHELF_MIN_AREA = 10000;
  const shelfLand = new Uint8Array(W * H);
  const sv2 = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    if (!land[i] || sv2[i]) continue;
    const pxs = [];
    const q2 = [[x, y]]; sv2[i] = 1;
    while (q2.length) {
      const [cx, cy] = q2.pop(); pxs.push(cy * W + cx);
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nx = cx+dx, ny = cy+dy;
        if (nx<0||nx>=W||ny<0||ny>=H) continue;
        const ni = ny*W+nx;
        if (land[ni] && !sv2[ni]) { sv2[ni] = 1; q2.push([nx, ny]); }
      }
    }
    if (pxs.length >= SHELF_MIN_AREA) for (const pi of pxs) shelfLand[pi] = 1;
  }

  // Compute ocean distance from shore (for shelf gradient)
  console.log("Computing ocean shelf distance...");
  const shelfDist = new Float32Array(W * H);
  shelfDist.fill(1e9);
  const SHELF_MAX = 200;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!shelfLand[y * W + x]) continue;
    for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nx = x+dx, ny = y+dy;
      if (nx<0||nx>=W||ny<0||ny>=H) continue;
      const ni = ny*W+nx;
      if (!land[ni]) shelfDist[ni] = 0;
    }
  }
  // Multi-pass chamfer distance (3-5-7 approximation of Euclidean)
  const INF = 1e9;
  for (let y = 1; y < H-1; y++) for (let x = 1; x < W-1; x++) {
    const i = y*W+x;
    if (land[i]) continue;
    const d = shelfDist;
    d[i] = Math.min(d[i],
      d[i-1]+1, d[i-W]+1,
      d[(y-1)*W+(x-1)]+1.414, d[(y-1)*W+(x+1)]+1.414);
  }
  for (let y = H-2; y >= 1; y--) for (let x = W-2; x >= 1; x--) {
    const i = y*W+x;
    if (land[i]) continue;
    const d = shelfDist;
    d[i] = Math.min(d[i],
      d[i+1]+1, d[i+W]+1,
      d[(y+1)*W+(x-1)]+1.414, d[(y+1)*W+(x+1)]+1.414);
  }

  // Step 7c: Generate heightmap-preview.png
  console.log("Generating heightmap-preview.png...");
  const preview = new Jimp(W, H);

  const shelfNear = [85, 128, 168];
  const deepOcean = [35, 60, 100];

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x;
    let r, g, b;

    if (!land[i]) {
      const d = Math.min(shelfDist[i], SHELF_MAX);
      const t = Math.pow(d / SHELF_MAX, 0.7);
      r = Math.round(shelfNear[0] + t * (deepOcean[0] - shelfNear[0]));
      g = Math.round(shelfNear[1] + t * (deepOcean[1] - shelfNear[1]));
      b = Math.round(shelfNear[2] + t * (deepOcean[2] - shelfNear[2]));
    } else {
      const fi = regionBuf[i];
      if (fi < factions.length) {
        const f = factions[fi];
        r = f.r; g = f.g; b = f.b;
        // Slight brightness variation from blur value
        const variation = (blurred[i] - SEA_THR) / (1 - SEA_THR);
        r = Math.min(255, Math.round(r * (0.85 + variation * 0.2)));
        g = Math.min(255, Math.round(g * (0.85 + variation * 0.2)));
        b = Math.min(255, Math.round(b * (0.85 + variation * 0.2)));
      } else {
        r = 180; g = 180; b = 170;
      }
    }

    // Coast darkening
    if (land[i]) {
      let nearOcean = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const cx = x + dx, cy = y + dy;
        if (cx >= 0 && cx < W && cy >= 0 && cy < H && !land[cy * W + cx]) { nearOcean = true; break; }
      }
      if (nearOcean) { r = Math.round(r * 0.75); g = Math.round(g * 0.75); b = Math.round(b * 0.75); }
    }

    // Border darkening
    if (land[i] && regionBuf[i] !== 255) {
      const cur = regionBuf[i];
      let isBorder = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const cx = x + dx, cy = y + dy;
        if (cx >= 0 && cx < W && cy >= 0 && cy < H) {
          const ni = regionBuf[cy * W + cx];
          if (ni !== 255 && ni !== cur) { isBorder = true; break; }
        }
      }
      if (isBorder) { r = Math.round(r * 0.55); g = Math.round(g * 0.55); b = Math.round(b * 0.55); }
    }

    preview.setPixelColor(Jimp.rgbaToInt(r, g, b, 255), x, y);
  }

  // Draw faction labels on preview (just dots for seeds)
  for (const f of factions) {
    const fx = Math.round(f.nx * W), fy = Math.round(f.ny * H);
    for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
      const px = fx + dx, py = fy + dy;
      if (px >= 0 && px < W && py >= 0 && py < H && dx*dx+dy*dy <= 9) {
        preview.setPixelColor(Jimp.rgbaToInt(255, 255, 255, 255), px, py);
      }
    }
  }

  await preview.writeAsync('heightmap-preview.png');
  console.log(`  heightmap-preview.png: ${(fs.statSync('heightmap-preview.png').size / 1024).toFixed(0)} KB`);

  // Step 8: Build output JSON
  const regions = factions.map((f) => ({
    id: f.id, name: f.name, tom: f.tom, hidden: !!f.hidden,
    cx: Math.round(f.nx * VW), cy: Math.round(f.ny * VH),
    color: `rgb(${f.r},${f.g},${f.b})`, r: f.r, g: f.g, b: f.b,
    desc: f.desc,
  }));

  const world = {
    viewBox: `0 0 ${VW} ${VH}`,
    hmW: W, hmH: H,
    coastPaths,
    factionBorders,
    regions,
    hitBin: "data/aurax-hit.bin", hitSize: HIT_SIZE,
  };

  fs.writeFileSync('aurax-world.json', JSON.stringify(world));
  console.log(`\naurax-world.json: ${(fs.statSync('aurax-world.json').size / 1024).toFixed(0)} KB`);
  console.log(`aurax-region-map.bin: ${(fs.statSync('aurax-region-map.bin').size / 1024).toFixed(0)} KB`);
  console.log("\nDone! Open heightmap-preview.png to see the political map.");
}

// ========= BOX BLUR =========
function boxBlur(data, W, H, radius) {
  const tmp = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let sum = 0, cnt = 0;
    for (let dx = -radius; dx <= radius; dx++) {
      const cx = Math.min(W - 1, Math.max(0, x + dx));
      sum += data[y * W + cx]; cnt++;
    }
    tmp[y * W + x] = sum / cnt;
  }
  const out = new Float32Array(W * H);
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) {
    let sum = 0, cnt = 0;
    for (let dy = -radius; dy <= radius; dy++) {
      const cy = Math.min(H - 1, Math.max(0, y + dy));
      sum += tmp[cy * W + x]; cnt++;
    }
    out[y * W + x] = sum / cnt;
  }
  return out;
}

// ========= CONTOUR EXTRACTION =========
function extractContours(land, W, H) {
  const bd = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    if (!land[y * W + x]) continue;
    if (!land[y*W+x-1] || !land[y*W+x+1] || !land[(y-1)*W+x] || !land[(y+1)*W+x]) bd.push([x, y]);
  }
  if (!bd.length) return [];

  const used = new Set();
  const bS = new Set(bd.map(([x, y]) => y * W + x));
  const out = [];

  for (const [sx, sy] of bd) {
    const sk = sy * W + sx;
    if (used.has(sk)) continue;
    const ch = [[sx, sy]];
    used.add(sk);
    let cx = sx, cy = sy;
    for (let s = 0; s < bd.length; s++) {
      let found = false;
      for (const [dx, dy] of [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]) {
        const nx = cx + dx, ny = cy + dy, nk = ny * W + nx;
        if (bS.has(nk) && !used.has(nk)) {
          ch.push([nx, ny]);
          used.add(nk);
          cx = nx; cy = ny;
          found = true;
          break;
        }
      }
      if (!found) break;
    }
    if (ch.length > 20) out.push(ch);
  }
  return out;
}

// ========= SIMPLIFY (Ramer-Douglas-Peucker) =========
function simplify(pts, tol) {
  if (pts.length <= 2) return pts;
  function pld(p, a, b) {
    const dx = b[0]-a[0], dy = b[1]-a[1], l2 = dx*dx+dy*dy;
    if (!l2) return Math.hypot(p[0]-a[0], p[1]-a[1]);
    const t = Math.max(0, Math.min(1, ((p[0]-a[0])*dx+(p[1]-a[1])*dy)/l2));
    return Math.hypot(p[0]-(a[0]+t*dx), p[1]-(a[1]+t*dy));
  }
  function rdp(p, e) {
    if (p.length <= 2) return p;
    let dm = 0, di = 0;
    for (let i = 1; i < p.length - 1; i++) {
      const d = pld(p[i], p[0], p[p.length-1]);
      if (d > dm) { dm = d; di = i; }
    }
    if (dm > e) return rdp(p.slice(0, di+1), e).slice(0, -1).concat(rdp(p.slice(di), e));
    return [p[0], p[p.length-1]];
  }
  return rdp(pts, tol);
}

// ========= FACTION BORDER EXTRACTION =========
function extractFactionBorders(regionBuf, land, W, H, SX, SY, nFactions) {
  // Collect border pixels between different factions
  const borderPixels = [];
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = y * W + x;
    if (regionBuf[i] === 255) continue;
    const cur = regionBuf[i];
    for (const [dx, dy] of [[1, 0], [0, 1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx >= W || ny >= H) continue;
      const ni = regionBuf[ny * W + nx];
      if (ni === 255 || ni === cur) continue;
      const key = Math.min(cur, ni) * 100 + Math.max(cur, ni);
      borderPixels.push({ x, y, key });
    }
  }

  // Group by pair
  const groups = {};
  for (const bp of borderPixels) {
    if (!groups[bp.key]) groups[bp.key] = [];
    groups[bp.key].push([bp.x, bp.y]);
  }

  // Convert each group to simplified SVG path
  const paths = [];
  for (const key of Object.keys(groups)) {
    const pts = groups[key];
    if (pts.length < 5) continue;

    // Sort by x then y for consistent chaining
    pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);

    // Simple chain: walk through sorted pixels
    const simplified = simplify(pts, 2.0);
    const svgPath = simplified.map(([x, y]) => `${(x * SX).toFixed(1)},${(y * SY).toFixed(1)}`).join("L");
    paths.push("M" + svgPath);
  }

  return paths;
}

main().catch(err => { console.error(err); process.exit(1); });
