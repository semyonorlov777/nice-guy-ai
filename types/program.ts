/** Feature flags для программы — определяют какие разделы доступны */
export interface ProgramFeatures {
  free_chat?: boolean;
  exercises?: boolean;
  test?: boolean;
  portrait?: boolean;
  author_chat?: boolean;
  /** Голосовой практикум: кабинет без текстового чата, режимы ведут на /voice/* */
  voice?: boolean;
}
