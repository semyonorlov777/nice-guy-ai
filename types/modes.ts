import type { WelcomeReply } from "@/types/welcome";

/** Как студент взаимодействует с режимом: текстовый чат, тест или голосовая сессия */
export type ModeInteraction = "text" | "test" | "voice";

/** Каталог режимов (shared across books) */
export interface ModeTemplate {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string;
  chat_type: string | null;
  route_suffix: string;
  is_chat_based: boolean;
  interaction: ModeInteraction;
  default_sort_order: number;
}

/** Привязка режима к конкретной программе/книге */
export interface ProgramMode {
  id: string;
  program_id: string;
  mode_template_id: string;
  enabled: boolean;
  sort_order: number;
  access_type: "free" | "paid";
  welcome_message: string | null;
  config: Record<string, unknown>;
}

/** Режим программы с данными шаблона — основной тип для UI */
export interface ProgramModeWithTemplate {
  key: string;
  name: string;
  description: string | null;
  icon: string;
  chat_type: string | null;
  route_suffix: string;
  is_chat_based: boolean;
  interaction: ModeInteraction;
  sort_order: number;
  access_type: "free" | "paid";
  welcome_message: string | null;
  config: Record<string, unknown>;
  welcome_mode_label: string | null;
  welcome_title: string | null;
  welcome_subtitle: string | null;
  welcome_ai_message: string | null;
  welcome_replies: WelcomeReply[];
  welcome_system_context: string | null;
  color_class: string;
  badge: string | null;
}

/** Данные для блока "Продолжить" */
export interface LastActiveMode {
  key: string;
  name: string;
  icon: string;
  route_suffix: string;
  last_at: string;
  chat_id: string;
}
