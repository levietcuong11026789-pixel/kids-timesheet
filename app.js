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
  spawnCoin(); showToast('📤 Đã gửi! Chờ Ba/Mẹ duyệt ⏳');
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
  closeStudyModal(); spawnCoin();
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
  closeReadingModal(); spawnCoin(); showToast(`📚 Đã gửi ${readingPages} trang! ⏳`);
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
  closeScoreModal(); spawnCoin(); showToast(`🏆 Đã gửi điểm ${selectedScore}! ⏳`);
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
  closeCustomModal(); spawnCoin(); showToast('📤 Đã gửi đề xuất! Ba/Mẹ sẽ xem và duyệt ⏳');
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
  showToast('✅ Đã duyệt! Bé được thưởng 🎉');
}
async function rejectTask(id) {
  await db.ref(`tasks/${todayKey()}/${id}/status`).set('rejected');
  showToast('❌ Đã từ chối nhiệm vụ này');
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
function spawnCoin(){
  const layer=document.getElementById('fx-layer');
  for(let i=0;i<5;i++) setTimeout(()=>{
    const el=document.createElement('div'); el.className='coin-fx'; el.textContent='💰';
    el.style.left=(20+Math.random()*60)+'vw'; el.style.top=(30+Math.random()*40)+'vh';
    layer.appendChild(el); setTimeout(()=>el.remove(),1300);
  },i*120);
}
