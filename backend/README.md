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
- `GET /api/opportunities?includeArchived=true|false`
- `POST /api/opportunities`
- `GET /api/opportunities/:opportunityId?includeArchived=true|false`
- `PATCH /api/opportunities/:opportunityId`
- `POST /api/opportunities/:opportunityId/archive`
- `POST /api/opportunities/:opportunityId/restore`
- `GET /api/opportunities/:opportunityId/items?includeArchived=true|false`
- `POST /api/opportunities/:opportunityId/items`
- `GET /api/opportunities/:opportunityId/items/:itemId?includeArchived=true|false`
- `PATCH /api/opportunities/:opportunityId/items/:itemId`
- `POST /api/opportunities/:opportunityId/items/:itemId/archive`
- `POST /api/opportunities/:opportunityId/items/:itemId/restore`
- `PUT /api/opportunities` (obsoleto; somente compatibilidade temporaria)
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

## Contratos granulares de oportunidades

Corpos de requisicao aceitam somente os campos documentados. A criacao de oportunidade exige `number` (texto, 1 a 100 caracteres) e aceita `title`, `dueDate` e `status`. A edicao usa o mesmo contrato, com campos parciais e `version` inteiro positivo obrigatorio.

A criacao de item exige `description`, `quantity` e `unit` como textos nao vazios. `quantity` deve representar numero positivo. Tambem aceita `itemNumber`, `reference`, `manufacturer`, `deliveryLocation`, `deliveryDeadline` e `technicalNotes`. A edicao usa os mesmos campos de modo parcial e exige `version`. A descricao permanece independente e soberana: referencia e fabricante sao metadados opcionais e nunca substituem nem reescrevem a descricao.

Arquivamento e restauracao recebem `{ "version": n }`. Toda alteracao bem-sucedida incrementa `version`; versao desatualizada responde `409 conflict`. A resposta de sucesso usa `{ "data": ... }`. Erros granulares usam `{ "error": { "code", "message", "details"? } }`, com `400 invalid_json`, `404 not_found`, `409 duplicate|conflict`, `413 payload_too_large`, `415 unsupported_media_type` ou `422 validation_error`.

## Importar backup do frontend

Envie para `POST /api/import-backup` o JSON exportado pela aba Dados do frontend.

Essa rota substitui o conteudo atual do SQLite pelo conteudo do backup.

## Proximo passo

Concluir a troca gradual dos services restantes do frontend para chamadas HTTP, mantendo o fallback local durante a transicao.
