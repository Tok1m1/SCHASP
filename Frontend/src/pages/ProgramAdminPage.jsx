import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

export default function ProgramAdminPage() {
  const [overview, setOverview] = useState(null);
  const [postgraduates, setPostgraduates] = useState([]);
  const [overdue, setOverdue] = useState([]);
  const [docType, setDocType] = useState("gibdd");
  const [personName, setPersonName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const [o, p, red] = await Promise.all([
          api.get("/program-admin/overview"),
          api.get("/program-admin/postgraduates"),
          api.get("/program-admin/milestones/overdue"),
        ]);
        if (!cancelled) {
          setOverview(o.data);
          setPostgraduates(p.data);
          setOverdue(red.data || []);
        }
      } catch (e) {
        if (!cancelled) {
          setError(getErrorMessage(e));
          toast.error("Не удалось загрузить данные");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const copyReference = async (text) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        toast.success("Справка скопирована в буфер обмена");
        return;
      }
    } catch {
      /* fallback below */
    }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      toast.success("Справка скопирована в буфер обмена");
    } catch {
      window.prompt("Скопируйте текст справки:", text);
    }
  };

  const counts = overview?.counts || {};
  const pgRows = postgraduates.map((item, idx) => ({
    id: item?.user?.id ?? idx + 1,
    fullName: item?.user?.fullName ?? "—",
    groupName: item?.user?.groupName ?? "—",
    email: item?.user?.email ?? "—",
    specialty: item?.profile?.specialtyCode ?? "—",
    department: item?.profile?.department ?? "—",
    overdueMilestones: item?.overdueMilestones ?? 0,
    hasPlanPendingApproval: item?.hasPlanPendingApproval ? "Да" : "Нет",
  }));
  const generatedReference = `СПРАВКА\nТип: ${docType}\nФИО: ${personName || "Не указано"}\nДата: ${new Date().toLocaleDateString()}\nСтатус: обучается в аспирантуре`;

  if (loading) {
    return (
      <SectionCard title="Администратор программы">
        <p className="text-slate-400 text-sm">Загрузка данных…</p>
      </SectionCard>
    );
  }

  if (error) {
    return (
      <SectionCard title="Администратор программы">
        <p className="text-rose-300 text-sm">{error}</p>
      </SectionCard>
    );
  }

  return (
    <div className="space-y-6">
      <SectionCard title="Сводка по аспирантуре">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <Metric title="Всего пользователей" value={counts.usersTotal} />
          <Metric title="Аспирантов" value={counts.postgraduates} />
          <Metric title="Профессоров" value={counts.professors} />
          <Metric title="Просроченных вех" value={counts.overdueMilestones} highlight={counts.overdueMilestones > 0} />
          <Metric title="Планов на согласовании" value={counts.plansPendingApproval} />
          <Metric title="Документов на проверке" value={counts.documentsOnReview} />
        </div>
        <p className="text-slate-400 text-xs mt-4 italic">
          Данные сформированы: {overview?.generatedAt ? new Date(overview.generatedAt).toLocaleString() : "—"}
        </p>
      </SectionCard>

      <SectionCard title="Список аспирантов">
        <SimpleTable rows={pgRows} />
      </SectionCard>

      <SectionCard title="Мониторинг неуспевающих — Красная зона">
        {overdue.length > 0 ? (
          <div className="rounded-xl border border-rose-900/40 bg-rose-950/20 overflow-hidden">
            <SimpleTable
              rows={overdue.map((m, idx) => ({
                id: m.id || idx + 1,
                owner: m.owner?.fullName || "—",
                groupName: m.owner?.groupName || "—",
                title: m.title,
                dueDate: new Date(m.dueDate).toLocaleDateString(),
                status: m.status,
              }))}
            />
          </div>
        ) : (
          <div className="bg-emerald-950/20 border border-emerald-900/40 rounded-xl p-4 text-emerald-300/80 text-sm text-center">
            Нет просроченных вех. Все аспиранты идут по плану.
          </div>
        )}
      </SectionCard>

      <SectionCard title="Конструктор справок">
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 mb-5">
          <div className="grid md:grid-cols-3 gap-3">
            <select 
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner" 
              value={docType} 
              onChange={(e) => setDocType(e.target.value)}
            >
              <option value="Для военкомата/отсрочка">Для военкомата/отсрочка</option>
              <option value="Для соцзащиты">Для соцзащиты</option>
              <option value="По месту требования">По месту требования</option>
            </select>
            <input
              className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm placeholder:text-slate-500 focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
              placeholder="ФИО аспиранта"
              value={personName}
              onChange={(e) => setPersonName(e.target.value)}
            />
            <button 
              type="button" 
              className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center" 
              onClick={() => copyReference(generatedReference)}
            >
              Копировать справку
            </button>
          </div>
        </div>
        <div className="bg-slate-950/60 border border-slate-700/80 rounded-xl p-5 font-mono text-sm text-sky-100 leading-relaxed shadow-inner">
          <pre className="whitespace-pre-wrap">{generatedReference}</pre>
        </div>
      </SectionCard>
    </div>
  );
}

function Metric({ title, value, highlight }) {
  return (
    <div className={`rounded-[0.9rem] p-4 border transition-colors ${
      highlight 
        ? "border-rose-500/50 bg-gradient-to-br from-rose-900/40 to-rose-950/40 hover:border-rose-400/60" 
        : "border-slate-600/70 bg-gradient-to-br from-slate-900/80 to-slate-800/70 hover:border-sky-400/50"
    }`}>
      <p className={`text-[10px] uppercase tracking-wider font-semibold ${highlight ? "text-rose-300" : "text-slate-400"}`}>{title}</p>
      <p className={`text-2xl font-black mt-2 drop-shadow-md ${highlight ? "text-rose-100" : "text-sky-100"}`}>{value ?? 0}</p>
    </div>
  );
}
