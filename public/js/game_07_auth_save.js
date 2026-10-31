// js/game_07_auth_save.js — 온라인 전용 로그인/회원가입 · 이메일 자동저장 · 캐릭터 3슬롯 · 백그라운드 보호
window.showSystemAlertModal = function(title, body, buttonsHtml = null) {
  const modal = document.getElementById('system-alert-modal');
  const titleEl = document.getElementById('sys-alert-title');
  const bodyEl = document.getElementById('sys-alert-body');
  const btnsEl = document.getElementById('sys-alert-btns');
  if (!modal || !titleEl || !bodyEl || !btnsEl) return;
  titleEl.innerText = title || '알림';
  bodyEl.innerText = body || '';
  btnsEl.innerHTML = buttonsHtml || `<button type="button" class="auth-primary-btn" style="flex:1;" onclick="closeSystemAlertModal()">확인</button>`;
  modal.style.display = 'flex';
};

window.closeSystemAlertModal = function() {
  const modal = document.getElementById('system-alert-modal');
  if (modal) modal.style.display = 'none';
};

// 💾 이메일 아이디 자동저장 & 새로고침 즉시 복원 헬퍼
window.restoreRememberedEmailToInput = function() {
  try {
    const emailInp = document.getElementById('auth-email');
    const remChk = document.getElementById('auth-remember-id');
    const savedPref = localStorage.getItem('MAGIC_REMEMBER_ID_PREF');
    const savedEmail = (localStorage.getItem('MAGIC_REMEMBERED_EMAIL') || '').trim();
    const isRememberOn = (savedPref !== 'false');

    if (remChk) {
      remChk.checked = isRememberOn;
    }
    if (emailInp && isRememberOn && savedEmail) {
      emailInp.value = savedEmail;
    }
  } catch (e) {}
};

window.onRememberEmailToggle = function() {
  try {
    const emailInp = document.getElementById('auth-email');
    const remChk = document.getElementById('auth-remember-id');
    if (!remChk) return;
    if (remChk.checked) {
      localStorage.setItem('MAGIC_REMEMBER_ID_PREF', 'true');
      const curVal = (emailInp?.value || '').trim().toLowerCase();
      if (curVal) {
        localStorage.setItem('MAGIC_REMEMBERED_EMAIL', curVal);
      }
    } else {
      localStorage.setItem('MAGIC_REMEMBER_ID_PREF', 'false');
      localStorage.removeItem('MAGIC_REMEMBERED_EMAIL');
    }
  } catch (e) {}
};

// 스크립트 로드 즉시 1차 복원 실행
window.restoreRememberedEmailToInput();

// 1) 로그인 / 회원가입 탭 전환
window.switchAuthMode = function(mode) {
  currentAuthMode = mode === 'signup' ? 'signup' : 'login';
  const loginTab = document.getElementById('tab-login-btn');
  const signupTab = document.getElementById('tab-signup-btn');
  const checkBtn = document.getElementById('btn-check-email');
  const confirmWrap = document.getElementById('signup-confirm-wrap');
  const rememberWrap = document.getElementById('remember-id-wrap');
  const submitBtn = document.getElementById('auth-action-btn');
  const emailMsg = document.getElementById('auth-email-msg');
  const statusMsg = document.getElementById('auth-status-msg');

  if (loginTab) loginTab.classList.toggle('active', currentAuthMode === 'login');
  if (signupTab) signupTab.classList.toggle('active', currentAuthMode === 'signup');
  if (checkBtn) checkBtn.style.display = currentAuthMode === 'signup' ? 'inline-block' : 'none';
  if (confirmWrap) confirmWrap.style.display = currentAuthMode === 'signup' ? 'block' : 'none';
  if (rememberWrap) rememberWrap.style.display = currentAuthMode === 'login' ? 'flex' : 'none';
  if (submitBtn) submitBtn.innerText = currentAuthMode === 'signup' ? '신규 계정 생성 (회원가입)' : '로그인';
  if (emailMsg) emailMsg.innerText = '';
  if (statusMsg && isSupabaseOnlineVerified) statusMsg.innerText = '';
  verifiedSignupEmail = null;

  if (currentAuthMode === 'login') {
    window.restoreRememberedEmailToInput();
  }
};

window.onAuthEmailInput = function() {
  verifiedSignupEmail = null;
  const emailInp = document.getElementById('auth-email');
  const remChk = document.getElementById('auth-remember-id');
  const emailMsg = document.getElementById('auth-email-msg');

  // 이메일 입력 즉시 '이메일 아이디 기억하기'가 체크되어 있으면 실시간 자동 저장 (새로고침 시에도 절대 증발하지 않음!)
  try {
    if (!remChk || remChk.checked) {
      const val = (emailInp?.value || '').trim().toLowerCase();
      if (val) {
        localStorage.setItem('MAGIC_REMEMBERED_EMAIL', val);
        localStorage.setItem('MAGIC_REMEMBER_ID_PREF', 'true');
      }
    }
  } catch (e) {}

  if (emailMsg && currentAuthMode === 'signup') {
    emailMsg.style.color = '#9ca3af';
    emailMsg.innerText = '이메일 중복확인을 진행해주세요.';
  }
};

// 🧹 브라우저 로컬 캐시 완전 초기화 헬퍼 (로그인 시 로컬 데이터를 무조건 무시하고 수파베이스 데이터로 덮어쓰기 위함)
function purgeBrowserLocalGameCache() {
  try {
    const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
    const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
    const storageTable = GameDB.SupabaseConfig?.tables?.storage || 'magic_storage';
    localStorage.removeItem(`MAGIC_DB_${accTable}`);
    localStorage.removeItem(`MAGIC_DB_${charTable}`);
    localStorage.removeItem(`MAGIC_DB_${storageTable}`);
  } catch (e) {}
}

let slotScreenRealtimeSub = null;
let slotScreenPollTimer = null;

function startSlotScreenRealtimeSync() {
  stopSlotScreenRealtimeSync();
  if (!currentAccountUser) return;
  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';

  // 1) Supabase Realtime 구독으로 다른 기기에서 캐릭터 생성/삭제 시 슬롯 화면 실시간 자동 갱신
  if (isSupabaseRemoteConnected && supabaseClient) {
    try {
      slotScreenRealtimeSub = supabaseClient
        .channel(`magic_slot_watch_${currentAccountUser.id}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: charTable, filter: `user_id=eq.${currentAccountUser.id}` },
          async () => {
            if (!isGameSessionActive && currentAccountUser) {
              await loadAccountCharacterSlots(true);
              renderCharacterSlots();
            }
          }
        )
        .subscribe();
    } catch (e) {}
  }

  // 2) 15초 주기 서버 폴링으로 선택 대기 상태에서도 데이터 소모를 아끼면서 수파베이스 최신 슬롯 상태 유지 (Realtime 구독 병행)
  slotScreenPollTimer = setInterval(async () => {
    if (!isGameSessionActive && !document.hidden && currentAccountUser && document.getElementById('slot-box')?.style.display !== 'none') {
      await loadAccountCharacterSlots(true);
      renderCharacterSlots();
    }
  }, 30000);
}

function stopSlotScreenRealtimeSync() {
  if (slotScreenPollTimer) {
    clearInterval(slotScreenPollTimer);
    slotScreenPollTimer = null;
  }
  if (slotScreenRealtimeSub && supabaseClient) {
    try { supabaseClient.removeChannel(slotScreenRealtimeSub); } catch (e) {}
    slotScreenRealtimeSub = null;
  }
}

window.refreshCharacterSlotsIfWaiting = async function() {
  if (!isGameSessionActive && currentAccountUser) {
    await loadAccountCharacterSlots(true);
    await loadAccountSharedStorage(true);
    renderCharacterSlots();
  }
};

window.refreshCharacterSlotsRealtime = async function() {
  if (window.isUiTouchDebounced?.('refreshCharacterSlotsRealtime', 300)) return;
  await window.refreshCharacterSlotsIfWaiting();
};

// 2) 회원가입 시 이메일 중복 체크 (오직 중앙 서버 + 수파베이스 DB 실시간 검증만 수행, 로컬 캐시 무시!)
window.checkEmailDuplicate = async function() {
  const emailRaw = (document.getElementById('auth-email')?.value || '').trim().toLowerCase();
  const emailMsg = document.getElementById('auth-email-msg');
  const badge = document.getElementById('db-conn-badge');
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // 온리 온라인(🟢) 상태에서만 중복확인 및 회원가입 허용 (황색/적색 절대 불가)
  if (!isSupabaseOnlineVerified || !badge || !badge.classList.contains('online')) {
    const recheck = await initSupabaseConnection();
    if (!recheck || !isSupabaseOnlineVerified || !badge?.classList.contains('online')) {
      if (emailMsg) {
        emailMsg.style.color = '#f87171';
        emailMsg.innerText = '⚠️ 수파베이스 온라인(🟢) 연결 상태에서만 회원가입이 가능합니다.';
      }
      return false;
    }
  }

  if (!emailRegex.test(emailRaw)) {
    if (emailMsg) {
      emailMsg.style.color = '#f87171';
      emailMsg.innerText = '⚠️ 올바른 이메일 형식을 입력해주세요.';
    }
    return false;
  }

  const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
  let exists = false;
  let verifiedRemote = false;

  // A. 중앙 서버(magic_server.js -> Supabase) 실시간 중복 조회
  const srvCheck = await callCentralServerApi('/api/auth/check-email', 'POST', { email: emailRaw });
  if (srvCheck && !srvCheck.error) {
    verifiedRemote = true;
    if (srvCheck.exists) exists = true;
  }

  // B. Supabase magic_accounts 테이블 직접 실시간 조회
  if (isSupabaseRemoteConnected && supabaseClient) {
    const { data, error } = await supabaseClient
      .from(accTable)
      .select('email')
      .ilike('email', emailRaw)
      .limit(1);
    if (!error) {
      verifiedRemote = true;
      if (Array.isArray(data) && data.length > 0) exists = true;
    }
  }

  if (!verifiedRemote) {
    if (emailMsg) {
      emailMsg.style.color = '#f87171';
      emailMsg.innerText = '⚠️ 수파베이스 서버와 통신할 수 없습니다. 네트워크를 확인해주세요.';
    }
    return false;
  }

  if (exists) {
    verifiedSignupEmail = null;
    if (emailMsg) {
      emailMsg.style.color = '#f87171';
      emailMsg.innerText = '⚠️ 이미 수파베이스에 등록된 이메일 계정입니다.';
    }
    return false;
  }

  verifiedSignupEmail = emailRaw;
  if (emailMsg) {
    emailMsg.style.color = '#4ade80';
    emailMsg.innerText = '✅ 사용 가능한 이메일 계정입니다! (서버 검증 완료)';
  }
  return true;
};

// 3) 로그인 / 회원가입 실행 (브라우저 로컬 데이터 완전 무시 · 무조건 수파베이스 DB 실시간 검증 및 업데이트!)
window.handleAuthSubmit = async function() {
  if (window.isUiTouchDebounced?.('handleAuthSubmit', 400)) return;
  window.tryEnterFullscreenMode?.();

  const emailRaw = (document.getElementById('auth-email')?.value || '').trim().toLowerCase();
  const password = document.getElementById('auth-password')?.value || '';
  const passwordConfirm = document.getElementById('auth-password-confirm')?.value || '';
  const rememberChk = document.getElementById('auth-remember-id')?.checked;
  const statusMsg = document.getElementById('auth-status-msg');
  const badge = document.getElementById('db-conn-badge');

  // 🛑 온리 온라인(🟢) 강제 검증: 황색(점검중)이거나 적색(오프라인)이면 로그인·회원가입 절대 불가!
  if (!isSupabaseOnlineVerified || !badge || !badge.classList.contains('online')) {
    if (statusMsg) {
      statusMsg.style.color = '#fde047';
      statusMsg.innerText = '⏳ 수파베이스 온라인 연결 상태를 확인하고 있습니다...';
    }
    const onlineNow = await initSupabaseConnection();
    if (!onlineNow || !isSupabaseOnlineVerified || !badge?.classList.contains('online')) {
      if (statusMsg) {
        statusMsg.style.color = '#f87171';
        statusMsg.innerText = '⚠️ 수파베이스 온라인(🟢) 상태에서만 로그인 및 회원가입이 가능합니다.';
      }
      return;
    }
  }

  if (!emailRaw || !password) {
    if (statusMsg) {
      statusMsg.style.color = '#f87171';
      statusMsg.innerText = '⚠️ 이메일과 비밀번호를 모두 입력해주세요.';
    }
    return;
  }
  if (password.length < 6) {
    if (statusMsg) {
      statusMsg.style.color = '#f87171';
      statusMsg.innerText = '⚠️ 비밀번호는 6자리 이상이어야 합니다.';
    }
    return;
  }

  const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
  const pwHash = encodePasswordHash(emailRaw, password);
  const legacyB64 = btoa(unescape(encodeURIComponent(password)));

  // 로그인/회원가입 시작 즉시 브라우저의 기존 로컬 DB 캐시를 모두 폐기하여 로컬 데이터 간섭을 100% 차단!
  purgeBrowserLocalGameCache();

  if (currentAuthMode === 'signup') {
    if (password !== passwordConfirm) {
      if (statusMsg) {
        statusMsg.style.color = '#f87171';
        statusMsg.innerText = '⚠️ 비밀번호와 비밀번호 확인이 일치하지 않습니다.';
      }
      return;
    }

    // 회원가입 버튼 클릭 시에도 실시간 중복 여부 재검증
    const ok = await window.checkEmailDuplicate();
    if (!ok) return;

    if (statusMsg) {
      statusMsg.style.color = '#93c5fd';
      statusMsg.innerText = '⏳ 수파베이스 서버에 실시간 계정을 등록하고 있습니다...';
    }

    let uid = generateValidUUID();
    let registeredInSupabase = false;

    // A. 중앙 서버(magic_server.js) 회원가입 요청
    const srvSignup = await callCentralServerApi('/api/auth/signup', 'POST', {
      user_id: uid,
      email: emailRaw,
      password,
      pw_hash: pwHash
    });
    if (srvSignup && srvSignup.error) {
      if (statusMsg) {
        statusMsg.style.color = '#f87171';
        statusMsg.innerText = `⚠️ ${srvSignup.error}`;
      }
      return;
    }
    if (srvSignup && srvSignup.ok && srvSignup.user?.id && isValidUUID(srvSignup.user.id)) {
      uid = srvSignup.user.id;
      registeredInSupabase = true;
    }

    // B. Supabase Auth & magic_accounts 테이블 직접 등록 검증
    if (isSupabaseRemoteConnected && supabaseClient) {
      try {
        const { data } = await supabaseClient.auth.signUp({
          email: emailRaw,
          password: password
        });
        if (data?.user?.id && isValidUUID(data.user.id)) {
          uid = data.user.id;
        }
      } catch (e) {}

      const { error: upErr } = await supabaseClient.from(accTable).upsert({
        user_id: uid,
        email: emailRaw,
        active_session_token: buildAccountTokenString(pwHash, ''),
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      if (!upErr) registeredInSupabase = true;
    }

    if (!registeredInSupabase) {
      if (statusMsg) {
        statusMsg.style.color = '#f87171';
        statusMsg.innerText = '⚠️ 수파베이스 DB 계정 등록에 실패했습니다. 로컬 임시 생성은 차단됩니다.';
      }
      return;
    }

    const createdUser = { id: uid, email: emailRaw };
    currentAccountUser = createdUser;
    try { localStorage.setItem('MAGIC_REMEMBERED_EMAIL', emailRaw); } catch (e) {}
    await onAccountLoginSuccess(createdUser);
    return;
  }

  // ==============================
  // 🔐 로그인 모드 (로컬 데이터 완전 무시 · 무조건 수파베이스 검증 및 최신 데이터 강제 업데이트)
  // ==============================
  if (statusMsg) {
    statusMsg.style.color = '#93c5fd';
    statusMsg.innerText = '⏳ 수파베이스 서버 인증 및 최신 데이터 동기화 중...';
  }

  let loggedUser = null;

  // 1순위: 중앙 서버(magic_server.js -> Supabase) 인증
  const srvLogin = await callCentralServerApi('/api/auth/login', 'POST', {
    email: emailRaw,
    password,
    pw_hash: pwHash
  });
  if (srvLogin && srvLogin.ok && srvLogin.user) {
    loggedUser = { id: srvLogin.user.id, email: emailRaw };
  } else if (srvLogin && srvLogin.error && srvLogin.error.includes('비밀번호')) {
    if (statusMsg) {
      statusMsg.style.color = '#f87171';
      statusMsg.innerText = `⚠️ ${srvLogin.error} ([🔑 비번 재설정]으로 변경 가능)`;
    }
    return;
  }

  // 2순위: Supabase magic_accounts 테이블 직접 실시간 검증
  if (!loggedUser && isSupabaseRemoteConnected && supabaseClient) {
    const { data: accRows } = await supabaseClient
      .from(accTable)
      .select('*')
      .ilike('email', emailRaw)
      .limit(1);

    if (Array.isArray(accRows) && accRows.length > 0) {
      const row = accRows[0];
      const parsedTok = parseAccountTokenString(row.active_session_token);
      if (parsedTok.pwHash) {
        const storedPrefix = String(parsedTok.pwHash).split('_')[0];
        const inputPrefix = String(pwHash).split('_')[0];
        if (
          parsedTok.pwHash === pwHash ||
          parsedTok.pwHash === legacyB64 ||
          parsedTok.pwHash === password ||
          (storedPrefix && storedPrefix.length >= 16 && storedPrefix === inputPrefix)
        ) {
          loggedUser = { id: row.user_id, email: emailRaw };
        } else {
          if (statusMsg) {
            statusMsg.style.color = '#f87171';
            statusMsg.innerText = '⚠️ 비밀번호가 일치하지 않습니다. (우측 하단 [🔑 비번 재설정]으로 즉시 변경 가능)';
          }
          return;
        }
      } else {
        // 초기 시딩 계정 등 active_session_token에 pwHash가 비어있는 경우 입력한 비밀번호로 즉시 해시 등록 후 로그인 허용
        const newTok = buildAccountTokenString(pwHash, parsedTok.sessionToken || '');
        try {
          await supabaseClient
            .from(accTable)
            .update({ active_session_token: newTok, updated_at: new Date().toISOString() })
            .eq('user_id', row.user_id);
        } catch (e) {}
        loggedUser = { id: row.user_id, email: emailRaw };
      }
    }

    if (!loggedUser) {
      const { data: authData, error: authErr } = await supabaseClient.auth.signInWithPassword({
        email: emailRaw,
        password: password
      });
      if (!authErr && authData?.user) {
        loggedUser = { id: authData.user.id, email: emailRaw };
      }
    }
  }

  if (!loggedUser) {
    if (statusMsg) {
      statusMsg.style.color = '#f87171';
      statusMsg.innerText = '⚠️ 수파베이스에 등록되지 않은 이메일이거나 비밀번호가 일치하지 않습니다.';
    }
    return;
  }

  if (rememberChk !== false) {
    try {
      localStorage.setItem('MAGIC_REMEMBERED_EMAIL', emailRaw);
      localStorage.setItem('MAGIC_REMEMBER_ID_PREF', 'true');
    } catch (e) {}
  } else {
    try {
      localStorage.setItem('MAGIC_REMEMBER_ID_PREF', 'false');
      localStorage.removeItem('MAGIC_REMEMBERED_EMAIL');
    } catch (e) {}
  }

  await onAccountLoginSuccess(loggedUser);
};

async function onAccountLoginSuccess(userObj) {
  // 로그인 성공 시 브라우저 로컬 데이터를 모두 비우고 무조건 수파베이스 데이터로 최신 업데이트!
  purgeBrowserLocalGameCache();
  currentAccountUser = userObj;
  try {
    localStorage.setItem('MAGIC_ACTIVE_USER', JSON.stringify(userObj));
  } catch (e) {}

  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('slot-box').style.display = 'block';
  const infoTxt = document.getElementById('user-info-text');
  if (infoTxt) infoTxt.innerText = userObj.email;

  await loadAccountSharedStorage(true);
  await loadAccountCharacterSlots(true);
  renderCharacterSlots();
  startSlotScreenRealtimeSync();
}

// 4) 계정 공유 창고(magic_storage) 로드 및 저장 (수파베이스 서버 우선 일원화)
async function loadAccountSharedStorage(forceRemote = true) {
  if (!currentAccountUser) return;
  const storageTable = GameDB.SupabaseConfig?.tables?.storage || 'magic_storage';
  const maxSlots = GameDB.SupabaseConfig?.maxStorageSlots || 60;
  let loadedGold = 0;
  let loadedItems = Array(maxSlots).fill(null);
  let loadedFromRemote = false;

  // A. 수파베이스 직접 조회 최우선
  if (isSupabaseRemoteConnected && supabaseClient) {
    const { data, error } = await supabaseClient
      .from(storageTable)
      .select('*')
      .eq('user_id', currentAccountUser.id)
      .maybeSingle();
    if (!error && data) {
      loadedGold = Number(data.bank_gold) || 0;
      if (Array.isArray(data.bank_items)) {
        loadedItems = data.bank_items.slice(0, maxSlots);
        while (loadedItems.length < maxSlots) loadedItems.push(null);
      }
      loadedFromRemote = true;
    } else if (!error && !data) {
      await supabaseClient.from(storageTable).upsert({
        user_id: currentAccountUser.id,
        bank_gold: 0,
        bank_items: loadedItems,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' });
      loadedFromRemote = true;
    }
  }

  // B. 중앙 서버 조회
  if (!loadedFromRemote) {
    const srvSt = await callCentralServerApi(`/api/storage/${encodeURIComponent(currentAccountUser.id)}`, 'GET');
    if (srvSt && srvSt.storage) {
      loadedGold = Number(srvSt.storage.bank_gold) || 0;
      if (Array.isArray(srvSt.storage.bank_items)) {
        loadedItems = srvSt.storage.bank_items.slice(0, maxSlots);
        while (loadedItems.length < maxSlots) loadedItems.push(null);
      }
      loadedFromRemote = true;
    }
  }

  window.accountStorage = {
    bankGold: loadedGold,
    bankItems: loadedItems
  };
  player.bankGold = loadedGold;
}

async function saveAccountSharedStorage() {
  if (!currentAccountUser || !window.accountStorage) return;
  const storageTable = GameDB.SupabaseConfig?.tables?.storage || 'magic_storage';
  const payload = {
    user_id: currentAccountUser.id,
    bank_gold: Number(window.accountStorage.bankGold) || 0,
    bank_items: window.accountStorage.bankItems || [],
    updated_at: new Date().toISOString()
  };

  callCentralServerApi('/api/storage/save', 'POST', payload);

  if (isSupabaseRemoteConnected && supabaseClient) {
    await supabaseClient.from(storageTable).upsert(payload, { onConflict: 'user_id' });
  }
}

// 5) 캐릭터 3슬롯(magic_characters) 실시간 수파베이스 조회 (로컬 데이터 무시, 무조건 서버 데이터 기준)
async function loadAccountCharacterSlots(forceRemote = true) {
  accountCharacters = [null, null, null];
  if (!currentAccountUser) return;
  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';

  let rows = null;

  // A. 중앙 서버(magic_server.js -> Supabase + 실시간 캐릭터 온라인 접속 여부 포함) 조회
  const srvChars = await callCentralServerApi(`/api/characters/${encodeURIComponent(currentAccountUser.id)}`, 'GET');
  if (srvChars && Array.isArray(srvChars.characters)) {
    rows = srvChars.characters;
  }

  // B. Supabase magic_characters 실시간 직접 조회 폴백
  if (rows === null && isSupabaseRemoteConnected && supabaseClient) {
    const { data, error } = await supabaseClient
      .from(charTable)
      .select('*')
      .eq('user_id', currentAccountUser.id)
      .lt('slot_index', 100)
      .order('slot_index', { ascending: true });
    if (!error && Array.isArray(data)) {
      rows = data;
    }
  }

  if (Array.isArray(rows)) {
    rows.forEach(r => {
      const sIdx = Number(r.slot_index);
      if (sIdx >= 0 && sIdx < 3 && !accountCharacters[sIdx]) {
        accountCharacters[sIdx] = r;
      }
    });
    // 만약 slot_index가 겹치거나 비정규화된 일반 슬롯(100 미만) 행이 있으면 빈 슬롯에 순차 배정
    rows.forEach(r => {
      if (Number(r.slot_index) >= 100) return;
      if (!accountCharacters.some(ac => ac && ac.id === r.id)) {
        const emptySlot = accountCharacters.findIndex(ac => ac === null);
        if (emptySlot > -1) accountCharacters[emptySlot] = r;
      }
    });
  }
}

function renderCharacterSlots() {
  const container = document.getElementById('character-slots');
  if (!container) return;

  let html = '';
  for (let i = 0; i < 3; i++) {
    const c = accountCharacters[i];
    if (c) {
      const clsMeta = CLASS_STATS[c.class] || CLASS_STATS.knight;
      const regObj = GameDB.Regions.find(r => r.id === (c.region_key || 'R01')) || GameDB.Regions[0];
      const isCharOnline = Boolean(c.isOnline || (c.id && typeof activeCharacterId !== 'undefined' && activeCharacterId === c.id));
      html += `
        <div class="char-slot-card" style="gap:6px; padding:8px 9px;">
          <div style="display:flex; align-items:center; gap:7px; min-width:0; flex:1;">
            <div style="position:relative; width:36px; height:36px; border-radius:8px; background:#090b10; border:1px solid #6b5535; display:flex; align-items:center; justify-content:center; font-size:19px; flex-shrink:0;">
              ${window.getClassIconHTML ? window.getClassIconHTML(c.class, 24) : (clsMeta.icon || '🛡️')}
            </div>
            <div style="min-width:0; flex:1; text-align:left;">
              <div style="font-size:13px; font-weight:bold; color:#fde047; display:flex; align-items:center; gap:5px; min-width:0;">
                <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; min-width:0;">Lv.${c.level || 1} ${c.name}</span>
                ${isCharOnline ? `<span title="이미 접속중인 캐릭터" style="color:#22c55e; font-size:11.5px; line-height:1; flex-shrink:0; text-shadow:none; box-shadow:none;">●</span>` : ''}
              </div>
              <div style="font-size:10px; color:#93c5fd; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                ${clsMeta.name} · 📍 ${regObj.name}
              </div>
            </div>
          </div>
          <div style="display:flex; gap:4px; flex-shrink:0;">
            <button type="button" class="auth-primary-btn" style="padding:5px 8px; font-size:11px; white-space:nowrap;" onclick="enterGameWithCharacter(${i})">⚡ 접속</button>
            <button type="button" class="auth-danger-btn" style="padding:5px 6px; font-size:10.5px; white-space:nowrap;" onclick="openDeleteCharModal(${i})">🗑️ 삭제</button>
          </div>
        </div>
      `;
    } else {
      html += `
        <div class="char-slot-card char-slot-empty">
          <div style="display:flex; align-items:center; gap:9px;">
            <div style="width:38px; height:38px; border-radius:8px; background:#090b10; border:1px dashed #4b5563; display:flex; align-items:center; justify-content:center; font-size:16px; color:#6b7280;">
              ${i + 1}
            </div>
            <div style="text-align:left;">
              <div style="font-size:12px; font-weight:bold; color:#9ca3af;">슬롯 ${i + 1} (비어있음)</div>
              <div style="font-size:9.5px; color:#6b7280;">수파베이스 실시간 연동</div>
            </div>
          </div>
          <button type="button" class="auth-sub-btn" style="border-color:#facc15; color:#fde047; padding:6px 12px;" onclick="openCharacterCreateScreen(${i})">➕ 캐릭터 생성</button>
        </div>
      `;
    }
  }
  container.innerHTML = html;
}

// 6) 캐릭터 생성 버튼 클릭 시 실시간 수파베이스 슬롯 상태 선검증 (다른 기기에서 이미 생성된 경우 즉시 차단 및 슬롯 갱신!)
window.openCharacterCreateScreen = async function(slotIdx) {
  if (window.isUiTouchDebounced?.('openCharacterCreateScreen', 350)) return;
  if (!currentAccountUser) return;

  // 버튼이 눌리는 순간 무조건 수파베이스 최신 슬롯 상태를 실시간 조회!
  await loadAccountCharacterSlots(true);
  renderCharacterSlots();

  const existingCount = accountCharacters.filter(Boolean).length;
  if (existingCount >= 3 || accountCharacters[slotIdx]) {
    const takenChar = accountCharacters[slotIdx];
    window.showSystemAlertModal(
      '⚠️ 실시간 서버 슬롯 동기화',
      takenChar
        ? `다른 기기(또는 창)에서 이미 슬롯 ${slotIdx + 1}번에 [${takenChar.name}] 캐릭터가 생성되었습니다.\n서버 최신 상태로 슬롯을 업데이트했습니다.`
        : `이미 캐릭터 3명 슬롯이 모두 사용 중입니다.\n서버 최신 상태로 슬롯을 업데이트했습니다.`
    );
    return;
  }

  pendingCreateSlotIndex = slotIdx;
  selectedCreateClass = 'knight';
  verifiedCharName = null;

  const nameInp = document.getElementById('create-char-name');
  const msgEl = document.getElementById('create-char-name-msg');
  if (nameInp) nameInp.value = '';
  if (msgEl) {
    msgEl.style.color = '#9ca3af';
    msgEl.innerText = '이름 입력 후 중복체크를 진행해주세요.';
  }

  window.enterPreGamePortraitView?.();
  window.selectClassForCreate('knight');
  document.getElementById('auth-overlay-ui').style.display = 'none';
  document.getElementById('char-select-ui').style.display = 'flex';
};

window.cancelCharacterCreate = async function() {
  window.enterPreGamePortraitView?.();
  document.getElementById('char-select-ui').style.display = 'none';
  document.getElementById('auth-overlay-ui').style.display = 'flex';
  await loadAccountCharacterSlots(true);
  renderCharacterSlots();
};

window.selectClassForCreate = function(classKey) {
  selectedCreateClass = classKey;
  ['knight', 'ranger', 'wizard'].forEach(k => {
    const card = document.querySelector(`.class-row-card[data-class="${k}"]`);
    const chk = document.getElementById(`chk-class-${k}`);
    if (card) card.classList.toggle('selected', k === classKey);
    if (chk) chk.innerText = k === classKey ? '✔' : '';
  });
};

window.onCharNameInput = function() {
  verifiedCharName = null;
  const msgEl = document.getElementById('create-char-name-msg');
  if (msgEl) {
    msgEl.style.color = '#9ca3af';
    msgEl.innerText = '캐릭터 이름 중복체크를 진행해주세요.';
  }
};

window.checkCharacterNameDuplicate = async function() {
  const rawName = (document.getElementById('create-char-name')?.value || '').trim();
  const msgEl = document.getElementById('create-char-name-msg');

  if (rawName.length < 2 || rawName.length > 10) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 캐릭터 이름은 2~10자 사이로 입력해주세요.';
    }
    return false;
  }
  if (/[^가-힣a-zA-Z0-9_]/.test(rawName)) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 특수문자는 사용할 수 없습니다. (한글/영문/숫자만 가능)';
    }
    return false;
  }

  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
  let isDup = false;
  let checkedRemote = false;

  const srvDup = await callCentralServerApi('/api/characters/check-name', 'POST', { name: rawName });
  if (srvDup && !srvDup.error) {
    checkedRemote = true;
    if (srvDup.exists) isDup = true;
  }

  if (isSupabaseRemoteConnected && supabaseClient) {
    const { data, error } = await supabaseClient
      .from(charTable)
      .select('id, name')
      .ilike('name', rawName)
      .limit(1);
    if (!error) {
      checkedRemote = true;
      if (Array.isArray(data) && data.length > 0) isDup = true;
    }
  }

  if (!checkedRemote) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 수파베이스 서버와 연결할 수 없어 중복 확인이 불가합니다.';
    }
    return false;
  }

  if (isDup) {
    verifiedCharName = null;
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = `⚠️ '${rawName}'은(는) 이미 존재하는 캐릭터 이름입니다.`;
    }
    return false;
  }

  verifiedCharName = rawName;
  if (msgEl) {
    msgEl.style.color = '#4ade80';
    msgEl.innerText = `✅ '${rawName}' 사용 가능! (수파베이스 실시간 검증 완료)`;
  }
  return true;
};

// 캐릭터 생성 확정 시: 절대 로컬에서 임시로 먼저 만들지 않고, 무조건 수파베이스 슬롯·이름 검증 및 DB INSERT 성공 후에만 게임 진입!
window.confirmCreateCharacter = async function() {
  if (window.isUiTouchDebounced?.('confirmCreateCharacter', 600)) return;
  window.tryEnterFullscreenMode?.();
  if (!currentAccountUser) return;

  const rawName = (document.getElementById('create-char-name')?.value || '').trim();
  const msgEl = document.getElementById('create-char-name-msg');

  // 1) 실시간 슬롯 점유 상태 수파베이스 재검증 (다른 기기에서 생성했는지 확인!)
  await loadAccountCharacterSlots(true);
  const existingCount = accountCharacters.filter(Boolean).length;
  if (existingCount >= 3 || accountCharacters[pendingCreateSlotIndex]) {
    document.getElementById('char-select-ui').style.display = 'none';
    document.getElementById('auth-overlay-ui').style.display = 'flex';
    renderCharacterSlots();
    window.showSystemAlertModal(
      '⚠️ 슬롯 실시간 동기화 알림',
      `대기 중 다른 기기에서 슬롯 ${pendingCreateSlotIndex + 1}번에 이미 캐릭터가 생성되어 최신 서버 슬롯 상태로 업데이트되었습니다.`
    );
    return;
  }

  // 2) 실시간 이름 중복 수파베이스 재검증
  const nameOk = await window.checkCharacterNameDuplicate();
  if (!nameOk) return;

  if (msgEl) {
    msgEl.style.color = '#93c5fd';
    msgEl.innerText = '⏳ 수파베이스 DB에 캐릭터를 생성 및 검증하고 있습니다...';
  }

  const prevCharId = activeCharacterId;
  const charId = generateValidUUID();
  const chosenClass = selectedClassForCreateOrDefault();
  const newSessionTok = `msess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

  // 3) 초기 캐릭터 데이터를 먼저 구성하여 수파베이스에 먼저 저장(INSERT) 검증!
  activeSlotIndex = pendingCreateSlotIndex;
  activeCharacterId = charId;
  currentSessionToken = newSessionTok;

  // 첫 실행 시 맵 렌더러/지형 DB 준비 완료 대기
  if (!window.HardcodedMapDB || !window.HardcodedMapDB['R01_sub1'] || !window.DetailFieldRenderer) {
    let waitCount = 0;
    while ((!window.HardcodedMapDB || !window.HardcodedMapDB['R01_sub1'] || !window.DetailFieldRenderer) && waitCount < 50) {
      await new Promise(r => setTimeout(r, 40));
      waitCount++;
    }
  }

  // 임시로 초기 스탯/인벤토리 구성 후 DB 먼저 검증
  window.startGame(chosenClass, rawName, null, true); // deferDisplay = true
  const initPayload = buildCurrentCharacterRecordPayload();
  initPayload.session_token = newSessionTok;

  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
  let dbCreatedOk = false;

  // A. 중앙 서버(/api/characters/save with _isNewCreate: true)로 슬롯 충돌 및 DB 생성 검증
  const srvCreate = await callCentralServerApi('/api/characters/save', 'POST', {
    ...initPayload,
    _isNewCreate: true
  });
  if (srvCreate && srvCreate.slotOccupied) {
    await loadAccountCharacterSlots(true);
    document.getElementById('char-select-ui').style.display = 'none';
    document.getElementById('auth-overlay-ui').style.display = 'flex';
    renderCharacterSlots();
    window.showSystemAlertModal('⚠️ 슬롯 생성 차단 (서버 우선)', srvCreate.error || '다른 기기에서 이미 슬롯에 캐릭터가 생성되었습니다.');
    return;
  }
  if (srvCreate && srvCreate.nameOccupied) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = `⚠️ ${srvCreate.error}`;
    }
    return;
  }
  if (srvCreate && srvCreate.ok) {
    dbCreatedOk = true;
  }

  // B. Supabase 클라이언트 직접 검증 및 저장
  if (isSupabaseRemoteConnected && supabaseClient) {
    const { data: liveSlotRows, error: slotCheckErr } = await supabaseClient
      .from(charTable)
      .select('id, name, slot_index')
      .eq('user_id', currentAccountUser.id)
      .lt('slot_index', 100);
    if (slotCheckErr) {
      if (!dbCreatedOk) {
        window.showSystemAlertModal('⚠️ 서버 연결 실패', '수파베이스 DB 검증에 실패하여 로컬 캐릭터 생성이 차단되었습니다.');
        return;
      }
    } else if (Array.isArray(liveSlotRows)) {
      const conflict = liveSlotRows.find(r => r.id !== charId && (Number(r.slot_index) === Number(pendingCreateSlotIndex) || liveSlotRows.length > 3));
      if (conflict && !dbCreatedOk) {
        await loadAccountCharacterSlots(true);
        document.getElementById('char-select-ui').style.display = 'none';
        document.getElementById('auth-overlay-ui').style.display = 'flex';
        renderCharacterSlots();
        window.showSystemAlertModal('⚠️ 슬롯 생성 차단 (서버 우선)', `다른 기기에서 이미 캐릭터가 생성되어 최신 서버 상태로 갱신되었습니다.`);
        return;
      }
      const { error: insErr } = await supabaseClient.from(charTable).upsert(initPayload, { onConflict: 'id' });
      if (!insErr) dbCreatedOk = true;
    }
  }

  if (!dbCreatedOk) {
    document.getElementById('char-select-ui').style.display = 'none';
    document.getElementById('auth-overlay-ui').style.display = 'flex';
    await loadAccountCharacterSlots(true);
    renderCharacterSlots();
    window.showSystemAlertModal('⚠️ 캐릭터 생성 실패', '수파베이스 서버에 캐릭터를 저장할 수 없어 생성이 취소되었습니다. (로컬 임시 생성 불가)');
    return;
  }

  // 4) 수파베이스 DB 생성 검증이 100% 완료된 후에만 화면을 인게임으로 전환하고 세션 가동!
  stopSlotScreenRealtimeSync();
  document.getElementById('auth-overlay-ui').style.display = 'none';
  document.getElementById('char-select-ui').style.display = 'none';
  document.getElementById('game-wrapper').style.display = 'flex';
  window.applyInGameScreenMode?.(null);
  window.forceResizePixiApp?.();
  requestAnimationFrame(() => window.forceResizePixiApp?.());
  setTimeout(() => window.forceResizePixiApp?.(), 80);
  setTimeout(() => window.forceResizePixiApp?.(), 260);

  connectCentralMultiplayerSocket();
  await registerActiveGameSession(charId, prevCharId);
  await loadAccountCharacterSlots(true);
  window.addChat(`🎉 [캐릭터 생성 완료] '${rawName}' 님, 알트리아 초심자의 마을에 오신 것을 환영합니다!`, 'log-kill');
};

function selectedClassForCreateOrDefault() {
  return selectedCreateClass || 'knight';
}

// 7) 캐릭터 삭제 확인 모달 (버튼 클릭 시 수파베이스 실시간 검증 후 오픈)
window.openDeleteCharModal = async function(slotIdx) {
  if (window.isUiTouchDebounced?.('openDeleteCharModal', 320)) return;
  await loadAccountCharacterSlots(true);
  renderCharacterSlots();
  const c = accountCharacters[slotIdx];
  if (!c) {
    window.showSystemAlertModal('ℹ️ 슬롯 상태 갱신됨', '다른 기기에서 이미 삭제되었거나 존재하지 않는 캐릭터입니다.');
    return;
  }
  pendingDeleteSlotIndex = slotIdx;

  const descEl = document.getElementById('delete-modal-desc');
  const inpEl = document.getElementById('delete-confirm-input');
  const msgEl = document.getElementById('delete-confirm-msg');
  const clsName = CLASS_STATS[c.class]?.name || c.class;

  if (descEl) {
    descEl.innerHTML = `슬롯 ${slotIdx + 1}의 <b style="color:#fde047;">[${c.name}] (${clsName})</b> 캐릭터를 수파베이스 서버에서 영구 삭제하시겠습니까?`;
  }
  if (inpEl) inpEl.value = '';
  if (msgEl) msgEl.innerText = '';
  document.getElementById('char-delete-modal').style.display = 'flex';
};

window.closeDeleteCharModal = function() {
  pendingDeleteSlotIndex = null;
  const modal = document.getElementById('char-delete-modal');
  if (modal) modal.style.display = 'none';
};

window.executeDeleteCharacter = async function() {
  if (window.isUiTouchDebounced?.('executeDeleteCharacter', 500)) return;
  if (pendingDeleteSlotIndex === null || !currentAccountUser) return;
  const c = accountCharacters[pendingDeleteSlotIndex];
  if (!c) return;

  const inpVal = (document.getElementById('delete-confirm-input')?.value || '').trim();
  const msgEl = document.getElementById('delete-confirm-msg');

  if (inpVal !== '삭제') {
    if (msgEl) msgEl.innerText = `⚠️ 입력창에 '삭제' 두 글자를 정확히 입력해주세요.`;
    return;
  }

  if (msgEl) {
    msgEl.style.color = '#93c5fd';
    msgEl.innerText = `⏳ 수파베이스 DB에서 캐릭터를 실시간 삭제 중...`;
  }

  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
  let deletedRemote = false;

  const srvDel = await callCentralServerApi(`/api/characters/delete`, 'POST', { id: c.id, user_id: currentAccountUser.id });
  if (srvDel && srvDel.ok) {
    deletedRemote = true;
  }

  if (isSupabaseRemoteConnected && supabaseClient) {
    const { error } = await supabaseClient
      .from(charTable)
      .delete()
      .eq('id', c.id)
      .eq('user_id', currentAccountUser.id);
    if (!error) deletedRemote = true;
  }

  if (!deletedRemote) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = `⚠️ 수파베이스 DB 연결 실패로 삭제할 수 없습니다.`;
    }
    return;
  }

  purgeBrowserLocalGameCache();
  window.closeDeleteCharModal();
  await loadAccountCharacterSlots(true);
  renderCharacterSlots();
};

// 8) 캐릭터 접속 (접속 버튼 클릭 시 무조건 수파베이스 최신 데이터를 실시간 조회·검증하여 진입!)
window.enterGameWithCharacter = async function(slotIdx) {
  if (window.isUiTouchDebounced?.('enterGameWithCharacter', 500)) return;
  window.tryEnterFullscreenMode?.();
  window.showGameLoadingScreen?.('⚡ 에테르 월드 접속 준비 중...', '수파베이스 DB에서 최신 캐릭터 데이터를 불러오고 있습니다...', 24);

  try {
    purgeBrowserLocalGameCache();
    await loadAccountCharacterSlots(true);
    await loadAccountSharedStorage(true);
    const c = accountCharacters[slotIdx];
    if (!c) {
      window.hideGameLoadingScreen?.(0);
      renderCharacterSlots();
      window.showSystemAlertModal('⚠️ 캐릭터 슬롯 갱신됨', '다른 기기에서 캐릭터 상태가 변경되어 슬롯 목록을 최신으로 업데이트했습니다.');
      return;
    }

    stopSlotScreenRealtimeSync();
    const prevCharId = activeCharacterId;
    activeSlotIndex = slotIdx;
    activeCharacterId = c.id;
    window.activeCharacterId = c.id;
    // 캐릭터 진입마다 항상 새로운 고유 세션 토큰을 먼저 발급하여 동일 캐릭터 중복 접속만 정확히 식별!
    currentSessionToken = `msess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // 🌟 첫 실행 시 맵 렌더러/지형 DB 준비 완료 대기 (새로고침 없이 100% 즉시 렌더링 보장)
    if (!window.HardcodedMapDB || !window.HardcodedMapDB['R01_sub1'] || !window.DetailFieldRenderer) {
      let waitCount = 0;
      while ((!window.HardcodedMapDB || !window.HardcodedMapDB['R01_sub1'] || !window.DetailFieldRenderer) && waitCount < 50) {
        await new Promise(r => setTimeout(r, 40));
        waitCount++;
      }
    }

    // 수파베이스에서 방금 가져온 최신 캐릭터 레코드(c)로 게임 진입 (옵션 포함 복원)
    const charClass = (c.class && CLASS_STATS[c.class]) ? c.class : 'knight';
    isGameSessionActive = true;
    window.startGame(charClass, c.name, c, false);
    window.forceResizePixiApp?.();
    requestAnimationFrame(() => window.forceResizePixiApp?.());
    setTimeout(() => window.forceResizePixiApp?.(), 80);
    setTimeout(() => window.forceResizePixiApp?.(), 260);
    connectCentralMultiplayerSocket();
    await registerActiveGameSession(c.id, prevCharId);
    window.addChat(`⚡ [접속 완료] '${c.name}' 캐릭터의 수파베이스 최신 데이터 및 환경설정을 불러왔습니다!`, 'log-kill');
  } catch (err) {
    console.error('enterGameWithCharacter Error:', err);
    window.hideGameLoadingScreen?.(0);
    window.showSystemAlertModal('⚠️ 캐릭터 접속 오류', `게임 진입 중 오류가 발생했습니다: ${err?.message || err}`);
  }
};

async function registerActiveGameSession(charId, prevCharId = null) {
  if (!currentAccountUser || !charId) return;
  if (!currentSessionToken) {
    currentSessionToken = `msess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }
  isGameSessionActive = true;

  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';

  // 로컬 미러의 해당 캐릭터(charId) 세션 토큰만 갱신 (같은 계정의 다른 캐릭터 슬롯은 절대 건드리지 않음!)
  const localChars = getLocalMirrorTable(charTable);
  const cIdx = localChars.findIndex(c => c && c.id === charId);
  if (cIdx > -1) {
    localChars[cIdx].session_token = currentSessionToken;
    setLocalMirrorTable(charTable, localChars);
  }

  // 중앙 서버(/api/characters/save) 및 Supabase magic_characters 테이블에 현재 캐릭터의 session_token 즉시 동기화
  const initCharPayload = buildCurrentCharacterRecordPayload();
  if (initCharPayload) {
    initCharPayload.session_token = currentSessionToken;
    await callCentralServerApi('/api/characters/save', 'POST', initCharPayload);
  }

  if (isSupabaseRemoteConnected && supabaseClient) {
    await supabaseClient
      .from(charTable)
      .update({ session_token: currentSessionToken, updated_at: new Date().toISOString() })
      .eq('id', charId);

    // 🌟 Supabase Realtime 구독을 계정(magic_accounts)이 아닌 '현재 캐릭터(magic_characters.id)' 단위로 감시!
    // -> 같은 계정의 다른 캐릭터가 접속해도 끊기지 않으며, 오직 동일한 캐릭터(charId)로 새로 접속했을 때만 기존 캐릭터가 종료됨!
    try {
      if (realtimeSubscription) {
        supabaseClient.removeChannel(realtimeSubscription);
        realtimeSubscription = null;
      }
      realtimeSubscription = supabaseClient
        .channel(`magic_char_session_${charId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: charTable, filter: `id=eq.${charId}` },
          (payload) => {
            const newToken = payload?.new?.session_token;
            if (isGameSessionActive && activeCharacterId === charId && newToken && newToken !== currentSessionToken) {
              handleForceDisconnectByOtherBrowser();
            }
          }
        )
        .subscribe();
    } catch (e) {}
  }

  // 같은 브라우저의 다른 탭에도 '동일 캐릭터(charId)' 기준 브로드캐스트
  if (sessionBroadcastChannel) {
    sessionBroadcastChannel.postMessage({
      type: 'NEW_CHAR_SESSION',
      userId: currentAccountUser.id,
      charId: charId,
      sessionToken: currentSessionToken
    });
  }

  // 중앙 서버에도 캐릭터 진입 알림 (이전 슬롯 유령 캐릭터 즉시 정리 및 동일 캐릭터 기존 소켓 강제 종료)
  sendCentralWsPacket({
    type: 'ENTER_CHAR',
    userId: currentAccountUser.id,
    email: currentAccountUser.email || '',
    charId: charId,
    prevCharId: prevCharId && prevCharId !== charId ? prevCharId : null,
    sessionToken: currentSessionToken,
    mapKey: currentMapKey,
    regionKey: currentRegionKey,
    player: buildMultiplayerPlayerSnapshot()
  });

  try {
    history.pushState({ magicInGame: true }, '', location.href);
  } catch (e) {}

  startAutoSaveAndSessionTimers();
}

function startAutoSaveAndSessionTimers() {
  stopAutoSaveAndSessionTimers();
  window.activeCharacterId = activeCharacterId;
  const autoSaveMs = Math.max(45000, GameDB.SupabaseConfig?.autoSaveIntervalMs || 45000);
  const heartbeatMs = Math.max(20000, GameDB.SupabaseConfig?.sessionHeartbeatMs || 20000);

  // 주기적 자동 저장 (변경 사항이 있을 때만 스마트 전송하여 데이터 절약)
  autoSaveTimerId = setInterval(() => {
    if (isGameSessionActive && !document.hidden) {
      saveCurrentCharacterAndStorageNow('periodic_45s');
    }
  }, autoSaveMs);

  // 🌟 동일 캐릭터 중복 접속 감지 폴링 (WebSocket 연결 시에는 서버가 실시간 차단하므로 REST 폴링 생략하여 데이터 절약!)
  sessionHeartbeatTimerId = setInterval(async () => {
    if (!isGameSessionActive || !currentAccountUser || !activeCharacterId || !currentSessionToken) return;
    if (isServerAuthoritativeMode()) return;
    const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';

    if (isSupabaseRemoteConnected && supabaseClient) {
      const { data, error } = await supabaseClient
        .from(charTable)
        .select('session_token')
        .eq('id', activeCharacterId)
        .maybeSingle();
      if (!error && data && data.session_token && data.session_token !== currentSessionToken) {
        handleForceDisconnectByOtherBrowser();
        return;
      }
    } else {
      const localChars = getLocalMirrorTable(charTable);
      const found = localChars.find(c => c && c.id === activeCharacterId);
      if (found && found.session_token && found.session_token !== currentSessionToken) {
        handleForceDisconnectByOtherBrowser();
      }
    }
  }, heartbeatMs);
}

function stopAutoSaveAndSessionTimers() {
  if (autoSaveTimerId) { clearInterval(autoSaveTimerId); autoSaveTimerId = null; }
  if (debounceSaveTimerId) { clearTimeout(debounceSaveTimerId); debounceSaveTimerId = null; }
  if (sessionHeartbeatTimerId) { clearInterval(sessionHeartbeatTimerId); sessionHeartbeatTimerId = null; }
  if (realtimeSubscription && supabaseClient) {
    try { supabaseClient.removeChannel(realtimeSubscription); } catch (e) {}
    realtimeSubscription = null;
  }
}

function handleForceDisconnectByOtherBrowser() {
  if (!isGameSessionActive) return;
  isGameSessionActive = false;
  stopAutoSaveAndSessionTimers();
  disableAutoAttack();
  window.SoundSystem?.stopBgm?.();

  if (centralWs) {
    try { centralWs.close(); } catch (e) {}
    centralWs = null;
  }

  ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });

  window.partyState = null;
  window.clearAllOtherPlayersVisuals?.();
  window.sweepOrphanPixiVisuals?.();
  ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui', 'party-control-modal', 'game-tip-modal', 'trade-modal-ui', 'immersive-20-modal', 'stat-alloc-modal'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  window.enterPreGamePortraitView?.();
  document.getElementById('game-wrapper').style.display = 'none';
  document.getElementById('auth-overlay-ui').style.display = 'flex';
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('slot-box').style.display = 'block';
  renderCharacterSlots();

  window.showSystemAlertModal(
    '⚠️ 동일 캐릭터 신규 접속 감지',
    '다른 창(또는 기기)에서 동일한 캐릭터로 새로 게임에 진입하여 현재 창의 캐릭터 접속이 안전하게 종료되었습니다.\n(같은 계정 내 다른 슬롯의 캐릭터로는 동시 접속이 가능합니다.)'
  );
}

// 9) 캐릭터 상태 직렬화 및 역직렬화
function buildCurrentCharacterRecordPayload() {
  if (!currentAccountUser || activeSlotIndex === null || !activeCharacterId) return null;

  let mercData = null;
  if (mercenary && mercenary.hired) {
    mercData = {
      hired: mercenary.hired,
      class: mercenary.class,
      name: mercenary.name,
      level: mercenary.level,
      exp: mercenary.exp,
      maxExp: mercenary.maxExp,
      hp: mercenary.hp,
      maxHp: mercenary.maxHp,
      mp: mercenary.mp,
      maxMp: mercenary.maxMp,
      isDead: mercenary.isDead,
      stance: mercenary.stance,
      stats: mercenary.stats,
      inventory: mercenary.inventory,
      equip: mercenary.equip,
      weaponPlus: mercenary.weaponPlus || 0,
      armorPlus: mercenary.armorPlus || 0,
      activeBuffs: mercenary.activeBuffs || { ELIXIR: 0, SHIELD: 0, HASTE: 0 }
    };
  }

  return {
    id: activeCharacterId,
    user_id: currentAccountUser.id,
    slot_index: activeSlotIndex,
    name: player.name,
    class: player.class,
    level: player.level || 1,
    exp: player.exp || 0,
    gold: player.gold || 0,
    region_key: currentRegionKey || 'R01',
    map_key: currentMapKey || 'R01_sub1',
    pos_x: Math.round(player.x || 2000),
    pos_y: Math.round(player.y || 14250),
    session_token: currentSessionToken,
    char_data: {
      maxExp: player.maxExp || 100,
      hp: Math.ceil(player.hp || 100),
      maxHp: player.maxHp || 100,
      mp: Math.ceil(player.mp || 50),
      maxMp: player.maxMp || 50,
      stats: player.stats,
      statPoints: player.statPoints || 0,
      statResetUsed: player.statResetUsed || 0,
      learnedSkills: Array.from(player.learnedSkills || []),
      inventory: player.inventory,
      equip: player.equip,
      weaponPlus: player.weaponPlus || 0,
      armorPlus: player.armorPlus || 0,
      quests: player.quests || {},
      activeBuffs: player.activeBuffs || {},
      skillSlots: window.skillSlots,
      autoSlots: Array.from(window.autoSlots || []),
      options: window.getSerializedOptions ? window.getSerializedOptions() : undefined,
      mercenary: mercData
    },
    updated_at: new Date().toISOString()
  };
}

window.applySavedCharacterRecordToState = function(record) {
  if (!record) return;
  const cd = record.char_data || {};

  player.name = record.name || player.name;
  player.class = (record.class && CLASS_STATS[record.class]) ? record.class : (player.class || 'knight');
  if (record.map_key) {
    currentMapKey = record.map_key;
    currentRegionKey = record.region_key || String(record.map_key).split('_')[0] || 'R01';
  }
  if (record.pos_x !== undefined && record.pos_y !== undefined && Number(record.pos_x) > 0 && Number(record.pos_y) > 0) {
    player.x = Number(record.pos_x);
    player.y = Number(record.pos_y);
    player.targetX = player.x;
    player.targetY = player.y;
  }
  player.level = Number(record.level) || 1;
  player.exp = Number(record.exp) || 0;
  player.maxExp = calcRequiredExpForLevel(player.level);
  player.gold = Number(record.gold) ?? 600;
  player.bankGold = window.accountStorage?.bankGold || 0;

  if (cd.stats) player.stats = { ...cd.stats };
  player.statPoints = Number(cd.statPoints) || 0;
  player.statResetUsed = Number(cd.statResetUsed) || 0;

  if (Array.isArray(cd.learnedSkills) && cd.learnedSkills.length > 0) {
    player.learnedSkills = new Set(cd.learnedSkills);
  } else {
    window.initDefaultLearnedSkills(player.class);
  }

  if (Array.isArray(cd.inventory)) {
    player.inventory = cd.inventory.slice(0, 100);
    while (player.inventory.length < 100) player.inventory.push(null);
  }
  if (cd.equip) {
    player.equip = { ...createEmptyEquipObj(), ...cd.equip };
    window.migrateAndNormalizeEquip?.(player.equip, player.inventory);
  }
  player.weaponPlus = Number(cd.weaponPlus) || 0;
  player.armorPlus = Number(cd.armorPlus) || 0;
  player.quests = cd.quests || {};
  if (cd.activeBuffs) {
    player.activeBuffs = { ...player.activeBuffs, ...cd.activeBuffs };
  }

  if (Array.isArray(cd.skillSlots)) {
    window.skillSlots = cd.skillSlots;
  }
  if (Array.isArray(cd.autoSlots)) {
    window.autoSlots = new Set(cd.autoSlots);
    for (let i = 1; i <= 9; i++) {
      const el = document.getElementById(`slot-${i}`);
      if (el) {
        if (window.autoSlots.has(i)) el.classList.add('auto-active');
        else el.classList.remove('auto-active');
      }
    }
  }

  if (cd.options && window.loadCharacterOptions) {
    window.loadCharacterOptions(cd.options);
  }

  if (cd.mercenary && cd.mercenary.hired && window.restoreMercenaryState) {
    window.restoreMercenaryState(cd.mercenary);
  } else {
    mercenary.hired = false;
  }

  recalcMaxHpMp(false);
  player.hp = Math.min(player.maxHp, Math.max(1, Number(cd.hp) || player.maxHp));
  player.mp = Math.min(player.maxMp, Math.max(0, Number(cd.mp) ?? player.maxMp));
};

// 옵션 변경 시 수파베이스(캐릭터 레코드)에 즉시 저장
window.saveOptionsToSupabase = function() {
  if (!isGameSessionActive || !currentAccountUser || !activeCharacterId) return;
  window.triggerAutoSave?.('option_change', true);
};

let _lastSavedCharSignature = '';

// 10) 실시간 자동저장 & 긴급 브라우저 종료 즉시 저장 (데이터 소모 절약 패치 적용: 변경사항 중복 전송 차단 및 서버 일원화 저장)
async function saveCurrentCharacterAndStorageNow(reason = 'auto', useKeepaliveFetch = false) {
  if (!isGameSessionActive || !currentAccountUser || activeSlotIndex === null || !activeCharacterId) return;

  const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
  const charPayload = buildCurrentCharacterRecordPayload();
  if (!charPayload) return;

  const isCriticalReason = (
    useKeepaliveFetch ||
    reason === 'option_change' ||
    reason === 'bank_update' ||
    reason === 'logout' ||
    reason === 'switch_character' ||
    reason === 'emergency_exit' ||
    reason === 'version_auto_reload' ||
    reason === 'version_patch_detected'
  );

  // 📉 데이터 절약: 이전 저장 스냅샷과 핵심 데이터(레벨/경험치/골드/위치/스탯/장비/인벤토리)가 동일하면 주기적 중복 전송 생략!
  const sigObj = {
    lv: charPayload.level,
    exp: charPayload.exp,
    gold: charPayload.gold,
    mk: charPayload.map_key,
    px: Math.round((charPayload.pos_x || 0) / 25),
    py: Math.round((charPayload.pos_y || 0) / 25),
    st: charPayload.char_data?.stats,
    sp: charPayload.char_data?.statPoints,
    eq: charPayload.char_data?.equip,
    inv: charPayload.char_data?.inventory,
    sk: charPayload.char_data?.learnedSkills,
    q: charPayload.char_data?.quests,
    opt: charPayload.char_data?.options,
    mc: charPayload.char_data?.mercenary ? {
      h: charPayload.char_data.mercenary.hired,
      lv: charPayload.char_data.mercenary.level,
      exp: charPayload.char_data.mercenary.exp,
      eq: charPayload.char_data.mercenary.equip,
      inv: charPayload.char_data.mercenary.inventory
    } : null
  };
  const curSig = JSON.stringify(sigObj);
  if (!isCriticalReason && curSig === _lastSavedCharSignature) {
    return;
  }
  _lastSavedCharSignature = curSig;

  // 창고(magic_storage)는 창고 입출금이나 로그아웃/캐릭터전환 시에만 저장하여 동일 계정 다중 캐릭터 접속 시 충돌 및 통신량 절감!
  if (reason === 'bank_update' || reason === 'logout' || reason === 'switch_character' || reason === 'emergency_exit') {
    if (useKeepaliveFetch) {
      saveAccountSharedStorage().catch(() => {});
    } else {
      await saveAccountSharedStorage();
    }
  }

  // 2. 중앙 서버(magic_server.js) 저장 (성공 시 서버가 DB에 저장하므로 클라이언트의 이중 Supabase 직접 전송을 생략해 데이터 50% 절감!)
  let savedViaCentralServer = false;
  if (useKeepaliveFetch) {
    try {
      fetch('/api/characters/save', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(charPayload)
      }).catch(() => {});
      savedViaCentralServer = isCentralServerConnected;
    } catch (e) {}
  } else {
    const srvRes = await callCentralServerApi('/api/characters/save', 'POST', charPayload);
    if (srvRes && srvRes.ok) {
      savedViaCentralServer = true;
    }
  }

  // 3. 중앙 서버 미연결(오프라인/단독 실행) 시에만 Supabase 원격 테이블 직접 저장 폴백
  if (!savedViaCentralServer && isSupabaseRemoteConnected && supabaseClient) {
    if (useKeepaliveFetch) {
      const { url, key } = getEffectiveSupabaseCreds();
      try {
        fetch(`${url}/rest/v1/${charTable}?on_conflict=id`, {
          method: 'POST',
          keepalive: true,
          headers: {
            'Content-Type': 'application/json',
            'apikey': key,
            'Authorization': `Bearer ${key}`,
            'Prefer': 'resolution=merge-duplicates'
          },
          body: JSON.stringify(charPayload)
        }).catch(() => {});
      } catch (e) {}
    } else {
      await supabaseClient.from(charTable).upsert(charPayload, { onConflict: 'id' });
    }
  }

  const badge = document.getElementById('opt-autosave-badge');
  if (badge) {
    const nowStr = new Date().toLocaleTimeString('ko-KR', { hour12: false });
    badge.innerText = `☁️ 자동저장 완료 (${nowStr})`;
  }
}

window.triggerAutoSave = function(reason = 'event', immediate = false) {
  if (!isGameSessionActive) return;
  if (immediate) {
    if (debounceSaveTimerId) {
      clearTimeout(debounceSaveTimerId);
      debounceSaveTimerId = null;
    }
    saveCurrentCharacterAndStorageNow(reason, false);
  } else {
    const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
    const charPayload = buildCurrentCharacterRecordPayload();
    if (charPayload) {
      const localChars = getLocalMirrorTable(charTable);
      const cIdx = localChars.findIndex(c => c && c.id === charPayload.id);
      if (cIdx > -1) localChars[cIdx] = charPayload;
      else localChars.push(charPayload);
      setLocalMirrorTable(charTable, localChars);
    }
    if (!debounceSaveTimerId) {
      const waitMs = Math.max(6000, GameDB.SupabaseConfig?.combatSaveDebounceMs || 6000);
      debounceSaveTimerId = setTimeout(() => {
        debounceSaveTimerId = null;
        saveCurrentCharacterAndStorageNow(reason, false);
      }, waitMs);
    }
  }
};

// 11) 게임 내 옵션 -> [캐릭터 선택] 및 [로그아웃]
window.returnToCharacterSelect = async function() {
  const optUi = document.getElementById('option-ui');
  if (optUi) optUi.classList.add('hidden');

  const leavingCharId = activeCharacterId;
  if (isGameSessionActive) {
    await saveCurrentCharacterAndStorageNow('switch_character', false);
  }
  sendCentralWsPacket({ type: 'LEAVE_CHAR', charId: leavingCharId });
  if (leavingCharId) {
    try {
      fetch('/api/characters/leave', {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charId: leavingCharId, userId: currentAccountUser?.id })
      }).catch(() => {});
    } catch (e) {}
  }
  isGameSessionActive = false;
  stopAutoSaveAndSessionTimers();
  disableAutoAttack();
  window.SoundSystem?.stopBgm?.();

  ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui', 'party-control-modal', 'game-tip-modal', 'trade-modal-ui', 'immersive-20-modal', 'stat-alloc-modal'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  window.closeWorldMapUI?.(true);
  window.closeShireMapUI?.(true);
  // 캐릭터 선택창으로 복귀 시 저장된 인게임 모드 설정은 유지한 채 화면만 즉시 세로모드로 전환!
  window.enterPreGamePortraitView?.();

  document.getElementById('game-wrapper').style.display = 'none';
  document.getElementById('char-select-ui').style.display = 'none';
  document.getElementById('auth-overlay-ui').style.display = 'flex';
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('slot-box').style.display = 'block';

  window.partyState = null;
  window.clearAllOtherPlayersVisuals?.();
  window.otherPlayers = [];
  window.sweepOrphanPixiVisuals?.();
  purgeBrowserLocalGameCache();
  await loadAccountSharedStorage(true);
  await loadAccountCharacterSlots(true);
  renderCharacterSlots();
  startSlotScreenRealtimeSync();
};

window.logoutAccount = async function() {
  const optUi = document.getElementById('option-ui');
  if (optUi) optUi.classList.add('hidden');

  if (isGameSessionActive) {
    await saveCurrentCharacterAndStorageNow('logout', false);
  }
  sendCentralWsPacket({ type: 'LEAVE_CHAR', charId: activeCharacterId });
  if (centralWs) {
    try { centralWs.close(); } catch (e) {}
    centralWs = null;
  }
  isGameSessionActive = false;
  stopAutoSaveAndSessionTimers();
  disableAutoAttack();
  window.SoundSystem?.stopBgm?.();

  if (isSupabaseRemoteConnected && supabaseClient) {
    try { await supabaseClient.auth.signOut({ scope: 'local' }); } catch (e) {}
  }

  window.partyState = null;
  window.clearAllOtherPlayersVisuals?.();
  window.otherPlayers = [];
  window.sweepOrphanPixiVisuals?.();
  currentAccountUser = null;
  activeSlotIndex = null;
  activeCharacterId = null;
  currentSessionToken = null;
  try { localStorage.removeItem('MAGIC_ACTIVE_USER'); } catch (e) {}

  ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui', 'party-control-modal', 'game-tip-modal', 'trade-modal-ui', 'immersive-20-modal', 'stat-alloc-modal'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });
  window.closeWorldMapUI?.(true);
  window.closeShireMapUI?.(true);
  // 로그아웃 시 로그인 화면을 즉시 세로모드로 전환!
  window.enterPreGamePortraitView?.();

  document.getElementById('game-wrapper').style.display = 'none';
  document.getElementById('char-select-ui').style.display = 'none';
  document.getElementById('auth-overlay-ui').style.display = 'flex';
  document.getElementById('slot-box').style.display = 'none';
  document.getElementById('auth-box').style.display = 'block';
  window.switchAuthMode('login');
  window.restoreRememberedEmailToInput?.();
};

// 12) 브라우저 강제 종료 / 뒤로가기 / 탭 이탈 시 즉시 실시간 저장 리스너
function bindEmergencyLifecycleSaveListeners() {
  const flushEmergencySave = () => {
    if (isGameSessionActive) {
      saveCurrentCharacterAndStorageNow('emergency_exit', true);
    }
  };

  window.addEventListener('beforeunload', flushEmergencySave);
  window.addEventListener('pagehide', flushEmergencySave);
  

function isMobileOrTabletDevice() {
  const ua = navigator.userAgent || '';
  if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) return true;
  if (navigator.userAgentData && navigator.userAgentData.mobile === true) return true;
  if (navigator.maxTouchPoints > 1 && /Macintosh/i.test(ua)) return true;
  const hasTouch = (navigator.maxTouchPoints || 0) > 0 || ('ontouchstart' in window);
  const isCoarse = typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;
  const shortSide = Math.min(window.screen?.width || 9999, window.screen?.height || 9999, window.innerWidth || 9999);
  if (hasTouch && isCoarse && shortSide <= 1024) return true;
  return false;
}

function isDesktopBrowser() {
  return !isMobileOrTabletDevice();
}

let pcBgTickerTimer = null;
let pcBgWorker = null;
let pcBgLastTickAt = 0;
let mobileBgHiddenAt = 0;

function runPcBackgroundTickStep() {
  if (!document.hidden || !isGameSessionActive) return;
  const now = Date.now();
  const elapsedMs = pcBgLastTickAt > 0 ? Math.max(16, Math.min(250, now - pcBgLastTickAt)) : 50;
  pcBgLastTickAt = now;
  const deltaFrames = (elapsedMs / 1000) * 60;
  try {
    gameLoop(deltaFrames);
    window.updateHotbarCooldowns?.();
  } catch (e) {}
}

function startPcBackgroundKeepAliveLoop() {
  pcBgLastTickAt = Date.now();
  // 1) Web Worker 타이머: 브라우저 백그라운드 탭 1초 쓰로틀링(Intensive Throttling)을 완벽 우회하여 50ms(20FPS)로 자동사냥 유지!
  if (!pcBgWorker && typeof Worker !== 'undefined' && typeof Blob !== 'undefined' && typeof URL !== 'undefined') {
    try {
      const workerBlob = new Blob([
        "let t=null; onmessage=function(e){ if(e.data==='start'){ if(t)clearInterval(t); t=setInterval(()=>postMessage('tick'),50); } else if(e.data==='stop'){ if(t){clearInterval(t);t=null;} } };"
      ], { type: 'application/javascript' });
      pcBgWorker = new Worker(URL.createObjectURL(workerBlob));
      pcBgWorker.onmessage = () => runPcBackgroundTickStep();
    } catch (e) {
      pcBgWorker = null;
    }
  }
  if (pcBgWorker) {
    try { pcBgWorker.postMessage('start'); } catch (e) {}
  }
  // 2) 보조 setInterval 폴백
  if (!pcBgTickerTimer) {
    pcBgTickerTimer = setInterval(() => {
      if (!pcBgWorker) runPcBackgroundTickStep();
    }, 60);
  }
}

function stopPcBackgroundKeepAliveLoop() {
  if (pcBgWorker) {
    try { pcBgWorker.postMessage('stop'); } catch (e) {}
  }
  if (pcBgTickerTimer) {
    clearInterval(pcBgTickerTimer);
    pcBgTickerTimer = null;
  }
  pcBgLastTickAt = 0;
}

window.sendServerLogoutPacket = function(explicitCharId = null) {
  const cid = explicitCharId || activeCharacterId || window.activeCharacterId;
  if (!cid) return;
  sendCentralWsPacket({ type: 'LEAVE_CHAR', charId: cid });
  try {
    fetch('/api/characters/leave', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ charId: cid, userId: currentAccountUser?.id })
    }).catch(() => {});
  } catch (e) {}
};

// 📱 스마트폰 5초 백그라운드 경과 시 동기식(Synchronous) 즉시 로그아웃 & 캐릭터 선택창 전환 (모바일 OS가 비동기 await를 일시정지시켜도 100% 전환 보장)
window.executeMobileBgLogoutToCharSelect = function() {
  if (bgLeaveTimer) { clearTimeout(bgLeaveTimer); bgLeaveTimer = null; }
  if (bgSaveLogoutTimer) { clearTimeout(bgSaveLogoutTimer); bgSaveLogoutTimer = null; }
  mobileBgHiddenAt = 0;

  if (!isGameSessionActive) return;
  const leavingCharId = activeCharacterId;

  // 1) 즉시 Keepalive 저장 및 서버 월드 퇴장 패킷 전송 (유령 캐릭터 원천 차단)
  try { saveCurrentCharacterAndStorageNow('mobile_bg_5s_logout', true); } catch (e) {}
  window.sendServerLogoutPacket(leavingCharId);

  // 2) 인게임 세션 종료 및 캐릭터 선택 화면으로 즉시 DOM 전환 (await 대기 없이 동기 실행!)
  isGameSessionActive = false;
  if (window.player) window.player.isInvincible = false;
  stopAutoSaveAndSessionTimers();
  disableAutoAttack();
  window.SoundSystem?.stopBgm?.();

  ['equip-ui', 'inventory-ui', 'skill-ui', 'quest-ui', 'npc-modal-ui', 'option-ui', 'merc-ui', 'stat-alloc-modal'].forEach(id => {
    document.getElementById(id)?.classList.add('hidden');
  });

  document.getElementById('game-wrapper').style.display = 'none';
  document.getElementById('char-select-ui').style.display = 'none';
  document.getElementById('auth-overlay-ui').style.display = 'flex';
  document.getElementById('auth-box').style.display = 'none';
  document.getElementById('slot-box').style.display = 'block';

  window.partyState = null;
  window.clearAllOtherPlayersVisuals?.();
  window.otherPlayers = [];
  window.sweepOrphanPixiVisuals?.();
  if (Array.isArray(accountCharacters)) {
    accountCharacters.forEach(c => {
      if (c && c.id === leavingCharId) c.isOnline = false;
    });
  }
  renderCharacterSlots();
  startSlotScreenRealtimeSync();

  window.showSystemAlertModal?.(
    '📱 모바일 백그라운드 안전 로그아웃',
    '스마트폰 백그라운드 상태가 5초 이상 지속되어 데이터를 안전하게 저장하고 인게임 접속을 종료한 뒤 캐릭터 선택 화면으로 이동했습니다.\n(타 플레이어 화면에서도 유령 캐릭터가 남지 않도록 즉시 퇴장 처리되었습니다.)'
  );

  // 3) 백그라운드에서 최신 슬롯 정보 비동기 갱신
  setTimeout(async () => {
    try {
      await loadAccountSharedStorage(true);
      await loadAccountCharacterSlots(true);
      renderCharacterSlots();
    } catch (e) {}
  }, 80);
};

function handleMobileBackgroundEnter() {
  if (!isGameSessionActive || !activeCharacterId) return;
  if (mobileBgHiddenAt > 0) return;
  mobileBgHiddenAt = Date.now();

  // 백그라운드 진입 즉시 데이터 세이브(keepalive) + 서버에 모바일 백그라운드 진입 알림 (모바일 OS가 1초 뒤 JS 타이머를 얼려도 서버가 1.5초 무적 & 5초 퇴장 처리!)
  try { saveCurrentCharacterAndStorageNow('mobile_bg_enter', true); } catch (e) {}
  sendCentralWsPacket({ type: 'MOBILE_BG_ENTER', charId: activeCharacterId, userId: currentAccountUser?.id });
  try {
    fetch('/api/characters/mobile-bg', {
      method: 'POST',
      keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ charId: activeCharacterId, userId: currentAccountUser?.id, state: 'hidden' })
    }).catch(() => {});
  } catch (e) {}

  if (bgLeaveTimer) clearTimeout(bgLeaveTimer);
  if (bgSaveLogoutTimer) clearTimeout(bgSaveLogoutTimer);

  // 클라이언트 측 1.5초(2초 이내) 무적 보호 타이머
  bgLeaveTimer = setTimeout(() => {
    if (!document.hidden || !isGameSessionActive) return;
    if (window.player) window.player.isInvincible = true;
    sendCentralWsPacket({
      type: 'PLAYER_BG_STATUS',
      charId: activeCharacterId,
      bgInvincible: true
    });
    window.addChat?.("🛡️ [모바일 보호] 백그라운드 진입(2초 이내)으로 무적 보호가 작동했습니다.", "log-sys");
  }, 1500);

  // 클라이언트 측 5.0초 인게임 로그아웃 & 캐릭터 선택창 이동 타이머
  bgSaveLogoutTimer = setTimeout(() => {
    if (!document.hidden || !isGameSessionActive) return;
    window.executeMobileBgLogoutToCharSelect();
  }, 5000);
}

function handleMobileBackgroundReturn() {
  if (bgLeaveTimer) { clearTimeout(bgLeaveTimer); bgLeaveTimer = null; }
  if (bgSaveLogoutTimer) { clearTimeout(bgSaveLogoutTimer); bgSaveLogoutTimer = null; }

  const elapsedBgMs = mobileBgHiddenAt > 0 ? (Date.now() - mobileBgHiddenAt) : 0;
  mobileBgHiddenAt = 0;

  // 스마트폰 OS가 백그라운드에서 JS 타이머를 동결시켰다가 5초 이후에 복귀한 경우 -> 즉시 캐릭터 선택창으로 전환!
  if (isGameSessionActive && elapsedBgMs >= 5000) {
    window.executeMobileBgLogoutToCharSelect();
    return;
  }

  if (window.player) {
    window.player.isInvincible = false;
  }
  if (isGameSessionActive && activeCharacterId) {
    sendCentralWsPacket({ type: 'MOBILE_BG_RETURN', charId: activeCharacterId });
    sendCentralWsPacket({
      type: 'PLAYER_BG_STATUS',
      charId: activeCharacterId,
      bgInvincible: false
    });
    try {
      fetch('/api/characters/mobile-bg', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ charId: activeCharacterId, userId: currentAccountUser?.id, state: 'visible' })
      }).then(r => r.json()).then(res => {
        if (res && res.loggedOutByServer && isGameSessionActive) {
          window.executeMobileBgLogoutToCharSelect();
        }
      }).catch(() => {});
    } catch (e) {}
  }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // 💡 PC 환경: 백그라운드 전환 시에도 로그아웃되지 않고 Web Worker 보조 루프로 자동사냥 정상 유지!
    if (isDesktopBrowser()) {
      if (isGameSessionActive) {
        startPcBackgroundKeepAliveLoop();
      }
      return;
    }
    // 📱 스마트폰(모바일) 환경: 1.5초 무적 -> 5초 자동저장 & 인게임 로그아웃(유령 제거) & 캐릭터 선택창 이동
    handleMobileBackgroundEnter();
  } else {
    stopPcBackgroundKeepAliveLoop();
    if (!isDesktopBrowser()) {
      handleMobileBackgroundReturn();
    } else if (window.player) {
      window.player.isInvincible = false;
    }

    // 로그인/캐릭터 선택창 대기 중일 때만 패치 즉시 반영, 인게임 중에는 선택 모달만 표시
    window.checkServerVersionAndAutoReload(null, false);
    if (window.refreshCharacterSlotsIfWaiting) {
      window.refreshCharacterSlotsIfWaiting();
    }
  }
});

window.addEventListener('pageshow', () => {
  if (!isDesktopBrowser() && !document.hidden) {
    handleMobileBackgroundReturn();
  }
});

window.addEventListener('focus', () => {
  if (!isDesktopBrowser() && !document.hidden && mobileBgHiddenAt > 0) {
    handleMobileBackgroundReturn();
  }
});

  window.addEventListener('popstate', () => {
    if (isGameSessionActive) {
      flushEmergencySave();
      try { history.pushState({ magicInGame: true }, '', location.href); } catch (e) {}
      window.showSystemAlertModal(
        '💾 실시간 자동저장 완료',
        '뒤로가기 이동이 감지되어 현재 캐릭터와 창고 상태를 즉시 저장했습니다.\n캐릭터 선택 화면으로 이동하시겠습니까?',
        `
          <button type="button" class="auth-sub-btn" style="flex:1;" onclick="closeSystemAlertModal()">계속 게임하기</button>
          <button type="button" class="auth-primary-btn" style="flex:1;" onclick="closeSystemAlertModal(); returnToCharacterSelect();">캐릭터 선택으로</button>
        `
      );
    }
  });
}

window.initAuthAndCharacterSystem = async function() {
  setupAuthKeyboardViewportHandler();
  bindEmergencyLifecycleSaveListeners();
  purgeBrowserLocalGameCache();

  // 1. 새로고침 즉시(네트워크 대기 전) 저장된 이메일 아이디 복원!
  window.restoreRememberedEmailToInput?.();

  window.checkServerVersionAndAutoReload?.();
  const isOnline = await initSupabaseConnection();

  // 2. 수파베이스 온라인 상태가 확인된 경우에만 세션 자동 로그인 허용 (황색/오프라인이면 절대 자동 진입 금지)
  if (isOnline && isSupabaseOnlineVerified && isSupabaseRemoteConnected && supabaseClient) {
    try {
      const { data } = await supabaseClient.auth.getSession();
      if (data?.session?.user) {
        await onAccountLoginSuccess({
          id: data.session.user.id,
          email: (data.session.user.email || '').toLowerCase()
        });
        return;
      }
    } catch (e) {}
  }

  // 3. 로그인 화면 전환 및 저장된 이메일 재확인
  window.switchAuthMode('login');
  window.restoreRememberedEmailToInput?.();
};

// 모든 분할 스크립트(game_01 ~ game_07) 로드 완료 시점에 이미 window.load 이벤트가 지나간 경우 즉시 부트 실행 보장
if (document.readyState === 'complete' && !window._magicBootStarted && typeof window.onload === 'function') {
  window.onload();
}


// ============================================================================
// 🔍 12) 아이디(이메일 마스킹) 찾기 & 비밀번호 2중 검증 재설정 (직업 제외)
// ============================================================================
window.openAuthRecoveryModal = function(mode = 'id') {
  const modal = document.getElementById('auth-recovery-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  window.switchRecoveryTab(mode === 'pw' ? 'pw' : 'id');

  const curLoginEmail = (document.getElementById('auth-email')?.value || '').trim().toLowerCase();
  const pwEmailInp = document.getElementById('recovery-pw-email');
  if (pwEmailInp && curLoginEmail && !pwEmailInp.value) {
    pwEmailInp.value = curLoginEmail;
  }
};

window.closeAuthRecoveryModal = function() {
  const modal = document.getElementById('auth-recovery-modal');
  if (modal) modal.style.display = 'none';
};

window.switchRecoveryTab = function(tab = 'id') {
  const isPw = (tab === 'pw');
  const idBtn = document.getElementById('tab-rec-id-btn');
  const pwBtn = document.getElementById('tab-rec-pw-btn');
  const idPanel = document.getElementById('recovery-id-panel');
  const pwPanel = document.getElementById('recovery-pw-panel');

  if (idBtn) idBtn.classList.toggle('active', !isPw);
  if (pwBtn) pwBtn.classList.toggle('active', isPw);
  if (idPanel) idPanel.style.display = isPw ? 'none' : 'flex';
  if (pwPanel) pwPanel.style.display = isPw ? 'flex' : 'none';
};

window.executeFindAccountId = async function() {
  const queryRaw = (document.getElementById('recovery-find-query')?.value || '').trim();
  const msgEl = document.getElementById('recovery-id-msg');
  const listEl = document.getElementById('recovery-id-results');
  if (listEl) listEl.innerHTML = '';

  if (queryRaw.length < 2) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 캐릭터 이름을 2글자 이상 입력해주세요.';
    }
    return;
  }

  if (msgEl) {
    msgEl.style.color = '#93c5fd';
    msgEl.innerText = '⏳ 수파베이스 DB에서 계정 정보를 안전하게 조회 중입니다...';
  }

  if (!isSupabaseOnlineVerified) {
    await initSupabaseConnection();
  }

  let results = [];
  let searchSucceeded = false;

  // 1순위: 중앙 서버(/api/auth/find-id) 호출 - 서버가 이메일을 완전히 마스킹하여 반환 (유출 원천 차단)
  const srvRes = await callCentralServerApi('/api/auth/find-id', 'POST', { query: queryRaw });
  if (srvRes && srvRes.ok && Array.isArray(srvRes.results)) {
    results = srvRes.results;
    searchSucceeded = true;
  }

  // 2순위: 브라우저 -> Supabase 직접 조회 폴백 (클라이언트에서도 즉시 마스킹 처리)
  if (!searchSucceeded && supabaseClient) {
    try {
      const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';
      const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
      const { data: charRows, error: charErr } = await supabaseClient
        .from(charTable)
        .select('id, user_id, name, class, level, slot_index')
        .lt('slot_index', 100)
        .ilike('name', `%${queryRaw}%`)
        .limit(15);

      if (!charErr && Array.isArray(charRows) && charRows.length > 0) {
        searchSucceeded = true;
        const userIds = Array.from(new Set(charRows.map(c => c.user_id).filter(Boolean)));
        const { data: accRows } = await supabaseClient
          .from(accTable)
          .select('user_id, email')
          .in('user_id', userIds);

        const accMap = new Map();
        if (Array.isArray(accRows)) {
          for (const a of accRows) {
            const rawEmail = String(a.email || '').trim().toLowerCase();
            const at = rawEmail.indexOf('@');
            let masked = '***';
            if (at > 1) {
              const nameP = rawEmail.slice(0, at);
              const domP = rawEmail.slice(at);
              const visLen = Math.min(2, Math.max(1, Math.floor(nameP.length / 2)));
              masked = `${nameP.slice(0, visLen)}${'*'.repeat(Math.max(3, nameP.length - visLen))}${domP}`;
            }
            accMap.set(a.user_id, { maskedEmail: masked, characters: [] });
          }
        }
        for (const ch of charRows) {
          const entry = accMap.get(ch.user_id);
          if (entry) {
            entry.characters.push({ name: ch.name, class: ch.class, level: ch.level });
          }
        }
        results = Array.from(accMap.values());
      }
    } catch (_) {}
  }

  if (!searchSucceeded) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 수파베이스 서버와 통신할 수 없습니다. 잠시 후 다시 시도해주세요.';
    }
    return;
  }

  if (!results || results.length === 0) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = `⚠️ '${queryRaw}' 캐릭터를 보유한 계정을 찾을 수 없습니다.`;
    }
    return;
  }

  if (msgEl) {
    msgEl.style.color = '#4ade80';
    msgEl.innerText = `✅ 총 ${results.length}개의 일치 계정을 찾았습니다! (이메일 마스킹 보호 적용)`;
  }

  if (listEl) {
    listEl.innerHTML = results.map(item => {
      const masked = String(item.maskedEmail || '***');
      const charDesc = Array.isArray(item.characters) && item.characters.length > 0
        ? item.characters.map(c => `Lv.${c.level || 1} ${c.name}`).join(', ')
        : '캐릭터';
      return `
        <div style="background:#11141b; border:1px solid #4a3b2c; border-radius:6px; padding:7px 9px; display:flex; justify-content:space-between; align-items:center; gap:6px;">
          <div style="min-width:0; flex:1;">
            <div style="font-size:12px; font-weight:bold; color:#fde047; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">📧 ${masked}</div>
            <div style="font-size:10px; color:#93c5fd; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">⚔️ 캐릭터: ${charDesc}</div>
          </div>
          <button type="button" class="auth-sub-btn" style="width:auto; padding:4px 7px; font-size:10px; color:#93c5fd; white-space:nowrap; flex-shrink:0;" onclick="window.switchRecoveryTab('pw')">🔑 비번 재설정</button>
        </div>
      `;
    }).join('');
  }
};

window.executeResetAccountPassword = async function() {
  const emailRaw = (document.getElementById('recovery-pw-email')?.value || '').trim().toLowerCase();
  const charNameRaw = (document.getElementById('recovery-pw-char')?.value || '').trim();
  const newPassword = document.getElementById('recovery-pw-new')?.value || '';
  const confirmPassword = document.getElementById('recovery-pw-confirm')?.value || '';
  const msgEl = document.getElementById('recovery-pw-msg');

  // 🌟 2중 필수 검증: 이메일 + 보유 캐릭터 이름 모두 필수! (직업 제외)
  if (!emailRaw) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 가입한 이메일 계정을 필수로 입력해주세요.';
    }
    return;
  }
  if (!charNameRaw) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 본인 확인을 위해 해당 계정의 [보유 캐릭터 이름]을 필수로 입력해주세요.';
    }
    return;
  }
  if (!newPassword || newPassword.length < 6) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 새 비밀번호는 6자리 이상이어야 합니다.';
    }
    return;
  }
  if (newPassword !== confirmPassword) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = '⚠️ 새 비밀번호와 비밀번호 확인이 일치하지 않습니다.';
    }
    return;
  }

  if (msgEl) {
    msgEl.style.color = '#93c5fd';
    msgEl.innerText = '⏳ 수파베이스 DB에서 2중 일치 검증(이메일+캐릭터명) 후 비밀번호를 변경 중입니다...';
  }

  if (!isSupabaseOnlineVerified) {
    await initSupabaseConnection();
  }

  const newPwHash = encodePasswordHash(emailRaw, newPassword);
  let resetSuccess = false;
  let resetErrorMsg = '';

  // 1순위: 중앙 서버(/api/auth/reset-password) 호출 (2중 필수 검증)
  const srvReset = await callCentralServerApi('/api/auth/reset-password', 'POST', {
    email: emailRaw,
    charName: charNameRaw,
    newPassword,
    pw_hash: newPwHash
  });

  if (srvReset) {
    if (srvReset.ok) {
      resetSuccess = true;
    } else if (srvReset.error) {
      resetErrorMsg = srvReset.error;
    }
  }

  // 2순위: 브라우저 -> Supabase 직접 업데이트 폴백 (동일한 2중 검증 수행)
  if (!resetSuccess && supabaseClient && !resetErrorMsg) {
    try {
      const accTable = GameDB.SupabaseConfig?.tables?.accounts || 'magic_accounts';
      const charTable = GameDB.SupabaseConfig?.tables?.characters || 'magic_characters';

      const { data: accRows, error: accErr } = await supabaseClient
        .from(accTable)
        .select('*')
        .ilike('email', emailRaw)
        .limit(1);

      if (!accErr && Array.isArray(accRows) && accRows.length > 0) {
        const acc = accRows[0];
        const { data: charRows } = await supabaseClient
          .from(charTable)
          .select('name')
          .eq('user_id', acc.user_id)
          .lt('slot_index', 100);

        if (!Array.isArray(charRows) || charRows.length === 0) {
          resetErrorMsg = '해당 계정에는 생성된 캐릭터가 없습니다. 운영자에게 문의해주세요.';
        } else {
          const matched = charRows.some(c => String(c.name || '').trim().toLowerCase() === charNameRaw.toLowerCase());
          if (!matched) {
            resetErrorMsg = `입력하신 캐릭터 이름('${charNameRaw}')이 해당 이메일 계정의 보유 캐릭터와 일치하지 않습니다. (2중 본인확인 실패)`;
          } else {
            const parsedTok = parseAccountTokenString(acc.active_session_token);
            const updatedToken = buildAccountTokenString(newPwHash, parsedTok.sessionToken || '');
            const { error: upErr } = await supabaseClient
              .from(accTable)
              .update({
                active_session_token: updatedToken,
                updated_at: new Date().toISOString()
              })
              .eq('user_id', acc.user_id);

            if (!upErr) resetSuccess = true;
            else resetErrorMsg = '수파베이스 비밀번호 업데이트 중 오류가 발생했습니다.';
          }
        }
      } else if (!accErr) {
        resetErrorMsg = '수파베이스에 등록되지 않은 이메일 계정입니다. [아이디 찾기]를 먼저 이용해주세요.';
      }
    } catch (_) {}
  }

  if (!resetSuccess) {
    if (msgEl) {
      msgEl.style.color = '#f87171';
      msgEl.innerText = `⚠️ ${resetErrorMsg || '수파베이스 서버와 통신할 수 없습니다.'}`;
    }
    return;
  }

  if (msgEl) {
    msgEl.style.color = '#4ade80';
    msgEl.innerText = '✅ 2중 검증 통과! 새 비밀번호로 즉시 변경되었습니다!';
  }

  // 로그인 입력창에 변경된 이메일과 새 비밀번호 자동 입력
  const loginEmailInp = document.getElementById('auth-email');
  const loginPwInp = document.getElementById('auth-password');
  if (loginEmailInp) loginEmailInp.value = emailRaw;
  if (loginPwInp) loginPwInp.value = newPassword;
  window.switchAuthMode('login');

  setTimeout(() => {
    window.closeAuthRecoveryModal();
    const statusMsg = document.getElementById('auth-status-msg');
    if (statusMsg) {
      statusMsg.style.color = '#4ade80';
      statusMsg.innerText = '✅ 비밀번호가 재설정되었습니다! 바로 [로그인] 버튼을 눌러 접속하세요.';
    }
  }, 600);
};
