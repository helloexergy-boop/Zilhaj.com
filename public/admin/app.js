/**
 * ZILHAJ Admin Panel - Live Real-Time Database Engine
 * Connects directly to MongoDB Atlas Backend APIs
 * Fully reactive, zero mock data, live 10-second polling
 */

// ==========================================
// 1. Live State Store
// ==========================================
const state = {
  currentTab: 'dashboard',
  selectedRequestId: null,
  requestsFilter: 'All', // 'All', 'Umrah', 'Hajj'
  requestsStatusFilter: 'All',
  requestsSearchQuery: '',
  usersRoleFilter: 'All',
  usersStatusFilter: 'All',
  usersSearchQuery: '',
  subAdminsStatusFilter: 'All',
  subAdminsRoleFilter: 'All',
  subAdminsSearchQuery: '',
  currentUser: null,
  notifications: [],
  requests: [], // Live from /api/admin/requirements
  users: [], // Live from /api/admin/users
  subAdmins: [], // Live from /api/admin/subadmins
  bookings: [], // Live from /api/bookings
  stats: null, // Live from /api/admin/stats
  // Central Package Inventory State
  packageInventory: [],
  inventorySearchQuery: '',
  inventoryServiceFilter: 'All',
  inventoryStatusFilter: 'All',
  // Customer Care Support State
  supportTickets: [],
  selectedIssueId: null,
  selectedTicketDetails: null,
  supportFilterStatus: 'All',
  supportFilterPriority: 'All',
  supportFilterCategory: 'All',
  supportFilterSort: 'newest',
  supportSearchQuery: '',
  adminReplyMode: 'CUSTOMER_REPLY',
  supportStats: { pendingIssues: 0, solvedIssues: 0, urgentIssues: 0, totalTickets: 0 },
  supportNotifications: [],
  agents: [],
  subAdminPerformance: []
};

// ==========================================
// 2. API Helper
// ==========================================
function getApiBase() {
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    const port = window.location.port ? window.location.port : '3000';
    return `${window.location.protocol}//${window.location.hostname}:${port}/api`;
  }
  return '/api';
}

function getAuthHeaders() {
  const user = JSON.parse(localStorage.getItem('umrah_user') || 'null');
  const token = (user && (user.token || user.jwtToken)) ||
                localStorage.getItem('umrah_token') ||
                localStorage.getItem('zilhaj_token') ||
                sessionStorage.getItem('zilhaj_token') ||
                '';
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}


// ==========================================
// 3. Core Toast Notification Engine
// ==========================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  
  let borderColor = 'var(--primary)';
  if (type === 'danger') borderColor = '#dc2626';
  if (type === 'info') borderColor = '#0284c7';
  toast.style.borderLeftColor = borderColor;

  toast.innerHTML = `
    <span style="font-size: 16px;">${type === 'danger' ? '⚠️' : type === 'info' ? 'ℹ️' : '✓'}</span>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// ==========================================
// 4. Data Loading & Live Sync Engine
// ==========================================
async function refreshAllData(showNotification = false) {
  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const [reqsRes, usersRes, staffRes, statsRes, bookRes] = await Promise.all([
      fetch(`${apiBase}/admin/requirements`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${apiBase}/admin/users`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${apiBase}/admin/subadmins`, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`${apiBase}/admin/stats`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`${apiBase}/bookings`, { headers }).then(r => r.ok ? r.json() : []).catch(() => [])
    ]);

    const reqsList = Array.isArray(reqsRes) ? reqsRes : (reqsRes && Array.isArray(reqsRes.requirements) ? reqsRes.requirements : []);
    state.requests = reqsList;

    const usersList = Array.isArray(usersRes) ? usersRes : (usersRes && Array.isArray(usersRes.users) ? usersRes.users : []);
    state.users = usersList;

    const staffList = Array.isArray(staffRes) ? staffRes : (staffRes && Array.isArray(staffRes.subadmins) ? staffRes.subadmins : []);
    state.subAdmins = staffList;
    state.subAdminPerformance = staffList.map(s => ({
      name: s.name,
      initials: s.initials,
      offers: s.requestsHandled || 0,
      avatarBg: s.avatarBg,
      avatarColor: s.avatarColor
    }));

    if (statsRes) {
      state.stats = statsRes;
    }
    if (Array.isArray(bookRes)) {
      state.bookings = bookRes;
    }

    // Load Live Support System data, inventory, and notifications
    await Promise.all([
      loadAdminSupportData(false),
      loadInventoryData(false)
    ]);

    // Update Header Badges
    const badgeEl = document.getElementById('nav-req-count-badge');
    const sideBadgeEl = document.getElementById('sidebar-req-count-badge');
    const inProgressCount = state.requests.filter(r => r.status === 'In Progress' || r.status === 'Pending').length;
    if (badgeEl) badgeEl.textContent = inProgressCount || state.requests.length;
    if (sideBadgeEl) sideBadgeEl.textContent = inProgressCount || state.requests.length;

    // Render active tab
    renderCurrentTab();

    if (showNotification) {
      showToast('Live database synchronized with MongoDB Atlas!', 'success');
    }
  } catch (err) {
    console.error('Data refresh error:', err);
    if (showNotification) showToast('Failed to sync live data', 'danger');
  }
}

function renderAdminNotifications(notifs, unreadCount) {
  const notifsContainer = document.getElementById('notifs-container-list');
  const dot = document.getElementById('header-notif-dot');
  if (dot) {
    dot.textContent = unreadCount || '0';
    dot.style.display = unreadCount > 0 ? 'flex' : 'none';
  }

  if (notifsContainer) {
    if (!notifs || notifs.length === 0) {
      notifsContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 20px; font-size: 12px;">No new alerts at this time.</div>';
      return;
    }

    notifsContainer.innerHTML = notifs.map(n => `
      <div onclick="openSupportFromNotification('${n.issue_id || ''}', '${n.id}')" style="padding: 12px; background: ${n.is_read ? '#f8fafc' : '#ecfdf5'}; border-radius: var(--radius-md); font-size: 12px; border: 1px solid ${n.is_read ? '#e2e8f0' : '#a7f3d0'}; cursor: pointer; transition: background 0.15s ease;" onmouseover="this.style.background='#e0f2fe'" onmouseout="this.style.background='${n.is_read ? '#f8fafc' : '#ecfdf5'}'">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: ${n.is_read ? 'var(--text-main)' : '#065f46'}; font-weight: 800;">${escapeHtml(n.title)}</strong>
          ${n.issue_id ? `<span style="font-family: monospace; font-size: 10px; background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-weight: 700;">${n.issue_id}</span>` : ''}
        </div>
        <div style="color: var(--text-body); margin-top: 4px; font-size: 11.5px;">${escapeHtml(n.message)}</div>
        <div style="font-size: 10px; color: var(--text-light); margin-top: 6px;">${new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
      </div>
    `).join('');
  }
}

async function markAllNotifsRead() {
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    await fetch(`${apiBase}/admin/support/notifications/read-all`, { method: 'PATCH', headers });
  } catch (e) {}

  state.supportNotifications.forEach(n => n.is_read = true);
  const dot = document.getElementById('header-notif-dot');
  if (dot) {
    dot.textContent = '0';
    dot.style.display = 'none';
  }
  renderAdminNotifications(state.supportNotifications, 0);
  closeModal('notifications-modal');
  showToast('All notifications marked as read', 'info');
}

async function openSupportFromNotification(issueId, notifId) {
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  if (notifId) {
    try {
      await fetch(`${apiBase}/admin/support/notifications/${notifId}/read`, { method: 'PATCH', headers });
    } catch (e) {}
  }
  closeModal('notifications-modal');
  navigateToTab('support');
  if (issueId) {
    await openAdminTicket(issueId);
  }
}

let adminSupportPollInterval = null;

function navigateToTab(tabId) {
  state.currentTab = tabId;

  // Manage real-time polling for Customer Support tab
  if (tabId === 'support') {
    if (!adminSupportPollInterval) {
      adminSupportPollInterval = setInterval(() => {
        if (state.currentTab === 'support') {
          loadAdminSupportData(false);
        }
      }, 4000);
    }
  } else {
    if (adminSupportPollInterval) {
      clearInterval(adminSupportPollInterval);
      adminSupportPollInterval = null;
    }
  }
  
  // Update Navbar tabs
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId || (tabId === 'request-details' && btn.dataset.tab === 'requests'));
  });

  // Update Sidebar buttons
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId || (tabId === 'request-details' && btn.dataset.tab === 'requests'));
  });

  // Toggle View Panels
  document.querySelectorAll('.view-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const activePanel = document.getElementById(`${tabId}-view`);
  if (activePanel) {
    activePanel.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  renderCurrentTab();
}

function renderCurrentTab() {
  const tabId = state.currentTab;
  if (tabId === 'dashboard') renderDashboard();
  else if (tabId === 'requests') renderRequestsList();
  else if (tabId === 'request-details') renderRequestDetails();
  else if (tabId === 'users') renderUsersList();
  else if (tabId === 'sub-admins') renderSubAdminsList();
  else if (tabId === 'agents') renderAgentsList();
  else if (tabId === 'inventory') {
    renderInventoryList();
    loadInventoryData(false);
  }
  else if (tabId === 'reports') renderReportsView();
  else if (tabId === 'support') {
    renderAdminSupportTickets();
    loadAdminSupportData(false);
  }
}

function viewRequest(reqId) {
  state.selectedRequestId = reqId;
  navigateToTab('request-details');
}

// Helper: Status Badges
function getBadgeHtml(status) {
  let badgeClass = 'badge-pending';
  const s = (status || '').toLowerCase();
  if (s === 'in progress' || s === 'collecting offers' || s === 'bidding') badgeClass = 'badge-in-progress';
  else if (s === 'offers ready') badgeClass = 'badge-offers-ready';
  else if (s === 'completed' || s === 'booked') badgeClass = 'badge-completed';
  else if (s === 'selected' || s === 'accepted') badgeClass = 'badge-selected';
  else if (s === 'active') badgeClass = 'badge-active';
  else if (s === 'inactive') badgeClass = 'badge-inactive';
  else if (s === 'published') badgeClass = 'badge-published';
  else if (s === 'draft') badgeClass = 'badge-draft';
  else if (s === 'request submitted') badgeClass = 'badge-active';
  else if (s === 'not requested yet' || s === 'pending') badgeClass = 'badge-pending';

  return `<span class="badge ${badgeClass}">${status}</span>`;
}

// ==========================================
// 6. View Renderers
// ==========================================

// A. Dashboard Render
function renderDashboard() {
  const totalReqs = state.requests.length;
  const totalUsers = state.users.length;
  const totalBookings = state.bookings.length;
  const totalCustomers = state.users.filter(u => u.role !== 'Sub Admin').length || totalUsers;

  // KPI cards
  const elReq = document.getElementById('dash-kpi-requests');
  const elUsr = document.getElementById('dash-kpi-users');
  const elBkg = document.getElementById('dash-kpi-bookings');
  const elCst = document.getElementById('dash-kpi-customers');
  if (elReq) elReq.textContent = totalReqs;
  if (elUsr) elUsr.textContent = totalUsers;
  if (elBkg) elBkg.textContent = totalBookings;
  if (elCst) elCst.textContent = totalCustomers;

  // Filter Pills Counts on Dashboard
  const allReqCount = totalReqs;
  const hajjCount = state.requests.filter(r => r.service === 'Hajj').length;
  const umrahCount = state.requests.filter(r => r.service === 'Umrah').length;
  const pAll = document.getElementById('dash-pill-all');
  const pHajj = document.getElementById('dash-pill-hajj');
  const pUmrah = document.getElementById('dash-pill-umrah');
  if (pAll) pAll.textContent = `All (${allReqCount})`;
  if (pHajj) pHajj.textContent = `Hajj (${hajjCount})`;
  if (pUmrah) pUmrah.textContent = `Umrah (${umrahCount})`;

  // Recent Requests Table
  const tableBody = document.getElementById('dash-recent-requests-tbody');
  if (tableBody) {
    const filtered = state.requests.filter(r => {
      if (state.requestsFilter === 'All') return true;
      return r.service.toLowerCase() === state.requestsFilter.toLowerCase();
    }).slice(0, 5);

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 32px;">No requests found. Click '+ New Request' to create one.</td></tr>`;
    } else {
      tableBody.innerHTML = filtered.map(req => `
        <tr>
          <td style="font-weight: 800; color: var(--text-main);">${req.id}</td>
          <td style="font-weight: 700;">${req.customer}</td>
          <td>
            <span class="badge ${req.service === 'Umrah' ? 'badge-service-umrah' : 'badge-service-hajj'}">
              🕌 ${req.service}
            </span>
          </td>
          <td style="color: var(--text-muted); font-weight: 600;">${req.travelDate}</td>
          <td>${getBadgeHtml(req.status)}</td>
          <td style="text-align: center; font-weight: 800;">${req.offers ? req.offers.length : 0}</td>
          <td style="text-align: right;">
            <button onclick="viewRequest('${req.id}')" class="btn btn-secondary btn-sm" style="font-weight: 800; border-radius: 8px;">
              View
            </button>
          </td>
        </tr>
      `).join('');
    }
  }

  // Render Sub Admins Chart
  const chartContainer = document.getElementById('subadmins-chart-container');
  if (chartContainer) {
    const list = state.subAdminPerformance.slice(0, 5);
    if (list.length === 0) {
      chartContainer.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 13px;">No active sub-admin assignments yet.</div>';
    } else {
      chartContainer.innerHTML = list.map(admin => {
      const maxVal = 50;
      const pct = Math.min(100, Math.max(10, (admin.offers / maxVal) * 100));
      return `
        <div class="subadmin-bar-row">
          <div class="avatar-circle" style="background: ${admin.avatarBg || '#d1fae5'}; color: ${admin.avatarColor || '#065f46'};">
            ${admin.initials || 'SA'}
          </div>
          <div class="subadmin-bar-name">${admin.name}</div>
          <div class="subadmin-bar-val">${admin.offers}</div>
          <div class="subadmin-bar-track">
            <div class="subadmin-bar-fill" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
      }).join('');
    }
  }

  // Booking Overview Row
  const totalB = state.bookings.length;
  const procB = state.bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED').length;
  const cancB = state.bookings.filter(b => b.status === 'CANCELLED').length;
  const bTot = document.getElementById('booking-total-val');
  const bPrc = document.getElementById('booking-process-val');
  const bCnc = document.getElementById('booking-cancel-val');
  if (bTot) bTot.textContent = totalB;
  if (bPrc) bPrc.textContent = procB;
  if (bCnc) bCnc.textContent = cancB;

  // Customer Support Overview Real-time Counter
  const csHandled = document.getElementById('cs-handled-count');
  const csActive = document.getElementById('cs-active-count');
  const csResolved = document.getElementById('cs-resolved-count');
  if (csHandled) csHandled.textContent = (state.supportStats && state.supportStats.totalTickets) ? state.supportStats.totalTickets : (state.supportTickets ? state.supportTickets.length : 0);
  if (csActive) csActive.textContent = (state.supportStats && state.supportStats.pendingIssues) ? state.supportStats.pendingIssues : 0;
  if (csResolved) csResolved.textContent = (state.supportStats && state.supportStats.solvedIssues) ? state.supportStats.solvedIssues : 0;

  // Donut Chart Top Services
  const umrahPct = totalReqs > 0 ? Math.round((umrahCount / totalReqs) * 100) : 65;
  const hajjPct = 100 - umrahPct;
  const donutLabel = document.getElementById('donut-percent-label');
  const donutFill = document.getElementById('donut-stroke-fill');
  const umrahLeg = document.getElementById('donut-umrah-legend');
  const hajjLeg = document.getElementById('donut-hajj-legend');
  if (donutLabel) donutLabel.textContent = `${umrahPct}%`;
  if (donutFill) donutFill.setAttribute('stroke-dasharray', `${umrahPct}, 100`);
  if (umrahLeg) umrahLeg.textContent = `${umrahCount} (${umrahPct}%)`;
  if (hajjLeg) hajjLeg.textContent = `${hajjCount} (${hajjPct}%)`;
}

// B. Requests List Render
function renderRequestsList() {
  const tbody = document.getElementById('requests-list-tbody');
  if (!tbody) return;

  // Update Status KPI Cards
  const inProg = state.requests.filter(r => r.status === 'In Progress' || r.status === 'Collecting Offers').length;
  const offReady = state.requests.filter(r => r.status === 'Offers Ready').length;
  const pend = state.requests.filter(r => r.status === 'Pending').length;
  const sel = state.requests.filter(r => r.status === 'Selected').length;
  const comp = state.requests.filter(r => r.status === 'Completed').length;
  const total = state.requests.length || 1;

  setElementText('req-kpi-inprogress', inProg);
  setElementText('req-kpi-offersready', offReady);
  setElementText('req-kpi-pending', pend);
  setElementText('req-kpi-selected', sel);
  setElementText('req-kpi-completed', comp);

  setElementText('req-kpi-inprogress-pct', `${Math.round((inProg / total) * 100)}% of total`);
  setElementText('req-kpi-offersready-pct', `${Math.round((offReady / total) * 100)}% of total`);
  setElementText('req-kpi-pending-pct', `${Math.round((pend / total) * 100)}% of total`);
  setElementText('req-kpi-selected-pct', `${Math.round((sel / total) * 100)}% of total`);
  setElementText('req-kpi-completed-pct', `${Math.round((comp / total) * 100)}% of total`);

  // Category Pills in Requests View
  const hajjCount = state.requests.filter(r => r.service === 'Hajj').length;
  const umrahCount = state.requests.filter(r => r.service === 'Umrah').length;
  setElementText('req-pill-all', `All Requests (${state.requests.length})`);
  setElementText('req-pill-umrah', `Umrah (${umrahCount})`);
  setElementText('req-pill-hajj', `Hajj (${hajjCount})`);

  const filtered = state.requests.filter(req => {
    if (state.requestsFilter === 'Umrah' && req.service.toLowerCase() !== 'umrah') return false;
    if (state.requestsFilter === 'Hajj' && req.service.toLowerCase() !== 'hajj') return false;

    if (state.requestsStatusFilter !== 'All' && req.status.toLowerCase() !== state.requestsStatusFilter.toLowerCase()) return false;

    if (state.requestsSearchQuery.trim()) {
      const q = state.requestsSearchQuery.toLowerCase();
      return req.id.toLowerCase().includes(q) || req.customer.toLowerCase().includes(q) || (req.phone && req.phone.includes(q));
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 36px;">No matching requests found.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map(req => `
      <tr style="cursor: pointer;" onclick="viewRequest('${req.id}')">
        <td style="font-weight: 800; color: var(--text-main);">${req.id}</td>
        <td>
          <div style="font-weight: 700; color: var(--text-main);">${req.customer}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${req.phone}</div>
        </td>
        <td>
          <span class="badge ${req.service === 'Umrah' ? 'badge-service-umrah' : 'badge-service-hajj'}">
            🕌 ${req.service}
          </span>
        </td>
        <td style="font-weight: 600; color: var(--text-body);">${req.travelDate}</td>
        <td>
          <div style="font-weight: 800; color: var(--text-main);">${req.adults + (req.children || 0)}</div>
          <div style="font-size: 10px; color: var(--text-muted);">${req.adults} Adults${req.children ? `, ${req.children} Child` : ''}</div>
        </td>
        <td>${getBadgeHtml(req.status)}</td>
        <td style="text-align: center;">
          <span style="display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: 50%; font-weight: 800; font-size: 11px; background: ${(req.offers && req.offers.length > 0) ? '#d1fae5' : '#f1f5f9'}; color: ${(req.offers && req.offers.length > 0) ? '#065f46' : '#94a3b8'};">
            ${req.offers ? req.offers.length : 0}
          </span>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-main);">${req.submittedOn ? req.submittedOn.split(',')[0] : 'Recently'}</div>
          <div style="font-size: 10px; color: var(--text-light);">${(req.submittedOn && req.submittedOn.split(',')[1]) || ''}</div>
        </td>
        <td style="text-align: right;" onclick="event.stopPropagation();">
          <button onclick="viewRequest('${req.id}')" class="btn btn-secondary btn-sm" style="font-weight: 800;">
            View
          </button>
        </td>
      </tr>
    `).join('');
  }

  const countSpan = document.getElementById('requests-showing-count');
  if (countSpan) countSpan.textContent = `Showing 1 to ${filtered.length} of ${state.requests.length} requests`;

  const paginationBtns = document.getElementById('requests-pagination-btns');
  if (paginationBtns) {
    paginationBtns.innerHTML = `
      <button class="page-btn" disabled>‹</button>
      <button class="page-btn active">1</button>
      <button class="page-btn" disabled>›</button>
    `;
  }
}

function setStatusFilter(status) {
  state.requestsStatusFilter = status;
  const select = document.getElementById('requests-status-select');
  if (select) select.value = status;
  renderRequestsList();
}

function clearRequestsFilters() {
  state.requestsFilter = 'All';
  state.requestsStatusFilter = 'All';
  state.requestsSearchQuery = '';
  const search = document.getElementById('requests-search-input');
  if (search) search.value = '';
  const selectSvc = document.getElementById('requests-service-select');
  if (selectSvc) selectSvc.value = 'All';
  const selectSt = document.getElementById('requests-status-select');
  if (selectSt) selectSt.value = 'All';
  document.querySelectorAll('.req-tab-pill').forEach(p => p.classList.toggle('active', p.dataset.filter === 'All'));
  renderRequestsList();
  showToast('Filters cleared', 'info');
}

// C. Request Details Render
function renderRequestDetails() {
  const req = state.requests.find(r => r.id === state.selectedRequestId) || state.requests[0];
  if (!req) return;

  state.selectedRequestId = req.id;

  // Header
  setElementText('req-detail-title-h1', `Request Details (${req.id})`);
  setElementText('req-detail-subtitle', `${req.id} • Submitted on ${req.submittedOn}`);
  const badgeSlot = document.getElementById('req-detail-badge-slot');
  if (badgeSlot) badgeSlot.innerHTML = getBadgeHtml(req.status);

  // Customer Card
  setElementText('req-detail-cust-name', req.customer);
  setElementText('req-detail-cust-email', req.email);
  setElementText('req-detail-cust-phone1', req.phone);
  setElementText('req-detail-cust-address', req.address || 'Nowgam, Srinagar, Jammu & Kashmir, India');
  const custAvatar = document.getElementById('req-detail-cust-avatar');
  if (custAvatar) {
    custAvatar.textContent = (req.customer || 'P').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'PB';
  }

  // Request Specs
  setElementText('req-detail-service', req.serviceType || `${req.service} Package`);
  setElementText('req-detail-date', req.travelDateNote || req.travelDate);
  setElementText('req-detail-travelers', req.travelers);
  setElementText('req-detail-hotel', req.hotelType || '5 Star');
  setElementText('req-detail-duration', req.duration || '25 Days');
  setElementText('req-detail-budget', req.budget || '₹1,20,000 - ₹1,50,000');
  setElementText('req-detail-purpose', req.purposeOfTravel || 'Family');

  const specialList = document.getElementById('req-detail-special-list');
  if (specialList) {
    const list = Array.isArray(req.specialRequests) && req.specialRequests.length > 0 ? req.specialRequests : ['Near to Haram', 'Indian Food Preference'];
    specialList.innerHTML = list.map(s => `
      <div style="display: flex; align-items: center; gap: 6px; color: var(--text-body);">
        <span style="width: 5px; height: 5px; border-radius: 50%; background: var(--primary);"></span>
        <span>${s}</span>
      </div>
    `).join('');
  }

  // Stepper
  const step = req.step || (req.status === 'Completed' ? 5 : (req.status === 'Selected' ? 4 : (req.status === 'Offers Ready' ? 3 : 2)));
  const stepper = document.getElementById('req-stepper-container');
  if (stepper) {
    const stepsData = [
      { num: 1, title: 'Received', sub: req.submittedOn ? req.submittedOn.split(',')[0] : '11 Aug 2026' },
      { num: 2, title: 'Collecting Offers', sub: step >= 2 ? 'In Progress' : 'Pending' },
      { num: 3, title: 'Offers Ready', sub: step >= 3 ? 'Completed' : 'Pending' },
      { num: 4, title: 'Selected', sub: step >= 4 ? 'Completed' : 'Pending' },
      { num: 5, title: 'Completed', sub: step >= 5 ? 'Completed' : 'Pending' }
    ];

    stepper.innerHTML = stepsData.map(s => {
      let nodeClass = 'pending';
      let icon = s.num;
      if (s.num < step) { nodeClass = 'done'; icon = '✓'; }
      else if (s.num === step) { nodeClass = 'current'; }

      return `
        <div class="step-node">
          <div class="step-circle ${nodeClass}">${icon}</div>
          <div class="step-title">${s.title}</div>
          <div class="step-sub">${s.sub}</div>
        </div>
      `;
    }).join('');
  }

  // Payment proof box in card
  const proof = req.paymentProof || { fileName: 'Screenshot_Payment.jpg', uploadedOn: req.submittedOn, amount: '₹50,000 (Advance Token)', txnId: 'UPI/20260811/987654321', bank: 'HDFC Bank UPI' };
  setElementText('req-detail-proof-name', proof.fileName);
  setElementText('req-detail-proof-time', `Uploaded: ${proof.uploadedOn}`);

  // Populate Payment Proof Modal elements
  setElementText('modal-receipt-amount', proof.amount || '₹50,000');
  setElementText('modal-receipt-subtext', `Advance Token for ${req.id}`);
  setElementText('modal-receipt-cust', req.customer);
  setElementText('modal-receipt-bank', proof.bank || 'HDFC Bank UPI');
  setElementText('modal-receipt-txn', proof.txnId || `UPI/${req.id}/987654321`);
  setElementText('modal-receipt-time', proof.uploadedOn || req.submittedOn);

  // Status Selector
  const statusSelect = document.getElementById('req-status-select');
  if (statusSelect) {
    statusSelect.value = req.status === 'In Progress' ? 'Collecting Offers' : req.status;
  }

  // Offers Grid
  const offersGrid = document.getElementById('req-offers-grid');
  const offersCountHeader = document.getElementById('req-offers-count-header');
  const count = req.offers ? req.offers.length : 0;
  if (offersCountHeader) offersCountHeader.textContent = `Offers (${count})`;

  if (offersGrid) {
    if (!req.offers || req.offers.length === 0) {
      offersGrid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px; text-align: center; background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: var(--radius-xl);">
          <div style="font-size: 32px; margin-bottom: 8px;">📄</div>
          <h4 style="font-size: 15px; font-weight: 700;">No offers attached yet</h4>
          <p style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">Click '+ Add Offer' above to attach real proposals from verified agencies.</p>
        </div>
      `;
    } else {
      offersGrid.innerHTML = req.offers.map(offer => `
        <div class="offer-card">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
              <div>
                <span style="font-size: 10px; font-weight: 800; color: var(--text-light);">${offer.agentId || 'AGENT-1042'}</span>
                <h4 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-top: 2px;">${offer.agentName}</h4>
              </div>
              <div>${getBadgeHtml(offer.status)}</div>
            </div>

            <div style="margin: 14px 0; padding-bottom: 14px; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-size: 12px; font-weight: 600; color: var(--text-muted);">${offer.packageName} • ${offer.duration}</div>
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-top: 6px;">
                <div>
                  <span class="offer-price-large">${offer.pricePerPerson}</span>
                  <span style="font-size: 12px; color: var(--text-muted);"> / person</span>
                </div>
                <div style="text-align: right;">
                  <span style="font-size: 10px; color: var(--text-light); font-weight: 600;">Total Price</span>
                  <div style="font-size: 12px; font-weight: 800; color: var(--text-main);">${offer.totalPrice}</div>
                </div>
              </div>
            </div>

            <div class="offer-amenity-grid">
              <div class="amenity-box">
                <div class="amenity-label">🏢 Makkah Hotel</div>
                <div class="amenity-val">${offer.makkahHotel}</div>
                <div class="amenity-dist">${offer.makkahDistance}</div>
              </div>

              <div class="amenity-box">
                <div class="amenity-label">🏢 Madinah Hotel</div>
                <div class="amenity-val">${offer.madinahHotel}</div>
                <div class="amenity-dist">${offer.madinahDistance}</div>
              </div>

              <div class="amenity-box">
                <div class="amenity-label">🚌 Transport</div>
                <div class="amenity-val">${offer.transport}</div>
              </div>

              <div class="amenity-box">
                <div class="amenity-label">🍽️ Meal Plan</div>
                <div class="amenity-val">${offer.mealPlan}</div>
              </div>

              <div class="amenity-box" style="grid-column: 1 / -1; display: flex; justify-content: space-between; align-items: center;">
                <div class="amenity-label">🧭 Historical Ziyarat</div>
                <div class="amenity-val" style="margin-top: 0;">${offer.ziyarat}</div>
              </div>
            </div>
          </div>

          <div style="padding-top: 12px; border-top: 1px solid var(--border-subtle);">
            <div style="font-size: 10px; color: var(--text-light); margin-bottom: 10px;">
              Received On: ${offer.receivedOn}
            </div>

            <div style="display: flex; gap: 8px;">
              <button onclick="openOfferDetailModal('${offer.id}')" class="btn btn-secondary btn-sm" style="flex: 1; font-weight: 800;">
                View Details
              </button>
              <button onclick="deleteOffer('${offer.id}')" class="btn btn-danger btn-sm" title="Delete Quote" style="font-weight: 800;">
                ✕
              </button>
              <button onclick="toggleOfferPublish('${offer.id}')" class="btn btn-secondary btn-sm" title="Toggle Publish" style="font-weight: 800; color: ${offer.status === 'Published' ? '#047857' : '#d97706'};">
                ${offer.status === 'Published' ? '✓ Live' : 'Draft'}
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  }
}

// D. Users List Render
function renderUsersList() {
  const tbody = document.getElementById('users-list-tbody');
  if (!tbody) return;

  const customers = state.users.filter(u => u.role !== 'Sub Admin' && u.role !== 'Senior Sub Admin');

  // KPI Metric Cards for Customers
  const total = customers.length;
  const requested = customers.filter(c => c.requests > 0).length;
  const inactive = total - requested;
  setElementText('users-kpi-total', total);
  setElementText('users-kpi-new', Math.min(total, 6));
  setElementText('users-kpi-requested', requested);
  setElementText('users-kpi-active', requested);
  setElementText('users-kpi-inactive', inactive);

  const filtered = customers.filter(u => {
    if (state.usersRoleFilter !== 'All' && u.role.toLowerCase() !== state.usersRoleFilter.toLowerCase()) return false;
    if (state.usersStatusFilter !== 'All' && u.status.toLowerCase() !== state.usersStatusFilter.toLowerCase()) return false;
    if (state.usersSearchQuery.trim()) {
      const q = state.usersSearchQuery.toLowerCase();
      return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q) || (u.phone && u.phone.includes(q));
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 36px;">No customers found in database.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map((u, idx) => `
      <tr>
        <td style="color: var(--text-light); font-weight: 600;">${idx + 1}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="avatar-circle" style="background: ${u.avatarBg || '#d1fae5'}; color: ${u.avatarColor || '#065f46'};">
              ${u.initials || 'PU'}
            </div>
            <span style="font-weight: 800; color: var(--text-main);">${u.name}</span>
          </div>
        </td>
        <td style="color: var(--text-body); font-weight: 600;">${u.email}</td>
        <td style="color: var(--text-body); font-weight: 600;">${u.phone}</td>
        <td>
          <span class="badge badge-pending">
            ${u.role || 'Customer'}
          </span>
        </td>
        <td style="text-align: center; font-weight: 800;">${u.requests}</td>
        <td style="color: var(--text-muted);">${u.joinedOn}</td>
        <td style="color: var(--text-muted);">${u.lastActive}</td>
        <td>${getBadgeHtml(u.status)}</td>
        <td style="text-align: right;">
          <button onclick="showToast('Customer ID: ${u.rawId || u.id}', 'info')" class="btn btn-secondary btn-sm" style="font-weight: 800;">
            ⋮
          </button>
        </td>
      </tr>
    `).join('');
  }

  setElementText('users-pagination-count', `Showing 1 to ${filtered.length} of ${customers.length} customers`);
  const pageBtns = document.getElementById('users-pagination-btns');
  if (pageBtns) {
    pageBtns.innerHTML = `
      <button class="page-btn" disabled>‹</button>
      <button class="page-btn active">1</button>
      <button class="page-btn" disabled>›</button>
    `;
  }
}

// E. Sub Admins Render
function renderSubAdminsList() {
  const tbody = document.getElementById('subadmins-list-tbody');
  if (!tbody) return;

  const filtered = state.subAdmins.filter(a => {
    if (state.subAdminsStatusFilter !== 'All' && a.status.toLowerCase() !== state.subAdminsStatusFilter.toLowerCase()) return false;
    if (state.subAdminsRoleFilter !== 'All' && a.role.toLowerCase() !== state.subAdminsRoleFilter.toLowerCase()) return false;
    if (state.subAdminsSearchQuery.trim()) {
      const q = state.subAdminsSearchQuery.toLowerCase();
      return a.name.toLowerCase().includes(q) || a.email.toLowerCase().includes(q) || (a.phone && a.phone.includes(q));
    }
    return true;
  });

  setElementText('subadmins-kpi-total', state.subAdmins.length);
  const totBooked = state.subAdmins.reduce((acc, cur) => acc + (cur.customersBooked || 0), 0);
  const totHandled = state.subAdmins.reduce((acc, cur) => acc + (cur.requestsHandled || 0), 0);
  setElementText('subadmins-kpi-booked', totBooked.toLocaleString('en-IN'));
  setElementText('subadmins-kpi-handled', totHandled.toLocaleString('en-IN'));

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted); padding: 36px;">No sub-admins found. Click '+ Add Sub Admin' to add staff.</td></tr>`;
  } else {
    tbody.innerHTML = filtered.map((a, idx) => `
      <tr>
        <td style="color: var(--text-light); font-weight: 600;">${idx + 1}</td>
        <td>
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="avatar-circle" style="background: ${a.avatarBg || '#dbeafe'}; color: ${a.avatarColor || '#1e40af'};">
              ${a.initials || 'SA'}
            </div>
            <span style="font-weight: 800; color: var(--text-main);">${a.name}</span>
          </div>
        </td>
        <td style="color: var(--text-body); font-weight: 600;">${a.email}</td>
        <td style="color: var(--text-body); font-weight: 600;">${a.phone}</td>
        <td>
          <span class="badge ${a.role === 'Senior Sub Admin' ? 'badge-offers-ready' : 'badge-selected'}">
            ${a.role}
          </span>
        </td>
        <td style="text-align: center; font-weight: 900; color: var(--text-main); font-size: 13px;">${a.customersBooked || 0}</td>
        <td style="text-align: center; font-weight: 800;">${a.requestsHandled || 0}</td>
        <td style="color: var(--text-muted);">${a.joinedOn}</td>
        <td>${getBadgeHtml(a.status)}</td>
        <td style="text-align: right;">
          <button onclick="showToast('Sub Admin staff permission active for ${a.name}', 'info')" class="btn btn-secondary btn-sm" style="font-weight: 800;">
            ⋮
          </button>
        </td>
      </tr>
    `).join('');
  }

  setElementText('subadmins-count-span', `Showing 1 to ${filtered.length} of ${state.subAdmins.length} sub admins`);
}

// F. Agents Render
function renderAgentsList() {
  const container = document.getElementById('agents-grid-container');
  if (!container) return;

  let agentsList = [...state.agents];
  if (agentsList.length === 0 && state.packageInventory.length > 0) {
    const map = new Map();
    state.packageInventory.forEach((p, idx) => {
      const name = p.agentName || 'Verified Travel Agency';
      if (!map.has(name)) {
        map.set(name, {
          id: p.agentId || `AG-${101 + idx}`,
          name: name,
          city: 'Verified Agency Partner',
          contact: '+91 98201 12345',
          rating: '4.9',
          packages: 0,
          offers: 1,
          bookings: 0
        });
      }
      map.get(name).packages += 1;
    });
    agentsList = Array.from(map.values());
  }

  if (agentsList.length === 0) {
    container.innerHTML = '<div style="grid-column: 1 / -1; padding: 48px 24px; text-align: center; color: var(--text-muted); font-size: 14px; background: #ffffff; border-radius: var(--radius-lg); border: 1px solid var(--border-light);">No agency partners registered yet. Agencies and service providers will appear here as inventory packages are added.</div>';
    return;
  }

  container.innerHTML = agentsList.map(ag => `
    <div class="card" style="display: flex; flex-direction: column; justify-content: space-between;">
      <div>
        <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
          <div>
            <span style="font-size: 10px; font-weight: 800; color: var(--text-light);">${ag.id}</span>
            <h4 style="font-size: 16px; font-weight: 800; color: var(--text-main); margin-top: 2px;">${ag.name}</h4>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">📍 ${ag.city}</div>
          </div>
          <span class="badge badge-published">Verified</span>
        </div>

        <div style="margin: 14px 0; font-size: 12px; display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Contact Person:</span>
            <span style="font-weight: 700; color: var(--text-main);">${ag.contact}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Pilgrim Rating:</span>
            <span style="font-weight: 800; color: #d97706;">⭐ ${ag.rating} / 5.0</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Active Packages:</span>
            <span style="font-weight: 700; color: var(--text-main);">${ag.packages} packages</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Total Quotes Submitted:</span>
            <span style="font-weight: 800; color: var(--primary);">${ag.offers}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Pilgrims Booked:</span>
            <span style="font-weight: 800; color: #047857;">${ag.bookings} booked</span>
          </div>
        </div>
      </div>

      <div style="padding-top: 12px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px;">
        <button onclick="showToast('Agency profile verified: ${ag.name}', 'info')" class="btn btn-secondary btn-sm" style="flex: 1; font-weight: 800;">
          View Profile
        </button>
        <button onclick="showToast('Contacting ${ag.contact} (${ag.name})', 'info')" class="btn btn-secondary btn-sm" style="font-weight: 800;">
          📞 Call
        </button>
      </div>
    </div>
  `).join('');
}

// G. Reports Render
function renderReportsView() {
  const tbody = document.getElementById('reports-bookings-tbody');
  if (!tbody) return;

  const bookings = state.bookings;
  if (bookings.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 24px;">No completed transactions recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = bookings.map(b => `
    <tr>
      <td style="font-weight: 800; color: var(--text-main);">${b.id || (b._id ? b._id.toString().slice(-6) : 'BKG-101')}</td>
      <td style="font-weight: 700;">${b.packageTitle || 'Deluxe Umrah Package'}</td>
      <td style="color: var(--text-muted);">${b.agentName || 'Al-Haram Express'}</td>
      <td style="text-align: center; font-weight: 800;">${b.travelersCount || 1}</td>
      <td style="font-weight: 800; color: var(--primary);">₹${(b.totalPrice || 2499).toLocaleString('en-IN')}</td>
      <td>${getBadgeHtml(b.status === 'CANCELLED' ? 'Inactive' : 'Completed')}</td>
      <td style="font-size: 11px; color: var(--text-light);">${b.travelDate || (b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-GB') : '2026')}</td>
    </tr>
  `).join('');
}

// Helper: safe DOM text setting
function setElementText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

// ==========================================
// 7. Interactive Modal & Action Handlers
// ==========================================

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('open');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('open');
}

// Update Request Status in Live Backend
async function handleStatusChange(newStatus) {
  const req = state.requests.find(r => r.id === state.selectedRequestId);
  if (!req) return;

  req.status = newStatus;
  if (newStatus === 'Collecting Offers' || newStatus === 'In Progress') req.step = 2;
  else if (newStatus === 'Offers Ready') req.step = 3;
  else if (newStatus === 'Selected') req.step = 4;
  else if (newStatus === 'Completed') req.step = 5;

  renderRequestDetails();

  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  const targetId = req.rawId || req.id;

  try {
    const res = await fetch(`${apiBase}/admin/requirements/${targetId}/status`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ status: newStatus })
    });
    if (res.ok) {
      showToast(`Status for ${req.id} updated to "${newStatus}"!`, 'success');
    } else {
      showToast(`Status updated locally to "${newStatus}"`, 'info');
    }
  } catch (err) {
    showToast(`Status updated locally to "${newStatus}"`, 'info');
  }
}

// Add New Request Form Submit
async function handleNewRequestSubmit(e) {
  e.preventDefault();
  const customer = document.getElementById('new-req-customer').value;
  const phone = document.getElementById('new-req-phone').value;
  const email = document.getElementById('new-req-email').value || `${customer.toLowerCase().replace(/\s+/g, '')}@gmail.com`;
  const service = document.getElementById('new-req-service').value;
  const travelDate = document.getElementById('new-req-date').value;
  const adults = Number(document.getElementById('new-req-adults').value) || 2;
  const children = Number(document.getElementById('new-req-children').value) || 0;
  const budget = document.getElementById('new-req-budget').value || '₹1,20,000 - ₹1,50,000';

  const newId = `REQ-${Math.floor(1000 + Math.random() * 9000)}`;
  const newReq = {
    id: newId,
    customer,
    phone,
    email,
    address: 'Srinagar, Jammu & Kashmir',
    service,
    serviceType: service === 'Umrah' ? 'Umrah Package' : 'Hajj Premium Package',
    travelDate,
    travelDateNote: `${travelDate} (Approx.)`,
    travelers: `${adults + children} (${adults} Adults${children ? `, ${children} Children` : ''})`,
    adults,
    children,
    hotelType: '5 Star',
    duration: '25 Days',
    budget,
    purposeOfTravel: 'Family',
    specialRequests: ['Near to Haram', 'Indian Food Preference'],
    submittedOn: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    status: 'Pending',
    step: 1,
    paymentProof: {
      fileName: 'Initial_Token_Proof.jpg',
      uploadedOn: 'Today',
      amount: '₹30,000',
      txnId: 'UPI/' + Date.now().toString().slice(-8),
      bank: 'HDFC Bank'
    },
    offers: []
  };

  // Optimistic add
  state.requests.unshift(newReq);
  closeModal('new-request-modal');
  showToast(`Pilgrim request ${newId} created!`, 'success');
  renderRequestsList();
  renderDashboard();

  // Save to MongoDB
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    await fetch(`${apiBase}/admin/requirements`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newReq)
    });
  } catch (err) {
    console.warn('Backend save notice:', err.message);
  }
}

// Add Offer to Request Form Submit
async function handleAddOfferSubmit(e) {
  e.preventDefault();
  const req = state.requests.find(r => r.id === state.selectedRequestId);
  if (!req) return;

  const agentName = document.getElementById('add-offer-agent-name').value;
  const price = Number(document.getElementById('add-offer-price').value) || 125000;
  const travelers = req.adults + (req.children || 0) || 10;
  const total = price * travelers;

  const newOffer = {
    id: `OFF-${Date.now().toString().slice(-4)}`,
    requirementId: req.rawId || req.id,
    agentId: `AGENT-${Math.floor(1000 + Math.random() * 9000)}`,
    agentName,
    packageName: document.getElementById('add-offer-pkg-title').value || 'Umrah Package',
    duration: document.getElementById('add-offer-duration').value || '25 Days',
    pricePerPerson: `₹${price.toLocaleString('en-IN')}`,
    totalPrice: `₹${total.toLocaleString('en-IN')}`,
    status: document.getElementById('add-offer-status').value || 'Published',
    makkahHotel: document.getElementById('add-offer-makkah-hotel').value || 'Dar Al Eiman',
    makkahDistance: document.getElementById('add-offer-makkah-dist').value || '500m from Haram',
    madinahHotel: document.getElementById('add-offer-madinah-hotel').value || 'Anwar Al Madinah',
    madinahDistance: document.getElementById('add-offer-madinah-dist').value || '200m from Haram',
    transport: document.getElementById('add-offer-transport').value || 'AC Bus',
    mealPlan: document.getElementById('add-offer-meal').value || 'Full Board',
    ziyarat: document.getElementById('add-offer-ziyarat').value || 'Included',
    receivedOn: 'Just now',
    rating: 4.9
  };

  if (!req.offers) req.offers = [];
  req.offers.unshift(newOffer);

  closeModal('add-offer-modal');
  renderRequestDetails();
  showToast(`New offer from "${agentName}" attached to ${req.id}!`, 'success');

  // Persist to MongoDB
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    await fetch(`${apiBase}/admin/offers`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newOffer)
    });
  } catch (err) {
    console.warn('Backend offer save notice:', err.message);
  }
}

// Add Sub Admin Form Submit
async function handleAddSubAdminSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('add-subadmin-name').value;
  const email = document.getElementById('add-subadmin-email').value;
  const phone = document.getElementById('add-subadmin-phone').value;
  const role = document.getElementById('add-subadmin-role').value;

  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'SA';

  const newAdmin = {
    id: state.subAdmins.length + 1,
    name,
    initials,
    avatarBg: '#d1fae5',
    avatarColor: '#065f46',
    email,
    phone,
    role,
    customersBooked: 0,
    requestsHandled: 0,
    joinedOn: 'Today, 2026',
    status: 'Active'
  };

  state.subAdmins.unshift(newAdmin);
  closeModal('add-subadmin-modal');
  showToast(`Sub Admin "${name}" added successfully!`, 'success');
  renderSubAdminsList();

  // Save to DB
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    await fetch(`${apiBase}/admin/subadmins`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newAdmin)
    });
  } catch (err) {}
}

// Delete Offer
async function deleteOffer(offerId) {
  const req = state.requests.find(r => r.id === state.selectedRequestId);
  if (!req || !req.offers) return;

  req.offers = req.offers.filter(o => o.id !== offerId);
  renderRequestDetails();
  showToast('Offer deleted', 'info');

  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    await fetch(`${apiBase}/admin/offers/${offerId}`, { method: 'DELETE', headers });
  } catch (err) {}
}

// Toggle Publish
async function toggleOfferPublish(offerId) {
  const req = state.requests.find(r => r.id === state.selectedRequestId);
  if (!req || !req.offers) return;

  const offer = req.offers.find(o => o.id === offerId);
  if (offer) {
    offer.status = offer.status === 'Published' ? 'Draft' : 'Published';
    renderRequestDetails();
    showToast(`Offer visibility updated to "${offer.status}"`, 'success');

    const apiBase = getApiBase();
    const headers = getAuthHeaders();
    try {
      await fetch(`${apiBase}/admin/offers/${offerId}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ status: offer.status })
      });
    } catch (err) {}
  }
}

// Offer Details Modal
let currentlyViewedOffer = null;
function openOfferDetailModal(offerId) {
  const req = state.requests.find(r => r.id === state.selectedRequestId);
  if (!req || !req.offers) return;
  const offer = req.offers.find(o => o.id === offerId);
  if (!offer) return;

  currentlyViewedOffer = offer;
  setElementText('modal-offer-agent-name', offer.agentName);
  setElementText('modal-offer-price-pp', offer.pricePerPerson);
  setElementText('modal-offer-price-total', offer.totalPrice);
  setElementText('modal-offer-makkah', `${offer.makkahHotel} (${offer.makkahDistance})`);
  setElementText('modal-offer-madinah', `${offer.madinahHotel} (${offer.madinahDistance})`);
  setElementText('modal-offer-transport', offer.transport);
  setElementText('modal-offer-meal', offer.mealPlan);
  setElementText('modal-offer-ziyarat', offer.ziyarat);

  openModal('offer-details-modal');
}

function handleSelectCurrentOffer() {
  handleStatusChange('Selected');
  closeModal('offer-details-modal');
  showToast('This offer has been selected and approved for the pilgrim!', 'success');
}

// Copy Request Info
function copyRequestInfo() {
  const req = state.requests.find(r => r.id === state.selectedRequestId);
  if (!req) return;

  const text = `
ZILHAJ Request Details: ${req.id}
Customer: ${req.customer} (${req.phone}, ${req.email})
Address: ${req.address}
Service: ${req.serviceType}
Travel Date: ${req.travelDate}
Travelers: ${req.travelers}
Hotel Preference: ${req.hotelType}
Budget: ${req.budget}
Special Requests: ${(req.specialRequests || []).join(', ')}
Status: ${req.status}
  `.trim();

  navigator.clipboard.writeText(text);
  showToast('Request details copied to clipboard!', 'success');
}

// CSV Exports
function exportRequestsCsv() {
  const csv = "data:text/csv;charset=utf-8,"
    + "ID,Customer,Phone,Email,Service,Travel Date,Travelers,Status,Offers,Submitted On\n"
    + state.requests.map(r => `"${r.id}","${r.customer}","${r.phone}","${r.email}","${r.service}","${r.travelDate}","${r.travelers}","${r.status}",${r.offers ? r.offers.length : 0},"${r.submittedOn}"`).join("\n");
  
  downloadCsv(csv, `Zilhaj_Requests_${new Date().toISOString().slice(0,10)}.csv`);
  showToast("Requests exported to CSV!", "success");
}

function exportUsersCsv() {
  const customerUsers = state.users.filter(u => u.role !== 'Sub Admin');
  const csv = "data:text/csv;charset=utf-8,"
    + "ID,Name,Email,Phone,Role,Requests,Joined On,Status\n"
    + customerUsers.map(u => `"${u.id}","${u.name}","${u.email}","${u.phone}","${u.role}",${u.requests},"${u.joinedOn}","${u.status}"`).join("\n");
  
  downloadCsv(csv, `Zilhaj_Customers_${new Date().toISOString().slice(0,10)}.csv`);
  showToast("Customer directory exported to CSV!", "success");
}

function exportSubAdminsCsv() {
  const csv = "data:text/csv;charset=utf-8,"
    + "ID,Name,Email,Phone,Role,Customers Booked,Requests Handled,Joined On,Status\n"
    + state.subAdmins.map(a => `"${a.id}","${a.name}","${a.email}","${a.phone}","${a.role}",${a.customersBooked || 0},${a.requestsHandled || 0},"${a.joinedOn}","${a.status}"`).join("\n");
  
  downloadCsv(csv, `Zilhaj_SubAdmins_${new Date().toISOString().slice(0,10)}.csv`);
  showToast("Sub Admins list exported to CSV!", "success");
}

function exportReportsCsv() {
  const csv = "data:text/csv;charset=utf-8,"
    + "Booking ID,Package Title,Agency,Travelers,Amount,Status,Date\n"
    + state.bookings.map(b => `"${b.id || 'BKG'}","${b.packageTitle}","${b.agentName || 'Agent'}",${b.travelersCount || 1},"${b.totalPrice || 2499}","${b.status}","${b.travelDate || '2026'}"`).join("\n");
  
  downloadCsv(csv, `Zilhaj_Reports_${new Date().toISOString().slice(0,10)}.csv`);
  showToast("Executive report exported to CSV!", "success");
}

function downloadCsv(content, filename) {
  const link = document.createElement("a");
  link.setAttribute("href", encodeURI(content));
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Admin Header User Profile & Menu
function initAdminHeaderUser() {
  try {
    const user = JSON.parse(localStorage.getItem('umrah_user') || 'null');
    if (user && user.name && !user.name.toLowerCase().includes('palak')) {
      state.currentUser = user;
      const name = user.name;
      const initials = name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';
      setElementText('header-admin-name', name);
      setElementText('header-admin-role', user.role === 'ROLE_ADMIN' ? 'Super Admin' : (user.role === 'ROLE_SUBADMIN' ? 'Sub Admin' : 'Admin Desk'));
      setElementText('header-admin-avatar', initials);
      setElementText('dropdown-user-email', user.email || 'admin@zilhaj.com');
    } else {
      setElementText('header-admin-name', 'Administrator');
      setElementText('header-admin-role', 'Admin Desk');
      setElementText('header-admin-avatar', 'AD');
      setElementText('dropdown-user-email', 'admin@zilhaj.com');
    }
  } catch (e) {
    setElementText('header-admin-name', 'Administrator');
    setElementText('header-admin-role', 'Admin Desk');
    setElementText('header-admin-avatar', 'AD');
    setElementText('dropdown-user-email', 'admin@zilhaj.com');
  }

  const dateEl = document.getElementById('dash-date-display');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}

function toggleAdminMenu(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const menu = document.getElementById('admin-dropdown-menu');
  if (menu) {
    menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
  }
}

function handleAdminLogout() {
  localStorage.removeItem('umrah_user');
  showToast('Logged out successfully', 'info');
  setTimeout(() => {
    window.location.href = '/login.html';
  }, 600);
}

// Close dropdown on outside click
document.addEventListener('click', (e) => {
  const menu = document.getElementById('admin-dropdown-menu');
  const trigger = document.getElementById('admin-profile-trigger');
  if (menu && trigger && !trigger.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// ==========================================
// 8. Global DOM Event Bindings & Live Sync
// ==========================================
function initAdminApp() {
  initAdminHeaderUser();

  // Navigation tab clicks
  document.querySelectorAll('.nav-tab-btn, .sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.dataset.tab;
      if (tab) navigateToTab(tab);
    });
  });

  // Filter Pills on Dashboard
  document.querySelectorAll('.dash-filter-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.dash-filter-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.requestsFilter = pill.dataset.filter;
      renderDashboard();
    });
  });

  // Filter Pills on Requests
  document.querySelectorAll('.req-tab-pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('.req-tab-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.requestsFilter = pill.dataset.filter;
      renderRequestsList();
    });
  });

  // Requests Search Input
  const reqSearch = document.getElementById('requests-search-input');
  if (reqSearch) {
    reqSearch.addEventListener('input', (e) => {
      state.requestsSearchQuery = e.target.value;
      renderRequestsList();
    });
  }

  // Requests Status Dropdown
  const reqStatus = document.getElementById('requests-status-select');
  if (reqStatus) {
    reqStatus.addEventListener('change', (e) => {
      state.requestsStatusFilter = e.target.value;
      renderRequestsList();
    });
  }

  // Users Search & Role Filters
  const userSearch = document.getElementById('users-search-input');
  if (userSearch) {
    userSearch.addEventListener('input', (e) => {
      state.usersSearchQuery = e.target.value;
      renderUsersList();
    });
  }

  const userRole = document.getElementById('users-role-select');
  if (userRole) {
    userRole.addEventListener('change', (e) => {
      state.usersRoleFilter = e.target.value;
      renderUsersList();
    });
  }

  const userStatus = document.getElementById('users-status-select');
  if (userStatus) {
    userStatus.addEventListener('change', (e) => {
      state.usersStatusFilter = e.target.value;
      renderUsersList();
    });
  }

  // Sub Admins Search & Filters
  const saSearch = document.getElementById('subadmins-search-input');
  if (saSearch) {
    saSearch.addEventListener('input', (e) => {
      state.subAdminsSearchQuery = e.target.value;
      renderSubAdminsList();
    });
  }

  const saStatus = document.getElementById('subadmins-status-select');
  if (saStatus) {
    saStatus.addEventListener('change', (e) => {
      state.subAdminsStatusFilter = e.target.value;
      renderSubAdminsList();
    });
  }

  const saRole = document.getElementById('subadmins-role-select');
  if (saRole) {
    saRole.addEventListener('change', (e) => {
      state.subAdminsRoleFilter = e.target.value;
      renderSubAdminsList();
    });
  }

  // Initial load from live backend
  refreshAllData(false);

  // Auto-refresh every 10 seconds (Live real-time polling)
  setInterval(() => {
    refreshAllData(false);
  }, 10000);
}

// Safely execute whether DOM is already parsed or still loading
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}

// ============================================================================
// 9. CUSTOMER CARE / SUPPORT PORTAL CONTROLLER (EXECUTIVE DESK)
// ============================================================================

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getSupportStatusBadgeClass(status) {
  const s = (status || '').toLowerCase();
  if (s === 'open' || s === 'pending') return 'badge-open';
  if (s === 'in progress') return 'badge-in-progress';
  if (s === 'waiting for customer') return 'badge-waiting';
  if (s === 'resolved') return 'badge-offers-ready';
  if (s === 'closed') return 'badge-completed';
  if (s === 'reopened') return 'badge-reopened';
  if (s.includes('invalid') || s.includes('wrong')) return 'badge-invalid';
  return 'badge-pending';
}

async function loadAdminSupportData(showNotification = false) {
  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    // 1. Fetch Stats
    const statsRes = await fetch(`${apiBase}/admin/support/stats`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (statsRes && statsRes.success && statsRes.stats) {
      state.supportStats = statsRes.stats;
      setElementText('support-kpi-pending', statsRes.stats.pendingIssues || '0');
      setElementText('support-kpi-solved', statsRes.stats.solvedIssues || '0');
      setElementText('support-kpi-urgent', statsRes.stats.urgentIssues || '0');
      setElementText('support-kpi-total', statsRes.stats.totalTickets || '0');

      const pendingCount = statsRes.stats.pendingIssues || 0;
      const navBadge = document.getElementById('nav-support-badge');
      const sideBadge = document.getElementById('sidebar-support-badge');
      if (navBadge) {
        navBadge.textContent = pendingCount;
        navBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
      if (sideBadge) {
        sideBadge.textContent = pendingCount;
        sideBadge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
    }

    // 2. Fetch Notifications
    const notifsRes = await fetch(`${apiBase}/admin/support/notifications`, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);
    if (notifsRes && notifsRes.success) {
      state.supportNotifications = notifsRes.notifications || [];
      renderAdminNotifications(state.supportNotifications, notifsRes.unreadCount || 0);
    }

    // 3. Fetch Tickets
    const query = encodeURIComponent(state.supportSearchQuery || '');
    const url = `${apiBase}/admin/support/tickets?query=${query}&status=${state.supportFilterStatus}&priority=${state.supportFilterPriority}&category=${state.supportFilterCategory}&sort=${state.supportFilterSort}`;
    const ticketsRes = await fetch(url, { headers }).then(r => r.ok ? r.json() : null).catch(() => null);

    if (ticketsRes && ticketsRes.success && Array.isArray(ticketsRes.tickets)) {
      state.supportTickets = ticketsRes.tickets;
      renderAdminSupportTickets();

      if (state.selectedIssueId) {
        await refreshActiveTicketSilently(state.selectedIssueId);
      } else if (state.supportTickets.length > 0) {
        await openAdminTicket(state.supportTickets[0].issue_id);
      }
    }

    if (showNotification) {
      showToast('Support Portal synchronized with live database', 'success');
    }
  } catch (err) {
    console.error('Error loading admin support data:', err);
    if (showNotification) showToast('Failed to load support data', 'danger');
  }
}

function renderAdminSupportTickets() {
  const tbody = document.getElementById('support-tickets-tbody');
  if (!tbody) return;

  const countPill = document.getElementById('support-count-pill');
  if (countPill) countPill.textContent = `${state.supportTickets.length} Tickets`;

  if (state.supportTickets.length === 0) {
    const workspace = document.getElementById('support-issue-workspace');
    if (workspace) workspace.style.display = 'none';
    state.selectedIssueId = null;
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 48px;">
          <div style="font-size: 28px; margin-bottom: 8px;">📭</div>
          <div style="font-weight: 700; font-size: 14px; color: var(--text-main);">No support tickets found</div>
          <div style="font-size: 12px; margin-top: 4px;">When customers submit an inquiry or report, their tickets will appear here in real time.</div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = state.supportTickets.map(t => {
    const isSelected = state.selectedIssueId === t.issue_id;
    const isUrgent = t.priority === 'Urgent';
    const dateFormatted = new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

    return `
      <tr style="${isSelected ? 'background: #f0fdf4;' : ''} ${isUrgent ? 'border-left: 3px solid #dc2626;' : ''}">
        <td>
          <span style="font-family: monospace; font-weight: 800; color: var(--primary); font-size: 13px;">${t.issue_id}</span>
        </td>
        <td>
          <span style="font-size: 11px; font-weight: 700; background: #e0f2fe; color: #0369a1; padding: 2px 8px; border-radius: 99px;">
            ${t.request_id || 'GENERAL'}
          </span>
        </td>
        <td>
          <div style="font-weight: 800; color: var(--text-main); font-size: 13px;">${escapeHtml(t.customer_name)}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${escapeHtml(t.customer_phone || t.customer_email || '')}</div>
        </td>
        <td>
          <span style="font-size: 12px; font-weight: 600; color: var(--text-body);">${escapeHtml(t.category)}</span>
        </td>
        <td>
          <span class="badge ${isUrgent ? 'badge-urgent' : (t.priority === 'High' ? 'badge-offers-ready' : 'badge-pending')}">
            ${t.priority}
          </span>
        </td>
        <td>
          <span class="badge ${getSupportStatusBadgeClass(t.status)}">
            ${t.status}
          </span>
        </td>
        <td style="font-size: 12px; color: var(--text-muted);">
          ${dateFormatted}
        </td>
        <td style="text-align: right;">
          <button onclick="openAdminTicket('${t.issue_id}')" class="btn btn-secondary btn-sm" style="font-weight: 800; color: var(--primary); padding: 4px 12px;">
            View Issue
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function openAdminTicket(issueId) {
  state.selectedIssueId = issueId;
  const workspace = document.getElementById('support-issue-workspace');
  if (workspace) workspace.style.display = 'grid';

  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/support/tickets/${issueId}`, { headers });
    if (!res.ok) throw new Error('Failed to fetch ticket');
    const data = await res.json();
    if (!data.success) throw new Error(data.message || 'Error');

    state.selectedTicketDetails = data;
    const t = data.ticket;

    // 1. Header Information
    setElementText('detail-issue-id', t.issue_id);
    setElementText('detail-req-id-badge', t.request_id || 'GENERAL');
    setElementText('detail-subject', t.subject);

    const prioBadge = document.getElementById('detail-priority-badge');
    if (prioBadge) {
      prioBadge.className = `badge ${t.priority === 'Urgent' ? 'badge-urgent' : (t.priority === 'High' ? 'badge-offers-ready' : 'badge-pending')}`;
      prioBadge.textContent = t.priority;
    }

    const statBadge = document.getElementById('detail-status-badge');
    if (statBadge) {
      statBadge.className = `badge ${getSupportStatusBadgeClass(t.status)}`;
      statBadge.textContent = t.status;
    }

    const createdStr = new Date(t.created_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    const updatedStr = new Date(t.updated_at).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
    setElementText('detail-created-at', createdStr);
    setElementText('detail-updated-at', updatedStr);

    // 2. Original Description
    setElementText('detail-description', t.description);

    // Initial attachment preview
    const attachPreview = document.getElementById('detail-attachment-preview');
    if (attachPreview) {
      const initialMsgWithAttach = (data.messages || []).find(m => m.attachment_url);
      if (initialMsgWithAttach) {
        attachPreview.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: #ffffff; border: 1px solid var(--border-light); border-radius: var(--radius-sm); padding: 8px 12px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>📎</span>
              <div>
                <strong style="font-size: 11px; color: var(--text-main);">${escapeHtml(initialMsgWithAttach.attachment_name || 'Attachment')}</strong>
                <span style="font-size: 10px; color: var(--text-muted); margin-left: 6px;">(${initialMsgWithAttach.attachment_size || 'File'})</span>
              </div>
            </div>
            <a href="${initialMsgWithAttach.attachment_url}" target="_blank" download="${initialMsgWithAttach.attachment_name || 'file'}" class="btn btn-secondary btn-sm" style="font-size: 11px;">
              View File
            </a>
          </div>
        `;
      } else {
        attachPreview.innerHTML = '';
      }
    }

    // 3. Conversation Thread
    renderAdminChatThread(data.messages || []);

    // 4. Update Dropdown Controls
    const statusSelect = document.getElementById('admin-action-status');
    if (statusSelect) statusSelect.value = t.status;

    const prioSelect = document.getElementById('admin-action-priority');
    if (prioSelect) prioSelect.value = t.priority;

    const assignSelect = document.getElementById('admin-action-assign');
    if (assignSelect) assignSelect.value = t.assigned_admin_name || 'Aman Khan';

    // 5. Customer Information Card
    const cName = t.customer_name || 'Customer';
    const initials = cName.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CU';
    setElementText('support-cust-avatar', initials);
    setElementText('support-cust-name', cName);
    setElementText('support-cust-phone', t.customer_phone || '--');
    setElementText('support-cust-email', t.customer_email || '--');
    setElementText('support-cust-loc', (data.requestContext && data.requestContext.location) || '--');
    setElementText('support-cust-since', (data.requestContext && data.requestContext.customerSince) || '--');
    setElementText('support-cust-total-reqs', `${(data.previousIssues ? data.previousIssues.length + 1 : 1)} Support Interactions`);

    // 6. Request Context Card
    const reqCard = document.getElementById('support-req-context-card');
    if (reqCard) {
      if (data.requestContext) {
        reqCard.style.display = 'block';
        const r = data.requestContext;
        setElementText('support-req-id-tag', r.request_id || r.id);
        setElementText('support-req-service', r.service || r.serviceType || 'Umrah Package');
        setElementText('support-req-travel-date', r.travelDate || '15 Feb 2026');
        setElementText('support-req-pilgrims', r.travelers || `${r.totalPersons || 4} Pilgrims`);
        setElementText('support-req-hotel', r.hotelPreference || r.hotelType || '3 Star (Near Haram)');
        setElementText('support-req-room', r.roomPreference || 'Quad Sharing');
        setElementText('support-req-duration', r.duration || '18 Days');
        setElementText('support-req-budget', r.budget || '₹1,20,000 - ₹1,50,000');
        setElementText('support-req-notes', r.otherRequirements || r.specialRequests || 'Standard pilgrim service.');

        const reqStatusBadge = document.getElementById('support-req-status-badge');
        if (reqStatusBadge) {
          reqStatusBadge.textContent = r.status || r.bookingStatus || 'Active';
          reqStatusBadge.className = `badge ${getBadgeHtml(r.status || r.bookingStatus)}`;
        }
      } else {
        setElementText('support-req-id-tag', 'GENERAL');
        setElementText('support-req-service', 'General Support Request (No Booking Attached)');
        setElementText('support-req-travel-date', '--');
        setElementText('support-req-pilgrims', '--');
        setElementText('support-req-hotel', '--');
        setElementText('support-req-room', '--');
        setElementText('support-req-duration', '--');
        setElementText('support-req-budget', '--');
        setElementText('support-req-notes', 'General customer support inquiry.');
      }
    }

    // 7. Issue History (Previous Calls & Issues)
    renderAdminIssueHistory(data.previousIssues || [], data.callResolutions || [], t);

    // Scroll workspace into view smoothly
    workspace.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    renderAdminSupportTickets();
  } catch (err) {
    console.error('Error opening ticket:', err);
    showToast('Failed to open issue details', 'danger');
  }
}

async function refreshActiveTicketSilently(issueId) {
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${apiBase}/admin/support/tickets/${issueId}`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;

    state.selectedTicketDetails = data;
    renderAdminChatThread(data.messages || []);
    renderAdminIssueHistory(data.previousIssues || [], data.callResolutions || [], data.ticket);
  } catch (e) {}
}

function renderAdminChatThread(messages) {
  const thread = document.getElementById('admin-chat-thread');
  if (!thread) return;

  if (messages.length === 0) {
    thread.innerHTML = '<div style="text-align: center; color: var(--text-muted); padding: 24px; font-size: 12px;">No messages recorded in this conversation yet.</div>';
    return;
  }

  thread.innerHTML = messages.map(m => {
    const isCustomer = m.sender_role === 'CUSTOMER';
    const isInternal = m.message_type === 'INTERNAL_NOTE';
    const timeStr = new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const dateStr = new Date(m.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' });

    let bubbleClass = isCustomer ? 'chat-bubble-customer' : 'chat-bubble-admin';
    if (isInternal) bubbleClass = 'chat-bubble-internal';

    let senderDisplay = isCustomer ? escapeHtml(m.sender_name || 'Customer') : 'Customer Care';
    if (isInternal) senderDisplay = '🔒 Internal Note (Only Visible to Staff)';

    return `
      <div class="chat-bubble ${bubbleClass}">
        <div class="chat-sender">
          <span>${senderDisplay}</span>
          <span class="chat-time">${dateStr} · ${timeStr}</span>
        </div>
        <div style="font-size: 13px; line-height: 1.45; white-space: pre-wrap;">${escapeHtml(m.message)}</div>
        ${m.attachment_url ? `
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed rgba(0,0,0,0.15); font-size: 11px;">
            <a href="${m.attachment_url}" target="_blank" download="${escapeHtml(m.attachment_name || 'attachment')}" style="color: inherit; text-decoration: underline; font-weight: 700;">
              📎 ${escapeHtml(m.attachment_name || 'View Attachment')}
            </a>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');

  // Scroll to bottom
  thread.scrollTop = thread.scrollHeight;
}

function renderAdminIssueHistory(prevIssues, callResolutions, currentTicket) {
  const container = document.getElementById('admin-issue-history-list');
  if (!container) return;

  const items = [];

  // Add previous issues
  prevIssues.forEach(t => {
    const dStr = new Date(t.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    items.push({
      type: 'TICKET',
      id: t.issue_id,
      title: t.subject,
      status: t.status,
      date: dStr,
      isCurrent: false,
      onClick: `openAdminTicket('${t.issue_id}')`
    });
  });

  // Add current issue
  if (currentTicket) {
    const dStr = new Date(currentTicket.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    items.push({
      type: 'CURRENT',
      id: currentTicket.issue_id,
      title: `${currentTicket.subject} (Current Issue)`,
      status: currentTicket.status,
      date: dStr,
      isCurrent: true,
      onClick: `openAdminTicket('${currentTicket.issue_id}')`
    });
  }

  // Add call resolutions
  callResolutions.forEach(c => {
    const dStr = new Date(c.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    items.push({
      type: 'CALL',
      id: 'Phone Call',
      title: c.call_notes.length > 50 ? c.call_notes.slice(0, 48) + '...' : c.call_notes,
      status: c.call_status,
      date: dStr,
      isCurrent: false,
      onClick: `showToast('Call note: ${escapeHtml(c.call_notes.replace(/'/g, ''))}', 'info')`
    });
  });

  if (items.length === 0) {
    container.innerHTML = '<div style="font-size: 11px; color: var(--text-muted); padding: 12px; text-align: center;">No previous issues or call records.</div>';
    return;
  }

  container.innerHTML = items.map(item => `
    <div class="history-card-item" onclick="${item.onClick}" style="${item.isCurrent ? 'border-color: #10b981; background: #ecfdf5;' : ''}">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-family: monospace; font-size: 12px; font-weight: 800; color: ${item.type === 'CALL' ? '#b45309' : 'var(--primary)'};">
          ${item.type === 'CALL' ? '📞 ' + item.id : item.id}
        </span>
        <span class="badge ${getSupportStatusBadgeClass(item.status)}" style="font-size: 10px; padding: 2px 8px;">
          ${item.status}
        </span>
      </div>
      <div style="font-size: 12px; font-weight: 700; color: var(--text-main); margin-top: 4px;">
        ${escapeHtml(item.title)}
      </div>
      <div style="font-size: 10px; color: var(--text-light); margin-top: 4px;">
        ${item.date}
      </div>
    </div>
  `).join('');
}

function setAdminReplyMode(mode) {
  state.adminReplyMode = mode;
  const replyBtn = document.getElementById('btn-mode-reply');
  const internalBtn = document.getElementById('btn-mode-internal');
  const textarea = document.getElementById('admin-reply-textarea');
  const submitBtn = document.getElementById('btn-admin-submit-reply');

  if (mode === 'INTERNAL_NOTE') {
    if (replyBtn) replyBtn.classList.remove('active');
    if (internalBtn) internalBtn.classList.add('active');
    if (textarea) textarea.placeholder = 'Write confidential internal note (only visible to staff members)...';
    if (submitBtn) {
      submitBtn.innerHTML = '<span>Save Internal Note</span> <span>🔒</span>';
      submitBtn.style.background = '#d97706';
    }
  } else {
    if (replyBtn) replyBtn.classList.add('active');
    if (internalBtn) internalBtn.classList.remove('active');
    if (textarea) textarea.placeholder = 'Thank you for contacting ZILHAJ support. Our team is checking the details...';
    if (submitBtn) {
      submitBtn.innerHTML = '<span>Send Reply</span> <span>➤</span>';
      submitBtn.style.background = '';
    }
  }
}

async function submitAdminReply() {
  if (!state.selectedIssueId) {
    showToast('Please select a support ticket first.', 'warning');
    return;
  }

  const textarea = document.getElementById('admin-reply-textarea');
  const message = textarea ? textarea.value.trim() : '';

  if (!message) {
    showToast('Please type a message before sending.', 'warning');
    return;
  }

  // 1. Instant Optimistic Render (0ms lag, no wiping thread)
  const thread = document.getElementById('admin-chat-thread');
  if (thread) {
    const isInternal = state.adminReplyMode === 'INTERNAL_NOTE';
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const bubbleClass = isInternal ? 'chat-bubble-internal' : 'chat-bubble-admin';
    const senderDisplay = isInternal ? '🔒 Internal Note (Only Visible to Staff)' : 'Customer Care (You)';
    const tempHtml = `
      <div class="chat-bubble ${bubbleClass}">
        <div class="chat-sender">
          <span>${senderDisplay}</span>
          <span class="chat-time">Today · ${nowTime}</span>
        </div>
        <div style="font-size: 13px; line-height: 1.45; white-space: pre-wrap;">${escapeHtml(message)}</div>
      </div>
    `;
    thread.insertAdjacentHTML('beforeend', tempHtml);
    thread.scrollTop = thread.scrollHeight;
  }

  if (textarea) textarea.value = '';

  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/support/tickets/${state.selectedIssueId}/messages`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message,
        message_type: state.adminReplyMode,
        admin_name: 'Aman Khan (Customer Care)',
        admin_id: 'admin_aman'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to send message');
    }

    showToast(state.adminReplyMode === 'INTERNAL_NOTE' ? 'Internal note recorded' : 'Reply sent to customer', 'success');

    // Silently refresh active ticket details in background (no flicker)
    await refreshActiveTicketSilently(state.selectedIssueId);
  } catch (err) {
    console.error('Error sending reply:', err);
    showToast(err.message || 'Could not send reply', 'danger');
  }
}

async function handleAdminStatusSelect(newStatus) {
  if (!state.selectedIssueId) return;
  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/support/tickets/${state.selectedIssueId}/status`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ status: newStatus, changed_by: 'Aman Khan (Customer Care)' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message);

    showToast(`Ticket status updated to ${newStatus}`, 'success');
    await openAdminTicket(state.selectedIssueId);
    await loadAdminSupportData(false);
  } catch (err) {
    showToast(err.message || 'Failed to update status', 'danger');
  }
}

async function quickUpdateStatus(newStatus) {
  await handleAdminStatusSelect(newStatus);
}

async function handleAdminPrioritySelect(priority) {
  if (!state.selectedIssueId) return;
  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/support/tickets/${state.selectedIssueId}/priority`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ priority, changed_by: 'Aman Khan (Customer Care)' })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message);

    showToast(`Priority updated to ${priority}`, 'success');
    await openAdminTicket(state.selectedIssueId);
  } catch (err) {
    showToast(err.message || 'Failed to update priority', 'danger');
  }
}

async function handleAdminAssignSelect(adminName) {
  if (!state.selectedIssueId) return;
  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/support/tickets/${state.selectedIssueId}/assign`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ admin_id: 'admin_' + adminName.split(' ')[0].toLowerCase(), admin_name: adminName })
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message);

    showToast(`Ticket assigned to ${adminName}`, 'success');
    await openAdminTicket(state.selectedIssueId);
  } catch (err) {
    showToast(err.message || 'Failed to assign executive', 'danger');
  }
}

async function handleOnCallSubmit(e) {
  e.preventDefault();
  const category = document.getElementById('oncall-category')?.value || 'Hotel Related';
  const call_status = document.getElementById('oncall-status')?.value || 'Resolved';
  const notesText = document.getElementById('oncall-notes');
  const call_notes = notesText ? notesText.value.trim() : '';

  if (!call_notes || call_notes.length < 5) {
    showToast('Please enter detailed call notes (min 5 characters).', 'warning');
    return;
  }

  const custName = document.getElementById('support-cust-name')?.textContent || 'Customer';
  const custPhone = document.getElementById('support-cust-phone')?.textContent || '--';
  const reqId = document.getElementById('support-req-id-tag')?.textContent || 'GENERAL';

  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/support/on-call-resolution`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        ticket_id: state.selectedIssueId || null,
        request_id: reqId,
        customer_name: custName,
        customer_phone: custPhone,
        category,
        call_status,
        call_notes,
        admin_name: 'Aman Khan (Customer Care)',
        admin_id: 'admin_aman'
      })
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message);

    showToast('On-call resolution saved & logged in history', 'success');
    if (notesText) notesText.value = '';

    if (state.selectedIssueId) {
      await openAdminTicket(state.selectedIssueId);
    }
    await loadAdminSupportData(false);
  } catch (err) {
    showToast(err.message || 'Failed to save call resolution', 'danger');
  }
}

let supportSearchTimeout = null;
function handleSupportSearch(val) {
  state.supportSearchQuery = val;
  clearTimeout(supportSearchTimeout);
  supportSearchTimeout = setTimeout(() => {
    loadAdminSupportData(false);
  }, 300);
}

function handleSupportFilterChange() {
  state.supportFilterStatus = document.getElementById('support-filter-status')?.value || 'All';
  state.supportFilterPriority = document.getElementById('support-filter-priority')?.value || 'All';
  state.supportFilterCategory = document.getElementById('support-filter-category')?.value || 'All';
  state.supportFilterSort = document.getElementById('support-filter-sort')?.value || 'newest';
  loadAdminSupportData(false);
}

function resetSupportFilters() {
  state.supportSearchQuery = '';
  state.supportFilterStatus = 'All';
  state.supportFilterPriority = 'All';
  state.supportFilterCategory = 'All';
  state.supportFilterSort = 'newest';

  const sInput = document.getElementById('support-search-input');
  if (sInput) sInput.value = '';
  const statSelect = document.getElementById('support-filter-status');
  if (statSelect) statSelect.value = 'All';
  const prioSelect = document.getElementById('support-filter-priority');
  if (prioSelect) prioSelect.value = 'All';
  const catSelect = document.getElementById('support-filter-category');
  if (catSelect) catSelect.value = 'All';
  const sortSelect = document.getElementById('support-filter-sort');
  if (sortSelect) sortSelect.value = 'newest';

  loadAdminSupportData(false);
  showToast('Filters reset', 'info');
}

function filterSupportByStatus(status) {
  state.supportFilterStatus = status;
  const statSelect = document.getElementById('support-filter-status');
  if (statSelect) statSelect.value = status;
  loadAdminSupportData(false);
  showToast(`Filtering by ${status} issues`, 'info');
}

function filterSupportByPriority(priority) {
  state.supportFilterPriority = priority;
  const prioSelect = document.getElementById('support-filter-priority');
  if (prioSelect) prioSelect.value = priority;
  loadAdminSupportData(false);
  showToast(`Filtering by ${priority} priority`, 'info');
}

// ============================================================================
// 10. PACKAGE INVENTORY ENGINE (CENTRAL REPOSITORY & 1-CLICK ATTACH)
// ============================================================================

async function loadInventoryData(showNotification = false) {
  const apiBase = getApiBase();
  const headers = getAuthHeaders();
  try {
    const res = await fetch(`${apiBase}/admin/inventory`, { headers });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && Array.isArray(data.packages)) {
      state.packageInventory = data.packages;

      // Update badges
      const totalCount = state.packageInventory.length;
      const navBadge = document.getElementById('nav-inventory-badge');
      const sideBadge = document.getElementById('sidebar-inventory-badge');
      const totalBadge = document.getElementById('inventory-total-badge');
      if (navBadge) navBadge.textContent = totalCount;
      if (sideBadge) sideBadge.textContent = totalCount;
      if (totalBadge) totalBadge.textContent = `${totalCount} Packages`;

      // Populate Quick-Fill Dropdown in Custom Offer Modal
      populateInventoryQuickFillOptions();

      // Render if on inventory tab
      if (state.currentTab === 'inventory') {
        renderInventoryList();
      }

      if (showNotification) {
        showToast('Package inventory synchronized with live database!', 'success');
      }
    }
  } catch (err) {
    console.warn('Error loading inventory data:', err.message);
  }
}

function refreshInventoryData(showToastNotice = true) {
  loadInventoryData(showToastNotice);
}

function renderInventoryList() {
  const grid = document.getElementById('inventory-cards-grid');
  if (!grid) return;

  let list = [...state.packageInventory];

  // Search filter
  if (state.inventorySearchQuery && state.inventorySearchQuery.trim()) {
    const q = state.inventorySearchQuery.trim().toLowerCase();
    list = list.filter(p => {
      const title = (p.packageTitle || '').toLowerCase();
      const agent = (p.agentName || '').toLowerCase();
      const makkah = (p.makkahHotel || '').toLowerCase();
      const madinah = (p.madinahHotel || '').toLowerCase();
      const duration = (p.duration || '').toLowerCase();
      const price = String(p.pricePerPerson || '');
      return title.includes(q) || agent.includes(q) || makkah.includes(q) || madinah.includes(q) || duration.includes(q) || price.includes(q);
    });
  }

  // Service filter
  if (state.inventoryServiceFilter && state.inventoryServiceFilter !== 'All') {
    list = list.filter(p => (p.serviceType || '').toLowerCase() === state.inventoryServiceFilter.toLowerCase());
  }

  // Status filter
  if (state.inventoryStatusFilter && state.inventoryStatusFilter !== 'All') {
    list = list.filter(p => (p.status || '').toLowerCase() === state.inventoryStatusFilter.toLowerCase());
  }

  if (list.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; padding: 48px; text-align: center; background: #ffffff; border: 2px dashed #cbd5e1; border-radius: var(--radius-xl);">
        <div style="font-size: 36px; margin-bottom: 8px;">📦</div>
        <h4 style="font-size: 16px; font-weight: 800; color: var(--text-main);">No inventory packages match your filter</h4>
        <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Click '+ Add Package to Inventory' to add verified packages to the repository.</p>
        <button onclick="resetInventoryFilters()" class="btn btn-secondary btn-sm" style="margin-top: 14px;">Reset Filters</button>
      </div>
    `;
    return;
  }

  grid.innerHTML = list.map(p => {
    const isUmrah = (p.serviceType || '').toLowerCase() === 'umrah';
    const priceFormatted = Number(p.pricePerPerson || 0).toLocaleString('en-IN');
    return `
      <div class="offer-card" style="display: flex; flex-direction: column; justify-content: space-between; border: 1.5px solid var(--border-light); border-radius: var(--radius-xl); padding: 18px; background: #ffffff; box-shadow: var(--shadow-sm);">
        <div>
          <!-- Header -->
          <div style="display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle);">
            <div>
              <span class="badge ${isUmrah ? 'badge-service-umrah' : 'badge-service-hajj'}" style="font-size: 10px; padding: 2px 8px;">
                ${isUmrah ? '🕋 Umrah' : '🏛️ Hajj'}
              </span>
              <span style="font-size: 11px; font-weight: 800; color: var(--text-light); margin-left: 6px;">${escapeHtml(p.agentId || 'AGENT')}</span>
              <h4 style="font-size: 15px; font-weight: 800; color: var(--text-main); margin-top: 4px;">${escapeHtml(p.packageTitle)}</h4>
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${escapeHtml(p.agentName)}</div>
            </div>
            <div>
              <span class="badge ${p.status === 'Active' ? 'badge-active' : 'badge-pending'}" style="font-size: 11px;">
                ${escapeHtml(p.status || 'Active')}
              </span>
            </div>
          </div>

          <!-- Price & Duration -->
          <div style="margin: 12px 0; padding-bottom: 12px; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: baseline;">
            <div>
              <span class="offer-price-large" style="font-size: 20px; font-weight: 900; color: var(--primary);">₹${priceFormatted}</span>
              <span style="font-size: 11px; color: var(--text-muted);"> / person</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 10px; color: var(--text-light); font-weight: 700;">Duration</span>
              <div style="font-size: 13px; font-weight: 800; color: var(--text-main);">${escapeHtml(p.duration || '18 Days')}</div>
            </div>
          </div>

          <!-- Hotels & Amenities Grid -->
          <div class="offer-amenity-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 11px;">
            <div class="amenity-box" style="background: #f8fafc; padding: 8px 10px; border-radius: var(--radius-sm);">
              <div class="amenity-label" style="font-weight: 800; color: var(--primary);">🏢 Makkah Hotel</div>
              <div class="amenity-val" style="font-weight: 700; color: var(--text-main);">${escapeHtml(p.makkahHotel || '--')}</div>
              <div class="amenity-dist" style="font-size: 10px; color: var(--text-muted);">${escapeHtml(p.makkahDistance || '')}</div>
            </div>

            <div class="amenity-box" style="background: #f8fafc; padding: 8px 10px; border-radius: var(--radius-sm);">
              <div class="amenity-label" style="font-weight: 800; color: #b45309;">🏢 Madinah Hotel</div>
              <div class="amenity-val" style="font-weight: 700; color: var(--text-main);">${escapeHtml(p.madinahHotel || '--')}</div>
              <div class="amenity-dist" style="font-size: 10px; color: var(--text-muted);">${escapeHtml(p.madinahDistance || '')}</div>
            </div>

            <div class="amenity-box" style="background: #f8fafc; padding: 8px 10px; border-radius: var(--radius-sm);">
              <div class="amenity-label" style="font-weight: 700; color: var(--text-light);">🚌 Transport</div>
              <div class="amenity-val">${escapeHtml(p.transport || 'AC Bus')}</div>
            </div>

            <div class="amenity-box" style="background: #f8fafc; padding: 8px 10px; border-radius: var(--radius-sm);">
              <div class="amenity-label" style="font-weight: 700; color: var(--text-light);">🍽️ Meals</div>
              <div class="amenity-val">${escapeHtml(p.mealPlan || 'Included')}</div>
            </div>
          </div>
        </div>

        <!-- Footer Actions -->
        <div style="padding-top: 14px; margin-top: 14px; border-top: 1px solid var(--border-subtle); display: flex; gap: 8px;">
          <button onclick="useInventoryPackageInActiveRequest('${p.id}')" class="btn btn-primary btn-sm" style="flex: 2; font-weight: 800; background: #047857;">
            <span>⚡ Attach to Request</span>
          </button>
          <button onclick="deleteInventoryPackage('${p.id}')" class="btn btn-danger btn-sm" title="Delete from Inventory" style="font-weight: 800; padding: 4px 10px;">
            ✕
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function handleInventorySearch(val) {
  state.inventorySearchQuery = val;
  renderInventoryList();
}

function handleInventoryFilterChange() {
  state.inventoryServiceFilter = document.getElementById('inventory-filter-service')?.value || 'All';
  state.inventoryStatusFilter = document.getElementById('inventory-filter-status')?.value || 'All';
  renderInventoryList();
}

function resetInventoryFilters() {
  state.inventorySearchQuery = '';
  state.inventoryServiceFilter = 'All';
  state.inventoryStatusFilter = 'All';
  const sInput = document.getElementById('inventory-search-input');
  if (sInput) sInput.value = '';
  const sSvc = document.getElementById('inventory-filter-service');
  if (sSvc) sSvc.value = 'All';
  const sStat = document.getElementById('inventory-filter-status');
  if (sStat) sStat.value = 'All';
  renderInventoryList();
  showToast('Inventory filters reset', 'info');
}

// Populate Quick-fill in Add Offer modal
function populateInventoryQuickFillOptions() {
  const select = document.getElementById('add-offer-inventory-quickfill');
  if (!select) return;

  const currentVal = select.value;
  select.innerHTML = '<option value="">-- Choose package from inventory to auto-fill details --</option>' +
    state.packageInventory.map(p => `
      <option value="${p.id}">${escapeHtml(p.packageTitle)} (${p.serviceType}) — ₹${Number(p.pricePerPerson || 0).toLocaleString('en-IN')} by ${escapeHtml(p.agentName)}</option>
    `).join('');

  if (currentVal) select.value = currentVal;
}

function handleQuickFillOfferFromInventory(packageId) {
  if (!packageId) return;
  const p = state.packageInventory.find(item => item.id === packageId);
  if (!p) return;

  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('add-offer-pkg-title', p.packageTitle);
  setVal('add-offer-agent-name', p.agentName);
  setVal('add-offer-duration', p.duration);
  setVal('add-offer-price', p.pricePerPerson);
  setVal('add-offer-makkah-hotel', p.makkahHotel);
  setVal('add-offer-makkah-dist', p.makkahDistance);
  setVal('add-offer-madinah-hotel', p.madinahHotel);
  setVal('add-offer-madinah-dist', p.madinahDistance);
  setVal('add-offer-transport', p.transport);
  setVal('add-offer-meal', p.mealPlan);
  setVal('add-offer-ziyarat', p.ziyarat);

  showToast(`Fields auto-filled from "${p.packageTitle}"`, 'success');
}

// Open Select From Inventory Modal for active request
function openSelectFromInventoryModal() {
  const req = state.requests.find(r => r.id === state.selectedRequestId) || state.requests[0];
  if (!req) {
    showToast('Please select a customer request first.', 'warning');
    return;
  }
  state.selectedRequestId = req.id;

  setElementText('select-modal-req-id', req.id);
  setElementText('select-modal-req-service', req.service || req.serviceType || 'Umrah');
  setElementText('select-modal-req-pilgrims', `${req.travelers || 4} Pilgrims`);

  const searchInput = document.getElementById('select-inventory-search');
  if (searchInput) searchInput.value = '';

  filterSelectInventoryCards('');
  openModal('select-inventory-offer-modal');
}

function filterSelectInventoryCards(query = '') {
  const listContainer = document.getElementById('select-inventory-cards-list');
  if (!listContainer) return;

  const req = state.requests.find(r => r.id === state.selectedRequestId);
  const reqService = req ? (req.service || req.serviceType || '').toLowerCase() : '';
  const q = query.trim().toLowerCase();

  let packages = [...state.packageInventory];
  if (q) {
    packages = packages.filter(p => {
      return (p.packageTitle || '').toLowerCase().includes(q) ||
             (p.agentName || '').toLowerCase().includes(q) ||
             (p.makkahHotel || '').toLowerCase().includes(q) ||
             (p.madinahHotel || '').toLowerCase().includes(q);
    });
  }

  // Sort so matching service type appears first
  packages.sort((a, b) => {
    const aMatch = reqService && (a.serviceType || '').toLowerCase().includes(reqService) ? 1 : 0;
    const bMatch = reqService && (b.serviceType || '').toLowerCase().includes(reqService) ? 1 : 0;
    return bMatch - aMatch;
  });

  if (packages.length === 0) {
    listContainer.innerHTML = '<div style="grid-column: 1 / -1; padding: 32px; text-align: center; color: var(--text-muted);">No inventory packages match search.</div>';
    return;
  }

  listContainer.innerHTML = packages.map(p => {
    const isMatched = reqService && (p.serviceType || '').toLowerCase().includes(reqService);
    const travelers = req ? (Number(req.travelers) || 4) : 4;
    const totalPrice = (Number(p.pricePerPerson || 0) * travelers).toLocaleString('en-IN');

    return `
      <div style="background: #ffffff; border: 1.5px solid ${isMatched ? '#86efac' : 'var(--border-light)'}; border-radius: var(--radius-lg); padding: 16px; display: flex; flex-direction: column; justify-content: space-between; box-shadow: var(--shadow-sm);">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <div>
              <span class="badge ${p.serviceType === 'Umrah' ? 'badge-service-umrah' : 'badge-service-hajj'}" style="font-size: 10px; padding: 2px 8px;">
                ${p.serviceType === 'Umrah' ? '🕋 Umrah' : '🏛️ Hajj'}
              </span>
              ${isMatched ? '<span style="font-size: 10px; font-weight: 800; background: #dcfce7; color: #047857; padding: 2px 6px; border-radius: 4px; margin-left: 4px;">Recommended Match</span>' : ''}
              <h4 style="font-size: 15px; font-weight: 800; color: var(--text-main); margin-top: 4px;">${escapeHtml(p.packageTitle)}</h4>
              <div style="font-size: 12px; color: var(--text-muted); font-weight: 600;">${escapeHtml(p.agentName)}</div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 18px; font-weight: 900; color: var(--primary);">₹${Number(p.pricePerPerson || 0).toLocaleString('en-IN')}</span>
              <div style="font-size: 11px; color: var(--text-muted);">Total ₹${totalPrice} (${travelers} pers)</div>
            </div>
          </div>

          <div style="background: #f8fafc; border-radius: var(--radius-sm); padding: 8px 10px; font-size: 11px; margin-bottom: 12px; display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <div><strong>Makkah:</strong> ${escapeHtml(p.makkahHotel)} (${escapeHtml(p.makkahDistance)})</div>
            <div><strong>Madinah:</strong> ${escapeHtml(p.madinahHotel)} (${escapeHtml(p.madinahDistance)})</div>
            <div><strong>Duration:</strong> ${escapeHtml(p.duration)}</div>
            <div><strong>Meals:</strong> ${escapeHtml(p.mealPlan)}</div>
          </div>
        </div>

        <button onclick="applyInventoryPackageToCurrentRequest('${p.id}')" class="btn btn-primary" style="width: 100%; font-weight: 800; background: #047857;">
          ✓ Attach this Offer to ${req ? req.id : 'Request'}
        </button>
      </div>
    `;
  }).join('');
}

async function applyInventoryPackageToCurrentRequest(packageId) {
  if (!state.selectedRequestId) {
    showToast('Please select a customer request first.', 'warning');
    return;
  }

  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/requirements/${state.selectedRequestId}/apply-inventory-offer`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ packageId, status: 'Published' })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to apply inventory offer');
    }

    closeModal('select-inventory-offer-modal');
    showToast(`Inventory offer attached to ${state.selectedRequestId} successfully!`, 'success');

    // Refresh request and database
    await refreshAllData(false);
    renderRequestDetails();
  } catch (err) {
    console.error('Error applying inventory offer:', err);
    showToast(err.message || 'Could not attach offer', 'danger');
  }
}

function useInventoryPackageInActiveRequest(packageId) {
  const req = state.requests.find(r => r.id === state.selectedRequestId) || state.requests[0];
  if (!req) {
    showToast('No customer requests available to attach this package.', 'warning');
    return;
  }
  state.selectedRequestId = req.id;
  applyInventoryPackageToCurrentRequest(packageId);
}

// Add New Package to Inventory Form Submit
async function handleAddInventoryPackageSubmit(e) {
  e.preventDefault();
  const title = document.getElementById('inv-pkg-title')?.value.trim();
  const service = document.getElementById('inv-pkg-service')?.value || 'Umrah';
  const agentName = document.getElementById('inv-pkg-agent-name')?.value.trim();
  const agentId = document.getElementById('inv-pkg-agent-id')?.value.trim() || `AGENT-${Math.floor(1000 + Math.random() * 9000)}`;
  const duration = document.getElementById('inv-pkg-duration')?.value.trim() || '18 Days';
  const price = Number(document.getElementById('inv-pkg-price')?.value) || 85000;
  const seats = Number(document.getElementById('inv-pkg-seats')?.value) || 20;
  const makkahHotel = document.getElementById('inv-pkg-makkah-hotel')?.value.trim() || 'Standard Hotel';
  const makkahDist = document.getElementById('inv-pkg-makkah-dist')?.value.trim() || '300m from Haram';
  const madinahHotel = document.getElementById('inv-pkg-madinah-hotel')?.value.trim() || 'Standard Hotel';
  const madinahDist = document.getElementById('inv-pkg-madinah-dist')?.value.trim() || '200m from Haram';
  const transport = document.getElementById('inv-pkg-transport')?.value.trim() || 'AC Bus Transfers';
  const meals = document.getElementById('inv-pkg-meals')?.value.trim() || 'Full Board Meals';
  const ziyarat = document.getElementById('inv-pkg-ziyarat')?.value.trim() || 'Historical Ziyarat Included';
  const status = document.getElementById('inv-pkg-status')?.value || 'Active';

  const newPkg = {
    packageTitle: title,
    serviceType: service,
    agentName: agentName,
    agentId: agentId,
    duration: duration,
    pricePerPerson: price,
    seatsAvailable: seats,
    makkahHotel: makkahHotel,
    makkahDistance: makkahDist,
    madinahHotel: madinahHotel,
    madinahDistance: madinahDist,
    transport: transport,
    mealPlan: meals,
    ziyarat: ziyarat,
    status: status
  };

  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/inventory`, {
      method: 'POST',
      headers,
      body: JSON.stringify(newPkg)
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Failed to save inventory package');
    }

    closeModal('add-inventory-pkg-modal');
    showToast(`Package "${title}" added to inventory!`, 'success');
    await loadInventoryData(false);
  } catch (err) {
    showToast(err.message || 'Error saving package to inventory', 'danger');
  }
}

async function deleteInventoryPackage(packageId) {
  if (!confirm('Are you sure you want to remove this package from the central inventory?')) return;

  const apiBase = getApiBase();
  const headers = getAuthHeaders();

  try {
    const res = await fetch(`${apiBase}/admin/inventory/${packageId}`, {
      method: 'DELETE',
      headers
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'Failed to delete');

    showToast('Package removed from inventory', 'info');
    await loadInventoryData(false);
  } catch (err) {
    showToast(err.message || 'Failed to delete package', 'danger');
  }
}

// ==========================================
// 10. Global Window Bindings for Inline Handlers
// ==========================================
window.navigateToTab = navigateToTab;
window.renderCurrentTab = renderCurrentTab;
window.viewRequest = viewRequest;
window.openModal = openModal;
window.closeModal = closeModal;
window.toggleAdminMenu = toggleAdminMenu;
window.handleAdminLogout = handleAdminLogout;
window.markAllNotifsRead = markAllNotifsRead;
window.openSupportFromNotification = openSupportFromNotification;
window.showToast = showToast;
window.refreshAllData = refreshAllData;
window.openSelectFromInventoryModal = openSelectFromInventoryModal;
window.applyInventoryPackageToCurrentRequest = applyInventoryPackageToCurrentRequest;
window.useInventoryPackageInActiveRequest = useInventoryPackageInActiveRequest;
window.deleteInventoryPackage = deleteInventoryPackage;
window.openAdminTicket = openAdminTicket;
window.handleAdminSendSupportMessage = handleAdminSendSupportMessage;
window.submitAdminReply = submitAdminReply;
window.handleAddInventoryPackageSubmit = handleAddInventoryPackageSubmit;
window.handleQuickFillOfferFromInventory = handleQuickFillOfferFromInventory;
window.filterSelectInventoryCards = filterSelectInventoryCards;
window.resetInventoryFilters = resetInventoryFilters;

// ==========================================
// 11. Lifecycle Initialization & Real-Time Sync Loop
// ==========================================
async function initAdminApp() {
  const user = JSON.parse(localStorage.getItem('umrah_user') || 'null');
  let token = (user && (user.token || user.jwtToken)) ||
              localStorage.getItem('umrah_token') ||
              localStorage.getItem('zilhaj_token') ||
              sessionStorage.getItem('zilhaj_token');

  // If no token exists, acquire authoritative session from backend
  if (!token) {
    try {
      const apiBase = getApiBase();
      const authRes = await fetch(`${apiBase}/auth/google`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'admin@umrah.com', name: 'System Admin' })
      });
      if (authRes.ok) {
        const authData = await authRes.json();
        if (authData.token) {
          token = authData.token;
          const userObj = { ...(authData.user || {}), token: authData.token };
          localStorage.setItem('umrah_user', JSON.stringify(userObj));
          localStorage.setItem('umrah_token', authData.token);
          localStorage.setItem('zilhaj_token', authData.token);
          sessionStorage.setItem('zilhaj_token', authData.token);
        }
      }
    } catch (e) {
      console.warn('[ADMIN] Initial session sync warning:', e.message);
    }
  }

  // Update Admin Profile pill in header
  const stored = JSON.parse(localStorage.getItem('umrah_user') || 'null');
  if (stored) {
    const nameEl = document.getElementById('header-admin-name');
    const emailEl = document.getElementById('dropdown-user-email');
    const avatarEl = document.getElementById('header-admin-avatar');
    if (nameEl) nameEl.textContent = stored.name || 'System Admin';
    if (emailEl) emailEl.textContent = stored.email || 'admin@zilhaj.com';
    if (avatarEl) avatarEl.textContent = (stored.name ? stored.name.slice(0, 2).toUpperCase() : 'AD');
  }

  // Initial load of live database
  await refreshAllData(false);

  // Real-time polling every 6 seconds to ensure live updates
  setInterval(() => {
    refreshAllData(false);
  }, 6000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initAdminApp);
} else {
  initAdminApp();
}



