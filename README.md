# LICITA AI

Sistema local para organizar o fluxo de oportunidades da Petrobras/Petronect, com evolucao futura para outras plataformas de licitacao.

## Estado atual

O MVP possui frontend React/Vite, API local em Node.js e persistencia SQLite. A integracao do frontend com a API esta em transicao: o SQLite e a fonte principal quando disponivel e o navegador mantem uma copia local para operacao offline e sincronizacao posterior.

## Fluxo atual do MVP

- Importar oportunidades a partir de arquivo Word.
- Preservar historico de importacoes.
- Classificar e padronizar itens por regras locais.
- Cadastrar fornecedores e especialidades.
- Gerar e acompanhar cotacoes.
- Registrar respostas e condicoes comerciais.
- Gerar propostas internas para posterior lancamento manual na Petronect.
- Acompanhar pendencias pelo painel.
- Exportar, importar e comparar backups.
- Reenviar alteracoes locais depois da reconexao com a API.

Ainda nao fazem parte do MVP atual: automacao da Petronect, integracao real com e-mail, autenticacao, auditoria e recursos de IA generativa.

## Estrutura

```text
frontend/   Aplicacao React/Vite e fallback local no navegador
backend/    API Node.js e persistencia SQLite
docs/       Visao, requisitos, arquitetura e roadmap
scripts/    Inicializacao do ambiente local
```

## Rodar frontend

```bash
cd frontend
npm run dev
```

## Rodar backend

```bash
cd backend
npm run dev
```

## Rodar sistema completo

Na raiz do projeto:

```bash
npm run dev
```

Esse comando inicializa o banco SQLite, sobe a API em `http://127.0.0.1:3333` e o frontend em
`http://127.0.0.1:5173`.
Quando o frontend estiver pronto, o navegador e aberto automaticamente.

No Windows, tambem e possivel iniciar pelo arquivo:

```text
iniciar-licita-ai.cmd
```

Mantenha a janela aberta enquanto estiver usando o sistema.

Comandos uteis na raiz:

```bash
npm run db:init
npm run test:api
npm run test:flow
npm run test:sync
npm run check
npm run lint
npm run build
```

`npm run test:flow` executa um teste rapido do fluxo SQLite em um banco temporario isolado.
`npm run test:api` executa as rotas HTTP em uma porta aleatoria e outro banco temporario isolado.
`npm run test:sync` valida a fila local, a migracao inicial de oportunidades e a reconexao com a API.
`npm run check` executa lint, teste da fila de sincronizacao, teste de fluxo, teste de API e build em sequencia.

Quando uma escrita segura falha por indisponibilidade da API, o frontend preserva a alteracao localmente e a coloca em uma fila persistente. O cabecalho mostra quantas operacoes estao pendentes e tenta reenvia-las a cada verificacao do backend. A restauracao integral de backup exige conexao e nunca e reenviada automaticamente.

O arquivo operacional `backend/data/licita-ai.sqlite` e configuracoes locais nunca devem ser adicionados ao Git. Use os scripts de teste, que trabalham com bancos temporarios isolados.

Rotas iniciais:

- `GET /health`
- `GET /api`

## Transicao arquitetural

O frontend ainda mantem fallback no navegador por meio de `services/dataServices.js`. O proximo incremento deve concluir o CRUD granular de oportunidades e itens na API, reduzindo a duplicidade entre SQLite e `localStorage`.
