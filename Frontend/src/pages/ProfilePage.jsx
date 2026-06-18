import { useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";
import { getRoleLabel } from "../utils/labels";

const labels = {
  fullName: "ФИО",
  groupName: "Учебная группа",
  email: "Электронная почта",
  phone: "Номер телефона"
};

export default function ProfilePage() {
  const { user, setUser } = useAuthStore();
  const showGroupField = user?.role === "postgraduate";
  const [form, setForm] = useState({
    fullName: user?.fullName || "",
    groupName: user?.groupName || "",
    email: user?.email || "",
    phone: user?.phone || "",
  });

  const profileFields = showGroupField
    ? ["fullName", "groupName", "email", "phone"]
    : ["fullName", "email", "phone"];

  const save = async () => {
    try {
      const payload = {
        fullName: form.fullName,
        email: form.email,
        phone: form.phone,
      };
      if (showGroupField) {
        payload.groupName = form.groupName;
      }
      const { data } = await api.put("/profile/me", payload);
      setUser(data);
      toast.success("Профиль успешно обновлен");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <SectionCard title="Настройки профиля">
      <div className="mb-6 flex items-center">
        <span className="muted mr-3">Ваша роль:</span>
        <span className="badge badgePrimary">
          {getRoleLabel(user?.role)}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        {profileFields.map((k) => (
          <div key={k} className="space-y-1.5">
            <label className="label">{labels[k]}</label>
            <input
              className="input"
              value={form[k] || ""}
              placeholder={labels[k]}
              onChange={(e) => setForm({ ...form, [k]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <div className="mt-8">
        <button 
          className="btn btnPrimary" 
          onClick={save}
        >
          Сохранить изменения
        </button>
      </div>
    </SectionCard>
  );
}
