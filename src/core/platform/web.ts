import type { ArcaFileSystem } from './FileSystem';

interface FilePickerWindow {
  showSaveFilePicker?: (options: unknown) => Promise<FileSystemFileHandle>;
  showOpenFilePicker?: (options: unknown) => Promise<FileSystemFileHandle[]>;
}

const w = window as unknown as FilePickerWindow;

export const webFileSystem: ArcaFileSystem = {
  canWriteDirectly: typeof w.showSaveFilePicker === 'function',

  async saveFile(name, data, mime) {
    if (w.showSaveFilePicker) {
      const handle = await w.showSaveFilePicker({
        suggestedName: name,
        types: [{ description: name, accept: { [mime]: [`.${name.split('.').pop()}`] } }],
      });
      const writable = await (handle as unknown as { createWritable(): Promise<{ write(d: Uint8Array): Promise<void>; close(): Promise<void> }> }).createWritable();
      await writable.write(data);
      await writable.close();
      return;
    }

    // Firefox e Safari: download normal.
    const url = URL.createObjectURL(new Blob([data as BlobPart], { type: mime }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    URL.revokeObjectURL(url);
  },

  async openFile(accept) {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        resolve(new Uint8Array(await file.arrayBuffer()));
      };
      input.oncancel = () => resolve(null);
      input.click();
    });
  },
};
