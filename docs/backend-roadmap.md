# Backend Roadmap

## Objetivo

Preparar o LICITA AI para sair do armazenamento local do navegador e evoluir para uma API com banco de dados.

## Fase 1 - API Base

- Criar backend Node. Concluido.
- Expor rota de saude. Concluido.
- Definir contrato inicial dos recursos. Concluido.
- Manter frontend usando `services/dataServices.js` com localStorage.

## Fase 2 - Persistencia

- Adicionar banco SQLite para desenvolvimento local. Concluido.
- Criar tabelas:
  - opportunities. Concluido.
  - opportunity_items. Concluido.
  - suppliers. Concluido.
  - supplier_specialties. Concluido.
  - quotations. Concluido.
  - proposals. Concluido.
  - proposal_items. Concluido.
- Criar migracoes simples. Concluido.
- Criar rota de importacao do backup local para SQLite. Concluido.
- Criar rotas de escrita individuais. Concluido para fornecedores, cotacoes, propostas e status de cotacao dos itens.

## Fase 3 - Integracao Frontend

- Criar cliente HTTP no frontend. Concluido.
- Trocar implementacao dos services para API. Em andamento; oportunidades, fornecedores, cotacoes, propostas e painel ja usam a API com fallback local.
- Manter backup/exportacao durante transicao.
- Reenviar automaticamente escritas feitas com a API indisponivel. Concluido com fila local persistente e indicador no cabecalho.
- Isolar testes automatizados do banco operacional. Concluido com arquivos SQLite temporarios e porta aleatoria para a API de teste.

## Fase 4 - Automacao Petronect

- Criar rotina separada para busca/importacao automatica.
- Registrar origem, lote e data de importacao.
- Manter possibilidade de importar Word enquanto a automacao nao estiver madura.
