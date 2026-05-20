"use client";

import { useState } from "react";
import { TASKS, TITLE, SUBTITLE_SUFFIX, type Section } from "@mini/project-plan/lib/tasks";

const PUBLIC_URL = "https://nice-guy-ai.vercel.app/project-plan";

export default function HomePage() {
  const [data, setData] = useState<Section[]>(TASKS);
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggle = (sectionId: string, taskId: number) => {
    setData((prev) =>
      prev.map((s) =>
        s.id === sectionId
          ? {
              ...s,
              tasks: s.tasks.map((t) =>
                t.id === taskId ? { ...t, done: !t.done } : t
              ),
            }
          : s
      )
    );
  };

  const totalTasks = data.reduce((a, s) => a + s.tasks.length, 0);
  const doneTasks = data.reduce(
    (a, s) => a + s.tasks.filter((t) => t.done).length,
    0
  );
  const progressPct = totalTasks ? (doneTasks / totalTasks) * 100 : 0;

  return (
    <main className="project-plan-page">
      <header className="project-plan-hero">
        <h1 className="project-plan-title">{TITLE}</h1>
        <p className="project-plan-subtitle">
          {totalTasks} задач · {SUBTITLE_SUFFIX}
        </p>
      </header>

      <div className="project-plan-progress">
        <div className="project-plan-progress-header">
          <span className="project-plan-progress-label">Прогресс</span>
          <span className="project-plan-progress-numbers">
            {doneTasks}/{totalTasks}
          </span>
        </div>
        <div className="project-plan-progress-track">
          <div
            className="project-plan-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      </div>

      <div className="project-plan-sections">
        {data.map((section) => {
          const sectionDone = section.tasks.filter((t) => t.done).length;
          const isOpen = expandedSection === section.id;
          return (
            <div className="project-plan-section" key={section.id}>
              <button
                type="button"
                className="project-plan-section-header"
                onClick={() => setExpandedSection(isOpen ? null : section.id)}
                aria-expanded={isOpen}
              >
                <div className="project-plan-section-title">
                  <span className="project-plan-section-icon">{section.icon}</span>
                  <span>{section.title}</span>
                  <span className="project-plan-section-count">
                    {sectionDone}/{section.tasks.length}
                  </span>
                </div>
                <span
                  className={`project-plan-chevron${isOpen ? " project-plan-chevron-open" : ""}`}
                  aria-hidden="true"
                >
                  ▼
                </span>
              </button>
              {isOpen && (
                <ul className="project-plan-tasks-list">
                  {section.tasks.map((task) => (
                    <li
                      className={`project-plan-task${task.done ? " project-plan-task-done" : ""}`}
                      key={task.id}
                    >
                      <button
                        type="button"
                        className={`project-plan-checkbox${task.done ? " project-plan-checkbox-checked" : ""}`}
                        onClick={() => toggle(section.id, task.id)}
                        aria-label={task.done ? "Снять отметку" : "Отметить выполненной"}
                        aria-pressed={task.done}
                      >
                        {task.done && (
                          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                              d="M2.5 6L5 8.5L9.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        )}
                      </button>
                      <span
                        className={`project-plan-task-text${task.done ? " project-plan-task-text-done" : ""}`}
                      >
                        {task.text}
                        {task.priority === "first" && (
                          <span className="project-plan-priority project-plan-priority-first">
                            сначала
                          </span>
                        )}
                        {task.priority === "important" && (
                          <span className="project-plan-priority project-plan-priority-important">
                            важно
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      <footer className="project-plan-footer">
        <p className="project-plan-footer-note">
          Отмечай выполненное · потом распланируем по датам
        </p>
        <p className="project-plan-footer-link">
          Доступно по ссылке:{" "}
          <a href={PUBLIC_URL}>{PUBLIC_URL}</a>
        </p>
      </footer>
    </main>
  );
}
