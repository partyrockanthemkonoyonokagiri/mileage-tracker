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
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ユーザーごとのコレクションパス
function userCol(uid) {
  return collection(db, 'users', uid, 'mileage_records');
}

// ============================================================
// State
// ============================================================
let allRecords      = [];
let editingId       = null;
let currentUid      = null;
let routeCalculated = false; // ルート距離が計算済みかどうか

// ============================================================
// DOM
// ============================================================
// Auth screen
const authScreen       = document.getElementById('auth-screen');
const appScreen        = document.getElementById('app-screen');
const authForm         = document.getElementById('auth-form');
const authEmail        = document.getElementById('a-email');
const authPassword     = document.getElementById('a-password');
const authSubmit       = document.getElementById('auth-submit');
const authError        = document.getElementById('auth-error');
const authTabBtns      = document.querySelectorAll('.auth-tab-btn');
const btnLogout        = document.getElementById('btn-logout');
const btnGoogleLogin   = document.getElementById('btn-google-login');

const tabBtns          = document.querySelectorAll('.tab-btn');
const tabPanes         = document.querySelectorAll('.tab-pane');

// Entry form
const entryForm           = document.getElementById('entry-form');
const fDate               = document.getElementById('f-date');
const fDateEnd            = document.getElementById('f-date-end');
const fRangeToggle        = document.getElementById('f-range-toggle');
const fSep                = document.getElementById('f-sep');
const fStart              = document.getElementById('f-start');
const fEnd                = document.getElementById('f-end');
const fDistance           = document.getElementById('f-distance');
const fRoute              = document.getElementById('f-route');
const fMemo               = document.getElementById('f-memo');
const odometerFields      = document.getElementById('odometer-fields');
const routeFields         = document.getElementById('route-fields');
const fOrigin             = document.getElementById('f-origin');
const fDestination        = document.getElementById('f-destination');
const fWaypointsContainer = document.getElementById('f-waypoints-container');
const btnAddWaypoint      = document.getElementById('btn-add-waypoint');
const btnCalcRoute        = document.getElementById('btn-calc-route');

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
// Auth UI
// ============================================================
let authMode = 'login';

authTabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    authMode = btn.dataset.auth;
    authTabBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    authSubmit.textContent = authMode === 'login' ? 'ログイン' : '登録';
    authError.textContent  = '';
  });
});

authForm.addEventListener('submit', async e => {
  e.preventDefault();
  authError.textContent = '';
  setLoading(authSubmit, true, authMode === 'login' ? 'ログイン中...' : '登録中...');

  try {
    if (authMode === 'login') {
      await signInWithEmailAndPassword(auth, authEmail.value, authPassword.value);
    } else {
      await createUserWithEmailAndPassword(auth, authEmail.value, authPassword.value);
    }
  } catch (err) {
    authError.textContent = authErrorMsg(err.code);
    setLoading(authSubmit, false, authMode === 'login' ? 'ログイン' : '登録');
  }
});

btnLogout.addEventListener('click', () => signOut(auth));

btnGoogleLogin.addEventListener('click', async () => {
  authError.textContent = '';
  try {
    await signInWithPopup(auth, new GoogleAuthProvider());
  } catch (err) {
    if (err.code !== 'auth/popup-closed-by-user') {
      authError.textContent = authErrorMsg(err.code);
    }
  }
});

function authErrorMsg(code) {
  const map = {
    'auth/invalid-email':            'メールアドレスの形式が正しくありません',
    'auth/user-not-found':           'メールアドレスまたはパスワードが違います',
    'auth/wrong-password':           'メールアドレスまたはパスワードが違います',
    'auth/invalid-credential':       'メールアドレスまたはパスワードが違います',
    'auth/email-already-in-use':     'このメールアドレスは既に使用されています',
    'auth/weak-password':            'パスワードは6文字以上にしてください',
    'auth/too-many-requests':        'しばらく時間をおいて再試行してください',
  };
  return map[code] || `エラーが発生しました (${code})`;
}

// ============================================================
// Bootstrap
// ============================================================
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUid = user.uid;
    authScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    await startApp();
  } else {
    currentUid = null;
    authScreen.classList.remove('hidden');
    appScreen.classList.add('hidden');
    authPassword.value    = '';
    authError.textContent = '';
    setLoading(authSubmit, false, authMode === 'login' ? 'ログイン' : '登録');
  }
});

async function startApp() {
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
  const q        = query(userCol(currentUid), orderBy('date', 'desc'));
  const snapshot = await getDocs(q);
  allRecords     = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
}

async function createRecord(data) {
  await addDoc(userCol(currentUid), { ...data, createdAt: serverTimestamp() });
  await loadAllRecords();
}

async function saveEditedRecord(id, data) {
  await updateDoc(doc(db, 'users', currentUid, 'mileage_records', id), data);
  await loadAllRecords();
}

async function removeRecord(id) {
  await deleteDoc(doc(db, 'users', currentUid, 'mileage_records', id));
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
// Distance Mode Toggle
// ============================================================
document.querySelectorAll('input[name="dist-mode"]').forEach(radio => {
  radio.addEventListener('change', () => {
    const isRoute = radio.value === 'route';
    odometerFields.classList.toggle('hidden', isRoute);
    routeFields.classList.toggle('hidden', !isRoute);
    fStart.required = !isRoute;
    fEnd.required   = !isRoute;
  });
});

// 経由地の追加・削除
btnAddWaypoint.addEventListener('click', () => {
  const row = document.createElement('div');
  row.className = 'waypoint-row';
  row.innerHTML = `
    <input type="text" placeholder="経由地">
    <button type="button" class="btn-remove-waypoint" aria-label="削除">×</button>
  `;
  row.querySelector('.btn-remove-waypoint').addEventListener('click', () => row.remove());
  fWaypointsContainer.appendChild(row);
});

// Places オートコンプリートの初期化
function initAutocomplete() {
  if (typeof google === 'undefined') return;
  // 非表示の地図要素を初期化して「マップが読み込まれませんでした」警告を抑制
  const mapDiv = document.createElement('div');
  mapDiv.style.display = 'none';
  document.body.appendChild(mapDiv);
  new google.maps.Map(mapDiv, { center: { lat: 35.6762, lng: 139.6503 }, zoom: 10 });

  [fOrigin, fDestination].forEach(input => {
    new google.maps.places.Autocomplete(input, { componentRestrictions: { country: 'jp' } });
  });
}

// DOMロード後にオートコンプリート初期化（Maps APIのコールバックより遅延する場合のフォールバック）
window.addEventListener('load', () => { setTimeout(initAutocomplete, 500); });

// 出発地・到着地・経由地が変わったら計算済みフラグをリセット
[fOrigin, fDestination].forEach(el =>
  el.addEventListener('input', () => { routeCalculated = false; fDistance.value = ''; })
);
fWaypointsContainer.addEventListener('input', () => { routeCalculated = false; fDistance.value = ''; });

// ルート距離計算
btnCalcRoute.addEventListener('click', async () => {
  const origin      = fOrigin.value.trim();
  const destination = fDestination.value.trim();
  if (!origin || !destination) {
    showToast('出発地と到着地を入力してください');
    return;
  }

  const waypoints = Array.from(fWaypointsContainer.querySelectorAll('input'))
    .map(i => i.value.trim()).filter(Boolean);

  btnCalcRoute.disabled    = true;
  btnCalcRoute.textContent = '計算中...';
  routeCalculated          = false;

  try {
    const distanceKm = await calcRouteDistance(origin, destination, waypoints);
    fDistance.value = distanceKm;
    routeCalculated = true;

    // 経路欄に自動入力
    const stops = [origin, ...waypoints, destination];
    fRoute.value = stops.join(' → ');

    showToast(`距離: ${distanceKm} km`);
  } catch (err) {
    fDistance.value = '';
    showToast('距離の取得に失敗しました: ' + err.message);
  } finally {
    btnCalcRoute.disabled    = false;
    btnCalcRoute.textContent = '距離を計算';
  }
});

function calcRouteDistance(origin, destination, waypoints) {
  return new Promise((resolve, reject) => {
    const service = new google.maps.DistanceMatrixService();

    if (waypoints.length === 0) {
      service.getDistanceMatrix(
        { origins: [origin], destinations: [destination], travelMode: 'DRIVING', region: 'JP' },
        (res, status) => {
          if (status !== 'OK') return reject(new Error(status));
          const el = res.rows[0]?.elements[0];
          if (el?.status !== 'OK') return reject(new Error('ルートが見つかりません'));
          resolve(Math.round(el.distance.value / 100) / 10);
        }
      );
    } else {
      // 経由地がある場合は区間ごとに合計
      const stops   = [origin, ...waypoints, destination];
      const origins = stops.slice(0, -1);
      const dests   = stops.slice(1);
      service.getDistanceMatrix(
        { origins, destinations: dests, travelMode: 'DRIVING', region: 'JP' },
        (res, status) => {
          if (status !== 'OK') return reject(new Error(status));
          let total = 0;
          for (let i = 0; i < origins.length; i++) {
            const el = res.rows[i]?.elements[i];
            if (el?.status !== 'OK') return reject(new Error(`区間 ${i + 1} のルートが見つかりません`));
            total += el.distance.value;
          }
          resolve(Math.round(total / 100) / 10);
        }
      );
    }
  });
}

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

  const isRoute = document.querySelector('input[name="dist-mode"]:checked').value === 'route';
  const start   = parseFloat(fStart.value);
  const end     = parseFloat(fEnd.value);
  const dateEnd = fRangeToggle.checked ? fDateEnd.value : null;
  const distance = parseFloat(fDistance.value);

  if (!isRoute && end < start) {
    showToast('終了距離はスタート距離以上にしてください');
    return;
  }
  if (isRoute) {
    if (!fOrigin.value.trim() || !fDestination.value.trim()) {
      showToast('出発地と到着地を入力してください');
      return;
    }
    if (!routeCalculated || isNaN(distance)) {
      showToast('「距離を計算」ボタンを押してから保存してください');
      return;
    }
  }
  if (dateEnd && dateEnd < fDate.value) {
    showToast('終了日はスタート日以降にしてください');
    return;
  }

  const data = buildRecord({
    date:    fDate.value,
    dateEnd,
    type:    document.querySelector('input[name="type"]:checked').value,
    start:   isRoute ? null : start,
    end:     isRoute ? null : end,
    distanceOverride: isRoute ? distance : null,
    route:   fRoute.value.trim(),
    memo:    fMemo.value.trim()
  });

  const btn = entryForm.querySelector('button[type="submit"]');
  setLoading(btn, true, '保存中...');

  try {
    await createRecord(data);
    showToast('保存しました');
    // キャリーオーバー: 終了距離を次のスタートへ（オドメーターモードのみ）
    fStart.value    = data.endOdometer ?? '';
    fEnd.value      = '';
    fDistance.value = '';
    fRoute.value    = '';
    fMemo.value     = '';
    fDate.value     = todayStr();
    fDateEnd.value  = '';
    fRangeToggle.checked = false;
    fSep.classList.add('hidden');
    fDateEnd.classList.add('hidden');
    // ルートモードのフィールドをクリア
    fOrigin.value      = '';
    fDestination.value = '';
    fWaypointsContainer.innerHTML = '';
    routeCalculated = false;
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
function buildRecord({ date, dateEnd, type, start, end, distanceOverride, route, memo }) {
  const distance = distanceOverride != null
    ? distanceOverride
    : Math.round((end - start) * 10) / 10;
  return {
    date,
    dateEnd:       dateEnd || null,
    type,
    startOdometer: start ?? null,
    endOdometer:   end   ?? null,
    distance,
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
