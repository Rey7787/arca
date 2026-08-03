# Arca
### Gerenciador Financeiro Pessoal

Fase 1 — fundação. Cria o perfil, desbloqueia, grava cifrado, lê decifrado e desfaz.

## Rodar

```bash
npm install
npm run dev
```

> O ambiente onde estes arquivos foram gerados está sem rede, então `npm install`
> e o build **não foram executados aqui**. Rode na sua máquina e me avise se
> aparecer erro de tipo — o `tsconfig` está em modo estrito.

## Publicar no GitHub Pages

1. Ajuste `base` no `vite.config.ts` para `/<nome-do-repo>/`
2. `npm run build`
3. Publique a pasta `dist/` (branch `gh-pages` ou GitHub Actions)

## O que já está de pé

| Peça | Onde | Estado |
|---|---|---|
| Derivação plugável (PBKDF2, Argon2id preparado) | `core/crypto/kdf/` | ✅ |
| AES-GCM, IV novo a cada gravação | `core/crypto/cipher.ts` | ✅ |
| Chave mestra envelopada + código de recuperação | `modules/auth/service.ts` | ✅ |
| Cofre em memória, bloqueio por inatividade | `core/crypto/vault.ts` | ✅ |
| Repositório genérico cifrado | `core/storage/repository.ts` | ✅ |
| Registry de módulos | `core/registry/` | ✅ |
| Undo/redo por command pattern + Ctrl+Z/Y | `core/history/` | ✅ |
| Camada de plataforma (web / Tauri futuro) | `core/platform/` | ✅ |
| Backup `.arca` versionado | — | fase 3 |
| Categorias, relatórios, PWA | — | fases 2–5 |

## Teste manual da fase 1

1. Abrir → criar senha → anotar o código de recuperação
2. Lançar uma saída → aparece na lista, saldo atualiza
3. Excluir → some da lista, toast "Desfazer" aparece
4. Ctrl+Z → volta
5. Bloquear → recarregar → abrir com a senha → o lançamento continua lá
6. Abrir o DevTools → IndexedDB → `arca` → os registros são blobs ilegíveis

O passo 6 é o que importa. Se der pra ler qualquer valor ali, algo quebrou.
