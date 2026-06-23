/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
  readonly VITE_LOW_BALANCE_THRESHOLD_CENTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
