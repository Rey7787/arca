import { bus } from '@/core/events/bus';
import type { Command } from './Command';

/**
 * Histórico vive SÓ em memória e é limpo no bloqueio — comando guarda dado já
 * decifrado, então persistir seria vazamento.
 */
export class HistoryStack {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  constructor(private limit = 50) {}

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }
  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
  get nextUndoLabel(): string | null {
    return this.undoStack.at(-1)?.label ?? null;
  }
  get nextRedoLabel(): string | null {
    return this.redoStack.at(-1)?.label ?? null;
  }

  async run(command: Command): Promise<void> {
    await command.execute();

    const previous = this.undoStack.at(-1);
    const merged = previous?.merge?.(command);
    if (merged) {
      this.undoStack[this.undoStack.length - 1] = merged;
    } else {
      this.undoStack.push(command);
      if (this.undoStack.length > this.limit) this.undoStack.shift();
    }

    this.redoStack = []; // ação nova invalida o caminho de refazer
    bus.emit('history:changed', undefined);
  }

  async undo(): Promise<void> {
    const command = this.undoStack.pop();
    if (!command) return;
    await command.undo();
    this.redoStack.push(command);
    bus.emit('history:changed', undefined);
  }

  async redo(): Promise<void> {
    const command = this.redoStack.pop();
    if (!command) return;
    await command.execute();
    this.undoStack.push(command);
    bus.emit('history:changed', undefined);
  }

  /** Restaurar backup e trocar senha limpam a pilha: não dá pra desfazer. */
  clear(): void {
    this.undoStack = [];
    this.redoStack = [];
    bus.emit('history:changed', undefined);
  }
}

export const history = new HistoryStack();

bus.on('vault:locked', () => history.clear());
