/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Absolute origin of the backend API, e.g. https://velozity-api.onrender.com
   * Leave empty in local development so the Vite dev-server proxy handles
   * `/api` and `/socket.io` (see vite.config.ts).
   */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
