# Diário do Projeto

## 09/07/2026

- Criado repositório no GitHub
- Criado README.md
- Criado docs/01-visao-do-produto.md
- Definido objetivo do LICITA AI
- Mapeado fluxo atual da Petronect
- Identificado principal gargalo:
  - Abrir oportunidades manualmente
  - Encontrar fornecedor
  - Histórico de preços

Próximo passo:
Configurar ambiente de desenvolvimento e criar a primeira versão do banco de dados.

## 27/08/2026 - Estabilizacao da linha de base

- Confirmada a implementacao local do frontend React/Vite e da API Node.js com SQLite.
- Registradas as funcionalidades de importacao Word, oportunidades, fornecedores, cotacoes, propostas, painel e backup.
- Confirmada a transicao em andamento de `localStorage` para SQLite, com fallback offline e fila de sincronizacao.
- Testes de sincronizacao, fluxo SQLite, API, lint e build executados com sucesso.
- Banco operacional identificado como dado local e protegido contra inclusao no Git.
- Componentes legados sem uso removidos: `Cotacoes.jsx`, `HistoricoCotacoes.jsx`, `itens.jsx` e `ComparativoCotacoes.jsx`.
- `backend/db/schema.sql` removido por duplicar a migracao inicial; a ativacao de chaves estrangeiras permanece no codigo de inicializacao do banco.
- Script de carga demonstrativa removido por nao possuir protecao contra substituicao do banco operacional.
- Documentacao alinhada ao estado implementado.

Proximo incremento recomendado:
Concluir o CRUD granular de oportunidades e itens, sem iniciar essa implementacao durante a estabilizacao.
