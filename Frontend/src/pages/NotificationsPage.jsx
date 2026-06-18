import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";

export default function NotificationsPage() {
  const [rows, setRows] = useState([]);

  const load = async () => {
    try {
      setRows((await api.get("/notifications")).data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <SectionCard
      title="Ваши уведомления"
      right={
        <button
          type="button"
          className="rounded-xl px-4 py-2 font-medium text-sm border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
          onClick={async () => {
            try {
              await api.post("/notifications/read-all");
              toast.success("Все уведомления прочитаны");
              await load();
            } catch (e) {
              toast.error(getErrorMessage(e));
            }
          }}
        >
          Прочитать все
        </button>
      }
    >
      <div className="space-y-4">
        {rows.map((n) => (
          <div key={n.id} className="p-4 rounded-xl border border-slate-700/60 bg-slate-900/40 hover:bg-slate-800/40 transition-colors">
            <div className="font-semibold text-slate-100 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-sky-400"></span>
              {n.title || "Уведомление"}
            </div>
            <div className="text-slate-300 mt-2 text-[15px]">{n.text || n.body || n.message || "-"}</div>
            {n.createdAt && <div className="text-xs text-slate-500 mt-3">{new Date(n.createdAt).toLocaleString()}</div>}
          </div>
        ))}
        {!rows.length && (
          <div className="text-center py-10">
            <div className="text-4xl mb-4">📭</div>
            <p className="text-slate-400">Уведомлений пока нет.</p>
          </div>
        )}
      </div>
    </SectionCard>
  );
}
