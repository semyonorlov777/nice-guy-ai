// Сборка системной инструкции учебного клиента. Тексты — из закрытых таблиц
// (voice_modes.frame_prompt, voice_clients.prompt) и app_config.voice_global_rules.

const LANG_LOCK = "ВСЕГДА ГОВОРИ ТОЛЬКО ПО-РУССКИ. RESPOND IN RUSSIAN. YOU MUST RESPOND UNMISTAKABLY IN RUSSIAN.";

export function buildInstruction(parts: {
  globalRules: string;
  framePrompt: string;
  personaPrompt: string;
  resumed: boolean;
}): string {
  const blocks = [
    LANG_LOCK,
    parts.personaPrompt.trim(),
    parts.framePrompt.trim(),
    parts.globalRules.trim(),
  ];
  if (parts.resumed) {
    blocks.push(
      "РАЗГОВОР ПРОДОЛЖАЕТСЯ после короткой паузы связи. Всё, что было сказано раньше, — в истории. Не здоровайся заново, не повторяй сказанного, жди реплику психолога и продолжай с того же места.",
    );
  }
  blocks.push(LANG_LOCK);
  return blocks.filter(Boolean).join("\n\n");
}
