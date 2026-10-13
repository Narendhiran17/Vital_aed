/**
 * AED Remind - Catalyst Advanced I/O Serverless Function
 * Express API Gateway connecting frontend to Zoho Creator & Catalyst BaaS
 */

try { require('dotenv').config(); } catch (e) {}
const express = require('express');
const cors = require('cors');
const catalyst = require('zcatalyst-sdk-node');
const creator = require('./creatorService');
const mappers = require('./delugeMappers');

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: true, credentials: true }));

// Attach Catalyst app instance
app.use((req, res, next) => {
  try {
    req.catalystApp = catalyst.initialize(req);
  } catch (e) {
    req.catalystApp = null;
  }
  next();
});

// In-Memory Fallback Cache for fast local responses
const memoryCache = {
  systemLogs: [],
  users: [
    {
      id: 'USR-SYSADMIN-01',
      firstName: 'Narendhiran',
      lastName: 'SysAdmin',
      email: 'narendhiran3317@gmail.com',
      phone: '(555) 100-2000',
      role: 'Sys Admin',
      organization: 'Vital AED',
      organizationKey: 'vital-aed',
      status: 'Active'
    },
    {
      id: 'USR-RESELLER-01',
      firstName: 'Hardik',
      lastName: 'Jahan Naren',
      email: 'hardikjahannaren@gmail.com',
      phone: '(555) 456-7890',
      role: 'Reseller*',
      organization: 'Vital AED',
      organizationKey: 'vital-aed',
      status: 'Active'
    }
  ]
};

// ==========================================
// AUTHENTICATION ROUTES
// ==========================================

app.get('/api/auth/current-user', async (req, res) => {
  try {
    if (req.catalystApp) {
      try {
        const userObj = await req.catalystApp.userManagement().getCurrentUser();
        if (userObj && userObj.email_id) {
          const email = userObj.email_id.toLowerCase();
          const role = email.includes('admin') || email.includes('naren') ? 'Sys Admin' :
                       email.includes('hardik') ? 'Reseller*' :
                       email.includes('inspector') ? 'Inspector' : 'Staff';
          return res.json({
            success: true,
            authenticated: true,
            user: {
              id: userObj.user_id,
              email: userObj.email_id,
              firstName: userObj.first_name || 'Portal',
              lastName: userObj.last_name || 'User',
              role,
              organization: 'Vital AED',
              organizationKey: role === 'Sys Admin' ? 'all' : 'vital-aed'
            }
          });
        }
      } catch (err) {
        // Unauthenticated session cookie
      }
    }
    return res.json({ success: true, authenticated: false, user: null });
  } catch (e) {
    return res.json({ success: true, authenticated: false, user: null });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  const em = (email || '').toLowerCase().trim();
  let role = 'Staff';
  let org = 'Vital AED';
  let orgKey = 'vital-aed';

  if (em === 'narendhiran3317@gmail.com' || em.includes('sysadmin') || em === 'christine@vitalaed.com') {
    role = 'Sys Admin';
    org = 'Global Access';
    orgKey = 'all';
  } else if (em === 'hardikjahannaren@gmail.com' || em.includes('reseller')) {
    role = 'Reseller*';
    org = 'Vital AED';
    orgKey = 'vital-aed';
  } else if (em.includes('inspector')) {
    role = 'Inspector';
  } else if (em.includes('miami')) {
    role = 'Admin';
    org = 'City of Miami Gardens - Parks & Rec';
    orgKey = 'miami-parks';
  }

  const user = {
    id: `USR-${Date.now()}`,
    email: em,
    firstName: em.split('@')[0],
    lastName: '',
    role,
    organization: org,
    organizationKey: orgKey
  };

  return res.json({ success: true, authenticated: true, user });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('catalyst_ticket');
  res.clearCookie('zcid');
  return res.json({ success: true, message: 'Logged out successfully' });
});

// ==========================================
// ORGANIZATIONS ROUTES
// ==========================================

app.get('/api/organizations', async (req, res) => {
  try {
    const reportData = await creator.getRecords('Organizations', {}, req);
    if (reportData && Array.isArray(reportData.data) && reportData.data.length > 0) {
      const orgs = reportData.data.map(r => ({
        id: String(r.ID),
        name: r.Organization_Name || 'Organization',
        key: r.Organization_Key || (r.Organization_Name ? r.Organization_Name.toLowerCase().replace(/[^a-z0-9]+/g, '-') : 'org'),
        phone: r.Phone1 || r.Phone || '',
        street1: r.Street || '',
        street2: r.Suite || '',
        city: r.City || '',
        state: r.State || '',
        zip: r.Zip || '',
        website: r.Website || '',
        type: r.Organization_Type || 'Direct Subscriber',
        resellerName: r.Reseller_Name || null
      }));
      return res.json({ source: 'creator', success: true, data: orgs });
    }
  } catch (e) {
    console.warn("Organizations fetch error:", e.message);
  }
  return res.json({ source: 'local', success: true, data: [] });
});

app.post('/api/organizations', async (req, res) => {
  try {
    const payload = mappers.buildOrganizationPayload(req.body);
    const result = await creator.addRecord('Organizations', payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/organizations/:id', async (req, res) => {
  try {
    const payload = mappers.buildOrganizationPayload(req.body);
    const result = await creator.updateRecord('Organizations', req.params.id, payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/organizations/:id', async (req, res) => {
  try {
    const result = await creator.deleteRecord('Organizations', req.params.id, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.json({ success: true, warning: e.message });
  }
});

// ==========================================
// LOCATIONS ROUTES
// ==========================================

app.get('/api/locations', async (req, res) => {
  try {
    const [locRes, orgRes] = await Promise.all([
      creator.getRecords('Locations', {}, req),
      creator.getRecords('Organizations', {}, req)
    ]);
    const orgsMap = {};
    if (orgRes && Array.isArray(orgRes.data)) {
      orgRes.data.forEach(o => { orgsMap[String(o.ID)] = { name: o.Organization_Name, key: o.Organization_Key }; });
    }
    if (locRes && Array.isArray(locRes.data) && locRes.data.length > 0) {
      const locs = locRes.data.map(l => {
        const { orgName, orgKey, orgId } = mappers.resolveOrganization(l, orgsMap);
        return {
          id: String(l.ID),
          name: l.Location_Name || 'Main Facility',
          street: l.Street || '',
          suite: l.Suite || '',
          city: l.City || '',
          state: l.State || '',
          zip: l.Zip || '',
          contact: l.Contact_Name || '',
          email: l.Contact_Email || '',
          phone: l.Contact_Phone || '',
          organization: orgName,
          organizationKey: orgKey,
          organizationId: orgId
        };
      });
      return res.json({ source: 'creator', success: true, data: locs });
    }
  } catch (e) {
    console.warn("Locations fetch error:", e.message);
  }
  return res.json({ source: 'local', success: true, data: [] });
});

app.post('/api/locations', async (req, res) => {
  try {
    const payload = mappers.buildLocationPayload(req.body);
    const result = await creator.addRecord('Locations', payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/locations/:id', async (req, res) => {
  try {
    const payload = mappers.buildLocationPayload(req.body);
    const result = await creator.updateRecord('Locations', req.params.id, payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/locations/:id', async (req, res) => {
  try {
    const result = await creator.deleteRecord('Locations', req.params.id, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.json({ success: true, warning: e.message });
  }
});

// ==========================================
// EQUIPMENT (AEDS, BATTERIES, PADS) ROUTES
// ==========================================

app.get('/api/equipment', async (req, res) => {
  try {
    const [aedRes, batRes, padRes, orgRes] = await Promise.all([
      creator.getRecords('AEDs', {}, req),
      creator.getRecords('Batteries', {}, req),
      creator.getRecords('Pads', {}, req),
      creator.getRecords('Organizations', {}, req)
    ]);

    const orgsMap = {};
    if (orgRes && Array.isArray(orgRes.data)) {
      orgRes.data.forEach(o => { orgsMap[String(o.ID)] = { name: o.Organization_Name, key: o.Organization_Key }; });
    }

    const aeds = (aedRes?.data || []).map(r => mappers.normalizeAED(r, orgsMap));
    const bats = (batRes?.data || []).map(r => mappers.normalizeBattery(r, orgsMap));
    const pads = (padRes?.data || []).map(r => mappers.normalizePad(r, orgsMap));

    const combined = [...aeds, ...bats, ...pads];
    if (combined.length > 0) {
      return res.json({ source: 'creator', success: true, data: combined });
    }
  } catch (e) {
    console.warn("Equipment fetch error:", e.message);
  }
  return res.json({ source: 'local', success: true, data: [] });
});

app.post('/api/equipment', async (req, res) => {
  try {
    const item = req.body;
    let result = null;
    if (item.type === 'Battery') {
      const payload = mappers.buildBatteryPayload(item);
      result = await creator.addRecord('Batteries', payload, req);
    } else if (item.type === 'Adult Pads' || item.type === 'Pediatric Pads' || item.type === 'Pads') {
      const payload = mappers.buildPadPayload(item);
      result = await creator.addRecord('Pads', payload, req);
    } else {
      const payload = mappers.buildAEDPayload(item);
      result = await creator.addRecord('AEDs', payload, req);
    }
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.put('/api/equipment/:id', async (req, res) => {
  try {
    const item = req.body;
    let result = null;
    if (item.type === 'Battery') {
      const payload = mappers.buildBatteryPayload(item);
      result = await creator.updateRecord('Batteries', req.params.id, payload, req);
    } else if (item.type === 'Adult Pads' || item.type === 'Pediatric Pads' || item.type === 'Pads') {
      const payload = mappers.buildPadPayload(item);
      result = await creator.updateRecord('Pads', req.params.id, payload, req);
    } else {
      const payload = mappers.buildAEDPayload(item);
      result = await creator.updateRecord('AEDs', req.params.id, payload, req);
    }
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.delete('/api/equipment/:id', async (req, res) => {
  try {
    await creator.deleteRecord('AEDs', req.params.id, req);
    await creator.deleteRecord('Batteries', req.params.id, req);
    await creator.deleteRecord('Pads', req.params.id, req);
    return res.json({ success: true, deletedId: req.params.id });
  } catch (e) {
    return res.json({ success: true, warning: e.message });
  }
});

// ==========================================
// INSPECTIONS ROUTES
// ==========================================

app.get('/api/inspections', async (req, res) => {
  try {
    const [inspRes, orgRes] = await Promise.all([
      creator.getRecords('Inspections', {}, req),
      creator.getRecords('Organizations', {}, req)
    ]);
    const orgsMap = {};
    if (orgRes && Array.isArray(orgRes.data)) {
      orgRes.data.forEach(o => { orgsMap[String(o.ID)] = { name: o.Organization_Name, key: o.Organization_Key }; });
    }
    if (inspRes && Array.isArray(inspRes.data) && inspRes.data.length > 0) {
      const list = inspRes.data.map(i => {
        const { orgName, orgKey, orgId } = mappers.resolveOrganization(i, orgsMap);
        return {
          id: String(i.ID),
          inspectionId: `INS-${i.ID}`,
          inspectionDate: i.Inspection_Date || '',
          inspector: i.Inspector_Name || '',
          overallResult: i.Overall_Result || 'Pass',
          status: i.Inspection_Status || 'OK',
          overallStatus: i.Inspection_Status || 'OK',
          rescueReady: i.Rescue_Ready || 'Yes',
          tab: 'active',
          organization: orgName,
          organizationKey: orgKey,
          organizationId: orgId
        };
      });
      return res.json({ source: 'creator', success: true, data: list });
    }
  } catch (e) {
    console.warn("Inspections fetch error:", e.message);
  }
  return res.json({ source: 'local', success: true, data: [] });
});

app.post('/api/inspections', async (req, res) => {
  try {
    const payload = mappers.buildInspectionPayload(req.body);
    const result = await creator.addRecord('Inspections', payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// RESCUE EVENTS & CPR ROUTES
// ==========================================

app.get('/api/rescue-events', async (req, res) => {
  try {
    const rescueRes = await creator.getRecords('Rescue_Events', {}, req);
    if (rescueRes && Array.isArray(rescueRes.data)) {
      return res.json({ source: 'creator', success: true, data: rescueRes.data });
    }
  } catch (e) {}
  return res.json({ source: 'local', success: true, data: [] });
});

app.post('/api/rescue-events', async (req, res) => {
  try {
    const payload = mappers.buildRescuePayload(req.body);
    const result = await creator.addRecord('Rescue_Events', payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

app.get('/api/cpr', async (req, res) => {
  try {
    const cprRes = await creator.getRecords('CPR_Certifications', {}, req);
    if (cprRes && Array.isArray(cprRes.data)) {
      return res.json({ source: 'creator', success: true, data: cprRes.data });
    }
  } catch (e) {}
  return res.json({ source: 'local', success: true, data: [] });
});

app.post('/api/cpr', async (req, res) => {
  try {
    const payload = mappers.buildCPRPayload(req.body);
    const result = await creator.addRecord('CPR_Certifications', payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// ==========================================
// USERS & WEBHOOKS
// ==========================================

app.get('/api/users', async (req, res) => {
  try {
    const usersRes = await creator.getRecords('Users', {}, req);
    if (usersRes && Array.isArray(usersRes.data) && usersRes.data.length > 0) {
      const users = usersRes.data.map(u => ({
        id: String(u.ID),
        creatorRecordId: String(u.ID),
        firstName: u.First_Name || '',
        lastName: u.Last_Name || '',
        email: u.Email || '',
        phone: u.Phone || '',
        role: u.Role || 'Staff',
        status: u.Status || 'Active',
        organization: u.Organization?.display_value || u.Organization || 'Vital AED'
      }));
      return res.json({ source: 'creator', success: true, data: users });
    }
  } catch (e) {}
  return res.json({ source: 'local', success: true, data: memoryCache.users });
});

app.post('/api/users', async (req, res) => {
  try {
    const payload = mappers.buildUserPayload(req.body);
    const result = await creator.addRecord('Users', payload, req);
    return res.json({ success: true, result });
  } catch (e) {
    return res.status(500).json({ success: false, error: e.message });
  }
});

// System logs
app.get('/api/system-logs', (req, res) => {
  res.json({ success: true, data: memoryCache.systemLogs });
});

app.post('/api/system-logs', (req, res) => {
  const entry = { id: `LOG-${Date.now()}`, timestamp: new Date().toISOString(), ...req.body };
  memoryCache.systemLogs.unshift(entry);
  res.json({ success: true, data: entry });
});

module.exports = app;
