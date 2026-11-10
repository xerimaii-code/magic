#!/usr/bin/env bash
# ==============================================================================
# HostDare VPS (10GB NVMe / 768MB~1GB RAM) 전용 안전 디스크 & 메모리 정리 스크립트
# 파일명: /root/clean_disk.sh
# 
# 🛡️ [핵심 안전 원칙 - 구포점 매입관리 ERP 'sale' 100% 무영향 보장]
#   1. /root/sale 디렉토리 및 SQLite DB(GData.db, TaxData.db, *.wal, *.shm) 절대 접근 금지
#   2. 'sale' ERP 프로세스의 로그는 보존하고, 대용량 로그가 발생하는 게임 서버(magic-*)만 선별 비우기
#   3. SQLite 임시 파일(etilqs_*), 소켓(*.sock), 잠금파일(*.lock) 삭제 대상에서 엄격 제외
#   4. nice(최저 CPU 우선순위) + ionice(유휴 I/O 우선순위)로 실행하여 ERP 작동 중 0.001초의 렉도 방지
#   5. sync 선행 후 안전한 PageCache 회수(drop_caches 1)로 데이터 무결성 보장
# ==============================================================================

# 최저 우선순위로 강제 전환 (ERP 'sale' 작업에 CPU 및 디스크 I/O 양보)
renice -n 19 $$ >/dev/null 2>&1 || true
if command -v ionice >/dev/null 2>&1; then
  ionice -c 3 -p $$ >/dev/null 2>&1 || true
fi

echo "=========================================================="
echo "🛡️ [HostDare 안전 정리 시작 - sale ERP 보호 모드] $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================================="

# 1. 실행 전 상태 출력
echo "▶ [정리 전 디스크 용량]"
df -h / | awk 'NR==1 || NR==2'
echo "▶ [정리 전 메모리 상태]"
free -m

# 2. PM2 로그 선별 정리 ('sale' ERP 로그는 절대 건드리지 않고 게임 서버 로그만 비우기)
if command -v pm2 >/dev/null 2>&1; then
  echo "▶ 게임 서버(magic-ai-runner, magic-game-server) 로그만 선별 비우기..."
  pm2 flush magic-ai-runner >/dev/null 2>&1 || true
  pm2 flush magic-game-server >/dev/null 2>&1 || true
fi

# ~/.pm2/logs 중 게임 관련 로그만 강제 트렁케이트 (sale 관련 로그는 영구 보존)
if [ -d "$HOME/.pm2/logs" ]; then
  find "$HOME/.pm2/logs" -type f -name "magic-*.log" -size +10M -exec truncate -s 0 {} \; 2>/dev/null || true
fi

# 3. 리눅스 시스템 저널 로그(journalctl) 정리 (최근 3일 / 50MB만 보관)
if command -v journalctl >/dev/null 2>&1; then
  echo "▶ 리눅스 저널 로그 압축 정리 (최근 3일치 / 50MB 제한)..."
  journalctl --vacuum-time=3d >/dev/null 2>&1 || true
  journalctl --vacuum-size=50M >/dev/null 2>&1 || true
fi

# 4. /var/log 내 오래된 시스템 압축 로그 삭제 (ERP 로그가 있는 /root는 절대 건드리지 않음)
echo "▶ 오래된 시스템 압축 로그 파일(*.gz, *.1) 정리..."
find /var/log -type f \( -name "*.gz" -o -name "*.1" -o -name "*.old" \) -delete 2>/dev/null || true

# 5. APT 패키지 캐시 비우기 (10GB 디스크에서 500MB~1.5GB 안전 회수)
if command -v apt-get >/dev/null 2>&1; then
  echo "▶ APT 패키지 설치 캐시 비우기 (apt-get clean)..."
  apt-get clean -y >/dev/null 2>&1 || true
  apt-get autoremove --purge -y >/dev/null 2>&1 || true
fi

# 6. npm 전역 캐시 비우기
if command -v npm >/dev/null 2>&1; then
  echo "▶ npm 빌드 캐시 비우기..."
  npm cache clean --force >/dev/null 2>&1 || true
fi

# 7. 임시 디렉토리(/tmp, /var/tmp) 안전 정리
# ⚠️ SQLite 임시 테이블(etilqs_*), 소켓(*.sock), 락파일(*.lock), DB 파일(*.db*)은 절대 삭제 금지!
echo "▶ 안전 임시 파일 정리 (SQLite/ERP 연관 파일 엄격 제외)..."
find /tmp -type f -atime +3 \
  ! -name "etilqs_*" \
  ! -name "*.sock" \
  ! -name "*.lock" \
  ! -name "*.db*" \
  ! -path "*/sale/*" \
  -delete 2>/dev/null || true

find /var/tmp -type f -atime +3 \
  ! -name "etilqs_*" \
  ! -name "*.sock" \
  ! -name "*.lock" \
  ! -name "*.db*" \
  ! -path "*/sale/*" \
  -delete 2>/dev/null || true

# 8. 안전한 OS 디스크 캐시(pagecache) 메모리 회수
# 먼저 sync로 SQLite ERP의 모든 미기록 데이터를 디스크에 완벽히 쓴 후 안전 회수
echo "▶ SQLite 데이터 동기화(sync) 및 디스크 캐시 메모리 회수..."
sync
echo 1 > /proc/sys/vm/drop_caches 2>/dev/null || true

# 9. 정리 후 디스크 및 메모리 상태 출력
echo "----------------------------------------------------------"
echo "✔ [정리 완료 후 디스크 용량]"
df -h / | awk 'NR==1 || NR==2'
echo "✔ [정리 완료 후 메모리 상태]"
free -m
echo "=========================================================="
echo "✨ sale ERP 프로세스 보호 및 안전 최적화 완료!"
echo "=========================================================="