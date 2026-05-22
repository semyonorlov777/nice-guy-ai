export type MessageSource = "web" | "telegram";
export type ChatKind = "manual" | "inbox";

export interface Chat {
  id: string;
  title: string;
  kind: ChatKind;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  chat_id: string;
  source: MessageSource;
  text: string;
  audio_duration_sec: number | null;
  created_at: string;
}

export interface ChatWithLastMessage extends Chat {
  last_message_text: string | null;
  last_message_at: string | null;
  message_count: number;
}
