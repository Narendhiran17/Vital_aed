/**
 * Zoho Creator REST API v2 Connector
 * Handles authentication, token refresh, and CRUD operations against Zoho Creator
 */

const axios = require('axios');

class CreatorService {
  constructor() {
    this.ownerName = process.env.CREATOR_OWNER_NAME || 'christine_vitalaed';
    this.appLinkName = process.env.CREATOR_APP_LINK_NAME || 'aed-remind-db';
    this.fallbackAppName = 'aed-remind';
    this.baseUrl = process.env.CREATOR_BASE_URL || 'https://creator.zoho.com/api/v2';
    this.accessToken = process.env.CREATOR_ACCESS_TOKEN || null;
    this.tokenExpiry = 0;
  }

  async getAuthHeaders(req) {
    // 1. Check if token was provided in request header
    if (req && req.headers && req.headers.authorization) {
      return { Authorization: req.headers.authorization };
    }
    // 2. Check environment variable token
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return { Authorization: `Zoho-oauthtoken ${this.accessToken}` };
    }
    // 3. Check catalyst app connection if available
    try {
      if (req && req.catalystApp) {
        const conn = req.catalystApp.connection({ connection_name: 'zoho_creator' });
        if (conn && typeof conn.getAccessToken === 'function') {
          const token = await conn.getAccessToken();
          if (token) return { Authorization: `Zoho-oauthtoken ${token}` };
        }
      }
    } catch (e) {}

    return this.accessToken ? { Authorization: `Zoho-oauthtoken ${this.accessToken}` } : {};
  }

  async getRecords(reportName, params = {}, req = null) {
    const headers = await this.getAuthHeaders(req);
    const url = `${this.baseUrl}/${this.ownerName}/${this.appLinkName}/report/${reportName}`;
    try {
      const res = await axios.get(url, { headers, params, timeout: 8000 });
      if (res.data && (res.data.code === 3000 || Array.isArray(res.data.data))) {
        return res.data;
      }
      return res.data;
    } catch (err) {
      // Try fallback app name if 404
      if (err.response && err.response.status === 404 && this.appLinkName !== this.fallbackAppName) {
        const fallbackUrl = `${this.baseUrl}/${this.ownerName}/${this.fallbackAppName}/report/${reportName}`;
        try {
          const fbRes = await axios.get(fallbackUrl, { headers, params, timeout: 8000 });
          return fbRes.data;
        } catch (e) {}
      }
      console.warn(`CreatorService.getRecords warning for report ${reportName}:`, err.message);
      return { code: err.response?.status || 500, data: [], message: err.message };
    }
  }

  async addRecord(formName, data, req = null) {
    const headers = await this.getAuthHeaders(req);
    const url = `${this.baseUrl}/${this.ownerName}/${this.appLinkName}/form/${formName}`;
    try {
      const res = await axios.post(url, { data }, { headers, timeout: 8000 });
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 404 && this.appLinkName !== this.fallbackAppName) {
        const fallbackUrl = `${this.baseUrl}/${this.ownerName}/${this.fallbackAppName}/form/${formName}`;
        try {
          const fbRes = await axios.post(fallbackUrl, { data }, { headers, timeout: 8000 });
          return fbRes.data;
        } catch (e) {}
      }
      console.warn(`CreatorService.addRecord error for form ${formName}:`, err.response?.data || err.message);
      return { code: err.response?.status || 500, error: err.response?.data || err.message };
    }
  }

  async updateRecord(formName, recordId, data, req = null) {
    const headers = await this.getAuthHeaders(req);
    const url = `${this.baseUrl}/${this.ownerName}/${this.appLinkName}/form/${formName}/${recordId}`;
    try {
      const res = await axios.patch(url, { data }, { headers, timeout: 8000 });
      return res.data;
    } catch (err) {
      if (err.response && err.response.status === 404 && this.appLinkName !== this.fallbackAppName) {
        const fallbackUrl = `${this.baseUrl}/${this.ownerName}/${this.fallbackAppName}/form/${formName}/${recordId}`;
        try {
          const fbRes = await axios.patch(fallbackUrl, { data }, { headers, timeout: 8000 });
          return fbRes.data;
        } catch (e) {}
      }
      console.warn(`CreatorService.updateRecord error for form ${formName}/${recordId}:`, err.response?.data || err.message);
      return { code: err.response?.status || 500, error: err.response?.data || err.message };
    }
  }

  async deleteRecord(reportName, recordId, req = null) {
    const headers = await this.getAuthHeaders(req);
    const url = `${this.baseUrl}/${this.ownerName}/${this.appLinkName}/report/${reportName}/${recordId}`;
    try {
      const res = await axios.delete(url, { headers, timeout: 8000 });
      return res.data;
    } catch (err) {
      console.warn(`CreatorService.deleteRecord error for report ${reportName}/${recordId}:`, err.response?.data || err.message);
      return { code: err.response?.status || 500, error: err.response?.data || err.message };
    }
  }
}

module.exports = new CreatorService();
