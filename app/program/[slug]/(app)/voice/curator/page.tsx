import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase-server";
import { requireProgramFeature } from "@/lib/queries/program";
import { SKILLS, isCurator, loadCuratorBoard, type CuratorDebrief, type CuratorFlag, type CuratorStudent, type SkillPair } from "@/lib/voice-practice/curator";
import "@/components/voice-practice/voice-practice.css";

export const dynamic = "force-dynamic";
export const metadata = { title: "Сводка куратора", robots: { index: false, follow: false } };

const fmtDate = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short", timeZone: "Europe/Moscow" });

function Pair({ pair, unit }: { pair: SkillPair; unit?: string }) {
  const [a, b] = pair;
  if (a == null && b == null) return <span className="vp-cur-none">—</span>;
  const trend = a == null || b == null ? "same" : b > a ? "up" : b < a ? "down" : "same";
  return (
    <span className="vp-cur-pair" data-trend={trend}>
      {a ?? "—"} → <b>{b ?? "—"}</b>
      {unit ? <span className="vp-cur-unit">{unit}</span> : null}
    </span>
  );
}

// В таблице на компьютере — короткий ярлык (полный текст в подсказке); на телефоне и в карточке — полностью.
const SHORT: Record<CuratorFlag["kind"], string | null> = {
  safety: "Безопасность",
  stuck: "Застрял на уровне 1",
  inactive: null,
  divergence: "Уверенность обгоняет навыки",
  integrity: "Сбой клиента",
  pattern: "Повторяется ошибка",
};

function Flags({ st, short }: { st: CuratorStudent; short?: boolean }) {
  if (!st.flags.length) return <span className="vp-cur-none">—</span>;
  return (
    <span className="vp-cur-flags">
      {st.flags.map((f) => (
        <span key={f.text} className="vp-cur-flag" data-kind={f.kind} title={short ? f.text : undefined}>
          {short ? (
            <>
              <span className="vp-cur-flag-s">{SHORT[f.kind] ?? f.text}</span>
              <span className="vp-cur-flag-f">{f.text}</span>
            </>
          ) : (
            f.text
          )}
        </span>
      ))}
    </span>
  );
}

function StudentCard({ st, slug, viewerId }: { st: CuratorStudent; slug: string; viewerId: string }) {
  return (
    <section id="card" className="vp-card vp-cur-card" aria-label={`Карточка: ${st.name}`}>
      <div className="vp-cur-card-head">
        <div>
          <h2>
            {st.name} {st.real ? <span className="vp-cur-badge">реальные сессии</span> : null}
          </h2>
          <p className="vp-hint">
            Консультаций: {st.sessions} · минут: {st.minutes}
            {st.lastDate ? ` · последняя ${fmtDate.format(new Date(st.lastDate))}` : ""}
          </p>
        </div>
        <Link href={`/program/${slug}/voice/curator`} className="vp-cur-close" aria-label="Закрыть карточку">
          ✕
        </Link>
      </div>

      <div className="vp-cur-modes">
        {Object.entries(st.modes).map(([m, n]) => (
          <span key={m} className="vp-cur-chip">
            {m} · {n}
          </span>
        ))}
      </div>

      <h3>Навыки: первая → последняя консультация</h3>
      <div className="vp-cur-skills">
        {SKILLS.map(({ key, name }) => {
          const [a, b] = st.skills[key];
          return (
            <div key={key} className="vp-cur-skill">
              <span>{name}</span>
              <span className="vp-cur-bar" aria-hidden="true">
                {b != null ? <span className="vp-cur-bar-fill" style={{ width: `${b}%` }} /> : null}
                {a != null ? <span className="vp-cur-bar-mark" style={{ left: `${a}%` }} /> : null}
              </span>
              <Pair pair={st.skills[key]} />
            </div>
          );
        })}
      </div>
      <div className="vp-row">
        <span>Уверенность (сумма трёх ответов, 0–30)</span>
        <Pair pair={st.confidence} />
      </div>
      {st.flags.length ? (
        <div className="vp-row">
          <span>Отметки</span>
          <Flags st={st} />
        </div>
      ) : null}

      <h3>Последние разборы</h3>
      {st.debriefs.length === 0 ? <p className="vp-hint">Разборов пока нет.</p> : null}
      {st.debriefs.map((d, i) => (
        <article key={d.sessionId ?? i} className="vp-cur-debrief">
          <p className="vp-cur-debrief-meta">
            {fmtDate.format(new Date(d.date))} · {d.mode}
            {d.client ? ` · ${d.client}` : ""} · {d.minutes} мин
          </p>
          {d.headline ? <p className="vp-cur-debrief-head">{d.headline}</p> : null}
          {d.strength ? (
            <p className="vp-cur-q">
              <span className="vp-ok">Сработало{d.strength.skill ? ` · ${d.strength.skill}` : ""}:</span> «{d.strength.quote}»
            </p>
          ) : null}
          {d.fix ? (
            <p className="vp-cur-q">
              <span className="vp-warn">Правка{d.fix.skill ? ` · ${d.fix.skill}` : ""}:</span> «{d.fix.quote}»
              {d.fix.alternative ? <span className="vp-cur-alt"> → «{d.fix.alternative}»</span> : null}
            </p>
          ) : null}
          {d.voice ? <VoiceReflection v={d.voice} /> : null}
          {d.attention.length ? (
            <ul className="vp-cur-att">
              {d.attention.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
          ) : null}
          {d.sessionId && st.id === viewerId ? (
            <Link href={`/program/${slug}/voice/session/${d.sessionId}`} className="vp-cur-link">
              Разбор и расшифровка →
            </Link>
          ) : null}
        </article>
      ))}
      <p className="vp-small">Расшифровки — только текст, голос не хранится.</p>
    </section>
  );
}

// Сводка куратора по потоку — макет к показу 17.10: демо-студенты + реальные сессии владельца.
export default async function CuratorPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ s?: string }>;
}) {
  const { slug } = await params;
  const { s: selectedId } = await searchParams;
  const supabase = await createClient();
  const { id: programId } = await requireProgramFeature(supabase, slug, "voice");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/auth?redirect=/program/${slug}/voice/curator`);
  if (!(await isCurator(user.id, programId))) redirect(`/program/${slug}/hub`);

  const { title, students } = await loadCuratorBoard(programId);
  const selected = students.find((st) => st.id === selectedId) ?? null;

  const totalSessions = students.reduce((n, st) => n + st.sessions, 0);
  const totalMinutes = students.reduce((n, st) => n + st.minutes, 0);
  const conf = students.filter((st) => st.confidence[0] != null && st.confidence[1] != null);
  const avg = (xs: number[]) => (xs.length ? (xs.reduce((a, b) => a + b, 0) / xs.length).toFixed(1).replace(".", ",") : "—");
  const needAttention = students.filter((st) => st.flags.length).length;

  return (
    <div className="vp-screen vp-wide">
      <p className="vp-kicker">Сводка куратора</p>
      <h1 className="vp-title">{title}</h1>
      <div className="vp-card vp-hint" style={{ marginBottom: 12 }}>
        <p style={{ margin: "0 0 8px" }}>
          <b>Практика каждого студента — на одной странице.</b> Не нужно присутствовать на каждой встрече: видно, кто
          сколько тренировался, какие навыки растут и где студент застрял.
        </p>
        <p style={{ margin: "0 0 8px" }}>
          <b>У института появляется доказательство результата.</b> Например: «до практикума уверенность была 3 из 10,
          после 20 учебных консультаций — 7». Эти цифры можно показывать будущим студентам.
        </p>
        <p style={{ margin: 0 }}>
          <b>Сразу видно, кому нужна помощь.</b> Отметки «не практикует неделю» или «уверенность выше реальных навыков»
          подсказывают куратору, кому написать в первую очередь.
        </p>
      </div>

      <div className="vp-cur-note" role="note">
        <b>Демонстрация. Критерии предварительные, согласуются с кураторами.</b>
        <span>Студенты вымышленные, кроме строк с пометкой «реальные сессии». Куратор видит разборы и расшифровки; голос не хранится.</span>
      </div>

      <div className="vp-cur-stats">
        <div className="vp-card"><b>{students.length}</b><span>студентов</span></div>
        <div className="vp-card"><b>{totalSessions}</b><span>консультаций</span></div>
        <div className="vp-card"><b>{totalMinutes.toLocaleString("ru-RU")}</b><span>минут практики</span></div>
        <div className="vp-card">
          <b>
            {avg(conf.map((st) => st.confidence[0]!))} → {avg(conf.map((st) => st.confidence[1]!))}
          </b>
          <span>уверенность в среднем, из 30</span>
        </div>
        <div className="vp-card"><b>{needAttention}</b><span>с отметками внимания</span></div>
      </div>

      {selected ? <StudentCard st={selected} slug={slug} viewerId={user.id} /> : null}

      <p className="vp-small vp-cur-legend">
        Навыки — балл 0–100 в первой и последней консультации, где для навыка был повод. Уверенность — сумма трёх ответов студента: до первой консультации → последний замер. Нажмите на имя, чтобы открыть карточку.
      </p>
      <div className="vp-cur-wrap">
        <table className="vp-cur-table">
          <caption className="vp-cur-sr">Студенты потока</caption>
          <thead>
            <tr>
              <th scope="col">Студент</th>
              <th scope="col">Консульт.</th>
              <th scope="col">Минут</th>
              <th scope="col">Последняя</th>
              {SKILLS.map((sk) => (
                <th key={sk.key} scope="col" title={sk.name}>
                  {sk.short}
                </th>
              ))}
              <th scope="col">Уверенность</th>
              <th scope="col">Отметки</th>
            </tr>
          </thead>
          <tbody>
            {students.map((st) => (
              <tr key={st.id} aria-selected={st.id === selected?.id} data-real={st.real || undefined}>
                <th scope="row">
                  <Link href={`/program/${slug}/voice/curator?s=${st.id}#card`}>
                    {st.name}
                  </Link>
                  {st.real ? <span className="vp-cur-badge">реальные сессии</span> : null}
                </th>
                <td data-label="Консультаций">{st.sessions}</td>
                <td data-label="Минут">{st.minutes}</td>
                <td data-label="Последняя">{st.lastDate ? fmtDate.format(new Date(st.lastDate)) : "—"}</td>
                {SKILLS.map((sk) => (
                  <td key={sk.key} data-label={sk.name}>
                    <Pair pair={st.skills[sk.key]} />
                  </td>
                ))}
                <td data-label="Уверенность">
                  <Pair pair={st.confidence} />
                </td>
                <td data-label="Отметки" className="vp-cur-flags-cell">
                  <Flags st={st} short />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const REFLECTION: Record<"self" | "prompted" | "none" | "skipped", string> = {
  self: "студент разобрал встречу сам",
  prompted: "о себе — после подсказки",
  none: "о себе не сказал",
  skipped: "разбор голосом пропущен, прочитан текстом",
};

/** Голосовой разбор «как в тройке»: самооценка и вывод студента его словами. */
function VoiceReflection({ v }: { v: NonNullable<CuratorDebrief["voice"]> }) {
  return (
    <div className="vp-cur-voice">
      <p className="vp-cur-q">
        <span className="vp-cur-voice-k">Разбор голосом:</span> {REFLECTION[v.level]}
      </p>
      {v.self ? (
        <p className="vp-cur-q">
          <span className="vp-cur-voice-k">О себе:</span> «{v.self}»
        </p>
      ) : null}
      {v.takeaway ? (
        <p className="vp-cur-q">
          <span className="vp-cur-voice-k">Вывод:</span> «{v.takeaway}»
        </p>
      ) : null}
    </div>
  );
}
