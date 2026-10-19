/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** Google OAuth web client ID. Online saves are off when it is not set. */
  readonly VITE_GOOGLE_CLIENT_ID?: string
  /** Base URL of the sync worker (server/), e.g. https://road-warden-sync.example.workers.dev */
  readonly VITE_SYNC_URL?: string
}
