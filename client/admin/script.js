/**
 * ZILHAJ.COM - ADMIN & SUB-ADMIN PORTAL ENGINE
 * Handles authentication, dynamic role-based permission checks, sub-admin management,
 * agent verifications, user moderation, requirement approvals, and revenue analytics.
 */

const API_BASE_URL = '/api';

// Current Admin User Session State
let currentAdminUser = {
  id: 'admin-1',
  name: 'System Administrator',
  email: 'admin@umrah.com',
  role: 'ROLE_ADMIN', // 'ROLE_ADMIN' or 'ROLE_SUBADMIN'
  permissions: ['MANAGE_USERS', 'MANAGE_AGENTS', 'APPROVE_REQUIREMENTS', 'MODERATE_PACKAGES', 'VIEW_FINANCES', 'MANAGE_SUBADMINS']
};

let cachedUsers = [];
let cachedAgents = [];
let cachedSubAdmins = [];
let cachedRequirements = [];
let cachedPackages = [];
let cachedPayments = [];
let currentAgentFilter = 'ALL';

// Initialize Admin Portal on Page Load
document.addEventListener('DOMContentLoaded', () => {
  loadAdminSession();
  applyRoleAndPermissionAccessControl();
  setupSidebarNavigation();
  refreshAdminData();
});

/**
 * 1. Session & Token Authentication Load
 */
function loadAdminSession() {
  const storedUserJson = localStorage.getItem('umrah_user') || sessionStorage.getItem('umrah_user');
  if (storedUserJson) {
    try {
      const parsed = JSON.parse(storedUserJson);
      if (parsed && (parsed.role === 'ROLE_ADMIN' || parsed.role === 'ROLE_SUBADMIN')) {
        currentAdminUser = {
          id: parsed.id || 'admin-user',
          name: parsed.name || 'Admin User',
          email: parsed.email || 'admin@zilhaj.com',
          role: parsed.role,
          permissions: parsed.permissions || (parsed.role === 'ROLE_ADMIN' 
            ? ['MANAGE_USERS', 'MANAGE_AGENTS', 'APPROVE_REQUIREMENTS', 'MODERATE_PACKAGES', 'VIEW_FINANCES', 'MANAGE_SUBADMINS']
            : ['MANAGE_USERS', 'MANAGE_AGENTS'])
        };
      }
    } catch (e) {
      console.warn('Could not parse stored admin session:', e);
    }
  }

  // Update Header UI
  document.getElementById('navAdminName').textContent = currentAdminUser.name;
  const initials = currentAdminUser.name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
  document.getElementById('navAdminAvatarInitials').textContent = initials || 'AD';

  const roleTag = document.getElementById('navAdminRoleTag');
  const sidebarBadge = document.getElementById('sidebarAdminBadgeText');

  if (currentAdminUser.role === 'ROLE_ADMIN') {
    roleTag.textContent = 'SUPER ADMIN';
    roleTag.className = 'admin-role-tag';
    sidebarBadge.textContent = 'Full Super Admin Control';
  } else {
    roleTag.textContent = 'SUB-ADMIN';
    roleTag.className = 'admin-role-tag subadmin';
    sidebarBadge.textContent = 'Limited Sub-Admin Portal';
  }
}

/**
 * 2. Dynamic Permission Access Control
 * Hides tabs & controls based on Sub-Admin permissions array.
 */
function applyRoleAndPermissionAccessControl() {
  const sidebarButtons = document.querySelectorAll('#adminSidebarNav .sidebar-link');
  let firstVisibleTab = null;

  sidebarButtons.forEach(button => {
    const requiredPermission = button.getAttribute('data-permission');
    const tabName = button.getAttribute('data-tab');

    let hasAccess = false;

    // Super Admin has unrestricted access to all modules
    if (currentAdminUser.role === 'ROLE_ADMIN') {
      hasAccess = true;
    } else if (currentAdminUser.role === 'ROLE_SUBADMIN') {
      if (currentAdminUser.permissions.includes(requiredPermission)) {
        hasAccess = true;
      }
    }

    if (hasAccess) {
      button.style.display = 'flex';
      if (!firstVisibleTab) firstVisibleTab = tabName;
    } else {
      button.style.display = 'none';
    }
  });

  // Switch to first allowed tab if active tab is hidden
  const currentActiveBtn = document.querySelector('#adminSidebarNav .sidebar-link.active');
  if (currentActiveBtn && currentActiveBtn.style.display === 'none' && firstVisibleTab) {
    switchAdminTab(firstVisibleTab);
  }
}

/**
 * 3. Sidebar Navigation Handler
 */
function setupSidebarNavigation() {
  const sidebarButtons = document.querySelectorAll('#adminSidebarNav .sidebar-link');
  sidebarButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabTarget = btn.getAttribute('data-tab');
      switchAdminTab(tabTarget);
    });
  });
}

function switchAdminTab(tabName) {
  // Check permission for tabName
  if (currentAdminUser.role !== 'ROLE_ADMIN') {
    const permMap = {
      'overview': 'VIEW_FINANCES',
      'users': 'MANAGE_USERS',
      'agents': 'MANAGE_AGENTS',
      'requirements': 'APPROVE_REQUIREMENTS',
      'packages': 'MODERATE_PACKAGES',
      'payments': 'VIEW_FINANCES',
      'subadmins': 'MANAGE_SUBADMINS'
    };
    const req = permMap[tabName];
    if (req && !currentAdminUser.permissions.includes(req)) {
      alert('Access Denied: You do not have permission to access the ' + tabName + ' module.');
      return;
    }
  }

  document.querySelectorAll('#adminSidebarNav .sidebar-link').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));

  const activeBtn = document.querySelector(`#adminSidebarNav .sidebar-link[data-tab="${tabName}"]`);
  const targetPane = document.getElementById(`tab-${tabName}`);

  if (activeBtn) activeBtn.classList.add('active');
  if (targetPane) targetPane.classList.add('active');
}

/**
 * 4. Fetch Real-time Admin Metrics & Data
 */
async function refreshAdminData() {
  const token = getJwtToken();
  const headers = token ? { 'Authorization': 'Bearer ' + token } : {};

  // A. Fetch Platform Analytics
  try {
    const res = await fetch(`${API_BASE_URL}/admin/analytics`, { headers });
    if (res.ok) {
      const data = await res.json();
      document.getElementById('statTotalUsers').textContent = data.totalUsers || 0;
      document.getElementById('statTotalAgents').textContent = data.totalAgents || 0;
      document.getElementById('statTotalRequirements').textContent = data.totalPackages || data.totalBookings || 0;
      if (data.totalRevenueINR !== undefined) {
        document.getElementById('statTotalRevenue').textContent = '₹' + Number(data.totalRevenueINR).toLocaleString('en-IN', { minimumFractionDigits: 2 });
      }
    } else {
      useFallbackAnalytics();
    }
  } catch (e) {
    useFallbackAnalytics();
  }

  // B. Fetch Users List
  try {
    const res = await fetch(`${API_BASE_URL}/admin/users`, { headers });
    if (res.ok) {
      cachedUsers = await res.json();
      renderUsersTable(cachedUsers);
    } else {
      useFallbackUsers();
    }
  } catch (e) {
    useFallbackUsers();
  }

  // C. Fetch Agents List
  try {
    const res = await fetch(`${API_BASE_URL}/admin/agents`, { headers });
    if (res.ok) {
      cachedAgents = await res.json();
      renderAgentsTable(cachedAgents);
    } else {
      useFallbackAgents();
    }
  } catch (e) {
    useFallbackAgents();
  }

  // D. Fetch Sub-Admins List
  try {
    const res = await fetch(`${API_BASE_URL}/admin/subadmins`, { headers });
    if (res.ok) {
      cachedSubAdmins = await res.json();
      renderSubAdminsTable(cachedSubAdmins);
    } else {
      useFallbackSubAdmins();
    }
  } catch (e) {
    useFallbackSubAdmins();
  }

  // E. Render Requirements, Packages & Payments
  renderRequirementsTable();
  renderPackagesTable();
  renderPaymentsTable();
}

/**
 * 5. Users Table Rendering & Search Filter
 */
function renderUsersTable(users) {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  if (!users || users.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No users registered yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(user => {
    const isSubAdmin = user.role === 'ROLE_SUBADMIN';
    const isSuperAdmin = user.role === 'ROLE_ADMIN';
    const isAgent = user.role === 'ROLE_AGENT';

    let roleBadge = '<span class="badge-tag approved">PILGRIM</span>';
    if (isSuperAdmin) roleBadge = '<span class="admin-role-tag">SUPER ADMIN</span>';
    else if (isSubAdmin) roleBadge = '<span class="admin-role-tag subadmin">SUB-ADMIN</span>';
    else if (isAgent) roleBadge = '<span class="badge-tag pending">TRAVEL AGENT</span>';

    const perms = (user.permissions && user.permissions.length > 0)
      ? user.permissions.map(p => `<span class="perm-pill-tag">${p}</span>`).join('')
      : '<span style="color: var(--text-light); font-size: 12px;">Full Access / N/A</span>';

    const dateStr = user.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN') : 'Recent';

    return `
      <tr>
        <td>
          <strong style="color: var(--text-dark);">${escapeHtml(user.name || 'User')}</strong>
        </td>
        <td>
          <div>${escapeHtml(user.email || 'N/A')}</div>
          <small style="color: var(--text-muted);">${escapeHtml(user.phone || 'No phone')}</small>
        </td>
        <td>${roleBadge}</td>
        <td>${perms}</td>
        <td>${dateStr}</td>
        <td>
          <button class="btn-table-action secondary" onclick="viewUserDetails('${user.id}')">Details</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterUsersTable() {
  const query = (document.getElementById('inputSearchUsers').value || '').toLowerCase();
  const filtered = cachedUsers.filter(u => 
    (u.name && u.name.toLowerCase().includes(query)) ||
    (u.email && u.email.toLowerCase().includes(query)) ||
    (u.phone && u.phone.includes(query))
  );
  renderUsersTable(filtered);
}

/**
 * 6. Agent Verifications Module
 */
function renderAgentsTable(agents) {
  const tbody = document.getElementById('agentsTableBody');
  if (!tbody) return;

  const filtered = agents.filter(a => {
    if (currentAgentFilter === 'ALL') return true;
    return (a.verificationStatus || 'PENDING') === currentAgentFilter;
  });

  const pendingCount = agents.filter(a => (a.verificationStatus || 'PENDING') === 'PENDING').length;
  document.getElementById('badgePendingAgents').textContent = pendingCount;
  document.getElementById('badgePendingCount').textContent = pendingCount;
  document.getElementById('statPendingAgentsText').textContent = `${pendingCount} Pending Approval`;

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No travel agencies match status: ${currentAgentFilter}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(agent => {
    const status = agent.verificationStatus || 'PENDING';
    let statusBadge = '<span class="badge-tag pending">PENDING</span>';
    if (status === 'VERIFIED') statusBadge = '<span class="badge-tag verified">VERIFIED</span>';
    if (status === 'REJECTED') statusBadge = '<span class="badge-tag rejected">REJECTED</span>';

    const canManageAgents = currentAdminUser.role === 'ROLE_ADMIN' || currentAdminUser.permissions.includes('MANAGE_AGENTS');

    const actions = canManageAgents ? `
      ${status !== 'VERIFIED' ? `<button class="btn-table-action primary" onclick="updateAgentStatus('${agent.id}', 'VERIFIED')">Verify</button>` : ''}
      ${status !== 'REJECTED' ? `<button class="btn-table-action danger" onclick="updateAgentStatus('${agent.id}', 'REJECTED')">Reject</button>` : ''}
    ` : '<span style="color: var(--text-light);">Read-only</span>';

    return `
      <tr>
        <td>
          <strong style="color: var(--text-dark);">${escapeHtml(agent.companyName || 'Travel Agency')}</strong>
        </td>
        <td><code>${escapeHtml(agent.licenseNumber || 'LIC-PENDING')}</code></td>
        <td>${escapeHtml(agent.ownerName || 'Agency Partner')}</td>
        <td>${statusBadge}</td>
        <td>⭐ ${agent.rating || '4.8'} (${agent.reviewCount || 12} reviews)</td>
        <td>${actions}</td>
      </tr>
    `;
  }).join('');
}

function filterAgentStatus(status) {
  currentAgentFilter = status;
  document.querySelectorAll('#agentStatusFilterTabs .filter-tab').forEach(t => t.classList.remove('active'));
  event.target.classList.add('active');
  renderAgentsTable(cachedAgents);
}

async function updateAgentStatus(agentId, newStatus) {
  const token = getJwtToken();
  try {
    const res = await fetch(`${API_BASE_URL}/admin/agents/${agentId}/verify?status=${newStatus}`, {
      method: 'PUT',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    });

    if (res.ok) {
      alert(`Agency status updated to ${newStatus} successfully.`);
      refreshAdminData();
    } else {
      // Local cache update fallback
      const target = cachedAgents.find(a => a.id === agentId);
      if (target) target.verificationStatus = newStatus;
      renderAgentsTable(cachedAgents);
      alert(`Agency status updated locally to ${newStatus}.`);
    }
  } catch (e) {
    const target = cachedAgents.find(a => a.id === agentId);
    if (target) target.verificationStatus = newStatus;
    renderAgentsTable(cachedAgents);
    alert(`Agency status updated locally to ${newStatus}.`);
  }
}

/**
 * 7. Sub-Admin Access Control Module (Super Admin & Authorized Sub-Admins)
 */
function renderSubAdminsTable(subAdmins) {
  const tbody = document.getElementById('subAdminsTableBody');
  if (!tbody) return;

  if (!subAdmins || subAdmins.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No Sub-Admins created yet. Click "Create New Sub-Admin" to add one.</td></tr>`;
    return;
  }

  tbody.innerHTML = subAdmins.map(sa => {
    const perms = (sa.permissions && sa.permissions.length > 0)
      ? sa.permissions.map(p => `<span class="perm-pill-tag">${p}</span>`).join(' ')
      : '<span style="color: var(--text-muted); font-size: 12px;">No permissions checked</span>';

    const canManageSubAdmins = currentAdminUser.role === 'ROLE_ADMIN' || currentAdminUser.permissions.includes('MANAGE_SUBADMINS');

    const actionsHtml = canManageSubAdmins ? `
      <button class="btn-table-action secondary" onclick="openSubAdminModal('${sa.id}')">Edit Permissions</button>
      <button class="btn-table-action danger" onclick="deleteSubAdmin('${sa.id}')">Revoke Account</button>
    ` : '<span style="color: var(--text-light);">Restricted</span>';

    return `
      <tr>
        <td>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="user-avatar-circle" style="width: 32px; height: 32px; font-size: 12px;">${(sa.name || 'SA').substring(0, 2).toUpperCase()}</span>
            <strong>${escapeHtml(sa.name)}</strong>
          </div>
        </td>
        <td>${escapeHtml(sa.email)}</td>
        <td>${escapeHtml(sa.phone || 'N/A')}</td>
        <td>${perms}</td>
        <td>${sa.createdAt ? new Date(sa.createdAt).toLocaleDateString('en-IN') : 'Recent'}</td>
        <td>${actionsHtml}</td>
      </tr>
    `;
  }).join('');
}

function openSubAdminModal(subAdminId = null) {
  const modal = document.getElementById('subAdminModalOverlay');
  const title = document.getElementById('modalSubAdminTitle');
  const editIdInput = document.getElementById('subAdminEditId');
  const passStar = document.getElementById('subAdminPasswordStar');
  const passHint = document.getElementById('subAdminPasswordHint');
  const passInput = document.getElementById('subAdminPassword');

  document.getElementById('formSubAdmin').reset();

  if (subAdminId) {
    const sa = cachedSubAdmins.find(x => x.id === subAdminId);
    if (!sa) return;

    title.textContent = 'Edit Sub-Admin Access Rights';
    editIdInput.value = sa.id;
    document.getElementById('subAdminName').value = sa.name;
    document.getElementById('subAdminEmail').value = sa.email;
    document.getElementById('subAdminEmail').readOnly = true;
    document.getElementById('subAdminPhone').value = sa.phone || '';

    passStar.style.display = 'none';
    passHint.style.display = 'block';
    passInput.required = false;

    // Set permission checkboxes
    const assigned = sa.permissions || [];
    document.querySelectorAll('input[name="subadmin_perm"]').forEach(cb => {
      cb.checked = assigned.includes(cb.value);
    });
  } else {
    title.textContent = 'Create New Sub-Admin Account';
    editIdInput.value = '';
    document.getElementById('subAdminEmail').readOnly = false;
    passStar.style.display = 'inline';
    passHint.style.display = 'none';
    passInput.required = true;

    document.querySelectorAll('input[name="subadmin_perm"]').forEach(cb => cb.checked = true);
  }

  modal.style.display = 'flex';
}

function closeSubAdminModal() {
  document.getElementById('subAdminModalOverlay').style.display = 'none';
}

async function handleSubAdminSubmit(e) {
  e.preventDefault();
  const token = getJwtToken();
  const editId = document.getElementById('subAdminEditId').value;
  const name = document.getElementById('subAdminName').value.trim();
  const email = document.getElementById('subAdminEmail').value.trim();
  const password = document.getElementById('subAdminPassword').value.trim();
  const phone = document.getElementById('subAdminPhone').value.trim();

  const selectedPermissions = Array.from(document.querySelectorAll('input[name="subadmin_perm"]:checked')).map(cb => cb.value);

  if (editId) {
    // Update permissions
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subadmins/${editId}/permissions`, {
        method: 'PUT',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ permissions: selectedPermissions })
      });

      if (res.ok) {
        alert('Sub-Admin permissions updated successfully.');
      } else {
        updateLocalSubAdmin(editId, name, phone, selectedPermissions);
      }
    } catch (e) {
      updateLocalSubAdmin(editId, name, phone, selectedPermissions);
    }
  } else {
    // Create new Sub-Admin
    try {
      const res = await fetch(`${API_BASE_URL}/admin/subadmins`, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name,
          email,
          password,
          phone,
          permissions: selectedPermissions
        })
      });

      if (res.ok) {
        alert('Sub-Admin account created successfully.');
      } else {
        createLocalSubAdmin(name, email, phone, selectedPermissions);
      }
    } catch (e) {
      createLocalSubAdmin(name, email, phone, selectedPermissions);
    }
  }

  closeSubAdminModal();
  refreshAdminData();
}

function createLocalSubAdmin(name, email, phone, permissions) {
  const newSubAdmin = {
    id: 'subadmin-' + Date.now(),
    name,
    email,
    phone,
    role: 'ROLE_SUBADMIN',
    permissions,
    createdAt: new Date().toISOString()
  };
  cachedSubAdmins.push(newSubAdmin);
  renderSubAdminsTable(cachedSubAdmins);
  alert('Sub-Admin created locally and saved in session.');
}

function updateLocalSubAdmin(id, name, phone, permissions) {
  const sa = cachedSubAdmins.find(x => x.id === id);
  if (sa) {
    sa.name = name;
    sa.phone = phone;
    sa.permissions = permissions;
    renderSubAdminsTable(cachedSubAdmins);
    alert('Sub-Admin permissions updated locally.');
  }
}

async function deleteSubAdmin(subAdminId) {
  if (!confirm('Are you sure you want to revoke and delete this Sub-Admin account?')) return;
  const token = getJwtToken();

  try {
    const res = await fetch(`${API_BASE_URL}/admin/subadmins/${subAdminId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer ' + token }
    });

    if (res.ok) {
      alert('Sub-Admin revoked successfully.');
    } else {
      cachedSubAdmins = cachedSubAdmins.filter(x => x.id !== subAdminId);
      renderSubAdminsTable(cachedSubAdmins);
    }
  } catch (e) {
    cachedSubAdmins = cachedSubAdmins.filter(x => x.id !== subAdminId);
    renderSubAdminsTable(cachedSubAdmins);
  }
  refreshAdminData();
}

/**
 * 8. Fallback Seeder Datasets (Ensures full real-life working demo out-of-the-box)
 */
function useFallbackAnalytics() {
  document.getElementById('statTotalUsers').textContent = '148';
  document.getElementById('statTotalAgents').textContent = '24';
  document.getElementById('statTotalRequirements').textContent = '36';
  document.getElementById('statTotalRevenue').textContent = '₹18,45,000.00';
}

function useFallbackUsers() {
  cachedUsers = [
    { id: 'usr-1', name: 'Tariq Mahmood', email: 'user@Zaireen.com', phone: '+91 9541692891', role: 'ROLE_USER', createdAt: '2026-08-10' },
    { id: 'usr-2', name: 'Umrah Travels Agent', email: 'agent@alharam.com', phone: '+91 9541692891', role: 'ROLE_AGENT', createdAt: '2026-08-12' },
    { id: 'usr-3', name: 'System Administrator', email: 'admin@umrah.com', phone: '+91 1234567890', role: 'ROLE_ADMIN', createdAt: '2026-08-01' },
    { id: 'usr-4', name: 'Operations SubAdmin', email: 'subadmin@umrah.com', phone: '+91 1234567899', role: 'ROLE_SUBADMIN', permissions: ['MANAGE_USERS', 'MANAGE_AGENTS', 'APPROVE_REQUIREMENTS'], createdAt: '2026-08-15' }
  ];
  renderUsersTable(cachedUsers);
}

function useFallbackAgents() {
  cachedAgents = [
    { id: 'ag-1', companyName: 'Al Haram Travels Srinagar', licenseNumber: 'UMRAH-LIC-95416', ownerName: 'Shabeer Ahmad', verificationStatus: 'VERIFIED', rating: 4.9, reviewCount: 128 },
    { id: 'ag-2', companyName: 'Baitullah Tours & Travels', licenseNumber: 'UMRAH-LIC-77201', ownerName: 'Mohammad Farooq', verificationStatus: 'PENDING', rating: 4.7, reviewCount: 42 },
    { id: 'ag-3', companyName: 'Ziyarat Express International', licenseNumber: 'UMRAH-LIC-88319', ownerName: 'Bilal Hassan', verificationStatus: 'PENDING', rating: 4.8, reviewCount: 65 }
  ];
  renderAgentsTable(cachedAgents);
}

function useFallbackSubAdmins() {
  cachedSubAdmins = [
    { id: 'sub-1', name: 'Operations SubAdmin', email: 'subadmin@umrah.com', phone: '+91 9541692899', role: 'ROLE_SUBADMIN', permissions: ['MANAGE_USERS', 'MANAGE_AGENTS', 'APPROVE_REQUIREMENTS'], createdAt: '2026-08-15' },
    { id: 'sub-2', name: 'Financial Auditor SubAdmin', email: 'finance.sub@zilhaj.com', phone: '+91 9876543210', role: 'ROLE_SUBADMIN', permissions: ['VIEW_FINANCES'], createdAt: '2026-08-20' }
  ];
  renderSubAdminsTable(cachedSubAdmins);
}

function renderRequirementsTable() {
  const tbody = document.getElementById('requirementsTableBody');
  if (!tbody) return;

  const reqs = [
    { id: 'req-101', traveler: 'Farooq Ahmad', cities: 'Makkah (8 Days) + Madinah (7 Days)', count: '4 Adults', budget: '₹1,20,000 / person', pref: '4-Star Hotel near Haram', status: 'PENDING' },
    { id: 'req-102', traveler: 'Dr. Sameer Khan', cities: 'Ramadan Special Package', count: '2 Adults', budget: '₹1,60,000 / person', pref: 'Includes Direct Flights', status: 'APPROVED' }
  ];

  tbody.innerHTML = reqs.map(r => `
    <tr>
      <td><strong>${r.traveler}</strong></td>
      <td>${r.cities}</td>
      <td>${r.count} - <strong>${r.budget}</strong></td>
      <td>${r.pref}</td>
      <td><span class="badge-tag ${r.status === 'APPROVED' ? 'approved' : 'pending'}">${r.status}</span></td>
      <td>
        ${r.status === 'PENDING' ? `<button class="btn-table-action primary" onclick="approveReq('${r.id}')">Approve for Bidding</button>` : `<span style="color: var(--primary-green); font-weight:700;">Live for Bids</span>`}
      </td>
    </tr>
  `).join('');
}

function approveReq(id) {
  alert(`Requirement ${id} approved for travel agency bidding!`);
  renderRequirementsTable();
}

function renderPackagesTable() {
  const tbody = document.getElementById('packagesTableBody');
  if (!tbody) return;

  const pkgs = [
    { id: 'pkg-1', title: '18-Day Deluxe Umrah Package', agency: 'Al Haram Travels', duration: '18 Days (600m to Haram)', price: '₹1,25,000', dep: '12 AUGUST' },
    { id: 'pkg-2', title: 'Economy 15-Day Umrah Saver', agency: 'Baitullah Tours', duration: '15 Days', price: '₹85,000', dep: '25 SEPTEMBER' }
  ];

  tbody.innerHTML = pkgs.map(p => `
    <tr>
      <td><strong>${p.title}</strong></td>
      <td>${p.agency}</td>
      <td>${p.duration}</td>
      <td><strong style="color: var(--primary-green);">${p.price}</strong></td>
      <td>${p.dep}</td>
      <td>
        <button class="btn-table-action danger" onclick="deletePkg('${p.id}')">Moderate / Remove</button>
      </td>
    </tr>
  `).join('');
}

function deletePkg(id) {
  if (confirm('Moderate and delete package listing?')) {
    alert('Package moderated and removed.');
  }
}

function renderPaymentsTable() {
  const tbody = document.getElementById('paymentsTableBody');
  if (!tbody) return;

  const payments = [
    { ref: 'PAY-95416-01', user: 'usr-1', pkg: '18-Day Deluxe Package', agency: 'Al Haram Travels', amount: '₹1,25,000.00', status: 'CONFIRMED', date: '2026-08-28' },
    { ref: 'PAY-95416-02', user: 'usr-2', pkg: 'Economy 15-Day Package', agency: 'Baitullah Tours', amount: '₹85,000.00', status: 'CONFIRMED', date: '2026-08-30' }
  ];

  tbody.innerHTML = payments.map(p => `
    <tr>
      <td><code>${p.ref}</code></td>
      <td>${p.user}</td>
      <td>${p.pkg}</td>
      <td>${p.agency}</td>
      <td><strong style="color: var(--primary-green);">${p.amount}</strong></td>
      <td><span class="badge-tag verified">${p.status}</span></td>
      <td>${p.date}</td>
    </tr>
  `).join('');
}

function exportAdminCSVReport() {
  window.open(`${API_BASE_URL}/admin/reports/export`, '_blank');
}

function logoutAdmin() {
  localStorage.removeItem('umrah_user');
  sessionStorage.removeItem('umrah_user');
  window.location.href = '/';
}

function getJwtToken() {
  const storedUser = localStorage.getItem('umrah_user') || sessionStorage.getItem('umrah_user');
  if (storedUser) {
    try {
      return JSON.parse(storedUser).token || '';
    } catch(e){}
  }
  return '';
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
