import { useEffect, useState } from "react";
import { backendApi } from "../services/backendApi";
import { proposalService, PROPOSAL_STATUSES } from "../services/dataServices";

function parseMoney(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function csvCell(value) {
  return `"${String(value ?? "").replaceAll('"', '""')}"`;
}

function formatDate(value) {
  if (!value) return "Nao informado";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function propostaDoAtalho(atalho) {
  if (atalho?.tipo !== "proposta" || !atalho.id) return null;
  return proposalService.findById(atalho.id);
}

function Propostas({ atalho, backendStatus, syncRevision }) {
  const [propostas, setPropostas] = useState(() => proposalService.listActive());
  const [propostaAberta, setPropostaAberta] = useState(() => propostaDoAtalho(atalho));
  const [origemDados, setOrigemDados] = useState("local");
  const [mensagemIntegracao, setMensagemIntegracao] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarPropostasDoBackend() {
      try {
        const resultado = await backendApi.proposals({ includeArchived: true });
        if (!ativo) return;

        setOrigemDados("sqlite");
        setMensagemIntegracao("Propostas carregadas do banco SQLite.");
        proposalService.saveAll(resultado.data);
        setPropostas(resultado.data.filter((proposal) => !proposal.archivedAt));

        if (atalho?.tipo === "proposta") {
          setPropostaAberta(
            resultado.data.find((proposal) => proposal.id === atalho.id && !proposal.archivedAt) || null
          );
        }
      } catch {
        if (!ativo) return;

        setOrigemDados("local");
        setMensagemIntegracao("Backend indisponivel. Usando propostas locais deste navegador.");
      }
    }

    carregarPropostasDoBackend();

    return () => {
      ativo = false;
    };
  }, [atalho, backendStatus, syncRevision]);

  function atualizarLista(lista) {
    proposalService.saveAll(lista);
    setPropostas(lista.filter((proposal) => !proposal.archivedAt));
  }

  async function atualizarStatus(proposalId, status) {
    const propostaAtualizada = proposalService
      .listAll()
      .find((proposal) => proposal.id === proposalId);

    const atualizadas = proposalService.listAll().map((proposal) =>
      proposal.id === proposalId ? { ...proposal, status, updatedAt: new Date().toISOString() } : proposal
    );

    const propostaParaSalvar = atualizadas.find((proposal) => proposal.id === proposalId) || propostaAtualizada;

    if (origemDados === "sqlite") {
      try {
        await backendApi.saveProposal(propostaParaSalvar);
        const resultado = await backendApi.proposals({ includeArchived: true });
        atualizarLista(resultado.data);
        setMensagemIntegracao("Status da proposta salvo no banco SQLite.");
      } catch {
        atualizarLista(atualizadas);
        setOrigemDados("local");
        setMensagemIntegracao("Nao foi possivel salvar no SQLite. Alteracao mantida localmente.");
      }
    } else {
      atualizarLista(atualizadas);
    }
  }

  async function arquivarProposta(proposalId) {
    const confirmar = window.confirm("Arquivar esta proposta? O historico sera preservado.");
    if (!confirmar) return;

    const agora = new Date().toISOString();
    const atualizadas = proposalService.listAll().map((proposal) =>
      proposal.id === proposalId
        ? { ...proposal, status: "Arquivada", archivedAt: agora, updatedAt: agora }
        : proposal
    );

    if (origemDados === "sqlite") {
      try {
        await backendApi.deleteProposal(proposalId);
        const resultado = await backendApi.proposals({ includeArchived: true });
        atualizarLista(resultado.data);
        setMensagemIntegracao("Proposta arquivada no banco SQLite.");
      } catch {
        atualizarLista(atualizadas);
        setOrigemDados("local");
        setMensagemIntegracao("Nao foi possivel arquivar no SQLite. Arquivamento mantido localmente.");
      }
    } else {
      atualizarLista(atualizadas);
    }
  }

  function exportarCsv(proposal) {
    const linhas = [
      [
        "Oportunidade",
        "Versao",
        "Status",
        "Item",
        "Descricao",
        "Quantidade",
        "Unidade",
        "Local de entrega",
        "Fornecedor",
        "Custo unitario",
        "Margem",
        "Venda unitario",
        "Total",
      ],
      ...proposal.items.map((item) => [
        proposal.opportunityNumber,
        proposal.version,
        proposal.status,
        item.itemNumber,
        item.description,
        item.quantity,
        item.unit,
        item.deliveryLocation,
        item.supplierName,
        item.costUnitPrice,
        `${item.marginPercent}%`,
        item.saleUnitPrice,
        item.totalSalePrice,
      ]),
      [],
      ["Total da proposta", proposal.totalValue],
    ];

    const content = linhas.map((linha) => linha.map(csvCell).join(";")).join("\n");
    const file = new Blob([content], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");

    link.href = url;
    link.download = `proposta-${proposal.opportunityNumber}-v${proposal.version}.csv`;
    link.click();

    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <h2>Propostas internas</h2>
      <p>
        Acompanhe aqui as propostas preparadas a partir das cotacoes respondidas. O envio para a
        Petronect continua sendo registrado manualmente no status.
      </p>
      <p className="import-message">
        Base em uso: {origemDados === "sqlite" ? "Banco SQLite" : "Navegador local"}. {mensagemIntegracao}
      </p>

      {propostas.length === 0 ? (
        <p>Nenhuma proposta gerada.</p>
      ) : (
        <div className="table-scroll">
          <table className="opportunity-table">
            <thead>
              <tr>
                <th>DATA</th>
                <th>OPORTUNIDADE</th>
                <th>VERSAO</th>
                <th>STATUS</th>
                <th>MARGEM</th>
                <th>TOTAL</th>
                <th>ITENS</th>
                <th>ACAO</th>
              </tr>
            </thead>
            <tbody>
              {propostas.map((proposal) => (
                <tr key={proposal.id}>
                  <td>{formatDate(proposal.createdAt)}</td>
                  <td>{proposal.opportunityNumber}</td>
                  <td>{proposal.version}</td>
                  <td>
                    <select value={proposal.status} onChange={(event) => atualizarStatus(proposal.id, event.target.value)}>
                      {PROPOSAL_STATUSES.filter((status) => status !== "Arquivada").map((status) => (
                        <option key={status}>{status}</option>
                      ))}
                    </select>
                  </td>
                  <td>{proposal.marginPercent}%</td>
                  <td>{formatMoney(parseMoney(proposal.totalValue))}</td>
                  <td>{proposal.items.length}</td>
                  <td>
                    <div className="table-actions">
                      <button
                        onClick={() => setPropostaAberta(proposal)}
                        title="Abre a proposta em uma janela com itens, valores e detalhes."
                      >
                        Ver
                      </button>
                      <button onClick={() => exportarCsv(proposal)} title="Baixa uma planilha CSV com os dados desta proposta.">Exportar CSV</button>
                      <button className="decline-button" onClick={() => arquivarProposta(proposal.id)} title="Arquiva a proposta mantendo o historico preservado.">
                        Arquivar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {propostaAberta && (
        <div className="modal-backdrop">
          <section className="modal-panel proposal-detail-modal">
            <div className="modal-title-row">
              <div>
                <h3>
                  Proposta {propostaAberta.opportunityNumber} - versao {propostaAberta.version}
                </h3>
                <p>
                  Status: {propostaAberta.status} | Total:{" "}
                  {formatMoney(parseMoney(propostaAberta.totalValue))}
                </p>
              </div>
              <button onClick={() => setPropostaAberta(null)} title="Fecha a janela de detalhes da proposta.">Voltar</button>
            </div>

            {propostaAberta.notes && <p>{propostaAberta.notes}</p>}

            <div className="table-scroll">
              <table className="opportunity-table">
                <thead>
                  <tr>
                    <th>ITEM</th>
                    <th>DESCRICAO</th>
                    <th>FORNECEDOR</th>
                    <th>QTDE</th>
                    <th>CUSTO UNIT.</th>
                    <th>MARGEM</th>
                    <th>VENDA UNIT.</th>
                    <th>TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {propostaAberta.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.itemNumber}</td>
                      <td>{item.description}</td>
                      <td>{item.supplierName}</td>
                      <td>{item.quantity}</td>
                      <td>{formatMoney(parseMoney(item.costUnitPrice))}</td>
                      <td>{item.marginPercent}%</td>
                      <td>{formatMoney(parseMoney(item.saleUnitPrice))}</td>
                      <td>{formatMoney(parseMoney(item.totalSalePrice))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="modal-actions">
              <button onClick={() => exportarCsv(propostaAberta)} title="Baixa uma planilha CSV desta proposta aberta.">Exportar CSV</button>
              <button onClick={() => setPropostaAberta(null)} title="Retorna para a lista de propostas.">Voltar</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default Propostas;
