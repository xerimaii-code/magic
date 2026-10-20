// js/game.js — 메인 ES 모듈 브릿지 (데이터 · 그래픽 · 사운드 · 옵션 모듈 로드 및 전역 스코프 연결)
import { GameDB, HardcodedMapDB, OBJ, Renderer, DetailFieldRenderer, loadEnvConfig, calcRequiredExpForLevel, calcBalancedKillExp } from './data.js';
import { drawPlayer, drawOtherPlayer, destroyOtherPlayerSprite, drawNPC, drawMonster, drawItem, drawProjectile, drawEffect, drawIsoSelectionRing, ISO_TILT, PixiCtx, PlayerSpriteManager, loadCustomSprites, loadItemSheetSprites, SoundSystem } from './data_image.js';
import { initOptionSystem, GameOptions, shouldLootItem } from './ui_option.js';
import { ImmersiveSystem } from './game_08_immersive_contents.js';

Object.assign(window, {
  GameDB,
  HardcodedMapDB,
  OBJ,
  Renderer,
  DetailFieldRenderer,
  loadEnvConfig,
  calcRequiredExpForLevel,
  calcBalancedKillExp,
  drawPlayer,
  drawOtherPlayer,
  destroyOtherPlayerSprite,
  drawNPC,
  drawMonster,
  drawItem,
  drawProjectile,
  drawEffect,
  drawIsoSelectionRing,
  ISO_TILT,
  PixiCtx,
  PlayerSpriteManager,
  loadCustomSprites,
  loadItemSheetSprites,
  SoundSystem,
  initOptionSystem,
  GameOptions,
  shouldLootItem,
  ImmersiveSystem
});
