import { useEffect, useMemo, useState } from "react";
import { Navigate, NavLink, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Toaster, toast } from "react-hot-toast";
import { AnimatePresence, motion } from "framer-motion";
import api, { getErrorMessage } from "./api/client";
import { useAuthStore } from "./store/authStore";
import SectionCard from "./components/SectionCard";
import HomePage from "./pages/HomePage";
import LoginPage from "./pages/LoginPage";
import ProfilePage from "./pages/ProfilePage";
import SchedulePage from "./pages/SchedulePage";
import JournalPage from "./pages/JournalPage";
import AdminPage from "./pages/AdminPage";
import PostgraduatePage from "./pages/PostgraduatePage";
import SupervisorPage from "./pages/SupervisorPage";
import { getRoleLabel } from "./utils/labels";

const legacyPageToRoute = {
  home: "/",
  login: "/login",
  profile: "/profile",
  schedule: "/schedule",
  journal: "/journal",
  admin: "/admin",
  postgraduate: "/postgraduate",
  supervisor: "/supervisor",
};

export default function App() {
  const { user, setUser, token, logout } = useAuthStore();
  const [loadingAuth, setLoadingAuth] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const showGroupCard = user?.role === "postgraduate";

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoadingAuth(false);
        return;
      }
      try {
        const { data } = await api.get("/profile/me");
        setUser(data);
      } catch {
        logout();
      } finally {
        setLoadingAuth(false);
      }
    })();
  }, [token, setUser, logout]);

  const menu = useMemo(() => {
    const base = [{ to: "/", label: "Главная" }];
    if (!user) return [...base, { to: "/login", label: "Вход" }];

    const items = [
      { to: "/profile", label: "Профиль" },
      { to: "/schedule", label: "Расписание" },
    ];

    if (user.role === "postgraduate") {
      items.push({ to: "/journal", label: "Журнал" });
      items.push({ to: "/postgraduate", label: "Личный кабинет" });
    }

    if (user.role === "professor") {
      items.push({ to: "/journal", label: "Журнал" });
      items.push({ to: "/supervisor", label: "Руководство" });
    }

    if (user.role === "admin") {
      items.push({ to: "/journal", label: "Журнал" });
      items.push({ to: "/admin", label: "Админ-ие поль-ей" });
    }

    return [...base, ...items];
  }, [user]);

  if (loadingAuth) {
    return (
      <div className="max-w-7xl mx-auto p-6 md:p-12 min-h-screen">
        <div className="bg-slate-900/80 border border-slate-700/50 backdrop-blur-md rounded-2xl p-8 text-slate-300">
          Загрузка...
        </div>
      </div>
    );
  }

  return (
    <div className="appShell space-y-6">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: "rgba(255,255,255,0.92)",
            color: "rgba(15,23,42,0.92)",
            border: "1px solid rgba(2,132,199,0.20)",
            boxShadow: "0 18px 45px rgba(2,8,23,0.12)",
          },
        }}
      />

      <header className="appHeader">
        <div className="space-y-2">
          
          <h1 className="appTitle">
            <span className="appTitleAccent">Расписание аспирантуры</span>
          </h1>
        </div>
        <div className="navBar">
          {menu.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                `navLink ${isActive ? "navLinkActive" : ""}`
              }
            >
              {item.label}
            </NavLink>
          ))}
          {user && (
            <button
              onClick={() => { logout(); navigate("/"); }}
              className="btn btnDanger"
            >
              Выйти
            </button>
          )}
        </div>
      </header>

      {user && (
        <motion.section 
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} 
          className="panel"
        >
          <div className={`grid grid-cols-1 sm:grid-cols-2 ${showGroupCard ? "md:grid-cols-4" : "md:grid-cols-3"} gap-4`}>
            <div className="panel">
              <p className="kicker">Пользователь</p>
              <p className="text-[15px] font-extrabold text-slate-900 mt-1">{user.fullName || user.login}</p>
            </div>
            <div className="panel">
              <p className="kicker">Роль</p>
              <p className="text-[15px] font-extrabold text-slate-900 mt-1">{getRoleLabel(user.role)}</p>
            </div>
            {showGroupCard && (
              <div className="panel">
                <p className="kicker">Группа</p>
                <p className="text-[15px] font-extrabold text-slate-900 mt-1">{user.groupName || "—"}</p>
              </div>
            )}
            <div className="panel">
              <p className="kicker">Email</p>
              <p className="text-[15px] font-extrabold text-slate-900 mt-1">{user.email || "—"}</p>
            </div>
          </div>
        </motion.section>
      )}

      <LegacyRedirect />
      <AnimatePresence mode="wait">
        <MainContent key={location.pathname} user={user} currentPath={location.pathname} />
      </AnimatePresence>
    </div>
  );
}

function MainContent({ user, currentPath }) {
  const needsAuth = !user && currentPath !== "/" && currentPath !== "/login" && currentPath !== "/index.html";
  if (needsAuth) {
    return (
      <PageTransition>
        <SectionCard title="Требуется авторизация">
          <p className="muted mb-4">Для доступа к разделу выполните вход.</p>
          <NavLink to="/login" className="btn btnPrimary">
            Перейти ко входу
          </NavLink>
        </SectionCard>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/index.html" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<Guard user={user}><ProfilePage /></Guard>} />
        <Route path="/schedule" element={<Guard user={user}><SchedulePage /></Guard>} />
        <Route
          path="/journal"
          element={
            <Guard user={user}>
              <RoleGuard user={user} roles={["admin", "professor", "postgraduate"]}>
                <JournalPage />
              </RoleGuard>
            </Guard>
          }
        />
        <Route
          path="/admin"
          element={
            <Guard user={user}>
              <RoleGuard user={user} roles={["admin"]}>
                <AdminPage />
              </RoleGuard>
            </Guard>
          }
        />
        <Route
          path="/postgraduate"
          element={
            <Guard user={user}>
              <RoleGuard user={user} roles={["postgraduate"]}>
                <PostgraduatePage />
              </RoleGuard>
            </Guard>
          }
        />
        <Route
          path="/supervisor"
          element={
            <Guard user={user}>
              <RoleGuard user={user} roles={["professor"]}>
                <SupervisorPage />
              </RoleGuard>
            </Guard>
          }
        />
        <Route path="*" element={<SectionCard title="Страница не найдена">Выберите раздел из меню.</SectionCard>} />
      </Routes>
    </PageTransition>
  );
}

function PageTransition({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

function Guard({ user, children }) {
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function RoleGuard({ user, roles, children }) {
  if (!roles.includes(user.role)) {
    return (
      <SectionCard title="Доступ запрещён">
        <p className="muted mb-4">Этот раздел недоступен для вашей роли.</p>
        <NavLink to="/" className="btn btnSecondary">
          На главную
        </NavLink>
      </SectionCard>
    );
  }
  return children;
}

function LegacyRedirect() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const legacyPage = params.get("page");
    if (!legacyPage) return;

    const target = legacyPageToRoute[legacyPage];
    if (!target) return;

    navigate({ pathname: target, search: "", hash: "" }, { replace: true });
  }, [location.pathname, location.search, navigate]);

  return null;
}
