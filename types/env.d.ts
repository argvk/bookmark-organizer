declare namespace NodeJS {
  interface ProcessEnv {
    OPENAI_API_KEY?: string;
    OPENAI_MODEL?: string;
    CONCURRENCY?: string;
    DEBUG?: string;
  }
}
