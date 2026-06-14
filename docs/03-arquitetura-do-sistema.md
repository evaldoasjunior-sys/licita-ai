# LICITA AI - Arquitetura do Sistema

## Objetivo

Automatizar o processo de análise de oportunidades da Petronect, identificação de fornecedores, geração de cotações e acompanhamento comercial.

---

## Módulos

### 1. Oportunidades

Responsável pelo cadastro e gerenciamento das oportunidades.

Campos principais:

* Número da oportunidade
* Data de vencimento
* Status
* Lista de itens

---

### 2. Itens

Responsável pela análise dos itens da oportunidade.

Campos principais:

* Número do item
* Quantidade
* Descrição
* Fabricante
* Categoria

Funções:

* Buscar fornecedores compatíveis

---

### 3. Base Comercial

Responsável pelo cadastro de fornecedores e especialidades.

Campos principais:

* Fornecedor
* Email
* Telefone
* Fabricante
* Categoria

Funções:

* Cadastro de especialidades
* Busca por fabricante e categoria

---

### 4. Cotações

Responsável pela geração de solicitações de cotação.

Funções:

* Geração automática de e-mail
* Integração com histórico

---

### 5. Histórico

Responsável pelo acompanhamento das cotações.

Status possíveis:

* Aguardando resposta
* Respondido
* Sem retorno
* Pedido emitido

---

## Fluxo Principal

Oportunidade
↓
Itens
↓
Busca de Fornecedores
↓
Geração de Cotação
↓
Histórico
↓
Resposta do Fornecedor

---

## Roadmap

### MVP 1.9

Integração completa:

Oportunidade → Item → Cotação

### MVP 2.0

Banco de dados

### MVP 2.1

Importação automática de oportunidades

### MVP 2.2

Integração com e-mail

### MVP 3.0

IA para classificação automática de itens e fornecedores
