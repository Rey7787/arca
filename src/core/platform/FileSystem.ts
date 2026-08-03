/**
 * Isolamento de plataforma. Tudo que toca disco passa por aqui.
 *
 * Na web: File System Access API (Chrome/Edge) com queda pro download manual.
 * No Tauri (fase 7): mesma interface, fs nativo. UI e módulos não mudam.
 */
export interface ArcaFileSystem {
  readonly canWriteDirectly: boolean;
  saveFile(name: string, data: Uint8Array, mime: string): Promise<void>;
  openFile(accept: string): Promise<Uint8Array | null>;
}
