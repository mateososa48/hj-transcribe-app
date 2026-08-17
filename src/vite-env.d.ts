/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ASSEMBLYAI_API_KEY?: string;
  readonly VITE_ELEVENLABS_API_KEY?: string;
  readonly VITE_MISTRAL_API_KEY?: string;
  readonly VITE_OPENAI_API_KEY?: string;
  readonly VITE_AI_GATEWAY_API_KEY?: string;
  readonly VITE_ANTHROPIC_API_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
