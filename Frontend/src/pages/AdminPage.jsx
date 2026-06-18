import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { getRoleLabel, ATTESTATION_DECISION_OPTIONS, getAttestationDecisionLabel } from "../utils/labels";

const emptyAttestationForm = {
  periodLabel: "",
  decision: "pending",
  notes: "",
  attestedAt: "",
};

const emptyProfessorFields = { tabNumber: "", position: "" };

function professorFieldsForRole(role) {
  return role === "professor" ? emptyProfessorFields : {};
}

export default function AdminPage() {
  const [users, setUsers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [postgraduates, setPostgraduates] = useState([]);
  const [form, setForm] = useState({
    login: "",
    password: "",
    fullName: "",
    role: "postgraduate",
    tabNumber: "",
    position: "",
  });
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);

  const [groupForm, setGroupForm] = useState({ name: "", description: "" });
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [editGroupForm, setEditGroupForm] = useState(null);

  const [selectedPgId, setSelectedPgId] = useState("");
  const [attestations, setAttestations] = useState([]);
  const [attestationForm, setAttestationForm] = useState(emptyAttestationForm);
  const [editingAttestationId, setEditingAttestationId] = useState(null);

  const loadUsers = async () => {
    setUsers((await api.get("/admin/users")).data);
  };

  const loadGroups = async () => {
    setGroups((await api.get("/admin/groups")).data);
  };

  const loadPostgraduates = async () => {
    setPostgraduates((await api.get("/admin/users", { params: { role: "postgraduate" } })).data);
  };

  const load = async () => {
    try {
      await Promise.all([loadUsers(), loadGroups(), loadPostgraduates()]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const loadAttestations = useCallback(async (userId) => {
    if (!userId) {
      setAttestations([]);
      return;
    }
    try {
      const { data } = await api.get("/admin/attestations", { params: { userId } });
      setAttestations(data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  }, []);

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    loadAttestations(selectedPgId);
  }, [selectedPgId, loadAttestations]);

  const add = async () => {
    if (!form.login || !form.password || !form.fullName) {
      toast.error("Заполните все поля");
      return;
    }
    try {
      setBusy(true);
      const payload = { ...form };
      if (payload.role !== "professor") {
        delete payload.tabNumber;
        delete payload.position;
      }
      await api.post("/admin/users", payload);
      toast.success("Пользователь создан");
      setForm({
        login: "",
        password: "",
        fullName: "",
        role: form.role,
        ...professorFieldsForRole(form.role),
      });
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    try {
      setBusy(true);
      await api.delete(`/admin/users/${id}`);
      toast.success("Пользователь удален");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (u) => {
    setEditingId(u.id);
    setEditForm({
      login: u.login || "",
      password: "",
      fullName: u.fullName || "",
      role: u.role || "postgraduate",
      groupId: u.groupId != null ? String(u.groupId) : "",
      email: u.email || "",
      phone: u.phone || "",
      tabNumber: u.tabNumber || "",
      position: u.position || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    try {
      setBusy(true);
      const payload = { ...editForm };
      if (!payload.password) delete payload.password;
      if (payload.role !== "professor") {
        payload.tabNumber = "";
        payload.position = "";
      }
      payload.groupId = payload.groupId ? Number(payload.groupId) : null;
      await api.put(`/admin/users/${editingId}`, payload);
      toast.success("Пользователь обновлён");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const addGroup = async () => {
    if (!groupForm.name.trim()) {
      toast.error("Укажите название группы");
      return;
    }
    try {
      setBusy(true);
      await api.post("/admin/groups", groupForm);
      toast.success("Группа создана");
      setGroupForm({ name: "", description: "" });
      await loadGroups();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startEditGroup = (g) => {
    setEditingGroupId(g.id);
    setEditGroupForm({ name: g.name || "", description: g.description || "" });
  };

  const saveGroup = async () => {
    if (!editingGroupId || !editGroupForm) return;
    try {
      setBusy(true);
      await api.put(`/admin/groups/${editingGroupId}`, editGroupForm);
      toast.success("Группа обновлена");
      setEditingGroupId(null);
      setEditGroupForm(null);
      await loadGroups();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeGroup = async (id) => {
    if (!window.confirm("Удалить группу?")) return;
    try {
      setBusy(true);
      await api.delete(`/admin/groups/${id}`);
      toast.success("Группа удалена");
      await loadGroups();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const resetAttestationForm = () => {
    setAttestationForm(emptyAttestationForm);
    setEditingAttestationId(null);
  };

  const saveAttestation = async () => {
    if (!selectedPgId) {
      toast.error("Выберите аспиранта");
      return;
    }
    if (!attestationForm.periodLabel.trim()) {
      toast.error("Укажите период / экзамен");
      return;
    }
    try {
      setBusy(true);
      const payload = {
        userId: Number(selectedPgId),
        periodLabel: attestationForm.periodLabel.trim(),
        decision: attestationForm.decision || null,
        notes: attestationForm.notes || null,
        attestedAt: attestationForm.attestedAt || null,
      };
      if (editingAttestationId) {
        await api.put(`/admin/attestations/${editingAttestationId}`, payload);
        toast.success("Аттестация обновлена");
      } else {
        await api.post("/admin/attestations", payload);
        toast.success("Аттестация создана");
      }
      resetAttestationForm();
      await loadAttestations(selectedPgId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startEditAttestation = (a) => {
    setEditingAttestationId(a.id);
    setAttestationForm({
      periodLabel: a.periodLabel || "",
      decision: a.decision || "",
      notes: a.notes || "",
      attestedAt: a.attestedAt || "",
    });
  };

  const removeAttestation = async (id) => {
    if (!window.confirm("Удалить запись аттестации?")) return;
    try {
      setBusy(true);
      await api.delete(`/admin/attestations/${id}`);
      toast.success("Аттестация удалена");
      await loadAttestations(selectedPgId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionCard title="Управление группами">
        <div className="panel mb-6">
          <h3 className="text-sm font-extrabold text-slate-900 mb-4">Создать группу</h3>
          <div className="grid md:grid-cols-3 gap-3 items-end">
            <input
              className="input"
              placeholder="Название"
              value={groupForm.name}
              onChange={(e) => setGroupForm((p) => ({ ...p, name: e.target.value }))}
            />
            <input
              className="input"
              placeholder="Описание (опционально)"
              value={groupForm.description}
              onChange={(e) => setGroupForm((p) => ({ ...p, description: e.target.value }))}
            />
            <button disabled={busy} className="btn btnPrimary" onClick={addGroup}>
              Добавить группу
            </button>
          </div>
        </div>

        <div className="space-y-3">
          {groups.map((g) => (
            <div key={g.id} className="panel">
              {editingGroupId === g.id && editGroupForm ? (
                <div className="grid md:grid-cols-3 gap-3 items-end">
                  <input
                    className="input"
                    value={editGroupForm.name}
                    onChange={(e) => setEditGroupForm((p) => ({ ...p, name: e.target.value }))}
                  />
                  <input
                    className="input"
                    placeholder="Описание"
                    value={editGroupForm.description}
                    onChange={(e) => setEditGroupForm((p) => ({ ...p, description: e.target.value }))}
                  />
                  <div className="flex gap-2">
                    <button disabled={busy} className="btn btnPrimary" onClick={saveGroup}>Сохранить</button>
                    <button disabled={busy} className="btn btnSecondary" onClick={() => { setEditingGroupId(null); setEditGroupForm(null); }}>Отмена</button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900">{g.name}</div>
                    <div className="muted text-sm mt-0.5">
                      {g.description || "Без описания"} • Аспирантов: {g._count?.members ?? 0} • Занятий: {g._count?.lessons ?? 0}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy} className="btn btnSecondary" onClick={() => startEditGroup(g)}>Редактировать</button>
                    <button disabled={busy} className="btn btnDanger" onClick={() => removeGroup(g.id)}>Удалить</button>
                  </div>
                </div>
              )}
            </div>
          ))}
          {groups.length === 0 && <div className="text-center muted py-4">Групп пока нет</div>}
        </div>
      </SectionCard>

      <SectionCard title="Аттестации">
        <div className="panel mb-6">
          <label className="label">Аспирант</label>
          <select
            className="select w-full max-w-md"
            value={selectedPgId}
            onChange={(e) => { setSelectedPgId(e.target.value); resetAttestationForm(); }}
          >
            <option value="">— выберите —</option>
            {postgraduates.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.login})</option>
            ))}
          </select>
        </div>

        {selectedPgId && (
          <>
            <div className="panel mb-6">
              <h3 className="text-sm font-extrabold text-slate-900 mb-4">
                {editingAttestationId ? "Редактирование аттестации" : "Новая аттестация"}
              </h3>
              <div className="grid md:grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Период / экзамен"
                  value={attestationForm.periodLabel}
                  onChange={(e) => setAttestationForm((p) => ({ ...p, periodLabel: e.target.value }))}
                />
                <select
                  className="select"
                  value={attestationForm.decision}
                  onChange={(e) => setAttestationForm((p) => ({ ...p, decision: e.target.value }))}
                >
                  {ATTESTATION_DECISION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <input
                  type="date"
                  className="input"
                  value={attestationForm.attestedAt}
                  onChange={(e) => setAttestationForm((p) => ({ ...p, attestedAt: e.target.value }))}
                />
                <input
                  className="input"
                  placeholder="Примечания"
                  value={attestationForm.notes}
                  onChange={(e) => setAttestationForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 mt-4">
                <button disabled={busy} className="btn btnPrimary" onClick={saveAttestation}>
                  {editingAttestationId ? "Сохранить" : "Добавить"}
                </button>
                {editingAttestationId && (
                  <button disabled={busy} className="btn btnSecondary" onClick={resetAttestationForm}>Отмена</button>
                )}
              </div>
            </div>

            <div className="space-y-3">
              {attestations.map((a) => (
                <div key={a.id} className="panel flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                  <div>
                    <div className="font-extrabold text-slate-900">{a.periodLabel}</div>
                    <div className="muted text-sm mt-0.5">
                      {getAttestationDecisionLabel(a.decision)} • {a.attestedAt || "дата не указана"}
                      {a.notes ? ` • ${a.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button disabled={busy} className="btn btnSecondary" onClick={() => startEditAttestation(a)}>Редактировать</button>
                    <button disabled={busy} className="btn btnDanger" onClick={() => removeAttestation(a.id)}>Удалить</button>
                  </div>
                </div>
              ))}
              {attestations.length === 0 && <div className="text-center muted py-4">Записей нет</div>}
            </div>
          </>
        )}
      </SectionCard>

      <SectionCard title="Администрирование пользователей">
        <div className="panel mb-8">
          <h3 className="text-sm font-extrabold text-slate-900 mb-4">Создать пользователя</h3>
          <div className="grid md:grid-cols-5 gap-3 items-end">
            <input
              className="input"
              placeholder="Логин"
              value={form.login}
              onChange={(e) => setForm({ ...form, login: e.target.value })}
            />
            <input
              className="input"
              placeholder="Пароль"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
            <input
              className="input"
              placeholder="ФИО"
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
            />
            <select
              className="select"
              value={form.role}
              onChange={(e) => setForm({
                ...form,
                role: e.target.value,
                ...professorFieldsForRole(e.target.value),
              })}
            >
              <option value="postgraduate">Аспирант</option>
              <option value="professor">Профессор</option>
              <option value="admin">Администратор</option>
            </select>
            <button
              disabled={busy}
              className="btn btnPrimary w-full"
              onClick={add}
            >
              Добавить
            </button>
            {form.role === "professor" && (
              <>
                <input
                  className="input md:col-span-2"
                  placeholder="Учётный номер"
                  value={form.tabNumber}
                  onChange={(e) => setForm({ ...form, tabNumber: e.target.value })}
                />
                <input
                  className="input md:col-span-3"
                  placeholder="Должность"
                  value={form.position}
                  onChange={(e) => setForm({ ...form, position: e.target.value })}
                />
              </>
            )}
          </div>
        </div>

        {editingId && editForm && (
          <div className="panel mb-8">
            <div className="flex items-center justify-between gap-3 mb-4">
              <h3 className="text-sm font-extrabold text-slate-900">Редактирование пользователя #{editingId}</h3>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className="btn btnPrimary"
                  onClick={saveEdit}
                >
                  Сохранить
                </button>
                <button
                  disabled={busy}
                  className="btn btnSecondary"
                  onClick={cancelEdit}
                >
                  Отмена
                </button>
              </div>
            </div>
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <input
                className="input"
                placeholder="Логин"
                value={editForm.login}
                onChange={(e) => setEditForm((p) => ({ ...p, login: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Новый пароль (опционально)"
                value={editForm.password}
                onChange={(e) => setEditForm((p) => ({ ...p, password: e.target.value }))}
              />
              <input
                className="input"
                placeholder="ФИО"
                value={editForm.fullName}
                onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
              />
              <select
                className="select"
                value={editForm.role}
                onChange={(e) => setEditForm((p) => ({
                  ...p,
                  role: e.target.value,
                  ...(e.target.value === "professor" ? {} : { tabNumber: "", position: "" }),
                }))}
              >
                <option value="postgraduate">Аспирант</option>
                <option value="professor">Профессор</option>
                <option value="admin">Администратор</option>
              </select>
              <select
                className="select"
                value={editForm.groupId}
                onChange={(e) => setEditForm((p) => ({ ...p, groupId: e.target.value }))}
              >
                <option value="">— без группы —</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
              <input
                className="input"
                placeholder="Email"
                value={editForm.email}
                onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
              />
              <input
                className="input"
                placeholder="Телефон"
                value={editForm.phone}
                onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
              />
              {editForm.role === "professor" && (
                <>
                  <input
                    className="input"
                    placeholder="Учётный номер"
                    value={editForm.tabNumber}
                    onChange={(e) => setEditForm((p) => ({ ...p, tabNumber: e.target.value }))}
                  />
                  <input
                    className="input md:col-span-2"
                    placeholder="Должность"
                    value={editForm.position}
                    onChange={(e) => setEditForm((p) => ({ ...p, position: e.target.value }))}
                  />
                </>
              )}
            </div>
            <p className="muted text-xs mt-3">
              Пароль меняется только если заполнить поле «Новый пароль».
            </p>
          </div>
        )}

        <div className="space-y-3">
          {users.map((u) => (
            <div key={u.id} className="panel flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div>
                <div className="font-extrabold text-slate-900 text-[15px]">{u.fullName}</div>
                <div className="muted text-sm mt-0.5">
                  Логин: <span className="font-semibold" style={{ color: "var(--primary)" }}>{u.login}</span> • Роль:{" "}
                  <span className="font-semibold">{getRoleLabel(u.role)}</span>
                  {u.groupName ? <> • Группа: {u.groupName}</> : null}
                  {u.role === "professor" && u.tabNumber ? (
                    <> • № {u.tabNumber}</>
                  ) : null}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  disabled={busy}
                  className="btn btnSecondary"
                  onClick={() => startEdit(u)}
                >
                  Редактировать
                </button>
                <button
                  disabled={busy}
                  className="btn btnDanger"
                  onClick={() => remove(u.id)}
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div className="text-center muted py-4">Список пользователей пуст</div>}
        </div>
      </SectionCard>
    </div>
  );
}
