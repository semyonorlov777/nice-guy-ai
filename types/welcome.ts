export interface WelcomeReply {
  text: string;
  type: "normal" | "exit";
}

export interface WelcomeConfig {
  modeLabel: string;
  title: string;
  subtitle: string;
  aiMessage: string;
  replies: WelcomeReply[];
  chatType?: "free" | "author" | "exercise";
  systemContext?: string;
}
