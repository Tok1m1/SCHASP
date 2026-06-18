import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";

const weekdayNames = ['Воскресенье', 'Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота'];

const lessonStatusLabels = {
  normal: "Обычное",
  cancelled: "Отменено",
  substituted: "Заменено",
};

function emptyLessonFields() {
  return { status: "normal", substituteTeacherId: "" };
}

function formatRuDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (!y || !m || !d) return String(iso);
  return `${d}.${m}.${y}`;
}

function weekdayRuFromIso(iso) {
  if (!iso) return "—";
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  return weekdayNames[d.getDay()] || "—";
}

export default function SchedulePage() {
  const { user } = useAuthStore();
  const [rows, setRows] = useState([]);
  const [filters, setFilters] = useState({ from: "", to: "" });
  const [busy, setBusy] = useState(false);
  const isAdmin = user?.role === "admin";

  const [groupsList, setGroupsList] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [form, setForm] = useState({ groupId: "", teacherId: "", date: "", time: "", subject: "", auditorium: "", ...emptyLessonFields() });
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(null);
  /** ETag по ключу (пользователь + фильтры дат) для условного GET /schedule */
  const scheduleEtagByKeyRef = useRef({});
  const csvInputRef = useRef(null);

  const load = async () => {
    try {
      const params = {};
      if (filters.from) params.from = filters.from;
      if (filters.to) params.to = filters.to;

      const cacheKey = [
        user?.id ?? "",
        user?.role ?? "",
        user?.groupId ?? "",
        filters.from,
        filters.to,
      ].join("|");

      const headers = {};
      const prevEtag = scheduleEtagByKeyRef.current[cacheKey];
      if (prevEtag) {
        headers["If-None-Match"] = prevEtag;
      }

      const res = await api.get("/schedule", {
        params,
        headers,
        validateStatus: (s) => (s >= 200 && s < 300) || s === 304,
      });

      if (res.status === 304) {
        return;
      }

      setRows(res.data);
      const etag = res.headers?.etag;
      if (etag) {
        scheduleEtagByKeyRef.current = {
          ...scheduleEtagByKeyRef.current,
          [cacheKey]: etag,
        };
      }
      toast.success("Расписание обновлено", { id: "refresh" });
    } catch (e) {
      toast.error(getErrorMessage(e), { id: "refresh" });
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const [gs, ts] = await Promise.all([
          api.get("/admin/groups"),
          api.get("/admin/users", { params: { role: "professor" } })
        ]);
        setGroupsList(gs.data || []);
        setTeachers(ts.data || []);
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    })();
  }, [isAdmin]);

  const grouped = useMemo(() => {
    // Normalize groupName per role
    const groups = new Map();
    rows.forEach((r) => {
      const groupName = user?.role === "postgraduate"
        ? (user?.groupName || "Моя группа")
        : (r?.group?.name || "Без группы");

      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(r);
    });

    const groupNames = Array.from(groups.keys()).sort((a, b) => String(a).localeCompare(String(b), "ru"));
    const result = groupNames.map((name) => {
      const list = groups.get(name) || [];
      list.sort((a, b) => {
        const da = a?.date || "";
        const db = b?.date || "";
        if (da !== db) return String(da).localeCompare(String(db));
        return String(a?.time || "").localeCompare(String(b?.time || ""));
      });
      return [name, list];
    });
    return result;
  }, [rows, user]);

  const addLesson = async () => {
    if (!form.groupId || !form.teacherId || !form.date || !form.time || !form.subject) {
      toast.error("Заполните группу, преподавателя, дату, время и занятие");
      return;
    }
    if (form.status === "substituted" && !form.substituteTeacherId) {
      toast.error("Укажите заменяющего преподавателя");
      return;
    }
    try {
      setBusy(true);
      await api.post("/schedule", {
        groupId: Number(form.groupId),
        teacherId: Number(form.teacherId),
        date: form.date,
        time: form.time,
        subject: form.subject,
        auditorium: form.auditorium || null,
        status: form.status,
        substituteTeacherId: form.status === "substituted" ? Number(form.substituteTeacherId) : null,
      });
      toast.success("Занятие добавлено");
      setForm({ groupId: "", teacherId: "", date: "", time: "", subject: "", auditorium: "", ...emptyLessonFields() });
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (lesson) => {
    setEditingId(lesson.id);
    setEditForm({
      groupId: lesson.group?.id || "",
      teacherId: lesson.teacher?.id || "",
      date: lesson.date || "",
      time: lesson.time || "",
      subject: lesson.subject || "",
      auditorium: lesson.auditorium || "",
      status: lesson.status || "normal",
      substituteTeacherId: lesson.substituteTeacher?.id || lesson.substituteTeacherId || "",
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(null);
  };

  const saveEdit = async () => {
    if (!editingId || !editForm) return;
    if (!editForm.groupId || !editForm.teacherId || !editForm.date || !editForm.time || !editForm.subject) {
      toast.error("Заполните группу, преподавателя, дату, время и занятие");
      return;
    }
    if (editForm.status === "substituted" && !editForm.substituteTeacherId) {
      toast.error("Укажите заменяющего преподавателя");
      return;
    }
    try {
      setBusy(true);
      await api.put(`/schedule/${editingId}`, {
        groupId: Number(editForm.groupId),
        teacherId: Number(editForm.teacherId),
        date: editForm.date,
        time: editForm.time,
        subject: editForm.subject,
        auditorium: editForm.auditorium || null,
        status: editForm.status,
        substituteTeacherId: editForm.status === "substituted" ? Number(editForm.substituteTeacherId) : null,
      });
      toast.success("Занятие обновлено");
      cancelEdit();
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const removeLesson = async (id) => {
    if (!confirm("Удалить занятие из расписания?")) return;
    try {
      setBusy(true);
      await api.delete(`/schedule/${id}`);
      toast.success("Удалено");
      await load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const importCsv = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("Выберите файл с расширением .csv");
      return;
    }

    try {
      setBusy(true);
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/schedule/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      scheduleEtagByKeyRef.current = {};
      await load();

      const { created = 0, skipped = 0, errors = [] } = res.data || {};
      const errCount = errors.length;
      let msg = res.data?.message || `Добавлено: ${created}, пропущено: ${skipped}`;
      if (errCount) {
        msg += `. Ошибок в строках: ${errCount}`;
      }
      toast.success(msg, { duration: errCount ? 6000 : 4000 });

      if (errCount) {
        const preview = errors.slice(0, 3).map((e) => `стр. ${e.line}: ${e.message}`).join("; ");
        toast.error(preview + (errCount > 3 ? "…" : ""), { duration: 8000 });
      }
    } catch (e) {
      const data = e?.response?.data;
      if (data?.errors?.length) {
        const preview = data.errors.slice(0, 3).map((err) => `стр. ${err.line}: ${err.message}`).join("; ");
        toast.error(`${data.error || "Ошибка импорта"}: ${preview}`, { duration: 8000 });
      } else {
        toast.error(getErrorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <SectionCard 
      title="Расписание занятий" 
      right={
        <div className="flex flex-wrap gap-2 items-center justify-end">
          <input
            type="date"
            value={filters.from}
            onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))}
            className="input"
            title="С даты"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))}
            className="input"
            title="По дату"
          />
          <button 
            className="btn btnSecondary" 
            onClick={load}
          >
            Обновить
          </button>
        </div>
      }
    >
      {isAdmin && (
        <div className="panel mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900">Управление расписанием (admin)</h3>
            <div className="flex items-center gap-2">
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={importCsv}
              />
              <button
                type="button"
                disabled={busy}
                className="btn btnSecondary text-xs"
                onClick={() => csvInputRef.current?.click()}
              >
                Загрузить из файла
              </button>
            </div>
          </div>
          <p className="text-xs muted mb-4">
            CSV с колонками: Группа; Дата; Время; Занятие; Преподаватель; Аудитория. Дата: ДД.ММ.ГГГГ или ГГГГ-ММ-ДД.
          </p>
          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="label">Группа</label>
              <select
                className="select"
                value={form.groupId}
                onChange={(e) => setForm((p) => ({ ...p, groupId: e.target.value }))}
              >
                <option value="">Выберите группу</option>
                {groupsList.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Преподаватель</label>
              <select
                className="select"
                value={form.teacherId}
                onChange={(e) => setForm((p) => ({ ...p, teacherId: e.target.value }))}
              >
                <option value="">Выберите преподавателя</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Дата</label>
              <input
                type="date"
                className="input"
                value={form.date}
                onChange={(e) => setForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Время</label>
              <input
                className="input"
                placeholder="10:45 – 12:20"
                value={form.time}
                onChange={(e) => setForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <label className="label">Занятие</label>
              <input
                className="input"
                placeholder="Академическое письмо"
                value={form.subject}
                onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Аудитория</label>
              <input
                className="input"
                placeholder="Коллоквиум 405"
                value={form.auditorium}
                onChange={(e) => setForm((p) => ({ ...p, auditorium: e.target.value }))}
              />
            </div>
            <div className="md:col-span-1">
              <button
                disabled={busy}
                className="btn btnPrimary w-full"
                onClick={addLesson}
              >
                Добавить
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="label">Статус занятия</label>
              <select
                className="select"
                value={form.status}
                onChange={(e) => setForm((p) => ({
                  ...p,
                  status: e.target.value,
                  substituteTeacherId: e.target.value === "substituted" ? p.substituteTeacherId : "",
                }))}
              >
                <option value="normal">Обычное</option>
                <option value="cancelled">Отменено</option>
                <option value="substituted">Заменено</option>
              </select>
            </div>
            {form.status === "substituted" && (
              <div className="md:col-span-4">
                <label className="label">Заменяющий преподаватель</label>
                <select
                  className="select"
                  value={form.substituteTeacherId}
                  onChange={(e) => setForm((p) => ({ ...p, substituteTeacherId: e.target.value }))}
                >
                  <option value="">Выберите преподавателя</option>
                  {teachers.filter((t) => String(t.id) !== String(form.teacherId)).map((t) => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}

      {isAdmin && editingId && editForm && (
        <div className="panel mb-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h3 className="text-sm font-extrabold text-slate-900">Редактирование занятия #{editingId}</h3>
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

          <div className="grid md:grid-cols-6 gap-3 items-end">
            <div className="md:col-span-2">
              <label className="label">Группа</label>
              <select className="select"
                value={editForm.groupId}
                onChange={(e) => setEditForm((p) => ({ ...p, groupId: e.target.value }))}
              >
                <option value="">Выберите группу</option>
                {groupsList.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="label">Преподаватель</label>
              <select className="select"
                value={editForm.teacherId}
                onChange={(e) => setEditForm((p) => ({ ...p, teacherId: e.target.value }))}
              >
                <option value="">Выберите преподавателя</option>
                {teachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Дата</label>
              <input type="date" className="input"
                value={editForm.date}
                onChange={(e) => setEditForm((p) => ({ ...p, date: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Время</label>
              <input className="input"
                value={editForm.time}
                onChange={(e) => setEditForm((p) => ({ ...p, time: e.target.value }))}
              />
            </div>
            <div className="md:col-span-3">
              <label className="label">Занятие</label>
              <input className="input"
                value={editForm.subject}
                onChange={(e) => setEditForm((p) => ({ ...p, subject: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Аудитория</label>
              <input className="input"
                value={editForm.auditorium}
                onChange={(e) => setEditForm((p) => ({ ...p, auditorium: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <label className="label">Статус занятия</label>
              <select
                className="select"
                value={editForm.status}
                onChange={(e) => setEditForm((p) => ({
                  ...p,
                  status: e.target.value,
                  substituteTeacherId: e.target.value === "substituted" ? p.substituteTeacherId : "",
                }))}
              >
                <option value="normal">Обычное</option>
                <option value="cancelled">Отменено</option>
                <option value="substituted">Заменено</option>
              </select>
            </div>
            {editForm.status === "substituted" && (
              <div className="md:col-span-4">
                <label className="label">Заменяющий преподаватель</label>
                <select
                  className="select"
                  value={editForm.substituteTeacherId}
                  onChange={(e) => setEditForm((p) => ({ ...p, substituteTeacherId: e.target.value }))}
                >
                  <option value="">Выберите преподавателя</option>
                  {teachers.filter((t) => String(t.id) !== String(editForm.teacherId)).map((t) => (
                    <option key={t.id} value={t.id}>{t.fullName}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      )}
      <div className="space-y-6">
        {grouped.map(([groupName, list]) => (
          <div key={groupName} className="space-y-3">
            <div className="text-slate-900 font-extrabold text-lg">{groupName}</div>
            <div className="tableWrap">
              <table className="table">
                <thead className="thead">
                  <tr className="tr">
                    {["Время", "Дата", "День недели", "Занятие", "Преподаватель", "Статус", "Аудитория"].map((h) => (
                      <th
                        key={h}
                        className="th"
                      >
                        {h}
                      </th>
                    ))}
                    {isAdmin && (
                      <th className="th">
                        Действия
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="tbody">
                  {list.map((r) => (
                    <tr key={r.id} className="tr">
                      <td className="td">{r.time || "—"}</td>
                      <td className="td">{formatRuDate(r.date)}</td>
                      <td className="td">{weekdayRuFromIso(r.date)}</td>
                      <td className="td">{r.subject || "—"}</td>
                      <td className="td">{r.teacher?.fullName || "—"}</td>
                      <td className="td">
                        {lessonStatusLabels[r.status] || lessonStatusLabels.normal}
                        {r.status === "substituted" && r.substituteTeacher?.fullName
                          ? ` (${r.substituteTeacher.fullName})`
                          : ""}
                      </td>
                      <td className="td">{r.auditorium || "—"}</td>
                      {isAdmin && (
                        <td className="td whitespace-nowrap">
                          <div className="flex gap-2">
                            <button
                              disabled={busy}
                              className="btn btnSecondary"
                              onClick={() => startEdit(r)}
                            >
                              Изм.
                            </button>
                            <button
                              disabled={busy}
                              className="btn btnDanger"
                              onClick={() => removeLesson(r.id)}
                            >
                              Удал.
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                  {!list.length && (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="td text-center" style={{ color: "rgba(15,23,42,0.60)", padding: "2rem 0.85rem" }}>
                        Нет занятий.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {!rows.length && (
          <div className="emptyState">
            Нет данных.
          </div>
        )}
      </div>
    </SectionCard>
  );
}
