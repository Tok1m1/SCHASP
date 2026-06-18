import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";
import {
  getAttendanceStatusLabel,
  JOURNAL_ATTENDANCE_COLUMN_LABELS,
  JOURNAL_ATTENDANCE_COLUMNS,
  JOURNAL_GRADE_COLUMN_LABELS,
  JOURNAL_GRADE_COLUMNS,
} from "../utils/labels";

export default function JournalPage() {
  const { user } = useAuthStore();
  const [selectedDate, setSelectedDate] = useState("");
  const [lessons, setLessons] = useState([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [groups, setGroups] = useState([]);
  const [selectedGroup, setSelectedGroup] = useState("");
  const [entry, setEntry] = useState(null);
  const [rows, setRows] = useState([]);

  const [myAttendance, setMyAttendance] = useState([]);
  const [myGrades, setMyGrades] = useState([]);
  const [busy, setBusy] = useState(false);

  const canWrite = user?.role === "admin" || user?.role === "professor";
  const isPostgraduate = user?.role === "postgraduate";

  const resetSelection = () => {
    setLessons([]);
    setSelectedLessonId("");
    setGroups([]);
    setSelectedGroup("");
    setEntry(null);
    setRows([]);
  };

  useEffect(() => {
    (async () => {
      try {
        if (isPostgraduate) {
          resetSelection();
          const [att, gr] = await Promise.all([api.get("/journal/my-attendance"), api.get("/journal/my-grades")]);
          setMyAttendance(att.data || []);
          setMyGrades(gr.data || []);
        } else {
          setMyAttendance([]);
          setMyGrades([]);
        }
      } catch (e) {
        toast.error(getErrorMessage(e));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadLessons = async (date) => {
    try {
      setBusy(true);
      setLessons((await api.get("/journal/lessons", { params: { date } })).data || []);
      setSelectedLessonId("");
      setGroups([]);
      setSelectedGroup("");
      setEntry(null);
      setRows([]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const loadGroups = async (lessonId) => {
    try {
      setBusy(true);
      setGroups((await api.get("/journal/groups", { params: { lessonId } })).data || []);
      setSelectedGroup("");
      setEntry(null);
      setRows([]);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const loadEntry = async (lessonId, groupName) => {
    try {
      setBusy(true);
      const { data } = await api.get("/journal/entry", { params: { lessonId, groupName } });
      setEntry(data);
      const nextRows = (data?.students || []).map((s) => ({
        postgraduateId: s.id,
        fullName: s.fullName,
        groupName: s.groupName,
        status: data?.attendanceByPostgraduateId?.[s.id]?.status || "unknown",
        grade: data?.gradesByPostgraduateId?.[s.id]?.grade || "",
        comment: data?.gradesByPostgraduateId?.[s.id]?.comment || "",
      }));
      setRows(nextRows);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (postgraduateId, status) => {
    setRows((p) => p.map((r) => (r.postgraduateId === postgraduateId ? { ...r, status } : r)));
  };

  const setGrade = (postgraduateId, grade) => {
    setRows((p) => p.map((r) => (r.postgraduateId === postgraduateId ? { ...r, grade } : r)));
  };

  const setComment = (postgraduateId, comment) => {
    setRows((p) => p.map((r) => (r.postgraduateId === postgraduateId ? { ...r, comment } : r)));
  };

  const saveEntry = async () => {
    if (!selectedLessonId || !selectedGroup) {
      toast.error("Выберите занятие и группу");
      return;
    }
    try {
      setBusy(true);
      await api.post("/journal/entry", {
        lessonId: Number(selectedLessonId),
        groupName: selectedGroup,
        rows: rows.map((r) => ({
          postgraduateId: r.postgraduateId,
          status: r.status,
          grade: r.grade,
          comment: r.comment,
        })),
      });
      toast.success("Журнал сохранён");
      await loadEntry(Number(selectedLessonId), selectedGroup);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const lessonLabel = useMemo(() => {
    const l = lessons.find((x) => String(x.id) === String(selectedLessonId));
    if (!l) return "";
    return `${l.subject} • ${l.date} • ${l.time} • ${l.teacher?.fullName || l.teacher || ""}`.trim();
  }, [lessons, selectedLessonId]);

  return (
    <SectionCard title="Журнал (посещаемость и оценки)">
      {isPostgraduate ? (
        <div className="space-y-6">
          <div className="panel">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4">Моя посещаемость</h3>
          <div className="tableWrap">
            <table className="table">
              <thead className="thead">
                <tr className="tr">
                  {JOURNAL_ATTENDANCE_COLUMNS.map((k) => (
                    <th key={k} className="th">
                      {JOURNAL_ATTENDANCE_COLUMN_LABELS[k]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="tbody">
                {(myAttendance || []).map((m, idx) => (
                  <tr key={m.id || idx} className="tr">
                    <td className="td">{m?.lesson?.date || "—"}</td>
                    <td className="td">{m?.lesson?.time || "—"}</td>
                    <td className="td">{m?.lesson?.subject || "—"}</td>
                    <td className="td">{m?.lesson?.teacher?.fullName || "—"}</td>
                    <td className="td">{getAttendanceStatusLabel(m?.status || "unknown")}</td>
                  </tr>
                ))}
                {!myAttendance?.length && (
                  <tr>
                    <td colSpan={5} className="td text-center" style={{ color: "rgba(15,23,42,0.60)", padding: "2rem 0.85rem" }}>
                      Нет отметок.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
          <div className="panel">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4">Мои оценки</h3>
            <div className="tableWrap">
              <table className="table">
                <thead className="thead">
                  <tr className="tr">
                    {JOURNAL_GRADE_COLUMNS.map((k) => (
                      <th key={k} className="th">
                        {JOURNAL_GRADE_COLUMN_LABELS[k]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="tbody">
                  {(myGrades || []).map((g, idx) => (
                    <tr key={g.id || idx} className="tr">
                      <td className="td">{g?.lesson?.date || "—"}</td>
                      <td className="td">{g?.lesson?.subject || "—"}</td>
                      <td className="td">{g?.lesson?.teacher?.fullName || "—"}</td>
                      <td className="td">{g?.grade || "—"}</td>
                    </tr>
                  ))}
                  {!myGrades?.length && (
                    <tr>
                      <td colSpan={4} className="td text-center" style={{ color: "rgba(15,23,42,0.60)", padding: "2rem 0.85rem" }}>
                        Оценок пока нет.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : canWrite ? (
        <div className="space-y-6">
          <div className="panel">
            <h3 className="text-sm font-extrabold text-slate-900 mb-4">Выбор занятия</h3>
            <div className="grid md:grid-cols-3 gap-3 items-end">
              <div className="md:col-span-1">
                <label className="label">Дата</label>
                <input
                  type="date"
                  className="input"
                  value={selectedDate}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedDate(v);
                    if (v) loadLessons(v);
                    else resetSelection();
                  }}
                />
              </div>
              <div className="md:col-span-1">
                <label className="label">Занятие</label>
                <select
                  className="select"
                  value={selectedLessonId}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedLessonId(v);
                    setSelectedGroup("");
                    setEntry(null);
                    setRows([]);
                    setGroups([]);
                    if (v) loadGroups(Number(v));
                  }}
                  disabled={!selectedDate || busy}
                >
                  <option value="">Выберите занятие</option>
                  {lessons.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.subject} • {l.time}
                    </option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-1">
                <label className="label">Группа</label>
                <select
                  className="select"
                  value={selectedGroup}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSelectedGroup(v);
                    setEntry(null);
                    setRows([]);
                    if (v && selectedLessonId) loadEntry(Number(selectedLessonId), v);
                  }}
                  disabled={!selectedLessonId || busy}
                >
                  <option value="">Выберите группу</option>
                  {groups.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {!!lessonLabel && (
              <p className="text-xs muted mt-3">
                Выбрано: <span className="text-slate-900 font-semibold">{lessonLabel}</span>
              </p>
            )}
          </div>

          {!!entry && (
            <div className="panel">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-extrabold text-slate-900">Журнал группы: {selectedGroup}</h3>
                <button
                  disabled={busy}
                  className="btn btnPrimary"
                  onClick={saveEntry}
                >
                  Сохранить
                </button>
              </div>

              <div className="space-y-2">
                {rows.map((r) => (
                  <div key={r.postgraduateId} className="panel">
                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                      <div className="flex-1">
                        <div className="text-slate-900 font-extrabold text-sm">{r.fullName}</div>
                        <div className="muted text-xs">{r.groupName || "—"}</div>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setStatus(r.postgraduateId, "present")}
                          className={`btn ${r.status === "present" ? "btnSecondary" : "btnGhost"}`}
                          style={r.status === "present" ? { borderColor: "rgba(16,185,129,0.28)", background: "rgba(16,185,129,0.10)" } : undefined}
                        >
                          Присутствовал
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(r.postgraduateId, "absent")}
                          className={`btn ${r.status === "absent" ? "btnSecondary" : "btnGhost"}`}
                          style={r.status === "absent" ? { borderColor: "rgba(239,68,68,0.28)", background: "rgba(239,68,68,0.10)" } : undefined}
                        >
                          Отсутствовал
                        </button>
                        <button
                          type="button"
                          onClick={() => setStatus(r.postgraduateId, "unknown")}
                          className={`btn ${r.status === "unknown" ? "btnSecondary" : "btnGhost"}`}
                          style={r.status === "unknown" ? { borderColor: "rgba(245,158,11,0.28)", background: "rgba(245,158,11,0.10)" } : undefined}
                        >
                          Не отмечено
                        </button>
                      </div>
                    </div>

                    <div className="grid md:grid-cols-2 gap-3 mt-3">
                      <input
                        className="input"
                        placeholder="Оценка (например: 5 / зачёт / не зачёт)"
                        value={r.grade}
                        onChange={(e) => setGrade(r.postgraduateId, e.target.value)}
                      />
                      <input
                        className="input"
                        placeholder="Комментарий (опционально)"
                        value={r.comment}
                        onChange={(e) => setComment(r.postgraduateId, e.target.value)}
                      />
                    </div>
                  </div>
                ))}
                {!rows.length && <div className="muted text-sm">Нет аспирантов в группе.</div>}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="emptyState">
          Раздел недоступен для вашей роли.
        </div>
      )}
    </SectionCard>
  );
}
