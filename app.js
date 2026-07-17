// =============================================
// BẢNG CHẤM CÔNG BÉ YÊU — app.js v2
// =============================================

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

// ── INIT ───────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  if (typeof firebaseConfig === 'undefined' || firebaseConfig.apiKey.startsWith('REPLACE')) {
    hide('loading-screen'); show('setup-screen'); return;
  }
  try {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    initApp();
  } catch(e) { hide('loading-screen'); show('setup-screen'); }
});

async function initApp() {
  const snap = await db.ref('settings').get();
  const s = snap.val() || {};

  // Set defaults
  if (!s.parentPin)       await db.ref('settings/parentPin').set('1234');
  if (s.openingBalance === undefined) await db.ref('settings/openingBalance').set(39000);
  if (s.totalEarned  === undefined)   await db.ref('settings/totalEarned').set(0);

  openingBalance = s.openingBalance ?? 39000;

  const childName = s.childName || 'Bé Yêu';
  document.getElementById('child-name-display').textContent = childName;
  document.getElementById('name-input').value = childName;
  document.getElementById('balance-input').value = openingBalance;

  const now  = new Date();
  const days = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
  document.getElementById('date-display').textContent =
    `${days[now.getDay()]}, ${now.getDate()}/${now.getMonth()+1}/${now.getFullYear()}`;

  // Real-time listener for today's tasks
  db.ref(`tasks/${todayKey()}`).on('value', snap => {
    todayTasks = snap.val() || {};
    renderChildView();
    if (parentOpen) renderParentView();
  });

  // Real-time listener for settings (balance updates)
  db.ref('settings').on('value', snap => {
    const sv = snap.val() || {};
    openingBalance = sv.openingBalance ?? 39000;
    updateTotalBalance(sv.totalEarned ?? 0);
  });

  hide('loading-screen'); show('app');
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

  // Card states for once-per-day tasks
  Object.keys(REWARDS).filter(t => REWARDS[t].once).forEach(type => {
    const card  = document.getElementById(`card-${type}`);
    const badge = document.getElementById(`badge-${type}`);
    if (!card) return;
    const hasPending  = Object.values(todayTasks).some(t => t.type === type && t.status === 'pending');
    const hasApproved = Object.values(todayTasks).some(t => t.type === type && t.status === 'approved');
    card.classList.remove('pending','approved');
    if (badge) badge.classList.add('hidden');
    if (hasApproved) { card.classList.add('approved'); if(badge){badge.textContent='✅';badge.classList.remove('hidden');} }
    else if (hasPending) { card.classList.add('pending'); if(badge){badge.textContent='⏳';badge.classList.remove('hidden');} }
  });

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
  const snap = await db.ref('tasks').orderByKey()
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
  await db.ref(`tasks/${todayKey()}`).push({
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
  await db.ref(`tasks/${todayKey()}`).push({
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
  await db.ref(`tasks/${todayKey()}`).push({
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
  await db.ref(`tasks/${todayKey()}`).push({
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
  await db.ref(`tasks/${todayKey()}`).push({
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
  const snap=await db.ref('settings/parentPin').get();
  if(currentPin===(snap.val()||'1234')){ closePinModal(); openParentView(); }
  else { show('pin-err'); currentPin=''; updatePinDots(); setTimeout(()=>hide('pin-err'),2000); }
}
function openParentView() { parentOpen=true; renderParentView(); show('parent-view'); }
function closeParentView() { parentOpen=false; hide('parent-view'); }

async function renderParentView() {
  const pending=Object.entries(todayTasks).filter(([,t])=>t.status==='pending').map(([id,t])=>({id,...t}));
  const pEl=document.getElementById('parent-pending-list');
  pEl.innerHTML=pending.length ? pending.map(t=>rowHTML(t,true)).join('') : '<div class="empty-msg">Không có gì cần duyệt ✨</div>';

  let earned=0, deducted=0;
  Object.values(todayTasks).forEach(t=>{
    if(t.status==='approved'){if(t.value>=0)earned+=t.value; else deducted+=t.value;}
  });
  const tot=earned+deducted;
  document.getElementById('parent-earned').textContent=fmtAbs(earned);
  document.getElementById('parent-deducted').textContent=fmtAbs(deducted);
  const tEl=document.getElementById('parent-today-total');
  tEl.textContent=fmt(tot); tEl.style.color=tot>=0?'var(--green)':'var(--red)';

  await renderMonthlyBreakdown();
}

async function renderMonthlyBreakdown() {
  const snap=await db.ref('tasks').orderByKey().startAt(monthPrefix()).endAt(monthPrefix()+'\uf8ff').get();
  const data=snap.val()||{};
  let monthTotal=0;
  const rows=Object.entries(data).sort(([a],[b])=>b.localeCompare(a)).map(([dk,dayTasks])=>{
    let d=0; Object.values(dayTasks).forEach(t=>{if(t.status==='approved')d+=t.value;});
    monthTotal+=d;
    const [,,dd]=dk.split('-');
    return `<div class="day-row"><span class="day-row-date">Ngày ${parseInt(dd)}</span><span class="day-row-val ${d>=0?'pos':'neg'}">${fmt(d)}</span></div>`;
  });
  document.getElementById('monthly-list').innerHTML=rows.join('')||'<div class="empty-msg">Chưa có dữ liệu</div>';
  const mEl=document.getElementById('parent-month-total');
  mEl.textContent=fmt(monthTotal); mEl.style.color=monthTotal>=0?'var(--green)':'var(--red)';
  document.getElementById('month-amount').textContent=monthTotal.toLocaleString('vi-VN')+' đ';
}

async function approveTask(id, isCustom) {
  const task=todayTasks[id]; if(!task||task.status!=='pending') return;
  let finalValue=task.value;
  if(isCustom){
    const inp=document.getElementById(`amt-${id}`);
    if(inp) finalValue=parseInt(inp.value)||task.value;
    await db.ref(`tasks/${todayKey()}/${id}/value`).set(finalValue);
  }
  await db.ref(`tasks/${todayKey()}/${id}/status`).set('approved');
  await db.ref('settings/totalEarned').transaction(c=>(c||0)+finalValue);
  playSound('approve'); showToast('✅ Đã duyệt! Bé được thưởng 🎉');
}
async function rejectTask(id) {
  await db.ref(`tasks/${todayKey()}/${id}/status`).set('rejected');
  playSound('reject'); showToast('❌ Đã từ chối nhiệm vụ này');
}

async function saveChildName() {
  const n=document.getElementById('name-input').value.trim()||'Bé Yêu';
  await db.ref('settings/childName').set(n);
  document.getElementById('child-name-display').textContent=n;
  showToast('💾 Đã lưu tên bé!');
}
async function saveNewPin() {
  const v=document.getElementById('pin-input-new').value.trim();
  if(!/^\d{4}$/.test(v)){showToast('⚠️ PIN phải là 4 chữ số!');return;}
  await db.ref('settings/parentPin').set(v);
  document.getElementById('pin-input-new').value='';
  showToast('🔐 Đã đổi PIN!');
}
async function saveBalance() {
  const v=parseInt(document.getElementById('balance-input').value)||0;
  await db.ref('settings/openingBalance').set(v);
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
    const snap = await db.ref('settings/parentPin').get();
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
    await db.ref('settings/parentPin').set(chpinNewVal);
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
  const snap = await db.ref('tasks').orderByKey().startAt(startKey).endAt(endKey + '\uf8ff').get();
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
  const snap = await db.ref('tasks').orderByKey()
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
  const snap = await db.ref('tasks').orderByKey()
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
  const snap = await db.ref('tasks').orderByKey()
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
  const snap = await db.ref(`tasks/${dateKey}`).get();
  const data = snap.val() || {};
  const [y, m, d] = dateKey.split('-');
  document.getElementById('cal-detail-title').textContent = `📋 Ngày ${parseInt(d)}/${parseInt(m)}`;

  const tasks = Object.values(data);
  if (!tasks.length) {
    document.getElementById('cal-detail-list').innerHTML = '<div class="empty-msg">Không có hoạt động nào</div>';
  } else {
    let net = 0;
    const rows = tasks.map(t => {
      const cls = t.status==='approved' ? (t.value>=0?'green':'red') : (t.status==='rejected'?'red':'');
      const badge = t.status==='approved' ? '✅' : t.status==='rejected' ? '❌' : '⏳';
      if (t.status==='approved') net += t.value;
      const valStr = t.value >= 0 ? `+${t.value.toLocaleString('vi-VN')}đ` : `−${Math.abs(t.value).toLocaleString('vi-VN')}đ`;
      return `<div class="cal-task-row">
        <span>${t.icon} ${t.label}</span>
        <span>${badge} <b class="${cls}">${valStr}</b></span>
      </div>`;
    }).join('');
    const totalCls = net >= 0 ? 'green' : 'red';
    document.getElementById('cal-detail-list').innerHTML =
      rows + `<div class="cal-net-row"><b>Tổng ngày:</b> <b class="${totalCls}">${net>=0?'+':'−'}${Math.abs(net).toLocaleString('vi-VN')} đ</b></div>`;
  }
  show('cal-day-detail');
}


