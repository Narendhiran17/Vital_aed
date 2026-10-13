/**
 * Deluge Mappers for AED Remind Creator Application & API
 * Translates between Creator Deluge schemas and clean portal JSON
 */

function formatCreatorDate(dStr) {
  if (!dStr) return '';
  const d = new Date(dStr);
  if (isNaN(d.getTime())) return dStr;
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const day = String(d.getDate()).padStart(2, '0');
  const mon = months[d.getMonth()];
  const yr = d.getFullYear();
  return `${day}-${mon}-${yr}`;
}

function mapBatteryModel(brand, model) {
  const text = `${brand || ''} ${model || ''}`.toLowerCase();
  if (text.includes('plus') || (text.includes('zoll') && !text.includes('3'))) return 'ZOLL AED Plus Batteries';
  if (text.includes('aed 3') || text.includes('aed3')) return 'ZOLL AED 3 Lithium Battery';
  if (text.includes('philips') || text.includes('onsite') || text.includes('frx')) return 'Philips HeartStart OnSite/FRx Battery';
  if (text.includes('view')) return 'Defibtech Lifeline VIEW Battery';
  if (text.includes('defibtech') || text.includes('lifeline')) return 'Defibtech Lifeline AED Battery';
  if (text.includes('g5') || text.includes('cardiac') || text.includes('powerheart')) return 'Powerheart G5 Battery';
  if (text.includes('cr2')) return 'Physio-Control LIFEPAK CR2 Lithium Battery';
  if (text.includes('1000') || text.includes('lifepak')) return 'Physio-Control LIFEPAK 1000 Lithium Battery';
  return model || 'ZOLL AED Plus Batteries';
}

function mapPadModel(brand, model) {
  const text = `${brand || ''} ${model || ''}`.toLowerCase();
  if (text.includes('g5') && text.includes('feedback')) return 'Cardiac Science Powerheart G5 Intellisense CPR Feedback Pads';
  if (text.includes('g5') || text.includes('cardiac') || text.includes('powerheart')) return 'Cardiac Science Powerheart G5 Adult Pads';
  if (text.includes('aed 3') || text.includes('aed3') || text.includes('uni')) return 'ZOLL AED 3 CPR-Uni Padz III';
  if (text.includes('zoll') || text.includes('cpr-d') || text.includes('plus')) return 'ZOLL AED Plus Adult CPR-D Padz';
  if (text.includes('frx')) return 'Philips HeartStart FRX Smart Pads II';
  if (text.includes('philips') || text.includes('onsite') || text.includes('smart')) return 'Philips OnSite Adult Smart Pads';
  if (text.includes('cr2') || text.includes('quik-step')) return 'Physio-Control LIFEPAK CR2 QUIK-STEP';
  if (text.includes('1000') || text.includes('redi-pak')) return 'Physio-Control LIFEPAK 1000 Adult REDI-PAK';
  if (text.includes('view')) return 'Defibtech Lifeline View Adult Pads';
  if (text.includes('defibtech') || text.includes('lifeline')) return 'Defibtech Lifeline Adult Pads';
  if (text.includes('heartsine') || text.includes('samaritan')) return 'HeartSine Samaritan Adult Pad';
  return model || 'ZOLL AED Plus Adult CPR-D Padz';
}

function mapAEDBrand(brand) {
  const b = (brand || '').toLowerCase();
  if (b.includes('cardiac') || b.includes('powerheart')) return 'Cardiac Science';
  if (b.includes('zoll')) return 'ZOLL';
  if (b.includes('philips')) return 'Philips';
  if (b.includes('stryker') || b.includes('physio') || b.includes('lifepak')) return 'Stryker / Physio-Control';
  if (b.includes('defibtech')) return 'Defibtech';
  if (b.includes('heartsine') || b.includes('samaritan')) return 'HeartSine';
  return brand || 'ZOLL';
}

function mapExpirationStatus(status) {
  if (!status) return 'OK';
  const s = String(status).trim().toLowerCase();
  if (s.includes('expir') && (s.includes('soon') || s.includes('day') || s.includes('warn'))) {
    return 'Expiring Soon';
  }
  if (s.includes('expir') || s.includes('replac')) return 'Expired';
  return 'OK';
}

function mapInventoryStatus(item) {
  if (!item) return 'Active';
  const statusStr = `${item.inventoryStatus || ''} ${item.status || ''} ${item.tab || ''} ${item.serviceStatus || ''}`.toLowerCase();
  if (statusStr.includes('spare') || item.tab === 'spare') return 'Spare';
  if (statusStr.includes('archiv') || item.tab === 'archived') return 'Archived';
  return 'Active';
}

function resolveOrganization(rec, orgsMap = {}) {
  let orgName = rec.Organization_Name || rec.Organization || rec.organization || '';
  let orgId = '';
  let orgKey = '';

  if (rec.Organizations_Lookup) {
    if (typeof rec.Organizations_Lookup === 'object') {
      orgId = String(rec.Organizations_Lookup.ID || '');
      orgName = rec.Organizations_Lookup.display_value || rec.Organizations_Lookup.Organization_Name || orgName;
    } else {
      orgId = String(rec.Organizations_Lookup);
    }
  } else if (rec.Organization && typeof rec.Organization === 'object') {
    orgId = String(rec.Organization.ID || '');
    orgName = rec.Organization.display_value || rec.Organization.Organization_Name || orgName;
  }

  if (orgId && orgsMap[orgId]) {
    orgName = orgsMap[orgId].name || orgName;
    orgKey = orgsMap[orgId].key || orgKey;
  }

  if (!orgKey && orgName) {
    orgKey = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  return { orgName, orgKey, orgId };
}

// Payload Builders
function buildBatteryPayload(item, aedId = null) {
  const payload = {
    Serial_Lot_Number: item.serialLot || item.lot || 'BAT-LOT-01',
    Brand: mapAEDBrand(item.brand),
    Battery_Model: mapBatteryModel(item.brand, item.model),
    SKU: item.sku || '',
    Purchase_Date: formatCreatorDate(item.purchaseDate || new Date()),
    Expiration_Date: formatCreatorDate(item.expirationDate || new Date(Date.now() + 4*365*24*3600*1000)),
    Expiration_Status: mapExpirationStatus(item.expirationStatus || item.status),
    Inventory_Status: mapInventoryStatus(item),
    Location: item.location === '-' ? '' : (item.location || ''),
    Organization: item.organization || item.orgName || ''
  };
  const targetAed = aedId || item.aedId;
  if (targetAed && /^\d+$/.test(String(targetAed).trim())) {
    payload.AED = String(targetAed).trim();
  }
  return payload;
}

function buildPadPayload(item, aedId = null) {
  const isPed = (item.padType || item.model || '').toLowerCase().includes('pediatric') ||
                (item.padType || item.model || '').toLowerCase().includes('child') ||
                (item.padType || item.model || '').toLowerCase().includes('infant');
  const payload = {
    Pad_Type: isPed ? 'Pediatric' : 'Adult',
    Brand: mapAEDBrand(item.brand),
    Pad_Model: mapPadModel(item.brand, item.model),
    SKU: item.sku || '',
    Lot_Number1: item.serialLot || item.lot || 'PAD-LOT-01',
    Installed_Date: formatCreatorDate(item.purchaseDate || item.installedDate || new Date()),
    Expiration_Date: formatCreatorDate(item.expirationDate || new Date(Date.now() + 2*365*24*3600*1000)),
    Expiration_Status: mapExpirationStatus(item.expirationStatus || item.status),
    Inventory_Status: mapInventoryStatus(item),
    Location: item.location === '-' ? '' : (item.location || ''),
    Organization: item.organization || item.orgName || ''
  };
  const targetAed = aedId || item.aedId;
  if (targetAed && /^\d+$/.test(String(targetAed).trim())) {
    payload.AED = String(targetAed).trim();
  }
  return payload;
}

function buildAEDPayload(item, orgId = null, locId = null) {
  const sn = item.serialLot || item.serialNumber || `SN-${Math.floor(100000 + Math.random() * 900000)}`;
  const serviceStat = item.serviceStatus || (item.tab === 'spare' ? 'Standby' : (item.tab === 'archived' ? 'Out of Service' : 'Rescue-Ready'));

  const payload = {
    Serial_Number: sn.startsWith('AED -') ? sn : `AED - ${sn}`,
    Brand: mapAEDBrand(item.brand),
    Model: item.model || 'AED Plus',
    SKU: item.sku || '',
    Purchase_Date: formatCreatorDate(item.purchaseDate || new Date()),
    Warranty_Expiration_Date: formatCreatorDate(item.warrantyExpirationDate || item.expirationDate || new Date(Date.now() + 5*365*24*3600*1000)),
    Service_Status: serviceStat,
    Inventory_Status: mapInventoryStatus(item),
    Warranty_Status: mapExpirationStatus(item.warrantyStatus || item.expirationStatus || 'OK'),
    Placement: item.placement || 'Reception Area'
  };
  if (orgId) payload.Organization = orgId;
  if (locId) payload.Location = locId;
  return payload;
}

function buildLocationPayload(loc) {
  return {
    Location_Name: loc.name || loc.Location_Name || 'Main Facility',
    Street: loc.street || loc.Street || '',
    Suite: loc.suite || loc.Suite || '',
    City: loc.city || loc.City || '',
    State: loc.state || loc.State || '',
    Zip: String(loc.zip || loc.Zip || ''),
    Contact_Name: loc.contact || loc.Contact_Name || '',
    Contact_Email: loc.email || loc.Contact_Email || '',
    Contact_Phone: loc.phone || loc.Contact_Phone || ''
  };
}

function buildOrganizationPayload(org) {
  return {
    Organization_Name: org.name || org.Organization_Name || 'New Organization',
    Organization_Key: org.key || org.Organization_Key || '',
    Phone1: org.phone || org.Phone1 || '',
    Street: org.street1 || org.Street || '',
    Suite: org.street2 || org.Suite || '',
    City: org.city || org.City || '',
    State: org.state || org.State || '',
    Zip: String(org.zip || org.Zip || ''),
    Website: org.website || org.Website || '',
    Organization_Type: org.type || org.Organization_Type || 'Direct Subscriber',
    Reseller_Name: org.resellerName || org.Reseller_Name || ''
  };
}

function buildUserPayload(user, orgId = null) {
  const payload = {
    First_Name: user.firstName || user.First_Name || '',
    Last_Name: user.lastName || user.Last_Name || '',
    Email: user.email || user.Email || '',
    Phone: user.phone || user.Phone || '',
    Role: user.role || user.Role || 'Staff',
    Status: user.status || user.Status || 'Active'
  };
  if (orgId) payload.Organization = orgId;
  return payload;
}

function buildInspectionPayload(item, aedId = null, locId = null, orgId = null) {
  const isFailed = (item.overallResult === 'Fail' || item.status === 'Failed' || item.inspectionStatus === 'Failed');
  const payload = {
    Inspection_Date: formatCreatorDate(item.inspectionDate || item.date || new Date()),
    Inspector_Name: item.inspector || item.inspectorName || '',
    Inspector_Email: item.inspectorEmail || '',
    Overall_Result: isFailed ? 'Fail' : 'Pass',
    Inspection_Status: isFailed ? 'Failed' : 'OK',
    Rescue_Ready: isFailed ? 'No' : 'Yes',
    Checklist_Answers1: typeof item.answers === 'object' ? JSON.stringify(item.answers) : (item.answers || ''),
    Notes: item.comments || item.notes || ''
  };
  if (aedId) payload.AED = aedId;
  if (locId) payload.Location = locId;
  if (orgId) payload.Organization = orgId;
  return payload;
}

function buildRescuePayload(item, aedId = null, locId = null, orgId = null) {
  const payload = {
    Event_Date: formatCreatorDate(item.eventDate || new Date()),
    Brand: item.brand || 'ZOLL',
    Model: item.model || 'AED Plus',
    SKU: item.sku || '',
    Notes: item.notes || item.summary || ''
  };
  if (aedId) payload.AED = aedId;
  if (locId) payload.Location = locId;
  if (orgId) payload.Organization = orgId;
  return payload;
}

function buildCPRPayload(item, locId = null, orgId = null) {
  const payload = {
    Participant_First_Name: item.firstName || item.Participant_First_Name || '',
    Participant_Last_Name: item.lastName || item.Participant_Last_Name || '',
    Participant_Email: item.email || item.Participant_Email || '',
    Participant_Phone: item.phone || item.Participant_Phone || '',
    Class_Date: formatCreatorDate(item.classDate || new Date()),
    Class_Type: item.classType || 'CPR/AED',
    Accreditation: item.accreditation || 'American Heart Association',
    Expiration_Date: formatCreatorDate(item.expirationDate || new Date(Date.now() + 730*24*3600*1000)),
    Expiration_Status: item.status || 'OK'
  };
  if (locId) payload.Location = locId;
  if (orgId) payload.Organization = orgId;
  return payload;
}

// Normalizers
function normalizeAED(rec, orgsMap = {}) {
  const { orgName, orgKey, orgId } = resolveOrganization(rec, orgsMap);
  const loc = rec.Location?.display_value || rec.Location || rec.Locations?.display_value || rec.Locations || '-';
  const tab = (rec.Inventory_Status || '').toLowerCase() === 'spare' || loc === '-' ? 'spare' :
              (rec.Inventory_Status || '').toLowerCase() === 'archived' ? 'archived' : 'active';
  return {
    id: String(rec.ID),
    type: 'AED',
    serialLot: rec.Serial_Number || rec.serialNumber || 'SN-UNKNOWN',
    brand: rec.Brand || 'ZOLL',
    model: rec.Model || rec.AED_Model || '',
    sku: rec.SKU || '',
    location: loc,
    placement: rec.Placement || rec.AED_Placement || '',
    purchaseDate: rec.Purchase_Date || '',
    warrantyExpirationDate: rec.Warranty_Expiration_Date || rec.Warranty_Expiration_date || '',
    serviceStatus: rec.Service_Status || 'Rescue-Ready',
    inventoryStatus: (rec.Inventory_Status || 'active').toLowerCase(),
    warrantyStatus: rec.Warranty_Status || 'OK',
    tab,
    organization: orgName,
    organizationKey: orgKey,
    organizationId: orgId
  };
}

function normalizeBattery(rec, orgsMap = {}) {
  const { orgName, orgKey, orgId } = resolveOrganization(rec, orgsMap);
  const loc = rec.Location?.display_value || rec.Location || '-';
  const aedRef = rec.AED?.ID || rec.Equipment__AED?.ID || rec.AED || rec.Equipment__AED || '';
  return {
    id: String(rec.ID),
    type: 'Battery',
    serialLot: rec.Serial_Lot_Number || rec.Lot_Number || rec.Serial_Number || 'BAT-UNKNOWN',
    brand: rec.Brand || 'ZOLL',
    model: rec.Battery_Model || rec.Battery_Name || 'Lithium Battery Pack',
    sku: rec.SKU || '',
    location: loc,
    purchaseDate: rec.Purchase_Date || rec.Purchasae_Date || '',
    expirationDate: rec.Expiration_Date || '',
    expirationStatus: rec.Expiration_Status || 'OK',
    inventoryStatus: (rec.Inventory_Status || 'active').toLowerCase(),
    tab: (rec.Inventory_Status || '').toLowerCase() === 'spare' || loc === '-' ? 'spare' : 'active',
    aedId: String(aedRef || ''),
    organization: orgName,
    organizationKey: orgKey,
    organizationId: orgId
  };
}

function normalizePad(rec, orgsMap = {}) {
  const { orgName, orgKey, orgId } = resolveOrganization(rec, orgsMap);
  const loc = rec.Location?.display_value || rec.Location || '-';
  const aedRef = rec.AED?.ID || rec.AED_Bilookup?.ID || rec.AED || rec.AED_Bilookup || '';
  const padType = rec.Pad_Type || ((rec.Pad_Model || '').toLowerCase().includes('pediatric') || (rec.Pad_Model || '').toLowerCase().includes('child') ? 'Pediatric Pads' : 'Adult Pads');
  return {
    id: String(rec.ID),
    type: padType.includes('Pediatric') ? 'Pediatric Pads' : 'Adult Pads',
    serialLot: rec.Lot_Number1 || rec.Lot_Number || 'PAD-UNKNOWN',
    brand: rec.Brand || rec.Pad_Brand || 'ZOLL',
    model: rec.Pad_Model || rec.Pad_Name || 'Defib Pads',
    sku: rec.SKU || '',
    location: loc,
    purchaseDate: rec.Installed_Date || '',
    expirationDate: rec.Expiration_Date || '',
    expirationStatus: rec.Expiration_Status || 'OK',
    inventoryStatus: (rec.Inventory_Status || 'active').toLowerCase(),
    tab: (rec.Inventory_Status || '').toLowerCase() === 'spare' || loc === '-' ? 'spare' : 'active',
    aedId: String(aedRef || ''),
    organization: orgName,
    organizationKey: orgKey,
    organizationId: orgId
  };
}

module.exports = {
  formatCreatorDate,
  mapBatteryModel,
  mapPadModel,
  mapAEDBrand,
  mapExpirationStatus,
  mapInventoryStatus,
  resolveOrganization,
  buildBatteryPayload,
  buildPadPayload,
  buildAEDPayload,
  buildLocationPayload,
  buildOrganizationPayload,
  buildUserPayload,
  buildInspectionPayload,
  buildRescuePayload,
  buildCPRPayload,
  normalizeAED,
  normalizeBattery,
  normalizePad
};
