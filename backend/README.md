# LICITA AI Backend

API local do LICITA AI com persistencia em SQLite e fallback local no frontend.

## Rodar localmente

```bash
npm run dev
```

Servidor padrao:

```text
http://127.0.0.1:3333
```

Por padrao, o acesso pelo navegador e aceito somente a partir de `http://127.0.0.1:5173` e `http://localhost:5173`. Para outra origem local, configure `LICITA_AI_ALLOWED_ORIGINS` com uma lista separada por virgulas.

Rotas iniciais:

- `GET /health`
- `GET /api`
- `GET /api/opportunities`
- `PUT /api/opportunities`
- `PATCH /api/opportunities/:opportunityId/items/:itemId/quotation-status`
- `GET /api/suppliers`
- `POST /api/suppliers`
- `PUT /api/suppliers/:id`
- `DELETE /api/suppliers/:id`
- `GET /api/quotations`
- `POST /api/quotations`
- `PUT /api/quotations/:id`
- `DELETE /api/quotations/:id`
- `GET /api/proposals`
- `POST /api/proposals`
- `PUT /api/proposals/:id`
- `DELETE /api/proposals/:id`
- `GET /api/summary`
- `GET /api/export-backup`
- `POST /api/import-backup`

## Inicializar banco

```bash
npm run db:init
```

Banco local:

```text
backend/data/licita-ai.sqlite
```

Para usar outro arquivo, defina `LICITA_AI_DB_PATH` antes de iniciar a API. Os testes automatizados usam essa configuracao com bancos temporarios e nunca alteram o arquivo acima.

As migracoes em `backend/db/migrations` sao aplicadas automaticamente na inicializacao e registradas na tabela `schema_migrations`.

## Importar backup do frontend

Envie para `POST /api/import-backup` o JSON exportado pela aba Dados do frontend.

Essa rota substitui o conteudo atual do SQLite pelo conteudo do backup.

## Proximo passo

Concluir a troca gradual dos services restantes do frontend para chamadas HTTP, mantendo o fallback local durante a transicao.
