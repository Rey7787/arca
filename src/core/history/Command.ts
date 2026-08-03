/**
 * Toda mutação de dado na Arca é um comando. Não existe caminho alternativo:
 * serviço não grava direto no repositório. É isso que torna o undo confiável
 * em vez de um remendo por cima.
 */
export interface Command {
  /** Texto mostrado ao usuário: "Excluir lançamento de R$ 45,00" */
  readonly label: string;
  execute(): Promise<void>;
  undo(): Promise<void>;
  /** Agrupa ações contíguas (digitação, ajuste repetido) num comando só. */
  merge?(next: Command): Command | null;
}
