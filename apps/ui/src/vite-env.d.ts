/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_LEGACY_UI_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
