# LICITA AI - Arquitetura do Sistema

## Objetivo

Automatizar o processo de analise de oportunidades da Petronect, identificacao de fornecedores, geracao de cotacoes e acompanhamento comercial em uma aplicacao local.

## Visao atual

```text
Navegador React/Vite
  |-- componentes de oportunidades, fornecedores, cotacoes e propostas
  |-- regras de importacao e padronizacao
  |-- cache/fallback em localStorage
  |-- fila persistente de sincronizacao
  |
  +---- HTTP em 127.0.0.1 ----> API Node.js ----> SQLite local
```

O backend escuta somente em `127.0.0.1:3333`. O frontend usa a API quando ela esta disponivel e preserva operacao local durante indisponibilidades. Essa duplicidade e transitoria e deve ser reduzida nos proximos incrementos.

## Frontend

- React 19 e Vite 8, em JavaScript.
- `domain/`: leitura de Word e padronizacao dos itens.
- `services/backendApi.js`: contratos HTTP.
- `services/dataServices.js`: acesso ao fallback local.
- `services/syncQueue.js`: fila de escritas pendentes.
- `storage/database.js`: migracao e persistencia no `localStorage`.
- `components/`: painel, oportunidades, historico de importacoes, fornecedores, cotacoes, propostas e backup.

Os componentes legados que nao faziam parte da navegacao ativa foram removidos durante a estabilizacao da linha de base.

## Backend e banco

- Servidor HTTP nativo do Node.js.
- Persistencia com `node:sqlite`.
- Migracoes versionadas em `backend/db/migrations` e aplicadas na inicializacao.
- Tabelas: oportunidades, itens, fornecedores, especialidades, cotacoes, propostas e itens de proposta.
- Operacoes de backup executadas em transacao.
- Testes de banco e API usam arquivos SQLite temporarios isolados.

O arquivo `backend/data/licita-ai.sqlite` contem dados operacionais locais e nao faz parte do codigo-fonte.

## Fluxo funcional implementado

```text
Arquivo Word
  -> oportunidades e itens
  -> padronizacao local
  -> busca de fornecedores
  -> geracao de cotacao
  -> resposta comercial
  -> proposta interna
  -> acompanhamento no painel
```

## Limitacoes conhecidas

- oportunidades ainda sao gravadas na API por substituicao integral da colecao;
- SQLite e `localStorage` coexistem como fontes durante a transicao;
- nao ha autenticacao, auditoria ou suporte multiusuario;
- a validacao dos contratos da API ainda e limitada;
- automacao Petronect, envio real de e-mail e IA ainda nao foram implementados.

## Proximo incremento planejado

Concluir a gestao granular de oportunidades e itens na API e no frontend, evitando substituicao integral da base e implementando o cadastro, edicao, pesquisa e filtros previstos nos requisitos.
