import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api, { getErrorMessage } from "../api/client";
import SectionCard from "../components/SectionCard";
import SimpleTable from "../components/SimpleTable";

import { ATTESTATION_DECISION_OPTIONS, getAttestationDecisionLabel } from "../utils/labels";

const emptyAttestationForm = {
  periodLabel: "",
  decision: "pending",
  notes: "",
  attestedAt: "",
};

export default function SupervisorPage() {
  const [rows, setRows] = useState([]);
  const [selectedYear, setSelectedYear] = useState("2026-2027");
  const [selectedPgId, setSelectedPgId] = useState("");
  const [pgData, setPgData] = useState(null);
  const [attestationForm, setAttestationForm] = useState(emptyAttestationForm);
  const [editingAttestationId, setEditingAttestationId] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setRows((await api.get("/supervisor/supervisions")).data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const loadPostgraduate = async (userId) => {
    if (!userId) {
      setPgData(null);
      return;
    }
    try {
      const { data } = await api.get(`/supervisor/postgraduate/${userId}`);
      setPgData(data);
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadPostgraduate(selectedPgId);
    setAttestationForm(emptyAttestationForm);
    setEditingAttestationId(null);
  }, [selectedPgId]);

  const riskRows = rows.map((r, idx) => ({
    id: r?.supervision?.id || idx + 1,
    postgraduate: r?.postgraduate?.fullName || "—",
    groupName: r?.postgraduate?.groupName || "—",
    topic: r?.latestTopic?.title || "—",
    risk: r?.latestTopic?.status === "approved" ? "В норме" : "Риск",
  }));

  const bulkApprove = async () => {
    try {
      const { data } = await api.post("/supervisor/plans/bulk-approve", { academicYear: selectedYear });
      toast.success(`Подтверждено планов: ${data.updated || 0}`);
    } catch (e) {
      toast.error(getErrorMessage(e));
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
        periodLabel: attestationForm.periodLabel.trim(),
        decision: attestationForm.decision || null,
        notes: attestationForm.notes || null,
        attestedAt: attestationForm.attestedAt || null,
      };
      if (editingAttestationId) {
        await api.patch(`/supervisor/attestations/${editingAttestationId}`, payload);
        toast.success("Аттестация обновлена");
      } else {
        await api.post("/supervisor/attestations", {
          postgraduateId: Number(selectedPgId),
          ...payload,
        });
        toast.success("Аттестация добавлена");
      }
      resetAttestationForm();
      await loadPostgraduate(selectedPgId);
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
      await api.delete(`/supervisor/attestations/${id}`);
      toast.success("Аттестация удалена");
      await loadPostgraduate(selectedPgId);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const attestationRows = (pgData?.attestations || []).map((a) => ({
    id: a.id,
    periodLabel: a.periodLabel,
    decision: getAttestationDecisionLabel(a.decision),
    attestedAt: a.attestedAt || "—",
    notes: a.notes || "—",
  }));

  return (
    <div className="space-y-6">
      <SectionCard title="Кабинет научного руководителя">
        <div className="bg-slate-900/40 border border-slate-700/60 rounded-xl p-5 gap-4 grid md:grid-cols-2 lg:grid-cols-3 items-center">
          <select
            className="w-full rounded-xl border border-slate-600/60 bg-slate-950/60 text-slate-100 px-4 py-2.5 text-sm focus:outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20 shadow-inner"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
          >
            <option value="2025-2026">2025-2026 год</option>
            <option value="2026-2027">2026-2027 год</option>
            <option value="2027-2028">2027-2028 год</option>
          </select>
          <button
            className="w-full rounded-xl px-5 py-2.5 text-sm font-semibold border border-transparent bg-sky-400 font-medium text-slate-950 shadow-[0_8px_24px_rgba(56,189,248,0.25)] hover:shadow-[0_10px_28px_rgba(56,189,248,0.35)] hover:brightness-105 transition-all text-center"
            onClick={bulkApprove}
          >
            Подтвердить отчеты группы
          </button>
          <button
            className="w-full rounded-xl px-5 py-2.5 text-sm font-medium border border-slate-600 bg-slate-800/80 hover:bg-slate-700 hover:border-slate-500 text-slate-200 transition-colors"
            onClick={load}
          >
            Обновить данные
          </button>
        </div>
      </SectionCard>

      <SectionCard title="Список ведомых и мониторинг рисков">
        <SimpleTable rows={riskRows} />
      </SectionCard>

      <SectionCard title="Аттестации аспирантов">
        <div className="panel mb-6">
          <label className="label">Аспирант</label>
          <select
            className="select w-full max-w-md"
            value={selectedPgId}
            onChange={(e) => setSelectedPgId(e.target.value)}
          >
            <option value="">— выберите —</option>
            {rows.map((r) => (
              r?.postgraduate ? (
                <option key={r.postgraduate.id} value={r.postgraduate.id}>
                  {r.postgraduate.fullName}
                </option>
              ) : null
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

            <SimpleTable rows={attestationRows} />

            {(pgData?.attestations || []).length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {pgData.attestations.map((a) => (
                  <div key={a.id} className="flex gap-2">
                    <button disabled={busy} className="btn btnSecondary text-xs" onClick={() => startEditAttestation(a)}>
                      Изм. #{a.id}
                    </button>
                    <button disabled={busy} className="btn btnDanger text-xs" onClick={() => removeAttestation(a.id)}>
                      Удал. #{a.id}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  );
}
