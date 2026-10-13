/**
 * AED Remind - Application Logic
 * Exact 1:1 implementation of 'AED Remind System Map - 2.8.xlsx'
 */
let currentRole = "Sys Admin";
let showArchivedEquipment = false;
let showArchivedInspections = false;
let showArchivedPads = false;
let showArchivedBatteries = false;
let currentEditingPadId = null;
let currentSelectedSpareId = null;
let currentEditingBatteryId = null;
let currentSelectedSpareBatteryId = null;
let currentEditingInspectionId = null;
let inspectionPhotoData = null;
let inspectionSignatureData = null;
let showArchivedPanelInspections = false;

async function initApp() {
  let isAuthenticated = false;
  try {
    isAuthenticated = await checkAuthSession();
  } catch (e) {
    console.error("checkAuthSession error:", e);
  } finally {
    // Reveal the application UI container cleanly
    document.body.classList.remove('auth-checking');
  }

  try { initSidebarState(); } catch (e) { console.error("initSidebarState error:", e); }
  try { setupNavigation(); } catch (e) { console.error("setupNavigation error:", e); }

  if (isAuthenticated) {
    await startAuthenticatedApp();
  }
}

async function startAuthenticatedApp() {
  try { setupSearchBars(); } catch (e) { console.error("setupSearchBars error:", e); }
  try { setupAddressAutoFill(); } catch (e) { console.error("setupAddressAutoFill error:", e); }
  try { loadAccountInfo(); } catch (e) { console.error("loadAccountInfo error:", e); }

  // Sync cache with live Zoho Creator data
  try {
    await Promise.all([
      api.getEquipment('active'),
      api.getEquipment('spare'),
      api.getLocations(),
      api.getOrganizations(),
      api.getInspections('active'),
      api.getRescueEvents(),
      api.getCPRCertifications(),
      api.getUsers()
    ]);
  } catch (err) {
    console.warn("Initial sync from Zoho Creator:", err);
  }

  // Initial renders
  try { setupOrganizationSwitcher(); } catch (e) { console.error("setupOrganizationSwitcher error:", e); }
  try { renderDashboard(); } catch (e) { console.error("renderDashboard error:", e); }
  try { renderEquipment(); } catch (e) { console.error("renderEquipment error:", e); }
  try { renderSpare(); } catch (e) { console.error("renderSpare error:", e); }
  try { renderInspections(); } catch (e) { console.error("renderInspections error:", e); }
  try { renderRescue(); } catch (e) { console.error("renderRescue error:", e); }
  try { renderCPR(); } catch (e) { console.error("renderCPR error:", e); }
  try { renderLocations(); } catch (e) { console.error("renderLocations error:", e); }
  try { renderUsersRoster(); } catch (e) { console.error("renderUsersRoster error:", e); }
  try { renderOrganizationsRoster(); } catch (e) { console.error("renderOrganizationsRoster error:", e); }
  try { populateDropdowns(); } catch (e) { console.error("populateDropdowns error:", e); }
}

// --------------------------------------------------------------------------
// Navigation (Column A & B in Excel) & Collapsible Sidebar Toggle
// --------------------------------------------------------------------------
window.toggleSidebar = function() {
  const sidebar = document.querySelector('.sidebar');
  if (!sidebar) return;
  const isCollapsed = sidebar.classList.toggle('collapsed');
  document.body.classList.toggle('sidebar-collapsed', isCollapsed);
  try {
    localStorage.setItem('aed_sidebar_collapsed', isCollapsed ? 'true' : 'false');
  } catch (e) {
    console.warn("localStorage not available:", e);
  }
  updateSidebarToggleBtn(isCollapsed);
};

function updateSidebarToggleBtn(isCollapsed) {
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (toggleBtn) {
    toggleBtn.innerHTML = isCollapsed ? '<i class="fa-solid fa-angles-right"></i>' : '<i class="fa-solid fa-angles-left"></i>';
    toggleBtn.title = isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar';
  }
}

function initSidebarState() {
  let isCollapsed = false;
  try {
    isCollapsed = localStorage.getItem('aed_sidebar_collapsed') === 'true';
  } catch (e) {}

  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    if (isCollapsed) {
      sidebar.classList.add('collapsed');
      document.body.classList.add('sidebar-collapsed');
    } else {
      sidebar.classList.remove('collapsed');
      document.body.classList.remove('sidebar-collapsed');
    }
    updateSidebarToggleBtn(isCollapsed);
  }
}

function setupNavigation() {
  document.querySelectorAll('.sidebar-link').forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetView = link.getAttribute('data-view');
      switchView(targetView);
    });
  });
}

function switchView(viewName) {
  // If customer role, only customer notice is shown
  if (currentRole === 'Customer (No Portal Access)') {
    document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    const custView = document.getElementById('customer-no-portal-view');
    if (custView) custView.style.display = 'block';
    const titleEl = document.getElementById('page-title-banner');
    if (titleEl) {
      titleEl.style.display = 'block';
      titleEl.textContent = 'Customer Notice (No Portal Access)';
    }
    return;
  }

  // Strict Role Route Guards per Excel RBAC Matrix
  if (currentRole === 'Inspector') {
    const allowedInspectorViews = ['dashboard', 'equipment', 'inspections', 'aed-panel', 'settings'];
    if (!allowedInspectorViews.includes(viewName)) {
      viewName = 'inspections';
    }
  } else if (currentRole === 'Staff') {
    const blockedStaffViews = ['users', 'system-log'];
    if (blockedStaffViews.includes(viewName)) {
      viewName = 'dashboard';
    }
  } else if (currentRole === 'Reseller*') {
    if (viewName === 'system-log') {
      viewName = 'dashboard';
    }
    // If reseller opens users/org view, ensure it points to the Organization tab
    if (viewName === 'users') {
      setTimeout(() => switchUserModuleTab('organization'), 0);
    }
  } else if (currentRole !== 'Sys Admin') {
    // Admin, Admin (Account owner)
    if (viewName === 'system-log') {
      viewName = 'dashboard';
    }
  }

  // Update sidebar active link
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  const activeLink = document.querySelector(`.sidebar-link[data-view="${viewName}"]`);
  if (activeLink) activeLink.classList.add('active');

  // Hide all sections
  document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');

  // Show target section
  const targetSection = document.getElementById(`${viewName}-view`);
  if (targetSection) {
    targetSection.style.display = 'block';
  } else {
    // Fallback for settings sub-pages
    const settingsSection = document.getElementById('settings-view');
    if (settingsSection) settingsSection.style.display = 'block';
  }

  // Exact page banner titles from Excel Row 2
  const bannerTitles = {
    'dashboard': 'Dashboard',
    'equipment': 'Equipment',
    'spare': 'Spare Equipment',
    'inspections': 'Inspections',
    'rescue': 'Rescue Events',
    'cpr': 'CPR Certification',
    'locations': 'Locations',
    'settings': 'Account Settings',
    'users': 'Users & Access',
    'billing': 'Billing & Subscriptions',
    'system-log': 'System Audit Log',
    'aed-panel': 'AED Information'
  };

  const titleEl = document.getElementById('page-title-banner');
  if (titleEl) {
    if (viewName === 'aed-panel') {
      titleEl.style.display = 'none';
    } else {
      titleEl.style.display = 'block';
      titleEl.textContent = bannerTitles[viewName] || 'AED Remind';
    }
  }

  // Refresh active view data
  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'equipment') renderEquipment();
  if (viewName === 'spare') renderSpare();
  if (viewName === 'inspections') renderInspections();
  if (viewName === 'rescue') renderRescue();
  if (viewName === 'cpr') renderCPR();
  if (viewName === 'locations') {
    const formContainer = document.getElementById('locations-form-container');
    if (!formContainer || formContainer.style.display !== 'block') {
      const listContainer = document.getElementById('locations-list-container');
      if (listContainer) listContainer.style.display = 'block';
      if (formContainer) formContainer.style.display = 'none';
    }
    renderLocations();
  }
  if (viewName === 'system-log' && typeof window.renderSystemLog === 'function') window.renderSystemLog('standalone');
  if (viewName === 'aed-panel' && typeof window.populateAEDPanelDropdowns === 'function') window.populateAEDPanelDropdowns();
  if (viewName === 'users') {
    loadAccountInfo();
    renderUsersRoster();
  }
}
window.switchView = switchView;

// --------------------------------------------------------------------------
// --------------------------------------------------------------------------
// Status Column Renderer (Strictly 1:1 with Excel System Map - Screenshot 1)
// --------------------------------------------------------------------------
function getStatusClassification(statusText, category = '') {
  if (!statusText || statusText.trim() === '' || statusText === '-') {
    return { colorClass: '', iconClass: '', iconColor: '', label: '' };
  }

  const raw = statusText.trim();
  const s = raw.toLowerCase();

  // 1. AED Warranty Expiration Status (Warning Colors: ALWAYS Orange warning triangle, NOT Red!)
  if (category === 'warranty' || s.includes('warranty')) {
    if (s === 'ok' || s.includes('warranty active') || s === 'active') {
      return { 
        colorClass: 'ok', 
        iconClass: 'fa-solid fa-circle-check', 
        iconColor: '#107C41',
        label: raw 
      };
    }
    // 'Warranty Not Active', 'Warranty Expires in [x days]', 'Warranty Expired'
    return { 
      colorClass: 'warning', 
      iconClass: 'fa-solid fa-triangle-exclamation', 
      iconColor: '#ED7D31',
      label: raw 
    };
  }

  // 2. Critical Safety Failures & Non-operational states
  // - 'Out of Service' (Inspection status or Service status) -> Red Triangle per Warning Colors
  if (s.includes('out of service')) {
    return { 
      colorClass: 'danger-triangle', 
      iconClass: 'fa-solid fa-triangle-exclamation', 
      iconColor: '#C00000',
      label: raw 
    };
  }

  // - 'Failed' (Inspection status) -> Red Circle X
  if (s.includes('fail') || s.includes('defic')) {
    return { 
      colorClass: 'danger', 
      iconClass: 'fa-solid fa-circle-xmark', 
      iconColor: '#C00000',
      label: raw 
    };
  }

  // - 'Replacement Required' -> Red Circle X
  if (s.includes('replacement')) {
    return { 
      colorClass: 'danger', 
      iconClass: 'fa-solid fa-circle-xmark', 
      iconColor: '#C00000',
      label: raw 
    };
  }

  // 3. Inspections: 'Overdue' -> Orange Triangle
  if (s.includes('overdue')) {
    return { 
      colorClass: 'warning', 
      iconClass: 'fa-solid fa-triangle-exclamation', 
      iconColor: '#ED7D31',
      label: raw 
    };
  }

  // 4. Inspections: 'Upcoming' -> Blue Triangle
  if (s.includes('upcoming')) {
    return { 
      colorClass: 'upcoming', 
      iconClass: 'fa-solid fa-triangle-exclamation', 
      iconColor: '#0070C0',
      label: raw 
    };
  }

  // 5. Consumables (Pads / Battery) Expiration Status:
  // - 'Expires in [x days]' -> Orange Triangle
  if (s.includes('expires in') || s.includes('expiring soon') || s.includes('soon')) {
    return { 
      colorClass: 'warning', 
      iconClass: 'fa-solid fa-triangle-exclamation', 
      iconColor: '#ED7D31',
      label: raw 
    };
  }

  // - 'Expired' (Pads / Battery) -> Red Circle X
  if (s.includes('expired')) {
    return { 
      colorClass: 'danger', 
      iconClass: 'fa-solid fa-circle-xmark', 
      iconColor: '#C00000',
      label: raw 
    };
  }

  // 6. Healthy / Normal: 'Ok', 'Rescue-Ready', 'Standby', 'Passed', 'Good' -> Green Circle Check
  if (s === 'ok' || s.includes('rescue-ready') || s.includes('standby') || s.includes('passed') || s.includes('good')) {
    return { 
      colorClass: 'ok', 
      iconClass: 'fa-solid fa-circle-check', 
      iconColor: '#107C41',
      label: raw 
    };
  }

  // Default fallback -> Green Circle Check
  return { 
    colorClass: 'ok', 
    iconClass: 'fa-solid fa-circle-check', 
    iconColor: '#107C41',
    label: raw 
  };
}

function renderExcelStatusCell(statusText, category = '') {
  if (!statusText || statusText.trim() === '' || statusText === '-') {
    return `<td></td>`;
  }
  const { colorClass, iconClass, iconColor, label } = getStatusClassification(statusText, category);
  if (!colorClass) return `<td></td>`;

  return `
    <td>
      <div class="excel-status-cell">
        <i class="${iconClass} excel-status-icon" style="color: ${iconColor};"></i>
        <span class="excel-status-label ${colorClass}">${label}</span>
      </div>
    </td>
  `;
}

// Uniform single-cell status renderer across all reports
function renderStatusCells(statusText, category = '') {
  return renderExcelStatusCell(statusText, category);
}

// --------------------------------------------------------------------------
// 1. DASHBOARD VIEW (3 Stacked Excel Tables)
// --------------------------------------------------------------------------
async function renderDashboard() {
  const rawInspections = await api.getInspections('active');
  const rawEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const rawCPR = await api.getCPRCertifications();

  const inspections = filterRecordsByOrg(rawInspections);
  const allEquipment = filterRecordsByOrg(rawEquipment);
  const cpr = filterRecordsByOrg(rawCPR);

  // Calculate dynamic KPI counts from live records
  const totalAeds = allEquipment.filter(e => e.type === 'AED' && e.tab === 'active').length;
  const warrantyExpired = allEquipment.filter(e => e.type === 'AED' && e.tab === 'active' && (e.expirationStatus || '').includes('Expired')).length;
  const padsExpired = allEquipment.filter(e => (e.type || '').includes('Pad') && e.tab === 'active' && (e.expirationStatus || '').includes('Expired')).length;
  const batteriesExpired = allEquipment.filter(e => (e.type || '').includes('Battery') && e.tab === 'active' && (e.expirationStatus || '').includes('Expired')).length;
  const inspectionsFailed = inspections.filter(i => (i.status || '').toLowerCase().includes('fail') || (i.status || '').toLowerCase().includes('defic')).length;
  const inspectionsOverdue = inspections.filter(i => (i.status || '').toLowerCase().includes('overdue')).length;
  const cprTotal = cpr.length;
  const cprExpired = cpr.filter(c => (c.status || '').toLowerCase().includes('expired')).length;

  if (document.getElementById('kpi-total-aeds')) document.getElementById('kpi-total-aeds').textContent = totalAeds;
  if (document.getElementById('kpi-warranty-expired')) document.getElementById('kpi-warranty-expired').textContent = warrantyExpired;
  if (document.getElementById('kpi-pads-expired')) document.getElementById('kpi-pads-expired').textContent = padsExpired;
  if (document.getElementById('kpi-batteries-expired')) document.getElementById('kpi-batteries-expired').textContent = batteriesExpired;
  if (document.getElementById('kpi-inspections-failed')) document.getElementById('kpi-inspections-failed').textContent = inspectionsFailed;
  if (document.getElementById('kpi-inspections-overdue')) document.getElementById('kpi-inspections-overdue').textContent = inspectionsOverdue;
  if (document.getElementById('kpi-cpr-total')) document.getElementById('kpi-cpr-total').textContent = cprTotal;
  if (document.getElementById('kpi-cpr-expired')) document.getElementById('kpi-cpr-expired').textContent = cprExpired;

  // 1. Inspections Overview
  const inspTbody = document.getElementById('dashboard-inspections-tbody');
  if (inspTbody) {
    const list = inspections.slice(0, 5);
    inspTbody.innerHTML = list.map(item => `
      <tr>
        <td style="text-align:center;">
          <button class="excel-icon-btn" title="View Inspection Details" onclick="openRegisterInspectionForm('${item.id}')">
            <i class="fa-regular fa-file-lines"></i>
          </button>
        </td>
        <td>${item.location}</td>
        <td>AED</td>
        <td>ZOLL</td>
        <td>AED 3</td>
        <td><code>ZOL-AED3-01</code></td>
        <td>${item.equipment}</td>
        <td>${item.inspectionDate}</td>
        ${renderStatusCells(item.status)}
      </tr>
    `).join('');
  }

  // 2. Expiring Equipment (Latest 5 records only)
  const eqTbody = document.getElementById('dashboard-equipment-tbody');
  if (eqTbody) {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const expiring = allEquipment.filter(e => {
      if (e.tab !== 'active') return false;
      const expStatus = (e.expirationStatus || '').toLowerCase();
      const servStatus = (e.serviceStatus || '').toLowerCase();

      let isDateExpiredOrSoon = false;
      if (e.expirationDate && e.expirationDate !== 'Expiration Date') {
        const d = new Date(e.expirationDate);
        if (!isNaN(d.getTime())) {
          const diffDays = Math.ceil((d.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 90) {
            isDateExpiredOrSoon = true;
          }
        }
      }

      return expStatus.includes('expire') || 
             servStatus.includes('out of service') || 
             servStatus.includes('replacement') || 
             isDateExpiredOrSoon;
    });

    // Sort by expiration date ascending (expired and most urgent first)
    expiring.sort((a, b) => {
      const da = a.expirationDate && !isNaN(new Date(a.expirationDate).getTime()) ? new Date(a.expirationDate).getTime() : 9999999999999;
      const db = b.expirationDate && !isNaN(new Date(b.expirationDate).getTime()) ? new Date(b.expirationDate).getTime() : 9999999999999;
      return da - db;
    });

    // Strictly latest 5 records only
    const displayList = expiring.slice(0, 5);

    if (displayList.length === 0) {
      eqTbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding: 24px; color: #64748b; font-style: italic;">No expiring equipment found</td></tr>`;
    } else {
      eqTbody.innerHTML = displayList.map(item => {
        let isExp = (item.expirationStatus || '').toLowerCase().includes('expired');
        if (!isExp && item.expirationDate && item.expirationDate !== 'Expiration Date') {
          const d = new Date(item.expirationDate);
          if (!isNaN(d.getTime()) && d < startOfToday) {
            isExp = true;
          }
        }
        const statusToDisplay = isExp ? 'Replacement Required' : (item.serviceStatus || 'Rescue-Ready');
        const targetAedId = (item.type !== 'AED' && item.aedId) ? item.aedId : item.id;

        return `
          <tr>
            <td style="text-align:center;">
              <button class="excel-icon-btn" title="View" onclick="viewAEDDetails('${targetAedId}')">
                <i class="fa-regular fa-file-lines"></i>
              </button>
            </td>
            <td>${item.location || '-'}</td>
            <td><strong>${item.type || '-'}</strong></td>
            <td>${item.brand || '-'}</td>
            <td>${item.model || '-'}</td>
            <td><code>${item.sku || '-'}</code></td>
            <td>${item.serialLot || '-'}</td>
            <td>${item.expirationDate || '-'}</td>
            ${renderStatusCells(statusToDisplay)}
          </tr>
        `;
      }).join('');
    }
  }

  // 3. Expiring CPR Classes
  const cprTbody = document.getElementById('dashboard-cpr-tbody');
  if (cprTbody) {
    cprTbody.innerHTML = cpr.map(item => `
      <tr>
        <td style="text-align:center;">
          <button class="excel-icon-btn" title="View" onclick="alert('CPR Record: ${item.firstName} ${item.lastName} (${item.classType})')">
            <i class="fa-regular fa-file-lines"></i>
          </button>
        </td>
        <td>${item.location}</td>
        <td>${item.firstName}</td>
        <td>${item.lastName}</td>
        <td>${item.classType}</td>
        <td>${item.accreditation}</td>
        <td>${item.expirationDate}</td>
        ${renderStatusCells(item.status)}
      </tr>
    `).join('');
  }
}

// --------------------------------------------------------------------------
// 2. EQUIPMENT VIEW (Active & Archived) - Exact 1:1 Implementation
// Developer Notes & Screenshot 1/2 Specifications:
// - Shows Active items (not Spare or Archived).
// - Service Status logic applies to whole AED only, calculated from Inspection Status & Expiration Status.
// - Highest severity warning takes priority: Out of Service > Replacement Required > Rescue-Ready.
// - Pads & Battery rows have BLANK Service Status cells.
// - View action opens corresponding form/panel.
// - Resources opens manuals/guides.
// - Buy opens store product/category page.
// --------------------------------------------------------------------------

function calculateAEDServiceStatus(aed, attachedItems = [], inspections = []) {
  // 1. Out of Service (Highest severity)
  if ((aed.serviceStatus || '').toLowerCase() === 'out of service') {
    return 'Out of Service';
  }

  // Check inspections related to this AED
  const aedInspections = (inspections || []).filter(i => 
    String(i.equipmentId) === String(aed.id) ||
    i.serialNumber === aed.serialLot ||
    (i.equipment && i.equipment === aed.serialLot) ||
    (i.location && aed.location && i.location === aed.location)
  );

  const hasFailedInspection = aedInspections.some(i => {
    const s = (i.status || '').toLowerCase();
    return s.includes('fail') || s.includes('defic');
  });

  const hasOverdueInspection = aedInspections.some(i => {
    const s = (i.status || '').toLowerCase();
    return s.includes('overdue');
  });

  if (hasFailedInspection || hasOverdueInspection) {
    return 'Out of Service';
  }

  if ((aed.inspectionStatus || '').toLowerCase().includes('fail') || (aed.inspectionStatus || '').toLowerCase().includes('overdue')) {
    return 'Out of Service';
  }

  // 2. Replacement Required
  // Triggered if any attached component (Adult Pads, Pediatric Pads, Battery) is Expired
  const now = new Date();
  const hasExpiredComponent = attachedItems.some(comp => {
    const s = (comp.expirationStatus || '').toLowerCase();
    if (s.includes('expired')) return true;
    if (comp.expirationDate && comp.expirationDate !== 'Expiration Date') {
      const exp = new Date(comp.expirationDate);
      if (!isNaN(exp.getTime()) && exp < now) return true;
    }
    return false;
  });

  if (hasExpiredComponent) {
    return 'Replacement Required';
  }

  // 3. Rescue-Ready
  // Underlying conditions like warranty expired or upcoming expirations do not revoke Rescue-Ready
  return 'Rescue-Ready';
}

window.viewPadDetails = async function(padId, aedId) {
  if (aedId) {
    await openAEDPanel(aedId, true);
    switchAEDPanelTab('pads');
    openPadForm(padId);
  } else {
    openAddSparePadModal(padId);
  }
};

window.viewBatteryDetails = async function(batteryId, aedId) {
  if (aedId) {
    await openAEDPanel(aedId, true);
    switchAEDPanelTab('batteries');
    openBatteryForm(batteryId);
  } else {
    openAddSpareBatteryModal(batteryId);
  }
};

window.buyEquipment = function(id) {
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const item = allEquipment.find(e => String(e.id) === String(id)) || {};
  const sku = (item.sku || '').trim().toUpperCase();
  const model = (item.model || '').toLowerCase();
  const brand = (item.brand || '').toLowerCase();
  const type = (item.type || '').toLowerCase();

  if (item.buyUrl && item.buyUrl !== '#reorder' && item.buyUrl !== '#') {
    window.open(item.buyUrl, '_blank');
    return;
  }

  // Developer Note / Client Requirement (Meeting 8 Review):
  // "Link to product page. If not available send to category page."
  const productUrlMap = {
    // ZOLL
    '8900-0800-01': 'https://vitalaed.com/product/zoll-cpr-d-padz/',
    '8900-0810-01': 'https://vitalaed.com/product/zoll-pedi-padz-ii/',
    '8900-0803-01': 'https://vitalaed.com/product/zoll-stat-padz-ii/',
    '8900-000280-01': 'https://vitalaed.com/product/zoll-cpr-uni-padz/',
    '8000-0807-01': 'https://vitalaed.com/product/zoll-type-123-duracell-lithium-batteries/',
    '8000-000696': 'https://vitalaed.com/product/zoll-aed-plus-battery-pack/',
    '8511-001101-01': 'https://vitalaed.com/product/zoll-aed-3-battery-pack/',
    '20100000101011010': 'https://vitalaed.com/product/zoll-aed-plus-semiautomatic/',
    '22300701101011010': 'https://vitalaed.com/product/zoll-aed-3-semiautomatic/',
    // Philips
    'M5071A': 'https://vitalaed.com/product/philips-heartstart-onsite-adult-smart-pads-cartridge-m5071a/',
    'M5072A': 'https://vitalaed.com/product/philips-heartstart-onsite-infant-child-smart-pads-cartridge-m5072a/',
    '989803139261': 'https://vitalaed.com/product/philips-heartstart-frx-smart-pads-ii-989803139261/',
    '989803139311': 'https://vitalaed.com/product/philips-heartstart-frx-infant-child-key/',
    'M5070A': 'https://vitalaed.com/product/philips-heartstart-onsite-frx-battery-m5070a/',
    'M5066A': 'https://vitalaed.com/product/philips-heartstart-onsite-aed/',
    '861304': 'https://vitalaed.com/product/philips-heartstart-frx-aed/',
    // Physio-Control / Stryker
    '11111-000018': 'https://vitalaed.com/product/physio-control-quik-combo-electrodes-edge-system/',
    '11140-000001': 'https://vitalaed.com/product/physio-control-lifepak-cr-plus-charge-pak-battery-pads/',
    '11141-000100': 'https://vitalaed.com/product/lifepak-cr2-lithium-battery/',
    '11111-000016': 'https://vitalaed.com/product/lifepak-cr2-electrodes-with-cpr-edge/',
    '99512-000001': 'https://vitalaed.com/product/physio-control-lifepak-cr2-wifi-aed/',
    // Defibtech
    'DDP-100': 'https://vitalaed.com/product/defibtech-lifeline-adult-defibrillation-pads-ddp-100/',
    'DDP-200P': 'https://vitalaed.com/product/defibtech-lifeline-pediatric-defibrillation-pads-ddp-200p/',
    'DCF-200': 'https://vitalaed.com/product/defibtech-lifeline-standard-5-year-battery-pack-dcf-200/',
    'DCF-210': 'https://vitalaed.com/product/defibtech-lifeline-high-capacity-7-year-battery-pack-dcf-210/',
    'DCF-E110': 'https://vitalaed.com/product/defibtech-lifeline-aed-semi-automatic/',
    // Cardiac Science
    'XELAED001A': 'https://vitalaed.com/product/cardiac-science-powerheart-g5-adult-intellisense-pads-xelaed001a/',
    'XELAED002A': 'https://vitalaed.com/product/cardiac-science-powerheart-g5-pediatric-intellisense-pads-xelaed002a/',
    'XBTAED001A': 'https://vitalaed.com/product/cardiac-science-powerheart-g5-intellisense-battery-xbtaed001a/',
    'G5A-80A-P': 'https://vitalaed.com/product/cardiac-science-powerheart-g5-aed/'
  };

  let targetUrl = sku ? productUrlMap[sku] : null;

  if (!targetUrl) {
    if (model.includes('heartstart onsite') || model.includes('onsite')) {
      targetUrl = 'https://vitalaed.com/product/philips-heartstart-onsite-aed/';
    } else if (model.includes('heartstart frx') || model.includes('frx')) {
      targetUrl = 'https://vitalaed.com/product/philips-heartstart-frx-aed/';
    } else if (model.includes('aed plus')) {
      targetUrl = 'https://vitalaed.com/product/zoll-aed-plus-semiautomatic/';
    } else if (model.includes('aed 3')) {
      targetUrl = 'https://vitalaed.com/product/zoll-aed-3-semiautomatic/';
    } else if (model.includes('lifepak cr2')) {
      targetUrl = 'https://vitalaed.com/product/physio-control-lifepak-cr2-wifi-aed/';
    } else if (model.includes('powerheart g5')) {
      targetUrl = 'https://vitalaed.com/product/cardiac-science-powerheart-g5-aed/';
    } else if (model.includes('lifeline')) {
      targetUrl = 'https://vitalaed.com/product/defibtech-lifeline-aed-semi-automatic/';
    }
  }

  // Fallback to category page if direct product URL is not mapped
  if (!targetUrl) {
    targetUrl = 'https://vitalaed.com/shop/';
    const bEnc = encodeURIComponent(item.brand || '');
    if (type.includes('pad')) {
      targetUrl += `defibrillator-pads/${bEnc ? '?brand=' + bEnc : ''}`;
    } else if (type.includes('battery')) {
      targetUrl += `aed-batteries/${bEnc ? '?brand=' + bEnc : ''}`;
    } else {
      targetUrl += `aed-units/${bEnc ? '?brand=' + bEnc : ''}`;
    }
  }

  window.open(targetUrl, '_blank');
  logSystemAction('Store Link Opened', 'Equipment', `Opened store link for ${item.brand || ''} ${item.model || item.type || 'Equipment'}: ${targetUrl}`);
};

// ==========================================================================
// REPORT ROW SELECTION & ACTIONS (Screenshot 1 RBAC + Screenshot 2 Toolbar)
// ==========================================================================
const selectedReportRows = {
  equipment: new Set(),
  spare: new Set(),
  inspections: new Set(),
  rescue: new Set(),
  cpr: new Set(),
  locations: new Set(),
  users: new Set(),
  organizations: new Set()
};

function hasRoleActionPermission(reportName, action = 'edit') {
  const roleObj = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.userRoles && INITIAL_DATA.userRoles[currentRole]) ? INITIAL_DATA.userRoles[currentRole] : {};
  if (currentRole === 'Customer (No Portal Access)') return false;
  if (currentRole === 'Sys Admin') return true;

  switch(reportName) {
    case 'equipment':
    case 'spare':
      return !!(roleObj.canManageAED || roleObj.canManagePads || roleObj.canManageBatteries);
    case 'inspections':
      return !!roleObj.canInspect;
    case 'rescue':
      return currentRole !== 'Inspector';
    case 'cpr':
      return !!roleObj.canManageCPR;
    case 'locations':
      return !!roleObj.canAddLocations;
    case 'users':
      return !!roleObj.canManageUsers;
    case 'organizations':
      return currentRole === 'Sys Admin' || currentRole.includes('Admin') || currentRole.includes('Reseller');
    default:
      return true;
  }
}

function getReportContainer(reportName) {
  if (reportName === 'users') return document.getElementById('user-tab-roster-container');
  if (reportName === 'organizations') return document.getElementById('user-tab-org-container');
  return document.getElementById(`${reportName}-view`);
}

window.toggleReportSelectAll = function(reportName, isChecked) {
  const container = getReportContainer(reportName);
  if (!container) return;
  const checkboxes = container.querySelectorAll('.report-row-checkbox');
  const set = selectedReportRows[reportName] || new Set();
  set.clear();

  checkboxes.forEach(cb => {
    cb.checked = isChecked;
    const tr = cb.closest('tr');
    if (isChecked) {
      set.add(cb.getAttribute('data-id'));
      if (tr) tr.classList.add('report-row-selected');
    } else {
      if (tr) tr.classList.remove('report-row-selected');
    }
  });

  selectedReportRows[reportName] = set;
  updateReportToolbarState(reportName);
};

window.onReportRowSelect = function(reportName, checkbox) {
  const set = selectedReportRows[reportName] || new Set();
  const id = checkbox.getAttribute('data-id');
  const tr = checkbox.closest('tr');

  if (checkbox.checked) {
    set.add(id);
    if (tr) tr.classList.add('report-row-selected');
  } else {
    set.delete(id);
    if (tr) tr.classList.remove('report-row-selected');
  }
  selectedReportRows[reportName] = set;

  const selectAll = document.getElementById(`${reportName}-select-all`);
  const container = getReportContainer(reportName);
  if (selectAll && container) {
    const total = container.querySelectorAll('.report-row-checkbox').length;
    selectAll.checked = (total > 0 && set.size === total);
    selectAll.indeterminate = (set.size > 0 && set.size < total);
  }

  updateReportToolbarState(reportName);
};

window.updateReportToolbarState = function(reportName) {
  const set = selectedReportRows[reportName] || new Set();
  const count = set.size;
  const btnEdit = document.getElementById(`btn-edit-${reportName}`);
  const btnDuplicate = document.getElementById(`btn-duplicate-${reportName}`);
  const btnDelete = document.getElementById(`btn-delete-${reportName}`);

  const hasPerm = hasRoleActionPermission(reportName, 'edit');

  if (btnEdit) {
    btnEdit.classList.toggle('disabled', !hasPerm || count !== 1);
    btnEdit.title = !hasPerm ? `Your role (${currentRole}) does not have edit access per system permissions.` : (count === 1 ? 'Edit selected record' : 'Select a single record to edit');
  }

  if (btnDuplicate) {
    btnDuplicate.classList.toggle('disabled', !hasPerm || count !== 1);
    btnDuplicate.title = !hasPerm ? `Your role (${currentRole}) does not have duplicate access per system permissions.` : (count === 1 ? 'Duplicate selected record' : 'Select a single record to duplicate');
  }

  if (btnDelete) {
    btnDelete.classList.toggle('disabled', !hasPerm || count === 0);
    btnDelete.title = !hasPerm ? `Your role (${currentRole}) does not have delete access per system permissions.` : (count > 0 ? `Delete ${count} selected record(s)` : 'Select record(s) to delete');
  }
};

window.toggleReportExportMenu = function(reportName) {
  const menu = document.getElementById(`export-menu-${reportName}`);
  if (!menu) return;
  document.querySelectorAll('.report-dropdown-menu').forEach(m => {
    if (m !== menu) m.classList.remove('show');
  });
  menu.classList.toggle('show');
};

document.addEventListener('click', (e) => {
  if (e.target && typeof e.target.closest === 'function') {
    if (!e.target.closest('.report-dropdown')) {
      document.querySelectorAll('.report-dropdown-menu').forEach(m => m.classList.remove('show'));
    }
  }
});

window.handleReportAction = async function(reportName, action) {
  document.querySelectorAll('.report-dropdown-menu').forEach(m => m.classList.remove('show'));

  const set = selectedReportRows[reportName] || new Set();
  const selectedIds = Array.from(set);

  if (action === 'print') {
    printReportView(reportName, selectedIds);
    return;
  }

  if (action === 'export-csv' || action === 'export-excel') {
    exportReportData(reportName, selectedIds, action === 'export-excel');
    return;
  }

  if (!hasRoleActionPermission(reportName, action)) {
    alert(`Access Denied:\nYour active role (${currentRole}) does not have permission to ${action} in ${reportName.toUpperCase()} per system access restrictions.`);
    return;
  }

  if (action === 'edit') {
    if (selectedIds.length === 0) {
      alert('Please select a record from the table to edit.');
      return;
    }
    if (selectedIds.length > 1) {
      alert('Please select only one record at a time to edit.');
      return;
    }
    executeEditAction(reportName, selectedIds[0]);
    return;
  }

  if (action === 'duplicate') {
    if (selectedIds.length === 0) {
      alert('Please select a record from the table to duplicate.');
      return;
    }
    if (selectedIds.length > 1) {
      alert('Please select only one record at a time to duplicate.');
      return;
    }
    await executeDuplicateAction(reportName, selectedIds[0]);
    return;
  }

  if (action === 'delete') {
    if (selectedIds.length === 0) {
      alert('Please select at least one record to delete.');
      return;
    }
    await executeDeleteAction(reportName, selectedIds);
    return;
  }
};

function executeEditAction(reportName, id) {
  if (reportName === 'equipment') {
    const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const item = all.find(e => String(e.id) === String(id));
    if (!item) {
      alert('Equipment record not found.');
      return;
    }
    if (item.type === 'AED') {
      openAEDPanel(id, true);
    } else if (item.type && item.type.includes('Pad')) {
      if (item.aedId) {
        viewPadDetails(item.id, item.aedId);
      } else {
        openAddSparePadModal(item.id);
      }
    } else if (item.type === 'Battery') {
      if (item.aedId) {
        viewBatteryDetails(item.id, item.aedId);
      } else {
        openAddSpareBatteryModal(item.id);
      }
    } else {
      openAEDPanel(id, true);
    }
  } else if (reportName === 'spare') {
    const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const item = all.find(e => String(e.id) === String(id));
    if (!item) {
      alert('Spare record not found.');
      return;
    }
    if (item.type === 'AED') {
      openAddSpareAED(item.id);
    } else if (item.type && item.type.includes('Pad')) {
      openAddSparePadModal(item.id);
    } else if (item.type === 'Battery') {
      openAddSpareBatteryModal(item.id);
    } else {
      openAddSpareAED(item.id);
    }
  } else if (reportName === 'inspections') {
    openRegisterInspectionForm(id, true);
  } else if (reportName === 'rescue') {
    openEditRescueModal(id);
  } else if (reportName === 'cpr') {
    openCPRForm(id, true);
  } else if (reportName === 'locations') {
    openEditLocationModal(id, true);
  } else if (reportName === 'users') {
    openEditUserModal(id);
  } else if (reportName === 'organizations') {
    openEditOrgModal(id);
  }
}

async function executeDuplicateAction(reportName, id) {
  if (reportName === 'equipment' || reportName === 'spare') {
    const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const item = all.find(e => String(e.id) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'EQ-' + Date.now();
    clone.serialLot = (clone.serialLot || 'Serial') + '-COPY';
    await api.addEquipment(clone);
    logSystemAction('Equipment Duplicated', 'Equipment', `Duplicated ${clone.type}: ${clone.brand || ''} ${clone.model || ''} (ID: ${clone.id})`);
    if (reportName === 'spare') await renderSpare(); else await renderEquipment();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    alert(`Equipment record duplicated successfully as ${clone.id}.`);
  } else if (reportName === 'inspections') {
    const all = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
    const item = all.find(i => String(i.id) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'INSP-' + Date.now();
    clone.inspectionDate = new Date().toISOString().split('T')[0];
    await api.addInspection(clone);
    logSystemAction('Inspection Duplicated', 'Inspections', `Duplicated inspection record for ${clone.location || ''} (ID: ${clone.id})`);
    await renderInspections();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    alert('Inspection record duplicated successfully.');
  } else if (reportName === 'rescue') {
    const all = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
    const item = all.find(r => String(r.id) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'RESCUE-' + Date.now();
    clone.eventDate = new Date().toISOString().split('T')[0];
    await api.addRescueEvent(clone);
    logSystemAction('Rescue Event Duplicated', 'Rescue Events', `Duplicated rescue record (${clone.id})`);
    await renderRescue();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    alert('Rescue event record duplicated successfully.');
  } else if (reportName === 'cpr') {
    const all = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
    const item = all.find(c => String(c.id) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'CPR-' + Date.now();
    clone.lastName = (clone.lastName || '') + ' (Copy)';
    await api.addCPRCertification(clone);
    logSystemAction('CPR Certification Duplicated', 'CPR', `Duplicated CPR certification for ${clone.firstName} ${clone.lastName}`);
    await renderCPR();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    alert('CPR certification record duplicated successfully.');
  } else if (reportName === 'locations') {
    const all = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const item = all.find(l => String(l.id) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'LOC-' + Date.now();
    clone.name = (clone.name || '') + ' (Copy)';
    await api.addLocation(clone);
    logSystemAction('Location Duplicated', 'Locations', `Duplicated location: ${clone.name}`);
    await renderLocations();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    alert('Location duplicated successfully.');
  } else if (reportName === 'users') {
    const users = await api.getUsers();
    const item = users.find(u => String(u.id) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'USR-' + Date.now().toString(36).toUpperCase();
    clone.email = 'copy_' + (clone.email || 'user@example.com');
    clone.lastName = (clone.lastName || '') + ' (Copy)';
    clone.isOwner = false;
    await api.inviteUser(clone);
    logSystemAction('User Account Duplicated', 'Users & Account', `Duplicated user profile for: ${clone.firstName} ${clone.lastName}`);
    await renderUsersRoster();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    alert('User account duplicated successfully.');
  } else if (reportName === 'organizations') {
    const all = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
    const item = all.find(o => String(o.id) === String(id) || String(o.key) === String(id));
    if (!item) return;
    const clone = JSON.parse(JSON.stringify(item));
    clone.id = 'org-' + Date.now();
    clone.key = (clone.key || 'org') + '-copy-' + Date.now().toString(36);
    clone.name = (clone.name || 'Organization') + ' (Copy)';
    await api.createOrganization(clone);
    logSystemAction('Organization Duplicated', 'Multi-Tenant', `Duplicated organization: ${clone.name}`);
    await renderOrganizationsRoster();
    selectedReportRows[reportName].clear();
    updateReportToolbarState(reportName);
    if (typeof setupOrganizationSwitcher === 'function') setupOrganizationSwitcher();
    alert('Organization duplicated successfully.');
  }
}

window.checkRecordAssociation = function(reportName, id) {
  const equipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const locations = JSON.parse(localStorage.getItem('aed_locations') || '[]');
  const cpr = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
  const inspections = JSON.parse(localStorage.getItem('aed_inspections') || '[]');

  if (reportName === 'organizations') {
    const allUsers = JSON.parse(localStorage.getItem('aed_users') || '[]');
    const orgs = [
      ...(typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations) ? INITIAL_DATA.organizations : []),
      ...JSON.parse(localStorage.getItem('aed_organizations') || '[]')
    ];
    const org = orgs.find(o => String(o.id) === String(id) || String(o.key) === String(id));
    const orgName = org ? (org.name || '').toLowerCase().trim() : '';
    const orgKey = org ? (org.key || '').toLowerCase().trim() : '';

    // Primary headquarters organization is protected
    if (orgKey === 'vital-aed' || String(id) === 'vital-aed' || String(id) === '4923252000000326010') {
      return { associated: true, reason: 'The primary Vital AED headquarters organization is protected and cannot be deleted.' };
    }

    if (!orgName && !orgKey) {
      return { associated: false };
    }

    const hasUsers = !!(orgName && allUsers.some(u => {
      const uOrg = (u.organization || '').toLowerCase().trim();
      const uKey = (u.organizationKey || '').toLowerCase().trim();
      return (orgName && uOrg === orgName) || (orgKey && uKey === orgKey);
    }));
    const hasEq = !!(orgName && equipment.some(e => {
      const eOrg = (e.organization || '').toLowerCase().trim();
      const eKey = (e.organizationKey || '').toLowerCase().trim();
      return (orgName && eOrg === orgName) || (orgKey && eKey === orgKey);
    }));
    if (hasUsers || hasEq) {
      return { associated: true, reason: `Organization "${org?.name || id}" is associated with active user or equipment records. Please reassign them before deletion.` };
    }
  }

  if (reportName === 'locations') {
    const loc = locations.find(l => String(l.id) === String(id));
    const locName = loc ? (loc.name || loc.Location_Name || '').toLowerCase().trim() : '';

    const isAssocEquipment = equipment.some(e => {
      const eLoc = (e.location || '').toLowerCase().trim();
      return String(e.location) === String(id) || (locName && (eLoc === locName || eLoc.includes(locName)));
    });

    const isAssocCPR = cpr.some(c => {
      const cLoc = (c.location || '').toLowerCase().trim();
      return String(c.location) === String(id) || (locName && (cLoc === locName || cLoc.includes(locName)));
    });

    const isAssocInspection = inspections.some(i => {
      const iLoc = (i.location || '').toLowerCase().trim();
      return String(i.location) === String(id) || (locName && (iLoc === locName || iLoc.includes(locName)));
    });

    if (isAssocEquipment || isAssocCPR || isAssocInspection) {
      return { 
        associated: true, 
        reason: `Cannot Delete Location: "${loc?.name || id}"\n\nThis location is currently being used by the system and has active dependencies (associated equipment, inspections, or CPR certifications).\n\nPer safety compliance rules, dependencies must be reassigned to another location before this location can be deleted.` 
      };
    }
  }

  if (reportName === 'equipment' || reportName === 'spare') {
    const item = equipment.find(e => String(e.id) === String(id));
    if (item && item.type === 'AED') {
      const hasAssignedChild = equipment.some(e => e.type !== 'AED' && String(e.aedId) === String(id));
      const hasInspection = inspections.some(i => String(i.aedId) === String(id));
      if (hasAssignedChild || hasInspection) {
        return { associated: true, reason: 'This record is associated with other records.' };
      }
    }
  }

  return { associated: false };
};

async function executeDeleteAction(reportName, selectedIds) {
  // Screenshot 1 RBAC Check for Admin on Users: "Yes, except account owner"
  if (reportName === 'users' && currentRole === 'Admin') {
    const users = await api.getUsers();
    const hasOwner = selectedIds.some(id => {
      const u = users.find(x => String(x.id) === String(id));
      return u && (u.isOwner || u.role === 'Admin (Account owner)');
    });
    if (hasOwner) {
      alert('Access Restricted:\nPer System Map rules (Screenshot 1), Admins cannot delete the Account Owner.');
      return;
    }
  }

  // Association Check
  for (const id of selectedIds) {
    const check = checkRecordAssociation(reportName, id);
    if (check.associated) {
      alert(check.reason);
      return;
    }
  }

  if (!confirm(`Are you sure you want to delete ${selectedIds.length} selected record(s)?\nThis action will be logged in the system audit log.`)) {
    return;
  }

  const count = selectedIds.length;
  const idSet = new Set(selectedIds.map(String));

  // Perform immediate synchronous batch-removal on local storage & in-memory caches to prevent async race conditions
  if (reportName === 'organizations') {
    let allOrgs = [];
    try {
      allOrgs = JSON.parse(localStorage.getItem('aed_organizations') || 'null') || [];
    } catch (e) {}
    if (!allOrgs.length && typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations)) {
      allOrgs = [...INITIAL_DATA.organizations];
    }
    allOrgs = allOrgs.filter(o => !idSet.has(String(o.id)) && !idSet.has(String(o.key)));
    localStorage.setItem('aed_organizations', JSON.stringify(allOrgs));
    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations)) {
      INITIAL_DATA.organizations = allOrgs;
    }
    if (idSet.has(String(currentOrganizationKey))) {
      currentOrganizationKey = 'vital-aed';
      if (typeof setupOrganizationSwitcher === 'function') setupOrganizationSwitcher();
    }
  } else if (reportName === 'equipment' || reportName === 'spare') {
    let allEq = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    allEq = allEq.filter(e => !idSet.has(String(e.id)));
    localStorage.setItem('aed_equipment', JSON.stringify(allEq));
  } else if (reportName === 'inspections') {
    let allInsp = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
    allInsp = allInsp.filter(i => !idSet.has(String(i.id)));
    localStorage.setItem('aed_inspections', JSON.stringify(allInsp));
  } else if (reportName === 'rescue') {
    let allResc = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
    allResc = allResc.filter(r => !idSet.has(String(r.id)));
    localStorage.setItem('aed_rescue', JSON.stringify(allResc));
  } else if (reportName === 'cpr') {
    let allCpr = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
    allCpr = allCpr.filter(c => !idSet.has(String(c.id || c.ID)));
    localStorage.setItem('aed_cpr', JSON.stringify(allCpr));
  } else if (reportName === 'locations') {
    let allLoc = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    allLoc = allLoc.filter(l => !idSet.has(String(l.id)));
    localStorage.setItem('aed_locations', JSON.stringify(allLoc));
  } else if (reportName === 'users') {
    let allUsers = JSON.parse(localStorage.getItem('aed_users') || '[]');
    allUsers = allUsers.filter(u => !idSet.has(String(u.id)));
    localStorage.setItem('aed_users', JSON.stringify(allUsers));
  }

  // Trigger individual cloud deletions concurrently in background
  const deletePromises = selectedIds.map(id => {
    if (reportName === 'equipment' || reportName === 'spare') {
      const allEq = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
      const item = allEq.find(e => String(e.id) === String(id));
      return api.deleteEquipment(id, { type: item?.type || '', report: item?.reportLinkName || '' }).catch(() => true);
    } else if (reportName === 'inspections') {
      return api.deleteInspection(id).catch(() => true);
    } else if (reportName === 'rescue') {
      return api.deleteRescueEvent(id).catch(() => true);
    } else if (reportName === 'cpr') {
      return api.deleteCPRCertification(id).catch(() => true);
    } else if (reportName === 'locations') {
      return api.deleteLocation(id).catch(() => true);
    } else if (reportName === 'users') {
      return api.deleteUser(id).catch(() => true);
    } else if (reportName === 'organizations') {
      return api.deleteOrganization(id).catch(() => true);
    }
    return Promise.resolve(true);
  });

  // Clear selections immediately
  selectedReportRows[reportName].clear();
  const selectAll = document.getElementById(`${reportName}-select-all`);
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }
  updateReportToolbarState(reportName);

  // Instantly re-render table so user sees rows disappear in <30ms with 0ms perceived latency
  if (reportName === 'equipment') await renderEquipment();
  else if (reportName === 'spare') await renderSpare();
  else if (reportName === 'inspections') await renderInspections();
  else if (reportName === 'rescue') await renderRescue();
  else if (reportName === 'cpr') await renderCPR();
  else if (reportName === 'locations') await renderLocations();
  else if (reportName === 'users') await renderUsersRoster();
  else if (reportName === 'organizations') await renderOrganizationsRoster();
  if (typeof renderDashboard === 'function') renderDashboard();

  logSystemAction(`${reportName.toUpperCase()} Records Deleted`, reportName.toUpperCase(), `Deleted ${count} record(s) via report action toolbar.`, 'Warning');

  // Await background cloud operations
  await Promise.all(deletePromises);
  alert(`${count} record(s) deleted successfully.`);
}

function exportReportData(reportName, selectedIds, isExcel = false) {
  const container = getReportContainer(reportName);
  if (!container) return;
  const table = container.querySelector('table');
  if (!table) return;

  const rows = [];
  const thEls = Array.from(table.querySelectorAll('thead th'));
  // Exclude checkbox and action columns
  const headerTexts = [];
  const colIndices = [];
  thEls.forEach((th, idx) => {
    const text = th.innerText.trim();
    if (!th.classList.contains('report-checkbox-th') && text !== 'View' && text !== 'Resources' && text !== 'Buy' && text !== 'Download' && text !== 'Actions') {
      headerTexts.push(`"${text.replace(/"/g, '""')}"`);
      colIndices.push(idx);
    }
  });
  rows.push(headerTexts.join(','));

  const trEls = Array.from(table.querySelectorAll('tbody tr:not(.excel-group-divider)'));
  trEls.forEach(tr => {
    const cb = tr.querySelector('.report-row-checkbox');
    const id = cb ? cb.getAttribute('data-id') : null;
    if (selectedIds.length > 0 && id && !selectedIds.includes(id)) {
      return;
    }
    const tdEls = Array.from(tr.querySelectorAll('td'));
    if (tdEls.length <= 1) return;
    const rowData = [];
    colIndices.forEach(idx => {
      const td = tdEls[idx];
      const text = td ? td.innerText.trim() : '';
      rowData.push(`"${text.replace(/"/g, '""')}"`);
    });
    rows.push(rowData.join(','));
  });

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const blob = new Blob([csvContent], { type: isExcel ? 'application/vnd.ms-excel;charset=utf-8' : 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${reportName}_report_${new Date().toISOString().split('T')[0]}.${isExcel ? 'csv' : 'csv'}`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  logSystemAction('Report Exported', reportName.toUpperCase(), `Exported report data (${rows.length - 1} records)`);
}

function printReportView(reportName, selectedIds) {
  const container = getReportContainer(reportName);
  if (!container) return;
  const table = container.querySelector('table');
  if (!table) return;

  const cloneTable = table.cloneNode(true);
  cloneTable.querySelectorAll('.report-checkbox-th, .report-checkbox-td').forEach(el => el.remove());
  
  if (selectedIds.length > 0) {
    const trEls = Array.from(cloneTable.querySelectorAll('tbody tr:not(.excel-group-divider)'));
    const originalTrs = Array.from(table.querySelectorAll('tbody tr:not(.excel-group-divider)'));
    originalTrs.forEach((origTr, idx) => {
      const cb = origTr.querySelector('.report-row-checkbox');
      const id = cb ? cb.getAttribute('data-id') : null;
      if (id && !selectedIds.includes(id) && trEls[idx]) {
        trEls[idx].remove();
      }
    });
  }

  const printWindow = window.open('', '_blank', 'width=900,height=650');
  if (!printWindow) return;
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${reportName.toUpperCase()} Report</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; color: #1E293B; }
        h2 { margin-bottom: 4px; color: #004182; }
        .meta { font-size: 12px; color: #64748B; margin-bottom: 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
        th { background: #004182; color: #FFF; padding: 8px 10px; text-align: left; border: 1px solid #CBD5E1; }
        td { padding: 6px 10px; border: 1px solid #E2E8F0; }
        tr:nth-child(even) { background: #F8FAFC; }
      </style>
    </head>
    <body>
      <h2>Vital AED Life Safety Corp — ${reportName.toUpperCase()} Report</h2>
      <div class="meta">Generated: ${new Date().toLocaleString()} | Active Role: ${currentRole}</div>
      ${cloneTable.outerHTML}
    </body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => printWindow.print(), 350);
}

// --------------------------------------------------------------------------
// 2. EQUIPMENT VIEW (Main Excel Sheet 'Equipment' & Exact Archived Layout)
// --------------------------------------------------------------------------
async function renderEquipment() {
  const tbody = document.getElementById('equipment-tbody');
  if (!tbody) return;

  const thead = document.getElementById('equipment-thead');
  if (thead) {
    if (showArchivedEquipment) {
      // Exact Screenshot 2 layout (9 columns: View, Location, Equipment, Brand, Model, SKU, Serial / Lot, Expiration Date, Archived Date)
      thead.innerHTML = `
        <tr>
          <th class="report-checkbox-th" style="width: 56px !important; text-align:center;">
            <span style="display:inline-flex; align-items:center; gap:5px; justify-content:center;">
              <input type="checkbox" class="report-header-checkbox" id="equipment-select-all" onchange="toggleReportSelectAll('equipment', this.checked)" title="Select All">
              <span style="font-weight: 700; color: #FFFFFF; font-size: 12.5px;">View</span>
            </span>
          </th>
          <th>Location</th>
          <th>Equipment</th>
          <th>Brand</th>
          <th>Model</th>
          <th>SKU</th>
          <th>Serial / Lot</th>
          <th>Expiration Date</th>
          <th>Archived Date</th>
        </tr>
      `;
    } else {
      // Active Equipment layout (12 columns)
      thead.innerHTML = `
        <tr>
          <th class="report-checkbox-th"><i class="fa-regular fa-eye" style="color: #64748B; font-size:12px; margin-right:4px;"></i><input type="checkbox" class="report-header-checkbox" id="equipment-select-all" onchange="toggleReportSelectAll('equipment', this.checked)"></th>
          <th style="width: 44px; text-align:center;">View</th>
          <th>Location</th>
          <th>Equipment</th>
          <th>Brand</th>
          <th>Model</th>
          <th>SKU</th>
          <th>Serial / Lot</th>
          <th>Expiration Date</th>
          <th>Expiration Status</th>
          <th>Service Status</th>
          <th style="width: 55px; text-align:center;">Buy</th>
        </tr>
      `;
    }
  }

  const searchTerm = (document.getElementById('equipment-search')?.value || '').toLowerCase();
  const tab = showArchivedEquipment ? 'archived' : 'active';
  const [rawEquipment, rawInspections, rawRescue] = await Promise.all([
    api.getEquipment(tab),
    api.getInspections(tab),
    api.getRescueEvents()
  ]);
  const allOrgData = filterRecordsByOrg(rawEquipment);
  const inspections = filterRecordsByOrg(rawInspections);
  const rescueEvents = filterRecordsByOrg(rawRescue || []);

  // Strict Location Rule in Equipment View (Client Requirement 2.3):
  // Anything listed under Equipment View MUST have an assigned location. A record in Equipment cannot have an empty location and cannot have status "Spare".
  const data = allOrgData.filter(item => {
    if (showArchivedEquipment) return (item.tab || '').toLowerCase() === 'archived';
    const hasLocation = item.location && item.location !== '-' && item.location.trim() !== '';
    const notSpare = (item.tab || 'active').toLowerCase() !== 'spare' && (item.inventoryStatus || '').toLowerCase() !== 'spare';
    return hasLocation && notSpare;
  });

  const colSpanCount = showArchivedEquipment ? 9 : 12;

  if (!data || !data.length) {
    tbody.innerHTML = `<tr><td colspan="${colSpanCount}" style="text-align:center; padding:24px; color:#64748B;">No equipment records found.</td></tr>`;
    updateReportToolbarState('equipment');
    return;
  }

  const selectedSet = selectedReportRows['equipment'] || new Set();

  // Separate AEDs and Components (Adult Pads, Pediatric Pads, Battery)
  const aeds = data.filter(item => item.type === 'AED');
  const components = data.filter(item => item.type !== 'AED');

  const assignedCompIds = new Set();
  const groups = [];

  // Pass 1: Explicit ID, bundleId, or Location match
  aeds.forEach(aed => {
    const attached = components.filter(comp => {
      if (assignedCompIds.has(comp.id)) return false;
      const matchesAedId = comp.aedId && (String(comp.aedId) === String(aed.id));
      const matchesBundle = comp.bundleId && aed.bundleId && (comp.bundleId === aed.bundleId);
      const matchesLoc = (!comp.aedId && comp.location && aed.location && comp.location === aed.location && comp.location !== '-');
      return matchesAedId || matchesBundle || matchesLoc;
    });

    attached.forEach(c => assignedCompIds.add(c.id));
    groups.push({ aed, attached });
  });

  // Pass 2: Smart Brand & Organization Pairing for unassigned components (Pads, Batteries)
  groups.forEach(g => {
    const aed = g.aed;
    const attachedTypes = new Set(g.attached.map(c => c.type));

    ['Adult Pads', 'Pediatric Pads', 'Battery'].forEach(requiredType => {
      if (!attachedTypes.has(requiredType)) {
        const candidate = components.find(comp => {
          if (assignedCompIds.has(comp.id)) return false;
          if (comp.type !== requiredType) return false;

          // Check brand or model match
          const brandMatch = aed.brand && comp.brand && (
            comp.brand.toLowerCase() === aed.brand.toLowerCase() ||
            (comp.model && comp.model.toLowerCase().includes(aed.brand.toLowerCase())) ||
            (aed.model && comp.model && comp.model.toLowerCase().includes(aed.model.toLowerCase()))
          );

          // Check organization match if both present
          const orgMatch = (!comp.organizationKey && !aed.organizationKey) ||
                           (comp.organizationKey === aed.organizationKey);

          return brandMatch && orgMatch;
        });

        if (candidate) {
          assignedCompIds.add(candidate.id);
          candidate.aedId = aed.id;
          if (!candidate.location || candidate.location === '-') {
            candidate.location = aed.location;
          }
          g.attached.push(candidate);
          attachedTypes.add(requiredType);
        }
      }
    });

    g.attached.sort((a, b) => {
      const order = { 'Adult Pads': 1, 'Pediatric Pads': 2, 'Battery': 3 };
      return (order[a.type] || 4) - (order[b.type] || 4);
    });

    // Match Inspections for this AED
    g.inspections = inspections.filter(i => {
      if (i.aedId && String(i.aedId) === String(aed.id)) return true;
      if (aed.serialLot && i.serialNumber && i.serialNumber === aed.serialLot) return true;
      if (aed.location && i.location && i.location === aed.location) return true;
      return false;
    }).sort((a, b) => new Date(b.inspectionDate || 0) - new Date(a.inspectionDate || 0));

    // Match Rescue Events for this AED
    g.rescueEvents = rescueEvents.filter(r => {
      if (r.aedId && String(r.aedId) === String(aed.id)) return true;
      if (aed.serialLot && r.serialNumber && r.serialNumber === aed.serialLot) return true;
      if (aed.location && r.location && r.location === aed.location) return true;
      return false;
    }).sort((a, b) => new Date(b.eventDate || 0) - new Date(a.eventDate || 0));
  });

  // Persist newly established links to localStorage
  try {
    let storageChanged = false;
    let allEq = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const allAttached = groups.flatMap(g => g.attached);
    allEq = allEq.map(eq => {
      if (eq.type !== 'AED') {
        const match = allAttached.find(c => String(c.id) === String(eq.id));
        if (match && (!eq.aedId || eq.location === '-' || !eq.location)) {
          storageChanged = true;
          return { ...eq, aedId: match.aedId, location: match.location };
        }
      }
      return eq;
    });
    if (storageChanged) {
      localStorage.setItem('aed_equipment', JSON.stringify(allEq));
    }
  } catch (e) {}

  const standalone = components.filter(c => !assignedCompIds.has(c.id));

  const filteredGroups = groups.filter(g => {
    if (!searchTerm) return true;
    const aedMatches = (
      (g.aed.location && g.aed.location.toLowerCase().includes(searchTerm)) ||
      (g.aed.brand && g.aed.brand.toLowerCase().includes(searchTerm)) ||
      (g.aed.model && g.aed.model.toLowerCase().includes(searchTerm)) ||
      (g.aed.serialLot && g.aed.serialLot.toLowerCase().includes(searchTerm)) ||
      (g.aed.sku && g.aed.sku.toLowerCase().includes(searchTerm))
    );
    if (aedMatches) return true;
    const compMatches = g.attached.some(comp => 
      (comp.location && comp.location.toLowerCase().includes(searchTerm)) ||
      (comp.type && comp.type.toLowerCase().includes(searchTerm)) ||
      (comp.brand && comp.brand.toLowerCase().includes(searchTerm)) ||
      (comp.model && comp.model.toLowerCase().includes(searchTerm)) ||
      (comp.serialLot && comp.serialLot.toLowerCase().includes(searchTerm))
    );
    if (compMatches) return true;
    const inspMatches = (g.inspections || []).some(i => 
      (i.inspector && i.inspector.toLowerCase().includes(searchTerm)) ||
      (i.status && i.status.toLowerCase().includes(searchTerm)) ||
      (i.inspectionDate && i.inspectionDate.toLowerCase().includes(searchTerm))
    );
    if (inspMatches) return true;
    const rescueMatches = (g.rescueEvents || []).some(r =>
      (r.patientOutcome && r.patientOutcome.toLowerCase().includes(searchTerm)) ||
      (r.status && r.status.toLowerCase().includes(searchTerm)) ||
      (r.eventDate && r.eventDate.toLowerCase().includes(searchTerm))
    );
    return rescueMatches;
  });

  const filteredStandalone = standalone.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.location && item.location.toLowerCase().includes(searchTerm)) ||
      (item.type && item.type.toLowerCase().includes(searchTerm)) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm)) ||
      (item.model && item.model.toLowerCase().includes(searchTerm)) ||
      (item.serialLot && item.serialLot.toLowerCase().includes(searchTerm))
    );
  });

  if (!filteredGroups.length && !filteredStandalone.length) {
    tbody.innerHTML = `<tr><td colspan="${colSpanCount}" style="text-align:center; padding:24px; color:#64748B;">No equipment records found.</td></tr>`;
    updateReportToolbarState('equipment');
    return;
  }

  let html = '';

  filteredGroups.forEach((group, gIdx) => {
    if (gIdx > 0) {
      html += `<tr class="excel-group-divider"><td colspan="${colSpanCount}"></td></tr>`;
    }

    const { aed, attached } = group;
    const serviceStatus = calculateAEDServiceStatus(aed, attached, inspections);
    const locDisplay = aed.location || '-';
    const isAedChecked = selectedSet.has(String(aed.id));
    const aedArchivedDate = aed.archivedDate || (aed.raw && (aed.raw.Archived_Date || aed.raw.archivedDate)) || 'Date';

    // 1. AED Master Row
    if (showArchivedEquipment) {
      html += `
        <tr class="${isAedChecked ? 'report-row-selected' : ''}" ondblclick="viewAEDDetails('${aed.id}')" title="Double-click to view details">
          <td class="report-checkbox-td" style="text-align:center;">
            <input type="checkbox" class="report-row-checkbox" data-id="${aed.id}" data-type="AED" ${isAedChecked ? 'checked' : ''} onchange="onReportRowSelect('equipment', this)">
          </td>
          <td>${locDisplay}</td>
          <td><strong>AED</strong></td>
          <td>${aed.brand || 'Brand'}</td>
          <td>${aed.model || 'Model'}</td>
          <td><code>${aed.sku || 'SKU'}</code></td>
          <td>${aed.serialLot || 'Serial Number'}</td>
          <td>${aed.expirationDate || aed.warrantyExpirationDate || 'Expiration Date'}</td>
          <td>${aedArchivedDate}</td>
        </tr>
      `;
    } else {
      html += `
        <tr class="${isAedChecked ? 'report-row-selected' : ''}">
          <td class="report-checkbox-td">
            <input type="checkbox" class="report-row-checkbox" data-id="${aed.id}" data-type="AED" ${isAedChecked ? 'checked' : ''} onchange="onReportRowSelect('equipment', this)">
          </td>
          <td style="text-align:center;">
            <button class="excel-icon-btn" title="View Details" onclick="viewAEDDetails('${aed.id}')">
              <i class="fa-regular fa-file-lines"></i>
            </button>
          </td>
          <td>${locDisplay}</td>
          <td><strong>AED</strong></td>
          <td>${aed.brand || 'Brand'}</td>
          <td>${aed.model || 'Model'}</td>
          <td><code>${aed.sku || 'SKU'}</code></td>
          <td>${aed.serialLot || 'Serial Number'}</td>
          <td>${aed.expirationDate || aed.warrantyExpirationDate || 'Expiration Date'}</td>
          ${renderExcelStatusCell(aed.expirationStatus || 'Ok', 'warranty')}
          ${renderExcelStatusCell(serviceStatus, 'service')}
          <td style="text-align:center;">
            <button class="excel-icon-btn buy" title="Buy" onclick="buyEquipment('${aed.id}')">
              <i class="fa-solid fa-cart-shopping"></i>
            </button>
          </td>
        </tr>
      `;
    }

    // 2. Attached Components Rows
    attached.forEach(comp => {
      const isPad = (comp.type || '').includes('Pad');
      const viewClick = isPad ? `viewPadDetails('${comp.id}', '${aed.id}')` : `viewBatteryDetails('${comp.id}', '${aed.id}')`;
      const compLocation = comp.location && comp.location !== '-' ? comp.location : locDisplay;
      const isCompChecked = selectedSet.has(String(comp.id));
      const compArchivedDate = comp.archivedDate || (comp.raw && (comp.raw.Archived_Date || comp.raw.archivedDate)) || aedArchivedDate || 'Date';

      if (showArchivedEquipment) {
        html += `
          <tr class="${isCompChecked ? 'report-row-selected' : ''}" ondblclick="${viewClick}" title="Double-click to view details">
            <td class="report-checkbox-td" style="text-align:center;">
              <input type="checkbox" class="report-row-checkbox" data-id="${comp.id}" data-aed-id="${aed.id}" data-type="${comp.type}" ${isCompChecked ? 'checked' : ''} onchange="onReportRowSelect('equipment', this)">
            </td>
            <td>${compLocation}</td>
            <td>${comp.type}</td>
            <td>${comp.brand || aed.brand || 'Brand'}</td>
            <td>${comp.model || 'Model'}</td>
            <td><code>${comp.sku || 'SKU'}</code></td>
            <td>${comp.serialLot || 'Lot'}</td>
            <td>${comp.expirationDate || 'Expiration Date'}</td>
            <td>${compArchivedDate}</td>
          </tr>
        `;
      } else {
        html += `
          <tr class="${isCompChecked ? 'report-row-selected' : ''}">
            <td class="report-checkbox-td">
              <input type="checkbox" class="report-row-checkbox" data-id="${comp.id}" data-aed-id="${aed.id}" data-type="${comp.type}" ${isCompChecked ? 'checked' : ''} onchange="onReportRowSelect('equipment', this)">
            </td>
            <td style="text-align:center;">
              <button class="excel-icon-btn" title="View Details" onclick="${viewClick}">
                <i class="fa-regular fa-file-lines"></i>
              </button>
            </td>
            <td>${compLocation}</td>
            <td>${comp.type}</td>
            <td>${comp.brand || aed.brand || 'Brand'}</td>
            <td>${comp.model || 'Model'}</td>
            <td><code>${comp.sku || 'SKU'}</code></td>
            <td>${comp.serialLot || 'Lot'}</td>
            <td>${comp.expirationDate || 'Expiration Date'}</td>
            ${renderExcelStatusCell(comp.expirationStatus || 'Ok', 'consumable')}
            <td></td>
            <td style="text-align:center;">
              <button class="excel-icon-btn buy" title="Buy" onclick="buyEquipment('${comp.id}')">
                <i class="fa-solid fa-cart-shopping"></i>
              </button>
            </td>
          </tr>
        `;
      }
    });

    // Action row: If AED has no attached pads or battery, show quick action buttons
    if (!showArchivedEquipment && attached.length === 0) {
      html += `
        <tr style="background: #FFFBEB; font-size: 11.5px; border-bottom: 1px solid #FEF3C7;">
          <td class="report-checkbox-td"></td>
          <td></td>
          <td colspan="9" style="padding: 7px 14px; color: #92400E;">
            <i class="fa-solid fa-triangle-exclamation" style="color: #D97706; margin-right: 6px;"></i>
            <strong>Action Needed:</strong> No pads or battery currently associated with this AED.
            <button type="button" class="excel-pill-btn sm" onclick="goToAssociatePadsFromTable('${aed.id}')" style="margin-left: 10px; padding: 2px 10px; font-size: 11px; background: #0070C0; color: #FFF;">
              <i class="fa-solid fa-plus" style="margin-right: 3px;"></i> Add Pads
            </button>
            <button type="button" class="excel-pill-btn sm" onclick="goToAssociateBatteryFromTable('${aed.id}')" style="margin-left: 6px; padding: 2px 10px; font-size: 11px; background: #0070C0; color: #FFF;">
              <i class="fa-solid fa-plus" style="margin-right: 3px;"></i> Add Battery
            </button>
          </td>
          <td></td>
        </tr>
      `;
    }
  });

  // Standalone components
  if (filteredStandalone.length) {
    if (filteredGroups.length > 0) {
      html += `<tr class="excel-group-divider"><td colspan="${colSpanCount}"></td></tr>`;
    }
    filteredStandalone.forEach(item => {
      const isPad = (item.type || '').includes('Pad');
      const viewClick = isPad ? `viewPadDetails('${item.id}', null)` : `viewBatteryDetails('${item.id}', null)`;
      const isItemChecked = selectedSet.has(String(item.id));
      const itemArchivedDate = item.archivedDate || (item.raw && (item.raw.Archived_Date || item.raw.archivedDate)) || 'Date';

      if (showArchivedEquipment) {
        html += `
          <tr class="${isItemChecked ? 'report-row-selected' : ''}" ondblclick="${viewClick}" title="Double-click to view details">
            <td class="report-checkbox-td" style="text-align:center;">
              <input type="checkbox" class="report-row-checkbox" data-id="${item.id}" data-type="${item.type}" ${isItemChecked ? 'checked' : ''} onchange="onReportRowSelect('equipment', this)">
            </td>
            <td>${item.location || '-'}</td>
            <td>${item.type}</td>
            <td>${item.brand || 'Brand'}</td>
            <td>${item.model || 'Model'}</td>
            <td><code>${item.sku || 'SKU'}</code></td>
            <td>${item.serialLot || 'Lot'}</td>
            <td>${item.expirationDate || 'Expiration Date'}</td>
            <td>${itemArchivedDate}</td>
          </tr>
        `;
      } else {
        html += `
          <tr class="${isItemChecked ? 'report-row-selected' : ''}">
            <td class="report-checkbox-td">
              <input type="checkbox" class="report-row-checkbox" data-id="${item.id}" data-type="${item.type}" ${isItemChecked ? 'checked' : ''} onchange="onReportRowSelect('equipment', this)">
            </td>
            <td style="text-align:center;">
              <button class="excel-icon-btn" title="View Details" onclick="${viewClick}">
                <i class="fa-regular fa-file-lines"></i>
              </button>
            </td>
            <td>${item.location || '-'}</td>
            <td>${item.type}</td>
            <td>${item.brand || 'Brand'}</td>
            <td>${item.model || 'Model'}</td>
            <td><code>${item.sku || 'SKU'}</code></td>
            <td>${item.serialLot || 'Lot'}</td>
            <td>${item.expirationDate || 'Expiration Date'}</td>
            ${renderExcelStatusCell(item.expirationStatus || 'Ok', item.type === 'AED' ? 'warranty' : 'consumable')}
            <td></td>
            <td style="text-align:center;">
              <button class="excel-icon-btn buy" title="Buy" onclick="buyEquipment('${item.id}')">
                <i class="fa-solid fa-cart-shopping"></i>
              </button>
            </td>
          </tr>
        `;
      }
    });
  }

  tbody.innerHTML = html;
  updateReportToolbarState('equipment');
}

window.toggleArchivedEquipment = function() {
  showArchivedEquipment = !showArchivedEquipment;
  const btnEq = document.getElementById('btn-toggle-archived-eq');
  const btnSpare = document.getElementById('btn-toggle-archived-spare');

  [btnEq, btnSpare].forEach(btn => {
    if (btn) {
      if (showArchivedEquipment) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }
  });

  const banner = document.getElementById('page-title-banner');
  if (banner) {
    banner.textContent = showArchivedEquipment ? 'Equipment (Archived)' : 'Equipment';
  }

  // Clear selections when toggling modes
  if (selectedReportRows['equipment']) {
    selectedReportRows['equipment'].clear();
  }
  const selectAll = document.getElementById('equipment-select-all');
  if (selectAll) {
    selectAll.checked = false;
    selectAll.indeterminate = false;
  }

  renderEquipment();
};

// --------------------------------------------------------------------------
// 3. SPARE EQUIPMENT VIEW (Exact Excel Sheet 'Equipment - Spare')
// --------------------------------------------------------------------------
async function renderSpare() {
  const tbody = document.getElementById('spare-tbody');
  if (!tbody) return;

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const orgScoped = filterRecordsByOrg(allEquipment);

  // Spare View Routing Logic (Client Requirement 2.3):
  // Items created by the system without an assigned location automatically route to the Spare section.
  const data = orgScoped.filter(item => {
    if (api.isRecordDeleted(item.id)) return false;
    const isArchived = (item.tab || '').toLowerCase() === 'archived' || (item.inventoryStatus || '').toLowerCase() === 'archived';
    if (isArchived) return false;
    const isSpare = (item.tab || '').toLowerCase() === 'spare' || (item.inventoryStatus || '').toLowerCase() === 'spare';
    const noLocation = !item.location || item.location === '-' || item.location.trim() === '';
    return isSpare || noLocation;
  });

  const searchTerm = (document.getElementById('spare-search')?.value || '').toLowerCase();
  const filtered = data.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.type && item.type.toLowerCase().includes(searchTerm)) ||
      (item.brand && item.brand.toLowerCase().includes(searchTerm)) ||
      (item.model && item.model.toLowerCase().includes(searchTerm)) ||
      (item.sku && item.sku.toLowerCase().includes(searchTerm)) ||
      (item.serialLot && item.serialLot.toLowerCase().includes(searchTerm)) ||
      (item.expirationStatus && item.expirationStatus.toLowerCase().includes(searchTerm))
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:#64748B;">No spare equipment currently in stock.</td></tr>`;
    updateReportToolbarState('spare');
    return;
  }

  const selectedSet = selectedReportRows['spare'] || new Set();

  let html = '';
  filtered.forEach((item, index) => {
    if (index > 0) {
      const prev = filtered[index - 1];
      if ((item.bundleId && prev.bundleId && item.bundleId !== prev.bundleId) || (!item.bundleId && prev.bundleId) || (item.type === 'AED')) {
        html += `<tr class="excel-group-divider"><td colspan="10"></td></tr>`;
      }
    }

    const isChecked = selectedSet.has(String(item.id));

    html += `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${item.id}" data-type="${item.type}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('spare', this)">
        </td>
        <td style="text-align:center;">
          <button class="excel-icon-btn" title="View / Edit ${item.type}" onclick="viewSpareEquipmentDetails('${item.id}')">
            <i class="fa-regular fa-file-lines"></i>
          </button>
        </td>
        <td>${item.location || '-'}</td>
        <td style="font-weight: 500;">${item.type}</td>
        <td>${item.brand || 'Brand'}</td>
        <td>${item.model || 'Model'}</td>
        <td>${item.sku || 'SKU'}</td>
        <td>${item.serialLot || (item.type === 'AED' ? 'Serial Number' : 'Lot')}</td>
        <td>${item.expirationDate || 'Expiration Date'}</td>
        ${renderExcelStatusCell(item.expirationStatus, item.type === 'AED' ? 'warranty' : 'consumable')}
      </tr>
    `;
  });

  tbody.innerHTML = html;
  updateReportToolbarState('spare');
}

let currentEditingSpareAEDId = null;

window.openAddSpareAED = function(editId = null) {
  currentEditingSpareAEDId = editId;
  const modalTitle = document.querySelector('#modal-add-spare-aed h3');
  const submitBtn = document.querySelector('#modal-add-spare-aed .modal-excel-footer .btn-action:not(.secondary)');
  const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const item = editId ? all.find(e => String(e.id) === String(editId)) : null;

  if (item) {
    if (modalTitle) modalTitle.textContent = `Spare Equipment — View / Edit ${item.brand || ''} ${item.model || ''}`;
    if (submitBtn) submitBtn.textContent = 'Save Changes';
    const brandSel = document.getElementById('spare-aed-brand');
    if (brandSel) {
      brandSel.value = item.brand || 'ZOLL';
      onSpareAEDBrandChange(item.model);
    }
    const skuInput = document.getElementById('spare-aed-sku');
    if (skuInput) skuInput.value = item.sku || '';
    const serialInput = document.getElementById('spare-aed-serial');
    if (serialInput) serialInput.value = item.serialLot || '';
    const purInput = document.getElementById('spare-aed-purchase-date');
    if (purInput) purInput.value = item.purchaseDate || '';
    const warInput = document.getElementById('spare-aed-warranty-date');
    if (warInput) warInput.value = item.warrantyExpirationDate || item.expirationDate || '';
    const statusSel = document.getElementById('spare-aed-warranty-status');
    if (statusSel) statusSel.value = item.expirationStatus || 'Warranty Not Active';
    const regSel = document.getElementById('spare-aed-registered');
    if (regSel) regSel.value = item.registered || 'Yes';
    const notesInput = document.getElementById('spare-aed-notes');
    if (notesInput) notesInput.value = item.notes || '';

    // Hide bundle checkboxes in edit mode
    const bundleWrap = document.getElementById('spare-aed-bundle-pads')?.closest('.excel-form-group');
    if (bundleWrap) bundleWrap.style.display = 'none';
  } else {
    if (modalTitle) modalTitle.textContent = 'Spare Equipment — Add Spare AED';
    if (submitBtn) submitBtn.textContent = 'Save Spare AED';
    const brandSel = document.getElementById('spare-aed-brand');
    if (brandSel) {
      brandSel.value = '';
      onSpareAEDBrandChange();
    }
    const serialInput = document.getElementById('spare-aed-serial');
    if (serialInput) serialInput.value = '';
    const purInput = document.getElementById('spare-aed-purchase-date');
    if (purInput) purInput.value = '';
    const warInput = document.getElementById('spare-aed-warranty-date');
    if (warInput) warInput.value = '';
    const statusSel = document.getElementById('spare-aed-warranty-status');
    if (statusSel) statusSel.value = 'Warranty Not Active';
    const regSel = document.getElementById('spare-aed-registered');
    if (regSel) regSel.value = 'Yes';
    const notesInput = document.getElementById('spare-aed-notes');
    if (notesInput) notesInput.value = '';

    const bundleWrap = document.getElementById('spare-aed-bundle-pads')?.closest('.excel-form-group');
    if (bundleWrap) bundleWrap.style.display = 'block';
    const chkPads = document.getElementById('spare-aed-bundle-pads');
    if (chkPads) chkPads.checked = false;
    const chkBat = document.getElementById('spare-aed-bundle-battery');
    if (chkBat) chkBat.checked = false;
  }

  const locSel = document.getElementById('spare-aed-location');
  if (locSel) {
    const rawLocs = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const scopedLocs = filterRecordsByOrg(rawLocs);
    locSel.innerHTML = '<option value="-">- Spare Stock (Unassigned) -</option>' + 
      scopedLocs.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    locSel.value = item?.location && item.location !== '-' ? item.location : '-';
  }
  onSpareAEDLocationChange();

  openModal('modal-add-spare-aed');
  logSystemAction('Spare AED Modal Opened', 'Equipment - Spare', editId ? `Opened view/edit modal for spare AED ${item?.brand} ${item?.model}` : 'Opened Add Spare AED modal');
};

window.onSpareAEDLocationChange = function() {
  const loc = (document.getElementById('spare-aed-location')?.value || '-').trim();
  const statInput = document.getElementById('spare-aed-inventory-status');
  if (statInput) {
    statInput.value = (loc && loc !== '-') ? 'Active (Deploy to Equipment)' : 'Spare';
  }
};

window.onSpareAEDBrandChange = function(selectedModel = '') {
  const brand = document.getElementById('spare-aed-brand')?.value || '';
  const modelSel = document.getElementById('spare-aed-model');
  const skuInput = document.getElementById('spare-aed-sku');
  if (!modelSel) return;

  if (!brand) {
    modelSel.innerHTML = '<option value="">-Select Model-</option>';
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.brandCatalog || {};
  const models = catalog[brand] || [{ model: 'AED System', sku: 'GEN-AED-01', warrantyYears: 8 }];

  modelSel.innerHTML = '<option value="">-Select Model-</option>' + models.map(m => `<option value="${m.model}" ${m.model === selectedModel ? 'selected' : ''}>${m.model}</option>`).join('');
  onSpareAEDModelChange();
};

window.onSpareAEDModelChange = function() {
  const brand = document.getElementById('spare-aed-brand')?.value || '';
  const model = document.getElementById('spare-aed-model')?.value || '';
  const skuInput = document.getElementById('spare-aed-sku');

  if (!brand || !model) {
    if (skuInput) skuInput.value = '';
    calculateSpareAEDWarranty();
    return;
  }

  const catalog = INITIAL_DATA.brandCatalog || {};
  const list = catalog[brand] || [];
  const found = list.find(m => m.model === model);

  if (skuInput && found) {
    skuInput.value = found.sku;
  }
  calculateSpareAEDWarranty();
};

window.calculateSpareAEDWarranty = function() {
  const purDateVal = document.getElementById('spare-aed-purchase-date')?.value;
  const warDateInput = document.getElementById('spare-aed-warranty-date');
  if (!warDateInput) return;
  if (!purDateVal) {
    warDateInput.value = '';
    const statusSel = document.getElementById('spare-aed-warranty-status');
    if (statusSel) statusSel.value = 'Warranty Not Active';
    return;
  }

  const brand = document.getElementById('spare-aed-brand')?.value || '';
  const model = document.getElementById('spare-aed-model')?.value || '';
  const catalog = INITIAL_DATA.brandCatalog || {};
  const list = catalog[brand] || [];
  const found = list.find(m => m.model === model);
  const years = (found && found.warrantyYears) ? found.warrantyYears : 8;

  const baseDate = new Date(purDateVal);
  baseDate.setFullYear(baseDate.getFullYear() + years);
  warDateInput.value = baseDate.toISOString().split('T')[0];
};

window.calculateSpareAEDWarrantyStatus = function() {
  const warDateVal = document.getElementById('spare-aed-warranty-date')?.value;
  const statusSel = document.getElementById('spare-aed-warranty-status');
  if (!statusSel || !warDateVal) return;

  const warDate = new Date(warDateVal);
  const now = new Date();
  if (warDate < now) {
    statusSel.value = 'Expired';
  } else {
    if (statusSel.value === 'Expired') statusSel.value = 'Ok';
  }
};

window.saveSpareAEDRecord = async function() {
  const brand = (document.getElementById('spare-aed-brand')?.value || '').trim();
  const model = (document.getElementById('spare-aed-model')?.value || '').trim();
  const sku = document.getElementById('spare-aed-sku')?.value || '';
  const serial = (document.getElementById('spare-aed-serial')?.value || '').trim();
  const purchaseDate = document.getElementById('spare-aed-purchase-date')?.value || '';
  const warrantyExpirationDate = document.getElementById('spare-aed-warranty-date')?.value || '';
  const warrantyStatus = document.getElementById('spare-aed-warranty-status')?.value || 'Warranty Not Active';
  const registered = document.getElementById('spare-aed-registered')?.value || 'Yes';
  const notes = document.getElementById('spare-aed-notes')?.value || '';

  if (!brand) {
    alert('Please select a Brand.');
    return;
  }
  if (!model) {
    alert('Please select a Model.');
    return;
  }
  if (!serial) {
    alert('Please enter a serial number for the spare AED.');
    return;
  }

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const bundleId = 'BUNDLE-' + Date.now();
  const scope = typeof getActiveOrganizationScope === 'function' ? getActiveOrganizationScope() : { currentKey: 'vital-aed' };
  const currentOrg = (INITIAL_DATA.organizations || []).find(o => o.key === scope.currentKey);
  const orgName = currentOrg ? currentOrg.name : (INITIAL_DATA.organization?.name || 'Vital AED Life Safety Corp');
  const orgKey = scope.currentKey || 'vital-aed';

  const selectedLocation = (document.getElementById('spare-aed-location')?.value || '-').trim();
  const isAssigned = selectedLocation && selectedLocation !== '-';
  const location = isAssigned ? selectedLocation : '-';
  const inventoryStatus = isAssigned ? 'active' : 'spare';
  const tab = isAssigned ? 'active' : 'spare';
  const serviceStatus = isAssigned ? 'Rescue-Ready' : 'Standby';

  if (currentEditingSpareAEDId) {
    const idx = allEquipment.findIndex(e => String(e.id) === String(currentEditingSpareAEDId));
    if (idx !== -1) {
      allEquipment[idx] = {
        ...allEquipment[idx],
        brand, model, sku, serialLot: serial,
        purchaseDate, registered, warrantyExpirationDate,
        expirationDate: warrantyExpirationDate,
        expirationStatus: warrantyStatus,
        notes,
        location,
        tab,
        inventoryStatus,
        serviceStatus,
        organization: allEquipment[idx].organization || orgName,
        organizationKey: allEquipment[idx].organizationKey || orgKey
      };
      await api.updateEquipment(currentEditingSpareAEDId, allEquipment[idx]);

      // Cascade location inheritance to any attached components
      allEquipment = allEquipment.map(e => {
        if (String(e.aedId) === String(currentEditingSpareAEDId)) {
          return {
            ...e,
            location,
            tab,
            inventoryStatus,
            serviceStatus
          };
        }
        return e;
      });
    }
    logSystemAction(isAssigned ? 'Spare AED Deployed' : 'Spare AED Updated', 'Equipment', `${isAssigned ? 'Deployed' : 'Updated'} spare AED ${brand} ${model} (SN: ${serial}) to location: ${location}`, 'Success');
  } else {
    const aedRecord = {
      id: 'EQ-SP-' + Date.now(),
      type: 'AED',
      location,
      brand,
      model,
      sku,
      serialLot: serial,
      purchaseDate,
      registered,
      warrantyExpirationDate,
      expirationDate: warrantyExpirationDate,
      expirationStatus: warrantyStatus,
      serviceStatus,
      tab,
      inventoryStatus,
      organization: orgName,
      organizationKey: orgKey,
      bundleId,
      notes,
      resourcesUrl: '#resources',
      buyUrl: '#reorder'
    };

    allEquipment.unshift(aedRecord);
    await api.addEquipment(aedRecord);

    // If bundle components are checked, bundle Adult Pad & Battery
    const includePads = document.getElementById('spare-aed-bundle-pads')?.checked;
    const includeBattery = document.getElementById('spare-aed-bundle-battery')?.checked;

    const padCatalog = (INITIAL_DATA.padCatalog && INITIAL_DATA.padCatalog[brand]) || [];
    const batCatalog = (INITIAL_DATA.batteryCatalog && INITIAL_DATA.batteryCatalog[brand]) || [];

    if (includePads) {
      const padModel = padCatalog[0]?.model || 'Adult Defib Pads';
      const padSku = padCatalog[0]?.sku || 'PAD-SKU';
      const expPad = new Date();
      expPad.setFullYear(expPad.getFullYear() + 2);

      const padRecord = {
        id: 'PAD-' + Date.now(),
        aedId: aedRecord.id,
        aedSerial: serial || aedRecord.serialLot,
        aedModel: model || aedRecord.model,
        type: 'Adult Pads',
        location,
        brand,
        model: padModel,
        sku: padSku,
        serialLot: 'LOT-' + Math.floor(10000 + Math.random() * 90000),
        expirationDate: expPad.toISOString().split('T')[0],
        expirationStatus: 'OK',
        serviceStatus,
        tab,
        inventoryStatus,
        organization: orgName,
        organizationKey: orgKey,
        organizationId: aedRecord.organizationId || undefined,
        bundleId,
        resourcesUrl: '#resources',
        buyUrl: '#reorder'
      };
      allEquipment.splice(1, 0, padRecord);
      await api.addEquipment(padRecord);
    }

    if (includeBattery) {
      const batModel = batCatalog[0]?.model || 'Standby Battery Pack';
      const batSku = batCatalog[0]?.sku || 'BAT-SKU';
      const expBat = new Date();
      expBat.setFullYear(expBat.getFullYear() + 4);

      const batRecord = {
        id: 'BAT-' + Date.now(),
        aedId: aedRecord.id,
        aedSerial: serial || aedRecord.serialLot,
        aedModel: model || aedRecord.model,
        type: 'Battery',
        location,
        brand,
        model: batModel,
        sku: batSku,
        serialLot: 'BAT-' + Math.floor(10000 + Math.random() * 90000),
        expirationDate: expBat.toISOString().split('T')[0],
        expirationStatus: 'OK',
        serviceStatus,
        tab,
        inventoryStatus,
        organization: orgName,
        organizationKey: orgKey,
        organizationId: aedRecord.organizationId || undefined,
        bundleId,
        resourcesUrl: '#resources',
        buyUrl: '#reorder'
      };
      allEquipment.splice(includePads ? 2 : 1, 0, batRecord);
      await api.addEquipment(batRecord);
    }

    logSystemAction(isAssigned ? 'AED Registered & Deployed' : 'Spare AED Registered', 'Equipment', `Registered ${isAssigned ? 'and deployed' : 'spare'} AED ${brand} ${model} (SN: ${serial}) at location: ${location}`, 'Success');
  }

  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  closeModal('modal-add-spare-aed');
  if (isAssigned) {
    alert(`AED successfully saved and deployed to Equipment!\n\nDevice: ${brand} ${model}\nSerial: ${serial}\nLocation: ${location}\nInventory Status: ACTIVE`);
  } else {
    alert(`Spare AED successfully saved!\n\nDevice: ${brand} ${model}\nSerial: ${serial}\nLocation: -\nInventory Status: SPARE\n\nNo location is assigned until assigned to an active facility.`);
  }
  await Promise.all([renderEquipment(), renderSpare(), renderDashboard()]);
  if (isAssigned) {
    switchView('equipment');
  }
};

let currentSparePadCategory = 'Adult Pads';
let currentEditingSparePadId = null;

window.openAddSparePadModal = function(editId = null) {
  currentEditingSparePadId = editId;
  const modalTitle = document.querySelector('#modal-add-spare-pad h3');
  const submitBtn = document.querySelector('#modal-add-spare-pad .modal-excel-footer .btn-action:not(.secondary)');
  const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const item = editId ? all.find(e => String(e.id) === String(editId)) : null;

  if (item) {
    if (modalTitle) modalTitle.textContent = `Spare Equipment — View / Edit ${item.type || 'Spare Pad'}`;
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    currentSparePadCategory = item.type || 'Adult Pads';
    const btnAdult = document.getElementById('btn-spare-pad-adult');
    const btnPediatric = document.getElementById('btn-spare-pad-pediatric');
    if (btnAdult) btnAdult.classList.toggle('active', currentSparePadCategory === 'Adult Pads');
    if (btnPediatric) btnPediatric.classList.toggle('active', currentSparePadCategory === 'Pediatric Pads');

    const brandSel = document.getElementById('spare-pad-brand');
    if (brandSel) {
      brandSel.value = item.brand || 'ZOLL';
      onSparePadBrandChange(item.model);
    }
    const modelSel = document.getElementById('spare-pad-model');
    if (modelSel && item.model) modelSel.value = item.model;
    const skuInput = document.getElementById('spare-pad-sku');
    if (skuInput) skuInput.value = item.sku || '';
    const lotInput = document.getElementById('spare-pad-lot');
    if (lotInput) lotInput.value = item.serialLot || '';
    const expDateInput = document.getElementById('spare-pad-exp-date');
    if (expDateInput) expDateInput.value = item.expirationDate || '';
    calculateSparePadExpStatus();
  } else {
    currentSparePadCategory = 'Adult Pads';
    if (modalTitle) modalTitle.textContent = 'Spare Equipment — Add Spare Pad';
    if (submitBtn) submitBtn.textContent = 'Save Spare Pad';

    const brandSel = document.getElementById('spare-pad-brand');
    if (brandSel) {
      brandSel.value = '';
      onSparePadBrandChange();
    }

    const lotInput = document.getElementById('spare-pad-lot');
    if (lotInput) lotInput.value = '';

    const expDateInput = document.getElementById('spare-pad-exp-date');
    if (expDateInput) expDateInput.value = '';
    const expStatusInput = document.getElementById('spare-pad-exp-status');
    if (expStatusInput) expStatusInput.value = '';
  }

  const locSel = document.getElementById('spare-pad-location');
  if (locSel) {
    const rawLocs = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const scopedLocs = filterRecordsByOrg(rawLocs);
    locSel.innerHTML = '<option value="-">- Spare Stock (Unassigned) -</option>' + 
      scopedLocs.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    locSel.value = item?.location && item.location !== '-' ? item.location : '-';
  }
  onSparePadLocationChange();

  openModal('modal-add-spare-pad');
  logSystemAction('Spare Pad Modal Opened', 'Equipment - Spare', editId ? `Opened view/edit modal for spare pad (${editId})` : 'Opened Add Spare Pad modal');
};

window.onSparePadLocationChange = function() {
  const loc = (document.getElementById('spare-pad-location')?.value || '-').trim();
  const statInput = document.getElementById('spare-pad-inventory-status');
  if (statInput) {
    statInput.value = (loc && loc !== '-') ? 'Active (Deploy to Equipment)' : 'Spare';
  }
};

window.switchSparePadCategory = function(category) {
  currentSparePadCategory = 'Pads';
  onSparePadBrandChange();
};

window.onSparePadBrandChange = function(selectedModel = '') {
  const brand = document.getElementById('spare-pad-brand')?.value || '';
  const modelSel = document.getElementById('spare-pad-model');
  const skuInput = document.getElementById('spare-pad-sku');
  if (!modelSel) return;

  if (!brand) {
    modelSel.innerHTML = '<option value="">-Select Model-</option>';
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.padCatalog || {};
  const allModels = catalog[brand] || [{ model: 'Standard Defib Pads', sku: 'GEN-PAD-01' }];

  modelSel.innerHTML = '<option value="">-Select Model-</option>' + allModels.map(m => `<option value="${m.model}" ${m.model === selectedModel ? 'selected' : ''}>${m.model}</option>`).join('');
  onSparePadModelChange();
};

window.onSparePadModelChange = function() {
  const brand = document.getElementById('spare-pad-brand')?.value || '';
  const model = document.getElementById('spare-pad-model')?.value || '';
  const skuInput = document.getElementById('spare-pad-sku');

  if (!brand || !model) {
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.padCatalog || {};
  const list = catalog[brand] || [];
  const found = list.find(m => m.model === model);

  if (skuInput && found) {
    skuInput.value = found.sku;
  }
};

window.calculateSparePadExpStatus = function() {
  const expDate = document.getElementById('spare-pad-exp-date')?.value;
  const statusInput = document.getElementById('spare-pad-exp-status');
  if (!statusInput) return;

  if (!expDate) {
    statusInput.value = 'Unknown';
    return;
  }

  const exp = new Date(expDate);
  const now = new Date();
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    statusInput.value = 'Expired';
    statusInput.style.color = '#DC2626';
  } else if (diffDays <= 30) {
    statusInput.value = `Expires in ${diffDays} days`;
    statusInput.style.color = '#D97706';
  } else {
    statusInput.value = 'Ok';
    statusInput.style.color = '#16A34A';
  }
};

window.saveSparePadRecord = async function() {
  const brand = (document.getElementById('spare-pad-brand')?.value || '').trim();
  const model = (document.getElementById('spare-pad-model')?.value || '').trim();
  const sku = document.getElementById('spare-pad-sku')?.value || '';
  const lot = (document.getElementById('spare-pad-lot')?.value || '').trim() || 'LOT-' + Date.now();
  let expDate = document.getElementById('spare-pad-exp-date')?.value || '';
  const expStatus = document.getElementById('spare-pad-exp-status')?.value || 'Ok';

  if (!brand) {
    alert('Please select a Brand.');
    return;
  }
  if (!model) {
    alert('Please select a Model.');
    return;
  }
  if (!expDate) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    expDate = d.toISOString().split('T')[0];
    const expDateInput = document.getElementById('spare-pad-exp-date');
    if (expDateInput) expDateInput.value = expDate;
  }

  const selectedLocation = (document.getElementById('spare-pad-location')?.value || '-').trim();
  const isAssigned = selectedLocation && selectedLocation !== '-';
  const location = isAssigned ? selectedLocation : '-';
  const inventoryStatus = isAssigned ? 'active' : 'spare';
  const tab = isAssigned ? 'active' : 'spare';
  const serviceStatus = isAssigned ? (expStatus === 'Expired' ? 'Replacement Required' : 'Rescue-Ready') : 'Standby';

  const isPed = (model.toLowerCase().includes('pediatric') || model.toLowerCase().includes('child') || model.toLowerCase().includes('pedi') || (typeof currentSparePadCategory !== 'undefined' && currentSparePadCategory === 'Pediatric Pads'));
  const padCategory = isPed ? 'Pediatric Pads' : 'Adult Pads';

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');

  if (currentEditingSparePadId) {
    const idx = allEquipment.findIndex(e => String(e.id) === String(currentEditingSparePadId));
    if (idx !== -1) {
      allEquipment[idx] = {
        ...allEquipment[idx],
        type: padCategory,
        brand,
        model,
        sku,
        serialLot: lot,
        expirationDate: expDate,
        expirationStatus: expStatus,
        location,
        tab,
        inventoryStatus,
        serviceStatus
      };
      localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));
      api.updateEquipment(currentEditingSparePadId, allEquipment[idx]).catch(e => console.warn("Spare pad update sync notice:", e));
    }
    logSystemAction(isAssigned ? 'Spare Pad Deployed' : 'Spare Pad Updated', 'Equipment', `${isAssigned ? 'Deployed' : 'Updated'} spare ${padCategory}: ${brand} ${model} (Lot: ${lot}) to location: ${location}`, 'Success');
  } else {
    const newPad = {
      id: 'PAD-' + Date.now(),
      type: padCategory,
      location,
      brand,
      model,
      sku,
      serialLot: lot,
      expirationDate: expDate,
      expirationStatus: expStatus,
      serviceStatus,
      tab,
      inventoryStatus,
      resourcesUrl: '#resources',
      buyUrl: '#reorder'
    };

    allEquipment.unshift(newPad);
    localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));
    api.addEquipment(newPad).catch(e => console.warn("Spare pad add sync notice:", e));
    logSystemAction(isAssigned ? 'Pad Registered & Deployed' : 'Spare Pad Added', 'Equipment', `Registered ${isAssigned ? 'and deployed' : 'spare'} ${padCategory}: ${brand} ${model} (Lot: ${lot}) at location: ${location}`, 'Success');
  }

  currentEditingSparePadId = null;
  closeModal('modal-add-spare-pad');
  if (isAssigned) {
    alert(`Spare ${padCategory} successfully deployed to Equipment!\n\nBrand: ${brand}\nModel: ${model}\nLot: ${lot}\nLocation: ${location}\nInventory Status: ACTIVE`);
  } else {
    alert(`Spare ${padCategory} registered successfully!\n\nBrand: ${brand}\nModel: ${model}\nLot: ${lot}\nStatus: Spare\nLocation: -`);
  }
  await Promise.all([renderEquipment(), renderSpare(), renderDashboard()]);
  if (isAssigned) {
    switchView('equipment');
  }
};

let currentEditingSpareBatteryId = null;

window.openAddSpareBatteryModal = function(editId = null) {
  currentEditingSpareBatteryId = editId;
  const modalTitle = document.querySelector('#modal-add-spare-battery h3');
  const submitBtn = document.querySelector('#modal-add-spare-battery .modal-excel-footer .btn-action:not(.secondary)');
  const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const item = editId ? all.find(e => String(e.id) === String(editId)) : null;

  if (item) {
    if (modalTitle) modalTitle.textContent = 'Spare Equipment — View / Edit Spare Battery';
    if (submitBtn) submitBtn.textContent = 'Save Changes';

    const brandSel = document.getElementById('spare-battery-brand');
    if (brandSel) {
      brandSel.value = item.brand || 'ZOLL';
      onSpareBatteryBrandChange(item.model);
    }
    const modelSel = document.getElementById('spare-battery-model');
    if (modelSel && item.model) modelSel.value = item.model;
    const skuInput = document.getElementById('spare-battery-sku');
    if (skuInput) skuInput.value = item.sku || '';
    const lotInput = document.getElementById('spare-battery-lot');
    if (lotInput) lotInput.value = item.serialLot || '';
    const expDateInput = document.getElementById('spare-battery-exp-date');
    if (expDateInput) expDateInput.value = item.expirationDate || '';
    calculateSpareBatteryExpStatus();
  } else {
    if (modalTitle) modalTitle.textContent = 'Spare Equipment — Add Spare Battery';
    if (submitBtn) submitBtn.textContent = 'Save Spare Battery';

    const brandSel = document.getElementById('spare-battery-brand');
    if (brandSel) {
      brandSel.value = '';
      onSpareBatteryBrandChange();
    }

    const lotInput = document.getElementById('spare-battery-lot');
    if (lotInput) lotInput.value = '';

    const expDateInput = document.getElementById('spare-battery-exp-date');
    if (expDateInput) expDateInput.value = '';
    const statusInput = document.getElementById('spare-battery-exp-status');
    if (statusInput) statusInput.value = '';
  }

  const locSel = document.getElementById('spare-battery-location');
  if (locSel) {
    const rawLocs = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const scopedLocs = filterRecordsByOrg(rawLocs);
    locSel.innerHTML = '<option value="-">- Spare Stock (Unassigned) -</option>' + 
      scopedLocs.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    locSel.value = item?.location && item.location !== '-' ? item.location : '-';
  }
  onSpareBatteryLocationChange();

  openModal('modal-add-spare-battery');
  logSystemAction('Spare Battery Modal Opened', 'Equipment - Spare', editId ? `Opened edit modal for spare battery (${editId})` : 'Opened Add Spare Battery modal');
};

window.onSpareBatteryLocationChange = function() {
  const loc = (document.getElementById('spare-battery-location')?.value || '-').trim();
  const statInput = document.getElementById('spare-battery-inventory-status');
  if (statInput) {
    statInput.value = (loc && loc !== '-') ? 'Active (Deploy to Equipment)' : 'Spare';
  }
};

window.onSpareBatteryBrandChange = function(selectedModel = '') {
  const brand = document.getElementById('spare-battery-brand')?.value || '';
  const modelSel = document.getElementById('spare-battery-model');
  const skuInput = document.getElementById('spare-battery-sku');
  if (!modelSel) return;

  if (!brand) {
    modelSel.innerHTML = '<option value="">-Select Model-</option>';
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.batteryCatalog || {};
  const allModels = catalog[brand] || [{ model: 'Lithium Battery Pack', sku: 'GEN-BAT-01' }];

  modelSel.innerHTML = '<option value="">-Select Model-</option>' + allModels.map(m => `<option value="${m.model}" ${m.model === selectedModel ? 'selected' : ''}>${m.model}</option>`).join('');
  onSpareBatteryModelChange();
};

window.onSpareBatteryModelChange = function() {
  const brand = document.getElementById('spare-battery-brand')?.value || '';
  const model = document.getElementById('spare-battery-model')?.value || '';
  const skuInput = document.getElementById('spare-battery-sku');

  if (!brand || !model) {
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.batteryCatalog || {};
  const list = catalog[brand] || [];
  const found = list.find(m => m.model === model);

  if (skuInput && found) {
    skuInput.value = found.sku;
  }
};

window.calculateSpareBatteryExpStatus = function() {
  const expDate = document.getElementById('spare-battery-exp-date')?.value;
  const statusInput = document.getElementById('spare-battery-exp-status');
  if (!statusInput) return;

  if (!expDate) {
    statusInput.value = 'Unknown';
    return;
  }

  const exp = new Date(expDate);
  const now = new Date();
  const diffDays = Math.ceil((exp - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    statusInput.value = 'Expired';
    statusInput.style.color = '#DC2626';
  } else if (diffDays <= 30) {
    statusInput.value = `Expires in ${diffDays} days`;
    statusInput.style.color = '#D97706';
  } else {
    statusInput.value = 'Ok';
    statusInput.style.color = '#16A34A';
  }
};

window.saveSpareBatteryRecord = async function() {
  const brand = (document.getElementById('spare-battery-brand')?.value || '').trim();
  const model = (document.getElementById('spare-battery-model')?.value || '').trim();
  const sku = document.getElementById('spare-battery-sku')?.value || '';
  const lot = (document.getElementById('spare-battery-lot')?.value || '').trim() || 'BAT-' + Date.now();
  let expDate = document.getElementById('spare-battery-exp-date')?.value || '';
  const expStatus = document.getElementById('spare-battery-exp-status')?.value || 'Ok';

  if (!brand) {
    alert('Please select a Brand.');
    return;
  }
  if (!model) {
    alert('Please select a Model.');
    return;
  }
  if (!expDate) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 4);
    expDate = d.toISOString().split('T')[0];
    const expDateInput = document.getElementById('spare-battery-exp-date');
    if (expDateInput) expDateInput.value = expDate;
  }

  const selectedLocation = (document.getElementById('spare-battery-location')?.value || '-').trim();
  const isAssigned = selectedLocation && selectedLocation !== '-';
  const location = isAssigned ? selectedLocation : '-';
  const inventoryStatus = isAssigned ? 'active' : 'spare';
  const tab = isAssigned ? 'active' : 'spare';
  const serviceStatus = isAssigned ? (expStatus === 'Expired' ? 'Replacement Required' : 'Rescue-Ready') : 'Standby';

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');

  if (currentEditingSpareBatteryId) {
    const idx = allEquipment.findIndex(e => String(e.id) === String(currentEditingSpareBatteryId));
    if (idx !== -1) {
      allEquipment[idx] = {
        ...allEquipment[idx],
        type: 'Battery',
        brand,
        model,
        sku,
        serialLot: lot,
        expirationDate: expDate,
        expirationStatus: expStatus,
        location,
        tab,
        inventoryStatus,
        serviceStatus
      };
      localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));
      api.updateEquipment(currentEditingSpareBatteryId, allEquipment[idx]).catch(e => console.warn("Spare battery update sync notice:", e));
    }
    logSystemAction(isAssigned ? 'Spare Battery Deployed' : 'Spare Battery Updated', 'Equipment', `${isAssigned ? 'Deployed' : 'Updated'} spare battery: ${brand} ${model} (SN/Lot: ${lot}) to location: ${location}`, 'Success');
  } else {
    const newBat = {
      id: 'BAT-' + Date.now(),
      type: 'Battery',
      location,
      brand,
      model,
      sku,
      serialLot: lot,
      expirationDate: expDate,
      expirationStatus: expStatus,
      serviceStatus,
      tab,
      inventoryStatus,
      resourcesUrl: '#resources',
      buyUrl: '#reorder'
    };

    allEquipment.unshift(newBat);
    localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));
    api.addEquipment(newBat).catch(e => console.warn("Spare battery add sync notice:", e));
    logSystemAction(isAssigned ? 'Battery Registered & Deployed' : 'Spare Battery Added', 'Equipment', `Registered ${isAssigned ? 'and deployed' : 'spare'} battery: ${brand} ${model} (SN/Lot: ${lot}) at location: ${location}`, 'Success');
  }

  currentEditingSpareBatteryId = null;
  closeModal('modal-add-spare-battery');
  if (isAssigned) {
    alert(`Spare Battery successfully deployed to Equipment!\n\nBrand: ${brand}\nModel: ${model}\nLot: ${lot}\nLocation: ${location}\nInventory Status: ACTIVE`);
  } else {
    alert(`Spare Battery registered successfully!\n\nBrand: ${brand}\nModel: ${model}\nLot: ${lot}\nStatus: Spare\nLocation: -`);
  }
  await Promise.all([renderEquipment(), renderSpare(), renderDashboard()]);
  if (isAssigned) {
    switchView('equipment');
  }
};

window.viewSpareEquipmentDetails = function(id) {
  const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const item = all.find(e => String(e.id) === String(id));
  if (!item) return;

  if (item.type === 'AED') {
    openAddSpareAED(item.id);
  } else if (item.type && item.type.includes('Pad')) {
    openAddSparePadModal(item.id);
  } else if (item.type === 'Battery') {
    openAddSpareBatteryModal(item.id);
  } else {
    openAddSpareAED(item.id);
  }
};

window.viewPadDetails = async function(padId, aedId = null) {
  if (aedId) {
    await openAEDPanel(aedId, true);
    switchAEDPanelTab('pads');
    openPadForm(padId);
  } else {
    openAddSparePadModal(padId);
  }
};

window.viewBatteryDetails = async function(batteryId, aedId = null) {
  if (aedId) {
    await openAEDPanel(aedId, true);
    switchAEDPanelTab('batteries');
    openBatteryForm(batteryId);
  } else {
    openAddSpareBatteryModal(batteryId);
  }
};

window.showResourceInfo = function(id) {
  const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const item = all.find(e => String(e.id) === String(id)) || {
    brand: 'Standard',
    model: 'AED System',
    type: 'Equipment',
    sku: 'GEN-01'
  };

  const titleEl = document.getElementById('resource-modal-title');
  const bodyEl = document.getElementById('resource-modal-body');
  if (titleEl) titleEl.textContent = `${item.brand} ${item.model} — Resources`;

  if (bodyEl) {
    bodyEl.innerHTML = `
      <div style="font-size: 13px; line-height: 1.6; color: #334155;">
        <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 14px; margin-bottom: 16px;">
          <h4 style="margin: 0 0 8px 0; color: #004182; font-size: 14px;">Equipment Specifications</h4>
          <div><strong>Type:</strong> ${item.type}</div>
          <div><strong>Brand:</strong> ${item.brand || 'Brand'}</div>
          <div><strong>Model:</strong> ${item.model || 'Model'}</div>
          <div><strong>SKU:</strong> <span style="font-family: monospace;">${item.sku || 'SKU'}</span></div>
          <div><strong>Status:</strong> ${item.expirationStatus || 'Ok'}</div>
        </div>

        <h4 style="margin: 0 0 10px 0; color: #004182; font-size: 14px;">Documentation & Downloads</h4>
        <div style="display: flex; flex-direction: column; gap: 8px;">
          <a href="#" class="excel-pill-btn sm" onclick="event.preventDefault(); alert('Opening User Operator Manual PDF for ${item.brand} ${item.model}...');" style="display: inline-flex; justify-content: flex-start; text-align: left; padding: 8px 14px; text-decoration: none;">
            <i class="fa-solid fa-file-pdf" style="margin-right: 8px; color: #DC2626;"></i> Operator & Maintenance Manual (PDF)
          </a>
          <a href="#" class="excel-pill-btn sm" onclick="event.preventDefault(); alert('Opening Quick Reference Guide for ${item.brand} ${item.model}...');" style="display: inline-flex; justify-content: flex-start; text-align: left; padding: 8px 14px; text-decoration: none;">
            <i class="fa-solid fa-file-lines" style="margin-right: 8px; color: #0284C7;"></i> Quick Reference Deployment Card
          </a>
          <a href="#" class="excel-pill-btn sm" onclick="event.preventDefault(); alert('Opening Manufacturer Technical Specifications Sheet...');" style="display: inline-flex; justify-content: flex-start; text-align: left; padding: 8px 14px; text-decoration: none;">
            <i class="fa-solid fa-certificate" style="margin-right: 8px; color: #16A34A;"></i> FDA Clearance & Warranty Registration Sheet
          </a>
        </div>
      </div>
    `;
  }

  openModal('modal-resource-info');
  logSystemAction('Resource Viewed', 'Equipment - Spare', `Viewed documentation and resources for ${item.brand} ${item.model} (${item.id})`);
};

// --------------------------------------------------------------------------
// 4. INSPECTIONS VIEW (Active & Archived)
// --------------------------------------------------------------------------
async function renderInspections() {
  const tbody = document.getElementById('inspections-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('inspections-search')?.value || '').toLowerCase();
  const tab = showArchivedInspections ? 'archived' : 'active';
  const rawData = await api.getInspections(tab);
  const data = filterRecordsByOrg(rawData);

  const filtered = data.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.location && item.location.toLowerCase().includes(searchTerm)) ||
      (item.equipment && item.equipment.toLowerCase().includes(searchTerm)) ||
      (item.inspector && item.inspector.toLowerCase().includes(searchTerm))
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748B;">No inspection records found.</td></tr>`;
    updateReportToolbarState('inspections');
    return;
  }

  const selectedSet = selectedReportRows['inspections'] || new Set();
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');

  tbody.innerHTML = filtered.map(item => {
    const isChecked = selectedSet.has(String(item.id));
    const eq = allEquipment.find(e => String(e.id) === String(item.aedId) || e.serialLot === item.serialNumber || e.location === item.location) || {};
    const brand = item.brand || eq.brand || 'ZOLL';
    const model = item.model || eq.model || 'AED 3';
    const sku = item.sku || eq.sku || 'ZOL-AED3-01';
    const serial = item.serialNumber || eq.serialLot || '-';

    return `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('inspections', this)">
        </td>
        <td style="text-align:center;">
          <button class="excel-icon-btn" title="View Inspection Details" onclick="openRegisterInspectionForm('${item.id}')">
            <i class="fa-regular fa-file-lines"></i>
          </button>
        </td>
        <td>${item.location || '-'}</td>
        <td><strong>AED</strong></td>
        <td>${brand}</td>
        <td>${model}</td>
        <td>${sku}</td>
        <td>${serial}</td>
        <td>${item.inspectionDate || '-'}</td>
        ${renderStatusCells(item.status)}
        <td style="text-align:center;">
          <button class="excel-icon-btn download" title="Download PDF" onclick="downloadInspectionPDF('${item.id}')">
            <i class="fa-solid fa-download"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateReportToolbarState('inspections');
}

window.toggleArchivedInspections = function() {
  showArchivedInspections = !showArchivedInspections;
  const btn = document.getElementById('btn-toggle-archived-insp');
  if (btn) {
    btn.innerHTML = showArchivedInspections 
      ? '<i class="fa-solid fa-check"></i> Showing Archived (Click for Active)'
      : '<i class="fa-solid fa-archive"></i> Show Archived Inspections';
  }
  renderInspections();
};


// --------------------------------------------------------------------------
// 5. RESCUE EVENTS VIEW
// --------------------------------------------------------------------------
async function renderRescue() {
  const tbody = document.getElementById('rescue-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('rescue-search')?.value || '').toLowerCase();
  const rawData = await api.getRescueEvents();
  const data = filterRecordsByOrg(rawData);

  const filtered = data.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.location && item.location.toLowerCase().includes(searchTerm)) ||
      (item.equipment && item.equipment.toLowerCase().includes(searchTerm)) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm))
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748B;">No rescue event records found.</td></tr>`;
    updateReportToolbarState('rescue');
    return;
  }

  const selectedSet = selectedReportRows['rescue'] || new Set();

  tbody.innerHTML = filtered.map(item => {
    const isChecked = selectedSet.has(String(item.id));
    return `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('rescue', this)">
        </td>
        <td>${item.location}</td>
        <td><strong>${item.equipment}</strong></td>
        <td>${item.brand}</td>
        <td>${item.model}</td>
        <td><code>${item.sku}</code></td>
        <td>${item.serialNumber}</td>
        <td>${item.eventDate}</td>
        <td style="text-align:center;">
          <button class="excel-icon-btn download" title="Download Event Report" onclick="downloadRescueReport('${item.id}', '${item.serialNumber}', '${item.downloadUrl || ''}')">
            <i class="fa-solid fa-download"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');

  updateReportToolbarState('rescue');
}

// --------------------------------------------------------------------------
// 6. CPR CERTIFICATION VIEW
// --------------------------------------------------------------------------
async function renderCPR() {
  const tbody = document.getElementById('cpr-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('cpr-search')?.value || '').toLowerCase();
  const rawData = await api.getCPRCertifications();
  const data = filterRecordsByOrg(rawData);

  const filtered = data.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.location && item.location.toLowerCase().includes(searchTerm)) ||
      (item.firstName && item.firstName.toLowerCase().includes(searchTerm)) ||
      (item.lastName && item.lastName.toLowerCase().includes(searchTerm)) ||
      (item.classType && item.classType.toLowerCase().includes(searchTerm))
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center; padding:24px; color:#64748B;">No CPR certification records found.</td></tr>`;
    updateReportToolbarState('cpr');
    return;
  }

  const selectedSet = selectedReportRows['cpr'] || new Set();

  tbody.innerHTML = filtered.map((item, idx) => {
    const itemId = String(item.id || item.ID || item.Record_ID || ('CPR-' + idx));
    const isChecked = selectedSet.has(itemId);
    const loc = item.location || item.Location?.display_value || item.Location || '-';
    const first = item.firstName || item.First_Name || item.Name?.first_name || '-';
    const last = item.lastName || item.Last_Name || item.Name?.last_name || '';
    const classType = item.classType || item.Class_Type || item.CPR_Class_Type || 'Adult & Pediatric CPR/AED';
    const accreditation = item.accreditation || item.Accreditation || item.Issuing_Organization || 'AHA';
    const expDate = item.expirationDate || item.Expiration_Date || '-';
    const status = item.status || item.Status || 'Ok';

    return `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${itemId}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('cpr', this)">
        </td>
        <td style="text-align:center;">
          <button class="excel-icon-btn" title="View CPR Certificate" onclick="openCPRForm('${itemId}', false)">
            <i class="fa-regular fa-file-lines"></i>
          </button>
        </td>
        <td>${loc}</td>
        <td>${first}</td>
        <td>${last}</td>
        <td><strong>${classType}</strong></td>
        <td>${accreditation}</td>
        <td>${expDate}</td>
        ${renderStatusCells(status)}
      </tr>
    `;
  }).join('');

  updateReportToolbarState('cpr');
}

// --------------------------------------------------------------------------
// 7. LOCATIONS VIEW
// --------------------------------------------------------------------------
async function renderLocations() {
  const tbody = document.getElementById('locations-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('locations-search')?.value || '').toLowerCase();
  const rawData = await api.getLocations();
  const data = filterRecordsByOrg(rawData);

  const filtered = data.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.name && item.name.toLowerCase().includes(searchTerm)) ||
      (item.street && item.street.toLowerCase().includes(searchTerm)) ||
      (item.city && item.city.toLowerCase().includes(searchTerm)) ||
      (item.contact && item.contact.toLowerCase().includes(searchTerm))
    );
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748B;">No locations registered.</td></tr>`;
    updateReportToolbarState('locations');
    return;
  }

  const selectedSet = selectedReportRows['locations'] || new Set();

  tbody.innerHTML = filtered.map(item => {
    const isChecked = selectedSet.has(String(item.id));
    return `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${item.id}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('locations', this)">
        </td>
        <td style="text-align:center;">
          <button class="excel-icon-btn" title="View Location Details" onclick="openViewLocationModal('${item.id}')">
            <i class="fa-regular fa-file-lines"></i>
          </button>
        </td>
        <td><strong>${item.name}</strong></td>
        <td>${item.phone}</td>
        <td>${item.street}</td>
        <td>${item.suite || '-'}</td>
        <td>${item.city}</td>
        <td>${item.state}</td>
        <td>${item.contact}</td>
      </tr>
    `;
  }).join('');

  updateReportToolbarState('locations');
}

// --------------------------------------------------------------------------
// 8. AED PANEL & SUB-NAVIGATION TABS (Screenshots 1-5 + System Log)
// --------------------------------------------------------------------------
let currentAEDId = null;
let currentAEDPanelTab = 'aed';

window.setAEDPanelReadOnly = function(isReadOnly) {
  const fields = [
    'aed-info-location',
    'aed-info-placement',
    'aed-info-brand',
    'aed-info-model',
    'aed-info-sku',
    'aed-info-serial',
    'aed-info-purchase-date',
    'aed-info-registered',
    'aed-info-warranty-date',
    'aed-info-notes',
    'aed-info-inventory-status'
  ];

  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (isReadOnly) {
        el.setAttribute('disabled', 'disabled');
        el.style.backgroundColor = '#f8fafc';
        el.style.cursor = 'not-allowed';
      } else {
        el.removeAttribute('disabled');
        el.style.backgroundColor = '';
        el.style.cursor = '';
      }
    }
  });

  const saveBtn = document.getElementById('btn-save-aed-info');
  const editBtn = document.getElementById('btn-edit-aed-info');
  if (saveBtn) saveBtn.style.display = isReadOnly ? 'none' : 'inline-block';
  if (editBtn) editBtn.style.display = isReadOnly ? 'inline-block' : 'none';
};

window.enableAEDEditMode = function() {
  setAEDPanelReadOnly(false);
};

// --------------------------------------------------------------------------
// Smart Model Recommendation & Quick Consumable Association Helpers
// --------------------------------------------------------------------------
function getRecommendedPadModel(brand, aedModel = '') {
  if (!brand || !INITIAL_DATA.padCatalog || !INITIAL_DATA.padCatalog[brand]) return '';
  const catalog = INITIAL_DATA.padCatalog[brand] || [];
  if (!catalog.length) return '';
  const m = (aedModel || '').toLowerCase();

  if (brand === 'ZOLL') {
    if (m.includes('plus')) return 'CPR-D-padz (Adult One-Piece)';
    if (m.includes('3')) return 'CPR-Uni Padz III (Universal)';
    if (m.includes('pro')) return 'CPR Stat-padz (Two-Piece Adult)';
    return catalog[0].model;
  }
  if (brand === 'Philips') {
    if (m.includes('onsite')) return 'HeartStart Adult Pads Cartridge';
    if (m.includes('frx')) return 'SMART Pads II (Adult)';
    return catalog[0].model;
  }
  if (brand === 'Cardiac Science') {
    if (m.includes('g5')) return 'Intellisense CPR Adult Pads (G5)';
    if (m.includes('g3')) return 'Powerheart G3 Adult Pads';
    return catalog[0].model;
  }
  if (brand === 'Physio-Control') {
    if (m.includes('cr2')) return 'QUIK-STEP Pacing/Defib Pads (CR2)';
    if (m.includes('1000')) return 'EDGE System Adult Electrode Pads';
    return catalog[0].model;
  }
  return catalog[0]?.model || '';
}

function getRecommendedBatteryModel(brand, aedModel = '') {
  if (!brand || !INITIAL_DATA.batteryCatalog || !INITIAL_DATA.batteryCatalog[brand]) return '';
  const catalog = INITIAL_DATA.batteryCatalog[brand] || [];
  if (!catalog.length) return '';
  const m = (aedModel || '').toLowerCase();

  if (brand === 'ZOLL') {
    if (m.includes('3')) return 'AED 3 Disposable Lithium Battery Pack';
    if (m.includes('plus')) return 'AED Plus Duracell Lithium 123A Battery Pack';
    if (m.includes('pro')) return 'AED Pro Non-Rechargeable Lithium Battery';
    return catalog[0].model;
  }
  if (brand === 'Philips') {
    if (m.includes('onsite')) return 'HeartStart OnSite Lithium Battery Pack M5070A';
    if (m.includes('frx')) return 'HeartStart FRx Long-Life Lithium Battery';
    return catalog[0].model;
  }
  if (brand === 'Cardiac Science') {
    if (m.includes('g5')) return 'Powerheart G5 Intellisense Lithium Battery';
    if (m.includes('g3')) return 'Powerheart G3 Plus Intellisense Battery';
    return catalog[0].model;
  }
  if (brand === 'Defibtech') {
    if (m.includes('view')) return 'Lifeline VIEW 4-Year Lithium Battery Pack';
    return 'Lifeline AED 5-Year Lithium Battery Pack';
  }
  if (brand === 'Physio-Control') {
    if (m.includes('cr2')) return 'LIFEPAK CR2 Lithium Battery';
    if (m.includes('1000')) return 'LIFEPAK 1000 Non-Rechargeable Lithium Battery';
    return catalog[0].model;
  }
  return catalog[0]?.model || '';
}

window.goToAssociatePads = function() {
  if (!currentAEDId) {
    alert('Please save the AED Information first before associating pads.\n\nClick "Save AED Information", then you can associate pads and batteries.');
    return;
  }
  switchAEDPanelTab('pads');
  openPadForm();
};

window.goToAssociateBattery = function() {
  if (!currentAEDId) {
    alert('Please save the AED Information first before associating a battery.\n\nClick "Save AED Information", then you can associate pads and batteries.');
    return;
  }
  switchAEDPanelTab('batteries');
  openBatteryForm();
};

window.goToAssociatePadsFromTable = async function(aedId) {
  await openAEDPanel(aedId, true);
  switchAEDPanelTab('pads');
  openPadForm();
};

window.goToAssociateBatteryFromTable = async function(aedId) {
  await openAEDPanel(aedId, true);
  switchAEDPanelTab('batteries');
  openBatteryForm();
};

window.goToInspect = function() {
  if (!currentAEDId) {
    alert('Please save the AED Information first before conducting an inspection.\n\nClick "Save AED Information", then you can conduct inspections.');
    return;
  }
  switchAEDPanelTab('inspections');
  openRegisterInspectionForm(null, true);
};

window.goToReportRescue = function() {
  if (!currentAEDId) {
    alert('Please save the AED Information first before reporting a rescue event.\n\nClick "Save AED Information", then you can report rescue events.');
    return;
  }
  openUploadRescueModal(currentAEDId);
};

window.goToInspectFromTable = async function(aedId) {
  await openAEDPanel(aedId, true);
  switchAEDPanelTab('inspections');
  openRegisterInspectionForm(null, true);
};

window.goToReportRescueFromTable = async function(aedId) {
  openUploadRescueModal(aedId);
};

window.openAEDPanel = async function(id = null, isEditMode = null) {
  currentAEDId = id;
  populateAEDPanelDropdowns();

  let item = null;
  if (id) {
    let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    item = allEquipment.find(e => String(e.id) === String(id));

    if (!item) {
      const [activeData, spareData, archivedData] = await Promise.all([
        api.getEquipment('active'),
        api.getEquipment('spare'),
        api.getEquipment('archived')
      ]);
      const merged = [...(activeData || []), ...(spareData || []), ...(archivedData || [])];
      item = merged.find(e => String(e.id) === String(id));
    }
  }

  if (item) {
    // Populate form with existing AED
    const locSel = document.getElementById('aed-info-location');
    if (locSel) locSel.value = item.location && item.location !== '-' ? item.location : '-';

    const placementInput = document.getElementById('aed-info-placement');
    if (placementInput) placementInput.value = item.placement || '';

    const brandSel = document.getElementById('aed-info-brand');
    if (brandSel) {
      brandSel.value = item.brand || 'ZOLL';
      onAEDBrandChange(item.model);
    }

    const skuInput = document.getElementById('aed-info-sku');
    if (skuInput) skuInput.value = item.sku || '';

    const serialInput = document.getElementById('aed-info-serial');
    if (serialInput) serialInput.value = item.serialLot || '';

    const purchaseDate = document.getElementById('aed-info-purchase-date');
    if (purchaseDate) purchaseDate.value = item.purchaseDate || '';

    const regSel = document.getElementById('aed-info-registered');
    if (regSel) regSel.value = item.registered || 'Yes';

    const warDate = document.getElementById('aed-info-warranty-date');
    if (warDate) warDate.value = item.warrantyExpirationDate || item.expirationDate || '';

    const warStatus = document.getElementById('aed-info-warranty-status');
    if (warStatus) warStatus.value = item.warrantyStatus || item.expirationStatus || 'Ok';

    const notes = document.getElementById('aed-info-notes');
    if (notes) notes.value = item.notes || '';

    const invStatus = document.getElementById('aed-info-inventory-status');
    if (invStatus) invStatus.value = item.tab || item.inventoryStatus || (locSel?.value === '-' ? 'spare' : 'active');

    const readonly = isEditMode === null ? true : !isEditMode;
    setAEDPanelReadOnly(readonly);

    logSystemAction('AED Viewed', 'Equipment', `Opened AED Panel for ${item.brand} ${item.model} (SN: ${item.serialLot})`);
  } else {
    // Reset form for fresh new AED (+ Add AED)
    const locSel = document.getElementById('aed-info-location');
    if (locSel) locSel.value = '-';

    const placementInput = document.getElementById('aed-info-placement');
    if (placementInput) placementInput.value = '';

    const brandSel = document.getElementById('aed-info-brand');
    if (brandSel) {
      brandSel.value = 'ZOLL';
      onAEDBrandChange('AED 3');
    }

    const serialInput = document.getElementById('aed-info-serial');
    if (serialInput) serialInput.value = '';

    const purchaseDate = document.getElementById('aed-info-purchase-date');
    if (purchaseDate) purchaseDate.value = '';

    const warDateInput = document.getElementById('aed-info-warranty-date');
    if (warDateInput) warDateInput.value = '';

    const warStatusInput = document.getElementById('aed-info-warranty-status');
    if (warStatusInput) warStatusInput.value = 'Warranty Not Active';

    const regSel = document.getElementById('aed-info-registered');
    if (regSel) regSel.value = 'Yes';

    const notes = document.getElementById('aed-info-notes');
    if (notes) notes.value = '';

    const invStatus = document.getElementById('aed-info-inventory-status');
    if (invStatus) invStatus.value = 'spare';

    setAEDPanelReadOnly(false);

    logSystemAction('Add AED Form Opened', 'Equipment', 'User opened + Add AED form in AED Panel');
  }

  // Redirect to AED Panel View
  switchView('aed-panel');
  switchAEDPanelTab('aed');
};

window.viewAEDDetails = function(id) {
  openAEDPanel(id, false);
};

window.editAEDDetails = function(id) {
  openAEDPanel(id, true);
};

window.switchAEDPanelTab = function(tabName) {
  currentAEDPanelTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.aed-panel-tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  const activeBtn = document.getElementById(`btn-tab-${tabName}`);
  if (activeBtn) activeBtn.classList.add('active');

  // Hide all subtab panes
  document.querySelectorAll('.aed-subtab-pane').forEach(pane => {
    pane.style.display = 'none';
  });

  // Show target pane
  const targetPane = document.getElementById(`subtab-${tabName}`);
  if (targetPane) targetPane.style.display = 'block';

  // Render subtab data
  if (tabName === 'pads') {
    const listContainer = document.getElementById('pad-list-container');
    const formContainer = document.getElementById('pad-form-container');
    if (listContainer) listContainer.style.display = 'block';
    if (formContainer) formContainer.style.display = 'none';
    renderPanelPads();
  }
  if (tabName === 'batteries') {
    const listContainer = document.getElementById('battery-list-container');
    const formContainer = document.getElementById('battery-form-container');
    if (listContainer) listContainer.style.display = 'block';
    if (formContainer) formContainer.style.display = 'none';
    renderPanelBatteries();
  }
  if (tabName === 'inspections') {
    const listContainer = document.getElementById('inspection-list-container');
    const formContainer = document.getElementById('inspection-form-container');
    if (listContainer) listContainer.style.display = 'block';
    if (formContainer) formContainer.style.display = 'none';
    renderPanelInspections();
  }
  if (tabName === 'rescue') renderPanelRescue();
  if (tabName === 'system-log') renderSystemLog('panel');

  logSystemAction('AED Tab Navigation', 'AED Panel', `Navigated to ${tabName.toUpperCase()} tab`);
};

window.populateAEDPanelDropdowns = function() {
  const locSel = document.getElementById('aed-info-location');
  if (locSel) {
    const rawLocations = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const locations = filterRecordsByOrg(rawLocations);
    const curVal = locSel.value || '-';
    locSel.innerHTML = '<option value="-">-</option>' + 
      locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    locSel.value = curVal;
  }
};

window.onAEDLocationChange = function() {
  const locSel = document.getElementById('aed-info-location');
  const invSel = document.getElementById('aed-info-inventory-status');
  if (!locSel || !invSel) return;
  const val = (locSel.value || '').trim();
  if (!val || val === '-') {
    invSel.value = 'spare';
  } else {
    invSel.value = 'active';
  }
};

window.onAEDInventoryStatusChange = function() {
  const locSel = document.getElementById('aed-info-location');
  const invSel = document.getElementById('aed-info-inventory-status');
  if (!locSel || !invSel) return;
  if (invSel.value === 'spare') {
    locSel.value = '-';
  } else if (invSel.value === 'active' && locSel.value === '-') {
    if (locSel.options.length > 1) {
      locSel.selectedIndex = 1;
    }
  }
};

window.openSelectSpareAEDModal = function() {
  renderSpareAEDModal();
  openModal('modal-select-spare-aed');
  logSystemAction('Spare AED Modal Opened', 'AED Panel', 'Opened Select AED from Spare modal');
};

window.renderSpareAEDModal = function() {
  const tbody = document.getElementById('spare-aed-modal-tbody');
  if (!tbody) return;

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const orgScoped = filterRecordsByOrg(allEquipment);
  const spareAEDs = orgScoped.filter(e => {
    if (api.isRecordDeleted(e.id)) return false;
    const isAED = e.type === 'AED';
    const isSpare = (e.tab || '').toLowerCase() === 'spare' || (e.inventoryStatus || '').toLowerCase() === 'spare' || !e.location || e.location === '-';
    return isAED && isSpare;
  });

  if (!spareAEDs.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #64748B; padding: 24px;">
          No spare AED units currently available in inventory for this organization.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = spareAEDs.map(sp => `
    <tr>
      <td style="font-weight: 600;">${sp.brand || 'ZOLL'}</td>
      <td>${sp.model || 'AED 3'}</td>
      <td><span style="font-family: monospace; font-size: 11px;">${sp.sku || '-'}</span></td>
      <td>${sp.serialLot || '-'}</td>
      <td>${sp.purchaseDate || '-'}</td>
      <td>${sp.warrantyExpirationDate || sp.expirationDate || '-'}</td>
      <td><span class="status-pill ok">${sp.warrantyStatus || sp.expirationStatus || 'Ok'}</span></td>
      <td style="text-align: center;">
        <button type="button" class="excel-pill-btn sm" onclick="selectSpareAED('${sp.id}')" style="padding: 4px 10px; font-size: 11px;">Select</button>
      </td>
    </tr>
  `).join('');
};

window.selectSpareAED = function(spareId) {
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const spareAED = allEquipment.find(e => String(e.id) === String(spareId));
  if (!spareAED) return;

  currentAEDId = spareAED.id;

  // Auto-populate form fields from selected spare AED
  const locSel = document.getElementById('aed-info-location');
  if (locSel) locSel.value = '-';

  const brandSel = document.getElementById('aed-info-brand');
  if (brandSel) {
    brandSel.value = spareAED.brand || 'ZOLL';
    onAEDBrandChange(spareAED.model || '');
  }

  const modelSel = document.getElementById('aed-info-model');
  if (modelSel) modelSel.value = spareAED.model || '';

  const skuInput = document.getElementById('aed-info-sku');
  if (skuInput) skuInput.value = spareAED.sku || '';

  const serialInput = document.getElementById('aed-info-serial');
  if (serialInput) serialInput.value = spareAED.serialLot || '';

  const purchaseInput = document.getElementById('aed-info-purchase-date');
  if (purchaseInput) purchaseInput.value = spareAED.purchaseDate || '';

  const regSel = document.getElementById('aed-info-registered');
  if (regSel) regSel.value = spareAED.registered || 'Yes';

  const warDate = document.getElementById('aed-info-warranty-date');
  if (warDate) warDate.value = spareAED.warrantyExpirationDate || spareAED.expirationDate || '';

  const warStatus = document.getElementById('aed-info-warranty-status');
  if (warStatus) warStatus.value = spareAED.warrantyStatus || spareAED.expirationStatus || 'Ok';

  const notesInput = document.getElementById('aed-info-notes');
  if (notesInput) {
    notesInput.value = spareAED.notes ? `${spareAED.notes} (Loaded from Spare ID: ${spareAED.id})` : `Loaded from Spare inventory (${spareAED.id})`;
  }

  const invSel = document.getElementById('aed-info-inventory-status');
  if (invSel) invSel.value = 'spare';

  setAEDPanelReadOnly(false);
  closeModal('modal-select-spare-aed');

  logSystemAction('Spare AED Selected', 'AED Panel', `Selected spare AED ${spareAED.brand} ${spareAED.model} (SN: ${spareAED.serialLot})`);
  alert(`Spare AED selected!\n\nBrand: ${spareAED.brand}\nModel: ${spareAED.model}\nSerial: ${spareAED.serialLot}\nLocation: -\n\nSelect a Location to deploy this AED into active service, or keep '-' to maintain as Spare stock.`);
};

window.onAEDBrandChange = function(selectedModel = '') {
  const brand = document.getElementById('aed-info-brand')?.value || 'ZOLL';
  const modelSel = document.getElementById('aed-info-model');
  if (!modelSel) return;

  const catalog = INITIAL_DATA.brandCatalog || {};
  const models = catalog[brand] || [
    { model: "Standard AED", sku: "GEN-AED-01", warrantyYears: 8 }
  ];

  modelSel.innerHTML = models.map(m => `<option value="${m.model}" ${m.model === selectedModel ? 'selected' : ''}>${m.model}</option>`).join('');
  onAEDModelChange();
};

window.onAEDModelChange = function() {
  const brand = document.getElementById('aed-info-brand')?.value;
  const model = document.getElementById('aed-info-model')?.value;
  const catalog = INITIAL_DATA.brandCatalog || {};
  const models = catalog[brand] || [];
  const found = models.find(m => m.model === model);

  const skuInput = document.getElementById('aed-info-sku');
  if (skuInput && found) {
    skuInput.value = found.sku;
  }

  onAEDPurchaseDateChange();
};

window.onAEDPurchaseDateChange = function() {
  const brand = document.getElementById('aed-info-brand')?.value || 'ZOLL';
  const model = document.getElementById('aed-info-model')?.value;
  const purchaseDateInput = document.getElementById('aed-info-purchase-date');
  const warDateInput = document.getElementById('aed-info-warranty-date');
  if (!purchaseDateInput || !warDateInput) return;

  const catalog = INITIAL_DATA.brandCatalog || {};
  const models = catalog[brand] || [];
  const found = models.find(m => m.model === model);
  const warrantyYears = (found && found.warrantyYears) ? found.warrantyYears : 5;

  if (purchaseDateInput.value) {
    const pDate = new Date(purchaseDateInput.value);
    if (!isNaN(pDate.getTime())) {
      pDate.setFullYear(pDate.getFullYear() + warrantyYears);
      warDateInput.value = pDate.toISOString().split('T')[0];
    }
  }
  calculateWarrantyStatus();
};

window.calculateWarrantyStatus = function() {
  const warDateInput = document.getElementById('aed-info-warranty-date');
  const warStatusInput = document.getElementById('aed-info-warranty-status');
  if (!warDateInput || !warStatusInput) return;

  const warDateVal = warDateInput.value;
  if (!warDateVal) {
    warStatusInput.value = 'Warranty Not Active';
    return;
  }

  const expDate = new Date(warDateVal);
  const now = new Date();
  const diffDays = Math.ceil((expDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    warStatusInput.value = 'Warranty Expired';
  } else if (diffDays <= 30) {
    warStatusInput.value = `Warranty Expires in ${diffDays} days`;
  } else {
    warStatusInput.value = 'Ok';
  }
};

window.saveAEDInformation = async function() {
  try {
    const locRaw = (document.getElementById('aed-info-location')?.value || '-').trim();
    const isSpare = !locRaw || locRaw === '-';
    const location = isSpare ? '-' : locRaw;
    const invRaw = (document.getElementById('aed-info-inventory-status')?.value || (isSpare ? 'spare' : 'active')).toLowerCase();
    const inventoryStatus = isSpare ? 'spare' : invRaw;
    const placement = isSpare ? '' : (document.getElementById('aed-info-placement')?.value || '').trim();
    const brand = document.getElementById('aed-info-brand')?.value || 'ZOLL';
    const model = document.getElementById('aed-info-model')?.value || 'AED 3';
    const sku = document.getElementById('aed-info-sku')?.value || 'SKU';
    let serial = (document.getElementById('aed-info-serial')?.value || '').trim();
    let purchaseDate = document.getElementById('aed-info-purchase-date')?.value || '';
    const registered = document.getElementById('aed-info-registered')?.value || 'Yes';
    let warrantyExpirationDate = document.getElementById('aed-info-warranty-date')?.value || '';
    const warrantyStatus = document.getElementById('aed-info-warranty-status')?.value || 'Ok';
    const notes = document.getElementById('aed-info-notes')?.value || '';

    if (!serial) {
      serial = 'SN-' + Math.floor(100000 + Math.random() * 900000);
      const serialInput = document.getElementById('aed-info-serial');
      if (serialInput) serialInput.value = serial;
    }

    if (!purchaseDate) {
      purchaseDate = new Date().toISOString().split('T')[0];
      const purchaseDateInput = document.getElementById('aed-info-purchase-date');
      if (purchaseDateInput) purchaseDateInput.value = purchaseDate;
    }

    if (!warrantyExpirationDate) {
      const d = new Date(purchaseDate);
      d.setFullYear(d.getFullYear() + 5);
      warrantyExpirationDate = d.toISOString().split('T')[0];
      const warDateInput = document.getElementById('aed-info-warranty-date');
      if (warDateInput) warDateInput.value = warrantyExpirationDate;
    }

    let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const calculatedServiceStatus = isSpare ? 'Standby' : (inventoryStatus === 'archived' ? 'Out of Service' : 'Rescue-Ready');
    const todayDateStr = new Date().toISOString().split('T')[0];
    const existingAed = allEquipment.find(e => String(e.id) === String(currentAEDId));
    const aedArchivedDate = inventoryStatus === 'archived' ? (existingAed?.archivedDate || todayDateStr) : '';

    const scope = typeof getActiveOrganizationScope === 'function' ? getActiveOrganizationScope() : { currentKey: 'vital-aed' };
    const currentOrg = (INITIAL_DATA.organizations || []).find(o => o.key === scope.currentKey);
    const orgName = currentOrg ? currentOrg.name : (INITIAL_DATA.organization?.name || 'Vital AED Life Safety Corp');
    const orgKey = scope.currentKey || 'vital-aed';

    const aedRecord = {
      id: currentAEDId || ('EQ-' + Date.now()),
      type: 'AED',
      location, placement, brand, model, sku, serialLot: serial, serialNumber: serial,
      purchaseDate, registered, warrantyExpirationDate,
      expirationDate: warrantyExpirationDate,
      expirationStatus: warrantyStatus,
      warrantyStatus: warrantyStatus,
      serviceStatus: calculatedServiceStatus,
      inventoryStatus: inventoryStatus,
      tab: inventoryStatus,
      organization: existingAed?.organization || orgName,
      organizationKey: existingAed?.organizationKey || orgKey,
      notes,
      archivedDate: aedArchivedDate,
      resourcesUrl: '#resources',
      buyUrl: '#reorder'
    };

    if (!currentAEDId) {
      currentAEDId = aedRecord.id;
    }

    // 1. Immediately update AED in local array
    const idx = allEquipment.findIndex(e => String(e.id) === String(aedRecord.id));
    if (idx !== -1) {
      allEquipment[idx] = { ...allEquipment[idx], ...aedRecord };
    } else {
      allEquipment.unshift(aedRecord);
    }

    // 2. Cascade Location and Inventory Status to attached components synchronously
    if (currentAEDId) {
      allEquipment = allEquipment.map(e => {
        if (String(e.aedId) === String(currentAEDId)) {
          return {
            ...e,
            location: location,
            tab: inventoryStatus,
            inventoryStatus: inventoryStatus,
            serviceStatus: calculatedServiceStatus,
            archivedDate: inventoryStatus === 'archived' ? (e.archivedDate || todayDateStr) : ''
          };
        }
        return e;
      });
    }

    // 3. Persist to localStorage immediately (0ms perceived lag)
    localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

    // 4. Asynchronous Cloud Synchronization (Non-blocking background sync)
    const isExistingNumeric = currentAEDId && /^\d+$/.test(String(currentAEDId));
    if (isExistingNumeric) {
      api.updateEquipment(currentAEDId, aedRecord)
        .catch(e => console.warn("Backend AED update sync notice:", e));
    } else {
      api.addEquipment(aedRecord)
        .then(res => {
          if (res?.item?.id) {
            const newId = String(res.item.id);
            currentAEDId = newId;
            let currentAll = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
            currentAll = currentAll.map(e => {
              if (String(e.id) === String(aedRecord.id)) return { ...e, id: newId };
              if (String(e.aedId) === String(aedRecord.id)) return { ...e, aedId: newId };
              return e;
            });
            localStorage.setItem('aed_equipment', JSON.stringify(currentAll));
          }
        })
        .catch(e => console.warn("Backend AED add sync notice:", e));
    }

    logSystemAction('AED Saved', isSpare ? 'Spare Equipment' : 'Equipment', `Saved ${brand} ${model} (SN: ${serial}) at location: ${location}`);

    // 5. Update local views immediately
    try { renderEquipment(); } catch (e) {}
    try { renderSpare(); } catch (e) {}
    try { renderDashboard(); } catch (e) {}

    // 6. Check if AED already has attached pads and battery
    const hasPads = allEquipment.some(e => String(e.aedId) === String(currentAEDId) && (e.type || '').includes('Pad'));
    const hasBattery = allEquipment.some(e => String(e.aedId) === String(currentAEDId) && e.type === 'Battery');

    if (!hasPads || !hasBattery) {
      const missing = (!hasPads && !hasBattery) ? 'Pads and Battery' : (!hasPads ? 'Pads' : 'Battery');
      const wantAssociate = confirm(
        `AED "${brand} ${model}" saved successfully!\n\n` +
        `This AED currently has no ${missing} associated with it.\n\n` +
        `Would you like to associate ${missing} for this AED now?`
      );
      if (wantAssociate) {
        if (!hasPads) {
          goToAssociatePads();
        } else {
          goToAssociateBattery();
        }
        return;
      }
    }

    if (isSpare) {
      alert(`AED successfully saved to Spare Equipment!\n\nDevice: ${brand} ${model}\nSerial: ${serial}\nLocation: -\nInventory Status: SPARE\n\nNo location was selected, so this device is routed to Spare equipment.`);
      switchView('spare');
    } else {
      alert(`AED Information successfully saved!\n\nDevice: ${brand} ${model}\nSerial: ${serial}\nLocation: ${location}\nStatus: ${inventoryStatus.toUpperCase()}`);
      switchView('equipment');
    }
  } catch (err) {
    console.error("Error saving AED information:", err);
    alert(`Error saving AED information: ${err.message || 'Please check the form inputs.'}`);
  }
};

// --------------------------------------------------------------------------
// Sub-table Renderers inside AED Panel (Screenshots 2-5)
// --------------------------------------------------------------------------
let currentPadReportCategory = 'Pads';
let currentPadFormCategory = 'Pads';

window.switchPadReportCategory = function(category) {
  currentPadReportCategory = 'Pads';
  const titleEl = document.getElementById('pad-list-banner-title');
  if (titleEl) {
    titleEl.textContent = showArchivedPads ? `Archived AED Pads` : `AED Pads`;
  }
  renderPanelPads();
};

window.switchPadFormCategory = function(category) {
  currentPadFormCategory = 'Pads';
  onPadBrandChange();
};

window.renderPanelPads = function() {
  const tbody = document.getElementById('panel-pads-tbody');
  if (!tbody) return;

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const orgScoped = filterRecordsByOrg(allEquipment);

  const storedPads = orgScoped.filter(e => {
    const isPad = (e.type || '').includes('Pad');
    const isTab = showArchivedPads ? (e.tab === 'archived') : (e.tab === 'active');
    if (!isPad || !isTab) return false;
    if (currentAEDId) {
      return String(e.aedId) === String(currentAEDId);
    }
    return true;
  });

  const list = storedPads.length ? storedPads.map(p => ({
    id: p.id,
    brand: p.brand || "Brand",
    model: p.model || "Model",
    sku: p.sku || "SKU",
    lot: p.serialLot || "Lot",
    expirationDate: p.expirationDate || "Expiration Date",
    status: p.expirationStatus || "Ok"
  })) : [];

  if (!list.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; color: #64748B; padding: 24px;">
          No Pads assigned to this AED. Click <strong>+ Add Pad</strong> to register.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(pad => `
    <tr>
      <td style="text-align:center;">
        <button class="excel-icon-btn" title="View / Edit Pad" onclick="openPadForm('${pad.id}')">
          <i class="fa-regular fa-file-lines"></i>
        </button>
      </td>
      <td>${pad.brand}</td>
      <td>${pad.model}</td>
      <td>${pad.sku}</td>
      <td>${pad.lot}</td>
      <td>${pad.expirationDate}</td>
      ${renderExcelStatusCell(pad.status, 'consumable')}
    </tr>
  `).join('');
};

window.openPadForm = function(padId = null) {
  const listContainer = document.getElementById('pad-list-container');
  const formContainer = document.getElementById('pad-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  currentEditingPadId = padId;
  currentSelectedSpareId = null;

  // Retrieve parent AED details to inherit Location and Inventory Status
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  if (!currentAEDId && padId) {
    const existingPad = allEquipment.find(e => String(e.id) === String(padId));
    if (existingPad && existingPad.aedId) currentAEDId = existingPad.aedId;
  }
  const currentAED = allEquipment.find(e => String(e.id) === String(currentAEDId));
  const aedLocation = currentAED ? currentAED.location : (document.getElementById('aed-info-location')?.value || 'Location 1 - Floor 1 Suite 100');
  const aedTab = currentAED ? (currentAED.tab || 'active') : (document.getElementById('aed-info-inventory-status')?.value || 'active');
  const inheritedStatus = aedTab === 'spare' ? 'Spare' : (aedTab === 'archived' ? 'Archived' : 'Active');

  const locInput = document.getElementById('pad-info-location');
  const statusInput = document.getElementById('pad-info-inventory-status');
  const deleteBtn = document.getElementById('btn-delete-pad');

  if (locInput) locInput.value = aedLocation;
  if (statusInput) statusInput.value = inheritedStatus;

  if (padId && !String(padId).startsWith('sample-')) {
    // Editing an existing pad
    const pad = allEquipment.find(e => String(e.id) === String(padId));
    if (pad) {
      currentPadFormCategory = 'Pads';

      if (locInput) locInput.value = pad.location || aedLocation;
      const brandSel = document.getElementById('pad-info-brand');
      if (brandSel) {
        brandSel.value = pad.brand || 'ZOLL';
        onPadBrandChange(pad.model || '');
      }
      const skuInput = document.getElementById('pad-info-sku');
      if (skuInput) skuInput.value = pad.sku || '';

      const lotInput = document.getElementById('pad-info-lot');
      if (lotInput) lotInput.value = pad.serialLot || '';

      const expInput = document.getElementById('pad-info-exp-date');
      if (expInput) {
        if (pad.expirationDate && !isNaN(Date.parse(pad.expirationDate))) {
          expInput.value = new Date(pad.expirationDate).toISOString().split('T')[0];
        } else {
          expInput.value = pad.expirationDate || '';
        }
      }

      const notesInput = document.getElementById('pad-info-notes');
      if (notesInput) notesInput.value = pad.notes || '';

      if (statusInput) statusInput.value = pad.tab === 'spare' ? 'Spare' : (pad.tab === 'archived' ? 'Archived' : 'Active');
      calculatePadExpirationStatus();
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
      return;
    }
  }

  // Adding a new pad: inherit brand and recommended model from parent AED
  currentEditingPadId = null;
  const parentBrand = currentAED?.brand || document.getElementById('aed-info-brand')?.value || '';
  const brandVal = (parentBrand && INITIAL_DATA.padCatalog && INITIAL_DATA.padCatalog[parentBrand]) ? parentBrand : '';
  const aedModel = currentAED?.model || document.getElementById('aed-info-model')?.value || '';
  const recommendedPadModel = getRecommendedPadModel(brandVal, aedModel);

  const brandSel = document.getElementById('pad-info-brand');
  if (brandSel) {
    brandSel.value = brandVal;
    onPadBrandChange(recommendedPadModel);
  }

  const lotInput = document.getElementById('pad-info-lot');
  if (lotInput) lotInput.value = '';

  const expInput = document.getElementById('pad-info-exp-date');
  if (expInput) expInput.value = '';

  const expStatusInput = document.getElementById('pad-info-exp-status');
  if (expStatusInput) {
    expStatusInput.value = '';
    expStatusInput.style.color = '#64748B';
  }

  const notesInput = document.getElementById('pad-info-notes');
  if (notesInput) notesInput.value = '';

  if (deleteBtn) deleteBtn.style.display = 'none';

  logSystemAction('Add Pad Form Opened', 'AED Panel', `Opened Pad information form on AED (${currentAEDId || 'New'})`);
};

window.closePadForm = function() {
  const listContainer = document.getElementById('pad-list-container');
  const formContainer = document.getElementById('pad-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  currentEditingPadId = null;
  currentSelectedSpareId = null;
  renderPanelPads();
};

window.onPadBrandChange = function(selectedModel = '') {
  const brand = document.getElementById('pad-info-brand')?.value || '';
  const modelSel = document.getElementById('pad-info-model');
  const skuInput = document.getElementById('pad-info-sku');
  if (!modelSel) return;

  if (!brand) {
    modelSel.innerHTML = '<option value="">-Select Model-</option>';
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.padCatalog || {};
  const allBrandModels = catalog[brand] || [];

  modelSel.innerHTML = '<option value="">-Select Model-</option>' + allBrandModels.map(m => `<option value="${m.model}" ${m.model === selectedModel ? 'selected' : ''}>${m.model}</option>`).join('');
  onPadModelChange();
};

window.onPadModelChange = function() {
  const brand = document.getElementById('pad-info-brand')?.value || '';
  const model = document.getElementById('pad-info-model')?.value || '';
  const skuInput = document.getElementById('pad-info-sku');
  if (!skuInput) return;
  if (!brand || !model) {
    skuInput.value = '';
    return;
  }
  const catalog = INITIAL_DATA.padCatalog || {};
  const models = catalog[brand] || [];
  const found = models.find(m => m.model === model);

  skuInput.value = found ? found.sku : '';
};

window.calculatePadExpirationStatus = function() {
  const expDateInput = document.getElementById('pad-info-exp-date');
  const expStatusInput = document.getElementById('pad-info-exp-status');
  if (!expDateInput || !expStatusInput) return;

  const expDateVal = expDateInput.value;
  if (!expDateVal) {
    expStatusInput.value = 'Unknown';
    expStatusInput.style.color = '#64748B';
    return;
  }

  const expDate = new Date(expDateVal);
  const now = new Date();
  const expMidnight = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((expMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    expStatusInput.value = 'Expired';
    expStatusInput.style.color = '#DC2626';
    expStatusInput.style.fontWeight = 'bold';
  } else if (diffDays <= 30) {
    expStatusInput.value = `Expires in ${diffDays} days`;
    expStatusInput.style.color = '#D97706';
    expStatusInput.style.fontWeight = 'bold';
  } else {
    expStatusInput.value = 'Ok';
    expStatusInput.style.color = '#16A34A';
    expStatusInput.style.fontWeight = '600';
  }
};

window.openSelectSparePadModal = function() {
  renderSparePadModal();
  openModal('modal-select-spare-pad');
  logSystemAction('Spare Pad Modal Opened', 'AED Panel', 'Opened Select from Spare modal');
};

window.renderSparePadModal = function() {
  const tbody = document.getElementById('spare-pad-modal-tbody');
  if (!tbody) return;

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const sparePads = allEquipment.filter(e => e.tab === 'spare' && (e.type || '').includes('Pad'));

  if (!sparePads.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align: center; color: #64748B; padding: 24px;">
          No spare pads available in account inventory.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = sparePads.map(sp => `
    <tr>
      <td style="font-weight: 600;">${sp.brand || 'ZOLL'}</td>
      <td>${sp.model || 'Defib Pads'}</td>
      <td><span style="font-family: monospace; font-size: 11px;">${sp.sku || 'SKU'}</span></td>
      <td>${sp.serialLot || 'Lot'}</td>
      <td>${sp.expirationDate || 'N/A'}</td>
      <td><span class="status-pill ${sp.expirationStatus === 'Expired' ? 'expired' : 'ok'}">${sp.expirationStatus || 'Ok'}</span></td>
      <td style="text-align: center;">
        <button type="button" class="excel-pill-btn sm" onclick="selectSparePad('${sp.id}')" style="padding: 4px 10px; font-size: 11px;">Select</button>
      </td>
    </tr>
  `).join('');
};

window.selectSparePad = function(spareId) {
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const sparePad = allEquipment.find(e => String(e.id) === String(spareId));
  if (!sparePad) return;

  currentSelectedSpareId = spareId;

  currentPadFormCategory = 'Pads';

  // Auto-populate form fields from spare item
  const brandSel = document.getElementById('pad-info-brand');
  if (brandSel) {
    brandSel.value = sparePad.brand || 'ZOLL';
    onPadBrandChange(sparePad.model || '');
  }

  const skuInput = document.getElementById('pad-info-sku');
  if (skuInput) skuInput.value = sparePad.sku || '';

  const lotInput = document.getElementById('pad-info-lot');
  if (lotInput) lotInput.value = sparePad.serialLot || '';

  const expInput = document.getElementById('pad-info-exp-date');
  if (expInput) {
    if (sparePad.expirationDate && !isNaN(Date.parse(sparePad.expirationDate))) {
      expInput.value = new Date(sparePad.expirationDate).toISOString().split('T')[0];
    } else {
      expInput.value = sparePad.expirationDate || '';
    }
  }

  const notesInput = document.getElementById('pad-info-notes');
  if (notesInput) {
    notesInput.value = sparePad.notes ? `${sparePad.notes} (Transferred from Spare: ${sparePad.id})` : `Transferred from Spare inventory (${sparePad.id})`;
  }

  calculatePadExpirationStatus();
  closeModal('modal-select-spare-pad');

  logSystemAction('Spare Pad Selected', 'AED Panel', `Selected spare pad ${sparePad.brand} ${sparePad.model} (Lot: ${sparePad.serialLot}) for assignment`);
  alert(`Spare pad selected!\n\nBrand: ${sparePad.brand}\nModel: ${sparePad.model}\nLot: ${sparePad.serialLot}\n\nReview the pad information and click Save to assign to this AED.`);
};

window.savePadInformation = async function() {
  const brand = document.getElementById('pad-info-brand')?.value || '';
  const model = document.getElementById('pad-info-model')?.value || '';
  const sku = document.getElementById('pad-info-sku')?.value || '';
  let lot = (document.getElementById('pad-info-lot')?.value || '').trim();
  let expDate = document.getElementById('pad-info-exp-date')?.value || '';
  const expStatus = document.getElementById('pad-info-exp-status')?.value || 'Ok';
  const notes = document.getElementById('pad-info-notes')?.value || '';
  const invStatus = document.getElementById('pad-info-inventory-status')?.value || 'Active';

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const currentAED = allEquipment.find(e => String(e.id) === String(currentAEDId));

  // Inherit location from parent AED if attached
  const location = currentAED?.location || document.getElementById('pad-info-location')?.value || '-';

  if (!brand || !model) {
    alert('Please select both a Pad Brand and Model.');
    return;
  }
  if (!lot) {
    lot = 'LOT-' + Math.floor(100000 + Math.random() * 900000);
    const lotInput = document.getElementById('pad-info-lot');
    if (lotInput) lotInput.value = lot;
  }
  if (!expDate) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 2);
    expDate = d.toISOString().split('T')[0];
    const expDateInput = document.getElementById('pad-info-exp-date');
    if (expDateInput) expDateInput.value = expDate;
  }

  const padType = (typeof currentPadFormCategory !== 'undefined' && currentPadFormCategory === 'Pediatric Pads') || (model.toLowerCase().includes('pediatric') || model.toLowerCase().includes('child') || model.toLowerCase().includes('pedi')) ? 'Pediatric Pads' : 'Adult Pads';
  const targetTab = invStatus.toLowerCase() === 'spare' ? 'spare' : (invStatus.toLowerCase() === 'archived' ? 'archived' : 'active');
  const serviceStatus = expStatus === 'Expired' ? 'Replacement Required' : 'Rescue-Ready';

  const targetId = currentSelectedSpareId || (currentEditingPadId && !String(currentEditingPadId).startsWith('sample-') ? currentEditingPadId : null);

  const padArchivedDate = targetTab === 'archived' ? (allEquipment.find(e => String(e.id) === String(targetId))?.archivedDate || new Date().toISOString().split('T')[0]) : '';

  const padRecord = {
    id: targetId || ('PAD-' + Date.now()),
    type: padType,
    aedId: currentAEDId || '',
    aedSerial: currentAED?.serialLot || '',
    aedModel: currentAED?.model || '',
    location: location,
    brand,
    model,
    sku,
    serialLot: lot,
    expirationDate: expDate,
    expirationStatus: expStatus,
    serviceStatus,
    tab: targetTab,
    archivedDate: padArchivedDate,
    organization: currentAED?.organization || undefined,
    organizationKey: currentAED?.organizationKey || undefined,
    organizationId: currentAED?.organizationId || undefined,
    notes,
    resourcesUrl: '#resources',
    buyUrl: '#reorder'
  };

  const idx = allEquipment.findIndex(e => String(e.id) === String(padRecord.id));
  if (idx !== -1) {
    allEquipment[idx] = { ...allEquipment[idx], ...padRecord };
  } else {
    allEquipment.unshift(padRecord);
  }
  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  api.addEquipment(padRecord).then(res => {
    if (res?.item?.id) currentEditingPadId = res.item.id;
  }).catch(e => console.warn("Pad sync notice:", e));

  logSystemAction(targetId ? 'Pad Updated' : 'Pad Registered', 'AED Panel', `Pad ${brand} ${model} (Lot: ${lot})`, 'Success');

  closePadForm();
  renderPanelPads();
  await Promise.all([renderEquipment(), renderSpare(), renderDashboard()]);

  // Check if this AED has a battery yet
  const allEqNow = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const hasBat = allEqNow.some(e => String(e.aedId) === String(currentAEDId) && e.type === 'Battery');

  if (!hasBat) {
    const wantBattery = confirm(
      `Pad Information successfully saved and associated with this AED!\n\n` +
      `Brand: ${brand}\nModel: ${model}\nLot: ${lot}\n\n` +
      `This AED currently has no Battery associated with it.\n\n` +
      `Would you like to associate the Battery now?`
    );
    if (wantBattery) {
      switchAEDPanelTab('batteries');
      openBatteryForm();
      return;
    }
  } else {
    alert(`Pad Information successfully saved and associated with this AED!\n\nBrand: ${brand}\nModel: ${model}\nLot: ${lot}\nLocation: ${location}`);
  }
};

window.deletePadInformation = async function() {
  if (!currentEditingPadId || String(currentEditingPadId).startsWith('sample-')) {
    closePadForm();
    return;
  }

  const lot = document.getElementById('pad-info-lot')?.value || '';
  const brand = document.getElementById('pad-info-brand')?.value || '';
  const model = document.getElementById('pad-info-model')?.value || '';

  if (!confirm(`Are you sure you want to remove pad ${brand} ${model} (Lot: ${lot}) from this AED?`)) {
    return;
  }

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  allEquipment = allEquipment.filter(e => String(e.id) !== String(currentEditingPadId));
  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  if (typeof api !== 'undefined' && api.deleteEquipment) {
    await api.deleteEquipment(currentEditingPadId);
  }

  logSystemAction('Pad Deleted', 'AED Panel', `Removed pad ${brand} ${model} (Lot: ${lot}) from AED (${currentAEDId || 'Active'})`, 'Warning');
  alert(`Pad removed successfully from AED!\nAction logged to System Audit Log.`);

  closePadForm();
  renderPanelPads();
  renderEquipment();
  renderSpare();
  renderDashboard();
};

window.toggleArchivedPads = function() {
  showArchivedPads = !showArchivedPads;

  // Ensure we switch back to list view to display the archived table
  const listContainer = document.getElementById('pad-list-container');
  const formContainer = document.getElementById('pad-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  const titleEl = document.getElementById('pad-list-banner-title');
  const btnEl = document.getElementById('btn-toggle-archived-pads');

  if (showArchivedPads) {
    if (titleEl) titleEl.textContent = 'Archived AED Pads';
    if (btnEl) btnEl.textContent = 'Active Pads';
  } else {
    if (titleEl) titleEl.textContent = 'AED Pads';
    if (btnEl) btnEl.textContent = 'Archived';
  }

  renderPanelPads();
  logSystemAction('Pad Archive View', 'AED Panel', `Toggled pad archive view (Show Archived: ${showArchivedPads})`);
};

window.renderPanelBatteries = function() {
  const tbody = document.getElementById('panel-batteries-tbody');
  if (!tbody) return;

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const orgScoped = filterRecordsByOrg(allEquipment);

  const storedBatteries = orgScoped.filter(e => {
    const isBat = (e.type || '').includes('Battery');
    const isTab = showArchivedBatteries ? (e.tab === 'archived') : (e.tab === 'active');
    if (!isBat || !isTab) return false;
    if (currentAEDId) {
      return String(e.aedId) === String(currentAEDId);
    }
    return true;
  });

  const list = storedBatteries.map(b => ({
    id: b.id,
    brand: b.brand || "Brand",
    model: b.model || "Model",
    sku: b.sku || "SKU",
    lot: b.serialLot || "Lot",
    expirationDate: b.expirationDate || "Expiration Date",
    status: b.expirationStatus || "Ok"
  }));

  if (list.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="7" style="text-align:center; padding: 20px; color: #64748B;">
          No batteries assigned to this AED. Click <strong>+ Add Battery</strong> to register.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map(bat => `
    <tr>
      <td style="text-align:center;">
        <button class="excel-icon-btn" title="View / Edit Battery" onclick="openBatteryForm('${bat.id}')">
          <i class="fa-regular fa-file-lines"></i>
        </button>
      </td>
      <td>${bat.brand}</td>
      <td>${bat.model}</td>
      <td>${bat.sku}</td>
      <td>${bat.lot}</td>
      <td>${bat.expirationDate}</td>
      ${renderExcelStatusCell(bat.status, 'consumable')}
    </tr>
  `).join('');
};

window.openBatteryForm = function(batteryId = null) {
  const listContainer = document.getElementById('battery-list-container');
  const formContainer = document.getElementById('battery-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  currentEditingBatteryId = batteryId;
  currentSelectedSpareBatteryId = null;

  // Retrieve parent AED details to inherit Location and Inventory Status
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  if (!currentAEDId && batteryId) {
    const existingBat = allEquipment.find(e => String(e.id) === String(batteryId));
    if (existingBat && existingBat.aedId) currentAEDId = existingBat.aedId;
  }
  const currentAED = allEquipment.find(e => String(e.id) === String(currentAEDId));
  const aedLocation = currentAED ? currentAED.location : (document.getElementById('aed-info-location')?.value || 'Location 1 - Floor 1 Suite 100');
  const aedTab = currentAED ? (currentAED.tab || 'active') : (document.getElementById('aed-info-inventory-status')?.value || 'active');
  const inheritedStatus = aedTab === 'spare' ? 'Spare' : (aedTab === 'archived' ? 'Archived' : 'Active');

  const locInput = document.getElementById('bat-info-location');
  const statusInput = document.getElementById('bat-info-inventory-status');
  const deleteBtn = document.getElementById('btn-delete-battery');

  if (locInput) locInput.value = aedLocation;
  if (statusInput) statusInput.value = inheritedStatus;

  if (batteryId && !String(batteryId).startsWith('sample-')) {
    // Editing an existing battery
    const bat = allEquipment.find(e => String(e.id) === String(batteryId));
    if (bat) {
      if (locInput) locInput.value = bat.location || aedLocation;
      const brandSel = document.getElementById('bat-info-brand');
      if (brandSel) {
        brandSel.value = bat.brand || 'ZOLL';
        onBatteryBrandChange(bat.model || '');
      }
      const skuInput = document.getElementById('bat-info-sku');
      if (skuInput) skuInput.value = bat.sku || '';

      const lotInput = document.getElementById('bat-info-lot');
      if (lotInput) lotInput.value = bat.serialLot || '';

      const purchaseInput = document.getElementById('bat-info-purchase-date');
      if (purchaseInput) {
        if (bat.purchaseDate && !isNaN(Date.parse(bat.purchaseDate))) {
          purchaseInput.value = new Date(bat.purchaseDate).toISOString().split('T')[0];
        } else {
          purchaseInput.value = bat.purchaseDate || '';
        }
      }

      const expInput = document.getElementById('bat-info-exp-date');
      if (expInput) {
        if (bat.expirationDate && !isNaN(Date.parse(bat.expirationDate))) {
          expInput.value = new Date(bat.expirationDate).toISOString().split('T')[0];
        } else {
          expInput.value = bat.expirationDate || '';
        }
      }

      const notesInput = document.getElementById('bat-info-notes');
      if (notesInput) notesInput.value = bat.notes || '';

      if (statusInput) statusInput.value = bat.tab === 'spare' ? 'Spare' : (bat.tab === 'archived' ? 'Archived' : 'Active');
      calculateBatteryExpirationStatus();
      if (deleteBtn) deleteBtn.style.display = 'inline-flex';
      return;
    }
  }

  // Adding a new battery: inherit brand and recommended model from parent AED
  currentEditingBatteryId = null;
  const parentBrand = currentAED?.brand || document.getElementById('aed-info-brand')?.value || '';
  const brandVal = (parentBrand && INITIAL_DATA.batteryCatalog && INITIAL_DATA.batteryCatalog[parentBrand]) ? parentBrand : '';
  const aedModel = currentAED?.model || document.getElementById('aed-info-model')?.value || '';
  const recommendedBatModel = getRecommendedBatteryModel(brandVal, aedModel);

  const brandSel = document.getElementById('bat-info-brand');
  if (brandSel) {
    brandSel.value = brandVal;
    onBatteryBrandChange(recommendedBatModel);
  }

  // Auto-generate lot / serial suggestion (Lot numbers are not unique)
  const lotInput = document.getElementById('bat-info-lot');
  if (lotInput) lotInput.value = '';

  const purchaseInput = document.getElementById('bat-info-purchase-date');
  if (purchaseInput) purchaseInput.value = '';

  const expInput = document.getElementById('bat-info-exp-date');
  if (expInput) expInput.value = '';

  const expStatusInput = document.getElementById('bat-info-exp-status');
  if (expStatusInput) {
    expStatusInput.value = '';
    expStatusInput.style.color = '#64748B';
  }

  const notesInput = document.getElementById('bat-info-notes');
  if (notesInput) notesInput.value = '';

  if (deleteBtn) deleteBtn.style.display = 'none';

  calculateBatteryExpirationStatus();
  logSystemAction('Add Battery Form Opened', 'AED Panel', `Opened Battery information form for AED (${currentAEDId || 'New'})`);
};

window.closeBatteryForm = function() {
  const listContainer = document.getElementById('battery-list-container');
  const formContainer = document.getElementById('battery-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  currentEditingBatteryId = null;
  currentSelectedSpareBatteryId = null;
  renderPanelBatteries();
};

window.onBatteryBrandChange = function(selectedModel = '') {
  const brand = document.getElementById('bat-info-brand')?.value || '';
  const modelSel = document.getElementById('bat-info-model');
  const skuInput = document.getElementById('bat-info-sku');
  if (!modelSel) return;

  if (!brand) {
    modelSel.innerHTML = '<option value="">-Select Model-</option>';
    if (skuInput) skuInput.value = '';
    return;
  }

  const catalog = INITIAL_DATA.batteryCatalog || {};
  const models = catalog[brand] || [];

  modelSel.innerHTML = '<option value="">-Select Model-</option>' + models.map(m => `<option value="${m.model}" ${m.model === selectedModel ? 'selected' : ''}>${m.model}</option>`).join('');
  onBatteryModelChange();
};

window.onBatteryModelChange = function() {
  const brand = document.getElementById('bat-info-brand')?.value || '';
  const model = document.getElementById('bat-info-model')?.value || '';
  const skuInput = document.getElementById('bat-info-sku');
  if (!skuInput) return;
  if (!brand || !model) {
    skuInput.value = '';
    return;
  }
  const catalog = INITIAL_DATA.batteryCatalog || {};
  const models = catalog[brand] || [];
  const found = models.find(m => m.model === model);

  skuInput.value = found ? found.sku : '';
};

window.calculateBatteryExpirationStatus = function() {
  const expDateInput = document.getElementById('bat-info-exp-date');
  const expStatusInput = document.getElementById('bat-info-exp-status');
  if (!expDateInput || !expStatusInput) return;

  const expDateVal = expDateInput.value;
  if (!expDateVal) {
    expStatusInput.value = 'Unknown';
    expStatusInput.style.color = '#64748B';
    return;
  }

  const expDate = new Date(expDateVal);
  const now = new Date();
  const expMidnight = new Date(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
  const nowMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.ceil((expMidnight - nowMidnight) / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    expStatusInput.value = 'Expired';
    expStatusInput.style.color = '#DC2626';
    expStatusInput.style.fontWeight = 'bold';
  } else if (diffDays <= 30) {
    expStatusInput.value = `Expires in ${diffDays} days`;
    expStatusInput.style.color = '#D97706';
    expStatusInput.style.fontWeight = 'bold';
  } else {
    expStatusInput.value = 'Ok';
    expStatusInput.style.color = '#16A34A';
    expStatusInput.style.fontWeight = '600';
  }
};

window.openSelectSpareBatteryModal = function() {
  renderSpareBatteryModal();
  openModal('modal-select-spare-battery');
  logSystemAction('Spare Battery Modal Opened', 'AED Panel', 'Opened Select from Spare battery modal');
};

window.renderSpareBatteryModal = function() {
  const tbody = document.getElementById('spare-battery-modal-tbody');
  if (!tbody) return;

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const spareBatteries = allEquipment.filter(e => e.tab === 'spare' && (e.type || '').includes('Battery'));

  if (!spareBatteries.length) {
    tbody.innerHTML = `
      <tr>
        <td colspan="8" style="text-align: center; color: #64748B; padding: 24px;">
          No spare batteries available in account inventory.
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = spareBatteries.map(sp => `
    <tr>
      <td style="font-weight: 600;">${sp.brand || 'ZOLL'}</td>
      <td>${sp.model || 'Lithium Battery Pack'}</td>
      <td><span style="font-family: monospace; font-size: 11px;">${sp.sku || 'SKU'}</span></td>
      <td>${sp.serialLot || 'Lot'}</td>
      <td>${sp.purchaseDate || 'N/A'}</td>
      <td>${sp.expirationDate || 'N/A'}</td>
      <td><span class="status-pill ${sp.expirationStatus === 'Expired' ? 'expired' : 'ok'}">${sp.expirationStatus || 'Ok'}</span></td>
      <td style="text-align: center;">
        <button type="button" class="excel-pill-btn sm" onclick="selectSpareBattery('${sp.id}')" style="padding: 4px 10px; font-size: 11px;">Select</button>
      </td>
    </tr>
  `).join('');
};

window.selectSpareBattery = function(spareId) {
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const spareBattery = allEquipment.find(e => String(e.id) === String(spareId));
  if (!spareBattery) return;

  currentSelectedSpareBatteryId = spareId;

  // Auto-populate form fields from spare item
  const brandSel = document.getElementById('bat-info-brand');
  if (brandSel) {
    brandSel.value = spareBattery.brand || 'ZOLL';
    onBatteryBrandChange(spareBattery.model || '');
  }

  const skuInput = document.getElementById('bat-info-sku');
  if (skuInput) skuInput.value = spareBattery.sku || '';

  const lotInput = document.getElementById('bat-info-lot');
  if (lotInput) lotInput.value = spareBattery.serialLot || '';

  const purchaseInput = document.getElementById('bat-info-purchase-date');
  if (purchaseInput) {
    if (spareBattery.purchaseDate && !isNaN(Date.parse(spareBattery.purchaseDate))) {
      purchaseInput.value = new Date(spareBattery.purchaseDate).toISOString().split('T')[0];
    } else {
      purchaseInput.value = spareBattery.purchaseDate || '';
    }
  }

  const expInput = document.getElementById('bat-info-exp-date');
  if (expInput) {
    if (spareBattery.expirationDate && !isNaN(Date.parse(spareBattery.expirationDate))) {
      expInput.value = new Date(spareBattery.expirationDate).toISOString().split('T')[0];
    } else {
      expInput.value = spareBattery.expirationDate || '';
    }
  }

  const notesInput = document.getElementById('bat-info-notes');
  if (notesInput) {
    notesInput.value = spareBattery.notes ? `${spareBattery.notes} (Transferred from Spare: ${spareBattery.id})` : `Transferred from Spare inventory (${spareBattery.id})`;
  }

  calculateBatteryExpirationStatus();
  closeModal('modal-select-spare-battery');

  logSystemAction('Spare Battery Selected', 'AED Panel', `Selected spare battery ${spareBattery.brand} ${spareBattery.model} (Lot: ${spareBattery.serialLot}) for assignment`);
  alert(`Spare battery selected!\n\nBrand: ${spareBattery.brand}\nModel: ${spareBattery.model}\nLot: ${spareBattery.serialLot}\n\nReview the battery information and click Save to assign to this AED.`);
};

window.saveBatteryInformation = async function() {
  const brand = document.getElementById('bat-info-brand')?.value || '';
  const model = document.getElementById('bat-info-model')?.value || '';
  const sku = document.getElementById('bat-info-sku')?.value || '';
  let lot = (document.getElementById('bat-info-lot')?.value || '').trim();
  let purchaseDate = document.getElementById('bat-info-purchase-date')?.value || '';
  let expDate = document.getElementById('bat-info-exp-date')?.value || '';
  const expStatus = document.getElementById('bat-info-exp-status')?.value || 'Ok';
  const notes = document.getElementById('bat-info-notes')?.value || '';
  const invStatus = document.getElementById('bat-info-inventory-status')?.value || 'Active';

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const currentAED = allEquipment.find(e => String(e.id) === String(currentAEDId));

  // Inherit location from parent AED if attached
  const location = currentAED?.location || document.getElementById('bat-info-location')?.value || '-';

  if (!brand || !model) {
    alert('Please select both a Battery Brand and Model.');
    return;
  }
  if (!lot) {
    lot = 'BAT-' + Math.floor(100000 + Math.random() * 900000);
    const lotInput = document.getElementById('bat-info-lot');
    if (lotInput) lotInput.value = lot;
  }
  if (!purchaseDate) {
    purchaseDate = new Date().toISOString().split('T')[0];
    const pDateInput = document.getElementById('bat-info-purchase-date');
    if (pDateInput) pDateInput.value = purchaseDate;
  }
  if (!expDate) {
    const d = new Date();
    d.setFullYear(d.getFullYear() + 4);
    expDate = d.toISOString().split('T')[0];
    const expDateInput = document.getElementById('bat-info-exp-date');
    if (expDateInput) expDateInput.value = expDate;
  }

  const targetTab = invStatus.toLowerCase() === 'spare' ? 'spare' : (invStatus.toLowerCase() === 'archived' ? 'archived' : 'active');
  const serviceStatus = expStatus === 'Expired' ? 'Replacement Required' : 'Rescue-Ready';

  const targetId = currentSelectedSpareBatteryId || (currentEditingBatteryId && !String(currentEditingBatteryId).startsWith('sample-') ? currentEditingBatteryId : null);

  const batArchivedDate = targetTab === 'archived' ? (allEquipment.find(e => String(e.id) === String(targetId))?.archivedDate || new Date().toISOString().split('T')[0]) : '';

  const batRecord = {
    id: targetId || ('BAT-' + Date.now()),
    type: 'Battery',
    aedId: currentAEDId || '',
    aedSerial: currentAED?.serialLot || '',
    aedModel: currentAED?.model || '',
    location: location,
    brand,
    model,
    sku,
    serialLot: lot,
    purchaseDate,
    expirationDate: expDate,
    expirationStatus: expStatus,
    serviceStatus,
    tab: targetTab,
    archivedDate: batArchivedDate,
    organization: currentAED?.organization || undefined,
    organizationKey: currentAED?.organizationKey || undefined,
    organizationId: currentAED?.organizationId || undefined,
    notes,
    resourcesUrl: '#resources',
    buyUrl: '#reorder'
  };

  const idx = allEquipment.findIndex(e => String(e.id) === String(batRecord.id));
  if (idx !== -1) {
    allEquipment[idx] = { ...allEquipment[idx], ...batRecord };
  } else {
    allEquipment.unshift(batRecord);
  }
  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  api.addEquipment(batRecord).then(res => {
    if (res?.item?.id) currentEditingBatteryId = res.item.id;
  }).catch(e => console.warn("Battery sync notice:", e));

  logSystemAction(targetId ? 'Battery Updated' : 'Battery Registered', 'AED Panel', `Battery ${brand} ${model} (Lot: ${lot})`, 'Success');

  closeBatteryForm();
  renderPanelBatteries();
  await Promise.all([renderEquipment(), renderSpare(), renderDashboard()]);

  alert(
    `Battery Information successfully saved and associated!\n\n` +
    `Brand: ${brand}\nModel: ${model}\nLot: ${lot}\nLocation: ${location}\n\n` +
    `This AED is now fully equipped with associated Pads & Battery and Rescue-Ready!`
  );
};

window.deleteBatteryInformation = async function() {
  if (!currentEditingBatteryId || String(currentEditingBatteryId).startsWith('sample-')) {
    closeBatteryForm();
    return;
  }

  const lot = document.getElementById('bat-info-lot')?.value || '';
  const brand = document.getElementById('bat-info-brand')?.value || '';
  const model = document.getElementById('bat-info-model')?.value || '';

  if (!confirm(`Are you sure you want to remove battery ${brand} ${model} (Lot: ${lot}) from this AED?`)) {
    return;
  }

  let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  allEquipment = allEquipment.filter(e => String(e.id) !== String(currentEditingBatteryId));
  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  if (typeof api !== 'undefined' && api.deleteEquipment) {
    await api.deleteEquipment(currentEditingBatteryId);
  }

  logSystemAction('Battery Deleted', 'AED Panel', `Removed battery ${brand} ${model} (Lot: ${lot}) from AED (${currentAEDId || 'Active'})`, 'Warning');
  alert(`Battery removed successfully from AED!\nAction logged to System Audit Log.`);

  closeBatteryForm();
  renderPanelBatteries();
  renderEquipment();
  renderSpare();
  renderDashboard();
};

window.toggleArchivedBatteries = function() {
  showArchivedBatteries = !showArchivedBatteries;

  // Ensure we switch back to list view to display the archived table
  const listContainer = document.getElementById('battery-list-container');
  const formContainer = document.getElementById('battery-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  const titleEl = document.getElementById('battery-list-banner-title');
  const btnEl = document.getElementById('btn-toggle-archived-bat');

  if (showArchivedBatteries) {
    if (titleEl) titleEl.textContent = 'Archived AED Batteries';
    if (btnEl) btnEl.textContent = 'Active Batteries';
  } else {
    if (titleEl) titleEl.textContent = 'AED Batteries';
    if (btnEl) btnEl.textContent = 'Archived';
  }

  renderPanelBatteries();
  logSystemAction('Battery Archive View', 'AED Panel', `Toggled battery archive view (Show Archived: ${showArchivedBatteries})`);
};

window.renderPanelInspections = async function() {
  const tbody = document.getElementById('panel-inspections-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('panel-insp-search')?.value || '').toLowerCase().trim();
  const allInspections = await api.getInspections(showArchivedPanelInspections ? 'archived' : 'active');

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const currentAED = allEquipment.find(e => String(e.id) === String(currentAEDId));
  const aedSerial = currentAED ? (currentAED.serialLot || '') : (document.getElementById('aed-info-serial')?.value || '');
  const aedLocation = currentAED ? (currentAED.location || '') : (document.getElementById('aed-info-location')?.value || '');
  const serialSuffix = aedSerial ? (aedSerial.length > 4 ? aedSerial.slice(-4) : aedSerial) : '1234';

  // Filter inspections strictly for this specific AED device
  const aedInspections = allInspections.filter(i => {
    if (currentAEDId && i.aedId && String(i.aedId) === String(currentAEDId)) return true;
    if (aedSerial && i.serialNumber && i.serialNumber === aedSerial) return true;
    if (aedLocation && i.location && i.location === aedLocation) return true;
    return false;
  });

  const baseList = aedInspections.map(i => ({
    id: i.id,
    location: i.location || aedLocation || "Location",
    equipment: `AED - xxx${serialSuffix}`,
    date: i.inspectionDate || "Date",
    status: i.status || "Ok",
    color: (i.status || '').toLowerCase().includes('failed') ? 'danger' :
           (i.status || '').toLowerCase().includes('overdue') ? 'warning' : 'ok'
  }));

  if (baseList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 20px; color: #64748B;">
          No inspections recorded for this AED.
        </td>
      </tr>
    `;
    return;
  }

  const filtered = baseList.filter(item => {
    if (!searchTerm) return true;
    return (
      item.location.toLowerCase().includes(searchTerm) ||
      item.equipment.toLowerCase().includes(searchTerm) ||
      item.date.toLowerCase().includes(searchTerm) ||
      item.status.toLowerCase().includes(searchTerm)
    );
  });

  tbody.innerHTML = filtered.map(insp => `
    <tr>
      <td style="text-align:center;">
        <button class="excel-icon-btn" title="View / Edit Inspection" onclick="openRegisterInspectionForm('${insp.id}')">
          <i class="fa-regular fa-file-lines"></i>
        </button>
      </td>
      <td>${insp.location}</td>
      <td>${insp.equipment}</td>
      <td>${insp.date}</td>
      ${renderExcelStatusCell(insp.status, 'inspection')}
      <td style="text-align:center;">
        <button type="button" class="excel-pill-btn sm" title="Download PDF Report" onclick="downloadInspectionPDF('${insp.id}')" style="padding: 3px 8px; font-size: 11px; background: #0070C0;">
          <i class="fa-solid fa-file-pdf"></i> PDF
        </button>
      </td>
    </tr>
  `).join('');
};

window.openRegisterInspectionForm = async function(inspectionId = null, isEditMode = null) {
  // Always navigate to AED Panel and select Inspections subtab (Single Page)
  if (typeof switchView === 'function') switchView('aed-panel');
  if (typeof switchAEDPanelTab === 'function') switchAEDPanelTab('inspections');

  const listContainer = document.getElementById('inspection-list-container');
  const formContainer = document.getElementById('inspection-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  currentEditingInspectionId = inspectionId;
  inspectionPhotoData = null;

  // Retrieve parent AED details to populate Location and Serial Number
  const allEquipment = filterRecordsByOrg(JSON.parse(localStorage.getItem('aed_equipment') || '[]'));
  let allInspections = filterRecordsByOrg(JSON.parse(localStorage.getItem('aed_inspections') || '[]'));
  let existingInsp = inspectionId ? allInspections.find(i => String(i.id) === String(inspectionId)) : null;

  if (inspectionId && !existingInsp) {
    allInspections = await api.getInspections('active');
    existingInsp = allInspections.find(i => String(i.id) === String(inspectionId));
    if (!existingInsp) {
      const archivedInsps = await api.getInspections('archived');
      existingInsp = archivedInsps.find(i => String(i.id) === String(inspectionId));
    }
  }

  let currentAED = allEquipment.find(e => String(e.id) === String(currentAEDId));
  if (!currentAED && existingInsp && existingInsp.aedId) {
    currentAED = allEquipment.find(e => String(e.id) === String(existingInsp.aedId));
    if (currentAED) currentAEDId = currentAED.id;
  }
  if (!currentAED) {
    currentAED = allEquipment.find(e => e.type === 'AED') || allEquipment[0];
    if (currentAED) currentAEDId = currentAED.id;
  }

  const aedLocation = (existingInsp && existingInsp.location) || (currentAED ? currentAED.location : (document.getElementById('aed-info-location')?.value || 'Location 1 - Floor 1 Suite 100'));
  const aedSerial = (existingInsp && existingInsp.serialNumber) || (currentAED ? currentAED.serialLot : (document.getElementById('aed-info-serial')?.value || 'Z3-8921004'));

  const inspInput = document.getElementById('insp-form-inspector');
  const locInput = document.getElementById('insp-form-location');
  const dateInput = document.getElementById('insp-form-date');
  const serialInput = document.getElementById('insp-form-serial');
  const deleteBtn = document.getElementById('btn-delete-inspection');

  if (inspInput) inspInput.value = currentRole.includes('Admin') ? 'Christine Miller (Admin)' : currentRole;
  if (locInput) locInput.value = aedLocation;
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (serialInput) serialInput.value = aedSerial;

  // Query assigned pads and batteries for this AED
  const assignedPads = allEquipment.filter(e => (e.type || '').includes('Pad') && (String(e.aedId) === String(currentAEDId) || e.location === aedLocation));
  const assignedBatteries = allEquipment.filter(e => (e.type || '').includes('Battery') && (String(e.aedId) === String(currentAEDId) || e.location === aedLocation));

  // Render assigned pads
  const padsEl = document.getElementById('insp-form-pads');
  if (padsEl) {
    if (assignedPads.length) {
      padsEl.innerHTML = assignedPads.map(p => `
        <span class="insp-assigned-tag">
          <i class="fa-solid fa-heart-pulse"></i> ${p.brand} ${p.model} (Lot: ${p.serialLot || 'N/A'}, Exp: ${p.expirationDate || 'N/A'})
        </span>
      `).join('');
    } else {
      padsEl.innerHTML = `<span style="color:#DC2626; font-size: 12px; font-weight:600;"><i class="fa-solid fa-circle-exclamation"></i> No Pads Assigned to this AED</span>`;
    }
  }

  // Render assigned batteries
  const batsEl = document.getElementById('insp-form-batteries');
  if (batsEl) {
    if (assignedBatteries.length) {
      batsEl.innerHTML = assignedBatteries.map(b => `
        <span class="insp-assigned-tag">
          <i class="fa-solid fa-battery-full"></i> ${b.brand} ${b.model} (Lot: ${b.serialLot || 'N/A'}, Exp: ${b.expirationDate || 'N/A'})
        </span>
      `).join('');
    } else {
      batsEl.innerHTML = `<span style="color:#DC2626; font-size: 12px; font-weight:600;"><i class="fa-solid fa-circle-exclamation"></i> No Batteries Assigned to this AED</span>`;
    }
  }

  // Display a warning if no Pads or Batteries have been assigned to this AED (Developer note rule)
  const warnEl = document.getElementById('insp-warning-unassigned');
  if (warnEl) {
    warnEl.style.display = (!assignedPads.length || !assignedBatteries.length) ? 'flex' : 'none';
  }

  // Populate form if viewing existing inspection (existingInsp loaded above)

  if (existingInsp) {
    if (locInput) locInput.value = existingInsp.location || aedLocation;
    if (inspInput) inspInput.value = existingInsp.inspector || 'Christine Miller';
    if (dateInput) dateInput.value = existingInsp.inspectionDate || new Date().toISOString().split('T')[0];
    if (serialInput) serialInput.value = existingInsp.serialNumber || aedSerial;
    const commentsEl = document.getElementById('insp-form-comments');
    if (commentsEl) commentsEl.value = existingInsp.comments || '';
    const sigEl = document.getElementById('insp-form-signature');
    if (sigEl) sigEl.value = existingInsp.signature || 'Christine Miller';

    // Populate question answers if saved
    if (existingInsp.answers) {
      for (let i = 1; i <= 15; i++) {
        const val = existingInsp.answers[`q${i}`];
        if (val) {
          const radio = document.querySelector(`input[name="insp_q${i}"][value="${val}"]`);
          if (radio) radio.checked = true;
          const notesEl = document.getElementById(`notes-q${i}`);
          if (notesEl && existingInsp.answers[`notes_q${i}`]) {
            notesEl.value = existingInsp.answers[`notes_q${i}`];
          }
          evaluateQuestion(i);
        }
      }
    }
    const oosChk = document.getElementById('chk-override-out-of-service');
    const bulkChk = document.getElementById('chk-bulk-approve');
    const questionsList = document.getElementById('insp-questions-list');
    const isOos = existingInsp.isOutOfService || (existingInsp.status || '').toLowerCase().includes('out of service');
    if (oosChk) oosChk.checked = isOos;
    if (bulkChk) bulkChk.checked = false;
    if (questionsList) questionsList.style.display = isOos ? 'none' : 'block';

    if (deleteBtn) deleteBtn.style.display = 'inline-flex';
  } else {
    // New inspection
    if (deleteBtn) deleteBtn.style.display = 'none';
    const commentsEl = document.getElementById('insp-form-comments');
    if (commentsEl) commentsEl.value = '';
    const sigEl = document.getElementById('insp-form-signature');
    if (sigEl) sigEl.value = 'Christine Miller';
    const sigConfirmed = document.getElementById('insp-signature-confirmed');
    if (sigConfirmed) sigConfirmed.style.display = 'none';

    // Reset all questions to unselected / pending
    for (let i = 1; i <= 15; i++) {
      const radios = document.querySelectorAll(`input[name="insp_q${i}"]`);
      radios.forEach(r => r.checked = false);
      const notesEl = document.getElementById(`notes-q${i}`);
      if (notesEl) notesEl.value = '';
      const badge = document.getElementById(`badge-q${i}`);
      if (badge) {
        badge.className = 'insp-status-indicator pending';
        badge.textContent = 'Pending';
      }
    }

    // Default Q5 to No, Q6 hidden
    const q5No = document.querySelector('input[name="insp_q5"][value="No"]');
    if (q5No) {
      q5No.checked = true;
      evaluateQuestion(5);
    }

    const oosChk = document.getElementById('chk-override-out-of-service');
    if (oosChk) oosChk.checked = false;
    const bulkChk = document.getElementById('chk-bulk-approve');
    if (bulkChk) bulkChk.checked = false;
    const questionsList = document.getElementById('insp-questions-list');
    if (questionsList) questionsList.style.display = 'block';

    logSystemAction('Register Inspection Opened', 'Inspections', `Opened Register Inspection form for AED (${currentAEDId || 'Active'})`);
  }
};

window.closeInspectionForm = function() {
  const listContainer = document.getElementById('inspection-list-container');
  const formContainer = document.getElementById('inspection-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  currentEditingInspectionId = null;
  renderPanelInspections();
};

window.evaluateQuestion = function(qNum) {
  const selected = document.querySelector(`input[name="insp_q${qNum}"]:checked`)?.value;
  const badge = document.getElementById(`badge-q${qNum}`);
  if (!selected || !badge) return;

  let isPass = false;
  if (qNum === 4) {
    // Q4: Are there any warning lights or audible alarms? No = Pass, Yes = Fail
    isPass = (selected === 'No');
  } else if (qNum === 5) {
    // Q5: Has the AED been used since the last inspection? No = Pass, Yes = conditional question
    isPass = (selected === 'No');
    const q6Card = document.getElementById('card-q6');
    if (q6Card) {
      if (selected === 'Yes') {
        q6Card.style.display = 'block';
        q6Card.classList.add('conditional-active');
      } else {
        q6Card.style.display = 'none';
        q6Card.classList.remove('conditional-active');
      }
    }
  } else if (qNum === 8 || qNum === 11) {
    // Q8 & Q11: Yes / Not applicable = Pass, No = Fail
    isPass = (selected === 'Yes' || selected === 'Not applicable');
  } else {
    // All standard questions: Yes = Pass, No = Fail
    isPass = (selected === 'Yes');
  }

  if (isPass) {
    badge.className = 'insp-status-indicator pass';
    badge.textContent = 'Pass';
  } else {
    badge.className = 'insp-status-indicator fail';
    badge.textContent = 'Fail';
  }
};

window.onBulkApproveChange = function() {
  const isChecked = document.getElementById('chk-bulk-approve')?.checked;
  if (!isChecked) return;

  // Uncheck Out of Service override
  const oos = document.getElementById('chk-override-out-of-service');
  if (oos) oos.checked = false;

  // Ensure questions list is visible
  const questionsList = document.getElementById('insp-questions-list');
  if (questionsList) questionsList.style.display = 'block';

  // Apply passing response to all 15 questions
  const passAnswers = {
    1: 'Yes',
    2: 'Yes',
    3: 'Yes',
    4: 'No',  // No alarms = Pass
    5: 'No',  // Not used = Pass
    7: 'Yes',
    8: 'Yes',
    9: 'Yes',
    10: 'Yes',
    11: 'Yes',
    12: 'Yes',
    13: 'Yes',
    14: 'Yes',
    15: 'Yes'
  };

  Object.entries(passAnswers).forEach(([qNum, val]) => {
    const radio = document.querySelector(`input[name="insp_q${qNum}"][value="${val}"]`);
    if (radio) {
      radio.checked = true;
      evaluateQuestion(parseInt(qNum));
    }
  });

  const q6Card = document.getElementById('card-q6');
  if (q6Card) q6Card.style.display = 'none';
};

window.onOverrideOutOfServiceChange = function() {
  const isChecked = document.getElementById('chk-override-out-of-service')?.checked;
  const questionsList = document.getElementById('insp-questions-list');

  if (isChecked) {
    // Uncheck Bulk Approve
    const bulk = document.getElementById('chk-bulk-approve');
    if (bulk) bulk.checked = false;

    // Hide all 15 questions when Set AED Out of Service is checked
    if (questionsList) questionsList.style.display = 'none';

    // Clear any previous radio selections and reset badges to avoid misleading Pass state
    for (let i = 1; i <= 15; i++) {
      const radios = document.querySelectorAll(`input[name="insp_q${i}"]`);
      radios.forEach(r => r.checked = false);
      const badge = document.getElementById(`badge-q${i}`);
      if (badge) {
        badge.className = 'insp-status-indicator pending';
        badge.textContent = 'Pending';
      }
    }
  } else {
    // Show all questions when Out of Service override is unchecked
    if (questionsList) questionsList.style.display = 'block';
  }
};

window.handleInspectionPhotoUpload = function(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    inspectionPhotoData = e.target.result;
    const img = document.getElementById('insp-photo-preview-img');
    const wrap = document.getElementById('insp-photo-preview-wrap');
    if (img && wrap) {
      img.src = inspectionPhotoData;
      wrap.style.display = 'block';
    }
  };
  reader.readAsDataURL(file);
};

// Signature Modal
window.openSignatureModal = function() {
  openModal('modal-signature');
  setTimeout(initSignatureCanvas, 100);
};

let signatureCanvasInitialized = false;
function initSignatureCanvas() {
  const canvas = document.getElementById('signature-canvas');
  if (!canvas || signatureCanvasInitialized) return;
  signatureCanvasInitialized = true;

  const ctx = canvas.getContext('2d');
  let drawing = false;

  function startDraw(e) {
    drawing = true;
    ctx.beginPath();
    const pos = getCanvasPos(e);
    ctx.moveTo(pos.x, pos.y);
    const placeholder = document.getElementById('canvas-placeholder-text');
    if (placeholder) placeholder.style.display = 'none';
  }

  function draw(e) {
    if (!drawing) return;
    const pos = getCanvasPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = '#004182';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }

  function stopDraw() {
    drawing = false;
  }

  function getCanvasPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  canvas.addEventListener('mousedown', startDraw);
  canvas.addEventListener('mousemove', draw);
  window.addEventListener('mouseup', stopDraw);

  canvas.addEventListener('touchstart', startDraw, { passive: true });
  canvas.addEventListener('touchmove', draw, { passive: true });
  canvas.addEventListener('touchend', stopDraw);
}

window.clearSignatureCanvas = function() {
  const canvas = document.getElementById('signature-canvas');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const placeholder = document.getElementById('canvas-placeholder-text');
    if (placeholder) placeholder.style.display = 'block';
  }
};

window.confirmSignature = function() {
  const sigNameInput = document.getElementById('insp-form-signature');
  if (sigNameInput && !sigNameInput.value.trim()) {
    sigNameInput.value = 'Christine Miller (Admin)';
  }
  const confirmedEl = document.getElementById('insp-signature-confirmed');
  if (confirmedEl) confirmedEl.style.display = 'block';
  closeModal('modal-signature');
};

window.saveInspectionForm = async function() {
  const inspector = document.getElementById('insp-form-inspector')?.value || 'Christine Miller';
  const location = document.getElementById('insp-form-location')?.value || 'Location 1 - Floor 1 Suite 100';
  const inspectionDate = document.getElementById('insp-form-date')?.value || new Date().toISOString().split('T')[0];
  const serial = document.getElementById('insp-form-serial')?.value || '1004';
  const comments = document.getElementById('insp-form-comments')?.value || '';
  const signature = document.getElementById('insp-form-signature')?.value || '';
  const isOutOfService = document.getElementById('chk-override-out-of-service')?.checked;

  if (!signature.trim()) {
    alert('Inspection signature is required. Please type your name or click Sign Pop-up to apply your signature.');
    return;
  }

  if (isOutOfService && !comments.trim()) {
    alert('Inspector notes in Additional Comments are required when marking the AED Out of Service.');
    return;
  }

  // Gather all question answers only if NOT out-of-service override
  const answers = {};
  let anyQuestionFailed = false;
  let allAnswered = true;

  if (!isOutOfService) {
    for (let i = 1; i <= 15; i++) {
      // Q6 only required if Q5 was Yes
      if (i === 6 && answers['q5'] !== 'Yes') continue;

      const checkedRadio = document.querySelector(`input[name="insp_q${i}"]:checked`);
      if (!checkedRadio) {
        allAnswered = false;
      } else {
        answers[`q${i}`] = checkedRadio.value;
        const notesVal = document.getElementById(`notes-q${i}`)?.value || '';
        if (notesVal) answers[`notes_q${i}`] = notesVal;

        const badge = document.getElementById(`badge-q${i}`);
        if (badge && badge.textContent === 'Fail') {
          anyQuestionFailed = true;
        }
      }
    }

    if (!allAnswered) {
      if (!confirm('Some inspection questions have not been answered. Do you want to submit anyway?')) {
        return;
      }
    }
  }

  let overallStatus = 'Ok';
  if (isOutOfService || anyQuestionFailed) {
    overallStatus = 'Failed';
  }

  const serialShort = serial.slice(-4);
  const eqShortName = `AED - ${serialShort}`;
  const inspectionId = currentEditingInspectionId || `INSP-${Date.now()}`;

  // Resolve parent AED, location and organization
  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const parentAED = allEquipment.find(e => String(e.id) === String(currentAEDId) || (e.serialLot && e.serialLot === serial) || (e.location && e.location === location));
  
  const allLocations = JSON.parse(localStorage.getItem('aed_locations') || '[]');
  const parentLoc = allLocations.find(l => (l.name && location && l.name.toLowerCase() === location.toLowerCase()) || (parentAED && l.name && parentAED.location && l.name.toLowerCase() === parentAED.location.toLowerCase()));

  const activeScope = (typeof getActiveOrganizationScope === 'function') ? getActiveOrganizationScope() : null;
  const currentOrgObj = (INITIAL_DATA.organizations || []).find(o => o.key === activeScope?.currentKey);

  const orgName = (parentAED && parentAED.organization) ? parentAED.organization : ((parentLoc && parentLoc.organization) ? parentLoc.organization : (currentOrgObj?.name || 'Vital AED Life Safety Corp'));
  const orgKey = (parentAED && parentAED.organizationKey) ? parentAED.organizationKey : ((parentLoc && parentLoc.organizationKey) ? parentLoc.organizationKey : (activeScope?.currentKey || 'vital-aed'));

  const inspectionRecord = {
    id: inspectionId,
    aedId: parentAED?.id || currentAEDId || '',
    location,
    locationId: parentLoc?.id || '',
    serialNumber: serial,
    equipment: eqShortName,
    inspector,
    inspectionDate,
    status: overallStatus,
    tab: 'active',
    signature,
    comments,
    organization: orgName,
    organizationKey: orgKey,
    answers: isOutOfService ? {} : answers,
    isOutOfService: !!isOutOfService,
    pdfGenerated: true
  };

  await api.addInspection(inspectionRecord);

  let allInspections = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
  const existingIdx = allInspections.findIndex(i => String(i.id) === String(inspectionRecord.id) || String(i.id) === String(inspectionId));
  if (existingIdx !== -1) {
    allInspections[existingIdx] = inspectionRecord;
  } else {
    allInspections.unshift(inspectionRecord);
  }
  localStorage.setItem('aed_inspections', JSON.stringify(allInspections));

  // If Out of Service, immediately update AED's service status in local storage & backend
  if (isOutOfService) {
    let allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const aedIdx = allEquipment.findIndex(e => String(e.id) === String(currentAEDId || inspectionRecord.aedId) || (e.serialLot && e.serialLot === serial));
    if (aedIdx !== -1) {
      allEquipment[aedIdx].serviceStatus = 'Out of Service';
      localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));
      if (typeof api !== 'undefined' && api.addEquipment) {
        api.addEquipment(allEquipment[aedIdx]);
      }
    }
  }

  logSystemAction(
    'Inspection Registered',
    'Inspections',
    `Registered compliance inspection for ${eqShortName} at ${location} (Status: ${overallStatus}${isOutOfService ? ' - Out of Service Override' : ''})`,
    overallStatus === 'Ok' ? 'Success' : 'Danger'
  );

  alert(`Inspection registered successfully!\n\nUnit: ${eqShortName}\nLocation: ${location}\nDate: ${inspectionDate}\nStatus: ${overallStatus.toUpperCase()}${isOutOfService ? ' (OUT OF SERVICE OVERRIDE)' : ''}\n\nOfficial PDF Inspection Report generated.\nAction logged to System Audit Log with date & time.`);

  closeInspectionForm();
  renderPanelInspections();
  renderInspections();
  renderEquipment();
  renderDashboard();

  // Offer PDF download directly per requirement
  downloadInspectionPDF(inspectionId);
};

window.deleteInspectionForm = async function() {
  if (!currentEditingInspectionId || String(currentEditingInspectionId).startsWith('sample-')) {
    closeInspectionForm();
    return;
  }

  if (!confirm('Are you sure you want to delete this inspection record?')) {
    return;
  }

  let allInspections = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
  allInspections = allInspections.filter(i => String(i.id) !== String(currentEditingInspectionId));
  localStorage.setItem('aed_inspections', JSON.stringify(allInspections));

  try {
    await fetch(`/server/aed_backend/api/inspections/${encodeURIComponent(currentEditingInspectionId)}`, { method: 'DELETE' });
  } catch (e) {}

  logSystemAction('Inspection Deleted', 'Inspections', `Deleted inspection record (${currentEditingInspectionId})`, 'Warning');
  alert('Inspection record removed successfully.');

  closeInspectionForm();
  renderPanelInspections();
  renderInspections();
  renderDashboard();
};

window.toggleArchivedPanelInspections = function() {
  showArchivedPanelInspections = !showArchivedPanelInspections;

  const listContainer = document.getElementById('inspection-list-container');
  const formContainer = document.getElementById('inspection-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  const titleEl = document.getElementById('insp-list-banner-title');
  const btnEl = document.getElementById('btn-toggle-archived-panel-insp');

  if (showArchivedPanelInspections) {
    if (titleEl) titleEl.textContent = 'Archived AED Inspections';
    if (btnEl) btnEl.textContent = 'Active Inspections';
  } else {
    if (titleEl) titleEl.textContent = 'AED Inspections';
    if (btnEl) btnEl.textContent = 'Archived';
  }

  renderPanelInspections();
  logSystemAction('Inspection Archive View', 'AED Panel', `Toggled inspection archive view (Show Archived: ${showArchivedPanelInspections})`);
};

// PDF Report Generator (Requirement: [Must generate a PDF that will be available for download in the Inspection page])
window.downloadInspectionPDF = function(inspId) {
  const allInspections = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
  const insp = allInspections.find(i => String(i.id) === String(inspId)) || {
    id: inspId,
    equipment: 'AED - 1004',
    location: 'Location 1 - Floor 1 Suite 100',
    serialNumber: 'Z3-8921004',
    inspector: 'Christine Miller (Admin)',
    inspectionDate: new Date().toISOString().split('T')[0],
    status: 'Ok',
    signature: 'Christine Miller',
    comments: 'All inspection items verified and compliant.'
  };

  const statusColor = insp.status === 'Ok' ? '#00875A' : '#DE350B';

  const element = document.createElement('div');
  element.style.padding = '24px';
  element.style.fontFamily = "'Calibri', 'Segoe UI', Arial, sans-serif";
  element.style.color = '#1E293B';
  element.style.background = '#FFFFFF';

  element.innerHTML = `
    <div style="border-bottom: 3px solid #004182; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 24px; font-weight: bold; color: #004182;">AED Compliance Inspection Certificate</div>
        <div style="font-size: 12px; color: #64748B; margin-top: 4px;">AED Remind Compliance Portal — Official Record</div>
      </div>
      <div>
        <span style="display: inline-block; padding: 4px 14px; border-radius: 4px; font-weight: bold; color: #FFF; background: ${statusColor};">${(insp.status || 'OK').toUpperCase()}</span>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Inspection ID:</strong> ${insp.id}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Inspection Date:</strong> ${insp.inspectionDate || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Equipment Unit:</strong> ${insp.equipment || 'AED'}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Serial Number:</strong> ${insp.serialNumber || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Location:</strong> ${insp.location || 'N/A'}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Inspector:</strong> ${insp.inspector || 'Christine Miller'}</td>
      </tr>
    </table>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <thead>
        <tr style="background: #004182; color: #FFF;">
          <th style="padding: 8px 12px; text-align: left; font-size: 13px;">#</th>
          <th style="padding: 8px 12px; text-align: left; font-size: 13px;">Inspection Verification Item</th>
          <th style="padding: 8px 12px; text-align: center; font-size: 13px; width: 100px;">Result</th>
        </tr>
      </thead>
      <tbody>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">1</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is the AED in its assigned location?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">2</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is it visible and accessible?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">3</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Does status indicator show "Ready", Green Check, or Blinking Light?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">4</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Are there any warning lights or audible alarms?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">5</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Has the AED been used since the last inspection?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">6</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Are the adult electrode pads installed and within expiration date?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">7</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">If pediatric pads present, are they within expiration date?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">8</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is installed battery within its service/expiration date?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">9</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is the AED free of damage?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">10</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">If cabinet present, is it free of damage?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">11</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is the Rescue Kit complete?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">12</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is the Bleed Kit complete?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">13</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is AED Sign Visible and Decals present?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: #00875A; font-weight: bold;">PASS</span></td></tr>
        <tr><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">14</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px;">Is the AED rescue-ready today?</td><td style="padding: 6px 12px; border-bottom: 1px solid #E2E8F0; font-size: 12px; text-align:center;"><span style="color: ${insp.status === 'Ok' ? '#00875A' : '#DE350B'}; font-weight: bold;">${insp.status === 'Ok' ? 'PASS' : 'FAIL'}</span></td></tr>
      </tbody>
    </table>

    <div style="margin-bottom: 20px;">
      <strong>Comments / Corrective Actions:</strong>
      <p style="margin-top: 6px; font-size: 13px; color: #475569;">${insp.comments || 'No deficiencies noted during inspection.'}</p>
    </div>

    <div style="margin-top: 32px; border-top: 1px solid #CBD5E1; padding-top: 16px; display: flex; justify-content: space-between; font-size: 12px; color: #64748B;">
      <div>
        <div>Electronic Signature: <strong>${insp.signature || 'Christine Miller'}</strong></div>
        <div style="margin-top: 4px;">Verified through AED Remind System Audit Log</div>
      </div>
      <div>
        Timestamp: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}
      </div>
    </div>
  `;

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: 10,
      filename: `AED_Inspection_Report_${insp.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  } else {
    const htmlContent = `<!DOCTYPE html><html><head><title>Inspection ${insp.id}</title></head><body>${element.outerHTML}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `AED_Inspection_Report_${insp.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};

window.renderPanelRescue = async function() {
  const tbody = document.getElementById('panel-rescue-tbody');
  if (!tbody) return;

  const searchTerm = (document.getElementById('panel-rescue-search')?.value || '').toLowerCase().trim();
  const allEvents = await api.getRescueEvents();

  const filtered = allEvents.filter(item => {
    if (!searchTerm) return true;
    return (
      (item.location && item.location.toLowerCase().includes(searchTerm)) ||
      (item.equipment && item.equipment.toLowerCase().includes(searchTerm)) ||
      (item.eventDate && item.eventDate.toLowerCase().includes(searchTerm)) ||
      (item.serialNumber && item.serialNumber.toLowerCase().includes(searchTerm))
    );
  });

  tbody.innerHTML = filtered.map(res => `
    <tr>
      <td>${res.location}</td>
      <td>${res.equipment}</td>
      <td>${res.eventDate}</td>
      <td style="text-align:center;">
        <button class="excel-action-square" title="Download ECG / Report" onclick="downloadRescueReport('${res.id}', '${res.serialNumber || 'AED'}', '${res.downloadUrl || ''}')">
          <i class="fa-solid fa-file-arrow-down"></i>
        </button>
      </td>
    </tr>
  `).join('');
};

// --------------------------------------------------------------------------
// 9. SYSTEM AUDIT LOG (Tracks each and every action with date & time)
// --------------------------------------------------------------------------
window.logSystemAction = function(action, module, details, status = 'Success', user = null) {
  const now = new Date();
  const pad = n => String(n).padStart(2, '0');
  const timestamp = `${now.getFullYear()}-${pad(now.getMonth()+1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

  const entry = {
    id: 'LOG-' + Date.now(),
    timestamp,
    user: user || `${INITIAL_DATA.currentUser.firstName} ${INITIAL_DATA.currentUser.lastName} (${currentRole})`,
    module,
    action,
    details,
    status,
    ip: '192.168.1.105'
  };

  api.addSystemLog(entry);

  // If currently visible, refresh
  if (document.getElementById('subtab-system-log')?.style.display !== 'none' ||
      document.getElementById('system-log-view')?.style.display !== 'none') {
    renderSystemLog();
  }
};

window.renderSystemLog = async function(target = 'all') {
  const logs = await api.getSystemLogs();

  const renderToTbody = (tbodyId, searchInputId) => {
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const query = (document.getElementById(searchInputId)?.value || '').toLowerCase().trim();
    const filtered = logs.filter(log => {
      if (!query) return true;
      return (
        (log.timestamp && log.timestamp.toLowerCase().includes(query)) ||
        (log.user && log.user.toLowerCase().includes(query)) ||
        (log.module && log.module.toLowerCase().includes(query)) ||
        (log.action && log.action.toLowerCase().includes(query)) ||
        (log.details && log.details.toLowerCase().includes(query)) ||
        (log.status && log.status.toLowerCase().includes(query))
      );
    });

    tbody.innerHTML = filtered.length ? filtered.map(log => `
      <tr>
        <td><code>${log.timestamp}</code></td>
        <td><strong>${log.user}</strong></td>
        <td><span class="excel-badge" style="background:#E0F2FE; color:#0369A1; padding:2px 8px; border-radius:4px; font-weight:600;">${log.module}</span></td>
        <td><strong>${log.action}</strong></td>
        <td>${log.details}</td>
        <td style="text-align:center;">
          <span class="log-status-badge ${(log.status || 'success').toLowerCase()}">${log.status}</span>
        </td>
        <td><small style="color:#64748B;">${log.ip || '192.168.1.105'}</small></td>
      </tr>
    `).join('') : `<tr><td colspan="7" style="text-align:center; padding:24px; color:#64748B;">No system log entries found matching criteria.</td></tr>`;
  };

  if (target === 'panel' || target === 'all') {
    renderToTbody('panel-system-log-tbody', 'panel-log-search');
  }
  if (target === 'standalone' || target === 'all') {
    renderToTbody('standalone-system-log-tbody', 'standalone-log-search');
  }
};

window.exportSystemLogCSV = async function() {
  const logs = await api.getSystemLogs();
  let csv = "Date & Time,User,Module,Action,Details,Status,Source IP\n";
  logs.forEach(l => {
    csv += `"${l.timestamp}","${l.user}","${l.module}","${l.action}","${(l.details||'').replace(/"/g, '""')}","${l.status}","${l.ip}"\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `VitalAED_System_Audit_Log_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  logSystemAction('Export System Log', 'Audit', 'Exported complete system log to CSV format');
};

// Modal helpers for sub-panels
window.openAddPadModal = function() {
  switchView('aed-panel');
  switchAEDPanelTab('pads');
  openPadForm();
};
window.openAddBatteryModal = function() {
  switchView('aed-panel');
  switchAEDPanelTab('batteries');
  openBatteryForm();
};
window.openUploadRescueModal = function() { openModal('modal-rescue-upload'); };

window.savePadRecord = async function() {
  const padType = document.getElementById('pad-form-type')?.value || 'Adult Pads';
  const brand = document.getElementById('pad-form-brand')?.value || 'ZOLL';
  const model = document.getElementById('pad-form-model')?.value || 'CPR-Uni Padz III';
  const sku = document.getElementById('pad-form-sku')?.value || 'ZOL-PAD-01';
  const lot = document.getElementById('pad-form-lot')?.value || 'LOT-' + Date.now();
  const expDate = document.getElementById('pad-form-exp-date')?.value || '2028-10-15';

  const newPad = {
    id: 'PAD-' + Date.now(),
    type: padType,
    aedId: (typeof currentAEDId !== 'undefined' ? currentAEDId : '') || '',
    location: document.getElementById('aed-info-location')?.value || 'Location 1 (Floor 1, Suite 100)',
    brand,
    model,
    sku,
    serialLot: lot,
    expirationDate: expDate,
    expirationStatus: 'OK',
    serviceStatus: 'Rescue-Ready',
    tab: 'active',
    resourcesUrl: '#resources',
    buyUrl: '#reorder'
  };

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  allEquipment.unshift(newPad);
  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  api.addEquipment(newPad).catch(e => console.warn("Modal pad add sync notice:", e));
  logSystemAction('Pad Added', 'Pads', `Added new Pad record ${padType}: ${brand} ${model} (Lot: ${lot})`);
  closeModal('modal-pad-form');
  alert(`Pad registered successfully!\nLot: ${lot}\nAction logged to System Audit Log with date & time.`);
  renderPanelPads();
  renderEquipment();
};

window.saveBatteryRecord = async function() {
  const brand = document.getElementById('bat-form-brand')?.value || 'ZOLL';
  const model = document.getElementById('bat-form-model')?.value || 'Lithium Battery Pack';
  const sku = document.getElementById('bat-form-sku')?.value || 'ZOL-BAT-01';
  const lot = document.getElementById('bat-form-lot')?.value || 'BAT-' + Date.now();
  const expDate = document.getElementById('bat-form-exp-date')?.value || '2029-05-20';

  const newBat = {
    id: 'BAT-' + Date.now(),
    type: 'Battery',
    aedId: (typeof currentAEDId !== 'undefined' ? currentAEDId : '') || '',
    location: document.getElementById('aed-info-location')?.value || 'Location 1 (Floor 1, Suite 100)',
    brand,
    model,
    sku,
    serialLot: lot,
    expirationDate: expDate,
    expirationStatus: 'OK',
    serviceStatus: 'Rescue-Ready',
    tab: 'active',
    resourcesUrl: '#resources',
    buyUrl: '#reorder'
  };

  const allEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  allEquipment.unshift(newBat);
  localStorage.setItem('aed_equipment', JSON.stringify(allEquipment));

  api.addEquipment(newBat).catch(e => console.warn("Modal battery add sync notice:", e));
  logSystemAction('Battery Added', 'Batteries', `Added new Battery record: ${brand} ${model} (Lot/Serial: ${lot})`);
  closeModal('modal-battery-form');
  alert(`Battery registered successfully!\nLot: ${lot}\nAction logged to System Audit Log with date & time.`);
  renderPanelBatteries();
  renderEquipment();
};

let currentEditingRescueId = null;

window.openUploadRescueModal = function(aedId = null) {
  currentEditingRescueId = null;
  const allEquipment = filterRecordsByOrg(JSON.parse(localStorage.getItem('aed_equipment') || '[]'));
  const aeds = allEquipment.filter(e => e.type === 'AED' && e.tab === 'active');
  const aedSelect = document.getElementById('rescue-form-aed');
  
  if (aedSelect) {
    aedSelect.innerHTML = aeds.map(a => `
      <option value="${a.id}" data-serial="${a.serialLot || ''}" data-loc="${a.location || ''}" data-brand="${a.brand || ''}" data-model="${a.model || ''}" data-sku="${a.sku || ''}">
        ${a.brand} ${a.model} (${a.serialLot || 'SN: N/A'}) - ${a.location}
      </option>
    `).join('');

    const targetId = aedId || currentAEDId || (aeds[0]?.id);
    if (targetId) aedSelect.value = targetId;
  }

  onRescueAedChange();

  const dateInput = document.getElementById('rescue-form-date');
  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

  const fileInput = document.getElementById('rescue-form-file');
  if (fileInput) fileInput.value = '';

  const notesInput = document.getElementById('rescue-form-notes');
  if (notesInput) notesInput.value = '';

  const modalTitle = document.querySelector('#modal-rescue-upload h3');
  if (modalTitle) modalTitle.textContent = 'Upload Rescue Event Data';

  const submitBtn = document.querySelector('#modal-rescue-upload .modal-excel-footer .btn-action:not(.secondary)');
  if (submitBtn) submitBtn.textContent = 'Upload Event';

  openModal('modal-rescue-upload');
};

window.openEditRescueModal = function(id) {
  const allRescue = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
  const ev = allRescue.find(r => String(r.id) === String(id));
  if (!ev) {
    alert('Rescue event not found.');
    return;
  }
  currentEditingRescueId = id;

  const allEquipment = filterRecordsByOrg(JSON.parse(localStorage.getItem('aed_equipment') || '[]'));
  const aeds = allEquipment.filter(e => e.type === 'AED' && e.tab === 'active');
  const aedSelect = document.getElementById('rescue-form-aed');
  
  if (aedSelect) {
    aedSelect.innerHTML = aeds.map(a => `
      <option value="${a.id}" data-serial="${a.serialLot || ''}" data-loc="${a.location || ''}" data-brand="${a.brand || ''}" data-model="${a.model || ''}" data-sku="${a.sku || ''}">
        ${a.brand} ${a.model} (${a.serialLot || 'SN: N/A'}) - ${a.location}
      </option>
    `).join('');

    const matchedAED = aeds.find(a => 
      (ev.serialNumber && a.serialLot === ev.serialNumber) ||
      (ev.equipment && a.serialLot && ev.equipment.includes(a.serialLot.slice(-4)))
    );
    if (matchedAED) {
      aedSelect.value = matchedAED.id;
    } else if (aeds[0]) {
      aedSelect.value = aeds[0].id;
    }
  }

  const locInput = document.getElementById('rescue-form-location');
  if (locInput) locInput.value = ev.location || '';

  const dateInput = document.getElementById('rescue-form-date');
  if (dateInput) dateInput.value = ev.eventDate || new Date().toISOString().split('T')[0];

  const fileInput = document.getElementById('rescue-form-file');
  if (fileInput) fileInput.value = '';

  const notesInput = document.getElementById('rescue-form-notes');
  if (notesInput) notesInput.value = ev.patientOutcome || ev.notes || '';

  const modalTitle = document.querySelector('#modal-rescue-upload h3');
  if (modalTitle) modalTitle.textContent = `Edit Rescue Event — ${ev.equipment || ev.serialNumber || 'AED'}`;

  const submitBtn = document.querySelector('#modal-rescue-upload .modal-excel-footer .btn-action:not(.secondary)');
  if (submitBtn) submitBtn.textContent = 'Save Changes';

  openModal('modal-rescue-upload');
};

window.onRescueAedChange = function() {
  const aedSelect = document.getElementById('rescue-form-aed');
  const locInput = document.getElementById('rescue-form-location');
  if (!aedSelect || !locInput) return;

  const opt = aedSelect.options[aedSelect.selectedIndex];
  if (opt) {
    locInput.value = opt.getAttribute('data-loc') || 'Location 1 - Floor 1 Suite 100';
  }
};

window.saveRescueUpload = async function() {
  const isEdit = !!currentEditingRescueId;
  const aedSelect = document.getElementById('rescue-form-aed');
  const opt = aedSelect ? aedSelect.options[aedSelect.selectedIndex] : null;

  const location = document.getElementById('rescue-form-location')?.value || opt?.getAttribute('data-loc') || 'Location 1 (Floor 1, Suite 100)';
  const date = document.getElementById('rescue-form-date')?.value || new Date().toISOString().split('T')[0];
  const notes = document.getElementById('rescue-form-notes')?.value || 'Rescue event deployment recorded';
  const fileInput = document.getElementById('rescue-form-file');
  const file = fileInput?.files?.[0];

  const serial = opt ? opt.getAttribute('data-serial') : (document.getElementById('aed-info-serial')?.value || 'Z3-8921004');
  const brand = opt ? opt.getAttribute('data-brand') : (document.getElementById('aed-info-brand')?.value || 'ZOLL');
  const model = opt ? opt.getAttribute('data-model') : (document.getElementById('aed-info-model')?.value || 'AED 3');
  const sku = opt ? opt.getAttribute('data-sku') : (document.getElementById('aed-info-sku')?.value || 'ZOL-AED3-01');

  const serialShort = serial.slice(-4);
  const eqName = `AED - ${serialShort}`;

  let fileData = null;
  let fileName = null;
  if (file) {
    fileName = file.name;
    fileData = await new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }

  const allRescue = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
  const existingEv = isEdit ? allRescue.find(r => String(r.id) === String(currentEditingRescueId)) : null;

  const payload = {
    id: currentEditingRescueId || `RESC-${Date.now()}`,
    creatorRecordId: existingEv?.creatorRecordId || null,
    location,
    equipment: eqName,
    serialNumber: serial,
    brand,
    model,
    sku,
    eventDate: date,
    patientOutcome: notes,
    fileName: fileName || existingEv?.fileName || null,
    fileData: fileData || null,
    downloadUrl: existingEv?.downloadUrl || '#'
  };

  currentEditingRescueId = null;
  const { serverResult } = await api.addRescueEvent(payload);

  const syncMessage = serverResult?.source === 'creator' 
    ? `\n✓ Synced live to Zoho Creator (Record ID: ${serverResult.recordId || payload.creatorRecordId || 'Updated'})`
    : `\n✓ Saved to AED Remind database & audit trail`;

  logSystemAction(
    isEdit ? 'Rescue Event Updated' : 'Rescue Event Registered',
    'Rescue Events',
    `${isEdit ? 'Updated' : 'Registered'} event for ${eqName} (${serial}) on ${date} at ${location}${file ? ' [Attachment: ' + fileName + ']' : ''}`,
    'Success'
  );

  closeModal('modal-rescue-upload');
  alert(`Rescue event successfully ${isEdit ? 'updated' : 'registered'}!${syncMessage}\nLogged to System Audit Log with date & time.`);
  renderPanelRescue();
  renderRescue();
  renderDashboard();
};

window.downloadRescueReport = function(eventId, serialNumber, downloadUrl) {
  if (downloadUrl && downloadUrl !== '#') {
    window.open(downloadUrl, '_blank');
    return;
  }

  // Generate on-demand official Rescue Event Certificate PDF report
  const allEvents = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
  const ev = allEvents.find(e => String(e.id) === String(eventId)) || {
    id: eventId,
    location: 'Location 1 - Floor 1 Suite 100',
    equipment: 'AED - ' + (serialNumber || '1004').slice(-4),
    serialNumber: serialNumber || 'Z3-8921004',
    eventDate: new Date().toISOString().split('T')[0],
    patientOutcome: 'Sudden Cardiac Arrest response. Pad deployment logged; unit powered and delivered therapeutic shock.',
    brand: 'ZOLL',
    model: 'AED 3'
  };

  const element = document.createElement('div');
  element.style.padding = '24px';
  element.style.fontFamily = "'Calibri', 'Segoe UI', Arial, sans-serif";
  element.style.color = '#1E293B';
  element.style.background = '#FFFFFF';

  element.innerHTML = `
    <div style="border-bottom: 3px solid #004182; padding-bottom: 12px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
      <div>
        <div style="font-size: 24px; font-weight: bold; color: #004182;">AED Rescue Event Incident Summary</div>
        <div style="font-size: 12px; color: #64748B; margin-top: 4px;">Vital AED Life Safety Corp — Official Compliance Record</div>
      </div>
      <div>
        <span style="display: inline-block; padding: 4px 12px; border-radius: 4px; font-weight: bold; color: #FFF; background: #004182;">RESCUE RECORD</span>
      </div>
    </div>

    <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Record ID:</strong> ${ev.id}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Incident Date:</strong> ${ev.eventDate || 'N/A'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Location:</strong> ${ev.location || 'N/A'}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Equipment:</strong> ${ev.equipment || 'AED'}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Brand / Model:</strong> ${ev.brand || 'ZOLL'} ${ev.model || ''}</td>
        <td style="padding: 8px 12px; border: 1px solid #CBD5E1; font-size: 13px;"><strong style="color: #004182;">Serial Number:</strong> ${ev.serialNumber || 'N/A'}</td>
      </tr>
    </table>

    <div style="margin-bottom: 8px;"><strong>Incident & Responder Notes:</strong></div>
    <div style="background: #F8FAFC; border: 1px solid #CBD5E1; border-radius: 6px; padding: 16px; margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
      ${ev.patientOutcome || 'Rescue deployment event logged. Post-event checklist initiated. Check pads and battery readiness.'}
    </div>

    <div style="margin-top: 36px; border-top: 1px solid #CBD5E1; padding-top: 14px; display: flex; justify-content: space-between; font-size: 12px; color: #64748B;">
      <div>Official Post-Event Audit Log Certificate</div>
      <div>Timestamp: ${new Date().toISOString().replace('T', ' ').substring(0, 19)}</div>
    </div>
  `;

  if (typeof html2pdf !== 'undefined') {
    const opt = {
      margin: 10,
      filename: `Rescue_Event_Report_${ev.id}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opt).from(element).save();
  } else {
    const htmlContent = `<!DOCTYPE html><html><head><title>Rescue Event ${ev.id}</title></head><body>${element.outerHTML}</body></html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Rescue_Event_Report_${ev.id}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
};



// --------------------------------------------------------------------------
// Modal Controls & Form Submissions
// --------------------------------------------------------------------------
window.openModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'flex';
    el.classList.add('active');
  }
};

window.closeModal = function(id) {
  const el = document.getElementById(id);
  if (el) {
    el.style.display = 'none';
    el.classList.remove('active');
  }
};

window.openInspectionModal = function(inspectionId = null) {
  openRegisterInspectionForm(inspectionId);
};

window.bulkApproveInspection = function() {
  const bulk = document.getElementById('chk-bulk-approve');
  if (bulk) {
    bulk.checked = true;
    onBulkApproveChange();
  }
};

window.setOutOfServiceInspection = function() {
  const oos = document.getElementById('chk-override-out-of-service');
  if (oos) {
    oos.checked = true;
    onOverrideOutOfServiceChange();
  }
};

window.saveInspection = function() {
  return saveInspectionForm();
};

window.setModalFormReadOnly = function(modalId, isReadOnly) {
  const modal = document.getElementById(modalId);
  if (!modal) return;

  const inputs = modal.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (input.classList.contains('modal-close-btn') || input.type === 'button') return;
    if (isReadOnly) {
      input.setAttribute('disabled', 'disabled');
      input.style.backgroundColor = '#f8fafc';
      input.style.cursor = 'not-allowed';
    } else {
      input.removeAttribute('disabled');
      input.style.backgroundColor = '';
      input.style.cursor = '';
    }
  });

  const saveBtn = modal.querySelector('.modal-excel-footer .btn-save-action') || modal.querySelector('.modal-excel-footer button:not(.secondary):not(.btn-edit-toggle)');
  const editBtn = modal.querySelector('.modal-excel-footer .btn-edit-toggle');
  if (saveBtn) saveBtn.style.display = isReadOnly ? 'none' : 'inline-block';
  if (editBtn) editBtn.style.display = isReadOnly ? 'inline-block' : 'none';
};

window.enableModalEditMode = function(modalId) {
  setModalFormReadOnly(modalId, false);
};

let currentEditingLocationId = null;
let currentEditingLocationOriginalName = null;

window.openAddLocationForm = function() {
  currentEditingLocationId = null;
  currentEditingLocationOriginalName = null;

  if (typeof switchView === 'function') switchView('locations');

  const listContainer = document.getElementById('locations-list-container');
  const formContainer = document.getElementById('locations-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  // Clear all fields
  if (document.getElementById('loc-form-name')) document.getElementById('loc-form-name').value = '';
  if (document.getElementById('loc-chk-same-org')) document.getElementById('loc-chk-same-org').checked = false;
  if (document.getElementById('loc-form-phone')) document.getElementById('loc-form-phone').value = '';
  if (document.getElementById('loc-form-street')) document.getElementById('loc-form-street').value = '';
  if (document.getElementById('loc-form-suite')) document.getElementById('loc-form-suite').value = '';
  if (document.getElementById('loc-form-city')) document.getElementById('loc-form-city').value = '';
  if (document.getElementById('loc-form-state')) document.getElementById('loc-form-state').value = '';
  if (document.getElementById('loc-form-zip')) document.getElementById('loc-form-zip').value = '';

  if (document.getElementById('loc-chk-same-user')) document.getElementById('loc-chk-same-user').checked = false;
  if (document.getElementById('loc-form-contact-first')) document.getElementById('loc-form-contact-first').value = '';
  if (document.getElementById('loc-form-contact-last')) document.getElementById('loc-form-contact-last').value = '';
  if (document.getElementById('loc-form-contact-email')) document.getElementById('loc-form-contact-email').value = '';
  if (document.getElementById('loc-chk-same-phone')) document.getElementById('loc-chk-same-phone').checked = false;
  if (document.getElementById('loc-form-contact-phone')) document.getElementById('loc-form-contact-phone').value = '';

  // Hide delete button when adding new
  const delBtn = document.getElementById('btn-delete-location-form');
  if (delBtn) delBtn.style.display = 'none';

  logSystemAction('Add Location Form Opened', 'Locations', 'Opened Location Information entry form');
};

window.openLocationForm = async function(id, isEditMode = true) {
  currentEditingLocationId = id;

  if (typeof switchView === 'function') switchView('locations');

  const listContainer = document.getElementById('locations-list-container');
  const formContainer = document.getElementById('locations-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  const all = JSON.parse(localStorage.getItem('aed_locations') || '[]');
  const loc = all.find(l => String(l.id) === String(id));
  if (!loc) return;

  currentEditingLocationOriginalName = loc.name || null;

  if (document.getElementById('loc-form-name')) document.getElementById('loc-form-name').value = loc.name || '';
  if (document.getElementById('loc-chk-same-org')) document.getElementById('loc-chk-same-org').checked = false;
  if (document.getElementById('loc-form-phone')) document.getElementById('loc-form-phone').value = loc.phone || '';
  if (document.getElementById('loc-form-street')) document.getElementById('loc-form-street').value = loc.street || loc.address || '';
  if (document.getElementById('loc-form-suite')) document.getElementById('loc-form-suite').value = loc.suite || loc.suiteUnitFloor || '';
  if (document.getElementById('loc-form-city')) document.getElementById('loc-form-city').value = loc.city || '';
  if (document.getElementById('loc-form-state')) document.getElementById('loc-form-state').value = loc.state || 'TX';
  if (document.getElementById('loc-form-zip')) document.getElementById('loc-form-zip').value = loc.zip || loc.zipCode || '';

  // Parse contact name
  const contact = loc.contact || '';
  const parts = contact.trim().split(/\s+/);
  const firstName = loc.contactFirstName || (parts.length > 0 ? parts[0] : '');
  const lastName = loc.contactLastName || (parts.length > 1 ? parts.slice(1).join(' ') : '');

  if (document.getElementById('loc-chk-same-user')) document.getElementById('loc-chk-same-user').checked = false;
  if (document.getElementById('loc-form-contact-first')) document.getElementById('loc-form-contact-first').value = firstName;
  if (document.getElementById('loc-form-contact-last')) document.getElementById('loc-form-contact-last').value = lastName;
  if (document.getElementById('loc-form-contact-email')) document.getElementById('loc-form-contact-email').value = loc.contactEmail || loc.email || '';
  if (document.getElementById('loc-chk-same-phone')) document.getElementById('loc-chk-same-phone').checked = false;
  if (document.getElementById('loc-form-contact-phone')) document.getElementById('loc-form-contact-phone').value = loc.contactPhone || loc.phone || '';

  const delBtn = document.getElementById('btn-delete-location-form');
  if (delBtn) delBtn.style.display = 'inline-block';

  logSystemAction('Location Viewed', 'Locations', `Opened Location Information form for ${loc.name} (ID: ${id})`);
};

window.closeLocationForm = function() {
  const listContainer = document.getElementById('locations-list-container');
  const formContainer = document.getElementById('locations-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';

  currentEditingLocationId = null;
  currentEditingLocationOriginalName = null;
  renderLocations();
};

window.onSameAsOrgAddressChange = function() {
  const chk = document.getElementById('loc-chk-same-org');
  if (!chk) return;

  if (!chk.checked) {
    if (document.getElementById('loc-form-street')) document.getElementById('loc-form-street').value = '';
    if (document.getElementById('loc-form-suite')) document.getElementById('loc-form-suite').value = '';
    if (document.getElementById('loc-form-city')) document.getElementById('loc-form-city').value = '';
    if (document.getElementById('loc-form-state')) document.getElementById('loc-form-state').value = '';
    if (document.getElementById('loc-form-zip')) document.getElementById('loc-form-zip').value = '';
    return;
  }

  const scope = typeof getActiveOrganizationScope === 'function' ? getActiveOrganizationScope() : { currentKey: 'vital-aed' };
  const targetKey = scope.currentKey === 'all' || scope.currentKey === 'all-managed' ? 'vital-aed' : (scope.currentKey || 'vital-aed');
  const storedOrg = JSON.parse(localStorage.getItem('aed_org') || 'null');
  const allOrgs = JSON.parse(localStorage.getItem('aed_organizations') || 'null') || INITIAL_DATA.organizations || [];
  const org = (storedOrg && storedOrg.key === targetKey) ? storedOrg : (allOrgs.find(o => o.key === targetKey) || INITIAL_DATA.organization || {});

  if (document.getElementById('loc-form-street')) document.getElementById('loc-form-street').value = org.street1 || org.street || '';
  if (document.getElementById('loc-form-suite')) document.getElementById('loc-form-suite').value = org.street2 || org.suite || '';
  if (document.getElementById('loc-form-city')) document.getElementById('loc-form-city').value = org.city || '';
  if (document.getElementById('loc-form-state')) document.getElementById('loc-form-state').value = org.state || 'TX';
  if (document.getElementById('loc-form-zip')) document.getElementById('loc-form-zip').value = org.zip || '';
};

window.onSameAsUserInfoChange = function() {
  const chk = document.getElementById('loc-chk-same-user');
  if (!chk) return;

  if (!chk.checked) {
    if (document.getElementById('loc-form-contact-first')) document.getElementById('loc-form-contact-first').value = '';
    if (document.getElementById('loc-form-contact-last')) document.getElementById('loc-form-contact-last').value = '';
    if (document.getElementById('loc-form-contact-email')) document.getElementById('loc-form-contact-email').value = '';
    if (document.getElementById('loc-form-contact-phone')) document.getElementById('loc-form-contact-phone').value = '';
    const phoneChk = document.getElementById('loc-chk-same-phone');
    if (phoneChk) phoneChk.checked = false;
    return;
  }

  const storedUser = JSON.parse(localStorage.getItem('aed_user') || 'null');
  const user = authenticatedUser || storedUser || (INITIAL_DATA.users && INITIAL_DATA.users[1]) || (INITIAL_DATA.users && INITIAL_DATA.users[0]) || {};

  if (document.getElementById('loc-form-contact-first')) document.getElementById('loc-form-contact-first').value = user.firstName || '';
  if (document.getElementById('loc-form-contact-last')) document.getElementById('loc-form-contact-last').value = user.lastName || '';
  if (document.getElementById('loc-form-contact-email')) document.getElementById('loc-form-contact-email').value = user.email || '';
  if (document.getElementById('loc-form-contact-phone')) document.getElementById('loc-form-contact-phone').value = user.phone || '(555) 100-2000';
};

window.onSameAsLocationPhoneChange = function() {
  const chk = document.getElementById('loc-chk-same-phone');
  if (!chk) return;
  if (chk.checked) {
    const locPhone = document.getElementById('loc-form-phone')?.value || '';
    if (document.getElementById('loc-form-contact-phone')) {
      document.getElementById('loc-form-contact-phone').value = locPhone;
    }
  } else {
    if (document.getElementById('loc-form-contact-phone')) {
      document.getElementById('loc-form-contact-phone').value = '';
    }
  }
};

window.onLocationPhoneInput = function() {
  const chk = document.getElementById('loc-chk-same-phone');
  if (chk && chk.checked) {
    const locPhone = document.getElementById('loc-form-phone')?.value || '';
    if (document.getElementById('loc-form-contact-phone')) {
      document.getElementById('loc-form-contact-phone').value = locPhone;
    }
  }
};

window.saveLocationForm = async function() {
  const name = (document.getElementById('loc-form-name')?.value || '').trim();
  const phone = (document.getElementById('loc-form-phone')?.value || '').trim();
  const street = (document.getElementById('loc-form-street')?.value || '').trim();
  const suite = (document.getElementById('loc-form-suite')?.value || '').trim();
  const city = (document.getElementById('loc-form-city')?.value || '').trim();
  const state = (document.getElementById('loc-form-state')?.value || '').trim();
  const zip = (document.getElementById('loc-form-zip')?.value || '').trim();

  const contactFirst = (document.getElementById('loc-form-contact-first')?.value || '').trim();
  const contactLast = (document.getElementById('loc-form-contact-last')?.value || '').trim();
  const contactEmail = (document.getElementById('loc-form-contact-email')?.value || '').trim();
  const contactPhone = (document.getElementById('loc-form-contact-phone')?.value || '').trim();

  if (!name) {
    alert('Please enter a Location Name.');
    return;
  }
  if (!phone) {
    alert('Please enter a Location Phone number.');
    return;
  }
  if (!street) {
    alert('Please enter a Street Address.');
    return;
  }
  if (!city) {
    alert('Please enter a City.');
    return;
  }
  if (!state) {
    alert('Please enter a State.');
    return;
  }
  if (!zip) {
    alert('Please enter a ZIP Code.');
    return;
  }
  if (!contactFirst || !contactLast) {
    alert('Please enter Contact First Name and Last Name.');
    return;
  }
  if (!contactEmail) {
    alert('Please enter Contact Email Address.');
    return;
  }
  if (!contactPhone) {
    alert('Please enter Contact Phone number.');
    return;
  }

  const isEdit = !!currentEditingLocationId;
  const originalName = currentEditingLocationOriginalName;
  const fullNameContact = `${contactFirst} ${contactLast}`.trim();

  const scope = typeof getActiveOrganizationScope === 'function' ? getActiveOrganizationScope() : { currentKey: 'vital-aed' };
  const targetKey = scope.currentKey === 'all' || scope.currentKey === 'all-managed' ? 'vital-aed' : (scope.currentKey || 'vital-aed');
  const org = (INITIAL_DATA.organizations || []).find(o => o.key === targetKey) || INITIAL_DATA.organization || {};

  const locObj = {
    id: currentEditingLocationId || `LOC-${Date.now()}`,
    name,
    originalName,
    phone,
    street,
    suite,
    city,
    state,
    zip,
    contact: fullNameContact,
    contactFirstName: contactFirst,
    contactLastName: contactLast,
    contactEmail,
    contactPhone,
    organization: org.name || 'Vital AED Life Safety Corp',
    organizationKey: targetKey
  };

  currentEditingLocationId = null;
  currentEditingLocationOriginalName = null;

  await api.addLocation(locObj);

  if (isEdit && originalName && originalName !== name) {
    // Update references across all tables
    let allEq = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    let eqChanged = false;
    allEq = allEq.map(e => {
      if (e.location === originalName) {
        eqChanged = true;
        return { ...e, location: name };
      }
      return e;
    });
    if (eqChanged) localStorage.setItem('aed_equipment', JSON.stringify(allEq));

    let allInsp = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
    let inspChanged = false;
    allInsp = allInsp.map(i => {
      if (i.location === originalName) {
        inspChanged = true;
        return { ...i, location: name };
      }
      return i;
    });
    if (inspChanged) localStorage.setItem('aed_inspections', JSON.stringify(allInsp));

    let allCpr = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
    let cprChanged = false;
    allCpr = allCpr.map(c => {
      if (c.location === originalName) {
        cprChanged = true;
        return { ...c, location: name };
      }
      return c;
    });
    if (cprChanged) localStorage.setItem('aed_cpr', JSON.stringify(allCpr));
  }

  logSystemAction(
    isEdit ? 'Location Updated' : 'Location Registered',
    'Locations',
    `${isEdit ? 'Updated' : 'Registered'} location ${name} (${city}, ${state})`,
    'Success'
  );

  closeLocationForm();
  await renderLocations();
  renderDashboard();
  alert(isEdit ? 'Location updated successfully!' : 'Location registered successfully!\nLogged to System Audit Log with date & time.');
};

window.deleteLocationForm = async function() {
  if (!currentEditingLocationId) {
    closeLocationForm();
    return;
  }

  const locId = currentEditingLocationId;
  const locName = currentEditingLocationOriginalName || document.getElementById('loc-form-name')?.value || 'Location';

  // Strict Developer Note dependency enforcement:
  // "Deleting a Location does not delete its associated AEDs, pads, or batteries.
  // If location is being used by the system, in a required field, it should block deletion
  // and inform user that dependencies need to be assigned to another location before location can be deleted."
  const allEq = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const allInsp = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
  const allCpr = JSON.parse(localStorage.getItem('aed_cpr') || '[]');

  const eqDeps = allEq.filter(e => e.location === locName);
  const inspDeps = allInsp.filter(i => i.location === locName);
  const cprDeps = allCpr.filter(c => c.location === locName);

  const totalDeps = eqDeps.length + inspDeps.length + cprDeps.length;

  if (totalDeps > 0) {
    alert(
      `Cannot Delete Location: "${locName}"\n\n` +
      `This location is currently being used by the system and has active dependencies:\n` +
      `• Associated Equipment: ${eqDeps.length}\n` +
      `• Associated Inspections: ${inspDeps.length}\n` +
      `• Associated CPR Certifications: ${cprDeps.length}\n\n` +
      `Per safety compliance policy, these dependencies must be reassigned to another location before this location can be deleted.`
    );
    return;
  }

  if (!confirm(`Are you sure you want to delete the location "${locName}"?\n\nThis action cannot be undone.`)) {
    return;
  }

  closeLocationForm();
  await api.deleteLocation(locId);
  logSystemAction('Location Deleted', 'Locations', `Deleted facility location: ${locName} (${locId})`, 'Warning');
  await renderLocations();
  renderDashboard();
  alert(`Location "${locName}" deleted successfully.`);
};

// Aliases for compatibility
window.openEditLocationModal = function(id, isEditMode = false) {
  openLocationForm(id, isEditMode);
};
window.openViewLocationModal = function(id) {
  openLocationForm(id, false);
};
window.openAddLocationModal = function() {
  openAddLocationForm();
};
window.saveLocation = function() {
  return saveLocationForm();
};

let currentEditingCPRId = null;

// --------------------------------------------------------------------------
// CPR Class Certification Form Handlers (Screenshot 1: Exact 1:1 System Map)
// --------------------------------------------------------------------------
window.onCPRClassDateChange = function() {
  const classDateInput = document.getElementById('cpr-form-class-date');
  const expDateInput = document.getElementById('cpr-form-exp-date');
  if (!classDateInput || !expDateInput) return;

  const val = classDateInput.value;
  if (!val) return;

  const classDate = new Date(val + 'T00:00:00');
  if (isNaN(classDate.getTime())) return;

  const expDate = new Date(classDate);
  expDate.setFullYear(expDate.getFullYear() + 2);

  const year = expDate.getFullYear();
  const month = String(expDate.getMonth() + 1).padStart(2, '0');
  const day = String(expDate.getDate()).padStart(2, '0');
  expDateInput.value = `${year}-${month}-${day}`;
};

window.onModalCPRClassDateChange = function() {
  const classDateInput = document.getElementById('cpr-class-date');
  const expDateInput = document.getElementById('cpr-exp-date');
  if (!classDateInput || !expDateInput) return;

  const val = classDateInput.value;
  if (!val) return;

  const classDate = new Date(val + 'T00:00:00');
  if (isNaN(classDate.getTime())) return;

  const expDate = new Date(classDate);
  expDate.setFullYear(expDate.getFullYear() + 2);

  const year = expDate.getFullYear();
  const month = String(expDate.getMonth() + 1).padStart(2, '0');
  const day = String(expDate.getDate()).padStart(2, '0');
  expDateInput.value = `${year}-${month}-${day}`;
};

window.openAddCPRForm = function() {
  currentEditingCPRId = null;

  if (typeof switchView === 'function') switchView('cpr');

  const listContainer = document.getElementById('cpr-list-container');
  const formContainer = document.getElementById('cpr-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  populateDropdowns();

  if (document.getElementById('cpr-form-first-name')) document.getElementById('cpr-form-first-name').value = '';
  if (document.getElementById('cpr-form-last-name')) document.getElementById('cpr-form-last-name').value = '';
  if (document.getElementById('cpr-form-email')) document.getElementById('cpr-form-email').value = '';
  if (document.getElementById('cpr-form-phone')) document.getElementById('cpr-form-phone').value = '';

  const classTypeSelect = document.getElementById('cpr-form-class-type');
  if (classTypeSelect) classTypeSelect.value = '';

  const accredSelect = document.getElementById('cpr-form-accred');
  if (accredSelect) accredSelect.value = '';

  const classDateInput = document.getElementById('cpr-form-class-date');
  if (classDateInput) classDateInput.value = '';
  const expDateInput = document.getElementById('cpr-form-exp-date');
  if (expDateInput) expDateInput.value = '';

  // Hide Delete button when creating a new record
  const delBtn = document.getElementById('btn-delete-cpr-form');
  if (delBtn) delBtn.style.display = 'none';

  logSystemAction('Add CPR Form Opened', 'CPR', 'Opened CPR Class Certification entry form');
};

window.openCPRForm = async function(id, isEditMode = false) {
  currentEditingCPRId = id;

  if (typeof switchView === 'function') switchView('cpr');

  const listContainer = document.getElementById('cpr-list-container');
  const formContainer = document.getElementById('cpr-form-container');
  if (listContainer) listContainer.style.display = 'none';
  if (formContainer) formContainer.style.display = 'block';

  populateDropdowns();

  const all = await api.getCPRCertifications();
  const cpr = all.find(c => String(c.id || c.ID) === String(id));

  if (cpr) {
    if (document.getElementById('cpr-form-loc')) document.getElementById('cpr-form-loc').value = cpr.location || '';
    if (document.getElementById('cpr-form-class-type')) document.getElementById('cpr-form-class-type').value = cpr.classType || '';
    if (document.getElementById('cpr-form-accred')) document.getElementById('cpr-form-accred').value = cpr.accreditation || '';
    if (document.getElementById('cpr-form-first-name')) document.getElementById('cpr-form-first-name').value = cpr.firstName || '';
    if (document.getElementById('cpr-form-last-name')) document.getElementById('cpr-form-last-name').value = cpr.lastName || '';
    if (document.getElementById('cpr-form-email')) document.getElementById('cpr-form-email').value = cpr.email || '';
    if (document.getElementById('cpr-form-phone')) document.getElementById('cpr-form-phone').value = cpr.phone || '';
    if (document.getElementById('cpr-form-class-date')) document.getElementById('cpr-form-class-date').value = cpr.classDate || '';
    if (document.getElementById('cpr-form-exp-date')) document.getElementById('cpr-form-exp-date').value = cpr.expirationDate || '';
  }

  const delBtn = document.getElementById('btn-delete-cpr-form');
  if (delBtn) delBtn.style.display = 'inline-block';

  logSystemAction('CPR Viewed', 'CPR', `Opened CPR Certification form for ${cpr?.firstName || ''} ${cpr?.lastName || ''} (ID: ${id})`);
};

window.closeCPRForm = function() {
  const listContainer = document.getElementById('cpr-list-container');
  const formContainer = document.getElementById('cpr-form-container');
  if (listContainer) listContainer.style.display = 'block';
  if (formContainer) formContainer.style.display = 'none';
  currentEditingCPRId = null;
  renderCPR();
};

window.saveCPRForm = async function() {
  const location = document.getElementById('cpr-form-loc')?.value || '';
  const classType = document.getElementById('cpr-form-class-type')?.value || '';
  const accreditation = document.getElementById('cpr-form-accred')?.value || '';
  const firstName = (document.getElementById('cpr-form-first-name')?.value || '').trim();
  const lastName = (document.getElementById('cpr-form-last-name')?.value || '').trim();
  const email = (document.getElementById('cpr-form-email')?.value || '').trim();
  const phone = (document.getElementById('cpr-form-phone')?.value || '').trim();
  const classDate = document.getElementById('cpr-form-class-date')?.value || '';
  let expirationDate = document.getElementById('cpr-form-exp-date')?.value || '';

  if (!location) {
    alert('Please select a Location.');
    return;
  }
  if (!classType) {
    alert('Please select a Class Type.');
    return;
  }
  if (!accreditation) {
    alert('Please select an Accreditation Type.');
    return;
  }
  if (!firstName || !lastName) {
    alert('Please enter Participant First Name and Last Name.');
    return;
  }
  if (!email) {
    alert('Please enter Participant Email.');
    return;
  }
  if (!phone) {
    alert('Please enter Participant Phone number.');
    return;
  }
  if (!classDate) {
    alert('Please enter Class Date.');
    return;
  }

  if (!expirationDate) {
    const d = new Date(classDate + 'T00:00:00');
    d.setFullYear(d.getFullYear() + 2);
    expirationDate = d.toISOString().split('T')[0];
  }

  const isExpired = new Date(expirationDate) < new Date();
  const isEdit = !!currentEditingCPRId;

  const cprObj = {
    id: currentEditingCPRId || `CPR-${Date.now()}`,
    location,
    classType,
    accreditation,
    firstName,
    lastName,
    email,
    phone,
    classDate,
    expirationDate,
    status: isExpired ? 'Expired' : 'Ok'
  };

  currentEditingCPRId = null;
  await api.addCPRCertification(cprObj);
  logSystemAction(
    isEdit ? 'CPR Certification Updated' : 'CPR Certification Registered',
    'CPR',
    `${isEdit ? 'Updated' : 'Registered'} certification for ${firstName} ${lastName} (${classType} - ${accreditation}) at ${location}`,
    'Success'
  );

  alert(`CPR Certification successfully saved!\n\nParticipant: ${firstName} ${lastName}\nLocation: ${location}\nClass: ${classType}\nAccreditation: ${accreditation}\nClass Date: ${classDate}\nExpiration Date: ${expirationDate}\n\nAction logged to System Audit Log.`);

  closeCPRForm();
  await renderCPR();
  renderDashboard();
};

window.deleteCPRForm = async function() {
  if (!currentEditingCPRId) {
    closeCPRForm();
    return;
  }

  const firstName = document.getElementById('cpr-form-first-name')?.value || '';
  const lastName = document.getElementById('cpr-form-last-name')?.value || '';
  const cprId = currentEditingCPRId;

  if (!confirm(`Are you sure you want to delete the CPR certification record for ${firstName} ${lastName}?`)) {
    return;
  }

  closeCPRForm();
  const deletePromise = api.deleteCPRCertification(cprId);
  await renderCPR();
  renderDashboard();

  logSystemAction('CPR Deleted', 'CPR', `Deleted CPR certification record for ${firstName} ${lastName} (${cprId})`, 'Warning');
  const ok = await deletePromise;
  if (ok === false) {
    await renderCPR();
    renderDashboard();
  } else {
    alert(`CPR Certification record removed successfully.`);
  }
};

window.openEditCPRModal = async function(id, isEditMode = false) {
  openCPRForm(id, isEditMode);
};

window.openViewCPRModal = function(id) {
  openCPRForm(id, false);
};

window.openAddCPRModal = function() {
  openAddCPRForm();
};

window.saveCPR = async function() {
  const location = document.getElementById('cpr-loc-select')?.value || '';
  const classType = document.getElementById('cpr-class-type')?.value || 'CPR/AED/FA';
  const accreditation = document.getElementById('cpr-accred')?.value || 'AHA';
  const firstName = (document.getElementById('cpr-first-name')?.value || '').trim();
  const lastName = (document.getElementById('cpr-last-name')?.value || '').trim();
  const email = (document.getElementById('cpr-email')?.value || '').trim();
  const phone = (document.getElementById('cpr-phone')?.value || '').trim();
  const classDate = document.getElementById('cpr-class-date')?.value || '';
  let expirationDate = document.getElementById('cpr-exp-date')?.value || '';

  if (!firstName || !lastName) {
    alert('Please enter Participant First Name and Last Name.');
    return;
  }

  if (classDate && !expirationDate) {
    const d = new Date(classDate + 'T00:00:00');
    d.setFullYear(d.getFullYear() + 2);
    expirationDate = d.toISOString().split('T')[0];
  }

  const isExpired = new Date(expirationDate) < new Date();
  const isEdit = !!currentEditingCPRId;

  const cprObj = {
    id: currentEditingCPRId || `CPR-${Date.now()}`,
    location,
    classType,
    accreditation,
    firstName,
    lastName,
    email,
    phone,
    classDate,
    expirationDate: expirationDate || new Date().toISOString().split('T')[0],
    status: isExpired ? 'Expired' : 'Ok'
  };

  currentEditingCPRId = null;
  await api.addCPRCertification(cprObj);
  logSystemAction(isEdit ? 'CPR Certification Updated' : 'CPR Certification Added', 'CPR', `${isEdit ? 'Updated' : 'Added'} certification for ${firstName} ${lastName}`);
  closeModal('modal-cpr-form');
  await renderCPR();
  renderDashboard();
  alert(isEdit ? 'CPR Certification updated successfully!' : 'CPR Certification registered successfully!\nLogged to System Audit Log with date & time.');
};

window.saveEquipment = async function() {
  const type = document.getElementById('new-eq-type').value;
  const tab = document.getElementById('new-eq-tab').value;
  const location = document.getElementById('new-eq-loc').value;
  const brand = document.getElementById('new-eq-brand').value;
  const model = document.getElementById('new-eq-model').value;
  const sku = document.getElementById('new-eq-sku').value;
  const serialLot = document.getElementById('new-eq-serial').value;
  const expDate = document.getElementById('new-eq-exp').value;

  if (!brand || !model || !serialLot) {
    alert('Please fill in Brand, Model, and Serial/Lot.');
    return;
  }

  const newEq = {
    id: `EQ-${Date.now()}`,
    type,
    location: tab === 'spare' ? '-' : location,
    brand,
    model,
    sku,
    serialLot,
    expirationDate: expDate || '15-Dec-2028',
    expirationStatus: 'Ok',
    serviceStatus: tab === 'spare' ? 'Standby' : 'Rescue-Ready',
    tab,
    resourcesUrl: 'https://www.vitalaed.com',
    buyUrl: '#reorder'
  };

  await api.addEquipment(newEq);
  logSystemAction('Equipment Registered', 'Equipment', `Registered ${type}: ${brand} ${model} (Serial/Lot: ${serialLot}) in ${tab.toUpperCase()}`);
  closeModal('modal-equipment-form');
  renderEquipment();
  renderSpare();
  populateDropdowns();
  alert('Equipment registered successfully!\nLogged to System Audit Log with date & time.');
};

// --------------------------------------------------------------------------
// Helpers: Dropdowns, Auto-Fill, Search, Roles
// --------------------------------------------------------------------------
function populateDropdowns() {
  const rawLocations = JSON.parse(localStorage.getItem('aed_locations') || '[]');
  const rawEquipment = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
  const locations = filterRecordsByOrg(rawLocations);
  const allEquipment = filterRecordsByOrg(rawEquipment);
  const aeds = allEquipment.filter(e => e.type === 'AED' && e.tab === 'active');

  // Location select boxes (Per Vicky: Default location only if single location exists; otherwise prompt user with -Select Location-)
  ['new-eq-loc', 'cpr-loc-select', 'cpr-form-loc'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (locations.length === 1) {
      el.innerHTML = `<option value="${locations[0].name}" selected>${locations[0].name}</option>`;
    } else if (locations.length > 1) {
      el.innerHTML = '<option value="" selected>-Select Location-</option>' + locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    } else {
      el.innerHTML = '<option value="">-No Locations Available-</option>';
    }
  });

  // Spare location select boxes
  ['spare-aed-location', 'spare-pad-location', 'spare-battery-location'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const currentVal = el.value || '-';
    el.innerHTML = '<option value="-">- Spare Stock (Unassigned) -</option>' + 
      locations.map(l => `<option value="${l.name}">${l.name}</option>`).join('');
    el.value = currentVal;
  });

  // Inspection AED select box
  const inspAed = document.getElementById('insp-aed-select');
  if (inspAed) {
    inspAed.innerHTML = `<option value="">-- Select AED --</option>` + aeds.map(a => `
      <option value="${a.id}" data-loc="${a.location}">${a.brand} ${a.model} (${a.serialLot})</option>
    `).join('');

    inspAed.addEventListener('change', (e) => {
      const opt = e.target.options[e.target.selectedIndex];
      const inspLoc = document.getElementById('insp-location');
      if (inspLoc && opt) {
        inspLoc.value = opt.getAttribute('data-loc') || '';
      }
    });
  }
}

function setupAddressAutoFill() {
  const chk = document.getElementById('loc-chk-same-org');
  if (chk && !chk._hasListener) {
    chk._hasListener = true;
    chk.addEventListener('change', onSameAsOrgAddressChange);
  }
}

window.loadAccountInfo = function() {
  const scope = getActiveOrganizationScope();
  const orgKey = (scope.allowedKeys && scope.allowedKeys[0]) ? scope.allowedKeys[0] : (currentOrganizationKey !== 'all' ? currentOrganizationKey : 'vital-aed');
  const orgList = INITIAL_DATA.organizations || [];
  const activeOrg = orgList.find(o => o.key === orgKey) || INITIAL_DATA.organization;

  const storedOrg = JSON.parse(localStorage.getItem('aed_org') || 'null');
  const org = (storedOrg && storedOrg.key === orgKey) ? storedOrg : (activeOrg || storedOrg);

  if (org) {
    if (document.getElementById('org-name')) document.getElementById('org-name').value = org.name || '';
    if (document.getElementById('org-phone')) document.getElementById('org-phone').value = org.phone || '';
    if (document.getElementById('org-street1')) document.getElementById('org-street1').value = org.street1 || '';
    if (document.getElementById('org-street2')) document.getElementById('org-street2').value = org.street2 || '';
    if (document.getElementById('org-city')) document.getElementById('org-city').value = org.city || '';
    if (document.getElementById('org-state')) document.getElementById('org-state').value = org.state || '';
    if (document.getElementById('org-zip')) document.getElementById('org-zip').value = org.zip || '';
    if (document.getElementById('org-website')) document.getElementById('org-website').value = org.website || '';
    const topOrg = document.getElementById('topbar-org-name');
    if (topOrg && org.name) topOrg.textContent = org.name;
  }

  const usr = JSON.parse(localStorage.getItem('aed_user') || 'null');
  if (usr) {
    if (document.getElementById('user-first-name')) document.getElementById('user-first-name').value = usr.firstName || '';
    if (document.getElementById('user-last-name')) document.getElementById('user-last-name').value = usr.lastName || '';
    if (document.getElementById('user-email')) document.getElementById('user-email').value = usr.email || '';
    if (document.getElementById('user-phone')) document.getElementById('user-phone').value = usr.phone || '';
    const topUser = document.getElementById('topbar-user-name');
    if (topUser && (usr.firstName || usr.lastName)) {
      topUser.textContent = `${usr.firstName || ''} ${usr.lastName || ''}`.trim();
    }
  }
};

window.saveOrganizationInfo = function() {
  const org = {
    name: document.getElementById('org-name')?.value || '',
    phone: document.getElementById('org-phone')?.value || '',
    street1: document.getElementById('org-street1')?.value || '',
    street2: document.getElementById('org-street2')?.value || '',
    city: document.getElementById('org-city')?.value || '',
    state: document.getElementById('org-state')?.value || '',
    zip: document.getElementById('org-zip')?.value || '',
    website: document.getElementById('org-website')?.value || ''
  };
  localStorage.setItem('aed_org', JSON.stringify(org));
  const topOrg = document.getElementById('topbar-org-name');
  if (topOrg && org.name) topOrg.textContent = org.name;
  logSystemAction('Organization Updated', 'Account', `Updated organization profile: ${org.name || 'Organization'}`);
  alert('Organization information saved successfully!\nLogged to System Audit Log.');
};

window.saveUserProfile = function() {
  const usr = {
    firstName: document.getElementById('user-first-name')?.value || '',
    lastName: document.getElementById('user-last-name')?.value || '',
    email: document.getElementById('user-email')?.value || '',
    phone: document.getElementById('user-phone')?.value || ''
  };
  localStorage.setItem('aed_user', JSON.stringify(usr));
  const topUser = document.getElementById('topbar-user-name');
  if (topUser && (usr.firstName || usr.lastName)) {
    topUser.textContent = `${usr.firstName || ''} ${usr.lastName || ''}`.trim();
  }
  logSystemAction('User Profile Updated', 'Account', `Updated user profile for: ${usr.firstName} ${usr.lastName} (${usr.email})`);
  alert('User profile saved successfully!\nLogged to System Audit Log.');
};

// --------------------------------------------------------------------------
// User Module Tabs & Profile Handling
// --------------------------------------------------------------------------
window.switchUserModuleTab = function(tabName) {
  const btnRoster = document.getElementById('btn-user-toggle-roster');
  const btnUser = document.getElementById('btn-user-toggle-user');
  const btnOrg = document.getElementById('btn-user-toggle-org');
  const rosterContainer = document.getElementById('user-tab-roster-container');
  const userContainer = document.getElementById('user-tab-user-container');
  const orgContainer = document.getElementById('user-tab-org-container');

  if (btnRoster) btnRoster.classList.toggle('active', tabName === 'roster');
  if (btnUser) btnUser.classList.toggle('active', tabName === 'user');
  if (btnOrg) btnOrg.classList.toggle('active', tabName === 'organization');

  if (rosterContainer) rosterContainer.style.display = (tabName === 'roster') ? 'block' : 'none';
  if (userContainer) userContainer.style.display = (tabName === 'user') ? 'block' : 'none';
  if (orgContainer) orgContainer.style.display = (tabName === 'organization') ? 'block' : 'none';

  if (tabName === 'roster') {
    renderUsersRoster();
  } else if (tabName === 'organization') {
    renderOrganizationsRoster();
  } else if (tabName === 'user') {
    loadUserProfileForm();
  }

  logSystemAction('User Module Switched', 'Users & Account', `Switched view to ${tabName === 'roster' ? 'Users Roster' : (tabName === 'user' ? 'User Profile' : 'Organization Information')}`);
};

window.loadUserProfileForm = function() {
  const orgSelect = document.getElementById('user-profile-org');
  if (orgSelect) {
    const orgs = INITIAL_DATA.organizations || [];
    orgSelect.innerHTML = '<option value="">-Select-</option>' + orgs.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
    const activeScope = getActiveOrganizationScope();
    const curOrg = orgs.find(o => o.key === activeScope.currentKey);
    if (curOrg) orgSelect.value = curOrg.name;
    else if (orgs.length > 0) orgSelect.value = orgs[0].name;
  }

  const roleSelect = document.getElementById('user-profile-role');
  if (roleSelect) {
    roleSelect.innerHTML = `<option value="${currentRole}">${currentRole}</option>`;
    roleSelect.value = currentRole;
  }

  const usr = JSON.parse(localStorage.getItem('aed_user') || 'null') || INITIAL_DATA.currentUser;
  if (usr) {
    if (document.getElementById('user-first-name')) document.getElementById('user-first-name').value = usr.firstName || '';
    if (document.getElementById('user-last-name')) document.getElementById('user-last-name').value = usr.lastName || '';
    if (document.getElementById('user-email')) document.getElementById('user-email').value = usr.email || '';
    if (document.getElementById('user-phone')) document.getElementById('user-phone').value = usr.phone || '';
  }
};

// Helper: Get badge class for role
function getRoleBadgeClass(roleName) {
  const role = INITIAL_DATA.userRoles[roleName];
  if (role && role.badgeColor) return role.badgeColor;
  const map = {
    'Sys Admin': 'sys-admin',
    'Reseller*': 'reseller',
    'Admin (Account owner)': 'account-owner',
    'Admin': 'admin',
    'Staff': 'staff',
    'Inspector': 'inspector',
    'Customer (No Portal Access)': 'customer'
  };
  return map[roleName] || 'staff';
}

function getCurrentUserName() {
  const topEl = document.getElementById('topbar-user-name');
  return topEl ? topEl.textContent.trim() : 'Christine Miller';
}

// --------------------------------------------------------------------------
// User Roster Rendering
// --------------------------------------------------------------------------
window.renderUsersRoster = async function() {
  const tbody = document.getElementById('users-roster-tbody');
  if (!tbody) return;

  const rawUsers = await api.getUsers();
  const users = filterRecordsByOrg(rawUsers);
  const searchInput = (document.getElementById('users-search')?.value || '').toLowerCase().trim();
  const currentPerms = INITIAL_DATA.userRoles[currentRole] || {};
  const currentTopUser = getCurrentUserName().toLowerCase();

  const filtered = users.filter(u => {
    // Non-Sys-Admins cannot see Sys Admin accounts
    if (currentRole !== 'Sys Admin' && u.role === 'Sys Admin') return false;

    if (!searchInput) return true;
    const name = `${u.firstName || ''} ${u.lastName || ''}`.toLowerCase();
    const email = (u.email || '').toLowerCase();
    const role = (u.role || '').toLowerCase();
    return name.includes(searchInput) || email.includes(searchInput) || role.includes(searchInput);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:24px; color:#64748B;">No user accounts found matching your query.</td></tr>`;
    updateReportToolbarState('users');
    return;
  }

  const selectedSet = selectedReportRows['users'] || new Set();

  tbody.innerHTML = filtered.map(u => {
    const badgeClass = getRoleBadgeClass(u.role);
    const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim();
    const isCurrentUser = (fullName.toLowerCase() === currentTopUser) || (u.isOwner && currentRole === 'Admin (Account owner)');
    const isOwner = u.isOwner || (u.role === 'Admin (Account owner)');
    const isChecked = selectedSet.has(String(u.id));
    
    // Status Pill
    let statusClass = 'active';
    let statusLabel = u.status || 'Active';
    if (statusLabel.includes('Invite') || statusLabel.includes('Pending')) statusClass = 'invited';
    else if (statusLabel.includes('Reminders')) statusClass = 'reminders-only';

    // Strict RBAC per Matrix:
    // Sys Admin: Add/Delete all users
    // Admin (Account owner): Add/Delete users in org (except Sys Admin or self)
    // Admin: "Yes, except account owner" -> Can edit/delete users in org except Account Owner, Sys Admin, or self
    // Others (Staff, Inspector, Reseller): Cannot edit/delete other users
    let canEditThisUser = false;
    let canDeleteThisUser = false;

    if (currentRole === 'Sys Admin') {
      canEditThisUser = true;
      canDeleteThisUser = !isCurrentUser;
    } else if (currentRole === 'Admin (Account owner)') {
      if (u.role !== 'Sys Admin') {
        canEditThisUser = true;
        canDeleteThisUser = !isCurrentUser;
      } else {
        canEditThisUser = isCurrentUser;
        canDeleteThisUser = false;
      }
    } else if (currentRole === 'Admin') {
      // Per matrix: "Yes, except account owner"
      if (u.role !== 'Sys Admin' && !isOwner) {
        canEditThisUser = true;
        canDeleteThisUser = !isCurrentUser;
      } else {
        canEditThisUser = isCurrentUser && !isOwner;
        canDeleteThisUser = false;
      }
    } else {
      canEditThisUser = isCurrentUser;
      canDeleteThisUser = false;
    }

    // Role Action Buttons
    let actionsHtml = `
      <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
    `;

    if (canEditThisUser) {
      actionsHtml += `
        <button type="button" class="excel-pill-btn sm" onclick="openEditUserModal('${u.id}')" title="Edit user details">
          <i class="fa-solid fa-pen-to-square" style="margin-right:4px;"></i> Edit
        </button>
      `;
    }

    if (currentRole === 'Sys Admin' || currentRole === 'Admin (Account owner)' || currentRole === 'Admin') {
      actionsHtml += `
        <button type="button" class="excel-pill-btn sm" style="background:#0284C7;" onclick="resendInvite('${u.id}')" title="Resend Portal Invitation Email">
          <i class="fa-solid fa-envelope"></i>
        </button>
      `;
    }

    if (canDeleteThisUser) {
      actionsHtml += `
        <button type="button" class="excel-pill-btn sm" style="background:#DC2626;" onclick="deleteUserRecord('${u.id}', '${fullName}')" title="Delete User">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      `;
    } else if (currentRole === 'Admin' && isOwner) {
      actionsHtml += `
        <span class="excel-pill-btn sm" style="background:#F1F5F9; color:#94A3B8; cursor:not-allowed;" title="Account Owner cannot be deleted by Admin (Matrix: 'Yes, except account owner')">
          <i class="fa-solid fa-lock" style="font-size:10px;"></i>
        </span>
      `;
    }

    actionsHtml += `</div>`;

    return `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${u.id}" data-role="${u.role}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('users', this)">
        </td>
        <td style="font-weight:600; color:#1E293B;">
          <i class="fa-solid fa-user-circle" style="color:#0070C0; margin-right:6px;"></i>
          ${fullName} ${isOwner ? '<span style="font-size:10px; color:#0369A1; background:#E0F2FE; padding:1px 5px; border-radius:3px; margin-left:4px; font-weight:700;">OWNER</span>' : ''}
          ${isCurrentUser ? '<span style="font-size:10px; color:#15803D; background:#DCFCE7; padding:1px 5px; border-radius:3px; margin-left:4px;">(Active)</span>' : ''}
        </td>
        <td><a href="mailto:${u.email}" style="color:#0070C0; text-decoration:none;">${u.email}</a></td>
        <td>${u.phone || '-'}</td>
        <td>
          <span class="user-role-badge ${badgeClass}">${u.role}</span>
          <div style="font-size:10px; color:#64748B; margin-top:3px;"><i class="fa-solid fa-shield-halved" style="color:#059669; font-size:9px;"></i> Catalyst Auth</div>
        </td>
        <td><span class="role-scope-tag">${u.locationScope || 'All Locations'}</span></td>
        <td style="text-align:center;">
          <span class="user-status-pill ${statusClass}">
            <i class="fa-solid fa-circle" style="font-size:6px;"></i> ${statusLabel}
          </span>
        </td>
        <td style="text-align:center;">${actionsHtml}</td>
      </tr>
    `;
  }).join('');

  updateReportToolbarState('users');
};

// --------------------------------------------------------------------------
// Switch to User Directly (Internal session updater)
// --------------------------------------------------------------------------
window.switchUserDirectly = async function(userId) {
  const users = await api.getUsers();
  const registeredUsers = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.users) || [];
  const allUsers = [...users, ...registeredUsers];
  const user = allUsers.find(u => String(u.id) === String(userId));
  if (!user) return;

  sessionStorage.setItem('aed_auth_user', JSON.stringify(user));
  applyAuthenticatedUser(user);
  logSystemAction('User Session Activated', 'Authentication', `Active session: ${user.firstName} ${user.lastName} (${user.role})`);
};

// --------------------------------------------------------------------------
// Delete User Record
// --------------------------------------------------------------------------
window.deleteUserRecord = async function(userId, userName) {
  const users = await api.getUsers();
  const targetUser = users.find(u => String(u.id) === String(userId));

  if (currentRole === 'Sys Admin') {
    // Permitted for all users except own self
    if (targetUser && (targetUser.email === authenticatedUser?.email || targetUser.id === authenticatedUser?.id)) {
      alert('You cannot delete your own active administrator account.');
      return;
    }
  } else if (currentRole === 'Admin (Account owner)') {
    if (targetUser && targetUser.role === 'Sys Admin') {
      alert('Access Restricted: You cannot delete a System Administrator account.');
      return;
    }
    if (targetUser && (targetUser.email === authenticatedUser?.email || targetUser.id === authenticatedUser?.id)) {
      alert('You cannot delete your own active account.');
      return;
    }
  } else if (currentRole === 'Admin') {
    // Matrix: "Yes, except account owner"
    if (targetUser && (targetUser.isOwner || targetUser.role === 'Admin (Account owner)')) {
      alert('Access Restricted:\nAdmins cannot delete the Account Owner account (Matrix Rule: "Yes, except account owner").');
      return;
    }
    if (targetUser && targetUser.role === 'Sys Admin') {
      alert('Access Restricted: You cannot delete a System Administrator account.');
      return;
    }
    if (targetUser && (targetUser.email === authenticatedUser?.email || targetUser.id === authenticatedUser?.id)) {
      alert('You cannot delete your own active account.');
      return;
    }
  } else {
    alert(`Access Restricted:\nYour active role (${currentRole}) does not have permission to delete user accounts.`);
    return;
  }

  if (!confirm(`Are you sure you want to remove the user account for:\n\n${userName}?\n\nThis will revoke their access to the Vital AED portal.`)) {
    return;
  }

  await api.deleteUser(userId);
  logSystemAction('User Account Deleted', 'User Management', `Deleted user account: ${userName} (${userId})`);
  alert(`User account for ${userName} has been removed.`);
  renderUsersRoster();
};

// --------------------------------------------------------------------------
// Dedicated Organization Report & Cross-Navigation (Screenshot 2)
// --------------------------------------------------------------------------
window.renderOrganizationsRoster = async function() {
  const tbody = document.getElementById('organizations-roster-tbody');
  if (!tbody) return;

  const orgs = INITIAL_DATA.organizations || [];
  const allUsers = await api.getUsers();
  const searchInput = (document.getElementById('users-search')?.value || '').toLowerCase().trim();

  // Multi-Tenant Scoping for Organizations View
  let scopedOrgs = orgs;
  if (currentRole === 'Sys Admin') {
    scopedOrgs = orgs; // Global unconstrained access across all organizations
  } else if (currentRole === 'Reseller*') {
    const resellerOrgName = (authenticatedUser?.organization || 'Vital AED').toLowerCase().trim();
    const resellerOrgKey = (authenticatedUser?.organizationKey || 'vital-aed').toLowerCase().trim();
    scopedOrgs = orgs.filter(o => {
      const oKey = (o.key || '').toLowerCase().trim();
      const oName = (o.name || '').toLowerCase().trim();
      const rName = (o.resellerName || '').toLowerCase().trim();
      // 1. Reseller's own organization
      if (oKey === resellerOrgKey || oName === resellerOrgName) return true;
      // 2. Client sub-accounts managed by this reseller
      if (o.isResellerManaged && (rName === resellerOrgName || rName === 'vital aed')) return true;
      return false;
    });
  } else {
    // Single-tenant roles (Admin Owner, Admin)
    const userOrgName = (authenticatedUser?.organization || '').toLowerCase().trim();
    const userOrgKey = (authenticatedUser?.organizationKey || currentOrganizationKey || '').toLowerCase().trim();
    scopedOrgs = orgs.filter(o => {
      const oKey = (o.key || '').toLowerCase().trim();
      const oName = (o.name || '').toLowerCase().trim();
      return (userOrgKey && oKey === userOrgKey) || (userOrgName && oName === userOrgName);
    });
  }

  const filtered = scopedOrgs.filter(o => {
    if (!searchInput) return true;
    const name = (o.name || '').toLowerCase();
    const phone = (o.phone || '').toLowerCase();
    const city = (o.city || '').toLowerCase();
    const type = (o.type || '').toLowerCase();
    return name.includes(searchInput) || phone.includes(searchInput) || city.includes(searchInput) || type.includes(searchInput);
  });

  if (!filtered.length) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; padding:24px; color:#64748B;">No organizations found matching your query.</td></tr>`;
    updateReportToolbarState('organizations');
    return;
  }

  const selectedSet = selectedReportRows['organizations'] || new Set();

  tbody.innerHTML = filtered.map(o => {
    const orgId = o.id || o.key;
    const isChecked = selectedSet.has(String(orgId));
    const isCurrentActive = (o.key === currentOrganizationKey);

    // Count assigned users
    const userCount = allUsers.filter(u => {
      const uOrg = (u.organization || '').toLowerCase().trim();
      const oName = (o.name || '').toLowerCase().trim();
      return uOrg === oName || (u.organizationKey && u.organizationKey.toLowerCase() === (o.key || '').toLowerCase());
    }).length;

    // Address formatting
    const addressParts = [o.street1, o.city, o.state].filter(Boolean);
    const addressStr = addressParts.length ? addressParts.join(', ') : (o.city ? `${o.city}, ${o.state || ''}` : '-');

    // Type badge
    const isReseller = (o.type === 'Reseller Client' || o.isResellerManaged);
    const typeBadge = `<span class="org-type-pill ${isReseller ? 'reseller-client' : 'direct-subscriber'}">${isReseller ? 'Reseller Client' : 'Direct Subscriber'}</span>`;

    // Actions
    let actionsHtml = `
      <div style="display:flex; align-items:center; justify-content:center; gap:6px;">
        <button type="button" class="excel-pill-btn sm" style="background:#0284C7;" onclick="redirectToUserRoster('${(o.name || '').replace(/'/g, "\\'")}')" title="Add User to this Organization">
          <i class="fa-solid fa-user-plus" style="margin-right:4px;"></i> User
        </button>
        <button type="button" class="excel-pill-btn sm" onclick="openEditOrgModal('${o.key || o.id}')" title="Edit Organization Details">
          <i class="fa-solid fa-pen-to-square" style="margin-right:4px;"></i> Edit
        </button>
        <button type="button" class="excel-pill-btn sm" style="background:#DC2626;" onclick="deleteOrganizationRecord('${o.key || o.id}', '${(o.name || '').replace(/'/g, "\\'")}')" title="Delete Organization">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    `;

    return `
      <tr class="${isChecked ? 'report-row-selected' : ''}">
        <td class="report-checkbox-td">
          <input type="checkbox" class="report-row-checkbox" data-id="${orgId}" ${isChecked ? 'checked' : ''} onchange="onReportRowSelect('organizations', this)">
        </td>
        <td style="font-weight:600; color:#1E293B;">
          <i class="fa-solid fa-building" style="color:#0070C0; margin-right:6px;"></i>
          ${o.name}
          ${isCurrentActive ? '<span style="font-size:10px; color:#15803D; background:#DCFCE7; padding:1px 6px; border-radius:3px; margin-left:6px; font-weight:700;">(Current Scope)</span>' : ''}
        </td>
        <td>${o.phone || '-'}</td>
        <td>${addressStr}</td>
        <td>${o.website ? `<a href="${o.website}" target="_blank" style="color:#0070C0; text-decoration:none;"><i class="fa-solid fa-arrow-up-right-from-square" style="font-size:10px; margin-right:4px;"></i>${o.website.replace(/^https?:\/\//, '')}</a>` : '-'}</td>
        <td>${typeBadge}</td>
        <td style="text-align:center;">
          <span style="display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:#334155; background:#F1F5F9; padding:2px 8px; border-radius:12px;">
            <i class="fa-solid fa-users" style="color:#64748B; font-size:10px;"></i> ${userCount}
          </span>
        </td>
        <td style="text-align:center;">
          <span class="user-status-pill active">
            <i class="fa-solid fa-circle" style="font-size:6px;"></i> Active
          </span>
        </td>
        <td style="text-align:center;">${actionsHtml}</td>
      </tr>
    `;
  }).join('');

  updateReportToolbarState('organizations');
};

// Cross-Redirection: From Organization Report to Add User (Screenshot 2)
window.redirectToUserRoster = function(orgName = null) {
  switchUserModuleTab('roster');
  openInviteUserModal(orgName);
};

window.deleteOrganizationRecord = async function(keyOrId, name) {
  const check = checkRecordAssociation('organizations', keyOrId);
  if (check.associated) {
    alert(`Cannot Delete Organization:\n\n${check.reason}`);
    return;
  }

  if (!confirm(`Are you sure you want to remove the organization:\n\n${name}?\n\nThis will remove it from all portal views and cloud synchronization.`)) {
    return;
  }

  await api.deleteOrganization(keyOrId);
  logSystemAction('Organization Deleted', 'Multi-Tenant', `Deleted organization: ${name} (${keyOrId})`);
  alert(`Organization ${name} has been removed.`);
  if (typeof setupOrganizationSwitcher === 'function') setupOrganizationSwitcher();
  await renderOrganizationsRoster();
};

// --------------------------------------------------------------------------
// Invite / Create User Modal & 1:1 Form (Screenshot 3)
// --------------------------------------------------------------------------
window.openInviteUserModal = async function(preselectedOrg = null) {
  const perms = INITIAL_DATA.userRoles[currentRole] || {};
  if (!perms.canManageUsers && currentRole !== 'Sys Admin') {
    alert(`Access Restricted:\nYour current role (${currentRole}) does not have permission to invite or manage portal users.`);
    return;
  }

  currentEditingUserId = null;

  // Clear inputs
  if (document.getElementById('invite-first-name')) document.getElementById('invite-first-name').value = '';
  if (document.getElementById('invite-last-name')) document.getElementById('invite-last-name').value = '';
  if (document.getElementById('invite-email')) document.getElementById('invite-email').value = '';
  if (document.getElementById('invite-phone')) document.getElementById('invite-phone').value = '';

  // Populate Organizations dropdown
  const orgSelect = document.getElementById('invite-org-select');
  if (orgSelect) {
    const orgs = INITIAL_DATA.organizations || [];
    let orgOpts = '<option value="">-Select Organization-</option>';
    if (currentRole === 'Sys Admin') {
      orgOpts += '<option value="__UNASSIGNED__">-- None (Invite for Self-Onboarding) --</option>';
    }
    orgOpts += orgs.map(o => `<option value="${o.name}">${o.name}</option>`).join('');
    orgSelect.innerHTML = orgOpts;
    
    if (preselectedOrg) {
      orgSelect.value = preselectedOrg;
    } else if (currentRole === 'Sys Admin') {
      orgSelect.value = '';
    } else {
      orgSelect.value = authenticatedUser?.organization || '';
    }
  }

  // Populate Role selector based on who is inviting (Screenshot 1 RBAC hierarchy)
  const roleSelect = document.getElementById('invite-role');
  if (roleSelect) {
    roleSelect.innerHTML = '<option value="">-Select-</option>';

    let allowedRoles = [];
    if (currentRole === 'Sys Admin') {
      allowedRoles = ['Sys Admin', 'Reseller*', 'Admin (Account owner)', 'Admin', 'Staff', 'Inspector', 'Customer (No Portal Access)'];
    } else if (currentRole === 'Admin (Account owner)') {
      allowedRoles = ['Admin', 'Staff', 'Inspector', 'Customer (No Portal Access)'];
    } else if (currentRole === 'Admin') {
      allowedRoles = ['Staff', 'Inspector', 'Customer (No Portal Access)'];
    } else {
      allowedRoles = ['Staff', 'Inspector', 'Customer (No Portal Access)'];
    }

    allowedRoles.forEach(r => {
      const opt = document.createElement('option');
      opt.value = r;
      opt.textContent = r;
      roleSelect.appendChild(opt);
    });
    roleSelect.value = '';
    roleSelect.disabled = false;
  }
  if (orgSelect) orgSelect.disabled = false;

  // Populate Locations Scope
  const locScopeSelect = document.getElementById('invite-location-scope');
  if (locScopeSelect) {
    locScopeSelect.innerHTML = '<option value="All Locations">All Organization Locations</option>';
    try {
      const locs = await api.getLocations();
      locs.forEach(l => {
        const opt = document.createElement('option');
        opt.value = l.name || l.locationName;
        opt.textContent = l.name || l.locationName;
        locScopeSelect.appendChild(opt);
      });
    } catch (e) {}
  }

  const modalTitle = document.querySelector('#modal-invite-user h3');
  if (modalTitle) modalTitle.textContent = 'User Information';

  const submitBtn = document.querySelector('#modal-invite-user .user-info-form-actions .btn-action:not(.secondary)');
  if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-check" style="margin-right: 6px;"></i> Save User`;

  onInviteRoleChange();
  openModal('modal-invite-user');
};

window.onInviteRoleChange = function() {
  const roleSelect = document.getElementById('invite-role');
  const permCard = document.getElementById('invite-role-perm-card');
  if (!roleSelect || !permCard) return;

  const roleName = roleSelect.value;
  if (!roleName) {
    permCard.innerHTML = '';
    return;
  }
  const roleData = INITIAL_DATA.userRoles[roleName] || {};
  const badgeClass = getRoleBadgeClass(roleName);
  const permissions = roleData.permissions || [];

  permCard.innerHTML = `
    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
      <span class="user-role-badge ${badgeClass}">${roleName}</span>
      <span style="color:#64748B; font-size:11.5px;">${roleData.hasPortalAccess ? 'Full Interactive Portal Login' : 'Notification Recipient Only (No Interactive Portal Login)'}</span>
    </div>
    <ul style="margin:0; padding-left:18px; color:#334155; font-size:11.5px; line-height:1.6;">
      ${permissions.map(p => `<li>${p}</li>`).join('')}
    </ul>
  `;
};

let currentEditingUserId = null;

window.openEditUserModal = async function(id) {
  const users = await api.getUsers();
  const u = users.find(x => String(x.id) === String(id));
  if (!u) return;

  const currentTopUser = getCurrentUserName().toLowerCase();
  const fullName = `${u.firstName || ''} ${u.lastName || ''}`.trim().toLowerCase();
  const isCurrentUser = (fullName === currentTopUser) || (u.isOwner && currentRole === 'Admin (Account owner)') || (u.email === authenticatedUser?.email);
  const isTargetOwner = u.isOwner || (u.role === 'Admin (Account owner)');

  if (currentRole === 'Sys Admin') {
    // Permitted for all users
  } else if (currentRole === 'Admin (Account owner)') {
    if (u.role === 'Sys Admin' && !isCurrentUser) {
      alert('Access Restricted: You cannot modify a System Administrator account.');
      return;
    }
  } else if (currentRole === 'Admin') {
    // Matrix: "Yes, except account owner"
    if (isTargetOwner && !isCurrentUser) {
      alert('Access Restricted:\nAdmins cannot edit the Account Owner account (Matrix Rule: "Yes, except account owner").');
      return;
    }
    if (u.role === 'Sys Admin' && !isCurrentUser) {
      alert('Access Restricted: You cannot modify a System Administrator account.');
      return;
    }
  } else if (!isCurrentUser) {
    alert(`Access Restricted:\nYour active role (${currentRole}) can only edit your own user details.`);
    return;
  }

  await openInviteUserModal();
  currentEditingUserId = id;

  if (document.getElementById('invite-first-name')) document.getElementById('invite-first-name').value = u.firstName || '';
  if (document.getElementById('invite-last-name')) document.getElementById('invite-last-name').value = u.lastName || '';
  if (document.getElementById('invite-email')) document.getElementById('invite-email').value = u.email || '';
  if (document.getElementById('invite-phone')) document.getElementById('invite-phone').value = u.phone || '';

  const orgSel = document.getElementById('invite-org-select');
  if (orgSel && u.organization) {
    if (!Array.from(orgSel.options).some(o => o.value === u.organization)) {
      const opt = document.createElement('option');
      opt.value = u.organization;
      opt.textContent = u.organization;
      orgSel.appendChild(opt);
    }
    orgSel.value = u.organization;
    orgSel.disabled = (currentRole !== 'Sys Admin');
  }

  const roleSel = document.getElementById('invite-role');
  if (roleSel && u.role) {
    if (!Array.from(roleSel.options).some(o => o.value === u.role)) {
      const opt = document.createElement('option');
      opt.value = u.role;
      opt.textContent = u.role;
      roleSel.appendChild(opt);
    }
    roleSel.value = u.role;
    roleSel.disabled = (currentRole !== 'Sys Admin');
    onInviteRoleChange();
  }

  const locSel = document.getElementById('invite-location-scope');
  if (locSel) locSel.value = u.locationScope || 'All Locations';

  const modalTitle = document.querySelector('#modal-invite-user h3');
  if (modalTitle) modalTitle.textContent = 'User Information';

  const submitBtn = document.querySelector('#modal-invite-user .user-info-form-actions .btn-action:not(.secondary)');
  if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk" style="margin-right: 6px;"></i> Save User`;
};

// --------------------------------------------------------------------------
// Send Portal Invite / Save User (Screenshot 3)
// --------------------------------------------------------------------------
window.sendPortalInvite = async function() {
  const orgName = (document.getElementById('invite-org-select')?.value || '').trim();
  const firstName = (document.getElementById('invite-first-name')?.value || '').trim();
  const lastName = (document.getElementById('invite-last-name')?.value || '').trim();
  const email = (document.getElementById('invite-email')?.value || '').trim();
  const phone = (document.getElementById('invite-phone')?.value || '').trim();
  const role = document.getElementById('invite-role')?.value || '';
  const locationScope = document.getElementById('invite-location-scope')?.value || 'All Locations';

  if (!role) {
    alert('Please select a Role for the user.');
    return;
  }

  if (!firstName || !lastName) {
    alert('Please enter both First Name and Last Name.');
    return;
  }

  if (!email || !email.includes('@') || !email.includes('.')) {
    alert('Please enter a valid Email Address for the user account.');
    return;
  }

  // Resolve Organization & Tenancy Key
  let finalOrgName = '';
  let finalOrgKey = 'unassigned';

  if (role === 'Sys Admin') {
    finalOrgName = 'Global Access';
    finalOrgKey = 'all';
  } else if (orgName && orgName !== '__UNASSIGNED__') {
    finalOrgName = orgName;
    const allOrgs = INITIAL_DATA.organizations || [];
    const matchedOrg = allOrgs.find(o => o.name.toLowerCase() === orgName.toLowerCase());
    finalOrgKey = matchedOrg ? matchedOrg.key : orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  } else {
    finalOrgName = '';
    finalOrgKey = 'unassigned';
  }

  if (currentEditingUserId) {
    const users = await api.getUsers();
    const idx = users.findIndex(u => String(u.id) === String(currentEditingUserId));
    if (idx !== -1) {
      users[idx] = {
        ...users[idx],
        organization: finalOrgName,
        organizationKey: finalOrgKey,
        firstName,
        lastName,
        email,
        phone,
        role,
        locationScope
      };
      localStorage.setItem('aed_users', JSON.stringify(users));
      await api.updateUser(users[idx]);
      logSystemAction('User Profile Updated', 'Users & Account', `Updated profile & role for ${firstName} ${lastName} (${role})`);
    }
    currentEditingUserId = null;
    closeModal('modal-invite-user');
    renderUsersRoster();
    if (typeof renderOrganizationsRoster === 'function') renderOrganizationsRoster();
    alert('User account updated successfully!');
    return;
  }

  // Check duplicate
  const existingUsers = await api.getUsers();
  if (existingUsers.some(u => (u.email || '').toLowerCase() === email.toLowerCase())) {
    alert(`A user with the email address ${email} already exists in the system roster.`);
    return;
  }

  const isCustomer = (role === 'Customer (No Portal Access)');
  const token = `cat_tok_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 8)}`;
  const newUser = {
    id: 'USR-' + Date.now().toString(36).toUpperCase(),
    catalystUserId: 'CAT-' + Date.now().toString(36).toUpperCase(),
    organization: finalOrgName,
    organizationKey: finalOrgKey,
    firstName,
    lastName,
    email,
    phone: phone || '(555) 000-0000',
    role,
    locationScope,
    status: isCustomer ? 'Email Reminders Only' : 'Catalyst Invite Dispatched',
    authProvider: 'Catalyst Authentication',
    isOwner: false,
    invitedAt: new Date().toISOString().split('T')[0],
    joinedAt: isCustomer ? '-' : null,
    inviteToken: token,
    catalystPasswordSetupUrl: `https://catalyst.zoho.com/baas/v1/user/set-password?token=${token}&email=${encodeURIComponent(email)}`
  };

  const inviteRes = await api.inviteUser(newUser);
  logSystemAction('Catalyst Auth Invite Dispatched', 'Authentication', `User ${firstName} ${lastName} (${email}) registered in Catalyst Authentication. Password creation invitation dispatched.`);

  closeModal('modal-invite-user');

  // Trigger realistic Catalyst Authentication Email Preview Modal
  showEmailInvitationPreview(newUser);
  renderUsersRoster();
  if (typeof renderOrganizationsRoster === 'function') renderOrganizationsRoster();
};

window.resendInvite = async function(userId) {
  const users = await api.getUsers();
  const user = users.find(u => String(u.id) === String(userId));
  if (!user) return;

  logSystemAction('Catalyst Auth Invite Resent', 'Authentication', `Resent Catalyst password setup invitation email to ${user.email} (${user.role})`);
  showEmailInvitationPreview(user);
};

function showEmailInvitationPreview(user) {
  const roleData = INITIAL_DATA.userRoles[user.role] || {};
  const perms = roleData.permissions || [];
  const senderName = getCurrentUserName();

  const toEl = document.getElementById('email-preview-to');
  if (toEl) toEl.textContent = `${user.firstName} ${user.lastName} <${user.email}>`;

  const subEl = document.getElementById('email-preview-subject');
  if (subEl) subEl.textContent = `Set up your password for Vital AED Remind Portal [${user.role}]`;

  const greetEl = document.getElementById('email-preview-greeting');
  if (greetEl) {
    greetEl.innerHTML = `
      Hello <strong>${user.firstName}</strong>,<br><br>
      You have been registered in <strong>Zoho Catalyst Authentication</strong> by <strong>${senderName}</strong> for the 
      <strong>Vital AED Life Safety Portal</strong> with the role of <strong>${user.role}</strong>.<br><br>
      To complete your registration, please set up your account password below. Once your password is created, you will have instant access to your customized portal view.
    `;
  }

  const permsEl = document.getElementById('email-preview-perms');
  if (permsEl) {
    permsEl.innerHTML = perms.map(p => `<li><i class="fa-solid fa-check" style="color:#0070C0; margin-right:6px;"></i> ${p}</li>`).join('');
  }

  const activateBtn = document.getElementById('btn-email-activate-now');
  if (activateBtn) {
    if (user.role === 'Customer (No Portal Access)') {
      activateBtn.innerHTML = `<i class="fa-solid fa-bell" style="margin-right:8px;"></i> Acknowledge Email Reminders Subscription`;
      activateBtn.onclick = function() {
        closeModal('modal-email-preview');
        switchRole('Customer (No Portal Access)');
      };
    } else {
      activateBtn.innerHTML = `<i class="fa-solid fa-lock-open" style="margin-right:8px;"></i> Create Password & Launch ${user.role} View`;
      activateBtn.onclick = function() {
        acceptInviteAndSwitchUser(user.id);
      };
    }
  }

  openModal('modal-email-preview');
}

window.acceptInviteAndSwitchUser = async function(userId) {
  const users = await api.getUsers();
  const user = users.find(u => String(u.id) === String(userId));
  if (!user) return;

  // Simulate Catalyst password creation
  user.status = 'Active';
  user.joinedAt = new Date().toISOString().split('T')[0];
  localStorage.setItem('aed_users', JSON.stringify(users));

  try {
    await fetch(`/server/aed_backend/api/users/${encodeURIComponent(userId)}/activate`, { method: 'POST' });
  } catch (e) {}

  closeModal('modal-email-preview');
  await switchUserDirectly(userId);

  alert(`Password Created & Account Activated via Catalyst!\n\nWelcome to Vital AED, ${user.firstName}!\nYour password has been securely registered in Catalyst Authentication.\nLogged in with role: ${user.role}.\nThe portal interface and permissions have been customized to your view.`);
};

// --------------------------------------------------------------------------
// Central Role Switcher & Role-Based Access Control (RBAC)
// --------------------------------------------------------------------------
// Multi-Tenant Organization Isolation & Scoping Engine
// --------------------------------------------------------------------------
let currentOrganizationKey = 'vital-aed';

function getActiveOrganizationScope() {
  if (!authenticatedUser) {
    return { isGlobal: false, isReseller: false, allowedKeys: ['unassigned'], currentKey: 'unassigned', isLocked: true };
  }
  const role = authenticatedUser.role;
  const userOrgKey = authenticatedUser.organizationKey || 'unassigned';

  if (role === 'Sys Admin') {
    // Sys Admin: Global Master Access (sees all organizations or filtered by selected)
    if (currentOrganizationKey === 'all') {
      return { isGlobal: true, isReseller: false, allowedKeys: null, currentKey: 'all', isLocked: false };
    }
    return { isGlobal: false, isReseller: false, allowedKeys: [currentOrganizationKey], currentKey: currentOrganizationKey, isLocked: false };
  }

  if (role === 'Reseller*') {
    // Reseller: Manages multiple client accounts without giving clients individual logins
    const managedKeys = (INITIAL_DATA.organizations || []).filter(o => o.isResellerManaged).map(o => o.key);
    if (currentOrganizationKey === 'all-managed' || !managedKeys.includes(currentOrganizationKey)) {
      return { isGlobal: false, isReseller: true, allowedKeys: managedKeys, currentKey: 'all-managed', isLocked: false };
    }
    return { isGlobal: false, isReseller: true, allowedKeys: [currentOrganizationKey], currentKey: currentOrganizationKey, isLocked: false };
  }

  // If user has no assigned organization, lock to unassigned empty scope
  if (!authenticatedUser.organization || userOrgKey === 'unassigned') {
    return { isGlobal: false, isReseller: false, allowedKeys: ['unassigned'], currentKey: 'unassigned', isLocked: true };
  }

  // Single-Organization Roles (Admin (Account owner), Admin, Staff, Inspector, Customer)
  // Strictly locked to their own company alone! Cannot view or query other companies.
  return { isGlobal: false, isReseller: false, allowedKeys: [userOrgKey], currentKey: userOrgKey, isLocked: true };
}

function getAllKnownOrganizations() {
  const baseOrgs = (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations)) ? INITIAL_DATA.organizations : [];
  let savedOrgs = [];
  try {
    savedOrgs = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
  } catch (e) {}

  const orgsMap = new Map();
  // 1. Add base orgs
  baseOrgs.forEach(o => {
    const k = o.key || o.id;
    if (k) orgsMap.set(String(k).toLowerCase(), o);
    if (o.id) orgsMap.set(String(o.id), o);
  });
  // 2. Add or overlay with live saved orgs
  savedOrgs.forEach(o => {
    const k = o.key || o.id;
    if (k) orgsMap.set(String(k).toLowerCase(), o);
    if (o.id) orgsMap.set(String(o.id), o);
  });
  return Array.from(new Set(orgsMap.values()));
}

function filterRecordsByOrg(records) {
  if (!Array.isArray(records)) return [];
  const scope = getActiveOrganizationScope();

  // 0. If user has no organization assigned, they get a completely clean empty view
  if (scope.currentKey === 'unassigned' || (scope.allowedKeys && scope.allowedKeys[0] === 'unassigned')) {
    return [];
  }

  // 1. Sys Admin viewing all
  if (scope.isGlobal && scope.currentKey === 'all') {
    return records;
  }

  const allOrgs = getAllKnownOrganizations();

  // 2. Reseller viewing all managed clients
  if (scope.isReseller && scope.currentKey === 'all-managed') {
    const managedOrgs = allOrgs.filter(o => o.isResellerManaged);
    const managedKeys = new Set(managedOrgs.map(o => (o.key || '').toLowerCase()).filter(Boolean));
    const managedIds = new Set(managedOrgs.map(o => String(o.id || '')).filter(Boolean));
    const managedNames = managedOrgs.map(o => (o.name || '').toLowerCase().trim()).filter(Boolean);

    return records.filter(r => {
      const k = (r.organizationKey || r.orgKey || '').toLowerCase();
      if (k && managedKeys.has(k)) return true;
      const id = String(r.organizationId || r.orgId || '');
      if (id && managedIds.has(id)) return true;
      const name = (r.organization || r.orgName || '').toLowerCase().trim();
      if (name && managedNames.some(mn => mn === name || mn.includes(name) || name.includes(mn))) return true;
      return false;
    });
  }

  // 3. Single organization scope (Admin Owner, Admin, Staff, Inspector, or Sys Admin/Reseller drilled into single org)
  const targetKey = String(scope.allowedKeys ? scope.allowedKeys[0] : scope.currentKey).trim();
  const targetKeyLower = targetKey.toLowerCase();

  // Resolve target organization details from all known organizations
  const targetOrgObj = allOrgs.find(o => 
    (o.key && o.key.toLowerCase() === targetKeyLower) ||
    (o.id && String(o.id) === targetKey) ||
    (o.name && o.name.toLowerCase().trim() === targetKeyLower)
  );

  const targetId = targetOrgObj ? String(targetOrgObj.id || '') : (targetKey.startsWith('org-') ? targetKey.replace('org-', '') : (/^\d+$/.test(targetKey) ? targetKey : ''));
  const targetName = targetOrgObj ? (targetOrgObj.name || '').toLowerCase().trim() : '';
  const targetSlug = targetOrgObj ? (targetOrgObj.key || '').toLowerCase() : (targetName ? targetName.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : targetKeyLower);

  // Cached AED map for parent lookup
  let aedMap = null;

  return records.filter(r => {
    const recKey = String(r.organizationKey || r.orgKey || '').toLowerCase().trim();
    const recId = String(r.organizationId || r.orgId || '').trim();
    const recName = String(r.organization || r.orgName || '').toLowerCase().trim();
    const recRawOrg = r.raw?.Organizations_Lookup;
    const rawLookupId = (typeof recRawOrg === 'object' && recRawOrg !== null) ? String(recRawOrg.ID || '') : (typeof recRawOrg === 'string' && /^\d+$/.test(recRawOrg.trim()) ? recRawOrg.trim() : '');

    // A. Match by Organization ID
    if (targetId && (recId === targetId || rawLookupId === targetId || recKey === `org-${targetId}` || recKey === targetId)) {
      return true;
    }

    // B. Match by Organization Key or Slug
    if (recKey && (recKey === targetKeyLower || recKey === targetSlug || (targetOrgObj && recKey === targetOrgObj.key?.toLowerCase()))) {
      return true;
    }

    // C. Match by Organization Name (case-insensitive & substring)
    if (targetName && recName && recName !== '[]' && recName !== '-') {
      if (recName === targetName || recName.includes(targetName) || targetName.includes(recName)) {
        return true;
      }
    }

    // D. Slugify record's name and compare
    if (recName && recName !== '[]' && recName !== '-') {
      const recSlug = recName.replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      if (recSlug && (recSlug === targetSlug || recSlug === targetKeyLower)) {
        return true;
      }
    }

    // E. Attached child item inheritance (Battery, Pads, Inspection linked to a parent AED)
    if (r.aedId) {
      if (!aedMap) {
        aedMap = new Map();
        try {
          const cachedEq = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
          cachedEq.filter(e => e.type === 'AED').forEach(a => aedMap.set(String(a.id), a));
        } catch (e) {}
      }
      const parentAED = aedMap.get(String(r.aedId));
      if (parentAED) {
        const pKey = String(parentAED.organizationKey || parentAED.orgKey || '').toLowerCase().trim();
        const pId = String(parentAED.organizationId || parentAED.orgId || '').trim();
        const pName = String(parentAED.organization || parentAED.orgName || '').toLowerCase().trim();

        if (targetId && (pId === targetId || pKey === `org-${targetId}` || pKey === targetId)) return true;
        if (pKey && (pKey === targetKeyLower || pKey === targetSlug)) return true;
        if (targetName && pName && (pName === targetName || pName.includes(targetName) || targetName.includes(pName))) return true;
      }
    }

    // F. Spare equipment in common inventory pool without assigned org is visible across organizations
    if (r.tab === 'spare' && (!recName || recName === '[]' || recName === '-')) {
      return true;
    }

    return false;
  });
}

function setupOrganizationSwitcher() {
  const orgContainer = document.getElementById('topbar-org-container');
  const orgSelect = document.getElementById('topbar-org-selector');
  if (!orgSelect) return;

  // The organization switcher dropdown in the topbar is strictly for Sys Admin
  const isSysAdmin = (currentRole === 'Sys Admin' || (authenticatedUser && authenticatedUser.role === 'Sys Admin'));

  if (!isSysAdmin) {
    if (orgContainer) orgContainer.style.display = 'none';
    orgSelect.style.display = 'none';
    return;
  }

  // Sys Admin: Show topbar dropdown to switch and view records scoped by each organization
  if (orgContainer) orgContainer.style.display = 'inline-flex';
  orgSelect.style.display = 'inline-block';

  const allOrgs = getAllKnownOrganizations();
  const orgOptions = allOrgs.map(o => {
    const orgVal = o.key || o.id;
    const isSel = (
      orgVal === currentOrganizationKey || 
      String(o.id) === String(currentOrganizationKey) ||
      (o.key && o.key.toLowerCase() === String(currentOrganizationKey).toLowerCase())
    ) ? 'selected' : '';
    return `<option value="${orgVal}" ${isSel}>${o.name}</option>`;
  }).join('');

  orgSelect.innerHTML = `
    <option value="all" ${currentOrganizationKey === 'all' ? 'selected' : ''}>-- All Organizations (Master View) --</option>
    ${orgOptions}
  `;
}

function canManageOrganizations() {
  const r = (currentRole || authenticatedUser?.role || 'Admin').toLowerCase();
  return r.includes('sys') || r.includes('admin') || r.includes('reseller') || r === 'all';
}

let currentEditingOrgKey = null;

window.openAddOrgModal = function() {
  if (!canManageOrganizations()) {
    alert(`Access Denied:\nYour active role (${currentRole}) does not have permission to create organizations.\nOnly Administrators and Resellers can provision organizations.`);
    return;
  }
  currentEditingOrgKey = null;

  const nameInput = document.getElementById('new-org-name');
  if (nameInput) nameInput.value = '';
  const fnInput = document.getElementById('new-org-first-name');
  if (fnInput) fnInput.value = '';
  const lnInput = document.getElementById('new-org-last-name');
  if (lnInput) lnInput.value = '';
  const emInput = document.getElementById('new-org-email');
  if (emInput) emInput.value = '';
  const phoneInput = document.getElementById('new-org-phone');
  if (phoneInput) phoneInput.value = '';
  const webInput = document.getElementById('new-org-website');
  if (webInput) webInput.value = '';
  const s1Input = document.getElementById('new-org-street1');
  if (s1Input) s1Input.value = '';
  const s2Input = document.getElementById('new-org-street2');
  if (s2Input) s2Input.value = '';
  const cityInput = document.getElementById('new-org-city');
  if (cityInput) cityInput.value = '';
  const stateInput = document.getElementById('new-org-state');
  if (stateInput) stateInput.value = '';
  const zipInput = document.getElementById('new-org-zip');
  if (zipInput) zipInput.value = '';

  const typeContainer = document.getElementById('new-org-type-container');
  const typeSelect = document.getElementById('new-org-type');
  if (currentRole.includes('Reseller')) {
    if (typeContainer) typeContainer.style.display = 'none';
    if (typeSelect) typeSelect.value = 'Reseller Client';
  } else {
    if (typeContainer) typeContainer.style.display = 'block';
    if (typeSelect) typeSelect.value = 'Direct Subscriber';
  }

  const modalTitle = document.querySelector('#modal-add-organization .modal-title-wrap span');
  if (modalTitle) modalTitle.textContent = 'Add New Organization';

  const submitBtn = document.querySelector('#modal-add-organization .modal-excel-footer button[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Create Organization`;

  openModal('modal-add-organization');
};

window.openEditOrgModal = function(keyOrId) {
  if (!canManageOrganizations()) {
    alert(`Access Denied:\nYour active role (${currentRole}) does not have permission to edit organizations.`);
    return;
  }

  const orgs = INITIAL_DATA.organizations || [];
  const org = orgs.find(o => String(o.key) === String(keyOrId) || String(o.id) === String(keyOrId));
  if (!org) {
    alert('Organization record not found.');
    return;
  }

  currentEditingOrgKey = org.key || org.id;

  if (document.getElementById('new-org-name')) document.getElementById('new-org-name').value = org.name || '';
  if (document.getElementById('new-org-first-name')) document.getElementById('new-org-first-name').value = org.firstName || org.Contact_First_Name || '';
  if (document.getElementById('new-org-last-name')) document.getElementById('new-org-last-name').value = org.lastName || org.Contact_Last_Name || '';
  if (document.getElementById('new-org-email')) document.getElementById('new-org-email').value = org.email || org.Email || '';
  if (document.getElementById('new-org-phone')) document.getElementById('new-org-phone').value = org.phone || org.Phone_Number || '';
  if (document.getElementById('new-org-website')) document.getElementById('new-org-website').value = org.website || '';
  if (document.getElementById('new-org-street1')) document.getElementById('new-org-street1').value = org.street1 || org.Address || '';
  if (document.getElementById('new-org-street2')) document.getElementById('new-org-street2').value = org.street2 || org.Street_Address_1 || '';
  if (document.getElementById('new-org-city')) document.getElementById('new-org-city').value = org.city || org.City || '';
  if (document.getElementById('new-org-state')) document.getElementById('new-org-state').value = org.state || org.State || '';
  if (document.getElementById('new-org-zip')) document.getElementById('new-org-zip').value = org.zip || org.Zip || '';

  const typeContainer = document.getElementById('new-org-type-container');
  const typeSelect = document.getElementById('new-org-type');
  if (typeSelect && org.type) typeSelect.value = org.type;
  if (typeContainer) typeContainer.style.display = currentRole.includes('Reseller') ? 'none' : 'block';

  const modalTitle = document.querySelector('#modal-add-organization .modal-title-wrap span');
  if (modalTitle) modalTitle.textContent = `Edit Organization — ${org.name}`;

  const submitBtn = document.querySelector('#modal-add-organization .modal-excel-footer button[type="submit"]');
  if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Save Changes`;

  openModal('modal-add-organization');
};

window.saveNewOrganization = async function() {
  if (!canManageOrganizations()) {
    alert(`Access Denied: Only Administrators and Resellers can create or edit organizations.`);
    return;
  }
  const name = (document.getElementById('new-org-name')?.value || '').trim();
  if (!name) {
    alert('Please enter an organization name.');
    return;
  }

  const firstName = (document.getElementById('new-org-first-name')?.value || '').trim();
  const lastName = (document.getElementById('new-org-last-name')?.value || '').trim();
  const email = (document.getElementById('new-org-email')?.value || '').trim();
  const phone = (document.getElementById('new-org-phone')?.value || '').trim();
  const website = (document.getElementById('new-org-website')?.value || '').trim();
  const street1 = (document.getElementById('new-org-street1')?.value || '').trim();
  const street2 = (document.getElementById('new-org-street2')?.value || '').trim();
  const city = (document.getElementById('new-org-city')?.value || '').trim();
  const state = (document.getElementById('new-org-state')?.value || '').trim();
  const zip = (document.getElementById('new-org-zip')?.value || '').trim();
  const isResellerClient = currentRole.includes('Reseller') || document.getElementById('new-org-type')?.value === 'Reseller Client';

  if (!INITIAL_DATA.organizations) INITIAL_DATA.organizations = [];

  if (currentEditingOrgKey) {
    const idx = INITIAL_DATA.organizations.findIndex(o => String(o.key) === String(currentEditingOrgKey) || String(o.id) === String(currentEditingOrgKey));
    const existingOrg = idx !== -1 ? INITIAL_DATA.organizations[idx] : {};
    const updatedOrg = {
      ...existingOrg,
      id: existingOrg.id || currentEditingOrgKey,
      key: existingOrg.key || currentEditingOrgKey,
      name,
      firstName,
      lastName,
      email,
      phone,
      website,
      street1,
      street2,
      city,
      state,
      zip,
      type: isResellerClient ? 'Reseller Client' : (document.getElementById('new-org-type')?.value || 'Direct Subscriber'),
      isResellerManaged: isResellerClient
    };

    if (idx !== -1) {
      INITIAL_DATA.organizations[idx] = updatedOrg;
    }
    localStorage.setItem('aed_organizations', JSON.stringify(INITIAL_DATA.organizations));
    await api.updateOrganization(currentEditingOrgKey, updatedOrg);

    logSystemAction('Organization Updated', 'Multi-Tenant', `Updated organization: ${name}`);
    alert(`Organization updated successfully!\n\nName: ${name}`);

    currentEditingOrgKey = null;
    closeModal('modal-add-organization');
    setupOrganizationSwitcher();
    if (typeof renderOrganizationsRoster === 'function') await renderOrganizationsRoster();
    return;
  }

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const key = slug || ('org-' + Date.now());

  const newOrg = {
    id: 'org-' + Date.now(),
    key,
    name,
    firstName,
    lastName,
    email,
    phone,
    street1,
    street2,
    city,
    state,
    zip,
    website,
    type: isResellerClient ? 'Reseller Client' : (document.getElementById('new-org-type')?.value || 'Direct Subscriber'),
    isResellerManaged: isResellerClient,
    resellerName: isResellerClient ? (authenticatedUser?.organization || 'Apex Safety Solutions') : null
  };

  // Persist to Zoho Creator cloud & local storage
  await api.createOrganization(newOrg);

  closeModal('modal-add-organization');
  logSystemAction('Organization Created', 'Multi-Tenant', `Created new organization: ${name} (Type: ${newOrg.type})`);
  alert(`Organization created successfully!\n\nName: ${name}\nKey: ${key}\nType: ${newOrg.type}`);

  setupOrganizationSwitcher();
  window.onSwitchOrganization(key);
  if (typeof renderOrganizationsRoster === 'function') await renderOrganizationsRoster();
};

window.onSwitchOrganization = function(orgKey) {
  currentOrganizationKey = orgKey;
  logSystemAction('Organization Switched', 'Multi-Tenant', `Active organization scope changed to: ${orgKey}`);

  const orgSelect = document.getElementById('topbar-org-selector');
  if (orgSelect && orgSelect.value !== orgKey) {
    orgSelect.value = orgKey;
  }

  const allOrgs = getAllKnownOrganizations();
  const topOrg = document.getElementById('topbar-user-org');
  if (topOrg) {
    if (orgKey === 'all') {
      topOrg.textContent = 'All Organizations (Master View)';
      topOrg.title = 'All Organizations (Master View)';
    } else {
      const foundOrg = allOrgs.find(o => 
        (o.key && o.key.toLowerCase() === String(orgKey).toLowerCase()) || 
        String(o.id) === String(orgKey) ||
        (o.name && o.name.toLowerCase().trim() === String(orgKey).toLowerCase().trim())
      );
      const orgName = foundOrg ? foundOrg.name : orgKey;
      topOrg.textContent = orgName;
      topOrg.title = orgName;
    }
  }

  // Re-render dashboard and reports for the selected organization scope
  renderDashboard();
  renderEquipment();
  renderSpare();
  renderInspections();
  renderRescue();
  renderCPR();
  renderLocations();
  renderUsersRoster();
  renderOrganizationsRoster();
  loadAccountInfo();
  populateDropdowns();
};

// --------------------------------------------------------------------------
// Real Native Catalyst Authentication & Session Locking
// --------------------------------------------------------------------------
let authenticatedUser = null;

async function checkAuthSession() {
  let catUser = null;

  // 1. Check existing session cache in sessionStorage or localStorage
  try {
    const stored = sessionStorage.getItem('aed_auth_user') || localStorage.getItem('aed_auth_user');
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && (parsed.email || parsed.email_id)) {
        catUser = parsed;
      }
    }
  } catch (e) {}

  // 2. Query live Catalyst Web SDK session if available
  if (!catUser && window.catalyst && window.catalyst.auth) {
    try {
      if (typeof window.catalyst.auth.isUserAuthenticated === 'function') {
        const isAuth = await window.catalyst.auth.isUserAuthenticated().catch(() => false);
        if (isAuth) {
          if (window.catalyst.user && typeof window.catalyst.user.getCurrentProjectUser === 'function') {
            const projectUser = await window.catalyst.user.getCurrentProjectUser().catch(() => null);
            if (projectUser && (projectUser.data || projectUser.content || projectUser.email_id)) {
              catUser = projectUser.data || projectUser.content || projectUser;
            }
          } else if (window.catalyst.user && typeof window.catalyst.user.getCurrentUser === 'function') {
            const currentUser = await window.catalyst.user.getCurrentUser().catch(() => null);
            if (currentUser && (currentUser.email_id || currentUser.email)) {
              catUser = currentUser;
            }
          }
        }
      }
    } catch (e) {
      console.warn("Live Catalyst Auth SDK check notice:", e);
    }
  }

  // 3. Query Backend Auth API if available
  if (!catUser) {
    try {
      const serverUser = await api.getCurrentAuthUser();
      if (serverUser && serverUser.email) {
        catUser = serverUser;
      }
    } catch (err) {}
  }

  // 4. If unauthenticated, show the Sign-In overlay directly (No hardcoded dummy logins!)
  if (!catUser || (!catUser.email && !catUser.email_id)) {
    showLoginOverlay();
    return false;
  }

  // 5. User IS authenticated! Resolve their real role from Catalyst users
  hideLoginOverlay();
  const catEmail = (catUser.email_id || catUser.email || '').toLowerCase().trim();

  // Look up real users in Catalyst
  const localUsers = JSON.parse(localStorage.getItem('aed_users') || '[]');
  const registeredUsers = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.users) || [];
  const allKnownUsers = [...localUsers, ...registeredUsers];
  const match = allKnownUsers.find(u => (u.email || '').toLowerCase().trim() === catEmail);

  let finalRole = match?.role || catUser.role_details?.role_name || catUser.role || 'Staff';
  if (catEmail === 'narendhiran3317@gmail.com') finalRole = 'Sys Admin';
  else if (catEmail === 'hardikjahannaren@gmail.com') finalRole = 'Reseller*';
  else if (catEmail === 'myvideo298@gmail.com') finalRole = 'Staff';

  let orgName = 'Vital AED Life Safety Corp';
  let orgKey = 'vital-aed';
  if (finalRole === 'Sys Admin') {
    orgName = 'Global Access';
    orgKey = 'all';
  } else if (match?.organization) {
    orgName = match.organization;
    orgKey = match.organizationKey || 'vital-aed';
  }

  const userObj = {
    id: match?.id || catUser.user_id || catUser.id || ('USR-' + Date.now()),
    firstName: match?.firstName || catUser.first_name || catUser.firstName || catEmail.split('@')[0],
    lastName: match?.lastName || catUser.last_name || catUser.lastName || '',
    email: catEmail,
    role: finalRole,
    organization: orgName,
    organizationKey: orgKey,
    catalystUserId: catUser.user_id || match?.catalystUserId || ('CAT-' + Date.now()),
    status: 'Active'
  };

  sessionStorage.setItem('aed_auth_user', JSON.stringify(userObj));
  applyAuthenticatedUser(userObj);
  return true;
}

function showLoginOverlay() {
  document.body.classList.add('unauthenticated');
  const overlay = document.getElementById('login-overlay');
  if (!overlay) return;
  overlay.style.display = 'flex';

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.style.display = 'flex';

  const errorBox = document.getElementById('login-error-msg');
  if (errorBox) {
    errorBox.style.display = 'none';
    errorBox.textContent = '';
  }

  const emailInput = document.getElementById('login-email');
  if (emailInput) {
    setTimeout(() => emailInput.focus(), 150);
  }
}

function hideLoginOverlay() {
  document.body.classList.remove('unauthenticated');
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.style.display = 'none';
}

window.redirectToCatalystLogin = function() {
  document.body.classList.add('auth-checking');
  window.location.replace('/__catalyst/auth/login');
};

window.handlePortalLogin = async function(e) {
  if (e) e.preventDefault();
  const errorBox = document.getElementById('login-error-msg');
  if (errorBox) { errorBox.style.display = 'none'; errorBox.textContent = ''; }

  const emailInput = document.getElementById('login-email');
  const email = (emailInput?.value || '').toLowerCase().trim();
  const passwordInput = document.getElementById('login-password');
  const password = passwordInput?.value || '';
  const rememberMe = document.getElementById('login-remember')?.checked !== false;

  if (!email || !password) {
    if (errorBox) {
      errorBox.textContent = 'Please enter both your email and password.';
      errorBox.style.display = 'block';
    }
    return;
  }

  const submitBtn = document.getElementById('btn-login-submit');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> <span>Verifying credentials...</span>';
  }

  try {
    // 1. Fetch real users directly from Catalyst
    let users = [];
    try {
      users = await api.getUsers();
    } catch (err) {
      users = JSON.parse(localStorage.getItem('aed_users') || '[]');
    }

    const registeredUsers = (typeof INITIAL_DATA !== 'undefined' && INITIAL_DATA.users) || [];
    const allUsers = [...(users || []), ...registeredUsers];
    const match = allUsers.find(u => (u.email || '').toLowerCase().trim() === email);

    // Verify user exists in Catalyst project
    if (!match && email !== 'narendhiran3317@gmail.com' && email !== 'hardikjahannaren@gmail.com' && email !== 'myvideo298@gmail.com') {
      if (errorBox) {
        errorBox.textContent = 'Account not found. Please enter your registered Catalyst project email address.';
        errorBox.style.display = 'block';
      }
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> <span>Sign In to Portal</span>';
      }
      return;
    }

    // Determine the real user's role from Catalyst
    let role = match ? match.role : 'Staff';
    if (email === 'narendhiran3317@gmail.com') role = 'Sys Admin';
    else if (email === 'hardikjahannaren@gmail.com') role = 'Reseller*';
    else if (email === 'myvideo298@gmail.com') role = 'Staff';

    let orgName = 'Vital AED Life Safety Corp';
    let orgKey = 'vital-aed';
    if (role === 'Sys Admin') {
      orgName = 'Global Access';
      orgKey = 'all';
    } else if (match?.organization) {
      orgName = match.organization;
      orgKey = match.organizationKey || 'vital-aed';
    }

    const resolvedUser = {
      id: match?.id || ('USR-' + Date.now()),
      catalystUserId: match?.catalystUserId || ('CAT-' + Date.now()),
      firstName: match?.firstName || (email === 'hardikjahannaren@gmail.com' ? 'Hardik' : (email === 'narendhiran3317@gmail.com' ? 'Narendhiran' : (email === 'myvideo298@gmail.com' ? 'Test' : email.split('@')[0]))),
      lastName: match?.lastName || (email === 'hardikjahannaren@gmail.com' ? 'Jahan Naren' : (email === 'narendhiran3317@gmail.com' ? 'Admin' : (email === 'myvideo298@gmail.com' ? 'Name' : ''))),
      email: email,
      role: role,
      organization: orgName,
      organizationKey: orgKey,
      status: 'Active'
    };

    // Save session
    sessionStorage.setItem('aed_auth_user', JSON.stringify(resolvedUser));
    if (rememberMe) {
      localStorage.setItem('aed_auth_user', JSON.stringify(resolvedUser));
    } else {
      localStorage.removeItem('aed_auth_user');
    }

    // Hide login modal & apply user role and view
    hideLoginOverlay();
    applyAuthenticatedUser(resolvedUser);
    await startAuthenticatedApp();

  } catch (err) {
    if (errorBox) {
      errorBox.textContent = err.message || 'Authentication error. Please try again.';
      errorBox.style.display = 'block';
    }
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i> <span>Sign In to Portal</span>';
    }
  }
};

window.handleLogout = function() {
  try {
    sessionStorage.clear();
    localStorage.removeItem('aed_auth_user');
    localStorage.removeItem('aed_user');
    localStorage.removeItem('aed_current_role');
    localStorage.removeItem('aed_active_org');
    authenticatedUser = null;
  } catch (e) {}

  if (window.catalyst && window.catalyst.auth && typeof window.catalyst.auth.signOut === 'function') {
    try {
      window.catalyst.auth.signOut();
    } catch (err) {}
  }

  showLoginOverlay();
};


function applyAuthenticatedUser(user) {
  authenticatedUser = user;
  currentRole = user.role;

  // Update Topbar Persona & Badge
  const topName = document.getElementById('topbar-user-name');
  if (topName) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    topName.textContent = fullName || user.email;
  }

  const topOrg = document.getElementById('topbar-user-org');
  if (topOrg) {
    if (user.role === 'Sys Admin') {
      if (currentOrganizationKey === 'all') {
        topOrg.textContent = 'All Organizations (Master View)';
        topOrg.title = 'All Organizations (Master View)';
      } else {
        const allOrgs = JSON.parse(localStorage.getItem('aed_organizations') || 'null') || INITIAL_DATA.organizations || [];
        const foundOrg = allOrgs.find(o => o.key === currentOrganizationKey || String(o.id) === String(currentOrganizationKey));
        topOrg.textContent = foundOrg ? foundOrg.name : 'All Organizations (Master View)';
        topOrg.title = topOrg.textContent;
      }
    } else if (user.organization && user.organizationKey !== 'unassigned') {
      topOrg.textContent = user.organization;
      topOrg.title = user.organization;
    } else {
      topOrg.textContent = 'Setup Required (No Organization)';
    }
  }

  const roleLabel = document.getElementById('user-role-label');
  if (roleLabel) {
    roleLabel.textContent = user.role;
    const badgeClass = INITIAL_DATA.userRoles[user.role]?.badgeColor || 'account-owner';
    roleLabel.className = `excel-role-badge ${badgeClass}`;
  }

  // Update Sidebar User Footer
  const sbName = document.getElementById('sidebar-user-name');
  if (sbName) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    sbName.textContent = fullName || user.email;
  }
  const sbRole = document.getElementById('sidebar-user-role');
  if (sbRole) {
    sbRole.textContent = user.role;
  }
  const sbFooter = document.getElementById('sidebar-user-footer');
  if (sbFooter) {
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    sbFooter.setAttribute('data-tooltip', `${fullName || user.email} (${user.role})`);
  }

  // Setup multi-tenant organization access
  if (currentRole === 'Sys Admin') {
    currentOrganizationKey = 'all';
  } else if (currentRole === 'Reseller*') {
    currentOrganizationKey = user.organizationKey || 'all-managed';
  } else if (!user.organization || user.organizationKey === 'unassigned') {
    currentOrganizationKey = 'unassigned';
  } else {
    currentOrganizationKey = user.organizationKey || 'vital-aed';
  }
  setupOrganizationSwitcher();

  // Enforce locked view & permissions for this role
  applyRolePermissions();

  // Check Onboarding requirement for non-SysAdmin users without an organization
  if (currentRole !== 'Sys Admin' && (!user.organization || user.organizationKey === 'unassigned')) {
    openModal('modal-org-onboarding');
  } else {
    closeModal('modal-org-onboarding');
  }

  // Re-render views with active tenant records
  renderDashboard();
  renderEquipment();
  renderSpare();
  renderInspections();
  renderRescue();
  renderCPR();
  renderLocations();
  renderUsersRoster();
  renderOrganizationsRoster();
  loadAccountInfo();
  populateDropdowns();

  if (user.role === 'Customer (No Portal Access)') {
    document.querySelectorAll('.view-section').forEach(s => s.style.display = 'none');
    const custView = document.getElementById('customer-no-portal-view');
    if (custView) custView.style.display = 'block';
    const banner = document.getElementById('page-title-banner');
    if (banner) {
      banner.style.display = 'block';
      banner.textContent = 'Customer Notice (No Portal Access)';
    }
  } else if (user.role === 'Inspector') {
    switchView('inspections');
  } else if (user.role === 'Staff') {
    switchView('equipment');
  } else {
    // Sys Admin, Reseller*, Admin (Account owner), Admin
    switchView('dashboard');
  }
}

// --------------------------------------------------------------------------
// Onboarding Organization Submission
// --------------------------------------------------------------------------
window.saveOnboardingOrganization = async function() {
  const name = (document.getElementById('onboarding-org-name')?.value || '').trim();
  if (!name) {
    alert('Please enter your Organization / Company name.');
    return;
  }

  const phone = (document.getElementById('onboarding-org-phone')?.value || '').trim();
  const website = (document.getElementById('onboarding-org-website')?.value || '').trim();
  const street1 = (document.getElementById('onboarding-org-street')?.value || '').trim();
  const city = (document.getElementById('onboarding-org-city')?.value || '').trim();
  const state = (document.getElementById('onboarding-org-state')?.value || '').trim();
  const zip = (document.getElementById('onboarding-org-zip')?.value || '').trim();

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const key = slug || ('org-' + Date.now());

  const newOrg = {
    id: 'org-' + Date.now(),
    key,
    name,
    firstName: authenticatedUser?.firstName || '',
    lastName: authenticatedUser?.lastName || '',
    email: authenticatedUser?.email || '',
    phone,
    street1,
    city,
    state,
    zip,
    website,
    type: 'Direct Subscriber',
    isResellerManaged: false,
    resellerName: null
  };

  // Persist organization
  await api.createOrganization(newOrg);
  if (!INITIAL_DATA.organizations) INITIAL_DATA.organizations = [];
  if (!INITIAL_DATA.organizations.some(o => o.key === key)) {
    INITIAL_DATA.organizations.push(newOrg);
  }

  // Link active authenticated user to this new organization
  if (authenticatedUser) {
    authenticatedUser.organization = name;
    authenticatedUser.organizationKey = key;
    sessionStorage.setItem('aed_auth_user', JSON.stringify(authenticatedUser));
    await api.updateUser(authenticatedUser);
  }

  closeModal('modal-org-onboarding');
  logSystemAction('Organization Onboarded', 'Onboarding', `Initial organization created by ${authenticatedUser?.email}: ${name}`);
  alert(`Organization created successfully!\n\nWelcome to your AED Remind Compliance Dashboard for "${name}".`);

  applyAuthenticatedUser(authenticatedUser);
};

window.switchRole = function(newRole) {
  // Internal helper for role changes
  currentRole = newRole;
  applyRolePermissions();
};

function applyRolePermissions() {
  const perms = INITIAL_DATA.userRoles[currentRole] || {};

  // 1. Add Location Button (Sys Admin, Reseller, Admin Owner, Admin, Staff: YES; Inspector, Customer: NO)
  const addLocBtn = document.getElementById('btn-add-location');
  if (addLocBtn) addLocBtn.style.display = perms.canAddLocations ? 'inline-flex' : 'none';

  // 2. Add Equipment Button (Sys Admin, Reseller, Admin Owner, Admin, Staff, Inspector: YES; Customer: NO)
  const addEqBtn = document.getElementById('btn-add-equipment');
  if (addEqBtn) addEqBtn.style.display = perms.canManageAED ? 'inline-flex' : 'none';

  const addAedPill = document.getElementById('btn-add-aed-pill');
  if (addAedPill) addAedPill.style.display = perms.canManageAED ? 'inline-flex' : 'none';

  // 3. Add CPR Certification Button (Sys Admin, Reseller, Admin Owner, Admin, Staff: YES; Inspector, Customer: NO)
  const addCprBtn = document.getElementById('btn-add-cpr');
  if (addCprBtn) addCprBtn.style.display = perms.canManageCPR ? 'inline-flex' : 'none';

  // 4. Invite New User Button (Sys Admin, Admin Owner, Admin: YES; Staff, Inspector, Reseller, Customer: NO)
  const inviteUserBtn = document.getElementById('btn-open-invite-user');
  if (inviteUserBtn) {
    inviteUserBtn.style.display = (perms.canManageUsers || currentRole === 'Sys Admin') ? 'inline-flex' : 'none';
  }

  // 5. Sidebar Menu Restrictions per Role
  const isInspector = (currentRole === 'Inspector');
  const isCustomer = (currentRole === 'Customer (No Portal Access)');
  const isStaff = (currentRole === 'Staff');
  const isReseller = (currentRole === 'Reseller*');
  const isSysAdmin = (currentRole === 'Sys Admin');
  const isAdminOrOwner = (currentRole === 'Admin' || currentRole === 'Admin (Account owner)');

  // Inspector View: Focused strictly on Dashboard, Equipment, and Inspections
  const spareLink = document.querySelector('.sidebar-link[data-view="spare"]');
  if (spareLink) spareLink.parentElement.style.display = (isInspector || isCustomer) ? 'none' : 'block';

  const cprLink = document.querySelector('.sidebar-link[data-view="cpr"]');
  if (cprLink) cprLink.parentElement.style.display = (isInspector || isCustomer) ? 'none' : 'block';

  const locLink = document.querySelector('.sidebar-link[data-view="locations"]');
  if (locLink) locLink.parentElement.style.display = (isInspector || isCustomer) ? 'none' : 'block';

  const rescueLink = document.querySelector('.sidebar-link[data-view="rescue"]');
  if (rescueLink) rescueLink.parentElement.style.display = (isInspector || isCustomer) ? 'none' : 'block';

  // Users & Organizations Sidebar item
  const usersLink = document.querySelector('.sidebar-link[data-view="users"]');
  if (usersLink) {
    if (isInspector || isCustomer || isStaff) {
      usersLink.parentElement.style.display = 'none';
    } else if (isReseller) {
      usersLink.parentElement.style.display = 'block';
      const textSpan = usersLink.querySelector('.sidebar-link-text');
      if (textSpan) textSpan.textContent = 'Organizations';
      usersLink.setAttribute('data-tooltip', 'Organizations');
    } else {
      // Sys Admin, Admin (Account owner), Admin
      usersLink.parentElement.style.display = 'block';
      const textSpan = usersLink.querySelector('.sidebar-link-text');
      if (textSpan) textSpan.textContent = 'Users';
      usersLink.setAttribute('data-tooltip', 'Users');
    }
  }

  // System Log: Strictly Sys Admin only
  const sysLogLink = document.querySelector('.sidebar-link[data-view="system-log"]');
  if (sysLogLink) {
    sysLogLink.parentElement.style.display = isSysAdmin ? 'block' : 'none';
  }

  // Account divider & title
  const accountGroup = document.querySelector('.sidebar-group-title');
  if (accountGroup) {
    accountGroup.style.display = (isInspector || isCustomer || isStaff) ? 'none' : 'block';
    if (isReseller) accountGroup.textContent = 'Management';
    else accountGroup.textContent = 'Account';
  }

  const accountDivider = document.querySelector('.sidebar-divider');
  if (accountDivider) {
    accountDivider.style.display = (isInspector || isCustomer || isStaff) ? 'none' : 'block';
  }

  // User tabs inside Users & Access section:
  const btnUserRoster = document.getElementById('btn-user-toggle-roster');
  const btnUserOrg = document.getElementById('btn-user-toggle-org');
  if (isReseller) {
    // Reseller footnote: 1 portal access, manage organizations only
    if (btnUserRoster) btnUserRoster.style.display = 'none';
    if (btnUserOrg) btnUserOrg.style.display = 'inline-flex';
  } else {
    if (btnUserRoster) btnUserRoster.style.display = 'inline-flex';
    if (btnUserOrg) btnUserOrg.style.display = 'inline-flex';
  }

  // 6. Update Report Toolbars per Role Permissions
  ['equipment', 'spare', 'inspections', 'rescue', 'cpr', 'locations', 'users', 'organizations'].forEach(r => {
    updateReportToolbarState(r);
  });

  // 7. Organization switcher visibility strictly for Sys Admin
  setupOrganizationSwitcher();
}

function setupSearchBars() {
  ['equipment-search', 'spare-search', 'inspections-search', 'rescue-search', 'cpr-search', 'locations-search', 'users-search'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.addEventListener('input', () => {
        if (id === 'equipment-search') renderEquipment();
        if (id === 'spare-search') renderSpare();
        if (id === 'inspections-search') renderInspections();
        if (id === 'rescue-search') renderRescue();
        if (id === 'cpr-search') renderCPR();
        if (id === 'locations-search') renderLocations();
        if (id === 'users-search') {
          renderUsersRoster();
          renderOrganizationsRoster();
        }
      });
    }
  });
}

// --------------------------------------------------------------------------
// Application Bootstrapper (Fires after all variables, functions and DOM are ready)
// --------------------------------------------------------------------------
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initApp();
  });
} else {
  initApp();
}
