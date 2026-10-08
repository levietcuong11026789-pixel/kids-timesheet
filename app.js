// =============================================
// BẢNG CHẤM CÔNG BÉ YÊU — app.js v3.7.0
// =============================================

const CURRENT_APP_VERSION = '3.7.0';
let _isUpdatingApp = false;
let _waitingServiceWorker = null;

// Xóa cache cũ nếu version thay đổi
if (localStorage.getItem('app_v') !== CURRENT_APP_VERSION) {
  localStorage.setItem('app_v', CURRENT_APP_VERSION);
  if ('caches' in window) {
    caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k))));
  }
}

// ── TỰ ĐỘNG PHÁT HIỆN BẢN MỚI TỪ VERSION.JSON ──
async function checkAppVersionOnline() {
  if (_isUpdatingApp) return;
  try {
    const res = await fetch(`./version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return;
    const info = await res.json();
    if (info && info.version && info.version !== CURRENT_APP_VERSION) {
      console.log(`[Auto-Update] Phát hiện bản mới: ${info.version} (hiện tại: ${CURRENT_APP_VERSION})`);
      showUpdateNotification(info.version);
    }
  } catch (err) {
    // Offline hoặc mạng gián đoạn, bỏ qua
  }
}

function showUpdateNotification(newVer) {
  const banner = document.getElementById('update-banner');
  const txt = document.getElementById('update-banner-text');
  if (banner) {
    if (txt) txt.textContent = `🎉 Đã có bản cập nhật mới (${newVer})!`;
    banner.classList.add('update-banner-show');
  }
}

function hideUpdateBanner() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.classList.remove('update-banner-show');
}

async function applyUpdateNow() {
  _isUpdatingApp = true;
  hideUpdateBanner();
  showToast('🚀 Đang cập nhật phiên bản mới...');

  if (_waitingServiceWorker) {
    _waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
  }

  if ('caches' in window) {
    try {
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
    } catch (e) {}
  }

  setTimeout(() => {
    const cleanUrl = window.location.origin + window.location.pathname;
    window.location.replace(`${cleanUrl}?v=${Date.now()}`);
  }, 400);
}

// ── SERVICE WORKER REGISTRATION ──
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then(reg => {
    reg.update();
    setInterval(() => {
      reg.update();
      checkAppVersionOnline();
    }, 15000);

    if (reg.waiting) {
      _waitingServiceWorker = reg.waiting;
      showUpdateNotification('mới');
    }

    reg.addEventListener('updatefound', () => {
      const newWorker = reg.installing;
      if (!newWorker) return;
      newWorker.addEventListener('statechange', () => {
        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
          _waitingServiceWorker = newWorker;
          showUpdateNotification('mới');
        }
      });
    });
  }).catch(() => {});

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!refreshing && _isUpdatingApp) {
      refreshing = true;
      window.location.reload();
    }
  });
}

// Kiểm tra ngay khi khởi động và mỗi khi quay lại app (điện thoại/laptop)
checkAppVersionOnline();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    checkAppVersionOnline();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration().then(reg => reg && reg.update());
    }
  }
});
window.addEventListener('focus', checkAppVersionOnline);




const REWARDS = {
  sweep:      { label: 'Quét nhà',  icon: '🧹', value: 1000,  once: true },
  mop:        { label: 'Lau nhà',   icon: '🫧', value: 2000,  once: true },
  clean_room: { label: 'Dọn phòng', icon: '🛏️', value: 2000,  once: true },
  reading:    { label: 'Đọc sách',  icon: '📖', once: true },
  score:      { label: 'Điểm KT',   icon: '🏆', once: false },
  study:      { label: 'Học hôm nay', icon: '✏️', once: true },
  custom:     { label: 'Việc khác', icon: '✍️', once: false }
};

const SCORE_VALUES   = { 10: 5000, 9: 3000, 8: 1000, 7: -3000, 6: -5000 };
const STUDY_REWARDS  = { 4: 10000, 3: -2000, 2: -5000, 1: -7000, 0: -10000 };
const SUBJECTS_LIST  = [
  { id: 'sub-english', label: 'Tiếng Anh' },
  { id: 'sub-math',    label: 'Toán' },
  { id: 'sub-viet',    label: 'Viết Tiếng Việt' },
  { id: 'sub-vocab',   label: 'Từ mới Tiếng Anh' }
];

function calcReadingReward(pages) {
  if (pages < 5) return 0;
  return 3000 + (pages - 5) * 500;
}
function fmt(n) {
  const abs = Math.abs(n).toLocaleString('vi-VN');
  if (n === 0) return '0 đ';
  return (n > 0 ? '+' : '−') + abs + ' đ';
}
function fmtAbs(n) { return Math.abs(n).toLocaleString('vi-VN') + ' đ'; }
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── STATE ──────────────────────────────────────
let db, currentPin = '', selectedSubject = 'Toán', selectedScore = null;
let readingPages = 5, customAmount = 2000;
let todayTasks = {}, parentOpen = false, openingBalance = 39000;
let currentKid = 'be1';
let parentSelectedYear = new Date().getFullYear();
let parentSelectedMonth = new Date().getMonth();
function kp(p) { return 'kids/' + currentKid + '/' + p; }

async function fetchAllPendingTasks() {
  const snap = await db.ref(kp('tasks')).get();
  const allDays = snap.val() || {};
  const pending = [];
  Object.entries(allDays).forEach(([dateKey, dayTasks]) => {
    if (dayTasks && typeof dayTasks === 'object') {
      Object.entries(dayTasks).forEach(([id, t]) => {
        if (t && t.status === 'pending') {
          pending.push({ id, dateKey, ...t });
        }
      });
    }
  });
  pending.sort((a,b) => {
    if (a.dateKey !== b.dateKey) return b.dateKey.localeCompare(a.dateKey);
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
  return pending;
}

function rowHTMLParentPending(task) {
  const dateKey = task.dateKey;
  const [y, m, d] = dateKey.split('-');
  const isToday = dateKey === todayKey();
  const dateTag = isToday ? 'Hôm nay' : `Ngày ${parseInt(d)}/${parseInt(m)}`;
  const btns = buildApproveBtnsForDate(task, dateKey);
  return `<div class="task-row">
    <div class="task-row-icon">${task.icon}</div>
    <div class="task-row-info">
      <div class="task-row-name">${task.label} <span class="pending-date-tag">${dateTag}</span></div>
      ${task.subLabel ? `<div class="task-row-sub">${task.subLabel}</div>` : ''}
    </div>
    ${btns}
  </div>`;
}

function buildApproveBtnsForDate(task, dateKey) {
  const isCustom = task.type === 'custom';
  if (isCustom) {
    return `<div class="approve-area">
      <input type="number" class="amount-edit" id="p-amt-${task.id}" value="${task.value}" step="500" title="Chỉnh số tiền">
      <div class="approve-btns">
        <button class="btn-approve" onclick="approveTaskForDate('${task.id}', '${dateKey}', true)">✅</button>
        <button class="btn-reject"  onclick="rejectTaskForDate('${task.id}', '${dateKey}')">❌</button>
      </div>
    </div>`;
  }
  return `<div class="approve-btns">
    <button class="btn-approve" onclick="approveTaskForDate('${task.id}', '${dateKey}', false)">✅</button>
    <button class="btn-reject"  onclick="rejectTaskForDate('${task.id}', '${dateKey}')">❌</button>
  </div>`;
}

// ── INIT ───────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.startsWith('REPLACE')) {
    hide('loading-screen'); show('setup-screen'); return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    migrateOldData().then(() => initApp());
  } catch(e) { hide('loading-screen'); show('setup-screen'); }
});

// Migrate old flat data to kids/be1/
async function migrateOldData() {
  const migrated = await db.ref('_migrated').get();
  if (migrated.val()) return;
  const oldTasks = await db.ref('tasks').get();
  const oldSettings = await db.ref('settings').get();
  if (oldTasks.val()) await db.ref('kids/be1/tasks').set(oldTasks.val());
  if (oldSettings.val()) await db.ref('kids/be1/settings').set(oldSettings.val());
  // Set default for be2
  await db.ref('kids/be2/settings').set({ childName: 'Bé Hai', parentPin: '1234', openingBalance: 0, totalEarned: 0 });
  await db.ref('_migrated').set(true);
}

let _taskListener = null, _settingsListener = null;

async function initApp() {
  // Detach old listeners
  if (_taskListener) db.ref(_taskListener).off();
  if (_settingsListener) db.ref(_settingsListener).off();

  // Update kid tabs UI
  document.querySelectorAll('.kid-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + currentKid)?.classList.add('active');

  const snap = await db.ref(kp('settings')).get();
  const s = snap.val() || {};

  // Set defaults
  if (!s.parentPin)       await db.ref(kp('settings/parentPin')).set('1234');
  if (s.openingBalance === undefined) await db.ref(kp('settings/openingBalance')).set(0);
  if (s.totalEarned  === undefined)   await db.ref(kp('settings/totalEarned')).set(0);

  openingBalance = s.openingBalance ?? 0;

  const childName = s.childName || (currentKid === 'be1' ? 'Bé Lớn' : 'Bé Nhỏ');
  document.getElementById('child-name-display').textContent = childName;
  document.getElementById('name-input').value = childName;
  document.getElementById('balance-input').value = openingBalance;

  const now  = new Date();
  const days = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  document.getElementById('date-display').textContent =
    `${days[now.getDay()]}, ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

  // Real-time listener for today's tasks
  const taskPath = kp(`tasks/${todayKey()}`);
  _taskListener = taskPath;
  db.ref(taskPath).on('value', snap => {
    todayTasks = snap.val() || {};
    renderChildView();
    if (parentOpen) renderParentView();
  });

  // Real-time listener for settings (balance updates)
  const settingsPath = kp('settings');
  _settingsListener = settingsPath;
  db.ref(settingsPath).on('value', snap => {
    const sv = snap.val() || {};
    openingBalance = sv.openingBalance ?? 0;
    updateTotalBalance(sv.totalEarned ?? 0);
  });

  await loadTaskConfig();
  setupDragReorder();
  hide('loading-screen'); show('app');
}

function switchKid(kid) {
  if (kid === currentKid) return;
  // Detach old listeners
  if (_taskListener) { db.ref(_taskListener).off(); _taskListener = null; }
  if (_settingsListener) { db.ref(_settingsListener).off(); _settingsListener = null; }
  currentKid = kid;
  todayTasks = {};
  parentOpen = false;
  hide('parent-view');
  initApp();
}

// ── TOTAL BALANCE ──────────────────────────────
function updateTotalBalance(totalEarned) {
  const total = openingBalance + (totalEarned || 0);
  document.getElementById('total-balance').textContent = total.toLocaleString('vi-VN') + ' đ';
}

// ── RENDER CHILD VIEW ──────────────────────────
function renderChildView() {
  let todayTotal = 0;
  const pending = [], approved = [];

  Object.entries(todayTasks).forEach(([id, task]) => {
    if (task.status === 'approved') { todayTotal += task.value; approved.push({ id, ...task }); }
    else if (task.status === 'pending') pending.push({ id, ...task });
  });

  // Today & month display
  const todayEl = document.getElementById('today-amount');
  todayEl.textContent = fmt(todayTotal);
  todayEl.className = todayTotal >= 0 ? 'green-txt' : 'red-txt';
  loadMonthTotal();

  // Re-render dynamic task grid with status
  renderTaskGrid();

  // Pending list
  const pEl = document.getElementById('pending-list');
  pEl.innerHTML = pending.length ? pending.map(t => rowHTML(t, false)).join('') : '<div class="empty-msg">Chưa có việc nào chờ duyệt 😊</div>';

  // Approved list
  const aEl = document.getElementById('approved-list');
  aEl.innerHTML = approved.length ? approved.map(t => rowHTML(t, false)).join('') : '<div class="empty-msg">Hãy làm việc để kiếm tiền nào! 💪</div>';
}

function rowHTML(task, showBtns) {
  const cls = task.value >= 0 ? 'green' : 'red';
  const valStr = `${task.value >= 0 ? '+' : '−'}${Math.abs(task.value).toLocaleString('vi-VN')} đ`;
  const btns = showBtns ? buildApproveBtns(task) : `<div class="task-row-val ${cls}">${valStr}</div>`;
  return `<div class="task-row">
    <div class="task-row-icon">${task.icon}</div>
    <div class="task-row-info">
      <div class="task-row-name">${task.label}</div>
      ${task.subLabel ? `<div class="task-row-sub">${task.subLabel}</div>` : ''}
    </div>
    ${btns}
  </div>`;
}

function buildApproveBtns(task) {
  if (task.type === 'custom') {
    return `<div class="approve-area">
      <input type="number" class="amount-edit" id="amt-${task.id}" value="${task.value}" step="500" title="Chỉnh số tiền">
      <div class="approve-btns">
        <button class="btn-approve" onclick="approveTask('${task.id}', true)">✅</button>
        <button class="btn-reject"  onclick="rejectTask('${task.id}')">❌</button>
      </div>
    </div>`;
  }
  return `<div class="approve-btns">
    <button class="btn-approve" onclick="approveTask('${task.id}', false)">✅</button>
    <button class="btn-reject"  onclick="rejectTask('${task.id}')">❌</button>
  </div>`;
}

// ── MONTH TOTAL ────────────────────────────────
async function loadMonthTotal() {
  const snap = await db.ref(kp('tasks')).orderByKey()
    .startAt(monthPrefix()).endAt(monthPrefix()+'\uf8ff').get();
  let total = 0;
  if (snap.val()) Object.values(snap.val()).forEach(day =>
    Object.values(day).forEach(t => { if(t.status==='approved') total+=t.value; }));
  document.getElementById('month-amount').textContent = total.toLocaleString('vi-VN') + ' đ';
}

// ── SUBMIT TASKS ───────────────────────────────
async function submitTask(type) {
  const cfg = REWARDS[type];
  if (cfg.once) {
    const already = Object.values(todayTasks).some(
      t => t.type === type && (t.status==='pending'||t.status==='approved'));
    if (already) { showToast('⏳ Đã đăng ký rồi!'); return; }
  }
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type, label: cfg.label, icon: cfg.icon, value: cfg.value,
    status: 'pending', createdAt: Date.now()
  });
  spawnCoin(); playSound('submit'); showToast('📤 Đã gửi! Chờ Ba/Mẹ duyệt ⏳');
}

// Study
function openStudyModal() {
  const already = Object.values(todayTasks).some(
    t => t.type==='study' && (t.status==='pending'||t.status==='approved'));
  if (already) { showToast('📚 Đã đăng ký học rồi!'); return; }
  SUBJECTS_LIST.forEach(s => { const el=document.getElementById(s.id); if(el) el.checked=false; });
  document.getElementById('study-preview').textContent = 'Chọn môn để xem kết quả';
  document.getElementById('study-preview').style.color = 'var(--gold)';
  show('study-modal');
}
function closeStudyModal() { hide('study-modal'); }
function updateStudyPreview() {
  const count = SUBJECTS_LIST.filter(s => document.getElementById(s.id)?.checked).length;
  const val   = STUDY_REWARDS[count];
  const prev  = document.getElementById('study-preview');
  if (count === 0) {
    prev.innerHTML = 'Hãy chọn ít nhất 1 môn đã học'; prev.style.color='var(--text-dim)'; return;
  }
  const done  = SUBJECTS_LIST.filter(s => document.getElementById(s.id)?.checked).map(s=>s.label).join(', ');
  if (val > 0) {
    prev.innerHTML = `🎉 Học đủ 4 môn! <b>+${val.toLocaleString('vi-VN')} đ</b>`;
    prev.style.color = 'var(--green)';
  } else {
    prev.innerHTML = `⚠️ Thiếu ${4-count} môn → <b>−${Math.abs(val).toLocaleString('vi-VN')} đ</b>`;
    prev.style.color = 'var(--red)';
  }
}
async function submitStudyTask() {
  const checked = SUBJECTS_LIST.filter(s => document.getElementById(s.id)?.checked);
  if (checked.length === 0) { showToast('⚠️ Chọn ít nhất 1 môn!'); return; }
  const count = checked.length;
  const value = STUDY_REWARDS[count];
  const subLabel = count === 4 ? 'Học đủ 4 môn ✅' : `Học ${count}/4 môn: ${checked.map(s=>s.label).join(', ')}`;
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type:'study', label:'Học hôm nay', icon:'✏️', subLabel, value,
    status:'pending', createdAt:Date.now()
  });
  closeStudyModal(); spawnCoin(); playSound('submit');
  showToast(count===4 ? '🎉 Học đủ 4 môn! Chờ Ba/Mẹ duyệt' : `⚠️ Học ${count}/4 môn, chờ Ba/Mẹ duyệt`);
}

// Reading
function openReadingModal() {
  const already = Object.values(todayTasks).some(
    t => t.type==='reading' && (t.status==='pending'||t.status==='approved'));
  if (already) { showToast('📖 Đã đăng ký đọc sách rồi!'); return; }
  readingPages = 5; updateReadingUI(); show('reading-modal');
}
function closeReadingModal() { hide('reading-modal'); }
function changePages(d) { readingPages = Math.max(1, readingPages+d); updateReadingUI(); }
function updateReadingUI() {
  document.getElementById('pages-count').textContent = readingPages;
  const r   = calcReadingReward(readingPages);
  const prev = document.getElementById('reading-preview');
  if (readingPages < 5) { prev.innerHTML='⚠️ Cần ít nhất <b>5 trang</b>'; prev.style.color='var(--red)'; }
  else { prev.innerHTML=`Sẽ nhận: <b>${r.toLocaleString('vi-VN')} đ</b>`; prev.style.color='var(--gold)'; }
}
async function submitReadingTask() {
  if (readingPages < 5) { showToast('📖 Cần ít nhất 5 trang!'); return; }
  const value = calcReadingReward(readingPages);
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type:'reading', label:'Đọc sách', icon:'📖',
    subLabel:`${readingPages} trang`, value, status:'pending', createdAt:Date.now()
  });
  closeReadingModal(); spawnCoin(); playSound('submit'); showToast(`📚 Đã gửi ${readingPages} trang! ⏳`);
}

// Score
function openScoreModal() {
  selectedSubject='Toán'; selectedScore=null;
  document.querySelectorAll('#subject-pills .pill').forEach((p,i)=>p.classList.toggle('active',i===0));
  document.querySelectorAll('#score-pills .pill').forEach(p=>p.classList.remove('active'));
  document.getElementById('score-preview').textContent='Chọn điểm để xem thưởng';
  document.getElementById('score-submit').disabled=true;
  show('score-modal');
}
function closeScoreModal() { hide('score-modal'); }
function selectPill(el, group) {
  el.parentElement.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  if(group==='subject') selectedSubject=el.dataset.val;
  else { selectedScore=parseInt(el.dataset.val); updateScorePreview(); }
}
function updateScorePreview() {
  const val=SCORE_VALUES[selectedScore]||0;
  const prev=document.getElementById('score-preview');
  if(val>=0){prev.innerHTML=`🎉 Điểm ${selectedScore}: <b>+${val.toLocaleString('vi-VN')} đ</b>`;prev.style.color='var(--green)';}
  else{prev.innerHTML=`😢 Điểm ${selectedScore}: <b>−${Math.abs(val).toLocaleString('vi-VN')} đ</b>`;prev.style.color='var(--red)';}
  document.getElementById('score-submit').disabled=false;
}
async function submitScoreTask() {
  if(selectedScore===null) return;
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type:'score', label:`Điểm ${selectedSubject}`, icon:'🏆',
    subLabel:`Điểm ${selectedScore}`, value:SCORE_VALUES[selectedScore],
    status:'pending', createdAt:Date.now()
  });
  closeScoreModal(); spawnCoin(); playSound('submit'); showToast(`🏆 Đã gửi điểm ${selectedScore}! ⏳`);
}

// Custom task
function openCustomModal() { customAmount=2000; updateCustomPreview(); show('custom-modal'); }
function closeCustomModal() { hide('custom-modal'); }
function changeCustomAmount(d) { customAmount=Math.max(500, customAmount+d); updateCustomPreview(); }
function updateCustomPreview() {
  document.getElementById('custom-amount').textContent=customAmount.toLocaleString('vi-VN');
}
async function submitCustomTask() {
  const name=document.getElementById('custom-task-name').value.trim();
  if(!name){showToast('⚠️ Con cần ghi tên công việc!');return;}
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type:'custom', label:name, icon:'✍️',
    subLabel:`Đề xuất: ${customAmount.toLocaleString('vi-VN')} đ`,
    value:customAmount, status:'pending', createdAt:Date.now()
  });
  document.getElementById('custom-task-name').value='';
  closeCustomModal(); spawnCoin(); playSound('submit'); showToast('📤 Đã gửi đề xuất! Ba/Mẹ sẽ xem và duyệt ⏳');
}

// ── PARENT VIEW ────────────────────────────────
function openPinModal() { currentPin=''; updatePinDots(); hide('pin-err'); show('pin-modal'); }
function closePinModal() { hide('pin-modal'); }
function pinKey(d) { if(currentPin.length>=4)return; currentPin+=d; updatePinDots(); if(currentPin.length===4)setTimeout(pinConfirm,200); }
function pinBackspace() { currentPin=currentPin.slice(0,-1); updatePinDots(); }
function updatePinDots() { document.querySelectorAll('#pin-dots span').forEach((s,i)=>s.classList.toggle('filled',i<currentPin.length)); }
async function pinConfirm() {
  const snap=await db.ref(kp('settings/parentPin')).get();
  if(currentPin===(snap.val()||'1234')){ closePinModal(); openParentView(); }
  else { show('pin-err'); currentPin=''; updatePinDots(); setTimeout(()=>hide('pin-err'),2000); }
}
function openParentView() {
  parentOpen = true;
  const now = new Date();
  parentSelectedYear = now.getFullYear();
  parentSelectedMonth = now.getMonth();
  renderParentView();
  show('parent-view');
}
function closeParentView() { parentOpen = false; hide('parent-view'); }

function changeParentMonth(delta) {
  parentSelectedMonth += delta;
  if (parentSelectedMonth < 0) { parentSelectedMonth = 11; parentSelectedYear--; }
  if (parentSelectedMonth > 11) { parentSelectedMonth = 0; parentSelectedYear++; }
  renderMonthlyBreakdown();
}

async function renderParentView() {
  const pending = await fetchAllPendingTasks();
  const pEl = document.getElementById('parent-pending-list');
  pEl.innerHTML = pending.length
    ? pending.map(t => rowHTMLParentPending(t)).join('')
    : '<div class="empty-msg">Không có gì cần duyệt ✨</div>';

  let earned = 0, deducted = 0;
  Object.values(todayTasks).forEach(t => {
    if (t.status === 'approved') { if (t.value >= 0) earned += t.value; else deducted += t.value; }
  });
  const tot = earned + deducted;
  document.getElementById('parent-earned').textContent = fmtAbs(earned);
  document.getElementById('parent-deducted').textContent = fmtAbs(deducted);
  const tEl = document.getElementById('parent-today-total');
  tEl.textContent = fmt(tot); tEl.style.color = tot >= 0 ? 'var(--green)' : 'var(--red)';

  await renderMonthlyBreakdown();
  await loadPaymentHistory();
}

async function renderMonthlyBreakdown() {
  const prefix = `${parentSelectedYear}-${String(parentSelectedMonth + 1).padStart(2, '0')}`;
  const labelEl = document.getElementById('parent-month-label');
  if (labelEl) labelEl.textContent = `Tháng ${parentSelectedMonth + 1}/${parentSelectedYear}`;

  const snap = await db.ref(kp('tasks')).orderByKey()
    .startAt(prefix).endAt(prefix + '\uf8ff').get();
  const data = snap.val() || {};
  let monthTotal = 0;
  const rows = Object.entries(data).sort(([a],[b]) => b.localeCompare(a)).map(([dk, dayTasks]) => {
    let d = 0, pendingCount = 0;
    Object.values(dayTasks).forEach(t => {
      if (t.status === 'approved') d += t.value;
      if (t.status === 'pending') pendingCount++;
    });
    monthTotal += d;
    const [,,dd] = dk.split('-');
    const pendingBadge = pendingCount > 0
      ? `<span class="pending-badge">⏳ ${pendingCount} chờ duyệt</span>`
      : '';
    return `<div class="day-row day-row-clickable${pendingCount > 0 ? ' has-pending' : ''}" onclick="openParentDayDetail('${dk}')">
      <span class="day-row-date">Ngày ${parseInt(dd)}</span>
      <div class="day-row-right">
        ${pendingBadge}
        <span class="day-row-val ${d >= 0 ? 'pos' : 'neg'}">${fmt(d)}</span>
      </div>
    </div>`;
  });
  document.getElementById('monthly-list').innerHTML = rows.join('') || '<div class="empty-msg">Chưa có dữ liệu tháng này</div>';
  const mEl = document.getElementById('parent-month-total');
  mEl.textContent = fmt(monthTotal); mEl.style.color = monthTotal >= 0 ? 'var(--green)' : 'var(--red)';
  const totLabelEl = document.getElementById('parent-month-total-label');
  if (totLabelEl) totLabelEl.textContent = `Tổng tháng ${parentSelectedMonth + 1}/${parentSelectedYear}`;
}

// ── PARENT DAY DETAIL MODAL ────────────────────
let parentDayDetailKey = null;

async function openParentDayDetail(dateKey) {
  parentDayDetailKey = dateKey;
  const [y, m, d] = dateKey.split('-');
  document.getElementById('pday-date-title').textContent = `📋 Ngày ${parseInt(d)} tháng ${parseInt(m)} năm ${y}`;
  await renderParentDayDetail(dateKey);
  show('parent-day-modal');
}

function closeParentDayModal() {
  hide('parent-day-modal');
  parentDayDetailKey = null;
}

async function renderParentDayDetail(dateKey) {
  const snap = await db.ref(kp(`tasks/${dateKey}`)).get();
  const data = snap.val() || {};
  const tasks = Object.entries(data).map(([id, t]) => ({ id, ...t }));

  const pending  = tasks.filter(t => t.status === 'pending');
  const approved = tasks.filter(t => t.status === 'approved');
  const rejected = tasks.filter(t => t.status === 'rejected');

  let net = approved.reduce((s, t) => s + t.value, 0);

  // Summary header
  const isToday = dateKey === todayKey();
  document.getElementById('pday-summary').innerHTML = `
    <div class="pday-stat-pill ${pending.length>0?'has-pending':''}">
      <span>⏳ Chờ</span><strong>${pending.length}</strong>
    </div>
    <div class="pday-stat-pill">
      <span>✅ Duyệt</span><strong class="green">${approved.length}</strong>
    </div>
    <div class="pday-stat-pill">
      <span>❌ Từ chối</span><strong class="red">${rejected.length}</strong>
    </div>
  `;

  let html = '';

  // Pending section with approve/reject buttons
  if (pending.length) {
    html += `<div class="det-section-label">⏳ Chờ duyệt (${pending.length})</div>`;
    pending.forEach(t => {
      const isCustom = t.type === 'custom';
      const valStr = t.value >= 0
        ? `+${t.value.toLocaleString('vi-VN')}đ`
        : `−${Math.abs(t.value).toLocaleString('vi-VN')}đ`;
      html += `<div class="det-task-row pday-pending-row" id="pday-row-${t.id}">
        <div class="det-task-left">
          <span class="det-task-name">${t.icon} ${t.label}</span>
          ${t.subLabel ? `<br><small class="det-sub">${t.subLabel}</small>` : ''}
        </div>
        <div class="pday-approve-area">
          ${isCustom ? `<input type="number" class="amount-edit" id="pday-amt-${t.id}" value="${t.value}" step="500" title="Chỉnh số tiền">` : `<span class="det-task-val ${t.value>=0?'green':'red'}">${valStr}</span>`}
          <div class="approve-btns">
            <button class="btn-approve" onclick="approveTaskForDate('${t.id}','${dateKey}',${isCustom})">✅</button>
            <button class="btn-reject"  onclick="rejectTaskForDate('${t.id}','${dateKey}')">❌</button>
          </div>
        </div>
      </div>`;
    });
  }

  // Approved section
  if (approved.length) {
    html += `<div class="det-section-label">✅ Đã duyệt</div>`;
    approved.forEach(t => {
      const cls = t.value >= 0 ? 'green' : 'red';
      const valStr = t.value >= 0 ? `+${t.value.toLocaleString('vi-VN')}đ` : `−${Math.abs(t.value).toLocaleString('vi-VN')}đ`;
      html += `<div class="det-task-row">
        <span class="det-task-left"><span class="det-task-name">${t.icon} ${t.label}</span>${t.subLabel?`<br><small class="det-sub">${t.subLabel}</small>`:''}</span>
        <span class="det-task-val ${cls}">${valStr}</span>
      </div>`;
    });
  }

  // Rejected section
  if (rejected.length) {
    html += `<div class="det-section-label">❌ Đã từ chối</div>`;
    rejected.forEach(t => {
      html += `<div class="det-task-row" style="opacity:.55">
        <span class="det-task-left"><span class="det-task-name">${t.icon} ${t.label}</span>${t.subLabel?`<br><small class="det-sub">${t.subLabel}</small>`:''}</span>
        <span class="det-task-val" style="color:var(--text-dim);text-decoration:line-through">${t.value>=0?'+':'−'}${Math.abs(t.value).toLocaleString('vi-VN')}đ</span>
      </div>`;
    });
  }

  if (!tasks.length) {
    html = '<div class="empty-msg" style="padding:24px 0">Chưa có hoạt động nào 📝</div>';
  }

  // Total row
  const totalCls = net >= 0 ? 'green' : 'red';
  html += `<div class="det-total-row">
    <span>Tổng thu nhập ngày này:</span>
    <span class="${totalCls} fw">${net>=0?'+':'−'}${Math.abs(net).toLocaleString('vi-VN')} đ</span>
  </div>`;

  document.getElementById('pday-task-list').innerHTML = html;
}

async function approveTaskForDate(id, dateKey, isCustom) {
  const snap = await db.ref(kp(`tasks/${dateKey}/${id}`)).get();
  const task = snap.val();
  if (!task || task.status !== 'pending') return;

  let finalValue = task.value;
  if (isCustom) {
    const inp = document.getElementById(`p-amt-${id}`) || document.getElementById(`pday-amt-${id}`) || document.getElementById(`cal-amt-${id}`) || document.getElementById(`amt-${id}`);
    if (inp) finalValue = parseInt(inp.value) || task.value;
    await db.ref(kp(`tasks/${dateKey}/${id}/value`)).set(finalValue);
  }
  await db.ref(kp(`tasks/${dateKey}/${id}/status`)).set('approved');
  await db.ref(kp('settings/totalEarned')).transaction(c => (c||0) + finalValue);

  playSound('approve'); showToast('✅ Đã duyệt! Bé được thưởng 🎉');
  if (parentDayDetailKey === dateKey) await renderParentDayDetail(dateKey);
  if (parentOpen) await renderParentView();
}

async function rejectTaskForDate(id, dateKey) {
  await db.ref(kp(`tasks/${dateKey}/${id}/status`)).set('rejected');
  playSound('reject'); showToast('❌ Đã từ chối nhiệm vụ này');
  if (parentDayDetailKey === dateKey) await renderParentDayDetail(dateKey);
  if (parentOpen) await renderParentView();
}

async function approveTask(id, isCustom) {
  const task=todayTasks[id]; if(!task||task.status!=='pending') return;
  let finalValue=task.value;
  if(isCustom){
    const inp=document.getElementById(`amt-${id}`);
    if(inp) finalValue=parseInt(inp.value)||task.value;
    await db.ref(kp(`tasks/${todayKey()}/${id}/value`)).set(finalValue);
  }
  await db.ref(kp(`tasks/${todayKey()}/${id}/status`)).set('approved');
  await db.ref(kp('settings/totalEarned')).transaction(c=>(c||0)+finalValue);
  playSound('approve'); showToast('✅ Đã duyệt! Bé được thưởng 🎉');
}
async function rejectTask(id) {
  await db.ref(kp(`tasks/${todayKey()}/${id}/status`)).set('rejected');
  playSound('reject'); showToast('❌ Đã từ chối nhiệm vụ này');
}

async function saveChildName() {
  const n=document.getElementById('name-input').value.trim()||'Bé Yêu';
  await db.ref(kp('settings/childName')).set(n);
  document.getElementById('child-name-display').textContent=n;
  showToast('💾 Đã lưu tên bé!');
}
async function saveNewPin() {
  const v=document.getElementById('pin-input-new').value.trim();
  if(!/^\d{4}$/.test(v)){showToast('⚠️ PIN phải là 4 chữ số!');return;}
  await db.ref(kp('settings/parentPin')).set(v);
  document.getElementById('pin-input-new').value='';
  showToast('🔐 Đã đổi PIN!');
}
async function saveBalance() {
  const v=parseInt(document.getElementById('balance-input').value)||0;
  await db.ref(kp('settings/openingBalance')).set(v);
  showToast('💰 Đã cập nhật số dư!');
}

// ── UI HELPERS ─────────────────────────────────
function show(id){document.getElementById(id)?.classList.remove('hidden');}
function hide(id){document.getElementById(id)?.classList.add('hidden');}
function showToast(msg){
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.remove('hidden');
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.add('hidden'),3000);
}

// ── CONFIRM MODAL ──────────────────────────────
function showConfirmModal(title, body, confirmLabel, onConfirm) {
  document.getElementById('confirm-title').textContent   = title;
  document.getElementById('confirm-body').textContent    = body;
  document.getElementById('confirm-ok-btn').textContent  = confirmLabel;
  document.getElementById('confirm-ok-btn').onclick = () => {
    hide('confirm-modal');
    onConfirm();
  };
  show('confirm-modal');
}
function closeConfirmModal() { hide('confirm-modal'); }
// ── CHANGE PIN MODAL ──────────────────────────
// Step: 'old' → 'new' → 'confirm'
let chpinStep = 'old', chpinBuf = '', chpinNewVal = '';

function openChangePinModal() {
  chpinStep = 'old'; chpinBuf = ''; chpinNewVal = '';
  document.getElementById('chpin-title').textContent = 'Nhập PIN hiện tại';
  document.getElementById('chpin-sub').textContent   = 'Xác nhận trước khi đổi';
  updateChpinDots(); hide('chpin-err');
  show('change-pin-modal');
}
function closeChangePinModal() { hide('change-pin-modal'); }

function chpinKey(d) {
  if (chpinBuf.length >= 4) return;
  chpinBuf += d; updateChpinDots();
  if (chpinBuf.length === 4) setTimeout(chpinNext, 200);
}
function chpinBack() { chpinBuf = chpinBuf.slice(0,-1); updateChpinDots(); }
function updateChpinDots() {
  document.querySelectorAll('#chpin-dots span').forEach((s,i) =>
    s.classList.toggle('filled', i < chpinBuf.length));
}
function showChpinErr(msg) {
  const el = document.getElementById('chpin-err');
  el.textContent = '❌ ' + msg; el.classList.remove('hidden');
  setTimeout(() => el.classList.add('hidden'), 2200);
  chpinBuf = ''; updateChpinDots();
}

async function chpinNext() {
  if (chpinStep === 'old') {
    // Verify current PIN
    const snap = await db.ref(kp('settings/parentPin')).get();
    const correct = snap.val() || '1234';
    if (chpinBuf !== correct) { showChpinErr('PIN cũ không đúng!'); return; }
    // Move to new PIN
    chpinStep = 'new'; chpinBuf = '';
    document.getElementById('chpin-title').textContent = 'Nhập PIN mới';
    document.getElementById('chpin-sub').textContent   = 'Chọn mã PIN mới (4 chữ số)';
    updateChpinDots();

  } else if (chpinStep === 'new') {
    if (chpinBuf.length < 4) { showChpinErr('Nhập đủ 4 số!'); return; }
    chpinNewVal = chpinBuf; chpinBuf = '';
    chpinStep = 'confirm';
    document.getElementById('chpin-title').textContent = 'Xác nhận PIN mới';
    document.getElementById('chpin-sub').textContent   = 'Nhập lại PIN mới vừa chọn';
    updateChpinDots();

  } else if (chpinStep === 'confirm') {
    if (chpinBuf !== chpinNewVal) {
      showChpinErr('PIN không khớp, thử lại!');
      chpinStep = 'new'; chpinBuf = '';
      document.getElementById('chpin-title').textContent = 'Nhập PIN mới';
      document.getElementById('chpin-sub').textContent   = 'Chọn mã PIN mới (4 chữ số)';
      updateChpinDots(); return;
    }
    await db.ref(kp('settings/parentPin')).set(chpinNewVal);
    closeChangePinModal();
    showToast('🔐 Đã đổi mật khẩu PIN thành công!');
  }
}

function spawnCoin(){
  const layer=document.getElementById('fx-layer');
  for(let i=0;i<5;i++) setTimeout(()=>{
    const el=document.createElement('div'); el.className='coin-fx'; el.textContent='💰';
    el.style.left=(20+Math.random()*60)+'vw'; el.style.top=(30+Math.random()*40)+'vh';
    layer.appendChild(el); setTimeout(()=>el.remove(),1300);
  },i*120);
}

// ── STATS SYSTEM ───────────────────────────────
let currentStatTab = 'day';

function openStatsModal() {
  currentStatTab = 'day';
  // Reset all tabs
  ['day','week','month','rank'].forEach(t => {
    document.getElementById(`stab-${t}`)?.classList.remove('active');
    document.getElementById(`spanel-${t}`)?.classList.add('hidden');
  });
  document.getElementById('stab-day').classList.add('active');
  document.getElementById('spanel-day').classList.remove('hidden');
  loadDayStats();
  show('stats-modal');
}
function closeStatsModal() { hide('stats-modal'); }

function switchStatTab(tab) {
  ['day','week','month','rank'].forEach(t => {
    document.getElementById(`stab-${t}`)?.classList.remove('active');
    document.getElementById(`spanel-${t}`)?.classList.add('hidden');
  });
  document.getElementById(`stab-${tab}`).classList.add('active');
  document.getElementById(`spanel-${tab}`).classList.remove('hidden');
  currentStatTab = tab;
  if (tab === 'day')   loadDayStats();
  if (tab === 'week')  loadWeekStats();
  if (tab === 'month') loadMonthStats();
  if (tab === 'rank')  loadRankStats();
}

// ── DAY STATS ──────────────────────────────────
function loadDayStats() {
  const approved = Object.values(todayTasks).filter(t => t.status === 'approved');
  const total = approved.reduce((s,t) => s + t.value, 0);

  const heroEl = document.getElementById('stat-day-hero');
  heroEl.textContent = total.toLocaleString('vi-VN') + ' đ';
  heroEl.style.color = total >= 0 ? 'var(--green)' : 'var(--red)';

  if (!approved.length) {
    document.getElementById('stat-day-tasks').innerHTML = '<div class="empty-msg">Chưa có việc nào được duyệt hôm nay</div>';
    return;
  }
  const rows = approved.sort((a,b) => b.value - a.value).map(t => {
    const cls = t.value >= 0 ? 'green' : 'red';
    return `<div class="stat-row">
      <span>${t.icon} ${t.label}${t.subLabel ? ` <small>${t.subLabel}</small>` : ''}</span>
      <span class="${cls} fw">${t.value>=0?'+':'−'}${Math.abs(t.value).toLocaleString('vi-VN')} đ</span>
    </div>`;
  }).join('');
  document.getElementById('stat-day-tasks').innerHTML = rows;
}

// ── WEEK STATS ─────────────────────────────────
async function loadWeekStats() {
  const now = new Date();
  // Get Monday of this week
  const dow = now.getDay(); // 0=Sun
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dow === 0 ? 6 : dow - 1));

  const dayNames = ['CN','T2','T3','T4','T5','T6','T7'];
  const dayKeys = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dayKeys.push({
      key: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`,
      label: `${dayNames[d.getDay()]} ${d.getDate()}/${d.getMonth()+1}`,
      date: d
    });
  }

  // Query Firebase for week range
  const startKey = dayKeys[0].key, endKey = dayKeys[6].key;
  const snap = await db.ref(kp('tasks')).orderByKey().startAt(startKey).endAt(endKey + '\uf8ff').get();
  const data = snap.val() || {};

  let weekTotal = 0, bestDay = null, bestVal = -Infinity;
  const rows = dayKeys.map(({key, label, date}) => {
    const dayData = data[key] || {};
    const approved = Object.values(dayData).filter(t => t.status === 'approved');
    const val = approved.reduce((s,t) => s+t.value, 0);
    if (approved.length && val > bestVal) { bestVal = val; bestDay = label; }
    weekTotal += val;
    const isFuture = date > now;
    const cls = val >= 0 ? 'green' : 'red';
    const isToday = key === todayKey();
    return `<div class="stat-row${isToday?' stat-today':''}">
      <span>${label}${isToday?' 👈':''}</span>
      <span class="${isFuture?'dim':''}">
        ${isFuture ? '—' : `<span class="${cls} fw">${val>=0?'+':'−'}${Math.abs(val).toLocaleString('vi-VN')} đ</span>`}
        ${approved.length ? `<small class="dim">(${approved.length} việc)</small>` : ''}
      </span>
    </div>`;
  }).join('');

  const heroEl = document.getElementById('stat-week-hero');
  heroEl.textContent = weekTotal.toLocaleString('vi-VN') + ' đ';
  heroEl.style.color = weekTotal >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('stat-week-days').innerHTML = rows;
  document.getElementById('stat-week-best').innerHTML = bestDay
    ? `🌟 <b>Ngày tốt nhất:</b> ${bestDay} — <span class="green fw">+${bestVal.toLocaleString('vi-VN')} đ</span>`
    : '';
}

// ── MONTH STATS ────────────────────────────────
async function loadMonthStats() {
  const now = new Date();
  const prefix = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const snap = await db.ref(kp('tasks')).orderByKey()
    .startAt(prefix).endAt(prefix+'\uf8ff').get();
  const data = snap.val() || {};

  let monthTotal = 0, totalTasks = 0, earnedDays = 0;
  const weekMap = {}; // week number → total

  Object.entries(data).forEach(([dateKey, dayData]) => {
    const approved = Object.values(dayData).filter(t => t.status === 'approved');
    const dayVal = approved.reduce((s,t) => s+t.value, 0);
    if (approved.length) { totalTasks += approved.length; earnedDays++; }
    monthTotal += dayVal;

    // Week grouping
    const d = new Date(dateKey);
    const weekNum = Math.ceil(d.getDate() / 7);
    weekMap[weekNum] = (weekMap[weekNum] || 0) + dayVal;
  });

  const heroEl = document.getElementById('stat-month-hero');
  heroEl.textContent = monthTotal.toLocaleString('vi-VN') + ' đ';
  heroEl.style.color = monthTotal >= 0 ? 'var(--green)' : 'var(--red)';

  document.getElementById('stat-month-summary').innerHTML = `
    <div class="mini-card"><div class="mc-val">${totalTasks}</div><div class="mc-lbl">Việc hoàn thành</div></div>
    <div class="mini-card"><div class="mc-val">${earnedDays}</div><div class="mc-lbl">Ngày có hoạt động</div></div>
    <div class="mini-card"><div class="mc-val green">${earnedDays>0?Math.round(monthTotal/earnedDays).toLocaleString('vi-VN'):0}đ</div><div class="mc-lbl">Trung bình/ngày</div></div>
  `;

  const weekRows = Object.entries(weekMap).sort(([a],[b])=>a-b).map(([w, val]) => {
    const cls = val >= 0 ? 'green' : 'red';
    return `<div class="stat-row">
      <span>📅 Tuần ${w} tháng này</span>
      <span class="${cls} fw">${val>=0?'+':'−'}${Math.abs(val).toLocaleString('vi-VN')} đ</span>
    </div>`;
  }).join('') || '<div class="empty-msg">Chưa có dữ liệu tháng này</div>';
  document.getElementById('stat-month-weeks').innerHTML = weekRows;
}

// ── RANK STATS (Leaderboard) ───────────────────
async function loadRankStats() {
  const prefix = monthPrefix();
  const snap = await db.ref(kp('tasks')).orderByKey()
    .startAt(prefix).endAt(prefix+'\uf8ff').get();
  const data = snap.val() || {};

  // Aggregate by task label
  const rankMap = {};
  Object.values(data).forEach(dayData => {
    Object.values(dayData).forEach(t => {
      if (t.status !== 'approved') return;
      const key = `${t.icon}||${t.label}`;
      if (!rankMap[key]) rankMap[key] = { icon: t.icon, label: t.label, total: 0, count: 0 };
      rankMap[key].total += t.value;
      rankMap[key].count++;
    });
  });

  const ranked = Object.values(rankMap).sort((a,b) => b.total - a.total);

  if (!ranked.length) {
    document.getElementById('stat-rank-list').innerHTML = '<div class="empty-msg">Chưa có dữ liệu tháng này</div>';
    return;
  }

  const medals = ['🥇','🥈','🥉'];
  const rows = ranked.map((item, i) => {
    const cls = item.total >= 0 ? 'green' : 'red';
    const medal = medals[i] || `${i+1}.`;
    const bar = Math.max(4, Math.round(Math.abs(item.total) / Math.abs(ranked[0].total) * 100));
    return `<div class="rank-row">
      <div class="rank-medal">${medal}</div>
      <div class="rank-info">
        <div class="rank-name">${item.icon} ${item.label}</div>
        <div class="rank-bar-wrap"><div class="rank-bar ${cls}-bar" style="width:${bar}%"></div></div>
        <div class="rank-meta">${item.count} lần · <span class="${cls} fw">${item.total>=0?'+':'−'}${Math.abs(item.total).toLocaleString('vi-VN')} đ</span></div>
      </div>
    </div>`;
  }).join('');
  document.getElementById('stat-rank-list').innerHTML = rows;
}

// ── SOUND SYSTEM ───────────────────────────────

function playSound(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (type === 'submit') {
      // Ascending ding — bé gửi task
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.18);
      gain.gain.setValueAtTime(0.28, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.28);
      osc.start(); osc.stop(ctx.currentTime + 0.3);

    } else if (type === 'approve') {
      // Coin jingle — Ba/Mẹ duyệt
      [523, 659, 784, 1047].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.type = 'triangle'; osc.frequency.value = freq;
        const t = ctx.currentTime + i * 0.1;
        gain.gain.setValueAtTime(0.25, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
        osc.start(t); osc.stop(t + 0.25);
      });

    } else if (type === 'reject') {
      // Descending buzz — từ chối
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(330, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(165, ctx.currentTime + 0.3);
      gain.gain.setValueAtTime(0.18, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc.start(); osc.stop(ctx.currentTime + 0.38);
    }
  } catch(e) { /* browser may block audio */ }
}

// ── CALENDAR ───────────────────────────────────
let calYear, calMonth;

function openCalModal() {
  const now = new Date();
  calYear = now.getFullYear(); calMonth = now.getMonth();
  renderCal();
  hide('cal-day-detail');
  show('cal-modal');
}
function closeCalModal() { hide('cal-modal'); }
function calPrev() { calMonth--; if(calMonth<0){calMonth=11;calYear--;} renderCal(); hide('cal-day-detail'); }
function calNext() { calMonth++; if(calMonth>11){calMonth=0;calYear++;} renderCal(); hide('cal-day-detail'); }

async function renderCal() {
  const monthNames = ['Tháng 1','Tháng 2','Tháng 3','Tháng 4','Tháng 5','Tháng 6',
                      'Tháng 7','Tháng 8','Tháng 9','Tháng 10','Tháng 11','Tháng 12'];
  document.getElementById('cal-month-label').textContent = `${monthNames[calMonth]} / ${calYear}`;

  // Fetch all tasks for this month
  const prefix = `${calYear}-${String(calMonth+1).padStart(2,'0')}`;
  const snap = await db.ref(kp('tasks')).orderByKey()
    .startAt(prefix).endAt(prefix+'\uf8ff').get();
  const monthData = snap.val() || {};

  // Build calendar grid
  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(calYear, calMonth+1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;

  let html = '';
  // Empty cells before first day
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateKey = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayData = monthData[dateKey] || null;
    const status = getDayStatus(dayData);
    const isToday = dateKey === todayStr ? ' cal-today' : '';
    const isFuture = new Date(calYear, calMonth, d) > today;

    let dotHtml = '';
    if (!isFuture && status !== 'empty') {
      dotHtml = `<span class="cal-dot ${status}-dot"></span>`;
    }
    html += `<div class="cal-cell${isToday}" onclick="showDayDetail('${dateKey}')">
      <span class="cal-day-num">${d}</span>${dotHtml}
    </div>`;
  }
  document.getElementById('cal-grid').innerHTML = html;
}

function getDayStatus(dayData) {
  if (!dayData) return 'empty';
  const tasks = Object.values(dayData);
  const approved = tasks.filter(t => t.status === 'approved');
  if (!approved.length) {
    // Has pending/rejected but nothing approved → red
    return tasks.length ? 'red' : 'empty';
  }
  const net = approved.reduce((s, t) => s + t.value, 0);
  if (net >= 8000) return 'green';
  if (net >= 1000) return 'yellow';
  return 'red';
}

async function showDayDetail(dateKey) {
  const snap = await db.ref(kp(`tasks/${dateKey}`)).get();
  const data = snap.val() || {};
  const [y, m, d] = dateKey.split('-');
  const isFuture = new Date(parseInt(y), parseInt(m)-1, parseInt(d)) > new Date();

  // Populate the dedicated detail modal
  document.getElementById('cal-det-date').textContent = `📋 Ngày ${parseInt(d)} tháng ${parseInt(m)} năm ${y}`;

  const tasks = Object.entries(data).map(([id, t]) => ({ id, ...t }));
  let bodyHtml = '';
  if (!tasks.length) {
    bodyHtml = '<div class="empty-msg" style="padding:24px 0">Chưa có hoạt động nào 📝</div>';
  } else {
    let net = 0;
    const approved = tasks.filter(t => t.status === 'approved');
    const pending  = tasks.filter(t => t.status === 'pending');
    const rejected = tasks.filter(t => t.status === 'rejected');

    const makeRows = (list, sectionLabel, isPendingSection) => {
      if (!list.length) return '';
      const rows = list.map(t => {
        const cls = t.value >= 0 ? 'green' : 'red';
        const valStr = t.value >= 0 ? `+${t.value.toLocaleString('vi-VN')}đ` : `−${Math.abs(t.value).toLocaleString('vi-VN')}đ`;
        let rightSide = `<span class="det-task-val ${cls}">${valStr}</span>`;
        if (isPendingSection) {
          const isCustom = t.type === 'custom';
          rightSide = `<div class="pday-approve-area">
            ${isCustom ? `<input type="number" class="amount-edit" id="cal-amt-${t.id}" value="${t.value}" step="500" title="Chỉnh số tiền">` : `<span class="det-task-val ${cls}">${valStr}</span>`}
            <div class="approve-btns">
              <button class="btn-approve" onclick="approveTaskFromCal('${t.id}','${dateKey}',${isCustom})">✅</button>
              <button class="btn-reject"  onclick="rejectTaskFromCal('${t.id}','${dateKey}')">❌</button>
            </div>
          </div>`;
        }
        return `<div class="det-task-row">
          <span class="det-task-left">${t.icon} <span class="det-task-name">${t.label}</span>${t.subLabel ? `<br><small class="det-sub">${t.subLabel}</small>` : ''}</span>
          ${rightSide}
        </div>`;
      }).join('');
      return `<div class="det-section-label">${sectionLabel}</div>${rows}`;
    };

    approved.forEach(t => { net += t.value; });
    const totalCls = net >= 0 ? 'green' : 'red';

    bodyHtml =
      makeRows(pending,  '⏳ Chờ duyệt', true) +
      makeRows(approved, '✅ Đã được duyệt', false) +
      makeRows(rejected, '❌ Bị từ chối', false) +
      `<div class="det-total-row">
        <span>Tổng thu nhập:</span>
        <span class="${totalCls} fw">${net>=0?'+':'−'}${Math.abs(net).toLocaleString('vi-VN')} đ</span>
      </div>`;
  }

  document.getElementById('cal-det-body').innerHTML = bodyHtml;

  // Show/hide add button
  const addBtn = document.getElementById('cal-det-add-btn');
  addBtn.classList.toggle('hidden', isFuture);
  addBtn.onclick = () => { closeCalDetModal(); openCalAddModal(dateKey); };

  show('cal-det-modal');
}

async function approveTaskFromCal(id, dateKey, isCustom) {
  await approveTaskForDate(id, dateKey, isCustom);
  await showDayDetail(dateKey);
  if (typeof renderCal === 'function') renderCal();
}

async function rejectTaskFromCal(id, dateKey) {
  await rejectTaskForDate(id, dateKey);
  await showDayDetail(dateKey);
  if (typeof renderCal === 'function') renderCal();
}
function closeCalDetModal() { hide('cal-det-modal'); }

// Keep old cal-day-detail hidden (no longer used)
function _unusedCalDayDetail() {}

// ── CAL ADD TASK MODAL (MULTI-SELECT) ───────────
let calAddDateKey = null;
let calAddSelectedMap = new Map();
let calAddCustomAmt = 2000;

function openCalAddModal(dateKey) {
  calAddDateKey = dateKey;
  calAddSelectedMap.clear();
  calAddCustomAmt = 2000;
  const [y, m, d] = dateKey.split('-');
  document.getElementById('cal-add-date-label').textContent = `Ngày ${parseInt(d)}/${parseInt(m)}/${y}`;
  // Populate task list
  const listEl = document.getElementById('cal-add-task-list');
  const allTasks = [
    ...taskConfig,
    { id:'score',   icon:'🏆', label:'Điểm kiểm tra', value: 3000 },
    { id:'custom',  icon:'✍️', label:'Việc khác (tự nhập)', value: 2000 }
  ];
  listEl.innerHTML = allTasks.map(t =>
    `<button class="cal-task-pill" data-id="${t.id}" data-label="${t.label}" data-icon="${t.icon}" data-value="${t.value}" onclick="toggleCalAddTask(this)">
       <span class="cpill-check">✓</span> ${t.icon} ${t.label} <span class="cpill-val">+${t.value.toLocaleString('vi-VN')}đ</span>
     </button>`
  ).join('');
  document.getElementById('cal-add-custom-row').classList.add('hidden');
  document.getElementById('cal-add-custom-name').value = '';
  updateCalAddPreview();
  show('cal-add-modal');
}
function closeCalAddModal() { hide('cal-add-modal'); }

function toggleCalAddTask(el) {
  const id = el.dataset.id;
  if (calAddSelectedMap.has(id)) {
    calAddSelectedMap.delete(id);
    el.classList.remove('active');
  } else {
    calAddSelectedMap.set(id, {
      id: el.dataset.id,
      label: el.dataset.label,
      icon: el.dataset.icon,
      value: parseInt(el.dataset.value)
    });
    el.classList.add('active');
  }
  const isCustomActive = calAddSelectedMap.has('custom');
  document.getElementById('cal-add-custom-row').classList.toggle('hidden', !isCustomActive);
  updateCalAddPreview();
}

function changeCalAddAmt(d) {
  calAddCustomAmt = Math.max(500, calAddCustomAmt + d);
  document.getElementById('cal-add-custom-amount').textContent = calAddCustomAmt.toLocaleString('vi-VN');
  if (calAddSelectedMap.has('custom')) {
    calAddSelectedMap.get('custom').value = calAddCustomAmt;
  }
  updateCalAddPreview();
}

function updateCalAddPreview() {
  const prev = document.getElementById('cal-add-preview');
  const submitBtn = document.querySelector('#cal-add-modal .btn-submit');
  const count = calAddSelectedMap.size;
  if (count === 0) {
    prev.innerHTML = '👉 Nhấn chọn một hoặc nhiều công việc bên trên';
    prev.style.color = 'var(--text-dim)';
    if (submitBtn) submitBtn.textContent = '📤 Gửi Ba/Mẹ duyệt';
    return;
  }

  let totalVal = 0;
  calAddSelectedMap.forEach((task, id) => {
    const val = id === 'custom' ? calAddCustomAmt : task.value;
    totalVal += val;
  });

  prev.innerHTML = `🎉 Đã chọn <b>${count} việc</b>: <b class="green">+${totalVal.toLocaleString('vi-VN')} đ</b>`;
  prev.style.color = 'var(--green)';
  if (submitBtn) submitBtn.textContent = `📤 Gửi Ba/Mẹ duyệt (${count} việc • +${totalVal.toLocaleString('vi-VN')} đ)`;
}

async function submitCalAddTask() {
  if (calAddSelectedMap.size === 0 || !calAddDateKey) {
    showToast('⚠️ Vui lòng chọn ít nhất 1 công việc!');
    return;
  }
  
  if (calAddSelectedMap.has('custom')) {
    const name = document.getElementById('cal-add-custom-name').value.trim();
    if (!name) {
      showToast('⚠️ Vui lòng nhập tên công việc tự nhập!');
      return;
    }
    const customTask = calAddSelectedMap.get('custom');
    customTask.label = name;
    customTask.value = calAddCustomAmt;
  }

  const tasksToPush = Array.from(calAddSelectedMap.values());
  const now = Date.now();
  
  for (let i = 0; i < tasksToPush.length; i++) {
    const t = tasksToPush[i];
    await db.ref(kp(`tasks/${calAddDateKey}`)).push({
      type: t.id === 'custom' ? 'custom' : 'simple',
      taskId: t.id,
      label: t.label,
      icon: t.icon,
      value: t.value,
      status: 'pending',
      createdAt: now + i,
      retroEntry: true
    });
  }

  const count = tasksToPush.length;
  closeCalAddModal();
  showDayDetail(calAddDateKey);
  renderCal();
  spawnCoin();
  playSound('submit');
  showToast(`📤 Đã gửi ${count} việc vào ngày ${calAddDateKey.split('-').slice(1).reverse().join('/')}!`);
}





// ── DEFAULT TASK CONFIGS ────────────────────────
const DEFAULT_CFG = {
  be1: [
    { id:'sweep', icon:'🧹', label:'Quét nhà', value:1000 },
    { id:'mop', icon:'🫧', label:'Lau nhà', value:2000 },
    { id:'clean_room', icon:'🛏️', label:'Dọn phòng', value:2000 },
    { id:'reading', icon:'📖', label:'Đọc sách', value:3000 },
    { id:'sub_english', icon:'📚', label:'Học Tiếng Anh', value:2500 },
    { id:'sub_math', icon:'✏️', label:'Học Toán', value:2500 },
    { id:'sub_viet', icon:'📝', label:'Viết Tiếng Việt', value:2500 },
    { id:'sub_vocab', icon:'🔤', label:'Từ mới Tiếng Anh', value:2500 }
  ],
  be2: [
    { id:'clean_room', icon:'🛏️', label:'Dọn phòng', value:1000 },
    { id:'english', icon:'📖', label:'Học Tiếng Anh', value:1000 },
    { id:'math', icon:'✏️', label:'Học Toán', value:1000 },
    { id:'listen', icon:'🎧', label:'Nghe Tiếng Anh', value:1000 },
    { id:'school', icon:'🏫', label:'Đi học', value:5000 }
  ]
};

let taskConfig = [];
let tmpTaskConfig = [];

async function loadTaskConfig() {
  const snap = await db.ref(kp('config/tasks')).get();
  const defaults = DEFAULT_CFG[currentKid] || [];
  if (!snap.val()) {
    taskConfig = defaults;
    await db.ref(kp('config/tasks')).set(taskConfig);
  } else {
    taskConfig = snap.val();
    // Auto-merge: thêm task mới từ DEFAULT_CFG nếu chưa có
    const existingIds = taskConfig.map(t => t.id);
    const missing = defaults.filter(d => !existingIds.includes(d.id));
    if (missing.length) {
      taskConfig = [...taskConfig, ...missing];
      await db.ref(kp('config/tasks')).set(taskConfig);
    }
  }
  renderTaskGrid();
}

// ── MULTI-SELECT MODE ON MAIN SCREEN ───────────
let isMultiSelectMode = false;
let multiSelectedTaskIds = new Set();

function toggleMultiSelectMode(forcedState) {
  if (typeof forcedState === 'boolean') {
    isMultiSelectMode = forcedState;
  } else {
    isMultiSelectMode = !isMultiSelectMode;
  }
  
  if (!isMultiSelectMode) {
    multiSelectedTaskIds.clear();
  }
  
  const btn = document.getElementById('btn-toggle-multi');
  if (btn) {
    btn.classList.toggle('active', isMultiSelectMode);
    btn.innerHTML = isMultiSelectMode ? '✕ Huỷ chọn nhiều' : '☑️ Chọn nhiều việc';
  }
  
  const grid = document.getElementById('task-grid');
  if (grid) {
    grid.classList.toggle('multi-mode', isMultiSelectMode);
  }
  
  updateMultiSelectBar();
  renderTaskGrid();
}

function updateMultiSelectBar() {
  const bar = document.getElementById('multiselect-bar');
  if (!bar) return;
  if (!isMultiSelectMode || multiSelectedTaskIds.size === 0) {
    bar.classList.remove('show');
    return;
  }
  
  const count = multiSelectedTaskIds.size;
  let totalReward = 0;
  multiSelectedTaskIds.forEach(id => {
    const cfg = taskConfig.find(t => t.id === id);
    if (cfg) totalReward += cfg.value;
  });
  
  document.getElementById('multi-count').textContent = count;
  document.getElementById('multi-total').textContent = `+${totalReward.toLocaleString('vi-VN')} đ`;
  bar.classList.add('show');
}

function onTaskCardClick(taskId, isApproved, isPending, pendingFirebaseId, label) {
  if (isApproved) {
    showToast('✅ Việc này đã được Ba/Mẹ duyệt!');
    return;
  }
  if (isPending) {
    cancelPendingTask(pendingFirebaseId, label);
    return;
  }
  
  if (isMultiSelectMode) {
    if (multiSelectedTaskIds.has(taskId)) {
      multiSelectedTaskIds.delete(taskId);
    } else {
      multiSelectedTaskIds.add(taskId);
    }
    renderTaskGrid();
    updateMultiSelectBar();
    return;
  }
  
  submitSimpleTask(taskId);
}

async function submitMultiTasks() {
  if (multiSelectedTaskIds.size === 0) {
    showToast('⚠️ Vui lòng chọn ít nhất 1 công việc!');
    return;
  }
  
  const taskIds = Array.from(multiSelectedTaskIds);
  const now = Date.now();
  let submittedCount = 0;
  
  for (let i = 0; i < taskIds.length; i++) {
    const taskId = taskIds[i];
    const cfg = taskConfig.find(t => t.id === taskId);
    if (!cfg) continue;
    
    const already = Object.values(todayTasks).some(
      t => t.taskId === taskId && (t.status === 'pending' || t.status === 'approved')
    );
    if (already) continue;
    
    await db.ref(kp(`tasks/${todayKey()}`)).push({
      type: 'simple',
      taskId: cfg.id,
      label: cfg.label,
      icon: cfg.icon,
      value: cfg.value,
      status: 'pending',
      createdAt: now + i
    });
    submittedCount++;
  }
  
  multiSelectedTaskIds.clear();
  toggleMultiSelectMode(false);
  spawnCoin();
  playSound('submit');
  showToast(`📤 Đã gửi ${submittedCount} công việc! Chờ Ba/Mẹ duyệt ⏳`);
}

function renderTaskGrid() {
  if (_dragCtx && _dragCtx.active) return;
  const grid = document.getElementById('task-grid');
  if (!grid) return;

  // Dynamic configurable tasks
  let html = taskConfig.map((t, i) => {
    const pendingEntry = Object.entries(todayTasks).find(
      ([,x]) => x.taskId === t.id && x.status === 'pending');
    const approvedEntry = Object.entries(todayTasks).find(
      ([,x]) => x.taskId === t.id && x.status === 'approved');
    const isPending  = !!pendingEntry;
    const isApproved = !!approvedEntry;
    const isMultiSelected = isMultiSelectMode && multiSelectedTaskIds.has(t.id);
    const badge = isApproved ? '✅' : isPending ? '⏳' : '';
    let stateClass = isApproved ? 'approved' : isPending ? 'pending' : '';
    if (isMultiSelected) stateClass += ' multi-selected';
    const pId = pendingEntry ? pendingEntry[0] : '';
    return `<div class="task-card ${stateClass}" data-idx="${i}" onclick="onTaskCardClick('${t.id}', ${isApproved}, ${isPending}, '${pId}', '${t.label}')">
      <div class="tc-icon">${t.icon}</div>
      <div class="tc-name">${t.label}</div>
      <div class="tc-reward green">+${t.value.toLocaleString('vi-VN')} đ</div>
      ${badge ? `<div class="tc-badge">${badge}</div>` : ''}
      ${isPending ? `<div class="tc-undo-hint">Nhấn để chọn lại</div>` : ''}
    </div>`;
  }).join('');

  // Fixed cards (not draggable — no data-idx)
  html += `<div class="task-card" onclick="openScoreModal()">
      <div class="tc-icon">🏆</div>
      <div class="tc-name">Điểm KT</div>
      <div class="tc-desc">Nhập điểm nhiều lần/ngày</div>
      <div class="tc-reward green">+1k ~ +5k đ</div>
    </div>
    <div class="task-card task-custom" onclick="openCustomModal()">
      <div class="tc-icon">✍️</div>
      <div class="tc-name">Việc khác</div>
      <div class="tc-desc">Đề xuất việc + số tiền</div>
      <div class="tc-reward primary">Tự đề xuất</div>
    </div>
    <div class="task-card task-penalty" onclick="openPenaltyModal()">
      <div class="tc-icon">⚠️</div>
      <div class="tc-name">Phạt</div>
      <div class="tc-desc">Ba/Mẹ trừ tiền</div>
      <div class="tc-reward red">Trừ tiền</div>
    </div>`;

  grid.innerHTML = html;
}

// ── DRAG & DROP REORDER (main task grid) ────────
let _dragCtx = null;
let _dragJustEnded = false;
let _dragSetup = false;

function setupDragReorder() {
  if (_dragSetup) return;
  const grid = document.getElementById('task-grid');
  if (!grid) return;
  _dragSetup = true;
  grid.addEventListener('touchstart', onGridPointerDown, { passive: true });
  grid.addEventListener('mousedown', onGridPointerDown);
}

function onGridPointerDown(e) {
  if (isMultiSelectMode) return;
  // Only drag cards with data-idx (configurable tasks, not fixed ones)
  const card = e.target.closest('.task-card[data-idx]');
  if (!card) return;
  const isTouch = e.type === 'touchstart';
  const p = isTouch ? e.touches[0] : e;
  cancelDrag();

  const ctx = {
    card, idx: parseInt(card.dataset.idx),
    startX: p.clientX, startY: p.clientY, isTouch,
    active: false, dropIdx: parseInt(card.dataset.idx)
  };
  _dragCtx = ctx;

  // Move & end handlers (scoped per gesture)
  function onMove(ev) {
    const pt = ev.touches ? ev.touches[0] : ev;
    if (!_dragCtx || _dragCtx !== ctx) return;
    if (!_dragCtx.active) {
      if (Math.abs(pt.clientX - ctx.startX) > 8 || Math.abs(pt.clientY - ctx.startY) > 8) {
        cancelDrag();
      }
      return;
    }
    ev.preventDefault();
    // Move ghost
    ctx.ghost.style.left = (pt.clientX - ctx.offX) + 'px';
    ctx.ghost.style.top  = (pt.clientY - ctx.offY) + 'px';
    // Find drop target: prefer card under cursor, fallback to closest
    let closest = ctx.idx, minD = Infinity;
    document.querySelectorAll('#task-grid .task-card[data-idx]').forEach(c => {
      const ci = parseInt(c.dataset.idx);
      if (ci === ctx.idx) return;
      const r = c.getBoundingClientRect();
      // Check if cursor is inside this card
      if (pt.clientX >= r.left && pt.clientX <= r.right && pt.clientY >= r.top && pt.clientY <= r.bottom) {
        closest = ci; minD = 0;
        return;
      }
      // Fallback: closest center
      const d = Math.hypot(pt.clientX - (r.left + r.width / 2), pt.clientY - (r.top + r.height / 2));
      if (d < minD) { minD = d; closest = ci; }
    });
    if (closest !== ctx.dropIdx) {
      ctx.dropIdx = closest;
      document.querySelectorAll('#task-grid .drag-over').forEach(c => c.classList.remove('drag-over'));
      if (closest !== ctx.idx) {
        document.querySelector(`#task-grid .task-card[data-idx="${closest}"]`)?.classList.add('drag-over');
      }
    }
  }

  function onEnd(ev) {
    cleanup();
    if (_dragCtx && _dragCtx === ctx && ctx.active) {
      ev.preventDefault();
      doFinishDrag(ctx);
    } else {
      cancelDrag();
    }
  }

  function cleanup() {
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onEnd);
  }

  ctx._cleanup = cleanup;
  ctx.timer = setTimeout(() => {
    if (!_dragCtx || _dragCtx !== ctx) return;
    const rect = card.getBoundingClientRect();
    if (navigator.vibrate) navigator.vibrate(30);
    const ghost = card.cloneNode(true);
    ghost.className = 'task-card drag-ghost';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    document.body.appendChild(ghost);
    card.classList.add('drag-placeholder');
    ctx.ghost = ghost;
    ctx.active = true;
    ctx.offX = ctx.startX - rect.left;
    ctx.offY = ctx.startY - rect.top;
    document.body.style.overflow = 'hidden';
  }, 400);

  if (isTouch) {
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  } else {
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onEnd);
  }
}

async function doFinishDrag(ctx) {
  const from = ctx.idx, to = ctx.dropIdx;
  // Cleanup visuals
  if (ctx.ghost) ctx.ghost.remove();
  ctx.card.classList.remove('drag-placeholder');
  document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
  document.body.style.overflow = '';
  _dragJustEnded = true;
  setTimeout(() => _dragJustEnded = false, 400);
  _dragCtx = null;

  if (from !== to) {
    const item = taskConfig.splice(from, 1)[0];
    taskConfig.splice(to, 0, item);
    renderTaskGrid(); // Render immediately with new order
    await db.ref(kp('config/tasks')).set(taskConfig);
    if (navigator.vibrate) navigator.vibrate(20);
    showToast('✅ Đã đổi vị trí!');
  }
}

function cancelDrag() {
  if (!_dragCtx) return;
  clearTimeout(_dragCtx.timer);
  if (_dragCtx.ghost) _dragCtx.ghost.remove();
  if (_dragCtx.card) _dragCtx.card.classList.remove('drag-placeholder');
  document.querySelectorAll('.drag-over').forEach(c => c.classList.remove('drag-over'));
  document.body.style.overflow = '';
  if (_dragCtx._cleanup) _dragCtx._cleanup();
  _dragCtx = null;
}

async function cancelPendingTask(firebaseId, label) {
  if (_dragJustEnded) return;
  // Show inline confirm overlay instead of native confirm()
  showConfirmModal(
    `🔄 Chọn lại "${label}"?`,
    'Huỷ lần đăng ký này để chọn lại hoặc đổi công việc khác.',
    '🗑️ Huỷ đăng ký',
    async () => {
      await db.ref(kp(`tasks/${todayKey()}/${firebaseId}`)).remove();
      playSound('reject');
      showToast(`🔄 Đã huỷ "${label}". Bé có thể chọn lại!`);
    }
  );
}

async function submitSimpleTask(taskId) {
  if (_dragJustEnded) return;
  const cfg = taskConfig.find(t => t.id === taskId);
  if (!cfg) return;
  const already = Object.values(todayTasks).some(
    t => t.taskId === taskId && (t.status === 'pending' || t.status === 'approved'));
  if (already) { showToast('⏳ Đã đăng ký rồi!'); return; }
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type: 'simple', taskId: cfg.id, label: cfg.label, icon: cfg.icon,
    value: cfg.value, status: 'pending', createdAt: Date.now()
  });
  spawnCoin(); playSound('submit'); showToast('📤 Đã gửi! Chờ Ba/Mẹ duyệt ⏳');
}

// ── PENALTY ─────────────────────────────────────
let penaltyAmount = 2000, penaltyReason = '';
function openPenaltyModal() { penaltyAmount = 2000; penaltyReason = ''; updatePenaltyUI(); show('penalty-modal'); }
function closePenaltyModal() { hide('penalty-modal'); }
function selectPenaltyReason(el, reason) {
  penaltyReason = reason;
  document.querySelectorAll('#penalty-reasons .pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
}
function changePenalty(d) { penaltyAmount = Math.max(500, penaltyAmount + d); updatePenaltyUI(); }
function updatePenaltyUI() { document.getElementById('penalty-amount').textContent = penaltyAmount.toLocaleString('vi-VN'); }
async function submitPenalty() {
  if (!penaltyReason) { showToast('⚠️ Chọn lý do phạt!'); return; }
  const note = document.getElementById('penalty-note').value.trim();
  await db.ref(kp(`tasks/${todayKey()}`)).push({
    type: 'penalty', label: `Phạt: ${penaltyReason}`, icon: '⚠️',
    subLabel: note || penaltyReason, value: -penaltyAmount,
    status: 'approved', createdAt: Date.now()
  });
  await db.ref(kp('settings/totalEarned')).transaction(c => (c || 0) - penaltyAmount);
  closePenaltyModal(); playSound('reject');
  showToast(`⚠️ Đã phạt −${penaltyAmount.toLocaleString('vi-VN')} đ`);
}

// ── TASK MANAGER ────────────────────────────────
function openTaskManager() { tmpTaskConfig = JSON.parse(JSON.stringify(taskConfig)); renderTaskManagerList(); show('task-manager-modal'); }
function closeTaskManager() { hide('task-manager-modal'); }
function renderTaskManagerList() {
  const len = tmpTaskConfig.length;
  document.getElementById('task-manager-list').innerHTML = tmpTaskConfig.map((t, i) =>
    `<div class="tm-row">
      <div class="tm-move-btns">
        <button class="tm-move-btn" onclick="moveTask(${i},-1)" ${i === 0 ? 'disabled' : ''}>▲</button>
        <button class="tm-move-btn" onclick="moveTask(${i},1)" ${i === len - 1 ? 'disabled' : ''}>▼</button>
      </div>
      <span class="tm-info">${t.icon} ${t.label}</span>
      <input type="number" class="tm-val" value="${t.value}" onchange="tmpTaskConfig[${i}].value=parseInt(this.value)||0" inputmode="numeric">
      <button class="btn-small red-btn" onclick="tmpTaskConfig.splice(${i},1);renderTaskManagerList()">🗑️</button>
    </div>`
  ).join('') || '<div class="empty-msg">Chưa có việc nào</div>';
}
function moveTask(index, direction) {
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= tmpTaskConfig.length) return;
  const temp = tmpTaskConfig[index];
  tmpTaskConfig[index] = tmpTaskConfig[newIndex];
  tmpTaskConfig[newIndex] = temp;
  renderTaskManagerList();
}
function addNewTask() {
  const icon = document.getElementById('new-task-icon').value.trim() || '📌';
  const label = document.getElementById('new-task-label').value.trim();
  const value = parseInt(document.getElementById('new-task-value').value) || 1000;
  if (!label) { showToast('⚠️ Nhập tên việc!'); return; }
  const id = label.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now().toString(36);
  tmpTaskConfig.push({ id, icon, label, value });
  document.getElementById('new-task-icon').value = '';
  document.getElementById('new-task-label').value = '';
  document.getElementById('new-task-value').value = '';
  renderTaskManagerList();
}
async function saveTaskConfig() {
  taskConfig = tmpTaskConfig;
  await db.ref(kp('config/tasks')).set(taskConfig);
  closeTaskManager(); renderTaskGrid();
  showToast('✅ Đã lưu cài đặt việc!');
}

// ── PAY WAGE FEATURE ─────────────────────────────
let payWageAmount = 0;
let _currentTotalBalance = 0;

async function openPayWageModal() {
  // Compute current total balance from Firebase
  const snap = await db.ref(kp('settings')).get();
  const s = snap.val() || {};
  const balance = (s.openingBalance ?? 0) + (s.totalEarned ?? 0);
  _currentTotalBalance = balance;
  payWageAmount = Math.max(0, balance); // default: pay all

  document.getElementById('pay-wage-current-balance').textContent =
    balance.toLocaleString('vi-VN') + ' đ';
  document.getElementById('pay-wage-amount').textContent =
    payWageAmount.toLocaleString('vi-VN');
  document.getElementById('pay-wage-note').value = '';
  show('pay-wage-modal');
}

function closePayWageModal() { hide('pay-wage-modal'); }

function changePayWageAmt(delta) {
  payWageAmount = Math.max(0, payWageAmount + delta);
  document.getElementById('pay-wage-amount').textContent =
    payWageAmount.toLocaleString('vi-VN');
}

function setPayWagePreset(preset) {
  if (preset === 'all')  payWageAmount = Math.max(0, _currentTotalBalance);
  if (preset === 'half') payWageAmount = Math.max(0, Math.round(_currentTotalBalance / 2 / 500) * 500);
  document.getElementById('pay-wage-amount').textContent =
    payWageAmount.toLocaleString('vi-VN');
}

async function confirmPayWage() {
  if (payWageAmount <= 0) { showToast('⚠️ Số tiền phải lớn hơn 0!'); return; }

  const note = document.getElementById('pay-wage-note').value.trim() || 'Thanh toán lương';
  const now  = new Date();
  const dateStr = `${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;
  const timeStr = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;

  // Save payment record
  await db.ref(kp('payments')).push({
    amount:    payWageAmount,
    note,
    paidAt:    now.toISOString(),
    timestamp: Date.now()
  });

  // Deduct from totalEarned (or openingBalance as fallback)
  // Strategy: reduce openingBalance by payment amount so balance drops
  await db.ref(kp('settings/openingBalance')).transaction(c => (c || 0) - payWageAmount);

  closePayWageModal();
  playSound('approve');

  // Money fly out effect (reverse)
  spawnPayment();
  showToast(`💸 Đã thanh toán ${payWageAmount.toLocaleString('vi-VN')} đ cho bé! 🎉`);

  // Refresh history
  await loadPaymentHistory();
}

function spawnPayment() {
  const layer = document.getElementById('fx-layer');
  const emojis = ['💸', '💵', '💴', '💳'];
  for (let i = 0; i < 6; i++) setTimeout(() => {
    const el = document.createElement('div');
    el.className = 'coin-fx';
    el.textContent = emojis[i % emojis.length];
    el.style.left  = (15 + Math.random() * 70) + 'vw';
    el.style.top   = (20 + Math.random() * 50) + 'vh';
    el.style.fontSize = '28px';
    layer.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  }, i * 100);
}

async function loadPaymentHistory() {
  const snap = await db.ref(kp('payments')).orderByChild('timestamp').get();
  const el = document.getElementById('payment-history-list');
  if (!snap.val()) {
    el.innerHTML = '<div class="empty-msg">Chưa có lần thanh toán nào</div>';
    return;
  }

  const payments = [];
  snap.forEach(child => payments.push({ id: child.key, ...child.val() }));
  payments.sort((a, b) => b.timestamp - a.timestamp); // newest first

  el.innerHTML = payments.map(p => {
    const d = new Date(p.paidAt || p.timestamp);
    const dateStr = `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}/${d.getFullYear()}`;
    const timeStr = `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    return `<div class="payment-item">
      <div class="payment-icon">💸</div>
      <div class="payment-info">
        <div class="payment-amount">−${p.amount.toLocaleString('vi-VN')} đ</div>
        <div class="payment-note">${p.note || 'Thanh toán lương'}</div>
        <div class="payment-date">${dateStr} lúc ${timeStr}</div>
      </div>
      <div class="payment-badge">Đã trả</div>
    </div>`;
  }).join('');
}

