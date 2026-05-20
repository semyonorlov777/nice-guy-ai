/**
 * THEME_ICON_MAP — справочник иконок программных тем (program_themes.icon_key).
 *
 * Вынесен из hub-icons.tsx, чтобы статические ссылки на десятки иконок
 * не препятствовали tree-shaking при импорте одиночных иконок из hub-icons.
 * Этот файл стягивает в bundle только тех потребителей, которые реально
 * используют THEME_ICON_MAP (хаб, страница результатов теста).
 */
import type { IconProps } from "./hub-icons";
import {
  ApprovalIcon,
  ContractsIcon,
  SuppressionIcon,
  ControlIcon,
  BoundariesIcon,
  MasculinityIcon,
  AttachmentIcon,
  DramaIcon,
  CompassIcon,
  BookOpenIcon,
  HeartLoveIcon,
  TargetIcon,
  UsersLoveIcon,
  SparklesIcon,
  ShieldIcon,
  LightbulbIcon,
  RocketIcon,
  InstrumentLightningIcon,
  MapIcon,
  MessageCircleIcon,
} from "./hub-icons";

export const THEME_ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  // nice-guy (ISSP scales)
  approval: ApprovalIcon,
  contracts: ContractsIcon,
  suppression: SuppressionIcon,
  control: ControlIcon,
  boundaries: BoundariesIcon,
  masculinity: MasculinityIcon,
  attachment: AttachmentIcon,
  // games-people-play (TA scales)
  games: DramaIcon,
  "ego-states": CompassIcon,
  "life-script": BookOpenIcon,
  strokes: HeartLoveIcon,
  karpman: TargetIcon,
  // razgovorny-gipnoz (Bakirov scales)
  rapport: UsersLoveIcon,
  suggestions: SparklesIcon,
  strategy: CompassIcon,
  awareness: ShieldIcon,
  trance: LightbulbIcon,
  // 100-notes (Osipov scales)
  fear_mastery: ShieldIcon,
  scale_thinking: RocketIcon,
  energy_agency: InstrumentLightningIcon,
  environment_hygiene: UsersLoveIcon,
  self_reflection: BookOpenIcon,
  // redecision-therapy (Goulding injunctions)
  intimacy: HeartLoveIcon,
  feelings: SuppressionIcon,
  success: RocketIcon,
  authenticity: MasculinityIcon,
  drivers: InstrumentLightningIcon,
  // heroes-and-outlaws (Mark/Pearson archetype groups)
  arch_paradise: CompassIcon,
  arch_impact: RocketIcon,
  arch_belonging: HeartLoveIcon,
  arch_order: ShieldIcon,
  // mind-power (Kehoe — темы по сферам жизни + шкалы теста)
  mp_money: RocketIcon,
  mp_health: ShieldIcon,
  mp_relationships: HeartLoveIcon,
  mp_creativity: LightbulbIcon,
  mp_mind_control: CompassIcon,
  mp_visualization: SparklesIcon,
  mp_affirmations: BookOpenIcon,
  mp_appreciation: HeartLoveIcon,
  mp_abundance_mindset: RocketIcon,
  // transdiagnostic-cbt (Frank & Davidson road map stages = scales)
  tdcbt_assessment: BookOpenIcon,
  tdcbt_mechanism: CompassIcon,
  tdcbt_hypothesis: LightbulbIcon,
  tdcbt_intervention: TargetIcon,
  tdcbt_revision: SparklesIcon,
  // the-choice (Eger — 5 шкал внутренней тюрьмы)
  "tc-prison": ShieldIcon,
  "tc-victimhood": CompassIcon,
  "tc-unforgiveness": HeartLoveIcon,
  "tc-hunger": ApprovalIcon,
  "tc-reactivity": TargetIcon,
  // Alias under scale-key form (test_results page reads by scale.key)
  tc_prison: ShieldIcon,
  tc_victimhood: CompassIcon,
  tc_unforgiveness: HeartLoveIcon,
  tc_hunger: ApprovalIcon,
  tc_reactivity: TargetIcon,
  // seven-habits (Covey — концепции 7 навыков)
  paradigm_shift: SparklesIcon,
  circle_of_influence: CompassIcon,
  personal_mission: MapIcon,
  quadrants: TargetIcon,
  emotional_bank: HeartLoveIcon,
  empathic_listening: MessageCircleIcon,
};
