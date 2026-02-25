import React, { useState, useEffect, useRef } from "react";

const initialTables = [
  { id: 1, name: "T1", seats: 2, status: "free" },
  { id: 2, name: "T2", seats: 4, status: "occupied" },
  { id: 3, name: "T3", seats: 4, status: "free" },
  { id: 4, name: "T4", seats: 6, status: "reserved" },
  { id: 5, name: "T5", seats: 2, status: "free" },
  { id: 6, name: "T6", seats: 8, status: "occupied" },
  { id: 7, name: "T7", seats: 4, status: "free" },
  { id: 8, name: "T8", seats: 6, status: "free" },
];

const initialMenu = [
  { id: 1, name: "Butter Chicken", category: "Main Course", price: 320, available: true },
  { id: 2, name: "Paneer Tikka", category: "Starter", price: 220, available: true },
  { id: 3, name: "Dal Makhani", category: "Main Course", price: 180, available: true },
  { id: 4, name: "Garlic Naan", category: "Bread", price: 60, available: true },
  { id: 5, name: "Mango Lassi", category: "Drinks", price: 90, available: true },
  { id: 6, name: "Gulab Jamun", category: "Dessert", price: 120, available: true },
  { id: 7, name: "Chicken Biryani", category: "Main Course", price: 380, available: true },
  { id: 8, name: "Veg Soup", category: "Starter", price: 140, available: false },
];

const initialOrders = [
  { id: 1001, tableId: 2, customerName: "Walk-in Guest", items: [{ menuId: 1, qty: 2 }, { menuId: 4, qty: 3 }], status: "served", time: "12:30 PM", total: 820 },
  { id: 1002, tableId: 6, customerName: "Rohit", items: [{ menuId: 7, qty: 1 }, { menuId: 5, qty: 2 }], status: "preparing", time: "1:05 PM", total: 560 },
];

const initialStaff = [
  { id: 1, name: "Rahul Sharma", role: "Waiter", shift: "Morning", status: "active" },
  { id: 2, name: "Priya Verma", role: "Chef", shift: "Morning", status: "active" },
  { id: 3, name: "Amit Kumar", role: "Manager", shift: "Full Day", status: "active" },
  { id: 4, name: "Sunita Devi", role: "Cashier", shift: "Evening", status: "off" },
];

const NAV_ITEMS = [
  { id: "dashboard", icon: "📊", label: "Dashboard" },
  { id: "tables", icon: "🪑", label: "Tables" },
  { id: "menu", icon: "🍽️", label: "Menu" },
  { id: "orders", icon: "📋", label: "Orders" },
  { id: "billing", icon: "🧾", label: "Billing" },
  { id: "staff", icon: "👨‍🍳", label: "Staff" },
];

const NAV_ROLE_ACCESS = {
  dashboard: ["admin", "employee"],
  tables: ["admin", "employee"],
  menu: ["admin"],
  orders: ["admin", "employee"],
  billing: ["admin", "employee"],
  staff: ["admin"],
};

let paypalSdkPromise = null;
let paypalSdkSignature = null;

function loadPaypalSdk(clientId, currency, buyerCountry, sandbox) {
  if (!clientId) {
    return Promise.reject(new Error("PayPal client ID is missing."));
  }

  const nextSignature = JSON.stringify({
    clientId,
    currency: currency || "USD",
    buyerCountry: buyerCountry || "US",
    sandbox: Boolean(sandbox),
  });

  if (paypalSdkPromise && paypalSdkSignature === nextSignature && window.paypal) {
    return Promise.resolve(window.paypal);
  }

  if (paypalSdkSignature !== nextSignature) {
    paypalSdkPromise = null;
    paypalSdkSignature = nextSignature;

    document
      .querySelectorAll('script[src*="paypal.com/sdk/js"]')
      .forEach((node) => node.remove());

    if (window.paypal) {
      try {
        delete window.paypal;
      } catch {
        window.paypal = undefined;
      }
    }
  }

  if (!paypalSdkPromise) {
    paypalSdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      const params = new URLSearchParams({
        "client-id": clientId,
        currency: currency || "USD",
        components: "buttons",
      });
      if (sandbox && buyerCountry) {
        params.set("buyer-country", buyerCountry);
      }
      script.src = `https://www.paypal.com/sdk/js?${params.toString()}`;
      script.async = true;
      script.onload = () => {
        if (window.paypal) {
          resolve(window.paypal);
          return;
        }
        reject(new Error("PayPal SDK did not load correctly."));
      };
      script.onerror = () => reject(new Error("Failed to load PayPal SDK."));
      document.body.appendChild(script);
    });
  }

  return paypalSdkPromise;
}

function LoginScreen({ onLoginSuccess }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("admin");
  const [username, setUsername] = useState("Admin");
  const [password, setPassword] = useState("admin123");
  const [name, setName] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (mode !== "login") return;
    if (role === "admin") {
      setUsername("Admin");
      setPassword("admin123");
    } else {
      setUsername("");
      setPassword("");
    }
    setError("");
    setMessage("");
  }, [role, mode]);

  const submitLogin = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, username, password }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.user) {
        throw new Error(data.error || "Login failed.");
      }
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err?.message || "Login failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitSignup = async (e) => {
    e.preventDefault();
    setError("");
    setMessage("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, name }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Signup failed.");
      }
      setMessage("Signup successful. Please login as employee.");
      setMode("login");
      setRole("employee");
      setPassword("");
      setConfirmPassword("");
    } catch (err) {
      setError(err?.message || "Signup failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "radial-gradient(ellipse at center, #0f2c68 0%, #051334 45%, #020a1f 100%)", display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <style>{`
        .auth-shell { width: 100%; max-width: 540px; border: 1px solid #2f5fb4; border-radius: 18px; background: linear-gradient(165deg, #102a5f 0%, #0a1f49 45%, #081736 100%); padding: 28px 28px 30px; box-shadow: 0 0 0 1px #2d63c433 inset, 0 0 70px #1d4ed833, 0 40px 80px rgba(0,0,0,0.6); position: relative; }
        .auth-shell::before { content: ""; position: absolute; inset: -2px; border-radius: 20px; pointer-events: none; box-shadow: 0 0 25px #3b82f655; }
        .auth-switch { display: flex; margin-bottom: 18px; border: 1px solid #2f5fb4; border-radius: 12px; overflow: hidden; background: #08173499; box-shadow: 0 0 20px #1d4ed822 inset; }
        .auth-switch button { flex: 1; background: transparent; border: none; color: #a8b6d4; padding: 12px 8px; font-family: 'Lato', sans-serif; font-weight: 700; cursor: pointer; font-size: 16px; }
        .auth-switch button.active { background: linear-gradient(90deg, #43c4ff, #2f8cff); color: #072349; text-shadow: 0 1px 0 #ffffff88; box-shadow: 0 0 25px #38bdf866; }
        .auth-form { display: flex; flex-direction: column; gap: 12px; }
        .auth-label { color: #b7c6e5; font-family: 'Lato', sans-serif; font-size: 12px; letter-spacing: 0.6px; display: block; margin-bottom: 4px; font-weight: 700; }
        .auth-field { width: 100%; height: 34px; border: 1px solid #2f5fb4; background: linear-gradient(180deg, #0f2450 0%, #0a1a3b 100%); color: #eaf2ff; border-radius: 3px; padding: 0 10px; font-size: 14px; box-shadow: 0 0 12px #1d4ed81f inset; }
        .auth-select { width: 130px; height: 34px; border: 1px solid #2f5fb4; background: linear-gradient(180deg, #0f2450 0%, #0a1a3b 100%); color: #eaf2ff; border-radius: 3px; padding: 0 8px; font-size: 14px; box-shadow: 0 0 12px #1d4ed81f inset; }
        .auth-btn { margin-top: 10px; width: 100%; height: 42px; border: 1px solid #4dbdff; background: linear-gradient(90deg, #33bbff 0%, #2563ff 100%); color: #e6f4ff; font-family: 'Lato', sans-serif; font-size: 16px; font-weight: 700; cursor: pointer; border-radius: 5px; letter-spacing: 0.2px; box-shadow: 0 0 24px #3b82f655; }
        .auth-btn:hover { filter: brightness(1.05); }
        .auth-hint { color: #9cb2d9; font-family: 'Lato', sans-serif; font-size: 12px; }
        .auth-msg { color: #86efac; font-family: 'Lato', sans-serif; font-size: 12px; }
        .auth-err { color: #ef4444; font-family: 'Lato', sans-serif; font-size: 13px; font-weight: 700; }
        .auth-field:focus, .auth-select:focus { outline: none; border-color: #60a5fa; box-shadow: 0 0 0 2px #3b82f633, 0 0 18px #2563eb3d inset; }
        @media (max-width: 600px) {
          .auth-shell { max-width: 100%; padding: 20px; }
          .auth-switch button { font-size: 15px; }
          .auth-err { font-size: 12px; }
          .auth-btn { font-size: 16px; }
        }
      `}</style>
      <div className="auth-shell">
        <div className="auth-switch">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Login</button>
          <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>Signup</button>
        </div>

        {mode === "login" ? (
          <form className="auth-form" onSubmit={submitLogin}>
            <div>
              <label className="auth-label">ROLE</label>
              <select className="auth-select" value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="admin">Admin</option>
                <option value="employee">Employee</option>
              </select>
            </div>
            <div>
              <label className="auth-label">USERNAME</label>
              <input className="auth-field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="auth-label">PASSWORD</label>
              <input className="auth-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {message && <div className="auth-msg">{message}</div>}
            {error && <div className="auth-err">{error}</div>}
            <button className="auth-btn" type="submit" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? "Signing in..." : "Sign In"}
            </button>
          </form>
        ) : (
          <form className="auth-form" onSubmit={submitSignup}>
            <div>
              <label className="auth-label">FULL NAME</label>
              <input className="auth-field" value={name} onChange={(e) => setName(e.target.value)} placeholder="Employee name" />
            </div>
            <div>
              <label className="auth-label">USERNAME</label>
              <input className="auth-field" value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </div>
            <div>
              <label className="auth-label">PASSWORD</label>
              <input className="auth-field" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div>
              <label className="auth-label">CONFIRM PASSWORD</label>
              <input className="auth-field" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} autoComplete="new-password" />
            </div>
            <div className="auth-hint">Signup creates an employee account.</div>
            {message && <div className="auth-msg">{message}</div>}
            {error && <div className="auth-err">{error}</div>}
            <button className="auth-btn" type="submit" disabled={isSubmitting} style={{ opacity: isSubmitting ? 0.7 : 1 }}>
              {isSubmitting ? "Creating..." : "Create Employee Account"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [tables, setTables] = useState(initialTables);
  const [menu, setMenu] = useState(initialMenu);
  const [orders, setOrders] = useState(initialOrders);
  const [staff, setStaff] = useState(initialStaff);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [profileForm, setProfileForm] = useState({ name: "", email: "", avatarUrl: "" });
  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [profileError, setProfileError] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const profileMenuRef = useRef(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [notification, setNotification] = useState(null);
  const [isSyncReady, setIsSyncReady] = useState(false);

  const showNotification = (msg, type = "success") => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const availableNavItems = NAV_ITEMS.filter((item) => {
    if (!user?.role) return false;
    return (NAV_ROLE_ACCESS[item.id] || []).includes(user.role);
  });
  const activeNavItem = availableNavItems.find((item) => item.id === activeTab) || availableNavItems[0];
  const SIDEBAR_EXPANDED_WIDTH = 240;
  const SIDEBAR_COLLAPSED_WIDTH = 72;
  const moduleBackground = "linear-gradient(180deg, #f8f6ef 0%, #f3efe5 100%)";
  const profileName = profile?.name || user?.name || "User";
  const profileEmail = profile?.email || "";
  const profileAvatarUrl = profile?.avatarUrl || "";
  const profileInitial = (profileName || "U").trim().charAt(0).toUpperCase();

  useEffect(() => {
    let active = true;

    const loadSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) {
          if (active) setUser(null);
          return;
        }
        const data = await res.json();
        if (active && data?.user) {
          setUser(data.user);
        }
      } catch (err) {
        console.error("Failed to restore login session:", err);
        if (active) setUser(null);
      } finally {
        if (active) setIsAuthLoading(false);
      }
    };

    loadSession();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;

    const loadState = async () => {
      setIsSyncReady(false);
      try {
        const res = await fetch("/api/state");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!active) return;
        setTables(Array.isArray(data.tables) ? data.tables : initialTables);
        setMenu(Array.isArray(data.menu) ? data.menu : initialMenu);
        setOrders(Array.isArray(data.orders) ? data.orders : initialOrders);
        setStaff(Array.isArray(data.staff) ? data.staff : initialStaff);
      } catch (err) {
        console.error("Failed to load state from database:", err);
      } finally {
        if (active) setIsSyncReady(true);
      }
    };

    loadState();
    return () => { active = false; };
  }, [user]);

  useEffect(() => {
    if (!user || !isSyncReady) return;
    const timer = setTimeout(async () => {
      try {
        await fetch("/api/state", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tables, menu, orders, staff }),
        });
      } catch (err) {
        console.error("Failed to persist state to database:", err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [tables, menu, orders, staff, isSyncReady, user]);

  useEffect(() => {
    if (!availableNavItems.length) return;
    if (!availableNavItems.some((item) => item.id === activeTab)) {
      setActiveTab(availableNavItems[0].id);
    }
  }, [availableNavItems, activeTab]);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    let active = true;
    const loadProfile = async () => {
      try {
        const res = await fetch("/api/auth/profile");
        if (!res.ok) return;
        const data = await res.json();
        if (active && data?.user) {
          setProfile(data.user);
        }
      } catch (err) {
        console.error("Failed to load profile:", err);
      }
    };
    loadProfile();
    return () => {
      active = false;
    };
  }, [user]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!profileMenuRef.current) return;
      if (!profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, []);

  const onLoginSuccess = (nextUser) => {
    setUser(nextUser);
    setActiveTab("dashboard");
    showNotification(`Logged in as ${nextUser.role}.`);
  };

  const openProfileEditor = () => {
    setProfileForm({
      name: profileName,
      email: profileEmail,
      avatarUrl: profileAvatarUrl,
    });
    setProfileError("");
    setShowProfileModal(true);
    setProfileMenuOpen(false);
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    setProfileError("");
    try {
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not update profile.");
      }
      setProfile(data.user);
      setUser((prev) => (prev ? { ...prev, ...data.user } : prev));
      setShowProfileModal(false);
      showNotification("Profile updated.");
    } catch (err) {
      setProfileError(err?.message || "Could not update profile.");
    } finally {
      setProfileBusy(false);
    }
  };

  const openPasswordSettings = () => {
    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    setProfileError("");
    setShowPasswordModal(true);
    setProfileMenuOpen(false);
  };

  const changePassword = async () => {
    setProfileError("");
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setProfileError("New password and confirm password do not match.");
      return;
    }
    setProfileBusy(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Could not change password.");
      }
      setShowPasswordModal(false);
      showNotification("Password changed.");
    } catch (err) {
      setProfileError(err?.message || "Could not change password.");
    } finally {
      setProfileBusy(false);
    }
  };

  const logout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Logout request failed:", err);
    }
    setUser(null);
    setProfile(null);
    setProfileMenuOpen(false);
    setShowProfileModal(false);
    setShowPasswordModal(false);
    setIsSyncReady(false);
    setTables(initialTables);
    setMenu(initialMenu);
    setOrders(initialOrders);
    setStaff(initialStaff);
    setActiveTab("dashboard");
    showNotification("Logged out.");
  };

  if (isAuthLoading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0b1220", color: "#cbd5e1", fontFamily: "'Lato', sans-serif" }}>
        Loading...
      </div>
    );
  }

  if (!user) {
    return <LoginScreen onLoginSuccess={onLoginSuccess} />;
  }

  return (
    <div style={{
      display: "flex", height: "100vh", overflow: "hidden", fontFamily: "'Georgia', serif",
      background: "#f6f3ea", color: "#e2e8f0"
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;700;900&family=Lato:wght@300;400;700&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: #111827; }
        ::-webkit-scrollbar-thumb { background: #38bdf8; border-radius: 3px; }
        body { background: #0b1220; }
        .nav-item { transition: all 0.3s ease; cursor: pointer; border-radius: 10px; }
        .nav-item:hover { background: rgba(56,189,248,0.15) !important; transform: translateX(4px); }
        .nav-item.active { background: linear-gradient(135deg, #38bdf8, #0ea5e9) !important; color: #0b1220 !important; }
        .card { background: #111827; border: 1px solid #334155; border-radius: 14px; transition: all 0.3s; }
        .card:hover { border-color: #38bdf844; box-shadow: 0 8px 32px rgba(56,189,248,0.1); }
        .btn-primary { background: linear-gradient(135deg, #38bdf8, #0ea5e9); color: #0b1220; border: none; padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; font-family: 'Lato', sans-serif; transition: all 0.3s; letter-spacing: 0.5px; }
        .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(56,189,248,0.4); }
        .btn-danger { background: rgba(239,68,68,0.14); color: #fda4af; border: 1px solid rgba(239,68,68,0.42); padding: 8px 14px; border-radius: 8px; cursor: pointer; font-family: 'Lato', sans-serif; font-weight: 700; transition: all 0.2s ease; }
        .btn-danger:hover { background: rgba(239,68,68,0.24); border-color: rgba(239,68,68,0.7); color: #ffe4e6; transform: translateY(-1px); }
        .btn-outline { background: transparent; color: #38bdf8; border: 1px solid #38bdf8; padding: 8px 16px; border-radius: 8px; cursor: pointer; font-family: 'Lato', sans-serif; transition: all 0.3s; }
        .btn-outline:hover { background: rgba(56,189,248,0.1); }
        input, select, textarea { background: #1f2937; border: 1px solid #475569; color: #e2e8f0; padding: 10px 14px; border-radius: 8px; font-family: 'Lato', sans-serif; outline: none; transition: border 0.3s; width: 100%; }
        input:focus, select:focus, textarea:focus { border-color: #38bdf8; box-shadow: 0 0 0 3px rgba(56,189,248,0.15); }
        .badge { padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; font-family: 'Lato', sans-serif; }
        .badge-free { background: rgba(34,197,94,0.15); color: #22c55e; border: 1px solid rgba(34,197,94,0.3); }
        .badge-occupied { background: rgba(239,68,68,0.15); color: #ef4444; border: 1px solid rgba(239,68,68,0.3); }
        .badge-reserved { background: rgba(245,158,11,0.15); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .badge-preparing { background: rgba(245,158,11,0.15); color: #f59e0b; }
        .badge-served { background: rgba(34,197,94,0.15); color: #22c55e; }
        .badge-paid { background: rgba(96,165,250,0.15); color: #60a5fa; }
        .table-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
        .table-card { background: #111827; border: 2px solid #334155; border-radius: 14px; padding: 20px; text-align: center; cursor: pointer; transition: all 0.3s; }
        .table-card:hover { transform: translateY(-4px); box-shadow: 0 12px 40px rgba(0,0,0,0.4); }
        .table-card.free { border-color: rgba(34,197,94,0.3); }
        .table-card.occupied { border-color: rgba(239,68,68,0.3); }
        .table-card.reserved { border-color: rgba(245,158,11,0.3); }
        .stat-card { background: #111827; border: 1px solid #334155; border-radius: 14px; padding: 24px; position: relative; overflow: hidden; }
        .stat-card::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #38bdf8, #0ea5e9); }
        .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 100; }
        .modal { background: #111827; border: 1px solid #475569; border-radius: 18px; padding: 32px; width: 90%; max-width: 500px; max-height: 80vh; overflow-y: auto; }
        .notification { position: fixed; top: 20px; right: 20px; padding: 14px 24px; border-radius: 10px; font-family: 'Lato', sans-serif; font-weight: 600; z-index: 999; animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { transform: translateX(100px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        .menu-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 16px; }
        .order-card { background: #111827; border: 1px solid #334155; border-radius: 12px; padding: 20px; transition: all 0.3s; }
        .order-card:hover { border-color: #38bdf844; }
        hr { border: none; border-top: 1px solid #334155; margin: 16px 0; }
        select option { background: #1f2937; }
        .page-title { font-family: 'Playfair Display', serif; font-size: 28px; font-weight: 700; color: #38bdf8; letter-spacing: 0.5px; }
        .section-title { font-family: 'Playfair Display', serif; font-size: 18px; color: #cbd5e1; margin-bottom: 16px; }
      `}</style>

      {/* Notification */}
      {notification && (
        <div className="notification" style={{
          background: notification.type === "success" ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)",
          color: "white"
        }}>
          {notification.type === "success" ? "✅ " : "❌ "}{notification.msg}
        </div>
      )}

      {/* Sidebar */}
      <div style={{
        width: sidebarOpen ? SIDEBAR_EXPANDED_WIDTH : SIDEBAR_COLLAPSED_WIDTH, height: "100vh",
        background: "#0f172a", borderRight: "1px solid #334155",
        transition: "width 0.3s ease", overflow: "hidden", flexShrink: 0,
        display: "flex", flexDirection: "column"
      }}>
        <div style={{ height: 76, padding: "0 12px", borderBottom: "1px solid #334155", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 10, flexShrink: 0,
              background: "linear-gradient(135deg, #38bdf8, #0ea5e9)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20
            }}>🍴</div>
            {sidebarOpen && (
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontWeight: 700, color: "#38bdf8", fontSize: 16, whiteSpace: "nowrap" }}>Solanki Garden</div>
                <div style={{ fontSize: 11, color: "#64748b", fontFamily: "'Lato', sans-serif" }}>Management System</div>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
            style={{
              borderRadius: 8,
              padding: 6,
              color: "#94a3b8",
              background: "transparent",
              border: "1px solid #334155",
              cursor: "pointer",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#1e293b";
              e.currentTarget.style.color = "#ffffff";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#94a3b8";
            }}
          >
            {sidebarOpen ? (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m9 18 6-6-6-6" />
              </svg>
            )}
          </button>
        </div>

        <nav style={{ padding: "16px 10px", flex: 1 }}>
          {availableNavItems.map(item => (
            <div key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: "flex", alignItems: "center", gap: 14,
                padding: "12px 14px", marginBottom: 6,
                color: activeTab === item.id ? "#0b1220" : "#94a3b8",
                fontFamily: "'Lato', sans-serif", fontWeight: 600, fontSize: 14
              }}
            >
              <span style={{ fontSize: 20, flexShrink: 0 }}>{item.icon}</span>
              {sidebarOpen && <span style={{ whiteSpace: "nowrap" }}>{item.label}</span>}
            </div>
          ))}
        </nav>

        <div style={{ padding: "12px 10px", borderTop: "1px solid #334155" }}>
          {sidebarOpen && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontFamily: "'Lato', sans-serif", color: "#cbd5e1", fontSize: 12, fontWeight: 700 }}>{user.name}</div>
              <div style={{ fontFamily: "'Lato', sans-serif", color: "#64748b", fontSize: 11, textTransform: "uppercase" }}>{user.role}</div>
            </div>
          )}
          <button className="btn-outline" style={{ width: "100%", marginBottom: 10 }} onClick={logout}>
            {sidebarOpen ? "Logout" : "↩"}
          </button>
        </div>
      </div>

      {/* Header + Main Content */}
      <div style={{ flex: 1, minWidth: 0, height: "100vh", overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <header style={{
          height: 76,
          background: "#0f172a",
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 24px",
        }}>
          <div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", fontWeight: 700 }}>
              {activeNavItem?.label || "Dashboard"}
            </div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#64748b" }}>
              Solanki Garden Management
            </div>
          </div>
          <div ref={profileMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setProfileMenuOpen((prev) => !prev)}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 10,
                color: "#e2e8f0",
                padding: "8px 10px",
                borderRadius: 10,
              }}
            >
              {profileAvatarUrl ? (
                <img src={profileAvatarUrl} alt="Profile" style={{ width: 34, height: 34, borderRadius: "50%", objectFit: "cover", border: "1px solid #334155" }} />
              ) : (
                <div style={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #2563eb, #38bdf8)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontFamily: "'Lato', sans-serif",
                  fontWeight: 700,
                  fontSize: 13,
                }}>
                  {profileInitial}
                </div>
              )}
              <div style={{ textAlign: "left" }}>
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 14, color: "#e2e8f0", fontWeight: 700 }}>{profileName}</div>
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#64748b", textTransform: "uppercase" }}>{user.role}</div>
              </div>
              <span style={{ color: "#94a3b8", fontSize: 12 }}>▼</span>
            </button>

            {profileMenuOpen && (
              <div style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: 0,
                width: 260,
                background: "#ffffff",
                borderRadius: 12,
                border: "1px solid #e2e8f0",
                boxShadow: "0 16px 40px rgba(2,6,23,0.25)",
                overflow: "hidden",
                zIndex: 1000,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 14, borderBottom: "1px solid #e5e7eb" }}>
                  {profileAvatarUrl ? (
                    <img src={profileAvatarUrl} alt="Profile" style={{ width: 40, height: 40, borderRadius: "50%", objectFit: "cover" }} />
                  ) : (
                    <div style={{ width: 40, height: 40, borderRadius: "50%", background: "#3b82f6", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Lato', sans-serif", fontWeight: 700 }}>
                      {profileInitial}
                    </div>
                  )}
                  <div>
                    <div style={{ color: "#111827", fontFamily: "'Lato', sans-serif", fontWeight: 700 }}>{profileName}</div>
                    <div style={{ color: "#6b7280", fontFamily: "'Lato', sans-serif", fontSize: 13 }}>{profileEmail || `${user.username}@local`}</div>
                  </div>
                </div>
                <button type="button" onClick={openProfileEditor} style={{ width: "100%", textAlign: "left", background: "#fff", border: "none", borderBottom: "1px solid #e5e7eb", padding: "12px 14px", color: "#374151", fontFamily: "'Lato', sans-serif", cursor: "pointer" }}>
                  Profile
                </button>
                <button type="button" onClick={openPasswordSettings} style={{ width: "100%", textAlign: "left", background: "#fff", border: "none", borderBottom: "1px solid #e5e7eb", padding: "12px 14px", color: "#374151", fontFamily: "'Lato', sans-serif", cursor: "pointer" }}>
                  Settings
                </button>
                <button type="button" onClick={logout} style={{ width: "100%", textAlign: "left", background: "#fff", border: "none", padding: "12px 14px", color: "#ef4444", fontFamily: "'Lato', sans-serif", fontWeight: 700, cursor: "pointer" }}>
                  Sign Out
                </button>
              </div>
            )}
          </div>
        </header>

        <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden", padding: "24px", background: moduleBackground }}>
          {activeTab === "dashboard" && <Dashboard tables={tables} orders={orders} menu={menu} staff={staff} />}
          {activeTab === "tables" && <Tables tables={tables} setTables={setTables} showNotification={showNotification} />}
          {activeTab === "menu" && <MenuPage menu={menu} setMenu={setMenu} showNotification={showNotification} />}
          {activeTab === "orders" && <Orders orders={orders} setOrders={setOrders} tables={tables} menu={menu} showNotification={showNotification} />}
          {activeTab === "billing" && <Billing orders={orders} setOrders={setOrders} tables={tables} menu={menu} showNotification={showNotification} />}
          {activeTab === "staff" && <Staff staff={staff} setStaff={setStaff} showNotification={showNotification} />}
        </div>

        {showProfileModal && (
          <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 20 }}>Manage Profile</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>NAME</label>
                  <input value={profileForm.name} onChange={(e) => setProfileForm((prev) => ({ ...prev, name: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>EMAIL</label>
                  <input value={profileForm.email} onChange={(e) => setProfileForm((prev) => ({ ...prev, email: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>PROFILE IMAGE URL</label>
                  <input value={profileForm.avatarUrl} onChange={(e) => setProfileForm((prev) => ({ ...prev, avatarUrl: e.target.value }))} placeholder="https://..." />
                </div>
                {profileError && <div style={{ color: "#fda4af", fontFamily: "'Lato', sans-serif", fontSize: 12 }}>{profileError}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={saveProfile} disabled={profileBusy}>
                    {profileBusy ? "Saving..." : "Save Profile"}
                  </button>
                  <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowProfileModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
            <div className="modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 20 }}>Change Password</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>CURRENT PASSWORD</label>
                  <input type="password" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, currentPassword: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>NEW PASSWORD</label>
                  <input type="password" value={passwordForm.newPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, newPassword: e.target.value }))} />
                </div>
                <div>
                  <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>CONFIRM NEW PASSWORD</label>
                  <input type="password" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm((prev) => ({ ...prev, confirmPassword: e.target.value }))} />
                </div>
                {profileError && <div style={{ color: "#fda4af", fontFamily: "'Lato', sans-serif", fontSize: 12 }}>{profileError}</div>}
                <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                  <button className="btn-primary" style={{ flex: 1 }} onClick={changePassword} disabled={profileBusy}>
                    {profileBusy ? "Updating..." : "Update Password"}
                  </button>
                  <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowPasswordModal(false)}>Cancel</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── DASHBOARD ───────────────────────────────────────────────────
function Dashboard({ tables, orders, menu, staff }) {
  const totalRevenue = orders.filter(o => o.status === "paid").reduce((s, o) => s + o.total, 0);
  const freeTables = tables.filter(t => t.status === "free").length;
  const activeOrders = orders.filter(o => o.status !== "paid").length;
  const activeStaff = staff.filter(s => s.status === "active").length;

  const stats = [
    { label: "Today's Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: "💰", sub: "From paid orders" },
    { label: "Free Tables", value: `${freeTables}/${tables.length}`, icon: "🪑", sub: "Available now" },
    { label: "Active Orders", value: activeOrders, icon: "📋", sub: "In progress" },
    { label: "Staff On Duty", value: activeStaff, icon: "👨‍🍳", sub: "Currently working" },
  ];

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div className="page-title">Dashboard</div>
        <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", marginTop: 4 }}>
          Welcome back! Here's what's happening today.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 20, marginBottom: 32 }}>
        {stats.map((s, i) => (
          <div key={i} className="stat-card">
            <div style={{ fontSize: 32, marginBottom: 12 }}>{s.icon}</div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 700, color: "#38bdf8" }}>{s.value}</div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#cbd5e1", marginTop: 4 }}>{s.label}</div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#64748b", marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {/* Table Status */}
        <div className="card" style={{ padding: 24 }}>
          <div className="section-title">Table Overview</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {tables.map(t => (
              <div key={t.id} style={{
                padding: "10px 16px", borderRadius: 10, fontFamily: "'Lato', sans-serif",
                fontSize: 13, fontWeight: 600,
                background: t.status === "free" ? "rgba(34,197,94,0.1)" : t.status === "occupied" ? "rgba(239,68,68,0.1)" : "rgba(245,158,11,0.1)",
                border: `1px solid ${t.status === "free" ? "rgba(34,197,94,0.3)" : t.status === "occupied" ? "rgba(239,68,68,0.3)" : "rgba(245,158,11,0.3)"}`,
                color: t.status === "free" ? "#22c55e" : t.status === "occupied" ? "#ef4444" : "#f59e0b"
              }}>
                {t.name} ({t.seats}p)
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
            {["free", "occupied", "reserved"].map(s => (
              <div key={s} style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8" }}>
                <div style={{
                  width: 10, height: 10, borderRadius: "50%",
                  background: s === "free" ? "#22c55e" : s === "occupied" ? "#ef4444" : "#f59e0b"
                }} />
                {s.charAt(0).toUpperCase() + s.slice(1)}: {tables.filter(t => t.status === s).length}
              </div>
            ))}
          </div>
        </div>

        {/* Recent Orders */}
        <div className="card" style={{ padding: 24 }}>
          <div className="section-title">Recent Orders</div>
          {orders.length === 0 ? (
            <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", textAlign: "center", padding: "20px 0" }}>No orders yet</div>
          ) : (
            orders.slice(-4).reverse().map(order => (
              <div key={order.id} style={{
                display: "flex", justifyContent: "space-between", alignItems: "center",
                padding: "12px 0", borderBottom: "1px solid #334155"
              }}>
                <div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#cbd5e1" }}>Order #{order.id}</div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#64748b" }}>Table {order.tableId} • {order.time}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#38bdf8" }}>₹{order.total}</div>
                  <span className={`badge badge-${order.status}`}>{order.status}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── TABLES ──────────────────────────────────────────────────────
function Tables({ tables, setTables, showNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editTable, setEditTable] = useState(null);
  const [form, setForm] = useState({ name: "", seats: 4, status: "free" });

  const openAdd = () => { setEditTable(null); setForm({ name: "", seats: 4, status: "free" }); setShowModal(true); };
  const openEdit = (t) => { setEditTable(t); setForm({ name: t.name, seats: t.seats, status: t.status }); setShowModal(true); };

  const save = () => {
    if (!form.name) return;
    if (editTable) {
      setTables(tables.map(t => t.id === editTable.id ? { ...t, ...form } : t));
      showNotification("Table updated!");
    } else {
      setTables([...tables, { id: Date.now(), ...form }]);
      showNotification("Table added!");
    }
    setShowModal(false);
  };

  const changeStatus = (id, status) => {
    setTables(tables.map(t => t.id === id ? { ...t, status } : t));
    showNotification(`Table status changed to ${status}`);
  };

  const deleteTable = (id) => {
    setTables(tables.filter(t => t.id !== id));
    showNotification("Table deleted!", "error");
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div className="page-title">Table Management</div>
          <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", marginTop: 4 }}>
            {tables.filter(t => t.status === "free").length} tables available
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Table</button>
      </div>

      <div className="table-grid">
        {tables.map(t => (
          <div key={t.id} className={`table-card ${t.status}`}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>
              {t.status === "free" ? "🟢" : t.status === "occupied" ? "🔴" : "🟡"}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, fontWeight: 700, color: "#cbd5e1" }}>{t.name}</div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#64748b", marginBottom: 12 }}>{t.seats} Seats</div>
            <span className={`badge badge-${t.status}`}>{t.status}</span>
            <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "center", flexWrap: "wrap" }}>
              {t.status !== "free" && <button className="btn-outline" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => changeStatus(t.id, "free")}>Free</button>}
              {t.status !== "occupied" && <button className="btn-outline" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => changeStatus(t.id, "occupied")}>Occupied</button>}
              {t.status !== "reserved" && <button className="btn-outline" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => changeStatus(t.id, "reserved")}>Reserve</button>}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 8, justifyContent: "center" }}>
              <button className="btn-outline" style={{ fontSize: 11, padding: "5px 10px" }} onClick={() => openEdit(t)}>✏️ Edit</button>
              <button className="btn-danger" style={{ fontSize: 11, padding: "5px 12px" }} onClick={() => deleteTable(t.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 24 }}>
              {editTable ? "Edit Table" : "Add New Table"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>TABLE NAME</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. T9" /></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>SEATS</label>
                <input type="number" value={form.seats} onChange={e => setForm({ ...form, seats: +e.target.value })} min={1} max={20} /></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>STATUS</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="free">Free</option>
                  <option value="occupied">Occupied</option>
                  <option value="reserved">Reserved</option>
                </select></div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={save}>Save</button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MENU ────────────────────────────────────────────────────────
function MenuPage({ menu, setMenu, showNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({ name: "", category: "Main Course", price: "", available: true });
  const [filterCat, setFilterCat] = useState("All");

  const categories = ["All", ...new Set(menu.map(m => m.category))];

  const openAdd = () => { setEditItem(null); setForm({ name: "", category: "Main Course", price: "", available: true }); setShowModal(true); };
  const openEdit = (item) => { setEditItem(item); setForm({ name: item.name, category: item.category, price: item.price, available: item.available }); setShowModal(true); };

  const save = () => {
    if (!form.name || !form.price) return;
    if (editItem) {
      setMenu(menu.map(m => m.id === editItem.id ? { ...m, ...form, price: +form.price } : m));
      showNotification("Menu item updated!");
    } else {
      setMenu([...menu, { id: Date.now(), ...form, price: +form.price }]);
      showNotification("Item added to menu!");
    }
    setShowModal(false);
  };

  const toggle = (id) => {
    setMenu(menu.map(m => m.id === id ? { ...m, available: !m.available } : m));
  };

  const deleteItem = (id) => {
    setMenu(menu.filter(m => m.id !== id));
    showNotification("Item removed!", "error");
  };

  const filtered = filterCat === "All" ? menu : menu.filter(m => m.category === filterCat);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <div>
          <div className="page-title">Menu Management</div>
          <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", marginTop: 4 }}>{menu.length} items total</div>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Item</button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" }}>
        {categories.map(cat => (
          <button key={cat}
            onClick={() => setFilterCat(cat)}
            style={{
              padding: "8px 18px", borderRadius: 20, border: "1px solid",
              fontFamily: "'Lato', sans-serif", fontSize: 13, cursor: "pointer", transition: "all 0.2s",
              background: filterCat === cat ? "linear-gradient(135deg, #38bdf8, #0ea5e9)" : "transparent",
              borderColor: filterCat === cat ? "transparent" : "#475569",
              color: filterCat === cat ? "#0b1220" : "#94a3b8", fontWeight: 600
            }}
          >{cat}</button>
        ))}
      </div>

      <div className="menu-grid">
        {filtered.map(item => (
          <div key={item.id} className="card" style={{ padding: 20, opacity: item.available ? 1 : 0.6 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 11, color: "#38bdf8", fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{item.category}</span>
              <span style={{
                fontFamily: "'Lato', sans-serif", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20,
                background: item.available ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color: item.available ? "#22c55e" : "#ef4444"
              }}>{item.available ? "Available" : "Unavailable"}</span>
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#cbd5e1", marginBottom: 4 }}>{item.name}</div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 22, fontWeight: 700, color: "#38bdf8", marginBottom: 16 }}>₹{item.price}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-outline" style={{ fontSize: 12, flex: 1 }} onClick={() => toggle(item.id)}>
                {item.available ? "🔴 Disable" : "🟢 Enable"}
              </button>
              <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => openEdit(item)}>✏️</button>
              <button className="btn-danger" style={{ fontSize: 12 }} onClick={() => deleteItem(item.id)}>Delete</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 24 }}>
              {editItem ? "Edit Menu Item" : "Add Menu Item"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>ITEM NAME</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Chicken Tikka" /></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>CATEGORY</label>
                <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                  {["Starter", "Main Course", "Bread", "Dessert", "Drinks"].map(c => <option key={c}>{c}</option>)}
                </select></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>PRICE (₹)</label>
                <input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} placeholder="e.g. 250" /></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>AVAILABILITY</label>
                <select value={form.available} onChange={e => setForm({ ...form, available: e.target.value === "true" })}>
                  <option value="true">Available</option>
                  <option value="false">Not Available</option>
                </select></div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={save}>Save Item</button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── ORDERS ──────────────────────────────────────────────────────
function Orders({ orders, setOrders, tables, menu, showNotification }) {
  const getEmptyOrderForm = () => ({ tableId: "", customerName: "", items: [] });
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(getEmptyOrderForm);
  const [selectedItems, setSelectedItems] = useState({});
  const [expandedOrderId, setExpandedOrderId] = useState(null);
  const [editingOrderId, setEditingOrderId] = useState(null);

  const closeOrderModal = () => {
    setShowModal(false);
    setEditingOrderId(null);
    setForm(getEmptyOrderForm());
    setSelectedItems({});
  };

  const startNewOrder = () => {
    setEditingOrderId(null);
    setForm(getEmptyOrderForm());
    setSelectedItems({});
    setShowModal(true);
  };

  const openEditOrder = (order) => {
    const prefills = order.items.reduce((acc, item) => ({ ...acc, [item.menuId]: item.qty }), {});
    setEditingOrderId(order.id);
    setForm({
      tableId: String(order.tableId ?? ""),
      customerName: order.customerName || "",
      items: order.items || [],
    });
    setSelectedItems(prefills);
    setShowModal(true);
  };

  const saveOrder = () => {
    const items = Object.entries(selectedItems)
      .filter(([, qty]) => qty > 0)
      .map(([menuId, qty]) => ({ menuId: +menuId, qty }));

    if (!form.tableId || !form.customerName.trim() || items.length === 0) {
      showNotification("Please select table, add customer name, and choose items.", "error");
      return;
    }

    const total = items.reduce((s, i) => {
      const m = menu.find((x) => x.id === i.menuId);
      return s + (m ? m.price * i.qty : 0);
    }, 0);

    const now = new Date();
    const time = now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });

    if (editingOrderId !== null) {
      setOrders(
        orders.map((o) =>
          o.id === editingOrderId
            ? {
                ...o,
                tableId: +form.tableId,
                customerName: form.customerName.trim(),
                items,
                total,
              }
            : o
        )
      );
      showNotification("Order updated!");
      closeOrderModal();
      return;
    }

    setOrders([
      ...orders,
      {
        id: 1000 + orders.length + 1,
        tableId: +form.tableId,
        customerName: form.customerName.trim(),
        items,
        status: "preparing",
        time,
        total,
      },
    ]);
    tables.find((t) => t.id === +form.tableId) && showNotification("New order placed!");
    closeOrderModal();
  };

  const updateStatus = (id, status) => {
    setOrders(orders.map((o) => (o.id === id ? { ...o, status } : o)));
    showNotification(`Order status updated to ${status}`);
  };

  const getOrderItems = (order) =>
    order.items
      .map((i) => {
        const m = menu.find((x) => x.id === i.menuId);
        return m ? `${m.name} x${i.qty}` : "";
      })
      .join(", ");

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div className="page-title">Order Management</div>
          <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", marginTop: 4 }}>
            {orders.filter((o) => o.status !== "paid").length} active orders
          </div>
        </div>
        <button className="btn-primary" onClick={startNewOrder}>+ New Order</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {orders.length === 0 && (
          <div className="card" style={{ padding: 40, textAlign: "center", color: "#64748b", fontFamily: "'Lato', sans-serif" }}>
            No orders yet. Click "+ New Order" to start!
          </div>
        )}

        {[...orders].reverse().map((order) => {
          const isExpanded = expandedOrderId === order.id;
          return (
            <div key={order.id} className="order-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, color: "#38bdf8" }}>Order #{order.id}</div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#94a3b8", marginTop: 2 }}>
                    Customer: {order.customerName || "Walk-in Guest"}
                  </div>
                </div>
                <button className="btn-outline" style={{ fontSize: 12, minWidth: 88 }} onClick={() => setExpandedOrderId(isExpanded ? null : order.id)}>
                  {isExpanded ? "Hide" : "Details"}
                </button>
              </div>

              {isExpanded && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: "1px solid #334155" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span className={`badge badge-${order.status}`}>{order.status}</span>
                      <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#94a3b8" }}>
                        Table {order.tableId} | {order.time}
                      </span>
                    </div>
                    <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", fontWeight: 700 }}>Rs {order.total}</div>
                  </div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#cbd5e1", marginTop: 8 }}>
                    {getOrderItems(order)}
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
                    {order.status !== "paid" && (
                      <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => openEditOrder(order)}>
                        Edit Order
                      </button>
                    )}
                    {order.status === "preparing" && (
                      <button className="btn-outline" style={{ fontSize: 12 }} onClick={() => updateStatus(order.id, "served")}>Mark Served</button>
                    )}
                    {order.status === "served" && (
                      <button className="btn-primary" style={{ fontSize: 12 }} onClick={() => updateStatus(order.id, "paid")}>Mark Paid</button>
                    )}
                    {order.status === "paid" && (
                      <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#22c55e" }}>Completed</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={closeOrderModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 24 }}>
              {editingOrderId !== null ? `Edit Order #${editingOrderId}` : "Place New Order"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>SELECT TABLE</label>
                <select value={form.tableId} onChange={(e) => setForm({ ...form, tableId: e.target.value })}>
                  <option value="">-- Choose Table --</option>
                  {tables.map((t) => <option key={t.id} value={t.id}>{t.name} ({t.seats} seats)</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>CUSTOMER NAME</label>
                <input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} placeholder="e.g. Amit Sharma" />
              </div>
              <div>
                <label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 10, display: "block" }}>SELECT ITEMS</label>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 240, overflowY: "auto" }}>
                  {menu.filter((m) => m.available).map((m) => (
                    <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#1f2937", borderRadius: 8, border: "1px solid #475569" }}>
                      <div>
                        <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 600, color: "#cbd5e1", fontSize: 14 }}>{m.name}</div>
                        <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#38bdf8" }}>Rs {m.price}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button onClick={() => setSelectedItems((p) => ({ ...p, [m.id]: Math.max(0, (p[m.id] || 0) - 1) }))}
                          style={{ background: "#475569", border: "none", color: "#e2e8f0", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 16 }}>-</button>
                        <span style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#38bdf8", minWidth: 20, textAlign: "center" }}>
                          {selectedItems[m.id] || 0}
                        </span>
                        <button onClick={() => setSelectedItems((p) => ({ ...p, [m.id]: (p[m.id] || 0) + 1 }))}
                          style={{ background: "#475569", border: "none", color: "#e2e8f0", width: 28, height: 28, borderRadius: 6, cursor: "pointer", fontSize: 16 }}>+</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div style={{ background: "#1f2937", padding: 14, borderRadius: 10, fontFamily: "'Lato', sans-serif" }}>
                <span style={{ color: "#94a3b8" }}>Order Total: </span>
                <span style={{ color: "#38bdf8", fontWeight: 700, fontSize: 18 }}>
                  Rs {Object.entries(selectedItems).reduce((s, [id, qty]) => {
                    const m = menu.find((x) => x.id === +id);
                    return s + (m ? m.price * qty : 0);
                  }, 0)}
                </span>
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={saveOrder}>
                  {editingOrderId !== null ? "Save Changes" : "Place Order"}
                </button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={closeOrderModal}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// BILLING
function Billing({ orders, setOrders, tables, menu, showNotification }) {
  const [selected, setSelected] = useState(null);
  const [paypalConfig, setPaypalConfig] = useState({
    enabled: false,
    clientId: "",
    currency: "USD",
    buyerCountry: "US",
    sandbox: true,
  });
  const paypalButtonsRef = useRef(null);

  const unpaid = orders.filter(o => o.status === "served" || o.status === "preparing");
  const paid = orders.filter(o => o.status === "paid");
  const totalRevenue = paid.reduce((s, o) => s + o.total, 0);

  const getItems = (order) =>
    order.items.map(i => {
      const m = menu.find(m => m.id === i.menuId);
      return m ? { ...m, qty: i.qty, subtotal: m.price * i.qty } : null;
    }).filter(Boolean);

  const escapeHtml = (value) =>
    String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll("\"", "&quot;")
      .replaceAll("'", "&#39;");

  const printInvoice = (order) => {
    if (!order) return;
    const items = getItems(order);
    const subtotal = Number(order.total || 0);
    const gst = Math.round(subtotal * 0.05);
    const grandTotal = subtotal + gst;
    const now = new Date().toLocaleString();

    const linesHtml = items.map((item) => `
      <tr>
        <td>${escapeHtml(item.name)}</td>
        <td style="text-align:center;">${item.qty}</td>
        <td style="text-align:right;">Rs ${item.price}</td>
        <td style="text-align:right;">Rs ${item.subtotal}</td>
      </tr>
    `).join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Invoice #${escapeHtml(order.id)}</title>
          <style>
            body { font-family: Arial, sans-serif; color: #111; margin: 24px; }
            .header { text-align: center; margin-bottom: 20px; }
            .title { font-size: 24px; font-weight: 700; }
            .meta { margin: 8px 0; font-size: 13px; color: #444; }
            table { width: 100%; border-collapse: collapse; margin-top: 14px; }
            th, td { border-bottom: 1px solid #ddd; padding: 8px; font-size: 13px; }
            th { text-align: left; background: #f5f5f5; }
            .totals { margin-top: 16px; width: 280px; margin-left: auto; }
            .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
            .grand { font-size: 18px; font-weight: 700; border-top: 2px solid #222; margin-top: 6px; padding-top: 8px; }
            .note { margin-top: 26px; font-size: 12px; color: #555; text-align: center; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">SOLANKI GARDEN</div>
            <div>Tax Invoice</div>
            <div class="meta">Printed: ${escapeHtml(now)}</div>
            <div class="meta">Order #${escapeHtml(order.id)} | Table ${escapeHtml(order.tableId)} | ${escapeHtml(order.time)}</div>
            <div class="meta">Customer: ${escapeHtml(order.customerName || "Walk-in Guest")}</div>
          </div>
          <table>
            <thead>
              <tr>
                <th>Item</th>
                <th style="text-align:center;">Qty</th>
                <th style="text-align:right;">Price</th>
                <th style="text-align:right;">Amount</th>
              </tr>
            </thead>
            <tbody>
              ${linesHtml}
            </tbody>
          </table>
          <div class="totals">
            <div><span>Subtotal</span><span>Rs ${subtotal}</span></div>
            <div><span>GST (5%)</span><span>Rs ${gst}</span></div>
            <div class="grand"><span>Total</span><span>Rs ${grandTotal}</span></div>
          </div>
          <div class="note">Thank you for dining with us.</div>
          <script>
            window.onload = function () {
              window.print();
            };
          </script>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      showNotification("Invoice created, but popup was blocked. Please allow popups.", "error");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  };

  const markPaid = (orderId) => {
    const paidOrder = orders.find((o) => o.id === orderId) || null;
    const updatedOrder = paidOrder ? { ...paidOrder, status: "paid" } : null;
    setOrders(orders.map(o => o.id === orderId ? { ...o, status: "paid" } : o));
    showNotification("Payment received! Bill cleared.");
    setSelected(updatedOrder);
  };

  useEffect(() => {
    let active = true;

    const loadPaypalConfig = async () => {
      try {
        const res = await fetch("/api/paypal/config");
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;
        setPaypalConfig({
          enabled: Boolean(data.enabled),
          clientId: data.clientId || "",
          currency: data.currency || "USD",
          buyerCountry: data.buyerCountry || "US",
          sandbox: Boolean(data.sandbox),
        });
      } catch (err) {
        console.error("Failed to load PayPal config:", err);
      }
    };

    loadPaypalConfig();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!selected || !paypalConfig.enabled || !paypalButtonsRef.current) return;

    let isMounted = true;

    const renderButtons = async () => {
      try {
        const paypal = await loadPaypalSdk(
          paypalConfig.clientId,
          paypalConfig.currency,
          paypalConfig.buyerCountry,
          paypalConfig.sandbox
        );
        if (!isMounted || !paypalButtonsRef.current) return;
        paypalButtonsRef.current.innerHTML = "";

        const buttons = paypal.Buttons({
          style: { layout: "vertical", shape: "rect", label: "paypal" },
          createOrder: async () => {
            try {
              const res = await fetch("/api/paypal/create-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ orderId: selected.id }),
              });
              const data = await res.json();
              if (!res.ok || !data.id) {
                const message = data.error || "Could not create PayPal order.";
                showNotification(message, "error");
                throw new Error(message);
              }
              return data.id;
            } catch (err) {
              const message = err?.message || "Could not create PayPal order.";
              showNotification(message, "error");
              throw err;
            }
          },
          onApprove: async (data) => {
            try {
              const res = await fetch("/api/paypal/capture-order", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ paypalOrderId: data.orderID, orderId: selected.id }),
              });
              const capture = await res.json();
              if (!res.ok || !capture.ok) {
                const message = capture.error || "Could not capture PayPal payment.";
                showNotification(message, "error");
                throw new Error(message);
              }
              markPaid(selected.id);
            } catch (err) {
              const message = err?.message || "Could not capture PayPal payment.";
              showNotification(message, "error");
              throw err;
            }
          },
          onError: (err) => {
            console.error("PayPal payment failed:", err);
            const message = err?.message || "PayPal payment failed. Try again.";
            showNotification(message, "error");
          },
        });

        if (!buttons.isEligible()) {
          showNotification("PayPal is not eligible for this browser.", "error");
          return;
        }

        await buttons.render(paypalButtonsRef.current);
      } catch (err) {
        console.error("Failed to initialize PayPal:", err);
        showNotification("Unable to initialize PayPal checkout.", "error");
      }
    };

    renderButtons();

    return () => {
      isMounted = false;
      if (paypalButtonsRef.current) {
        paypalButtonsRef.current.innerHTML = "";
      }
    };
  }, [selected, paypalConfig, showNotification]);

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div className="page-title">Billing & Invoice</div>
        <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", marginTop: 4 }}>
          Total Revenue: <span style={{ color: "#38bdf8", fontWeight: 700 }}>₹{totalRevenue.toLocaleString()}</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: selected ? "1fr 1fr" : "1fr", gap: 24 }}>
        <div>
          <div className="section-title">Pending Payments ({unpaid.length})</div>
          {unpaid.length === 0 && (
            <div className="card" style={{ padding: 40, textAlign: "center", color: "#64748b", fontFamily: "'Lato', sans-serif" }}>
              No pending payments 🎉
            </div>
          )}
          {unpaid.map(order => (
            <div key={order.id} className="order-card" style={{ marginBottom: 12, cursor: "pointer", border: selected?.id === order.id ? "1px solid #38bdf8" : undefined }}
              onClick={() => setSelected(order)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: "#38bdf8" }}>Order #{order.id}</div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                    Table {order.tableId} • {order.time}
                  </div>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#94a3b8", marginTop: 4 }}>
                    Customer: {order.customerName || "Walk-in Guest"}
                  </div>
                  <span className={`badge badge-${order.status}`} style={{ marginTop: 8, display: "inline-block" }}>{order.status}</span>
                </div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, color: "#38bdf8", fontWeight: 700 }}>₹{order.total}</div>
              </div>
            </div>
          ))}

          <div style={{ marginTop: 24 }}>
            <div className="section-title">Paid Orders ({paid.length})</div>
            {paid.map(order => (
              <div key={order.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 16px", background: "#111827", borderRadius: 10, marginBottom: 8, border: "1px solid #334155" }}>
                <div style={{ fontFamily: "'Lato', sans-serif", color: "#94a3b8", fontSize: 14 }}>
                  <div>Order #{order.id} • Table {order.tableId} • {order.time}</div>
                  <div style={{ marginTop: 2 }}>Customer: {order.customerName || "Walk-in Guest"}</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ fontFamily: "'Lato', sans-serif", fontWeight: 700, color: "#22c55e" }}>₹{order.total} ✅</div>
                  <button className="btn-outline" style={{ fontSize: 12, padding: "8px 10px" }} onClick={() => printInvoice(order)}>
                    Download Bill
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selected && (
          <div className="card" style={{ padding: 28, alignSelf: "flex-start" }}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 4, textAlign: "center" }}>🍴 SOLANKI GARDEN</div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#64748b", textAlign: "center", marginBottom: 20 }}>Fine Dining Restaurant</div>
            <hr />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
              <span>Order #{selected.id}</span>
              <span>Table {selected.tableId}</span>
              <span>{selected.time}</span>
            </div>
            <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#94a3b8", marginBottom: 12 }}>
              Customer: {selected.customerName || "Walk-in Guest"}
            </div>
            <hr />
            <div style={{ marginBottom: 16 }}>
              {getItems(selected).map((item, i) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", fontFamily: "'Lato', sans-serif", borderBottom: "1px dashed #334155" }}>
                  <div>
                    <div style={{ color: "#cbd5e1", fontSize: 14 }}>{item.name}</div>
                    <div style={{ color: "#64748b", fontSize: 12 }}>₹{item.price} × {item.qty}</div>
                  </div>
                  <div style={{ color: "#38bdf8", fontWeight: 700, fontSize: 15 }}>₹{item.subtotal}</div>
                </div>
              ))}
            </div>
            <hr />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Lato', sans-serif", marginBottom: 6 }}>
              <span style={{ color: "#94a3b8" }}>Subtotal</span>
              <span style={{ color: "#cbd5e1" }}>₹{selected.total}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Lato', sans-serif", marginBottom: 6 }}>
              <span style={{ color: "#94a3b8" }}>GST (5%)</span>
              <span style={{ color: "#cbd5e1" }}>₹{Math.round(selected.total * 0.05)}</span>
            </div>
            <hr />
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "'Playfair Display', serif", fontSize: 20, marginBottom: 20 }}>
              <span style={{ color: "#cbd5e1" }}>Total</span>
              <span style={{ color: "#38bdf8", fontWeight: 700 }}>₹{Math.round(selected.total * 1.05)}</span>
            </div>
            {paypalConfig.enabled ? (
              <div ref={paypalButtonsRef} />
            ) : (
              <div style={{ marginBottom: 10, fontFamily: "'Lato', sans-serif", color: "#fda4af", fontSize: 12 }}>
                PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET in server environment.
              </div>
            )}
            {selected.status === "paid" && (
              <button className="btn-primary" style={{ width: "100%", marginTop: 10, padding: "12px" }} onClick={() => printInvoice(selected)}>
                Print Bill (PDF)
              </button>
            )}
            {selected.status !== "paid" && (
              <button className="btn-outline" style={{ width: "100%", marginTop: 10, padding: "12px" }} onClick={() => markPaid(selected.id)}>
                Mark Cash Payment
              </button>
            )}
            <button className="btn-outline" style={{ width: "100%", marginTop: 10, padding: "12px" }} onClick={() => setSelected(null)}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STAFF ───────────────────────────────────────────────────────
function Staff({ staff, setStaff, showNotification }) {
  const [showModal, setShowModal] = useState(false);
  const [editStaff, setEditStaff] = useState(null);
  const [form, setForm] = useState({ name: "", role: "Waiter", shift: "Morning", status: "active" });

  const openAdd = () => { setEditStaff(null); setForm({ name: "", role: "Waiter", shift: "Morning", status: "active" }); setShowModal(true); };
  const openEdit = (s) => { setEditStaff(s); setForm({ name: s.name, role: s.role, shift: s.shift, status: s.status }); setShowModal(true); };

  const save = () => {
    if (!form.name) return;
    if (editStaff) {
      setStaff(staff.map(s => s.id === editStaff.id ? { ...s, ...form } : s));
      showNotification("Staff updated!");
    } else {
      setStaff([...staff, { id: Date.now(), ...form }]);
      showNotification("Staff member added!");
    }
    setShowModal(false);
  };

  const roleIcons = { Waiter: "🧑‍💼", Chef: "👨‍🍳", Manager: "👔", Cashier: "💰" };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 32 }}>
        <div>
          <div className="page-title">Staff Management</div>
          <div style={{ color: "#64748b", fontFamily: "'Lato', sans-serif", marginTop: 4 }}>
            {staff.filter(s => s.status === "active").length} on duty today
          </div>
        </div>
        <button className="btn-primary" onClick={openAdd}>+ Add Staff</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
        {staff.map(s => (
          <div key={s.id} className="card" style={{ padding: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, fontSize: 26,
                background: s.status === "active" ? "rgba(56,189,248,0.15)" : "rgba(100,90,75,0.15)",
                border: `2px solid ${s.status === "active" ? "#38bdf844" : "#47556944"}`,
                display: "flex", alignItems: "center", justifyContent: "center"
              }}>
                {roleIcons[s.role] || "👤"}
              </div>
              <div>
                <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: "#cbd5e1" }}>{s.name}</div>
                <div style={{ fontFamily: "'Lato', sans-serif", fontSize: 13, color: "#38bdf8", marginTop: 2 }}>{s.role}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              <span style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, padding: "4px 10px", borderRadius: 6, background: "#1f2937", color: "#94a3b8", border: "1px solid #475569" }}>
                🕐 {s.shift}
              </span>
              <span className={`badge ${s.status === "active" ? "badge-free" : "badge-occupied"}`}>
                {s.status === "active" ? "On Duty" : "Off Duty"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-outline" style={{ flex: 1, fontSize: 12 }} onClick={() => openEdit(s)}>✏️ Edit</button>
              <button className="btn-outline" style={{ fontSize: 12 }}
                onClick={() => {
                  setStaff(staff.map(st => st.id === s.id ? { ...st, status: st.status === "active" ? "off" : "active" } : st));
                  showNotification("Status updated!");
                }}>
                {s.status === "active" ? "🔴" : "🟢"}
              </button>
              <button className="btn-danger" style={{ fontSize: 12 }}
                onClick={() => { setStaff(staff.filter(st => st.id !== s.id)); showNotification("Staff removed!", "error"); }}>
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 22, color: "#38bdf8", marginBottom: 24 }}>
              {editStaff ? "Edit Staff" : "Add Staff Member"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>FULL NAME</label>
                <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Ravi Singh" /></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>ROLE</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {["Waiter", "Chef", "Manager", "Cashier", "Helper"].map(r => <option key={r}>{r}</option>)}
                </select></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>SHIFT</label>
                <select value={form.shift} onChange={e => setForm({ ...form, shift: e.target.value })}>
                  {["Morning", "Afternoon", "Evening", "Night", "Full Day"].map(s => <option key={s}>{s}</option>)}
                </select></div>
              <div><label style={{ fontFamily: "'Lato', sans-serif", fontSize: 12, color: "#94a3b8", marginBottom: 6, display: "block" }}>STATUS</label>
                <select value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                  <option value="active">Active</option>
                  <option value="off">Off Duty</option>
                </select></div>
              <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
                <button className="btn-primary" style={{ flex: 1 }} onClick={save}>Save</button>
                <button className="btn-outline" style={{ flex: 1 }} onClick={() => setShowModal(false)}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

