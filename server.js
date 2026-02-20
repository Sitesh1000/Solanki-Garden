const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { DatabaseSync } = require("node:sqlite");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const raw = fs.readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(path.join(__dirname, ".env"));

const HOST = "127.0.0.1";
const PORT = 4000;
const dbPath = path.join(__dirname, "restaurant.db");
const clientDistPath = path.join(__dirname, "dist");
const PAYPAL_API_BASE = process.env.PAYPAL_API_BASE || "https://api-m.sandbox.paypal.com";
const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID || "";
const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET || "";
const PAYPAL_CURRENCY = process.env.PAYPAL_CURRENCY || "USD";
const PAYPAL_BUYER_COUNTRY = process.env.PAYPAL_BUYER_COUNTRY || "US";
const BILLING_CURRENCY = process.env.BILLING_CURRENCY || "INR";
const PAYPAL_INR_TO_USD_RATE = Number(process.env.PAYPAL_INR_TO_USD_RATE || "0.012");
const ADMIN_USERNAME = process.env.AUTH_ADMIN_USERNAME || "Admin";
const ADMIN_PASSWORD = process.env.AUTH_ADMIN_PASSWORD || "admin123";
const EMPLOYEE_USERNAME = process.env.AUTH_EMPLOYEE_USERNAME || "employee";
const EMPLOYEE_PASSWORD = process.env.AUTH_EMPLOYEE_PASSWORD || "employee123";
const SESSION_COOKIE_NAME = "sg_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const db = new DatabaseSync(dbPath);
const sessions = new Map();

const DEFAULT_ADMIN_USER = { username: ADMIN_USERNAME, password: ADMIN_PASSWORD, role: "admin", name: "Administrator" };

const DEFAULT_STATE = {
  tables: [
    { id: 1, name: "T1", seats: 2, status: "free" },
    { id: 2, name: "T2", seats: 4, status: "occupied" },
    { id: 3, name: "T3", seats: 4, status: "free" },
    { id: 4, name: "T4", seats: 6, status: "reserved" },
    { id: 5, name: "T5", seats: 2, status: "free" },
    { id: 6, name: "T6", seats: 8, status: "occupied" },
    { id: 7, name: "T7", seats: 4, status: "free" },
    { id: 8, name: "T8", seats: 6, status: "free" },
  ],
  menu: [
    { id: 1, name: "Butter Chicken", category: "Main Course", price: 320, available: true },
    { id: 2, name: "Paneer Tikka", category: "Starter", price: 220, available: true },
    { id: 3, name: "Dal Makhani", category: "Main Course", price: 180, available: true },
    { id: 4, name: "Garlic Naan", category: "Bread", price: 60, available: true },
    { id: 5, name: "Mango Lassi", category: "Drinks", price: 90, available: true },
    { id: 6, name: "Gulab Jamun", category: "Dessert", price: 120, available: true },
    { id: 7, name: "Chicken Biryani", category: "Main Course", price: 380, available: true },
    { id: 8, name: "Veg Soup", category: "Starter", price: 140, available: false },
  ],
  orders: [
    { id: 1001, tableId: 2, customerName: "Walk-in Guest", items: [{ menuId: 1, qty: 2 }, { menuId: 4, qty: 3 }], status: "served", time: "12:30 PM", total: 820 },
    { id: 1002, tableId: 6, customerName: "Rohit", items: [{ menuId: 7, qty: 1 }, { menuId: 5, qty: 2 }], status: "preparing", time: "1:05 PM", total: 560 },
  ],
  staff: [
    { id: 1, name: "Rahul Sharma", role: "Waiter", shift: "Morning", status: "active" },
    { id: 2, name: "Priya Verma", role: "Chef", shift: "Morning", status: "active" },
    { id: 3, name: "Amit Kumar", role: "Manager", shift: "Full Day", status: "active" },
    { id: 4, name: "Sunita Devi", role: "Cashier", shift: "Evening", status: "off" },
  ],
};

db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    data TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS auth_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'employee')),
    name TEXT NOT NULL,
    email TEXT NOT NULL DEFAULT '',
    avatar_url TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

function ensureAuthUserColumns() {
  const columns = db.prepare("PRAGMA table_info(auth_users)").all().map((col) => col.name);
  if (!columns.includes("email")) {
    db.exec("ALTER TABLE auth_users ADD COLUMN email TEXT NOT NULL DEFAULT '';");
  }
  if (!columns.includes("avatar_url")) {
    db.exec("ALTER TABLE auth_users ADD COLUMN avatar_url TEXT NOT NULL DEFAULT '';");
  }
}

ensureAuthUserColumns();

function seedDefaultUsers() {
  db.prepare(`
    INSERT INTO auth_users (username, password, role, name, email, avatar_url)
    VALUES (?, ?, ?, ?, '', '')
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      role = excluded.role,
      name = excluded.name,
      email = COALESCE(auth_users.email, ''),
      avatar_url = COALESCE(auth_users.avatar_url, '')
  `).run(DEFAULT_ADMIN_USER.username, DEFAULT_ADMIN_USER.password, DEFAULT_ADMIN_USER.role, DEFAULT_ADMIN_USER.name);

  if (EMPLOYEE_USERNAME && EMPLOYEE_USERNAME !== DEFAULT_ADMIN_USER.username) {
    db.prepare(`
      INSERT INTO auth_users (username, password, role, name, email, avatar_url)
      VALUES (?, ?, 'employee', 'Employee', '', '')
      ON CONFLICT(username) DO NOTHING
    `).run(EMPLOYEE_USERNAME, EMPLOYEE_PASSWORD);
  }
}

seedDefaultUsers();

function normalizeState(raw) {
  return {
    tables: Array.isArray(raw?.tables) ? raw.tables : DEFAULT_STATE.tables,
    menu: Array.isArray(raw?.menu) ? raw.menu : DEFAULT_STATE.menu,
    orders: Array.isArray(raw?.orders) ? raw.orders : DEFAULT_STATE.orders,
    staff: Array.isArray(raw?.staff) ? raw.staff : DEFAULT_STATE.staff,
  };
}

function getState() {
  const row = db.prepare("SELECT data FROM app_state WHERE id = 1").get();
  if (!row) {
    saveState(DEFAULT_STATE);
    return DEFAULT_STATE;
  }
  try {
    return normalizeState(JSON.parse(row.data));
  } catch {
    saveState(DEFAULT_STATE);
    return DEFAULT_STATE;
  }
}

function saveState(state) {
  const normalized = normalizeState(state);
  db.prepare(`
    INSERT INTO app_state (id, data, updated_at)
    VALUES (1, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(id) DO UPDATE SET
      data = excluded.data,
      updated_at = CURRENT_TIMESTAMP
  `).run(JSON.stringify(normalized));
}

function json(res, statusCode, payload, extraHeaders = {}) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    ...extraHeaders,
  });
  res.end(JSON.stringify(payload));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function findUserByUsername(username) {
  return db.prepare(`
    SELECT username, password, role, name, email, avatar_url
    FROM auth_users
    WHERE username = ?
    LIMIT 1
  `).get(username);
}

function findUserByUsernameCaseInsensitive(username) {
  return db.prepare(`
    SELECT username, password, role, name, email, avatar_url
    FROM auth_users
    WHERE lower(username) = lower(?)
    LIMIT 1
  `).get(username);
}

function getPublicUser(user) {
  return {
    username: user.username,
    role: user.role,
    name: user.name,
    email: user.email || "",
    avatarUrl: user.avatar_url || "",
  };
}

function createEmployeeUser({ username, password, name }) {
  db.prepare(`
    INSERT INTO auth_users (username, password, role, name, email, avatar_url)
    VALUES (?, ?, 'employee', ?, '', '')
  `).run(username, password, name || "Employee");
}

function updateUserProfile({ username, name, email, avatarUrl }) {
  db.prepare(`
    UPDATE auth_users
    SET name = ?, email = ?, avatar_url = ?
    WHERE username = ?
  `).run(name, email, avatarUrl, username);
}

function updateUserPassword({ username, newPassword }) {
  db.prepare(`
    UPDATE auth_users
    SET password = ?
    WHERE username = ?
  `).run(newPassword, username);
}

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || "";
  const result = {};
  for (const entry of cookieHeader.split(";")) {
    const [rawKey, ...rawValueParts] = entry.trim().split("=");
    if (!rawKey) continue;
    result[rawKey] = decodeURIComponent(rawValueParts.join("=") || "");
  }
  return result;
}

function buildCookie(name, value, maxAgeSeconds) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

function clearExpiredSessions() {
  const now = Date.now();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(sessionId);
  }
}

function createSession(user) {
  clearExpiredSessions();
  const sessionId = crypto.randomUUID();
  sessions.set(sessionId, {
    user: getPublicUser(user),
    expiresAt: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  return sessionId;
}

function getSessionUser(req) {
  clearExpiredSessions();
  const cookies = parseCookies(req);
  const sessionId = cookies[SESSION_COOKIE_NAME];
  if (!sessionId) return null;
  const session = sessions.get(sessionId);
  if (!session) return null;
  session.expiresAt = Date.now() + SESSION_MAX_AGE_SECONDS * 1000;
  return session.user;
}

function requireAuth(req, res, roles = null) {
  const user = getSessionUser(req);
  if (!user) {
    json(res, 401, { ok: false, error: "Unauthorized. Please login first." });
    return null;
  }
  if (Array.isArray(roles) && roles.length > 0 && !roles.includes(user.role)) {
    json(res, 403, { ok: false, error: "Forbidden for this role." });
    return null;
  }
  return user;
}

function isPaypalConfigured() {
  return Boolean(PAYPAL_CLIENT_ID && PAYPAL_CLIENT_SECRET);
}

async function getPaypalAccessToken() {
  const credentials = Buffer.from(`${PAYPAL_CLIENT_ID}:${PAYPAL_CLIENT_SECRET}`).toString("base64");
  const response = await fetch(`${PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(`PayPal token request failed (${response.status}): ${details}`);
  }

  const data = await response.json();
  return data.access_token;
}

function getOrderById(orderId) {
  const parsedId = Number(orderId);
  if (!Number.isFinite(parsedId)) return null;
  const state = getState();
  return state.orders.find((order) => order.id === parsedId) || null;
}

function getGrandTotal(order) {
  return Math.round(Number(order.total || 0) * 1.05);
}

function toPaypalAmount(orderTotalInBillingCurrency) {
  if (PAYPAL_CURRENCY === BILLING_CURRENCY) {
    return Math.max(0.01, Number(orderTotalInBillingCurrency)).toFixed(2);
  }

  // Current app bills in INR. If PayPal is USD, convert before charging.
  if (BILLING_CURRENCY === "INR" && PAYPAL_CURRENCY === "USD") {
    const usdValue = Number(orderTotalInBillingCurrency) * PAYPAL_INR_TO_USD_RATE;
    return Math.max(0.01, usdValue).toFixed(2);
  }

  throw new Error(
    `Unsupported currency mapping: BILLING_CURRENCY=${BILLING_CURRENCY}, PAYPAL_CURRENCY=${PAYPAL_CURRENCY}`
  );
}

function sendStaticFile(reqPath, res) {
  if (!fs.existsSync(clientDistPath)) {
    res.writeHead(404);
    res.end("Frontend build not found. Run `npm run build`.");
    return;
  }

  const safePath = reqPath === "/" ? "/index.html" : reqPath;
  const filePath = path.join(clientDistPath, safePath);
  const normalizedRoot = path.normalize(clientDistPath + path.sep);
  const normalizedFile = path.normalize(filePath);
  if (!normalizedFile.startsWith(normalizedRoot)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(normalizedFile, (err, data) => {
    if (err) {
      // SPA fallback
      fs.readFile(path.join(clientDistPath, "index.html"), (indexErr, indexData) => {
        if (indexErr) {
          res.writeHead(404);
          res.end("Not found");
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
        res.end(indexData);
      });
      return;
    }
    const ext = path.extname(normalizedFile).toLowerCase();
    const mime = {
      ".html": "text/html; charset=utf-8",
      ".js": "text/javascript; charset=utf-8",
      ".jsx": "text/plain; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".json": "application/json; charset=utf-8",
    }[ext] || "application/octet-stream";

    res.writeHead(200, { "Content-Type": mime });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  if (url.pathname === "/api/auth/me" && req.method === "GET") {
    const user = getSessionUser(req);
    if (!user) {
      json(res, 401, { ok: false, error: "Not logged in." });
      return;
    }
    json(res, 200, { ok: true, user });
    return;
  }

  if (url.pathname === "/api/auth/login" && req.method === "POST") {
    readJsonBody(req)
      .then((parsed) => {
        const username = String(parsed.username || "").trim();
        const password = String(parsed.password || "");
        const role = parsed.role === "employee" ? "employee" : "admin";
        if (!username || !password) {
          json(res, 400, { ok: false, error: "Username and password are required." });
          return;
        }
        let userTemplate = findUserByUsername(username);
        if (!userTemplate && role === "admin") {
          userTemplate = findUserByUsernameCaseInsensitive(username);
        }
        if (!userTemplate || userTemplate.role !== role || userTemplate.password !== password) {
          json(res, 401, { ok: false, error: "Invalid credentials." });
          return;
        }

        const sessionId = createSession(userTemplate);
        json(
          res,
          200,
          { ok: true, user: getPublicUser(userTemplate) },
          { "Set-Cookie": buildCookie(SESSION_COOKIE_NAME, sessionId, SESSION_MAX_AGE_SECONDS) }
        );
      })
      .catch((err) => {
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (url.pathname === "/api/auth/signup" && req.method === "POST") {
    readJsonBody(req)
      .then((parsed) => {
        const username = String(parsed.username || "").trim();
        const password = String(parsed.password || "");
        const name = String(parsed.name || "").trim();
        if (!username || !password) {
          json(res, 400, { ok: false, error: "Username and password are required." });
          return;
        }
        if (username.length < 3) {
          json(res, 400, { ok: false, error: "Username must be at least 3 characters." });
          return;
        }
        if (password.length < 6) {
          json(res, 400, { ok: false, error: "Password must be at least 6 characters." });
          return;
        }
        if (findUserByUsername(username)) {
          json(res, 409, { ok: false, error: "Username already exists." });
          return;
        }

        createEmployeeUser({ username, password, name });
        json(res, 201, {
          ok: true,
          message: "Employee account created. Please login.",
        });
      })
      .catch((err) => {
        if (String(err?.message || "").includes("UNIQUE")) {
          json(res, 409, { ok: false, error: "Username already exists." });
          return;
        }
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (url.pathname === "/api/auth/logout" && req.method === "POST") {
    const cookies = parseCookies(req);
    const sessionId = cookies[SESSION_COOKIE_NAME];
    if (sessionId) sessions.delete(sessionId);
    json(res, 200, { ok: true }, { "Set-Cookie": buildCookie(SESSION_COOKIE_NAME, "", 0) });
    return;
  }

  if (url.pathname === "/api/auth/profile" && req.method === "GET") {
    const sessionUser = requireAuth(req, res, ["admin", "employee"]);
    if (!sessionUser) return;
    const user = findUserByUsername(sessionUser.username);
    if (!user) {
      json(res, 404, { ok: false, error: "User not found." });
      return;
    }
    json(res, 200, { ok: true, user: getPublicUser(user) });
    return;
  }

  if (url.pathname === "/api/auth/profile" && req.method === "PUT") {
    const sessionUser = requireAuth(req, res, ["admin", "employee"]);
    if (!sessionUser) return;
    readJsonBody(req)
      .then((parsed) => {
        const name = String(parsed.name || "").trim();
        const email = String(parsed.email || "").trim();
        const avatarUrl = String(parsed.avatarUrl || "").trim();
        if (!name) {
          json(res, 400, { ok: false, error: "Name is required." });
          return;
        }
        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          json(res, 400, { ok: false, error: "Invalid email format." });
          return;
        }
        updateUserProfile({ username: sessionUser.username, name, email, avatarUrl });
        const updated = findUserByUsername(sessionUser.username);
        if (!updated) {
          json(res, 404, { ok: false, error: "User not found after update." });
          return;
        }
        const sessionId = parseCookies(req)[SESSION_COOKIE_NAME];
        if (sessionId && sessions.has(sessionId)) {
          const session = sessions.get(sessionId);
          session.user = getPublicUser(updated);
          sessions.set(sessionId, session);
        }
        json(res, 200, { ok: true, user: getPublicUser(updated) });
      })
      .catch((err) => {
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (url.pathname === "/api/auth/change-password" && req.method === "POST") {
    const sessionUser = requireAuth(req, res, ["admin", "employee"]);
    if (!sessionUser) return;
    readJsonBody(req)
      .then((parsed) => {
        const currentPassword = String(parsed.currentPassword || "");
        const newPassword = String(parsed.newPassword || "");
        if (!currentPassword || !newPassword) {
          json(res, 400, { ok: false, error: "Current and new password are required." });
          return;
        }
        if (newPassword.length < 6) {
          json(res, 400, { ok: false, error: "New password must be at least 6 characters." });
          return;
        }
        const user = findUserByUsername(sessionUser.username);
        if (!user || user.password !== currentPassword) {
          json(res, 401, { ok: false, error: "Current password is incorrect." });
          return;
        }
        updateUserPassword({ username: sessionUser.username, newPassword });
        json(res, 200, { ok: true, message: "Password updated successfully." });
      })
      .catch((err) => {
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (url.pathname === "/api/state" && req.method === "GET") {
    const user = requireAuth(req, res, ["admin", "employee"]);
    if (!user) return;
    json(res, 200, getState());
    return;
  }

  if (url.pathname === "/api/state" && req.method === "PUT") {
    const user = requireAuth(req, res, ["admin", "employee"]);
    if (!user) return;
    readJsonBody(req)
      .then((parsed) => {
        saveState(parsed);
        json(res, 200, { ok: true });
      })
      .catch((err) => {
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (url.pathname === "/api/paypal/config" && req.method === "GET") {
    const user = requireAuth(req, res, ["admin", "employee"]);
    if (!user) return;
    json(res, 200, {
      enabled: isPaypalConfigured(),
      clientId: PAYPAL_CLIENT_ID,
      currency: PAYPAL_CURRENCY,
      buyerCountry: PAYPAL_BUYER_COUNTRY,
      sandbox: PAYPAL_API_BASE.includes("sandbox.paypal.com"),
      billingCurrency: BILLING_CURRENCY,
      inrToUsdRate: PAYPAL_INR_TO_USD_RATE,
    });
    return;
  }

  if (url.pathname === "/api/paypal/create-order" && req.method === "POST") {
    const user = requireAuth(req, res, ["admin", "employee"]);
    if (!user) return;
    readJsonBody(req)
      .then(async (parsed) => {
        if (!isPaypalConfigured()) {
          json(res, 503, { ok: false, error: "PayPal credentials are not configured on the server." });
          return;
        }

        const order = getOrderById(parsed.orderId);
        if (!order) {
          json(res, 404, { ok: false, error: "Order not found." });
          return;
        }

        if (order.status === "paid") {
          json(res, 409, { ok: false, error: "Order is already paid." });
          return;
        }

        const accessToken = await getPaypalAccessToken();
        const amountValue = toPaypalAmount(getGrandTotal(order));
        const paypalResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            intent: "CAPTURE",
            purchase_units: [
              {
                custom_id: String(order.id),
                amount: {
                  currency_code: PAYPAL_CURRENCY,
                  value: amountValue,
                },
              },
            ],
          }),
        });

        if (!paypalResponse.ok) {
          const details = await paypalResponse.text();
          throw new Error(`PayPal create-order failed (${paypalResponse.status}): ${details}`);
        }

        const paypalOrder = await paypalResponse.json();
        json(res, 200, { ok: true, id: paypalOrder.id });
      })
      .catch((err) => {
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (url.pathname === "/api/paypal/capture-order" && req.method === "POST") {
    const user = requireAuth(req, res, ["admin", "employee"]);
    if (!user) return;
    readJsonBody(req)
      .then(async (parsed) => {
        if (!isPaypalConfigured()) {
          json(res, 503, { ok: false, error: "PayPal credentials are not configured on the server." });
          return;
        }

        if (!parsed.paypalOrderId) {
          json(res, 400, { ok: false, error: "paypalOrderId is required." });
          return;
        }

        const accessToken = await getPaypalAccessToken();
        const paypalResponse = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${parsed.paypalOrderId}/capture`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
        });

        if (!paypalResponse.ok) {
          const details = await paypalResponse.text();
          throw new Error(`PayPal capture failed (${paypalResponse.status}): ${details}`);
        }

        const captureData = await paypalResponse.json();
        const captureStatus = captureData.status || "";
        if (captureStatus !== "COMPLETED") {
          json(res, 409, { ok: false, error: `Capture not completed. Current status: ${captureStatus}` });
          return;
        }

        const parsedOrderId = Number(parsed.orderId);
        if (Number.isFinite(parsedOrderId)) {
          const state = getState();
          const updatedOrders = state.orders.map((order) =>
            order.id === parsedOrderId ? { ...order, status: "paid" } : order
          );
          saveState({ ...state, orders: updatedOrders });
        }

        json(res, 200, { ok: true, status: captureStatus });
      })
      .catch((err) => {
        json(res, 400, { ok: false, error: err.message });
      });
    return;
  }

  if (req.method === "GET") {
    sendStaticFile(url.pathname, res);
    return;
  }

  json(res, 404, { ok: false, error: "Not found" });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
  console.log("Database file:", dbPath);
});
