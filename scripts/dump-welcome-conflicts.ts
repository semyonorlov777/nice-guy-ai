#!/usr/bin/env tsx
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv(): Record<string, string> {
  const envPath = resolve(process.cwd(), ".env.local");
  const env: Record<string, string> = { ...process.env } as Record<string, string>;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const t = line.trim();
      if (!t || t.startsWith("#")) continue;
      const eq = t.indexOf("=");
      if (eq === -1) continue;
      const k = t.slice(0, eq).trim();
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      env[k] = v;
    }
  } catch {}
  return env;
}

const env = loadEnv();
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

async function main() {
  const { data: programs } = await supabase
    .from("programs")
    .select("id, slug")
    .in("slug", ["love-languages", "nice-guy"]);
  const slugById = new Map((programs ?? []).map((p: { id: string; slug: string }) => [p.id, p.slug]));
  const programIds = (programs ?? []).map((p: { id: string }) => p.id);

  const { data: modes } = await supabase
    .from("program_modes")
    .select("program_id, welcome_message, welcome_ai_message, welcome_replies, mode_templates!inner(key)")
    .in("program_id", programIds);

  const out: string[] = [];
  out.push("# Конфликты welcome_message vs welcome_ai_message\n");
  out.push("В каждом режиме заполнены ОБА поля. Программа берёт legacy `welcome_message` — новое `welcome_ai_message` + кнопки игнорируются на проде.\n");
  out.push("Для каждого режима реши: **оставить старое** (тогда удалить welcome_ai_message + welcome_replies) или **переключиться на новое** (тогда удалить welcome_message).\n");
  out.push("---\n");

  for (const m of (modes ?? []) as Array<{
    program_id: string;
    welcome_message: string | null;
    welcome_ai_message: string | null;
    welcome_replies: unknown;
    mode_templates: { key: string };
  }>) {
    if (!m.welcome_message || !m.welcome_ai_message) continue;
    const slug = slugById.get(m.program_id) ?? "?";
    const key = m.mode_templates?.key ?? "?";
    out.push(`\n## ${slug} → \`${key}\`\n`);
    out.push("### СТАРОЕ — `welcome_message` (это видят пользователи СЕЙЧАС)\n");
    out.push("```");
    out.push(m.welcome_message);
    out.push("```\n");
    out.push("### НОВОЕ — `welcome_ai_message` (написано тобой позже, СЕЙЧАС НЕ ВИДНО)\n");
    out.push("```");
    out.push(m.welcome_ai_message);
    out.push("```\n");
    if (Array.isArray(m.welcome_replies) && m.welcome_replies.length > 0) {
      out.push("**Кнопки-«ёлочки» которые шли бы вместе с новым:**\n");
      for (const r of m.welcome_replies as Array<{ text?: string; type?: string }>) {
        out.push(`- ${r.type === "exit" ? "🚪" : "•"} «${r.text}»`);
      }
      out.push("");
    }
    out.push("---");
  }

  const target = resolve(process.cwd(), "WELCOME-CONFLICTS.md");
  writeFileSync(target, out.join("\n"), "utf8");
  console.log(`✅ Записал ${target}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
