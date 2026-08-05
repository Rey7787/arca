# Arca — Etapa 0: autenticação no Supabase

**Data:** 04/08/2026
**Projeto de teste:** `teste-arca` (descartável, região São Paulo / sa-east-1)
**Status:** concluída. Nenhum código da Arca foi tocado nesta etapa.

---

## O modelo que foi validado

A senha do usuário nunca sai do dispositivo. Ela é transformada localmente em **dois valores independentes**:

| Valor | Sal usado | Para onde vai | Serve para |
|---|---|---|---|
| `hashDeAuth` | derivado do e-mail (sempre igual) | vai para o Supabase, no lugar da senha | provar identidade |
| `chaveDoCofre` | aleatório, guardado no VaultMeta | **nunca sai do dispositivo** | cifrar/decifrar os dados |

Os dois valores não têm relação matemática entre si. Se o banco do Supabase vazar inteiro, o `hashDeAuth` vazado não abre cofre nenhum.

O sal de autenticação vem do e-mail normalizado (minúsculas, sem espaços nas pontas), então o mesmo e-mail digitado de jeitos diferentes no PC e no celular gera a mesma derivação.

---

## Resultado dos oito testes

| # | Teste | Resultado |
|---|---|---|
| 01 | Derivação dupla | ✅ Dois valores distintos, normalização de e-mail funcionando |
| 02 | Cadastro | ✅ Supabase aceitou `hashDeAuth` de 64 hex como senha e devolveu sessão |
| 03 | Login | ✅ Entra com o valor derivado; valor errado é recusado |
| 04 | Limite de 72 bytes do bcrypt | ✅ Recusa **explícita** acima de 72 caracteres — não corta em silêncio |
| 05 | Renovação de sessão | ✅ Token renova sem senha e sem a chave do cofre em memória |
| 06 | Link mágico | ⚠️ Funciona — e por isso precisa ficar desligado (ver abaixo) |
| 07 | Trocar senha por dentro | ✅ Troca, invalida o valor antigo e permite reverter |
| 08 | Reset nativo de senha | ⚠️ **Foi aceito** — precisa ser bloqueado no código (ver abaixo) |

---

## Regras que a Arca precisa seguir

### 1. Proibido: reset nativo de senha do Supabase

Nunca chamar `resetPasswordForEmail()`, nem oferecer botão que leve a isso.

**Por quê:** o reset troca a credencial no servidor sem passar pelo dispositivo. O login passaria a exigir a senha nova enquanto o cofre continuaria cifrado com a chave derivada da senha antiga. O usuário entraria e encontraria os próprios dados ilegíveis — pior do que não conseguir entrar.

### 2. Proibido: link mágico / OTP por e-mail

Nunca chamar `signInWithOtp()`.

**Por quê:** loga sem senha. Sem senha não há como derivar a `chaveDoCofre`. Vira um caminho de "login" que termina num cofre trancado.

### 3. A recuperação continua sendo a que a Arca já tem

Código de recuperação gerado pelo próprio app, no dispositivo, carregando o material necessário para reconstruir a chave.

Se o usuário perder senha **e** código, os dados foram. Esse é o preço honesto da criptografia de verdade — não é uma falha a ser consertada.

### 4. Formato do `hashDeAuth`: hex de 64 caracteres

O bcrypt por baixo do Supabase corta em 72 bytes. Hex de 64 passa com folga.

⚠️ **Não trocar para base64 de 64 bytes** (daria 88 caracteres) — o cadastro passa a ser recusado. Vale um comentário no código nesse ponto.

Isso **não** limita a senha do usuário, que continua livre e longa. O limite vale para o valor derivado, que tem tamanho fixo.

### 5. Sessão e chave do cofre são coisas separadas

- **Sessão** = permissão de falar com o servidor. Renova sozinha, sem senha.
- **Chave do cofre** = permissão de ler os dados. Só na memória, só enquanto destravado.

O bloqueio automático por inatividade descarta a chave da memória **sem** deslogar do servidor. Ao voltar, a senha reconstrói a chave localmente, sem ida à rede.

A chave do cofre nunca é persistida para manter sessão viva.

---

## Pendências para as próximas etapas

**[FEITO — commit 0772f76]** ~~Adicionar ao `scripts/check-rules.mjs`:~~ quebrar o build se aparecer `resetPasswordForEmail` ou `signInWithOtp` no código. É a forma de garantir que as regras 1 e 2 sobrevivam a você mesmo daqui a seis meses.

**Troca de senha com sincronização ativa:** hoje o fluxo é decifra com a chave antiga → recifra com a nova → envia o `hashDeAuth` novo. Com vários dispositivos, se a recifragem subir pela metade (internet caindo no meio), outro aparelho baixa dados cifrados com a chave velha e não abre. Provável solução: versão da chave gravada junto com o cofre. Assunto da etapa de sincronização.

**Configuração do projeto real:** desligar `Confirm email` foi necessário só na bancada, para os testes rodarem. No projeto de produção, decidir conscientemente se a confirmação fica ligada.

---

## Limpeza

**[FEITO — 05/08/2026]** O projeto `teste-arca` foi apagado. Tinha usuários de teste criados de verdade e já não servia para mais nada.

Painel → Settings → General → rolar até o fim → **Delete project**.
