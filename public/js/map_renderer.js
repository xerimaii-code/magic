// js/map_renderer.js
export const OBJ = {
  HOUSE: 0, OAK_TREE: 1, PINE_TREE: 2, DEAD_TREE: 3, ROCK: 4,
  WALL: 5, WATER: 6, LAVA: 7, BOSS_ALTAR: 8, ELVEN_HOUSE: 9,
  DESERT_TENT: 10, PIRATE_SHIP: 11, MAGIC_TOWER: 12, IGLOO: 13, CACTUS: 14,
  PALM_TREE: 15, CAMP_TENT: 16, SNOW_HOUSE: 17, CRYSTAL_WALL: 18,
  SEA: 19, DOCK: 20, SHIP_WALL: 21, CABIN_DESK: 22, CANYON_WALL: 23,
  OBSIDIAN_WALL: 24, PORTAL: 25, DRAGON_EGG: 26, VOID_PLATFORM: 27,
  TOXIC_POOL: 28, MUD: 29, PLAZA: 30, CAMPFIRE: 31,
  VILLAGE_HOUSE: 100, WINDMILL: 101, ANCIENT_PILLAR: 102, BROKEN_PILLAR: 103,
  GOBLIN_CAVE_ENTRANCE: 104, CHIEF_TENT: 105, WELL: 106, FENCE_POST: 107, ORE_VEIN: 108,
  // R02 실버바인(Silvervine) 전용 오브젝트
  FAIRY_MUSHROOM_HOUSE: 109, FAIRY_TENT: 110, FAIRY_POND: 111, GIANT_MUSHROOM: 112,
  SILVER_VINE_TREE: 113, LUMBER_MILL: 114, LOG_PILE: 115, CORRUPTED_WORLD_TREE: 116,
  // R05 모라안(Moraan) 전용 오브젝트
  CARAVAN_WAGON: 117, SUNKEN_RUINS: 118, ANT_HELL_CRATER: 119, PHARAOH_PYRAMID: 120, OBELISK: 121,
  // R07 발레노스(Balenos) 전용 오브젝트
  HARBOR_HOUSE: 122, HARBOR_SHIP: 123, CARGO_CRATES: 124, ANCHOR_WRECK: 125,
  SHIPWRECK: 126, PIRATE_CABIN: 127, SEA_STACK: 128,
  // R03 칼라드루 ~ R15 이터니티 전용 랜드마크 오브젝트
  FORTRESS_WALL: 129, MINE_ENTRANCE: 130, RUNE_ALTAR: 131,
  ELVEN_ARCH: 132, GLOW_TREE: 133, SUNKEN_TEMPLE: 134, WATER_THRONE: 135,
  SWAMP_TENT: 136, BEAST_DEN: 137, TOXIC_ALTAR: 138,
  ICE_IGLOO: 139, ICE_SPIRE: 140, CRYSTAL_CAVE: 141, FROST_THRONE: 142,
  VOLCANO_CONE: 143, DEMON_CRATER: 144,
  RAVEN_TENT: 145, UNDEAD_CRYPT: 146, LICH_CASTLE: 147,
  HARPY_NEST: 148, STORMBIRD_ALTAR: 149,
  MANA_CRYSTAL: 150, ARCANE_AIRSHIP: 151, TITAN_DOME: 152,
  GIANT_RIBCAGE: 153, TORTURE_FORTRESS: 154, NETHER_PORTAL: 155,
  TRAINING_RUINS: 156, DRAKE_NEST: 157, DRAGON_LAIR: 158,
  RIFT_GATE: 159, ABYSS_CRYSTAL: 160, KAELEN_THRONE: 161
};

export const HardcodedMapDB = {};

export class DetailFieldRenderer {
  // 지역 ID별 4000x16000 심리스 배경 라우터
  static drawRegionField(ctx, w, h, regionId = "R01") {
    if (regionId === "R01") this.drawAltriaField(ctx, w, h);
    else if (regionId === "R02") this.drawSilvervineField(ctx, w, h);
    else if (regionId === "R05") this.drawMoraanField(ctx, w, h);
    else if (regionId === "R07") this.drawBalenosField(ctx, w, h);
    else this.drawThemedSeamlessField(ctx, w, h, regionId);
  }

  // 오브젝트 타입별 통합 렌더러
  static drawCustomObject(ctx, type, x, y, w, h, extra) {
    if (type === OBJ.VILLAGE_HOUSE) this.drawVillageHouse(ctx, x, y, w, h, extra);
    else if (type === OBJ.WINDMILL) this.drawWindmill(ctx, x, y, w, h);
    else if (type === OBJ.ANCIENT_PILLAR) this.drawAncientPillar(ctx, x, y, w, false);
    else if (type === OBJ.BROKEN_PILLAR) this.drawAncientPillar(ctx, x, y, w, true);
    else if (type === OBJ.GOBLIN_CAVE_ENTRANCE) this.drawGoblinCaveEntrance(ctx, x, y, w, h);
    else if (type === OBJ.CHIEF_TENT) this.drawChiefTent(ctx, x, y, w, h);
    else if (type === OBJ.FAIRY_MUSHROOM_HOUSE) this.drawFairyMushroomHouse(ctx, x, y, w, h, extra);
    else if (type === OBJ.FAIRY_TENT) this.drawFairyTent(ctx, x, y, w, h, extra);
    else if (type === OBJ.FAIRY_POND) this.drawFairyPond(ctx, x, y, w, h);
    else if (type === OBJ.GIANT_MUSHROOM) this.drawGiantMushroom(ctx, x, y, w, extra);
    else if (type === OBJ.SILVER_VINE_TREE) this.drawSilverVineTree(ctx, x, y, w, h);
    else if (type === OBJ.LUMBER_MILL) this.drawLumberMill(ctx, x, y, w, h);
    else if (type === OBJ.LOG_PILE) this.drawLogPile(ctx, x, y, w, h);
    else if (type === OBJ.CORRUPTED_WORLD_TREE) this.drawCorruptedWorldTree(ctx, x, y, w, h);
    else if (type === OBJ.CARAVAN_WAGON) this.drawCaravanWagon(ctx, x, y, w, h);
    else if (type === OBJ.SUNKEN_RUINS) this.drawSunkenRuins(ctx, x, y, w, h);
    else if (type === OBJ.ANT_HELL_CRATER) this.drawAntHellCrater(ctx, x, y, w, h);
    else if (type === OBJ.PHARAOH_PYRAMID) this.drawPharaohPyramid(ctx, x, y, w, h);
    else if (type === OBJ.OBELISK) this.drawObelisk(ctx, x, y, w, h);
    else if (type === OBJ.PALM_TREE) this.drawPalmTree(ctx, x, y, w);
    else if (type === OBJ.CACTUS) this.drawCactus(ctx, x, y, w);
    else if (type === OBJ.HARBOR_HOUSE) this.drawHarborHouse(ctx, x, y, w, h, extra);
    else if (type === OBJ.HARBOR_SHIP) this.drawHarborShip(ctx, x, y, w, h, extra);
    else if (type === OBJ.CARGO_CRATES) this.drawCargoCrates(ctx, x, y, w, h);
    else if (type === OBJ.ANCHOR_WRECK) this.drawAnchorWreck(ctx, x, y, w, h);
    else if (type === OBJ.SHIPWRECK) this.drawShipwreck(ctx, x, y, w, h, extra);
    else if (type === OBJ.PIRATE_CABIN) this.drawPirateCabin(ctx, x, y, w, h);
    else if (type === OBJ.SEA_STACK) this.drawSeaStack(ctx, x, y, w);
    else if (type >= 129 && type <= 161) this.drawExtendedLandmark(ctx, type, x, y, w, h, extra);
    else if (type === OBJ.WELL) Renderer.drawWell(ctx, x, y, w);
    else if (type === OBJ.DESERT_TENT) Renderer.drawDesertTent(ctx, x, y, w, h);
    else if (type === OBJ.CAMP_TENT) Renderer.drawCampTent(ctx, x, y, w, h);
    else if (type === OBJ.BOSS_ALTAR) Renderer.drawBossAltar(ctx, x, y, w, h, extra);
    else if (type === OBJ.PORTAL) Renderer.drawPortal(ctx, x, y, w, h, extra);
    else if (type === OBJ.PLAZA) Renderer.drawPlaza(ctx, x, y, w, extra);
    else if (type === OBJ.CAMPFIRE) Renderer.drawCampfire(ctx, x, y, w);
    else if (type === OBJ.WALL) Renderer.drawWall(ctx, x, y, w, h);
    else if (type === OBJ.ROCK) Renderer.drawRock(ctx, x, y, w);
    else Renderer.drawTree(ctx, x, y, w, type);
  }

  // ==========================================================================
  // 1. R01 알트리아 (Altria) 4000x16000 필드 렌더러
  // ==========================================================================
  static drawAltriaField(ctx, w, h) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#4f7932");
    bgGrad.addColorStop(0.35, "#689f38");
    bgGrad.addColorStop(0.65, "#7cb342");
    bgGrad.addColorStop(1, "#558b2f");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 420; i++) {
      let px = (Math.abs(Math.sin(i * 12.9898) * 43758.5453) % 1) * w;
      let py = (Math.abs(Math.cos(i * 78.233) * 23421.631) % 1) * h;
      let rx = 120 + (i % 5) * 60;
      let ry = 80 + (i % 4) * 40;
      ctx.fillStyle = i % 2 === 0 ? "rgba(156, 204, 101, 0.16)" : "rgba(51, 105, 30, 0.14)";
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.save();
    const lakeGrad = ctx.createRadialGradient(3600, 15400, 100, 3600, 15400, 900);
    lakeGrad.addColorStop(0, "#29b6f6");
    lakeGrad.addColorStop(0.7, "#0288d1");
    lakeGrad.addColorStop(1, "#4e342e");
    ctx.fillStyle = lakeGrad;
    ctx.beginPath();
    ctx.moveTo(2750, 16000);
    ctx.quadraticCurveTo(3100, 14950, 4000, 14750);
    ctx.lineTo(4000, 16000);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#d7ccc8";
    ctx.lineWidth = 18;
    ctx.stroke();
    ctx.restore();

    this.drawDirtPaths(ctx);
    this.drawRiversAndBridges(ctx, w);
    this.drawVillageGround(ctx, 2000, 14250, 760);
    this.drawRuinsGround(ctx, 1450, 8100);
    this.drawCaveEntranceGround(ctx, 1100, 1950);
    this.drawChiefCampGround(ctx, 2950, 2100);
    this.drawGrassAndFlowers(ctx, w, h);
  }

  static drawDirtPaths(ctx) {
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    const drawRoad = (pts, width, edgeCol = "rgba(109, 76, 65, 0.55)", fillCol = "#d7b889") => {
      ctx.strokeStyle = edgeCol;
      ctx.lineWidth = width + 24;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = fillCol;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();
    };

    drawRoad([[1650, 15950], [1850, 15200], [2000, 14850], [2000, 13450]], 130);
    drawRoad([[2000, 13450], [1400, 12800], [1100, 11700], [1150, 10200], [1450, 8300]], 110);
    drawRoad([[2000, 13450], [2650, 12600], [2800, 11500], [2400, 9600], [1450, 8300]], 105);
    drawRoad([[1450, 8300], [2100, 6800], [2650, 4900], [2350, 3500]], 115);
    drawRoad([[2350, 3500], [1650, 2800], [1100, 2280]], 110);
    drawRoad([[2350, 3500], [2800, 2900], [2950, 2480]], 115);

    ctx.restore();
  }

  static drawRiversAndBridges(ctx, w) {
    ctx.save();
    const drawRiverCurve = (pts, riverWidth) => {
      ctx.strokeStyle = "#c5a880";
      ctx.lineWidth = riverWidth + 44;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = "#0288d1";
      ctx.lineWidth = riverWidth;
      ctx.stroke();

      ctx.strokeStyle = "#4fc3f7";
      ctx.lineWidth = riverWidth * 0.55;
      ctx.stroke();
    };

    let southRiverPts = [];
    for (let x = 0; x <= w; x += 200) {
      let y = 11600 + Math.sin(x / 450) * 180;
      southRiverPts.push([x, y]);
    }
    drawRiverCurve(southRiverPts, 220);

    let northRiverPts = [];
    for (let x = 0; x <= w; x += 200) {
      let y = 4300 + (x / w) * 1100 + Math.sin(x / 400) * 160;
      northRiverPts.push([x, y]);
    }
    drawRiverCurve(northRiverPts, 230);

    this.drawWoodBridge(ctx, 1100, 11680, 220, 340);
    this.drawWoodBridge(ctx, 2800, 11580, 220, 340);
    this.drawWoodBridge(ctx, 2650, 4920, 230, 360);

    ctx.restore();
  }

  static drawWoodBridge(ctx, cx, cy, bw, bh) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.fillRect(-bw / 2 + 12, -bh / 2 + 10, bw, bh);
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(-bw / 2 - 14, -bh / 2, bw + 28, bh);
    for (let y = -bh / 2 + 8; y < bh / 2 - 8; y += 26) {
      ctx.fillStyle = (Math.abs(y) % 52 === 0) ? "#8d6e63" : "#795548";
      ctx.fillRect(-bw / 2, y, bw, 22);
      ctx.strokeStyle = "#3e2723";
      ctx.lineWidth = 2;
      ctx.strokeRect(-bw / 2, y, bw, 22);
    }
    ctx.fillStyle = "#3e2723";
    for (let y = -bh / 2; y <= bh / 2; y += 70) {
      ctx.beginPath(); ctx.arc(-bw / 2 - 7, y, 10, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(bw / 2 + 7, y, 10, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  static drawVillageGround(ctx, cx, cy, r) {
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(0, 0, 100, 0, 0, r);
    grad.addColorStop(0, "#e6c994");
    grad.addColorStop(0.75, "#cfa96e");
    grad.addColorStop(1, "rgba(207, 169, 110, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#4e342e";
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(0, 0, r - 30, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r - 30, Math.PI * 0.58, Math.PI * 1.42);
    ctx.stroke();

    ctx.strokeStyle = "#3e2723";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(150, -450);
    ctx.quadraticCurveTo(300, -370, 420, -320);
    ctx.stroke();
    const flagColors = ["#ef4444", "#facc15", "#3b82f6", "#22c55e", "#a855f7"];
    for (let i = 0; i < 8; i++) {
      let t = i / 8;
      let fx = 150 + t * 270;
      let fy = -450 + t * 130 + Math.sin(t * Math.PI) * 20;
      ctx.fillStyle = flagColors[i % flagColors.length];
      ctx.beginPath();
      ctx.moveTo(fx - 8, fy);
      ctx.lineTo(fx + 8, fy);
      ctx.lineTo(fx, fy + 22);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  static drawRuinsGround(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(0, 0, 50, 0, 0, 750);
    grad.addColorStop(0, "rgba(215, 184, 137, 0.75)");
    grad.addColorStop(1, "rgba(215, 184, 137, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 0, 850, 600, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawCaveEntranceGround(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(0, 0, 100, 0, 0, 850);
    grad.addColorStop(0, "#5d4037");
    grad.addColorStop(0.6, "#795548");
    grad.addColorStop(1, "rgba(121, 85, 72, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 100, 900, 650, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawChiefCampGround(ctx, cx, cy) {
    ctx.save();
    ctx.translate(cx, cy);
    const grad = ctx.createRadialGradient(0, 0, 100, 0, 0, 850);
    grad.addColorStop(0, "#a1887f");
    grad.addColorStop(0.7, "#8d6e63");
    grad.addColorStop(1, "rgba(141, 110, 99, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(0, 100, 850, 650, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  static drawGrassAndFlowers(ctx, w, h) {
    ctx.save();
    const flowerColors = ["#f43f5e", "#facc15", "#e879f9", "#ffffff", "#60a5fa"];
    for (let i = 0; i < 1600; i++) {
      let gx = (Math.abs(Math.sin(i * 45.123) * 98765.432) % 1) * (w - 200) + 100;
      let gy = (Math.abs(Math.cos(i * 91.456) * 54321.987) % 1) * (h - 200) + 100;
      if (Math.abs(gy - 11600) < 250 || Math.abs(gy - (4300 + (gx / w) * 1100)) < 260) continue;

      ctx.strokeStyle = i % 3 === 0 ? "#33691e" : "#558b2f";
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx - 6, gy - 12);
      ctx.moveTo(gx, gy);
      ctx.lineTo(gx + 5, gy - 14);
      ctx.stroke();

      if (i % 5 === 0) {
        ctx.fillStyle = flowerColors[i % flowerColors.length];
        ctx.beginPath();
        ctx.arc(gx + 5, gy - 16, 4.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  // ==========================================================================
  // 2. R02 실버바인 (Silvervine) 4000x16000 필드 렌더러 (SilverVine.jpg 일관성 100%)
  // ==========================================================================
  static drawSilvervineField(ctx, w, h) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#1c1226");    // 북단: 타락한 세계수 심연 숲
    bgGrad.addColorStop(0.24, "#1e3a2f"); // 중북부: 깊은 그림자 숲
    bgGrad.addColorStop(0.55, "#2d6a4f"); // 중부: 은빛 덩굴숲 & 벌목장
    bgGrad.addColorStop(0.82, "#40916c"); // 남부: 요정의 숲 초입
    bgGrad.addColorStop(1, "#2d6a4f");    // 최남단: 페어리 캠프 주변
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 신비로운 이끼 패치와 은빛 안개 바닥 질감
    for (let i = 0; i < 450; i++) {
      let px = (Math.abs(Math.sin(i * 17.31) * 54321.1) % 1) * w;
      let py = (Math.abs(Math.cos(i * 63.89) * 19283.7) % 1) * h;
      let rx = 130 + (i % 5) * 65;
      let ry = 85 + (i % 4) * 45;
      if (py < 4000) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(126, 34, 206, 0.14)" : "rgba(153, 27, 27, 0.10)";
      } else if (px < 2100 && py > 5800 && py < 11000) {
        ctx.fillStyle = i % 2 === 0 ? "rgba(45, 212, 191, 0.16)" : "rgba(167, 243, 208, 0.12)";
      } else {
        ctx.fillStyle = i % 2 === 0 ? "rgba(116, 198, 157, 0.16)" : "rgba(27, 67, 50, 0.18)";
      }
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 1) 은빛 덩굴숲 발광 시냇물 (북서쪽 -> 중서부 -> 남서쪽)
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const streamPts = [
      [850, 4800], [980, 6000], [1220, 7200], [1050, 8400],
      [1320, 9500], [1100, 10700], [580, 11800], [0, 12700]
    ];
    ctx.strokeStyle = "rgba(45, 212, 191, 0.28)";
    ctx.lineWidth = 280;
    ctx.beginPath();
    ctx.moveTo(streamPts[0][0], streamPts[0][1]);
    for (let i = 1; i < streamPts.length; i++) ctx.lineTo(streamPts[i][0], streamPts[i][1]);
    ctx.stroke();

    ctx.strokeStyle = "#0d9488";
    ctx.lineWidth = 175;
    ctx.stroke();

    ctx.strokeStyle = "#5eead4";
    ctx.lineWidth = 90;
    ctx.stroke();

    // 동쪽 벌목장 물레방아 수로 (중동부)
    const millStreamPts = [[2750, 6200], [3180, 7150], [2950, 8050], [3600, 8650], [4000, 9000]];
    ctx.strokeStyle = "#0284c7";
    ctx.lineWidth = 130;
    ctx.beginPath();
    ctx.moveTo(millStreamPts[0][0], millStreamPts[0][1]);
    for (let i = 1; i < millStreamPts.length; i++) ctx.lineTo(millStreamPts[i][0], millStreamPts[i][1]);
    ctx.stroke();
    ctx.strokeStyle = "#7dd3fc";
    ctx.lineWidth = 65;
    ctx.stroke();
    ctx.restore();

    // 2) 실버바인 오솔길 (SilverVine.jpg의 점선 동선과 완벽 일치)
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const drawForestPath = (pts, width) => {
      ctx.strokeStyle = "rgba(62, 39, 35, 0.5)";
      ctx.lineWidth = width + 24;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = "#b59b72";
      ctx.lineWidth = width;
      ctx.stroke();
    };
    // 페어리 캠프(2020,13400) -> 버려진 벌목장(3000,9200) -> 은빛 덩굴숲(950,9080) -> 타락한 세계수(2050,4920)
    drawForestPath([[2020, 13400], [2650, 11800], [3000, 9200]], 115);
    drawForestPath([[3000, 9200], [2000, 9450], [950, 9080]], 115);
    drawForestPath([[2020, 13400], [1350, 11500], [950, 9080]], 105);
    drawForestPath([[950, 9080], [1650, 7200], [2650, 6000], [2050, 4920]], 120);
    drawForestPath([[3000, 9200], [2750, 6800], [2050, 4920]], 110);
    ctx.restore();

    // 통나무 다리 배치
    this.drawWoodBridge(ctx, 1210, 9650, 210, 300);
    this.drawWoodBridge(ctx, 1120, 6650, 210, 300);

    // 3) 4대 거점 바닥 지형 하이라이트 (SilverVine.tmj 좌표 정밀 일치)
    // [A] 페어리 캠프(S1) (2020, 13400)
    ctx.save();
    ctx.translate(2020, 13400);
    const campGrad = ctx.createRadialGradient(0, 0, 120, 0, 0, 840);
    campGrad.addColorStop(0, "#95d5b2");
    campGrad.addColorStop(0.65, "#52b788");
    campGrad.addColorStop(1, "rgba(82, 183, 136, 0)");
    ctx.fillStyle = campGrad;
    ctx.beginPath(); ctx.arc(0, 0, 840, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "rgba(167, 243, 208, 0.55)";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, 380, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();

    // [B] 은빛 덩굴숲 (950, 9080)
    ctx.save();
    ctx.translate(950, 9080);
    const vineGrad = ctx.createRadialGradient(0, 0, 80, 0, 0, 900);
    vineGrad.addColorStop(0, "rgba(94, 234, 212, 0.42)");
    vineGrad.addColorStop(0.6, "rgba(20, 184, 166, 0.2)");
    vineGrad.addColorStop(1, "rgba(20, 184, 166, 0)");
    ctx.fillStyle = vineGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 900, 750, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // [C] 버려진 벌목장 (3000, 8850)
    ctx.save();
    ctx.translate(3000, 8850);
    const millGrad = ctx.createRadialGradient(0, 0, 100, 0, 0, 780);
    millGrad.addColorStop(0, "#9c8265");
    millGrad.addColorStop(0.7, "#78624c");
    millGrad.addColorStop(1, "rgba(120, 98, 76, 0)");
    ctx.fillStyle = millGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 820, 640, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // [D] 타락한 세계수 (2050, 4250)
    ctx.save();
    ctx.translate(2050, 4250);
    const treeGrad = ctx.createRadialGradient(0, 0, 150, 0, 0, 1100);
    treeGrad.addColorStop(0, "#3b0764");
    treeGrad.addColorStop(0.55, "#2e1065");
    treeGrad.addColorStop(1, "rgba(46, 16, 101, 0)");
    ctx.fillStyle = treeGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 1150, 850, 0, 0, Math.PI * 2); ctx.fill();
    // 붉은/보라 타락 균열
    ctx.strokeStyle = "#ec4899";
    ctx.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      let a = (Math.PI * 2 / 8) * i;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 140, Math.sin(a) * 90 - 200);
      ctx.lineTo(Math.cos(a + 0.15) * 450, Math.sin(a + 0.15) * 320 - 150);
      ctx.stroke();
    }
    ctx.restore();

    // 4) 반딧불이 & 발광 포자 디테일
    ctx.save();
    for (let i = 0; i < 950; i++) {
      let gx = (Math.abs(Math.sin(i * 31.7) * 87654.3) % 1) * (w - 200) + 100;
      let gy = (Math.abs(Math.cos(i * 83.1) * 43219.8) % 1) * (h - 200) + 100;
      ctx.fillStyle = gy < 4000 ? "#e879f9" : (i % 3 === 0 ? "#5eead4" : "#bef264");
      ctx.beginPath();
      ctx.arc(gx, gy, 3.5 + (i % 3), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ==========================================================================
  // 3. R05 모라안 (Moraan) 4000x16000 필드 렌더러 (Moraan.jpg & Moraan.tmj 일관성 100%)
  // ==========================================================================
  static drawMoraanField(ctx, w, h) {
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, "#c88a4b");    // 북부: 암석 사막 & 고대 파라오 무덤
    bgGrad.addColorStop(0.38, "#e0a458"); // 중북부: 사막 고원
    bgGrad.addColorStop(0.68, "#f3be70"); // 중남부: 작열하는 모래언덕
    bgGrad.addColorStop(1, "#e6ad5c");    // 남부: 오아시스 야영지 주변
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 모래언덕 물결 곡선 (Dune Ridges)
    ctx.save();
    for (let i = 0; i < 65; i++) {
      let dy = 600 + i * 240;
      ctx.fillStyle = i % 2 === 0 ? "rgba(180, 83, 9, 0.12)" : "rgba(254, 243, 199, 0.16)";
      ctx.beginPath();
      ctx.moveTo(0, dy);
      ctx.bezierCurveTo(w * 0.3, dy - 160, w * 0.7, dy + 160, w, dy - 40);
      ctx.lineTo(w, dy + 180);
      ctx.lineTo(0, dy + 180);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 사막 캐러밴 이동 경로 (Moraan.jpg 점선 루트와 일치)
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    const drawSandTrail = (pts, width) => {
      ctx.strokeStyle = "rgba(146, 64, 14, 0.35)";
      ctx.lineWidth = width + 22;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = "#fde68a";
      ctx.lineWidth = width;
      ctx.stroke();
    };
    // 오아시스 캠프(2350,13650) -> 작열하는 모래언덕(1150,9200) -> 고대 파라오 무덤(2950,5650) -> 개미지옥 둥지(1050,4150)
    drawSandTrail([[2350, 13650], [1450, 12400], [1050, 10800], [1150, 9200]], 115);
    drawSandTrail([[2350, 13650], [2750, 11400], [2100, 9800], [1150, 9200]], 110);
    drawSandTrail([[1150, 9200], [2150, 7600], [2950, 5650]], 120);
    drawSandTrail([[2950, 5650], [2000, 5100], [1050, 4150]], 115);
    drawSandTrail([[1150, 9200], [1250, 6600], [1050, 4150]], 110);
    ctx.restore();

    // [1] 남동부: 오아시스 야영지(S1) (캠프 중심: 2350, 13650 / 호수 중심: 2350, 12650)
    ctx.save();
    const oasisGrassGrad = ctx.createRadialGradient(2350, 13200, 200, 2350, 13200, 1150);
    oasisGrassGrad.addColorStop(0, "#4ade80");
    oasisGrassGrad.addColorStop(0.55, "#22c55e");
    oasisGrassGrad.addColorStop(0.82, "#84cc16");
    oasisGrassGrad.addColorStop(1, "rgba(132, 204, 22, 0)");
    ctx.fillStyle = oasisGrassGrad;
    ctx.beginPath();
    ctx.ellipse(2350, 13200, 1150, 980, 0, 0, Math.PI * 2);
    ctx.fill();

    // 남부 야영지 모래 광장 (NPC 및 플레이어 스폰 지점: 2350, 13650)
    const campSandGrad = ctx.createRadialGradient(2350, 13650, 80, 2350, 13650, 520);
    campSandGrad.addColorStop(0, "#fef3c7");
    campSandGrad.addColorStop(0.75, "#fde68a");
    campSandGrad.addColorStop(1, "rgba(253, 230, 138, 0)");
    ctx.fillStyle = campSandGrad;
    ctx.beginPath();
    ctx.ellipse(2350, 13650, 540, 420, 0, 0, Math.PI * 2);
    ctx.fill();

    // 에메랄드빛 오아시스 호수 (2350, 12550)
    const waterGrad = ctx.createRadialGradient(2350, 12550, 50, 2350, 12550, 520);
    waterGrad.addColorStop(0, "#67e8f9");
    waterGrad.addColorStop(0.65, "#06b6d4");
    waterGrad.addColorStop(0.92, "#0284c7");
    waterGrad.addColorStop(1, "#d97706");
    ctx.fillStyle = waterGrad;
    ctx.beginPath();
    ctx.ellipse(2350, 12550, 520, 310, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#bae6fd";
    ctx.lineWidth = 8;
    ctx.stroke();
    ctx.restore();

    // [2] 중서부: 작열하는 모래언덕 (1150, 9200)
    ctx.save();
    ctx.translate(1150, 9200);
    const duneGrad = ctx.createRadialGradient(0, 0, 100, 0, 0, 880);
    duneGrad.addColorStop(0, "rgba(234, 88, 12, 0.28)");
    duneGrad.addColorStop(0.65, "rgba(217, 119, 6, 0.15)");
    duneGrad.addColorStop(1, "rgba(217, 119, 6, 0)");
    ctx.fillStyle = duneGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 920, 680, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // [3] 북동부: 고대 파라오 무덤 석조 성역 바닥 (2950, 5250)
    ctx.save();
    ctx.translate(2950, 5250);
    ctx.fillStyle = "#d6b37c";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 8;
    ctx.fillRect(-620, -450, 1240, 1100);
    ctx.strokeRect(-620, -450, 1240, 1100);
    // 사암 타일 격자 무늬
    ctx.strokeStyle = "rgba(120, 53, 15, 0.28)";
    ctx.lineWidth = 3;
    for (let x = -560; x <= 560; x += 140) {
      ctx.beginPath(); ctx.moveTo(x, -450); ctx.lineTo(x, 650); ctx.stroke();
    }
    for (let y = -400; y <= 600; y += 120) {
      ctx.beginPath(); ctx.moveTo(-620, y); ctx.lineTo(620, y); ctx.stroke();
    }
    ctx.restore();

    // [4] 북서부: 개미지옥 둥지 황무지 바닥 (1050, 3600)
    ctx.save();
    ctx.translate(1050, 3600);
    const antGrad = ctx.createRadialGradient(0, 0, 120, 0, 0, 880);
    antGrad.addColorStop(0, "#78350f");
    antGrad.addColorStop(0.6, "#92400e");
    antGrad.addColorStop(1, "rgba(146, 64, 14, 0)");
    ctx.fillStyle = antGrad;
    ctx.beginPath(); ctx.ellipse(0, 0, 900, 720, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // ==========================================================================
  // 4. R07 발레노스 (Balenos) 4000x16000 필드 렌더러 (Balenos.jpg 일관성 100%)
  // ==========================================================================
  static drawBalenosField(ctx, w, h) {
    // 1) 전체 심해 및 연안 바다 배경
    const seaGrad = ctx.createLinearGradient(0, 0, w, h);
    seaGrad.addColorStop(0, "#0b2e42");
    seaGrad.addColorStop(0.45, "#124e6b");
    seaGrad.addColorStop(0.8, "#16698a");
    seaGrad.addColorStop(1, "#0e3f57");
    ctx.fillStyle = seaGrad;
    ctx.fillRect(0, 0, w, h);

    // 바다 물결 무늬
    ctx.save();
    ctx.strokeStyle = "rgba(186, 230, 253, 0.14)";
    ctx.lineWidth = 4;
    for (let i = 0; i < 240; i++) {
      let wx = (Math.abs(Math.sin(i * 23.1) * 41234.5) % 1) * w;
      let wy = (Math.abs(Math.cos(i * 57.3) * 71234.5) % 1) * h;
      ctx.beginPath();
      ctx.moveTo(wx - 45, wy);
      ctx.quadraticCurveTo(wx, wy - 12, wx + 45, wy);
      ctx.stroke();
    }
    ctx.restore();

    // 2) 북부 해적선장의 오두막 해안 절벽 대지 (X: 1200~4000, Y: 800~5200)
    ctx.save();
    ctx.fillStyle = "#e0f2fe"; // 파도 포말 외곽선
    ctx.beginPath();
    ctx.moveTo(1250, 2800);
    ctx.quadraticCurveTo(1500, 1200, 2700, 900);
    ctx.lineTo(4000, 900);
    ctx.lineTo(4000, 5600);
    ctx.quadraticCurveTo(3100, 5300, 2100, 4800);
    ctx.quadraticCurveTo(1350, 4200, 1250, 2800);
    ctx.closePath();
    ctx.fill();

    const cliffGrad = ctx.createLinearGradient(1300, 1000, 3800, 5200);
    cliffGrad.addColorStop(0, "#78716c");
    cliffGrad.addColorStop(0.5, "#57534e");
    cliffGrad.addColorStop(1, "#44403c");
    ctx.fillStyle = cliffGrad;
    ctx.strokeStyle = "#292524";
    ctx.lineWidth = 18;
    ctx.fill();
    ctx.stroke();

    // 해적 요새 잔디/흙 마당
    ctx.fillStyle = "#657548";
    ctx.beginPath();
    ctx.ellipse(2650, 3550, 980, 1100, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 3) 중앙 난파선 무덤 모래톱 & 암초 여울 (X: 1100~3500, Y: 6200~9100)
    ctx.save();
    const shoalGrad = ctx.createRadialGradient(2000, 7700, 150, 2000, 7700, 1150);
    shoalGrad.addColorStop(0, "#cbd5e1");
    shoalGrad.addColorStop(0.5, "#64748b");
    shoalGrad.addColorStop(0.82, "#0ea5e9");
    shoalGrad.addColorStop(1, "rgba(14, 165, 233, 0)");
    ctx.fillStyle = shoalGrad;
    ctx.beginPath();
    ctx.ellipse(2050, 7700, 1180, 950, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 4) 남동부 검은 모래 해변 & 화산 절벽 (X: 2300~4000, Y: 8800~14800)
    ctx.save();
    // 하얀 파도 거품선
    ctx.fillStyle = "rgba(240, 249, 255, 0.85)";
    ctx.beginPath();
    ctx.moveTo(2750, 5200);
    ctx.quadraticCurveTo(2550, 7500, 2320, 10200);
    ctx.quadraticCurveTo(2220, 12400, 2650, 14600);
    ctx.lineTo(4000, 14600);
    ctx.lineTo(4000, 5200);
    ctx.closePath();
    ctx.fill();

    // 검은 모래 해변 본체 (Black Sand Beach)
    const blackSandGrad = ctx.createLinearGradient(2350, 9000, 4000, 14000);
    blackSandGrad.addColorStop(0, "#3f3f46");
    blackSandGrad.addColorStop(0.5, "#27272a");
    blackSandGrad.addColorStop(1, "#18181b");
    ctx.fillStyle = blackSandGrad;
    ctx.beginPath();
    ctx.moveTo(2820, 5200);
    ctx.quadraticCurveTo(2620, 7500, 2400, 10200);
    ctx.quadraticCurveTo(2300, 12400, 2720, 14550);
    ctx.lineTo(4000, 14550);
    ctx.lineTo(4000, 5200);
    ctx.closePath();
    ctx.fill();

    // 동쪽 끝 용암 균열 화산 절벽 (Balenos.jpg 우측 중단 디테일)
    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.moveTo(3520, 8800);
    ctx.lineTo(4000, 8500);
    ctx.lineTo(4000, 12200);
    ctx.lineTo(3580, 11800);
    ctx.lineTo(3420, 10400);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(3850, 9200); ctx.lineTo(3620, 9850); ctx.lineTo(3750, 10600);
    ctx.moveTo(3920, 10400); ctx.lineTo(3680, 11200);
    ctx.stroke();
    ctx.restore();

    // 5) 남서부 포트 발레노스 석조 항구 도시 (X: 0~2050, Y: 9800~14800, 중심: 1200, 11800)
    ctx.save();
    // 항구 석조 방파제 및 바닥
    ctx.fillStyle = "#78716c";
    ctx.strokeStyle = "#292524";
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, 9900);
    ctx.lineTo(1450, 9900);
    ctx.lineTo(2050, 11100);
    ctx.lineTo(2050, 12650);
    ctx.lineTo(1550, 13400);
    ctx.lineTo(1550, 14650);
    ctx.lineTo(0, 14650);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 항구 밝은 석조 보도블록 광장
    ctx.fillStyle = "#d6cfc2";
    ctx.beginPath();
    ctx.moveTo(80, 10100);
    ctx.lineTo(1380, 10100);
    ctx.lineTo(1920, 11200);
    ctx.lineTo(1920, 12550);
    ctx.lineTo(1420, 13300);
    ctx.lineTo(1420, 14450);
    ctx.lineTo(80, 14450);
    ctx.closePath();
    ctx.fill();

    // 석조 타일 격자선
    ctx.strokeStyle = "rgba(87, 83, 78, 0.25)";
    ctx.lineWidth = 3;
    for (let x = 200; x <= 1850; x += 150) {
      ctx.beginPath(); ctx.moveTo(x, 10150); ctx.lineTo(x, 14400); ctx.stroke();
    }
    for (let y = 10200; y <= 14300; y += 150) {
      ctx.beginPath(); ctx.moveTo(100, y); ctx.lineTo(1900, y); ctx.stroke();
    }

    // 나무 선착장 부두 (Piers)
    this.drawWoodBridge(ctx, 1850, 10650, 320, 160);
    this.drawWoodBridge(ctx, 1780, 13050, 340, 170);
    this.drawWoodBridge(ctx, 1550, 14050, 340, 170);
    ctx.restore();

    // 6) 구역 간 연결 다리 및 해안 도로 (Balenos.jpg 점선 루트 완벽 구현)
    // [다리 1] 포트 발레노스(1200,11800) <-> 검은 모래 해변(3050,11800) 연결 대형 해상 교량
    this.drawWoodBridge(ctx, 2200, 11850, 560, 260);
    // [다리 2] 포트 발레노스(1200,11800) <-> 난파선 무덤(2000,7950) 연결 암초 나무다리
    ctx.save();
    ctx.strokeStyle = "#8d6e63";
    ctx.lineWidth = 135;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(1450, 10150);
    ctx.lineTo(1850, 8450);
    ctx.stroke();
    ctx.strokeStyle = "#5d4037";
    ctx.lineWidth = 110;
    ctx.stroke();
    ctx.restore();

    // [도로 3] 검은 모래 해변(3050,11800) -> 난파선 무덤(2000,7950) -> 해적선장의 오두막(2650,4150) 해안 길
    ctx.save();
    ctx.strokeStyle = "rgba(214, 211, 209, 0.45)";
    ctx.lineWidth = 115;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(3050, 11800);
    ctx.lineTo(3100, 8600);
    ctx.lineTo(2950, 6200);
    ctx.lineTo(2650, 4150);
    ctx.moveTo(3050, 8200);
    ctx.lineTo(2000, 7950);
    ctx.stroke();
    ctx.restore();
  }

  // ==========================================================================
  // 🏛️ 각 지역 랜드마크 & 건물 상세 드로잉 함수들
  // ==========================================================================

  // --- [R01 알트리아 오브젝트] ---
  static drawVillageHouse(ctx, x, y, w, h, roofType = "straw") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(8, h * 0.25, w * 0.58, h * 0.35, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#f5ebd6";
    ctx.fillRect(-w * 0.42, -h * 0.1, w * 0.84, h * 0.52);
    ctx.strokeStyle = "#4e342e";
    ctx.lineWidth = 6;
    ctx.strokeRect(-w * 0.42, -h * 0.1, w * 0.84, h * 0.52);

    ctx.fillStyle = "#5d4037";
    ctx.fillRect(-w * 0.42, -h * 0.1, 12, h * 0.52);
    ctx.fillRect(w * 0.42 - 12, -h * 0.1, 12, h * 0.52);
    ctx.fillRect(-w * 0.42, h * 0.15, w * 0.84, 8);

    ctx.fillStyle = "#4e342e";
    ctx.beginPath();
    ctx.roundRect(-22, h * 0.08, 44, h * 0.34, [18, 18, 0, 0]);
    ctx.fill();
    ctx.fillStyle = "#fde047";
    ctx.fillRect(-w * 0.28, 0, 26, 26);
    ctx.strokeRect(-w * 0.28, 0, 26, 26);
    ctx.fillRect(w * 0.28 - 26, 0, 26, 26);
    ctx.strokeRect(w * 0.28 - 26, 0, 26, 26);

    const roofGrad = ctx.createLinearGradient(0, -h * 0.65, 0, -h * 0.02);
    if (roofType === "straw") {
      roofGrad.addColorStop(0, "#facc15");
      roofGrad.addColorStop(1, "#ca8a04");
    } else {
      roofGrad.addColorStop(0, "#d97706");
      roofGrad.addColorStop(1, "#92400e");
    }
    ctx.fillStyle = roofGrad;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.65);
    ctx.lineTo(-w * 0.55, -h * 0.02);
    ctx.lineTo(w * 0.55, -h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 6;
    ctx.stroke();
    ctx.restore();
  }

  static drawWindmill(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.35, w * 0.55, h * 0.2, 0, 0, Math.PI * 2);
    ctx.fill();

    const towerGrad = ctx.createLinearGradient(-w * 0.35, 0, w * 0.35, 0);
    towerGrad.addColorStop(0, "#f5ebd6");
    towerGrad.addColorStop(1, "#c7b299");
    ctx.fillStyle = towerGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -h * 0.35);
    ctx.lineTo(w * 0.28, -h * 0.35);
    ctx.lineTo(w * 0.4, h * 0.35);
    ctx.lineTo(-w * 0.4, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4e342e";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = "#b45309";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.65);
    ctx.lineTo(-w * 0.36, -h * 0.32);
    ctx.lineTo(w * 0.36, -h * 0.32);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#451a03";
    ctx.beginPath();
    ctx.roundRect(-22, h * 0.05, 44, h * 0.3, [20, 20, 0, 0]);
    ctx.fill();

    ctx.save();
    ctx.translate(0, -h * 0.32);
    ctx.rotate(Math.PI / 4);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(-5, 0, 10, w * 0.85);
      ctx.fillStyle = "#fef3c7";
      ctx.strokeStyle = "#78350f";
      ctx.lineWidth = 3;
      ctx.fillRect(5, 25, 36, w * 0.68);
      ctx.strokeRect(5, 25, 36, w * 0.68);
    }
    ctx.fillStyle = "#3e2723";
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.restore();
  }

  static drawAncientPillar(ctx, x, y, size, broken = false) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(10, 20, size * 0.55, size * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    const h = broken ? size * 1.1 : size * 1.9;
    const w = size * 0.65;
    const grad = ctx.createLinearGradient(-w / 2, 0, w / 2, 0);
    grad.addColorStop(0, "#e5e7eb");
    grad.addColorStop(0.5, "#d1d5db");
    grad.addColorStop(1, "#9ca3af");

    ctx.fillStyle = "#9ca3af";
    ctx.fillRect(-w * 0.65, 0, w * 1.3, 24);
    ctx.strokeStyle = "#4b5563";
    ctx.lineWidth = 3;
    ctx.strokeRect(-w * 0.65, 0, w * 1.3, 24);

    ctx.fillStyle = grad;
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.strokeRect(-w / 2, -h, w, h);

    if (!broken) {
      ctx.fillStyle = "#d1d5db";
      ctx.fillRect(-w * 0.65, -h - 18, w * 1.3, 18);
      ctx.strokeRect(-w * 0.65, -h - 18, w * 1.3, 18);
    }
    ctx.restore();
  }

  static drawGoblinCaveEntrance(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.35, w * 0.55, h * 0.25, 0, 0, Math.PI * 2);
    ctx.fill();

    const rockGrad = ctx.createLinearGradient(0, -h * 0.55, 0, h * 0.4);
    rockGrad.addColorStop(0, "#78716c");
    rockGrad.addColorStop(0.6, "#57534e");
    rockGrad.addColorStop(1, "#292524");
    ctx.fillStyle = rockGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.52, h * 0.35);
    ctx.lineTo(-w * 0.46, -h * 0.15);
    ctx.lineTo(-w * 0.25, -h * 0.48);
    ctx.lineTo(0, -h * 0.58);
    ctx.lineTo(w * 0.28, -h * 0.45);
    ctx.lineTo(w * 0.48, -h * 0.1);
    ctx.lineTo(w * 0.52, h * 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 8;
    ctx.stroke();

    ctx.fillStyle = "#050508";
    ctx.beginPath();
    ctx.arc(0, h * 0.18, w * 0.24, Math.PI, 0);
    ctx.lineTo(w * 0.24, h * 0.35);
    ctx.lineTo(-w * 0.24, h * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(-130, -h * 0.42, 260, 42);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2;
    ctx.strokeRect(-130, -h * 0.42, 260, 42);
    ctx.fillStyle = "#fde047";
    ctx.font = "bold 22px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("💀 고블린 동굴 (Lv.13~17)", 0, -h * 0.42 + 29);
    ctx.restore();
  }

  static drawChiefTent(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath();
    ctx.ellipse(0, h * 0.35, w * 0.55, h * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    const tentGrad = ctx.createLinearGradient(0, -h * 0.55, 0, h * 0.35);
    tentGrad.addColorStop(0, "#b91c1c");
    tentGrad.addColorStop(0.5, "#991b1b");
    tentGrad.addColorStop(1, "#7f1d1d");
    ctx.fillStyle = tentGrad;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.6);
    ctx.lineTo(-w * 0.48, h * 0.05);
    ctx.lineTo(-w * 0.42, h * 0.35);
    ctx.lineTo(w * 0.42, h * 0.35);
    ctx.lineTo(w * 0.48, h * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#450a0a";
    ctx.lineWidth = 6;
    ctx.stroke();

    ctx.fillStyle = "#1c1917";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.05);
    ctx.lineTo(-w * 0.16, h * 0.35);
    ctx.lineTo(w * 0.16, h * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(0,0,0,0.75)";
    ctx.fillRect(-140, -h * 0.5, 280, 42);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2;
    ctx.strokeRect(-140, -h * 0.5, 280, 42);
    ctx.fillStyle = "#fca5a5";
    ctx.font = "bold 22px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑 족장의 막사 [보스(B)]", 0, -h * 0.5 + 29);
    ctx.restore();
  }

  // --- [R02 실버바인 전용 오브젝트] ---
  static drawFairyMushroomHouse(ctx, x, y, w, h, roofStyle = "pink") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.34, w * 0.52, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    // 둥근 버섯 줄기 몸통
    ctx.fillStyle = "#fef3c7";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.roundRect(-w * 0.34, -h * 0.08, w * 0.68, h * 0.44, [28, 28, 16, 16]);
    ctx.fill();
    ctx.stroke();

    // 아치형 나무 문 & 발광 둥근 창문
    ctx.fillStyle = "#5d4037";
    ctx.beginPath();
    ctx.roundRect(-22, h * 0.08, 44, h * 0.28, [22, 22, 0, 0]);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#fde047";
    ctx.beginPath(); ctx.arc(-w * 0.2, h * 0.08, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.2, h * 0.08, 14, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // 버섯 갓 / 잎사귀 지붕
    const capGrad = ctx.createRadialGradient(0, -h * 0.35, 10, 0, -h * 0.2, w * 0.6);
    if (roofStyle === "leaf") {
      capGrad.addColorStop(0, "#fbbf24");
      capGrad.addColorStop(0.7, "#ea580c");
      capGrad.addColorStop(1, "#15803d");
    } else {
      capGrad.addColorStop(0, "#f472b6");
      capGrad.addColorStop(0.7, "#db2777");
      capGrad.addColorStop(1, "#831843");
    }
    ctx.fillStyle = capGrad;
    ctx.beginPath();
    ctx.moveTo(-w * 0.56, -h * 0.02);
    ctx.quadraticCurveTo(0, -h * 0.85, w * 0.56, -h * 0.02);
    ctx.quadraticCurveTo(0, -h * 0.12, -w * 0.56, -h * 0.02);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#4c0519";
    ctx.lineWidth = 5;
    ctx.stroke();

    // 버섯 물방울 무늬
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    [[-0.25, -0.22, 14], [0, -0.35, 17], [0.24, -0.2, 13], [-0.1, -0.16, 10], [0.14, -0.14, 11]].forEach(([px, py, pr]) => {
      ctx.beginPath(); ctx.arc(w * px, h * py, pr, 0, Math.PI * 2); ctx.fill();
    });
    ctx.restore();
  }

  static drawFairyTent(ctx, x, y, w, h, colorTheme = "purple") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.35, w * 0.52, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    const tentGrad = ctx.createLinearGradient(0, -h * 0.55, 0, h * 0.35);
    if (colorTheme === "blue") {
      tentGrad.addColorStop(0, "#38bdf8");
      tentGrad.addColorStop(1, "#1e3a8a");
    } else {
      tentGrad.addColorStop(0, "#c084fc");
      tentGrad.addColorStop(1, "#581c87");
    }
    ctx.fillStyle = tentGrad;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.58);
    ctx.quadraticCurveTo(-w * 0.25, -h * 0.1, -w * 0.48, h * 0.35);
    ctx.lineTo(w * 0.48, h * 0.35);
    ctx.quadraticCurveTo(w * 0.25, -h * 0.1, 0, -h * 0.58);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#fde047";
    ctx.lineWidth = 4;
    ctx.stroke();

    // 텐트 입구와 요정 등불
    ctx.fillStyle = "#1e1b4b";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.05);
    ctx.lineTo(-w * 0.18, h * 0.35);
    ctx.lineTo(w * 0.18, h * 0.35);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "#fef08a";
    for (let i = -3; i <= 3; i++) {
      ctx.beginPath();
      ctx.arc(i * (w * 0.12), h * 0.02 + Math.abs(i) * 8, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  static drawFairyPond(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    const pondGrad = ctx.createRadialGradient(0, 0, 20, 0, 0, w * 0.5);
    pondGrad.addColorStop(0, "#a5f3fc");
    pondGrad.addColorStop(0.6, "#22d3ee");
    pondGrad.addColorStop(0.9, "#0284c7");
    pondGrad.addColorStop(1, "#15803d");
    ctx.fillStyle = pondGrad;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.5, h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#86efac";
    ctx.lineWidth = 8;
    ctx.stroke();

    // 수련 잎과 발광 연꽃
    ctx.fillStyle = "#22c55e";
    [[-70, -20, 22], [65, 25, 25], [-20, 45, 18]].forEach(([lx, ly, lr]) => {
      ctx.beginPath(); ctx.arc(lx, ly, lr, 0.2, Math.PI * 1.9); ctx.lineTo(lx, ly); ctx.closePath(); ctx.fill();
    });
    ctx.fillStyle = "#f472b6";
    ctx.beginPath(); ctx.arc(-65, -25, 9, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(68, 20, 10, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  static drawGiantMushroom(ctx, x, y, size, colorType = "blue") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, size * 0.28, size * 0.38, size * 0.18, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#fde68a";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 3;
    ctx.fillRect(-size * 0.14, -size * 0.25, size * 0.28, size * 0.52);
    ctx.strokeRect(-size * 0.14, -size * 0.25, size * 0.28, size * 0.52);

    ctx.fillStyle = colorType === "purple" ? "#a855f7" : (colorType === "pink" ? "#ec4899" : "#38bdf8");
    ctx.beginPath();
    ctx.arc(0, -size * 0.25, size * 0.45, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(-size * 0.16, -size * 0.42, size * 0.08, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(size * 0.15, -size * 0.38, size * 0.07, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  static drawSilverVineTree(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(45, 212, 191, 0.22)";
    ctx.beginPath(); ctx.ellipse(0, w * 0.35, w * 0.65, w * 0.32, 0, 0, Math.PI * 2); ctx.fill();

    // 은빛 줄기
    ctx.fillStyle = "#cbd5e1";
    ctx.strokeStyle = "#0f766e";
    ctx.lineWidth = 4;
    ctx.fillRect(-w * 0.12, -w * 0.2, w * 0.24, w * 0.55);
    ctx.strokeRect(-w * 0.12, -w * 0.2, w * 0.24, w * 0.55);

    // 거대 은빛-민트 잎사귀 (SilverVine.jpg 좌측 은빛덩굴 숲 식생)
    const leafCols = ["#99f6e4", "#5eead4", "#2dd4bf", "#ccfbf1"];
    const angles = [-0.9, -0.45, 0, 0.45, 0.9];
    angles.forEach((ang, idx) => {
      ctx.save();
      ctx.translate(0, -w * 0.2);
      ctx.rotate(ang);
      ctx.fillStyle = leafCols[idx % leafCols.length];
      ctx.strokeStyle = "#115e59";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-w * 0.28, -w * 0.45, 0, -w * 0.85);
      ctx.quadraticCurveTo(w * 0.28, -w * 0.45, 0, 0);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    ctx.restore();
  }

  static drawLumberMill(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.35, w * 0.58, h * 0.25, 0, 0, Math.PI * 2); ctx.fill();

    // 목재 본체
    ctx.fillStyle = "#5d4037";
    ctx.strokeStyle = "#271c19";
    ctx.lineWidth = 6;
    ctx.fillRect(-w * 0.42, -h * 0.12, w * 0.76, h * 0.46);
    ctx.strokeRect(-w * 0.42, -h * 0.12, w * 0.76, h * 0.46);

    // 우측 대형 물레방아 (Waterwheel)
    ctx.save();
    ctx.translate(w * 0.36, h * 0.12);
    ctx.fillStyle = "#4e342e";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(0, 0, h * 0.28, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#795548";
    ctx.beginPath(); ctx.arc(0, 0, h * 0.18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 8; i++) {
      let a = (Math.PI / 4) * i;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * h * 0.28, Math.sin(a) * h * 0.28);
      ctx.stroke();
    }
    ctx.restore();

    // 이끼 낀 낡은 박공지붕
    ctx.fillStyle = "#3e2723";
    ctx.beginPath();
    ctx.moveTo(-w * 0.04, -h * 0.62);
    ctx.lineTo(-w * 0.5, -h * 0.06);
    ctx.lineTo(w * 0.42, -h * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 지붕 위 초록 이끼 패치
    ctx.fillStyle = "#4d7c0f";
    ctx.beginPath();
    ctx.moveTo(-w * 0.04, -h * 0.62);
    ctx.lineTo(-w * 0.35, -h * 0.22);
    ctx.lineTo(w * 0.12, -h * 0.28);
    ctx.closePath();
    ctx.fill();

    // 안내 간판
    ctx.fillStyle = "rgba(0,0,0,0.78)";
    ctx.fillRect(-150, -h * 0.52, 300, 42);
    ctx.strokeStyle = "#a3e635";
    ctx.lineWidth = 2;
    ctx.strokeRect(-150, -h * 0.52, 300, 42);
    ctx.fillStyle = "#bef264";
    ctx.font = "bold 21px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🪵 버려진 벌목장 (Lv.28~33)", 0, -h * 0.52 + 29);
    ctx.restore();
  }

  static drawLogPile(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.3, w * 0.55, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    const rows = [[0, 12], [-22, 12], [22, 12], [-11, -8], [11, -8], [0, -28]];
    rows.forEach(([lx, ly]) => {
      ctx.fillStyle = "#6d4c41";
      ctx.strokeStyle = "#3e2723";
      ctx.lineWidth = 3;
      ctx.fillRect(lx - w * 0.32, ly - 12, w * 0.64, 24);
      ctx.strokeRect(lx - w * 0.32, ly - 12, w * 0.64, 24);
      ctx.fillStyle = "#d7ccc8";
      ctx.beginPath(); ctx.arc(lx + w * 0.32, ly, 12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    });
    ctx.restore();
  }

  static drawCorruptedWorldTree(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(88, 28, 135, 0.5)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.36, w * 0.58, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();

    // 거대 뒤틀린 뿌리와 줄기
    const trunkGrad = ctx.createLinearGradient(-w * 0.3, -h * 0.4, w * 0.3, h * 0.4);
    trunkGrad.addColorStop(0, "#3b0764");
    trunkGrad.addColorStop(0.5, "#1f122b");
    trunkGrad.addColorStop(1, "#09050d");
    ctx.fillStyle = trunkGrad;
    ctx.strokeStyle = "#111827";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-w * 0.45, h * 0.38);
    ctx.quadraticCurveTo(-w * 0.22, h * 0.1, -w * 0.25, -h * 0.25);
    ctx.lineTo(w * 0.25, -h * 0.25);
    ctx.quadraticCurveTo(w * 0.22, h * 0.1, w * 0.45, h * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 줄기 중앙 붉은 마안(타락의 핵)
    ctx.fillStyle = "#ef4444";
    ctx.shadowColor = "#f43f5e";
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.08);
    ctx.quadraticCurveTo(38, 15, 0, 48);
    ctx.quadraticCurveTo(-38, 15, 0, -h * 0.08);
    ctx.fill();
    ctx.shadowBlur = 0;

    // 어두운 보라빛 거대 수관
    const canopyPuffs = [
      [-0.32, -0.32, 0.28, "#2e1065"],
      [0.32, -0.32, 0.28, "#2e1065"],
      [-0.18, -0.48, 0.3, "#4c1d95"],
      [0.18, -0.48, 0.3, "#4c1d95"],
      [0, -0.38, 0.34, "#3b0764"]
    ];
    canopyPuffs.forEach(([px, py, pr, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.arc(w * px, h * py, w * pr, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#1e1b4b"; ctx.lineWidth = 4; ctx.stroke();
    });

    // 보스 네임플레이트
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(-165, -h * 0.55, 330, 44);
    ctx.strokeStyle = "#c084fc";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-165, -h * 0.55, 330, 44);
    ctx.fillStyle = "#e879f9";
    ctx.font = "bold 22px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑 타락한 세계수 [보스(B)]", 0, -h * 0.55 + 30);
    ctx.restore();
  }

  // --- [R05 모라안 전용 오브젝트] ---
  static drawPalmTree(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.32)";
    ctx.beginPath(); ctx.ellipse(10, size * 0.38, size * 0.42, size * 0.2, 0, 0, Math.PI * 2); ctx.fill();

    // 휘어진 야자수 기둥
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = size * 0.16;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, size * 0.35);
    ctx.quadraticCurveTo(size * 0.12, -size * 0.1, 0, -size * 0.55);
    ctx.stroke();

    // 야자수 잎사귀
    ctx.translate(0, -size * 0.55);
    for (let i = 0; i < 6; i++) {
      ctx.save();
      ctx.rotate((Math.PI * 2 / 6) * i);
      ctx.fillStyle = i % 2 === 0 ? "#16a34a" : "#15803d";
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(size * 0.35, -size * 0.18, size * 0.62, size * 0.1);
      ctx.quadraticCurveTo(size * 0.28, size * 0.05, 0, 0);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();
  }

  static drawCactus(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath(); ctx.ellipse(0, size * 0.35, size * 0.32, size * 0.15, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#15803d";
    ctx.strokeStyle = "#052e16";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-size * 0.12, -size * 0.45, size * 0.24, size * 0.8, 12);
    ctx.fill(); ctx.stroke();

    ctx.beginPath();
    ctx.roundRect(-size * 0.34, -size * 0.22, size * 0.24, size * 0.14, 8);
    ctx.roundRect(-size * 0.34, -size * 0.38, size * 0.14, size * 0.28, 8);
    ctx.roundRect(size * 0.1, -size * 0.15, size * 0.24, size * 0.14, 8);
    ctx.roundRect(size * 0.2, -size * 0.32, size * 0.14, size * 0.28, 8);
    ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  static drawCaravanWagon(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.32, w * 0.52, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#d6c5b3";
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(-w * 0.4, -h * 0.2, w * 0.8, h * 0.45, 14);
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = "#92400e";
    ctx.fillRect(-w * 0.4, h * 0.05, w * 0.8, 10);
    ctx.fillStyle = "#38bdf8";
    ctx.fillRect(-w * 0.25, -h * 0.1, 28, 20);
    ctx.fillRect(w * 0.05, -h * 0.1, 28, 20);

    // 바퀴
    ctx.fillStyle = "#292524";
    ctx.beginPath(); ctx.arc(-w * 0.22, h * 0.26, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.22, h * 0.26, 18, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  static drawSunkenRuins(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.14);
    ctx.fillStyle = "#d4a359";
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 5;
    ctx.fillRect(-w * 0.42, -h * 0.35, w * 0.22, h * 0.65);
    ctx.strokeRect(-w * 0.42, -h * 0.35, w * 0.22, h * 0.65);
    ctx.fillRect(w * 0.2, -h * 0.35, w * 0.22, h * 0.65);
    ctx.strokeRect(w * 0.2, -h * 0.35, w * 0.22, h * 0.65);
    ctx.fillRect(-w * 0.48, -h * 0.48, w * 0.96, h * 0.2);
    ctx.strokeRect(-w * 0.48, -h * 0.48, w * 0.96, h * 0.2);
    ctx.restore();
  }

  static drawAntHellCrater(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);

    // 외곽 암석 절벽 링
    ctx.fillStyle = "#57534e";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, 0, w * 0.5, h * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 개미지옥 소용돌이 모래 구덩이 (동심원 깔때기)
    const rings = [
      [0.42, "#b45309"],
      [0.33, "#92400e"],
      [0.24, "#78350f"],
      [0.15, "#451a03"],
      [0.08, "#090504"]
    ];
    rings.forEach(([sc, col]) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.ellipse(0, h * 0.05, w * sc, h * sc * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    });

    // 안내 배너
    ctx.fillStyle = "rgba(0,0,0,0.8)";
    ctx.fillRect(-155, -h * 0.48, 310, 42);
    ctx.strokeStyle = "#f59e0b";
    ctx.lineWidth = 2;
    ctx.strokeRect(-155, -h * 0.48, 310, 42);
    ctx.fillStyle = "#fde047";
    ctx.font = "bold 21px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("🐜 개미지옥 둥지 (Lv.73~78)", 0, -h * 0.48 + 29);
    ctx.restore();
  }

  static drawPharaohPyramid(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.38, w * 0.56, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();

    // 계단식 황금 피라미드 본체
    const pyrGrad = ctx.createLinearGradient(0, -h * 0.62, 0, h * 0.36);
    pyrGrad.addColorStop(0, "#fef08a");
    pyrGrad.addColorStop(0.3, "#eab308");
    pyrGrad.addColorStop(0.75, "#ca8a04");
    pyrGrad.addColorStop(1, "#854d0e");
    ctx.fillStyle = pyrGrad;
    ctx.strokeStyle = "#422006";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.62);
    ctx.lineTo(-w * 0.52, h * 0.36);
    ctx.lineTo(w * 0.52, h * 0.36);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 피라미드 층계 가로선
    ctx.strokeStyle = "rgba(66, 32, 6, 0.45)";
    ctx.lineWidth = 4;
    for (let i = 1; i <= 5; i++) {
      let ty = -h * 0.62 + (h * 0.98) * (i / 6);
      let halfW = (w * 0.52) * (i / 6);
      ctx.beginPath(); ctx.moveTo(-halfW, ty); ctx.lineTo(halfW, ty); ctx.stroke();
    }

    // 신전 입구 게이트
    ctx.fillStyle = "#b45309";
    ctx.strokeStyle = "#422006";
    ctx.lineWidth = 5;
    ctx.fillRect(-w * 0.16, h * 0.02, w * 0.32, h * 0.34);
    ctx.strokeRect(-w * 0.16, h * 0.02, w * 0.32, h * 0.34);
    ctx.fillStyle = "#090504";
    ctx.fillRect(-w * 0.09, h * 0.1, w * 0.18, h * 0.26);

    // 보스 네임플레이트
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(-175, -h * 0.52, 350, 44);
    ctx.strokeStyle = "#facc15";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-175, -h * 0.52, 350, 44);
    ctx.fillStyle = "#fef08a";
    ctx.font = "bold 22px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑 고대 파라오 무덤 [보스(B)]", 0, -h * 0.52 + 30);
    ctx.restore();
  }

  static drawObelisk(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath(); ctx.ellipse(8, 20, w * 0.55, w * 0.25, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#d97706";
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 4;
    ctx.fillRect(-w * 0.42, -16, w * 0.84, 32);
    ctx.strokeRect(-w * 0.42, -16, w * 0.84, 32);

    ctx.fillStyle = "#f59e0b";
    ctx.beginPath();
    ctx.moveTo(-w * 0.28, -16);
    ctx.lineTo(-w * 0.18, -h * 0.82);
    ctx.lineTo(0, -h);
    ctx.lineTo(w * 0.18, -h * 0.82);
    ctx.lineTo(w * 0.28, -16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 푸른 영혼 불꽃
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.arc(0, -h - 14, 12, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  // --- [R07 발레노스 전용 오브젝트] ---
  static drawHarborHouse(ctx, x, y, w, h, roofColor = "blue") {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(6, h * 0.28, w * 0.56, h * 0.28, 0, 0, Math.PI * 2); ctx.fill();

    ctx.fillStyle = "#e7e5e4";
    ctx.strokeStyle = "#292524";
    ctx.lineWidth = 5;
    ctx.fillRect(-w * 0.42, -h * 0.12, w * 0.84, h * 0.52);
    ctx.strokeRect(-w * 0.42, -h * 0.12, w * 0.84, h * 0.52);

    // 목재 기둥 프레임
    ctx.fillStyle = "#57534e";
    ctx.fillRect(-w * 0.42, -h * 0.12, 12, h * 0.52);
    ctx.fillRect(w * 0.42 - 12, -h * 0.12, 12, h * 0.52);
    ctx.fillRect(-w * 0.42, h * 0.12, w * 0.84, 8);

    // 항구 기와 지붕 (푸른색 / 붉은 벽돌색)
    ctx.fillStyle = roofColor === "red" ? "#991b1b" : "#1e3a8a";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.62);
    ctx.lineTo(-w * 0.52, -h * 0.06);
    ctx.lineTo(w * 0.52, -h * 0.06);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#451a03";
    ctx.fillRect(-22, h * 0.1, 44, h * 0.3);
    ctx.fillStyle = "#fde047";
    ctx.fillRect(-w * 0.26, -h * 0.02, 24, 24);
    ctx.fillRect(w * 0.26 - 24, -h * 0.02, 24, 24);
    ctx.restore();
  }

  static drawHarborShip(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.25, w * 0.54, h * 0.24, 0, 0, Math.PI * 2); ctx.fill();

    // 범선 선체
    ctx.fillStyle = "#78350f";
    ctx.strokeStyle = "#271c19";
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-w * 0.48, 0);
    ctx.lineTo(w * 0.48, 0);
    ctx.lineTo(w * 0.34, h * 0.28);
    ctx.lineTo(-w * 0.34, h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 돛대 및 하얀 돛
    ctx.fillStyle = "#451a03";
    ctx.fillRect(-6, -h * 0.68, 12, h * 0.68);
    ctx.fillStyle = "#f8fafc";
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-w * 0.32, -h * 0.58);
    ctx.quadraticCurveTo(0, -h * 0.65, w * 0.32, -h * 0.58);
    ctx.quadraticCurveTo(w * 0.38, -h * 0.32, w * 0.3, -h * 0.14);
    ctx.quadraticCurveTo(0, -h * 0.2, -w * 0.3, -h * 0.14);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  static drawCargoCrates(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "#b45309";
    ctx.strokeStyle = "#451a03";
    ctx.lineWidth = 3;
    ctx.fillRect(-w * 0.4, -h * 0.1, w * 0.42, h * 0.42);
    ctx.strokeRect(-w * 0.4, -h * 0.1, w * 0.42, h * 0.42);
    ctx.fillRect(2, -h * 0.05, w * 0.38, h * 0.38);
    ctx.strokeRect(2, -h * 0.05, w * 0.38, h * 0.38);
    ctx.fillRect(-w * 0.2, -h * 0.45, w * 0.4, h * 0.38);
    ctx.strokeRect(-w * 0.2, -h * 0.45, w * 0.4, h * 0.38);
    ctx.restore();
  }

  static drawAnchorWreck(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(0.35);
    ctx.strokeStyle = "#52525b";
    ctx.lineWidth = 10;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(0, -w * 0.35);
    ctx.lineTo(0, w * 0.35);
    ctx.moveTo(-w * 0.22, -w * 0.18);
    ctx.lineTo(w * 0.22, -w * 0.18);
    ctx.moveTo(-w * 0.32, w * 0.12);
    ctx.quadraticCurveTo(0, w * 0.45, w * 0.32, w * 0.12);
    ctx.stroke();
    ctx.restore();
  }

  static drawShipwreck(ctx, x, y, w, h, tiltDir = 1) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tiltDir * 0.18);

    // 파손된 유령선 선체
    ctx.fillStyle = "#3f3a34";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-w * 0.5, 0);
    ctx.lineTo(w * 0.48, -h * 0.05);
    ctx.lineTo(w * 0.35, h * 0.28);
    ctx.lineTo(-w * 0.38, h * 0.28);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 부러진 돛대와 초록 이끼/찢어진 유령 돛
    ctx.fillStyle = "#292524";
    ctx.fillRect(-8, -h * 0.65, 16, h * 0.65);
    ctx.fillStyle = "rgba(74, 222, 128, 0.42)";
    ctx.strokeStyle = "#166534";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-w * 0.3, -h * 0.55);
    ctx.lineTo(w * 0.28, -h * 0.48);
    ctx.lineTo(w * 0.15, -h * 0.15);
    ctx.lineTo(-w * 0.05, -h * 0.28);
    ctx.lineTo(-w * 0.25, -h * 0.12);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  static drawPirateCabin(ctx, x, y, w, h) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.48)";
    ctx.beginPath(); ctx.ellipse(0, h * 0.36, w * 0.58, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();

    // 통나무 방벽 (Palisade Fence)
    ctx.fillStyle = "#5d4037";
    ctx.strokeStyle = "#271c19";
    ctx.lineWidth = 4;
    for (let px = -w * 0.48; px <= w * 0.48; px += 34) {
      if (Math.abs(px) < 95) continue; // 중앙 입구 개방
      ctx.fillRect(px - 14, h * 0.05, 28, h * 0.32);
      ctx.strokeRect(px - 14, h * 0.05, 28, h * 0.32);
    }

    // 해적선장의 오두막 본채
    ctx.fillStyle = "#451a03";
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 6;
    ctx.fillRect(-w * 0.3, -h * 0.25, w * 0.6, h * 0.52);
    ctx.strokeRect(-w * 0.3, -h * 0.25, w * 0.6, h * 0.52);

    ctx.fillStyle = "#3f6212";
    ctx.beginPath();
    ctx.moveTo(0, -h * 0.62);
    ctx.lineTo(-w * 0.38, -h * 0.18);
    ctx.lineTo(w * 0.38, -h * 0.18);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 해적 해골 깃발
    ctx.fillStyle = "#111827";
    ctx.fillRect(w * 0.15, -h * 0.78, 80, 50);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 26px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("☠", w * 0.15 + 40, -h * 0.78 + 34);

    // 보스 네임플레이트
    ctx.fillStyle = "rgba(0,0,0,0.82)";
    ctx.fillRect(-175, -h * 0.52, 350, 44);
    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-175, -h * 0.52, 350, 44);
    ctx.fillStyle = "#fca5a5";
    ctx.font = "bold 22px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("👑 해적선장의 오두막 [보스(B)]", 0, -h * 0.52 + 30);
    ctx.restore();
  }


  // ==========================================================================
  // 5. R03, R04, R06, R08 ~ R15 테마별 4000x16000 심리스 오픈필드 배경 렌더러
  // ==========================================================================
  static drawThemedSeamlessField(ctx, w, h, regionId) {
    const THEME_CFG = {
      R03: { // 칼라드루 (바위산/붉은 협곡)
        stops: ["#4a2511", "#8c3f1b", "#b85a2a", "#9c4720", "#6e3216"],
        patchCol1: "rgba(234, 88, 12, 0.14)", patchCol2: "rgba(67, 20, 7, 0.22)",
        roadEdge: "rgba(67, 20, 7, 0.55)", roadFill: "#e6b88a",
        paths: [
          [[2215, 13580], [1600, 11800], [1180, 9415]],
          [[2215, 13580], [2850, 11400], [3290, 8960]],
          [[1180, 9415], [2100, 8800], [3290, 8960]],
          [[1180, 9415], [1850, 6400], [2515, 3380]],
          [[3290, 8960], [2650, 6200], [2515, 3380]]
        ],
        zones: [
          { x: 2215, y: 13580, rx: 850, ry: 720, c0: "#d6a87c", c1: "#9c6644" },
          { x: 1180, y: 9415,  rx: 820, ry: 680, c0: "#ea580c", c1: "#9a3412" },
          { x: 3290, y: 8960,  rx: 750, ry: 620, c0: "#57534e", c1: "#292524" },
          { x: 2515, y: 3380,  rx: 950, ry: 750, c0: "#b45309", c1: "#78350f" }
        ],
        canyonY: [10400, 7800], bridges: [[1180, 10400], [1420, 7800]]
      },
      R04: { // 엘론드 (신비로운 마법 호수)
        stops: ["#082f49", "#0369a1", "#0284c7", "#0ea5e9", "#0f766e"],
        patchCol1: "rgba(103, 232, 249, 0.18)", patchCol2: "rgba(14, 116, 144, 0.22)",
        roadEdge: "rgba(8, 145, 178, 0.5)", roadFill: "#bae6fd",
        paths: [
          [[3080, 5345], [2050, 6800], [995, 12980]],
          [[995, 12980], [2100, 12200], [3005, 10925]],
          [[3005, 10925], [2200, 7800], [980, 5240]],
          [[3080, 5345], [2050, 5300], [980, 5240]]
        ],
        zones: [
          { x: 3080, y: 5345,  rx: 920, ry: 780, c0: "#67e8f9", c1: "#0284c7" },
          { x: 995,  y: 12980, rx: 880, ry: 750, c0: "#5eead4", c1: "#0f766e" },
          { x: 3005, y: 10925, rx: 820, ry: 680, c0: "#38bdf8", c1: "#0369a1" },
          { x: 980,  y: 5240,  rx: 900, ry: 740, c0: "#a5f3fc", c1: "#0891b2" }
        ]
      },
      R06: { // 블러드문 (핏빛 늪지대)
        stops: ["#3b0a1e", "#4c1d24", "#5c2b29", "#4a2c2a", "#36151e"],
        patchCol1: "rgba(225, 29, 72, 0.20)", patchCol2: "rgba(74, 222, 128, 0.12)",
        roadEdge: "rgba(69, 10, 10, 0.55)", roadFill: "#a88b73",
        paths: [
          [[2335, 13730], [2100, 11500], [1220, 9580]],
          [[1220, 9580], [2250, 8100], [3100, 6095]],
          [[3100, 6095], [2100, 5200], [1165, 4185]]
        ],
        zones: [
          { x: 2335, y: 13730, rx: 920, ry: 720, c0: "#847558", c1: "#574c3a" },
          { x: 1220, y: 9580,  rx: 900, ry: 720, c0: "#be123c", c1: "#881337" },
          { x: 3100, y: 6095,  rx: 820, ry: 680, c0: "#9f1239", c1: "#4c0519" },
          { x: 1165, y: 4185,  rx: 920, ry: 740, c0: "#701a75", c1: "#3b0764" }
        ]
      },
      R08: { // 프로스트홀드 (만년설원)
        stops: ["#cbd5e1", "#e2e8f0", "#f1f5f9", "#e0f2fe", "#bae6fd"],
        patchCol1: "rgba(56, 189, 248, 0.16)", patchCol2: "rgba(255, 255, 255, 0.45)",
        roadEdge: "rgba(148, 163, 184, 0.5)", roadFill: "#bae6fd",
        paths: [
          [[2710, 13020], [1950, 10800], [1070, 8785]],
          [[1070, 8785], [1650, 6600], [1215, 4550]],
          [[1215, 4550], [2200, 4800], [3155, 4290]],
          [[1070, 8785], [2350, 6400], [3155, 4290]]
        ],
        zones: [
          { x: 2710, y: 13020, rx: 900, ry: 740, c0: "#93c5fd", c1: "#60a5fa" },
          { x: 1070, y: 8785,  rx: 850, ry: 680, c0: "#e0f2fe", c1: "#7dd3fc" },
          { x: 1215, y: 4550,  rx: 820, ry: 660, c0: "#67e8f9", c1: "#0284c7" },
          { x: 3155, y: 4290,  rx: 880, ry: 700, c0: "#cbd5e1", c1: "#64748b" }
        ]
      },
      R09: { // 이그니스 (화산 지대)
        stops: ["#1c1917", "#291510", "#3b1812", "#271714", "#181210"],
        patchCol1: "rgba(249, 115, 22, 0.25)", patchCol2: "rgba(220, 38, 38, 0.22)",
        roadEdge: "rgba(234, 88, 12, 0.55)", roadFill: "#57534e",
        paths: [
          [[1360, 13590], [2050, 12200], [2235, 10420]],
          [[2235, 10420], [1850, 8400], [2070, 6595]],
          [[2070, 6595], [2150, 4800], [2605, 3215]]
        ],
        zones: [
          { x: 1360, y: 13590, rx: 860, ry: 680, c0: "#57534e", c1: "#292524" },
          { x: 2235, y: 10420, rx: 950, ry: 720, c0: "#ea580c", c1: "#7c2d12" },
          { x: 2070, y: 6595,  rx: 850, ry: 680, c0: "#dc2626", c1: "#450a0a" },
          { x: 2605, y: 3215,  rx: 960, ry: 760, c0: "#f97316", c1: "#7f1d1d" }
        ]
      },
      R10: { // 다크우드 (저주받은 안개숲)
        stops: ["#1e1b2e", "#2d2640", "#382c4c", "#2e293a", "#1f1d24"],
        patchCol1: "rgba(168, 85, 247, 0.18)", patchCol2: "rgba(45, 212, 191, 0.14)",
        roadEdge: "rgba(88, 28, 135, 0.5)", roadFill: "#6b7280",
        paths: [
          [[1310, 13320], [2450, 11800], [1215, 8945]],
          [[1215, 8945], [2100, 7400], [3155, 6365]],
          [[3155, 6365], [2350, 5200], [1220, 4540]]
        ],
        zones: [
          { x: 1310, y: 13320, rx: 880, ry: 700, c0: "#6b7280", c1: "#374151" },
          { x: 1215, y: 8945,  rx: 920, ry: 720, c0: "#6d28d9", c1: "#3b0764" },
          { x: 3155, y: 6365,  rx: 820, ry: 680, c0: "#14b8a6", c1: "#115e59" },
          { x: 1220, y: 4540,  rx: 920, ry: 740, c0: "#10b981", c1: "#064e3b" }
        ]
      },
      R11: { // 윈드스톰 (하늘 협곡 & 구름 절벽)
        stops: ["#7dd3fc", "#93c5fd", "#bfdbfe", "#cbd5e1", "#94a3b8"],
        patchCol1: "rgba(255, 255, 255, 0.42)", patchCol2: "rgba(120, 113, 108, 0.25)",
        roadEdge: "rgba(87, 83, 78, 0.6)", roadFill: "#d6b37c",
        paths: [
          [[2720, 13685], [1850, 11400], [950, 8855]],
          [[950, 8855], [1950, 7600], [2965, 6585]],
          [[2965, 6585], [2150, 5200], [1680, 4045]]
        ],
        zones: [
          { x: 2720, y: 13685, rx: 950, ry: 780, c0: "#84cc16", c1: "#4d7c0f" },
          { x: 950,  y: 8855,  rx: 880, ry: 760, c0: "#a8a29e", c1: "#57534e" },
          { x: 2965, y: 6585,  rx: 880, ry: 720, c0: "#d97706", c1: "#78350f" },
          { x: 1680, y: 4045,  rx: 940, ry: 740, c0: "#475569", c1: "#1e293b" }
        ],
        bridges: [[1850, 11400], [1950, 7600]]
      },
      R12: { // 아르카나 (천공의 부유섬)
        stops: ["#1e1b4b", "#1d4ed8", "#0284c7", "#0ea5e9", "#1e3a8a"],
        patchCol1: "rgba(56, 189, 248, 0.28)", patchCol2: "rgba(192, 132, 252, 0.24)",
        roadEdge: "rgba(56, 189, 248, 0.65)", roadFill: "#a5f3fc",
        paths: [
          [[1225, 5135], [2150, 6400], [2965, 7965]],
          [[2965, 7965], [2050, 9100], [1220, 10255]],
          [[1220, 10255], [2050, 11600], [2800, 12980]]
        ],
        zones: [
          { x: 1225, y: 5135,  rx: 920, ry: 740, c0: "#86efac", c1: "#15803d" },
          { x: 2965, y: 7965,  rx: 900, ry: 720, c0: "#cbd5e1", c1: "#475569" },
          { x: 1220, y: 10255, rx: 880, ry: 700, c0: "#a7f3d0", c1: "#047857" },
          { x: 2800, y: 12980, rx: 940, ry: 760, c0: "#fde68a", c1: "#b45309" }
        ]
      },
      R13: { // 네더게이트 (마계 차원문 황무지)
        stops: ["#2a0808", "#450a0a", "#5c1916", "#3f1312", "#1f0707"],
        patchCol1: "rgba(239, 68, 68, 0.24)", patchCol2: "rgba(249, 115, 22, 0.18)",
        roadEdge: "rgba(220, 38, 38, 0.55)", roadFill: "#78716c",
        paths: [
          [[3100, 12165], [1950, 11200], [990, 9745]],
          [[990, 9745], [2050, 8300], [3010, 6805]],
          [[3010, 6805], [1950, 5400], [1085, 4140]]
        ],
        zones: [
          { x: 3100, y: 12165, rx: 880, ry: 720, c0: "#57534e", c1: "#1c1917" },
          { x: 990,  y: 9745,  rx: 900, ry: 720, c0: "#b91c1c", c1: "#450a0a" },
          { x: 3010, y: 6805,  rx: 880, ry: 700, c0: "#78716c", c1: "#292524" },
          { x: 1085, y: 4140,  rx: 940, ry: 750, c0: "#e11d48", c1: "#4c0519" }
        ]
      },
      R14: { // 드래곤피크 (고룡의 화산 둥지)
        stops: ["#1c1412", "#2e1f18", "#422c22", "#362219", "#1f1410"],
        patchCol1: "rgba(245, 158, 11, 0.22)", patchCol2: "rgba(239, 68, 68, 0.18)",
        roadEdge: "rgba(180, 83, 9, 0.55)", roadFill: "#a8a29e",
        paths: [
          [[2080, 13345], [1650, 11000], [1020, 8630]],
          [[1020, 8630], [2100, 8400], [3100, 8130]],
          [[3100, 8130], [2200, 6000], [2445, 3755]],
          [[1020, 8630], [1850, 6000], [2445, 3755]]
        ],
        zones: [
          { x: 2080, y: 13345, rx: 920, ry: 750, c0: "#78716c", c1: "#44403c" },
          { x: 1020, y: 8630,  rx: 860, ry: 700, c0: "#78350f", c1: "#451a03" },
          { x: 3100, y: 8130,  rx: 860, ry: 700, c0: "#d97706", c1: "#78350f" },
          { x: 2445, y: 3755,  rx: 960, ry: 760, c0: "#eab308", c1: "#713f12" }
        ]
      },
      R15: { // 이터니티 (공허의 중심)
        stops: ["#090514", "#1e1b4b", "#3b0764", "#2e1065", "#0f0720"],
        patchCol1: "rgba(192, 132, 252, 0.24)", patchCol2: "rgba(56, 189, 248, 0.20)",
        roadEdge: "rgba(168, 85, 247, 0.65)", roadFill: "#e9d5ff",
        paths: [
          [[2100, 13285], [1550, 10800], [1085, 8410]],
          [[2100, 13285], [2650, 10800], [3105, 8540]],
          [[1085, 8410], [2100, 8500], [3105, 8540]],
          [[1085, 8410], [1600, 6000], [2120, 3660]],
          [[3105, 8540], [2650, 6000], [2120, 3660]]
        ],
        zones: [
          { x: 2100, y: 13285, rx: 920, ry: 740, c0: "#a855f7", c1: "#4c1d95" },
          { x: 1085, y: 8410,  rx: 880, ry: 720, c0: "#c084fc", c1: "#581c87" },
          { x: 3105, y: 8540,  rx: 880, ry: 720, c0: "#e879f9", c1: "#701a75" },
          { x: 2120, y: 3660,  rx: 980, ry: 780, c0: "#818cf8", c1: "#312e81" }
        ]
      }
    };

    const cfg = THEME_CFG[regionId] || THEME_CFG.R03;
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    cfg.stops.forEach((col, idx) => bgGrad.addColorStop(idx / (cfg.stops.length - 1), col));
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // 지형 질감 패치
    for (let i = 0; i < 420; i++) {
      let px = (Math.abs(Math.sin(i * 19.73) * 43758.5) % 1) * w;
      let py = (Math.abs(Math.cos(i * 73.19) * 23421.6) % 1) * h;
      let rx = 120 + (i % 5) * 65;
      let ry = 80 + (i % 4) * 45;
      ctx.fillStyle = i % 2 === 0 ? cfg.patchCol1 : cfg.patchCol2;
      ctx.beginPath();
      ctx.ellipse(px, py, rx, ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4대 거점 대지(섬/성역) 하이라이트
    cfg.zones.forEach(z => {
      ctx.save();
      ctx.translate(z.x, z.y);
      const g = ctx.createRadialGradient(0, 0, 100, 0, 0, z.rx);
      g.addColorStop(0, z.c0);
      g.addColorStop(0.68, z.c1);
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(0, 0, z.rx, z.ry, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 거점 간 연결 도로 / 마법 다리 / 용암길
    ctx.save();
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    cfg.paths.forEach(pts => {
      ctx.strokeStyle = cfg.roadEdge;
      ctx.lineWidth = 142;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.stroke();

      ctx.strokeStyle = cfg.roadFill;
      ctx.lineWidth = 112;
      ctx.stroke();
    });
    ctx.restore();

    if (cfg.bridges) {
      cfg.bridges.forEach(([bx, by]) => this.drawWoodBridge(ctx, bx, by, 230, 340));
    }
  }

  // ==========================================================================
  // 6. R03 ~ R15 전용 랜드마크 오브젝트(129~161) 고해상도 캔버스 렌더러
  // ==========================================================================
  static drawExtendedLandmark(ctx, type, x, y, w, h, extra) {
    ctx.save();
    ctx.translate(x, y);

    // 바닥 그림자
    ctx.fillStyle = "rgba(0,0,0,0.42)";
    ctx.beginPath();
    ctx.ellipse(0, (h || w) * 0.34, (w || 200) * 0.52, (h || w) * 0.24, 0, 0, Math.PI * 2);
    ctx.fill();

    const drawBanner = (txt, borderCol = "#facc15", textCol = "#fef08a") => {
      ctx.fillStyle = "rgba(0,0,0,0.82)";
      ctx.fillRect(-165, -h * 0.54, 330, 42);
      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 2.5;
      ctx.strokeRect(-165, -h * 0.54, 330, 42);
      ctx.fillStyle = textCol;
      ctx.font = "bold 20px Noto Sans KR, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(txt, 0, -h * 0.54 + 28);
    };

    if (type === OBJ.FORTRESS_WALL) {
      // 석조 성벽 및 망루 (칼라드루/드래곤피크)
      ctx.fillStyle = "#78716c";
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 5;
      ctx.fillRect(-w * 0.45, -h * 0.2, w * 0.9, h * 0.5);
      ctx.strokeRect(-w * 0.45, -h * 0.2, w * 0.9, h * 0.5);
      ctx.fillStyle = "#57534e";
      ctx.fillRect(-w * 0.48, -h * 0.45, w * 0.28, h * 0.78);
      ctx.strokeRect(-w * 0.48, -h * 0.45, w * 0.28, h * 0.78);
      ctx.fillRect(w * 0.2, -h * 0.45, w * 0.28, h * 0.78);
      ctx.strokeRect(w * 0.2, -h * 0.45, w * 0.28, h * 0.78);
      ctx.fillStyle = "#1c1917";
      ctx.beginPath(); ctx.roundRect(-36, h * 0.02, 72, h * 0.28, [30, 30, 0, 0]); ctx.fill();
    }
    else if (type === OBJ.MINE_ENTRANCE) {
      // 광신도의 광산 동굴 & 광차 레일
      ctx.fillStyle = "#57534e";
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 7;
      ctx.beginPath();
      ctx.arc(0, h * 0.2, w * 0.46, Math.PI, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#090d16";
      ctx.beginPath();
      ctx.arc(0, h * 0.2, w * 0.28, Math.PI, 0);
      ctx.closePath();
      ctx.fill();
      // 나무 갱도 버팀목 & 철도 레일
      ctx.strokeStyle = "#78350f"; ctx.lineWidth = 12;
      ctx.strokeRect(-w * 0.26, -h * 0.12, w * 0.52, h * 0.32);
      ctx.strokeStyle = "#94a3b8"; ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(-45, h * 0.2); ctx.lineTo(-75, h * 0.48);
      ctx.moveTo(45, h * 0.2);  ctx.lineTo(75, h * 0.48);
      ctx.stroke();
      drawBanner("⛏️ 광신도의 광산 (Lv.42~48)", "#f59e0b");
    }
    else if (type === OBJ.RUNE_ALTAR) {
      // 골렘의 제단 (반원형 거석 룬 제단)
      ctx.fillStyle = "#78716c";
      ctx.strokeStyle = "#292524";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, h * 0.1, w * 0.48, h * 0.32, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      for (let i = -2; i <= 2; i++) {
        let px = i * (w * 0.18);
        let py = -h * 0.22 + Math.abs(i) * 28;
        ctx.fillStyle = "#57534e";
        ctx.fillRect(px - 36, py - 90, 72, 130);
        ctx.strokeRect(px - 36, py - 90, 72, 130);
        ctx.fillStyle = "#f97316";
        ctx.font = "bold 36px serif";
        ctx.textAlign = "center";
        ctx.fillText("ᚱ", px, py - 15);
      }
      drawBanner("👑 골렘의 제단 [보스(B)]", "#f97316", "#fed7aa");
    }
    else if (type === OBJ.ELVEN_ARCH) {
      // 엘론드 백색 마법 아치
      ctx.strokeStyle = "#e0f2fe";
      ctx.lineWidth = 16;
      ctx.beginPath();
      ctx.arc(0, h * 0.25, w * 0.36, Math.PI, 0);
      ctx.moveTo(-w * 0.36, h * 0.25); ctx.lineTo(-w * 0.36, h * 0.42);
      ctx.moveTo(w * 0.36, h * 0.25);  ctx.lineTo(w * 0.36, h * 0.42);
      ctx.stroke();
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    else if (type === OBJ.GLOW_TREE) {
      // 엘론드 발광 거목
      ctx.fillStyle = "#cbd5e1";
      ctx.fillRect(-w * 0.12, -h * 0.05, w * 0.24, h * 0.42);
      const cols = ["#38bdf8", "#67e8f9", "#a5f3fc", "#818cf8"];
      [[-0.25, -0.22, 0.32], [0.25, -0.22, 0.32], [0, -0.42, 0.38], [0, -0.2, 0.35]].forEach(([px, py, pr], i) => {
        ctx.fillStyle = cols[i % cols.length];
        ctx.beginPath(); ctx.arc(w * px, h * py, w * pr, 0, Math.PI * 2); ctx.fill();
      });
    }
    else if (type === OBJ.SUNKEN_TEMPLE) {
      // 가라앉은 신전
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.ellipse(0, h * 0.22, w * 0.44, h * 0.24, 0, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = "#0e7490";
      ctx.strokeStyle = "#164e63";
      ctx.lineWidth = 5;
      ctx.fillRect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.42);
      ctx.strokeRect(-w * 0.28, -h * 0.18, w * 0.56, h * 0.42);
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.65); ctx.lineTo(-w * 0.32, -h * 0.18); ctx.lineTo(w * 0.32, -h * 0.18); ctx.closePath();
      ctx.fill(); ctx.stroke();
      drawBanner("🏛️ 가라앉은 신전 (Lv.58~63)", "#38bdf8", "#bae6fd");
    }
    else if (type === OBJ.WATER_THRONE) {
      // 물의 정령왕좌
      ctx.fillStyle = "#0284c7";
      ctx.beginPath(); ctx.ellipse(0, h * 0.22, w * 0.48, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#67e8f9";
      ctx.strokeStyle = "#0369a1";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.65);
      ctx.lineTo(-w * 0.34, -h * 0.1);
      ctx.lineTo(-w * 0.24, h * 0.25);
      ctx.lineTo(w * 0.24, h * 0.25);
      ctx.lineTo(w * 0.34, -h * 0.1);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      drawBanner("👑 물의 정령왕좌 [보스(B)]", "#38bdf8", "#e0f2fe");
    }
    else if (type === OBJ.SWAMP_TENT || type === OBJ.RAVEN_TENT) {
      Renderer.drawCampTent(ctx, 0, 0, w, h);
    }
    else if (type === OBJ.BEAST_DEN) {
      // 역병 짐승의 굴 (괴수 이빨 동굴)
      ctx.fillStyle = "#4c1d24";
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, h * 0.25, w * 0.46, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#090508";
      ctx.beginPath(); ctx.arc(0, h * 0.25, w * 0.28, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#e7e5e4";
      [-0.18, -0.06, 0.06, 0.18].forEach(tx => {
        ctx.beginPath();
        ctx.moveTo(w * (tx - 0.04), h * 0.02);
        ctx.lineTo(w * (tx + 0.04), h * 0.02);
        ctx.lineTo(w * tx, h * 0.16);
        ctx.closePath();
        ctx.fill();
      });
      drawBanner("🩸 역병 짐승의 굴 (Lv.88~93)", "#f43f5e", "#fecdd3");
    }
    else if (type === OBJ.TOXIC_ALTAR) {
      // 맹독 늪지 깊은곳
      ctx.fillStyle = "#4ade80";
      ctx.beginPath(); ctx.ellipse(0, h * 0.12, w * 0.42, h * 0.26, 0, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = "#15803d"; ctx.lineWidth = 6; ctx.stroke();
      drawBanner("👑 맹독 늪지 깊은곳 [보스(B)]", "#4ade80", "#bbf7d0");
    }
    else if (type === OBJ.ICE_IGLOO) {
      ctx.fillStyle = "#e0f2fe";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(0, h * 0.2, w * 0.42, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0c4a6e";
      ctx.beginPath(); ctx.arc(0, h * 0.2, w * 0.16, Math.PI, 0); ctx.closePath(); ctx.fill();
    }
    else if (type === OBJ.ICE_SPIRE) {
      ctx.fillStyle = "#7dd3fc";
      ctx.strokeStyle = "#0284c7";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.65);
      ctx.lineTo(-w * 0.35, h * 0.3);
      ctx.lineTo(w * 0.35, h * 0.3);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    else if (type === OBJ.CRYSTAL_CAVE) {
      ctx.fillStyle = "#cbd5e1";
      ctx.strokeStyle = "#334155";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, h * 0.25, w * 0.46, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#082f49";
      ctx.beginPath(); ctx.arc(0, h * 0.25, w * 0.28, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#38bdf8";
      [[-w * 0.32, h * 0.2], [w * 0.32, h * 0.2]].forEach(([cx, cy]) => {
        ctx.beginPath(); ctx.moveTo(cx, cy - 90); ctx.lineTo(cx - 35, cy + 20); ctx.lineTo(cx + 35, cy + 20); ctx.closePath(); ctx.fill();
      });
      drawBanner("❄️ 얼어붙은 수정동굴 (Lv.120~128)", "#38bdf8", "#e0f2fe");
    }
    else if (type === OBJ.FROST_THRONE) {
      ctx.fillStyle = "#94a3b8";
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 6;
      ctx.fillRect(-w * 0.28, -h * 0.55, w * 0.56, h * 0.8);
      ctx.strokeRect(-w * 0.28, -h * 0.55, w * 0.56, h * 0.8);
      drawBanner("👑 서리거인의 안식처 [보스(B)]", "#60a5fa", "#dbeafe");
    }
    else if (type === OBJ.VOLCANO_CONE || type === OBJ.DEMON_CRATER) {
      ctx.fillStyle = "#292524";
      ctx.strokeStyle = "#090504";
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(-w * 0.48, h * 0.34);
      ctx.lineTo(-w * 0.22, -h * 0.52);
      ctx.lineTo(w * 0.22, -h * 0.52);
      ctx.lineTo(w * 0.48, h * 0.34);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#f97316";
      ctx.beginPath(); ctx.ellipse(0, -h * 0.52, w * 0.22, 28, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(-28, -h * 0.52, 56, h * 0.86);
      if (type === OBJ.DEMON_CRATER) drawBanner("👑 화염마족의 분화구 [보스(B)]", "#f97316", "#ffedd5");
      else drawBanner("🌋 용암 튜브 미궁 (Lv.140~148)", "#f97316", "#ffedd5");
    }
    else if (type === OBJ.UNDEAD_CRYPT || type === OBJ.LICH_CASTLE) {
      ctx.fillStyle = "#374151";
      ctx.strokeStyle = "#111827";
      ctx.lineWidth = 6;
      ctx.fillRect(-w * 0.36, -h * 0.28, w * 0.72, h * 0.6);
      ctx.strokeRect(-w * 0.36, -h * 0.28, w * 0.72, h * 0.6);
      ctx.fillStyle = "#2dd4bf";
      ctx.beginPath(); ctx.roundRect(-36, h * 0.02, 72, h * 0.3, [32, 32, 0, 0]); ctx.fill();
      if (type === OBJ.LICH_CASTLE) drawBanner("👑 언데드 군주의 방 [보스(B)]", "#2dd4bf", "#ccfbf1");
      else drawBanner("💀 망자의 지하묘지 (Lv.160~168)", "#2dd4bf", "#ccfbf1");
    }
    else if (type === OBJ.HARPY_NEST || type === OBJ.STORMBIRD_ALTAR) {
      ctx.fillStyle = "#a16207";
      ctx.strokeStyle = "#422006";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(0, h * 0.1, w * 0.42, h * 0.25, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#fef3c7";
      [[-24, 8], [24, 8], [0, -10]].forEach(([ex, ey]) => {
        ctx.beginPath(); ctx.ellipse(ex, ey, 18, 24, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      });
      if (type === OBJ.STORMBIRD_ALTAR) drawBanner("👑 폭풍새의 산란장 [보스(B)]", "#38bdf8", "#e0f2fe");
      else drawBanner("🦅 하피의 둥지 (Lv.180~188)", "#facc15", "#fef08a");
    }
    else if (type === OBJ.MANA_CRYSTAL || type === OBJ.ABYSS_CRYSTAL) {
      ctx.fillStyle = type === OBJ.MANA_CRYSTAL ? "#c084fc" : "#e879f9";
      ctx.strokeStyle = "#f8fafc";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -h * 0.65);
      ctx.lineTo(w * 0.28, -h * 0.1);
      ctx.lineTo(0, h * 0.32);
      ctx.lineTo(-w * 0.28, -h * 0.1);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      if (type === OBJ.ABYSS_CRYSTAL && extra === "dungeon") drawBanner("🌌 심연의 회랑 (Lv.320~340)", "#e879f9", "#fae8ff");
    }
    else if (type === OBJ.ARCANE_AIRSHIP) {
      DetailFieldRenderer.drawHarborShip(ctx, 0, 0, w, h);
      drawBanner("🛸 고대 마공학 부유선 (Lv.205~215)", "#a855f7", "#f3e8ff");
    }
    else if (type === OBJ.TITAN_DOME) {
      ctx.fillStyle = "#d97706";
      ctx.strokeStyle = "#451a03";
      ctx.lineWidth = 6;
      ctx.beginPath(); ctx.arc(0, h * 0.2, w * 0.42, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#38bdf8";
      ctx.beginPath(); ctx.arc(0, -h * 0.05, 36, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      drawBanner("👑 기계신 타이탄 제어실 [보스(B)]", "#facc15", "#fef08a");
    }
    else if (type === OBJ.GIANT_RIBCAGE) {
      ctx.strokeStyle = "#e7e5e4";
      ctx.lineWidth = 12;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.arc(i * 42, 0, 65, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
      }
    }
    else if (type === OBJ.TORTURE_FORTRESS) {
      ctx.fillStyle = "#44403c";
      ctx.strokeStyle = "#1c1917";
      ctx.lineWidth = 6;
      ctx.fillRect(-w * 0.42, -h * 0.25, w * 0.84, h * 0.55);
      ctx.strokeRect(-w * 0.42, -h * 0.25, w * 0.84, h * 0.55);
      drawBanner("⛓️ 고문관의 미궁 (Lv.240~255)", "#ef4444", "#fecaca");
    }
    else if (type === OBJ.NETHER_PORTAL) {
      ctx.fillStyle = "#450a0a";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.36, h * 0.48, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#e11d48";
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.22, h * 0.32, 0, 0, Math.PI * 2); ctx.fill();
      drawBanner("👑 차원문 중심부 [보스(B)]", "#ef4444", "#fecaca");
    }
    else if (type === OBJ.TRAINING_RUINS) {
      DetailFieldRenderer.drawSunkenRuins(ctx, 0, 0, w, h);
    }
    else if (type === OBJ.DRAKE_NEST) {
      DetailFieldRenderer.drawAntHellCrater(ctx, 0, 0, w, h);
      drawBanner("🥚 드레이크 부화장 (Lv.280~295)", "#f59e0b", "#fef3c7");
    }
    else if (type === OBJ.DRAGON_LAIR) {
      ctx.fillStyle = "#eab308";
      ctx.beginPath(); ctx.ellipse(0, h * 0.15, w * 0.45, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
      DetailFieldRenderer.drawExtendedLandmark(ctx, OBJ.GIANT_RIBCAGE, -120, -20, 220, 140);
      drawBanner("👑 고룡의 둥지 [보스(B)]", "#facc15", "#fef08a");
    }
    else if (type === OBJ.RIFT_GATE) {
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.ellipse(0, 0, w * 0.32, h * 0.45, 0, 0, Math.PI * 2); ctx.stroke();
    }
    else if (type === OBJ.KAELEN_THRONE) {
      // 블랙홀 일식 & 배교자 카엘런의 옥좌
      ctx.fillStyle = "#090514";
      ctx.strokeStyle = "#c084fc";
      ctx.lineWidth = 10;
      ctx.beginPath(); ctx.arc(0, -h * 0.38, 95, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#3b0764";
      ctx.fillRect(-w * 0.28, -h * 0.15, w * 0.56, h * 0.45);
      ctx.strokeRect(-w * 0.28, -h * 0.15, w * 0.56, h * 0.45);
      drawBanner("👑 배교자 카엘런의 옥좌 [최종보스(B)]", "#c084fc", "#f3e8ff");
    }

    ctx.restore();
  }

  static drawSeaStack(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = "rgba(240, 249, 255, 0.8)";
    ctx.lineWidth = 6;
    ctx.beginPath(); ctx.ellipse(0, size * 0.22, size * 0.58, size * 0.28, 0, 0, Math.PI * 2); ctx.stroke();
    Renderer.drawRock(ctx, 0, 0, size);
    ctx.restore();
  }
}

export class Renderer {
  static drawWell(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0, 10, size * 0.55, size * 0.35, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#78716c";
    ctx.beginPath(); ctx.arc(0, 0, size * 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#292524"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#0288d1";
    ctx.beginPath(); ctx.arc(0, 0, size * 0.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#5d4037";
    ctx.fillRect(-size * 0.4, -size * 0.6, 10, size * 0.6);
    ctx.fillRect(size * 0.4 - 10, -size * 0.6, 10, size * 0.6);
    ctx.fillStyle = "#8d6e63";
    ctx.fillRect(-size * 0.5, -size * 0.75, size, 20);
    ctx.strokeRect(-size * 0.5, -size * 0.75, size, 20);
    ctx.restore();
  }

  static drawDesertTent(ctx, x, y, w, h) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)"; ctx.beginPath(); ctx.ellipse(0, h / 2 - 10, w / 2, h / 4, 0, 0, Math.PI * 2); ctx.fill();
    const tentGrad = ctx.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
    tentGrad.addColorStop(0, "#e8d0a9"); tentGrad.addColorStop(1, "#a88759");
    ctx.fillStyle = tentGrad;
    ctx.beginPath(); ctx.moveTo(-w / 2, h / 2); ctx.lineTo(0, -h / 2); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#2b1c12"; ctx.beginPath(); ctx.moveTo(-w / 6, h / 2); ctx.lineTo(0, h / 8); ctx.lineTo(w / 6, h / 2); ctx.fill();
    ctx.restore();
  }

  static drawCampTent(ctx, x, y, w, h) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)"; ctx.beginPath(); ctx.ellipse(0, h / 2 - 10, w / 2, h / 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#64748b"; ctx.beginPath(); ctx.moveTo(0, -h / 2); ctx.lineTo(-w / 2, h / 2); ctx.lineTo(w / 2, h / 2); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = "#1e293b"; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = "#0f172a"; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-w / 6, h / 2); ctx.lineTo(w / 6, h / 2); ctx.fill();
    ctx.restore();
  }

  static drawBossAltar(ctx, x, y, w, h, theme) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(69, 10, 10, 0.35)";
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.45, h * 0.38, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#dc2626"; ctx.lineWidth = 4; ctx.stroke();
    for (let i = 0; i < 4; i++) {
      let a = (Math.PI / 2) * i + Math.PI / 4;
      let px = Math.cos(a) * w * 0.42, py = Math.sin(a) * h * 0.35;
      ctx.fillStyle = "#78350f"; ctx.fillRect(px - 12, py - 55, 24, 55);
      ctx.fillStyle = "#ef4444"; ctx.fillRect(px - 16, py - 45, 32, 18);
    }
    ctx.restore();
  }

  static drawPortal(ctx, x, y, w, h, portalType = "") {
    ctx.save(); ctx.translate(x, y);
    const isExit = portalType.startsWith("EXIT_");
    const glowColor = isExit ? "#38bdf8" : "#a855f7";
    ctx.shadowColor = glowColor; ctx.shadowBlur = 30;
    ctx.fillStyle = "#090d16";
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.38, h * 0.48, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = glowColor; ctx.lineWidth = 10; ctx.stroke();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(0, 0, w * 0.22, h * 0.3, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;

    const PORTAL_LABELS = {
      TO_GOBLIN_CAVE: "🌀 고블린 동굴 입장",
      TO_SILVERVINE_DUNGEON: "🌀 버려진 벌목장 심층부 입장",
      TO_R03_DUNGEON: "🌀 광신도의 광산 심층부 입장",
      TO_R04_DUNGEON: "🌀 가라앉은 신전 심층부 입장",
      TO_MORAAN_DUNGEON: "🌀 개미지옥 둥지 심층부 입장",
      TO_R06_DUNGEON: "🌀 역병 짐승의 굴 입장",
      TO_BALENOS_DUNGEON: "🌀 난파선 무덤 선실 입장",
      TO_R08_DUNGEON: "🌀 얼어붙은 수정동굴 입장",
      TO_R09_DUNGEON: "🌀 용암 튜브 미궁 입장",
      TO_R10_DUNGEON: "🌀 망자의 지하묘지 입장",
      TO_R11_DUNGEON: "🌀 하피의 둥지 심층부 입장",
      TO_R12_DUNGEON: "🌀 고대 마공학 부유선 내부 입장",
      TO_R13_DUNGEON: "🌀 고문관의 미궁 입장",
      TO_R14_DUNGEON: "🌀 드레이크 부화장 심층부 입장",
      TO_R15_DUNGEON: "🌀 심연의 회랑 던전 입장"
    };
    let label = isExit ? "🌀 야외 필드로 나가기" : (PORTAL_LABELS[portalType] || "🌀 던전 심층부 입장");

    ctx.fillStyle = "#fde047";
    ctx.font = "bold 18px Noto Sans KR, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(label, 0, -h * 0.58);
    ctx.restore();
  }

  static drawPlaza(ctx, x, y, radius, theme) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(215, 184, 137, 0.5)";
    ctx.beginPath(); ctx.arc(0, 0, radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#5d4037"; ctx.lineWidth = 6; ctx.stroke();
    ctx.restore();
  }

  static drawCampfire(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(255, 120, 0, 0.22)";
    ctx.beginPath(); ctx.arc(0, 0, size * 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#57534e";
    for (let i = 0; i < 8; i++) {
      let a = (Math.PI / 4) * i;
      ctx.beginPath(); ctx.arc(Math.cos(a) * size * 0.7, Math.sin(a) * size * 0.5, size * 0.22, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = "#451a03"; ctx.lineWidth = 10; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(-size * 0.5, size * 0.2); ctx.lineTo(size * 0.5, -size * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-size * 0.5, -size * 0.2); ctx.lineTo(size * 0.5, size * 0.2); ctx.stroke();
    ctx.fillStyle = "#ef4444";
    ctx.beginPath(); ctx.moveTo(0, -size * 1.1); ctx.quadraticCurveTo(size * 0.6, 0, 0, size * 0.3); ctx.quadraticCurveTo(-size * 0.6, 0, 0, -size * 1.1); ctx.fill();
    ctx.fillStyle = "#facc15";
    ctx.beginPath(); ctx.moveTo(0, -size * 0.7); ctx.quadraticCurveTo(size * 0.35, 0, 0, size * 0.2); ctx.quadraticCurveTo(-size * 0.35, 0, 0, -size * 0.7); ctx.fill();
    ctx.restore();
  }

  static drawTree(ctx, x, y, size, type) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath(); ctx.ellipse(0, size * 0.38, size * 0.48, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();

    if (type === OBJ.PINE_TREE) {
      ctx.fillStyle = "#451a03"; ctx.fillRect(-size * 0.1, 0, size * 0.2, size * 0.4);
      ctx.fillStyle = "#1b4332";
      ctx.beginPath(); ctx.moveTo(0, -size * 0.75); ctx.lineTo(-size * 0.48, 0.05 * size); ctx.lineTo(size * 0.48, 0.05 * size); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#2d6a4f";
      ctx.beginPath(); ctx.moveTo(0, -size * 1.05); ctx.lineTo(-size * 0.38, -size * 0.25); ctx.lineTo(size * 0.38, -size * 0.25); ctx.closePath(); ctx.fill();
    } else {
      ctx.fillStyle = "#5d4037";
      ctx.fillRect(-size * 0.12, -size * 0.05, size * 0.24, size * 0.45);
      ctx.strokeStyle = "#3e2723"; ctx.lineWidth = 3;
      ctx.strokeRect(-size * 0.12, -size * 0.05, size * 0.24, size * 0.45);

      const puffs = [
        [-0.25, -0.2, 0.34, "#2e7d32"],
        [0.25, -0.2, 0.34, "#2e7d32"],
        [0, -0.45, 0.38, "#388e3c"],
        [-0.15, -0.35, 0.3, "#4caf50"],
        [0.15, -0.35, 0.3, "#66bb6a"],
        [0, -0.22, 0.36, "#43a047"]
      ];
      puffs.forEach(([px, py, pr, col]) => {
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(size * px, size * py, size * pr, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#1b5e20";
        ctx.lineWidth = 2.5;
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  static drawRock(ctx, x, y, size) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.beginPath(); ctx.ellipse(0, size * 0.22, size * 0.52, size * 0.24, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#78716c";
    ctx.beginPath();
    ctx.moveTo(-size * 0.48, size * 0.2);
    ctx.lineTo(-size * 0.35, -size * 0.32);
    ctx.lineTo(size * 0.1, -size * 0.4);
    ctx.lineTo(size * 0.48, -size * 0.05);
    ctx.lineTo(size * 0.42, size * 0.22);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#292524"; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = "#a8a29e";
    ctx.beginPath();
    ctx.moveTo(-size * 0.32, -size * 0.28);
    ctx.lineTo(size * 0.08, -size * 0.36);
    ctx.lineTo(size * 0.15, -size * 0.05);
    ctx.lineTo(-size * 0.2, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  static drawWall(ctx, x, y, w, h) {
    ctx.save();
    ctx.fillStyle = "#3f3a34";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#57534e";
    ctx.fillRect(x, y, w, 18);
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 4;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
  }
}

// ============================================================================
// 🗺️ 4대 심리스 오픈필드 (4000 x 16000) 및 미로 던전 빌더
// ============================================================================

// [1] R01 알트리아 (Altria) 4000x16000
function buildAltriaSeamlessMap() {
  const w = 4000;
  const h = 16000;
  let objects = [];

  objects.push([OBJ.WINDMILL, 2150, 13650, 260, 340]);
  objects.push([OBJ.WELL, 2340, 13920, 90, 90]);
  objects.push([OBJ.CAMPFIRE, 2000, 14120, 55, 55]);

  objects.push([OBJ.VILLAGE_HOUSE, 1680, 13800, 240, 210, "straw"]);
  objects.push([OBJ.VILLAGE_HOUSE, 1520, 14180, 250, 210, "straw"]);
  objects.push([OBJ.VILLAGE_HOUSE, 1680, 14550, 240, 210, "wood"]);
  objects.push([OBJ.VILLAGE_HOUSE, 2480, 14050, 240, 210, "wood"]);
  objects.push([OBJ.VILLAGE_HOUSE, 2420, 14480, 250, 210, "straw"]);
  objects.push([OBJ.VILLAGE_HOUSE, 2120, 14650, 220, 190, "straw"]);

  objects.push([OBJ.ANCIENT_PILLAR, 950, 7600, 110, 110]);
  objects.push([OBJ.ANCIENT_PILLAR, 1350, 7450, 110, 110]);
  objects.push([OBJ.BROKEN_PILLAR, 820, 8350, 110, 110]);
  objects.push([OBJ.BROKEN_PILLAR, 2150, 7850, 110, 110]);
  objects.push([OBJ.ANCIENT_PILLAR, 1850, 8500, 100, 100]);

  objects.push([OBJ.DESERT_TENT, 1150, 8050, 190, 150]);
  objects.push([OBJ.CAMP_TENT, 1380, 7920, 180, 140]);
  objects.push([OBJ.DESERT_TENT, 1780, 8100, 200, 155]);
  objects.push([OBJ.CAMPFIRE, 1480, 8180, 45, 45]);

  objects.push([OBJ.GOBLIN_CAVE_ENTRANCE, 1100, 1620, 820, 520]);
  objects.push([OBJ.CAMPFIRE, 780, 2100, 45, 45]);
  objects.push([OBJ.CAMPFIRE, 1420, 2100, 45, 45]);
  objects.push([OBJ.PORTAL, 1100, 2120, 160, 160, "TO_GOBLIN_CAVE"]);

  objects.push([OBJ.BOSS_ALTAR, 2950, 2250, 520, 520, "nature"]);
  objects.push([OBJ.CHIEF_TENT, 2950, 1620, 680, 480]);
  objects.push([OBJ.CAMPFIRE, 2580, 2150, 50, 50]);
  objects.push([OBJ.CAMPFIRE, 3320, 2150, 50, 50]);

  for (let i = 0; i < 420; i++) {
    let tx = 120 + (Math.abs(Math.sin(i * 19.31) * 91827.3) % (w - 240));
    let ty = 250 + (Math.abs(Math.cos(i * 37.71) * 65432.1) % (h - 500));

    if (Math.hypot(tx - 2000, ty - 14250) < 950) continue;
    if (Math.hypot(tx - 1450, ty - 8150) < 700) continue;
    if (Math.hypot(tx - 1100, ty - 2050) < 850) continue;
    if (Math.hypot(tx - 2950, ty - 2200) < 900) continue;
    if (Math.abs(ty - 11600) < 320) continue;
    if (Math.abs(ty - (4300 + (tx / w) * 1100)) < 340) continue;
    if (tx > 2700 && ty > 14700) continue;
    if (tx > 1000 && tx < 3000 && (i % 3 !== 0)) continue;

    let size = 85 + (i % 5) * 20;
    let tType = (tx > 2900 && ty > 6500 && ty < 11000) ? OBJ.PINE_TREE : OBJ.OAK_TREE;
    objects.push([tType, tx, ty, size, size]);
  }

  for (let i = 0; i < 110; i++) {
    let rx = 150 + (Math.abs(Math.sin(i * 73.1) * 41234.5) % (w - 300));
    let ry = 300 + (Math.abs(Math.cos(i * 29.7) * 81234.5) % (h - 600));
    if (Math.hypot(rx - 2000, ry - 14250) < 980) continue;
    if (Math.hypot(rx - 1450, ry - 8150) < 700) continue;
    if (Math.hypot(rx - 1100, ry - 2050) < 850) continue;
    if (Math.hypot(rx - 2950, ry - 2200) < 900) continue;
    if (Math.abs(ry - 11600) < 320 || Math.abs(ry - (4300 + (rx / w) * 1100)) < 340) continue;
    if (rx > 1300 && rx < 2700) continue;
    objects.push([OBJ.ROCK, rx, ry, 65 + (i % 4) * 18, 65]);
  }

  const altriaMapData = {
    regionId: "R01",
    width: w,
    height: h,
    isSeamlessRegion: true,
    isDungeon: false,
    bgColor: "#558b2f",
    pathColor: "rgba(0,0,0,0)",
    direction: "N",
    isMaze: false,
    objects: objects,
    extraWallBoxes: (() => {
      const boxes = [];
      // 남부 강 (y = 11600 + sin(x/450)*180, 폭 220) - 서쪽 다리(1100) 및 동쪽 다리(2800) 구간만 개방
      for (let x = 0; x < 4000; x += 80) {
        const cx = x + 40;
        if (Math.abs(cx - 1100) < 135 || Math.abs(cx - 2800) < 135) continue;
        const ry = Math.round(11600 + Math.sin(cx / 450) * 180);
        boxes.push({ x: x, y: ry - 110, width: 84, height: 220 });
      }
      // 북부 강 (y = 4300 + (x/4000)*1100 + sin(x/400)*160, 폭 230) - 북부 다리(2650) 구간만 개방
      for (let x = 0; x < 4000; x += 80) {
        const cx = x + 40;
        if (Math.abs(cx - 2650) < 140) continue;
        const ry = Math.round(4300 + (cx / 4000) * 1100 + Math.sin(cx / 400) * 160);
        boxes.push({ x: x, y: ry - 115, width: 84, height: 230 });
      }
      // 남동쪽 호수 (x: 2820~4000, y: 14820~16000) 수면 진입 방지
      boxes.push(
        { x: 3450, y: 14820, width: 550, height: 1180 },
        { x: 3120, y: 15080, width: 350, height: 920 },
        { x: 2840, y: 15420, width: 300, height: 580 }
      );
      return boxes;
    })(),
    spawn: { x: 2000, y: 14250 },
    fieldPos: { x: 1820, y: 8620 },
    dungeonEntrance: { x: 1100, y: 2280 },
    bossPos: { x: 2950, y: 2250 },
    bossWarpPos: { x: 2950, y: 2820 },
    warpSafeZones: [
      { x: 2000, y: 14250, radius: 780, type: "town" },
      { x: 1820, y: 8620,  radius: 420, type: "field" },
      { x: 1100, y: 2280,  radius: 420, type: "dungeon_entrance" },
      { x: 2950, y: 2820,  radius: 420, type: "boss_camp" }
    ],
    title: "알트리아 (Altria) - 초심자의마을(S)",
    landmarks: [
      { name: "초심자의마을(S)", x: 2000, y: 14250, type: "town", desc: "마을 안전지대" },
      { name: "속삭이는 들판", x: 1820, y: 8620, type: "field", desc: "권장 Lv.5~13 (안전진입)" },
      { name: "고블린 동굴 입구", x: 1100, y: 2280, type: "dungeon_entrance", desc: "동굴 입구 (안전진입)" },
      { name: "족장의 막사 [보스(B)]", x: 2950, y: 2820, type: "boss_camp", desc: "막사 입구 (안전진입)" }
    ]
  };

  HardcodedMapDB["R01_sub1"] = altriaMapData;
  HardcodedMapDB["R01_sub2"] = altriaMapData;
  HardcodedMapDB["R01_sub4"] = altriaMapData;
}

// [2] R02 실버바인 (Silvervine) 4000x16000 (SilverVine.jpg & SilverVine.tmj 완벽 구현)
function buildSilvervineSeamlessMap() {
  const w = 4000;
  const h = 16000;
  let objects = [];

  // 1) 남부: 요정의 야영지(S1) (SilverVine.tmj id=3 중심: 2020, 13400)
  objects.push([OBJ.CAMPFIRE, 2020, 13560, 50, 50]);
  objects.push([OBJ.FAIRY_MUSHROOM_HOUSE, 1520, 13120, 230, 210, "pink"]);
  objects.push([OBJ.FAIRY_MUSHROOM_HOUSE, 1740, 12920, 240, 220, "leaf"]);
  objects.push([OBJ.FAIRY_MUSHROOM_HOUSE, 1440, 13560, 220, 200, "pink"]);
  objects.push([OBJ.FAIRY_TENT, 2450, 13080, 210, 180, "blue"]);
  objects.push([OBJ.FAIRY_TENT, 2560, 13480, 220, 190, "purple"]);
  objects.push([OBJ.FAIRY_TENT, 2380, 13880, 210, 180, "purple"]);
  objects.push([OBJ.FAIRY_POND, 1580, 14120, 480, 320]);

  const campMushrooms = [
    [1280, 13000, 95, "blue"], [1260, 13850, 85, "pink"],
    [2680, 12950, 95, "purple"], [2720, 13780, 90, "blue"],
    [2150, 14180, 85, "pink"], [1950, 12780, 80, "blue"]
  ];
  campMushrooms.forEach(([mx, my, ms, mc]) => objects.push([OBJ.GIANT_MUSHROOM, mx, my, ms, mc]));

  // 2) 중서부: 은빛 덩굴숲 (SilverVine.tmj id=2 중심: 950, 9080)
  const vineTrees = [
    [520, 8250], [880, 7950], [1380, 8350], [580, 8950],
    [1460, 8900], [680, 9650], [1350, 9600], [580, 10150]
  ];
  vineTrees.forEach(([vx, vy]) => objects.push([OBJ.SILVER_VINE_TREE, vx, vy, 210, 210]));
  objects.push([OBJ.GIANT_MUSHROOM, 780, 8750, 90, "blue"]);
  objects.push([OBJ.GIANT_MUSHROOM, 1220, 9250, 85, "purple"]);
  objects.push([OBJ.ANCIENT_PILLAR, 1380, 8650, 95, 95]);

  // 3) 중동부: 버려진 벌목장 (SilverVine.tmj id=4 중심: 3000, 9200 / 포탈: 3000, 8960)
  objects.push([OBJ.LUMBER_MILL, 3050, 8420, 680, 460]);
  objects.push([OBJ.LOG_PILE, 2520, 8820, 220, 120]);
  objects.push([OBJ.LOG_PILE, 2580, 9120, 200, 110]);
  objects.push([OBJ.LOG_PILE, 3420, 8980, 220, 120]);
  objects.push([OBJ.PORTAL, 3000, 8960, 160, 160, "TO_SILVERVINE_DUNGEON"]);

  // 4) 북단 중앙: 타락한 세계수 (SilverVine.tmj id=1 중심: 2050, 4920 / 보스: 2050, 4550)
  objects.push([OBJ.CORRUPTED_WORLD_TREE, 2050, 3750, 960, 720]);
  objects.push([OBJ.BOSS_ALTAR, 2050, 4550, 520, 520, "corrupted"]);
  objects.push([OBJ.CAMPFIRE, 1620, 4480, 50, 50]);
  objects.push([OBJ.CAMPFIRE, 2480, 4480, 50, 50]);

  // 5) 숲 나무 및 바위 배치 (주요 거점 및 길목 보호)
  for (let i = 0; i < 440; i++) {
    let tx = 120 + (Math.abs(Math.sin(i * 23.17) * 81273.5) % (w - 240));
    let ty = 280 + (Math.abs(Math.cos(i * 41.89) * 54329.1) % (h - 560));

    if (Math.hypot(tx - 2020, ty - 13400) < 980) continue; // 페어리 캠프 보호
    if (Math.hypot(tx - 1580, ty - 14120) < 420) continue; // 페어리 연못 보호
    if (Math.hypot(tx - 950, ty - 9080) < 750) continue;   // 은빛 덩굴숲 중심 보호
    if (Math.hypot(tx - 3000, ty - 8850) < 820) continue;  // 버려진 벌목장 보호
    if (Math.hypot(tx - 2050, ty - 4400) < 1050) continue; // 타락한 세계수 앞마당 보호
    if (tx > 950 && tx < 3050 && (i % 3 !== 0)) continue;  // 중앙 이동 동선 확보

    let size = 90 + (i % 5) * 22;
    let tType = (ty < 5200 || i % 3 === 0) ? OBJ.PINE_TREE : OBJ.OAK_TREE;
    objects.push([tType, tx, ty, size, size]);
  }

  for (let i = 0; i < 95; i++) {
    let rx = 140 + (Math.abs(Math.sin(i * 67.3) * 32145.6) % (w - 280));
    let ry = 350 + (Math.abs(Math.cos(i * 31.9) * 76543.2) % (h - 700));
    if (Math.hypot(rx - 2020, ry - 13400) < 980) continue;
    if (Math.hypot(rx - 950, ry - 9080) < 750) continue;
    if (Math.hypot(rx - 3000, ry - 8850) < 820) continue;
    if (Math.hypot(rx - 2050, ry - 4400) < 1050) continue;
    if (rx > 1200 && rx < 2800) continue;
    objects.push([OBJ.ROCK, rx, ry, 65 + (i % 4) * 18, 65]);
  }

  const silvervineMapData = {
    regionId: "R02",
    width: w,
    height: h,
    isSeamlessRegion: true,
    isDungeon: false,
    bgColor: "#2d6a4f",
    pathColor: "rgba(0,0,0,0)",
    direction: "N",
    isMaze: false,
    objects: objects,
    extraWallBoxes: (() => {
      const boxes = [];
      const streamSegs = [
        [850, 4800, 980, 6000],
        [980, 6000, 1220, 7200],
        [1220, 7200, 1050, 8400],
        [1050, 8400, 1320, 9500],
        [1320, 9500, 1100, 10700],
        [1100, 10700, 580, 11800],
        [580, 11800, 0, 12700]
      ];
      streamSegs.forEach(([x1, y1, x2, y2]) => {
        const steps = 10;
        for (let s = 0; s < steps; s++) {
          const t = (s + 0.5) / steps;
          const sx = Math.round(x1 + (x2 - x1) * t);
          const sy = Math.round(y1 + (y2 - y1) * t);
          // 통나무 다리(1120,6650 / 1210,9650) 및 주요 오솔길 교차로 개방
          if (Math.hypot(sx - 1120, sy - 6650) < 220) continue;
          if (Math.hypot(sx - 1210, sy - 9650) < 240) continue;
          if (Math.hypot(sx - 1150, sy - 7800) < 210) continue;
          if (Math.hypot(sx - 1020, sy - 11100) < 210) continue;
          boxes.push({ x: sx - 55, y: sy - 55, width: 110, height: 110 });
        }
      });
      // 동쪽 벌목장 물레방아 수로 (오솔길 동선 우측 외곽)
      [[3250, 7250], [3480, 8550], [3780, 8820]].forEach(([mx, my]) => {
        boxes.push({ x: mx - 65, y: my - 65, width: 130, height: 130 });
      });
      return boxes;
    })(),
    spawn: { x: 2020, y: 13400 },
    fieldPos: { x: 1420, y: 9520 },
    dungeonEntrance: { x: 3000, y: 9120 },
    bossPos: { x: 2050, y: 4550 },
    bossWarpPos: { x: 2050, y: 5150 },
    warpSafeZones: [
      { x: 2020, y: 13400, radius: 780, type: "town" },
      { x: 1420, y: 9520,  radius: 420, type: "field" },
      { x: 3000, y: 9120,  radius: 420, type: "dungeon_entrance" },
      { x: 2050, y: 5150,  radius: 420, type: "boss_camp" }
    ],
    title: "실버바인 (Silvervine) - 요정의 야영지(S1)",
    landmarks: [
      { name: "요정의 야영지(S1)", x: 2020, y: 13400, type: "town", desc: "야영지 안전지대" },
      { name: "은빛 덩굴숲", x: 1420, y: 9520, type: "field", desc: "권장 Lv.20~28 (안전진입)" },
      { name: "버려진 벌목장", x: 3000, y: 9120, type: "dungeon_entrance", desc: "벌목장 입구 (안전진입)" },
      { name: "타락한 세계수 [보스(B)]", x: 2050, y: 5150, type: "boss_camp", desc: "세계수 입구 (안전진입)" }
    ]
  };

  HardcodedMapDB["R02_sub1"] = silvervineMapData;
  HardcodedMapDB["R02_sub2"] = silvervineMapData;
  HardcodedMapDB["R02_sub4"] = silvervineMapData;
}

// [3] R05 모라안 (Moraan) 4000x16000 (Moraan.jpg & Moraan.tmj 완벽 구현)
function buildMoraanSeamlessMap() {
  const w = 4000;
  const h = 16000;
  let objects = [];

  // 1) 남동부: 오아시스야영지(S1) (Oasis Camp, 중심: 2350, 13650 / 호수: 2350, 12550)
  objects.push([OBJ.CAMPFIRE, 2350, 13820, 50, 50]);
  objects.push([OBJ.DESERT_TENT, 1860, 13350, 210, 165]);
  objects.push([OBJ.DESERT_TENT, 1820, 13850, 210, 165]);
  objects.push([OBJ.CARAVAN_WAGON, 1980, 14220, 220, 150]);
  objects.push([OBJ.DESERT_TENT, 2840, 13400, 210, 165]);
  objects.push([OBJ.DESERT_TENT, 2820, 13920, 210, 165]);
  objects.push([OBJ.DESERT_TENT, 2580, 14220, 200, 155]);

  const oasisPalms = [
    [1680, 12450], [1850, 12150], [2350, 12050], [2850, 12180], [3020, 12550],
    [1650, 13050], [3050, 13050], [1620, 13650], [3080, 13650], [2200, 14380], [2850, 14350]
  ];
  oasisPalms.forEach(([px, py]) => objects.push([OBJ.PALM_TREE, px, py, 135, 135]));

  // 2) 중서부: 작열하는 모래언덕 (Burning Sand Dunes, 중심: 1150, 9200)
  objects.push([OBJ.SUNKEN_RUINS, 820, 8820, 280, 220]);
  objects.push([OBJ.SUNKEN_RUINS, 1620, 8950, 260, 200]);
  objects.push([OBJ.BROKEN_PILLAR, 920, 9450, 110, 110]);
  objects.push([OBJ.ANCIENT_PILLAR, 1480, 8650, 110, 110]);
  objects.push([OBJ.CACTUS, 620, 9250, 95, 95]);
  objects.push([OBJ.CACTUS, 1680, 9480, 95, 95]);

  // 3) 북서부: 개미지옥 둥지 (Ant Hell Nest, 중심: 1050, 4150 / 포탈: 1050, 3920)
  objects.push([OBJ.ANT_HELL_CRATER, 1050, 3300, 880, 620]);
  objects.push([OBJ.PORTAL, 1050, 3920, 160, 160, "TO_MORAAN_DUNGEON"]);
  objects.push([OBJ.ROCK, 580, 3750, 110, 110]);
  objects.push([OBJ.ROCK, 1520, 3750, 110, 110]);

  // 4) 북동부: 고대 파라오 무덤 (Ancient Pharaoh Tomb [Boss(B)], 보스: 2950, 5300 / 워프: 2950, 5650)
  objects.push([OBJ.PHARAOH_PYRAMID, 2950, 4420, 920, 680]);
  objects.push([OBJ.OBELISK, 2420, 4980, 120, 280]);
  objects.push([OBJ.OBELISK, 3480, 4980, 120, 280]);
  objects.push([OBJ.BOSS_ALTAR, 2950, 5300, 520, 520, "desert"]);
  objects.push([OBJ.CAMPFIRE, 2480, 5450, 55, 55]);
  objects.push([OBJ.CAMPFIRE, 3420, 5450, 55, 55]);
  objects.push([OBJ.ANCIENT_PILLAR, 2620, 5780, 100, 100]);
  objects.push([OBJ.ANCIENT_PILLAR, 3280, 5780, 100, 100]);

  // 5) 사막 선인장 & 바위 배치
  for (let i = 0; i < 190; i++) {
    let cx = 140 + (Math.abs(Math.sin(i * 29.41) * 76123.4) % (w - 280));
    let cy = 350 + (Math.abs(Math.cos(i * 53.19) * 43218.9) % (h - 700));

    if (Math.hypot(cx - 2350, cy - 13300) < 1200) continue; // 오아시스 보호
    if (Math.hypot(cx - 1150, cy - 9200) < 750) continue;   // 모래언덕 유적 보호
    if (Math.hypot(cx - 1050, cy - 3650) < 880) continue;   // 개미지옥 보호
    if (Math.hypot(cx - 2950, cy - 5150) < 1050) continue;  // 파라오 무덤 보호

    if (i % 2 === 0) {
      objects.push([OBJ.CACTUS, cx, cy, 80 + (i % 3) * 15, 85]);
    } else {
      objects.push([OBJ.ROCK, cx, cy, 70 + (i % 4) * 20, 70]);
    }
  }

  const moraanMapData = {
    regionId: "R05",
    width: w,
    height: h,
    isSeamlessRegion: true,
    isDungeon: false,
    bgColor: "#e0a458",
    pathColor: "rgba(0,0,0,0)",
    direction: "N",
    isMaze: false,
    objects: objects,
    // 오아시스 호수 수면 충돌박스 (호수 남쪽 캠프 광장 2350,13650은 완전히 열려 있음)
    extraWallBoxes: [
      { x: 1920, y: 12320, width: 860, height: 460 }
    ],
    spawn: { x: 2350, y: 13650 },
    fieldPos: { x: 1680, y: 9550 },
    dungeonEntrance: { x: 1050, y: 4050 },
    bossPos: { x: 2950, y: 5300 },
    bossWarpPos: { x: 2950, y: 5880 },
    warpSafeZones: [
      { x: 2350, y: 13650, radius: 780, type: "town" },
      { x: 1680, y: 9550,  radius: 420, type: "field" },
      { x: 1050, y: 4050,  radius: 420, type: "dungeon_entrance" },
      { x: 2950, y: 5880,  radius: 420, type: "boss_camp" }
    ],
    title: "모라안 (Moraan) - 오아시스야영지(S1)",
    landmarks: [
      { name: "오아시스야영지(S1)", x: 2350, y: 13650, type: "town", desc: "야영지 안전지대" },
      { name: "작열하는 모래언덕", x: 1680, y: 9550, type: "field", desc: "권장 Lv.65~73 (안전진입)" },
      { name: "개미지옥 둥지", x: 1050, y: 4050, type: "dungeon_entrance", desc: "개미지옥 입구 (안전진입)" },
      { name: "고대 파라오 무덤 [보스(B)]", x: 2950, y: 5880, type: "boss_camp", desc: "무덤 입구 (안전진입)" }
    ]
  };

  HardcodedMapDB["R05_sub1"] = moraanMapData;
  HardcodedMapDB["R05_sub2"] = moraanMapData;
  HardcodedMapDB["R05_sub4"] = moraanMapData;
}

// [4] R07 발레노스 (Balenos) 4000x16000 (Balenos.jpg 완벽 구현)
function buildBalenosSeamlessMap() {
  const w = 4000;
  const h = 16000;
  let objects = [];

  // 1) 남서부: 항구도시 발레노스(S) (Balenos.tmj id=1 중심: 1080, 12150)
  objects.push([OBJ.CAMPFIRE, 1080, 12310, 50, 50]);
  objects.push([OBJ.HARBOR_HOUSE, 520, 11580, 260, 220, "blue"]);
  objects.push([OBJ.HARBOR_HOUSE, 420, 12080, 250, 220, "red"]);
  objects.push([OBJ.HARBOR_HOUSE, 540, 12620, 260, 220, "blue"]);
  objects.push([OBJ.HARBOR_HOUSE, 760, 13250, 250, 210, "red"]);
  objects.push([OBJ.HARBOR_HOUSE, 480, 13780, 250, 210, "blue"]);

  objects.push([OBJ.CARGO_CRATES, 780, 11720, 110, 95]);
  objects.push([OBJ.CARGO_CRATES, 1480, 11680, 110, 95]);
  objects.push([OBJ.CARGO_CRATES, 1520, 12450, 110, 95]);
  objects.push([OBJ.CARGO_CRATES, 1120, 13050, 110, 95]);

  // 선착장 정박 범선 3척 (Balenos.jpg 좌하단 범선 배치 일치)
  objects.push([OBJ.HARBOR_SHIP, 1860, 10420, 320, 260]);
  objects.push([OBJ.HARBOR_SHIP, 1820, 12820, 320, 260]);
  objects.push([OBJ.HARBOR_SHIP, 1620, 13850, 340, 270]);

  // 2) 남동부: 검은 모래 해변 (Balenos.tmj id=2 중심: 3250, 12300)
  objects.push([OBJ.ANCHOR_WRECK, 2680, 13200, 140, 140]);
  objects.push([OBJ.ANCHOR_WRECK, 2580, 10850, 130, 130]);
  objects.push([OBJ.CARGO_CRATES, 3580, 12850, 120, 100]);
  objects.push([OBJ.CARGO_CRATES, 3450, 11250, 120, 100]);
  objects.push([OBJ.ROCK, 3620, 11650, 130, 130]);
  objects.push([OBJ.ROCK, 3520, 10200, 140, 140]);
  objects.push([OBJ.OAK_TREE, 3720, 12350, 110, 110]);
  objects.push([OBJ.OAK_TREE, 3550, 13400, 115, 115]);

  // 3) 중앙: 난파선 무덤 (Balenos.tmj id=3 중심: 1900, 7680 / 포탈: 1900, 7450)
  objects.push([OBJ.SHIPWRECK, 1520, 7020, 440, 340, -1]);
  objects.push([OBJ.SHIPWRECK, 2320, 7180, 440, 340, 1]);
  objects.push([OBJ.PORTAL, 1900, 7450, 160, 160, "TO_BALENOS_DUNGEON"]);
  objects.push([OBJ.SEA_STACK, 1120, 7350, 150, 150]);
  objects.push([OBJ.SEA_STACK, 1380, 8150, 130, 130]);
  objects.push([OBJ.SEA_STACK, 2720, 7750, 145, 145]);
  objects.push([OBJ.SEA_STACK, 2150, 6650, 160, 160]);

  // 4) 북부: 해적선장의 오두막 (Balenos.tmj id=4 중심: 2720, 3780 / 보스: 2720, 3500)
  objects.push([OBJ.PIRATE_CABIN, 2720, 2650, 920, 660]);
  objects.push([OBJ.BOSS_ALTAR, 2720, 3500, 520, 520, "pirate"]);
  objects.push([OBJ.CAMPFIRE, 2320, 3350, 50, 50]);
  objects.push([OBJ.CAMPFIRE, 2720, 3220, 55, 55]);
  objects.push([OBJ.CAMPFIRE, 3120, 3350, 50, 50]);
  objects.push([OBJ.CARGO_CRATES, 2220, 3050, 115, 100]);
  objects.push([OBJ.CARGO_CRATES, 3180, 3050, 115, 100]);

  const cliffTrees = [
    [1750, 2550], [1920, 2380], [3480, 2650], [3580, 3450], [3420, 4150],
    [320, 10350], [480, 10220]
  ];
  cliffTrees.forEach(([tx, ty]) => objects.push([OBJ.OAK_TREE, tx, ty, 115, 115]));

  const seaRocks = [
    [650, 4500, 160], [850, 5800, 140], [520, 7500, 170],
    [1050, 3400, 150], [450, 15100, 160], [1850, 15200, 140]
  ];
  seaRocks.forEach(([rx, ry, rs]) => objects.push([OBJ.SEA_STACK, rx, ry, rs, rs]));

  const balenosMapData = {
    regionId: "R07",
    width: w,
    height: h,
    isSeamlessRegion: true,
    isDungeon: false,
    bgColor: "#124e6b",
    pathColor: "rgba(0,0,0,0)",
    direction: "N",
    isMaze: false,
    objects: objects,
    // 깊은 바다 수면 및 동쪽 화산 절벽 충돌박스 (항구 광장, 해상 교량, 암초 나무다리, 검은 모래 해변, 해적 요새 길목은 개방)
    extraWallBoxes: [
      // 서북부 외해 (X: 0~1180, Y: 0~9850)
      { x: 0, y: 0, width: 1180, height: 9850 },
      // 최북단 해안 절벽 위쪽 바다
      { x: 1180, y: 0, width: 2820, height: 920 },
      // 해적 요새 절벽과 난파선 무덤 사이 서쪽 바다 (X: 1180~2520, Y: 4850~6750)
      { x: 1180, y: 4850, width: 1340, height: 1900 },
      // 난파선 무덤과 포트 발레노스 사이 바다 (암초 나무다리 X:1380~1920 구간 제외)
      { x: 0, y: 8650, width: 1320, height: 1250 },
      { x: 1980, y: 8650, width: 480, height: 1450 },
      // 포트 발레노스(서)와 검은 모래 해변(동) 사이 중앙 해협 바다 — 해상 교량(Y: 11710~11990) 위/아래 수면 차단!
      { x: 1960, y: 10100, width: 440, height: 1590 },
      { x: 1960, y: 12010, width: 440, height: 1380 },
      // 포트 발레노스 남동쪽 만(Bay) 바다 (X: 1560~2620, Y: 13390~14700)
      { x: 1560, y: 13390, width: 1060, height: 1310 },
      // 동쪽 화산 용암 절벽 (X: 3560~4000, Y: 8600~12000)
      { x: 3560, y: 8600, width: 440, height: 3400 },
      // 최남단 심해 (Y: 14650~16000)
      { x: 0, y: 14650, width: 4000, height: 1350 }
    ],
    spawn: { x: 1080, y: 12150 },
    fieldPos: { x: 2680, y: 12150 },
    dungeonEntrance: { x: 1900, y: 7620 },
    bossPos: { x: 2720, y: 3500 },
    bossWarpPos: { x: 2720, y: 4080 },
    warpSafeZones: [
      { x: 1080, y: 12150, radius: 780, type: "town" },
      { x: 2680, y: 12150, radius: 420, type: "field" },
      { x: 1900, y: 7620,  radius: 420, type: "dungeon_entrance" },
      { x: 2720, y: 4080,  radius: 420, type: "boss_camp" }
    ],
    title: "발레노스 (Balenos) - 항구도시 발레노스(S)",
    landmarks: [
      { name: "항구도시 발레노스(S)", x: 1080, y: 12150, type: "town", desc: "항구 안전지대" },
      { name: "검은 모래 해변", x: 2680, y: 12150, type: "field", desc: "권장 Lv.95~103 (안전진입)" },
      { name: "난파선 무덤", x: 1900, y: 7620, type: "dungeon_entrance", desc: "난파선 입구 (안전진입)" },
      { name: "해적선장의 선실 [보스(B)]", x: 2720, y: 4080, type: "boss_camp", desc: "선실 입구 (안전진입)" }
    ]
  };

  HardcodedMapDB["R07_sub1"] = balenosMapData;
  HardcodedMapDB["R07_sub2"] = balenosMapData;
  HardcodedMapDB["R07_sub4"] = balenosMapData;
}

// ============================================================================
// 🏰 각 지역 미로 던전 생성기 (R01, R02, R05, R07)
// ============================================================================
function buildRegionMazeDungeon(mapKey, exitTarget, title, bgColor) {
  const w = 3000;
  const h = 3000;
  let objects = [];

  objects.push([OBJ.WALL, 0, 0, w, 90]);
  objects.push([OBJ.WALL, 0, h - 90, w, 90]);
  objects.push([OBJ.WALL, 0, 0, 90, h]);
  objects.push([OBJ.WALL, w - 90, 0, 90, h]);

  const cellSize = 360;
  for (let y = cellSize; y < h - cellSize; y += cellSize) {
    for (let x = cellSize; x < w - cellSize; x += cellSize) {
      if (Math.hypot(x - 1500, y - 2650) < 420) continue;
      if (Math.hypot(x - 1500, y - 1500) < 380) continue;

      let seed = Math.sin(x * 0.013 + y * 0.029);
      if (seed > 0.15) {
        objects.push([OBJ.WALL, x - 140, y, 280, 75]);
      } else if (seed < -0.15) {
        objects.push([OBJ.WALL, x, y - 140, 75, 280]);
      }
    }
  }

  const torches = [
    [1500, 2450], [1100, 2100], [1900, 2100],
    [900, 1500], [1500, 1500], [2100, 1500],
    [1100, 900], [1900, 900], [1500, 600]
  ];
  torches.forEach(([tx, ty]) => {
    objects.push([OBJ.CAMPFIRE, tx, ty, 40, 40]);
  });

  for (let i = 0; i < 45; i++) {
    let rx = 200 + (Math.abs(Math.sin(i * 51.7) * 33211) % (w - 400));
    let ry = 200 + (Math.abs(Math.cos(i * 83.2) * 77411) % (h - 400));
    if (Math.hypot(rx - 1500, ry - 2680) < 350) continue;
    objects.push([OBJ.ROCK, rx, ry, 65, 65]);
  }

  objects.push([OBJ.PORTAL, 1500, 2760, 150, 150, exitTarget]);

  const regionPrefix = mapKey.split('_')[0];
  HardcodedMapDB[mapKey] = {
    regionId: regionPrefix,
    width: w,
    height: h,
    isSeamlessRegion: false,
    isDungeon: true,
    bgColor: bgColor,
    pathColor: "rgba(0,0,0,0.35)",
    direction: "N",
    isMaze: true,
    objects: objects,
    spawn: { x: 1500, y: 2580 },
    title: title
  };
  HardcodedMapDB[`${regionPrefix}_sub3`] = HardcodedMapDB[mapKey];
}

function buildGenericSeamlessRegionMap(reg, cfg) {
  const w = 4000;
  const h = 16000;
  let objects = [];

  const [tx, ty] = cfg.town;
  const [fx, fy] = cfg.field;
  const [dx, dy] = cfg.dungeon;
  const [bx, by] = cfg.boss;

  // 1) 안전지대 마을/야영지 (5대 NPC 주변 건물 & 모닥불 배치)
  objects.push([OBJ.CAMPFIRE, tx, ty + 150, 50, 50]);
  objects.push([cfg.townObj, tx - 480, ty - 260, 260, 220, "straw"]);
  objects.push([cfg.townObj, tx + 480, ty - 260, 260, 220, "wood"]);
  objects.push([cfg.townObj, tx - 520, ty + 240, 260, 220, "wood"]);
  objects.push([cfg.townObj, tx + 520, ty + 240, 260, 220, "straw"]);
  if (cfg.townExtraObj) {
    objects.push([cfg.townExtraObj, tx, ty - 520, 320, 260]);
  }

  // 2) 중부 필드 사냥터 (sub2) 랜드마크 배치
  objects.push([cfg.fieldObj, fx - 320, fy - 240, 240, 220]);
  objects.push([cfg.fieldObj, fx + 340, fy - 180, 240, 220]);
  objects.push([cfg.fieldObj, fx - 260, fy + 280, 220, 200]);
  objects.push([OBJ.CAMPFIRE, fx, fy + 120, 45, 45]);

  // 3) 던전 입구 (sub3) 랜드마크 & 입장 포탈 배치
  objects.push([cfg.dungeonObj, dx, dy - 520, 740, 480, "dungeon"]);
  objects.push([OBJ.PORTAL, dx, dy - 220, 160, 160, `TO_${reg.id}_DUNGEON`]);
  objects.push([OBJ.CAMPFIRE, dx - 280, dy - 220, 45, 45]);
  objects.push([OBJ.CAMPFIRE, dx + 280, dy - 220, 45, 45]);

  // 4) 보스 성역 (sub4) 랜드마크 & 보스 제단 배치
  objects.push([cfg.bossObj, bx, by - 950, 880, 620]);
  objects.push([OBJ.BOSS_ALTAR, bx, by - 340, 520, 520, reg.theme]);
  objects.push([OBJ.CAMPFIRE, bx - 340, by - 340, 50, 50]);
  objects.push([OBJ.CAMPFIRE, bx + 340, by - 340, 50, 50]);

  // 5) 배경 식생/바위/크리스탈 배치 (주요 거점 반경 950px 보호)
  for (let i = 0; i < 320; i++) {
    let ox = 140 + (Math.abs(Math.sin(i * 29.17) * 81273.5) % (w - 280));
    let oy = 320 + (Math.abs(Math.cos(i * 47.89) * 54329.1) % (h - 640));

    if (Math.hypot(ox - tx, oy - ty) < 980) continue;
    if (Math.hypot(ox - fx, oy - fy) < 780) continue;
    if (Math.hypot(ox - dx, oy - dy) < 880) continue;
    if (Math.hypot(ox - bx, oy - (by - 340)) < 1020) continue;
    if (ox > 1100 && ox < 2900 && (i % 3 !== 0)) continue;

    let size = 85 + (i % 4) * 20;
    let tType = i % 2 === 0 ? cfg.prop1 : cfg.prop2;
    objects.push([tType, ox, oy, size, size]);
  }

  const mapData = {
    regionId: reg.id,
    width: w,
    height: h,
    isSeamlessRegion: true,
    isDungeon: false,
    bgColor: cfg.bgColor,
    pathColor: "rgba(0,0,0,0)",
    direction: "N",
    isMaze: false,
    objects: objects,
    extraWallBoxes: [],
    spawn: { x: tx, y: ty },
    fieldPos: { x: fx, y: fy + 480 },
    fieldCenterPos: { x: fx, y: fy },
    dungeonEntrance: { x: dx, y: dy },
    bossPos: { x: bx, y: by - 340 },
    bossWarpPos: { x: bx, y: by + 220 },
    warpSafeZones: [
      { x: tx, y: ty, radius: 780, type: "town" },
      { x: fx, y: fy + 480, radius: 420, type: "field" },
      { x: dx, y: dy, radius: 420, type: "dungeon_entrance" },
      { x: bx, y: by + 220, radius: 420, type: "boss_camp" }
    ],
    title: `${reg.name} (${reg.eng}) - ${reg.sub1}`,
    landmarks: [
      { name: reg.sub1, x: tx, y: ty, type: "town", desc: "안전지대 복귀" },
      { name: reg.sub2, x: fx, y: fy + 480, type: "field", desc: `권장 ${reg.lvRange} (안전진입)` },
      { name: reg.sub3, x: dx, y: dy, type: "dungeon_entrance", desc: "던전 입구 (안전진입)" },
      { name: `${reg.sub4} [보스(B)]`, x: bx, y: by + 220, type: "boss_camp", desc: "보스 성역 입구 (안전진입)" }
    ]
  };

  HardcodedMapDB[`${reg.id}_sub1`] = mapData;
  HardcodedMapDB[`${reg.id}_sub2`] = mapData;
  HardcodedMapDB[`${reg.id}_sub4`] = mapData;
}

export function initAllMaps(regions) {
  buildAltriaSeamlessMap();
  buildSilvervineSeamlessMap();
  buildMoraanSeamlessMap();
  buildBalenosSeamlessMap();

  const EXTENDED_REGION_CONFIGS = {
    R03: {
      town: [2215, 13580], field: [1180, 9415], dungeon: [3290, 8960], boss: [2515, 3380],
      townObj: OBJ.VILLAGE_HOUSE, townExtraObj: OBJ.FORTRESS_WALL, fieldObj: OBJ.CAMP_TENT,
      dungeonObj: OBJ.MINE_ENTRANCE, bossObj: OBJ.RUNE_ALTAR, prop1: OBJ.ROCK, prop2: OBJ.DEAD_TREE,
      bgColor: "#8c3f1b", dungBg: "#271710"
    },
    R04: {
      town: [3080, 5345], field: [995, 12980], dungeon: [3005, 10925], boss: [980, 5240],
      townObj: OBJ.ELVEN_ARCH, townExtraObj: OBJ.GLOW_TREE, fieldObj: OBJ.GLOW_TREE,
      dungeonObj: OBJ.SUNKEN_TEMPLE, bossObj: OBJ.WATER_THRONE, prop1: OBJ.GLOW_TREE, prop2: OBJ.ANCIENT_PILLAR,
      bgColor: "#0284c7", dungBg: "#082f49"
    },
    R06: {
      town: [2335, 13730], field: [1220, 9580], dungeon: [3100, 6095], boss: [1165, 4185],
      townObj: OBJ.SWAMP_TENT, townExtraObj: null, fieldObj: OBJ.GIANT_MUSHROOM,
      dungeonObj: OBJ.BEAST_DEN, bossObj: OBJ.TOXIC_ALTAR, prop1: OBJ.PINE_TREE, prop2: OBJ.GIANT_MUSHROOM,
      bgColor: "#4c1d24", dungBg: "#261019"
    },
    R08: {
      town: [2710, 13020], field: [1070, 8785], dungeon: [1215, 4550], boss: [3155, 4290],
      townObj: OBJ.ICE_IGLOO, townExtraObj: OBJ.VILLAGE_HOUSE, fieldObj: OBJ.ICE_SPIRE,
      dungeonObj: OBJ.CRYSTAL_CAVE, bossObj: OBJ.FROST_THRONE, prop1: OBJ.PINE_TREE, prop2: OBJ.ICE_SPIRE,
      bgColor: "#e2e8f0", dungBg: "#0f2942"
    },
    R09: {
      town: [1360, 13590], field: [2235, 10420], dungeon: [2070, 6595], boss: [2605, 3215],
      townObj: OBJ.DESERT_TENT, townExtraObj: OBJ.FORTRESS_WALL, fieldObj: OBJ.ROCK,
      dungeonObj: OBJ.VOLCANO_CONE, bossObj: OBJ.DEMON_CRATER, prop1: OBJ.ROCK, prop2: OBJ.BROKEN_PILLAR,
      bgColor: "#291510", dungBg: "#260b08"
    },
    R10: {
      town: [1310, 13320], field: [1215, 8945], dungeon: [3155, 6365], boss: [1220, 4540],
      townObj: OBJ.RAVEN_TENT, townExtraObj: null, fieldObj: OBJ.GIANT_MUSHROOM,
      dungeonObj: OBJ.UNDEAD_CRYPT, bossObj: OBJ.LICH_CASTLE, prop1: OBJ.PINE_TREE, prop2: OBJ.BROKEN_PILLAR,
      bgColor: "#2d2640", dungBg: "#161426"
    },
    R11: {
      town: [2720, 13685], field: [950, 8855], dungeon: [2965, 6585], boss: [1680, 4045],
      townObj: OBJ.VILLAGE_HOUSE, townExtraObj: OBJ.WINDMILL, fieldObj: OBJ.ROCK,
      dungeonObj: OBJ.HARPY_NEST, bossObj: OBJ.STORMBIRD_ALTAR, prop1: OBJ.PINE_TREE, prop2: OBJ.ROCK,
      bgColor: "#93c5fd", dungBg: "#1e293b"
    },
    R12: {
      town: [1225, 5135], field: [2965, 7965], dungeon: [1220, 10255], boss: [2800, 12980],
      townObj: OBJ.FAIRY_TENT, townExtraObj: OBJ.MANA_CRYSTAL, fieldObj: OBJ.ANCIENT_PILLAR,
      dungeonObj: OBJ.ARCANE_AIRSHIP, bossObj: OBJ.TITAN_DOME, prop1: OBJ.MANA_CRYSTAL, prop2: OBJ.ANCIENT_PILLAR,
      bgColor: "#1d4ed8", dungBg: "#172554"
    },
    R13: {
      town: [3100, 12165], field: [990, 9745], dungeon: [3010, 6805], boss: [1085, 4140],
      townObj: OBJ.CAMP_TENT, townExtraObj: OBJ.FORTRESS_WALL, fieldObj: OBJ.GIANT_RIBCAGE,
      dungeonObj: OBJ.TORTURE_FORTRESS, bossObj: OBJ.NETHER_PORTAL, prop1: OBJ.ROCK, prop2: OBJ.GIANT_RIBCAGE,
      bgColor: "#450a0a", dungBg: "#240606"
    },
    R14: {
      town: [2080, 13345], field: [1020, 8630], dungeon: [3100, 8130], boss: [2445, 3755],
      townObj: OBJ.VILLAGE_HOUSE, townExtraObj: OBJ.FORTRESS_WALL, fieldObj: OBJ.TRAINING_RUINS,
      dungeonObj: OBJ.DRAKE_NEST, bossObj: OBJ.DRAGON_LAIR, prop1: OBJ.ROCK, prop2: OBJ.GIANT_RIBCAGE,
      bgColor: "#2e1f18", dungBg: "#21120c"
    },
    R15: {
      town: [2100, 13285], field: [1085, 8410], dungeon: [3105, 8540], boss: [2120, 3660],
      townObj: OBJ.FAIRY_TENT, townExtraObj: OBJ.RIFT_GATE, fieldObj: OBJ.ANCIENT_PILLAR,
      dungeonObj: OBJ.ABYSS_CRYSTAL, bossObj: OBJ.KAELEN_THRONE, prop1: OBJ.ABYSS_CRYSTAL, prop2: OBJ.BROKEN_PILLAR,
      bgColor: "#1e1b4b", dungBg: "#0d061a"
    }
  };

  buildRegionMazeDungeon("R01_dungeon", "EXIT_TO_ALTRIA", "고블린 동굴 (미로 던전 - 미니맵 이동 불가)", "#1e1b18");
  buildRegionMazeDungeon("R02_dungeon", "EXIT_TO_SILVERVINE", "버려진 벌목장 심층부 (미로 던전 - 미니맵 이동 불가)", "#1a241b");
  buildRegionMazeDungeon("R05_dungeon", "EXIT_TO_MORAAN", "개미지옥 둥지 심층부 (미로 던전 - 미니맵 이동 불가)", "#2e1d0f");
  buildRegionMazeDungeon("R07_dungeon", "EXIT_TO_BALENOS", "난파선 무덤 심연 선실 (미로 던전 - 미니맵 이동 불가)", "#0f1e29");

  regions.forEach((region) => {
    if (["R01", "R02", "R05", "R07"].includes(region.id)) return;
    const cfg = EXTENDED_REGION_CONFIGS[region.id];
    if (cfg) {
      buildGenericSeamlessRegionMap(region, cfg);
      buildRegionMazeDungeon(
        `${region.id}_dungeon`,
        `EXIT_TO_${region.id}`,
        `${region.sub3} 심층부 (미로 던전 - 미니맵 이동 불가)`,
        cfg.dungBg
      );
    }
  });
}