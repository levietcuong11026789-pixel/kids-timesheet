// =============================================
// BẢNG CHẤM CÔNG BÉ YÊU — app.js
// =============================================

// ── CONFIG / REWARDS ──────────────────────────
const REWARDS = {
  study:      { label: 'Học 4 môn', icon: '✏️', value: 10000, once: true },
  sweep:      { label: 'Quét nhà',  icon: '🧹', value: 1000,  once: true },
  mop:        { label: 'Lau nhà',   icon: '🫧', value: 2000,  once: true },
  clean_room: { label: 'Dọn phòng', icon: '🛏️', value: 2000,  once: true },
  reading:    { label: 'Đọc sách',  icon: '📖', once: true },
  score:      { label: 'Điểm KT',   icon: '🏆', once: false }
};

const SCORE_VALUES = { 10: 5000, 9: 3000, 8: 1000, 7: -3000, 6: -5000 };

function calcReadingReward(pages) {
  if (pages < 5) return 0;
  return 3000 + (pages - 5) * 500;
}

function formatVND(n) {
  const abs = Math.abs(n);
  const sign = n < 0 ? '−' : '+';
  return (n === 0 ? '' : sign) + abs.toLocaleString('vi-VN') + ' đ';
}

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function monthPrefix() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
}

// ── STATE ─────────────────────────────────────
let db;
let currentPin = '';
let selectedSubject = 'Toán';
let selectedScore = null;
let readingPages = 5;
let todayTasks = {};   // live snapshot
let parentOpen = false;

// ── INIT ──────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Check if firebase-config has been filled in
  if (
    typeof firebaseConfig === 'undefined' ||
    firebaseConfig.apiKey.startsWith('REPLACE')
  ) {
    hide('loading-screen');
    show('setup-screen');
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    initApp();
  } catch (e) {
    console.error('Firebase init error:', e);
    hide('loading-screen');
    show('setup-screen');
  }
});

async function initApp() {
  // Load settings
  const snap = await db.ref('settings').get();
  const settings = snap.val() || {};
  if (!settings.parentPin) {
    await db.ref('settings/parentPin').set('1234');
  }
  const childName = settings.childName || 'Bé Yêu';
  document.getElementById('child-name-display').textContent = childName;
  document.getElementById('name-input').value = childName;

  // Date display
  const now = new Date();
  const days = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  document.getElementById('date-display').textContent =
    `${days[now.getDay()]}, ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

  // Listen to today's tasks real-time
  db.ref(`tasks/${todayKey()}`).on('value', snap => {
    todayTasks = snap.val() || {};
    renderChildView();
    if (parentOpen) renderParentView();
  });

  hide('loading-screen');
  show('app');
}

// ── RENDER CHILD VIEW ─────────────────────────
function renderChildView() {
  let todayTotal = 0;
  const pending = [];
  const approved = [];

  Object.entries(todayTasks).forEach(([id, task]) => {
    if (task.status === 'approved') {
      todayTotal += task.value;
      approved.push({ id, ...task });
    } else if (task.status === 'pending') {
      pending.push({ id, ...task });
    }
  });

  // Update money display
  document.getElementById('today-amount').textContent = todayTotal.toLocaleString('vi-VN') + ' đ';
  animateMoneyChange();

  // Update month total (async)
  loadMonthTotal();

  // Update card states
  Object.keys(REWARDS).forEach(type => {
    if (!REWARDS[type].once) return;
    const card = document.getElementById(`card-${type}`);
    const badge = document.getElementById(`badge-${type}`);
    if (!card) return;

    const hasPending  = Object.values(todayTasks).some(t => t.type === type && t.status === 'pending');
    const hasApproved = Object.values(todayTasks).some(t => t.type === type && t.status === 'approved');

    card.classList.remove('pending', 'approved', 'disabled');
    if (badge) badge.classList.add('hidden');

    if (hasApproved) {
      card.classList.add('approved');
      if (badge) { badge.textContent = '✅'; badge.classList.remove('hidden'); }
    } else if (hasPending) {
      card.classList.add('pending');
      if (badge) { badge.textContent = '⏳'; badge.classList.remove('hidden'); }
    }
  });

  // Render pending list
  const pendingEl = document.getElementById('pending-list');
  if (pending.length === 0) {
    pendingEl.innerHTML = '<div class="empty-msg">Chưa có việc nào chờ duyệt 😊</div>';
  } else {
    pendingEl.innerHTML = pending.map(t => taskRowHTML(t, false)).join('');
  }

  // Render approved list
  const approvedEl = document.getElementById('approved-list');
  if (approved.length === 0) {
    approvedEl.innerHTML = '<div class="empty-msg">Hãy làm việc để kiếm tiền nào! 💪</div>';
  } else {
    approvedEl.innerHTML = approved.map(t => taskRowHTML(t, false)).join('');
  }
}

function taskRowHTML(task, showButtons) {
  const valClass = task.value >= 0 ? 'green' : 'red';
  const valStr = task.value.toLocaleString('vi-VN') + ' đ';
  const prefix = task.value >= 0 ? '+' : '−';
  const absVal = Math.abs(task.value).toLocaleString('vi-VN');
  const sub = task.subLabel || '';
  const btns = showButtons ? `
    <div class="approve-btns">
      <button class="btn-approve" onclick="approveTask('${task.id}')">✅</button>
      <button class="btn-reject"  onclick="rejectTask('${task.id}')">❌</button>
    </div>` : `<div class="task-row-val ${valClass}">${prefix}${absVal} đ</div>`;

  return `
    <div class="task-row">
      <div class="task-row-icon">${task.icon}</div>
      <div class="task-row-info">
        <div class="task-row-name">${task.label}</div>
        ${sub ? `<div class="task-row-sub">${sub}</div>` : ''}
      </div>
      ${btns}
    </div>`;
}

// ── MONTH TOTAL ───────────────────────────────
async function loadMonthTotal() {
  const snap = await db.ref('tasks').orderByKey()
    .startAt(monthPrefix())
    .endAt(monthPrefix() + '\uf8ff')
    .get();

  let total = 0;
  if (snap.val()) {
    Object.values(snap.val()).forEach(dayTasks => {
      Object.values(dayTasks).forEach(t => {
        if (t.status === 'approved') total += t.value;
      });
    });
  }
  document.getElementById('month-amount').textContent = total.toLocaleString('vi-VN') + ' đ';
  return total;
}

// ── SUBMIT TASKS ──────────────────────────────
async function submitTask(type) {
  const cfg = REWARDS[type];
  if (!cfg) return;

  // Check if already has pending or approved (for once-per-day tasks)
  if (cfg.once) {
    const already = Object.values(todayTasks).some(
      t => t.type === type && (t.status === 'pending' || t.status === 'approved')
    );
    if (already) {
      showToast('⏳ Đã đăng ký rồi, chờ Ba/Mẹ duyệt nha!');
      return;
    }
  }

  const ref = db.ref(`tasks/${todayKey()}`).push();
  await ref.set({
    type,
    label: cfg.label,
    icon:  cfg.icon,
    value: cfg.value,
    status: 'pending',
    createdAt: Date.now()
  });

  spawnCoin();
  showToast('📤 Đã gửi! Chờ Ba/Mẹ duyệt nhé ⏳');
}

// Reading
function openReadingModal() {
  const already = Object.values(todayTasks).some(
    t => t.type === 'reading' && (t.status === 'pending' || t.status === 'approved')
  );
  if (already) { showToast('📖 Đã đăng ký đọc sách rồi!'); return; }
  readingPages = 5;
  updateReadingUI();
  show('reading-modal');
}
function closeReadingModal() { hide('reading-modal'); }
function changePages(delta) {
  readingPages = Math.max(1, readingPages + delta);
  updateReadingUI();
}
function updateReadingUI() {
  document.getElementById('pages-count').textContent = readingPages;
  const reward = calcReadingReward(readingPages);
  const preview = document.getElementById('reading-preview');
  if (readingPages < 5) {
    preview.innerHTML = '⚠️ Cần ít nhất <b>5 trang</b> để được thưởng';
    preview.style.borderColor = 'rgba(248,113,113,.4)';
  } else {
    preview.innerHTML = `Sẽ nhận: <b>${reward.toLocaleString('vi-VN')} đ</b>`;
    preview.style.borderColor = 'rgba(251,191,36,.3)';
  }
}
async function submitReadingTask() {
  if (readingPages < 5) { showToast('📖 Cần ít nhất 5 trang!'); return; }
  const value = calcReadingReward(readingPages);
  const ref = db.ref(`tasks/${todayKey()}`).push();
  await ref.set({
    type: 'reading',
    label: 'Đọc sách',
    icon: '📖',
    subLabel: `${readingPages} trang`,
    value,
    status: 'pending',
    createdAt: Date.now()
  });
  closeReadingModal();
  spawnCoin();
  showToast(`📚 Đã gửi ${readingPages} trang! Chờ Ba/Mẹ duyệt ⏳`);
}

// Score
function openScoreModal() {
  selectedSubject = 'Toán';
  selectedScore = null;
  // Reset pills
  document.querySelectorAll('#subject-pills .pill').forEach((p,i) => {
    p.classList.toggle('active', i === 0);
  });
  document.querySelectorAll('#score-pills .pill').forEach(p => p.classList.remove('active'));
  document.getElementById('score-preview').textContent = 'Chọn điểm để xem thưởng';
  document.getElementById('score-preview').style.color = 'var(--gold)';
  document.getElementById('score-submit').disabled = true;
  show('score-modal');
}
function closeScoreModal() { hide('score-modal'); }

function selectPill(el, group) {
  const parent = el.parentElement;
  parent.querySelectorAll('.pill').forEach(p => p.classList.remove('active'));
  el.classList.add('active');
  if (group === 'subject') {
    selectedSubject = el.dataset.val;
  } else {
    selectedScore = parseInt(el.dataset.val);
    updateScorePreview();
  }
}
function updateScorePreview() {
  const val = SCORE_VALUES[selectedScore] || 0;
  const preview = document.getElementById('score-preview');
  if (val >= 0) {
    preview.innerHTML = `🎉 Điểm ${selectedScore}: <b>+${val.toLocaleString('vi-VN')} đ</b>`;
    preview.style.color = 'var(--green)';
    preview.style.borderColor = 'rgba(52,211,153,.3)';
  } else {
    preview.innerHTML = `😢 Điểm ${selectedScore}: <b>−${Math.abs(val).toLocaleString('vi-VN')} đ</b>`;
    preview.style.color = 'var(--red)';
    preview.style.borderColor = 'rgba(248,113,113,.3)';
  }
  document.getElementById('score-submit').disabled = false;
}
async function submitScoreTask() {
  if (selectedScore === null) return;
  const value = SCORE_VALUES[selectedScore];
  const ref = db.ref(`tasks/${todayKey()}`).push();
  await ref.set({
    type: 'score',
    label: `Điểm ${selectedSubject}`,
    icon: '🏆',
    subLabel: `Điểm ${selectedScore}`,
    value,
    status: 'pending',
    createdAt: Date.now()
  });
  closeScoreModal();
  spawnCoin();
  showToast(`🏆 Đã gửi điểm ${selectedScore}! Chờ Ba/Mẹ duyệt ⏳`);
}

// ── PARENT VIEW ───────────────────────────────
function openPinModal() {
  currentPin = '';
  updatePinDots();
  hide('pin-err');
  show('pin-modal');
}
function closePinModal() { hide('pin-modal'); }

function pinKey(digit) {
  if (currentPin.length >= 4) return;
  currentPin += digit;
  updatePinDots();
  if (currentPin.length === 4) setTimeout(pinConfirm, 200);
}
function pinBackspace() {
  currentPin = currentPin.slice(0, -1);
  updatePinDots();
}
function updatePinDots() {
  document.querySelectorAll('#pin-dots span').forEach((dot, i) => {
    dot.classList.toggle('filled', i < currentPin.length);
  });
}
async function pinConfirm() {
  const snap = await db.ref('settings/parentPin').get();
  const correctPin = snap.val() || '1234';
  if (currentPin === correctPin) {
    closePinModal();
    openParentView();
  } else {
    show('pin-err');
    currentPin = '';
    updatePinDots();
    setTimeout(() => hide('pin-err'), 2000);
  }
}

function openParentView() {
  parentOpen = true;
  renderParentView();
  show('parent-view');
}
function closeParentView() {
  parentOpen = false;
  hide('parent-view');
}

async function renderParentView() {
  // Pending list
  const pending = Object.entries(todayTasks)
    .filter(([,t]) => t.status === 'pending')
    .map(([id,t]) => ({ id, ...t }));

  const parentPendingEl = document.getElementById('parent-pending-list');
  if (pending.length === 0) {
    parentPendingEl.innerHTML = '<div class="empty-msg">Không có gì cần duyệt ✨</div>';
  } else {
    parentPendingEl.innerHTML = pending.map(t => taskRowHTML(t, true)).join('');
  }

  // Today summary
  let earned = 0, deducted = 0;
  Object.values(todayTasks).forEach(t => {
    if (t.status === 'approved') {
      if (t.value >= 0) earned += t.value;
      else deducted += t.value;
    }
  });
  const todayTotal = earned + deducted;
  document.getElementById('parent-earned').textContent = earned.toLocaleString('vi-VN') + ' đ';
  document.getElementById('parent-deducted').textContent = Math.abs(deducted).toLocaleString('vi-VN') + ' đ';
  const totalEl = document.getElementById('parent-today-total');
  totalEl.textContent = todayTotal.toLocaleString('vi-VN') + ' đ';
  totalEl.style.color = todayTotal >= 0 ? 'var(--green)' : 'var(--red)';

  // Monthly breakdown
  await renderMonthlyBreakdown();
}

async function renderMonthlyBreakdown() {
  const snap = await db.ref('tasks').orderByKey()
    .startAt(monthPrefix())
    .endAt(monthPrefix() + '\uf8ff')
    .get();

  const data = snap.val() || {};
  let monthTotal = 0;
  const rows = Object.entries(data)
    .sort(([a],[b]) => b.localeCompare(a))
    .map(([dateKey, dayTasks]) => {
      let dayTotal = 0;
      Object.values(dayTasks).forEach(t => {
        if (t.status === 'approved') dayTotal += t.value;
      });
      monthTotal += dayTotal;
      const [,, dd] = dateKey.split('-');
      const cls = dayTotal >= 0 ? 'pos' : 'neg';
      const prefix = dayTotal >= 0 ? '+' : '−';
      return `<div class="day-row">
        <span class="day-row-date">Ngày ${parseInt(dd)}</span>
        <span class="day-row-val ${cls}">${prefix}${Math.abs(dayTotal).toLocaleString('vi-VN')} đ</span>
      </div>`;
    });

  document.getElementById('monthly-list').innerHTML = rows.join('') || '<div class="empty-msg">Chưa có dữ liệu tháng này</div>';
  const monthEl = document.getElementById('parent-month-total');
  monthEl.textContent = monthTotal.toLocaleString('vi-VN') + ' đ';
  monthEl.style.color = monthTotal >= 0 ? 'var(--green)' : 'var(--red)';
  document.getElementById('month-amount').textContent = monthTotal.toLocaleString('vi-VN') + ' đ';
}

// Approve / Reject
async function approveTask(id) {
  await db.ref(`tasks/${todayKey()}/${id}/status`).set('approved');
  showToast('✅ Đã duyệt! Bé được thưởng rồi 🎉');
}
async function rejectTask(id) {
  await db.ref(`tasks/${todayKey()}/${id}/status`).set('rejected');
  showToast('❌ Đã từ chối nhiệm vụ này');
}

// Settings
async function saveChildName() {
  const name = document.getElementById('name-input').value.trim() || 'Bé Yêu';
  await db.ref('settings/childName').set(name);
  document.getElementById('child-name-display').textContent = name;
  showToast('💾 Đã lưu tên bé!');
}
async function saveNewPin() {
  const val = document.getElementById('pin-input-new').value.trim();
  if (!/^\d{4}$/.test(val)) { showToast('⚠️ PIN phải là 4 chữ số!'); return; }
  await db.ref('settings/parentPin').set(val);
  document.getElementById('pin-input-new').value = '';
  showToast('🔐 Đã đổi PIN thành công!');
}

// ── UI HELPERS ────────────────────────────────
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(el._t);
  el._t = setTimeout(() => el.classList.add('hidden'), 3000);
}

function spawnCoin() {
  const layer = document.getElementById('fx-layer');
  for (let i = 0; i < 5; i++) {
    setTimeout(() => {
      const el = document.createElement('div');
      el.className = 'coin-fx';
      el.textContent = '💰';
      el.style.left = (20 + Math.random() * 60) + 'vw';
      el.style.top  = (30 + Math.random() * 40) + 'vh';
      layer.appendChild(el);
      setTimeout(() => el.remove(), 1300);
    }, i * 120);
  }
}

let _moneyPulse;
function animateMoneyChange() {
  const el = document.getElementById('today-amount');
  el.style.transform = 'scale(1.2)';
  clearTimeout(_moneyPulse);
  _moneyPulse = setTimeout(() => { el.style.transform = ''; }, 350);
}
