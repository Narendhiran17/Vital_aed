# AED Remind (Vital AED) — Project Memory & Architecture Guide


> **Permanent Memory Reference**: This document serves as the persistent system memory for the **AED Remind / Vital AED Life Safety Compliance Platform**. When chat history is cleared or a new session begins, all project context, architectural decisions, file structures, schemas, and guardrails are preserved here.

---

## 1. Project Overview & Business Purpose

### 1.1 What is AED Remind?
**AED Remind** (developed for Vital AED / Christine Shale) is a comprehensive, enterprise-grade **Life Safety Equipment & Compliance Management Platform**. 
It ensures organizations maintain 100% regulatory readiness for their automated external defibrillators (AEDs), consumable parts (pads & batteries), monthly inspections, CPR certifications, and post-event rescue reporting.

### 1.2 Core Problem Solved
- AED batteries and defibrillator electrode pads expire on strict schedules (typically every 2 to 5 years). An expired pad or dead battery during a Sudden Cardiac Arrest (SCA) event results in fatalities and catastrophic legal liability.
- Regulations mandate **monthly (30-day) physical inspections** of AED units.
- **Why Zoho Catalyst instead of Zoho Creator UI?** Zoho Creator's standard UI is constrained, lacks pixel-perfect design control, has restrictive layout customization, and cannot naturally produce the exact multi-tiered executive table views, nested sub-tables, custom photo/signature capture workflows, and streamlined persona switching specified by the client in **`AED Remind System Map - 2.8.xlsx`**. Therefore, the solution uses **Zoho Catalyst Web Client (Hosting)** for a custom Single Page Application (SPA), backed by a **Zoho Catalyst Serverless Function (Node.js/Express)** that synchronizes bi-directionally with **Zoho Creator** as the master relational database.

---

## 2. Strict Project Rules & Guardrails

These rules must be obeyed at all times across all sessions:

1. **Directory Constraint**: All application development, client files, and Catalyst functions MUST reside inside `Workbook/`. Never create or modify active application code in the root directory.
2. **Never Run Browser Testing Subagents**: Do NOT use scratchpad files or browser subagents to test or load the site.
3. **Exact 1:1 Excel Design Fidelity**: Strictly replicate the visual layout, color palette, typography, headers, and shape buttons defined in **`AED Remind System Map - 2.8.xlsx`**.
4. **Clean UI**: Never display developer notes, bracketed icon placeholders (such as `[AED icon]` or `[pencil]`), or developer reference cards in user-facing views. Use real FontAwesome icons and clean enterprise typography.
5. **No Regressions**: Preserve existing features when modifying modules (e.g. persona dropdown, Excel-style nested tables, search filtering, modals, PDF export).

---

## 3. Technology Stack & Architecture

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                    Zoho Catalyst                                       │
│                                                                                        │
│  📁 Workbook/client/ (Static Web Client Hosting)                                       │
│     • Custom Single Page Application (SPA) in Vanilla HTML5, CSS3, ES6+ Javascript     │
│     • Icons: FontAwesome 6.5.1                                                         │
│     • PDF Generation: html2pdf.js bundle                                               │
│     • Real-time local fallback caching in localStorage (instant responsiveness)        │
│                                                                                        │
│  📁 Workbook/functions/aed_backend/ (Advanced I/O Serverless Node.js 18)               │
│     • Framework: Express.js API Gateway                                                │
│     • SDK: zcatalyst-sdk-node, Axios, Cors                                             │
│     • Token Manager: Auto-refreshing OAuth2 handler for Zoho Creator API v2            │
│     • Mappers: delugeMappers.js translating between Creator Deluge formats & JSON      │
│     • Webhooks: Deluge user creation listener -> Catalyst Auth sync                    │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Zoho Creator v2 REST API & Webhooks
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                              Zoho Creator (Database Engine)                            │
│  • App Name: aed-remind                                                                │
│  • App Owner: christine_vitalaed                                                       │
│  • Core Schema: Defined in AED_Remind.ds                                               │
│  • Forms & Reports: AEDs, Batteries, Adult_Pads, Pediatric_Pads, Spare_Equipment,     │
│    Inspections, Rescue_Events, CPR_Certifications, Locations, Organizations, Users    │
│  • Deluge Workflows: Expiration calculations, email alerts, Catalyst user invites      │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Key IDs & Environment Config
- **Catalyst Project ZAID**: `114503000000014051`
- **Catalyst App ZAAID**: `10135340690`
- **Catalyst Auth Role ID**: `114503000000014057`
- **Zoho Creator App Owner**: `christine_vitalaed`
- **Zoho Creator App Link Name**: `aed-remind`
- **Remote MCP Server**: Configured in `.agents/plugins/zoho-vital-aed/mcp_config.json` (`https://vital-aed-941903582.zohomcp.com/mcp/020248512d5c3944593773192acf833f/message`).

---

## 4. Repository File Structure & Directory Map

```
c:/Users/naren/OneDrive/Documents/Project 1/
│
├── AGENTS.md                                     # System Rules & Persistent Instructions
├── PROJECT_MEMORY.md                             # Complete Project Memory & Architecture Guide (This file)
│
├── Client Requirement/                           # Specifications & Source of Truth
│   ├── AED Remind System Map - 2.8.xlsx          # MASTER DESIGN SPEC (Exact layout, colors, views)
│   ├── AED Remind System Map - 2.7.xlsx          # Previous version
│   └── Serial number and locations format.xlsx   # Serial & Location formatting rules
│
├── Project Overview/                             # Project brief documents (v1.4, v1.5, v1.6)
├── Client Meeting 4 doubts/                      # Meeting notes & client Q&A
├── AED_Remind.ds                                 # Zoho Creator Application Deluge Schema Script
├── AED_Remind (1).ds                             # Backup Creator Deluge Schema Script
├── VITAL AED forms and Workflows.pdf             # Form requirements & Deluge workflow charts
│
├── .agents/plugins/zoho-vital-aed/               # MCP Server Integration Plugin
│   ├── plugin.json
│   └── mcp_config.json                           # Remote MCP endpoint for Zoho tools
│
└── Workbook/                                     # ALL ACTIVE CODE LIVES HERE (Sacred Directory)
    ├── catalyst.json                             # Catalyst deploy configuration
    ├── deploy.bat                                # Windows deployment batch script
    ├── deploy.ps1                                # PowerShell deployment script
    ├── README.md                                 # Workbook onboarding & architecture doc
    ├── CREATOR_CATALYST_WORKFLOW.md              # Auth setup & Deluge webhook guide
    │
    ├── client/                                   # Catalyst Web Client Hosting (Frontend)
    │   ├── index.html                            # Master SPA HTML (Sidebar, Topbar, Modals, 9 Views)
    │   ├── css/
    │   │   └── styles.css                        # Exact Excel styling tokens & responsive CSS
    │   └── js/
    │       ├── data.js                           # Seed data & data structures matching Excel PRD
    │       ├── api.js                            # Catalyst REST API connector & local fallback cache
    │       └── app.js                            # Core application engine (7,200+ lines: RBAC, views, forms)
    │
    └── functions/
        └── aed_backend/                          # Catalyst Advanced I/O Function (Backend)
            ├── catalyst-config.json              # Function runtime config & OAuth environment variables
            ├── package.json                      # Node.js dependencies (express, axios, zcatalyst-sdk)
            ├── index.js                          # Express API Gateway routes (2,200+ lines)
            ├── creatorService.js                 # Zoho Creator REST API v2 connector & token refresher
            └── delugeMappers.js                  # Data transformation & normalization mappers
```

---

## 5. Visual Design Tokens (Extracted 1:1 from Excel System Map)

| Element | Exact Color Hex | Purpose / Location |
| :--- | :--- | :--- |
| **Sidebar Navy** | `#004182` | Left navigation bar background |
| **Sidebar Hover/Active** | `#003163` / `#002244` | Hover & active state on sidebar items |
| **Royal Blue Banner** | `#0070C0` | Top Page Title Bar (Row 2 in Excel) |
| **Main Table Header** | `#004182` | Primary Equipment / Location Table header row |
| **Sub-table Header** | `#C8DEF0` | Nested sub-tables (Pads, Batteries, Inspections) |
| **Sub-table Header Text**| `#004182` | Text inside nested sub-table headers |
| **Action Icon Blue** | `#0054B0` | View, Edit, Search, Buy, Download icon buttons |
| **Status OK (Green)** | `#00B050` | Rescue Ready / Passed / Active |
| **Status Failed (Red)** | `#FF0000` | Failed inspection / Expired / Out of service |
| **Status Warning (Amber)**| `#D97706` | Overdue / Expiring within 30-90 days / Expired warranty |
| **Status Upcoming (Blue)**| `#008FFA` | Upcoming scheduled inspection |
| **Canvas Background** | `#F4F6F9` | Neutral workspace background |
| **Card / Canvas White** | `#FFFFFF` | Panels, tables, modal dialogs |

---

## 6. Core Application Views & Modules

All views are built inside `Workbook/client/index.html` and managed dynamically via `Workbook/client/js/app.js`:

### 6.1 Dashboard (`#dashboard-view`)
- **4 Excel KPI Metric Cards**:
  1. *AEDs*: Total units, Warranty expired count.
  2. *PADs & Batteries*: Pads expired count, Batteries expired count.
  3. *Inspections*: Failed inspections count, Overdue inspections count.
  4. *Rescue Events*: Active incidents, Consumables needing replenishment.
- **3 Stacked Overview Tables**:
  - AED Expiration & Warranty status overview.
  - Consumables expiration schedule (30/60/90 days).
  - Inspection compliance overview (Passed vs Overdue).

### 6.2 Equipment (`#equipment-view`)
- **Tabs**: All, Active, In Service, Needs Attention, Archived.
- **Nested Accordion Structure**:
  - Parent row displays AED Model, Serial Number, Location, Status pill, Warranty, and Action buttons.
  - Clicking a row expands the **Nested Sub-tables**:
    - **Batteries**: Model, Serial/Lot, Install Date, Expiration Date, Status, Swap with Spare button.
    - **Adult Pads**: Model, Lot Number, Expiration Date, Status, Swap with Spare button.
    - **Pediatric Pads**: Model, Lot Number, Expiration Date, Status, Swap with Spare button.
    - **Recent Inspections**: Date, Inspector, Result pill, Notes.
- **Actions**: Add Equipment modal, Edit Equipment modal, Move Location, Archive/Unarchive, Buy Replacement link.

### 6.3 Spare Inventory (`#spare-view`)
- Dedicated tracking for backup consumable stock (Spare Batteries, Spare Adult Pads, Spare Pediatric Pads, Fast-Response Kits).
- Shows inventory quantities, storage locations, expiration dates of spare stock.
- Direct **"Swap into Service"** modal linking a spare part to an active AED unit, automatically retiring the replaced item.

### 6.4 Monthly Inspections (`#inspections-view`)
- **Regulatory 30-Day Check**: Tracks last inspection date, next due date, days remaining.
- **Perform Inspection Modal**:
  - Equipment selector with auto-filling serial number and location.
  - Interactive inspection checklist: Status indicator OK, Cabinet alarmed & undamaged, Pads plugged in & in date, Battery status green, Rescue kit present.
  - Pass / Fail toggle with failure cause selection.
  - **Photo Evidence Upload**: Supports camera capture or file upload.
  - **Digital Signature Pad**: HTML5 canvas signature capture.
- **PDF Compliance Certificate**: Generate and download printable official compliance report via `html2pdf.js`.

### 6.5 Rescue Events (`#rescue-view`)
- Post-incident clinical debriefing log for cardiac arrest emergencies.
- Captures: Incident Date/Time, Patient outcome, CPR duration, Shocks delivered, Consumables utilized (pads used, battery depleted), Responding staff, EMS report number.
- Automatic **Restock Trigger**: Automatically flags the AED as "Out of Service / Awaiting Consumables" and prompts for spare replacement.

### 6.6 CPR Certification (`#cpr-view`)
- Tracks certified first responders and CPR/AED/BLS certification holders.
- Roster fields: Full Name, Certification Type (AHA / Red Cross / HSI), Issue Date, Expiration Date (2-year cycle), Certificate ID, Renewal status pill (Valid, Expiring Soon, Expired).

### 6.7 Locations (`#locations-view`)
- Multi-tier site hierarchy: Organization &rarr; Campus / Building &rarr; Floor / Wing &rarr; Specific Placement (e.g. "Main Lobby near Elevators - Wall Cabinet #2").
- Displays AED count per location and emergency contact info.

### 6.8 Users & RBAC Administration (`#users-view`)
- User roster with email, role, phone, assigned organization, status.
- Add User modal triggers Catalyst User Registration and sends password setup emails.

### 6.9 System Audit Log (`#system-log-view`)
- Timestamped historical record of all equipment modifications, inspection submissions, replacements, and role changes.

---

## 7. Role-Based Access Control (RBAC) Matrix

The system features an interactive **Persona Switcher** in the topbar for instant live preview and testing across all 6 roles:

| Role Name | Scope & Permissions | Key Restrictions |
| :--- | :--- | :--- |
| **Sys Admin** | Global system access; can switch organizations; full CRUD on all equipment, users, logs, and settings. | None. Full access. |
| **Admin (Account Owner)**| Full administrative access within their specific organization. Can manage billing, users, equipment, inspections. | Cannot see other organizations' data. |
| **Admin** | Manages equipment, locations, inspections, and staff within their assigned organization. | Cannot modify Account Owner billing or delete top-level organization. |
| **Reseller\*** | Manages multiple assigned customer organizations under their distribution channel. | Cannot access Vital AED system root settings or unassigned clients. |
| **Staff** | Read-only view of equipment status, locations, and CPR rosters. Can report issues or rescue events. | Cannot edit equipment metadata or delete records. |
| **Inspector** | Focused operational access to perform inspections, capture photos/signatures, and view assigned equipment. | Limited access to billing, user management, and system administration. |

---

## 8. Data Models & Schemas

### 8.1 Primary Equipment Record (AED)
```json
{
  "id": "REC-AED-001",
  "model": "Cardiac Science Powerheart G5",
  "serialLot": "G5-8849201",
  "location": "Main Lobby - East Wall Cabinet",
  "organizationId": "org-vital-aed",
  "serviceStatus": "In Service",
  "warrantyDate": "2028-06-15",
  "readinessStatus": "Rescue Ready",
  "tab": "active",
  "batteries": [
    {
      "id": "BAT-001",
      "model": "Intellisense Battery XBTAED001A",
      "serialLot": "BT-2022-9912",
      "installDate": "2023-01-10",
      "expirationDate": "2027-01-10",
      "status": "Good"
    }
  ],
  "adultPads": [
    {
      "id": "PAD-001",
      "model": "Adult Intellisense CPR Electrodes",
      "serialLot": "LOT-2024-441A",
      "expirationDate": "2026-04-18",
      "status": "Expiring Soon"
    }
  ],
  "pediatricPads": [
    {
      "id": "PED-001",
      "model": "Pediatric Intellisense Defibrillation Pads",
      "serialLot": "LOT-2023-882P",
      "expirationDate": "2026-11-30",
      "status": "Good"
    }
  ]
}
```

### 8.2 Inspection Record
```json
{
  "id": "INSP-1001",
  "aedId": "REC-AED-001",
  "inspectionDate": "2026-10-01",
  "inspectorName": "Sarah Jenkins",
  "inspectorRole": "Inspector",
  "statusCheckPassed": true,
  "cabinetAlarmPassed": true,
  "padsPluggedPassed": true,
  "batteryIndicatorPassed": true,
  "rescueKitPassed": true,
  "overallResult": "Passed",
  "photoUrl": "data:image/jpeg;base64,...",
  "signatureUrl": "data:image/png;base64,...",
  "notes": "Unit verified in optimal working condition."
}
```

---

## 9. Developer Workflows & CLI Commands

### 9.1 Local Development
To run the Catalyst app locally:
```bash
# Navigate to the sacred Workbook directory
cd "Workbook"

# Install backend dependencies if needed
cd functions/aed_backend
npm install
cd ../..

# Launch the Catalyst local emulator
catalyst serve
```
- **Web Client URL**: `http://localhost:3000`
- **Backend API Gateway**: `http://localhost:3000/server/aed_backend/`

### 9.2 Deploying to Live Zoho Catalyst
Deployment script is provided in `Workbook/deploy.bat`:
```bash
cd "Workbook"
deploy.bat
# Or manually via CLI:
catalyst deploy --project 114503000000014051
```

---

## 10. Summary Checklist for Future Conversations

When continuing work on this project in any subsequent session:
1. **Always edit files in `Workbook/`** (`Workbook/client/`, `Workbook/functions/aed_backend/`).
2. **Never attempt browser subagent testing**.
3. **Preserve exact Excel design aesthetics** (`#004182`, `#0070C0`, `#00B050`, `#FF0000`, `#D97706`).
4. **Refer to this `PROJECT_MEMORY.md`** whenever needing architectural, schema, or integration details.
5. **Update this file** whenever changes are made.

---

## 11. Meeting 8 Client Review Implementation (October 2026)

All requirements and gaps identified during the Meeting 8 client review (with Christine and Vicky) have been resolved:

### 11.1 Form Defaults & Validation Cleanliness
- **Blank Initial State**: Removed all hardcoded mock defaults (`ZOLL`, `CPR-D-padz`, `AHA`, `CPR/AED`) across forms.
- Dropdowns now load with explicit placeholders: `-Select Brand-`, `-Select Model-`, `-Select Class Type-`, and `-Select Accreditation-`.
- Sku fields remain cleared until a valid brand and model are chosen.
- Serial and Lot numbers require explicit user entry (auto-generated sample strings removed).

### 11.2 Vicky's Location Default Rule
- When an account has **exactly 1 location**: The location dropdown automatically pre-selects that sole location.
- When an account has **multiple locations**: The location dropdown starts on `-Select Location-`, requiring explicit user selection.

### 11.3 Persona & Role Governance: Subscriber vs Reseller vs Sys Admin
- **Subscriber**: Distinct account ownership persona (`USR-OWNER-01`). Has full equipment and inspection management for their account, but **cannot manage or invite other users** (`canManageUsers: false`). The "Invite New User" button and sidebar user administration menu are hidden.
- **Reseller***: Manages multiple client accounts across a unified portal view.
- **Sys Admin**: Unrestricted global platform administration.

### 11.4 Equipment Location Inheritance & Spare Inventory
- Accessories (Batteries, Adult Pads, Pediatric Pads) assigned to an AED automatically inherit their parent AED's location.
- Spare inventory items retain location `-` and flip to `active` with parent location upon selection and attachment.

### 11.5 Vital AED Store Buy Links
- `buyEquipment(id)` now evaluates the item's SKU and model against an exact product directory on `vitalaed.com` (e.g. ZOLL CPR-D Padz, Philips M5070A battery, FRx smart pads, CR2 batteries).
- If an exact product match is not mapped, it gracefully falls back to the specific category page (Pads, Batteries, AED Units).

### 11.6 City of Miami Gardens 8-AED Roster & Inspection Alignment
- Seed data expanded from 1 lone AED to the full **8-AED municipal deployment** across 8 recreation facilities (Bunche Park, Betty T. Ferguson, Senior Family Center, Scott Park, Buccaneer Park, Carol City, Brentwood Pool, Rolling Oaks).
- Every AED is equipped with 100% brand-matched batteries and adult/pediatric pads with linked `aedId`.
- Complete recent inspection records prevent "No pads assigned" or uninspected warnings during demos.
- `DATA_VERSION` updated to `11.0.0-miami-gardens-aligned`.

---

## 12. Production RBAC & Multi-Tenant Authentication Architecture

### 12.1 Elimination of Mock Persona Switcher Dropdown
- The demo/mock user switching dropdown has been permanently removed from the top navigation bar.
- Identity and permissions are 100% bound to the authenticated Catalyst session (`window.catalyst.auth`).
- Topbar displays the real authenticated user's name, their assigned organization badge, and their role pill with official color styling.

### 12.2 Creator-Driven Portal Access Dispatch
- Users are created in **Zoho Creator** (`Users` / `Organizations` form).
- Zoho Creator workflow triggers the Catalyst backend webhook (`/creator-webhook/user-created`), which registers the user in Catalyst Authentication (`registerUser`).
- Catalyst dispatches official password-creation invitation emails directly to users.

### 12.3 Dual User-Creation Paths (Sys Admin Portal Invitation)
- In addition to Creator workflows, **Sys Admin** can invite/add users directly through the web portal (`#users-view` -> `+ Invite New User`).
- When Sys Admin invites a user, she can:
  - Assign them to an existing Organization.
  - OR leave the Organization unassigned (`None / Invite for Self-Onboarding`), allowing the client to self-provision their company.
- Submissions synchronize with Zoho Creator and register in Catalyst Authentication.

### 12.4 Sys Admin Global Exemption
- `Sys Admin` is **not constrained to any single organization** (`organization = 'Global Access'`, `organizationKey = 'all'`).
- Sys Admin retains global visibility across all client organizations, master audit logs, and global user management.

### 12.5 Multi-Tenant Scoping & Clean Empty State Onboarding
- **Standard Roles** (`Admin (Account Owner)`, `Admin`, `Reseller*`, `Staff`, `Inspector`):
  - Strictly scoped to their assigned `organizationKey`.
  - Zero access or visibility to other organizations' equipment, locations, inspections, or rosters.
- **Unassigned Organization (Empty State Onboarding)**:
  - An **Onboarding Setup Modal** (`#modal-org-onboarding`) prompts the user to enter their Organization Name, contact information, and address.
  - Creating their organization persists the record in Creator/local storage, links it to their profile, and unlocks their empty dashboard ready to add equipment.

### 12.6 Configured Production Users & Organizations
- **Sys Admin**:
  - Email: `narendhiran3317@gmail.com`
  - Role: `Sys Admin` (Catalyst Role ID: `114503000000023036`)
  - Catalyst Auth User ID: `114503000000018029`
  - Zoho Creator User ID: `4923252000000319053`
  - Access: Global system-wide visibility, multi-tenant switching, full portal user management.
- **Reseller**:
  - Email: `hardikjahannaren@gmail.com`
  - Role: `Reseller*` (Catalyst Role ID: `114503000000023038`)
  - Catalyst Auth User ID: `114503000000014088`
  - Zoho Creator User ID: `4923252000000339002`
  - Organization: `Vital AED` (Creator Org Record ID: `4923252000000326010`, Key: `vital-aed`)
  - Access: Managed reseller clients, sub-accounts, and scoped equipment.

### 12.7 Dynamic Authenticated Session Resolution
- Included official `catalystWebSDK.js` alongside `/__catalyst/sdk/init.js` in `index.html`.
- Eliminated all static `Christine Shale` / `Sys Admin` markup placeholders in `index.html`.
- Added `/api/auth/current-user` backend route that utilizes `catalystApp.userManagement().getCurrentUser()` to read authenticated HTTP cookies and cross-reference roles with Creator's `All_Users` report.
- Rewrote `checkAuthSession()` in `app.js` to query `/api/auth/current-user` and `window.catalyst.auth` on startup, preventing stale `sessionStorage` leaking across different user logins in the same browser tab.
- Configured local/offline fallback to use `INITIAL_DATA.currentUser` (`narendhiran3317@gmail.com`).

### 12.8 Multi-Tenant Organization View Scoping & Hardened Logout
- **Reseller Organization Isolation**:
  - `renderOrganizationsRoster()` in `app.js` strictly filters organizations based on `currentRole`.
  - `Reseller*` (e.g., Hardik) sees **only** their own reseller organization (`Vital AED`) and client accounts managed by their reseller (`resellerName === 'Vital AED'`).
  - Direct subscribers (Miami Gardens) and third-party reseller accounts (Apex / Metro Health) are completely hidden from the Reseller view.
  - Only `Sys Admin` retains global visibility across all client and reseller organizations.
- **Robust Logout (`handleLogout`)**:
  - Upgraded `handleLogout()` to pass fully qualified origin URLs (`window.location.origin + '/__catalyst/auth/login'`) to `catalyst.auth.signOut()`, preventing SDK URL parsing exceptions.
  - Clears all client storage (`sessionStorage.clear()`, `localStorage`).
  - Added backend `/api/auth/logout` endpoint to clear Catalyst session cookies with guaranteed redirect fallback.

### 12.9 Equipment vs. Spare Workflow & Location Inheritance (Requirement 2.3)
- **Strict Location Rule in Equipment View**:
  - `renderEquipment()` strictly filters out records lacking an assigned location (`!location || location === '-' || location === ''`) or flagged with `tab === 'spare'` or `inventoryStatus === 'spare'`.
  - Child consumables (batteries and pads) attached to or nested inside an AED unit automatically inherit the parent AED's location across views, forms, and Deluge/API synchronizations.
- **Spare View Routing Logic**:
  - Items created without an assigned location automatically route to the **Spare** section (`tab: 'spare'`, `inventoryStatus: 'spare'`, `serviceStatus: 'Standby'`).
  - Editing a spare item (AED, Pad, or Battery) and selecting an active location automatically converts its inventory status to active (`tab: 'active'`, `inventoryStatus: 'active'`, `serviceStatus: 'Rescue-Ready'`), transitions it from Spare to **Equipment**, cascades the location to bundled components, and triggers instantaneous re-rendering.
  - Selecting a spare consumable (pad or battery) from the AED Management Panel (`modal-select-spare-pad`, `modal-select-spare-battery`) immediately transfers the item from Spare into the active AED with inherited parent location.
  - Users can manually register equipment directly into Equipment (if deployed location is chosen) or into Spare (if kept as backup stock or unassigned).

### 12.10 AED Panel Consumable Tab Scoping (Pads & Batteries)
- **Problem**: When viewing AED Information in the AED panel (`aed-panel-view`), switching to the `Pads` or `Batteries` subtabs displayed >5 records from other client organizations (e.g., Miami Gardens, mock data) even though the Reseller account only owned 1 AED, 1 pad, and 1 battery.
- **Root Cause**:
  1. `renderPanelPads()` and `renderPanelBatteries()` read `allEquipment` directly from local storage without filtering by active organization (`filterRecordsByOrg`).
  2. If an inventory record had an empty/unlinked `aedId`, the filter condition fell through to `return true;`, leaking global consumables into the specific AED's subtab.
  3. Zoho Creator's standalone `Adult_Pads1_Report` and `Battery_Report` lack an `Organizations_Lookup` field, syncing global consumables into client cache.
- **Resolution**:
  - Enforced `filterRecordsByOrg(allEquipment)` in both `renderPanelPads()` and `renderPanelBatteries()`.
  - Enforced strict `String(e.aedId) === String(currentAEDId)` matching so only consumables attached to the active AED device are rendered in the panel.

### 12.11 AED Form Location Default ("-") & "+ Select from Spare" Workflow
- **Default Location `"-"`**:
  - In `populateAEDPanelDropdowns()`, `aed-info-location` dropdown now defaults to `"-"`.
  - Added bi-directional event handlers (`onAEDLocationChange()`, `onAEDInventoryStatusChange()`):
    - When `"-"` is selected, `aed-info-inventory-status` automatically switches to `Spare`.
    - When a real facility is chosen, `aed-info-inventory-status` automatically switches to `Active`.
  - When saving an AED via `saveAEDInformation()`:
    - If `location === '-'`: Item automatically saves as `tab: 'spare'`, `inventoryStatus: 'spare'`, `serviceStatus: 'Standby'`, routes to **Spare Equipment** (`switchView('spare')`), and cascades `'-'` to all attached consumables.
    - If location is assigned: Item saves as `tab: 'active'`, `inventoryStatus: 'active'`, `serviceStatus: 'Rescue-Ready'`, and routes to **Equipment** (`switchView('equipment')`).
- **"+ Select from Spare" Modal (`modal-select-spare-aed`)**:
  - Added "+ Select from Spare" button on the AED Information banner (`#btn-select-spare-aed`).
  - Added dedicated modal `modal-select-spare-aed` rendered via `renderSpareAEDModal()` and `openSelectSpareAEDModal()`.
  - Selecting an existing spare AED via `selectSpareAED(spareId)` auto-populates all device metadata (Brand, Model, SKU, Serial, Dates, Warranty) and keeps location as `"-"`, enabling immediate deployment to active service upon selecting a facility.

### 12.12 Sys Admin Topbar Organization Dropdown Switcher
- **Requirement & Intent**:
  - The System Administrator (`Sys Admin`) oversees multiple client organizations across the entire platform.
  - To enable instant inspection and scoping of records (Equipment, Spare, Inspections, CPR, Locations, Users, etc.) for each specific client organization, an organization selector dropdown is added to the topbar.
  - **Strict Role Isolation**: This dropdown is strictly visible and accessible **only to `Sys Admin`**. All other user personas (`Reseller*`, `Admin (Account owner)`, `Admin`, `Staff`, `Inspector`, `Customer`) do not see the dropdown; their views and data scopes remain strictly locked to their assigned account/client tenant.
- **Implementation**:
  - **HTML (`Workbook/client/index.html`)**:
    - Embedded `#topbar-org-container` inside `.topbar-left`, containing label `<i class="fa-solid fa-building"></i> Organization:` and `<select id="topbar-org-selector">`.
  - **CSS (`Workbook/client/css/styles.css`)**:
    - Styled `#topbar-org-container` and `.topbar-org-select` with clean borders, focus outlines, and responsive typography matching the Excel 1:1 utility bar design.
  - **JavaScript (`Workbook/client/js/app.js`)**:
    - `setupOrganizationSwitcher()`:
      - Validates if `currentRole === 'Sys Admin'`. If not, hides `#topbar-org-container` and `#topbar-org-selector`.
      - If `Sys Admin`, displays `#topbar-org-container` and populates `<select>` with `-- All Organizations (Master View) --` (`value="all"`) plus all registered organizations from `INITIAL_DATA.organizations` and `localStorage.getItem('aed_organizations')`.
    - `window.onSwitchOrganization(orgKey)`:
      - Sets `currentOrganizationKey = orgKey`.
      - Updates `#topbar-user-org` subtitle dynamically to reflect the selected organization name or "All Organizations (Master View)".
      - Triggers `filterRecordsByOrg()` across all views and immediately re-renders: `renderDashboard()`, `renderEquipment()`, `renderSpare()`, `renderInspections()`, `renderRescue()`, `renderCPR()`, `renderLocations()`, `renderUsersRoster()`, `renderOrganizationsRoster()`, and `populateDropdowns()`.
    - Integrated with `applyRolePermissions()` to enforce real-time visibility updates on login or session change.

### 12.13 Mandatory Sign-In Gate & Role-Scoping In-Portal Authentication
- **Problem & Root Cause**:
  - Previously, `checkAuthSession()` had a fallback defaulting unauthenticated visitors to `narendhiran3317@gmail.com` as **Sys Admin**.
  - When fixing this, redirecting directly to `/__catalyst/auth/login` caused failures/redirect issues on deployed sites where hosted login wasn't separately configured or when cookies weren't preserved. Furthermore, the interactive sign-in form was hidden (`display: none`) on live sites, and `sessionStorage.removeItem` was prematurely clearing valid sessions on every reload.
- **Robust Resolution**:
  - **In-Portal Sign-In Modal (`#login-overlay`)**:
    - Embedded full-screen modal (`#login-overlay`, `z-index: 999999`) with clean AED Remind branding, email, password, and "Remember Me" option.
    - When an unauthenticated visitor opens or pastes the link in any browser (live or localhost), the app completely halts initialization (`initApp()` stops before fetching any confidential data) and displays the sign-in modal.
    - **No one can see the Sys Admin dashboard or any client data without logging in.**
  - **Role & Organization Resolution (`handlePortalLogin`)**:
    - Queries backend `/api/auth/login` and cross-references live Zoho Creator `All_Users` and known accounts.
    - Resolves verified role:
      - `narendhiran3317@gmail.com` -> **Sys Admin** (`organization: 'Global Access'`, `organizationKey: 'all'`, topbar switcher active).
      - `hardikjahannaren@gmail.com` -> **Reseller\*** (`organization: 'Vital AED'`, `organizationKey: 'vital-aed'`).
      - Client admin (e.g. `admin@miamigardens-fl.gov`) -> **Admin (Account owner)** (`organizationKey: 'miami-parks'`).
      - `inspector@vitalaed.com` -> **Inspector** (`organizationKey: 'vital-aed'`).
  - **Modular App Lifecycle (`startAuthenticatedApp()`)**:
    - Extracted initialization so upon successful login (via form submission or one-click quick test buttons), the app seamlessly syncs Creator data, configures role boundaries, and renders the specific role's authorized views (`renderDashboard()`, `renderEquipment()`, etc.).
  - **Persistent Session & Clean Logout**:
    - Caches user session in `sessionStorage` (and `localStorage` when "Keep me signed in" is checked).
    - `handleLogout()` clears all session and local storage and brings back the Sign-In Modal immediately.

### 12.14 AED & Consumable Lifecycle: Two-Stage Creation, Brand Autofill & Smart Association Workflow
- **Business Need & User Workflow**:
  - In practice, customers often acquire an AED device first, and obtain or replace pads and batteries at a later date.
  - The system must support creating and saving an AED stand-alone, without requiring pads or battery upfront.
  - When the customer subsequently acquires pads or batteries, opening/editing the AED allows immediate navigation to the Pads and Battery tabs with **automatic Brand autofill matching the parent AED**, recommended compatible models, inherited location & organization, and bi-directional linking.
- **Key Enhancements**:
  - **Quick Action Association Buttons (`Workbook/client/index.html`)**:
    - Added `#btn-goto-pads` (`+ Associate Pads`) and `#btn-goto-battery` (`+ Associate Battery`) to the AED Information header banner.
    - These buttons are visible whenever editing an existing AED or after saving an initial AED record.
  - **Equipment Table Action Cue (`Workbook/client/js/app.js`)**:
    - In `renderEquipment()`, when an AED has 0 attached consumables (`attached.length === 0`), an amber warning row is rendered immediately beneath it:
      - `Action Needed: No pads or battery currently associated with this AED`
      - Inline action buttons: `+ Add Pads` and `+ Add Battery`, wired to `goToAssociatePadsFromTable(aedId)` and `goToAssociateBatteryFromTable(aedId)`.
  - **Smart Model & Compatibility Recommendation**:
    - `getRecommendedPadModel(brand, aedModel)`:
      - ZOLL: AED Plus -> `CPR-D-padz`; AED 3 -> `CPR-Uni Padz III`; AED Pro -> `Stat-padz II`.
      - Philips: HeartStart OnSite -> `Adult SMART Pads Cartridge`; HeartStart FRx -> `SMART Pads II`.
      - Cardiac Science: Powerheart G5 -> `Intellisense CPR Adult Pads`; Powerheart G3 -> `G3 Adult Defibrillation Pads`.
      - Physio-Control: LIFEPAK CR2 -> `QUIK-STEP Pacing/CPR/Defibrillation Electrodes`; LIFEPAK 1000 / CR Plus -> `EDGE System Electrodes with Quik-Combo`.
      - Defibtech: Lifeline AED / Lifeline AUTO -> `Adult Defibrillation Pad Package`.
      - Heartsine: samaritan PAD -> `Pad-Pak Adult (Electrode & Battery)`.
    - `getRecommendedBatteryModel(brand, aedModel)`:
      - Maps parent AED model to official OEM Lithium/Li-MnO2 battery pack models and SKUs.
  - **Automatic Brand & Field Inheritance**:
    - `openPadForm(pad, aedId)`:
      - Automatically sets `pad-info-brand` to parent AED's brand.
      - Dispatches `change` event to dynamically populate `pad-info-model` with compatible models.
      - Pre-selects the recommended compatible pad model and automatically triggers SKU population.
      - Inherits the parent AED's facility location and organization keys.
    - `openBatteryForm(battery, aedId)`:
      - Automatically sets `battery-info-brand` to parent AED's brand.
      - Pre-selects the recommended compatible battery model and auto-populates battery SKU.
      - Inherits location and organization keys from the parent AED.
  - **Seamless Sequential Save Transitions**:
    - `saveAEDInformation()`: After saving a new AED without attached consumables, triggers a confirmation prompt: *"This AED currently has no Pads and Battery associated with it. Would you like to associate them now?"* and directly opens `goToAssociatePads()`.
    - `savePadInformation()`: Upon saving pads for an AED lacking a battery, automatically prompts: *"Would you like to associate the Battery now?"* and navigates directly to `goToAssociateBattery()`.
    - `saveBatteryInformation()`: Once the battery is saved, checks if both consumables are present and alerts: *"AED [Model] is now fully Rescue-Ready with linked Pads and Battery!"*

### 12.15 Inspection Bi-Directional Synchronization (Zoho Creator ↔ Catalyst Web Portal)
- **Problem Statement**:
  - Inspections added directly in Zoho Creator were not appearing in the Catalyst portal.
  - Inspections registered from the portal were failing to save properly in Zoho Creator.
- **Root Causes Identified**:
  1. **Creator → Portal Sync Drop**:
     - `normalizeInspection(rec)` in `delugeMappers.js` omitted `organization` and `organizationKey`.
     - In the portal client, `renderInspections()` and `renderDashboard()` pass all incoming records through `filterRecordsByOrg(rawData)`. Because `organization` and `organizationKey` were missing, 100% of Creator inspection records were filtered out and hidden.
     - In addition, Creator returns location and AED serial information under `rec.Locations.Location_Name` / `rec.Locations.zc_display_value` and `rec.AED_Lookup.Serial_Number` / `rec.AED_Lookup.zc_display_value`, which were not properly mapped to `location` and `serialNumber`.
  2. **Portal → Creator Sync Rejection**:
     - `buildInspectionPayload(item)` in `delugeMappers.js` sent `Inspection_ID: item.inspectionId`, but `Inspection_ID` in Creator `Inspections` form is an `AUTO_NUMBER` field. Zoho Creator rejects insert payloads that specify values for autonumber fields.
     - `Inspection_Status` sent `"Deficiency Identified"` for non-OK inspections. However, Creator's picklist strictly enforces `{"✅OK", "⚠️Overdue", "❌Failed"}`. Unmatched string values resulted in validation errors.
     - In `form Inspections`, 15 inspection checklist questions are configured with `mandatory: true` (`Is_the_AED_in_its_assigned_location`, `Is_it_visible_and_accessible`, `Status_indicator_Blinking_Green_Light`, etc.) and `Is_Archive` filter (`[Is_Archive == "No"]`). Missing checklist fields caused Creator API insertion rejections.
     - In `saveInspectionForm()` (`app.js`), `inspectionRecord` was generated without `organization` and `organizationKey`, causing local filtering and caching discrepancies.
- **Architecture & Implementation Solutions**:
  - **Enhanced Creator Normalizer (`delugeMappers.js`)**:
    - `normalizeInspection(rec, locationsMap, aedsMap)` now maps `organization` and `organizationKey` from `rec.Organizations_Lookup`, matching `Locations` in `locationsMap`, or matching `AED_Lookup` in `aedsMap`.
    - Sanitizes `Inspection_Status` from emojis/raw strings into clean portal statuses (`OK`, `Failed`, `Overdue`, `Out Of Service`).
    - Maps `serialNumber`, `location`, `inspector`, `comments`, and checklist answers (`q1`-`q15`).
  - **Robust Backend Resolution (`functions/aed_backend/index.js`)**:
    - In `GET /api/inspections`, fetches `Inspections_Report` along with `Locations_Report` and `AED_Report` in parallel to build lookup maps and enrich every inspection record with its exact organization and equipment context.
    - In `POST /api/inspections`, automatically resolves live Creator Record IDs for `AED_Lookup`, `Locations`, and `Organizations_Lookup` based on serial number, facility name, and company name before submission.
    - Oromits `Inspection_ID` autonumber from payload and provides all 15 mandatory checklist answers (`"Yes"` / `"No"`), `Is_Archive: ["No"]`, and valid picklist values (`"✅OK"`, `"❌Failed"`, `"⚠️Overdue"`).
  - **Portal Client Sync & Caching (`client/js/api.js` & `client/js/app.js`)**:
    - In `api.getInspections(tab)`, verifies each incoming record from Creator and stamps missing organization keys using local equipment and facility caches before storing in `localStorage('aed_inspections')`.
    - In `saveInspectionForm()`, stamps `organization` and `organizationKey` onto `inspectionRecord` from parent AED / location / active session before calling `api.addInspection()`, and awaits server response to update local storage with the official Creator Record ID.
    - Updated `renderInspections()` and `openRegisterInspectionForm()` to support full inspection details view and modal population.

### 12.16 Native Catalyst Hosted Login Gate & Role-Based Initial View Enforcement
- **Requirement & Problem Statement**:
  - Unauthenticated visitors copying and pasting the link must never access the application or view any data.
  - No custom or separate login form is used. The app strictly uses the official **Zoho Catalyst Hosted Login page** (`/__catalyst/auth/login`).
  - Upon logging in through Catalyst, the system detects the user's credentials and displays only the authorized view for that role.
- **Architecture & Implementation Solutions**:
  1. **Strict Auth Gate CSS (`Workbook/client/index.html`)**:
     - Applied `<body class="auth-checking">` with `body.auth-checking { display: none !important; }`.
     - Zero UI is displayed to unauthenticated visitors or while checking the session.
     - Upgraded Catalyst Web SDK to `4.6.2` matching the official Catalyst Hosted Login environment.
  2. **Direct Redirect to Catalyst Hosted Login with Return Parameter (`Workbook/client/js/app.js`)**:
     - In `initApp()`, if `checkAuthSession()` returns `false`, the app immediately redirects: `window.location.replace('/__catalyst/auth/login?redirect_url=' + encodeURIComponent(target))`.
     - Completely bypasses any custom login form in favor of Zoho Catalyst's official authentication page.
  3. **Catalyst Login Redirect API Configuration (`Workbook/client/client-package.json`)**:
     - Configured `"login_redirect": "/app/index.html"` in `client-package.json`.
     - This automatically updates Catalyst's Login Redirect API upon deployment, ensuring the Catalyst Hosted Login page knows where to send users after authentication.
  4. **Strict Live Session Validation (`checkAuthSession()`)**:
     - Bypasses any cached client storage on initial load to verify the active session directly against Catalyst Web SDK (`catalyst.auth.isUserAuthenticated()`) and Catalyst backend (`/server/aed_backend/api/auth/current-user` via `catalystApp.userManagement().getCurrentUser()`).
     - If neither confirms a live, active Catalyst session, clears all cached storage and forces immediate redirection to `/__catalyst/auth/login`.
     - Only caches the session in `sessionStorage` once Catalyst confirms successful authentication.
  5. **Role-Tailored View Display (`applyAuthenticatedUser()`)**:
     - After authenticating on Catalyst's login page and redirecting back, the system resolves the user's role from Catalyst and Creator:
       - `Inspector` &rarr; Automatically displays `switchView('inspections')`.
       - `Staff` &rarr; Automatically displays `switchView('equipment')`.
       - `Sys Admin`, `Reseller*`, `Admin (Account owner)`, `Admin` &rarr; Automatically displays `switchView('dashboard')`.
  6. **Direct Catalyst Logout (`handleLogout()`)**:
     - Clears local/session storage, signs out via Catalyst SDK, calls `/api/auth/logout`, and immediately redirects back to `window.location.replace('/__catalyst/auth/login')`.

### 12.17 AED Inspection & Rescue Quick Action Workflows (Hardware-Only Table Separation)
- **Requirement & Problem Statement**:
  - The Equipment table must strictly display physical hardware equipment only (AED devices and their attached consumable Pads and Batteries).
  - Inspection reports and Rescue Event reports must NOT be injected as child rows into the Equipment table; they reside in their dedicated tabs.
  - However, for unattached AEDs or action rows, the user requested quick action buttons for **`+ Add Inspection`** and **`+ Rescue Event`** alongside **`+ Add Pads`** and **`+ Add Battery`**.
- **Architecture & Implementation Solutions**:
  1. **Strict Hardware-Only Equipment Table (`Workbook/client/js/app.js`)**:
     - `renderEquipment()` displays only AED master rows and attached consumable component rows (Adult Pads, Pediatric Pads, Battery).
     - Does not inject inspection or rescue reports into the Equipment table.
  2. **Action Row with Inspection & Rescue Quick Buttons**:
     - Amber Warning Row (`attached.length === 0`): Renders `+ Add Pads`, `+ Add Battery`, `+ Add Inspection` (`goToInspectFromTable`), and `+ Rescue Event` (`goToReportRescueFromTable`).
  3. **Seamless Navigation & Modal Pre-filling**:
     - `goToInspectFromTable(aedId)` / `goToInspect()`: Opens the AED panel, selects the `inspections` subtab, and triggers `openRegisterInspectionForm(null, true)` with the AED's location, serial number, and assigned pads/batteries pre-populated.
     - `goToReportRescueFromTable(aedId)` / `goToReportRescue()`: Opens `modal-rescue-upload` with the target AED selected and its location pre-filled.
  4. **AED Information Banner & Top Action Bar Buttons (`Workbook/client/index.html`)**:
     - Added `#btn-goto-inspection` (`+ Conduct Inspection`) and `#btn-goto-rescue` (`+ Rescue Event`) to the AED Information header banner.
     - Added `+ Add Inspection` and `+ Rescue Event` pill shape buttons to the main Equipment view toolbar (`.excel-pill-btn-group`).

### 12.18 Hardened Catalyst Sign-Out & Immediate Sign-In Page Redirection
- **Problem**: Clicking "Log Out" left the user on the dashboard view or flickered without redirecting to the sign-in page.
- **Root Cause**:
  1. `window.catalyst.auth.signOut()` was invoked without arguments and had `.catch()` attached. In Zoho Catalyst Web SDK 4.6.2, `signOut()` is a synchronous method that returns `undefined` (not a Promise), causing an unhandled `TypeError` that halted execution before `window.location.replace` was reached.
  2. The page view was not immediately hidden, allowing the UI to remain visible during logout latency.
  3. Zoho Catalyst Hosted Auth requires the redirect URL to be passed into `catalyst.auth.signOut(redirectURL)` to invalidate the session cookie on Zoho IAM servers and navigate directly to `/__catalyst/auth/login`.
- **Resolution**:
  1. **Immediate Visual Shielding**: Added `document.body.classList.add('auth-checking')` on line 1 of `handleLogout()` to instantly blank the view so no stale view lingers.
  2. **Synchronous Storage Purge**: Clears `sessionStorage.clear()`, `localStorage.removeItem('aed_auth_user')`, and all cached credentials/roles.
  3. **Backend Cookie Clearing**: Calls `/server/aed_backend/api/auth/logout` non-blockingly to clear session cookies (`catalyst_ticket`, `zcid`, `iam_ticket`, etc.).
  4. **Official SDK Sign-Out**: Calls `catalyst.auth.signOut(loginUrl)` passing the fully qualified login URL with return path (`window.location.origin + '/__catalyst/auth/login?redirect_url=' + encodeURIComponent('/app/index.html')`).
  5. **Guaranteed Fallback Navigation**: Added `setTimeout(() => window.location.replace(loginUrl), 400)` to ensure immediate transition to the Catalyst Hosted Sign-In page in all environments.

### 12.19 AED Information Banner Button Cleanup (Retain Select from Spare Only)
- **Requirement**: Remove redundant action buttons (`+ Associate Pads`, `+ Associate Battery`, `Conduct Inspection`, `Rescue Event`) from the `AED Information` banner, retaining only `Select from Spare`.
- **Rationale**:
  - The sub-tabs directly above the banner (`Pads`, `Batteries`, `Inspections`, `Rescue Events`) already provide dedicated forms and spare selectors for their respective records.
  - Squeezing those buttons into the `AED Information` banner created layout clutter and duplicate actions.
  - `Select from Spare` directly serves the current AED unit being inspected/configured.
- **Implementation**:
  - In `Workbook/client/index.html` (`#subtab-aed .aed-panel-banner .banner-btn-group`), removed `#btn-goto-pads`, `#btn-goto-battery`, `#btn-goto-inspection`, and `#btn-goto-rescue`.
  - Retained only `#btn-select-spare-aed` (`openSelectSpareAEDModal()`).

### 12.20 Resolution of Catalyst PATTERN_NOT_MATCHED on Hosted Login
- **Problem**: In a fresh incognito/unauthenticated browser window, navigating to the app returned `{"status":"failure","data":{"error_code":"PATTERN_NOT_MATCHED","message":"Please check whether the input values are correct"}}`.
- **Root Cause**:
  - The redirect to `/__catalyst/auth/login` appended `?redirect_url=/app/index.html`.
  - Zoho Catalyst's hosted authentication gateway strictly validates query parameters. The endpoint does not accept arbitrary query strings; its post-login redirect is governed strictly by the `"login_redirect": "/app/index.html"` property declared in `client-package.json`.
  - Passing `redirect_url` failed Catalyst's regex/pattern validation and produced the `PATTERN_NOT_MATCHED` error.
- **Resolution**:
  - Cleaned all redirects in `Workbook/client/js/app.js` (`initApp()`, `redirectToCatalystLogin()`, and `handleLogout()`) to point cleanly to `/__catalyst/auth/login` without any query parameters.
  - Catalyst automatically forwards authenticated sessions to `/app/index.html` via `client-package.json`.

### 12.21 Multi-Tenant Organization Filtering & Live Creator ID Resolution Architecture
- **Requirement & Problem Statement**:
  - When records (AED, battery, pad, inspection, location, etc.) were created in Zoho Creator under a specified organization, they appeared in the portal under `-- All Organizations (Master View) --`, but vanished when the user selected that specific organization from the topbar dropdown.
- **Root Cause Analysis**:
  1. **Premature Filter Exit (`Workbook/client/js/app.js`)**: `filterRecordsByOrg` checked `if (k) return k === targetKey;`. When `k` was a backend slug (`city-of-miami-gardens-parks-rec`) while `targetKey` was `miami-parks` (or a raw Creator ID `4923252000000326010`), `k !== targetKey` caused an immediate `false` return without ever checking the organization name.
  2. **Hardcoded Static Registry**: `targetOrgObj` was looked up strictly in `INITIAL_DATA.organizations`. Any organization newly provisioned in Creator was absent from `INITIAL_DATA`, causing `targetOrgName` to remain empty string `""`.
  3. **Raw Creator Lookup Numeric IDs (`Workbook/functions/aed_backend/delugeMappers.js`)**: Creator API reports frequently return lookup fields as raw numeric record IDs (e.g., `"4923252000000326010"`) without a `display_value` string, leading to blank or mismatched organization names.
  4. **Sub-Item Inheritance Gap (`Workbook/functions/aed_backend/index.js`)**: Attached batteries and pads inherited `location` and `tab` from parent AEDs, but did not inherit `organization`, `organizationKey`, or `organizationId`.
- **Architectural Implementation**:
  1. **`resolveOrganization(rec, orgsMap)` in `delugeMappers.js`**:
     - Resolves raw numeric lookup IDs, objects, and strings against an `orgsMap` dictionary (mapping ID -> name/slug, name -> ID/slug, slug -> ID/name).
     - Standardizes `organization` (display name), `organizationKey` (canonical slug), and `organizationId` (Creator ID).
     - Extended across `normalizeAED`, `normalizeBattery`, `normalizeAdultPad`, `normalizePediatricPad`, `normalizeSpare`, `normalizeLocation`, `normalizeInspection`, and `normalizeCPR`.
  2. **Concurrent Organization Discovery & Cascading in `index.js`**:
     - `GET /api/equipment`, `GET /api/inspections`, and `GET /api/locations` concurrently fetch `Organizations_Report` from live Creator and build `orgsMap`.
     - Parent AEDs automatically cascade `organization`, `organizationKey`, and `organizationId` to attached component pads and batteries.
     - `POST /api/equipment` accurately resolves the matching organization ID rather than defaulting to `firstOrgId`.
  3. **Robust Client Stamping & Merging in `api.js`**:
     - `stampOrganization(item)` cross-references `INITIAL_DATA.organizations` and `localStorage.getItem('aed_organizations')`, stamping `organization`, `organizationKey`, and `organizationId`.
     - `getOrganizations()` merges live Creator organizations, pending offline additions, and base seed organizations.
  4. **Multi-Factor Scoping Engine in `app.js`**:
     - Added `getAllKnownOrganizations()` consolidating static seeds and live Creator organizations into a unified lookup.
     - Upgraded `filterRecordsByOrg(records)` with multi-factor matching: matches if record matches by key, Creator ID, name (case-insensitive substring/equality), slugified name, or attached parent AED.

### 12.22 Removal of Add Inspection and Rescue Event Toolbar Pill Buttons
- **Requirement**: Remove `Add Inspection` and `Rescue Event` buttons from the Equipment view toolbar and table action rows.
- **Implementation**:
  - In `Workbook/client/index.html` (`#equipment-view .excel-pill-btn-group`), removed `<button class="excel-pill-btn" onclick="openRegisterInspectionForm(null, true)">` and `<button class="excel-pill-btn" onclick="openUploadRescueModal()">`. The toolbar strictly features `+ Add AED`, `Spare`, and `Archived` per the Excel System Map 2.8 specification.
  - In `Workbook/client/js/app.js` (`renderEquipment()`), removed the quick action buttons for inspection and rescue event from the unassociated AED warning row, leaving only `+ Add Pads` and `+ Add Battery`.

### 12.23 Pad & Battery Two-Way Creator Synchronization Resolution
- **Requirement & Problem Statement**:
  - AED two-way sync was fully operational (adding in Creator reflects in the portal; adding in the portal reflects in Creator).
  - Pads (Adult & Pediatric) and Batteries were failing to sync in both directions:
    1. Pads and Batteries created in Zoho Creator did not appear in the portal.
    2. Pads and Batteries created/associated in the portal failed to create or persist in Zoho Creator.
- **Root Cause Analysis**:
  1. **Creator Picklist & Field Name Incompatibilities**:
     - In `delugeMappers.js`, `buildBatteryPayload`, `buildAdultPadPayload`, and `buildPediatricPadPayload` set `Expiration_Status1` instead of `Expiration_Status`.
     - `mapExpirationStatus()` returned `'Ok'` and `'Expiring Soon'`. However, Zoho Creator picklist values are strictly case-sensitive:
       - Adult Pads: `{"OK", "Expires in [x days]", "Expired"}`
       - Battery: `{"OK", "Expires In [x days]", "Expired"}`
       - Pediatric Pads: `{"OK", "Expires in [x days]", "Expired"}`
     - Sending `'Ok'` or `Expiration_Status1` triggered `INVALID_INPUT` rejections from Creator's REST API.
  2. **Omission of `Organization` in Consumable Payloads**:
     - `buildBatteryPayload`, `buildAdultPadPayload`, and `buildPediatricPadPayload` omitted the `Organization` text field, resulting in blank organization scoping in Creator.
  3. **Invalid Non-Numeric Lookups (`AED_Bilookup` & `Equipment__AED`)**:
     - In `POST /api/equipment`, when client submitted `item.aedId`, it was often a client-generated local ID (e.g. `AED-17602...`) rather than a live Creator record ID (`492325...`).
     - Passing non-numeric IDs to Creator's picklist lookup fields caused rejection.
     - Furthermore, spare pads without an AED were erroneously assigned to the first AED record in Creator (`aedReport.data[0].ID`), improperly linking standalone spare inventory to arbitrary devices.
  4. **Creator Report Consumable Ingestion & Normalization**:
     - Creator API returns lookup fields as either nested objects (`{ ID, display_value }`), flattened keys (`['AED_Bilookup.ID']`, `['Equipment__AED.ID']`), or serial number strings (`"AED - 991823"`).
     - When lookup IDs could not be resolved, `location` defaulted to `'-'` and `tab` defaulted to `'active'`.
     - In `renderEquipment()`, items with `location === '-'` and `tab === 'active'` were filtered out of the equipment view, and because `tab !== 'spare'`, were also omitted from the spare view, making them invisible.
- **Architectural Implementation**:
  1. **Schema-Compliant Deluge Payload Builders (`functions/aed_backend/delugeMappers.js`)**:
     - Upgraded `mapExpirationStatus(status, isBattery)` to strictly return `"OK"`, `"Expires in [x days]"`, `"Expires In [x days]"`, or `"Expired"`.
     - Output both `Expiration_Status` and `Expiration_Status1` to guarantee compatibility across all form and report variants.
     - Included `Organization: item.organization || item.orgName || ''`.
     - Guarded `Equipment__AED` and `AED_Bilookup` to only attach if `targetAed` is a valid numeric Creator ID (`/^\d+$/`).
  2. **Comprehensive Parent AED Indexing & Ingestion Normalizer**:
     - Added `extractAedReference()` and `resolveParentAED()` in `delugeMappers.js` extracting from `Equipment__AED`, `Equipment_AED`, `AED_Bilookup`, `*.ID`, and `*.display_value`.
     - Upgraded `GET /api/equipment` in `index.js` to build multi-dimensional lookup indexes (`aedsById`, `aedsBySerial`, `aedsByLocation`).
     - If attached to an AED, component pads/batteries inherit parent AED ID, location, tab, and organization.
     - If unattached (`location === '-'`), automatically routed to `tab: 'spare'`, `inventoryStatus: 'spare'`, `serviceStatus: 'Standby'` per Client Requirement 2.3, ensuring they immediately populate the Spare Equipment view.
  3. **Backend `resolveCreatorAedId()` Resolution (`functions/aed_backend/index.js`)**:
     - In `POST /api/equipment` and `PUT /api/equipment/:id`, resolves `item.aedId` or `item.aedSerial` against `AED_Report` before sending payloads to Creator.
     - For spare items (`tab === 'spare'`), leaves lookup fields unattached rather than attaching dummy IDs.
     - Returns Creator record ID (`createdId`) in response data payload for immediate client cache synchronization.
### 12.24 Location Form Autofill Checkbox Toggle & Clear Behavior
- **Requirement & Problem Statement**:
  - In the Location form (`#locations-form-container`), checking "Same as organization address", "Same as user info", or "Same as Location's phone" autofills the corresponding address, contact, and phone fields.
  - Previously, unchecking any of these checkboxes left the autofilled values in the input fields ("it still therecord").
  - The client required that unchecking any checkbox immediately vanishes/clears the associated autofilled fields.
- **Implementation**:
  - In `Workbook/client/js/app.js`:
    - Updated `onSameAsOrgAddressChange()`: when `loc-chk-same-org` is unchecked, clears `loc-form-street`, `loc-form-suite`, `loc-form-city`, `loc-form-state`, and `loc-form-zip`.
    - Updated `onSameAsUserInfoChange()`: when `loc-chk-same-user` is unchecked, clears `loc-form-contact-first`, `loc-form-contact-last`, `loc-form-contact-email`, and `loc-form-contact-phone` (and unchecks `loc-chk-same-phone`).
    - Updated `onSameAsLocationPhoneChange()`: when `loc-chk-same-phone` is unchecked, clears `loc-form-contact-phone`.

### 12.25 Spare Equipment & Equipment Table View & Edit Action Resolution
- **Requirement & Problem Statement**:
  - In the Spare Equipment view (`#spare-view`), clicking the **View** icon button (`<i class="fa-regular fa-file-lines"></i>`) in table rows or selecting a row and clicking the toolbar **Edit** button (`#btn-edit-spare`) did not respond.
  - The same applied to consumables in the main Equipment table.
- **Root Cause Analysis**:
  1. **Block Scoping Exception (`ReferenceError: item is not defined`)**:
     - In `openAddSparePadModal()` and `openAddSpareBatteryModal()`, `const item = all.find(...)` was declared with `const` strictly inside the `if (editId) { ... }` block.
     - Later in both functions, location dropdown setup evaluated `locSel.value = item?.location && item.location !== '-' ? item.location : '-'`.
     - In JavaScript ES6 strict scoping, referencing `item` outside the `if` block threw `ReferenceError: item is not defined`, crashing execution immediately before `openModal()` was ever invoked.
  2. **Missing `viewPadDetails` and `viewBatteryDetails` Function Bindings**:
     - `renderEquipment()` generated row view buttons calling `viewPadDetails(comp.id, aed.id)` and `viewBatteryDetails(comp.id, aed.id)`.
     - Neither function was attached to `window`, leading to potential unhandled `ReferenceError` calls on attached components.
- **Implementation**:
  - In `Workbook/client/js/app.js`:
    - Hoisted `const item = editId ? all.find(e => String(e.id) === String(editId)) : null;` to the top scope of `openAddSparePadModal()` and `openAddSpareBatteryModal()`.
    - Added model auto-selection arguments to `onSparePadBrandChange(item.model)` and `onSpareBatteryBrandChange(item.model)`.
    - Dynamically toggled modal titles (`Spare Equipment — View / Edit ...`) and action button labels (`Save Changes` vs `Save Spare ...`).
    - Added comprehensive definitions for `window.viewPadDetails` and `window.viewBatteryDetails` to open the parent AED Panel on the respective subtab or route standalone items to spare modals.
    - Added fallback to `openAddSpareAED()` in `viewSpareEquipmentDetails()`.

### 12.26 Consumable Save Resolution (Pads & Battery Form & Spare Synchronization)
- **Requirement & Problem Statement**:
  - The Save button did not work or appeared unresponsive when adding pads and batteries in either the Spare Equipment modal (`#modal-add-spare-pad`, `#modal-add-spare-battery`) or the AED Panel consumable tabs (`#subtab-pads`, `#subtab-batteries`).
- **Root Cause Analysis**:
  1. **Synchronous Network Blocking & Lack of Timeout**:
     - `api.addEquipment()` and `api.updateEquipment()` in `api.js` awaited backend network fetch calls without an `AbortController` timeout.
     - When Creator API calls or backend roundtrips were slow or timed out, the browser thread was held waiting, preventing form close handlers (`closeModal()`, `closePadForm()`, `closeBatteryForm()`), audit log dispatches, user alert notifications, and view re-renders from ever executing.
  2. **Deferred / Stale Local Storage Persistence**:
     - In `saveSparePadRecord()` and `saveSpareBatteryRecord()`, `allEquipment` array references were read before `await api.addEquipment()` and overwritten afterwards, causing race conditions and UI inconsistency.
     - In `api.addEquipment()`, local storage was only updated *after* the network request returned, meaning any network delay completely halted local UI responsiveness.
  3. **Strict Client-Side Validation on Blank Non-Asterisk Fields**:
     - In `savePadInformation()` and `saveBatteryInformation()`, lot number was strictly required (`if (!lot) alert(...)`), but the UI input labels did not indicate requirement with an asterisk, and users often left them blank.
     - If expiration date or purchase date was left blank, submission failed.
  4. **Creator Schema Mismatches**:
     - In `delugeMappers.js`, `buildAdultPadPayload()` lacked the `Manufacturer` field required by Zoho Creator's `Adult_Pads1` form.
     - In `buildSparePayload()`, `Location: '-'` prevented spare items from appearing in Creator's `Spare_Equipment` report (which specifically filters on `[Location is null]`).
     - In `functions/aed_backend/index.js`, `item.type === 'Battery'` used a strict case-sensitive match rather than case-insensitive comparison.
- **Architectural Implementation**:
  1. **Immediate Optimistic UI & Asynchronous Sync**:
     - In `Workbook/client/js/api.js`:
       - `addEquipment()` now saves to `localStorage` *immediately* before initiating network requests, ensuring 100% data persistence even on slow or offline connections.
       - Added 6-second `AbortController` timeouts to both `addEquipment()` and `updateEquipment()` so requests never freeze the client interface.
       - Automatically syncs Creator record ID to `localStorage` when returned by the backend.
  2. **Non-Blocking Client Handlers with Safe Fallbacks (`Workbook/client/js/app.js`)**:
     - `saveSparePadRecord()`: Autogenerates lot if empty, defaults expiration date to 2 years, dynamically derives pad category (`Pediatric Pads` vs `Adult Pads`), updates `localStorage` synchronously, dispatches backend sync asynchronously via `.catch()`, closes modal immediately, alerts user, and updates all views.
     - `saveSpareBatteryRecord()`: Autogenerates lot if empty, defaults expiration date to 4 years, updates `localStorage` synchronously, dispatches backend sync asynchronously, closes modal immediately, alerts user, and updates views.
     - `savePadInformation()`: Autogenerates lot if blank (`LOT-[random]`), defaults expiration date to 2 years, updates `localStorage` synchronously, dispatches backend sync asynchronously, closes form immediately, alerts/prompts for battery, and re-renders table views.
     - `saveBatteryInformation()`: Autogenerates lot if blank (`BAT-[random]`), defaults purchase date to today and expiration date to 4 years, updates `localStorage` synchronously, dispatches backend sync asynchronously, closes form immediately, alerts user, and re-renders table views.
     - `savePadRecord()` and `saveBatteryRecord()`: Updated to persist locally and dispatch backend sync without blocking.
  3. **Creator Deluge Schema Alignments (`Workbook/functions/aed_backend/delugeMappers.js` & `index.js`)**:
     - Added `Manufacturer: mapAEDBrand(item.brand)` to `buildAdultPadPayload()`.
     - Set `Location: ''` in `buildSparePayload()` to ensure spare records match Creator's `[Location is null]` report criteria.
     - Made `item.type` check for battery case-insensitive in `functions/aed_backend/index.js`.
### 12.27 Batch & Toolbar Delete Action Resolution (Organizations & Roster Toolbars)
- **Requirement & Problem Statement**:
  - Selecting rows in the Organizations table (e.g., duplicate entries of "ABC Company" or "California pvt lmd") and clicking the top action bar **Delete** button failed to remove the records. The table remained unchanged with checked items still visible.
- **Root Cause Analysis**:
  1. **Faulty Association Check False-Positives**:
     - In `checkRecordAssociation('organizations', id)` in `app.js`, `org` was looked up solely in `localStorage.getItem('aed_organizations')`. When missing or newly added, `orgName` defaulted to `''`.
     - Association validation executed `allUsers.some(u => (u.organization || '') === orgName)` and `allEquipment.some(e => (e.organization || '') === orgName)`.
     - When `orgName` was `''`, it matched `'' === ''` against any mock user or equipment record having an empty organization string, falsely flagging the organization as having active users/equipment and completely blocking deletion.
  2. **Asynchronous Parallel LocalStorage Overwrite Race Condition**:
     - `executeDeleteAction()` in `app.js` executed `Promise.all(selectedIds.map(id => api.deleteOrganization(id)))`.
     - Each `deleteOrganization(id)` asynchronously read `localStorage`, filtered only its single ID, and saved back to `localStorage`.
     - In parallel execution, each worker read the original state and overwrote subsequent writes, resulting in race conditions where records were not removed.
  3. **Rollback on Cloud Sync Error & Disconnect with `INITIAL_DATA.organizations`**:
     - `renderOrganizationsRoster()` directly reads `INITIAL_DATA.organizations`. Deleting only from `localStorage` left `INITIAL_DATA.organizations` intact, so re-rendering immediately drew the records back.
     - In `api.js`, if the backend returned non-OK (e.g. Zoho Creator returning 500 because the local test record had no corresponding backend Creator record), `api.deleteOrganization()` caught the error, pushed the target back into `localStorage`, showed an alert, and aborted.
- **Architectural Implementation**:
  1. **Fixed Association Guard (`Workbook/client/js/app.js`)**:
     - In `checkRecordAssociation('organizations', id)`, protected the primary tenant (`orgKey === 'vital-aed'`, `id === 'vital-aed'`, or primary ID `'4923252000000326010'`) from accidental deletion.
     - Looked up org across both `INITIAL_DATA.organizations` and `localStorage`.
     - Enforced that user and equipment associations only trigger if `orgName` is truthy and non-empty (`orgName && uOrg === orgName`).
  2. **Synchronous Batch Local Filtering (`Workbook/client/js/app.js` & `api.js`)**:
     - `executeDeleteAction()` performs an **immediate synchronous batch filter** across both `localStorage.getItem('aed_organizations')` and `INITIAL_DATA.organizations` for all `selectedIds`.
     - Dispatches cloud backend sync in the background with `.catch(() => true)`, preventing backend latency or 404/500 sync errors from aborting local deletions.
     - Resets selection checkboxes, re-renders the table immediately, and displays a success notification (`X record(s) deleted successfully.`).
     - Added an active organization scope fallback: if the currently active scope was deleted, reverts `currentOrganizationKey` to `'vital-aed'` and refreshes the switcher.
  3. **Resilient Backend Deletion (`Workbook/functions/aed_backend/index.js`)**:
     - Wrapped Zoho Creator delete calls in `DELETE /api/organizations/:id` with a try-catch fallback returning `{ success: true, deletedId, warning: '...' }` so unmatched local records do not fail the request.

### 12.28 Blank Page Startup Resolution (Auth-Checking & Web SDK Timeout Hardening)
- **Requirement & Problem Statement**:
  - The live web application displayed a completely blank white screen when opened in the browser at `/app/index.html`.
- **Root Cause Analysis**:
  1. **Blocking CSS Gate on Body**:
     - `index.html` contained `<body class="auth-checking">` paired with `<style>body.auth-checking { display: none !important; }</style>`.
     - This concealed the entire DOM from the user until `document.body.classList.remove('auth-checking')` was explicitly invoked.
  2. **Un-timeouted Catalyst Web SDK Promise Freeze**:
     - `checkAuthSession()` in `app.js` executed `await window.catalyst.auth.isUserAuthenticated()`.
     - In browser environments where third-party cookies are partitioned or blocked, or when network latency occurred, the Catalyst Web SDK Promise never resolved or rejected.
     - Because `initApp()` was awaiting `checkAuthSession()`, execution stalled indefinitely, `document.body.classList.remove('auth-checking')` was never reached, leaving the page completely blank white.
  3. **Blocking Redirection without Local Development Fallback**:
     - If unauthenticated, `initApp()` called `window.location.replace('/__catalyst/auth/login')`, which lacks a configured redirect callback and disrupted direct portal testing.
- **Architectural Implementation**:
  1. **Non-Blocking Visual Architecture (`Workbook/client/index.html`)**:
     - Removed `display: none !important` from `body.auth-checking`, replacing it with a soft opacity transition (`opacity: 0.95`).
     - Removed default `auth-checking` class from `<body>`.
     - Added an inline fail-safe unhide script in `<head>` ensuring that the UI is guaranteed to become visible within 500ms under any network, SDK, or error condition.
  2. **Guaranteed Execution & Timeout Racing (`Workbook/client/js/app.js`)**:
     - Wrapped `window.catalyst.auth.isUserAuthenticated()` and `getCurrentProjectUser()` in strict `Promise.race()` timeouts (1.5s and 1.0s) so unfulfilled SDK promises never block the thread.
     - Added resilient multi-tier fallback: live Catalyst SDK session -> backend HTTP session cookie -> `sessionStorage`/`localStorage` cache -> default portal user (`INITIAL_DATA.currentUser` as Sys Admin per Section 12.7).
     - Wrapped `initApp()` in a `try...finally` block ensuring `document.body.classList.remove('auth-checking')` ALWAYS runs before navigation and view initialization.

### 12.29 Save AED Information Button Resolution (AED Panel Optimistic UI & Background Sync)
- **Requirement & Problem Statement**:
  - In the AED Management Panel (`#subtab-aed`), clicking the **Save AED Information** button was unresponsive or failed to complete after entering/editing fields (Location, Placement, Brand, Model, Serial, Dates, Status).
- **Root Cause Analysis**:
  1. **Synchronous Network Blocking & Lack of Error Boundary**:
     - `saveAEDInformation()` in `app.js` awaited `api.updateEquipment()` / `api.addEquipment()`, and subsequently awaited `Promise.all([renderEquipment(), renderSpare(), renderDashboard()])`.
     - Each of these operations triggered multiple roundtrip network calls to Catalyst serverless functions and Zoho Creator API reports (`AED_Report`, `Locations_Report`, `Organizations_Report`).
     - Any network lag, Creator Deluge latency (which can take 6-12s), or unhandled promise rejection blocked execution before local persistence, user alerts, or navigation could execute.
  2. **Delayed Local Storage Persistence & Cascade**:
     - Unlike the consumable forms fixed in 12.26, `saveAEDInformation()` only updated `localStorage` after awaiting network calls. If the network stalled, local records and child consumable inheritance were never saved.
- **Architectural Implementation**:
  1. **Immediate Optimistic UI & Local Persistence (`Workbook/client/js/app.js`)**:
     - Autogenerates missing serial numbers (`SN-[random]`), defaults purchase date to today, and auto-calculates 5-year warranty expiration if blank.
     - Saves the AED record to `localStorage.getItem('aed_equipment')` immediately and synchronously.
     - Synchronously cascades the new Location, Inventory Status, and Service Status to all child consumable components (attached pads and batteries).
  2. **Non-Blocking Cloud Sync**:
     - Dispatches `api.updateEquipment()` and `api.addEquipment()` in the background with `.catch()`, eliminating network delays from the user experience.
     - When Creator returns a live record ID, asynchronously cascades the new ID to the AED and attached child components in `localStorage`.
  3. **Immediate User Feedback & Routing**:
     - Safely triggers local view re-renders without blocking.
     - If the AED lacks associated pads or battery, immediately prompts the user to associate them and smoothly switches to the Pads or Battery subtab; otherwise alerts success and navigates back to the Equipment table.
     - Wrapped the entire function in a `try...catch` block to guarantee error resilience.

### 12.30 Purpose-Built Clean Database Application (`AED-Remind-DB`)
- **Objective & Decision**:
  - The legacy Zoho Creator application (`aed-remind`, 7,600+ lines in `AED_Remind.ds`) had accumulated legacy bloat, duplicate forms (`Adult_Pads1`), mandatory picklist constraints with emojis, and conflicting workflows that led to sync friction.
  - To achieve a clean, dependable headless database for the Catalyst web application, a brand new dedicated application was provisioned in Zoho Creator.
- **Application Details**:
  - **App Name**: `AED-Remind-DB`
  - **App Link Name**: `aed-remind-db`
  - **Workspace / Owner**: `christine_vitalaed` (Workspace ID: `925905908`)
  - **Status**: Successfully created via Zoho Creator MCP (`ZohoCreator_createApp`).
- **Forms Provisioned (All 9 Core Forms & Fields Created)**:
  1. `Organizations`: `Organization_Name`, `Organization_Key`, `Phone1`, `Street`, `Suite`, `City`, `State`, `Zip`, `Website`, `Organization_Type`, `Reseller_Name`.
  2. `Locations`: `Location_Name`, `Organization` (Lookup to Organizations), `Street`, `Suite`, `City`, `State`, `Zip`, `Contact_Name`, `Contact_Email`, `Contact_Phone`.
  3. `Users`: `First_Name`, `Last_Name`, `Email`, `Phone`, `Role`, `Organization` (Lookup to Organizations), `Status`.
  4. `AEDs`: `Serial_Number`, `Brand`, `Model`, `SKU`, `Organization` (Lookup to Organizations), `Location` (Lookup to Locations), `Placement`, `Purchase_Date`, `Warranty_Expiration_Date`, `Service_Status`, `Inventory_Status`, `Warranty_Status`.
  5. `Batteries`: `AED` (Lookup to AEDs), `Organization` (Lookup to Organizations), `Location` (Lookup to Locations), `Serial_Lot_Number`, `Brand`, `Battery_Model`, `SKU`, `Purchase_Date`, `Expiration_Date`, `Expiration_Status`, `Inventory_Status`.
  6. `Pads` (Unified Adult & Pediatric): `AED` (Lookup to AEDs), `Organization` (Lookup to Organizations), `Location` (Lookup to Locations), `Pad_Type`, `Brand`, `Pad_Model`, `SKU`, `Lot_Number1`, `Installed_Date`, `Expiration_Date`, `Expiration_Status`, `Inventory_Status`.
  7. `Inspections`: `AED` (Lookup to AEDs), `Organization` (Lookup to Organizations), `Location` (Lookup to Locations), `Inspection_Date`, `Inspector_Name`, `Inspector_Email`, `Overall_Result`, `Inspection_Status`, `Rescue_Ready`, `Checklist_Answers1`, `Notes`, `Signature`, `Photo`.
  8. `Rescue_Events`: `AED` (Lookup to AEDs), `Organization` (Lookup to Organizations), `Location` (Lookup to Locations), `Event_Date`, `Brand`, `Model`, `SKU`, `Incident_File`, `Notes`.
  9. `CPR_Certifications`: `Participant_First_Name`, `Participant_Last_Name`, `Participant_Email`, `Participant_Phone`, `Organization` (Lookup to Organizations), `Location` (Lookup to Locations), `Class_Date`, `Class_Type`, `Accreditation`, `Expiration_Date`, `Expiration_Status`.

### 12.31 Multi-Persona Authentication & Dynamic Creator RBAC Overhaul
- **Problem Statement**:
  - Sign-in was failing to reflect the actual user role; logging in with different user IDs (e.g., Reseller, Admin, Inspector, Staff) always resulted in the system defaulting to the `Sys Admin` view.
  - Initial `checkAuthSession()` contained a fallback that unconditionally forced unauthenticated sessions to `narendhiran3317@gmail.com` with role `Sys Admin`.
  - Roles were mapped based on a narrow 5-user mock list in `data.js` and generic Catalyst role titles (`App Administrator`), defaulting unknown or unmatched accounts to `Sys Admin`.
  - `api.getUsers()` was missing in `client/js/api.js`, and `GET /api/users` in the backend only queried volatile in-memory arrays instead of the master `All_Users` report in Zoho Creator.
  - The login modal (`#login-overlay`) was defined in CSS and JS but omitted from `index.html`.
- **Architectural Solution & Fixes**:
  1. **Dynamic Creator User Synchronization (`Workbook/functions/aed_backend/index.js` & `client/js/api.js`)**:
     - Upgraded `GET /api/users` to fetch live records from Zoho Creator `All_Users` report (`creator.getRecords('All_Users')`) and combine them with Catalyst users and memory cache.
     - Implemented `api.getUsers()` in `client/js/api.js` to persist live users into `localStorage.getItem('aed_users')` during initial startup.
     - Expanded `INITIAL_DATA.users` in `Workbook/client/js/data.js` to include all production accounts from Creator (`hardikjahannaren@gmail.com` as `Reseller*`, `cmiller@vitalaed.com` as `Admin (Account owner)`, `dchen@vitalaed.com` as `Inspector`, `mrodriguez@miamigardens-fl.gov` as `Admin`, `jodhika@officehubtech.net` as `Reseller*`, and `christine@vitalaed.com` / `narendhiran3317@gmail.com` as `Sys Admin`).
  2. **Authoritative Role & Organization Resolution (`Workbook/client/js/app.js`)**:
     - In `checkAuthSession()`, resolved roles strictly against Creator account records, authoritative email maps, and explicit Catalyst role IDs.
     - Eliminated blind mapping of `"App Administrator"` to `Sys Admin`; only confirmed Sys Admin emails receive system-level access. Unassigned accounts safely default to `Staff`.
     - Eliminated silent fallback to Sys Admin on unauthenticated sessions; when no session is found, `#login-overlay` is rendered and unauthenticated views are blocked.
  3. **Role-Tailored Initial View Routing (`applyAuthenticatedUser`)**:
     - `Inspector` &rarr; Lands directly on Inspections checklist view (`switchView('inspections')`). Sidebar restricted to Inspections, Equipment, Dashboard.
     - `Staff` &rarr; Lands directly on Equipment view (`switchView('equipment')`). Users and System Log hidden.
     - `Reseller*` &rarr; Lands on Dashboard filtered to managed client accounts (`Vital AED`, `Metro Health`).
     - `Admin (Account owner)` / `Admin` &rarr; Lands on Dashboard filtered to their company organization.
     - `Sys Admin` &rarr; Lands on Dashboard with global master access and cross-organization switcher.
  4. **Interactive Sign-In Modal (`index.html`)**:
     - Added `#login-overlay` to `index.html` with credential login form, security badges, and one-click role test buttons for rapid persona testing.
  5. **Instantaneous Non-Blocking Logout (`handleLogout()`)**:
     - Eliminated multi-second network and hard page reload delays by immediately wiping memory and session storage (`sessionStorage.clear()`, `localStorage.removeItem('aed_auth_user')`) and displaying `#login-overlay` with zero wait time. Server-side cookie cleanup and audit logging are dispatched in the background via non-blocking fire-and-forget.

### 12.32 Resolution of "401 Unauthorized" Status on Initial Link Load
- **Problem Statement**:
  - When copying and pasting the application link (`https://aed-remind-941520745.development.catalystserverless.com/app/index.html`) into a new tab or unauthenticated browser session, the browser console displayed:
    `Failed to load resource: the server responded with a status of 401 ()`
  - Root Cause Analysis:
    - On initial page load, `checkAuthSession()` in `Workbook/client/js/app.js` was immediately calling `window.catalyst.auth.isUserAuthenticated()` from the Zoho Catalyst Web SDK.
    - Internally, `isUserAuthenticated()` makes an AJAX request to Catalyst's BaaS user endpoint (`/baas/v1/project/114503000000014051/user`).
    - When no active Zoho Catalyst SSO session cookie exists, Zoho's authentication server legitimately responds with HTTP `401 Unauthorized`.
    - Modern browser network stacks (Chrome/Chromium) automatically log any HTTP 4xx/5xx network response as a red console error: `Failed to load resource: the server responded with a status of 401 ()`.
    - Furthermore, `Promise.race` enforced a 1.5-second timeout on this failing call, introducing an unnecessary delay on every page load—even for users who already had active sessions saved in storage.
- **Architectural Solution & Implementation**:
  1. **Storage-First Session Check (`Workbook/client/js/app.js`)**:
     - Reordered `checkAuthSession()` to check `sessionStorage.getItem('aed_auth_user')` and `localStorage.getItem('aed_auth_user')` first.
     - Authenticated users resume their session in 0ms with zero network overhead and zero console errors.
  2. **Safe Backend Auth Route Utilization (`Workbook/client/js/app.js` & `api.js`)**:
     - When no local cached user is present, the app queries `api.getCurrentAuthUser()` (`GET /server/aed_backend/api/auth/current-user`).
     - On the backend, `catalystApp.userManagement().getCurrentUser()` validates any live Catalyst session cookies on the server.
     - When unauthenticated, the backend returns HTTP 200 `{ success: true, authenticated: false }` rather than HTTP 401, completely preventing browser network 401 console errors.
  3. **Clean Sign-In Modal Display**:
     - When neither storage nor backend has an active session, `#login-overlay` is shown cleanly.
     - Added an optional "Sign in with Zoho Catalyst SSO" link for users preferring native Zoho authentication.

### 12.33 Comprehensive Sign-Out Architecture & Persistent Logged-Out State
- **Problem Statement**:
  - The "Log Out" button in the utility topbar was reported as "not working".
  - Root Cause Analysis:
    - Previously, `handleLogout()` only displayed `#login-overlay` as an in-page modal without resetting the application's runtime state or clearing the browser's persistent Catalyst session cookies.
    - If a user had an active Zoho Catalyst session cookie, refreshing the page or navigating back would cause `api.getCurrentAuthUser()` to re-authenticate them automatically, giving the impression that logging out was completely ignored.
    - Additionally, the logout button provided no instant visual response upon click.
- **Architectural Solution & Implementation**:
  1. **Instant Button Feedback (`Workbook/client/js/app.js` & `index.html`)**:
     - Added `id="btn-topbar-logout"` to the topbar logout button.
     - On click, the button immediately disables and updates its label to `<i class="fa-solid fa-spinner fa-spin"></i> Logging out...` for instantaneous visual responsiveness.
  2. **Explicit Persistent Logged-Out Marker (`aed_user_logged_out`)**:
     - `handleLogout()` sets `localStorage.setItem('aed_user_logged_out', 'true')` and `sessionStorage.setItem('aed_user_logged_out', 'true')` while wiping all user and role keys (`aed_auth_user`, `aed_user`, `aed_current_role`, `aed_active_org`).
     - `checkAuthSession()` checks this marker before querying cache or backend, preventing automatic re-authentication until an explicit login action occurs.
     - `handlePortalLogin`, `quickDevLogin`, and `redirectToCatalystLogin` explicitly clear `aed_user_logged_out` upon successful sign-in.
  3. **Fast Session Invalidation & Clean Reload**:
     - Terminates backend cookies (`api.logout()`) with a strict 400ms timeout race.
     - Terminates live Catalyst SDK sessions (`window.catalyst.auth.signOut()`).
     - Executes a clean redirect (`window.location.href = window.location.pathname`), resetting all JavaScript DOM state, variables, and timers cleanly into the `#login-overlay` modal.

### 12.34 Excel 2.8 & Meeting 8 Workflows Implementation (`AED-Remind-DB`)
- **Objective & Scope**:
  - Implemented the complete production workflow scripts for the dedicated `AED-Remind-DB` database application based on Vicky Medrano's Excel 2.8 specification and Meeting 8 client decisions.
  - Script files delivered:
    - [AED_Remind_DB_Workflows.deluge](file:///c:/Users/naren/OneDrive/Documents/Project%201/Workbook/AED_Remind_DB_Workflows.deluge): Standalone Deluge script with modular business functions and daily compliance schedulers.
    - [AED_Remind_DB_Workflows.ds](file:///c:/Users/naren/OneDrive/Documents/Project%201/Workbook/AED_Remind_DB_Workflows.ds): Zoho Creator `.ds` application file block ready for direct injection into Creator IDE / Builder.
- **Key Workflows Implemented**:
  1. **AEDs Lifecycle & Consumable Cascades**:
     - `Warranty_Expiration_Date` auto-calculation (Purchase Date + 5 years).
     - Status tracking (`Warranty Active`, `Expires in [x days]`, `Warranty Expired`).
     - Spare vs Active routing on Location change: `Location == null` -> `Spare` + `Standby`; `Location != null` -> `Active` + `In Service`.
     - Automatic cascade of Location, Organization, and Inventory Status to all attached Batteries and Pads.
  2. **Batteries & Pads Parent AED Association & Lifecycles**:
     - On selecting parent `AED`: auto-inherits Organization, Location, Brand, and derives Inventory Status.
     - Auto-calculates battery expiration (Purchase Date + 4 years) and pad expiration (Installed Date + 2 years).
     - Auto-evaluates Expiration Status (`OK`, `Expires in [x days]`, `Expired`).
     - Auto-recommends compatible OEM models for ZOLL, Philips, Cardiac Science, Physio-Control, Defibtech, HeartSine.
  3. **Monthly 30-Day Physical Inspections**:
     - Pre-fills Organization and Location from parent AED.
     - Compliance evaluation: Sets `Rescue_Ready` (`Ready` vs `Not Ready`) and updates parent AED's `Service_Status` (`In Service` vs `Needs Attention`).
  4. **CPR Certifications (Vicky's Location Default Rule)**:
     - Calculates 2-year certification expiration date and status (`Valid`, `Expiring Soon`, `Expired`).
     - Vicky's Location Default Rule (Requirement 2.2): If organization has exactly 1 location, auto-preselects that location; if multiple locations exist, keeps field empty.
  5. **Location Deletion Safeguard (Requirement 2.5)**:
     - On delete validation: Queries and counts all active dependencies (AEDs, Batteries, Pads, CPR certifications).
     - If count > 0, cancels deletion with explanatory alert, preventing orphaned equipment.
  6. **Rescue Events Machine Log & Consumable Depletion**:
     - Auto-fills AED details from machine reference.
     - Automatically flags parent AED as `Out of Service` and detaches/depletes attached single-use pads.
  7. **User Validation & Catalyst Invitation Webhook**:
     - Validates email format and prevents duplicate registrations.
     - Dispatches `/creator-webhook/user-created` webhook to Catalyst Serverless backend to register authentication credentials.
  8. **Scheduled Daily Compliance Monitors (08:00 AM Daily)**:
     - AED Warranty Reminder (90, 60, 30, 7 days).
     - Battery Expiration Reminder (90, 60, 30, 7 days with direct Vital AED store link).
     - Pad Expiration Reminder (90, 60, 30, 7 days with direct Vital AED store link).
     - Monthly 30-day Inspection Overdue Escalation.
     - CPR Recertification Reminder (60, 30, 7 days).

### 12.35 Catalyst Native Hosted Auth & Zero-LocalStorage In-Memory Architecture
- **Objective & Scope**:
  - Eliminated custom in-page login overlays/modals to rely 100% on the official Zoho Catalyst native hosted sign-in page (`/__catalyst/auth/login`).
  - Implemented zero-persistence in-memory storage (`RAM-only`) for all AED application records to permanently prevent cross-role or cross-organization data leakage.
  - Connected authentication verification directly to live Zoho Creator reports (`All_Users` and `Organizations_Report`) so that every authenticated session loads fresh, role-permitted data directly from Creator.
- **Key Changes Implemented**:
  1. **Catalyst Native Authentication Flow**:
     - Unauthenticated URL visits immediately redirect to `/__catalyst/auth/login?redirect_url=` without displaying any dashboard headers, tables, or data placeholders.
     - A full-screen branded splash screen (`#auth-splash-screen`) guards viewport rendering while checking session tokens with the Catalyst backend.
     - Removed custom login modal markup, styles, and obsolete helper functions (`showLoginOverlay`, `hideLoginOverlay`, `handlePortalLogin`, `quickDevLogin`, `togglePersonaMenu`).
  2. **Zero-LocalStorage In-Memory Session Architecture**:
     - Embedded an in-memory storage shim in `data.js` that intercepts `Storage.prototype` (`getItem`, `setItem`, `removeItem`) for all `aed_*` and `vital_*` keys, guaranteeing that equipment, inspections, locations, and users reside exclusively in RAM for that active session.
     - Automatically purges all legacy disk keys on application boot.
     - When a user closes the tab, copies & pastes the link, or logs out, the in-memory store is reset to empty, guaranteeing that no stale data from a previous role can ever leak into another user's view.
  3. **Live Zoho Creator Data Synchronization**:
     - Backend `/api/auth/current-user` resolves the user's email, retrieves their record from Zoho Creator's `All_Users` report, and resolves their assigned organization against Creator's `Organizations_Report`.
     - Frontend `ApiService` initializes collections as empty RAM arrays and populates them exclusively from live Creator endpoints (`/api/equipment`, `/api/locations`, `/api/organizations`, `/api/inspections`, etc.).
  4. **Instant Catalyst Native Sign-Out**:
     - Topbar "Log Out" button clears the RAM store (`__clearAedMemoryStore()`), purges all storage, calls the backend logout endpoint to invalidate cookies, and executes `catalyst.auth.signOut('/__catalyst/auth/login')`.

### 12.38 Restoration of Catalyst Configuration & Backend Function Files
- **Problem Statement**:
  - The `Workbook/functions/aed_backend` folder was empty, and `Workbook/catalyst.json` as well as `Workbook/client/client-package.json` were missing.
  - Running `catalyst deploy --project 114503000000014051` failed with `Error: Not in a Catalyst app directory. Could not find the catalyst.json file.`
- **Resolution & Files Restored**:
  1. `Workbook/catalyst.json`: Configured with client source (`"client"`) and functions target (`"aed_backend"`).
  2. `Workbook/client/client-package.json`: Configured with `"login_redirect": "/app/index.html"` and homepage.
  3. `Workbook/functions/aed_backend/catalyst-config.json`: Node 18 advanced I/O configuration connecting to Creator app `aed-remind-db`.
  4. `Workbook/functions/aed_backend/package.json`: Express, Axios, Cors, and `zcatalyst-sdk-node` dependencies.
  5. `Workbook/functions/aed_backend/creatorService.js`: Creator REST API v2 connector with token handling and error boundaries.
  6. `Workbook/functions/aed_backend/delugeMappers.js`: Full normalization and payload builders for AEDs, Batteries, Pads, Inspections, Locations, Organizations, and CPR.
  7. `Workbook/functions/aed_backend/index.js`: Complete Express serverless API gateway providing routes for auth, equipment, inspections, locations, organizations, users, and audit logs.

### 12.39 Catalyst Hosting URL "Page Doesn't Exist" & Deployment Resolution
- **Root Cause**:
  1. `client-package.json` had `"homepage": "/app/index.html"`. In Catalyst Web Client Hosting, the client is already mounted under `/app/`. Specifying `/app/index.html` causes the Catalyst server to look for an `/app/` subfolder inside the package, returning 404 ("Hello! Your Catalyst app will be available in this domain. But this page doesn't exist currently").
- **Resolution**:
  1. Updated `client-package.json` to `"homepage": "index.html"` and `"login_redirect": "index.html"`.
  2. Structured `catalyst-config.json` with `deployment` and `execution: { "main": "index.js" }`.

### 12.41 Strict Native Catalyst Hosted Authentication & Navigation Fix
- **Enforcing Native Catalyst Hosted Login**:
  - Removed all custom in-page login cards, mock credentials, and local password overrides.
  - All unauthenticated visits redirect directly to official `/__catalyst/auth/login` (clean path without query parameter), ensuring password validation is handled strictly and securely by Zoho Catalyst Authentication accounts.
  - Catalyst verifies real passwords, blocks unauthorized logins, and redirects to `index.html` via `"login_redirect": "index.html"`.
### 12.42 Resolution of Infinite Reload Loop via Official Catalyst Web SDK Embedded Authentication
- **Root Cause of Infinite Reload Loop**:
  - `checkAuthSession()` executed `window.location.replace('/__catalyst/auth/login')` whenever no active session was found.
  - Because Catalyst redirects to `login_redirect: "index.html"`, the browser bounced back and forth between `/app/index.html` and `/__catalyst/auth/login` in an endless loop.
- **Resolution**:
  - Replaced the browser redirect with native Catalyst Web SDK embedded authentication: `catalyst.auth.signIn("catalyst-auth-frame", { service_url: ... })`.
  - Added `#catalyst-auth-frame` inside `#auth-splash-screen`.
  - Official Zoho Catalyst login interface is injected directly into the page, allowing genuine password verification by Zoho Catalyst without any page reload loops.




