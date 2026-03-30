// ============================================================
// Firebase 設定
// ※ セットアップ手順に従い、以下の値を書き換えてください
// ============================================================
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyAkqjQHT0iX7QCBts_pmkhaOWXNWY7V25U",
  authDomain:        "mileage-tracker-1dd8f.firebaseapp.com",
  projectId:         "mileage-tracker-1dd8f",
  storageBucket:     "mileage-tracker-1dd8f.firebasestorage.app",
  messagingSenderId: "747490982242",
  appId:             "1:747490982242:web:7a93e86a45eb9d1105543b"
};

// ============================================================
// Init Firebase
// ============================================================
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);
const COL = 'mileage_records';

// ============================================================
// State
// ============================================================
let allRecords = [];
let editingId  = null;

// ============================================================
// DOM
// ============================================================
const tabBtns          = document.querySelectorAll('.tab-btn');
const tabPanes         = document.querySelectorAll('.tab-pane');

// Entry form
const entryForm        = document.getElementById('entry-form');
const fDate            = document.getElementById('f-date');
const fDateEnd         = document.getElementById('f-date-end');
const fRangeToggle     = document.getElementById('f-range-toggle');
const fSep             = document.getElementById('f-sep');
const fStart           = document.getElementById('f-start');
const fEnd             = document.getElementById('f-end');
const fDistance        = document.getElementById('f-distance');
const fRoute           = document.getElementById('f-route');
const fMemo            = document.getElementById('f-memo');

// Records
const rMonth           = document.getElementById('r-month');
const rType            = document.getElementById('r-type');
const recordsTotal     = document.getElementById('records-total');
const recordsContainer = document.getElementById('records-container');

// Summary
const sYear            = document.getElementById('s-year');
const summaryContainer = document.getElementById('summary-container');

// Edit modal
const modal            = document.getElementById('modal');
const editForm         = document.getElementById('edit-form');
const eDate            = document.getElementById('e-date');
const eDateEnd         = document.getElementById('e-date-end');
const eRangeToggle     = document.getElementById('e-range-toggle');
const eSep             = document.getElementById('e-sep');
const eStart           = document.getElementById('e-start');
const eEnd             = document.getElementById('e-end');
const eDistance        = document.getElementById('e-distance');
const eRoute           = document.getElementById('e-route');
const eMemo            = document.getElementById('e-memo');
const modalCancel      = document.getElementById('modal-cancel');

const toast            = document.getElementById('toast');

// ============================================================
// Bootstrap
// ============================================================
async function init() {
  if (firebaseConfig.apiKey === 'YOUR_API_KEY') {
    recordsContainer.innerHTML =
      '<p class="empty">⚠️ app.js の firebaseConfig を設定してください</p>';
    summaryContainer.innerHTML = '<p class="empty">⚠️ Firebase 未設定</p>';
    return;
  }

  fDate.value  = todayStr();
  rMonth.value = currentMonthStr();
  populateYearSelector();

  try {
    await loadAllRecords();
  } catch (e) {
    showToast('データ読み込みに失敗しました: ' + e.message);
    return;
  }

  fillLastOdometer();
  renderRecords();
  renderSummary();
}

// ============================================================
// Firestore CRUD
// ============================================================
async function loadAllRecords() {
  const q        = query(collection(db, COL), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  allRecords     = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createRecord(data) {
  await addDoc(collection(db, COL), { ...data, createdAt: serverTimestamp() });
  await loadAllRecords();
}

async function saveEditedRecord(id, data) {
  await updateDoc(doc(db, COL, id), data);
  await loadAllRecords();
}

async function removeRecord(id) {
  await deleteDoc(doc(db, COL, id));
  await loadAllRecords();
}

// ============================================================
// Tabs
// ============================================================
tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    tabBtns.forEach(b => b.classList.remove('active'));
    tabPanes.forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    if (tab === 'records') renderRecords();
    if (tab === 'summary') renderSummary();
  });
});

// ============================================================
// Date Range Toggle
// ============================================================
function setupRangeToggle(toggle, sep, endInput) {
  toggle.addEventListener('change', () => {
    const on = toggle.checked;
    sep.classList.toggle('hidden', !on);
    endInput.classList.toggle('hidden', !on);
    if (!on) endInput.value = '';
  });
}

setupRangeToggle(fRangeToggle, fSep, fDateEnd);
setupRangeToggle(eRangeToggle, eSep, eDateEnd);

// ============================================================
// Entry Form
// ============================================================
function fillLastOdometer() {
  if (allRecords.length === 0) return;
  const sorted = [...allRecords].sort((a, b) => b.date.localeCompare(a.date));
  const last   = sorted[0];
  if (last?.endOdometer != null) {
    fStart.value = last.endOdometer;
    calcDistance(fStart, fEnd, fDistance);
  }
}

[fStart, fEnd].forEach(el =>
  el.addEventListener('input', () => calcDistance(fStart, fEnd, fDistance))
);

entryForm.addEventListener('submit', async e => {
  e.preventDefault();

  const start   = parseFloat(fStart.value);
  const end     = parseFloat(fEnd.value);
  const dateEnd = fRangeToggle.checked ? fDateEnd.value : null;

  if (end < start) {
    showToast('終了距離はスタート距離以上にしてください');
    return;
  }
  if (dateEnd && dateEnd < fDate.value) {
    showToast('終了日はスタート日以降にしてください');
    return;
  }

  const data = buildRecord({
    date:    fDate.value,
    dateEnd,
    type:    document.querySelector('input[name="type"]:checked').value,
    start, end,
    route:   fRoute.value.trim(),
    memo:    fMemo.value.trim()
  });

  const btn = entryForm.querySelector('button[type="submit"]');
  setLoading(btn, true, '保存中...');

  try {
    await createRecord(data);
    showToast('保存しました');
    // キャリーオーバー: 終了距離を次のスタートへ
    fStart.value    = data.endOdometer;
    fEnd.value      = '';
    fDistance.value = '';
    fRoute.value    = '';
    fMemo.value     = '';
    fDate.value     = todayStr();
    fDateEnd.value  = '';
    fRangeToggle.checked = false;
    fSep.classList.add('hidden');
    fDateEnd.classList.add('hidden');
    document.querySelector('input[name="type"][value="private"]').checked = true;
  } catch (err) {
    showToast('保存に失敗しました: ' + err.message);
  } finally {
    setLoading(btn, false, '保存');
  }
});

// ============================================================
// Records List
// ============================================================
rMonth.addEventListener('change', renderRecords);
rType.addEventListener('change', renderRecords);

function renderRecords() {
  const monthFilter = rMonth.value;
  const typeFilter  = rType.value;

  let filtered = allRecords.filter(r => {
    if (monthFilter && !r.date.startsWith(monthFilter)) return false;
    if (typeFilter !== 'all' && r.type !== typeFilter)  return false;
    return true;
  }).sort((a, b) => b.date.localeCompare(a.date));

  // 集計バー
  if (filtered.length > 0) {
    const priv = filtered.filter(r => r.type === 'private').reduce((s, r)  => s + r.distance, 0);
    const biz  = filtered.filter(r => r.type === 'business').reduce((s, r) => s + r.distance, 0);
    const all  = priv + biz;
    recordsTotal.classList.add('visible');
    recordsTotal.innerHTML = `
      <span>合計 <b class="val">${fmtKm(all)} km</b></span>
      <span>プライベート <b class="val" style="color:var(--private)">${fmtKm(priv)} km</b></span>
      <span>事業用 <b class="val" style="color:var(--business)">${fmtKm(biz)} km</b></span>
    `;
  } else {
    recordsTotal.classList.remove('visible');
  }

  if (filtered.length === 0) {
    recordsContainer.innerHTML = '<p class="empty">記録がありません</p>';
    return;
  }

  recordsContainer.innerHTML = filtered.map(renderCard).join('');

  recordsContainer.querySelectorAll('.btn-edit').forEach(btn =>
    btn.addEventListener('click', () => openEditModal(btn.dataset.id))
  );
  recordsContainer.querySelectorAll('.btn-delete').forEach(btn =>
    btn.addEventListener('click', () => confirmDelete(btn.dataset.id))
  );
}

function renderCard(r) {
  const isB      = r.type === 'business';
  const typeName = isB ? '事業用' : 'プライベート';
  const badgeCls = isB ? 'badge-business' : 'badge-private';

  const dateLabel = r.dateEnd
    ? `${formatDate(r.date)} 〜 ${formatDate(r.dateEnd)}`
    : formatDate(r.date);

  return `
    <div class="record-card">
      <div class="record-header">
        <span class="record-date">${dateLabel}</span>
        <span class="badge ${badgeCls}">${typeName}</span>
      </div>
      <div class="record-distance">${fmtKm(r.distance)}<span class="unit">km</span></div>
      <div class="record-odometer">${fmtKm(r.startOdometer)} → ${fmtKm(r.endOdometer)} km</div>
      ${r.route ? `<div class="record-detail">📍 ${esc(r.route)}</div>` : ''}
      ${r.memo  ? `<div class="record-detail">📝 ${esc(r.memo)}</div>`  : ''}
      <div class="record-actions">
        <button class="btn-sm btn-edit"   data-id="${r.id}">編集</button>
        <button class="btn-sm btn-delete" data-id="${r.id}">削除</button>
      </div>
    </div>
  `;
}

// ============================================================
// Edit Modal
// ============================================================
function openEditModal(id) {
  const r = allRecords.find(r => r.id === id);
  if (!r) return;

  editingId       = id;
  eDate.value     = r.date;
  eStart.value    = r.startOdometer;
  eEnd.value      = r.endOdometer;
  eDistance.value = r.distance;
  eRoute.value    = r.route || '';
  eMemo.value     = r.memo  || '';
  document.querySelector(`input[name="e-type"][value="${r.type}"]`).checked = true;

  // 期間設定の復元
  const hasRange = !!r.dateEnd;
  eRangeToggle.checked = hasRange;
  eSep.classList.toggle('hidden', !hasRange);
  eDateEnd.classList.toggle('hidden', !hasRange);
  eDateEnd.value = r.dateEnd || '';

  modal.classList.remove('hidden');
  modal.querySelector('.modal-box').scrollTop = 0;
}

[eStart, eEnd].forEach(el =>
  el.addEventListener('input', () => calcDistance(eStart, eEnd, eDistance))
);

editForm.addEventListener('submit', async e => {
  e.preventDefault();

  const start   = parseFloat(eStart.value);
  const end     = parseFloat(eEnd.value);
  const dateEnd = eRangeToggle.checked ? eDateEnd.value : null;

  if (end < start) {
    showToast('終了距離はスタート距離以上にしてください');
    return;
  }
  if (dateEnd && dateEnd < eDate.value) {
    showToast('終了日はスタート日以降にしてください');
    return;
  }

  const data = buildRecord({
    date:    eDate.value,
    dateEnd,
    type:    document.querySelector('input[name="e-type"]:checked').value,
    start, end,
    route:   eRoute.value.trim(),
    memo:    eMemo.value.trim()
  });

  const btn = editForm.querySelector('button[type="submit"]');
  setLoading(btn, true, '保存中...');

  try {
    await saveEditedRecord(editingId, data);
    closeModal();
    renderRecords();
    renderSummary();
    showToast('更新しました');
  } catch (err) {
    showToast('更新に失敗しました: ' + err.message);
  } finally {
    setLoading(btn, false, '保存');
  }
});

modalCancel.addEventListener('click', closeModal);
document.querySelector('.modal-overlay').addEventListener('click', closeModal);

function closeModal() {
  modal.classList.add('hidden');
  editingId = null;
}

// ============================================================
// Delete
// ============================================================
async function confirmDelete(id) {
  if (!confirm('この記録を削除しますか？')) return;
  try {
    await removeRecord(id);
    renderRecords();
    renderSummary();
    showToast('削除しました');
  } catch (err) {
    showToast('削除に失敗しました: ' + err.message);
  }
}

// ============================================================
// Summary
// ============================================================
function populateYearSelector() {
  const cur = new Date().getFullYear();
  for (let y = cur; y >= cur - 5; y--) {
    const opt = document.createElement('option');
    opt.value = y;
    opt.textContent = `${y}年`;
    sYear.appendChild(opt);
  }
}

sYear.addEventListener('change', renderSummary);

function renderSummary() {
  const year    = parseInt(sYear.value);
  const curYear = new Date().getFullYear();
  const curMon  = new Date().getMonth() + 1;

  const monthData = Array.from({ length: 12 }, (_, i) => {
    const m       = i + 1;
    const prefix  = `${year}-${String(m).padStart(2, '0')}`;
    const recs    = allRecords.filter(r => r.date.startsWith(prefix));
    const priv    = recs.filter(r => r.type === 'private').reduce((s, r)  => s + r.distance, 0);
    const biz     = recs.filter(r => r.type === 'business').reduce((s, r) => s + r.distance, 0);
    return { month: m, priv, biz, total: priv + biz };
  });

  const totPriv = monthData.reduce((s, m) => s + m.priv,  0);
  const totBiz  = monthData.reduce((s, m) => s + m.biz,   0);
  const totAll  = totPriv + totBiz;

  const rows = monthData
    .filter(m => !(year === curYear && m.month > curMon && m.total === 0))
    .map(m => `
      <tr>
        <td>${m.month}月</td>
        <td>${m.priv  > 0 ? fmtKm(m.priv)  + ' km' : '-'}</td>
        <td>${m.biz   > 0 ? fmtKm(m.biz)   + ' km' : '-'}</td>
        <td>${m.total > 0 ? fmtKm(m.total) + ' km' : '-'}</td>
      </tr>
    `).join('');

  summaryContainer.innerHTML = `
    <div class="summary-totals">
      <div class="total-card private">
        <div class="t-label">プライベート</div>
        <div class="t-value">${fmtKm(totPriv)}<small>km</small></div>
      </div>
      <div class="total-card business">
        <div class="t-label">事業用</div>
        <div class="t-value">${fmtKm(totBiz)}<small>km</small></div>
      </div>
      <div class="total-card">
        <div class="t-label">合計</div>
        <div class="t-value">${fmtKm(totAll)}<small>km</small></div>
      </div>
    </div>
    <div class="summary-table-wrap">
      <table>
        <thead>
          <tr>
            <th>月</th>
            <th>プライベート</th>
            <th>事業用</th>
            <th>合計</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>年間合計</td>
            <td>${fmtKm(totPriv)} km</td>
            <td>${fmtKm(totBiz)} km</td>
            <td>${fmtKm(totAll)} km</td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

// ============================================================
// Helpers
// ============================================================
function buildRecord({ date, dateEnd, type, start, end, route, memo }) {
  return {
    date,
    dateEnd:       dateEnd || null,
    type,
    startOdometer: start,
    endOdometer:   end,
    distance:      Math.round((end - start) * 10) / 10,
    route,
    memo
  };
}

function calcDistance(startEl, endEl, distEl) {
  const s = parseFloat(startEl.value);
  const e = parseFloat(endEl.value);
  distEl.value = (!isNaN(s) && !isNaN(e) && e >= s)
    ? Math.round((e - s) * 10) / 10
    : '';
}

function todayStr()        { return new Date().toISOString().slice(0, 10); }
function currentMonthStr() { return new Date().toISOString().slice(0, 7); }

function formatDate(str) {
  const [y, m, d] = str.split('-');
  return `${y}年${parseInt(m)}月${parseInt(d)}日`;
}

function fmtKm(n) {
  return (Math.round(n * 10) / 10).toLocaleString('ja-JP');
}

function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
}

function setLoading(btn, loading, label) {
  btn.disabled    = loading;
  btn.textContent = label;
}

// ============================================================
// Start
// ============================================================
init().catch(err => {
  console.error(err);
  showToast('初期化エラー: ' + err.message);
});
