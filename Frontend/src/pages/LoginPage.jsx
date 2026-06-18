import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-hot-toast";
import SectionCard from "../components/SectionCard";
import api, { getErrorMessage } from "../api/client";
import { useAuthStore } from "../store/authStore";

export default function LoginPage() {
  const [form, setForm] = useState({ login: "", password: "" });
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!form.login || !form.password) {
      toast.error("Введите логин и пароль");
      return;
    }
    
    try {
      const { data } = await api.post("/auth/login", form);
      setAuth(data.user, data.token);
      toast.success("Вход выполнен успешно");
      navigate("/profile", { replace: true });
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <SectionCard title="Вход в систему">
      <p className="muted mb-6 text-sm">
        Введите логин и пароль. Роль определяется автоматически по учётной записи.
      </p>
      <form onSubmit={handleLogin} className="space-y-4 max-w-lg">
        <div className="grid sm:grid-cols-2 gap-4">
          <input
            className="input"
            placeholder="Ваш логин"
            value={form.login}
            onChange={(e) => setForm({ ...form, login: e.target.value })}
          />
          <input
            className="input"
            type="password"
            placeholder="Ваш пароль"
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
        </div>
        <div className="pt-2">
          <button type="submit" className="btn btnPrimary w-full sm:w-auto">
            Войти
          </button>
        </div>
      </form>
    </SectionCard>
  );
}
