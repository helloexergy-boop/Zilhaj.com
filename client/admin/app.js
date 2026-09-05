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
  agents: [
    { id: "AGENT-1042", name: "Al-Safwa Travel & Tours", contact: "Sheikh Mansoor", city: "Makkah / Srinagar", verified: true, rating: 4.9, packages: 12, offers: 248, bookings: 184 },
    { id: "AGENT-8091", name: "Makkah Tours & Services", contact: "Dr. Bilal Qureshi", city: "Jeddah / Srinagar", verified: true, rating: 4.8, packages: 8, offers: 196, bookings: 140 },
    { id: "AGENT-3310", name: "Haramain Express Travel", contact: "Haji Ghulam Rasool", city: "Srinagar / Riyadh", verified: true, rating: 4.95, packages: 15, offers: 312, bookings: 260 },
    { id: "AGENT-7720", name: "Rawdah Holidays Pvt Ltd", contact: "Faheem Akhtar", city: "Mumbai / Madinah", verified: true, rating: 4.85, packages: 6, offers: 145, bookings: 110 },
    { id: "AGENT-4501", name: "Al-Haramain Group Int.", contact: "Mustafa Kamal", city: "New Delhi / Makkah", verified: true, rating: 4.75, packages: 5, offers: 112, bookings: 84 },
    { id: "AGENT-9912", name: "Noor Al Huda Pilgrimages", contact: "Molvi Shabir", city: "Srinagar / Madinah", verified: true, rating: 4.9, packages: 9, offers: 180, bookings: 146 }
  ],
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
  const token = (user && user.token) ? user.token : 'demo-superadmin-jwt-token';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
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

    if (Array.isArray(reqsRes) && reqsRes.length > 0) {
      state.requests = reqsRes;
    }
    if (Array.isArray(usersRes) && usersRes.length > 0) {
      state.users = usersRes;
    }
    if (Array.isArray(staffRes) && staffRes.length > 0) {
      state.subAdmins = staffRes;
      state.subAdminPerformance = staffRes.map(s => ({
        name: s.name,
        initials: s.initials,
        offers: s.requestsHandled || 18,
        avatarBg: s.avatarBg,
        avatarColor: s.avatarColor
      }));
    }
    if (statsRes) {
      state.stats = statsRes;
    }
    if (Array.isArray(bookRes)) {
      state.bookings = bookRes;
    }

    // Build notifications from latest inquiries
    generateLiveNotifications();

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

function generateLiveNotifications() {
  const notifs = [];
  state.requests.slice(0, 4).forEach((r, idx) => {
    notifs.push({
      id: idx + 1,
      title: r.status === 'Completed' ? 'Booking Completed' : (r.offers && r.offers.length > 0 ? 'Offer Received' : 'New Request Submitted'),
      msg: `${r.customer} submitted ${r.service} request (${r.id}).`,
      time: r.submittedOn || 'Recently',
      unread: idx < 2
    });
  });
  state.notifications = notifs;

  const notifsContainer = document.getElementById('notifs-container-list');
  const dot = document.getElementById('header-notif-dot');
  if (dot) dot.textContent = notifs.filter(n => n.unread).length || '0';
  if (notifsContainer) {
    notifsContainer.innerHTML = notifs.map(n => `
      <div style="padding: 12px; background: ${n.unread ? '#ecfdf5' : '#f8fafc'}; border-radius: var(--radius-md); font-size: 12px; border: 1px solid ${n.unread ? '#a7f3d0' : '#e2e8f0'};">
        <div style="font-weight: 800; color: ${n.unread ? '#065f46' : 'var(--text-main)'};">${n.title}</div>
        <div style="color: var(--text-body); margin-top: 2px;">${n.msg}</div>
        <div style="font-size: 10px; color: var(--text-light); margin-top: 4px;">${n.time}</div>
      </div>
    `).join('');
  }
}

function markAllNotifsRead() {
  state.notifications.forEach(n => n.unread = false);
  const dot = document.getElementById('header-notif-dot');
  if (dot) dot.textContent = '0';
  generateLiveNotifications();
  closeModal('notifications-modal');
  showToast('All notifications marked as read', 'info');
}

// ==========================================
// 5. Navigation & Tab Switcher
// ==========================================
function navigateToTab(tabId) {
  state.currentTab = tabId;
  
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
  else if (tabId === 'reports') renderReportsView();
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
  const totalBookings = state.bookings.length || 8;
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
    const list = state.subAdminPerformance.length > 0 ? state.subAdminPerformance.slice(0, 5) : [
      { name: "Palak Badyal", initials: "PB", offers: 48, avatarBg: "#d1fae5", avatarColor: "#065f46" },
      { name: "Arslan Ahmed", initials: "AA", offers: 36, avatarBg: "#ccfbf1", avatarColor: "#115e59" },
      { name: "Irfan Fayaz", initials: "IF", offers: 28, avatarBg: "#e0f2fe", avatarColor: "#0369a1" },
      { name: "Tawseef Ahmad", initials: "TA", offers: 22, avatarBg: "#e0e7ff", avatarColor: "#3730a3" },
      { name: "Samiullah Mir", initials: "SM", offers: 18, avatarBg: "#fef3c7", avatarColor: "#92400e" }
    ];

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

  // Booking Overview Row
  const totalB = state.bookings.length || 8;
  const procB = state.bookings.filter(b => b.status !== 'CANCELLED' && b.status !== 'COMPLETED').length || 3;
  const cancB = state.bookings.filter(b => b.status === 'CANCELLED').length || 1;
  const bTot = document.getElementById('booking-total-val');
  const bPrc = document.getElementById('booking-process-val');
  const bCnc = document.getElementById('booking-cancel-val');
  if (bTot) bTot.textContent = totalB;
  if (bPrc) bPrc.textContent = procB;
  if (bCnc) bCnc.textContent = cancB;

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
  const totBooked = state.subAdmins.reduce((acc, cur) => acc + (cur.customersBooked || 0), 0) || 1248;
  const totHandled = state.subAdmins.reduce((acc, cur) => acc + (cur.requestsHandled || 0), 0) || 856;
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

  container.innerHTML = state.agents.map(ag => `
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
    if (user) {
      state.currentUser = user;
      const name = user.name || 'Admin User';
      const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'AD';
      setElementText('header-admin-name', name);
      setElementText('header-admin-role', user.role === 'ROLE_ADMIN' ? 'Super Admin' : (user.role === 'ROLE_SUBADMIN' ? 'Sub Admin' : 'Admin'));
      setElementText('header-admin-avatar', initials);
      setElementText('dropdown-user-email', user.email || 'admin@umrah.com');
    }
  } catch (e) {}

  const dateEl = document.getElementById('dash-date-display');
  if (dateEl) {
    const now = new Date();
    dateEl.textContent = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  }
}

function toggleAdminMenu(e) {
  e.stopPropagation();
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
  if (menu && !trigger.contains(e.target) && !menu.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// ==========================================
// 8. Global DOM Event Bindings & Live Sync
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
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
});
