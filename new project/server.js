const http = require('node:http');
const net = require('node:net');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'bachelor_expenses.db');
const PUBLIC_DIR = path.join(__dirname, 'public');

// Ensure database directory exists (for cloud persistent volumes)
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize SQLite database
const db = new DatabaseSync(DB_PATH);

function initDb() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roommates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      color TEXT DEFAULT '#6366f1',
      avatar TEXT DEFAULT 'BM',
      active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      category TEXT NOT NULL,
      amount REAL NOT NULL,
      paid_by_id INTEGER NOT NULL,
      split_among_ids TEXT NOT NULL,
      expense_date TEXT NOT NULL,
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settlements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      payer_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      settlement_date TEXT NOT NULL,
      payment_method TEXT DEFAULT 'UPI',
      notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS rent_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      month_year TEXT NOT NULL UNIQUE,
      flat_rent REAL NOT NULL DEFAULT 12000,
      prev_reading REAL NOT NULL DEFAULT 1020,
      curr_reading REAL NOT NULL DEFAULT 1208,
      unit_rate REAL NOT NULL DEFAULT 8.0,
      water_bill REAL NOT NULL DEFAULT 0,
      wifi_bill REAL NOT NULL DEFAULT 0,
      gas_bill REAL NOT NULL DEFAULT 0,
      other_charges REAL NOT NULL DEFAULT 0,
      flat_address TEXT DEFAULT 'Flat #304, Sunshine Residency, 1st Cross, HSR Layout, Bengaluru',
      meter_no TEXT DEFAULT 'BESCOM-KA-7821',
      landlord_name TEXT DEFAULT 'Ramesh Sharma',
      notes TEXT DEFAULT 'Rent & Electricity bill split equally among all roommates.',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Seed default roommates if table is empty
  const countRoommates = db.prepare('SELECT COUNT(*) as cnt FROM roommates').get().cnt;
  if (countRoommates === 0) {
    const insertRm = db.prepare('INSERT INTO roommates (name, phone, color, avatar, active) VALUES (?, ?, ?, ?, 1)');
    insertRm.run('Shivam Kumar', '+91 98765 43210', '#4f46e5', 'SK');
    insertRm.run('Rishu Kumar', '+91 98765 43211', '#059669', 'RK');
    insertRm.run('Raj Kumar', '+91 98765 43212', '#d97706', 'RJ');
    console.log('Seeded initial 3 roommates: Shivam Kumar, Rishu Kumar, Raj Kumar');
  }

  // Seed default sample expenses matching user prompt example if empty
  const countExpenses = db.prepare('SELECT COUNT(*) as cnt FROM expenses').get().cnt;
  if (countExpenses === 0) {
    const rms = db.prepare('SELECT id, name FROM roommates ORDER BY id ASC').all();
    const shivam = rms.find(r => r.name.includes('Shivam')) || rms[0];
    const rishu = rms.find(r => r.name.includes('Rishu')) || rms[1];
    const raj = rms.find(r => r.name.includes('Raj')) || rms[2];

    const today = new Date();
    const curYear = today.getFullYear();
    const curMonth = String(today.getMonth() + 1).padStart(2, '0');
    const ymd = (d) => `${curYear}-${curMonth}-${String(d).padStart(2, '0')}`;
    const allIds = JSON.stringify([shivam.id, rishu.id, raj.id]);

    const insExp = db.prepare(`
      INSERT INTO expenses (title, category, amount, paid_by_id, split_among_ids, expense_date, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);

    // Matching user example:
    // Total = 24,000. Shivam paid 12,000; Rishu paid 6,000; Raj paid 6,000.
    // Equal Share = 8,000 each.
    // Rishu owes Shivam 2,000; Raj owes Shivam 2,000.
    insExp.run('Flat Rent - Monthly', 'Flat Rent', 12000, shivam.id, allIds, ymd(1), 'Flat monthly rent paid via NetBanking');
    insExp.run('Electricity Bill (188 units @ ₹8)', 'Electricity Bill', 1500, rishu.id, allIds, ymd(5), 'Meter bill settled online');
    insExp.run('WiFi / High-Speed Broadband', 'WiFi/Internet', 800, raj.id, allIds, ymd(3), 'Airtel Fiber 100 Mbps');
    insExp.run('Monthly Grocery Mart', 'Grocery', 4500, rishu.id, allIds, ymd(8), 'Rice, Dal, Atta, Masala from D-Mart');
    insExp.run('Fresh Farm Vegetables', 'Vegetables', 1500, raj.id, allIds, ymd(10), 'Sabzi mandi weekly buy');
    insExp.run('Mother Dairy Milk (Monthly)', 'Milk', 1200, raj.id, allIds, ymd(12), 'Daily 1L toned milk');
    insExp.run('Indane Gas Cylinder Refill', 'Gas Cylinder', 1100, raj.id, allIds, ymd(14), 'LPG commercial refill');
    insExp.run('House Cleaning & Miscellaneous', 'Miscellaneous Expenses', 1400, raj.id, allIds, ymd(16), 'Mop, Harpic, garbage bags & snacks');

    console.log('Seeded sample bachelor expenses totalling ₹24,000 matching user example');

    // Seed rent bill for current month
    const curMonthYear = `${curYear}-${curMonth}`;
    const insRent = db.prepare(`
      INSERT OR IGNORE INTO rent_bills (month_year, flat_rent, prev_reading, curr_reading, unit_rate, water_bill, wifi_bill, gas_bill, other_charges)
      VALUES (?, 12000, 1020, 1208, 8.0, 300, 800, 1100, 0)
    `);
    insRent.run(curMonthYear);
  }
}

initDb();

// Helper to get local network IP addresses
function getNetworkIps() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address);
      }
    }
  }
  return ips;
}

// Debt Simplification Algorithm
function computeDebtSettlements(roommates, expenses, settlements) {
  // Map of roommate id -> { id, name, paid, share, net }
  const balanceMap = {};
  for (const rm of roommates) {
    balanceMap[rm.id] = {
      id: rm.id,
      name: rm.name,
      color: rm.color,
      avatar: rm.avatar,
      paid: 0,
      share: 0,
      settlementPaid: 0,
      settlementReceived: 0,
      net: 0
    };
  }

  // 1. Calculate expense payments and shares
  for (const exp of expenses) {
    const amount = Number(exp.amount) || 0;
    const payerId = exp.paid_by_id;

    if (balanceMap[payerId]) {
      balanceMap[payerId].paid += amount;
    }

    let splitIds = [];
    try {
      splitIds = typeof exp.split_among_ids === 'string' ? JSON.parse(exp.split_among_ids) : exp.split_among_ids;
    } catch {
      splitIds = roommates.map(r => r.id);
    }
    if (!Array.isArray(splitIds) || splitIds.length === 0) {
      splitIds = roommates.map(r => r.id);
    }

    const perPersonShare = amount / splitIds.length;
    for (const sId of splitIds) {
      if (balanceMap[sId]) {
        balanceMap[sId].share += perPersonShare;
      }
    }
  }

  // 2. Account for settlements already recorded
  for (const set of settlements) {
    const amount = Number(set.amount) || 0;
    if (balanceMap[set.payer_id]) {
      balanceMap[set.payer_id].settlementPaid += amount;
    }
    if (balanceMap[set.receiver_id]) {
      balanceMap[set.receiver_id].settlementReceived += amount;
    }
  }

  // 3. Compute Net Balance for each roommate:
  // net = (paid - share) + (settlementPaid - settlementReceived)
  // Positive = person is owed money (creditor)
  // Negative = person owes money (debtor)
  for (const id in balanceMap) {
    const b = balanceMap[id];
    b.net = Math.round(((b.paid - b.share) + (b.settlementPaid - b.settlementReceived)) * 100) / 100;
    b.paid = Math.round(b.paid * 100) / 100;
    b.share = Math.round(b.share * 100) / 100;
  }

  // 4. Greedy Debt Minimization Algorithm
  const debtors = [];
  const creditors = [];

  for (const id in balanceMap) {
    const b = balanceMap[id];
    if (b.net < -0.01) {
      debtors.push({ id: b.id, name: b.name, color: b.color, amount: Math.abs(b.net) });
    } else if (b.net > 0.01) {
      creditors.push({ id: b.id, name: b.name, color: b.color, amount: b.net });
    }
  }

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const debts = [];
  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];
    const minAmount = Math.min(debtor.amount, creditor.amount);

    if (minAmount > 0.01) {
      debts.push({
        fromId: debtor.id,
        fromName: debtor.name,
        fromColor: debtor.color,
        toId: creditor.id,
        toName: creditor.name,
        toColor: creditor.color,
        amount: Math.round(minAmount * 100) / 100
      });
    }

    debtor.amount -= minAmount;
    creditor.amount -= minAmount;

    if (debtor.amount <= 0.01) dIdx++;
    if (creditor.amount <= 0.01) cIdx++;
  }

  return {
    balances: Object.values(balanceMap),
    debts
  };
}

let actualPort = parseInt(process.env.PORT, 10) || 3000;

// Request Body Parser helper
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 5 * 1024 * 1024) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Send JSON response helper
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// MIME Types Map
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

// HTTP Server
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    return res.end();
  }

  const urlObj = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = urlObj.pathname;

  try {
    // ----------------------------------------------------
    // API ROUTES
    // ----------------------------------------------------
    if (pathname.startsWith('/api/')) {
      // 1. Network Info
      if (pathname === '/api/network-info' && req.method === 'GET') {
        const ips = getNetworkIps();
        return sendJson(res, 200, {
          hostname: os.hostname(),
          port: actualPort,
          ips,
          localUrl: `http://localhost:${actualPort}`,
          networkUrls: ips.map(ip => `http://${ip}:${actualPort}`)
        });
      }

      // 2. Roommates API
      if (pathname === '/api/roommates') {
        if (req.method === 'GET') {
          const rows = db.prepare('SELECT * FROM roommates ORDER BY id ASC').all();
          return sendJson(res, 200, rows);
        }
        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (!body.name || !body.name.trim()) {
            return sendJson(res, 400, { error: 'Roommate name is required' });
          }
          const name = body.name.trim();
          const phone = body.phone ? body.phone.trim() : '';
          const color = body.color || '#6366f1';
          const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'RM';
          const avatar = body.avatar || initials;

          const stmt = db.prepare('INSERT INTO roommates (name, phone, color, avatar, active) VALUES (?, ?, ?, ?, 1)');
          const info = stmt.run(name, phone, color, avatar);
          const newRoommate = db.prepare('SELECT * FROM roommates WHERE id = ?').get(info.lastInsertRowid);
          return sendJson(res, 201, newRoommate);
        }
      }

      if (pathname.startsWith('/api/roommates/') && req.method === 'PUT') {
        const id = parseInt(pathname.split('/')[3], 10);
        const body = await parseBody(req);
        const rm = db.prepare('SELECT * FROM roommates WHERE id = ?').get(id);
        if (!rm) return sendJson(res, 404, { error: 'Roommate not found' });

        const name = body.name !== undefined ? body.name.trim() : rm.name;
        const phone = body.phone !== undefined ? body.phone.trim() : rm.phone;
        const color = body.color !== undefined ? body.color : rm.color;
        const active = body.active !== undefined ? (body.active ? 1 : 0) : rm.active;
        const avatar = body.avatar !== undefined ? body.avatar : rm.avatar;

        db.prepare('UPDATE roommates SET name = ?, phone = ?, color = ?, active = ?, avatar = ? WHERE id = ?')
          .run(name, phone, color, active, avatar, id);

        const updated = db.prepare('SELECT * FROM roommates WHERE id = ?').get(id);
        return sendJson(res, 200, updated);
      }

      if (pathname.startsWith('/api/roommates/') && req.method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        // Ensure at least 2 active roommates remain
        const totalActive = db.prepare('SELECT COUNT(*) as cnt FROM roommates WHERE active = 1').get().cnt;
        if (totalActive <= 2) {
          return sendJson(res, 400, { error: 'Cannot delete. At least 2 active roommates are required for expense splitting.' });
        }
        // Soft delete or de-activate
        db.prepare('UPDATE roommates SET active = 0 WHERE id = ?').run(id);
        return sendJson(res, 200, { success: true, message: 'Roommate deactivated' });
      }

      // 3. Expenses API
      if (pathname === '/api/expenses') {
        if (req.method === 'GET') {
          const month = urlObj.searchParams.get('month'); // YYYY-MM
          const category = urlObj.searchParams.get('category');
          const paidBy = urlObj.searchParams.get('paid_by');
          const search = urlObj.searchParams.get('search');

          let query = `
            SELECT e.*, r.name as paid_by_name, r.color as paid_by_color, r.avatar as paid_by_avatar
            FROM expenses e
            LEFT JOIN roommates r ON e.paid_by_id = r.id
            WHERE 1=1
          `;
          const params = [];

          if (month) {
            query += ` AND e.expense_date LIKE ?`;
            params.push(`${month}%`);
          }
          if (category && category !== 'All') {
            query += ` AND e.category = ?`;
            params.push(category);
          }
          if (paidBy && paidBy !== 'All') {
            query += ` AND e.paid_by_id = ?`;
            params.push(parseInt(paidBy, 10));
          }
          if (search) {
            query += ` AND (e.title LIKE ? OR e.notes LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
          }

          query += ` ORDER BY e.expense_date DESC, e.id DESC`;

          const rows = db.prepare(query).all(...params);
          return sendJson(res, 200, rows);
        }

        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (!body.title || !body.title.trim()) {
            return sendJson(res, 400, { error: 'Expense title is required' });
          }
          const amount = parseFloat(body.amount);
          if (isNaN(amount) || amount <= 0) {
            return sendJson(res, 400, { error: 'Valid amount greater than 0 is required' });
          }
          if (!body.paid_by_id) {
            return sendJson(res, 400, { error: 'Payer must be selected' });
          }

          const title = body.title.trim();
          const category = body.category || 'Miscellaneous Expenses';
          const paidById = parseInt(body.paid_by_id, 10);
          const splitAmong = Array.isArray(body.split_among_ids) && body.split_among_ids.length > 0
            ? JSON.stringify(body.split_among_ids.map(Number))
            : JSON.stringify(db.prepare('SELECT id FROM roommates WHERE active = 1').all().map(r => r.id));
          const expenseDate = body.expense_date || new Date().toISOString().slice(0, 10);
          const notes = body.notes ? body.notes.trim() : '';

          const stmt = db.prepare(`
            INSERT INTO expenses (title, category, amount, paid_by_id, split_among_ids, expense_date, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);
          const info = stmt.run(title, category, amount, paidById, splitAmong, expenseDate, notes);
          const newExp = db.prepare(`
            SELECT e.*, r.name as paid_by_name, r.color as paid_by_color, r.avatar as paid_by_avatar
            FROM expenses e
            LEFT JOIN roommates r ON e.paid_by_id = r.id
            WHERE e.id = ?
          `).get(info.lastInsertRowid);

          return sendJson(res, 201, newExp);
        }
      }

      // Expense by ID: PUT, DELETE
      if (pathname.startsWith('/api/expenses/') && !pathname.endsWith('/reset-month')) {
        const id = parseInt(pathname.split('/')[3], 10);
        if (req.method === 'PUT') {
          const body = await parseBody(req);
          const exp = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id);
          if (!exp) return sendJson(res, 404, { error: 'Expense not found' });

          const title = body.title !== undefined ? body.title.trim() : exp.title;
          const category = body.category !== undefined ? body.category : exp.category;
          const amount = body.amount !== undefined ? parseFloat(body.amount) : exp.amount;
          const paidById = body.paid_by_id !== undefined ? parseInt(body.paid_by_id, 10) : exp.paid_by_id;
          const splitAmong = body.split_among_ids !== undefined
            ? JSON.stringify(body.split_among_ids.map(Number))
            : exp.split_among_ids;
          const expenseDate = body.expense_date !== undefined ? body.expense_date : exp.expense_date;
          const notes = body.notes !== undefined ? body.notes.trim() : exp.notes;

          db.prepare(`
            UPDATE expenses
            SET title = ?, category = ?, amount = ?, paid_by_id = ?, split_among_ids = ?, expense_date = ?, notes = ?
            WHERE id = ?
          `).run(title, category, amount, paidById, splitAmong, expenseDate, notes, id);

          const updated = db.prepare(`
            SELECT e.*, r.name as paid_by_name, r.color as paid_by_color, r.avatar as paid_by_avatar
            FROM expenses e
            LEFT JOIN roommates r ON e.paid_by_id = r.id
            WHERE e.id = ?
          `).get(id);

          return sendJson(res, 200, updated);
        }

        if (req.method === 'DELETE') {
          db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
          return sendJson(res, 200, { success: true, message: 'Expense deleted successfully' });
        }
      }

      // Reset Month Expenses Endpoint
      if (pathname === '/api/expenses/reset-month' && req.method === 'POST') {
        const body = await parseBody(req);
        if (!body.month) {
          return sendJson(res, 400, { error: 'Month (YYYY-MM) is required to reset' });
        }
        const monthPattern = `${body.month}%`;
        const count = db.prepare('SELECT COUNT(*) as cnt FROM expenses WHERE expense_date LIKE ?').get(monthPattern).cnt;
        db.prepare('DELETE FROM expenses WHERE expense_date LIKE ?').run(monthPattern);
        return sendJson(res, 200, {
          success: true,
          message: `Cleared ${count} expenses for month ${body.month}`,
          deletedCount: count
        });
      }

      // 4. Settlements API
      if (pathname === '/api/settlements') {
        if (req.method === 'GET') {
          const rows = db.prepare(`
            SELECT s.*,
              p.name as payer_name, p.color as payer_color, p.avatar as payer_avatar,
              r.name as receiver_name, r.color as receiver_color, r.avatar as receiver_avatar
            FROM settlements s
            LEFT JOIN roommates p ON s.payer_id = p.id
            LEFT JOIN roommates r ON s.receiver_id = r.id
            ORDER BY s.settlement_date DESC, s.id DESC
          `).all();
          return sendJson(res, 200, rows);
        }

        if (req.method === 'POST') {
          const body = await parseBody(req);
          const payerId = parseInt(body.payer_id, 10);
          const receiverId = parseInt(body.receiver_id, 10);
          const amount = parseFloat(body.amount);

          if (!payerId || !receiverId || payerId === receiverId) {
            return sendJson(res, 400, { error: 'Invalid payer or receiver' });
          }
          if (isNaN(amount) || amount <= 0) {
            return sendJson(res, 400, { error: 'Valid settlement amount greater than 0 is required' });
          }

          const settlementDate = body.settlement_date || new Date().toISOString().slice(0, 10);
          const paymentMethod = body.payment_method || 'UPI';
          const notes = body.notes ? body.notes.trim() : 'Settled debt';

          const stmt = db.prepare(`
            INSERT INTO settlements (payer_id, receiver_id, amount, settlement_date, payment_method, notes)
            VALUES (?, ?, ?, ?, ?, ?)
          `);
          const info = stmt.run(payerId, receiverId, amount, settlementDate, paymentMethod, notes);

          const newSet = db.prepare(`
            SELECT s.*,
              p.name as payer_name, p.color as payer_color, p.avatar as payer_avatar,
              r.name as receiver_name, r.color as receiver_color, r.avatar as receiver_avatar
            FROM settlements s
            LEFT JOIN roommates p ON s.payer_id = p.id
            LEFT JOIN roommates r ON s.receiver_id = r.id
            WHERE s.id = ?
          `).get(info.lastInsertRowid);

          return sendJson(res, 201, newSet);
        }
      }

      if (pathname.startsWith('/api/settlements/') && req.method === 'DELETE') {
        const id = parseInt(pathname.split('/')[3], 10);
        db.prepare('DELETE FROM settlements WHERE id = ?').run(id);
        return sendJson(res, 200, { success: true, message: 'Settlement record deleted' });
      }

      // Reset All Settlements Endpoint
      if (pathname === '/api/settlements/reset' && req.method === 'POST') {
        db.prepare('DELETE FROM settlements').run();
        return sendJson(res, 200, { success: true, message: 'All settlement history has been reset successfully' });
      }

      // 5. Rent & Electricity Bills API
      if (pathname === '/api/rent-bills') {
        if (req.method === 'GET') {
          const monthYear = urlObj.searchParams.get('month') || new Date().toISOString().slice(0, 7);
          let bill = db.prepare('SELECT * FROM rent_bills WHERE month_year = ?').get(monthYear);
          if (!bill) {
            // Provide default template with previous month's ending reading if available
            const prevBill = db.prepare('SELECT curr_reading FROM rent_bills ORDER BY month_year DESC LIMIT 1').get();
            const prevReading = prevBill ? prevBill.curr_reading : 1000;
            bill = {
              id: null,
              month_year: monthYear,
              flat_rent: 12000,
              prev_reading: prevReading,
              curr_reading: prevReading + 180,
              unit_rate: 8.0,
              water_bill: 300,
              wifi_bill: 800,
              gas_bill: 0,
              other_charges: 0,
              flat_address: 'Flat #304, Sunshine Residency, 1st Cross, HSR Layout, Bengaluru',
              meter_no: 'BESCOM-KA-7821',
              landlord_name: 'Ramesh Sharma',
              notes: 'Monthly Bachelor Flat Rent & BESCOM Electricity Bill @ ₹8 per unit.'
            };
          }
          return sendJson(res, 200, bill);
        }

        if (req.method === 'POST') {
          const body = await parseBody(req);
          if (!body.month_year) {
            return sendJson(res, 400, { error: 'Month-Year is required' });
          }

          const monthYear = body.month_year;
          const flatRent = parseFloat(body.flat_rent) || 0;
          const prevReading = parseFloat(body.prev_reading) || 0;
          const currReading = parseFloat(body.curr_reading) || 0;
          const unitRate = parseFloat(body.unit_rate) !== undefined ? parseFloat(body.unit_rate) : 8.0;
          const waterBill = parseFloat(body.water_bill) || 0;
          const wifiBill = parseFloat(body.wifi_bill) || 0;
          const gasBill = parseFloat(body.gas_bill) || 0;
          const otherCharges = parseFloat(body.other_charges) || 0;
          const flatAddress = body.flat_address || '';
          const meterNo = body.meter_no || '';
          const landlordName = body.landlord_name || '';
          const notes = body.notes || '';

          const existing = db.prepare('SELECT id FROM rent_bills WHERE month_year = ?').get(monthYear);
          if (existing) {
            db.prepare(`
              UPDATE rent_bills
              SET flat_rent = ?, prev_reading = ?, curr_reading = ?, unit_rate = ?,
                  water_bill = ?, wifi_bill = ?, gas_bill = ?, other_charges = ?,
                  flat_address = ?, meter_no = ?, landlord_name = ?, notes = ?
              WHERE id = ?
            `).run(flatRent, prevReading, currReading, unitRate, waterBill, wifiBill, gasBill, otherCharges, flatAddress, meterNo, landlordName, notes, existing.id);
          } else {
            db.prepare(`
              INSERT INTO rent_bills
              (month_year, flat_rent, prev_reading, curr_reading, unit_rate, water_bill, wifi_bill, gas_bill, other_charges, flat_address, meter_no, landlord_name, notes)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(monthYear, flatRent, prevReading, currReading, unitRate, waterBill, wifiBill, gasBill, otherCharges, flatAddress, meterNo, landlordName, notes);
          }

          const savedBill = db.prepare('SELECT * FROM rent_bills WHERE month_year = ?').get(monthYear);
          return sendJson(res, 200, savedBill);
        }
      }

      // 6. Summary & Settlement Calculations API
      if (pathname === '/api/summary') {
        const month = urlObj.searchParams.get('month'); // YYYY-MM
        const roommates = db.prepare('SELECT * FROM roommates WHERE active = 1 ORDER BY id ASC').all();

        let expenses;
        if (month) {
          expenses = db.prepare('SELECT * FROM expenses WHERE expense_date LIKE ?').all(`${month}%`);
        } else {
          expenses = db.prepare('SELECT * FROM expenses').all();
        }

        const settlements = db.prepare('SELECT * FROM settlements').all();

        // Total expenses
        let totalExpense = 0;
        const categoryMap = {};

        for (const exp of expenses) {
          const amt = Number(exp.amount) || 0;
          totalExpense += amt;
          categoryMap[exp.category] = (categoryMap[exp.category] || 0) + amt;
        }

        // Compute balances and simplified debts
        const { balances, debts } = computeDebtSettlements(roommates, expenses, settlements);

        return sendJson(res, 200, {
          month: month || 'All Time',
          totalExpense: Math.round(totalExpense * 100) / 100,
          roommateCount: roommates.length,
          equalPerPersonShare: roommates.length > 0 ? Math.round((totalExpense / roommates.length) * 100) / 100 : 0,
          categoryBreakdown: categoryMap,
          balances,
          whoOwesWhom: debts,
          settlementsCount: settlements.length
        });
      }

      // 7. Multi-Year Expenditure Archive API (3+ Years)
      if (pathname === '/api/multi-year-summary') {
        const currentYear = new Date().getFullYear();
        // Support selected 3 years range (e.g. currentYear, currentYear-1, currentYear-2)
        const yearParam = parseInt(urlObj.searchParams.get('year'), 10) || currentYear;
        const years = [yearParam - 2, yearParam - 1, yearParam];

        const allExpenses = db.prepare('SELECT * FROM expenses').all();
        const roommates = db.prepare('SELECT id, name, color FROM roommates').all();

        // Generate full monthly breakdown for each of the 3 years
        const yearsData = {};

        for (const yr of years) {
          yearsData[yr] = {
            year: yr,
            totalYearExpense: 0,
            months: []
          };

          for (let m = 1; m <= 12; m++) {
            const mStr = String(m).padStart(2, '0');
            const ym = `${yr}-${mStr}`;
            const monthExpenses = allExpenses.filter(e => e.expense_date.startsWith(ym));

            const total = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
            yearsData[yr].totalYearExpense += total;

            // Categories breakdown for this month
            const catMap = {};
            const payerMap = {};
            for (const exp of monthExpenses) {
              catMap[exp.category] = (catMap[exp.category] || 0) + Number(exp.amount);
              payerMap[exp.paid_by_id] = (payerMap[exp.paid_by_id] || 0) + Number(exp.amount);
            }

            yearsData[yr].months.push({
              month: ym,
              monthIndex: m,
              monthName: new Date(yr, m - 1, 1).toLocaleString('default', { month: 'short' }),
              totalExpense: Math.round(total * 100) / 100,
              expenseCount: monthExpenses.length,
              categories: catMap,
              payers: payerMap
            });
          }
          yearsData[yr].totalYearExpense = Math.round(yearsData[yr].totalYearExpense * 100) / 100;
        }

        return sendJson(res, 200, {
          selectedYear: yearParam,
          years: yearsData,
          roommates
        });
      }

      // 8. Full Reset Database Endpoint (Safe with explicit confirmation)
      if (pathname === '/api/reset-all' && req.method === 'POST') {
        db.prepare('DELETE FROM expenses').run();
        db.prepare('DELETE FROM settlements').run();
        db.prepare('DELETE FROM rent_bills').run();
        return sendJson(res, 200, { success: true, message: 'All expenses, settlements, and rent bills have been reset.' });
      }

      // 9. Export All Data JSON Endpoint
      if (pathname === '/api/export' && req.method === 'GET') {
        const data = {
          exportDate: new Date().toISOString(),
          roommates: db.prepare('SELECT * FROM roommates').all(),
          expenses: db.prepare('SELECT * FROM expenses').all(),
          settlements: db.prepare('SELECT * FROM settlements').all(),
          rentBills: db.prepare('SELECT * FROM rent_bills').all()
        };
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="bachelor-expenses-backup-${new Date().toISOString().slice(0, 10)}.json"`
        });
        return res.end(JSON.stringify(data, null, 2));
      }

      return sendJson(res, 404, { error: 'API endpoint not found' });
    }

    // ----------------------------------------------------
    // STATIC FILE SERVING
    // ----------------------------------------------------
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname);

    // Prevent directory traversal
    if (!filePath.startsWith(PUBLIC_DIR)) {
      res.writeHead(403, { 'Content-Type': 'text/plain' });
      return res.end('Access Denied');
    }

    fs.stat(filePath, (err, stats) => {
      if (err || !stats.isFile()) {
        // Fallback to index.html for SPA if path doesn't contain dot
        if (!pathname.includes('.')) {
          filePath = path.join(PUBLIC_DIR, 'index.html');
          return serveFile(filePath, res);
        }
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('File Not Found');
      }
      serveFile(filePath, res);
    });

  } catch (serverErr) {
    console.error('Server error handling request:', serverErr);
    sendJson(res, 500, { error: 'Internal Server Error', message: serverErr.message });
  }
});

function serveFile(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      return res.end('Server Error reading file');
    }
    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600'
    });
    res.end(data);
  });
}

function checkPortAvailable(port) {
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        resolve(false);
      })
      .once('listening', () => {
        tester.once('close', () => resolve(true)).close();
      })
      .listen(port, '0.0.0.0');
  });
}

async function findAvailablePort(startPort) {
  let port = startPort;
  while (!(await checkPortAvailable(port))) {
    console.log(`Port ${port} is in use, checking port ${port + 1}...`);
    port++;
  }
  return port;
}

(async () => {
  const preferredPort = parseInt(process.env.PORT, 10) || 3000;
  actualPort = await findAvailablePort(preferredPort);

  server.listen(actualPort, '0.0.0.0', () => {
    const ips = getNetworkIps();
    console.log(`\n======================================================`);
    console.log(`🏠 Bachelor Expense Manager Server is LIVE on port ${actualPort}!`);
    console.log(`Local Access:   http://localhost:${actualPort}`);
    ips.forEach(ip => {
      console.log(`Roommate Wi-Fi: http://${ip}:${actualPort}`);
    });
    console.log(`SQLite DB:      ${DB_PATH}`);
    console.log(`======================================================\n`);
  });
})();


