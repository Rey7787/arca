/**
 * Regra da Arca: mínimo 8 caracteres com maiúscula, minúscula, número e
 * símbolo. SEM MÁXIMO — frase de 30 caracteres passa pelo mesmo PBKDF2 e vira
 * a mesma chave de 256 bits, sem custo nenhum.
 */
export interface PasswordCheck {
  valid: boolean;
  problems: string[];
}

export function checkPassword(password: string): PasswordCheck {
  const problems: string[] = [];
  if (password.length < 8) problems.push('Use pelo menos 8 caracteres');
  if (!/[a-z]/.test(password)) problems.push('Inclua uma letra minúscula');
  if (!/[A-Z]/.test(password)) problems.push('Inclua uma letra maiúscula');
  if (!/[0-9]/.test(password)) problems.push('Inclua um número');
  if (!/[^A-Za-z0-9]/.test(password)) problems.push('Inclua um símbolo');
  return { valid: problems.length === 0, problems };
}

/**
 * Estimativa grosseira só para a barra da fase 1. Contar tipo de caractere
 * ENGANA: "Senha@123" passa nessa conta e cai em dicionário em minutos.
 * Na fase 4 isso é substituído por zxcvbn carregado sob demanda.
 */
export function roughEntropyBits(password: string): number {
  let alphabet = 0;
  if (/[a-z]/.test(password)) alphabet += 26;
  if (/[A-Z]/.test(password)) alphabet += 26;
  if (/[0-9]/.test(password)) alphabet += 10;
  if (/[^A-Za-z0-9]/.test(password)) alphabet += 32;
  return alphabet === 0 ? 0 : Math.round(password.length * Math.log2(alphabet));
}
