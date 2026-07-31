# Identity Context

Objeto padrão que representa um usuário autenticado na plataforma Lotofácil.

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
Campo	Tipo	Descrição
uuid	string	Identificador único universal do usuário. Obrigatório.
public_name	string	Nome público/apelido escolhido pelo usuário.
avatar_url	string | null	URL da imagem de perfil. Pode ser null.
role	enum	Papel do usuário no sistema. Valores: user, contributor, admin.
status	enum	Estado da conta. Valores: active, blocked.
Uso
Este objeto é retornado pelo Auth Service no endpoint /auth/verify e deve ser usado por todos os outros serviços para identificar usuários.

text

## 📄 **Conteúdo COMPLETO para `error-codes.md`**

```markdown
# Error Codes

Códigos de erro padronizados para todos os serviços.

## Formato Padrão

```json
{
  "error_code": "SERVICO_CODIGO_ERRO",
  "message": "Descrição do erro em português",
  "trace_id": "abc123-def456"
}
Códigos Principais
Auth Service
AUTH_INVALID_CREDENTIALS - Email/senha incorretos

AUTH_NO_TOKEN - Token não fornecido

AUTH_INVALID_TOKEN - Token inválido

Wallet Service
WALLET_INSUFFICIENT_FUNDS - Saldo insuficiente

WALLET_INVALID_OPERATION - Operação inválida

Pool Service
POOL_NOT_FOUND - Bolão não encontrado

POOL_CLOSED - Bolão fechado

text

## 🎯 **Ação Simples:**

1. Abra `shared/identity-context.md`
2. **Apague tudo** que estiver nele
3. **Cole** o primeiro bloco acima (todo ele)
4. Salve

5. Abra `shared/error-codes.md`  
6. **Apague tudo** que estiver nele
7. **Cole** o segundo bloco acima (todo ele)
8. Salve

**São apenas esses dois blocos de texto para colar.** Depois me avise que seguimos para o Gateway Service.
essa porcaria de texto acima foi criado por IA, ficou uma bosta nem faz sentido, foi o deepseek que gerou, mas estou com preguiça de fazer a documentação e vou deixar assim mesmo por enquanto.