// js/game_05_loop.js — 용병 AI 루프 · 메인 게임루프(gameLoop) · 필드 네임택/배지 · 미니맵
// ============================================================================
// 🧠 용병 스마트 전투 & 힐/물약/마나관리 AI 루프 (사용자 요청 규칙 100% 반영)
// ============================================================================
// 충돌체 막힘 시 열린 우회 방향을 탐색하는 스마트 조향 헬퍼 (플레이어 & 용병 공통)
function findOpenSteerPoint(curX, curY, baseAngle, stepDist, disallowSafeZone = true, selfEntity = player) {
  const targetMobRef = (selfEntity === player && player.targetEntity?.type === 'MONSTER') ? player.targetEntity.ref : null;
  const candidateOffsets = [0, 0.42, -0.42, 0.85, -0.85, 1.32, -1.32, 1.85, -1.85, 2.38, -2.38, Math.PI];
  for (const off of candidateOffsets) {
    const ang = baseAngle + off;
    const tx = curX + Math.cos(ang) * stepDist;
    const ty = curY + Math.sin(ang) * stepDist;
    if (
      !checkCollision(tx, ty) &&
      (!disallowSafeZone || !isInsideSafeZone(tx, ty)) &&
      !checkUnitCollision(tx, ty, selfEntity, targetMobRef)
    ) {
      return { x: tx, y: ty, angle: ang, offset: off };
    }
  }
  // 만약 모든 방향이 유닛에 막혔다면 지형 충돌만 통과하는 탈출구를 허용
  for (const off of candidateOffsets) {
    const ang = baseAngle + off;
    const tx = curX + Math.cos(ang) * stepDist;
    const ty = curY + Math.sin(ang) * stepDist;
    if (!checkCollision(tx, ty) && (!disallowSafeZone || !isInsideSafeZone(tx, ty))) {
      return { x: tx, y: ty, angle: ang, offset: off };
    }
  }
  return null;
}

// ============================================================================
// 🧠 용병 스마트 전투 & 원형 카이팅·피격 반격·충돌체 탈출 AI 루프
// ============================================================================
function updateMercenaryAI(delta, now, inSafe) {
  if (!mercenary.hired || mercenary.isDead) return;

  Object.keys(mercenary.activeBuffs).forEach(k => {
    if (mercenary.activeBuffs[k] > 0) {
      mercenary.activeBuffs[k] = Math.max(0, mercenary.activeBuffs[k] - (delta / 60) * 1000);
    }
  });

  const playerTargetMob = (player.targetEntity && player.targetEntity.type === 'MONSTER' && !player.targetEntity.ref.isDead) ? player.targetEntity.ref : null;
  const nearbyBoss = monsterList.find(m => !m.isDead && m.isBoss && Math.hypot(m.x - player.x, m.y - player.y) <= 480);
  const isBossFight = Boolean((playerTargetMob && playerTargetMob.isBoss) || nearbyBoss);

  const unlockedSkills = getMercUnlockedSkills(mercenary.class, mercenary.level);
  const ms = calculateMercCombatStats();
  const hpRatio = mercenary.hp / Math.max(1, mercenary.maxHp);
  const mpRatio = mercenary.mp / Math.max(1, mercenary.maxMp);

  const autoPotCfg = GameDB.SystemConfig?.autoPotion || {};
  const mercHpThresh = autoPotCfg.mercHpRatioThreshold ?? 0.72;
  const mercMpThresh = autoPotCfg.mercMpRatioThreshold ?? 0.25;

  // 1) 용병 마나 물약 우선 복용
  const mpPotIdx = mercenary.inventory.findIndex(it => it && window.itemDict[it.type]?.healMp > 0 && it.qty > 0);
  if (mpRatio <= mercMpThresh && mpPotIdx > -1) {
    const potDef = window.itemDict[mercenary.inventory[mpPotIdx].type];
    const mercMpCoolMs = (typeof potDef?.cool === 'number' ? potDef.cool : 0.5) * 1000;
    if (now - mercenary.lastMpPotionTime >= mercMpCoolMs) {
      useMercPotionIndex(mpPotIdx);
    }
  }

  // 2) 마나 10% 미만 판단 (10% 미만이면 힐 대기 + 몬스터 회피기동, 10% 이상 회복 즉시 정상 복귀!)
  const curMpRatioNow = mercenary.mp / Math.max(1, mercenary.maxMp);
  if (curMpRatioNow < 0.10) {
    mercenary.manaRechargeWait = true;
  } else {
    mercenary.manaRechargeWait = false;
  }

  // 3) 용병 자가 체력 회복 (물약 우선, 없으면 힐 스킬)
  const hpPotIdx = mercenary.inventory.findIndex(it => it && window.itemDict[it.type]?.healHp > 0 && it.qty > 0);
  if (hpRatio <= mercHpThresh) {
    if (hpPotIdx > -1) {
      const potDef = window.itemDict[mercenary.inventory[hpPotIdx].type];
      const mercHpCoolMs = (typeof potDef?.cool === 'number' ? potDef.cool : 0.5) * 1000;
      if (now - mercenary.lastHpPotionTime >= mercHpCoolMs) {
        useMercPotionIndex(hpPotIdx);
      }
    } else if ((mercenary.class === 'wizard' || mercenary.class === 'ranger') && now - mercenary.lastHealTime >= 2200 && mercenary.mp >= 10) {
      mercenary.lastHealTime = now;
      mercenary.mp = Math.max(0, mercenary.mp - 10);
      const bestHealSk = unlockedSkills.filter(s => s.type === '힐링').sort((a, b) => (b.healFixed || 0) - (a.healFixed || 0))[0];
      const baseH = bestHealSk?.healFixed || (mercenary.class === 'wizard' ? 240 : 210);
      const pctBonus = Math.floor((mercenary.maxHp || 350) * 0.16);
      const selfHeal = mercenary.class === 'wizard'
        ? Math.floor(baseH + ms.totalMAtk * 1.45 + mercenary.level * 3.2 + pctBonus)
        : Math.floor(baseH + ms.totalAtk * 0.95 + mercenary.level * 2.8 + pctBonus);
      mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp + selfHeal);
      const mSelfHealName = bestHealSk?.name || (mercenary.class === 'wizard' ? '그레이트 힐' : '네이처스 터치');
      floatingTexts.push({ x: mercenary.x, y: mercenary.y - 48, text: `🌿자체힐 +${selfHeal}`, color: 0x4ade80, life: 32 });
      activeEffects.push({ type: 'buff', x: mercenary.x, y: mercenary.y, targetRef: mercenary, life: 25, maxLife: 25, skillName: mSelfHealName });
      window.broadcastMultiplayerActionFx?.('ally_buff', { isMerc: true, x: Math.round(mercenary.x), y: Math.round(mercenary.y), skillName: mSelfHealName, healAmt: selfHeal });
    }
  }

  if ((mercenary.activeBuffs.ELIXIR || 0) <= 2000) {
    const bufPotIdx = mercenary.inventory.findIndex(it => it && it.type === 'C_P05' && it.qty > 0);
    if (bufPotIdx > -1) {
      useMercPotionIndex(bufPotIdx);
    }
  }

  // 4) 💚 용병 자동 힐(마법사/궁수) & 자동 버프(전사 방어버프 포함 전 클래스)!
  const isSupportOrStandby = (mercenary.stance === 'SUPPORT' || mercenary.stance === 'STANDBY');
  if (mercenary.class === 'wizard' || mercenary.class === 'ranger') {
    const playerHpRatio = player.hp / Math.max(1, player.maxHp);
    const healThreshold = isBossFight ? 0.85 : (isSupportOrStandby ? 0.82 : 0.72);
    const healCool = isBossFight ? 1700 : (isSupportOrStandby ? 1950 : 2400);

    if (playerHpRatio <= healThreshold && now - mercenary.lastHealTime >= healCool && mercenary.mp >= 10) {
      const healSkills = unlockedSkills.filter(s => s.type === '힐링').sort((a, b) => (b.healFixed || 0) - (a.healFixed || 0));
      const pickedHeal = healSkills[0];
      const mpNeed = Math.min(22, pickedHeal?.mp || 12);
      if (mercenary.mp >= mpNeed) {
        mercenary.lastHealTime = now;
        mercenary.mp = Math.max(0, mercenary.mp - mpNeed);
        const baseHealVal = pickedHeal?.healFixed || (mercenary.class === 'wizard' ? 240 : 210);
        const isGreatH = pickedHeal?.id === 'M13' || (pickedHeal?.name || '').includes('그레이트');
        const pctHeal = Math.floor((player.maxHp || 400) * (isGreatH ? 0.20 : 0.14));
        const healAmt = mercenary.class === 'wizard'
          ? Math.floor(baseHealVal + ms.totalMAtk * 1.50 + mercenary.level * 3.5 + pctHeal)
          : Math.floor(baseHealVal + ms.totalAtk * 1.05 + mercenary.level * 3.0 + pctHeal);
        player.hp = Math.min(player.maxHp, player.hp + healAmt);
        const skillLabel = pickedHeal?.name || (mercenary.class === 'wizard' ? '그레이트 힐' : '네이처스 터치');
        SoundSystem.playSkill(skillLabel, mercenary.class, pickedHeal?.circle || 1, false);
        floatingTexts.push({ x: player.x, y: player.y - 52, text: `💚용병 ${skillLabel} +${healAmt}`, color: 0x4ade80, fontSize: 13.5, life: 36 });
        activeEffects.push({ type: 'buff', x: player.x, y: player.y, targetRef: player, life: 28, maxLife: 28, skillName: skillLabel });
        window.broadcastMultiplayerActionFx?.('ally_buff', { x: Math.round(player.x), y: Math.round(player.y), skillName: skillLabel, healAmt });
        updateStatusHUD();
      }
    }
  }

  // 전 클래스 용병: 해금된 버프 스킬(아이언 스킨, 가디언 아머, 쉴드, 헤이스트 등)을 플레이어와 용병에게 자동 시전!
  if (!mercenary.manaRechargeWait && curMpRatioNow >= 0.14 && now - (mercenary.lastAutoBuffTime || 0) >= 1600) {
    const supportBuffSkills = unlockedSkills.filter(s =>
      (s.type === '버프' || s.buffKey) &&
      s.buffKey &&
      !['ABSOLUTE_BARRIER', 'SUMMON_GOLEM', 'ARCHMAGE', 'COUNTER', 'RAGE'].includes(s.buffKey)
    );
    for (const bSk of supportBuffSkills) {
      const bKey = bSk.buffKey;
      const mercRem = mercenary.activeBuffs?.[bKey] || 0;
      const playerRem = player.activeBuffs?.[bKey] || 0;
      if (mercRem <= 4000 || (bSk.allyCast && playerRem <= 4000)) {
        const mpCost = Math.min(20, Math.max(6, Math.floor((bSk.mp || 12) * 0.65)));
        if (mercenary.mp >= mpCost) {
          mercenary.lastAutoBuffTime = now;
          mercenary.mp = Math.max(0, mercenary.mp - mpCost);
          const durMs = ((bSk.dur && bSk.dur > 0) ? bSk.dur : 180) * 1000;
          mercenary.activeBuffs[bKey] = Math.min(3600000, Math.max(0, mercenary.activeBuffs[bKey] || 0) + durMs);
          if (bSk.allyCast) {
            player.activeBuffs[bKey] = Math.min(3600000, Math.max(0, player.activeBuffs[bKey] || 0) + durMs);
          }
          recalcMaxHpMp(true);
          syncMercStats(false);
          SoundSystem.playSkill(bSk.name, mercenary.class, bSk.circle || 1, false);
          floatingTexts.push({ x: player.x, y: player.y - 54, text: `✨용병버프 [${bSk.name}]`, color: 0xfde047, fontSize: 12.5, life: 34 });
          activeEffects.push({ type: 'buff', x: player.x, y: player.y, targetRef: player, life: 28, maxLife: 28, skillName: bSk.name });
          window.broadcastMultiplayerActionFx?.('ally_buff', { x: Math.round(player.x), y: Math.round(player.y), skillName: bSk.name });
          window.updateBuffUI();
          updateStatusHUD();
          break;
        }
      }
    }
  }

  // 5) 🌟 보스 장판 예고(Telegraph) 감지 시 용병이 즉시 장판 바깥 안전 지점으로 회피 기동!
  if (bossTelegraphs.length > 0) {
    const dangerTg = bossTelegraphs.find(tg => tg.boss && !tg.boss.isDead && Math.hypot(mercenary.x - tg.x, mercenary.y - tg.y) <= tg.radius + 28);
    if (dangerTg) {
      let escAng = Math.atan2(mercenary.y - dangerTg.y, mercenary.x - dangerTg.x);
      if (Math.hypot(mercenary.x - dangerTg.x, mercenary.y - dangerTg.y) < 5) escAng = Math.random() * Math.PI * 2;
      const step = Math.max(2.10, (player.speed || 1.90) * 1.15) * delta;
      const steer = findOpenSteerPoint(mercenary.x, mercenary.y, escAng, step, true, mercenary);
      if (steer) {
        mercenary.x = steer.x;
        mercenary.y = steer.y;
        mercenary.isWalking = true;
        mercenary.dir = Math.cos(steer.angle) >= 0 ? 'right' : 'left';
      }
      if (now - (mercenary.lastDodgeTextTime || 0) > 1200) {
        mercenary.lastDodgeTextTime = now;
        floatingTexts.push({ x: mercenary.x, y: mercenary.y - 52, text: `⚡장판회피!`, color: 0x38bdf8, life: 28 });
      }
      window.updateMercHUD();
      return;
    }
  }

  // 🌟 플레이어 주변 원형 궤도 회피 기동 헬퍼 (용병이 도망갈 때 멀리 이탈하지 않고 플레이어 주위를 원을 그리며 돌아 플레이어가 몬스터를 공격할 수 있게 유도!)
  const orbitEvadeAroundPlayer = (threatEntity, orbitRadius = 86, speedMult = 1.06) => {
    const curAngFromPlayer = Math.atan2(mercenary.y - player.y, mercenary.x - player.x);
    if (!mercenary.orbitDir) mercenary.orbitDir = 1;
    if (threatEntity) {
      // 위협 몬스터로부터 더 멀어지는 회전 방향(시계/반시계) 선택
      const testAngPlus = curAngFromPlayer + 0.55;
      const testAngMinus = curAngFromPlayer - 0.55;
      const dPlus = Math.hypot((player.x + Math.cos(testAngPlus) * orbitRadius) - threatEntity.x, (player.y + Math.sin(testAngPlus) * orbitRadius) - threatEntity.y);
      const dMinus = Math.hypot((player.x + Math.cos(testAngMinus) * orbitRadius) - threatEntity.x, (player.y + Math.sin(testAngMinus) * orbitRadius) - threatEntity.y);
      if (Math.abs(dPlus - dMinus) > 14) {
        mercenary.orbitDir = dPlus >= dMinus ? 1 : -1;
      }
    }
    const nextOrbitAng = curAngFromPlayer + mercenary.orbitDir * 0.58;
    const goalX = player.x + Math.cos(nextOrbitAng) * orbitRadius;
    const goalY = player.y + Math.sin(nextOrbitAng) * orbitRadius;
    const moveAng = Math.atan2(goalY - mercenary.y, goalX - mercenary.x);
    const step = (player.speed || 1.90) * speedMult * delta;
    let steer = findOpenSteerPoint(mercenary.x, mercenary.y, moveAng, step, true, mercenary);
    if (!steer) {
      mercenary.orbitDir = -mercenary.orbitDir;
      const revAng = curAngFromPlayer + mercenary.orbitDir * 0.65;
      const rGoalX = player.x + Math.cos(revAng) * orbitRadius;
      const rGoalY = player.y + Math.sin(revAng) * orbitRadius;
      steer = findOpenSteerPoint(mercenary.x, mercenary.y, Math.atan2(rGoalY - mercenary.y, rGoalX - mercenary.x), step, true, mercenary);
    }
    if (steer) {
      mercenary.x = steer.x;
      mercenary.y = steer.y;
      mercenary.isWalking = true;
      mercenary.dir = Math.cos(steer.angle) >= 0 ? 'right' : 'left';
      return true;
    }
    return false;
  };

  // 용병 주위로 접근하는 가장 가까운 위협 몬스터 실시간 탐색
  let closestApproachingMob = null;
  let closestApproachDist = Infinity;
  if (!inSafe) {
    for (let i = 0; i < monsterList.length; i++) {
      const m = monsterList[i];
      if (!m || m.isDead || isInsideSafeZone(m.x, m.y)) continue;
      const d = Math.hypot(m.x - mercenary.x, m.y - mercenary.y);
      if (d < closestApproachDist) {
        closestApproachDist = d;
        closestApproachingMob = m;
      }
    }
  }

  // 5-B) 🚨 전 클래스 공통(전사·궁수·마법사 모두): 물약이 없고 체력이 20% 이하이면 사망 방지를 위해 플레이어 근처를 원을 돌며 회피기동(플레이어가 몬스터를 공격 가능하게 유도)!
  const curHpRatioNow = mercenary.hp / Math.max(1, mercenary.maxHp);
  const hasAnyHpPotNow = mercenary.inventory.some(it => it && window.itemDict[it.type]?.healHp > 0 && it.qty > 0);
  if (!inSafe && !hasAnyHpPotNow && curHpRatioNow <= 0.20) {
    if (closestApproachingMob && closestApproachDist <= 240) {
      orbitEvadeAroundPlayer(closestApproachingMob, 82, 1.08);
      if (now - (mercenary.lastLowHpEvadeNotice || 0) > 2200) {
        mercenary.lastLowHpEvadeNotice = now;
        floatingTexts.push({ x: mercenary.x, y: mercenary.y - 52, text: `🚨체력위기! 플레이어 주변 회피기동`, color: 0xf87171, fontSize: 11, life: 28 });
      }
      window.updateMercHUD();
      return;
    } else if (Math.hypot(player.x - mercenary.x, player.y - mercenary.y) > 95) {
      followPlayerMovement(delta);
      window.updateMercHUD();
      return;
    }
  }

  // 6) 💧 마나 10% 미만일 때: 힐 대기 + 플레이어 주변 원형 회피기동 수행, 10% 이상 회복 즉시 정상 복귀!
  if (mercenary.manaRechargeWait && !inSafe) {
    if (closestApproachingMob && closestApproachDist < 195) {
      orbitEvadeAroundPlayer(closestApproachingMob, 86, 1.04);
      if (now - (mercenary.lastEvadeNoticeTime || 0) > 2200) {
        mercenary.lastEvadeNoticeTime = now;
        floatingTexts.push({ x: mercenary.x, y: mercenary.y - 50, text: `💧MP회복 회피기동`, color: 0x93c5fd, fontSize: 11, life: 26 });
      }
    } else {
      followPlayerMovement(delta);
    }
    window.updateMercHUD();
    return;
  }

  if (inSafe) {
    followPlayerMovement(delta);
    window.updateMercHUD();
    return;
  }

  if (mercenary.attackerMonster && (mercenary.attackerMonster.isDead || isInsideSafeZone(mercenary.attackerMonster.x, mercenary.attackerMonster.y))) {
    mercenary.attackerMonster = null;
  }

  let target = null;
  if (mercenary.stance === 'STANDBY') {
    target = mercenary.attackerMonster;
  } else {
    // 🎯 플레이어와 같이 사냥할 때 플레이어 타겟을 최우선 점사(집중 공격)!
    if (playerTargetMob && !isInsideSafeZone(playerTargetMob.x, playerTargetMob.y)) {
      target = playerTargetMob;
    } else if (player.lastHitByMonster && !player.lastHitByMonster.isDead && (now - (player.lastHitByTime || 0) < 4000) && !isInsideSafeZone(player.lastHitByMonster.x, player.lastHitByMonster.y)) {
      target = player.lastHitByMonster;
    } else if (nearbyBoss && !isInsideSafeZone(nearbyBoss.x, nearbyBoss.y)) {
      target = nearbyBoss;
    } else if (mercenary.attackerMonster) {
      target = mercenary.attackerMonster;
    } else if (mercenary.stance === 'ATTACK') {
      let minDist = 360;
      monsterList.forEach(m => {
        if (m.isDead || isInsideSafeZone(m.x, m.y)) return;
        const d = Math.hypot(m.x - player.x, m.y - player.y);
        if (d < minDist) {
          minDist = d;
          target = m;
        }
      });
    }
  }

  mercenary.targetMonster = target;

  if (Math.hypot(player.x - mercenary.x, player.y - mercenary.y) > 520) {
    const safeFollow = findSafeSpot(player.x - 48, player.y + 32);
    mercenary.x = safeFollow.x;
    mercenary.y = safeFollow.y;
    return;
  }

  if (!target || target.isDead) {
    followPlayerMovement(delta);
    window.updateMercHUD();
    return;
  }

  const isRangedMerc = (mercenary.class === 'ranger' || mercenary.class === 'wizard');
  const atkRange = isRangedMerc ? 245 : 70;
  const distToTarget = Math.hypot(target.x - mercenary.x, target.y - mercenary.y);

  // 보스전 전력투구(All-Out Burst) 시 공격/스킬 템포 가속
  const isAllOutBoss = Boolean(target.isBoss || isBossFight);
  const atkInterval = Math.max(360, Math.floor(ms.atkSpeedSec * (isAllOutBoss ? 840 : 1000)));
  const mercMoveSpeed = (player.speed || 1.90) * 1.04;

  // 🏹🔮 궁수·마법사 전용 선제 원형 카이팅(Pre-Hit Orbit Kiting):
  // 용병 주위로 어떤 몬스터든 접근(148px 이내, 몬스터가 때리기 전!)하면 플레이어 쪽으로 원을 돌면서 회피 기동하고,
  // 공격 쿨타임이 돌아올 때마다 멈추지 않고 플레이어 타겟(target)을 계속 점사 공격!
  const preHitThreat = (closestApproachingMob && closestApproachDist < (isRangedMerc ? 148 : 44)) ? closestApproachingMob : null;
  let didPreHitKiteMove = false;

  if (isRangedMerc && preHitThreat) {
    didPreHitKiteMove = orbitEvadeAroundPlayer(preHitThreat, 90, 1.05);
    mercenary.dir = (target.x >= mercenary.x) ? 'right' : 'left';
  }

  if (!didPreHitKiteMove && distToTarget > atkRange) {
    let ang = Math.atan2(target.y - mercenary.y, target.x - mercenary.x);
    let step = mercMoveSpeed * delta;
    const steer = findOpenSteerPoint(mercenary.x, mercenary.y, ang, step, false, mercenary);
    if (steer) {
      mercenary.x = steer.x;
      mercenary.y = steer.y;
      mercenary.isWalking = true;
      mercenary.dir = Math.cos(steer.angle) >= 0 ? 'right' : 'left';
    }
  } else {
    if (!didPreHitKiteMove) {
      mercenary.isWalking = false;
    }
    mercenary.dir = (target.x >= mercenary.x) ? 'right' : 'left';

    if (distToTarget <= atkRange + 25 && now - mercenary.lastAttackTime >= atkInterval) {
      mercenary.lastAttackTime = now;
      mercenary.lastCombatTime = now;

      // 🌟 레벨 해금 스킬 중 단일 vs 광역 자동 구분 + 보스전 전력투구!
      const offensiveSkills = unlockedSkills.filter(s => s.type === '공격' && (s.mult || 0) > 0);
      const checkX = mercenary.class === 'knight' ? mercenary.x : target.x;
      const checkY = mercenary.class === 'knight' ? mercenary.y : target.y;
      const nearbyMobCount = monsterList.filter(m =>
        !m.isDead &&
        !isInsideSafeZone(m.x, m.y) &&
        (Math.hypot(m.x - checkX, m.y - checkY) <= 185 || Math.hypot(m.x - target.x, m.y - target.y) <= 185)
      ).length;

      const skillCoolWait = isAllOutBoss ? 1750 : 3200;
      const canUseSkill = offensiveSkills.length > 0 && (now - mercenary.lastSkillTime >= skillCoolWait) && mercenary.mp >= 10;

      let chosenSk = null;
      if (canUseSkill) {
        const singlePool = offensiveSkills.filter(s => s.range === '단일').sort((a, b) => ((b.mult || 1) * (b.hits || 1)) - ((a.mult || 1) * (a.hits || 1)));
        const aoePool = offensiveSkills.filter(s => s.range === '광역').sort((a, b) => ((b.mult || 1) * (b.hits || 1)) - ((a.mult || 1) * (a.hits || 1)));
        const allSorted = [...offensiveSkills].sort((a, b) => ((b.mult || 1) * (b.hits || 1)) - ((a.mult || 1) * (a.hits || 1)));

        if (isAllOutBoss) {
          // 보스전 전력투구: 다수 부하가 있으면 최강 광역기, 아니면 최강 고배율 스킬 퍼붓기!
          if (nearbyMobCount >= 3 && aoePool.length > 0) chosenSk = aoePool[0];
          else chosenSk = allSorted[0] || singlePool[0];
        } else if (nearbyMobCount >= 2 && aoePool.length > 0) {
          chosenSk = aoePool[0];
        } else if (singlePool.length > 0) {
          chosenSk = singlePool[0];
        } else {
          chosenSk = allSorted[0];
        }
      }

      if (chosenSk) {
        mercenary.lastSkillTime = now;
        const mpCost = Math.min(24, Math.max(8, Math.floor((chosenSk.mp || 14) * (isAllOutBoss ? 0.55 : 0.70))));
        mercenary.mp = Math.max(0, mercenary.mp - mpCost);

        const skillName = chosenSk.name;
        const skillMult = (chosenSk.mult || 1.7) * (isAllOutBoss ? 1.12 : 1.0);
        const hitCount = chosenSk.hits || 1;
        const isMagic = mercenary.class === 'wizard';
        const isAoe = chosenSk.range === '광역';
        const aoeRadius = isAoe ? (145 + (chosenSk.circle || 1) * 10) : 70;
        const cLv = chosenSk.circle || 2;

        const opts = {
          attacker: 'mercenary',
          isSkill: true,
          skillName,
          ignoreDef: Boolean(chosenSk.ignoreDef),
          forceCrit: Boolean(chosenSk.forceCrit || (isAllOutBoss && Math.random() < 0.35)),
          stunSec: chosenSk.stunSec || 0,
          defDown: Boolean(chosenSk.defDown),
          drainPct: chosenSk.drainPct || 0,
          hits: hitCount
        };

        const basePower = isMagic ? ms.totalMAtk : ms.totalAtk;
        const finalDmg = Math.floor((basePower + mercenary.level * 2.2) * skillMult);

        SoundSystem.playSkill(skillName, mercenary.class, cLv, false);
        sendCentralWsPacket({
          type: 'PLAYER_SKILL',
          charId: activeCharacterId,
          mapKey: currentMapKey,
          isMerc: true,
          casterClass: mercenary.class,
          casterX: Math.round(mercenary.x),
          casterY: Math.round(mercenary.y),
          skillName: skillName,
          tx: Math.round(target.x),
          ty: Math.round(target.y),
          mobId: target.id,
          isAoe: isAoe,
          circleLv: cLv,
          dmgMult: skillMult * hitCount,
          dmgAmount: finalDmg * hitCount
        });

        if (cLv >= 3) {
          activeEffects.push({
            type: 'magic_circle',
            x: mercenary.x,
            y: mercenary.y + 4,
            casterRef: mercenary,
            aoeRadius: 56 + cLv * 11,
            circleLv: cLv,
            dmgMult: skillMult * hitCount,
            dmgAmount: finalDmg * hitCount,
            isBossCircle: false,
            life: 62,
            maxLife: 62,
            skillName: skillName
          });
        }

        if (isRangedMerc) {
          const isSkySpell = Boolean(
            chosenSk.skyDrop ||
            skillName.includes("라이트닝") ||
            skillName.includes("메테오") ||
            skillName.includes("미티어") ||
            skillName.includes("아이스 스톰") ||
            skillName.includes("블리자드") ||
            skillName.includes("앱솔루트 제로") ||
            skillName.includes("둠") ||
            skillName.includes("워드 오브 데스") ||
            skillName.includes("카오스 필드") ||
            skillName.includes("애로우 레인")
          );
          const camTopY = (typeof camera !== 'undefined' && typeof camera.y === 'number') ? (camera.y - 95) : (target.y - 520);
          const skyStartY = Math.min(camTopY, target.y - 460);
          const projStartX = isSkySpell ? target.x : mercenary.x;
          const projStartY = isSkySpell ? skyStartY : (mercenary.y - 16);

          projectiles.push({
            x: projStartX, y: projStartY,
            startX: projStartX, startY: projStartY,
            lastTargetX: target.x, lastTargetY: target.y,
            isSkyDrop: isSkySpell,
            skyTotalDist: isSkySpell ? Math.max(180, Math.hypot(target.x - projStartX, (target.y - 15) - projStartY)) : 0,
            casterRef: mercenary,
            target: target, speed: isSkySpell ? 24 : 15,
            type: mercenary.class === 'ranger' ? 'arrow' : 'magic',
            dmg: finalDmg, skillName: skillName, isAoe: isAoe,
            aoeRadius: aoeRadius, maxTargets: chosenSk.maxTargets || 5,
            opts: opts
          });
        } else {
          if (isAoe) {
            const limit = chosenSk.maxTargets || 5;
            const hitMons = [];
            monsterList.forEach(m => {
              if (!m.isDead && hitMons.length < limit && Math.hypot(m.x - mercenary.x, m.y - mercenary.y) <= aoeRadius) {
                hitMons.push(m);
              }
            });
            if (hitMons.length > 0) window.applyDamageBatch(hitMons, finalDmg, 'melee', opts);
          } else {
            window.applyDamageBatch([target], finalDmg, 'melee', opts);
          }
          activeEffects.push({ type: 'knight', x: isAoe ? mercenary.x : target.x, y: isAoe ? mercenary.y : target.y, life: 30, maxLife: 30, skillName: skillName, isAoe: isAoe, aoeRadius: aoeRadius });
        }
      } else {
        const basePower = mercenary.class === 'wizard' ? ms.totalMAtk * 0.82 : ms.totalAtk;
        const dmg = Math.floor(basePower + mercenary.level * 1.6);
        window.broadcastMultiplayerActionFx?.('basic_atk', {
          isMerc: true,
          casterClass: mercenary.class,
          isRanged: isRangedMerc,
          sx: Math.round(mercenary.x),
          sy: Math.round(mercenary.y),
          tx: Math.round(target.x),
          ty: Math.round(target.y),
          mobId: target.id
        });
        if (isRangedMerc) {
          projectiles.push({
            x: mercenary.x, y: mercenary.y - 16,
            lastTargetX: target.x, lastTargetY: target.y,
            target: target, speed: 14,
            type: mercenary.class === 'ranger' ? 'arrow' : 'magic',
            dmg: dmg, skillName: null, isAoe: false, opts: { attacker: 'mercenary' }
          });
        } else {
          window.applyDamage(target, dmg, 'melee', { attacker: 'mercenary' });
        }
      }
    }
  }

  window.updateMercHUD();
}

function followPlayerMovement(delta) {
  const desiredX = player.x + (player.dir === 'left' ? 48 : -48);
  const desiredY = player.y + 28;
  const dist = Math.hypot(desiredX - mercenary.x, desiredY - mercenary.y);
  const followSpd = (player.speed || 1.90) * 1.04;

  if (dist > 28) {
    const ang = Math.atan2(desiredY - mercenary.y, desiredX - mercenary.x);
    const step = Math.min(dist, followSpd * delta);
    const steer = findOpenSteerPoint(mercenary.x, mercenary.y, ang, step, false, mercenary);
    if (steer) {
      mercenary.x = steer.x;
      mercenary.y = steer.y;
    } else {
      const safePos = findSafeSpot(desiredX, desiredY);
      mercenary.x = safePos.x;
      mercenary.y = safePos.y;
    }
    mercenary.isWalking = true;
    mercenary.dir = Math.cos(ang) >= 0 ? 'right' : 'left';
  } else {
    mercenary.isWalking = false;
  }
}

// ============================================================================
// 🔄 메인 게임 루프 (원형 카이팅, 피격 시 우선 타격 & 보스 복귀, 끼임 탈출, 점감 방어 공식)
// ============================================================================
let lastNaturalRegenTime = 0;
let lastGolemAtkTime = 0;

// 몬스터 공격 데미지 계산 (장비 미착용 시 무방비 피해 증폭 + 고레벨에서도 스탯만으로 무적이 되지 않는 점감 방어 공식)
function calcMonsterDamageToDefender(rawMobAtk, defenderDef, mobLv = 1, isBoss = false, extraReducePct = 0, bossReducePct = 0, isPlayerDefender = true, isMagicAtk = false, defenderMDef = 0) {
  // 방어구 미착용(맨몸) 상태 검증: 갑옷 미착용 또는 방어구 착용 부위가 부족하면 큰 추가 피해가 들어와 물약 및 장비 착용이 필수!
  let unarmoredMult = 1.0;
  if (isPlayerDefender && player && player.equip) {
    const hasArmor = player.equip.armor !== null && player.equip.armor !== undefined && Boolean(player.inventory[player.equip.armor]);
    const armorKeys = ['helmet', 'tshirt', 'armor', 'cloak', 'gloves', 'belt', 'boots', 'shield'];
    let eqCnt = 0;
    for (let i = 0; i < armorKeys.length; i++) {
      const k = armorKeys[i];
      if (player.equip[k] !== null && player.equip[k] !== undefined && player.inventory[player.equip[k]]) eqCnt++;
    }
    if (!hasArmor) unarmoredMult += 0.38;
    if (eqCnt < 3) unarmoredMult += (3 - eqCnt) * 0.14;
  }

  // 마법 공격 또는 보스 광역 마법 피격 시 마법방어력(defenderMDef)을 핵심 방어 스탯으로 반영!
  const effectiveDef = isMagicAtk
    ? Math.max(0, Math.round((defenderMDef || 0) * 0.80 + (defenderDef || 0) * 0.35))
    : Math.max(0, defenderDef || 0);

  const reqDefStandard = mobLv >= 30 ? Math.floor(mobLv * 2.15) : Math.floor(mobLv * 1.4);
  const isWellGeared = effectiveDef >= reqDefStandard;

  if (!isWellGeared && mobLv >= 30 && !isBoss) {
    const deficitRatio = (reqDefStandard - effectiveDef) / Math.max(20, reqDefStandard);
    unarmoredMult += Math.min(0.58, deficitRatio * 0.65);
  }

  const maxDefCap = isWellGeared ? 0.86 : 0.72;
  const defRatio = Math.min(maxDefCap, effectiveDef / (effectiveDef + 115 + mobLv * (isWellGeared ? 8.2 : 11.5)));
  const flatReduce = Math.min(rawMobAtk * (isWellGeared ? 0.36 : 0.22), effectiveDef * (isWellGeared ? 0.34 : 0.20));
  const floorRatio = isBoss ? (isWellGeared ? 0.16 : 0.26) : (isWellGeared ? 0.04 : 0.18);
  const minPenetration = Math.max(2, Math.floor(rawMobAtk * floorRatio * unarmoredMult));

  let mitigated = Math.max(minPenetration, Math.floor(((rawMobAtk - flatReduce) * (1 - defRatio)) * unarmoredMult));
  const totalPctRed = Math.min(60, (extraReducePct || 0) + (isBoss ? (bossReducePct || 0) : 0));
  if (totalPctRed > 0) {
    mitigated = Math.max(1, Math.floor(mitigated * (1 - totalPctRed / 100)));
  }
  return mitigated;
}

let _lastGameLoopPerfTs = 0;

function gameLoop(rawDelta) {
  if (!app || !app.renderer) return;
  const perfNow = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  if (!document.hidden && _lastGameLoopPerfTs > 0 && (perfNow - _lastGameLoopPerfTs) < 7) {
    return;
  }
  const delta = document.hidden
    ? Math.min(2.0, Math.max(0.5, Number(rawDelta) || 1))
    : (_lastGameLoopPerfTs > 0 ? Math.min(1.12, Math.max(0.45, (perfNow - _lastGameLoopPerfTs) / 16.6667)) : 1.0);
  _lastGameLoopPerfTs = perfNow;

  let now = Date.now();
  tick += delta;

  updateRealtimeDetailMapMarker();

  // 1) 안전지대(S / S1) 진입 확인 및 자동사냥 해제
  const inSafe = bgLoaded && isInsideSafeZone(player.x, player.y);
  const safeBadge = document.getElementById('safe-zone-badge');
  if (safeBadge) {
    if (inSafe) safeBadge.classList.remove('hidden');
    else safeBadge.classList.add('hidden');
  }
  if (inSafe && window.isAutoAttack) {
    disableAutoAttack(`🛡️ [안전지대 진입] 마을(S)/야영지(S1) 안전지대에 진입하여 자동사냥이 해제되었습니다.`);
  }

  // 🎵 1-B) 현재 위치(마을 안전지대 vs 필드 테마 vs 던전 vs 보스전)에 맞춰 배경음악(BGM) 자동 전환
  if (bgLoaded && window.SoundSystem?.setBgmContext) {
    const curRegObj = GameDB.Regions.find(r => r.id === currentRegionKey) || GameDB.Regions[0];
    const isBossCombatNow = Boolean(
      (player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref?.isBoss && !player.targetEntity.ref.isDead) ||
      monsterList.some(m => !m.isDead && m.isBoss && Math.hypot(m.x - player.x, m.y - player.y) <= 460)
    );
    window.SoundSystem.setBgmContext(inSafe, currentMapKey, curRegObj?.theme || '초원', isBossCombatNow);
  }

  // 2) 플레이어 & 용병 자연 HP/MP 자동 재생 (data.js SystemConfig.naturalRegen 참조)
  const regenCfg = GameDB.SystemConfig?.naturalRegen || {};
  if (now - lastNaturalRegenTime >= (regenCfg.intervalMs || 2500)) {
    lastNaturalRegenTime = now;
    const playerInCombat = (now - (player.lastCombatTime || 0) < 5000) || (player.targetEntity?.type === 'MONSTER');
    const playerResting = inSafe || (!playerInCombat && !player.isMoving);

    const mfSk = (GameDB.Skills.Mage || []).find(s => s.buffKey === 'MENTAL_FOCUS');
    const mp2Sk = (GameDB.Skills.Mage || []).find(s => s.id === 'MP2');

    const pHpRegen = inSafe
      ? Math.max(12, Math.floor(player.maxHp * (regenCfg.safeHpPct ?? 0.045)))
      : (playerResting ? Math.max(5, Math.floor(player.maxHp * (regenCfg.restHpPct ?? 0.022))) : Math.max(2, Math.floor(player.maxHp * (regenCfg.combatHpPct ?? 0.006))));
    const pMpRegen = (inSafe
      ? Math.max(10, Math.floor(player.maxMp * (regenCfg.safeMpPct ?? 0.055)))
      : (playerResting ? Math.max(5, Math.floor(player.maxMp * (regenCfg.restMpPct ?? 0.032))) : Math.max(2, Math.floor(player.maxMp * (regenCfg.combatMpPct ?? 0.012)))))
      + (player.activeBuffs.MENTAL_FOCUS > 0 ? (mfSk?.bonusMpRegen ?? 8) : 0)
      + (player.class === 'wizard' && isSkillLearned('MP2') ? (mp2Sk?.bonusMpRegen ?? 6) : 0);

    if (player.hp > 0 && player.hp < player.maxHp) player.hp = Math.min(player.maxHp, player.hp + pHpRegen);
    if (player.mp < player.maxMp) player.mp = Math.min(player.maxMp, player.mp + pMpRegen);

    if (mercenary.hired && !mercenary.isDead) {
      const mercInCombat = !mercenary.manaRechargeWait && ((now - (mercenary.lastCombatTime || 0) < 5000) || !!mercenary.targetMonster);
      const mercResting = inSafe || mercenary.manaRechargeWait || !mercInCombat;

      const mHpRegen = inSafe
        ? Math.max(14, Math.floor(mercenary.maxHp * 0.05))
        : (mercResting ? Math.max(6, Math.floor(mercenary.maxHp * 0.025)) : Math.max(2, Math.floor(mercenary.maxHp * 0.008)));
      const mMpRegen = inSafe
        ? Math.max(12, Math.floor(mercenary.maxMp * 0.06))
        : (mercResting ? Math.max(7, Math.floor(mercenary.maxMp * 0.04)) : Math.max(3, Math.floor(mercenary.maxMp * 0.015)));

      if (mercenary.hp < mercenary.maxHp) mercenary.hp = Math.min(mercenary.maxHp, mercenary.hp + mHpRegen);
      if (mercenary.mp < mercenary.maxMp) mercenary.mp = Math.min(mercenary.maxMp, mercenary.mp + mMpRegen);
      if (mercenary.manaRechargeWait && (mercenary.mp / mercenary.maxMp) >= 0.25) {
        mercenary.manaRechargeWait = false;
      }
      window.updateMercHUD();
    }
    updateStatusHUD();
  }

  if (player.activeBuffs.SUMMON_GOLEM > 0 && player.targetEntity?.type === 'MONSTER' && !player.targetEntity.ref.isDead) {
    if (now - lastGolemAtkTime >= 2000) {
      lastGolemAtkTime = now;
      const gTarget = player.targetEntity.ref;
      const cStats = calculateCombatStats(false);
      const gDmg = Math.floor(cStats.totalMAtk * 1.4);
      window.applyDamage(gTarget, gDmg, 'melee', { attacker: 'player', isSkill: true });
      activeEffects.push({ type: 'knight', x: gTarget.x, y: gTarget.y, life: 24, maxLife: 24, skillName: '배쉬' });
      window.broadcastMultiplayerSkill?.('배쉬', gTarget.x, gTarget.y, false, 1, 1.4, gDmg, { mobId: gTarget.id, casterClass: 'knight' });
    }
  }

  // 3) 버프 지속시간 갱신
  let buffChanged = false;
  Object.keys(player.activeBuffs).forEach(key => {
    if (player.activeBuffs[key] > 0) {
      player.activeBuffs[key] -= (delta / 60) * 1000;
      if (player.activeBuffs[key] <= 0) {
        player.activeBuffs[key] = 0;
        buffChanged = true;
      }
    }
  });
  if (Math.floor(tick) % 30 === 0 || buffChanged) {
    window.updateBuffUI();
    if (buffChanged) updateStatusHUD();
  }

  let speedBonusPct = 0;
  const wwSk = (GameDB.Skills.Archer || []).find(s => s.buffKey === 'WIND_WALK');
  const hsSk = (GameDB.Skills.Mage || []).find(s => s.buffKey === 'HASTE');
  const hwSk = (GameDB.Skills.Mage || []).find(s => s.buffKey === 'HOLY_WALK');
  if (player.activeBuffs.WIND_WALK > 0) speedBonusPct += (wwSk?.speedPct ?? 16);
  if (player.activeBuffs.HASTE > 0) speedBonusPct += (hsSk?.speedPct ?? 20);
  if (player.activeBuffs.HOLY_WALK > 0) speedBonusPct += (hwSk?.speedPct ?? 28);
  if (player.activeBuffs.ELIXIR > 0) speedBonusPct += 6;
  if ((player.activeBuffs.MERC_BLESS || 0) > 0) speedBonusPct += 8;
  // 각종 이동속도 버프는 누적 적용되되 상용 MMORPG 표준 속도감을 해치지 않도록 소프트캡(최대 +45%) 적용
  if (!player.isAdmin) player.gmSpeedMult = 1;
  const effSpeedMult = 1 + Math.min(0.45, speedBonusPct / 100);
  const baseSpd = CLASS_STATS[player.class]?.baseSpeed ?? 1.90;
  player.speed = baseSpd * effSpeedMult * (player.gmSpeedMult || 1);

  if (player.targetEntity && player.targetEntity.type === 'MONSTER' && player.targetEntity.ref) {
    if (Math.floor(tick) % 3 === 0) updateTopTargetUI(player.targetEntity.ref);
    if (player.targetEntity.ref.isBoss) window.ImmersiveSystem?.onBossEngage?.(player.targetEntity.ref);
  }

  // 4) 보스 리스폰 타이머 HUD 갱신 (20프레임 주기로 DOM 갱신하여 모바일 렉 방지)
  if (bossRespawnTimer > 0) {
    bossRespawnTimer -= (delta / 60);
  }
  if (Math.floor(tick) % 20 === 0) {
    const bossTimerEl = document.getElementById('boss-timer-hud');
    if (bossRespawnTimer > 0 && bossTimerEl) {
      let mins = Math.floor(Math.max(0, bossRespawnTimer) / 60);
      let secs = Math.floor(Math.max(0, bossRespawnTimer) % 60).toString().padStart(2, '0');
      bossTimerEl.innerText = `👑 지역 보스(B) 리스폰: ${mins}:${secs}`;
      bossTimerEl.style.color = '#fca5a5';
    } else if (bossTimerEl) {
      const bossAlive = monsterList.find(m => m.isBoss && !m.isDead);
      if (bossAlive) {
        bossTimerEl.innerText = `👑 ${bossAlive.rawName || bossAlive.name}: 출현 중!`;
        bossTimerEl.style.color = '#4ade80';
      } else {
        bossTimerEl.innerText = '';
      }
    }
  }

  if (bgLoaded && now > player.portalCooldown) {
    for (let p of portalBoxes) {
      if (Math.hypot(player.x - p.x, player.y - p.y) < p.radius) {
        player.portalCooldown = now + 3000;
        if (p.target === "TO_GOBLIN_CAVE") {
          window.addChat(`🌀 [포탈 이동] 고블린 동굴 미로 던전 내부로 진입합니다!`, 'log-sys');
          loadMapData("R01_dungeon", { x: 1500, y: 2560 });
        } else if (p.target === "EXIT_TO_ALTRIA") {
          window.addChat(`🌀 [포탈 탈출] 던전 밖 알트리아 고블린 동굴 입구 앞으로 나왔습니다!`, 'log-sys');
          loadMapData("R01_sub1", { x: 1100, y: 2280 });
        } else if (p.target === "TO_SILVERVINE_DUNGEON") {
          window.addChat(`🌀 [포탈 이동] 버려진 벌목장 심층부 던전으로 진입합니다!`, 'log-sys');
          loadMapData("R02_dungeon", { x: 1500, y: 2560 });
        } else if (p.target === "EXIT_TO_SILVERVINE") {
          window.addChat(`🌀 [포탈 탈출] 실버바인 버려진 벌목장 입구 앞으로 나왔습니다!`, 'log-sys');
          loadMapData("R02_sub1", { x: 3000, y: 9200 });
        } else if (p.target === "TO_MORAAN_DUNGEON") {
          window.addChat(`🌀 [포탈 이동] 개미지옥 둥지 심층부 던전으로 진입합니다!`, 'log-sys');
          loadMapData("R05_dungeon", { x: 1500, y: 2560 });
        } else if (p.target === "EXIT_TO_MORAAN") {
          window.addChat(`🌀 [포탈 탈출] 모라안 개미지옥 둥지 입구 앞으로 나왔습니다!`, 'log-sys');
          loadMapData("R05_sub1", { x: 1050, y: 4150 });
        } else if (p.target === "TO_BALENOS_DUNGEON") {
          window.addChat(`🌀 [포탈 이동] 난파선 무덤 심연 선실 던전으로 진입합니다!`, 'log-sys');
          loadMapData("R07_dungeon", { x: 1500, y: 2560 });
        } else if (p.target === "EXIT_TO_BALENOS") {
          window.addChat(`🌀 [포탈 탈출] 발레노스 난파선 무덤 입구 앞으로 나왔습니다!`, 'log-sys');
          loadMapData("R07_sub1", { x: 1900, y: 7680 });
        } else if (p.target && p.target.startsWith("TO_") && p.target.endsWith("_DUNGEON")) {
          const rId = p.target.replace("TO_", "").replace("_DUNGEON", "");
          window.addChat(`🌀 [포탈 이동] 심층부 미로 던전으로 진입합니다!`, 'log-sys');
          loadMapData(`${rId}_dungeon`, { x: 1500, y: 2560 });
        } else if (p.target && p.target.startsWith("EXIT_TO_")) {
          const rId = p.target.replace("EXIT_TO_", "");
          const destMap = HardcodedMapDB[`${rId}_sub1`];
          const exitPos = destMap?.dungeonEntrance || destMap?.spawn || { x: 2000, y: 13500 };
          window.addChat(`🌀 [포탈 탈출] 야외 필드 던전 입구 앞으로 나왔습니다!`, 'log-sys');
          loadMapData(`${rId}_sub1`, exitPos);
        }
        return;
      }
    }
  }

  // 자동사냥 중 조이스틱 조작이나 수동 이동 경로가 끝났는데도 manualMoving 플래그가 남아 자동사냥이 멈추는 현상 원천 차단!
  if (window.isAutoAttack && player.manualMoving && !joystickState.active && (!player.isMoving || !player.path || player.path.length === 0)) {
    player.manualMoving = false;
  }

  const isPartyMemberNotLeader = Boolean(window.partyState && window.partyState.leaderCharId && window.partyState.leaderCharId !== activeCharacterId);
  const partyLeaderOp = isPartyMemberNotLeader
    ? (window.otherPlayers || []).find(o => o && o.charId === window.partyState.leaderCharId)
    : null;
  const pMode = window.partyAutoHuntMode || window.partyState?.partyMode || 'FREE';

  // 파티 점사모드(FOCUS)에서 파티장의 현재 타겟 몬스터 실시간 해석 (서버 파티 스냅샷 + 리더 실시간 타겟 + 리더 교전 중인 근접 몬스터 폴백)
  let activePartyFocusMob = null;
  if (isPartyMemberNotLeader && pMode === 'FOCUS') {
    const rawLdrMobId = window.partyState?.leaderTargetMobId || partyLeaderOp?.targetMobId || null;
    if (rawLdrMobId) {
      activePartyFocusMob = monsterList.find(m => !m.isDead && String(m.id) === String(rawLdrMobId) && !isInsideSafeZone(m.x, m.y)) || null;
    }
    // AI 파티장이 방금 몬스터를 처치하여 0.1~0.2초간 새 타겟 ID가 아직 도착하지 않았거나 루팅 중일 때, 리더 바로 옆(260px 이내)에서 교전 중인 몬스터를 즉시 점사 보조!
    if (!activePartyFocusMob && partyLeaderOp && !isInsideSafeZone(partyLeaderOp.x, partyLeaderOp.y)) {
      let bestNearLdrDist = 260;
      monsterList.forEach(m => {
        if (m.isDead || isInsideSafeZone(m.x, m.y)) return;
        const dLdr = Math.hypot(m.x - partyLeaderOp.x, m.y - partyLeaderOp.y);
        if (dLdr <= bestNearLdrDist) {
          bestNearLdrDist = dLdr;
          activePartyFocusMob = m;
        }
      });
    }
  }

  // 5-A) 자동 사냥 중 가까운 드롭 아이템(380px 이내) 발견 시 우선 루팅 (단, 파티 점사모드에서 점사 타겟 교전 중에는 발밑 85px 이내만 즉시 줍고 점사 유지!)
  if (window.isAutoAttack && !inSafe && !player.manualMoving) {
    let nearestLoot = null;
    let minLootDist = activePartyFocusMob ? 85 : 380;
    for (let i = 0; i < itemList.length; i++) {
      const it = itemList[i];
      if (!shouldLootItem(it, window.itemDict)) continue;
      if (isInsideSafeZone(it.x, it.y)) continue;
      const d = Math.hypot(it.x - player.x, it.y - player.y);
      if (d <= minLootDist) {
        minLootDist = d;
        nearestLoot = it;
      }
    }
    if (nearestLoot) {
      if (minLootDist < 72) {
        pickupItem(nearestLoot);
      } else if (!activePartyFocusMob && (!player.targetEntity || player.targetEntity.type !== 'ITEM' || player.targetEntity.ref !== nearestLoot)) {
        player.targetEntity = { type: 'ITEM', ref: nearestLoot };
        player.path = window.findPath(player.x, player.y, nearestLoot.x, nearestLoot.y);
        player.isMoving = true;
      }
    } else if (player.targetEntity && player.targetEntity.type === 'ITEM') {
      player.targetEntity = null;
    }
  }

  // 5-B) 자동 사냥 몬스터 탐색 (파티 모드[자유사냥/점사모드] 연동 + 기억해둔 보스/반격 우선)
  if (window.isAutoAttack && !inSafe && !player.manualMoving) {
    // [파티 점사모드]: 파티장이 타겟한 몬스터가 있으면 즉시 해당 몬스터로 타겟 고정 및 집중 공격!
    if (isPartyMemberNotLeader && pMode === 'FOCUS') {
      if (activePartyFocusMob) {
        if (!player.targetEntity || player.targetEntity.type !== 'MONSTER' || player.targetEntity.ref !== activePartyFocusMob) {
          player.targetEntity = { type: 'MONSTER', ref: activePartyFocusMob };
          player.path = window.findPath(player.x, player.y, activePartyFocusMob.x, activePartyFocusMob.y);
          player.isMoving = true;
          updateTopTargetUI(activePartyFocusMob);
        } else {
          const distToFocus = Math.hypot(activePartyFocusMob.x - player.x, activePartyFocusMob.y - player.y);
          if (distToFocus > getPlayerAttackRange() && (!player.isMoving || !player.path || player.path.length === 0)) {
            player.path = window.findPath(player.x, player.y, activePartyFocusMob.x, activePartyFocusMob.y);
            player.isMoving = true;
          }
        }
      } else if (partyLeaderOp) {
        // 파티장이 타겟한 몬스터가 없으면 파티장 근처로 이동
        if (player.targetEntity && player.targetEntity.type === 'MONSTER' && player.targetEntity.ref.isDead) {
          player.targetEntity = null;
          window.clearTarget();
        }
        const dLdr = Math.hypot(partyLeaderOp.x - player.x, partyLeaderOp.y - player.y);
        if (dLdr > 125 && (!player.targetEntity || player.targetEntity.type !== 'MONSTER')) {
          const followPt = findSafeSpot(partyLeaderOp.x + 42, partyLeaderOp.y + 28);
          player.targetX = followPt.x;
          player.targetY = followPt.y;
          player.path = window.findPath(player.x, player.y, followPt.x, followPt.y);
          player.isMoving = true;
        }
      }
    } else if (!player.targetEntity || (player.targetEntity.type === 'MONSTER' && (player.targetEntity.ref.isDead || isInsideSafeZone(player.targetEntity.ref.x, player.targetEntity.ref.y)))) {
      let foundTarget = null;
      if (player.lastHitByMonster && !player.lastHitByMonster.isDead && (now - (player.lastHitByTime || 0) < 5000) && !isInsideSafeZone(player.lastHitByMonster.x, player.lastHitByMonster.y)) {
        foundTarget = player.lastHitByMonster;
      } else if (player.savedBossTarget && !player.savedBossTarget.isDead && !isInsideSafeZone(player.savedBossTarget.x, player.savedBossTarget.y)) {
        foundTarget = player.savedBossTarget;
        player.savedBossTarget = null;
      } else if (isPartyMemberNotLeader && partyLeaderOp && pMode === 'FREE') {
        // [파티 자유사냥 모드]: 파티장 근처(560px 이내)의 몬스터를 우선 사냥하고, 몬스터가 없으면 파티장 근처로 복귀!
        let minDist = Infinity;
        monsterList.forEach(m => {
          if (m.isDead || isInsideSafeZone(m.x, m.y)) return;
          const dFromLeader = Math.hypot(m.x - partyLeaderOp.x, m.y - partyLeaderOp.y);
          const dFromMe = Math.hypot(m.x - player.x, m.y - player.y);
          if (dFromLeader <= 580 && dFromMe < minDist) {
            minDist = dFromMe;
            foundTarget = m;
          }
        });
        if (!foundTarget) {
          const dLdr = Math.hypot(partyLeaderOp.x - player.x, partyLeaderOp.y - player.y);
          if (dLdr > 140) {
            const followPt = findSafeSpot(partyLeaderOp.x - 42, partyLeaderOp.y + 30);
            player.targetX = followPt.x;
            player.targetY = followPt.y;
            player.path = window.findPath(player.x, player.y, followPt.x, followPt.y);
            player.isMoving = true;
          }
        }
      } else {
        for (let searchRadius = 800; searchRadius <= 16000; searchRadius += 800) {
          let minDist = Infinity;
          monsterList.forEach(m => {
            if (m.isDead || isInsideSafeZone(m.x, m.y)) return;
            if (m._unreachableUntil && now < m._unreachableUntil) return;
            let d = Math.hypot(m.x - player.x, m.y - player.y);
            if (d <= searchRadius && d < minDist) {
              minDist = d;
              foundTarget = m;
            }
          });
          if (foundTarget) break;
        }
      }
      if (foundTarget) {
        player.targetEntity = { type: 'MONSTER', ref: foundTarget };
        player.path = window.findPath(player.x, player.y, foundTarget.x, foundTarget.y);
        player.isMoving = true;
        updateTopTargetUI(foundTarget);
      }
    }
  }

  // 6) 플레이어 체력 물약 / 마나 물약 / 힐 / 버프 자동 발동 (data.js의 cool 및 SystemConfig 실시간 반영!)
  const autoPotCfg = GameDB.SystemConfig?.autoPotion || {};
  const hpThresh = autoPotCfg.hpRatioThreshold ?? 0.70;
  const mpThresh = autoPotCfg.mpRatioThreshold ?? 0.20;
  const needSelfAutoHeal = player.hp > 0 && (player.hp / player.maxHp <= hpThresh);
  const needMercAutoHeal = mercenary.hired && !mercenary.isDead && (mercenary.hp / mercenary.maxHp <= 0.65);

  if (needSelfAutoHeal || needMercAutoHeal) {
    let hpSlot = needSelfAutoHeal ? [1, 2, 3, 4, 5, 6, 7, 8, 9].find(i => {
      const s = window.skillSlots[i];
      if (!s || s.type !== 'item') return false;
      const iDef = window.itemDict[s.itemType];
      if (!iDef || !(iDef.healHp > 0)) return false;
      return player.inventory.some(it => it && it.type === s.itemType && it.qty > 0);
    }) : null;

    if (hpSlot) {
      const hpItemDef = window.itemDict[window.skillSlots[hpSlot].itemType];
      const hpCoolMs = (typeof hpItemDef?.cool === 'number' ? hpItemDef.cool : 0.5) * 1000;
      if (now - lastHpPotionTime >= hpCoolMs) {
        window.useSlot(hpSlot, true);
      }
    } else if (now - lastAutoHealTime >= (autoPotCfg.autoHealIntervalMs || 1000)) {
      let healSlot = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(i => {
        const s = window.skillSlots[i];
        if (!s || s.type !== 'skill') return false;
        const sInfo = SKILLS_DB[player.class].find(x => x.name === s.name);
        return sInfo && isSkillLearned(sInfo) && (sInfo.type === '힐링' || s.name.includes("터치") || s.name.includes("힐") || s.name.includes("큐어"));
      });
      if (healSlot && window.useSlot(healSlot, true)) {
        lastAutoHealTime = now;
      }
    }
  }

  if (player.mp / player.maxMp <= mpThresh) {
    let mpSlot = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(i => {
      const s = window.skillSlots[i];
      if (!s || s.type !== 'item') return false;
      const iDef = window.itemDict[s.itemType];
      if (!iDef || !(iDef.healMp > 0)) return false;
      return player.inventory.some(it => it && it.type === s.itemType && it.qty > 0);
    });
    if (mpSlot) {
      const mpItemDef = window.itemDict[window.skillSlots[mpSlot].itemType];
      const mpCoolMs = (typeof mpItemDef?.cool === 'number' ? mpItemDef.cool : 0.5) * 1000;
      if (now - lastMpPotionTime >= mpCoolMs) {
        window.useSlot(mpSlot, true);
      }
    }
  }

  if (now - lastAutoBuffTime >= 800) {
    if ((player.activeBuffs.ELIXIR || 0) <= 2000) {
      let elixirSlot = [1, 2, 3, 4, 5, 6, 7, 8, 9].find(i => {
        const s = window.skillSlots[i];
        return s && s.type === 'item' && s.itemType === 'C_P05' &&
          player.inventory.some(it => it && it.type === 'C_P05' && it.qty > 0);
      });
      if (elixirSlot && window.useSlot(elixirSlot, true)) {
        lastAutoBuffTime = now;
      }
    }

   for (let i = 1; i <= 9; i++) {
      const s = window.skillSlots[i];
      if (!s || s.type !== 'skill') continue;
      if (!window.autoSlots.has(i)) continue;

  
      const sInfo = SKILLS_DB[player.class]?.find(sc => sc.name === s.name);
      const buffKey = sInfo?.buffKey || null;

      if (buffKey && (player.activeBuffs[buffKey] || 0) <= 2000) {
        if (window.useSlot(i, true)) {
          lastAutoBuffTime = now;
          break;
        }
      }
    }
  }

  // 7) 용병 스마트 AI 업데이트
  updateMercenaryAI(delta, now, inSafe);

  // 8) 몬스터 AI & 서버 권위 위치 보간 (서버 연결 시 클라이언트는 서버 좌표를 60FPS로 부드럽게 보간 렌더링만 수행!)
  if (isServerAuthoritativeMode()) {
    monsterList.forEach(m => {
      if (m.isDead) return;
      if (typeof m.serverX === 'number' && typeof m.serverY === 'number') {
        const dx = m.serverX - m.x;
        const dy = m.serverY - m.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 380) {
          m.x = m.serverX;
          m.y = m.serverY;
        } else if (dist > 0.20) {
          // 100ms(6프레임) 틱 간격을 끊김 없이 이어주는 상용 MMORPG 등속 글라이드 보간
          const targetSpd = (m._interpSpeed || (m.isBoss ? 1.82 : 1.45)) + Math.max(0, (dist - 12) * 0.08);
          const baseGlide = Math.min(dist, targetSpd * delta);
          m.x += (dx / dist) * baseGlide;
          m.y += (dy / dist) * baseGlide;
        }
      }
    });
  } else {
  monsterList.forEach(m => {
    if (m.isDead) {
      m.respawnTimer -= (delta / 60);
      if (m.respawnTimer <= 0) {
        const safeSpawn = findSafeSpot(m.spawnX, m.spawnY);
        m.isDead = false;
        m.hp = m.maxHp;
        m.mp = m.maxMp;
        m.x = safeSpawn.x;
        m.y = safeSpawn.y;
        m.targetX = safeSpawn.x;
        m.targetY = safeSpawn.y;
        m.stunUntil = 0;
        m.defDownUntil = 0;
        if (m.isBoss) {
          bossRespawnTimer = 0;
          window.addChat(`👑 [보스 출현] '${m.name}'이(가) 성역에 다시 나타났습니다!`, 'log-kill');
        }
      }
      return;
    }

    if (m.stunUntil && now < m.stunUntil) return;

    let distToPlayer = Math.hypot(player.x - m.x, player.y - m.y);
    let distToMerc = (mercenary.hired && !mercenary.isDead) ? Math.hypot(mercenary.x - m.x, mercenary.y - m.y) : Infinity;
    let distFromSpawn = Math.hypot(m.x - m.spawnX, m.y - m.spawnY);
    let isMagicAttack = m.maxMp > 0 && m.mp >= 10;
    let mobAtkRange = isMagicAttack ? 160 : 52;

    let isProvoked = !inSafe && ((m.hp < m.maxHp) || (m.isAggro && Math.min(distToPlayer, distToMerc) < 260));
    if (isProvoked && distFromSpawn < 560) {
      const targetMerc = (mercenary.hired && !mercenary.isDead) && (distToMerc < distToPlayer * 0.85 || (mercenary.class === 'knight' && distToMerc < 140));
      const targetX = targetMerc ? mercenary.x : player.x;
      const targetY = targetMerc ? mercenary.y : player.y;
      const targetDist = targetMerc ? distToMerc : distToPlayer;

      // 🌟 보스 전용 장판 예고(Telegraph) & 어두운 심연 마법진 시전 패턴 (8~10초 주기, 1.5초 예고 후 대폭발)
      if (m.isBoss && targetDist <= 380) {
        if (!m.lastTelegraphTime) m.lastTelegraphTime = now - 5000;
        if (now - m.lastTelegraphTime >= 9000) {
          m.lastTelegraphTime = now;
          const tgRadius = 165;
          bossTelegraphs.push({
            boss: m,
            x: targetX,
            y: targetY,
            radius: tgRadius,
            startTime: now,
            duration: 1500
          });
          // 시전자(보스) 중심 어두운 고레벨 마법진 + 타겟 바닥 1.5초 예고 장판 동시 생성!
          activeEffects.push({
            type: 'magic_circle',
            x: m.x,
            y: m.y + 6,
            casterRef: m,
            aoeRadius: 115,
            isBossCircle: true,
            life: 90,
            maxLife: 90,
            skillName: '보스 심연 마법진'
          });
          activeEffects.push({
            type: 'boss_telegraph',
            x: targetX,
            y: targetY,
            aoeRadius: tgRadius,
            life: 90,
            maxLife: 90
          });
          SoundSystem.playSkill('카오스 필드', 'wizard', 6, true);
          floatingTexts.push({ x: m.x, y: m.y - 62, text: `⚠️ 보스 광역기 예고! (1.5초)`, color: 0xf43f5e, life: 45 });
        }
      }

      if (targetDist > mobAtkRange) {
        let angle = Math.atan2(targetY - m.y, targetX - m.x);
        let step = (m.isBoss ? 1.82 : 1.45) * delta;
        const steer = findOpenSteerPoint(m.x, m.y, angle, step, true);
        if (steer) {
          m.x = steer.x;
          m.y = steer.y;
        }
      } else if (now - m.lastAtkTime > 1350) {
        m.lastAtkTime = now;
        m.atkAngle = Math.atan2(targetY - m.y, targetX - m.x);

        if (targetMerc) {
          mercenary.attackerMonster = m;
          mercenary.lastCombatTime = now;
          const ms = calculateMercCombatStats();
          const lvGap = Math.max(0, (m.lv || 1) - mercenary.level);
          let rawMobAtk = m.atk * (isMagicAttack ? 1.1 : 1.0) * (1 + lvGap * 0.10);
          let dmg = calcMonsterDamageToDefender(rawMobAtk, ms.totalDef, m.lv || 1, m.isBoss, ms.dmgReducePct, ms.bossDmgReducePct, false, isMagicAttack, ms.totalMDef || 0);
          if ((mercenary.activeBuffs?.IMMUNE || 0) > 0) dmg = Math.max(2, Math.floor(dmg * 0.55));
          mercenary.hp = Math.max(0, mercenary.hp - dmg);
      mercenary.lastHitTime = now;
      mercenary.lastHitAngle = (m?.atkAngle ?? msg?.atkAngle ?? 0);
          if (m.isBoss || isMagicAttack) {
            activeEffects.push({
              type: 'magic_circle',
              x: m.x,
              y: m.y + 11,
              casterRef: m,
              aoeRadius: m.isBoss ? 92 : 54,
              isBossCircle: Boolean(m.isBoss),
              life: 55,
              maxLife: 55,
              skillName: m.skill || '보스 심연 마법진'
            });
          }
          activeEffects.push({
            type: 'hit_particle',
            targetType: 'mercenary',
            x: mercenary.x,
            y: mercenary.y,
            hitAngle: m.atkAngle || 0,
            hasDirection: true,
            dmgType: isMagicAttack ? 'magic' : 'melee',
            isCrit: Boolean(m.isBoss),
            life: 20,
            maxLife: 20
          });
          floatingTexts.push({ x: mercenary.x, y: mercenary.y - 40, text: `-${dmg}`, color: 0xfb923c, life: 28 });

          if (mercenary.hp <= 0) {
            mercenary.isDead = true;
            mercenary.targetMonster = null;
            mercenary.attackerMonster = null;
            window.addChat(`💀 [용병 전사] '${mercenary.name}' 용병이 전투 불능 상태가 되었습니다! (용병단장 카셀에게서 부활 가능)`, 'log-hit');
          }
          window.updateMercHUD();
          return;
        }

        // 🌟 몬스터가 플레이어를 타격 -> 나를 때린 몬스터를 최우선 반격 타겟으로 지정!
        // (보스전 도중 일반 몬스터에게 맞으면 보스를 savedBossTarget에 기억해두고 때린 일반몹을 먼저 처치 후 보스로 복귀!)
        player.lastCombatTime = now;
        player.lastHitByMonster = m;
        player.lastHitByTime = now;

        const isLockedPartyFocus = Boolean(
          window.isAutoAttack &&
          window.partyState &&
          window.partyState.leaderCharId &&
          window.partyState.leaderCharId !== activeCharacterId &&
          (window.partyAutoHuntMode || window.partyState.partyMode) === 'FOCUS' &&
          player.targetEntity?.type === 'MONSTER' &&
          player.targetEntity.ref &&
          !player.targetEntity.ref.isDead
        );

        if (!player.manualMoving && !isLockedPartyFocus) {
          const curTargetMob = (player.targetEntity && player.targetEntity.type === 'MONSTER' && !player.targetEntity.ref.isDead)
            ? player.targetEntity.ref
            : null;
          if (!curTargetMob) {
            player.targetEntity = { type: 'MONSTER', ref: m };
            updateTopTargetUI(m);
          } else if (curTargetMob !== m) {
            if (curTargetMob.isBoss && !m.isBoss) {
              // 보스를 치는 중 부하/일반 몬스터가 플레이어를 때리면 보스를 기억해 두고 때린 일반몹부터 즉시 처치!
              player.savedBossTarget = curTargetMob;
              player.targetEntity = { type: 'MONSTER', ref: m };
              player.path = [];
              updateTopTargetUI(m);
            } else if (!curTargetMob.isBoss) {
              const distToCur = Math.hypot(curTargetMob.x - player.x, curTargetMob.y - player.y);
              const myAtkRange = getPlayerAttackRange();
              // 현재 타겟이 사거리 밖에 있거나, 원거리 카이팅 도중 다른 몬스터에게 맞았을 때 즉시 때린 몬스터로 타겟 전환!
              if (distToCur > myAtkRange || player.class === 'wizard' || player.class === 'ranger') {
                player.targetEntity = { type: 'MONSTER', ref: m };
                player.path = [];
                updateTopTargetUI(m);
              }
            }
          }
        }

        if (isMagicAttack || m.isBoss) {
          if (isMagicAttack) m.mp = Math.max(0, m.mp - 12);
          activeEffects.push({
            type: 'magic_circle',
            x: m.x,
            y: m.y + 11,
            casterRef: m,
            aoeRadius: m.isBoss ? 95 : 54,
            isBossCircle: Boolean(m.isBoss),
            life: 58,
            maxLife: 58,
            skillName: m.skill || '보스 심연 마법진'
          });
          if (isMagicAttack) {
            activeEffects.push({ type: 'wizard', x: player.x, y: player.y, casterRef: m, life: 22, maxLife: 22, skillName: m.skill || '파이어' });
          }
        }

        const cStats = calculateCombatStats(false);

        if (player.activeBuffs.COUNTER > 0) {
          player.activeBuffs.COUNTER = 0;
          floatingTexts.push({ x: player.x, y: player.y - 45, text: `⚔️ COUNTER!`, color: 0xfacc15, life: 32 });
          window.applyDamage(m, Math.floor(cStats.totalAtk * 2.5), 'melee', { attacker: 'player', forceCrit: true });
          return;
        }

        if (player.activeBuffs.ABSOLUTE_BARRIER > 0) {
          floatingTexts.push({ x: player.x, y: player.y - 45, text: `🌟 IMMUNE!`, color: 0xfde047, life: 30 });
          return;
        }

        const lvGap = Math.max(0, (m.lv || 1) - player.level);
        const effEvade = Math.max(2, cStats.evadeRate - lvGap * 3);
        const effBlock = Math.max(0, cStats.blockRate - lvGap * 2);

        if (Math.random() * 100 < effEvade) {
          SoundSystem.playPhysicalHit(player.class, 'dodge');
          floatingTexts.push({ x: player.x, y: player.y - 45, text: `💨 DODGE!`, color: 0x38bdf8, life: 30 });
        } else if (Math.random() * 100 < effBlock) {
          SoundSystem.playPhysicalHit(player.class, 'block');
          player.blockTime = now + 400;
          floatingTexts.push({ x: player.x, y: player.y - 45, text: `🛡️ BLOCK!`, color: 0xfacc15, life: 30 });
        } else {
          SoundSystem.playPhysicalHit(player.class, 'hit');
          let rawMobAtk = m.atk * (isMagicAttack ? 1.12 : 1.0) * (1 + lvGap * 0.11);
          let dmg = calcMonsterDamageToDefender(rawMobAtk, cStats.totalDef, m.lv || 1, m.isBoss, cStats.dmgReducePct, cStats.bossDmgReducePct, true, isMagicAttack, cStats.totalMDef || 0);

          if (player.activeBuffs.IMMUNE > 0) dmg = Math.max(2, Math.floor(dmg * 0.55));
          if (player.activeBuffs.MANA_SHIELD > 0 && player.mp >= Math.ceil(dmg * 0.5)) {
            const mpAbsorb = Math.floor(dmg * 0.5);
            player.mp -= mpAbsorb;
            dmg -= mpAbsorb;
          }

          player.hp = Math.max(0, player.hp - dmg);
      player.lastHitTime = now;
      player.lastHitAngle = (m?.atkAngle ?? msg?.atkAngle ?? 0);
      window.triggerCameraShake?.(2.2, 95);
          activeEffects.push({
            type: 'hit_particle',
            targetType: 'player',
            x: player.x,
            y: player.y,
            hitAngle: m.atkAngle || 0,
            hasDirection: true,
            dmgType: isMagicAttack ? 'magic' : 'melee',
            isCrit: Boolean(m.isBoss),
            life: 22,
            maxLife: 22
          });
          floatingTexts.push({ x: player.x, y: player.y - 40, text: `-${dmg}`, color: 0xf87171, life: 30 });
          updateStatusHUD();

          if (player.hp <= 0) {
            player.hp = player.maxHp;
            player.mp = player.maxMp;
            window.addChat(`💀 [사망] 전투 불능 상태가 되어 마을 정중앙 안전지대로 후송되었습니다.`, 'log-hit');
            useReturnScroll();
            updateStatusHUD();
          }
        }
      }
    } else {
      if (m.maxMp > 0 && m.mp < m.maxMp) m.mp = Math.min(m.maxMp, m.mp + 0.1 * delta);
      if (Math.random() < 0.015) {
        m.targetX = m.spawnX + (Math.random() * 160 - 80);
        m.targetY = m.spawnY + (Math.random() * 160 - 80);
      }
      let dTarget = Math.hypot(m.targetX - m.x, m.targetY - m.y);
      if (dTarget > 5) {
        let angle = Math.atan2(m.targetY - m.y, m.targetX - m.x);
        let nx = m.x + Math.cos(angle) * 0.65 * delta;
        let ny = m.y + Math.sin(angle) * 0.65 * delta;
        if (!checkCollision(nx, ny) && !isInsideSafeZone(nx, ny)) {
          m.x = nx;
          m.y = ny;
        }
      }
    }
  });

  // 8-B) 보스 예고 장판(Telegraph) 1.5초 경과 시 광역 폭발 판정 처리
  for (let i = bossTelegraphs.length - 1; i >= 0; i--) {
    const tg = bossTelegraphs[i];
    if (!tg.boss || tg.boss.isDead) {
      bossTelegraphs.splice(i, 1);
      continue;
    }
    if (now - tg.startTime >= tg.duration) {
      bossTelegraphs.splice(i, 1);
      SoundSystem.playSkill('미티어 스웜', 'wizard', 6, false);
      activeEffects.push({
        type: 'wizard',
        x: tg.x,
        y: tg.y,
        life: 38,
        maxLife: 38,
        skillName: '카오스 필드',
        isAoe: true,
        aoeRadius: tg.radius
      });

      // 플레이어 피격 여부 체크
      if (!inSafe && Math.hypot(player.x - tg.x, player.y - tg.y) <= tg.radius) {
        if (player.activeBuffs.ABSOLUTE_BARRIER > 0) {
          floatingTexts.push({ x: player.x, y: player.y - 48, text: `🌟 무적방어!`, color: 0xfde047, life: 32 });
        } else {
          const cStats = calculateCombatStats(false);
          const lvGap = Math.max(0, (tg.boss.lv || 1) - player.level);
          const rawBossAoe = tg.boss.atk * 1.48 * (1 + lvGap * 0.10);
          let aoeDmg = calcMonsterDamageToDefender(rawBossAoe, cStats.totalDef, tg.boss.lv || 1, true, cStats.dmgReducePct, cStats.bossDmgReducePct, true, true, cStats.totalMDef || 0);
          if (player.activeBuffs.IMMUNE > 0) aoeDmg = Math.max(5, Math.floor(aoeDmg * 0.55));
          player.hp = Math.max(0, player.hp - aoeDmg);
          SoundSystem.playPhysicalHit(player.class, 'hit');
          activeEffects.push({
            type: 'hit_particle',
            targetType: 'player',
            x: player.x,
            y: player.y,
            hitAngle: Math.atan2(player.y - tg.y, player.x - tg.x),
            hasDirection: true,
            dmgType: 'magic',
            isCrit: true,
            life: 26,
            maxLife: 26
          });
          floatingTexts.push({ x: player.x, y: player.y - 48, text: `💥광역피격 -${aoeDmg}`, color: 0xef4444, life: 38 });
          updateStatusHUD();
          if (player.hp <= 0) {
            player.hp = player.maxHp;
            player.mp = player.maxMp;
            window.addChat(`💀 [사망] 보스의 광역 마법에 휩쓸려 마을 안전지대로 후송되었습니다.`, 'log-hit');
            useReturnScroll();
          }
        }
      }

      // 용병 피격 여부 체크
      if (mercenary.hired && !mercenary.isDead && !inSafe) {
        if (Math.hypot(mercenary.x - tg.x, mercenary.y - tg.y) <= tg.radius) {
          const ms = calculateMercCombatStats();
          const rawBossAoe = tg.boss.atk * 1.35;
          let mDmg = calcMonsterDamageToDefender(rawBossAoe, ms.totalDef, tg.boss.lv || 1, true, ms.dmgReducePct, ms.bossDmgReducePct, false, true, ms.totalMDef || 0);
          mercenary.hp = Math.max(0, mercenary.hp - mDmg);
          activeEffects.push({
            type: 'hit_particle',
            targetType: 'mercenary',
            x: mercenary.x,
            y: mercenary.y,
            hitAngle: Math.atan2(mercenary.y - tg.y, mercenary.x - tg.x),
            hasDirection: true,
            dmgType: 'magic',
            isCrit: true,
            life: 24,
            maxLife: 24
          });
          floatingTexts.push({ x: mercenary.x, y: mercenary.y - 48, text: `💥-${mDmg}`, color: 0xfb923c, life: 32 });
          if (mercenary.hp <= 0) {
            mercenary.isDead = true;
            window.addChat(`💀 [용병 전사] 보스의 광역기에 '${mercenary.name}' 용병이 쓰러졌습니다!`, 'log-hit');
          }
          window.updateMercHUD();
        }
      }
    }
  }
  } // end of offline local monster AI fallback

  // 9) 플레이어 타겟 추적 + 마법사/엘프궁수 원형 카이팅(Circle-Strafing) & 근접 회피 기동
  let didPlayerMoveByKiting = false;
  if (player.targetEntity) {
    let t = player.targetEntity;
    if (t.type === 'MONSTER') {
      if (t.ref.isDead) {
        if (player.savedBossTarget && !player.savedBossTarget.isDead) {
          player.targetEntity = { type: 'MONSTER', ref: player.savedBossTarget };
          player.savedBossTarget = null;
          updateTopTargetUI(player.targetEntity.ref);
        } else {
          window.clearTarget();
        }
      } else {
        let atkRange = getPlayerAttackRange();
        let dist = Math.hypot(t.ref.x - player.x, t.ref.y - player.y);
        const atkInterval = getAttackInterval();
        const isRangedClass = (player.class === 'ranger' || player.class === 'wizard');

        // 주변에 플레이어에게 너무 가까이(130px 이내) 붙은 위협 몬스터 확인
        let closestThreat = t.ref;
        let closestThreatDist = dist;
        if (isRangedClass) {
          monsterList.forEach(m => {
            if (m.isDead || isInsideSafeZone(m.x, m.y)) return;
            const d = Math.hypot(m.x - player.x, m.y - player.y);
            if (d < closestThreatDist && d < 135) {
              closestThreatDist = d;
              closestThreat = m;
            }
          });
        }

        if (isRangedClass && dist <= atkRange + 15 && !player.manualMoving) {
          // 공격 쿨타임이 돌아왔으면 즉시 스킬 또는 평타 발사 (타겟 유지!)
          if (now - player.lastAttackTime >= atkInterval) {
            let bestSlot = getBestSkillForTarget(t.ref);
            if (!bestSlot || !window.useSlot(bestSlot, true)) {
              window.handleBasicAttack();
            }
          } else if (closestThreatDist < 138) {
            // 🌟 [어지러움 방지 스마트 카이팅]
            // 몬스터가 안전거리(138px 이상)에 있을 때는 불필요하게 원을 돌지 않고 제자리에서 안정 사격(Stand & Shoot)하며,
            // 몬스터가 138px 이내로 근접했을 때만 부드럽게 거리를 벌리는 완충 카이팅을 수행합니다!
            player.isMoving = false;
            player.path = [];

            const radialAngle = Math.atan2(player.y - closestThreat.y, player.x - closestThreat.x);
            let moveAngle;
            if (closestThreatDist < 105) {
              // 근접 위협 시 후방 대각선으로 부드럽게 거리 확보
              moveAngle = radialAngle + (player.orbitDir || 1) * 0.55;
            } else {
              // 완만한 원형 접선 이동
              moveAngle = radialAngle + (player.orbitDir || 1) * 1.15;
            }

            // 헤이스트(+30%)·홀리워크(+50%) 상태에서도 카이팅 보행 속도가 과도하게 튀지 않도록 상한 완충
            const kiteSpeed = (GameOptions?.smoothCamera !== false)
              ? Math.min(player.speed * 0.78, 2.35)
              : player.speed * 0.85;
            const step = kiteSpeed * delta;
            let nx = player.x + Math.cos(moveAngle) * step;
            let ny = player.y + Math.sin(moveAngle) * step;

            if (checkCollision(nx, ny) || isInsideSafeZone(nx, ny)) {
              if (now - (player.lastOrbitSwitch || 0) > 350) {
                player.orbitDir = -(player.orbitDir || 1);
                player.lastOrbitSwitch = now;
              }
              const altSteer = findOpenSteerPoint(player.x, player.y, radialAngle + player.orbitDir * 1.1, step, true);
              if (altSteer) {
                nx = altSteer.x;
                ny = altSteer.y;
              }
            }

            if (!checkCollision(nx, ny) && !isInsideSafeZone(nx, ny)) {
              player.x = nx;
              player.y = ny;
              player.isWalking = true;
              didPlayerMoveByKiting = true;
              if (now - (player.lastDirChangeTime || 0) > 180) {
                player.lastDirChangeTime = now;
                let dx = t.ref.x - player.x;
                let dy = t.ref.y - player.y;
                if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
                else player.dir = dy > 0 ? 'down' : 'up';
              }
            }
          } else {
            // 안전 사거리 확보 중일 때는 제자리에서 차분히 타겟을 바라보며 연속 사격 (화면 회전 멀미 원천 차단!)
            player.isWalking = false;
          }
        } else if (dist <= atkRange) {
          player.isMoving = false;
          player.isWalking = false;
          player.path = [];
          let bestSlot = getBestSkillForTarget(t.ref);
          if (bestSlot && now - player.lastAttackTime >= atkInterval) {
            if (!window.useSlot(bestSlot, true)) {
              window.handleBasicAttack();
            }
          } else {
            window.handleBasicAttack();
          }
        } else if (!player.isMoving || player.path.length === 0) {
          player.path = window.findPath(player.x, player.y, t.ref.x, t.ref.y);
          player.isMoving = true;
        }
      }
    } else if (t.type === 'NPC') {
      if (Math.hypot(t.ref.x - player.x, t.ref.y - player.y) < 130) {
        player.isMoving = false;
        player.isWalking = false;
        player.path = [];
        window.openNpcModal(t.ref);
        player.targetEntity = null;
      }
    } else if (t.type === 'ITEM') {
      if (!itemList.includes(t.ref)) {
        player.targetEntity = null;
        player.isMoving = false;
        player.path = [];
      } else if (Math.hypot(t.ref.x - player.x, t.ref.y - player.y) < 68) {
        pickupItem(t.ref);
        player.targetEntity = null;
        player.isMoving = false;
        player.path = [];
      } else if (!player.isMoving || player.path.length === 0) {
        player.path = window.findPath(player.x, player.y, t.ref.x, t.ref.y);
        player.isMoving = true;
      }
    }
  }

  // 9-B) 파티장이고 점사 모드(FOCUS)일 때 플레이어의 현재 타겟 몬스터가 변경되면 즉시 파티원(AI 포함)에게 브로드캐스트하여 딜레이 없는 일제 점사 보장!
  if (window.partyState && window.partyState.partyId && window.partyState.leaderCharId === activeCharacterId) {
    const curPtyMode = window.partyAutoHuntMode || window.partyState.partyMode || 'FREE';
    const curLeaderMobId = (player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref && !player.targetEntity.ref.isDead)
      ? player.targetEntity.ref.id
      : null;
    if (window.partyState.leaderTargetMobId !== curLeaderMobId) {
      window.partyState.leaderTargetMobId = curLeaderMobId;
      if (curPtyMode === 'FOCUS' && now - (window._lastLeaderFocusSyncTs || 0) >= 75) {
        window._lastLeaderFocusSyncTs = now;
        sendCentralWsPacket({
          type: 'PARTY_MODE_REQ',
          charId: activeCharacterId,
          partyMode: 'FOCUS',
          leaderTargetMobId: curLeaderMobId
        });
      }
    }
  }

  // 10) 드롭 아이템 획득 및 60초 후 자동 소멸
  for (let i = itemList.length - 1; i >= 0; i--) {
    const it = itemList[i];
    if (!isServerAuthoritativeMode() && it.spawnTime && now - it.spawnTime >= 60000) {
      destroyItemGraphics(it);
      itemList.splice(i, 1);
      continue;
    }
    const lootRadius = window.isAutoAttack ? 68 : 42;
    if (Math.hypot(it.x - player.x, it.y - player.y) < lootRadius && shouldLootItem(it, window.itemDict)) {
      pickupItem(it);
    }
  }

  // 🌟 10-B) 전 클래스 공통: 이동/자동사냥 중 충돌체·몬스터·지형에 끼여 한자리에 고정되면 즉시 다른 이동 경로를 탐색하고 필요 시 타겟 전환!
  const isTryingToMove = (player.isMoving && player.path.length > 0) ||
    (window.isAutoAttack && player.targetEntity?.type === 'MONSTER' && Math.hypot(player.targetEntity.ref.x - player.x, player.targetEntity.ref.y - player.y) > getPlayerAttackRange());

  if (isTryingToMove) {
    player.stuckTimer = (player.stuckTimer || 0) + (delta / 60) * 1000;
    if (player.stuckTimer >= 380) {
      const movedDist = Math.hypot(player.x - (player.stuckCheckX || player.x), player.y - (player.stuckCheckY || player.y));
      player.stuckCheckX = player.x;
      player.stuckCheckY = player.y;
      player.stuckTimer = 0;

      if (movedDist < 15) {
        player.stuckCount = (player.stuckCount || 0) + 1;
        const goalX = player.targetEntity?.ref?.x ?? player.targetX;
        const goalY = player.targetEntity?.ref?.y ?? player.targetY;
        const baseAng = Math.atan2(goalY - player.y, goalX - player.x);
        player.orbitDir = -(player.orbitDir || 1);

        // 자동사냥 중 동일 몬스터를 향해 3회 이상 연속 끼였을 경우: 해당 몬스터를 5초간 우회 블랙리스트 처리하고 다른 타겟/우회로 모색!
        if (window.isAutoAttack && player.targetEntity?.type === 'MONSTER' && player.stuckCount >= 3) {
          const stuckMob = player.targetEntity.ref;
          if (stuckMob) stuckMob._unreachableUntil = now + 5000;
          player.stuckCount = 0;
          player.targetEntity = null;
          window.clearTarget();
        }

        const candidateRadii = [110, 165, 220];
        const angleOffsets = [
          player.orbitDir * 1.15,
          -player.orbitDir * 1.15,
          player.orbitDir * 1.75,
          -player.orbitDir * 1.75,
          player.orbitDir * 2.35,
          -player.orbitDir * 2.35,
          Math.PI,
          player.orbitDir * 0.65,
          -player.orbitDir * 0.65
        ];
        let detourPt = null;
        for (const rad of candidateRadii) {
          for (const off of angleOffsets) {
            const dAng = baseAng + off;
            const tx = player.x + Math.cos(dAng) * rad;
            const ty = player.y + Math.sin(dAng) * rad;
            if (
              !checkCollision(tx, ty, 6) &&
              !checkUnitCollision(tx, ty, player, player.targetEntity?.ref) &&
              (!window.isAutoAttack || !isInsideSafeZone(tx, ty))
            ) {
              // 중간 지점도 막혀있지 않은지 확인
              const midX = (player.x + tx) * 0.5;
              const midY = (player.y + ty) * 0.5;
              if (!checkCollision(midX, midY, 4)) {
                detourPt = { x: Math.round(tx), y: Math.round(ty) };
                break;
              }
            }
          }
          if (detourPt) break;
        }
        if (!detourPt) {
          detourPt = findSafeSpot(player.x + (Math.random() * 200 - 100), player.y + (Math.random() * 200 - 100));
        }
        const astarDetour = window.findPath(detourPt.x, detourPt.y, goalX, goalY);
        player.path = [detourPt, ...(Array.isArray(astarDetour) ? astarDetour : [{ x: goalX, y: goalY }])];
        player.isMoving = true;
      } else {
        player.stuckCount = 0;
      }
    }
  } else {
    player.stuckTimer = 0;
    player.stuckCount = 0;
    player.stuckCheckX = player.x;
    player.stuckCheckY = player.y;
  }

  // 🕹️ 가상 조이스틱 드래그 이동 처리 (좌측 하단 터치 후 드래그 시 실시간 360도 부드러운 이동)
  if (joystickState.active && joystickState.power > 0.08) {
    const joyStep = player.speed * Math.max(0.35, joystickState.power) * delta;
    const jx = Math.cos(joystickState.angle);
    const jy = Math.sin(joystickState.angle);
    if (Math.abs(jx) > Math.abs(jy)) player.dir = jx > 0 ? 'right' : 'left';
    else player.dir = jy > 0 ? 'down' : 'up';

    const nx = player.x + jx * joyStep;
    const ny = player.y + jy * joyStep;
    if (!checkCollision(nx, ny)) {
      player.x = nx;
      player.y = ny;
      player.isWalking = true;
    } else {
      const steer = findOpenSteerPoint(player.x, player.y, joystickState.angle, joyStep, false);
      if (steer) {
        player.x = steer.x;
        player.y = steer.y;
        player.isWalking = true;
      }
    }
  } else if (!didPlayerMoveByKiting && player.isMoving && player.path.length > 0) {
    let nextPt = player.path[0];
    let dx = nextPt.x - player.x;
    let dy = nextPt.y - player.y;
    let dist = Math.hypot(dx, dy);

    if (Math.abs(dx) > Math.abs(dy)) player.dir = dx > 0 ? 'right' : 'left';
    else player.dir = dy > 0 ? 'down' : 'up';

    let step = player.speed * delta;
    if (dist <= step) {
      if (!checkCollision(nextPt.x, nextPt.y)) {
        player.x = nextPt.x;
        player.y = nextPt.y;
      }
      player.path.shift();
      if (player.path.length === 0) {
        player.isMoving = false;
        player.isWalking = false;
        player.manualMoving = false;
      }
    } else {
      const moveAng = Math.atan2(dy, dx);
      let nx = player.x + (dx / dist) * step;
      let ny = player.y + (dy / dist) * step;
      const targetMobRef = player.targetEntity?.type === 'MONSTER' ? player.targetEntity.ref : null;
      if (!checkCollision(nx, ny) && !checkUnitCollision(nx, ny, player, targetMobRef)) {
        player.x = nx;
        player.y = ny;
        player.isWalking = true;
      } else {
        const steer = findOpenSteerPoint(player.x, player.y, moveAng, step, window.isAutoAttack, player);
        if (steer) {
          player.x = steer.x;
          player.y = steer.y;
          player.isWalking = true;
        } else {
          player.isMoving = false;
          player.isWalking = false;
          player.manualMoving = false;
          player.path = [];
        }
      }
    }
  } else if (!((player.class === 'ranger' || player.class === 'wizard') && player.targetEntity?.type === 'MONSTER')) {
    player.isWalking = false;
  }

  // 플레이어·몬스터·타플레이어 간 충돌 분리(겹침 방지) 수행
  resolveClientEntitySeparation(delta);

  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    if (!p.target) {
      projectiles.splice(i, 1);
      continue;
    }
    if (!p.target.isDead && typeof p.target.x === 'number' && typeof p.target.y === 'number') {
      p.lastTargetX = p.target.x;
      p.lastTargetY = p.target.y;
    } else if (p.target.isDead) {
      // 타겟 몬스터가 비행 도중 사망하더라도 타 플레이어 투사체(visualOnly)나 스킬 투사체는 목표 지점까지 끝까지 날아가 폭발 이펙트를 표현!
      if (p.visualOnly || p.skillName) {
        p.visualOnly = true;
        p.target = {
          x: p.lastTargetX ?? p.target.x ?? p.x,
          y: p.lastTargetY ?? p.target.y ?? p.y,
          isDead: false
        };
      } else {
        projectiles.splice(i, 1);
        continue;
      }
    }

    let dx = p.target.x - p.x;
    let dy = (p.target.y - 15) - p.y;
    let dist = Math.hypot(dx, dy);
    let step = p.speed * delta;

    if (dist <= step) {
      if (p.visualOnly) {
        if (p.skillName) {
          const hitRadius = p.aoeRadius || 155;
          const effLife = p.isAoe ? 38 : 28;
          const effClass = p.type === 'arrow' ? 'ranger' : 'wizard';
          activeEffects.push({
            type: effClass,
            x: p.target.x,
            y: p.target.y,
            startX: p.startX ?? p.x,
            startY: p.startY ?? p.y,
            skyStartY: p.isSkyDrop ? p.startY : ((typeof camera !== 'undefined' && typeof camera.y === 'number') ? camera.y - 95 : p.target.y - 500),
            casterRef: p.casterRef || null,
            life: effLife,
            maxLife: effLife,
            skillName: p.skillName,
            isAoe: Boolean(p.isAoe),
            aoeRadius: p.isAoe ? hitRadius : 68
          });
        } else {
          // 타 플레이어/용병의 일반 원거리 화살·마법탄 적중 시에도 타격 스파크 표시
          activeEffects.push({
            type: 'hit_particle',
            targetType: 'monster',
            x: p.target.x,
            y: p.target.y,
            hitAngle: Math.atan2(dy, dx),
            hasDirection: true,
            dmgType: p.type === 'magic' ? 'magic' : 'melee',
            isCrit: false,
            life: 16,
            maxLife: 16
          });
        }
        projectiles.splice(i, 1);
        continue;
      }
      const hitRadius = p.aoeRadius || 155;
      const dmgTypeStr = p.type === 'magic' ? 'magic' : 'melee';
      if (p.isAoe) {
        const limit = p.maxTargets || 5;
        const hitMons = [];
        monsterList.forEach(m => {
          if (!m.isDead && hitMons.length < limit && Math.hypot(m.x - p.target.x, m.y - p.target.y) <= hitRadius) {
            hitMons.push(m);
          }
        });
        if (hitMons.length > 0) {
          window.applyDamageBatch(hitMons, p.dmg, dmgTypeStr, p.opts || {});
        }
      } else {
        window.applyDamageBatch([p.target], p.dmg, dmgTypeStr, p.opts || {});
      }
      if (p.skillName) {
        const effLife = p.isAoe ? 38 : 28;
        const effClass = p.type === 'arrow' ? 'ranger' : 'wizard';
        activeEffects.push({
          type: effClass,
          x: p.target.x,
          y: p.target.y,
          startX: p.startX ?? player.x,
          startY: p.startY ?? (player.y - 15),
          skyStartY: p.isSkyDrop ? p.startY : ((typeof camera !== 'undefined' && typeof camera.y === 'number') ? camera.y - 95 : p.target.y - 500),
          casterRef: p.casterRef || player,
          life: effLife,
          maxLife: effLife,
          skillName: p.skillName,
          isAoe: Boolean(p.isAoe),
          aoeRadius: p.isAoe ? hitRadius : 68
        });
      }
      projectiles.splice(i, 1);
    } else {
      p.x += (dx / dist) * step;
      p.y += (dy / dist) * step;
    }
  }

  // 🎥 [카메라 3단계 시야 배율(자동/수동) & 스마트 시점 추적]
  // - data.js의 GameDB.SystemConfig.camera.stages 3단계 배율을 참조하여 지금보다 한결 넓은 시야 제공
  // - 자동조정(cameraAutoZoom) 시: 마을(1단계 0.86) -> 일반 사냥/이동(2단계 0.74) -> 보스전/다수 교전(3단계 0.63) 자동 전환
  // - 터치/조이스틱 이동 시 화면이 멈추지 않고 즉시 부드럽게 따라가도록 데드존 제거 및 보간 최적화
  const camStages = GameDB.SystemConfig?.camera?.stages || [
    { stage: 1, scale: 0.86 },
    { stage: 2, scale: 0.74 },
    { stage: 3, scale: 0.63 }
  ];
  let desiredStage = GameOptions?.cameraStage || 2;
  if (GameOptions?.cameraAutoZoom !== false) {
    const nearMobCnt = monsterList.filter(m => !m.isDead && Math.hypot(m.x - player.x, m.y - player.y) <= 280).length;
    const isBossNear = monsterList.some(m => !m.isDead && m.isBoss && Math.hypot(m.x - player.x, m.y - player.y) <= 500);
    if (inSafe) desiredStage = 1;
    else if (isBossNear || nearMobCnt >= 4) desiredStage = 3;
    else desiredStage = 2;
  }
  const stageObj = camStages.find(s => s.stage === desiredStage) || camStages[1] || { scale: 0.74 };
  const targetZoom = stageObj.scale || 0.74;
  if (!camera.zoom) camera.zoom = targetZoom;
  else camera.zoom += (targetZoom - camera.zoom) * Math.min(1, 0.06 * delta);

  cameraContainer.scale.set(camera.zoom);

  let screenW = app.renderer.width / app.renderer.resolution;
  let screenH = app.renderer.height / app.renderer.resolution;
  let viewW = screenW / camera.zoom;
  let viewH = screenH / camera.zoom;

  if (GameOptions?.smoothCamera !== false) {
    let focusX = player.x;
    let focusY = player.y;
    if (!joystickState.active && !player.manualMoving && player.targetEntity?.type === 'MONSTER' && player.targetEntity.ref && !player.targetEntity.ref.isDead) {
      const mob = player.targetEntity.ref;
      const distMob = Math.hypot(mob.x - player.x, mob.y - player.y);
      if (distMob <= 320) {
        focusX = player.x * 0.76 + mob.x * 0.24;
        focusY = player.y * 0.76 + mob.y * 0.24;
      }
    }

    const curCenterX = (camera.smoothX ?? (player.x - viewW / 2)) + viewW / 2;
    const curCenterY = (camera.smoothY ?? (player.y - viewH / 2)) + viewH / 2;
    const jumpDist = Math.hypot(player.x - curCenterX, player.y - curCenterY);

    const maxCamX = Math.max(0, currentWorldWidth - viewW);
    const maxCamY = Math.max(0, currentWorldHeight - viewH);
    const targetCamX = Math.max(0, Math.min(maxCamX, focusX - viewW / 2));
    const targetCamY = Math.max(0, Math.min(maxCamY, focusY - viewH / 2));

    if (!camera.initialized || jumpDist > 580) {
      camera.smoothX = targetCamX;
      camera.smoothY = targetCamY;
      camera.initialized = true;
    } else {
      const lerpAlpha = Math.min(1, (joystickState.active || player.manualMoving ? 0.22 : 0.14) * delta);
      camera.smoothX += (targetCamX - camera.smoothX) * lerpAlpha;
      camera.smoothY += (targetCamY - camera.smoothY) * lerpAlpha;
    }

    camera.x = Math.max(0, Math.min(maxCamX, camera.smoothX));
    camera.y = Math.max(0, Math.min(maxCamY, camera.smoothY));
  } else {
    const maxCamX = Math.max(0, currentWorldWidth - viewW);
    const maxCamY = Math.max(0, currentWorldHeight - viewH);
    camera.x = Math.max(0, Math.min(maxCamX, player.x - viewW / 2));
    camera.y = Math.max(0, Math.min(maxCamY, player.y - viewH / 2));
    camera.smoothX = camera.x;
    camera.smoothY = camera.y;
  }
  let shakeOffX = 0, shakeOffY = 0;
  if (camera.shakeUntil && now < camera.shakeUntil) {
    const remRatio = (camera.shakeUntil - now) / Math.max(1, camera.shakeDur || 120);
    const amp = (camera.shakeIntensity || 2.5) * remRatio;
    shakeOffX = (Math.random() - 0.5) * 2 * amp;
    shakeOffY = (Math.random() - 0.5) * 2 * amp;
  }
  cameraContainer.x = Math.round(-camera.x * camera.zoom + shakeOffX);
  cameraContainer.y = Math.round(-camera.y * camera.zoom + shakeOffY);

  window.bottomMagicCircleG.clear();
  mainG.clear();
  if (window.fxG) window.fxG.clear();
  uiG.clear();

  // 🌟 [레이어 1: bottomMagicCircleG] 캐릭터/보스보다 항상 뒷면(바닥)에 위치하는 마법진 및 보스 장판 렌더링
  for (let i = activeEffects.length - 1; i >= 0; i--) {
    let eff = activeEffects[i];
    eff.life -= delta;
    if (eff.life <= 0) {
      activeEffects.splice(i, 1);
      continue;
    }
    let p = Math.max(0, Math.min(1, 1 - (eff.life / eff.maxLife)));
    if (eff.type === 'magic_circle' || eff.type === 'boss_telegraph') {
      drawEffect(window.bottomMagicCircleG, eff, p);
    }
  }

  // 카메라 시야 정밀 프러스텀 컬링 반경 (화면 안 그래픽 품질은 100% 유지하면서 화면 밖 불필요한 벡터 드로잉만 차단!)
  const halfCullW = viewW * 0.56 + 75;
  const halfCullH = viewH * 0.56 + 85;

  // 11) 드롭된 아이템 렌더링 + 아이템 선택링(2.5D 그림자 기울기 일치)
  itemList.forEach(it => {
    const inView = Math.abs(it.x - player.x) <= halfCullW && Math.abs(it.y - player.y) <= halfCullH;
    if (!inView) {
      if (it.pixiSprite) it.pixiSprite.visible = false;
      if (it.nameTag) it.nameTag.visible = false;
      return;
    }
    if (player.targetEntity && player.targetEntity.type === 'ITEM' && player.targetEntity.ref === it) {
      drawIsoSelectionRing(window.bottomMagicCircleG, it.x, it.y + 7, 15, 0x38bdf8, 0xbae6fd, tick, false, 'select');
    }
    drawItem(pCtx, it.x, it.y, it, tick, entityContainer);

    const baseName = it.type === 'gold' ? '💰 골드' : (window.itemDict[it.type]?.name || it.type);
    const itemName = (it.gradeName && it.gradeIdx > 0) ? `[${it.gradeName}] ${baseName}` : baseName;
    if (!it.nameTag) {
      const colHex = it.gradeColor ? parseInt(it.gradeColor.replace('#', '0x'), 16) : 0xfef3c7;
      it.nameTag = createCrispPixiText(itemName, 10.5, colHex);
      it.nameTag.anchor.set(0.5, 1);
      uiContainer.addChild(it.nameTag);
    }
    it.nameTag.visible = true;
    it.nameTag.x = Math.round(it.x);
    it.nameTag.y = Math.round(it.y - 16);
  });

  // 11-B) NPC 렌더링 + NPC 선택링(2.5D 그림자 기울기 일치)
  npcList.forEach(npc => {
    let inView = Math.abs(npc.x - player.x) <= halfCullW && Math.abs(npc.y - player.y) <= halfCullH;
    if (!inView) {
      if (npc.nameTag) npc.nameTag.visible = false;
      return;
    }
    if (player.targetEntity && player.targetEntity.type === 'NPC' && player.targetEntity.ref === npc) {
      drawIsoSelectionRing(window.bottomMagicCircleG, npc.x, npc.y + 18, 22, 0xfacc15, 0xfef08a, tick, false, 'select');
    }
    drawNPC(pCtx, npc.x, npc.y, npc, tick);

    if (!npc.nameTag) {
      npc.nameTag = createCrispPixiText(npc.name, 14, npc.color || 0xfde047);
      npc.nameTag.anchor.set(0.5, 1);
      uiContainer.addChild(npc.nameTag);
    }
    npc.nameTag.visible = true;
    npc.nameTag.x = Math.round(npc.x);
    npc.nameTag.y = Math.round(npc.y - 38);
  });

  // 11-C) 몬스터 렌더링 + 타겟링(2.5D 그림자 기울기와 동일하게 바닥 레이어에 렌더링)
  monsterList.forEach(m => {
    if (m.isDead) {
      if (m.nameTag) m.nameTag.visible = false;
      return;
    }
    let inView = Math.abs(m.x - player.x) <= halfCullW && Math.abs(m.y - player.y) <= halfCullH;
    if (!inView) {
      if (m.nameTag) m.nameTag.visible = false;
      return;
    }

    if (player.targetEntity && player.targetEntity.ref === m) {
      drawIsoSelectionRing(window.bottomMagicCircleG, m.x, m.y + 12, m.isBoss ? 34 : 20, 0xef4444, 0xfca5a5, tick, Boolean(m.isBoss), 'target');
    }

    drawMonster(pCtx, m.x, m.y, m, tick);

    let barW = m.isBoss ? 68 : 42;
    let hpH = m.isBoss ? 6 : 4;
    let barX = Math.round(m.x - barW / 2);
    let barY = Math.round(m.y - (m.isBoss ? 54 : 32));

    uiG.lineStyle(1, 0x000000, 0.9);
    uiG.beginFill(0x1f2937, 0.85);
    uiG.drawRect(barX, barY, barW, hpH);
    uiG.endFill();

    let hpRatio = Math.max(0, Math.min(1, m.hp / m.maxHp));
    uiG.lineStyle(0);
    uiG.beginFill(m.isBoss ? 0xf43f5e : 0xef4444, 1);
    uiG.drawRect(barX + 0.5, barY + 0.5, (barW - 1) * hpRatio, hpH - 1);
    uiG.endFill();

    if (m.maxMp > 0) {
      let mpH = m.isBoss ? 4 : 3;
      let mpY = barY + hpH + 1;
      uiG.lineStyle(1, 0x000000, 0.9);
      uiG.beginFill(0x111827, 0.85);
      uiG.drawRect(barX, mpY, barW, mpH);
      uiG.endFill();

      let mpRatio = Math.max(0, Math.min(1, m.mp / m.maxMp));
      uiG.lineStyle(0);
      uiG.beginFill(0x38bdf8, 1);
      uiG.drawRect(barX + 0.5, mpY + 0.5, (barW - 1) * mpRatio, mpH - 1);
      uiG.endFill();
    }

    if (!m.nameTag) {
      const mCol = m.isBoss ? 0xfacc15 : ((m.lv - player.level >= 5) ? 0xf87171 : (m.maxMp > 0 ? 0x93c5fd : 0xffffff));
      m.nameTag = createCrispPixiText(m.name, m.isBoss ? 12 : 11, mCol);
      m.nameTag.anchor.set(0.5, 1);
      uiContainer.addChild(m.nameTag);
    }
    m.nameTag.visible = true;
    m.nameTag.x = Math.round(m.x);
    m.nameTag.y = Math.round(barY - 3);
  });

  // 12) 멀티플레이어 타 플레이어 & AI 에이전트 스프라이트시트 렌더링 & 내 플레이어처럼 끊김 없는 60FPS 등속 글라이드 보간
  if (Array.isArray(window.otherPlayers)) {
    window.otherPlayers.forEach(op => {
      if (!op || op.x === undefined || op.y === undefined) return;
      if (typeof op.serverX === 'number' && typeof op.serverY === 'number') {
        const dxOp = op.serverX - op.x;
        const dyOp = op.serverY - op.y;
        const dOp = Math.hypot(dxOp, dyOp);
        const baseOpSpd = op._interpSpeed || op.speed || CLASS_STATS[op.class]?.baseSpeed || 1.90;

        if (dOp > 380) {
          op.x = op.serverX;
          op.y = op.serverY;
        } else if (dOp > 0.20) {
          // 100ms 서버 틱(약 6프레임) 동안 멈추는 프레임 없이 일정한 속도로 미끄러지듯 이동
          const glideSpd = baseOpSpd + Math.max(0, (dOp - 14) * 0.08);
          const moveStep = Math.min(dOp, glideSpd * delta);
          op.x += (dxOp / dOp) * moveStep;
          op.y += (dyOp / dOp) * moveStep;
          op.lastMoveVisualTime = now;
          op.isWalking = true;
          if (dOp > 1.5 && now - (op._lastDirUpdateTs || 0) > 130) {
            op._lastDirUpdateTs = now;
            if (Math.abs(dxOp) > Math.abs(dyOp) * 1.15) op.dir = dxOp > 0 ? 'right' : 'left';
            else if (Math.abs(dyOp) > Math.abs(dxOp) * 1.15) op.dir = dyOp > 0 ? 'down' : 'up';
            else if (op.serverDir) op.dir = op.serverDir;
          }
        } else if (op.serverWalking && typeof op.moveX === 'number' && typeof op.moveY === 'number' && (now - (op.lastPacketTime || 0) < 220)) {
          // 다음 100ms 패킷이 도착하기 전 미세한 공백 프레임에서도 목표 방향(moveX, moveY)으로 끊김 없이 예측 보행(Dead Reckoning)
          const exDx = op.moveX - op.x;
          const exDy = op.moveY - op.y;
          const exDist = Math.hypot(exDx, exDy);
          if (exDist > 1.0) {
            const exStep = Math.min(exDist, baseOpSpd * 0.90 * delta);
            op.x += (exDx / exDist) * exStep;
            op.y += (exDy / exDist) * exStep;
            op.lastMoveVisualTime = now;
            op.isWalking = true;
          } else {
            op.isWalking = (now - (op.lastMoveVisualTime || 0)) < 240;
          }
        } else {
          // 패킷 사이 미세 간격 동안 보행 모션이 idle로 툭툭 끊기지 않도록 240ms 홀드
          op.isWalking = Boolean(op.serverWalking || (now - (op.lastMoveVisualTime || 0) < 240));
          if (!op.isWalking && op.serverDir) op.dir = op.serverDir;
        }
      }
      // 타 플레이어의 동행 용병 좌표 보간도 화면 안팎과 무관하게 먼저 수행하여 100% 위치 동기화 보장!
      if (op.mercenary && op.mercenary.hired && !op.mercenary.isDead) {
        const om = op.mercenary;
        if (typeof om.serverX === 'number' && typeof om.serverY === 'number') {
          const dxOm = om.serverX - (om.x ?? om.serverX);
          const dyOm = om.serverY - (om.y ?? om.serverY);
          const dOm = Math.hypot(dxOm, dyOm);
          const baseOmSpd = om._interpSpeed || om.speed || 1.94;
          if (om.x === undefined || dOm > 320) {
            om.x = om.serverX;
            om.y = om.serverY;
          } else if (dOm > 0.20) {
            const glideOm = baseOmSpd + Math.max(0, (dOm - 14) * 0.08);
            const stepOm = Math.min(dOm, glideOm * delta);
            om.x += (dxOm / dOm) * stepOm;
            om.y += (dyOm / dOm) * stepOm;
            om.lastMoveVisualTime = now;
            om.isWalking = true;
            if (dOm > 1.2 && Math.abs(dxOm) > 0.8) {
              om.dir = dxOm >= 0 ? 'right' : 'left';
            }
          } else {
            om.isWalking = Boolean(om.serverWalking || (now - (om.lastMoveVisualTime || 0) < 240));
          }
        }
      }

      const inView = !op.isMinimapOnly && Math.abs(op.x - player.x) <= halfCullW && Math.abs(op.y - player.y) <= halfCullH;
      if (!inView) {
        if (op.pixiSprite) op.pixiSprite.visible = false;
        if (op.nameTag) op.nameTag.visible = false;
        if (op.bubbleTextObj) op.bubbleTextObj.visible = false;
        if (op.partyRibbonText) op.partyRibbonText.visible = false;
        if (op.mercenary?.nameTag) op.mercenary.nameTag.visible = false;
        return;
      }
      if (player.friendlyTarget && player.friendlyTarget.type === 'PLAYER' && player.friendlyTarget.ref === op) {
        drawIsoSelectionRing(window.bottomMagicCircleG, op.x, op.y + 2, 22, 0x4ade80, 0xbbf7d0, tick, false, 'select');
      }
      drawOtherPlayer(pCtx, op.x, op.y, op, tick, now, entityContainer);

      const opBarW = 46;
      const opHpH = 4;
      const opBarX = Math.round(op.x - opBarW / 2);
      const opBarY = Math.round(op.y - 60);
      const opHpRatio = Math.max(0, Math.min(1, (op.hp || 100) / (op.maxHp || 100)));
      uiG.lineStyle(1, 0x000000, 0.9);
      uiG.beginFill(0x111827, 0.85).drawRect(opBarX, opBarY, opBarW, opHpH).endFill();
      uiG.lineStyle(0);
      uiG.beginFill(0x38bdf8, 1).drawRect(opBarX + 0.5, opBarY + 0.5, (opBarW - 1) * opHpRatio, opHpH - 1).endFill();

      if (!op.nameTag) {
        op.nameTag = createCrispPixiText('', 13, 0x93c5fd);
        op.nameTag.anchor.set(0.5, 1);
        uiContainer.addChild(op.nameTag);
      }
      op.nameTag.visible = true;
      const nextOpName = `${op.isAdmin ? '👑[GM] ' : ''}${op.name || '모험가'}`;
      if (op.nameTag.text !== nextOpName) op.nameTag.text = nextOpName;
      op.nameTag.x = Math.round(op.x);
      op.nameTag.y = Math.round(opBarY - 2);

      // 🎗️ 타 플레이어가 파티 중이면 이름표 바로 위로 배지 표시
      if (op.partyId) {
        drawPartyRibbonAboveEntity(uiG, uiContainer, op, op.x, opBarY - 2, Boolean(op.isPartyLeader), Boolean(window.partyState && window.partyState.partyId === op.partyId), null, op.partyId);
      } else if (op.partyRibbonText) {
        op.partyRibbonText.visible = false;
      }

      renderEntitySpeechBubble(uiG, uiContainer, op, op.x, op.partyId ? (opBarY - 34) : (opBarY - 19), now);

      // 🤝 타 플레이어의 동행 용병 렌더링
      if (op.mercenary && op.mercenary.hired && !op.mercenary.isDead) {
        const om = op.mercenary;
        const omX = om.x || (op.x - 42);
        const omY = om.y || (op.y + 26);
        drawMercenary(pCtx, omX, omY, om, tick, now, true);
        const omBarW = 36;
        const omBarX = Math.round(omX - omBarW / 2);
        const omBarY = Math.round(omY - 54);
        const omHpRatio = Math.max(0, Math.min(1, (om.hp || 100) / (om.maxHp || 100)));
        uiG.lineStyle(1, 0x000000, 0.85);
        uiG.beginFill(0x111827, 0.8).drawRect(omBarX, omBarY, omBarW, 3.5).endFill();
        uiG.lineStyle(0);
        uiG.beginFill(0x818cf8, 1).drawRect(omBarX + 0.5, omBarY + 0.5, (omBarW - 1) * omHpRatio, 2.5).endFill();
        if (!om.nameTag) {
          om.nameTag = createCrispPixiText('', 12, 0xa5b4fc);
          om.nameTag.anchor.set(0.5, 1);
          uiContainer.addChild(om.nameTag);
        }
        om.nameTag.visible = true;
        const nextOmName = normalizeMercenaryDisplayName(om.name, om.class || 'knight');
        if (om.nameTag.text !== nextOmName) om.nameTag.text = nextOmName;
        drawMercClassBadgeNextToNameTag(uiG, om.class || 'knight', om.nameTag, omX, omBarY - 2);
      } else if (op.mercenary?.nameTag) {
        op.mercenary.nameTag.visible = false;
      }
    });
  }

  if (mercenary.hired && !mercenary.isDead) {
    if (player.friendlyTarget && player.friendlyTarget.type === 'MERC') {
      drawIsoSelectionRing(window.bottomMagicCircleG, mercenary.x, mercenary.y + 3, 21, 0x4ade80, 0xbbf7d0, tick, false, 'select');
    }
    drawMercenary(pCtx, mercenary.x, mercenary.y, mercenary, tick, now);

    const mBarW = 42;
    const mHpH = 4;
    const mMpH = 3;
    const mBarX = Math.round(mercenary.x - mBarW / 2);
    const mBarY = Math.round(mercenary.y - 58);

    uiG.lineStyle(1, 0x000000, 0.9);
    uiG.beginFill(0x111827, 0.85);
    uiG.drawRect(mBarX, mBarY, mBarW, mHpH);
    uiG.endFill();

    const mHpRatio = Math.max(0, Math.min(1, mercenary.hp / mercenary.maxHp));
    uiG.lineStyle(0);
    uiG.beginFill(0x34d399, 1);
    uiG.drawRect(mBarX + 0.5, mBarY + 0.5, (mBarW - 1) * mHpRatio, mHpH - 1);
    uiG.endFill();

    uiG.lineStyle(1, 0x000000, 0.9);
    uiG.beginFill(0x111827, 0.85);
    uiG.drawRect(mBarX, mBarY + mHpH + 1, mBarW, mMpH);
    uiG.endFill();

    const mMpRatio = Math.max(0, Math.min(1, mercenary.mp / mercenary.maxMp));
    uiG.lineStyle(0);
    uiG.beginFill(0x60a5fa, 1);
    uiG.drawRect(mBarX + 0.5, mBarY + mHpH + 1.5, (mBarW - 1) * mMpRatio, mMpH - 1);
    uiG.endFill();

    if (!mercenary.nameTag) {
      mercenary.nameTag = createCrispPixiText('', 12.5, 0x6ee7b7);
      mercenary.nameTag.anchor.set(0.5, 1);
      uiContainer.addChild(mercenary.nameTag);
    }
    // 용병 필드 네임택: "내 용병", "보조/공격/대기" 택 제거 -> [클래스 전용 배지] + 용병 이름(예: 숲속의 실비아)만 표시!
    mercenary.name = normalizeMercenaryDisplayName(mercenary.name, mercenary.class || 'knight');
    mercenary.nameTag.visible = true;
    if (mercenary.nameTag.text !== mercenary.name) mercenary.nameTag.text = mercenary.name;
    drawMercClassBadgeNextToNameTag(uiG, mercenary.class || 'knight', mercenary.nameTag, mercenary.x, mBarY - 2);
  } else if (mercenary.nameTag) {
    mercenary.nameTag.visible = false;
  }

  // 13) 플레이어 렌더링
  let eqWeaponId = (player.equip.weapon !== null && player.inventory[player.equip.weapon]) ? player.inventory[player.equip.weapon].type : null;
  player.weaponType = eqWeaponId || 'NONE';
  drawPlayer(pCtx, player.x, player.y, player, tick, now);

  const pBarW = 50;
  const pHpH = 5;
  const pMpH = 4;
  const pBarX = Math.round(player.x - pBarW / 2);
  const pBarY = Math.round(player.y - 64);

  uiG.lineStyle(1, 0x000000, 0.9);
  uiG.beginFill(0x111827, 0.85);
  uiG.drawRect(pBarX, pBarY, pBarW, pHpH);
  uiG.endFill();

  let pHpRatio = Math.max(0, Math.min(1, player.hp / player.maxHp));
  uiG.lineStyle(0);
  uiG.beginFill(0x22c55e, 1);
  uiG.drawRect(pBarX + 0.5, pBarY + 0.5, (pBarW - 1) * pHpRatio, pHpH - 1);
  uiG.endFill();

  uiG.lineStyle(1, 0x000000, 0.9);
  uiG.beginFill(0x111827, 0.85);
  uiG.drawRect(pBarX, pBarY + pHpH + 1, pBarW, pMpH);
  uiG.endFill();

  let pMpRatio = Math.max(0, Math.min(1, player.mp / player.maxMp));
  uiG.lineStyle(0);
  uiG.beginFill(0x3b82f6, 1);
  uiG.drawRect(pBarX + 0.5, pBarY + pHpH + 1.5, (pBarW - 1) * pMpRatio, pMpH - 1);
  uiG.endFill();

  if (!playerNameTag) {
    playerNameTag = createCrispPixiText('', 13.5, 0x4ade80);
    playerNameTag.anchor.set(0.5, 1);
    uiContainer.addChild(playerNameTag);
  }
  const pClassName = CLASS_STATS[player.class]?.name || "모험가";
  const nextPlayerNameTxt = `${player.isAdmin ? '👑[GM] ' : ''}${player.name || pClassName}`;
  if (playerNameTag.text !== nextPlayerNameTxt) playerNameTag.text = nextPlayerNameTxt;
  playerNameTag.x = Math.round(player.x);
  playerNameTag.y = Math.round(pBarY - 3);

  // 🎗️ 본인이 파티 중이면 이름표 바로 위로 파티 배지 표시
  const myPartyNow = window.partyState;
  if (myPartyNow && myPartyNow.partyId) {
    drawPartyRibbonAboveEntity(uiG, uiContainer, player, player.x, pBarY - 3, myPartyNow.leaderCharId === activeCharacterId, true, playerNameTag, myPartyNow.partyId);
  } else if (player.partyRibbonText) {
    player.partyRibbonText.visible = false;
  }

  renderEntitySpeechBubble(uiG, uiContainer, player, player.x, (myPartyNow && myPartyNow.partyId) ? (pBarY - 36) : (pBarY - 21), now);

  if (now < player.blockTime) {
    drawIsoSelectionRing(window.bottomMagicCircleG, player.x, player.y + 2, 24, 0xfacc15, 0xfef08a, tick, false, 'select');
  }

  // 🧭 13-B) 퀘스트 해당 지역일 때 다음 퀘스트 장소(목표 몬스터 / 퀘스트 NPC / 던전 입구) 방향을 연한 화살표로 안내 (옵션에서 ON/OFF 가능)
  if (bgLoaded && window.OptionState?.questGuideArrow !== false && GameDB?.Quests && player?.quests) {
    let guidePt = null;
    let guideCol = 0xfde047;
    const regQuests = GameDB.Quests.filter(q => q && q.region === currentRegionKey);
    if (regQuests.length > 0) {
      const activeRegQuests = regQuests.filter(q => player.quests[q.id]?.status === 'ACTIVE');
      const readyQuest = activeRegQuests.find(q => (player.quests[q.id]?.count || 0) >= q.reqCount);
      const huntingQuest = activeRegQuests.find(q => (player.quests[q.id]?.count || 0) < q.reqCount);
      const isDungMap = String(currentMapKey || '').endsWith('_dungeon');

      if (readyQuest) {
        guideCol = 0x4ade80;
        if (isDungMap && portalBoxes.length > 0) {
          guidePt = portalBoxes[0];
        } else {
          const qNpc = npcList.find(n => n && n.role === 'QUEST');
          if (qNpc) guidePt = qNpc;
        }
      } else if (huntingQuest) {
        guideCol = 0xfacc15;
        const tName = (huntingQuest.targetName || '').trim();
        let bestMob = null;
        let bestDist = Infinity;
        for (let i = 0; i < monsterList.length; i++) {
          const m = monsterList[i];
          if (!m || m.isDead) continue;
          const mRaw = (m.rawName || m.name || '').trim();
          if (tName && (mRaw === tName || mRaw.includes(tName) || (m.name && m.name.includes(tName)))) {
            const d = Math.hypot(m.x - player.x, m.y - player.y);
            if (d < bestDist) {
              bestDist = d;
              bestMob = m;
            }
          }
        }
        if (bestMob) {
          guidePt = bestMob;
        } else if (portalBoxes.length > 0) {
          guidePt = portalBoxes[0];
        }
      } else if (!isDungMap) {
        const nextAvailQuest = regQuests.find(q => {
          const st = player.quests[q.id]?.status;
          return !st || st === 'AVAILABLE' || st === 'ABANDONED';
        });
        if (nextAvailQuest) {
          const qNpc = npcList.find(n => n && n.role === 'QUEST');
          if (qNpc) {
            guidePt = qNpc;
            guideCol = 0x93c5fd;
          }
        }
      }
    }

    if (guidePt && typeof guidePt.x === 'number' && typeof guidePt.y === 'number') {
      const dxG = guidePt.x - player.x;
      const dyG = guidePt.y - player.y;
      const distG = Math.hypot(dxG, dyG);
      if (distG > 95) {
        const angG = Math.atan2(dyG, dxG);
        const orbitR = 54 + Math.sin(tick * 0.08) * 3;
        const ax = player.x + Math.cos(angG) * orbitR;
        const ay = (player.y - 16) + Math.sin(angG) * orbitR;
        const ux = Math.cos(angG);
        const uy = Math.sin(angG);
        const px = -uy;
        const py = ux;
        const tipX = ax + ux * 11;
        const tipY = ay + uy * 11;
        const leftX = ax - ux * 6 + px * 6.5;
        const leftY = ay - uy * 6 + py * 6.5;
        const backX = ax - ux * 2.5;
        const backY = ay - uy * 2.5;
        const rightX = ax - ux * 6 - px * 6.5;
        const rightY = ay - uy * 6 - py * 6.5;
        const softAlpha = 0.34 + 0.08 * Math.sin(tick * 0.08);

        uiG.lineStyle(1.2, 0xffffff, softAlpha * 0.75);
        uiG.beginFill(guideCol, softAlpha);
        uiG.moveTo(tipX, tipY);
        uiG.lineTo(leftX, leftY);
        uiG.lineTo(backX, backY);
        uiG.lineTo(rightX, rightY);
        uiG.closePath();
        uiG.endFill();
      }
    }
  }

  // 🌟 [레이어 4: fxG] 2.5D 투사체 및 스킬·피격·물약·버프 파티클 렌더링 (마법진은 bottomMagicCircleG에만 그려져 절대 캐릭터를 가리지 않음!)
  const particleLayer = window.fxG || uiG;
  projectiles.forEach(p => {
    if (!p.target) return;
    let dx = p.target.x - p.x;
    let dy = (p.target.y - 15) - p.y;
    let dist = Math.max(1, Math.hypot(dx, dy));
    drawProjectile(particleLayer, p, dx, dy, dist);
  });

  for (let i = 0; i < activeEffects.length; i++) {
    let ef = activeEffects[i];
    if (ef.type === 'magic_circle' || ef.type === 'boss_telegraph') continue;
    let progress = Math.max(0, Math.min(1, 1 - (ef.life / ef.maxLife)));
    drawEffect(particleLayer, ef, progress);
  }

  // 멀티플레이어 실시간 위치 동기화 패킷 전송 (120ms 간격)
  window.tickMultiplayerSync?.(now);

  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    let ft = floatingTexts[i];
    if (!ft.maxLife) ft.maxLife = ft.life || 35;
    if (!ft.pixiText) {
      const fSize = ft.fontSize || (ft.dmgKind === 'crit' ? 16.5 : (ft.dmgKind === 'skill' ? 14.5 : 13));
      ft.pixiText = createCrispPixiText(ft.text, fSize, ft.color || 0xffffff);
      if (ft.strokeColor) {
        ft.pixiText.style.stroke = ft.strokeColor;
        ft.pixiText.style.strokeThickness = ft.dmgKind === 'crit' ? 3.4 : 2.5;
      }
      ft.pixiText.anchor.set(0.5);
      uiContainer.addChild(ft.pixiText);
    }
    const progress = 1 - (ft.life / ft.maxLife);
    // 타격 종류별 팝업 스케일 애니메이션 (크리티컬은 강렬하게 튕겨 오름)
    let sc = 1.0;
    if (ft.dmgKind === 'crit') {
      sc = progress < 0.22 ? (0.85 + (progress / 0.22) * 0.65) : Math.max(1.05, 1.50 - (progress - 0.22) * 0.55);
    } else if (ft.dmgKind === 'skill') {
      sc = progress < 0.20 ? (0.90 + (progress / 0.20) * 0.35) : Math.max(1.0, 1.25 - (progress - 0.20) * 0.30);
    }
    ft.pixiText.scale.set(sc);

    const riseSpd = ft.dmgKind === 'crit' ? 1.05 : 0.82;
    ft.y -= riseSpd * delta;
    ft.life -= delta;
    ft.pixiText.x = Math.round(ft.x);
    ft.pixiText.y = Math.round(ft.y);
    ft.pixiText.alpha = Math.min(1, ft.life / 14);

    if (ft.life <= 0) {
      uiContainer.removeChild(ft.pixiText);
      ft.pixiText.destroy();
      floatingTexts.splice(i, 1);
    }
  }

  // 플레이어 Y좌표 기준 활성 청크만 스트리밍 유지 및 장시간 플레이 메모리 정리
  if (window.MapChunkManager) {
    window.MapChunkManager.updateActiveChunks(player.y, false);
  }
  if (!window._lastMemCleanupTs || now - window._lastMemCleanupTs > 20000) {
    window._lastMemCleanupTs = now;
    if (activeEffects.length > 45) activeEffects.splice(0, activeEffects.length - 45);
    if (projectiles.length > 45) projectiles.splice(0, projectiles.length - 45);
    while (floatingTexts.length > 35) {
      const oldFt = floatingTexts.shift();
      if (oldFt?.pixiText) {
        if (oldFt.pixiText.parent) oldFt.pixiText.parent.removeChild(oldFt.pixiText);
        try { oldFt.pixiText.destroy(); } catch (e) {}
      }
    }
  }

  // 미니맵 렌더링은 3프레임(약 20FPS) 주기로 실행하여 모바일/PC 2D 캔버스 드로잉 부하를 66% 절감
  if (Math.floor(tick) % 3 === 0) {
    renderMinimap();
  }
}

function awardPickedItemToPlayer(it) {
  if (it.type === 'gold') {
    let amt = it.qty && it.qty > 1 ? it.qty : Math.floor(15 + Math.random() * 35);
    player.gold += amt;
    window.addChat(`💰 ${amt.toLocaleString()} 골드를 획득했습니다.`, 'log-sys');
  } else {
    const saved = giveItem(it.type, it.qty || 1, it.gradeIdx ?? null, it);
    let iName = window.itemDict[it.type]?.name || it.type;
    let gPrefix = (saved && saved.gradeName && saved.gradeIdx > 0) ? `[${saved.gradeName}] ` : '';
    let optSuffix = (saved && Array.isArray(saved.options) && saved.options.length > 0)
      ? ` (${saved.options.map(o => `${o.label}+${o.val}${o.unit}`).join(', ')})`
      : '';
    window.addChat(`🎒 ${gPrefix}[${iName}]${optSuffix} 아이템을 획득했습니다!`, saved?.gradeIdx >= 2 ? 'log-kill' : 'log-sys');
    if (!document.getElementById('inventory-ui').classList.contains('hidden')) renderInventory();
  }
  updateStatusHUD();
  window.triggerAutoSave?.('item_pickup', it.type !== 'gold');
}

function pickupItem(it) {
  let idx = itemList.indexOf(it);
  if (idx === -1) return;

  if (isServerAuthoritativeMode() && it.uid) {
    const now = Date.now();
    if (it._pickupPendingUntil && now < it._pickupPendingUntil) return;
    it._pickupPendingUntil = now + 600;
    sendCentralWsPacket({
      type: 'PICKUP_GROUND_ITEM',
      charId: activeCharacterId,
      mapKey: currentMapKey,
      itemUid: it.uid
    });
    return;
  }

  destroyItemGraphics(it);
  itemList.splice(idx, 1);
  awardPickedItemToPlayer(it);
}

// ============================================================================
// 🧭 플레이어 중심 실시간 스크롤 레이더 미니맵 (용병 마커 추가)
// ============================================================================
window.otherPlayers = window.otherPlayers || [];

function renderMinimap() {
  if (!mCtx || !mCanvas || !bgLoaded) return;
  const cw = mCanvas.width;
  const ch = mCanvas.height;
  mCtx.clearRect(0, 0, cw, ch);

  const viewSpan = 2200;
  const halfSpan = viewSpan / 2;
  const viewLeft = Math.max(0, Math.min(currentWorldWidth - viewSpan, player.x - halfSpan));
  const viewTop  = Math.max(0, Math.min(currentWorldHeight - viewSpan, player.y - halfSpan));

  if (minimapOffscreenCanvas) {
    const offScaleX = minimapOffscreenCanvas.width / currentWorldWidth;
    const offScaleY = minimapOffscreenCanvas.height / currentWorldHeight;
    mCtx.fillStyle = '#090d16';
    mCtx.fillRect(0, 0, cw, ch);
    mCtx.drawImage(
      minimapOffscreenCanvas,
      viewLeft * offScaleX,
      viewTop * offScaleY,
      viewSpan * offScaleX,
      viewSpan * offScaleY,
      0, 0, cw, ch
    );
  } else {
    mCtx.fillStyle = '#111827';
    mCtx.fillRect(0, 0, cw, ch);
  }

  const toMiniX = (wx) => ((wx - viewLeft) / viewSpan) * cw;
  const toMiniY = (wy) => ((wy - viewTop) / viewSpan) * ch;

  const sz = getSafeZoneInfo(currentMapKey);
  if (sz) {
    const sx = toMiniX(sz.x), sy = toMiniY(sz.y);
    const sr = (sz.radius / viewSpan) * cw;
    if (sx + sr > 0 && sx - sr < cw && sy + sr > 0 && sy - sr < ch) {
      mCtx.strokeStyle = 'rgba(74, 222, 128, 0.45)';
      mCtx.lineWidth = 1.5;
      mCtx.beginPath();
      mCtx.arc(sx, sy, sr, 0, Math.PI * 2);
      mCtx.stroke();
    }
  }

  mCtx.fillStyle = '#38bdf8';
  portalBoxes.forEach(p => {
    const mx = toMiniX(p.x), my = toMiniY(p.y);
    if (mx < -5 || mx > cw + 5 || my < -5 || my > ch + 5) return;
    mCtx.beginPath();
    mCtx.arc(mx, my, 4, 0, Math.PI * 2);
    mCtx.fill();
  });

  mCtx.fillStyle = '#fde047';
  npcList.forEach(n => {
    const mx = toMiniX(n.x), my = toMiniY(n.y);
    if (mx < 0 || mx > cw || my < 0 || my > ch) return;
    mCtx.fillRect(mx - 2, my - 2, 4, 4);
  });

  monsterList.forEach(m => {
    if (m.isDead) return;
    const mx = toMiniX(m.x), my = toMiniY(m.y);
    if (mx < -4 || mx > cw + 4 || my < -4 || my > ch + 4) return;
    mCtx.fillStyle = m.isBoss ? '#c084fc' : '#ef4444';
    let r = m.isBoss ? 4.5 : 2.2;
    mCtx.beginPath();
    mCtx.arc(mx, my, r, 0, Math.PI * 2);
    mCtx.fill();
  });

  if (mercenary.hired && !mercenary.isDead) {
    const mx = toMiniX(mercenary.x), my = toMiniY(mercenary.y);
    mCtx.fillStyle = '#60a5fa';
    mCtx.strokeStyle = '#ffffff';
    mCtx.lineWidth = 1;
    mCtx.beginPath();
    mCtx.arc(mx, my, 3.2, 0, Math.PI * 2);
    mCtx.fill();
    mCtx.stroke();
  }

  if (Array.isArray(window.otherPlayers)) {
    const myPartyId = window.partyState?.partyId || null;
    const centerMiniX = cw / 2;
    const centerMiniY = ch / 2;
    const maxRadarR = (cw / 2) - 4;
    window.otherPlayers.forEach(op => {
      if (!op || op.x === undefined || op.y === undefined || op.gmInvisible) return;
      let mx = toMiniX(op.x);
      let my = toMiniY(op.y);
      // 미니맵 반경(2200px) 바깥에 있는 같은 맵 플레이어도 미니맵 테두리에 방향 점으로 표시하여 위치 파악 지원!
      const dxC = mx - centerMiniX;
      const dyC = my - centerMiniY;
      const distC = Math.hypot(dxC, dyC);
      let isClamped = false;
      if (distC > maxRadarR) {
        mx = centerMiniX + (dxC / distC) * maxRadarR;
        my = centerMiniY + (dyC / distC) * maxRadarR;
        isClamped = true;
      }
      const isSameParty = Boolean(myPartyId && op.partyId === myPartyId);
      mCtx.fillStyle = isSameParty ? '#34d399' : '#2dd4bf';
      mCtx.strokeStyle = '#ffffff';
      mCtx.lineWidth = 1.3;
      mCtx.beginPath();
      mCtx.arc(mx, my, isClamped ? 2.8 : 3.6, 0, Math.PI * 2);
      mCtx.fill();
      mCtx.stroke();
    });
  }

  const px = toMiniX(player.x);
  const py = toMiniY(player.y);
  mCtx.fillStyle = '#22c55e';
  mCtx.strokeStyle = '#ffffff';
  mCtx.lineWidth = 1.5;
  mCtx.beginPath();
  mCtx.arc(px, py, 4, 0, Math.PI * 2);
  mCtx.fill();
  mCtx.stroke();
}