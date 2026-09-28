# 🏠 Bachelor Expense Manager

A modern, high-performance **SplitWise-style expense manager & flat bill generator** built specifically for bachelor roommates:
1. **Shivam Kumar**
2. **Rishu Kumar**
3. **Raj Kumar**
*(plus dynamic support for adding 4th, 5th, or any number of flatmates!)*

---

## 🚀 Key Features

### 1. 👥 Multi-Roommate Live Sync & Network Access
* **Full Operating Backend**: Zero external dependencies! Runs on Node.js standard library with built-in SQLite (`node:sqlite`).
* **Connected for All Bachelors**: Accessible from any phone or laptop on the flat Wi-Fi / Local Network (`http://<your-ip>:3001` or `http://localhost:3001`).
* **QR Code & Share Link**: Click the **"Wi-Fi Sync"** badge in the header to view or scan the instant mobile connection QR code.
* **Auto Live Sync**: Automatically syncs expenses and balances across all roommate devices in real time.

### 2. ⚡ Flat Rent & Electricity Bill (Strict Single A4 Page Print)
* Dedicated **Flat Rent & Electricity Calculator** (replaces monthly budget).
* **BESCOM Electricity Meter Calculation**:
  * Previous meter reading
  * Current meter reading
  * Units consumed
  * **Tariff rate preset to ₹8.00 / unit**
  * Auto-calculated electricity total
* Water bill, WiFi broadband, LPG gas cylinder, and maintenance charges.
* **Print Bill (Strict Single A4 Page)**:
  * Formatted with custom `@page { size: A4 portrait; margin: 10mm 12mm; }`
  * Guaranteed **zero spillover to a second page**.
  * Contains flat address, meter readings, itemized breakdown table, equal roommate split ratio, and tenant/owner signature blocks.
* **"Post as Monthly Expenses"**: One-click posting of Rent & Electricity directly into the expense ledger.

### 3. 🤝 Settle Up & Who Owes Whom (Mathematically Exact)
* **Greedy Debt Minimization Algorithm**: Computes exact net balances and pairs debtors with creditors to minimize transactions.
* **One-Click "Settle Up"**: Record payments (UPI / Cash / NetBanking) to immediately update balances.
* **Settlement History Log**: Complete audit trail of past payments.
* **Reset Settlement History**: Clear past settlement records and recompute raw balances at any time.

### 4. 📅 3-Year Monthly Expenditure Archive
* **Long-Term Financial Storage**: Stores all expenses across 3+ full years (e.g. 2024, 2025, 2026, 2027).
* **Multi-Year Selector**: Switch between years with one click.
* **12-Month Grid**: Cards for every month showing total spent, transaction count, and quick "Jump to Month" button.
* **12-Month Expense Trend Chart**: Visual trajectory of flat spending throughout the year.

### 5. ➕ Dynamic Roommate Management
* Add new flatmates (e.g. 4th, 5th roommate) with custom avatars and profile colors.
* Equal share calculations automatically and dynamically adjust across all active roommates.

### 6. 🗑️ Clean Reset Controls (No WhatsApp Button)
* **Reset Month Button**: Clear all expenses for the selected month with safety confirmation.
* **Profile Drawer Reset**: Quick month reset button in the profile column.
* **Reset Settlement History**: Reset settled transactions.
* **Export JSON Backup**: Download complete database backup.
* *WhatsApp summary button has been permanently removed as requested.*

---

## 🛠️ Quick Start Guide

### Start the Server:
```bash
node server.js
# OR
npm start
```

### Access the Web App:
* **On your laptop**: Open `http://localhost:3001`
* **On Roommates' Phones (Same Wi-Fi)**: Open `http://<your-lan-ip>:3001` (e.g. `http://192.168.1.15:3001` or `http://10.230.121.108:3001`)

---

## 🗄️ Database Architecture
* SQLite database file: `bachelor_expenses.db`
* Tables:
  * `roommates`: ID, name, phone, color, avatar, active
  * `expenses`: ID, title, category, amount, paid_by_id, split_among_ids, expense_date, notes
  * `settlements`: ID, payer_id, receiver_id, amount, settlement_date, payment_method, notes
  * `rent_bills`: ID, month_year, flat_rent, prev_reading, curr_reading, unit_rate (₹8), water_bill, wifi_bill, gas_bill, other_charges, flat_address, meter_no
