import { useEffect, useState } from "react";
import { backendApi } from "../services/backendApi";
import {
  opportunityService,
  proposalService,
  quotationService,
} from "../services/dataServices";

function itensAtivosDasOportunidades(oportunidades) {
  return oportunidades.flatMap((opportunity) =>
    opportunity.items
      .filter((item) => !item.archivedAt)
      .map((item) => ({
        opportunity,
        item,
      }))
  );
}

function propostaDaCotacao(propostas, cotacao) {
  return propostas.find(
    (proposal) =>
      !proposal.archivedAt && proposal.items.some((item) => item.quotationId === cotacao.id)
  );
}

function contar(lista, filtro) {
  return lista.filter(filtro).length;
}

function Painel({ backendStatus, onNavigate, syncRevision }) {
  const [oportunidades, setOportunidades] = useState(() => opportunityService.listActive());
  const [cotacoes, setCotacoes] = useState(() => quotationService.listActive());
  const [propostas, setPropostas] = useState(() => proposalService.listActive());
  const [origemDados, setOrigemDados] = useState("local");
  const [mensagemIntegracao, setMensagemIntegracao] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarPainelDoBackend() {
      try {
        const [oportunidadesResultado, cotacoesResultado, propostasResultado] = await Promise.all([
          backendApi.opportunities({ includeArchived: true }),
          backendApi.quotations({ includeArchived: true }),
          backendApi.proposals({ includeArchived: true }),
        ]);

        if (!ativo) return;

        opportunityService.saveAll(oportunidadesResultado.data);
        quotationService.saveAll(cotacoesResultado.data);
        proposalService.saveAll(propostasResultado.data);

        setOportunidades(oportunidadesResultado.data.filter((opportunity) => !opportunity.archivedAt));
        setCotacoes(cotacoesResultado.data.filter((cotacao) => !cotacao.archivedAt));
        setPropostas(propostasResultado.data.filter((proposal) => !proposal.archivedAt));
        setOrigemDados("sqlite");
        setMensagemIntegracao("Painel carregado do banco SQLite.");
      } catch {
        if (!ativo) return;

        setOrigemDados("local");
        setMensagemIntegracao("Backend indisponivel. Painel carregado do navegador local.");
      }
    }

    carregarPainelDoBackend();

    return () => {
      ativo = false;
    };
  }, [backendStatus, syncRevision]);

  const itensAtivos = itensAtivosDasOportunidades(oportunidades);

  const indicadores = [
    {
      label: "Oportunidades ativas",
      value: oportunidades.length,
    },
    {
      label: "Itens aguardando cotacao",
      value: contar(itensAtivos, ({ item }) => !item.quotationStatus),
    },
    {
      label: "Cotacoes nao enviadas",
      value: contar(cotacoes, (cotacao) => !cotacao.emailSentAt),
    },
    {
      label: "Aguardando resposta",
      value: contar(
        cotacoes,
        (cotacao) => cotacao.emailSentAt && !cotacao.respondedAt && cotacao.status !== "Respondido"
      ),
    },
    {
      label: "Respondidas sem proposta",
      value: contar(
        cotacoes,
        (cotacao) => cotacao.status === "Respondido" && !propostaDaCotacao(propostas, cotacao)
      ),
    },
    {
      label: "Propostas em rascunho",
      value: contar(propostas, (proposal) => proposal.status === "Rascunho"),
    },
    {
      label: "Prontas para envio",
      value: contar(propostas, (proposal) => proposal.status === "Pronta para envio"),
    },
    {
      label: "Enviadas na Petronect",
      value: contar(propostas, (proposal) => proposal.status === "Enviada na Petronect"),
    },
  ];

  const pendencias = [
    ...itensAtivos
      .filter(({ item }) => !item.quotationStatus)
      .map(({ opportunity, item }) => ({
        tipo: "Gerar cotacao",
        referencia: `${opportunity.number} / Item ${item.itemNumber}`,
        detalhe: item.category || item.rawDescription || item.description || "Item sem categoria",
        tela: "oportunidades",
        destino: null,
        botao: "Abrir oportunidades",
      })),
    ...cotacoes
      .filter((cotacao) => !cotacao.emailSentAt)
      .map((cotacao) => ({
        tipo: "Enviar cotacao",
        referencia: `${cotacao.opportunityNumber} / Item ${cotacao.itemNumber}`,
        detalhe: cotacao.supplierName || "Fornecedor nao informado",
        tela: "cotacoes",
        destino: { tipo: "cotacao", id: cotacao.id },
        botao: "Abrir cotacao",
      })),
    ...cotacoes
      .filter(
        (cotacao) => cotacao.emailSentAt && !cotacao.respondedAt && cotacao.status !== "Respondido"
      )
      .map((cotacao) => ({
        tipo: "Cobrar resposta",
        referencia: `${cotacao.opportunityNumber} / Item ${cotacao.itemNumber}`,
        detalhe: cotacao.supplierName || "Fornecedor nao informado",
        tela: "cotacoes",
        destino: { tipo: "cotacao", id: cotacao.id },
        botao: "Abrir cotacao",
      })),
    ...cotacoes
      .filter((cotacao) => cotacao.status === "Respondido" && !propostaDaCotacao(propostas, cotacao))
      .map((cotacao) => ({
        tipo: "Gerar proposta",
        referencia: `${cotacao.opportunityNumber} / Item ${cotacao.itemNumber}`,
        detalhe: cotacao.supplierName || "Fornecedor nao informado",
        tela: "cotacoes",
        destino: { tipo: "gerar-proposta", id: cotacao.id },
        botao: "Gerar proposta",
      })),
    ...propostas
      .filter((proposal) => proposal.status === "Pronta para envio")
      .map((proposal) => ({
        tipo: "Enviar na Petronect",
        referencia: `${proposal.opportunityNumber} / Versao ${proposal.version}`,
        detalhe: `Total ${proposal.totalValue || "0"}`,
        tela: "propostas",
        destino: { tipo: "proposta", id: proposal.id },
        botao: "Abrir proposta",
      })),
    ...propostas
      .filter((proposal) => proposal.status === "Enviada na Petronect")
      .map((proposal) => ({
        tipo: "Atualizar resultado",
        referencia: `${proposal.opportunityNumber} / Versao ${proposal.version}`,
        detalhe: "Marcar como ganha ou perdida quando houver retorno.",
        tela: "propostas",
        destino: { tipo: "proposta", id: proposal.id },
        botao: "Abrir proposta",
      })),
  ];

  return (
    <div>
      <h2>Painel de acompanhamento</h2>
      <p>Visao geral das oportunidades, cotacoes, respostas e propostas que precisam de acao.</p>
      <p className="import-message">
        Base em uso: {origemDados === "sqlite" ? "Banco SQLite" : "Navegador local"}. {mensagemIntegracao}
      </p>

      <section className="dashboard-grid">
        {indicadores.map((indicador) => (
          <div className="dashboard-metric" key={indicador.label}>
            <strong>{indicador.value}</strong>
            <span>{indicador.label}</span>
          </div>
        ))}
      </section>

      <section className="dashboard-section">
        <h3>Pendencias</h3>

        {pendencias.length === 0 ? (
          <p>Nenhuma pendencia operacional no momento.</p>
        ) : (
          <div className="table-scroll">
            <table className="opportunity-table dashboard-table">
              <thead>
                <tr>
                  <th>ACAO</th>
                  <th>REFERENCIA</th>
                  <th>DETALHE</th>
                  <th>IR PARA</th>
                </tr>
              </thead>
              <tbody>
                {pendencias.map((pendencia, index) => (
                  <tr key={`${pendencia.tipo}-${pendencia.referencia}-${index}`}>
                    <td>{pendencia.tipo}</td>
                    <td>{pendencia.referencia}</td>
                    <td>{pendencia.detalhe}</td>
                    <td>
                      <button onClick={() => onNavigate(pendencia.tela, pendencia.destino)} title={`Abre a tela relacionada para executar: ${pendencia.tipo}.`}>
                        {pendencia.botao}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export default Painel;
