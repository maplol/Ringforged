import type { Room, Obstacle, ObstacleType, RoomEventType, RoomEvent } from "./types";
import { ElementType } from "./types";
import { ROOM_SIZES, WALL_THICKNESS, DOOR_WIDTH } from "./constants";
import { shuffle, uid, randRange, pick } from "./utils";

function roomSize(type: Room["type"]): { width: number; height: number } {
  const s = ROOM_SIZES[type] ?? ROOM_SIZES.normal;
  return {
    width: Math.round(randRange(s.minW, s.maxW)),
    height: Math.round(randRange(s.minH, s.maxH)),
  };
}

function generateObstacles(type: Room["type"], w: number, h: number): Obstacle[] {
  if (type === "start" || type === "treasure") return [];

  const pad = WALL_THICKNESS + 60;
  const cx = w / 2;
  const cy = h / 2;
  const doorZone = DOOR_WIDTH / 2 + 40;

  const count = type === "boss" ? randRange(5, 8) : type === "elite" ? randRange(4, 7) : randRange(2, 5);
  const obstacles: Obstacle[] = [];

  const types: ObstacleType[] = ["pillar", "barrel", "lava", "crystal"];

  for (let i = 0; i < count; i++) {
    let x: number, y: number;
    let tries = 0;
    do {
      x = randRange(pad, w - pad);
      y = randRange(pad, h - pad);
      tries++;
    } while (
      tries < 20 && (
        (Math.abs(x - cx) < 80 && Math.abs(y - cy) < 80) ||
        (y < pad + doorZone && Math.abs(x - cx) < doorZone) ||
        (y > h - pad - doorZone && Math.abs(x - cx) < doorZone) ||
        (x < pad + doorZone && Math.abs(y - cy) < doorZone) ||
        (x > w - pad - doorZone && Math.abs(y - cy) < doorZone) ||
        obstacles.some(o => Math.hypot(o.x - x, o.y - y) < 80)
      )
    );

    const otype = pick(types);
    const radius = otype === "pillar" ? randRange(18, 30)
      : otype === "barrel" ? randRange(14, 20)
      : otype === "lava" ? randRange(30, 55)
      : randRange(12, 18);

    obstacles.push({
      id: uid(),
      x,
      y,
      type: otype,
      radius,
      hp: otype === "barrel" ? 2 : otype === "crystal" ? 1 : 999,
      maxHp: otype === "barrel" ? 2 : otype === "crystal" ? 1 : 999,
      destroyed: false,
      element: otype === "crystal"
        ? pick(Object.values(ElementType))
        : undefined,
    });
  }

  return obstacles;
}

export function generateMap(roomCount: number): Record<string, Room> {
  const map: Record<string, Room> = {};
  const key = (x: number, y: number) => `${x},${y}`;
  const dirs: [number, number, keyof Room["doors"], keyof Room["doors"]][] = [
    [0, -1, "top", "bottom"],
    [0, 1, "bottom", "top"],
    [-1, 0, "left", "right"],
    [1, 0, "right", "left"],
  ];

  const startSize = roomSize("start");
  const start: Room = {
    x: 0,
    y: 0,
    cleared: true,
    visited: true,
    type: "start",
    doors: { top: false, bottom: false, left: false, right: false },
    width: startSize.width,
    height: startSize.height,
    obstacles: [],
  };
  map[key(0, 0)] = start;

  const frontier: [number, number][] = [[0, 0]];
  let placed = 1;

  while (placed < roomCount && frontier.length > 0) {
    const fi = Math.floor(Math.random() * frontier.length);
    const [fx, fy] = frontier[fi];
    const shuffled = shuffle(dirs);

    let expanded = false;
    for (const [dx, dy, fromDoor, toDoor] of shuffled) {
      const nx = fx + dx;
      const ny = fy + dy;
      if (map[key(nx, ny)]) continue;

      const isBoss = placed === roomCount - 1;
      const isElite = !isBoss && placed > 2 && Math.random() < 0.2;
      const isTreasure = !isBoss && !isElite && placed > 1 && Math.random() < 0.12;
      const isEvent = !isBoss && !isElite && !isTreasure && placed > 2 && Math.random() < 0.1;

      const rType: Room["type"] = isBoss ? "boss" : isElite ? "elite" : isTreasure ? "treasure" : isEvent ? "event" : "normal";
      const size = roomSize(rType);

      const eventTypes: RoomEventType[] = ["altar", "merchant", "trap", "chest", "speed_trial"];
      const roomEvent: RoomEvent | undefined = rType === "event"
        ? { type: pick(eventTypes), active: true }
        : undefined;

      const room: Room = {
        x: nx,
        y: ny,
        cleared: rType === "event" && roomEvent?.type !== "trap" && roomEvent?.type !== "speed_trial",
        visited: false,
        type: rType,
        event: roomEvent,
        doors: { top: false, bottom: false, left: false, right: false },
        width: size.width,
        height: size.height,
        obstacles: generateObstacles(rType, size.width, size.height),
      };
      room.doors[toDoor] = true;
      map[key(fx, fy)].doors[fromDoor] = true;

      map[key(nx, ny)] = room;
      frontier.push([nx, ny]);
      placed++;
      expanded = true;
      break;
    }

    if (!expanded) {
      frontier.splice(fi, 1);
    }
  }

  // Find boss room and attach an exit room
  const bossEntry = Object.entries(map).find(([, r]) => r.type === "boss");
  if (bossEntry) {
    const [bossKey, bossRoom] = bossEntry;
    const [bx, by] = bossKey.split(",").map(Number);
    const exitDirs: [number, number, keyof Room["doors"], keyof Room["doors"]][] = [
      [0, -1, "top", "bottom"],
      [0, 1, "bottom", "top"],
      [-1, 0, "left", "right"],
      [1, 0, "right", "left"],
    ];
    for (const [dx, dy, fromDoor, toDoor] of shuffle(exitDirs)) {
      const ex = bx + dx;
      const ey = by + dy;
      if (map[key(ex, ey)]) continue;
      const exitSize = roomSize("exit");
      const exitRoom: Room = {
        x: ex, y: ey,
        cleared: true, visited: false,
        type: "exit",
        doors: { top: false, bottom: false, left: false, right: false },
        width: exitSize.width, height: exitSize.height,
        obstacles: [],
      };
      exitRoom.doors[toDoor] = true;
      bossRoom.doors[fromDoor] = true;
      map[key(ex, ey)] = exitRoom;
      break;
    }
  }

  return map;
}
