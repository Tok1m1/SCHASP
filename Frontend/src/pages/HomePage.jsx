import { useMemo } from "react";
import SectionCard from "../components/SectionCard";
import { useAuthStore } from "../store/authStore";
import { getRoleLabel } from "../utils/labels";

export default function HomePage() {
  const { user } = useAuthStore();
  const roleSummary = useMemo(() => {
    if (!user) return null;
    if (user.role === "admin") {
      return {
        title: `Роль: ${getRoleLabel(user.role).toLowerCase()}`,
        items: [
          "Управление пользователями, группами и аттестациями",
          "Формирование и корректировка расписания",
          "Учёт занятий",
        ],
      };
    }
    if (user.role === "postgraduate") {
      return {
        title: `Роль: ${getRoleLabel(user.role).toLowerCase()}`,
        items: ["Просмотр расписания занятий", "Доступ к личному кабинету", "Просмотр оценок/аттестаций (при наличии)"],
      };
    }
    if (user.role === "professor") {
      return {
        title: `Роль: ${getRoleLabel(user.role).toLowerCase()}`,
        items: ["Просмотр расписания занятий", "Ведение журнала посещаемости и оценок", "Аттестации ведомых аспирантов"],
      };
    }
    return {
      title: `Роль: ${getRoleLabel(user.role)}`,
      items: ["Демо-режим: интерфейс адаптирован под роли admin и postgraduate."],
    };
  }, [user]);

  return (
    <div className="space-y-6">
      {roleSummary && (
        <SectionCard title={roleSummary.title}>
          <ul className="grid sm:grid-cols-2 gap-3">
            {roleSummary.items.map((t) => (
              <li
                key={t}
                className="panel flex items-center gap-3"
              >
                <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }}></span>
                <span className="text-slate-900">{t}</span>
              </li>
            ))}
          </ul>
        </SectionCard>
      )}

      <SectionCard title="О платформе">
        <div className="grid md:grid-cols-3 gap-5">
          <div className="md:col-span-3">
            <p className="text-slate-300 leading-relaxed max-w-4xl text-[15px]">
              Программный модуль для ведения расписания и учёта занятий в аспирантуре. Система поддерживает разграничение
              доступа по ролям и обеспечивает фиксацию учебных событий и отметок посещаемости.
            </p>
          </div>
          <Feature title="Ролевой доступ" text="Роли admin и postgraduate, доступ к разделам ограничен правами." />
          <Feature title="Расписание" text="Хранение и просмотр расписания занятий с фильтрацией по датам." />
          <Feature title="Учёт занятий" text="Отметка посещаемости по конкретному занятию и сохранение в базе данных." />
        </div>
      </SectionCard>

      <SectionCard title="Что доступно сейчас">
        <ul className="grid sm:grid-cols-2 gap-3">
          <li className="panel flex items-center gap-3">
             <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }}></span>
             <span className="text-slate-900">Личный кабинет и редактирование профиля</span>
          </li>
          <li className="panel flex items-center gap-3">
             <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }}></span>
             <span className="text-slate-900">Просмотр расписания и оценок (если заведены)</span>
          </li>
          <li className="panel flex items-center gap-3">
             <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }}></span>
             <span className="text-slate-900">Управление пользователями и ролями</span>
          </li>
          <li className="panel flex items-center gap-3">
             <span className="w-2 h-2 rounded-full" style={{ background: "var(--primary)" }}></span>
             <span className="text-slate-900">Учёт занятий (посещаемость) по расписанию</span>
          </li>
        </ul>
      </SectionCard>
    </div>
  );
}

function Feature({ title, text }) {
  return (
    <article className="panel hover:-translate-y-0.5 transition-transform">
      <h3 className="text-slate-900 font-extrabold mb-2">{title}</h3>
      <p className="text-sm muted leading-relaxed">{text}</p>
    </article>
  );
}
