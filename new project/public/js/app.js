/**
 * Bachelor Expense Manager - Complete Application Logic
 * Pair programmed for Shivam Kumar, Rishu Kumar, Raj Kumar & Flatmates
 */

// Application State
const state = {
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  archiveYear: new Date().getFullYear(),
  roommates: [],
  expenses: [],
  settlements: [],
  summary: null,
  rentBill: null,
  networkInfo: null,
  theme: localStorage.getItem('bem_theme') || 'light',
  activeTab: 'dashboard',
  categoryChart: null,
  roommateChart: null,
  multiYearChart: null,
  pollTimer: null,
  searchDebounce: null
};

// Category Icons & Color Mapping
const CATEGORY_META = {
  'Flat Rent': { icon: '🏠', color: '#4f46e5' },
  'Electricity Bill': { icon: '⚡', color: '#f59e0b' },
  'Water Bill': { icon: '💧', color: '#06b6d4' },
  'WiFi/Internet': { icon: '📶', color: '#3b82f6' },
  'Grocery': { icon: '🛒', color: '#10b981' },
  'Vegetables': { icon: '🥦', color: '#84cc16' },
  'Milk': { icon: '🥛', color: '#ec4899' },
  'Gas Cylinder': { icon: '🔥', color: '#ea580c' },
  'Cooking Oil & Spices': { icon: '🧂', color: '#eab308' },
  'House Cleaning Items': { icon: '🧹', color: '#14b8a6' },
  'Travel/Transport': { icon: '🚗', color: '#6366f1' },
  'Eating Outside': { icon: '🍔', color: '#f43f5e' },
  'Miscellaneous Expenses': { icon: '📦', color: '#8b5cf6' }
};

// Currency Formatter
function formatINR(amount) {
  const val = Number(amount) || 0;
  return '₹' + val.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Compact Date Formatter
function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ----------------------------------------------------
// INITIALIZATION
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  applyTheme(state.theme);
  setupEventListeners();
  updateMonthDisplay();
  
  await fetchNetworkInfo();
  await loadRoommates();
  await loadSummary();
  await loadExpenses();
  await loadRentBill();
  
  // Background live sync every 8 seconds
  state.pollTimer = setInterval(() => {
    if (!document.hidden) {
      loadSummary(true);
      loadExpenses(true);
    }
  }, 8000);
});

// Setup event listeners
function setupEventListeners() {
  // Theme toggle
  document.getElementById('btn-theme-toggle').addEventListener('click', toggleTheme);

  // Month navigation
  document.getElementById('btn-prev-month').addEventListener('click', () => changeMonth(-1));
  document.getElementById('btn-next-month').addEventListener('click', () => changeMonth(1));
  
  const monthInput = document.getElementById('month-input-hidden');
  document.getElementById('btn-calendar-picker').addEventListener('click', () => {
    monthInput.showPicker ? monthInput.showPicker() : monthInput.click();
  });
  monthInput.addEventListener('change', (e) => {
    if (e.target.value) {
      setMonth(e.target.value);
    }
  });

  // Drawer
  document.getElementById('btn-open-drawer').addEventListener('click', openDrawer);

  // Network connect
  document.getElementById('btn-network-info').addEventListener('click', openNetworkModal);

  // Default dates for modals
  const todayYMD = new Date().toISOString().slice(0, 10);
  document.getElementById('exp-date').value = todayYMD;
  document.getElementById('settle-date').value = todayYMD;
  document.getElementById('rent-month-picker').value = state.currentMonth;
}

// ----------------------------------------------------
// THEME MANAGEMENT
// ----------------------------------------------------
function toggleTheme() {
  const nextTheme = state.theme === 'light' ? 'dark' : 'light';
  applyTheme(nextTheme);
}

function applyTheme(theme) {
  state.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('bem_theme', theme);
  document.getElementById('theme-icon').textContent = theme === 'dark' ? '☀️' : '🌙';
  
  // Refresh charts on theme switch
  if (state.categoryChart) state.categoryChart.destroy();
  if (state.roommateChart) state.roommateChart.destroy();
  if (state.multiYearChart) state.multiYearChart.destroy();
  renderCategoryChart();
  renderRoommateChart();
}

// ----------------------------------------------------
// TAB NAVIGATION
// ----------------------------------------------------
function switchTab(tabId) {
  state.activeTab = tabId;
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  document.querySelectorAll('.tab-content').forEach(section => {
    section.classList.toggle('active', section.id === `tab-${tabId}`);
  });

  if (tabId === 'rent-bill') {
    calculateRentBill();
  } else if (tabId === 'expenditure') {
    loadMultiYearArchive();
  } else if (tabId === 'settle') {
    loadSummary();
    loadSettlementsHistory();
  }
}

// ----------------------------------------------------
// MONTH NAVIGATION
// ----------------------------------------------------
function changeMonth(delta) {
  const [yearStr, monthStr] = state.currentMonth.split('-');
  let year = parseInt(yearStr, 10);
  let month = parseInt(monthStr, 10) + delta;

  if (month < 1) {
    month = 12;
    year--;
  } else if (month > 12) {
    month = 1;
    year++;
  }

  setMonth(`${year}-${String(month).padStart(2, '0')}`);
}

function setMonth(ymString) {
  state.currentMonth = ymString;
  updateMonthDisplay();
  document.getElementById('rent-month-picker').value = ymString;
  loadSummary();
  loadExpenses();
  loadRentBill();
}

function updateMonthDisplay() {
  const [yearStr, monthStr] = state.currentMonth.split('-');
  const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const formatted = dateObj.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
  document.getElementById('display-current-month').textContent = formatted;
  document.getElementById('banner-month-label').textContent = formatted;
  document.getElementById('drawer-current-month-label').textContent = formatted;
}

// ----------------------------------------------------
// API CALLS: NETWORK & ROOMMATES
// ----------------------------------------------------
async function fetchNetworkInfo() {
  try {
    const res = await fetch('/api/network-info');
    if (!res.ok) return;
    const data = await res.json();
    state.networkInfo = data;
    
    if (data.ips && data.ips.length > 0) {
      document.getElementById('network-badge-text').textContent = `Wi-Fi: ${data.ips[0]}:${data.port}`;
    }
  } catch (err) {
    console.warn('Network info unavailable:', err);
  }
}

async function loadRoommates() {
  try {
    const res = await fetch('/api/roommates');
    if (!res.ok) throw new Error('Failed to load roommates');
    state.roommates = await res.json();
    renderRoommateSelects();
    renderDrawerRoommates();
  } catch (err) {
    console.error('Error loading roommates:', err);
    showToast('Failed to load roommates list', 'error');
  }
}

function renderRoommateSelects() {
  const activeRoommates = state.roommates.filter(r => r.active);

  // Paid By in Expense Modal
  const expPaidBy = document.getElementById('exp-paid-by');
  expPaidBy.innerHTML = activeRoommates.map(r => 
    `<option value="${r.id}">${r.name}</option>`
  ).join('');

  // Filter Paid By
  const filterPaidBy = document.getElementById('filter-paid-by');
  filterPaidBy.innerHTML = `<option value="All">All Payers</option>` + 
    activeRoommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');

  // Split Checkboxes
  const splitContainer = document.getElementById('exp-split-checkboxes');
  splitContainer.innerHTML = activeRoommates.map(r => `
    <label class="split-checkbox-label">
      <input type="checkbox" name="split_roommate" value="${r.id}" checked />
      <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:${r.color};"></span>
      <span>${r.name.split(' ')[0]}</span>
    </label>
  `).join('');

  // Settle Selects
  const sPayer = document.getElementById('settle-payer-id');
  const sReceiver = document.getElementById('settle-receiver-id');
  sPayer.innerHTML = activeRoommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
  sReceiver.innerHTML = activeRoommates.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
}

function renderDrawerRoommates() {
  const list = document.getElementById('drawer-roommates-list');
  list.innerHTML = state.roommates.map(r => `
    <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 10px; background:var(--bg-page); border-radius:var(--radius-sm); border:1px solid var(--border-color);">
      <div style="display:flex; align-items:center; gap:8px;">
        <div style="width:28px; height:28px; border-radius:50%; background:${r.color}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:11px; font-weight:700;">
          ${r.avatar || r.name.slice(0, 2).toUpperCase()}
        </div>
        <div>
          <div style="font-size:12.5px; font-weight:700; color:var(--text-main);">${r.name}</div>
          <div style="font-size:10.5px; color:var(--text-muted);">${r.phone || 'Flatmate'}</div>
        </div>
      </div>
      <span style="font-size:11px; font-weight:700; color:${r.active ? 'var(--success)' : 'var(--text-muted)'};">
        ${r.active ? '● Active' : 'Inactive'}
      </span>
    </div>
  `).join('');
}

// ----------------------------------------------------
// API CALLS: EXPENSES
// ----------------------------------------------------
let searchDebounceTimeout = null;
function debounceFilter() {
  clearTimeout(searchDebounceTimeout);
  searchDebounceTimeout = setTimeout(() => {
    loadExpenses();
  }, 250);
}

async function loadExpenses(silent = false) {
  try {
    const category = document.getElementById('filter-category').value;
    const paidBy = document.getElementById('filter-paid-by').value;
    const search = document.getElementById('filter-search').value.trim();

    let url = `/api/expenses?month=${state.currentMonth}`;
    if (category && category !== 'All') url += `&category=${encodeURIComponent(category)}`;
    if (paidBy && paidBy !== 'All') url += `&paid_by=${encodeURIComponent(paidBy)}`;
    if (search) url += `&search=${encodeURIComponent(search)}`;

    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load expenses');
    state.expenses = await res.json();
    renderExpensesTable();
  } catch (err) {
    if (!silent) {
      console.error(err);
      showToast('Error loading expenses', 'error');
    }
  }
}

function renderExpensesTable() {
  const tbody = document.getElementById('expenses-table-body');
  if (state.expenses.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7">
          <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h4 style="font-size:15px; font-weight:700; margin-bottom:4px;">No Expenses Logged This Month</h4>
            <p style="font-size:12.5px;">Click the "+ Add Expense" button above to log flat groceries, bills, or rent!</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.expenses.map(e => {
    const catMeta = CATEGORY_META[e.category] || { icon: '📦', color: '#6366f1' };
    let splitNames = 'All Flatmates';
    try {
      const sIds = JSON.stringify(e.split_among_ids);
      const ids = typeof e.split_among_ids === 'string' ? JSON.parse(e.split_among_ids) : e.split_among_ids;
      if (Array.isArray(ids)) {
        splitNames = ids.map(id => {
          const rm = state.roommates.find(r => r.id === id);
          return rm ? rm.name.split(' ')[0] : 'Roommate';
        }).join(', ');
      }
    } catch {}

    return `
      <tr>
        <td style="white-space:nowrap; font-weight:600; font-size:12px; color:var(--text-muted);">
          ${formatDate(e.expense_date)}
        </td>
        <td>
          <div style="font-weight:700; color:var(--text-main); font-size:13.5px;">${escapeHtml(e.title)}</div>
          ${e.notes ? `<div style="font-size:11.5px; color:var(--text-muted); margin-top:2px;">💬 ${escapeHtml(e.notes)}</div>` : ''}
        </td>
        <td>
          <span class="category-tag" style="background:${catMeta.color}15; color:${catMeta.color};">
            ${catMeta.icon} ${e.category}
          </span>
        </td>
        <td style="font-size:14px; font-weight:800; color:var(--text-main); white-space:nowrap;">
          ${formatINR(e.amount)}
        </td>
        <td>
          <span class="payer-badge">
            <span class="payer-dot" style="background:${e.paid_by_color || '#4f46e5'};"></span>
            ${escapeHtml(e.paid_by_name || 'Roommate')}
          </span>
        </td>
        <td>
          <span style="font-size:11.5px; color:var(--text-muted); background:var(--bg-page); padding:3px 8px; border-radius:var(--radius-sm); border:1px solid var(--border-color);">
            👥 ${splitNames}
          </span>
        </td>
        <td style="text-align:right; white-space:nowrap;">
          <button class="btn btn-secondary btn-sm" onclick="openEditExpenseModal(${e.id})" title="Edit Expense">✏️</button>
          <button class="btn btn-danger-outline btn-sm" onclick="deleteExpense(${e.id})" title="Delete Expense">🗑️</button>
        </td>
      </tr>
    `;
  }).join('');
}

// ----------------------------------------------------
// API CALLS: SUMMARY & DEBT SETTLEMENTS
// ----------------------------------------------------
async function loadSummary(silent = false) {
  try {
    const res = await fetch(`/api/summary?month=${state.currentMonth}`);
    if (!res.ok) throw new Error('Failed to load summary');
    state.summary = await res.json();

    renderDashboardMetrics();
    renderRoommateBalances();
    renderCategoryChart();
    renderRoommateChart();
    renderSettleSection();
  } catch (err) {
    if (!silent) {
      console.error(err);
      showToast('Error loading financial summary', 'error');
    }
  }
}

function renderDashboardMetrics() {
  if (!state.summary) return;
  const s = state.summary;

  document.getElementById('stat-total-expense').textContent = formatINR(s.totalExpense);
  document.getElementById('stat-equal-share').textContent = formatINR(s.equalPerPersonShare);
  document.getElementById('stat-roommate-count').textContent = `Split across ${s.roommateCount} roommates`;
  document.getElementById('stat-expense-count').textContent = `${state.expenses.length} transactions this month`;

  // Calculate rent + electricity utility sum
  const cats = s.categoryBreakdown || {};
  const rentAndUtils = (cats['Flat Rent'] || 0) + (cats['Electricity Bill'] || 0) + 
                       (cats['Water Bill'] || 0) + (cats['WiFi/Internet'] || 0) + 
                       (cats['Gas Cylinder'] || 0);
  document.getElementById('stat-rent-utility').textContent = formatINR(rentAndUtils);

  // Daily average spend calculation
  const [yearStr, monthStr] = state.currentMonth.split('-');
  const now = new Date();
  const isCurrentMonth = now.getFullYear() === parseInt(yearStr, 10) && (now.getMonth() + 1) === parseInt(monthStr, 10);
  const daysInMonth = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10), 0).getDate();
  const daysPassed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

  const dailyAvg = s.totalExpense / daysPassed;
  document.getElementById('stat-daily-avg').textContent = formatINR(dailyAvg);
  document.getElementById('stat-days-passed').textContent = `${daysPassed} of ${daysInMonth} days evaluated`;
}

function renderRoommateBalances() {
  if (!state.summary || !state.summary.balances) return;
  const grid = document.getElementById('roommate-balances-grid');

  grid.innerHTML = state.summary.balances.map(b => {
    let badgeClass = 'zero';
    let statusText = 'Settled Up';
    if (b.net > 0.01) {
      badgeClass = 'positive';
      statusText = `Gets back +${formatINR(b.net)}`;
    } else if (b.net < -0.01) {
      badgeClass = 'negative';
      statusText = `Owes others -${formatINR(Math.abs(b.net))}`;
    }

    return `
      <div class="roommate-balance-card">
        <div>
          <div class="rm-card-header">
            <div class="rm-avatar" style="background:${b.color || '#4f46e5'};">
              ${b.avatar || b.name.slice(0, 2).toUpperCase()}
            </div>
            <div class="rm-info">
              <h4>${escapeHtml(b.name)}</h4>
              <span>Bachelor Roommate</span>
            </div>
          </div>
          <div class="rm-stats-row">
            <span class="rm-stat-label">Total Paid:</span>
            <span class="rm-stat-val">${formatINR(b.paid)}</span>
          </div>
          <div class="rm-stats-row">
            <span class="rm-stat-label">Equal Share:</span>
            <span class="rm-stat-val">${formatINR(b.share)}</span>
          </div>
        </div>
        <div class="rm-net-badge ${badgeClass}">
          <span>Net Balance</span>
          <span>${statusText}</span>
        </div>
      </div>
    `;
  }).join('');
}

// ----------------------------------------------------
// SETTLE UP & DEBTS CALCULATION (FIXED & ACCURATE)
// ----------------------------------------------------
function renderSettleSection() {
  if (!state.summary) return;
  const debts = state.summary.whoOwesWhom || [];
  const debtsContainer = document.getElementById('debts-cards-container');
  const allClearBanner = document.getElementById('settle-all-clear');
  const settleBadge = document.getElementById('settle-badge');

  settleBadge.textContent = debts.length;

  if (debts.length === 0) {
    debtsContainer.innerHTML = '';
    allClearBanner.style.display = 'block';
  } else {
    allClearBanner.style.display = 'none';
    debtsContainer.innerHTML = debts.map(d => `
      <div class="debt-item-card">
        <div class="debt-flow-info">
          <div style="width:40px; height:40px; border-radius:50%; background:${d.fromColor}; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:13px;">
            ${d.fromName.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <div style="font-size:14px; font-weight:800; color:var(--text-main);">
              ${escapeHtml(d.fromName)} <span style="font-weight:400; color:var(--text-muted);">owes</span> ${escapeHtml(d.toName)}
            </div>
            <div style="font-size:12px; color:var(--text-muted); margin-top:2px;">
              Direct payment clears this debt
            </div>
          </div>
        </div>
        <div style="display:flex; align-items:center; gap:14px;">
          <span class="debt-amount-pill">${formatINR(d.amount)}</span>
          <button class="btn btn-success btn-sm" onclick="triggerDirectSettle(${d.fromId}, ${d.toId}, ${d.amount}, '${escapeHtml(d.fromName)}', '${escapeHtml(d.toName)}')">
            🤝 Settle Up
          </button>
        </div>
      </div>
    `).join('');
  }

  // Roommates Net Balances Table in Settle Tab
  const balancesTable = document.getElementById('settle-balances-table-body');
  balancesTable.innerHTML = state.summary.balances.map(b => {
    let netStyle = 'color:var(--text-muted);';
    let netLabel = '₹0.00 (Settled)';
    if (b.net > 0.01) {
      netStyle = 'color:var(--success); font-weight:800;';
      netLabel = `+${formatINR(b.net)} (Gets Back)`;
    } else if (b.net < -0.01) {
      netStyle = 'color:var(--danger); font-weight:800;';
      netLabel = `-${formatINR(Math.abs(b.net))} (Needs to Pay)`;
    }

    return `
      <tr>
        <td style="font-weight:700; display:flex; align-items:center; gap:8px;">
          <span style="display:inline-block; width:10px; height:10px; border-radius:50%; background:${b.color};"></span>
          ${escapeHtml(b.name)}
        </td>
        <td>${formatINR(b.paid)}</td>
        <td>${formatINR(b.share)}</td>
        <td style="font-size:12px; color:var(--text-muted);">
          +${formatINR(b.settlementPaid || 0)} / -${formatINR(b.settlementReceived || 0)}
        </td>
        <td style="${netStyle}">${netLabel}</td>
      </tr>
    `;
  }).join('');
}

function triggerDirectSettle(fromId, toId, amount, fromName, toName) {
  document.getElementById('settle-payer-id').value = fromId;
  document.getElementById('settle-receiver-id').value = toId;
  document.getElementById('settle-amount').value = amount;
  document.getElementById('settle-notes').value = `Settlement between ${fromName} and ${toName} for ${state.currentMonth}`;
  openModal('modal-settle');
}

async function loadSettlementsHistory() {
  try {
    const res = await fetch('/api/settlements');
    if (!res.ok) return;
    state.settlements = await res.json();
    renderSettlementsHistoryTable();
  } catch (err) {
    console.error('Failed to load settlements:', err);
  }
}

function renderSettlementsHistoryTable() {
  const tbody = document.getElementById('settlements-history-body');
  if (state.settlements.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align:center; padding:18px; color:var(--text-muted);">
          No settlements recorded yet.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.settlements.map(s => `
    <tr>
      <td style="font-size:11.5px; color:var(--text-muted);">${formatDate(s.settlement_date)}</td>
      <td>
        <strong style="color:var(--text-main);">${escapeHtml(s.payer_name)}</strong>
        <span style="color:var(--text-muted); font-size:11px;"> paid </span>
        <strong style="color:var(--text-main);">${escapeHtml(s.receiver_name)}</strong>
      </td>
      <td style="font-weight:700; color:var(--success);">${formatINR(s.amount)}</td>
      <td>
        <span style="font-size:10.5px; background:var(--bg-page); border:1px solid var(--border-color); padding:2px 6px; border-radius:var(--radius-sm);">
          ${s.payment_method || 'UPI'}
        </span>
      </td>
      <td style="text-align:right;">
        <button class="btn btn-danger-outline btn-sm" onclick="deleteSettlement(${s.id})" title="Delete Settlement">✕</button>
      </td>
    </tr>
  `).join('');
}

async function handleSettleSubmit(event) {
  event.preventDefault();
  const payerId = parseInt(document.getElementById('settle-payer-id').value, 10);
  const receiverId = parseInt(document.getElementById('settle-receiver-id').value, 10);
  const amount = parseFloat(document.getElementById('settle-amount').value);
  const method = document.getElementById('settle-method').value;
  const date = document.getElementById('settle-date').value;
  const notes = document.getElementById('settle-notes').value;

  if (payerId === receiverId) {
    showToast('Payer and receiver cannot be the same person', 'error');
    return;
  }

  try {
    const res = await fetch('/api/settlements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payer_id: payerId,
        receiver_id: receiverId,
        amount,
        payment_method: method,
        settlement_date: date,
        notes
      })
    });

    if (!res.ok) throw new Error('Settlement could not be recorded');
    closeModal('modal-settle');
    showToast('Settlement recorded! Balances updated.', 'success');
    await loadSummary();
    await loadSettlementsHistory();
  } catch (err) {
    console.error(err);
    showToast(err.message, 'error');
  }
}

async function deleteSettlement(id) {
  if (!confirm('Are you sure you want to delete this settlement record?')) return;
  try {
    const res = await fetch(`/api/settlements/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete settlement');
    showToast('Settlement record removed', 'success');
    await loadSummary();
    await loadSettlementsHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function confirmResetSettlementHistory() {
  if (!confirm('⚠️ Are you sure you want to reset ALL settlement history?\nThis will clear past payments and recompute raw balances.')) {
    return;
  }
  try {
    const res = await fetch('/api/settlements/reset', { method: 'POST' });
    if (!res.ok) throw new Error('Failed to reset settlements');
    showToast('All settlement history has been reset', 'success');
    await loadSummary();
    await loadSettlementsHistory();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// FLAT RENT & ELECTRICITY BILL (SINGLE A4 PRINT ENGINE)
// ----------------------------------------------------
async function loadRentBill() {
  try {
    const res = await fetch(`/api/rent-bills?month=${state.currentMonth}`);
    if (!res.ok) return;
    state.rentBill = await res.json();
    populateRentForm(state.rentBill);
    calculateRentBill();
  } catch (err) {
    console.error('Failed to load rent bill:', err);
  }
}

function onRentMonthChange() {
  const chosenMonth = document.getElementById('rent-month-picker').value;
  if (chosenMonth) {
    state.currentMonth = chosenMonth;
    updateMonthDisplay();
    loadRentBill();
  }
}

function populateRentForm(bill) {
  if (!bill) return;
  document.getElementById('rent-flat-amount').value = bill.flat_rent || 12000;
  document.getElementById('rent-meter-prev').value = bill.prev_reading || 1000;
  document.getElementById('rent-meter-curr').value = bill.curr_reading || 1180;
  document.getElementById('rent-meter-rate').value = bill.unit_rate || 8.0;
  document.getElementById('rent-water-bill').value = bill.water_bill || 0;
  document.getElementById('rent-wifi-bill').value = bill.wifi_bill || 0;
  document.getElementById('rent-gas-bill').value = bill.gas_bill || 0;
  document.getElementById('rent-other-charges').value = bill.other_charges || 0;
  document.getElementById('rent-flat-address').value = bill.flat_address || 'Flat #304, Sunshine Residency, HSR Layout, Bengaluru';
  document.getElementById('rent-meter-no').value = bill.meter_no || 'BESCOM-KA-7821';
}

function calculateRentBill() {
  const flatRent = parseFloat(document.getElementById('rent-flat-amount').value) || 0;
  const prevReading = parseFloat(document.getElementById('rent-meter-prev').value) || 0;
  const currReading = parseFloat(document.getElementById('rent-meter-curr').value) || 0;
  const unitRate = parseFloat(document.getElementById('rent-meter-rate').value) || 8.0;

  const waterBill = parseFloat(document.getElementById('rent-water-bill').value) || 0;
  const wifiBill = parseFloat(document.getElementById('rent-wifi-bill').value) || 0;
  const gasBill = parseFloat(document.getElementById('rent-gas-bill').value) || 0;
  const otherCharges = parseFloat(document.getElementById('rent-other-charges').value) || 0;

  const unitsConsumed = Math.max(0, currReading - prevReading);
  const electricityTotal = unitsConsumed * unitRate;

  const utilitiesTotal = waterBill + wifiBill + gasBill + otherCharges;
  const grandTotal = flatRent + electricityTotal + utilitiesTotal;

  const activeRms = state.roommates.filter(r => r.active);
  const rmCount = Math.max(1, activeRms.length);
  const perPersonShare = grandTotal / rmCount;

  // Update UI Callouts
  document.getElementById('calc-units-consumed').textContent = `${unitsConsumed.toFixed(1)} Units`;
  document.getElementById('calc-electricity-total').textContent = formatINR(electricityTotal);
  document.getElementById('bill-summary-rent').textContent = formatINR(flatRent);
  document.getElementById('bill-summary-power').textContent = `${formatINR(electricityTotal)} (${unitsConsumed.toFixed(1)} units @ ₹${unitRate}/u)`;
  document.getElementById('bill-summary-utils').textContent = formatINR(utilitiesTotal);
  document.getElementById('bill-summary-grand').textContent = formatINR(grandTotal);
  document.getElementById('bill-summary-rm-count').textContent = rmCount;
  document.getElementById('bill-summary-per-head').textContent = `${formatINR(perPersonShare)} / head`;

  // Render live single A4 preview & print wrapper
  renderA4Bill({
    flatRent,
    prevReading,
    currReading,
    unitRate,
    unitsConsumed,
    electricityTotal,
    waterBill,
    wifiBill,
    gasBill,
    otherCharges,
    grandTotal,
    perPersonShare,
    activeRms,
    monthYear: state.currentMonth,
    flatAddress: document.getElementById('rent-flat-address').value,
    meterNo: document.getElementById('rent-meter-no').value
  });
}

function renderA4Bill(data) {
  const [yearStr, monthStr] = data.monthYear.split('-');
  const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const monthName = dateObj.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const invoiceNo = `BEM-${yearStr}${monthStr}-${Math.floor(1000 + Math.random() * 9000)}`;
  const invoiceDate = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  const billHtml = `
    <div class="a4-bill-card">
      <!-- A4 Header -->
      <div class="a4-header">
        <div class="a4-brand">
          <h2>BACHELOR EXPENSE MANAGER</h2>
          <p>Official Flat Rent & Utility Bill Invoice • Strictly Single A4 Page</p>
        </div>
        <div class="a4-invoice-meta">
          <span class="invoice-badge">INVOICE: ${invoiceNo}</span>
          <div><strong>Billing Month:</strong> ${monthName}</div>
          <div><strong>Invoice Date:</strong> ${invoiceDate}</div>
        </div>
      </div>

      <!-- Flat & Meter Info Grid -->
      <div class="a4-grid-2">
        <div class="a4-info-box">
          <h4>📍 Apartment / Flat Details</h4>
          <p><strong>Address:</strong> ${escapeHtml(data.flatAddress)}</p>
          <p><strong>Bachelors Sharing:</strong> ${data.activeRms.map(r => r.name).join(', ')}</p>
        </div>
        <div class="a4-info-box">
          <h4>⚡ Electricity Meter Info</h4>
          <p><strong>Meter No:</strong> ${escapeHtml(data.meterNo)}</p>
          <p><strong>Electricity Tariff:</strong> ₹${data.unitRate.toFixed(2)} per Unit</p>
        </div>
      </div>

      <!-- Electricity Consumption Box -->
      <div class="a4-meter-box">
        <div class="a4-meter-title">
          <span>⚡ Electricity Meter Reading Breakdown</span>
          <span>Approved Tariff: ₹${data.unitRate.toFixed(2)}/kWh</span>
        </div>
        <div class="a4-meter-stats">
          <div class="a4-meter-stat-item">
            <div class="a4-meter-stat-label">Previous Reading</div>
            <div class="a4-meter-stat-val">${data.prevReading.toFixed(1)}</div>
          </div>
          <div class="a4-meter-stat-item">
            <div class="a4-meter-stat-label">Current Reading</div>
            <div class="a4-meter-stat-val">${data.currReading.toFixed(1)}</div>
          </div>
          <div class="a4-meter-stat-item">
            <div class="a4-meter-stat-label">Units Consumed</div>
            <div class="a4-meter-stat-val">${data.unitsConsumed.toFixed(1)}</div>
          </div>
          <div class="a4-meter-stat-item">
            <div class="a4-meter-stat-label">Total Power Charge</div>
            <div class="a4-meter-stat-val">${formatINR(data.electricityTotal)}</div>
          </div>
        </div>
      </div>

      <!-- Itemized Bill Table -->
      <table class="a4-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Item Description</th>
            <th>Unit / Reading Basis</th>
            <th class="text-right">Amount (₹)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td><strong>Flat Base Rent</strong> (${monthName})</td>
            <td>Monthly Lease Agreement</td>
            <td class="text-right font-bold">${formatINR(data.flatRent)}</td>
          </tr>
          <tr>
            <td>2</td>
            <td><strong>BESCOM Electricity Bill</strong></td>
            <td>${data.unitsConsumed.toFixed(1)} units @ ₹${data.unitRate.toFixed(2)} / unit</td>
            <td class="text-right font-bold">${formatINR(data.electricityTotal)}</td>
          </tr>
          ${data.waterBill > 0 ? `
          <tr>
            <td>3</td>
            <td>Water Supply & Maintenance</td>
            <td>Monthly Flat Share</td>
            <td class="text-right">${formatINR(data.waterBill)}</td>
          </tr>` : ''}
          ${data.wifiBill > 0 ? `
          <tr>
            <td>4</td>
            <td>High-Speed WiFi / Broadband Internet</td>
            <td>Fiber 100 Mbps Monthly Plan</td>
            <td class="text-right">${formatINR(data.wifiBill)}</td>
          </tr>` : ''}
          ${data.gasBill > 0 ? `
          <tr>
            <td>5</td>
            <td>LPG Gas Cylinder Refill</td>
            <td>Kitchen Cooking Gas</td>
            <td class="text-right">${formatINR(data.gasBill)}</td>
          </tr>` : ''}
          ${data.otherCharges > 0 ? `
          <tr>
            <td>6</td>
            <td>Other Society Maintenance & Cleaning</td>
            <td>Society Maintenance</td>
            <td class="text-right">${formatINR(data.otherCharges)}</td>
          </tr>` : ''}
          <tr class="total-row">
            <td colspan="3" class="text-right">GRAND TOTAL PAYABLE AMOUNT:</td>
            <td class="text-right font-bold">${formatINR(data.grandTotal)}</td>
          </tr>
        </tbody>
      </table>

      <!-- Equal Split Distribution Table -->
      <div class="a4-split-box">
        <h4>👥 Equal Roommate Distribution (${data.activeRms.length} Bachelors)</h4>
        <table class="a4-table" style="margin-bottom:0;">
          <thead>
            <tr>
              <th>Roommate Name</th>
              <th>Equal Split Ratio</th>
              <th>Payable Share</th>
              <th>Status</th>
              <th>Signature</th>
            </tr>
          </thead>
          <tbody>
            ${data.activeRms.map(r => `
              <tr>
                <td><strong>${escapeHtml(r.name)}</strong></td>
                <td>1 / ${data.activeRms.length}</td>
                <td class="font-bold">${formatINR(data.perPersonShare)}</td>
                <td><span style="color:#059669; font-weight:700;">● Due Equal</span></td>
                <td style="color:#94a3b8; font-style:italic;">_________________</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Signatures Grid -->
      <div class="a4-signatures">
        <div class="a4-sign-block">
          <div class="a4-sign-line"></div>
          <div class="a4-sign-label">Shivam Kumar (Tenant)</div>
        </div>
        <div class="a4-sign-block">
          <div class="a4-sign-line"></div>
          <div class="a4-sign-label">Rishu / Raj (Tenant)</div>
        </div>
        <div class="a4-sign-block">
          <div class="a4-sign-line"></div>
          <div class="a4-sign-label">Flat Representative / Owner</div>
        </div>
      </div>

      <div class="a4-footer-notes">
        Generated via Bachelor Expense Manager • Valid single-page computer printed record • No spillover guarantee
      </div>
    </div>
  `;

  // Update preview container and hidden print wrapper
  document.getElementById('live-bill-preview-container').innerHTML = billHtml;
  document.getElementById('printable-bill-wrapper').innerHTML = billHtml;
}

async function saveRentBill(event) {
  event.preventDefault();
  const billData = {
    month_year: state.currentMonth,
    flat_rent: parseFloat(document.getElementById('rent-flat-amount').value) || 0,
    prev_reading: parseFloat(document.getElementById('rent-meter-prev').value) || 0,
    curr_reading: parseFloat(document.getElementById('rent-meter-curr').value) || 0,
    unit_rate: parseFloat(document.getElementById('rent-meter-rate').value) || 8.0,
    water_bill: parseFloat(document.getElementById('rent-water-bill').value) || 0,
    wifi_bill: parseFloat(document.getElementById('rent-wifi-bill').value) || 0,
    gas_bill: parseFloat(document.getElementById('rent-gas-bill').value) || 0,
    other_charges: parseFloat(document.getElementById('rent-other-charges').value) || 0,
    flat_address: document.getElementById('rent-flat-address').value,
    meter_no: document.getElementById('rent-meter-no').value
  };

  try {
    const res = await fetch('/api/rent-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(billData)
    });
    if (!res.ok) throw new Error('Failed to save rent bill');
    showToast('Flat rent & electricity details saved!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Convert rent and electricity bill into dashboard expenses
async function postBillAsExpenses() {
  if (!confirm('Post this month\'s Flat Rent and Electricity Bill as expenses in the dashboard?')) return;

  const flatRent = parseFloat(document.getElementById('rent-flat-amount').value) || 0;
  const prevReading = parseFloat(document.getElementById('rent-meter-prev').value) || 0;
  const currReading = parseFloat(document.getElementById('rent-meter-curr').value) || 0;
  const unitRate = parseFloat(document.getElementById('rent-meter-rate').value) || 8.0;
  const powerAmt = Math.max(0, currReading - prevReading) * unitRate;

  const activeRms = state.roommates.filter(r => r.active);
  const shivam = activeRms.find(r => r.name.includes('Shivam')) || activeRms[0];
  const splitIds = activeRms.map(r => r.id);
  const dateStr = `${state.currentMonth}-01`;

  try {
    // 1. Post Flat Rent
    if (flatRent > 0) {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `Flat Rent (${state.currentMonth})`,
          category: 'Flat Rent',
          amount: flatRent,
          paid_by_id: shivam.id,
          split_among_ids: splitIds,
          expense_date: dateStr,
          notes: 'Auto-generated from Flat Rent Calculator'
        })
      });
    }

    // 2. Post Electricity
    if (powerAmt > 0) {
      await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: `BESCOM Electricity Bill (${(currReading - prevReading).toFixed(1)} units @ ₹${unitRate})`,
          category: 'Electricity Bill',
          amount: powerAmt,
          paid_by_id: shivam.id,
          split_among_ids: splitIds,
          expense_date: dateStr,
          notes: `Meter reading: ${prevReading} -> ${currReading}`
        })
      });
    }

    showToast('Rent & Electricity bills posted to dashboard!', 'success');
    await loadSummary();
    await loadExpenses();
    switchTab('dashboard');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function triggerPrintBill() {
  calculateRentBill();
  setTimeout(() => {
    if (window.AndroidApp && typeof window.AndroidApp.printBill === 'function') {
      window.AndroidApp.printBill();
    } else {
      window.print();
    }
  }, 100);
}

// ----------------------------------------------------
// 3-YEAR MONTHLY EXPENDITURE ARCHIVE
// ----------------------------------------------------
async function loadMultiYearArchive() {
  try {
    const res = await fetch(`/api/multi-year-summary?year=${state.archiveYear}`);
    if (!res.ok) return;
    const data = await res.json();
    renderArchiveYearsPills(data);
    renderArchiveYearData(data.years[state.archiveYear]);
    renderMultiYearChart(data.years[state.archiveYear]);
  } catch (err) {
    console.error('Error loading multi-year archive:', err);
  }
}

function renderArchiveYearsPills(data) {
  const container = document.getElementById('archive-year-pills');
  const years = Object.keys(data.years).map(Number).sort();

  container.innerHTML = years.map(yr => `
    <button class="year-pill-btn ${yr === state.archiveYear ? 'active' : ''}" onclick="selectArchiveYear(${yr})">
      ${yr}
    </button>
  `).join('');
}

function selectArchiveYear(yr) {
  state.archiveYear = yr;
  loadMultiYearArchive();
}

function renderArchiveYearData(yearData) {
  if (!yearData) return;
  document.getElementById('archive-selected-year-title').textContent = yearData.year;
  document.getElementById('trend-year-label').textContent = yearData.year;
  document.getElementById('archive-year-total').textContent = formatINR(yearData.totalYearExpense);
  document.getElementById('archive-year-avg').textContent = `${formatINR(yearData.totalYearExpense / 12)} / month avg`;

  // Highest month
  let highestMonth = { monthName: '-', totalExpense: 0 };
  let totalCount = 0;

  for (const m of yearData.months) {
    totalCount += m.expenseCount;
    if (m.totalExpense > highestMonth.totalExpense) {
      highestMonth = m;
    }
  }

  document.getElementById('archive-highest-month').textContent = highestMonth.monthName;
  document.getElementById('archive-highest-amt').textContent = formatINR(highestMonth.totalExpense);
  document.getElementById('archive-year-count').textContent = totalCount;

  // 12 Months Cards Grid
  const grid = document.getElementById('months-archive-grid');
  grid.innerHTML = yearData.months.map(m => `
    <div class="month-archive-card" onclick="jumpToMonth('${m.month}')">
      <div class="month-archive-title">
        <h4>${m.monthName} ${yearData.year}</h4>
        <span style="font-size:11px; font-weight:700; color:var(--text-muted); background:var(--bg-page); padding:2px 8px; border-radius:var(--radius-full); border:1px solid var(--border-color);">
          ${m.expenseCount} entries
        </span>
      </div>
      <div class="month-archive-total">${formatINR(m.totalExpense)}</div>
      <div style="font-size:11.5px; color:var(--text-muted); margin-bottom:10px;">
        ${m.expenseCount > 0 ? 'Click to inspect or manage expenses' : 'No expenses recorded'}
      </div>
      <button class="btn btn-secondary btn-sm" style="width:100%;">
        Jump to ${m.monthName} ➔
      </button>
    </div>
  `).join('');
}

function jumpToMonth(ym) {
  setMonth(ym);
  switchTab('dashboard');
}

// ----------------------------------------------------
// CHARTS (CHART.JS)
// ----------------------------------------------------
function renderCategoryChart() {
  const ctx = document.getElementById('categoryChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const cats = (state.summary && state.summary.categoryBreakdown) || {};
  const labels = Object.keys(cats);
  const data = Object.values(cats);

  document.getElementById('chart-cat-count').textContent = `${labels.length} Active`;

  if (labels.length === 0) {
    if (state.categoryChart) state.categoryChart.destroy();
    return;
  }

  const colors = labels.map(l => (CATEGORY_META[l] ? CATEGORY_META[l].color : '#6366f1'));

  if (state.categoryChart) {
    state.categoryChart.destroy();
  }

  state.categoryChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: state.theme === 'dark' ? '#1f2937' : '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            font: { size: 11 },
            color: state.theme === 'dark' ? '#cbd5e1' : '#334155'
          }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.label}: ${formatINR(item.raw)}`
          }
        }
      },
      cutout: '65%'
    }
  });
}

function renderRoommateChart() {
  const ctx = document.getElementById('roommateChart');
  if (!ctx || typeof Chart === 'undefined') return;

  const balances = (state.summary && state.summary.balances) || [];
  if (balances.length === 0) {
    if (state.roommateChart) state.roommateChart.destroy();
    return;
  }

  const names = balances.map(b => b.name.split(' ')[0]);
  const paidData = balances.map(b => b.paid);
  const shareData = balances.map(b => b.share);

  if (state.roommateChart) {
    state.roommateChart.destroy();
  }

  state.roommateChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: names,
      datasets: [
        {
          label: 'Total Paid',
          data: paidData,
          backgroundColor: '#4f46e5',
          borderRadius: 4
        },
        {
          label: 'Equal Share',
          data: shareData,
          backgroundColor: '#10b981',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: (v) => '₹' + v,
            color: state.theme === 'dark' ? '#94a3b8' : '#64748b',
            font: { size: 11 }
          },
          grid: {
            color: state.theme === 'dark' ? '#374151' : '#f1f5f9'
          }
        },
        x: {
          ticks: {
            color: state.theme === 'dark' ? '#cbd5e1' : '#334155',
            font: { size: 12, weight: 600 }
          },
          grid: { display: false }
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            color: state.theme === 'dark' ? '#cbd5e1' : '#334155',
            font: { size: 11 }
          }
        },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.dataset.label}: ${formatINR(item.raw)}`
          }
        }
      }
    }
  });
}

function renderMultiYearChart(yearData) {
  const ctx = document.getElementById('multiYearChart');
  if (!ctx || typeof Chart === 'undefined' || !yearData) return;

  const labels = yearData.months.map(m => m.monthName);
  const data = yearData.months.map(m => m.totalExpense);

  if (state.multiYearChart) {
    state.multiYearChart.destroy();
  }

  state.multiYearChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: `Expenditure ${yearData.year}`,
        data,
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.35,
        pointBackgroundColor: '#4f46e5',
        pointRadius: 4,
        pointHoverRadius: 6
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          ticks: {
            callback: (v) => '₹' + v,
            color: state.theme === 'dark' ? '#94a3b8' : '#64748b'
          },
          grid: { color: state.theme === 'dark' ? '#374151' : '#f1f5f9' }
        },
        x: {
          ticks: { color: state.theme === 'dark' ? '#cbd5e1' : '#334155' },
          grid: { display: false }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: (item) => ` Total: ${formatINR(item.raw)}`
          }
        }
      }
    }
  });
}

// ----------------------------------------------------
// EXPENSE CRUD MODALS & ACTIONS
// ----------------------------------------------------
function openAddExpenseModal() {
  document.getElementById('expense-form').reset();
  document.getElementById('expense-edit-id').value = '';
  document.getElementById('expense-modal-title').textContent = '➕ Add New Expense';
  document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
  
  // Check all roommates by default
  document.querySelectorAll('input[name="split_roommate"]').forEach(cb => cb.checked = true);
  openModal('modal-expense');
}

function openEditExpenseModal(id) {
  const exp = state.expenses.find(e => e.id === id);
  if (!exp) return;

  document.getElementById('expense-edit-id').value = exp.id;
  document.getElementById('expense-modal-title').textContent = '✏️ Edit Expense';
  document.getElementById('exp-title').value = exp.title;
  document.getElementById('exp-category').value = exp.category;
  document.getElementById('exp-amount').value = exp.amount;
  document.getElementById('exp-paid-by').value = exp.paid_by_id;
  document.getElementById('exp-date').value = exp.expense_date;
  document.getElementById('exp-notes').value = exp.notes || '';

  let splitIds = [];
  try {
    splitIds = typeof exp.split_among_ids === 'string' ? JSON.parse(exp.split_among_ids) : exp.split_among_ids;
  } catch {}

  document.querySelectorAll('input[name="split_roommate"]').forEach(cb => {
    cb.checked = splitIds.includes(parseInt(cb.value, 10));
  });

  openModal('modal-expense');
}

async function handleExpenseSubmit(event) {
  event.preventDefault();
  const editId = document.getElementById('expense-edit-id').value;
  const title = document.getElementById('exp-title').value.trim();
  const category = document.getElementById('exp-category').value;
  const amount = parseFloat(document.getElementById('exp-amount').value);
  const paidById = parseInt(document.getElementById('exp-paid-by').value, 10);
  const expenseDate = document.getElementById('exp-date').value;
  const notes = document.getElementById('exp-notes').value.trim();

  const splitCheckboxes = document.querySelectorAll('input[name="split_roommate"]:checked');
  const splitAmongIds = Array.from(splitCheckboxes).map(cb => parseInt(cb.value, 10));

  if (splitAmongIds.length === 0) {
    showToast('Select at least one roommate to split with', 'error');
    return;
  }

  const payload = {
    title,
    category,
    amount,
    paid_by_id: paidById,
    split_among_ids: splitAmongIds,
    expense_date: expenseDate,
    notes
  };

  try {
    let res;
    if (editId) {
      res = await fetch(`/api/expenses/${editId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }

    if (!res.ok) throw new Error('Failed to save expense');
    closeModal('modal-expense');
    showToast(editId ? 'Expense updated successfully!' : 'Expense added successfully!', 'success');
    
    // Switch to expense month if different
    const expYM = expenseDate.slice(0, 7);
    if (expYM !== state.currentMonth) {
      setMonth(expYM);
    } else {
      await loadSummary();
      await loadExpenses();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteExpense(id) {
  if (!confirm('Are you sure you want to delete this expense?')) return;
  try {
    const res = await fetch(`/api/expenses/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete expense');
    showToast('Expense deleted successfully', 'success');
    await loadSummary();
    await loadExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// RESET BUTTONS (PROMPT REQUIREMENTS)
// ----------------------------------------------------
async function confirmResetMonthExpenses() {
  const [yearStr, monthStr] = state.currentMonth.split('-');
  const monthName = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  
  if (!confirm(`⚠️ DANGER: Reset all expenses for ${monthName}?\nThis will clear all transactions recorded for this month only.`)) {
    return;
  }

  try {
    const res = await fetch('/api/expenses/reset-month', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ month: state.currentMonth })
    });
    if (!res.ok) throw new Error('Failed to reset month expenses');
    const data = await res.json();
    showToast(data.message, 'success');
    closeDrawer();
    await loadSummary();
    await loadExpenses();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// ADD ROOMMATE (DYNAMIC ROOMMATES: 3 TO 4+)
// ----------------------------------------------------
function openAddRoommateModal() {
  document.getElementById('roommate-form').reset();
  closeDrawer();
  openModal('modal-roommate');
}

async function handleRoommateSubmit(event) {
  event.preventDefault();
  const name = document.getElementById('rm-name').value.trim();
  const phone = document.getElementById('rm-phone').value.trim();
  const avatar = document.getElementById('rm-avatar').value.trim();
  const color = document.getElementById('rm-color').value;

  try {
    const res = await fetch('/api/roommates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, avatar, color })
    });

    if (!res.ok) throw new Error('Failed to add roommate');
    const newRm = await res.json();
    closeModal('modal-roommate');
    showToast(`Roommate ${newRm.name} added!`, 'success');
    
    await loadRoommates();
    await loadSummary();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ----------------------------------------------------
// NETWORK WI-FI CONNECT MODAL & QR CODE
// ----------------------------------------------------
function openNetworkModal() {
  const container = document.getElementById('qrcode-container');
  const urlDisplay = document.getElementById('network-share-url');
  container.innerHTML = '';

  const url = (state.networkInfo && state.networkInfo.networkUrls && state.networkInfo.networkUrls.length > 0)
    ? state.networkInfo.networkUrls[0]
    : window.location.href;

  urlDisplay.textContent = url;

  if (typeof QRCode !== 'undefined') {
    new QRCode(container, {
      text: url,
      width: 170,
      height: 170,
      colorDark: '#0f172a',
      colorLight: '#ffffff',
      correctLevel: QRCode.CorrectLevel.H
    });
  } else {
    container.innerHTML = `<p style="font-size:12px; color:var(--text-muted);">QR Code library unavailable</p>`;
  }

  openModal('modal-network');
}

function copyNetworkUrl() {
  const url = document.getElementById('network-share-url').textContent;
  navigator.clipboard.writeText(url).then(() => {
    showToast('Wi-Fi connection link copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

// ----------------------------------------------------
// DRAWER & MODAL HELPERS
// ----------------------------------------------------
function openDrawer() {
  document.getElementById('drawer-overlay').classList.add('active');
  document.getElementById('drawer-panel').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer-overlay').classList.remove('active');
  document.getElementById('drawer-panel').classList.remove('open');
}

function openModal(id) {
  document.getElementById(id).classList.add('active');
}

function closeModal(id) {
  document.getElementById(id).classList.remove('active');
}

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span>${type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️'}</span>
    <span>${escapeHtml(message)}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(50px)';
    toast.style.transition = 'all 0.25s ease';
    setTimeout(() => toast.remove(), 250);
  }, 3500);
}

// Security Helper
function escapeHtml(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

// ----------------------------------------------------
// PWA & ANDROID INSTALLATION SUPPORT
// ----------------------------------------------------
let deferredPrompt = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('ServiceWorker registered with scope:', reg.scope))
      .catch(err => console.warn('ServiceWorker registration failed:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
  }
});

window.addEventListener('appinstalled', () => {
  deferredPrompt = null;
  const installBtn = document.getElementById('btn-install-pwa');
  if (installBtn) installBtn.style.display = 'none';
  showToast('Bachelor Expense Manager installed successfully!', 'success');
});

function triggerPWAInstall() {
  if (deferredPrompt) {
    deferredPrompt.prompt();
    deferredPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('Installing Bachelor Expense Manager...', 'info');
      }
      deferredPrompt = null;
    });
  } else {
    showToast('To install: Tap your mobile browser menu (⋮) -> "Add to Home screen" or "Install App"!', 'info');
  }
}

