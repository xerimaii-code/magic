// js/data_image.js
const _pixiColorCache = new Map();

export class PixiCtx {
    constructor(g) { this.g = g; this.stack = []; this.tx = 0; this.ty = 0; this.scX = 1; this.scY = 1; this.rot = 0; }
    save() { this.stack.push({x: this.tx, y: this.ty, sx: this.scX, sy: this.scY, r: this.rot}); }
    restore() { let s = this.stack.pop(); if(s) { this.tx = s.x; this.ty = s.y; this.scX = s.sx; this.scY = s.sy; this.rot = s.r; } }
    translate(x, y) {
        if (this.rot === 0) {
            this.tx += x * this.scX;
            this.ty += y * this.scY;
        } else {
            const c = Math.cos(this.rot), s = Math.sin(this.rot);
            this.tx += (x * c - y * s) * this.scX;
            this.ty += (x * s + y * c) * this.scY;
        }
    }
    rotate(a) { this.rot += a; }
    scale(x, y) { this.scX *= x; this.scY *= y; }
    _t(x, y) {
        if (this.rot === 0) {
            return { x: this.tx + x * this.scX, y: this.ty + y * this.scY };
        }
        const c = Math.cos(this.rot), s = Math.sin(this.rot);
        return { x: this.tx + (x * c - y * s) * this.scX, y: this.ty + (x * s + y * c) * this.scY };
    }
    _parseColor(col, defaultAlpha = 1) {
        if (!col) return { hex: 0x000000, alpha: 0 };
        if (typeof col === 'number') return { hex: col, alpha: defaultAlpha };
        const cacheKey = defaultAlpha === 1 ? col : `${col}@${defaultAlpha}`;
        const cached = _pixiColorCache.get(cacheKey);
        if (cached) return cached;

        const s = String(col).trim();
        let res = { hex: 0x111111, alpha: defaultAlpha };
        if (s.startsWith('#')) {
            const raw = s.slice(1);
            if (raw.length === 3) {
                const r = parseInt(raw[0] + raw[0], 16) || 0;
                const g = parseInt(raw[1] + raw[1], 16) || 0;
                const b = parseInt(raw[2] + raw[2], 16) || 0;
                res = { hex: (r << 16) | (g << 8) | b, alpha: defaultAlpha };
            } else {
                res = { hex: parseInt(raw, 16) || 0, alpha: defaultAlpha };
            }
        } else if (s.startsWith('rgba') || s.startsWith('rgb')) {
            const m = s.match(/[\d.]+/g);
            if (m && m.length >= 3) {
                const r = Math.min(255, Math.max(0, parseInt(m[0], 10) || 0));
                const g = Math.min(255, Math.max(0, parseInt(m[1], 10) || 0));
                const b = Math.min(255, Math.max(0, parseInt(m[2], 10) || 0));
                const a = m.length >= 4 ? Math.min(1, Math.max(0, parseFloat(m[3]))) : defaultAlpha;
                res = { hex: (r << 16) | (g << 8) | b, alpha: a };
            } else {
                res = { hex: 0x000000, alpha: 0.45 };
            }
        }
        if (_pixiColorCache.size < 512) _pixiColorCache.set(cacheKey, res);
        return res;
    }
    poly(pts, fill, stroke='#111111', lw=2) {
        if (stroke && lw > 0) {
            const sc = this._parseColor(stroke, 1);
            this.g.lineStyle(lw, sc.hex, sc.alpha);
        } else {
            this.g.lineStyle(0);
        }
        if (fill) {
            const fc = this._parseColor(fill, 1);
            this.g.beginFill(fc.hex, fc.alpha);
        }
        let p0 = this._t(pts[0][0], pts[0][1]); this.g.moveTo(p0.x, p0.y);
        for(let i=1; i<pts.length; i++) { let p = this._t(pts[i][0], pts[i][1]); this.g.lineTo(p.x, p.y); }
        this.g.closePath(); if(fill) this.g.endFill();
    }
    ellipse(cx, cy, rx, ry, fill, stroke='#111111', lw=2) {
        if (stroke && lw > 0) {
            const sc = this._parseColor(stroke, 1);
            this.g.lineStyle(lw, sc.hex, sc.alpha);
        } else {
            this.g.lineStyle(0);
        }
        if (fill) {
            const fc = this._parseColor(fill, 1);
            this.g.beginFill(fc.hex, fc.alpha);
        }
        if (this.rot === 0) {
            this.g.drawEllipse(this.tx + cx * this.scX, this.ty + cy * this.scY, Math.abs(rx * this.scX), Math.abs(ry * this.scY));
            if (fill) this.g.endFill();
            return;
        }
        let pts = []; for(let i=0; i<=16; i++) { let a = (i/16) * Math.PI * 2; pts.push([cx + Math.cos(a)*rx, cy + Math.sin(a)*ry]); }
        let p0 = this._t(pts[0][0], pts[0][1]); this.g.moveTo(p0.x, p0.y);
        for(let i=1; i<pts.length; i++) { let p = this._t(pts[i][0], pts[i][1]); this.g.lineTo(p.x, p.y); }
        this.g.closePath(); if(fill) this.g.endFill();
    }
    curveFill(sx, sy, cp1x, cp1y, cp2x, cp2y, ex, ey, fill, stroke='#111111', lw=2) {
        if (stroke && lw > 0) {
            const sc = this._parseColor(stroke, 1);
            this.g.lineStyle(lw, sc.hex, sc.alpha);
        } else {
            this.g.lineStyle(0);
        }
        if (fill) {
            const fc = this._parseColor(fill, 1);
            this.g.beginFill(fc.hex, fc.alpha);
        }
        let p0 = this._t(sx, sy); this.g.moveTo(p0.x, p0.y);
        for(let i=1; i<=10; i++) {
            let t = i/10; let xt = Math.pow(1-t,3)*sx + 3*Math.pow(1-t,2)*t*cp1x + 3*(1-t)*t*t*cp2x + Math.pow(t,3)*ex; let yt = Math.pow(1-t,3)*sy + 3*Math.pow(1-t,2)*t*cp1y + 3*(1-t)*t*t*cp2y + Math.pow(t,3)*ey;
            let p = this._t(xt, yt); this.g.lineTo(p.x, p.y);
        }
        this.g.closePath(); if(fill) this.g.endFill();
    }
}

// ============================================================================
// 🔊 프로시저럴 사운드 합성 시스템 (Web Audio API 기반 — 외부 오디오 파일 불필요)
// - 클래스별 물리 공격/피격음, 스킬/마법 속성별 효과음, 몬스터 이름 맞춤 사망 효과음
// ============================================================================
export const SoundSystem = {
    ctx: null,
    noiseBuffer: null,

    _ensureCtx() {
        const opts = window.OptionState;
        if (opts && !opts.sfxOn) return null;
        const vol = opts && typeof opts.sfxVolume === 'number' ? opts.sfxVolume / 100 : 0.75;
        if (vol <= 0.01) return null;

        if (!this.ctx) {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!AudioCtx) return null;
            this.ctx = new AudioCtx();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume().catch(() => {});
        }
        if (!this.noiseBuffer && this.ctx) {
            const sr = this.ctx.sampleRate;
            const buf = this.ctx.createBuffer(1, sr * 1.5, sr);
            const data = buf.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
                data[i] = Math.random() * 2 - 1;
            }
            this.noiseBuffer = buf;
        }
        return { ctx: this.ctx, vol: Math.min(1.0, vol * 0.42) };
    },

    _tone(type, fStart, fEnd, dur, gainVal, delay = 0) {
        const s = this._ensureCtx();
        if (!s) return;
        const { ctx, vol } = s;
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(20, fStart), now);
        if (fEnd && fEnd !== fStart) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, fEnd), now + dur);
        }
        const peak = Math.max(0.001, gainVal * vol);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(peak, now + Math.min(0.02, dur * 0.2));
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + dur + 0.02);
    },

    _noise(filterType, fStart, fEnd, qVal, dur, gainVal, delay = 0) {
        const s = this._ensureCtx();
        if (!s || !this.noiseBuffer) return;
        const { ctx, vol } = s;
        const now = ctx.currentTime + delay;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const flt = ctx.createBiquadFilter();
        flt.type = filterType;
        flt.frequency.setValueAtTime(Math.max(40, fStart), now);
        if (fEnd && fEnd !== fStart) {
            flt.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), now + dur);
        }
        flt.Q.setValueAtTime(qVal || 1.2, now);
        const g = ctx.createGain();
        const peak = Math.max(0.001, gainVal * vol);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(peak, now + Math.min(0.025, dur * 0.18));
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
        src.connect(flt);
        flt.connect(g);
        g.connect(ctx.destination);
        src.start(now);
        src.stop(now + dur + 0.02);
    },

    playUiClick() {
        this._tone('sine', 680, 920, 0.06, 0.22);
    },

    // 1) 플레이어 클래스별 기본 공격 효과음 (묵직한 저음 타격 어택감 강화)
    playBasicAttack(classKey = 'knight') {
        if (classKey === 'knight') {
            // 인간전사: 묵직한 대검/도검 풍압 + 저음 펀치 + 강철 칼날 여운
            this._tone('sine', 105, 36, 0.15, 0.52);
            this._noise('bandpass', 1200, 310, 1.8, 0.16, 0.62);
            this._tone('sawtooth', 260, 72, 0.14, 0.42);
            this._tone('triangle', 1120, 520, 0.10, 0.22, 0.02);
        } else if (classKey === 'ranger') {
            // 엘프궁수: 묵직한 장궁 현 울림 + 날카로운 파공음
            this._tone('sine', 135, 48, 0.12, 0.44);
            this._tone('triangle', 320, 110, 0.11, 0.42);
            this._noise('highpass', 2100, 750, 1.6, 0.14, 0.45, 0.015);
        } else {
            // 엘프마법사: 응축된 아케인 캐논 발사음 (저음 공명 + 크리스탈 파동)
            this._tone('sine', 145, 52, 0.15, 0.45);
            this._tone('sine', 480, 920, 0.16, 0.38);
            this._tone('triangle', 760, 320, 0.18, 0.30, 0.02);
        }
    },

    // 2) 플레이어 클래스별 피격 / 방어 / 회피 / 크리티컬 효과음 (묵직한 물리 타격 질감 극대화)
    playPhysicalHit(classKey = 'knight', hitType = 'hit', isCrit = false) {
        if (hitType === 'block') {
            // 방패 블록: 중후한 강철 방패 충격음 + 서브베이스 반동
            this._tone('sine', 92, 34, 0.18, 0.58);
            this._tone('square', 760, 440, 0.20, 0.42);
            this._tone('triangle', 1180, 820, 0.24, 0.32, 0.01);
            this._noise('bandpass', 1650, 520, 2.8, 0.14, 0.52);
            return;
        }
        if (hitType === 'dodge') {
            // 회피: 재빠른 바람 스침음
            this._noise('bandpass', 1800, 3200, 2.0, 0.11, 0.34);
            return;
        }
        // 공통 묵직한 서브베이스 바디 임팩트 (타격 무게감 핵심)
        this._tone('sine', isCrit ? 128 : 96, 28, isCrit ? 0.22 : 0.16, isCrit ? 0.72 : 0.56);
        if (isCrit) {
            // 크리티컬 히트: 강렬한 파열음 + 금속성 고음 공명
            this._tone('sawtooth', 280, 42, 0.19, 0.58);
            this._tone('triangle', 1480, 620, 0.16, 0.38, 0.01);
            this._noise('lowpass', 1850, 240, 1.1, 0.18, 0.65);
        }
        if (classKey === 'knight') {
            // 전사 피격: 판금 갑옷의 묵직한 금속 충격음
            this._tone('sawtooth', 155, 44, 0.16, 0.52);
            this._tone('square', 580, 260, 0.11, 0.26);
            this._noise('lowpass', 920, 180, 1.4, 0.15, 0.54);
        } else if (classKey === 'ranger') {
            // 궁수 피격: 가죽 갑옷의 탄력 있는 묵직한 타격음
            this._tone('triangle', 195, 54, 0.15, 0.48);
            this._noise('bandpass', 1050, 260, 1.3, 0.13, 0.48);
        } else if (classKey === 'wizard') {
            // 마법사 피격: 로브 및 마력 결계 충격음
            this._tone('sine', 210, 58, 0.15, 0.46);
            this._tone('sine', 880, 420, 0.12, 0.24);
            this._noise('bandpass', 1300, 340, 1.6, 0.13, 0.44);
        } else {
            // 몬스터 물리/마법 피격음: 묵직한 육체/갑피 타격감
            this._tone('sawtooth', 175, 48, 0.15, 0.50);
            this._tone('triangle', 130, 40, 0.16, 0.52);
            this._noise('lowpass', 1150, 210, 1.1, 0.14, 0.50);
        }
    },

    // 3) 스킬 및 마법 종류별 맞춤 효과음
    playSkill(skillName = '', classKey = 'wizard', circle = 1, isBoss = false) {
        const n = String(skillName);

        // 고서클(3~6서클) 마법 시전 시 신비로운 마법진 공명음 선행
        if (isBoss) {
            this._tone('sawtooth', 110, 55, 0.55, 0.42);
            this._tone('triangle', 220, 110, 0.50, 0.32, 0.05);
        } else if (circle >= 3 && classKey === 'wizard') {
            this._tone('sine', 440, 880, 0.35, 0.24);
            this._tone('triangle', 660, 1320, 0.38, 0.18, 0.04);
        }

        // [A] 운석 / 대폭발 계열
        if (n.includes('메테오') || n.includes('미티어')) {
            this._tone('sine', 1100, 140, 0.28, 0.36);
            this._noise('lowpass', 850, 85, 1.0, 0.52, 0.72, 0.12);
            this._tone('sawtooth', 125, 34, 0.48, 0.55, 0.12);
            return;
        }
        // [B] 화염 계열
        if (n.includes('파이어') || n.includes('이럽션') || n.includes('헬 파이어')) {
            this._noise('lowpass', 1400, 160, 1.4, 0.36, 0.62);
            this._tone('sawtooth', 240, 58, 0.32, 0.44);
            if (n.includes('헬 파이어') || n.includes('이럽션') || n.includes('월')) {
                this._noise('bandpass', 720, 120, 2.0, 0.42, 0.55, 0.08);
            }
            return;
        }
        // [C] 냉기 / 빙결 계열
        if (n.includes('아이스') || n.includes('콜드') || n.includes('블리자드') || n.includes('제로')) {
            this._tone('sine', 1480, 2450, 0.14, 0.32);
            this._tone('triangle', 2100, 1120, 0.18, 0.28, 0.06);
            this._noise('highpass', 1800, 3600, 2.5, 0.28, 0.42, 0.02);
            if (n.includes('스톰') || n.includes('블리자드') || n.includes('제로')) {
                this._noise('bandpass', 950, 420, 3.2, 0.45, 0.48, 0.05);
            }
            return;
        }
        // [D] 번개 / 뇌전 / 마비 계열
        if (n.includes('라이트닝') || n.includes('파럴라이즈') || n.includes('퓨리')) {
            this._noise('highpass', 2200, 450, 1.8, 0.26, 0.58);
            this._tone('sawtooth', 920, 140, 0.18, 0.42);
            this._tone('square', 1450, 260, 0.16, 0.32, 0.06);
            return;
        }
        // [E] 힐링 / 성마법 치유 계열
        if (n.includes('힐') || n.includes('큐어') || n.includes('터치') && !n.includes('뱀파이어')) {
            const notes = n.includes('그레이트') ? [523, 659, 784, 1046, 1318] : [523, 659, 784, 1046];
            notes.forEach((freq, idx) => {
                this._tone('sine', freq, freq * 1.02, 0.24, 0.28, idx * 0.055);
                this._tone('triangle', freq * 2, freq * 2, 0.18, 0.12, idx * 0.055);
            });
            return;
        }
        // [F] 전사 물리 액티브 (배쉬 / 실드 스트라이크 / 차지 / 휠윈드 / 워크라이 / 레이지 / 카운터)
        if (n.includes('배쉬') || n.includes('실드 스트라이크') || n.includes('차지')) {
            if (n.includes('차지')) this._noise('bandpass', 1800, 500, 2.0, 0.12, 0.45);
            this._tone('sawtooth', 220, 45, 0.24, 0.55, n.includes('차지') ? 0.06 : 0);
            this._tone('square', 580, 180, 0.18, 0.35, n.includes('차지') ? 0.06 : 0);
            this._noise('lowpass', 1100, 150, 1.2, 0.22, 0.58, n.includes('차지') ? 0.06 : 0);
            return;
        }
        if (n.includes('휠윈드')) {
            for (let i = 0; i < 3; i++) {
                this._noise('bandpass', 1600, 420, 2.2, 0.14, 0.50, i * 0.09);
                this._tone('sawtooth', 340, 120, 0.12, 0.30, i * 0.09);
            }
            return;
        }
        if (n.includes('워크라이') || n.includes('레이지')) {
            this._tone('sawtooth', 155, 92, 0.38, 0.48);
            this._tone('sawtooth', 230, 135, 0.35, 0.35, 0.03);
            this._noise('lowpass', 650, 180, 2.0, 0.35, 0.42);
            return;
        }
        // [G] 궁수 사격 액티브 (더블 샷 / 멀티 샷 / 애로우 레인 / 피어스 / 스나이퍼 / 게일)
        if (n.includes('더블 샷') || n.includes('멀티 샷') || n.includes('애로우 레인')) {
            const count = n.includes('레인') ? 5 : (n.includes('멀티') ? 3 : 2);
            for (let i = 0; i < count; i++) {
                this._tone('triangle', 420, 150, 0.08, 0.30, i * 0.055);
                this._noise('highpass', 2600, 900, 1.8, 0.10, 0.35, i * 0.055);
            }
            return;
        }
        if (n.includes('스나이퍼') || n.includes('피어스') || n.includes('게일') || n.includes('윈드 컷')) {
            this._noise('bandpass', 2800, 480, 2.2, 0.22, 0.58);
            this._tone('sawtooth', 680, 110, 0.20, 0.45);
            this._tone('sine', 1360, 320, 0.16, 0.30, 0.02);
            return;
        }
        // [H] 암흑 / 저주 / 데스 레이 / 둠 / 타임 스탑 / 카오스 필드
        if (n.includes('데스 레이')) {
            this._tone('sawtooth', 880, 220, 0.34, 0.45);
            this._tone('square', 440, 110, 0.34, 0.35);
            return;
        }
        if (n.includes('타임 스탑')) {
            this._tone('sine', 880, 880, 0.06, 0.35, 0);
            this._tone('sine', 660, 660, 0.06, 0.35, 0.09);
            this._tone('sawtooth', 260, 32, 0.45, 0.50, 0.18);
            return;
        }
        if (n.includes('둠') || n.includes('데스') || n.includes('카오스') || n.includes('뱀파이어') || n.includes('포이즌') || n.includes('블라인드') || n.includes('슬립') || n.includes('사일런스') || n.includes('바인드')) {
            this._tone('sawtooth', 195, 58, 0.38, 0.44);
            this._tone('triangle', 290, 82, 0.36, 0.32, 0.04);
            this._noise('bandpass', 620, 140, 2.5, 0.34, 0.38);
            return;
        }
        // [I] 텔레포트 / 닷지 스텝
        if (n.includes('텔레포트') || n.includes('닷지')) {
            this._tone('sine', 320, 1280, 0.18, 0.34);
            this._noise('bandpass', 1200, 3400, 2.0, 0.16, 0.30);
            return;
        }
        // [J] 버프 / 오라 계열 기본
        this._tone('sine', 392, 587, 0.22, 0.28);
        this._tone('triangle', 587, 784, 0.25, 0.24, 0.06);
    },

    // 4) 몬스터 사망 시 이름과 어울리는 맞춤 사망 효과음
    playMonsterDeath(monName = '', isBoss = false) {
        const n = String(monName);

        if (isBoss) {
            // 보스 몬스터 사망: 웅장한 저음 괴성 + 대폭발 잔향 + 승리 화음
            this._tone('sawtooth', 160, 28, 0.65, 0.62);
            this._noise('lowpass', 900, 70, 1.2, 0.68, 0.68);
            [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
                this._tone('triangle', f, f, 0.32, 0.26, 0.25 + idx * 0.07);
            });
            return;
        }

        if (n.includes('슬라임')) {
            // 슬라임: 뽀글거리며 녹아내리는 젤리 방울 사운드
            this._tone('sine', 420, 110, 0.16, 0.36);
            this._tone('sine', 580, 160, 0.14, 0.28, 0.06);
        } else if (n.includes('해골') || n.includes('수호병')) {
            // 해골류: 다그닥거리며 뼈가 무너지는 소리
            for (let i = 0; i < 3; i++) {
                this._tone('square', 520 - i * 90, 180, 0.06, 0.28, i * 0.055);
                this._noise('bandpass', 2200 - i * 300, 700, 3.0, 0.06, 0.32, i * 0.055);
            }
        } else if (n.includes('망령') || n.includes('유령') || n.includes('리치') || n.includes('사제') || n.includes('세이렌') || n.includes('픽시') || n.includes('서큐버스')) {
            // 영혼/망령/마법사형: 공허 속으로 흩어지는 원혼 비명음
            this._tone('sine', 780, 210, 0.34, 0.30);
            this._tone('triangle', 540, 140, 0.36, 0.24, 0.03);
            this._noise('bandpass', 1500, 300, 2.5, 0.30, 0.28);
        } else if (n.includes('거미') || n.includes('전갈') || n.includes('벌레') || n.includes('말벌') || n.includes('독사')) {
            // 벌레/절지류/독사: 날카로운 치찰음(Chitter/Hiss)과 껍질 파열음
            this._noise('highpass', 2600, 600, 3.0, 0.18, 0.42);
            this._tone('sawtooth', 620, 130, 0.16, 0.28);
        } else if (n.includes('골렘') || n.includes('타이탄') || n.includes('가고일') || n.includes('엔트') || n.includes('수호목') || n.includes('세계수')) {
            // 암석/기계/거목: 묵직하게 무너져 내리는 붕괴음
            this._noise('lowpass', 620, 65, 1.0, 0.38, 0.58);
            this._tone('sawtooth', 120, 32, 0.36, 0.48);
        } else if (n.includes('늑대') || n.includes('야수') || n.includes('악어') || n.includes('리자드맨') || n.includes('드레이크') || n.includes('드래곤')) {
            // 야수/파충류/용족: 으르렁거리는 하울링 단말마
            this._tone('sawtooth', 260, 68, 0.28, 0.42);
            this._tone('triangle', 380, 95, 0.25, 0.30, 0.03);
            this._noise('lowpass', 950, 180, 1.5, 0.24, 0.36);
        } else {
            // 고블린 / 오크 / 인간형 적: 단말마 신음 + 쓰러지는 소리
            this._tone('sawtooth', 230, 82, 0.22, 0.38);
            this._noise('bandpass', 900, 220, 1.5, 0.18, 0.35, 0.04);
        }
    },

    // =======================================================
    // 🎵 5) 맵 분위기별 실시간 신디사이저 배경음악 (BGM) 시스템
    // - 마을/안전지대: 잔잔하고 평화로운 하프·플루트·따뜻한 패드 선율
    // - 필드(초원/숲/설원/사막/화산 등): 지역 테마에 맞춘 판타지 배경음악
    // - 던전/보스전: 긴장감 넘치는 다크 판타지 및 보스 배틀 테마
    // =======================================================
    bgmTimer: null,
    bgmGain: null,
    currentBgmTheme: null,
    bgmStep: 0,
    bgmUnlocked: false,

    _ensureBgmCtx() {
        const opts = window.OptionState;
        if (opts && !opts.bgmOn) return null;
        const vol = opts && typeof opts.bgmVolume === 'number' ? opts.bgmVolume / 100 : 0.55;
        if (vol <= 0.01) return null;

        try {
            if (!this.ctx) {
                const AudioCtx = window.AudioContext || window.webkitAudioContext;
                if (!AudioCtx) return null;
                this.ctx = new AudioCtx();
            }
            if (this.ctx.state === 'suspended') {
                this.ctx.resume().catch(() => {});
            }
            if (!this.bgmGain && this.ctx) {
                this.bgmGain = this.ctx.createGain();
                this.bgmGain.gain?.setValueAtTime?.(Math.max(0.001, vol * 0.24), this.ctx.currentTime);
                this.bgmGain.connect(this.ctx.destination);
            } else if (this.bgmGain && this.ctx) {
                this.bgmGain.gain?.setTargetAtTime?.(Math.max(0.001, vol * 0.24), this.ctx.currentTime, 0.1);
            }
            return this.ctx;
        } catch (e) {
            return null;
        }
    },

    _bgmNote(freq, dur, wave = 'sine', gainVal = 0.25, cutoff = 1600, attack = 0.04, delay = 0) {
        const ctx = this._ensureBgmCtx();
        if (!ctx || !this.bgmGain || !freq || freq <= 20) return;
        const now = ctx.currentTime + delay;
        const osc = ctx.createOscillator();
        const flt = ctx.createBiquadFilter();
        const g = ctx.createGain();

        osc.type = wave;
        osc.frequency.setValueAtTime(freq, now);

        flt.type = 'lowpass';
        flt.frequency.setValueAtTime(cutoff, now);

        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(gainVal, now + Math.min(attack, dur * 0.35));
        g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc.connect(flt);
        flt.connect(g);
        g.connect(this.bgmGain);

        osc.start(now);
        osc.stop(now + dur + 0.05);
    },

    resolveBgmThemeKey(inSafe, mapKey = '', regionTheme = '초원', isBossFight = false) {
        if (inSafe) return 'TOWN_PEACEFUL';
        if (isBossFight) return 'BOSS_BATTLE';
        if (String(mapKey).endsWith('_dungeon')) return 'DUNGEON_MYSTERY';
        const t = String(regionTheme || '');
        if (t.includes('설원')) return 'FIELD_SNOW';
        if (t.includes('사막') || t.includes('바위산') || t.includes('해안')) return 'FIELD_EXOTIC';
        if (t.includes('늪지') || t.includes('화산') || t.includes('저주') || t.includes('마계') || t.includes('용의') || t.includes('공허')) return 'FIELD_DARK';
        return 'FIELD_BRIGHT';
    },

    setBgmContext(inSafe, mapKey = '', regionTheme = '초원', isBossFight = false) {
        const nextTheme = this.resolveBgmThemeKey(inSafe, mapKey, regionTheme, isBossFight);
        const opts = window.OptionState;
        if (!opts || !opts.bgmOn || (opts.bgmVolume || 0) <= 0) {
            this.stopBgm();
            this.currentBgmTheme = nextTheme;
            return;
        }
        if (this.currentBgmTheme === nextTheme && this.bgmTimer) return;
        this.currentBgmTheme = nextTheme;
        this.bgmStep = 0;
        this.startBgmLoop();
    },

    updateBgmState() {
        const opts = window.OptionState;
        if (!opts || !opts.bgmOn || (opts.bgmVolume || 0) <= 0) {
            this.stopBgm();
            return;
        }
        if (this.bgmGain && this.ctx) {
            const vol = Math.max(0, Math.min(100, Number(opts.bgmVolume) || 0)) / 100;
            try { this.bgmGain.gain?.setTargetAtTime?.(Math.max(0.001, vol * 0.24), this.ctx.currentTime, 0.08); } catch (e) {}
        }
        if (!this.bgmTimer) {
            this.startBgmLoop();
        }
    },

    stopBgm() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
        if (this.bgmGain && this.ctx) {
            try {
                this.bgmGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
            } catch (e) {}
        }
    },

    startBgmLoop() {
        if (this.bgmTimer) {
            clearInterval(this.bgmTimer);
            this.bgmTimer = null;
        }
        const opts = window.OptionState;
        if (!opts || !opts.bgmOn || (opts.bgmVolume || 0) <= 0) return;

        const theme = this.currentBgmTheme || 'TOWN_PEACEFUL';
        const stepMsMap = {
            TOWN_PEACEFUL: 410,
            FIELD_BRIGHT: 290,
            FIELD_SNOW: 350,
            FIELD_EXOTIC: 270,
            FIELD_DARK: 260,
            DUNGEON_MYSTERY: 310,
            BOSS_BATTLE: 210
        };
        const stepMs = stepMsMap[theme] || 360;

        const playStep = () => {
            if (!window.OptionState?.bgmOn || (window.OptionState?.bgmVolume || 0) <= 0) {
                this.stopBgm();
                return;
            }
            const ctx = this._ensureBgmCtx();
            if (!ctx || ctx.state !== 'running') return;

            const s = this.bgmStep % 32;
            this.bgmStep++;

            if (theme === 'TOWN_PEACEFUL') {
                // 잔잔하고 평화로운 마을 음악 (Cmaj7 - G/B - Am7 - Fmaj7 하프 아르페지오 & 따뜻한 플루트 선율)
                const chords = [
                    [261.63, 329.63, 392.00, 493.88], // Cmaj7
                    [246.94, 293.66, 392.00, 587.33], // Gadd9/B
                    [220.00, 261.63, 329.63, 392.00], // Am7
                    [174.61, 261.63, 349.23, 440.00]  // Fmaj7
                ];
                const cIdx = Math.floor(s / 8) % 4;
                const chord = chords[cIdx];

                // 마디 첫 박에 따뜻한 저음 패드 화음
                if (s % 8 === 0) {
                    this._bgmNote(chord[0] * 0.5, 3.1, 'sine', 0.24, 650, 0.35);
                    this._bgmNote(chord[1], 2.8, 'sine', 0.14, 800, 0.40);
                    this._bgmNote(chord[2], 2.8, 'triangle', 0.10, 900, 0.45);
                }
                // 잔잔한 하프/류트 아르페지오
                const arpPattern = [0, 1, 2, 3, 2, 1, 2, 0];
                const arpNote = chord[arpPattern[s % 8]];
                this._bgmNote(arpNote, 0.75, 'triangle', 0.16, 1350, 0.02);

                // 서정적인 플루트/오르골 멜로디
                const melody = [
                    523.25, 0, 659.25, 587.33, 523.25, 0, 392.00, 0,
                    493.88, 0, 587.33, 659.25, 587.33, 0, 392.00, 0,
                    440.00, 0, 523.25, 659.25, 783.99, 0, 659.25, 523.25,
                    587.33, 523.25, 440.00, 0, 392.00, 0, 0, 0
                ];
                if (melody[s] > 0) {
                    this._bgmNote(melody[s], 0.95, 'sine', 0.22, 1800, 0.08);
                }
            } else if (theme === 'FIELD_BRIGHT') {
                // 초원·숲·호수 모험 테마 (Am - F - C - G)
                const chords = [
                    [220.00, 261.63, 329.63, 440.00],
                    [174.61, 220.00, 261.63, 349.23],
                    [261.63, 329.63, 392.00, 523.25],
                    [196.00, 246.94, 293.66, 392.00]
                ];
                const chord = chords[Math.floor(s / 8) % 4];
                if (s % 4 === 0) {
                    this._bgmNote(chord[0] * 0.5, 0.9, 'triangle', 0.22, 700, 0.03);
                }
                const arp = chord[s % 4];
                this._bgmNote(arp, 0.42, 'triangle', 0.14, 1500, 0.02);
                const mel = [
                    440.00, 0, 523.25, 587.33, 659.25, 0, 587.33, 523.25,
                    587.33, 523.25, 440.00, 0, 349.23, 0, 440.00, 0,
                    523.25, 0, 659.25, 783.99, 659.25, 0, 523.25, 0,
                    587.33, 0, 493.88, 392.00, 440.00, 0, 0, 0
                ];
                if (mel[s] > 0) this._bgmNote(mel[s], 0.55, 'sine', 0.20, 1900, 0.04);
            } else if (theme === 'FIELD_SNOW') {
                // 설원 크리스탈 테마 (Em - Cmaj7 - D - Bm)
                const chords = [
                    [164.81, 246.94, 329.63, 493.88],
                    [130.81, 261.63, 329.63, 493.88],
                    [146.83, 293.66, 369.99, 587.33],
                    [246.94, 293.66, 369.99, 493.88]
                ];
                const chord = chords[Math.floor(s / 8) % 4];
                if (s % 8 === 0) this._bgmNote(chord[0], 2.4, 'sine', 0.20, 800, 0.25);
                this._bgmNote(chord[(s * 2) % 4] * 2, 0.65, 'sine', 0.13, 2400, 0.01);
            } else if (theme === 'FIELD_EXOTIC') {
                // 사막·협곡·해안 테마 (Dm - Bb - Gm - A7)
                const chords = [
                    [146.83, 220.00, 293.66, 349.23],
                    [116.54, 233.08, 293.66, 349.23],
                    [196.00, 233.08, 293.66, 392.00],
                    [110.00, 220.00, 277.18, 329.63]
                ];
                const chord = chords[Math.floor(s / 8) % 4];
                if (s % 2 === 0) this._bgmNote(chord[0], 0.35, 'triangle', 0.20, 850, 0.01);
                this._bgmNote(chord[s % 4] * 1.5, 0.32, 'sawtooth', 0.10, 1200, 0.02);
            } else if (theme === 'BOSS_BATTLE') {
                // 보스 전투 긴박한 오케스트라 신스 테마
                const bassNotes = [146.83, 146.83, 116.54, 130.81];
                const root = bassNotes[Math.floor(s / 8) % 4];
                this._bgmNote(root * (s % 2 === 0 ? 0.5 : 1), 0.22, 'sawtooth', 0.22, 950, 0.01);
                const bossMel = [
                    587.33, 0, 587.33, 659.25, 698.46, 0, 659.25, 587.33,
                    523.25, 0, 466.16, 523.25, 587.33, 0, 440.00, 0,
                    587.33, 0, 698.46, 783.99, 880.00, 0, 783.99, 698.46,
                    659.25, 0, 554.37, 0, 587.33, 0, 0, 0
                ];
                if (bossMel[s] > 0) this._bgmNote(bossMel[s], 0.32, 'sawtooth', 0.16, 1750, 0.02);
            } else {
                // 다크 판타지 / 던전 미궁 테마 (Cm - Ab - Fm - G7)
                const chords = [
                    [130.81, 196.00, 261.63, 311.13],
                    [103.83, 207.65, 261.63, 311.13],
                    [174.61, 207.65, 261.63, 349.23],
                    [196.00, 246.94, 293.66, 392.00]
                ];
                const chord = chords[Math.floor(s / 8) % 4];
                if (s % 4 === 0) this._bgmNote(chord[0] * 0.5, 0.9, 'sine', 0.24, 520, 0.05);
                this._bgmNote(chord[s % 4], 0.45, 'triangle', 0.13, 1100, 0.03);
            }
        };

        playStep();
        this.bgmTimer = setInterval(playStep, stepMs);
    }
};
window.SoundSystem = SoundSystem;

// =======================================================
// 🌟 드롭 아이템 스프라이트 매니저 (./asset/item.png 축소 적용)
// =======================================================
export const ItemSpriteManager = {
    baseTexture: null,
    textures: {},
    loaded: false
};

export async function loadItemSheetSprites(itemJsonData) {
    if (!itemJsonData || !itemJsonData.items) return;
    try {
        const tex = await PIXI.Texture.fromURL('./asset/item.png');
        ItemSpriteManager.baseTexture = tex.baseTexture;
        const gridSize = itemJsonData.gridSize || 34;
        const margin = itemJsonData.margin || 1;
        const size = itemJsonData.size || 32;

        itemJsonData.items.forEach(itemDef => {
            if (itemDef.grid) {
                const rx = itemDef.grid.x * gridSize + margin;
                const ry = itemDef.grid.y * gridSize + margin;
                if (rx + size <= ItemSpriteManager.baseTexture.width && ry + size <= ItemSpriteManager.baseTexture.height) {
                    const rect = new PIXI.Rectangle(rx, ry, size, size);
                    ItemSpriteManager.textures[itemDef.id] = new PIXI.Texture(ItemSpriteManager.baseTexture, rect);
                }
            }
        });
        if (!ItemSpriteManager.textures['S_RE01'] && ItemSpriteManager.textures['S_AR01']) {
            ItemSpriteManager.textures['S_RE01'] = ItemSpriteManager.textures['S_AR01'];
        }
        ItemSpriteManager.loaded = true;
    } catch (e) {
        console.warn("[System] item.png 로드 실패 - 기본 도형 모드로 대체:", e);
    }
}

export function drawItem(ctx, x, y, item, tick, entityContainer = null) {
    ctx.save();
    ctx.translate(x, y);
    ctx.ellipse(0, 7, 7, 2.5, 'rgba(0,0,0,0.45)', null);
    let bounce = Math.sin(tick * 0.06 + x) * 2.5;
    let t = item.type;

    if (ItemSpriteManager.loaded && ItemSpriteManager.textures[t] && (entityContainer || PlayerSpriteManager.container)) {
        const targetContainer = entityContainer || PlayerSpriteManager.container;
        if (!item.pixiSprite) {
            item.pixiSprite = new PIXI.Sprite(ItemSpriteManager.textures[t]);
            item.pixiSprite.anchor.set(0.5, 0.5);
            item.pixiSprite.scale.set(0.62);
            targetContainer.addChild(item.pixiSprite);
        }
        item.pixiSprite.visible = true;
        item.pixiSprite.x = x;
        item.pixiSprite.y = y + bounce - 3;
        ctx.restore();
        return;
    }

    ctx.translate(0, bounce - 3);
    ctx.scale(0.75, 0.75);
    if (t === 'gold') {
        ctx.ellipse(0, 2, 7, 5, '#facc15', '#b45309', 1);
        ctx.ellipse(0, 0, 7, 5, '#fde047', '#b45309', 1);
    } else {
        ctx.poly([[-5,-5], [5,-5], [6,5], [-6,5]], '#a8a29e', '#57534e', 1);
        ctx.poly([[-2,-7], [2,-7], [3,-5], [-3,-5]], '#78350f', '#451a03', 1);
    }
    ctx.restore();
}

// =======================================================
// 🌟 플레이어 2D 스프라이트 렌더링 매니저 (전사 / 궁수 / 마법사 통합)
// =======================================================
export const PlayerSpriteManager = {
    container: null,
    sprite: null,
    textures: {},
    loaded: false,
    currentFrame: 0,
    lastFrameTime: 0
};

async function loadSpriteSheetBaseTexture(urls, removeBlackBg = false) {
    for (const url of urls) {
        try {
            const img = await new Promise((resolve, reject) => {
                const el = new Image();
                el.crossOrigin = 'anonymous';
                el.onload = () => resolve(el);
                el.onerror = reject;
                el.src = url;
            });

            if (removeBlackBg) {
                const canvas = document.createElement('canvas');
                canvas.width = img.width;
                canvas.height = img.height;
                const c = canvas.getContext('2d');
                c.drawImage(img, 0, 0);
                const imgData = c.getImageData(0, 0, canvas.width, canvas.height);
                const data = imgData.data;
                for (let i = 0; i < data.length; i += 4) {
                    if (data[i] <= 14 && data[i + 1] <= 14 && data[i + 2] <= 14) {
                        data[i + 3] = 0;
                    }
                }
                c.putImageData(imgData, 0, 0);
                return PIXI.BaseTexture.from(canvas);
            }
            return PIXI.BaseTexture.from(img);
        } catch (e) {}
    }
    return null;
}

export async function loadCustomSprites() {
    const knightAssets = [
        { name: 'none', urls: ['./asset/knight.png'] },
        { name: 'sh',   urls: ['./asset/knight_sh.png'] },
        { name: 'sw',   urls: ['./asset/knight_sw.png'] },
        { name: 'sw_sh',urls: ['./asset/knight_sw_sh.png'] }
    ];

    const rowActions = [
        'walk_up', 'walk_left', 'walk_down', 'walk_right',
        'attack_up', 'attack_left', 'attack_down', 'attack_right'
    ];

    for (let asset of knightAssets) {
        const baseTex = await loadSpriteSheetBaseTexture(asset.urls, false);
        if (!baseTex) continue;
        PlayerSpriteManager.textures[asset.name] = {};
        const frameW = 64, frameH = 64;
        const columns = Math.floor(baseTex.width / frameW);
        const rows = Math.min(Math.floor(baseTex.height / frameH), 8);

        for (let r = 0; r < rows; r++) {
            let action = rowActions[r];
            PlayerSpriteManager.textures[asset.name][action] = [];
            for (let c = 0; c < columns; c++) {
                let frame = new PIXI.Rectangle(c * frameW, r * frameH, frameW, frameH);
                PlayerSpriteManager.textures[asset.name][action].push(new PIXI.Texture(baseTex, frame));
            }
        }
    }

    const elfAssets = [
        {
            name: 'archer_none',
            urls: ['./asset/ELF_ARCHER.png'],
            rows: [
                { action: 'walk_up',      startY: 512,  frameW: 64, frameH: 64, count: 6 },
                { action: 'walk_left',    startY: 576,  frameW: 64, frameH: 64, count: 6 },
                { action: 'walk_down',    startY: 640,  frameW: 64, frameH: 64, count: 6 },
                { action: 'walk_right',   startY: 704,  frameW: 64, frameH: 64, count: 6 },
                { action: 'attack_up',    startY: 768,  frameW: 64, frameH: 64, count: 4 },
                { action: 'attack_left',  startY: 832,  frameW: 64, frameH: 64, count: 4 },
                { action: 'attack_down',  startY: 896,  frameW: 64, frameH: 64, count: 4 },
                { action: 'attack_right', startY: 960,  frameW: 64, frameH: 64, count: 4 }
            ]
        },
        {
            name: 'archer_bow',
            urls: ['./asset/ELF_ARCHER_bow.png'],
            rows: [
                { action: 'walk_up',      startY: 3489, frameW: 128, frameH: 64, count: 7 },
                { action: 'walk_left',    startY: 3615, frameW: 128, frameH: 64, count: 7 },
                { action: 'walk_down',    startY: 3744, frameW: 128, frameH: 64, count: 7 },
                { action: 'walk_right',   startY: 3871, frameW: 128, frameH: 64, count: 7 },
                { action: 'attack_up',    startY: 1024, frameW: 64,  frameH: 64, count: 13 },
                { action: 'attack_left',  startY: 1088, frameW: 64,  frameH: 64, count: 13 },
                { action: 'attack_down',  startY: 1152, frameW: 64,  frameH: 64, count: 13 },
                { action: 'attack_right', startY: 1216, frameW: 64,  frameH: 64, count: 13 }
            ]
        },
        {
            name: 'mage',
            urls: ['./asset/ELF_MAGE.png'],
            rows: [
                { action: 'walk_up',      startY: 512,  frameW: 64, frameH: 64, count: 4 },
                { action: 'walk_left',    startY: 576,  frameW: 64, frameH: 64, count: 6 },
                { action: 'walk_down',    startY: 640,  frameW: 64, frameH: 64, count: 6 },
                { action: 'walk_right',   startY: 704,  frameW: 64, frameH: 64, count: 6 },
                { action: 'attack_up',    startY: 0,    frameW: 64, frameH: 64, count: 4 },
                { action: 'attack_left',  startY: 64,   frameW: 64, frameH: 64, count: 4 },
                { action: 'attack_down',  startY: 128,  frameW: 64, frameH: 64, count: 4 },
                { action: 'attack_right', startY: 192,  frameW: 64, frameH: 64, count: 4 }
            ]
        }
    ];

    for (let asset of elfAssets) {
        const baseTex = await loadSpriteSheetBaseTexture(asset.urls, true);
        if (!baseTex) {
            console.warn(`[System] 스프라이트 시트 로드 실패: ${asset.name}`);
            continue;
        }
        PlayerSpriteManager.textures[asset.name] = {};

        for (let rInfo of asset.rows) {
            const fw = rInfo.frameW || 64;
            const fh = rInfo.frameH || 64;
            PlayerSpriteManager.textures[asset.name][rInfo.action] = [];
            if (rInfo.startY + fh > baseTex.height) continue;

            const maxCols = Math.floor(baseTex.width / fw);
            const count = Math.min(rInfo.count, maxCols);
            for (let c = 0; c < count; c++) {
                let rect = new PIXI.Rectangle(c * fw, rInfo.startY, fw, fh);
                PlayerSpriteManager.textures[asset.name][rInfo.action].push(new PIXI.Texture(baseTex, rect));
            }
        }
    }

    PlayerSpriteManager.loaded = true;
}

export function drawPlayer(ctx, x, y, p, tick, now) {
    if (!PlayerSpriteManager.loaded) return;

    if (!PlayerSpriteManager.sprite) {
        PlayerSpriteManager.sprite = new PIXI.Sprite();
        PlayerSpriteManager.sprite.anchor.set(0.5, 0.92);
        PlayerSpriteManager.sprite.scale.set(1.05);
        if (PlayerSpriteManager.container) {
            PlayerSpriteManager.container.addChild(PlayerSpriteManager.sprite);
        }
    }

    let equipState = 'none';
    if (p.class === 'ranger') {
        const wType = (p.equip.weapon !== null && p.inventory[p.equip.weapon]) ? String(p.inventory[p.equip.weapon].type || '') : '';
        const hasBow = wType.includes('W_BW') || wType.includes('_BW');
        equipState = hasBow ? 'archer_bow' : 'archer_none';
    } else if (p.class === 'wizard') {
        equipState = 'mage';
    } else {
        if (p.equip.weapon !== null && p.equip.shield !== null) equipState = 'sw_sh';
        else if (p.equip.weapon !== null) equipState = 'sw';
        else if (p.equip.shield !== null) equipState = 'sh';
        else equipState = 'none';
    }

    if (!PlayerSpriteManager.textures[equipState]) {
        equipState = 'none';
    }

    let action = (p.isMoving || p.isWalking) ? 'walk' : 'idle';
    let isAttack = now - p.lastAttackTime < 420;
    if (isAttack) action = 'attack';

    let animName = `${action === 'idle' ? 'walk' : action}_${p.dir}`;
    let textures = PlayerSpriteManager.textures[equipState]?.[animName];
    if (!textures || textures.length === 0) {
        textures = PlayerSpriteManager.textures[equipState]?.['walk_down'];
    }

    if (textures && textures.length > 0) {
        if (action === 'idle') {
            PlayerSpriteManager.sprite.texture = textures[0];
        } else {
            let frameSpeed = isAttack ? Math.max(30, Math.floor(380 / textures.length)) : 95;
            if (now - PlayerSpriteManager.lastFrameTime > frameSpeed) {
                PlayerSpriteManager.currentFrame++;
                PlayerSpriteManager.lastFrameTime = now;
            }
            if (PlayerSpriteManager.currentFrame >= textures.length) {
                PlayerSpriteManager.currentFrame = 0;
            }
            PlayerSpriteManager.sprite.texture = textures[PlayerSpriteManager.currentFrame];
        }
    }

    // 묵직한 공격 런지 & 피격 리코일(반동) 표현
    let offsetX = 0, offsetY = 0;
    const atkElapsed = now - (p.lastAttackTime || 0);
    if (atkElapsed >= 0 && atkElapsed < 210) {
        const lunge = Math.sin((atkElapsed / 210) * Math.PI) * (p.class === 'knight' ? 7.5 : 4.0);
        const dirVec = p.dir === 'left' ? [-1, 0] : (p.dir === 'right' ? [1, 0] : (p.dir === 'up' ? [0, -0.75] : [0, 0.75]));
        offsetX += dirVec[0] * lunge;
        offsetY += dirVec[1] * lunge;
    }
    const hitElapsed = now - (p.lastHitTime || 0);
    if (hitElapsed >= 0 && hitElapsed < 170) {
        const recoil = Math.sin((hitElapsed / 170) * Math.PI) * 6.0;
        const hAng = typeof p.lastHitAngle === 'number' ? p.lastHitAngle : 0;
        offsetX += Math.cos(hAng) * recoil;
        offsetY += Math.sin(hAng) * recoil * 0.65;
        PlayerSpriteManager.sprite.tint = hitElapsed < 95 ? 0xff9999 : 0xffffff;
    } else {
        PlayerSpriteManager.sprite.tint = 0xffffff;
    }

    PlayerSpriteManager.sprite.anchor.set(0.5, 0.92);
    PlayerSpriteManager.sprite.x = x + offsetX;
    PlayerSpriteManager.sprite.y = y + offsetY;

    // 🌟 본인 캐릭터 전용 시인성 오라: 용병/타플레이어 오라와 절대 혼동되지 않는 [황금 왕관 비콘 이중 링 + 4방향 회전 스타 포인터]
    ctx.save();
    ctx.translate(x, y);
    ctx.ellipse(0, 2, 14, 4.5, 'rgba(0, 0, 0, 0.45)', null, 0);
    const ringRx = 20.5 + Math.sin(tick * 0.09) * 1.4;
    const ringRy = ringRx * ISO_TILT;
    // 1) 바닥에 은은하게 퍼지는 황금빛 주인공 필드 광채
    ctx.ellipse(0, 3, ringRx * 1.08, ringRy * 1.08, 'rgba(250, 204, 21, 0.14)', null, 0);
    // 2) 외곽 선명한 로얄 골드 링 (#facc15) & 내부 네온 화이트-골드 이중 링 (#fef08a)
    ctx.ellipse(0, 3, ringRx, ringRy, null, '#facc15', 2.4);
    ctx.ellipse(0, 3, ringRx * 0.76, ringRy * 0.76, null, 'rgba(254, 240, 138, 0.78)', 1.3);
    // 3) 4방향으로 회전하는 황금 다이아몬드 비콘 포인터 (난전 속에서도 내 캐릭터 위치를 즉각 식별)
    const rotBase = tick * 0.04;
    for (let i = 0; i < 4; i++) {
        const ang = rotBase + (i * Math.PI) / 2;
        const tipX = Math.cos(ang) * (ringRx * 1.18);
        const tipY = 3 + Math.sin(ang) * (ringRy * 1.18);
        const inX = Math.cos(ang) * (ringRx * 0.88);
        const inY = 3 + Math.sin(ang) * (ringRy * 0.88);
        const s1X = Math.cos(ang + 0.14) * (ringRx * 1.02);
        const s1Y = 3 + Math.sin(ang + 0.14) * (ringRy * 1.02);
        const s2X = Math.cos(ang - 0.14) * (ringRx * 1.02);
        const s2Y = 3 + Math.sin(ang - 0.14) * (ringRy * 1.02);
        ctx.poly([[inX, inY], [s1X, s1Y], [tipX, tipY], [s2X, s2Y]], '#fef08a', '#ca8a04', 1.1);
    }
    ctx.restore();
}

export function drawNPC(ctx, x, y, npc, tick) {
    ctx.save();
    ctx.translate(x, y);
    ctx.ellipse(0, 18, 14, 5, 'rgba(0,0,0,0.5)', null);

    let role = npc.role || "";
    let name = npc.name || "";
    let bob = Math.sin(tick * 0.06 + x) * 1.5;

    if (role === "WORLDMAP" || name.includes("아리아") || name.includes("포탈")) {
        let pRot = tick * 0.04;
        ctx.ellipse(0, 16, 22 + Math.sin(pRot) * 3, 8, null, '#c084fc', 2);
        ctx.ellipse(0, 16, 15, 5 + Math.cos(pRot) * 2, null, '#38bdf8', 1.5);
        ctx.translate(0, bob);
        ctx.scale(0.9, 0.9);
        ctx.poly([[-15, -4], [15, -4], [19, 26], [-19, 26]], '#3b0764', '#1e1b4b', 1.5);
        ctx.poly([[-9, -4], [9, -4], [11, 26], [-11, 26]], '#7e22ce', '#581c87', 1);
        ctx.poly([[-10, -4], [10, -4], [8, 4], [-8, 4]], '#facc15', '#b45309', 1);
        ctx.ellipse(0, -16, 10, 10, '#fde68a', '#111111', 1);
        ctx.curveFill(-13, -14, -15, -32, 15, -32, 13, -14, '#581c87', '#c084fc', 1.5);
        let orbY = -10 + Math.sin(tick * 0.08) * 3;
        ctx.ellipse(18, orbY, 6, 6, '#38bdf8', '#e0f2fe', 1.5);
    }
    else if (role === "MERCHANT" || name.includes("마르코")) {
        ctx.translate(0, bob);
        ctx.scale(0.9, 0.9);
        ctx.ellipse(-12, 4, 9, 14, '#78350f', '#451a03', 1.5);
        ctx.ellipse(-12, -6, 7, 5, '#d97706', '#451a03', 1);
        ctx.poly([[-13, -5], [13, -5], [15, 26], [-15, 26]], '#991b1b', '#450a0a', 1.5);
        ctx.poly([[-5, -5], [5, -5], [4, 18], [-4, 18]], '#fef3c7', '#d97706', 1);
        ctx.poly([[-14, 12], [14, 12], [14, 16], [-14, 16]], '#451a03', '#111111', 1);
        ctx.ellipse(11, 17, 5, 5, '#facc15', '#b45309', 1);
        ctx.ellipse(0, -16, 10, 10, '#fcd34d', '#111111', 1);
        ctx.poly([[-6, -13], [0, -15], [6, -13], [0, -11]], '#451a03', null, 0);
        ctx.ellipse(0, -24, 13, 5, '#b45309', '#451a03', 1.5);
        ctx.ellipse(4, -27, 4, 4, '#facc15', null, 0);
    }
    else if (role === "SKILL" || name.includes("엘린")) {
        ctx.translate(0, bob);
        ctx.scale(0.9, 0.9);
        ctx.poly([[-14, -5], [14, -5], [18, 26], [-18, 26]], '#1e3a8a', '#172554', 1.5);
        ctx.poly([[-6, -5], [6, -5], [8, 26], [-8, 26]], '#3b82f6', '#1d4ed8', 1);
        ctx.poly([[16, -24], [19, -24], [19, 26], [16, 26]], '#78350f', '#451a03', 1);
        ctx.ellipse(17.5, -27, 6, 6, '#60a5fa', '#eff6ff', 1.5);
        ctx.ellipse(0, -16, 10, 10, '#fde68a', '#111111', 1);
        ctx.ellipse(0, -22, 16, 4, '#1e3a8a', '#facc15', 1.5);
        ctx.poly([[-10, -22], [10, -22], [2, -38], [-4, -36]], '#1d4ed8', '#172554', 1.5);
    }
    else if (role === "MERCENARY" || name.includes("카셀")) {
        ctx.translate(0, bob);
        ctx.scale(0.92, 0.92);
        ctx.poly([[-16, -4], [16, -4], [19, 26], [-19, 26]], '#7f1d1d', '#450a0a', 1.5);
        ctx.poly([[-11, -4], [11, -4], [12, 26], [-12, 26]], '#94a3b8', '#1e293b', 1.5);
        ctx.poly([[-4, -4], [4, -4], [3, 22], [-3, 22]], '#facc15', '#b45309', 1);
        ctx.ellipse(0, -16, 10, 10, '#fcd34d', '#111111', 1);
        ctx.curveFill(-10, -19, -11, -31, 11, -31, 10, -19, '#64748b', '#1e293b', 1.5);
        ctx.curveFill(0, -29, 7, -39, 15, -33, 9, -25, '#ef4444', '#7f1d1d', 1.2);
        ctx.poly([[14, -18], [18, -18], [18, 26], [14, 26]], '#e2e8f0', '#334155', 1.2);
    }
    else if (role === "QUEST" || name.includes("발렌") || name.includes("아리엘") || name.includes("토르딘") || name.includes("실바나") || name.includes("하킴")) {
        ctx.translate(0, bob);
        ctx.scale(0.92, 0.92);
        ctx.poly([[-16, -4], [16, -4], [20, 26], [-20, 26]], '#7f1d1d', '#450a0a', 1.5);
        ctx.poly([[-11, -4], [11, -4], [12, 26], [-12, 26]], '#374151', '#111827', 1);
        ctx.poly([[-12, -5], [12, -5], [10, 2], [-10, 2]], '#facc15', '#b45309', 1);
        ctx.ellipse(0, -16, 10, 10, '#fcd34d', '#111111', 1);
        ctx.poly([[-8, -12], [8, -12], [5, 2], [0, 6], [-5, 2]], '#f3f4f6', '#9ca3af', 1);
        ctx.poly([[-9, -23], [-9, -30], [-4, -26], [0, -31], [4, -26], [9, -30], [9, -23]], '#facc15', '#b45309', 1);
        ctx.poly([[-17, -14], [-14, -14], [-14, 26], [-17, 26]], '#78350f', '#451a03', 1);
        ctx.ellipse(-15.5, -16, 4, 4, '#facc15', '#b45309', 1);
    }
    else if (role === "SCROLL" || name.includes("카인")) {
        ctx.translate(0, bob);
        ctx.scale(0.9, 0.9);
        ctx.poly([[-14, -5], [14, -5], [16, 26], [-16, 26]], '#065f46', '#022c22', 1.5);
        ctx.poly([[-7, -5], [7, -5], [8, 26], [-8, 26]], '#047857', '#064e3b', 1);
        ctx.poly([[-14, 10], [14, 10], [14, 14], [-14, 14]], '#451a03', '#111111', 1);
        ctx.ellipse(-6, 14, 3, 4, '#ef4444', '#111111', 1);
        ctx.ellipse(0, 14, 3, 4, '#3b82f6', '#111111', 1);
        ctx.ellipse(6, 14, 3, 4, '#eab308', '#111111', 1);
        ctx.ellipse(0, -16, 10, 10, '#fcd34d', '#111111', 1);
        ctx.curveFill(-12, -14, -12, -28, 12, -28, 12, -14, '#065f46', '#facc15', 1.5);
        ctx.poly([[12, -6], [22, -8], [22, 6], [12, 8]], '#fef08a', '#ca8a04', 1.5);
    }
    else {
        ctx.scale(0.85, 0.85);
        ctx.poly([[-14, -5], [14, -5], [16, 28], [-16, 28]], '#78350f', '#451a03', 1);
        ctx.ellipse(0, -18, 10, 11, '#fcd34d');
        ctx.curveFill(-12, -16, -10, -25, 10, -25, 12, -16, '#451a03', '#111111', 1);
    }
    ctx.restore();
}

// ============================================================================
// 📐 2.5D 시점 표준 기울기 상수 (플레이어 바닥 그림자 14 : 4.5 비율 = 약 0.3214)
// ============================================================================
export const ISO_TILT = 4.5 / 14;

// 선명하고 깔끔한 글로우 파티클 (과도한 4중 번짐을 제거하고 2중 크리스탈 코어+후광으로 가독성 및 FPS 향상)
function drawSoftGlowParticle(g, x, y, radius, colorHex, alpha = 1.0, coreColorHex = 0xffffff) {
    const a = Math.max(0, Math.min(1, alpha));
    if (a <= 0.01 || radius <= 0.2) return;
    g.lineStyle(0);
    g.beginFill(colorHex, a * 0.42).drawCircle(x, y, radius * 1.35).endFill();
    g.beginFill(coreColorHex, a * 0.92).drawCircle(x, y, radius * 0.58).endFill();
}

// 2.5D 바닥 원근감이 적용된 부드러운 타원 글로우 헬퍼
function drawSoftIsoEllipse(g, cx, cy, rx, colorHex, alpha = 1.0, lineW = 2.0, fillAlpha = 0.14) {
    const a = Math.max(0, Math.min(1, alpha));
    if (a <= 0.01 || rx <= 0.5) return;
    const ry = rx * ISO_TILT;
    if (fillAlpha > 0) {
        g.lineStyle(0);
        g.beginFill(colorHex, a * fillAlpha).drawEllipse(cx, cy, rx, ry).endFill();
    }
    if (lineW > 0) {
        g.lineStyle(lineW + 2.2, colorHex, a * 0.24).drawEllipse(cx, cy, rx * 1.03, ry * 1.03);
        g.lineStyle(lineW, colorHex, a * 0.92).drawEllipse(cx, cy, rx, ry);
        g.lineStyle(0);
    }
}

// ============================================================================
// 🎯 2.5D 시점 맞춤 선택링(아군/NPC/아이템) & 타겟링(몬스터/보스) 바닥 렌더러
// - 플레이어 그림자(14 : 4.5)와 동일한 기울기(ISO_TILT)로 캐릭터/몬스터 발밑 바닥에 렌더링
// ============================================================================
export function drawIsoSelectionRing(g, cx, cy, baseRx, mainCol = 0xef4444, subCol = 0xfca5a5, tick = 0, isBoss = false, ringType = 'target') {
    const pulse = Math.sin(tick * 0.10) * (isBoss ? 2.5 : 1.5);
    const rx = baseRx + pulse;
    const ry = rx * ISO_TILT;

    // 1) 바닥에 깔리는 부드러운 2.5D 타원형 외부 광채 및 반투명 필드
    g.lineStyle(0);
    g.beginFill(mainCol, isBoss ? 0.18 : 0.13).drawEllipse(cx, cy, rx * 1.08, ry * 1.08).endFill();

    // 2) 메인 2.5D 타원 링 & 내부 보조 링
    g.lineStyle(isBoss ? 3.0 : 2.2, mainCol, 0.92).drawEllipse(cx, cy, rx, ry);
    g.lineStyle(1.3, subCol, 0.78).drawEllipse(cx, cy, rx * 0.78, ry * 0.78);

    // 3) 2.5D 타원 궤도를 따라 회전하는 4방향 포인터 마커 (시점 기울기 완벽 일치)
    const rotBase = tick * (ringType === 'target' ? -0.045 : 0.035);
    const markerCount = 4;
    for (let i = 0; i < markerCount; i++) {
        const ang = rotBase + (i * Math.PI * 2) / markerCount;
        const px = cx + Math.cos(ang) * (rx * 1.04);
        const py = cy + Math.sin(ang) * (ry * 1.04);
        const inX = cx + Math.cos(ang) * (rx * 0.82);
        const inY = cy + Math.sin(ang) * (ry * 0.82);
        const sideAng1 = ang + 0.14;
        const sideAng2 = ang - 0.14;
        const s1x = cx + Math.cos(sideAng1) * (rx * 1.12);
        const s1y = cy + Math.sin(sideAng1) * (ry * 1.12);
        const s2x = cx + Math.cos(sideAng2) * (rx * 1.12);
        const s2y = cy + Math.sin(sideAng2) * (ry * 1.12);

        g.lineStyle(1.4, 0xffffff, 0.85);
        g.beginFill(subCol, 0.92);
        g.moveTo(inX, inY);
        g.lineTo(s1x, s1y);
        g.lineTo(px, py);
        g.lineTo(s2x, s2y);
        g.closePath();
        g.endFill();
    }
    g.lineStyle(0);
}

// ============================================================================
// 👥 멀티플레이어 타 캐릭터 스프라이트 시트 렌더러 (내 캐릭터와 100% 동일한 스프라이트시트 & 4방향 보행/공격 애니메이션 적용)
// ============================================================================
export function destroyOtherPlayerSprite(op) {
    if (!op) return;
    if (op.pixiSprite) {
        try {
            if (op.pixiSprite.parent) op.pixiSprite.parent.removeChild(op.pixiSprite);
            op.pixiSprite.destroy({ children: false, texture: false, baseTexture: false });
        } catch (e) {}
        op.pixiSprite = null;
    }
}

export function drawOtherPlayer(ctx, x, y, op, tick, now, entityContainer = null) {
    if (!op) return;

    // 1. 바닥 2.5D 그림자 (내 캐릭터와 동일한 14 : 4.5 비율)
    ctx.save();
    ctx.translate(x, y);
    ctx.ellipse(0, 2, 14, 4.5, 'rgba(0, 0, 0, 0.45)', null, 0);
    ctx.restore();

    const targetContainer = entityContainer || PlayerSpriteManager.container;
    if (PlayerSpriteManager.loaded && targetContainer) {
        if (!op.pixiSprite || op.pixiSprite.destroyed) {
            op.pixiSprite = new PIXI.Sprite();
            op.pixiSprite.anchor.set(0.5, 0.92);
            op.pixiSprite.scale.set(1.05);
            targetContainer.addChild(op.pixiSprite);
        } else if (op.pixiSprite.parent !== targetContainer) {
            targetContainer.addChild(op.pixiSprite);
        }

        const pClass = op.class || 'knight';
        let equipState = op.equipState || '';
        if (!equipState || !PlayerSpriteManager.textures[equipState]) {
            const wType = String(op.weaponType || '');
            const hasShield = Boolean(op.hasShield);
            if (pClass === 'ranger') {
                const hasBow = !wType || wType.includes('W_BW') || wType.includes('_BW');
                equipState = hasBow ? 'archer_bow' : 'archer_none';
            } else if (pClass === 'wizard') {
                equipState = 'mage';
            } else {
                const hasWeapon = Boolean(wType);
                if (hasWeapon && hasShield) equipState = 'sw_sh';
                else if (hasWeapon) equipState = 'sw';
                else if (hasShield) equipState = 'sh';
                else equipState = 'sw_sh';
            }
        }
        if (!PlayerSpriteManager.textures[equipState]) {
            equipState = pClass === 'ranger' ? 'archer_bow' : (pClass === 'wizard' ? 'mage' : 'sw_sh');
        }
        if (!PlayerSpriteManager.textures[equipState]) {
            equipState = 'none';
        }

        const isAttack = (now - (op.lastAttackTime || 0)) < 420;
        const isMovingNow = Boolean(op.isWalking || op.isMoving || (now - (op.lastMoveVisualTime || 0) < 160));
        const action = isAttack ? 'attack' : (isMovingNow ? 'walk' : 'idle');
        const dir = ['up', 'down', 'left', 'right'].includes(op.dir) ? op.dir : 'down';
        const animName = `${action === 'idle' ? 'walk' : action}_${dir}`;

        let textures = PlayerSpriteManager.textures[equipState]?.[animName];
        if (!textures || textures.length === 0) {
            textures = PlayerSpriteManager.textures[equipState]?.['walk_down'];
        }

        if (textures && textures.length > 0) {
            if (op.lastAnimKey !== `${equipState}:${action}:${dir}`) {
                op.lastAnimKey = `${equipState}:${action}:${dir}`;
                op.spriteFrame = 0;
                op.lastSpriteFrameTime = now;
            }
            if (action === 'idle') {
                op.spriteFrame = 0;
                op.pixiSprite.texture = textures[0];
            } else {
                const frameSpeed = isAttack ? Math.max(30, Math.floor(380 / textures.length)) : 92;
                if (!op.lastSpriteFrameTime) op.lastSpriteFrameTime = now;
                if (now - op.lastSpriteFrameTime > frameSpeed) {
                    op.spriteFrame = ((op.spriteFrame || 0) + 1) % textures.length;
                    op.lastSpriteFrameTime = now;
                }
                if ((op.spriteFrame || 0) >= textures.length) {
                    op.spriteFrame = 0;
                }
                op.pixiSprite.texture = textures[op.spriteFrame || 0];
            }
        }

        let offsetX = 0, offsetY = 0;
        const atkElapsed = now - (op.lastAttackTime || 0);
        if (atkElapsed >= 0 && atkElapsed < 210) {
            const lunge = Math.sin((atkElapsed / 210) * Math.PI) * (pClass === 'knight' ? 6.5 : 3.5);
            const dirVec = dir === 'left' ? [-1, 0] : (dir === 'right' ? [1, 0] : (dir === 'up' ? [0, -0.75] : [0, 0.75]));
            offsetX += dirVec[0] * lunge;
            offsetY += dirVec[1] * lunge;
        }
        const hitElapsed = now - (op.lastHitTime || 0);
        if (hitElapsed >= 0 && hitElapsed < 170) {
            const recoil = Math.sin((hitElapsed / 170) * Math.PI) * 5.5;
            const hAng = typeof op.lastHitAngle === 'number' ? op.lastHitAngle : 0;
            offsetX += Math.cos(hAng) * recoil;
            offsetY += Math.sin(hAng) * recoil * 0.65;
            op.pixiSprite.tint = hitElapsed < 90 ? 0xff9999 : (op.customTint || 0xffffff);
        } else {
            op.pixiSprite.tint = op.customTint || 0xffffff;
        }

        op.pixiSprite.visible = true;
        op.pixiSprite.alpha = op.gmInvisible ? 0.45 : (typeof op.customAlpha === 'number' ? op.customAlpha : 1.0);
        op.pixiSprite.anchor.set(0.5, 0.92);
        op.pixiSprite.x = x + offsetX;
        op.pixiSprite.y = y + offsetY;
        return;
    }
}

// ============================================================================
// 🐉 전 지역 52종 몬스터 이름 1:1 맞춤형 고해상도 2.5D 외형 렌더러 (하드웨어 가속 최적화)
// - PixiJS 네이티브 drawEllipse & 색상 캐싱과 결합하여 프레임 저하(0%) 없이 입체 음영·무기 광택·관절 모션·보스 오라 구현
// ============================================================================
export function drawMonster(ctx, x, y, m, tick) {
    ctx.save();
    ctx.translate(x, y);

    const n = m.rawName || m.name || "";
    const isBoss = Boolean(m.isBoss);
    const isElite = !isBoss && Boolean(m.isElite);
    const eliteScale = isElite ? (Number(m.scaleMult) || 1.90) : 1.0;
    const now = Date.now();

    // 🌟 몬스터 공격 모션 (공격 후 280ms 동안 전방 런지 찌르기 및 반동 - 2.5D 각도 반영)
    const isAttacking = (now - (m.lastAtkTime || 0) < 280);
    let atkLungeX = 0;
    let atkLungeY = 0;
    if (isAttacking) {
        const progress = (now - m.lastAtkTime) / 280;
        const lungeDist = isBoss ? 26 : (isElite ? 22 : 16);
        const lungeFactor = Math.sin(progress * Math.PI);
        const ang = m.atkAngle || 0;
        atkLungeX = Math.cos(ang) * lungeDist * lungeFactor;
        atkLungeY = Math.sin(ang) * lungeDist * lungeFactor * 0.65;
    }

    // 🌟 2.5D 이중 입체 그림자 렌더링 (외부 부드러운 그림자 + 발밑 코어 암영)
    const shadowRx = isBoss ? 28 : (isElite ? 25 : 14.5);
    const shadowRy = shadowRx * ISO_TILT;
    ctx.ellipse(0, 12, shadowRx * 1.12, shadowRy * 1.12, 'rgba(0,0,0,0.24)', null, 0);
    ctx.ellipse(0, 12, shadowRx * 0.82, shadowRy * 0.82, 'rgba(0,0,0,0.48)', null, 0);

    // 👑 보스 몬스터 바닥 이중 마법 문양 링 / ★거대 정예 황금 왕관 오라 링
    if (isBoss) {
        const pulse = Math.sin(tick * 0.08) * 2.5;
        const bossRx = 30 + pulse;
        const bossRy = bossRx * ISO_TILT;
        ctx.ellipse(0, 12, bossRx * 1.08, bossRy * 1.08, 'rgba(220, 38, 38, 0.14)', null, 0);
        ctx.ellipse(0, 12, bossRx, bossRy, null, '#dc2626', 2.0);
        ctx.ellipse(0, 12, bossRx * 0.76, bossRy * 0.76, null, '#facc15', 1.2);
        const bRot = tick * 0.035;
        for (let i = 0; i < 4; i++) {
            const a = bRot + (i * Math.PI) / 2;
            const px = Math.cos(a) * bossRx;
            const py = 12 + Math.sin(a) * bossRy;
            ctx.ellipse(px, py, 2.8, 1.8, '#fef08a', '#dc2626', 1);
        }
    } else if (isElite) {
        const pulse = Math.sin(tick * 0.10) * 2.0;
        const eliteRx = 27 + pulse;
        const eliteRy = eliteRx * ISO_TILT;
        ctx.ellipse(0, 12, eliteRx, eliteRy, 'rgba(250, 204, 21, 0.14)', '#facc15', 1.8);
        ctx.ellipse(0, 12, eliteRx * 0.78, eliteRy * 0.78, null, 'rgba(254, 240, 138, 0.7)', 1.1);
    }

    const phase = tick * 0.1 + x * 0.05 + y * 0.03;
    const bounce = Math.sin(phase) * (isBoss ? 1.5 : 2.4);
    const breathe = Math.cos(phase) * 0.032;
    const swing = Math.sin(tick * 0.15 + y * 0.04) * 3.2;

    // 💥 몬스터 피격 시 묵직한 넉백 리코일 + 타격 스쿼시 & 임팩트 링
    const hitElapsed = now - (m.lastHitTime || 0);
    let hitRecoilX = 0;
    let hitRecoilY = 0;
    let hitSquashX = 1.0 + breathe;
    let hitSquashY = 1.0 - breathe * 0.8;
    if (hitElapsed >= 0 && hitElapsed < 185) {
        const hitFactor = Math.sin((hitElapsed / 185) * Math.PI);
        const recoilDist = (m.lastHitCrit ? 11.5 : 7.5) * (isBoss ? 0.65 : (isElite ? 0.8 : 1.0));
        const hAng = typeof m.lastHitAngle === 'number' ? m.lastHitAngle : 0;
        hitRecoilX = Math.cos(hAng) * recoilDist * hitFactor;
        hitRecoilY = Math.sin(hAng) * recoilDist * hitFactor * 0.65;
        hitSquashX = 1.0 + 0.14 * hitFactor;
        hitSquashY = 1.0 - 0.11 * hitFactor;
    }

    ctx.translate(atkLungeX + hitRecoilX, bounce + atkLungeY + hitRecoilY);
    if (eliteScale !== 1.0 || hitSquashX !== 1.0 || hitSquashY !== 1.0) {
        ctx.scale(eliteScale * hitSquashX, eliteScale * hitSquashY);
    }

    if (hitElapsed >= 0 && hitElapsed < 150) {
        const impRx = (isBoss ? 30 : 19) * (0.7 + 0.5 * (hitElapsed / 150));
        ctx.ellipse(0, 8, impRx, impRx * ISO_TILT, 'rgba(255, 255, 255, 0.28)', m.lastHitCrit ? '#facc15' : '#f87171', m.lastHitCrit ? 2.8 : 2.0);
    }

    if (isAttacking) {
        const flashRx = isBoss ? 25 : 15;
        ctx.ellipse(0, 8, flashRx, flashRx * ISO_TILT, null, '#facc15', 2.0);
    }

    // 1. 슬라임 계열 (초원 슬라임 / 푸른 초원 슬라임 — 반투명 젤리 질감 + 내부 마력 코어 + 하이라이트)
    if (n.includes("슬라임")) {
        const isBlue = n.includes("푸른");
        const outerCol = isBlue ? '#0ea5e9' : '#16a34a';
        const bodyCol  = isBlue ? '#38bdf8' : '#22c55e';
        const strokeCol = isBlue ? '#0369a1' : '#14532d';
        const coreCol  = isBlue ? '#e0f2fe' : '#bbf7d0';
        const squish = Math.sin(tick * 0.12 + x) * 1.9;

        // 젤리 하단 그림자 베이스 & 외피
        ctx.ellipse(0, 7, 13.5 + squish * 0.6, 5.2, outerCol, null, 0);
        ctx.curveFill(-14.5 - squish, 10, -16.5, -14.5 + squish, 16.5, -14.5 + squish, 14.5 + squish, 10, bodyCol, strokeCol, 1.8);
        // 내부 부유 마력 코어 핵 (숨쉬듯 위아래 부유)
        const coreY = 1 + Math.sin(tick * 0.14) * 1.2;
        ctx.ellipse(0, coreY, 5.5, 4.2, isBlue ? '#0284c7' : '#15803d', null, 0);
        ctx.ellipse(0, coreY - 0.5, 3.2, 2.4, coreCol, null, 0);
        // 상단 좌측 젤리 광택 하이라이트
        ctx.ellipse(-5.2, -4.2 + squish * 0.3, 4.8, 2.5, coreCol, null, 0);
        ctx.ellipse(-7.5, -1.0 + squish * 0.3, 1.6, 1.2, '#ffffff', null, 0);
        // 입체적인 눈동자 & 듀얼 안광
        ctx.ellipse(-4.2, 1.2, 2.3, 3.0, '#0f172a', null, 0);
        ctx.ellipse(4.2, 1.2, 2.3, 3.0, '#0f172a', null, 0);
        ctx.ellipse(-4.8, 0.2, 1.0, 1.0, '#ffffff', null, 0);
        ctx.ellipse(3.6, 0.2, 1.0, 1.0, '#ffffff', null, 0);
        ctx.poly([[-1.8, 3.8], [0, 4.8], [1.8, 3.8]], null, '#0f172a', 1.1);
        if (isBlue) {
            ctx.poly([[-5, -10], [-2, -16], [0, -10]], '#bae6fd', '#0284c7', 1);
            ctx.poly([[5, -10], [2, -16], [0, -10]], '#bae6fd', '#0284c7', 1);
            ctx.poly([[0, -19], [-3.5, -9], [3.5, -9]], '#e0f2fe', '#0284c7', 1.2);
        }
    }
    // 2. 고블린 계열 (들판 고블린 / 궁수 / 전사 / 주술사 / 어둠 고블린 / 고블린 족장(B))
    else if (n.includes("고블린") || n.includes("친위대장")) {
        const isArcher = n.includes("궁수");
        const isShaman = n.includes("주술사");
        const isDark = n.includes("어둠");
        const isWarrior = n.includes("전사") || n.includes("친위대장");
        const sc = isBoss ? 1.78 : (isWarrior ? 1.15 : 0.98);
        ctx.scale(sc, sc);

        // 망토 (보스 / 정예전사 / 주술사)
        if (isBoss || isWarrior || isShaman) {
            const capeCol = isBoss ? '#991b1b' : (isDark ? '#3b0764' : '#78350f');
            const capeTrim = isBoss ? '#facc15' : '#111111';
            ctx.poly([[-11, -6], [11, -6], [16 + swing * 0.3, 13], [-16 + swing * 0.3, 13]], capeCol, capeTrim, 1.3);
        }
        // 교차 보행 다리 & 가죽 장화
        const legL = swing * 0.45;
        const legR = -swing * 0.45;
        ctx.poly([[-7, 5], [-2, 5], [-2 + legL, 13], [-8 + legL, 13]], '#3f2305', '#111111', 1.1);
        ctx.poly([[2, 5], [7, 5], [8 + legR, 13], [2 + legR, 13]], '#3f2305', '#111111', 1.1);
        // 갑옷 몸통 & X자 가죽 하네스 & 벨트 버클
        const armorCol = isBoss ? '#b45309' : (isDark ? '#4c1d95' : (isWarrior ? '#475569' : '#713f12'));
        const armorSub = isBoss ? '#fef08a' : (isWarrior ? '#94a3b8' : '#a16207');
        ctx.poly([[-9.5, -6], [9.5, -6], [10.5, 8], [-10.5, 8]], armorCol, '#111111', 1.4);
        ctx.poly([[-6, -5], [6, -5], [4, 4], [-4, 4]], armorSub, null, 0);
        ctx.poly([[-10, 4], [10, 4], [10, 7.5], [-10, 7.5]], '#27170a', '#111111', 1);
        ctx.poly([[-2.5, 3.8], [2.5, 3.8], [2.5, 7.8], [-2.5, 7.8]], '#facc15', '#78350f', 1);

        // 어깨 견갑
        if (isBoss || isWarrior) {
            ctx.ellipse(-10, -4, 4.5, 3.5, isBoss ? '#dc2626' : '#64748b', '#111111', 1.2);
            ctx.ellipse(10, -4, 4.5, 3.5, isBoss ? '#dc2626' : '#64748b', '#111111', 1.2);
        }

        // 뾰족한 고블린 귀 + 귀걸이 + 얼굴 입체 음영
        const skinCol = isDark ? '#4d7c0f' : '#65a30d';
        const skinDark = isDark ? '#365314' : '#3f6212';
        ctx.poly([[-8.5, -13], [-20, -18], [-11, -8.5]], skinCol, '#1a2e05', 1.2);
        ctx.poly([[8.5, -13], [20, -18], [11, -8.5]], skinCol, '#1a2e05', 1.2);
        ctx.ellipse(-15, -11.5, 1.5, 1.5, '#facc15', '#000', 0.6);
        ctx.ellipse(0, -13, 9.2, 8.6, skinCol, '#1a2e05', 1.4);
        ctx.ellipse(0, -10.5, 7.5, 4.8, skinDark, null, 0);

        // 매서운 눈썹 + 안광 + 송곳니
        ctx.ellipse(-3.6, -14, 2.2, 2.1, isBoss || isDark ? '#ef4444' : '#facc15', '#000', 0.9);
        ctx.ellipse(3.6, -14, 2.2, 2.1, isBoss || isDark ? '#ef4444' : '#facc15', '#000', 0.9);
        ctx.ellipse(-3.8, -14.4, 0.8, 0.8, '#ffffff', null, 0);
        ctx.ellipse(3.4, -14.4, 0.8, 0.8, '#ffffff', null, 0);
        ctx.poly([[-6.5, -16.8], [-1.2, -15.2], [-1.5, -14.2], [-6.5, -15.5]], '#1a2e05', null, 0);
        ctx.poly([[6.5, -16.8], [1.2, -15.2], [1.5, -14.2], [6.5, -15.5]], '#1a2e05', null, 0);
        ctx.poly([[-4.5, -8.5], [-2.5, -11.5], [-1, -8.5]], '#ffffff', '#111', 0.7);
        ctx.poly([[4.5, -8.5], [2.5, -11.5], [1, -8.5]], '#ffffff', '#111', 0.7);

        // 투구 / 왕관 / 두건
        if (isBoss) {
            ctx.poly([[-9.5, -19], [-10.5, -28], [-4.5, -22.5], [0, -30.5], [4.5, -22.5], [10.5, -28], [9.5, -19]], '#facc15', '#b45309', 1.4);
            ctx.ellipse(0, -22.5, 2.2, 2.2, '#ef4444', '#fef08a', 0.8);
        } else if (isShaman) {
            ctx.poly([[-9.5, -18], [9.5, -18], [6, -29], [-6, -29]], isDark ? '#581c87' : '#b91c1c', '#111', 1.2);
            ctx.poly([[-7, -23], [-13, -28], [-5, -26]], '#e2e8f0', '#111', 1);
            ctx.poly([[7, -23], [13, -28], [5, -26]], '#e2e8f0', '#111', 1);
            ctx.ellipse(0, -22.5, 3.8, 3.8, '#f8fafc', '#111', 1);
        } else if (isWarrior) {
            ctx.curveFill(-10.5, -16, -8.5, -26.5, 8.5, -26.5, 10.5, -16, '#64748b', '#1e293b', 1.3);
            ctx.poly([[-2, -25], [2, -25], [0, -31]], '#94a3b8', '#1e293b', 1.1);
        } else if (isArcher) {
            ctx.curveFill(-9.5, -16, -6.5, -24.5, 6.5, -24.5, 9.5, -16, '#166534', '#052e16', 1.2);
            ctx.poly([[-8, -14], [-11, -22], [-5, -18]], '#ef4444', '#7f1d1d', 0.9);
        }

        // 무기 디테일
        if (isArcher) {
            ctx.poly([[-9, -15], [-6, -15], [-4, -3], [-7, -3]], '#78350f', '#111', 1);
            ctx.curveFill(9, -16, 19, -7, 19, 6, 9, 12, null, '#b45309', 2.3);
            ctx.poly([[9, -15], [10, -15], [10, 11], [9, 11]], '#e2e8f0', null, 0);
            ctx.poly([[8, -2], [18, -2], [18, -0.5], [8, -0.5]], '#fef08a', null, 0);
            ctx.poly([[18, -4], [22, -1.2], [18, 1.5]], '#38bdf8', '#0284c7', 0.8);
        } else if (isShaman) {
            ctx.poly([[11, -23], [13.5, -23], [13.5, 12], [11, 12]], '#78350f', '#111', 1.1);
            const orbGlow = 5.2 + Math.sin(tick * 0.18) * 1.1;
            ctx.ellipse(12.2, -26, orbGlow, orbGlow, isDark ? '#a855f7' : '#f97316', '#fde047', 1.4);
            ctx.ellipse(12.2, -26, 2.4, 2.4, '#ffffff', null, 0);
        } else if (isBoss) {
            // 양날 대형 배틀액스 & 황금 문장 방패
            ctx.poly([[11, -26], [14, -26], [14, 13], [11, 13]], '#78350f', '#111', 1.2);
            ctx.poly([[13, -23], [27, -30], [28, -9], [13, -14]], '#e2e8f0', '#1e293b', 1.5);
            ctx.poly([[22, -27], [26.5, -29], [27.5, -10], [22, -12]], '#ffffff', null, 0);
            ctx.poly([[12, -23], [1, -27], [1, -11], [12, -14]], '#cbd5e1', '#1e293b', 1.4);
            ctx.poly([[-17, -10], [-8, -10], [-7, 6], [-12.5, 11], [-18, 6]], '#7f1d1d', '#facc15', 1.5);
            ctx.ellipse(-12.5, -1, 2.8, 2.8, '#facc15', '#451a03', 1);
        } else if (isWarrior) {
            ctx.poly([[-16, -9], [-8, -9], [-7.5, 5], [-12, 8.5], [-16.5, 5]], '#475569', '#1e293b', 1.3);
            ctx.ellipse(-12, -1.5, 2.2, 2.2, '#e2e8f0', '#1e293b', 0.9);
            ctx.poly([[10, -3], [20, -19], [23.5, -15.5], [12.5, 1]], '#e2e8f0', '#1e293b', 1.2);
            ctx.poly([[11, -3], [19.5, -17], [21, -15.5], [12, -1]], '#ffffff', null, 0);
        } else {
            ctx.poly([[9, -2], [18, -15], [21, -11.5], [11.5, 2]], '#cbd5e1', '#1e293b', 1.2);
            ctx.poly([[10, -2], [17.5, -13.5], [19, -12], [11, 0]], '#ffffff', null, 0);
        }
    }
    // 3. 늑대 & 야수 계열 (들판 늑대 / 서리 늑대 / 역병 감염야수)
    else if (n.includes("늑대") || n.includes("감염야수")) {
        const isIce = n.includes("서리");
        const isPlague = n.includes("역병") || n.includes("감염");
        const furCol = isIce ? '#7dd3fc' : (isPlague ? '#6b21a8' : '#57534e');
        const lightFur = isIce ? '#e0f2fe' : (isPlague ? '#c084fc' : '#a8a29e');
        const darkFur = isIce ? '#0369a1' : (isPlague ? '#3b0764' : '#292524');
        const eyeCol = isIce ? '#38bdf8' : (isPlague ? '#4ade80' : '#ef4444');
        ctx.scale(1.18, 1.18);

        // 풍성한 이중 꼬리 & 4족 보행 다리
        ctx.poly([[-13, -2], [-25, -11 + swing * 0.45], [-22, -2 + swing * 0.3], [-19, 3]], furCol, darkFur, 1.2);
        ctx.poly([[-16, -4], [-23, -9 + swing * 0.45], [-20, -1]], lightFur, null, 0);

        const s1 = swing * 0.55;
        ctx.poly([[-12, 3], [-8, 3], [-9 - s1, 12], [-13 - s1, 12]], darkFur, '#111', 1);
        ctx.poly([[-7, 4], [-3, 4], [-4 + s1, 12.5], [-8 + s1, 12.5]], furCol, darkFur, 1);
        ctx.poly([[3, 3], [7, 3], [8 - s1, 12], [4 - s1, 12]], darkFur, '#111', 1);
        ctx.poly([[7, 4], [11, 4], [12 + s1, 12.5], [8 + s1, 12.5]], furCol, darkFur, 1);

        // 근육질 몸통 & 가슴 갈기털
        ctx.ellipse(-2, 0, 14.5, 8.2, furCol, darkFur, 1.4);
        ctx.ellipse(-3, 2.5, 10, 4.2, lightFur, null, 0);
        ctx.poly([[-4, -8.5], [9, -10.5], [13, -3], [11, 3.5], [-2, 2.5]], furCol, darkFur, 1.3);
        ctx.poly([[4, -6], [11, -3], [9, 3], [2, 1]], lightFur, null, 0);

        // 등 결정/돌기
        if (isPlague) {
            ctx.poly([[-9, -7], [-6, -15], [-3, -7], [1, -16.5], [5, -7]], '#a855f7', '#111', 1.1);
            ctx.ellipse(-4, -2, 2.2, 1.8, '#4ade80', '#14532d', 0.8);
            ctx.ellipse(2, -1, 1.8, 1.5, '#4ade80', '#14532d', 0.8);
        } else if (isIce) {
            ctx.poly([[-9, -7], [-6, -15], [-3, -7], [1, -16], [5, -7]], '#e0f2fe', '#0284c7', 1.1);
        }

        // 귀 & 늑대 머리 & 송곳니 주둥이
        ctx.poly([[6, -10], [8.5, -19], [12, -10]], furCol, darkFur, 1.2);
        ctx.poly([[11, -10], [15.5, -19], [16.5, -9]], furCol, darkFur, 1.2);
        ctx.ellipse(12, -7, 7.2, 6.2, furCol, darkFur, 1.4);
        ctx.poly([[15, -9.5], [25, -6.5], [23, -1.5], [14, -2.5]], furCol, darkFur, 1.2);
        ctx.poly([[15, -2.5], [22.5, -1.5], [21, 1.5], [13, 0]], darkFur, '#111', 1);
        ctx.poly([[17, -2.5], [18.5, 0.5], [20, -2.5], [21.5, 0.2], [22.5, -2]], '#ffffff', null, 0);
        ctx.ellipse(14.2, -8.2, 2.0, 1.8, eyeCol, '#000', 0.8);
        ctx.ellipse(14.5, -8.5, 0.7, 0.7, '#ffffff', null, 0);
    }
    // 4. 독버섯 정령 (형광 포자 + 주름갓 음영 + 귀여운 스텝)
    else if (n.includes("버섯")) {
        ctx.scale(1.18, 1.18);
        const step = swing * 0.35;
        ctx.ellipse(-4.5 + step, 11, 3.8, 2.2, '#d97706', '#451a03', 1);
        ctx.ellipse(4.5 - step, 11, 3.8, 2.2, '#d97706', '#451a03', 1);
        ctx.poly([[-7.5, -2], [7.5, -2], [9.5, 10.5], [-9.5, 10.5]], '#fef3c7', '#78350f', 1.4);
        ctx.ellipse(0, -1, 16, 4.5, '#581c87', '#3b0764', 1.2);
        ctx.curveFill(-18.5, -1, -16.5, -25, 16.5, -25, 18.5, -1, '#9333ea', '#3b0764', 1.6);
        ctx.curveFill(-14, -4, -12, -21, 12, -21, 14, -4, '#a855f7', null, 0);
        ctx.ellipse(-7.5, -11.5, 3.8, 3.2, '#e2e8f0', '#6b21a8', 0.8);
        ctx.ellipse(6.5, -13.5, 4.2, 3.2, '#5eead4', '#0f766e', 0.8);
        ctx.ellipse(0, -6.5, 3.2, 2.4, '#f0abfc', '#701a75', 0.8);
        ctx.ellipse(-3.6, 3, 2.0, 2.5, '#111827', null, 0);
        ctx.ellipse(3.6, 3, 2.0, 2.5, '#111827', null, 0);
        ctx.ellipse(-4.0, 2.2, 0.8, 0.8, '#ffffff', null, 0);
        ctx.ellipse(3.2, 2.2, 0.8, 0.8, '#ffffff', null, 0);
        // 부유하는 독포자 방울
        const spY = Math.sin(tick * 0.12) * 3;
        ctx.ellipse(-14, -16 + spY, 2.0, 2.0, '#5eead4', null, 0);
        ctx.ellipse(15, -14 - spY, 1.8, 1.8, '#f0abfc', null, 0);
    }
    // 5. 픽시 / 하피 / 서큐버스 (4중 날개 / 깃털 날개 / 박쥐 날개 + 마력 구체)
    else if (n.includes("픽시") || n.includes("하피") || n.includes("서큐버스")) {
        const isPixie = n.includes("픽시");
        const isHarpy = n.includes("하피");
        const sc = isPixie ? 1.05 : 1.25;
        ctx.scale(sc, sc);
        const wingCol = isPixie ? '#d8b4fe' : (isHarpy ? '#38bdf8' : '#be123c');
        const wingSub = isPixie ? '#f3e8ff' : (isHarpy ? '#bae6fd' : '#f43f5e');
        const dressCol = isPixie ? '#6b21a8' : (isHarpy ? '#0369a1' : '#4c0519');
        const flap = Math.sin(tick * 0.26) * 5.5;

        // 상/하단 이중 날개
        ctx.poly([[-3, -7], [-23, -21 + flap], [-19, -3 + flap * 0.5]], wingCol, '#111', 1.2);
        ctx.poly([[3, -7], [23, -21 + flap], [19, -3 + flap * 0.5]], wingCol, '#111', 1.2);
        ctx.poly([[-4, -6], [-17, -14 + flap * 0.8], [-14, -4 + flap * 0.4]], wingSub, null, 0);
        ctx.poly([[4, -6], [17, -14 + flap * 0.8], [14, -4 + flap * 0.4]], wingSub, null, 0);
        ctx.poly([[-3, -3], [-16, 2 - flap * 0.4], [-11, 9]], wingCol, '#111', 1.0);
        ctx.poly([[3, -3], [16, 2 - flap * 0.4], [11, 9]], wingCol, '#111', 1.0);

        // 의상 및 장식
        ctx.poly([[-7.5, -6], [7.5, -6], [10.5, 10.5], [-10.5, 10.5]], dressCol, '#111', 1.3);
        ctx.poly([[-4, -5], [4, -5], [5, 9.5], [-5, 9.5]], wingSub, null, 0);
        ctx.ellipse(0, -14, 7.6, 7.6, '#fde68a', '#111', 1.2);
        ctx.curveFill(-8.5, -15, -8.5, -25.5, 8.5, -25.5, 8.5, -15, isPixie ? '#a855f7' : (isHarpy ? '#0ea5e9' : '#111827'), '#111', 1.1);
        if (!isPixie && !isHarpy) {
            ctx.poly([[-5, -20], [-12, -29], [-2, -22]], '#f43f5e', '#111', 1.1);
            ctx.poly([[5, -20], [12, -29], [2, -22]], '#f43f5e', '#111', 1.1);
        } else if (isPixie) {
            ctx.ellipse(0, -24, 5, 2, null, '#fef08a', 1.4);
        }
        ctx.ellipse(-2.6, -14, 1.6, 1.8, isPixie ? '#38bdf8' : '#ef4444', null, 0);
        ctx.ellipse(2.6, -14, 1.6, 1.8, isPixie ? '#38bdf8' : '#ef4444', null, 0);
    }
    // 6. 엔트 / 수호목 / 부패한 세계수(B)
    else if (n.includes("엔트") || n.includes("수호목") || n.includes("세계수")) {
        const sc = isBoss ? 2.18 : 1.40;
        ctx.scale(sc, sc);
        const barkCol = isBoss ? '#3b0764' : '#451a03';
        const barkSub = isBoss ? '#581c87' : '#78350f';
        const leafCol = isBoss ? '#7e22ce' : '#166534';
        const subLeaf = isBoss ? '#c084fc' : '#22c55e';

        // 뿌리 다리 & 나무 기둥 결
        ctx.poly([[-15, 12.5], [-9, 0], [9, 0], [15, 12.5]], barkCol, '#111', 1.4);
        ctx.poly([[-11.5, -16], [11.5, -16], [13.5, 10.5], [-13.5, 10.5]], barkCol, '#111', 1.6);
        ctx.poly([[-5, -15], [-2, -15], [-3, 9], [-6, 9]], barkSub, null, 0);
        ctx.poly([[3, -15], [6, -15], [5, 9], [2, 9]], barkSub, null, 0);
        // 나뭇가지 팔
        ctx.poly([[-11, -8], [-25, -19 + swing * 0.3], [-21, -11], [-11, -3]], barkCol, '#111', 1.2);
        ctx.poly([[11, -8], [25, -19 - swing * 0.3], [21, -11], [11, -3]], barkCol, '#111', 1.2);
        // 다층 수관(잎사귀)
        ctx.ellipse(-11, -20, 11.5, 9.2, leafCol, '#111', 1.3);
        ctx.ellipse(11, -20, 11.5, 9.2, leafCol, '#111', 1.3);
        ctx.ellipse(0, -25.5, 14.5, 11.5, subLeaf, '#111', 1.4);
        ctx.ellipse(-5, -27, 6, 4, isBoss ? '#e879f9' : '#86efac', null, 0);
        // 영혼 안광 & 나무 입
        ctx.ellipse(-4.2, -6.5, 2.6, 2.6, isBoss ? '#ef4444' : '#facc15', '#000', 1);
        ctx.ellipse(4.2, -6.5, 2.6, 2.6, isBoss ? '#ef4444' : '#facc15', '#000', 1);
        ctx.poly([[-5, -1], [0, -2.5], [5, -1], [3, 2], [-3, 2]], '#111827', null, 0);
        if (isBoss) {
            ctx.ellipse(0, 3.5, 4.8, 6.2, '#f43f5e', '#fde047', 1.5);
            ctx.ellipse(0, 3.5, 2.2, 3.2, '#ffffff', null, 0);
        }
    }
    // 7. 거미 / 전갈 / 병정벌레 / 말벌여왕
    else if (n.includes("거미") || n.includes("전갈") || n.includes("벌레") || n.includes("말벌")) {
        const isScorpion = n.includes("전갈");
        const isWasp = n.includes("말벌");
        const isIce = n.includes("얼음");
        const isQueen = n.includes("여왕");
        const sc = isBoss ? 1.92 : (isQueen ? 1.38 : 1.15);
        ctx.scale(sc, sc);

        if (isWasp) {
            const flap = Math.sin(tick * 0.38) * 6.5;
            ctx.ellipse(-13, -12 + flap * 0.4, 12, 5.2, 'rgba(186,230,253,0.78)', '#38bdf8', 1.1);
            ctx.ellipse(13, -12 + flap * 0.4, 12, 5.2, 'rgba(186,230,253,0.78)', '#38bdf8', 1.1);
            ctx.ellipse(0, 3.5, 9.5, 12.5, '#facc15', '#111', 1.5);
            ctx.poly([[-8.5, -0.5], [8.5, -0.5], [8.5, 2.8], [-8.5, 2.8]], '#111827', null, 0);
            ctx.poly([[-7.5, 5.5], [7.5, 5.5], [6.5, 8.8], [-6.5, 8.8]], '#111827', null, 0);
            ctx.poly([[-3.2, 14.5], [3.2, 14.5], [0, 23]], '#dc2626', '#111', 1.1);
            ctx.ellipse(0, -10, 7.2, 6.2, '#ca8a04', '#111', 1.2);
            ctx.ellipse(-2.8, -11, 2.0, 2.2, '#ef4444', '#000', 0.8);
            ctx.ellipse(2.8, -11, 2.0, 2.2, '#ef4444', '#000', 0.8);
            ctx.poly([[-5.5, -15], [-3.5, -22], [0, -17.5], [3.5, -22], [5.5, -15]], '#fde047', '#b45309', 1.1);
        } else if (isScorpion) {
            for (let i = 0; i < 3; i++) {
                const oy = -1 + i * 3.5;
                const lOff = (i % 2 === 0 ? 1 : -1) * swing * 0.35;
                ctx.poly([[-9, oy], [-19, oy - 3 + lOff], [-22, oy + 3 + lOff]], null, '#451a03', 2.0);
                ctx.poly([[9, oy], [19, oy - 3 - lOff], [22, oy + 3 - lOff]], null, '#451a03', 2.0);
            }
            ctx.ellipse(0, 2, 13.5, 9.2, '#b45309', '#451a03', 1.5);
            ctx.ellipse(0, 1.5, 9.5, 5.5, '#d97706', null, 0);
            ctx.ellipse(-14.5, -5.5, 6.5, 4.2, '#d97706', '#451a03', 1.3);
            ctx.ellipse(14.5, -5.5, 6.5, 4.2, '#d97706', '#451a03', 1.3);
            ctx.curveFill(0, -4, 4, -23, 15, -25, 8.5, -14, '#92400e', '#451a03', 1.6);
            ctx.ellipse(9.5, -15.5, 3.8, 3.8, '#ef4444', '#111', 1.1);
            ctx.ellipse(9.5, -16.2, 1.4, 1.4, '#fef08a', null, 0);
        } else {
            const bodyCol = isIce ? '#0284c7' : (isQueen ? '#581c87' : (n.includes("벌레") ? '#78350f' : '#1e293b'));
            const subCol  = isIce ? '#7dd3fc' : (isQueen ? '#c084fc' : (n.includes("벌레") ? '#b45309' : '#475569'));
            const headCol = isIce ? '#bae6fd' : (isQueen ? '#a855f7' : '#334155');
            for (let i = 0; i < 4; i++) {
                const oy = -4 + i * 3.5;
                const lMov = ((i % 2 === 0) ? 1 : -1) * swing * 0.4;
                ctx.poly([[-8, oy], [-20, oy - 5 + lMov], [-25, oy + 2.5 + lMov]], null, isIce ? '#38bdf8' : '#0f172a', 2.1);
                ctx.poly([[8, oy], [20, oy - 5 - lMov], [25, oy + 2.5 - lMov]], null, isIce ? '#38bdf8' : '#0f172a', 2.1);
            }
            ctx.ellipse(0, 4.5, 13.5, 14.2, bodyCol, '#111', 1.5);
            ctx.poly([[0, -2], [5, 4], [0, 11], [-5, 4]], subCol, null, 0);
            ctx.ellipse(0, -7, 8.8, 7.6, headCol, '#111', 1.4);
            ctx.poly([[-4, -12], [-6, -17], [-2, -13]], '#e2e8f0', '#111', 0.9);
            ctx.poly([[4, -12], [6, -17], [2, -13]], '#e2e8f0', '#111', 0.9);
            ctx.ellipse(-3.2, -9, 2.1, 2.1, '#ef4444', '#000', 0.7);
            ctx.ellipse(3.2, -9, 2.1, 2.1, '#ef4444', '#000', 0.7);
            if (isQueen) {
                ctx.poly([[-5.5, -14], [-3.5, -21], [0, -16.5], [3.5, -21], [5.5, -14]], '#facc15', '#b45309', 1.1);
            }
        }
    }
    // 8. 오크 / 트롤 / 서리 거인(B)
    else if (n.includes("오크") || n.includes("트롤") || n.includes("거인")) {
        const isFrostGiant = n.includes("서리 거인");
        const isFireTroll = n.includes("불의 트롤");
        const sc = isBoss ? 2.08 : (isFireTroll ? 1.48 : 1.20);
        ctx.scale(sc, sc);

        const skinCol = isFrostGiant ? '#60a5fa' : (isFireTroll ? '#dc2626' : (n.includes("붉은") ? '#991b1b' : '#3f6212'));
        const armorCol = isFrostGiant ? '#1e3a8a' : (isFireTroll ? '#450a0a' : '#334155');

        // 다리 & 갑옷 몸통 & 해골 벨트
        ctx.poly([[-8, 6], [-2, 6], [-2 + swing * 0.35, 13.5], [-9 + swing * 0.35, 13.5]], '#1e293b', '#111', 1.1);
        ctx.poly([[2, 6], [8, 6], [9 - swing * 0.35, 13.5], [2 - swing * 0.35, 13.5]], '#1e293b', '#111', 1.1);
        ctx.poly([[-12.5, -6], [12.5, -6], [14.5, 12], [-14.5, 12]], armorCol, '#111', 1.5);
        ctx.poly([[-8, -5], [8, -5], [6, 5], [-6, 5]], skinCol, null, 0);
        ctx.ellipse(-13, -4.5, 5.5, 4.5, '#64748b', '#111', 1.2);
        ctx.ellipse(13, -4.5, 5.5, 4.5, '#64748b', '#111', 1.2);
        ctx.ellipse(0, 7, 3.5, 3.0, '#facc15', '#451a03', 1.1);

        // 머리 & 뿔/엄니
        ctx.ellipse(0, -14, 10.5, 9.8, skinCol, '#111', 1.5);
        if (isFrostGiant) {
            ctx.poly([[-8.5, -11], [8.5, -11], [5.5, 3], [0, 7], [-5.5, 3]], '#e0f2fe', '#94a3b8', 1.2);
            ctx.poly([[-10, -20], [-17, -30], [-6, -21]], '#e0f2fe', '#1e293b', 1.3);
            ctx.poly([[10, -20], [17, -30], [6, -21]], '#e0f2fe', '#1e293b', 1.3);
        } else {
            ctx.poly([[-5.5, -8.5], [-3.5, -14.5], [-1, -8.5]], '#ffffff', '#111', 1);
            ctx.poly([[5.5, -8.5], [3.5, -14.5], [1, -8.5]], '#ffffff', '#111', 1);
        }
        ctx.ellipse(-3.6, -15, 2.2, 2.1, isFrostGiant ? '#e0f2fe' : '#facc15', '#000', 0.8);
        ctx.ellipse(3.6, -15, 2.2, 2.1, isFrostGiant ? '#e0f2fe' : '#facc15', '#000', 0.8);
        // 대형 전투도끼 / 해머
        ctx.poly([[12.5, -19], [15.5, -19], [15.5, 11], [12.5, 11]], '#78350f', '#111', 1.2);
        ctx.poly([[7, -25], [23, -25], [23, -13.5], [7, -13.5]], isFrostGiant ? '#7dd3fc' : '#94a3b8', '#111', 1.4);
        ctx.poly([[18, -24], [22, -24], [22, -14.5], [18, -14.5]], '#ffffff', null, 0);
    }
    // 9. 골렘 / 가고일 / 타이탄(B)
    else if (n.includes("골렘") || n.includes("가고일") || n.includes("타이탄") || n.includes("파수꾼")) {
        const isLava = n.includes("화산") || n.includes("용암");
        const isMecha = n.includes("마공학") || n.includes("타이탄") || n.includes("파수꾼");
        const isTemple = n.includes("신전");
        const sc = isBoss ? 2.18 : 1.40;
        ctx.scale(sc, sc);

        const bodyCol = isLava ? '#292524' : (isMecha ? '#d97706' : (isTemple ? '#cbd5e1' : '#64748b'));
        const highlightCol = isLava ? '#57534e' : (isMecha ? '#fbbf24' : (isTemple ? '#f8fafc' : '#94a3b8'));
        const coreCol = isLava ? '#f97316' : (isMecha ? '#38bdf8' : '#facc15');

        if (n.includes("가고일")) {
            ctx.poly([[-8, -8], [-25, -19 + swing * 0.4], [-19, 2]], '#334155', '#111', 1.3);
            ctx.poly([[8, -8], [25, -19 + swing * 0.4], [19, 2]], '#334155', '#111', 1.3);
        }
        // 육중한 장갑판 몸통 & 마력 코어 라인
        ctx.poly([[-14.5, -10.5], [14.5, -10.5], [11.5, 12.5], [-11.5, 12.5]], bodyCol, '#111827', 1.6);
        ctx.poly([[-11, -9], [11, -9], [8, 2], [-8, 2]], highlightCol, null, 0);
        ctx.poly([[-20.5, -10], [-12, -12.5], [-12, 4.5], [-19.5, 4.5]], bodyCol, '#111827', 1.4);
        ctx.poly([[12, -12.5], [20.5, -10], [19.5, 4.5], [12, 4.5]], bodyCol, '#111827', 1.4);
        ctx.poly([[-8.5, -22.5], [8.5, -22.5], [9.5, -10], [-9.5, -10]], bodyCol, '#111827', 1.5);
        // 흉부 에너지 코어 & 바이저 안광
        ctx.ellipse(0, -1, 5.5, 5.5, coreCol, '#ffffff', 1.4);
        ctx.ellipse(0, -1, 2.5, 2.5, '#ffffff', null, 0);
        ctx.ellipse(-3.2, -16, 2.2, 1.9, coreCol, null, 0);
        ctx.ellipse(3.2, -16, 2.2, 1.9, coreCol, null, 0);
        if (isBoss) {
            ctx.ellipse(0, -14, 23, 6.5, null, coreCol, 2.0);
        }
    }
    // 10. 정령 / 세이렌 / 폭풍의 눈(B) / 이프리트(B)
    else if (n.includes("정령") || n.includes("세이렌") || n.includes("폭풍") || n.includes("이프리트")) {
        const isFire = n.includes("이프리트") || n.includes("화염");
        const isStorm = n.includes("폭풍");
        const isIce = n.includes("빙결") || n.includes("눈보라");
        const sc = isBoss ? 2.04 : 1.28;
        ctx.scale(sc, sc);

        const cMain = isFire ? '#ef4444' : (isStorm ? '#0284c7' : (isIce ? '#38bdf8' : '#0ea5e9'));
        const cSub  = isFire ? '#facc15' : (isStorm ? '#fde047' : '#e0f2fe');

        // 소용돌이 하체 & 다층 원소 코어
        ctx.curveFill(-12.5, -4, -16.5, 8.5, 16.5, 8.5, 0, 14.5, cMain, '#111', 1.3);
        ctx.ellipse(0, -6, 11.5, 10.5, cMain, cSub, 1.6);
        ctx.ellipse(0, -6, 7.2, 6.5, cSub, null, 0);
        ctx.ellipse(0, -16, 8.2, 8.2, cSub, cMain, 1.4);
        ctx.ellipse(-3, -16, 1.9, 2.2, '#111827', null, 0);
        ctx.ellipse(3, -16, 1.9, 2.2, '#111827', null, 0);
        for (let i = 0; i < 4; i++) {
            const a = tick * 0.09 + (Math.PI / 2) * i;
            ctx.ellipse(Math.cos(a) * 16.5, -8 + Math.sin(a) * 6.5, 3.6, 3.6, cSub, cMain, 1.1);
        }
        if (isBoss) {
            ctx.poly([[-8.5, -22], [-5.5, -31], [0, -24.5], [5.5, -31], [8.5, -22]], '#facc15', '#b45309', 1.4);
        }
    }
    // 11. 사막 파라오 / 수호병 / 해골 / 리치 킹(B) / 망령군주
    else if (n.includes("파라오") || n.includes("수호병") || n.includes("해골") || n.includes("리치") || n.includes("망령")) {
        const isPharaoh = n.includes("람세스") || n.includes("파라오");
        const isLich = n.includes("리치") || n.includes("망령군주");
        const isPirateGhost = n.includes("선원") || n.includes("갑판장");
        const sc = isBoss ? 2.04 : 1.20;
        ctx.scale(sc, sc);

        if (isPharaoh) {
            ctx.poly([[-13.5, -18], [13.5, -18], [16.5, -1.5], [-16.5, -1.5]], '#1d4ed8', '#facc15', 1.8);
            ctx.poly([[-10.5, -5], [10.5, -5], [12.5, 12.5], [-12.5, 12.5]], '#facc15', '#78350f', 1.5);
            ctx.ellipse(0, -13, 8.2, 8.2, '#fef3c7', '#78350f', 1.3);
            ctx.ellipse(0, -21, 2.5, 3.2, '#ef4444', '#facc15', 1.0);
            ctx.ellipse(-3, -14, 2.1, 2.1, '#38bdf8', null, 0);
            ctx.ellipse(3, -14, 2.1, 2.1, '#38bdf8', null, 0);
            ctx.poly([[12, -25], [14.2, -25], [14.2, 12.5], [12, 12.5]], '#facc15', '#78350f', 1.3);
            ctx.ellipse(13.1, -27, 4.8, 4.8, '#ef4444', '#fde047', 1.3);
        } else if (isLich || n.includes("망령")) {
            ctx.curveFill(-13.5, 12.5, -16.5, -18, 16.5, -18, 13.5, 12.5, '#1e1b4b', '#a855f7', 1.5);
            ctx.poly([[-6, -5], [6, -5], [8, 11], [-8, 11]], '#312e81', null, 0);
            ctx.ellipse(0, -13, 8.2, 8.2, '#e2e8f0', '#111', 1.3);
            ctx.ellipse(-3, -14, 2.1, 2.1, '#2dd4bf', null, 0);
            ctx.ellipse(3, -14, 2.1, 2.1, '#2dd4bf', null, 0);
            if (isBoss || isLich) {
                ctx.poly([[-8.5, -20], [-8.5, -29], [-3, -22.5], [0, -31], [3, -22.5], [8.5, -29], [8.5, -20]], '#38bdf8', '#1e3a8a', 1.3);
            }
            ctx.poly([[11, -23], [13.2, -23], [13.2, 12], [11, 12]], '#64748b', '#111', 1.2);
            ctx.ellipse(12.1, -26, 5.2, 5.2, '#2dd4bf', '#ffffff', 1.3);
        } else {
            // 해골 병사: 갈비뼈 디테일 + 방패 + 시미터 도검
            ctx.poly([[-8.5, -5], [8.5, -5], [9.5, 10], [-9.5, 10]], isPirateGhost ? '#7f1d1d' : '#cbd5e1', '#334155', 1.4);
            ctx.poly([[-5, -2], [5, -2], [5, 0], [-5, 0]], '#475569', null, 0);
            ctx.poly([[-4.5, 2], [4.5, 2], [4.5, 4], [-4.5, 4]], '#475569', null, 0);
            ctx.ellipse(0, -13, 8.2, 8.2, '#f8fafc', '#475569', 1.4);
            ctx.ellipse(-3, -14, 2.1, 2.1, '#ef4444', null, 0);
            ctx.ellipse(3, -14, 2.1, 2.1, '#ef4444', null, 0);
            ctx.ellipse(-11, -1, 4.5, 6.0, '#64748b', '#1e293b', 1.2);
            ctx.poly([[10, -2], [21, -17], [23.5, -13.5], [12.5, 2]], '#e2e8f0', '#1e293b', 1.2);
        }
    }
    // 12. 독사 / 리자드맨 / 악어 / 역병의 히드라(B)
    else if (n.includes("독사") || n.includes("리자드맨") || n.includes("악어") || n.includes("히드라")) {
        if (n.includes("히드라")) {
            ctx.scale(2.08, 2.08);
            ctx.ellipse(0, 6.5, 16.5, 10.5, '#065f46', '#022c22', 1.6);
            ctx.ellipse(0, 7.5, 11, 6, '#34d399', null, 0);
            [[-12.5, -16.5, -1], [0, -21.5, 0], [12.5, -16.5, 1]].forEach(([hx, hy, dirIdx]) => {
                const sway = Math.sin(tick * 0.12 + dirIdx) * 2.0;
                ctx.poly([[-3.2, 2], [3.2, 2], [hx + sway + 3.2, hy], [hx + sway - 3.2, hy]], '#047857', '#022c22', 1.3);
                ctx.ellipse(hx + sway, hy, 6.8, 5.2, '#10b981', '#022c22', 1.3);
                ctx.ellipse(hx + sway - 2.2, hy - 1, 1.6, 1.6, '#ef4444', null, 0);
                ctx.ellipse(hx + sway + 2.2, hy - 1, 1.6, 1.6, '#ef4444', null, 0);
            });
        } else if (n.includes("악어")) {
            ctx.scale(1.32, 1.32);
            ctx.poly([[-18.5, 2], [14, 0], [22.5, 6], [-18.5, 9.5]], '#14532d', '#052e16', 1.4);
            ctx.poly([[-12, 0], [-9, -4], [-6, 0], [-3, -4], [0, 0], [3, -4], [6, 0]], '#16a34a', '#052e16', 1);
            ctx.poly([[10, 0], [25.5, 2], [24.5, 7.5], [10, 6.5]], '#166534', '#052e16', 1.2);
            ctx.ellipse(13, 0, 2.1, 2.1, '#facc15', '#000', 0.8);
        } else if (n.includes("리자드맨")) {
            ctx.scale(1.20, 1.20);
            ctx.poly([[-8, 4], [-21, 10.5], [-16.5, 12.5], [-6, 8]], '#15803d', '#052e16', 1.2);
            ctx.poly([[-9.5, -5], [9.5, -5], [10.5, 10.5], [-10.5, 10.5]], '#16a34a', '#052e16', 1.4);
            ctx.ellipse(-11, 1, 4.5, 6.0, '#eab308', '#713f12', 1.2);
            ctx.ellipse(0, -13, 8.8, 7.2, '#22c55e', '#052e16', 1.4);
            ctx.poly([[10, -21], [12.2, -21], [12.2, 12], [10, 12]], '#eab308', '#713f12', 1.2);
            ctx.poly([[8, -21], [11.1, -27], [14.2, -21]], '#fef08a', '#713f12', 1);
        } else {
            ctx.scale(1.15, 1.15);
            ctx.ellipse(0, 6.5, 12.5, 5.2, '#15803d', '#052e16', 1.3);
            ctx.ellipse(0, -5.5, 10.5, 8.2, '#4ade80', '#14532d', 1.3);
            ctx.ellipse(0, -9, 6.2, 5.2, '#166534', '#052e16', 1.3);
            ctx.ellipse(-2.5, -10, 1.6, 1.6, '#ef4444', null, 0);
            ctx.ellipse(2.5, -10, 1.6, 1.6, '#ef4444', null, 0);
        }
    }
    // 13. 해적 / 약탈자 / 암살자 / 대사제 / 선장 바르보(B) / 배교자 카엘런(B) / 공허의 기사
    else if (n.includes("해적") || n.includes("약탈자") || n.includes("바르보") || n.includes("암살자") || n.includes("대사제") || n.includes("카엘런") || n.includes("기사") || n.includes("근위대")) {
        const isBarbo = n.includes("바르보");
        const isKaelen = n.includes("카엘런");
        const isVoid = n.includes("공허") || isKaelen;
        const sc = isBoss ? 2.05 : 1.20;
        ctx.scale(sc, sc);

        if (isKaelen) {
            ctx.ellipse(0, -16, 20.5, 20.5, '#090514', '#c084fc', 2.2);
            for (let i = 0; i < 6; i++) {
                const a = tick * 0.06 + (Math.PI / 3) * i;
                ctx.ellipse(Math.cos(a) * 24.5, -16 + Math.sin(a) * 14.5, 3.6, 3.6, '#e879f9', '#ffffff', 1.2);
            }
        }
        const coatCol = isVoid ? '#1e1b4b' : (isBarbo || n.includes("해적") ? '#7f1d1d' : '#1f2937');
        ctx.poly([[-11.5, -5], [11.5, -5], [14.5, 12.5], [-14.5, 12.5]], coatCol, '#facc15', 1.5);
        ctx.poly([[-4.5, -4.5], [4.5, -4.5], [3.5, 11], [-3.5, 11]], isVoid ? '#7e22ce' : '#b91c1c', null, 0);
        ctx.ellipse(0, -13, 8.6, 8.6, '#fde68a', '#111', 1.3);
        if (isBarbo || n.includes("해적")) {
            ctx.poly([[-14.5, -16], [0, -26.5], [14.5, -16], [9.5, -13], [-9.5, -13]], '#111827', '#facc15', 1.4);
            ctx.ellipse(0, -18.5, 2.2, 2.2, '#f8fafc', null, 0);
        } else {
            ctx.curveFill(-10.5, -14, -10.5, -26.5, 10.5, -26.5, 10.5, -14, isVoid ? '#4c1d95' : '#334155', '#facc15', 1.3);
        }
        ctx.ellipse(-3, -14, 1.9, 1.9, isVoid ? '#e879f9' : '#ef4444', null, 0);
        ctx.ellipse(3, -14, 1.9, 1.9, isVoid ? '#e879f9' : '#ef4444', null, 0);
        ctx.poly([[11, -4], [22.5, -18.5], [25.5, -14.5], [13.5, 2]], isVoid ? '#c084fc' : '#e2e8f0', '#111', 1.3);
    }
    // 14. 드레이크 / 화염드래곤 / 고룡 / 에이션트 레드(B) / 발록(B) / 임프
    else {
        const isBalrog = n.includes("발록");
        const isImp = n.includes("임프");
        const sc = isBoss ? 2.28 : (isImp ? 0.98 : 1.58);
        ctx.scale(sc, sc);
        const mainCol = isBalrog ? '#450a0a' : '#dc2626';
        const wingCol = isBalrog ? '#f97316' : '#991b1b';
        const flap = Math.sin(tick * 0.18) * 5.5;

        // 드래곤 꼬리 & 이중 막 날개
        ctx.poly([[-8, 6], [-22, 11 + swing * 0.4], [-18, 4]], mainCol, '#111', 1.2);
        ctx.poly([[-8, -6], [-29, -22.5 + flap], [-22.5, 4]], wingCol, '#111', 1.5);
        ctx.poly([[8, -6], [29, -22.5 + flap], [22.5, 4]], wingCol, '#111', 1.5);
        ctx.poly([[-8, -5], [-21, -15 + flap * 0.8], [-17, 1]], isBalrog ? '#fde047' : '#ef4444', null, 0);
        ctx.poly([[8, -5], [21, -15 + flap * 0.8], [17, 1]], isBalrog ? '#fde047' : '#ef4444', null, 0);
        // 몸통 & 황금 비늘 배
        ctx.poly([[-11.5, -6], [11.5, -6], [13.5, 12.5], [-13.5, 12.5]], mainCol, '#111', 1.5);
        ctx.poly([[-5.5, -4], [5.5, -4], [6.5, 11.5], [-6.5, 11.5]], '#facc15', '#b45309', 1.1);
        // 드래곤 뿔 & 머리 & 안광
        ctx.poly([[-6, -18], [-14.5, -28.5], [-2, -20]], '#fde047', '#111', 1.2);
        ctx.poly([[6, -18], [14.5, -28.5], [2, -20]], '#fde047', '#111', 1.2);
        ctx.ellipse(0, -14, 9.8, 8.8, mainCol, '#111', 1.5);
        ctx.ellipse(-3.5, -15, 2.2, 2.2, '#fef08a', '#000', 0.7);
        ctx.ellipse(3.5, -15, 2.2, 2.2, '#fef047', '#000', 0.7);
        if (isBalrog || isBoss) {
            ctx.poly([[12, -2], [27, -23], [30, -18.5], [14.5, 3]], '#f97316', '#fde047', 1.5);
        }
    }

    // 💫 스턴(기절) 및 방어력 감소(디버프) 상태이상 시각 피드백
    if (m.stunUntil && m.stunUntil > now) {
        const sRot = tick * 0.16;
        for (let i = 0; i < 3; i++) {
            const sa = sRot + (i * Math.PI * 2) / 3;
            ctx.ellipse(Math.cos(sa) * 11, -28 + Math.sin(sa) * 3.5, 2.4, 2.4, '#fef08a', '#ca8a04', 0.9);
        }
    }
    if (m.defDownUntil && m.defDownUntil > now) {
        ctx.poly([[13, -18], [17, -18], [15, -13]], '#c084fc', '#3b0764', 0.9);
    }

    ctx.restore();
}

// ============================================================================
// 🏹 2.5D 시점 및 물리 비행 각도(atan2)가 반영된 투사체 렌더러 (하늘 낙하형 마법 화면 밖 출발 지원)
// ============================================================================
export function drawProjectile(mainG, p, dx, dy, dist) {
    const sName = String(p.skillName || "");
    const ang = Math.atan2(dy, dx);
    const cos = Math.cos(ang);
    const sin = Math.sin(ang);
    const nx = -sin;
    const ny = cos;

    // 1. ☄️ 하늘에서 내려오는 마법/스킬 (화면 밖 상단에서 시작하여 타겟에 깔끔하게 직격 충돌)
    if (p.isSkyDrop) {
        const tx = p.target ? p.target.x : p.x;
        const ty = p.target ? p.target.y : (p.y + 40);
        // 타겟 바닥에 2.5D 낙하 예고 타원 링 표시 (충돌 직전 수축)
        const totalDist = Math.max(120, p.skyTotalDist || 480);
        const remainRatio = Math.max(0, Math.min(1, dist / totalDist));
        const lockR = 16 + remainRatio * 26;
        mainG.lineStyle(1.8, 0xfef08a, 0.45 + (1 - remainRatio) * 0.45)
            .drawEllipse(tx, ty + 2, lockR, lockR * ISO_TILT);
        mainG.lineStyle(0);

        if (sName.includes("라이트닝") || sName.includes("썬더")) {
            // 콜 라이트닝 / 썬더 볼트 / 체인 라이트닝 / 라이트닝 스톰: 화면 밖 상단에서 내려꽂히는 뇌전 줄기
            const isBlue = sName.includes("체인") || sName.includes("썬더");
            const glowCol = isBlue ? 0x38bdf8 : 0xfacc15;
            const coreCol = 0xffffff;
            mainG.lineStyle(8, glowCol, 0.28)
                .moveTo(p.x - cos * 85, p.y - sin * 85)
                .lineTo(p.x - cos * 55 + nx * 9, p.y - sin * 55 + ny * 9)
                .lineTo(p.x - cos * 25 - nx * 8, p.y - sin * 25 - ny * 8)
                .lineTo(p.x, p.y);
            mainG.lineStyle(3.2, coreCol, 0.95)
                .moveTo(p.x - cos * 85, p.y - sin * 85)
                .lineTo(p.x - cos * 55 + nx * 9, p.y - sin * 55 + ny * 9)
                .lineTo(p.x - cos * 25 - nx * 8, p.y - sin * 25 - ny * 8)
                .lineTo(p.x, p.y);
            drawSoftGlowParticle(mainG, p.x, p.y, 9.5, glowCol, 0.95, coreCol);
        } else if (sName.includes("메테오") || sName.includes("미티어")) {
            // 메테오(소) / 미티어 스웜: 화면 밖 상단에서 화염 꼬리를 끌며 낙하하는 운석
            const rockR = sName.includes("미티어") ? 13 : 10;
            mainG.lineStyle(rockR * 1.4, 0xf97316, 0.35)
                .moveTo(p.x, p.y)
                .lineTo(p.x - cos * 70, p.y - sin * 70);
            mainG.lineStyle(rockR * 0.8, 0xfef08a, 0.75)
                .moveTo(p.x, p.y)
                .lineTo(p.x - cos * 38, p.y - sin * 38);
            mainG.lineStyle(0);
            mainG.beginFill(0xdc2626, 0.95).drawCircle(p.x, p.y, rockR).endFill();
            mainG.beginFill(0xfef08a, 0.9).drawCircle(p.x + cos * 2, p.y + sin * 2, rockR * 0.55).endFill();
        } else if (sName.includes("아이스") || sName.includes("블리자드") || sName.includes("제로")) {
            // 아이스 스톰 / 블리자드 / 앱솔루트 제로: 화면 밖 상단에서 떨어지는 거대 빙결 결정
            const iceLen = sName.includes("제로") ? 24 : 16;
            mainG.lineStyle(5, 0x38bdf8, 0.35).moveTo(p.x, p.y).lineTo(p.x - cos * 52, p.y - sin * 52);
            mainG.lineStyle(1.6, 0xffffff, 0.95);
            mainG.beginFill(0x7dd3fc, 0.9);
            mainG.moveTo(p.x + cos * iceLen, p.y + sin * iceLen);
            mainG.lineTo(p.x - cos * 4 + nx * (iceLen * 0.45), p.y - sin * 4 + ny * (iceLen * 0.45));
            mainG.lineTo(p.x - cos * iceLen, p.y - sin * iceLen);
            mainG.lineTo(p.x - cos * 4 - nx * (iceLen * 0.45), p.y - sin * 4 - ny * (iceLen * 0.45));
            mainG.closePath();
            mainG.endFill();
        } else if (sName.includes("애로우 레인")) {
            // 애로우 레인: 화면 밖 상단에서 타겟으로 쏟아지는 빛의 화살 다발
            const offsets = [-12, 0, 12];
            offsets.forEach((off, idx) => {
                const ax = p.x + nx * off - cos * (idx % 2) * 10;
                const ay = p.y + ny * off - sin * (idx % 2) * 10;
                mainG.lineStyle(2.2, 0xfef08a, 0.92).moveTo(ax, ay).lineTo(ax - cos * 24, ay - sin * 24);
                drawSoftGlowParticle(mainG, ax, ay, 4.0, 0x2dd4bf, 0.9, 0xffffff);
            });
        } else {
            // 둠 / 워드 오브 데스 / 카오스 필드: 화면 밖 상단에서 내려오는 심판의 암흑 칼날·구체
            mainG.lineStyle(6, 0x9333ea, 0.35).moveTo(p.x, p.y).lineTo(p.x - cos * 60, p.y - sin * 60);
            mainG.lineStyle(2.6, 0xf43f5e, 0.95).moveTo(p.x + cos * 10, p.y + sin * 10).lineTo(p.x - cos * 32, p.y - sin * 32);
            drawSoftGlowParticle(mainG, p.x, p.y, 9.0, 0xc084fc, 0.95, 0xffffff);
        }
        mainG.lineStyle(0);
        return;
    }

    // 2.5D 지면 투사체 그림자 (비행 고도 입체감 표현)
    mainG.lineStyle(0);
    mainG.beginFill(0x000000, 0.28).drawEllipse(p.x, p.y + 15, 7.5, 7.5 * ISO_TILT).endFill();

    if (p.type === 'arrow') {
        let shaftCol = 0xfef3c7;
        let headCol = 0xffffff;
        let glowCol = 0x38bdf8;
        if (sName.includes("파이어")) { headCol = 0xfef08a; glowCol = 0xf97316; }
        else if (sName.includes("아이스")) { headCol = 0xe0f2fe; glowCol = 0x38bdf8; }
        else if (sName.includes("피어스") || sName.includes("사일런스")) { headCol = 0xf3e8ff; glowCol = 0xa855f7; }
        else if (sName.includes("스나이퍼")) { headCol = 0xfef08a; glowCol = 0xef4444; }
        else if (sName.includes("게일") || sName.includes("레인") || sName.includes("멀티") || sName.includes("더블")) { headCol = 0xccfbf1; glowCol = 0x2dd4bf; }

        const drawSingleArrow = (ox, oy, scale = 1.0) => {
            const ax = p.x + ox;
            const ay = p.y + oy;
            const tailX = ax - cos * 22 * scale;
            const tailY = ay - sin * 22 * scale;

            if (sName) {
                mainG.lineStyle(6 * scale, glowCol, 0.25).moveTo(ax, ay).lineTo(ax - cos * 30 * scale, ay - sin * 30 * scale);
                mainG.lineStyle(3 * scale, glowCol, 0.55).moveTo(ax, ay).lineTo(tailX, tailY);
            }
            mainG.lineStyle(2.1 * scale, shaftCol, 0.95).moveTo(ax, ay).lineTo(tailX, tailY);

            mainG.lineStyle(0);
            mainG.beginFill(headCol, 0.98);
            mainG.moveTo(ax + cos * 6 * scale, ay + sin * 6 * scale);
            mainG.lineTo(ax - cos * 4 * scale + nx * 3.8 * scale, ay - sin * 4 * scale + ny * 3.8 * scale);
            mainG.lineTo(ax - cos * 4 * scale - nx * 3.8 * scale, ay - sin * 4 * scale - ny * 3.8 * scale);
            mainG.closePath();
            mainG.endFill();

            mainG.lineStyle(1.4 * scale, sName ? glowCol : 0x94a3b8, 0.85);
            mainG.moveTo(tailX + cos * 4, tailY + sin * 4).lineTo(tailX - cos * 2 + nx * 3.5, tailY - sin * 2 + ny * 3.5);
            mainG.moveTo(tailX + cos * 4, tailY + sin * 4).lineTo(tailX - cos * 2 - nx * 3.5, tailY - sin * 2 - ny * 3.5);

            if (sName) {
                drawSoftGlowParticle(mainG, ax, ay, (sName.includes("스나이퍼") ? 5.2 : 3.6) * scale, glowCol, 0.85, headCol);
            }
        };

        if (sName.includes("더블")) {
            drawSingleArrow(nx * 4.5, ny * 4.5, 0.92);
            drawSingleArrow(-nx * 4.5, -ny * 4.5, 0.92);
        } else if (sName.includes("멀티")) {
            drawSingleArrow(0, 0, 0.95);
            drawSingleArrow(nx * 7 - cos * 4, ny * 7 - sin * 4, 0.85);
            drawSingleArrow(-nx * 7 - cos * 4, -ny * 7 - sin * 4, 0.85);
        } else {
            drawSingleArrow(0, 0, sName.includes("스나이퍼") ? 1.25 : 1.0);
        }
    } else {
        let c1 = 0x38bdf8, c2 = 0xa855f7;
        if (sName.includes("파이어") || sName.includes("메테오") || sName.includes("미티어") || sName.includes("이럽션") || sName.includes("헬 파이어")) { c1 = 0xfef08a; c2 = 0xef4444; }
        else if (sName.includes("블라인드") || sName.includes("둠") || sName.includes("데스") || sName.includes("카오스") || sName.includes("뱀파이어") || sName.includes("사일런스")) { c1 = 0xf0abfc; c2 = 0x581c87; }
        else if (sName.includes("포이즌")) { c1 = 0x86efac; c2 = 0x15803d; }
        else if (sName.includes("아이스") || sName.includes("콜드") || sName.includes("블리자드") || sName.includes("제로") || sName.includes("프로즌")) { c1 = 0xffffff; c2 = 0x06b6d4; }
        else if (sName.includes("라이트닝") || sName.includes("파럴라이즈") || sName.includes("썬더")) { c1 = 0xffffff; c2 = 0xfacc15; }
        else if (sName.includes("윈드")) { c1 = 0xa7f3d0; c2 = 0x10b981; }
        else if (sName.includes("어스")) { c1 = 0xfde047; c2 = 0xb45309; }

        // 마법 투사체 외형 및 꼬리 파티클 대폭 확대 (상용 RPG 수준의 화려한 마력 탄환)
        mainG.lineStyle(6.5, c2, 0.30).moveTo(p.x, p.y).lineTo(p.x - cos * 38, p.y - sin * 38);
        mainG.lineStyle(3.2, c1, 0.65).moveTo(p.x, p.y).lineTo(p.x - cos * 24, p.y - sin * 24);
        mainG.lineStyle(0);

        if (sName.includes("아이스") || sName.includes("콜드")) {
            mainG.lineStyle(2.0, 0xffffff, 0.95);
            mainG.beginFill(c2, 0.90);
            mainG.moveTo(p.x + cos * 19, p.y + sin * 19);
            mainG.lineTo(p.x - cos * 8 + nx * 8.5, p.y - sin * 8 + ny * 8.5);
            mainG.lineTo(p.x - cos * 24, p.y - sin * 24);
            mainG.lineTo(p.x - cos * 8 - nx * 8.5, p.y - sin * 8 - ny * 8.5);
            mainG.closePath();
            mainG.endFill();
        } else if (sName.includes("파이어")) {
            // 화염 마법: 거대한 화염구 코어 + 타오르는 불꽃 코로나
            mainG.lineStyle(3.8, 0xf97316, 0.92).moveTo(p.x + cos * 15, p.y + sin * 15).lineTo(p.x - cos * 28, p.y - sin * 28);
            mainG.lineStyle(0);
            mainG.beginFill(0xef4444, 0.45).drawCircle(p.x - cos * 4, p.y - sin * 4, 15).endFill();
            mainG.beginFill(0xfef08a, 0.96);
            mainG.moveTo(p.x + cos * 18, p.y + sin * 18);
            mainG.lineTo(p.x - cos * 5 + nx * 8.5, p.y - sin * 5 + ny * 8.5);
            mainG.lineTo(p.x - cos * 5 - nx * 8.5, p.y - sin * 5 - ny * 8.5);
            mainG.closePath();
            mainG.endFill();
        } else if (sName.includes("윈드")) {
            // 윈드 컷: 대형 이중 초승달 폭풍 칼날
            mainG.lineStyle(5.2, c2, 0.55);
            mainG.moveTo(p.x - cos * 9 + nx * 19, p.y - sin * 9 + ny * 19);
            mainG.lineTo(p.x + cos * 11, p.y + sin * 11);
            mainG.lineTo(p.x - cos * 9 - nx * 19, p.y - sin * 9 - ny * 19);
            mainG.lineStyle(3.2, 0xffffff, 0.95);
            mainG.moveTo(p.x - cos * 7 + nx * 16, p.y - sin * 7 + ny * 16);
            mainG.lineTo(p.x + cos * 9, p.y + sin * 9);
            mainG.lineTo(p.x - cos * 7 - nx * 16, p.y - sin * 7 - ny * 16);
        }

        const wavePhase = (Date.now() * 0.025) + (p.x * 0.05);
        const orbitOff = Math.sin(wavePhase) * 5.5;
        drawSoftGlowParticle(mainG, p.x, p.y, 10.5, c2, 0.98, c1);
        drawSoftGlowParticle(mainG, p.x - cos * 12 + nx * orbitOff, p.y - sin * 12 + ny * orbitOff, 7.6, c2, 0.84, c1);
        drawSoftGlowParticle(mainG, p.x - cos * 23 - nx * orbitOff, p.y - sin * 23 - ny * orbitOff, 5.8, c2, 0.65, c1);
        drawSoftGlowParticle(mainG, p.x - cos * 34, p.y - sin * 34, 4.0, c2, 0.45, c1);
    }
    mainG.lineStyle(0);
}

// ============================================================================
// ✡️ 공격마법 3서클 이상 전용 마법진 렌더러 (피해량·배율·서클에 따라 크기 & 색상 자동 차등)
// - 버프/힐링/비공격 마법에는 호출되지 않으며, 공격마법의 위력을 바닥 마법진으로 직관적 표현
// ============================================================================
function drawDiamondSparkle(mainG, cx, cy, r, col, alpha) {
    mainG.lineStyle(0);
    mainG.beginFill(col, alpha);
    mainG.moveTo(cx, cy - r);
    mainG.lineTo(cx + r * 0.35, cy - r * 0.35);
    mainG.lineTo(cx + r, cy);
    mainG.lineTo(cx + r * 0.35, cy + r * 0.35);
    mainG.lineTo(cx, cy + r);
    mainG.lineTo(cx - r * 0.35, cy + r * 0.35);
    mainG.lineTo(cx - r, cy);
    mainG.lineTo(cx - r * 0.35, cy - r * 0.35);
    mainG.closePath();
    mainG.endFill();
}

export function drawSacredMagicCircle(mainG, cx, cy, baseRadius, progress, isBossCircle = false, skillName = '', circleLv = 3, dmgMult = 1.5, dmgAmount = 0) {
    let alpha = 1.0;
    if (progress < 0.20) alpha = progress / 0.20;
    else if (progress > 0.72) alpha = Math.max(0, (1 - progress) / 0.28);
    alpha = Math.max(0, Math.min(1, alpha));

    // 피해량(dmgAmount) 및 스킬 대미지 배율(dmgMult), 서클(circleLv)에 따른 4단계 위력 티어 산출
    let powerTier = 1; // 1: 중급(3서클급), 2: 상급(4서클급), 3: 특급(5서클급), 4: 초월(6서클/극대 피해)
    if (!isBossCircle) {
        if (dmgAmount >= 1400 || dmgMult >= 3.8 || circleLv >= 6) powerTier = 4;
        else if (dmgAmount >= 700 || dmgMult >= 2.7 || circleLv === 5) powerTier = 3;
        else if (dmgAmount >= 300 || dmgMult >= 2.0 || circleLv === 4) powerTier = 2;
        else powerTier = 1;
    }

    // 피해량 티어에 비례한 마법진 반경 스케일 (세련되고 절제된 비율 유지)
    const tierScaleMap = { 1: 0.76, 2: 0.90, 3: 1.06, 4: 1.22 };
    const dmgBonusScale = Math.min(0.18, Math.max(0, (dmgAmount || 0) / 10000));
    const tierScale = isBossCircle ? 1.08 : ((tierScaleMap[powerTier] || 0.90) + dmgBonusScale);

    const pulseScale = 0.88 + 0.14 * Math.sin(Math.min(1, progress * 1.4) * (Math.PI / 2));
    const R = baseRadius * tierScale * pulseScale;
    const rot = progress * (isBossCircle ? -1.15 : (0.95 + powerTier * 0.22));
    const tilt = ISO_TILT;

    // 피해량 티어별 고유 색상 팔레트 (1: 시안 블루 -> 2: 로얄 퍼플 -> 3: 솔라 골드 -> 4: 크림슨 어비스)
    let auraCol1, auraCol2, outerLineCol, subLineCol;
    if (isBossCircle) {
        auraCol1 = 0x2a0410; auraCol2 = 0x7f1d1d; outerLineCol = 0xef4444; subLineCol = 0xf87171;
    } else if (powerTier === 1) {
        // 3서클 / 기본 피해량: 청명한 아케인 시안-블루
        auraCol1 = 0x0c4a6e; auraCol2 = 0x0284c7; outerLineCol = 0xe0f2fe; subLineCol = 0x38bdf8;
    } else if (powerTier === 2) {
        // 4서클 / 중상급 피해량: 고귀한 아메지스트 바이올렛
        auraCol1 = 0x4c1d95; auraCol2 = 0x7e22ce; outerLineCol = 0xf5d0fe; subLineCol = 0xc084fc;
    } else if (powerTier === 3) {
        // 5서클 / 고피해량: 찬란한 솔라 골드 & 앰버
        auraCol1 = 0x78350f; auraCol2 = 0xd97706; outerLineCol = 0xfef08a; subLineCol = 0xfacc15;
    } else {
        // 6서클 / 초극대 피해량: 심연의 크림슨 레드 & 황금 룬
        auraCol1 = 0x7f1d1d; auraCol2 = 0xdc2626; outerLineCol = 0xfde047; subLineCol = 0xf87171;
    }

    const toIsometric = (x, y) => ({
        x: cx + (x - cx),
        y: cy + (y - cy) * tilt
    });

    // 바닥 2.5D 타원 오라 후광
    mainG.lineStyle(0);
    mainG.beginFill(auraCol1, alpha * (isBossCircle ? 0.50 : (0.18 + powerTier * 0.04))).drawEllipse(cx, cy, R * 1.10, R * 1.10 * tilt).endFill();
    mainG.beginFill(auraCol2, alpha * (isBossCircle ? 0.36 : (0.14 + powerTier * 0.04))).drawEllipse(cx, cy, R * 0.78, R * 0.78 * tilt).endFill();

    const drawIsoPolygon = (sides, r, rAngle, lw, col, a) => {
        mainG.lineStyle(lw, col, a);
        for (let i = 0; i <= sides; i++) {
            const ang = rAngle + (i / sides) * Math.PI * 2;
            const px = cx + Math.cos(ang) * r;
            const py = cy + Math.sin(ang) * r;
            const p = toIsometric(px, py);
            if (i === 0) mainG.moveTo(p.x, p.y);
            else mainG.lineTo(p.x, p.y);
        }
    };

    // 외곽 이중 2.5D 타원 링
    mainG.lineStyle(2.0 + powerTier * 0.35, outerLineCol, alpha * 0.92).drawEllipse(cx, cy, R, R * tilt);
    mainG.lineStyle(1.2 + powerTier * 0.2, subLineCol, alpha * 0.78).drawEllipse(cx, cy, R * 0.90, R * 0.90 * tilt);

    // 티어별 기하학 문양 차등 (티어 1: 삼각/육각, 티어 2: 사각 옥타그램, 티어 3+: 이중 옥타그램 & 육망성)
    if (powerTier >= 2 || isBossCircle) {
        drawIsoPolygon(4, R * 0.90, rot, 2.0, outerLineCol, alpha * 0.90);
        drawIsoPolygon(4, R * 0.90, rot + Math.PI / 4, 2.0, subLineCol, alpha * 0.85);
    } else {
        drawIsoPolygon(6, R * 0.90, rot, 1.8, outerLineCol, alpha * 0.85);
    }

    mainG.lineStyle(2.0, outerLineCol, alpha * 0.90).drawEllipse(cx, cy, R * 0.62, R * 0.62 * tilt);
    drawIsoPolygon(3, R * 0.62, -rot * 1.3, 1.9, outerLineCol, alpha * 0.90);
    drawIsoPolygon(3, R * 0.62, -rot * 1.3 + Math.PI, 1.9, outerLineCol, alpha * 0.90);

    // 고위력(티어 3, 4) 마법진은 추가 외곽 룬 링과 더 많은 룬 구체 표시
    const runeCount = powerTier >= 4 ? 12 : (powerTier === 3 ? 8 : 6);
    for (let i = 0; i < runeCount; i++) {
        const a = rot + (i * Math.PI * 2) / runeCount;
        const rxPt = cx + Math.cos(a) * (R * 0.78);
        const ryPt = cy + Math.sin(a) * (R * 0.78 * tilt);
        drawSoftGlowParticle(mainG, rxPt, ryPt, 2.4 + powerTier * 0.55, subLineCol, alpha * 0.88, outerLineCol);
    }

    mainG.lineStyle(1.8, outerLineCol, alpha * 0.95).drawEllipse(cx, cy, R * 0.24, R * 0.24 * tilt);
    mainG.lineStyle(0);
}

// 파티클 시드 초기화 헬퍼 (2.5D 중력/고도/위상/각도 물리 파라미터 포함 - 마법/타격 스케일 업그레이드)
function ensureEffectParticles(eff, count = 56) {
    if (!eff.particles) {
        eff.particles = [];
        for (let i = 0; i < count; i++) {
            eff.particles.push({
                ang: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.35,
                distRatio: 0.12 + Math.random() * 0.95,
                spd: 0.65 + Math.random() * 1.15,
                sz: 3.4 + Math.random() * 5.8,
                vz: 34 + Math.random() * 68,
                gravity: 65 + Math.random() * 45,
                hOff: (Math.random() - 0.5) * 34,
                phase: Math.random() * Math.PI * 2
            });
        }
    }
    return eff.particles;
}

// ============================================================================
// ✨ 전 스킬·마법 전수조사 완료 렌더러
// - 하늘에서 내려오는 마법(라이트닝/썬더볼트/체인라이트닝/라이트닝스톰/메테오/미티어스웜/아이스스톰/블리자드/앱솔루트제로/둠/워드오브데스/카오스필드/애로우레인)은 화면 밖 상단에서 시작해 타겟에 충돌!
// - 버프/힐링/비공격 계열은 마법진 없이 부드러운 파티클만 표현!
// - 공격마법 3서클 이상만 피해량에 따라 크기/색상이 다른 마법진 표현!
// ============================================================================
export function drawEffect(mainG, eff, progress) {
    const tilt = ISO_TILT;

    // 1. 공격마법(3서클 이상) 및 보스 전용 2.5D 바닥 마법진 (bottomMagicCircleG 전용)
    if (eff.type === 'magic_circle') {
        const caster = eff.casterRef;
        const cx = caster && caster.x !== undefined ? caster.x : eff.x;
        const yOff = eff.isBossCircle ? 11 : 2;
        const cy = caster && caster.y !== undefined ? (caster.y + yOff) : eff.y;
        drawSacredMagicCircle(
            mainG,
            cx,
            cy,
            eff.aoeRadius || 78,
            progress,
            Boolean(eff.isBossCircle),
            eff.skillName || '',
            eff.circleLv || 3,
            eff.dmgMult || 1.5,
            eff.dmgAmount || 0
        );
        return;
    }

    // 2. 보스 광역기 바닥 예고 장판
    if (eff.type === 'boss_telegraph') {
        const R = eff.aoeRadius || 165;
        const pulse = 0.5 + 0.5 * Math.sin(progress * Math.PI * 10);
        const ry = R * tilt;
        mainG.lineStyle(3, 0xef4444, 0.88).drawEllipse(eff.x, eff.y, R, ry);
        mainG.lineStyle(0);
        mainG.beginFill(0xdc2626, 0.15 + pulse * 0.12).drawEllipse(eff.x, eff.y, R, ry).endFill();
        mainG.beginFill(0xef4444, 0.28).drawEllipse(eff.x, eff.y, R * progress, ry * progress).endFill();
        drawSacredMagicCircle(mainG, eff.x, eff.y, R * 0.76, progress, true, '보스 심연 마법진', 6, 4.5, 2500);
        return;
    }

    const sName = String(eff.skillName || "");
    const isAoe = Boolean(eff.isAoe);
    const maxR = (eff.aoeRadius || (isAoe ? 160 : 78)) * 1.08;
    const alpha = Math.max(0, Math.sin((1 - progress) * (Math.PI / 2)));
    const pts = ensureEffectParticles(eff, isAoe ? 26 : 16);
    // 화면 밖 상단 시작 Y좌표 (시전자/카메라 기준 화면 상단 바깥)
    const skyTopY = typeof eff.skyStartY === 'number' ? eff.skyStartY : (eff.y - 540);

    // 3. 💥 피격 파티클 (hit_particle - 깔끔하고 절도 있는 타격 스파크)
    if (eff.type === 'hit_particle') {
        const hitPts = ensureEffectParticles(eff, eff.isCrit ? 11 : 7);
        const isPlayerHit = eff.targetType === 'player';
        const isMercHit = eff.targetType === 'mercenary';
        const isMagicHit = eff.dmgType === 'magic';
        const isSkillHit = Boolean(eff.isSkill);
        const baseAng = typeof eff.hitAngle === 'number' ? eff.hitAngle : 0;

        let mainCol = isPlayerHit ? 0xef4444 : (isMercHit ? 0xf97316 : (isMagicHit ? 0x38bdf8 : (isSkillHit ? 0xc084fc : 0xfde047)));
        let coreCol = 0xffffff;
        if (eff.isCrit) {
            mainCol = 0xfacc15;
            coreCol = 0xfef08a;
        }

        // 이중 바닥 충격파 링 (타격 무게감 표현)
        const ringR = (eff.isCrit ? 56 : (isSkillHit ? 44 : 34)) * (0.25 + progress * 0.78);
        drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, ringR, mainCol, alpha * 0.92, eff.isCrit ? 3.2 : 2.2, 0.16);
        if (eff.isCrit || isSkillHit) {
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, ringR * 0.62, 0xffffff, alpha * 0.85, 1.8, 0.10);
        }

        // 타격 중심 코어 임팩트 플래시 & 슬래시 라인
        if (progress < 0.55) {
            const flashRatio = 1 - (progress / 0.55);
            const slashLen = (eff.isCrit ? 42 : 26) * (0.5 + progress * 0.7);
            const sAng = baseAng + (Math.PI / 4);
            mainG.lineStyle(eff.isCrit ? 4.5 : 3.0, mainCol, alpha * flashRatio * 0.9);
            mainG.moveTo(eff.x - Math.cos(sAng) * slashLen, (eff.y - 16) - Math.sin(sAng) * slashLen * 0.75)
                 .lineTo(eff.x + Math.cos(sAng) * slashLen, (eff.y - 16) + Math.sin(sAng) * slashLen * 0.75);
            mainG.lineStyle(eff.isCrit ? 2.4 : 1.6, 0xffffff, alpha * flashRatio);
            mainG.moveTo(eff.x - Math.cos(sAng) * slashLen * 0.8, (eff.y - 16) - Math.sin(sAng) * slashLen * 0.6)
                 .lineTo(eff.x + Math.cos(sAng) * slashLen * 0.8, (eff.y - 16) + Math.sin(sAng) * slashLen * 0.6);
            mainG.lineStyle(0);
        }

        hitPts.forEach((p, idx) => {
            const spread = (idx % 2 === 0 ? 1 : -1) * (p.distRatio * 1.25);
            const dirAng = eff.hasDirection ? (baseAng + spread) : p.ang;
            const travel = (eff.isCrit ? 64 : (isSkillHit ? 52 : 40)) * p.spd * progress;
            const px = eff.x + Math.cos(dirAng) * travel;
            const zHeight = Math.max(0, (p.vz * progress) - (0.5 * p.gravity * progress * progress));
            const py = (eff.y - 15) + Math.sin(dirAng) * travel * tilt - zHeight;

            drawSoftGlowParticle(mainG, px, py, p.sz * (eff.isCrit ? 1.05 : 0.82) * (1 - progress * 0.35), mainCol, alpha, coreCol);
        });

        if (eff.isCrit) {
            const burstR = 46 * Math.sin(progress * Math.PI);
            drawDiamondSparkle(mainG, eff.x, eff.y - 18, burstR, 0xfacc15, alpha * 0.92);
            drawDiamondSparkle(mainG, eff.x, eff.y - 18, burstR * 0.62, 0xffffff, alpha);
        }
        return;
    }

    // 4. 🌿 버프 · 힐링 · 비공격 계열 (마법진 없이 오직 부드럽고 우아한 소프트 파티클만 표현!)
    const isNonCombatSpell =
        eff.type === 'potion' ||
        eff.type === 'buff' ||
        sName.includes("힐") ||
        sName.includes("큐어") ||
        sName.includes("라이트") && !sName.includes("라이트닝") ||
        sName.includes("실드") && !sName.includes("스트라이크") ||
        sName.includes("디텍션") ||
        sName.includes("인챈트") ||
        sName.includes("블레스드") ||
        sName.includes("헤이스트") ||
        sName.includes("메디테이션") ||
        sName.includes("스킨") ||
        sName.includes("스피릿") ||
        sName.includes("서먼") ||
        sName.includes("이뮨") ||
        sName.includes("배리어") ||
        sName.includes("워크") ||
        sName.includes("인듀어") ||
        sName.includes("버서커") ||
        sName.includes("카운터") ||
        sName.includes("아이언 윌") ||
        sName.includes("라이프 스틸") ||
        sName.includes("타이탄") ||
        sName.includes("임모탈") ||
        sName.includes("이글 아이") ||
        sName.includes("그레이스");

    if (isNonCombatSpell) {
        const subType = eff.subType || '';
        const isHpPot = subType === 'hp' || sName.includes("체력 물약");
        const isMpPot = subType === 'mp' || sName.includes("마나 물약") || sName.includes("메디테이션");
        const isElixir = subType === 'elixir' || sName.includes("비약") || sName.includes("버서커") || sName.includes("타이탄");
        const isHeal = sName.includes("힐") || sName.includes("큐어");
        const isGreatHeal = sName.includes("그레이트") || sName.includes("힐 올");

        let cMain = 0x38bdf8, cSub = 0xbae6fd, cCore = 0xffffff;
        if (isHpPot) { cMain = 0x22c55e; cSub = 0x86efac; cCore = 0xfef08a; }
        else if (isMpPot) { cMain = 0x38bdf8; cSub = 0x93c5fd; cCore = 0xe0f2fe; }
        else if (isElixir) { cMain = 0xf97316; cSub = 0xfde047; cCore = 0xffffff; }
        else if (isGreatHeal) { cMain = 0x34d399; cSub = 0xfef08a; cCore = 0xffffff; }
        else if (isHeal) { cMain = 0x10b981; cSub = 0xa7f3d0; cCore = 0xfef08a; }
        else if (sName.includes("실드") || sName.includes("배리어") || sName.includes("이뮨")) { cMain = 0x60a5fa; cSub = 0xe0f2fe; cCore = 0xffffff; }
        else if (sName.includes("스킨") || sName.includes("인듀어") || sName.includes("아이언 윌") || sName.includes("블레스드")) { cMain = 0xf59e0b; cSub = 0xfef08a; cCore = 0xffffff; }
        else if (sName.includes("헤이스트") || sName.includes("워크") || sName.includes("그레이스") || sName.includes("이글 아이")) { cMain = 0x2dd4bf; cSub = 0x99f6e4; cCore = 0xffffff; }
        else if (sName.includes("인챈트") || sName.includes("스피릿") || sName.includes("라이프 스틸")) { cMain = 0xf472b6; cSub = 0xc084fc; cCore = 0xffffff; }
        else if (sName.includes("라이트") || sName.includes("디텍션") || sName.includes("임모탈")) { cMain = 0xfacc15; cSub = 0xfef9c3; cCore = 0xffffff; }

        const followX = eff.targetRef && eff.targetRef.x !== undefined ? eff.targetRef.x : eff.x;
        const followY = eff.targetRef && eff.targetRef.y !== undefined ? eff.targetRef.y : eff.y;
        const rad = isGreatHeal ? 64 : (eff.type === 'potion' ? 34 : 44);

        // 마법진 같은 각진 기하학 도형 없이, 부드러운 숨결 파동과 소프트 글로우 입자만 유영하도록 표현
        const softWaveAlpha = alpha * 0.55;
        drawSoftIsoEllipse(mainG, followX, followY + 2, rad * (0.5 + progress * 0.45), cMain, softWaveAlpha, 1.8, 0.10);

        // 캐릭터를 부드럽게 감싸며 피어오르는 오라 베일
        mainG.lineStyle(0);
        const veilH = (isGreatHeal ? 72 : 52) * Math.sin(progress * Math.PI);
        mainG.beginFill(cMain, alpha * 0.11).drawEllipse(followX, followY - veilH * 0.45, rad * 0.52, Math.max(12, veilH * 0.55)).endFill();

        // 스킬 이름에 걸맞은 부드러운 상징 포인트
        if (sName.includes("실드") || sName.includes("배리어") || sName.includes("이뮨")) {
            const domeR = 26 + Math.sin(progress * Math.PI) * 4;
            mainG.lineStyle(1.6, cSub, alpha * 0.65).drawEllipse(followX, followY - 18, domeR, domeR * 0.88);
            mainG.lineStyle(0);
            mainG.beginFill(cMain, alpha * 0.12).drawEllipse(followX, followY - 18, domeR, domeR * 0.88).endFill();
        } else if (sName.includes("디텍션")) {
            // 디텍션: 주변 은신을 탐색하는 부드러운 동심원 파동 2개
            drawSoftIsoEllipse(mainG, followX, followY + 2, 115 * progress, 0xfacc15, alpha * 0.7, 2.0, 0.04);
        } else if (sName.includes("라이트") || sName.includes("이글 아이")) {
            // 라이트 / 이글 아이: 머리 위를 부드럽게 밝히는 따뜻한 빛 구체
            drawSoftGlowParticle(mainG, followX, followY - 52 - progress * 6, 9, 0xfef08a, alpha * 0.9, 0xffffff);
        } else if (sName.includes("서먼 몬스터")) {
            mainG.beginFill(0x64748b, alpha * 0.35).drawEllipse(followX, followY - 34, 18, 26).endFill();
            drawSoftGlowParticle(mainG, followX, followY - 40, 6.5, 0x38bdf8, alpha * 0.9, 0xffffff);
        }

        // 부드럽게 나선 상승하는 반딧불이형 소프트 파티클
        const pCount = eff.type === 'potion' ? 14 : 22;
        pts.slice(0, pCount).forEach((p, idx) => {
            const spiralAng = p.ang + progress * 2.4;
            const orbitR = rad * 0.62 * p.distRatio * (1 - progress * 0.2);
            const px = followX + Math.cos(spiralAng) * orbitR;
            const py = followY + 2 + Math.sin(spiralAng) * (orbitR * tilt) - (progress * (isGreatHeal ? 68 : 48) * p.spd);
            const pCol = idx % 2 === 0 ? cMain : cSub;
            drawSoftGlowParticle(mainG, px, py, p.sz * 0.68 * Math.sin(progress * Math.PI), pCol, alpha * 0.9, cCore);
        });
        return;
    }

    // 5. 🌀 텔레포트 / 매스 텔레포트 / 닷지 스텝 (마법진 없이 부드러운 공간 잔상만 표현)
    if (sName.includes("텔레포트") || sName.includes("닷지")) {
        const isDodge = sName.includes("닷지");
        const c1 = isDodge ? 0x38bdf8 : 0xa855f7;
        const c2 = isDodge ? 0xbae6fd : 0xe879f9;
        drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, 46 * (1 - progress * 0.45), c1, alpha * 0.75, 2.0, 0.12);
        pts.slice(0, 18).forEach(p => {
            const r = 38 * p.distRatio * (1 - progress * 0.5);
            const px = eff.x + Math.cos(p.ang + progress * 3) * r;
            const py = eff.y + Math.sin(p.ang + progress * 3) * r * tilt - progress * 52 * p.spd;
            drawSoftGlowParticle(mainG, px, py, p.sz * 0.68, c2, alpha * 0.9, 0xffffff);
        });
        return;
    }

    // 6. ☄️ 하늘에서 내려오는 공격마법 & 궁수 스킬 (화면 밖 상단 `skyTopY`에서 시작하여 타겟에 깔끔하게 충돌!)
    // 대상: 라이트닝, 썬더 볼트, 체인 라이트닝, 라이트닝 스톰, 메테오(소), 미티어 스웜, 아이스 스톰, 블리자드, 앱솔루트 제로, 둠, 워드 오브 데스, 카오스 필드, 애로우 레인
    const isSkyLightning = sName.includes("라이트닝") || sName.includes("썬더 볼트");
    const isSkyMeteor = sName.includes("메테오") || sName.includes("미티어");
    const isSkyIce = sName.includes("아이스 스톰") || sName.includes("블리자드") || sName.includes("앱솔루트 제로");
    const isSkyDark = sName.includes("둠") || sName.includes("워드 오브 데스") || sName.includes("카오스 필드");
    const isSkyArrow = sName.includes("애로우 레인");

    if (isSkyLightning || isSkyMeteor || isSkyIce || isSkyDark || isSkyArrow) {
        const areaR = isAoe ? maxR : 68;
        // 화면 밖 상단(skyTopY)에서 타겟 지점(eff.y)까지의 총 낙하 거리
        const dropHeight = Math.max(380, eff.y - skyTopY);

        if (isSkyLightning) {
            // ⚡ 콜 라이트닝 / 썬더 볼트 / 체인 라이트닝 / 라이트닝 스톰
            const isBlue = sName.includes("썬더") || sName.includes("체인");
            const boltCol = isBlue ? 0x38bdf8 : 0xfacc15;
            const strikeCount = isAoe ? 6 : 1;

            for (let b = 0; b < strikeCount; b++) {
                const p = pts[b * 4] || pts[0];
                const delay = isAoe ? (b / strikeCount) * 0.35 : 0;
                const localP = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
                if (localP <= 0) continue;

                const tx = eff.x + (isAoe ? Math.cos(p.ang) * (areaR * 0.75 * p.distRatio) : 0);
                const ty = eff.y + (isAoe ? Math.sin(p.ang) * (areaR * 0.75 * p.distRatio * tilt) : 0);
                const startY = ty - dropHeight;

                // 전반부(0 ~ 0.38): 화면 밖 상단에서 타겟으로 번개 줄기가 빠르게 낙하
                const headRatio = Math.min(1, localP / 0.35);
                const curY = startY + (ty - startY) * headRatio;
                const tailY = Math.max(startY, curY - dropHeight * 0.65);

                if (localP < 0.85) {
                    const boltAlpha = alpha * (localP > 0.45 ? (1 - (localP - 0.45) / 0.4) : 1);
                    const midY1 = tailY + (curY - tailY) * 0.35;
                    const midY2 = tailY + (curY - tailY) * 0.70;
                    mainG.lineStyle(9, boltCol, boltAlpha * 0.28)
                        .moveTo(tx + 8, tailY)
                        .lineTo(tx - 12, midY1)
                        .lineTo(tx + 10, midY2)
                        .lineTo(tx, curY);
                    mainG.lineStyle(3.2, 0xffffff, boltAlpha * 0.95)
                        .moveTo(tx + 8, tailY)
                        .lineTo(tx - 12, midY1)
                        .lineTo(tx + 10, midY2)
                        .lineTo(tx, curY);
                }

                // 타겟 충돌 순간(headRatio >= 0.95): 지면 파열 링 & 스파크
                if (headRatio >= 0.95) {
                    const hitP = (localP - 0.32) / 0.68;
                    const ringR = (isAoe ? 48 : 62) * (0.3 + hitP * 0.7);
                    drawSoftIsoEllipse(mainG, tx, ty + 2, ringR, boltCol, alpha * (1 - hitP * 0.6), 2.6, 0.16);
                    drawSoftGlowParticle(mainG, tx, ty - 6, 10 * (1 - hitP * 0.5), boltCol, alpha, 0xffffff);
                }
            }

            if (sName.includes("체인") && progress > 0.3) {
                mainG.lineStyle(2.4, 0x38bdf8, alpha * 0.88);
                for (let k = 0; k < 4; k++) {
                    const pA = pts[k] || pts[0];
                    const pB = pts[k + 1] || pts[0];
                    mainG.moveTo(eff.x + Math.cos(pA.ang) * areaR * 0.6, eff.y + Math.sin(pA.ang) * areaR * 0.6 * tilt - 12)
                        .lineTo(eff.x + Math.cos(pB.ang) * areaR * 0.6, eff.y + Math.sin(pB.ang) * areaR * 0.6 * tilt - 12);
                }
            }
            return;
        }

        if (isSkyMeteor) {
            // ☄️ 메테오(소) / 미티어 스웜: 화면 밖 상단에서 사선으로 낙하하여 타겟에 충돌 폭발!
            const meteorCount = sName.includes("미티어") ? 6 : 1;
            for (let m = 0; m < meteorCount; m++) {
                const p = pts[m * 4] || pts[0];
                const delay = meteorCount > 1 ? (m / meteorCount) * 0.42 : 0;
                const localP = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
                if (localP <= 0) continue;

                const tx = eff.x + (meteorCount > 1 ? Math.cos(p.ang) * (areaR * 0.72 * p.distRatio) : 0);
                const ty = eff.y + (meteorCount > 1 ? Math.sin(p.ang) * (areaR * 0.72 * p.distRatio * tilt) : 0);

                if (localP < 0.52) {
                    // 화면 밖 상단(ty - dropHeight)에서 타겟(tx, ty)까지 직선 낙하
                    const fallRatio = localP / 0.52;
                    const mx = tx + (1 - fallRatio) * 110;
                    const my = ty - (1 - fallRatio) * dropHeight;
                    const rockR = sName.includes("미티어") ? 13 : 11;

                    // 타겟 바닥 조준원
                    drawSoftIsoEllipse(mainG, tx, ty + 2, 28 * (1 - fallRatio * 0.5), 0xef4444, alpha * 0.5, 1.6, 0.08);
                    // 화염 꼬리 + 운석 코어
                    mainG.lineStyle(rockR * 1.3, 0xf97316, alpha * 0.45).moveTo(mx, my).lineTo(mx + 28, my - 95);
                    mainG.lineStyle(rockR * 0.7, 0xfef08a, alpha * 0.85).moveTo(mx, my).lineTo(mx + 14, my - 48);
                    mainG.lineStyle(0);
                    mainG.beginFill(0xdc2626, alpha).drawCircle(mx, my, rockR).endFill();
                    mainG.beginFill(0xfef08a, alpha).drawCircle(mx - 2, my + 2, rockR * 0.55).endFill();
                } else {
                    // 타겟 충돌 후 깔끔한 화염 크레이터 충격파
                    const boomRatio = (localP - 0.52) / 0.48;
                    const br = (meteorCount > 1 ? areaR * 0.48 : 74) * (0.25 + boomRatio * 0.75);
                    drawSoftIsoEllipse(mainG, tx, ty + 2, br, 0xef4444, (1 - boomRatio) * alpha, 3.2, 0.22);
                    drawSoftGlowParticle(mainG, tx, ty - 8, 16 * (1 - boomRatio * 0.6), 0xf97316, (1 - boomRatio) * alpha, 0xfef08a);
                }
            }
            return;
        }

        if (isSkyIce) {
            // ❄️ 아이스 스톰 / 블리자드 / 앱솔루트 제로: 화면 밖 상단에서 빙결 결정이 낙하하여 타겟 충돌
            const shardCount = sName.includes("앱솔루트 제로") ? 5 : 8;
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, areaR * (0.4 + progress * 0.6), 0x38bdf8, alpha * 0.8, 2.6, 0.16);
            for (let i = 0; i < shardCount; i++) {
                const p = pts[i * 3] || pts[0];
                const delay = (i / shardCount) * 0.40;
                const localP = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
                if (localP <= 0) continue;

                const tx = eff.x + Math.cos(p.ang) * (areaR * 0.75 * p.distRatio);
                const ty = eff.y + Math.sin(p.ang) * (areaR * 0.75 * p.distRatio * tilt);
                if (localP < 0.50) {
                    const fallRatio = localP / 0.50;
                    const ix = tx - (1 - fallRatio) * 65;
                    const iy = ty - (1 - fallRatio) * dropHeight;
                    mainG.lineStyle(4, 0x7dd3fc, alpha * 0.5).moveTo(ix, iy).lineTo(ix - 14, iy - 65);
                    drawDiamondSparkle(mainG, ix, iy, sName.includes("제로") ? 13 : 9, 0xe0f2fe, alpha);
                } else {
                    const hitRatio = (localP - 0.50) / 0.50;
                    const sh = (sName.includes("제로") ? 46 : 30) * Math.sin(hitRatio * Math.PI);
                    mainG.lineStyle(1.4, 0xffffff, alpha * (1 - hitRatio * 0.5));
                    mainG.beginFill(0x38bdf8, alpha * 0.75);
                    mainG.moveTo(tx - 7, ty).lineTo(tx, ty - sh).lineTo(tx + 7, ty).closePath().endFill();
                    drawSoftIsoEllipse(mainG, tx, ty + 2, 32 * hitRatio, 0xbae6fd, alpha * (1 - hitRatio), 1.8, 0.10);
                }
            }
            return;
        }

        if (isSkyArrow) {
            // 🏹 애로우 레인: 화면 밖 상단에서 화살비가 쏟아져 타겟 지점에 꽂힘
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, areaR, 0x2dd4bf, alpha * 0.8, 2.4, 0.12);
            const arrowCount = 12;
            for (let i = 0; i < arrowCount; i++) {
                const p = pts[i * 2] || pts[0];
                const delay = (i / arrowCount) * 0.45;
                const localP = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
                if (localP <= 0) continue;

                const tx = eff.x + Math.cos(p.ang) * (areaR * 0.82 * p.distRatio);
                const ty = eff.y + Math.sin(p.ang) * (areaR * 0.82 * p.distRatio * tilt);
                if (localP < 0.48) {
                    const fallRatio = localP / 0.48;
                    const ax = tx - (1 - fallRatio) * 55;
                    const ay = ty - (1 - fallRatio) * dropHeight;
                    mainG.lineStyle(2.4, 0xfef08a, alpha).moveTo(ax, ay).lineTo(ax - 6, ay - 36);
                    drawSoftGlowParticle(mainG, ax, ay, 4.0, 0x2dd4bf, alpha, 0xffffff);
                } else {
                    const splashR = ((localP - 0.48) / 0.52) * 34;
                    drawSoftIsoEllipse(mainG, tx, ty, splashR, 0x5eead4, alpha * 0.75, 1.5, 0.08);
                }
            }
            return;
        }

        if (isSkyDark) {
            // 💀 둠 / 워드 오브 데스 / 카오스 필드: 화면 밖 상단에서 심판의 암흑 창·구체가 수직 낙하하여 타겟 관통
            const cGlow = sName.includes("데스") ? 0xf43f5e : (sName.includes("둠") ? 0x9333ea : 0xc084fc);
            const dropCount = sName.includes("카오스") ? 5 : 1;
            for (let d = 0; d < dropCount; d++) {
                const p = pts[d * 5] || pts[0];
                const delay = dropCount > 1 ? (d / dropCount) * 0.35 : 0;
                const localP = Math.min(1, Math.max(0, (progress - delay) / (1 - delay)));
                if (localP <= 0) continue;

                const tx = eff.x + (dropCount > 1 ? Math.cos(p.ang) * (areaR * 0.7 * p.distRatio) : 0);
                const ty = eff.y + (dropCount > 1 ? Math.sin(p.ang) * (areaR * 0.7 * p.distRatio * tilt) : 0);
                if (localP < 0.45) {
                    const fallRatio = localP / 0.45;
                    const by = ty - (1 - fallRatio) * dropHeight;
                    mainG.lineStyle(8, cGlow, alpha * 0.35).moveTo(tx, by).lineTo(tx, by - 95);
                    mainG.lineStyle(3.2, 0xffffff, alpha).moveTo(tx, by).lineTo(tx, by - 55);
                    drawDiamondSparkle(mainG, tx, by, 14, cGlow, alpha);
                } else {
                    const boomP = (localP - 0.45) / 0.55;
                    const br = (dropCount > 1 ? areaR * 0.45 : 72) * (0.3 + boomP * 0.7);
                    drawSoftIsoEllipse(mainG, tx, ty + 2, br, cGlow, (1 - boomP) * alpha, 3.0, 0.22);
                    drawDiamondSparkle(mainG, tx, ty - 14, 20 * (1 - boomP * 0.5), 0xffffff, (1 - boomP) * alpha);
                }
            }
            return;
        }
    }

    // 7. 🛡️ 전사(Warrior) 전용 액티브 스킬 (배쉬 / 실드 스트라이크 / 프로보크 / 휠윈드 / 차지 / 워크라이)
    if (eff.type === 'knight' || sName.includes("배쉬") || sName.includes("실드 스트라이크") || sName.includes("프로보크") || sName.includes("휠윈드") || sName.includes("차지") || sName.includes("워크라이")) {
        if (sName.includes("프로보크")) {
            // 프로보크: 적의 투지를 자극하는 붉은 도발 파동 & 머리 위 분노 마크
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, 54 * progress, 0xef4444, alpha, 2.8, 0.16);
            const crossY = eff.y - 42 - progress * 8;
            mainG.lineStyle(2.8, 0xfef08a, alpha)
                .moveTo(eff.x - 8, crossY - 8).lineTo(eff.x + 8, crossY + 8)
                .moveTo(eff.x + 8, crossY - 8).lineTo(eff.x - 8, crossY + 8);
            return;
        }
        if (sName.includes("휠윈드")) {
            for (let ring = 1; ring <= 3; ring++) {
                const rr = (maxR * ring) / 3 * (0.35 + progress * 0.65);
                const col = ring % 2 === 0 ? 0xfacc15 : 0x34d399;
                drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, rr, col, alpha * 0.9, 3.2 - ring * 0.5, 0.08);
            }
            pts.slice(0, 28).forEach(p => {
                const spiralAng = p.ang + progress * 8.5;
                const r = maxR * p.distRatio * (0.3 + progress * 0.7);
                const px = eff.x + Math.cos(spiralAng) * r;
                const py = eff.y + Math.sin(spiralAng) * (r * tilt) - (p.distRatio * 18 * Math.sin(progress * Math.PI));
                const tx = px - Math.sin(spiralAng) * 18;
                const ty = py + Math.cos(spiralAng) * (18 * tilt);
                mainG.lineStyle(2.2, 0xffffff, alpha * 0.85).moveTo(px, py).lineTo(tx, ty);
            });
        } else if (sName.includes("워크라이")) {
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, maxR * progress, 0xf97316, alpha, 4.0, 0.16);
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, maxR * Math.max(0, progress - 0.18), 0xfde047, alpha * 0.85, 2.5, 0.08);
            pts.slice(0, 24).forEach(p => {
                const r = maxR * p.distRatio * progress;
                const z = Math.sin(progress * Math.PI) * 24 * p.spd;
                drawSoftGlowParticle(mainG, eff.x + Math.cos(p.ang) * r, eff.y + Math.sin(p.ang) * (r * tilt) - z, p.sz * 0.8, 0xfb923c, alpha * 0.9, 0xfef08a);
            });
        } else if (sName.includes("차지")) {
            const ang = typeof eff.angle === 'number' ? eff.angle : 0;
            const sx = eff.startX !== undefined ? eff.startX : (eff.x - Math.cos(ang) * 90);
            const sy = eff.startY !== undefined ? eff.startY : (eff.y - Math.sin(ang) * 90);
            mainG.lineStyle(7, 0xfacc15, alpha * 0.35).moveTo(sx, sy).lineTo(eff.x, eff.y);
            mainG.lineStyle(3.2, 0xffffff, alpha * 0.9).moveTo(sx, sy).lineTo(eff.x, eff.y);
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, 58 * progress, 0xef4444, alpha, 3.0, 0.18);
        } else if (sName.includes("실드 스트라이크")) {
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, 56 * progress, 0xfacc15, alpha, 3.0, 0.18);
            const shR = 22 * (0.5 + progress * 0.5);
            mainG.lineStyle(2.6, 0xfef08a, alpha);
            mainG.beginFill(0x1d4ed8, alpha * 0.45);
            mainG.moveTo(eff.x, eff.y - 18 - shR)
                .lineTo(eff.x + shR * 0.85, eff.y - 18 - shR * 0.4)
                .lineTo(eff.x, eff.y - 18 + shR)
                .lineTo(eff.x - shR * 0.85, eff.y - 18 - shR * 0.4)
                .closePath().endFill();
        } else {
            // 배쉬
            const r = 54;
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, r * progress, 0xef4444, alpha, 2.8, 0.16);
            mainG.lineStyle(4.5, 0xfacc15, alpha)
                .moveTo(eff.x - r * progress, eff.y - 16 - r * progress * 0.6)
                .lineTo(eff.x + r * progress, eff.y - 16 + r * progress * 0.6);
            mainG.lineStyle(3.0, 0xffffff, alpha)
                .moveTo(eff.x + r * progress, eff.y - 16 - r * progress * 0.6)
                .lineTo(eff.x - r * progress, eff.y - 16 + r * progress * 0.6);
        }
        return;
    }

    // 8. 🏹 궁수(Archer) 전용 액티브 스킬 (더블 샷 / 파이어 샷 / 인탱글 / 멀티 샷 / 아이스 샷 / 피어스 / 사일런스 애로우 / 스나이퍼 / 게일 샷)
    if (eff.type === 'ranger') {
        if (sName.includes("멀티 샷")) {
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, maxR * progress, 0x2dd4bf, alpha * 0.85, 2.6, 0.14);
            pts.slice(0, 24).forEach(p => {
                const d = maxR * p.distRatio * progress;
                drawSoftGlowParticle(mainG, eff.x + Math.cos(p.ang) * d, eff.y + Math.sin(p.ang) * d * tilt - 10, p.sz * 0.75, 0x5eead4, alpha, 0xffffff);
            });
        } else if (sName.includes("스나이퍼") || sName.includes("피어스")) {
            const r = sName.includes("스나이퍼") ? 72 : 58;
            const cMain = sName.includes("스나이퍼") ? 0xef4444 : 0xa855f7;
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, r * progress, cMain, alpha, 3.0, 0.18);
            mainG.lineStyle(2.2, 0xfacc15, alpha)
                .moveTo(eff.x - r, eff.y - 12).lineTo(eff.x + r, eff.y - 12)
                .moveTo(eff.x, eff.y - 12 - r * 0.6).lineTo(eff.x, eff.y - 12 + r * 0.6);
        } else if (sName.includes("인탱글")) {
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, 48 * (0.4 + progress * 0.6), 0x22c55e, alpha, 2.4, 0.18);
            for (let i = 0; i < 6; i++) {
                const a = (i * Math.PI) / 3 + progress * 2.0;
                const vx = eff.x + Math.cos(a) * 30 * progress;
                const vy = eff.y + Math.sin(a) * 30 * tilt * progress;
                mainG.lineStyle(2.8, 0x16a34a, alpha).moveTo(eff.x, eff.y + 6).lineTo(vx, vy - 32 * Math.sin(progress * Math.PI));
            }
        } else if (sName.includes("사일런스 애로우")) {
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, 54 * progress, 0x818cf8, alpha, 2.6, 0.16);
            const sr = 22;
            mainG.lineStyle(2.8, 0xc084fc, alpha)
                .moveTo(eff.x - sr, eff.y - 18 - sr * 0.6).lineTo(eff.x + sr, eff.y - 18 + sr * 0.6)
                .moveTo(eff.x + sr, eff.y - 18 - sr * 0.6).lineTo(eff.x - sr, eff.y - 18 + sr * 0.6);
        } else if (sName.includes("게일 샷")) {
            for (let k = 0; k < 3; k++) {
                drawSoftIsoEllipse(mainG, eff.x, eff.y - k * 14 * progress, (30 + k * 14) * progress, 0x2dd4bf, alpha * 0.88, 2.2, 0.10);
            }
        } else {
            const c1 = sName.includes("파이어") ? 0xf97316 : (sName.includes("아이스") ? 0x38bdf8 : 0xa3e635);
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, 50 * progress, c1, alpha, 2.6, 0.15);
            pts.slice(0, 18).forEach(p => {
                const d = 52 * p.distRatio * progress;
                drawSoftGlowParticle(mainG, eff.x + Math.cos(p.ang) * d, eff.y + Math.sin(p.ang) * d * tilt - 12, p.sz * 0.75, c1, alpha, 0xffffff);
            });
        }
        return;
    }

    // 9. 🔮 마법사(Mage) 개별 마법 이름 맞춤형 파티클 렌더러

    // [9-A] 직선 빔/브레스 마법 (콜드 빔 / 데스 레이 / 콘 오브 콜드)
    if (sName.includes("콜드 빔") || sName.includes("데스 레이") || sName.includes("콘 오브 콜드")) {
        const sx = eff.startX !== undefined ? eff.startX : (eff.casterRef?.x ?? (eff.x - 120));
        const sy = eff.startY !== undefined ? eff.startY : ((eff.casterRef?.y ?? eff.y) - 18);
        const tx = eff.x;
        const ty = eff.y - 14;
        const ang = Math.atan2(ty - sy, tx - sx);
        const isDeathRay = sName.includes("데스 레이");
        const isCone = sName.includes("콘 오브 콜드");
        const cOuter = isDeathRay ? 0xbe123c : 0x0284c7;
        const cInner = isDeathRay ? 0xf43f5e : 0x7dd3fc;

        if (isCone) {
            const coneLen = Math.max(130, Math.hypot(tx - sx, ty - sy) + 35);
            const spread = 0.44;
            mainG.lineStyle(2.0, 0xe0f2fe, alpha * 0.85);
            mainG.beginFill(0x38bdf8, alpha * 0.28);
            mainG.moveTo(sx, sy)
                .lineTo(sx + Math.cos(ang - spread) * coneLen, sy + Math.sin(ang - spread) * coneLen * 0.75)
                .lineTo(sx + Math.cos(ang + spread) * coneLen, sy + Math.sin(ang + spread) * coneLen * 0.75)
                .closePath().endFill();
        } else {
            mainG.lineStyle(12 * (1 - progress * 0.4), cOuter, alpha * 0.32).moveTo(sx, sy).lineTo(tx, ty);
            mainG.lineStyle(6 * (1 - progress * 0.3), cInner, alpha * 0.75).moveTo(sx, sy).lineTo(tx, ty);
            mainG.lineStyle(2.5, 0xffffff, alpha).moveTo(sx, sy).lineTo(tx, ty);
        }
        drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, 58 * (0.4 + progress * 0.6), cInner, alpha, 2.6, 0.16);
        return;
    }

    // [9-B] 흡수 마법 (뱀파이어 터치 / 마나 드레인)
    if (sName.includes("뱀파이어 터치") || sName.includes("마나 드레인")) {
        const isBlood = sName.includes("뱀파이어");
        const cMain = isBlood ? 0xf43f5e : 0x38bdf8;
        const cCore = isBlood ? 0xfecdd3 : 0xe0f2fe;
        const dstX = eff.casterRef?.x ?? (eff.startX ?? eff.x);
        const dstY = (eff.casterRef?.y ?? (eff.startY ?? eff.y)) - 18;

        drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, 54 * (1 - progress * 0.5), cMain, alpha, 2.4, 0.16);
        pts.slice(0, 18).forEach((p, idx) => {
            const t = Math.min(1, Math.max(0, progress * 1.25 - (idx / 18) * 0.35));
            const arcOffset = Math.sin(t * Math.PI) * 28 * (idx % 2 === 0 ? 1 : -1);
            const px = eff.x + (dstX - eff.x) * t + arcOffset * 0.5;
            const py = (eff.y - 14) + (dstY - (eff.y - 14)) * t - Math.sin(t * Math.PI) * 20;
            drawSoftGlowParticle(mainG, px, py, p.sz * 0.78, cMain, alpha, cCore);
        });
        return;
    }

    // [9-C] 화염 마법 (파이어 애로우 / 파이어 볼 / 파이어 월 / 파이어 스톰 / 이럽션 / 헬 파이어)
    if (sName.includes("파이어") || sName.includes("이럽션") || sName.includes("헬 파이어")) {
        const areaR = isAoe ? maxR : (sName.includes("헬 파이어") || sName.includes("이럽션") ? 92 : 64);
        drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, areaR * (0.35 + progress * 0.65), 0xf97316, alpha, 3.0, 0.20);

        if (sName.includes("파이어 애로우")) {
            // 화염 화살 관통 스파크
            mainG.lineStyle(3.5, 0xfef08a, alpha)
                .moveTo(eff.x - 28, eff.y - 38).lineTo(eff.x + 18, eff.y - 4);
        } else if (sName.includes("파이어 월")) {
            for (let w = 0; w < 8; w++) {
                const a = (w * Math.PI) / 4 + progress * 0.4;
                const wx = eff.x + Math.cos(a) * (areaR * 0.72);
                const wy = eff.y + Math.sin(a) * (areaR * 0.72 * tilt);
                const wh = 48 * Math.sin(progress * Math.PI);
                mainG.lineStyle(0);
                mainG.beginFill(0xea580c, alpha * 0.55).drawRoundedRect(wx - 8, wy - wh, 16, wh + 4, 6).endFill();
                mainG.beginFill(0xfef08a, alpha * 0.75).drawRoundedRect(wx - 4, wy - wh * 0.85, 8, wh * 0.85, 4).endFill();
            }
        } else if (sName.includes("이럽션") || sName.includes("헬 파이어") || sName.includes("파이어 스톰")) {
            for (let k = 0; k < 4; k++) {
                const ratio = k / 3;
                const h = ratio * 80 * Math.sin(progress * Math.PI);
                const rRing = (22 + ratio * 28) * (0.6 + progress * 0.4);
                drawSoftIsoEllipse(mainG, eff.x, eff.y - h, rRing, k % 2 === 0 ? 0xef4444 : 0xfacc15, alpha * 0.82, 2.2, 0.12);
            }
        }

        pts.slice(0, 26).forEach(p => {
            const r = areaR * p.distRatio * (isAoe ? 0.90 : progress);
            const px = eff.x + Math.cos(p.ang + progress * 1.8) * r;
            const py = eff.y + Math.sin(p.ang + progress * 1.8) * (r * tilt) - progress * 54 * p.spd;
            const col = p.spd > 1.1 ? 0xfef08a : (p.spd > 0.85 ? 0xf97316 : 0xdc2626);
            drawSoftGlowParticle(mainG, px, py, p.sz * 0.82 * (1.1 - progress * 0.3), col, alpha * 0.9, 0xffffff);
        });
        return;
    }

    // [9-D] 지상 냉기 마법 (아이스 다트 / 프로즌 클라우드 / 아이스 스파이크)
    if (sName.includes("아이스 다트") || sName.includes("프로즌 클라우드") || sName.includes("아이스 스파이크")) {
        const areaR = isAoe ? maxR : 68;
        drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, areaR * (0.4 + progress * 0.6), 0x38bdf8, alpha * 0.88, 2.6, 0.18);

        if (sName.includes("프로즌 클라우드")) {
            // 차가운 서리 구름 안개와 눈꽃 입자
            mainG.lineStyle(0);
            mainG.beginFill(0xbae6fd, alpha * 0.25).drawEllipse(eff.x, eff.y - 36, areaR * 0.75, areaR * 0.35).endFill();
        } else {
            // 아이스 다트 / 아이스 스파이크: 대지에서 솟아오르는 얼음 가시
            const spikeCount = sName.includes("스파이크") ? 7 : 3;
            for (let i = 0; i < spikeCount; i++) {
                const p = pts[i * 3] || pts[0];
                const sx = eff.x + (spikeCount > 3 ? Math.cos(p.ang) * (areaR * 0.72 * p.distRatio) : (i - 1) * 16);
                const sy = eff.y + (spikeCount > 3 ? Math.sin(p.ang) * (areaR * 0.72 * p.distRatio * tilt) : 0);
                const sh = (sName.includes("스파이크") ? 44 : 26) * Math.sin(progress * Math.PI);
                mainG.lineStyle(1.4, 0xffffff, alpha);
                mainG.beginFill(0x7dd3fc, alpha * 0.82);
                mainG.moveTo(sx - 6, sy).lineTo(sx, sy - sh).lineTo(sx + 6, sy).closePath().endFill();
            }
        }
        pts.slice(0, 20).forEach(p => {
            const swirlAng = p.ang + progress * 3.5;
            const r = areaR * p.distRatio;
            drawDiamondSparkle(mainG, eff.x + Math.cos(swirlAng) * r, eff.y + Math.sin(swirlAng) * (r * tilt) - progress * 24, p.sz * 1.1, 0xe0f2fe, alpha * 0.88);
        });
        return;
    }

    // [9-E] 대지 감옥 & 속박 마법 (어스 재일 / 어스 바인드)
    if (sName.includes("어스 재일") || sName.includes("어스 바인드")) {
        const areaR = 64;
        drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, areaR * (0.45 + progress * 0.55), 0xd97706, alpha, 3.0, 0.22);
        // 타겟 주변을 가두는 6개의 암석 기둥 창살
        for (let i = 0; i < 6; i++) {
            const a = (i * Math.PI) / 3;
            const rx = eff.x + Math.cos(a) * 34;
            const ry = eff.y + Math.sin(a) * 34 * tilt;
            const rh = 42 * Math.sin(progress * Math.PI);
            mainG.lineStyle(1.5, 0xfef08a, alpha * 0.8);
            mainG.beginFill(0x92400e, alpha * 0.88).drawRoundedRect(rx - 5, ry - rh, 10, rh + 2, 3).endFill();
        }
        return;
    }

    // [9-F] 상태이상 / 저주 / 시간 마법 (커스 포이즌 / 블라인드 / 슬립 / 포그 오브 슬리핑 / 커스 파럴라이즈 / 사일런스 / 웨폰 브레이크 / 캔슬레이션 / 디스펠 매직 / 타임 스탑)
    if (
        sName.includes("포이즌") || sName.includes("블라인드") || sName.includes("슬립") || sName.includes("슬리핑") ||
        sName.includes("파럴라이즈") || sName.includes("사일런스") || sName.includes("브레이크") ||
        sName.includes("캔슬") || sName.includes("디스펠") || sName.includes("타임 스탑")
    ) {
        const areaR = isAoe ? maxR : 62;
        if (sName.includes("포이즌")) {
            // 커스 포이즌: 보글거리는 맹독 늪 & 초록 독 방울 상승
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, areaR * (0.5 + progress * 0.5), 0x22c55e, alpha * 0.85, 2.4, 0.20);
            pts.slice(0, 18).forEach(p => {
                const r = areaR * 0.7 * p.distRatio;
                const px = eff.x + Math.cos(p.ang) * r;
                const py = eff.y + Math.sin(p.ang) * r * tilt - progress * 42 * p.spd;
                drawSoftGlowParticle(mainG, px, py, p.sz * 0.85, 0x4ade80, alpha, 0xd9f99d);
            });
        } else if (sName.includes("블라인드")) {
            // 블라인드: 시야를 가리는 칠흑의 암흑 안개 링
            mainG.lineStyle(0);
            mainG.beginFill(0x0f172a, alpha * 0.65).drawEllipse(eff.x, eff.y - 22, 38, 26).endFill();
            drawSoftIsoEllipse(mainG, eff.x, eff.y - 22, 36 * (0.6 + progress * 0.4), 0x9333ea, alpha, 2.5, 0.15);
        } else if (sName.includes("슬립") || sName.includes("슬리핑")) {
            // 슬립 / 포그 오브 슬리핑: 몽환적인 연보라 수면 안개와 별빛 입자
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, areaR * (0.5 + progress * 0.5), 0x818cf8, alpha * 0.75, 2.0, 0.16);
            pts.slice(0, 16).forEach(p => {
                const px = eff.x + Math.cos(p.ang + progress * 1.5) * (areaR * 0.65 * p.distRatio);
                const py = eff.y - 16 + Math.sin(p.ang) * (areaR * 0.65 * p.distRatio * tilt) - progress * 34;
                drawDiamondSparkle(mainG, px, py, p.sz * 1.1, 0xe0e7ff, alpha * 0.9);
            });
        } else if (sName.includes("파럴라이즈")) {
            // 커스 파럴라이즈: 몸을 휘감는 자색 마비 전류 사슬
            drawSoftIsoEllipse(mainG, eff.x, eff.y - 12, 36, 0xfacc15, alpha, 2.4, 0.12);
            drawSoftIsoEllipse(mainG, eff.x, eff.y - 26, 30, 0xa855f7, alpha, 2.4, 0.12);
        } else if (sName.includes("웨폰 브레이크")) {
            // 웨폰 브레이크: 금속 파열 스파크 & 교차 균열선
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, 52 * progress, 0xf97316, alpha, 2.6, 0.15);
            mainG.lineStyle(3.2, 0xe2e8f0, alpha)
                .moveTo(eff.x - 22, eff.y - 34).lineTo(eff.x + 22, eff.y - 6)
                .moveTo(eff.x + 18, eff.y - 36).lineTo(eff.x - 18, eff.y - 4);
        } else if (sName.includes("타임 스탑")) {
            // 타임 스탑: 2.5D 황금 시계판과 정지된 시침/분침
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, areaR * (0.4 + progress * 0.6), 0x2dd4bf, alpha, 3.0, 0.18);
            const handAng1 = progress * 1.6;
            const handAng2 = -Math.PI / 2;
            mainG.lineStyle(3.2, 0xfde047, alpha)
                .moveTo(eff.x, eff.y + 2).lineTo(eff.x + Math.cos(handAng1) * areaR * 0.72, eff.y + 2 + Math.sin(handAng1) * areaR * 0.72 * tilt)
                .moveTo(eff.x, eff.y + 2).lineTo(eff.x + Math.cos(handAng2) * areaR * 0.52, eff.y + 2 + Math.sin(handAng2) * areaR * 0.52 * tilt);
        } else {
            // 사일런스 / 캔슬레이션 / 디스펠 매직: 마력 해제 은빛·자수정 파동
            const cClean = sName.includes("사일런스") ? 0xc084fc : 0x7dd3fc;
            drawSoftIsoEllipse(mainG, eff.x, eff.y + 2, areaR * progress, cClean, alpha * 0.85, 2.4, 0.14);
            drawDiamondSparkle(mainG, eff.x, eff.y - 20, 22 * Math.sin(progress * Math.PI), 0xffffff, alpha);
        }
        return;
    }

    // [9-G] 윈드 컷 (초승달 바람 칼날 교차 베기) & 에너지 볼트 (순수 마력 구체 폭발)
    const areaR = isAoe ? maxR : 60;
    const isWind = sName.includes("윈드");
    const cMain = isWind ? 0x10b981 : 0x38bdf8;
    const cSub  = isWind ? 0xa7f3d0 : 0xc084fc;
    drawSoftIsoEllipse(mainG, eff.x, eff.y + 4, areaR * progress, cMain, alpha, 2.6, 0.16);
    if (isWind) {
        const sl = 34 * Math.sin(progress * Math.PI);
        mainG.lineStyle(3.0, 0xa7f3d0, alpha)
            .moveTo(eff.x - sl, eff.y - 16 - sl * 0.5).lineTo(eff.x + sl, eff.y - 16 + sl * 0.5)
            .moveTo(eff.x + sl, eff.y - 16 - sl * 0.5).lineTo(eff.x - sl, eff.y - 16 + sl * 0.5);
    }
    pts.slice(0, 20).forEach(p => {
        const r = areaR * p.distRatio * progress;
        const px = eff.x + Math.cos(p.ang + progress * 3.2) * r;
        const py = eff.y + Math.sin(p.ang + progress * 3.2) * (r * tilt) - Math.sin(progress * Math.PI) * 22 * p.spd;
        drawSoftGlowParticle(mainG, px, py, p.sz * 0.75, cMain, alpha * 0.9, cSub);
    });
}
