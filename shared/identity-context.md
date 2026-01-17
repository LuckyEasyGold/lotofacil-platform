# Identity Context

Objeto padrão que representa um usuário autenticado na plataforma Lotofácil.
Este objeto é retornado pelo Auth Service no endpoint `/auth/verify` e deve ser
injetado pelo Gateway Service em todas as requisições autenticadas.

## Estrutura

```json
{
  "uuid": "70f1b687-a400-41f9-9067-293fa54d0854",
  "public_name": "João da Silva",
  "avatar_url": "https://exemplo.com/avatar.jpg",
  "role": "user",
  "status": "active"
}
Campos
Campo	Tipo	Descrição	Exemplo
uuid	string	Identificador único universal do usuário. Obrigatório.	"70f1b687-a400-41f9-9067-293fa54d0854"
public_name	string	Nome público/apelido escolhido pelo usuário.	"João da Silva", "anon-abc123"
avatar_url	string | null	URL da imagem de perfil. Pode ser null.	"https://exemplo.com/avatar.jpg"
role	enum	Papel do usuário no sistema. Valores: user, contributor, admin.	"user"
status	enum	Estado da conta. Valores: active, blocked.	"active"
Uso pelos Módulos
Todos os serviços (Wallet, Bolões, etc.) devem receber este objeto via header X-Identity-Context
(codificado em Base64) ou através do Gateway Service.

Exemplo de header:

text
X-Identity-Context: eyJ1dWlkIjoiNzBmMWI2ODctYTQwMC00MWY5LTkwNjctMjkzZmE1NGQwODU0IiwicHVibGljX25hbWUiOiJKb8OjbyBkYSBTaWx2YSIsInJvbGUiOiJ1c2VyIiwic3RhdHVzIjoiYWN0aXZlIn0=
Notas
O uuid é a fonte única da verdade para identificar usuários entre serviços.

Serviços nunca devem usar email ou outros dados sensíveis para identificar usuários.

Este contrato não pode ser quebrado sem versão. Mudanças = nova versão da API.

text

## 📁 **Arquivo 2: `shared/error-codes.md`**

```markdown
# Error Codes

Códigos de erro padronizados para todos os serviços da plataforma Lotofácil.
Todos os erros seguem o mesmo formato JSON.

## Formato Padrão de Erro

```json
{
  "error_code": "SERVICO_CODIGO_ERRO",
  "message": "Descrição legível do erro em português",
  "trace_id": "abc123-def456-ghi789",
  "timestamp": "2026-01-17T13:45:30.123Z"
}
Códigos por Serviço
Auth Service (AUTH_*)
Código	HTTP Status	Descrição
AUTH_INVALID_CREDENTIALS	401	Email e/ou senha incorretos.
AUTH_NO_TOKEN	401	Token de autenticação não fornecido.
AUTH_INVALID_TOKEN	401	Token inválido, expirado ou malformado.
AUTH_USER_NOT_FOUND	404	Usuário não encontrado (UUID não existe).
AUTH_EMAIL_ALREADY_USED	409	Email já está cadastrado por outro usuário.
AUTH_INVALID_SIGNATURE	401	Assinatura criptográfica inválida (login por chave pública).
Wallet Service (WALLET_*)
Código	HTTP Status	Descrição
WALLET_INSUFFICIENT_FUNDS	400	Saldo insuficiente para a operação.
WALLET_INVALID_OPERATION	400	Operação financeira inválida ou malformada.
WALLET_TRANSACTION_NOT_FOUND	404	Transação não encontrada.
Pool Service (POOL_*)
Código	HTTP Status	Descrição
POOL_NOT_FOUND	404	Bolão não encontrado.
POOL_CLOSED	400	Bolão já está fechado para novas participações.
POOL_INSUFFICIENT_QUOTAS	400	Não há cotas disponíveis no bolão.
POOL_ALREADY_PARTICIPATING	409	Usuário já está participando deste bolão.
Game Service (GAME_*)
Código	HTTP Status	Descrição
GAME_INVALID_NUMBERS	400	Números fornecidos não formam um jogo válido da Lotofácil.
GAME_GENERATION_FAILED	500	Falha ao gerar jogos (parâmetros inválidos).