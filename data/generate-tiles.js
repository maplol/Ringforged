const Jimp = require("jimp");
const fs = require("fs");
const path = require("path");

const TILE_SIZE = 256;
const SRC = "heightmap-preview.png";
const OUT_DIR = "tiles";
const MAX_ZOOM = 4; // 2^4 = 16 tiles per axis → 16*256 = 4096

async function main() {
  console.log("Loading source image...");
  const img = await Jimp.read(SRC);
  const W = img.bitmap.width, H = img.bitmap.height;
  console.log(`  Source: ${W}x${H}`);

  if (fs.existsSync(OUT_DIR)) fs.rmSync(OUT_DIR, { recursive: true });

  for (let z = 0; z <= MAX_ZOOM; z++) {
    const gridSize = Math.pow(2, z);
    const scaledW = gridSize * TILE_SIZE;
    const scaledH = gridSize * TILE_SIZE;

    console.log(`Zoom ${z}: ${gridSize}x${gridSize} tiles (${scaledW}x${scaledH}px scaled)`);

    const scaled = img.clone().resize(scaledW, scaledH, Jimp.RESIZE_BICUBIC);

    const zDir = path.join(OUT_DIR, String(z));
    fs.mkdirSync(zDir, { recursive: true });

    for (let ty = 0; ty < gridSize; ty++) {
      for (let tx = 0; tx < gridSize; tx++) {
        const tile = scaled.clone().crop(
          tx * TILE_SIZE, ty * TILE_SIZE,
          TILE_SIZE, TILE_SIZE
        );
        const fname = path.join(zDir, `${tx}_${ty}.png`);
        await tile.writeAsync(fname);
      }
    }

    const tileCount = gridSize * gridSize;
    const dirSize = fs.readdirSync(zDir).reduce((s, f) => s + fs.statSync(path.join(zDir, f)).size, 0);
    console.log(`  ${tileCount} tiles, ${(dirSize / 1024).toFixed(0)} KB total`);
  }

  const meta = { tileSize: TILE_SIZE, maxZoom: MAX_ZOOM, imageSize: W };
  fs.writeFileSync(path.join(OUT_DIR, "meta.json"), JSON.stringify(meta));
  console.log("\nDone! Tiles in " + OUT_DIR + "/");
}

main().catch(err => { console.error(err); process.exit(1); });
