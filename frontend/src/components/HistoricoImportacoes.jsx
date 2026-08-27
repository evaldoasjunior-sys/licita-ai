import { useEffect, useState } from "react";
import { backendApi } from "../services/backendApi";
import { opportunityService } from "../services/dataServices";

function listarItens(opportunities) {
  return opportunities.flatMap((opportunity) =>
    opportunity.items
      .filter((item) => !item.archivedAt || item.quotationStatus === "Declinado")
      .map((item) => ({
        opportunity,
        item,
      }))
  );
}

function formatarData(valor) {
  if (!valor) return "Nao informado";

  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;

  return data.toLocaleString("pt-BR");
}

function agruparPorImportacao(opportunities) {
  const grupos = new Map();

  opportunities
    .filter((opportunity) => opportunity.archivedAt)
    .forEach((opportunity) => {
      const chave = opportunity.importBatchId || opportunity.archivedAt || opportunity.id;
      const grupo = grupos.get(chave) || {
        id: chave,
        importFileName: opportunity.importFileName || opportunity.title || "Arquivo nao informado",
        importedAt: opportunity.importedAt,
        archivedAt: opportunity.archivedAt,
        archiveReason: opportunity.archiveReason || "Historico",
        opportunities: [],
      };

      grupo.opportunities.push(opportunity);
      grupos.set(chave, grupo);
    });

  return Array.from(grupos.values()).sort((a, b) => {
    const dataA = new Date(a.archivedAt || a.importedAt || 0).getTime();
    const dataB = new Date(b.archivedAt || b.importedAt || 0).getTime();
    return dataB - dataA;
  });
}

function HistoricoImportacoes({ backendStatus, syncRevision }) {
  const [grupos, setGrupos] = useState(() =>
    agruparPorImportacao(opportunityService.listAll())
  );
  const [origemDados, setOrigemDados] = useState("local");
  const [mensagemIntegracao, setMensagemIntegracao] = useState("");

  async function atualizarHistorico() {
    try {
      const resultado = await backendApi.opportunities({ includeArchived: true });
      opportunityService.saveAll(resultado.data);
      setGrupos(agruparPorImportacao(resultado.data));
      setOrigemDados("sqlite");
      setMensagemIntegracao("Historico carregado do banco SQLite.");
    } catch {
      setGrupos(agruparPorImportacao(opportunityService.listAll()));
      setOrigemDados("local");
      setMensagemIntegracao("Backend indisponivel. Historico carregado do navegador local.");
    }
  }

  useEffect(() => {
    let ativo = true;

    backendApi
      .opportunities({ includeArchived: true })
      .then((resultado) => {
        if (!ativo) return;

        opportunityService.saveAll(resultado.data);
        setGrupos(agruparPorImportacao(resultado.data));
        setOrigemDados("sqlite");
        setMensagemIntegracao("Historico carregado do banco SQLite.");
      })
      .catch(() => {
        if (!ativo) return;

        setOrigemDados("local");
        setMensagemIntegracao("Backend indisponivel. Historico carregado do navegador local.");
      });

    return () => {
      ativo = false;
    };
  }, [backendStatus, syncRevision]);

  return (
    <div>
      <div className="page-title-row">
        <div>
          <h2>Historico de importacoes</h2>
          <p>Consulte aqui os lotes anteriores que sairam da tela principal de oportunidades.</p>
        </div>
        <button onClick={atualizarHistorico} title="Recarrega o historico de importacoes, usando SQLite se disponivel.">Atualizar</button>
      </div>
      <p className="import-message">
        Base em uso: {origemDados === "sqlite" ? "Banco SQLite" : "Navegador local"}. {mensagemIntegracao}
      </p>

      {grupos.length === 0 ? (
        <p>Nenhuma importacao anterior arquivada.</p>
      ) : (
        grupos.map((grupo) => {
          const itens = listarItens(grupo.opportunities);

          return (
            <section className="history-batch" key={grupo.id}>
              <div className="history-batch-header">
                <div>
                  <h3>{grupo.importFileName}</h3>
                  <p>
                    Importado em: {formatarData(grupo.importedAt)} | Movido para historico em:{" "}
                    {formatarData(grupo.archivedAt)}
                  </p>
                  <p>Motivo: {grupo.archiveReason}</p>
                </div>
                <strong>
                  {grupo.opportunities.length} oportunidade(s) / {itens.length} item(ns)
                </strong>
              </div>

              <div className="table-scroll">
                <table className="opportunity-table">
                  <thead>
                    <tr>
                      <th>N.</th>
                      <th>ITEM</th>
                      <th>QTDE</th>
                      <th>DESCRICAO</th>
                      <th>ENTREGA</th>
                      <th>ANEXO</th>
                      <th>VENCIMENTO</th>
                      <th>STATUS</th>
                      <th>CATEGORIA</th>
                      <th>FABRICANTE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map(({ opportunity, item }) => (
                      <tr key={`${opportunity.id}-${item.id}`}>
                        <td>{opportunity.number}</td>
                        <td>{item.itemNumber}</td>
                        <td>{item.quantity}</td>
                        <td>{item.rawDescription || item.description}</td>
                        <td>{item.deliveryLocation || "Nao informado"}</td>
                        <td>{item.attachmentRequired || ""}</td>
                        <td>{opportunity.dueDate || "Nao informado"}</td>
                        <td>{item.quotationStatus || opportunity.status}</td>
                        <td>{item.category || "Nao identificada"}</td>
                        <td>
                          {item.manufacturers.map((manufacturer) => manufacturer.name).join(", ") ||
                            "Nao identificado"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}

export default HistoricoImportacoes;
