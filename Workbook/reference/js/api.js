/**
 * Catalyst API Connector
 * Handles requests to Catalyst serverless functions and synchronizes with Zoho Creator
 */

class ApiService {
  constructor() {
    this.baseUrl = '/server/aed_backend/api';
    this.isCatalystAvailable = false;
    this.initStorage();
  }

  initStorage() {
    const DATA_VERSION = "11.0.0-miami-gardens-aligned";
    if (localStorage.getItem('aed_data_version') !== DATA_VERSION) {
      const eq = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.equipment || []) : [];
      const loc = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.locations || []) : [];
      const org = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.organizations || []) : [];
      const usr = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.users || []) : [];
      const insp = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.inspections || []) : [];
      const cpr = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.cprCertifications || []) : [];
      const rsc = typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.rescueEvents || []) : [];

      localStorage.setItem('aed_equipment', JSON.stringify(eq));
      localStorage.setItem('aed_inspections', JSON.stringify(insp));
      localStorage.setItem('aed_locations', JSON.stringify(loc));
      localStorage.setItem('aed_cpr', JSON.stringify(cpr));
      localStorage.setItem('aed_rescue', JSON.stringify(rsc));
      localStorage.setItem('aed_system_logs', '[]');
      localStorage.setItem('aed_users', JSON.stringify(usr));
      localStorage.setItem('aed_organizations', JSON.stringify(org));
      localStorage.setItem('aed_deleted_ids', '[]');
      localStorage.setItem('aed_data_version', DATA_VERSION);
    }
  }

  markRecordDeleted(id) {
    if (!id) return;
    try {
      const deletedIds = JSON.parse(localStorage.getItem('aed_deleted_ids') || '[]');
      if (!deletedIds.includes(String(id))) {
        deletedIds.push(String(id));
        localStorage.setItem('aed_deleted_ids', JSON.stringify(deletedIds));
      }
    } catch (e) {}
  }

  isRecordDeleted(id) {
    if (!id) return false;
    try {
      const deletedIds = JSON.parse(localStorage.getItem('aed_deleted_ids') || '[]');
      return deletedIds.includes(String(id));
    } catch (e) {
      return false;
    }
  }

  clearAllPortalRecords() {
    localStorage.setItem('aed_equipment', '[]');
    localStorage.setItem('aed_inspections', '[]');
    localStorage.setItem('aed_locations', '[]');
    localStorage.setItem('aed_cpr', '[]');
    localStorage.setItem('aed_rescue', '[]');
    localStorage.setItem('aed_system_logs', '[]');
    localStorage.setItem('aed_users', '[]');
    localStorage.setItem('aed_organizations', '[]');
    localStorage.setItem('aed_deleted_ids', '[]');
    localStorage.setItem('aed_data_version', "10.0.0-seed-populated");
  }

  // Authentication
  async getCurrentAuthUser() {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      const res = await fetch(`${this.baseUrl}/auth/current-user`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        const json = await res.json();
        if (json && json.authenticated && json.user) {
          return json.user;
        }
      }
    } catch (e) {
      console.warn("api.getCurrentAuthUser notice:", e);
    }
    return null;
  }

  async login(email, password) {
    try {
      const res = await fetch(`${this.baseUrl}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password })
      });
      if (res.ok) {
        const json = await res.json();
        if (json && json.authenticated && json.user) {
          return json.user;
        }
      }
    } catch (e) {
      console.warn("api.login backend notice:", e);
    }
    return null;
  }

  async logout() {
    try {
      await fetch(`${this.baseUrl}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (e) {
      console.warn("api.logout notice:", e);
    }
  }

  // Equipment
  async getEquipment(tab = 'active') {
    try {
      const res = await fetch(`${this.baseUrl}/equipment?status=${tab}`);
      if (res.ok) {
        const json = await res.json();
        if (json.source === 'creator' && Array.isArray(json.data)) {
          const liveData = json.data.filter(item => !this.isRecordDeleted(item.id));
          this.syncEquipmentCache(liveData, tab);
          const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
          return all.filter(item => !this.isRecordDeleted(item.id) && (item.tab || 'active').toLowerCase() === tab.toLowerCase());
        }
      }
    } catch (e) {
      console.warn("Creator equipment sync failed, falling back to local:", e);
    }
    const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    return all.filter(item => !this.isRecordDeleted(item.id) && (item.tab || 'active').toLowerCase() === tab.toLowerCase());
  }

  syncEquipmentCache(creatorRecords, tab) {
    try {
      let localAll = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
      localAll = localAll.filter(item => !this.isRecordDeleted(item.id));
      let otherTabs = localAll.filter(item => (item.tab || 'active').toLowerCase() !== tab.toLowerCase());
      const creatorIds = new Set(creatorRecords.map(r => String(r.id)));
      const cleanSn = s => (s || '').toLowerCase().replace(/^(aed\s*-\s*)/i, '').trim();
      const creatorSerials = new Set(creatorRecords.map(r => cleanSn(r.serialLot)).filter(s => s && s !== '-'));

      const pendingLocal = localAll.filter(item => {
        const itemTab = (item.tab || 'active').toLowerCase();
        if (itemTab !== tab.toLowerCase()) return false;
        if (this.isRecordDeleted(item.id)) return false;
        if (creatorIds.has(String(item.id))) return false;
        const sn = cleanSn(item.serialLot);
        if (sn && sn !== '-' && creatorSerials.has(sn)) return false;
        return true;
      });

      const merged = [...creatorRecords.filter(r => !this.isRecordDeleted(r.id)), ...pendingLocal, ...otherTabs];
      localStorage.setItem('aed_equipment', JSON.stringify(merged));
    } catch (e) {
      console.error("Cache sync error:", e);
    }
  }

  stampOrganization(item) {
    if (!item || typeof item !== 'object') return item;
    const baseOrgs = (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations)) ? INITIAL_DATA.organizations : [];
    let savedOrgs = [];
    try {
      savedOrgs = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
    } catch (e) {}
    const allKnown = [...baseOrgs, ...savedOrgs];

    const matchOrg = (query) => {
      if (!query) return null;
      const q = String(query).toLowerCase().trim();
      return allKnown.find(o => 
        (o.id && String(o.id) === String(query)) ||
        (o.key && o.key.toLowerCase() === q) ||
        (o.name && o.name.toLowerCase().trim() === q) ||
        (o.name && (o.name.toLowerCase().trim().includes(q) || q.includes(o.name.toLowerCase().trim())))
      ) || null;
    };

    let found = matchOrg(item.organizationId) || matchOrg(item.organizationKey || item.orgKey) || matchOrg(item.organization || item.orgName);

    if (!found) {
      let activeOrgKey = 'vital-aed';
      let activeOrgName = 'Vital AED Life Safety Corp (HQ)';
      let activeOrgId = '';
      try {
        const authUser = JSON.parse(sessionStorage.getItem('aed_auth_user') || localStorage.getItem('aed_auth_user') || 'null');
        if (authUser && (authUser.organizationKey || authUser.organization)) {
          activeOrgKey = authUser.organizationKey || activeOrgKey;
          activeOrgName = authUser.organization || activeOrgName;
          activeOrgId = authUser.organizationId || '';
        } else if (typeof currentOrganizationKey !== 'undefined' && currentOrganizationKey && currentOrganizationKey !== 'all' && currentOrganizationKey !== 'all-managed') {
          activeOrgKey = currentOrganizationKey;
        }
      } catch (e) {}

      found = matchOrg(activeOrgKey) || matchOrg(activeOrgName) || null;
      if (!found) {
        if (!item.organizationKey && !item.orgKey) item.organizationKey = activeOrgKey;
        if (!item.organization && !item.orgName) item.organization = activeOrgName;
        if (!item.organizationId && activeOrgId) item.organizationId = activeOrgId;
      }
    }

    if (found) {
      item.organization = found.name || item.organization;
      item.organizationKey = found.key || (found.name ? found.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') : item.organizationKey);
      if (found.id) item.organizationId = String(found.id);
    }

    return item;
  }

  async addEquipment(item) {
    this.stampOrganization(item);
    // Automatic Spare View Routing Rule (Client Requirement 2.3):
    // Items created without an assigned location automatically route to Spare
    if (!item.location || item.location === '-' || item.location.trim() === '' || item.tab === 'spare') {
      item.location = '-';
      item.tab = 'spare';
      item.inventoryStatus = 'spare';
      if (!item.serviceStatus || item.serviceStatus === 'Rescue-Ready') {
        item.serviceStatus = 'Standby';
      }
    } else if (item.tab !== 'archived') {
      item.tab = 'active';
      item.inventoryStatus = 'active';
    }

    const originalId = String(item.id);

    // Optimistic UI: Persist immediately to localStorage so UI updates instantly without blocking
    const all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const existingIdx = all.findIndex(e => 
      String(e.id) === String(item.id) || 
      String(e.id) === originalId || 
      (e.serialLot && item.serialLot && e.serialLot.toLowerCase() === item.serialLot.toLowerCase() && e.type === item.type)
    );
    if (existingIdx !== -1) {
      all[existingIdx] = { ...all[existingIdx], ...item };
    } else {
      all.unshift(item);
    }
    localStorage.setItem('aed_equipment', JSON.stringify(all));

    let serverResult = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${this.baseUrl}/equipment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        serverResult = await res.json();
        const serverId = serverResult?.data?.ID || serverResult?.result?.data?.ID || serverResult?.result?.ID;
        if (serverId) {
          item.id = String(serverId);
          const currentAll = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
          const matchIdx = currentAll.findIndex(e => String(e.id) === originalId);
          if (matchIdx !== -1) {
            currentAll[matchIdx].id = String(serverId);
            localStorage.setItem('aed_equipment', JSON.stringify(currentAll));
          }
        }
      }
    } catch (e) {
      console.warn("Failed to reach equipment backend:", e);
    }
    return { item, serverResult };
  }

  async updateEquipment(id, item) {
    this.stampOrganization(item);
    // Dynamic Spare <-> Equipment Transition:
    // If a spare item is assigned a location, automatically move to active Equipment
    if (item.location && item.location !== '-' && item.location.trim() !== '' && item.tab !== 'archived') {
      item.tab = 'active';
      item.inventoryStatus = 'active';
      if (!item.serviceStatus || item.serviceStatus === 'Standby') {
        item.serviceStatus = 'Rescue-Ready';
      }
    } else if (!item.location || item.location === '-' || item.location.trim() === '' || item.tab === 'spare') {
      item.location = '-';
      item.tab = 'spare';
      item.inventoryStatus = 'spare';
      if (!item.serviceStatus || item.serviceStatus === 'Rescue-Ready') {
        item.serviceStatus = 'Standby';
      }
    }

    const targetId = String(id || item.id);
    let all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const idx = all.findIndex(e => String(e.id) === targetId);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...item };
    }
    localStorage.setItem('aed_equipment', JSON.stringify(all));

    let serverResult = null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);
      const res = await fetch(`${this.baseUrl}/equipment/${encodeURIComponent(targetId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (res.ok) {
        serverResult = await res.json();
      }
    } catch (e) {
      console.warn("Failed to reach equipment backend for update:", e);
    }
    return { item, serverResult };
  }

  // Inspections
  async getInspections(tab = 'active') {
    try {
      const res = await fetch(`${this.baseUrl}/inspections?status=${tab}`);
      if (res.ok) {
        const json = await res.json();
        if (json.source === 'creator' && Array.isArray(json.data)) {
          const allEquipment = (JSON.parse(localStorage.getItem('aed_equipment') || '[]')).concat(typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.equipment || []) : []);
          const allLocations = (JSON.parse(localStorage.getItem('aed_locations') || '[]')).concat(typeof INITIAL_DATA !== 'undefined' ? (INITIAL_DATA.locations || []) : []);
          const liveData = json.data.filter(item => !this.isRecordDeleted(item.id)).map(item => {
            // Guarantee organization and organizationKey are set
            if (!item.organization || !item.organizationKey) {
              // 1. Check matching location
              const locMatch = allLocations.find(l => (l.name && item.location && l.name.toLowerCase() === item.location.toLowerCase()) || (l.id && item.locationId && String(l.id) === String(item.locationId)));
              if (locMatch && (locMatch.organization || locMatch.orgName)) {
                item.organization = locMatch.organization || locMatch.orgName;
                item.organizationKey = locMatch.organizationKey || locMatch.orgKey;
              }
              // 2. Check matching AED
              if (!item.organization) {
                const aedMatch = allEquipment.find(e => (item.aedId && String(e.id) === String(item.aedId)) || (item.serialNumber && e.serialLot && (e.serialLot === item.serialNumber || e.serialLot.includes(item.serialNumber))));
                if (aedMatch && (aedMatch.organization || aedMatch.orgName)) {
                  item.organization = aedMatch.organization || aedMatch.orgName;
                  item.organizationKey = aedMatch.organizationKey || aedMatch.orgKey;
                }
              }
              // 3. Fallback to stampOrganization
              if (!item.organization || !item.organizationKey) {
                this.stampOrganization(item);
              }
            }
            return item;
          });
          localStorage.setItem('aed_inspections', JSON.stringify(liveData));
          return liveData.filter(item => (item.tab || 'active').toLowerCase() === tab.toLowerCase());
        }
      }
    } catch (e) {
      console.warn("Creator inspections sync failed:", e);
    }
    const all = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
    return all.filter(item => !this.isRecordDeleted(item.id) && (item.tab || 'active').toLowerCase() === tab.toLowerCase());
  }

  async addInspection(item) {
    this.stampOrganization(item);
    const originalId = String(item.id);
    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/inspections`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        serverResult = await res.json();
        if (serverResult?.result?.data?.ID) {
          item.id = String(serverResult.result.data.ID);
        }
      }
    } catch (e) {
      console.warn("Failed to reach inspections backend:", e);
    }
    const all = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
    const existingIdx = all.findIndex(i => String(i.id) === String(item.id) || String(i.id) === originalId);
    if (existingIdx !== -1) {
      all[existingIdx] = { ...all[existingIdx], ...item };
    } else {
      all.unshift(item);
    }
    localStorage.setItem('aed_inspections', JSON.stringify(all));
    return { item, serverResult };
  }

  // Locations
  async getLocations() {
    try {
      const res = await fetch(`${this.baseUrl}/locations`);
      if (res.ok) {
        const json = await res.json();
        if (json.source === 'creator' && Array.isArray(json.data)) {
          const liveData = json.data.filter(l => !this.isRecordDeleted(l.id));
          localStorage.setItem('aed_locations', JSON.stringify(liveData));
          return liveData;
        }
      }
    } catch (e) {
      console.warn("Creator locations sync failed:", e);
    }
    const all = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    return all.filter(l => !this.isRecordDeleted(l.id));
  }

  async addLocation(loc) {
    this.stampOrganization(loc);
    const originalId = String(loc.id);
    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loc)
      });
      if (res.ok) {
        serverResult = await res.json();
        if (serverResult?.result?.data?.ID) {
          loc.id = String(serverResult.result.data.ID);
        }
      }
    } catch (e) {
      console.warn("Failed to reach locations backend:", e);
    }
    const all = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const existingIdx = all.findIndex(l => 
      String(l.id) === String(loc.id) || 
      String(l.id) === originalId ||
      (loc.originalName && l.name && l.name.toLowerCase() === loc.originalName.toLowerCase()) ||
      (l.name && loc.name && l.name.toLowerCase() === loc.name.toLowerCase())
    );
    if (existingIdx !== -1) {
      all[existingIdx] = { ...all[existingIdx], ...loc };
    } else {
      all.unshift(loc);
    }
    localStorage.setItem('aed_locations', JSON.stringify(all));
    return { loc, serverResult };
  }

  // Organizations
  async getOrganizations() {
    try {
      const res = await fetch(`${this.baseUrl}/organizations`);
      if (res.ok) {
        const json = await res.json();
        if (json.source === 'creator' && Array.isArray(json.data) && json.data.length > 0) {
          const liveData = json.data.filter(item => !this.isRecordDeleted(item.id) && !this.isRecordDeleted(item.key));
          let localOrgs = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
          const baseOrgs = (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations)) ? INITIAL_DATA.organizations : [];
          const liveKeys = new Set(liveData.map(o => (o.key || '').toLowerCase()));
          const liveNames = new Set(liveData.map(o => (o.name || '').toLowerCase()));
          const pending = localOrgs.filter(o => 
            !liveKeys.has((o.key || '').toLowerCase()) && 
            !liveNames.has((o.name || '').toLowerCase()) && 
            !this.isRecordDeleted(o.id) && 
            !this.isRecordDeleted(o.key)
          );
          const remainingBase = baseOrgs.filter(o =>
            !liveKeys.has((o.key || '').toLowerCase()) &&
            !liveNames.has((o.name || '').toLowerCase()) &&
            !this.isRecordDeleted(o.id) &&
            !this.isRecordDeleted(o.key)
          );
          const merged = [...liveData, ...pending, ...remainingBase];
          localStorage.setItem('aed_organizations', JSON.stringify(merged));
          if (typeof INITIAL_DATA !== 'undefined') INITIAL_DATA.organizations = merged;
          return merged;
        }
      }
    } catch (e) {
      console.warn("Creator organization sync failed, falling back to local:", e);
    }
    const local = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
    const filtered = local.filter(item => !this.isRecordDeleted(item.id) && !this.isRecordDeleted(item.key));
    if (typeof INITIAL_DATA !== 'undefined' && filtered.length > 0) INITIAL_DATA.organizations = filtered;
    return filtered;
  }

  async createOrganization(org) {
    if (!org) return null;
    let localOrgs = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
    localOrgs = localOrgs.filter(o => String(o.id) !== String(org.id) && String(o.key) !== String(org.key));
    localOrgs.push(org);
    localStorage.setItem('aed_organizations', JSON.stringify(localOrgs));
    if (typeof INITIAL_DATA !== 'undefined') INITIAL_DATA.organizations = localOrgs;

    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/organizations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(org)
      });
      if (res.ok) {
        serverResult = await res.json();
        if (serverResult && serverResult.success) {
          const creatorId = serverResult.result?.data?.ID;
          if (creatorId) {
            org.id = String(creatorId);
            const idx = localOrgs.findIndex(o => o.key === org.key);
            if (idx !== -1) {
              localOrgs[idx].id = org.id;
              localStorage.setItem('aed_organizations', JSON.stringify(localOrgs));
            }
          }
        }
      }
    } catch (e) {
      console.warn("Backend createOrganization notice:", e);
    }
    return { success: true, org, serverResult };
  }

  async updateOrganization(id, org) {
    let localOrgs = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
    const idx = localOrgs.findIndex(o => String(o.id) === String(id) || String(o.key) === String(id) || String(o.key) === String(org.key));
    if (idx !== -1) {
      localOrgs[idx] = { ...localOrgs[idx], ...org };
      localStorage.setItem('aed_organizations', JSON.stringify(localOrgs));
      if (typeof INITIAL_DATA !== 'undefined') INITIAL_DATA.organizations = localOrgs;
    }

    try {
      const res = await fetch(`${this.baseUrl}/organizations/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(org)
      });
      if (res.ok) {
        return await res.json();
      }
    } catch (e) {
      console.warn("Backend updateOrganization notice:", e);
    }
    return { success: true, source: 'local' };
  }

  // CPR Certifications
  async getCPRCertifications() {
    const normalize = (r, idx) => ({
      id: String(r.id || r.ID || r.Record_ID || ('CPR-' + (idx !== undefined ? idx : Date.now()))),
      location: r.location || r.Locations?.display_value || r.Location?.display_value || r.Location || r.Locations || '-',
      firstName: r.firstName || r.Participant_First_Name || r.First_Name || r.Name?.first_name || r.Student_First_Name || '-',
      lastName: r.lastName || r.Participant_Last_Name || r.Last_Name || r.Name?.last_name || r.Student_Last_Name || '',
      email: r.email || r.Participant_Email || r.Email || '',
      phone: r.phone || r.Participant_Phone_Number || r.Phone_Number || r.Phone || '',
      classDate: r.classDate || r.Class_Date || '',
      classType: r.classType || r.Class_Type || r.CPR_Class_Type || r.Training_Type || 'Adult & Pediatric CPR/AED',
      accreditation: r.accreditation || r.Accreditation_Type || r.Accreditation || r.Issuing_Organization || 'AHA',
      expirationDate: r.expirationDate || r.Expiration_Date || r.Cert_Expiration_Date || '-',
      status: r.status || r.Expiration_Status1 || r.Expiration_Status || r.Status || r.Certification_Status || 'Ok',
      raw: r
    });

    try {
      const res = await fetch(`${this.baseUrl}/cpr`);
      if (res.ok) {
        const json = await res.json();
        if (json.source === 'creator' && Array.isArray(json.data)) {
          const list = json.data.map((item, i) => normalize(item, i)).filter(item => !this.isRecordDeleted(item.id));
          localStorage.setItem('aed_cpr', JSON.stringify(list));
          return list;
        }
      }
    } catch (e) {}
    const rawLocal = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
    return rawLocal.map((item, i) => normalize(item, i)).filter(item => !this.isRecordDeleted(item.id));
  }

  async addCPRCertification(cert) {
    this.stampOrganization(cert);
    const originalId = String(cert.id);
    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/cpr`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(cert)
      });
      if (res.ok) {
        serverResult = await res.json();
        if (serverResult?.result?.data?.ID) {
          cert.id = String(serverResult.result.data.ID);
        }
      }
    } catch (e) {}
    const all = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
    const existingIdx = all.findIndex(c => 
      String(c.id) === String(cert.id) || 
      String(c.id) === originalId ||
      (c.firstName && cert.firstName && c.lastName && cert.lastName &&
       c.firstName.toLowerCase() === cert.firstName.toLowerCase() &&
       c.lastName.toLowerCase() === cert.lastName.toLowerCase())
    );
    if (existingIdx !== -1) {
      all[existingIdx] = { ...all[existingIdx], ...cert };
    } else {
      all.unshift(cert);
    }
    localStorage.setItem('aed_cpr', JSON.stringify(all));
    return { cert, serverResult };
  }

  // Rescue Events
  async getRescueEvents() {
    try {
      const res = await fetch(`${this.baseUrl}/rescue-events`);
      if (res.ok) {
        const json = await res.json();
        if (json.source === 'creator' && json.data) {
          localStorage.setItem('aed_rescue', JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch (e) {}
    return JSON.parse(localStorage.getItem('aed_rescue') || '[]');
  }

  async addRescueEvent(item) {
    this.stampOrganization(item);
    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/rescue-events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item)
      });
      if (res.ok) {
        serverResult = await res.json();
      }
    } catch (e) {}

    const all = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
    if (serverResult?.recordId) {
      item.creatorRecordId = serverResult.recordId;
      item.downloadUrl = `/server/aed_backend/api/rescue-events/${serverResult.recordId}/download`;
    }
    const existingIdx = all.findIndex(r => 
      String(r.id) === String(item.id) || 
      (item.creatorRecordId && String(r.creatorRecordId) === String(item.creatorRecordId))
    );
    if (existingIdx !== -1) {
      all[existingIdx] = { ...all[existingIdx], ...item };
    } else {
      all.unshift(item);
    }
    localStorage.setItem('aed_rescue', JSON.stringify(all));
    return { item, serverResult };
  }

  async getCreatorMetadata() {
    try {
      const res = await fetch(`${this.baseUrl}/creator/meta`);
      if (res.ok) return await res.json();
    } catch (e) {}
    return null;
  }

  // System Audit Logs
  async getSystemLogs() {
    try {
      const res = await fetch(`${this.baseUrl}/system-logs`);
      if (res.ok) {
        const json = await res.json();
        if (json.data) return json.data;
      }
    } catch (e) {}
    return JSON.parse(localStorage.getItem('aed_system_logs') || '[]');
  }

  async addSystemLog(entry) {
    try {
      await fetch(`${this.baseUrl}/system-logs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(entry)
      });
    } catch (e) {}
    const logs = JSON.parse(localStorage.getItem('aed_system_logs') || '[]');
    logs.unshift(entry);
    localStorage.setItem('aed_system_logs', JSON.stringify(logs));
    return entry;
  }


  // Users Management & Portal Invites
  async getUsers() {
    try {
      const res = await fetch(`${this.baseUrl}/users`);
      if (res.ok) {
        const json = await res.json();
        if (json.data && Array.isArray(json.data) && json.data.length > 0) {
          const filtered = json.data.filter(u => !this.isRecordDeleted(u.id) && !this.isRecordDeleted(u.creatorRecordId));
          localStorage.setItem('aed_users', JSON.stringify(filtered));
          return filtered;
        }
      }
    } catch (e) {
      console.warn("Failed to fetch users from server, falling back to local storage:", e);
    }
    const all = JSON.parse(localStorage.getItem('aed_users') || '[]');
    if (!all || all.length === 0) {
      return await this._legacyMockUsers();
    }
    return all.filter(u => !this.isRecordDeleted(u.id) && !this.isRecordDeleted(u.creatorRecordId));
  }

  async _legacyMockUsers() {
    let local = [
        {
          id: '114503000000016049',
          catalystUserId: '114503000000016049',
          creatorRecordId: '4923252000000319053',
          firstName: 'Narendhiran',
          lastName: 'SysAdmin',
          email: 'narendhiran3317@gmail.com',
          phone: '(555) 100-2000',
          role: 'Sys Admin',
          catalystRoleId: '114503000000023036',
          organization: 'Vital AED',
          organizationKey: 'vital-aed',
          locationScope: 'All Organizations',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: true,
          invitedAt: '2026-10-09',
          joinedAt: '2026-10-09'
        },
        {
          id: '114503000000014085',
          catalystUserId: '114503000000014085',
          creatorRecordId: '4923252000000339002',
          firstName: 'Hardik',
          lastName: 'Jahan Naren',
          email: 'hardikjahannaren@gmail.com',
          phone: '(555) 456-7890',
          role: 'Reseller*',
          catalystRoleId: '114503000000023038',
          organization: 'Vital AED',
          organizationKey: 'vital-aed',
          locationScope: 'Managed Client Accounts',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-10-09',
          joinedAt: '2026-10-09'
        },
        {
          id: 'USR-SYSADMIN-01',
          catalystUserId: 'CAT-SYSADMIN-01',
          firstName: 'Christine',
          lastName: 'Shale',
          email: 'christine@vitalaed.com',
          phone: '(555) 100-2000',
          role: 'Sys Admin',
          catalystRoleId: '114503000000023036',
          organization: 'Vital AED Life Safety Corp (HQ)',
          organizationKey: 'vital-aed',
          locationScope: 'All Organizations',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: true,
          invitedAt: '2026-08-01',
          joinedAt: '2026-08-01'
        },
        {
          id: 'USR-OWNER-01',
          catalystUserId: 'CAT-OWNER-01',
          firstName: 'Christine',
          lastName: 'Miller',
          email: 'cmiller@vitalaed.com',
          phone: '(555) 234-5678',
          role: 'Admin (Account owner)',
          catalystRoleId: '114503000000023042',
          organization: 'Vital AED Life Safety Corp (HQ)',
          organizationKey: 'vital-aed',
          locationScope: 'All Locations',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: true,
          invitedAt: '2026-08-01',
          joinedAt: '2026-08-01'
        },
        {
          id: 'USR-ADMIN-01',
          catalystUserId: 'CAT-ADMIN-01',
          firstName: 'Marcus',
          lastName: 'Vance',
          email: 'mvance@vitalaed.com',
          phone: '(555) 345-6789',
          role: 'Admin',
          catalystRoleId: '114503000000023040',
          organization: 'Vital AED Life Safety Corp (HQ)',
          organizationKey: 'vital-aed',
          locationScope: 'All Locations',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-08-05',
          joinedAt: '2026-08-06'
        },
        {
          id: 'USR-STAFF-01',
          catalystUserId: 'CAT-STAFF-01',
          firstName: 'Sarah',
          lastName: 'Jenkins',
          email: 'sjenkins@vitalaed.com',
          phone: '(555) 567-8901',
          role: 'Staff',
          catalystRoleId: '114503000000023044',
          organization: 'Vital AED Life Safety Corp (HQ)',
          organizationKey: 'vital-aed',
          locationScope: 'Austin Medical Center',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-08-15',
          joinedAt: '2026-08-16'
        },
        {
          id: 'USR-OWNER-02',
          catalystUserId: 'CAT-OWNER-02',
          firstName: 'David',
          lastName: 'Rodriguez',
          email: 'drodriguez@miamigardensfl.gov',
          phone: '(305) 555-0199',
          role: 'Admin (Account owner)',
          catalystRoleId: '114503000000023042',
          organization: 'City of Miami Gardens - Parks & Rec',
          organizationKey: 'miami-gardens',
          locationScope: 'All Municipal Facilities',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: true,
          invitedAt: '2026-08-02',
          joinedAt: '2026-08-03'
        },
        {
          id: 'USR-STAFF-02',
          catalystUserId: 'CAT-STAFF-02',
          firstName: 'Maria',
          lastName: 'Rivera',
          email: 'mrivera@miamigardensfl.gov',
          phone: '(305) 555-0244',
          role: 'Staff',
          catalystRoleId: '114503000000023044',
          organization: 'City of Miami Gardens - Parks & Rec',
          organizationKey: 'miami-gardens',
          locationScope: 'Betty T. Ferguson Center',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-08-16',
          joinedAt: '2026-08-17'
        },
        {
          id: 'USR-RESELLER-01',
          catalystUserId: 'CAT-RESELLER-01',
          firstName: 'Apex Safety',
          lastName: 'Solutions',
          email: 'support@apexsafety.com',
          phone: '(555) 456-7890',
          role: 'Reseller*',
          catalystRoleId: '114503000000023038',
          organization: 'Apex Safety Solutions',
          organizationKey: 'apex-reseller',
          locationScope: 'Managed Client Accounts (Ft. Lauderdale & Coral Gables)',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-08-10',
          joinedAt: '2026-08-11'
        },
        {
          id: 'USR-STAFF-03',
          catalystUserId: 'CAT-STAFF-03',
          firstName: 'Rachel',
          lastName: 'Adams',
          email: 'radams@ftlauderdalefitness.com',
          phone: '(954) 555-4321',
          role: 'Staff',
          catalystRoleId: '114503000000023044',
          organization: 'Fort Lauderdale Fitness Centers',
          organizationKey: 'ft-lauderdale',
          locationScope: 'Downtown Las Olas Gym',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-08-12',
          joinedAt: '2026-08-13'
        },
        {
          id: 'USR-INSPECTOR-02',
          catalystUserId: 'CAT-INSPECTOR-02',
          firstName: 'Carlos',
          lastName: 'Mendez',
          email: 'cmendez@coralgablescommunity.org',
          phone: '(305) 555-8765',
          role: 'Inspector',
          catalystRoleId: '114503000000023046',
          organization: 'Coral Gables Community Center',
          organizationKey: 'coral-gables',
          locationScope: 'All Community Buildings',
          status: 'Active',
          authProvider: 'Catalyst Authentication',
          isOwner: false,
          invitedAt: '2026-08-18',
          joinedAt: '2026-08-19'
        },
        {
          id: 'USR-CUSTOMER-01',
          catalystUserId: 'CAT-CUSTOMER-01',
          firstName: 'Robert',
          lastName: 'Chen',
          email: 'rchen@gmail.com',
          phone: '(555) 789-0123',
          role: 'Customer (No Portal Access)',
          catalystRoleId: null,
          organization: 'Vital AED Life Safety Corp (HQ)',
          organizationKey: 'vital-aed',
          locationScope: 'Email Reminders Only',
          status: 'Email Reminders Only',
          authProvider: 'None',
          isOwner: false,
          invitedAt: '2026-08-20',
          joinedAt: '-'
        }
      ];
    localStorage.setItem('aed_users', JSON.stringify(local));
    return local;
  }

  async inviteUser(user) {
    this.stampOrganization(user);
    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/users/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (res.ok) serverResult = await res.json();
    } catch (e) {}
    const users = await this.getUsers();
    users.unshift(user);
    localStorage.setItem('aed_users', JSON.stringify(users));
    return { user, serverResult };
  }

  async updateUser(user) {
    this.stampOrganization(user);
    const userId = user.id || user.catalystUserId;
    let serverResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/users/${encodeURIComponent(userId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(user)
      });
      if (res.ok) serverResult = await res.json();
    } catch (e) {
      console.warn("Failed to update user on server:", e);
    }
    let all = JSON.parse(localStorage.getItem('aed_users') || '[]');
    const idx = all.findIndex(u => String(u.id) === String(userId) || String(u.catalystUserId) === String(userId) || (user.email && (u.email || '').toLowerCase() === user.email.toLowerCase()));
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...user };
    } else {
      all.unshift(user);
    }
    localStorage.setItem('aed_users', JSON.stringify(all));
    return { user, serverResult };
  }

  async deleteUser(userId) {
    this.markRecordDeleted(userId);
    let users = await this.getUsers();
    users = users.filter(u => String(u.id) !== String(userId) && String(u.creatorRecordId) !== String(userId));
    localStorage.setItem('aed_users', JSON.stringify(users));
    try {
      await fetch(`${this.baseUrl}/users/${encodeURIComponent(userId)}`, { method: 'DELETE' });
    } catch (e) {
      console.warn('Backend user delete notice:', e);
    }
    return true;
  }

  async deleteEquipment(id, itemMeta = {}) {
    this.markRecordDeleted(id);
    let all = JSON.parse(localStorage.getItem('aed_equipment') || '[]');
    const target = all.find(e => String(e.id) === String(id));
    const itemType = itemMeta.type || target?.type || '';
    const itemReport = itemMeta.report || target?.reportLinkName || '';

    // Optimistic local deletion
    all = all.filter(e => String(e.id) !== String(id));
    localStorage.setItem('aed_equipment', JSON.stringify(all));

    try {
      const q = new URLSearchParams({ skipAssocCheck: 'true' });
      if (itemType) q.append('type', itemType);
      if (itemReport) q.append('report', itemReport);

      const res = await fetch(`${this.baseUrl}/equipment/${encodeURIComponent(id)}?${q.toString()}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        if (target) {
          all.push(target);
          localStorage.setItem('aed_equipment', JSON.stringify(all));
        }
        alert(json.error || 'This record could not be deleted.');
        return false;
      }
    } catch (e) {
      console.warn('Backend equipment delete sync notice:', e);
    }
    return true;
  }

  async deleteInspection(id) {
    this.markRecordDeleted(id);
    let all = JSON.parse(localStorage.getItem('aed_inspections') || '[]');
    const target = all.find(i => String(i.id) === String(id));
    all = all.filter(i => String(i.id) !== String(id));
    localStorage.setItem('aed_inspections', JSON.stringify(all));

    try {
      const res = await fetch(`${this.baseUrl}/inspections/${encodeURIComponent(id)}?skipAssocCheck=true`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        if (target) {
          all.push(target);
          localStorage.setItem('aed_inspections', JSON.stringify(all));
        }
        alert(json.error || 'This inspection could not be deleted.');
        return false;
      }
    } catch (e) {
      console.warn('Backend inspection delete sync notice:', e);
    }
    return true;
  }

  async deleteLocation(id) {
    this.markRecordDeleted(id);
    let all = JSON.parse(localStorage.getItem('aed_locations') || '[]');
    const target = all.find(l => String(l.id) === String(id));
    all = all.filter(l => String(l.id) !== String(id));
    localStorage.setItem('aed_locations', JSON.stringify(all));

    try {
      const res = await fetch(`${this.baseUrl}/locations/${encodeURIComponent(id)}?skipAssocCheck=true`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        if (target) {
          all.push(target);
          localStorage.setItem('aed_locations', JSON.stringify(all));
        }
        alert(json.error || 'This record could not be deleted.');
        return false;
      }
    } catch (e) {
      console.warn('Backend location delete sync notice:', e);
    }
    return true;
  }

  async deleteOrganization(id) {
    this.markRecordDeleted(id);
    const targetId = String(id);

    // Synchronously filter both localStorage and INITIAL_DATA.organizations
    let all = JSON.parse(localStorage.getItem('aed_organizations') || '[]');
    all = all.filter(o => String(o.id) !== targetId && String(o.key) !== targetId);
    localStorage.setItem('aed_organizations', JSON.stringify(all));

    if (typeof INITIAL_DATA !== 'undefined' && Array.isArray(INITIAL_DATA.organizations)) {
      INITIAL_DATA.organizations = INITIAL_DATA.organizations.filter(o => String(o.id) !== targetId && String(o.key) !== targetId);
    }

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      await fetch(`${this.baseUrl}/organizations/${encodeURIComponent(targetId)}`, {
        method: 'DELETE',
        signal: controller.signal
      });
      clearTimeout(timeoutId);
    } catch (e) {
      console.warn('Backend organization delete sync notice:', e);
    }
    return true;
  }

  async deleteCPRCertification(id) {
    this.markRecordDeleted(id);
    let all = JSON.parse(localStorage.getItem('aed_cpr') || '[]');
    const target = all.find(c => String(c.id || c.ID) === String(id));
    all = all.filter(c => String(c.id || c.ID) !== String(id));
    localStorage.setItem('aed_cpr', JSON.stringify(all));

    try {
      const res = await fetch(`${this.baseUrl}/cpr/${encodeURIComponent(id)}?skipAssocCheck=true`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        if (target) {
          all.push(target);
          localStorage.setItem('aed_cpr', JSON.stringify(all));
        }
        alert(json.error || 'This record could not be deleted.');
        return false;
      }
    } catch (e) {
      console.warn('Backend CPR delete sync notice:', e);
    }
    return true;
  }

  async deleteRescueEvent(id) {
    this.markRecordDeleted(id);
    let all = JSON.parse(localStorage.getItem('aed_rescue') || '[]');
    const target = all.find(r => String(r.id) === String(id));
    all = all.filter(r => String(r.id) !== String(id));
    localStorage.setItem('aed_rescue', JSON.stringify(all));

    try {
      const res = await fetch(`${this.baseUrl}/rescue-events/${encodeURIComponent(id)}?skipAssocCheck=true`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json.success === false) {
        if (target) {
          all.push(target);
          localStorage.setItem('aed_rescue', JSON.stringify(all));
        }
        alert(json.error || 'This record could not be deleted.');
        return false;
      }
    } catch (e) {}
    return true;
  }
  async purgeAllCreatorAndLocalRecords() {
    let cloudResult = null;
    try {
      const res = await fetch(`${this.baseUrl}/creator/purge-all-records`);
      if (res.ok) cloudResult = await res.json();
    } catch (e) {
      console.warn("Cloud purge notice:", e);
    }
    this.clearAllPortalRecords();
    return {
      success: true,
      message: "All portal local storage and Zoho Creator cloud records purged successfully!",
      cloudResult
    };
  }
}

const api = new ApiService();
window.api = api;
window.clearAllPortalRecords = async () => {
  console.log("Purging all local and Zoho Creator cloud records...");
  const res = await api.purgeAllCreatorAndLocalRecords();
  if (typeof initApp === 'function') initApp();
  alert("All portal & Zoho Creator records have been successfully purged.");
  return res;
};




