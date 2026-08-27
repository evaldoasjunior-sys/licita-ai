import { useEffect, useState } from "react";
import { backendApi } from "../services/backendApi";
import {
  createId,
  opportunityService,
  proposalService,
  QUOTATION_STATUSES,
  quotationService,
} from "../services/dataServices";

function statusDoEnvio(cotacao) {
  if (cotacao.emailSentAt) return `Enviado em ${cotacao.emailSentAt}`;
  return "Nao enviado";
}

function parseMoney(value) {
  const normalized = String(value || "")
    .replace(/[^\d,.-]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseNumber(value) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value) {
  return value.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function localizarItemDaCotacao(cotacao) {
  const oportunidade = opportunityService.listAll().find(
    (opportunity) =>
      opportunity.id === cotacao.opportunityId || opportunity.number === cotacao.opportunityNumber
  );

  const item = oportunidade?.items.find(
    (opportunityItem) =>
      opportunityItem.id === cotacao.itemId || opportunityItem.itemNumber === cotacao.itemNumber
  );

  return { oportunidade, item };
}

function cotacaoDoAtalho(atalho) {
  if (!atalho?.id) return null;
  return quotationService.findById(atalho.id);
}

function propostaDraftDoAtalho(atalho) {
  if (atalho?.tipo !== "gerar-proposta") return null;

  const cotacao = cotacaoDoAtalho(atalho);
  if (!cotacao) return null;

  const { item } = localizarItemDaCotacao(cotacao);

  return {
    cotacao,
    item,
    margem: "20",
    mensagem: "",
  };
}

function CotacaoGeradas({ atalho, backendStatus, syncRevision }) {
  const [cotacoes, setCotacoes] = useState(() => quotationService.listActive());
  const [cotacaoEmEdicao, setCotacaoEmEdicao] = useState(() =>
    atalho?.tipo === "cotacao" ? cotacaoDoAtalho(atalho) : null
  );
  const [propostaEmGeracao, setPropostaEmGeracao] = useState(() => propostaDraftDoAtalho(atalho));
  const [origemDados, setOrigemDados] = useState("local");
  const [mensagemIntegracao, setMensagemIntegracao] = useState("");

  useEffect(() => {
    let ativo = true;

    async function carregarCotacoesDoBackend() {
      try {
        const resultado = await backendApi.quotations({ includeArchived: true });
        if (!ativo) return;

        setOrigemDados("sqlite");
        setMensagemIntegracao("Cotacoes carregadas do banco SQLite.");
        quotationService.saveAll(resultado.data);
        setCotacoes(resultado.data.filter((cotacao) => !cotacao.archivedAt));

        if (atalho?.tipo === "cotacao") {
          setCotacaoEmEdicao(
            resultado.data.find((cotacao) => cotacao.id === atalho.id && !cotacao.archivedAt) || null
          );
        }

        if (atalho?.tipo === "gerar-proposta") {
          const cotacao = resultado.data.find((item) => item.id === atalho.id && !item.archivedAt);
          if (cotacao) {
            const { item } = localizarItemDaCotacao(cotacao);
            setPropostaEmGeracao({ cotacao, item, margem: "20", mensagem: "" });
          }
        }
      } catch {
        if (!ativo) return;

        setOrigemDados("local");
        setMensagemIntegracao("Backend indisponivel. Usando cotacoes locais deste navegador.");
      }
    }

    carregarCotacoesDoBackend();

    return () => {
      ativo = false;
    };
  }, [atalho, backendStatus, syncRevision]);

  function todasCotacoes() {
    return quotationService.listAll();
  }

  function persistirCotacoes(atualizadas) {
    quotationService.saveAll(atualizadas);
    setCotacoes(atualizadas.filter((cotacao) => !cotacao.archivedAt));
  }

  async function atualizarStatusDoItem(cotacaoAtualizada) {
    opportunityService.updateItemQuotationStatus({
      opportunityId: cotacaoAtualizada.opportunityId,
      itemId: cotacaoAtualizada.itemId,
      status: cotacaoAtualizada.status,
    });

    if (origemDados !== "sqlite") return true;

    try {
      await backendApi.updateOpportunityItemQuotationStatus({
        opportunityId: cotacaoAtualizada.opportunityId,
        itemId: cotacaoAtualizada.itemId,
        status: cotacaoAtualizada.status,
      });
      return true;
    } catch {
      return false;
    }
  }

  async function salvarCotacao(cotacaoEditada) {
    let cotacaoAtualizada = null;
    let cotacaoSalvaNoSqlite = false;
    const atualizadas = todasCotacoes().map((cotacao) => {
      if (cotacao.id !== cotacaoEditada.id) return cotacao;

      cotacaoAtualizada = {
        ...cotacao,
        ...cotacaoEditada,
        updatedAt: new Date().toISOString(),
      };

      return cotacaoAtualizada;
    });

    if (origemDados === "sqlite") {
      try {
        await backendApi.saveQuotation(cotacaoAtualizada || cotacaoEditada);
        const resultado = await backendApi.quotations({ includeArchived: true });
        persistirCotacoes(resultado.data);
        cotacaoSalvaNoSqlite = true;
        setMensagemIntegracao("Cotacao salva no banco SQLite.");
      } catch {
        persistirCotacoes(atualizadas);
        setOrigemDados("local");
        setMensagemIntegracao("Nao foi possivel salvar no SQLite. Alteracao mantida localmente.");
      }
    } else {
      persistirCotacoes(atualizadas);
    }

    if (cotacaoAtualizada) {
      const itemSincronizado = await atualizarStatusDoItem(cotacaoAtualizada);
      if (cotacaoSalvaNoSqlite && !itemSincronizado) {
        setMensagemIntegracao(
          "Cotacao salva no SQLite, mas o status do item ficou apenas no navegador. Tente salvar novamente."
        );
      }
    }
    setCotacaoEmEdicao(null);
  }

  function marcarEmailEnviado(cotacao) {
    const confirmar = window.confirm("Confirmar que o e-mail desta cotacao foi enviado?");
    if (!confirmar) return;

    salvarCotacao({
      ...cotacao,
      status: "Email enviado",
      emailSentAt: cotacao.emailSentAt || new Date().toLocaleDateString("pt-BR"),
    });
  }

  function abrirCotacao(cotacao) {
    setCotacaoEmEdicao({ ...cotacao });
  }

  function cancelarEdicao() {
    const confirmar = window.confirm("Cancelar a edicao? As alteracoes nao confirmadas serao descartadas.");
    if (!confirmar) return;

    setCotacaoEmEdicao(null);
  }

  function atualizarRascunho(campo, valor) {
    setCotacaoEmEdicao((cotacao) => (cotacao ? { ...cotacao, [campo]: valor } : cotacao));
  }

  function alterarStatusNoRascunho(status) {
    setCotacaoEmEdicao((cotacao) => {
      if (!cotacao) return cotacao;

      const atualizada = { ...cotacao, status };

      if (status === "Email enviado" && !atualizada.emailSentAt) {
        atualizada.emailSentAt = new Date().toLocaleDateString("pt-BR");
      }

      if (status === "Respondido" && !atualizada.respondedAt) {
        atualizada.respondedAt = new Date().toLocaleDateString("pt-BR");
      }

      return atualizada;
    });
  }

  function registrarRespostaNoRascunho() {
    setCotacaoEmEdicao((cotacao) =>
      cotacao
        ? {
            ...cotacao,
            status: "Respondido",
            respondedAt: cotacao.respondedAt || new Date().toLocaleDateString("pt-BR"),
          }
        : cotacao
    );
  }

  function confirmarEdicao() {
    if (!cotacaoEmEdicao) return;

    const confirmar = window.confirm("Confirmar e salvar as alteracoes desta cotacao?");
    if (!confirmar) return;

    salvarCotacao(cotacaoEmEdicao);
  }

  function abrirGeracaoProposta(cotacao) {
    if (cotacao.status !== "Respondido") {
      alert("A proposta deve ser gerada somente depois que a cotacao estiver como Respondido.");
      return;
    }

    const jaExiste = proposalService.hasActiveForQuotation(cotacao.id);

    if (jaExiste) {
      alert("Ja existe uma proposta ativa gerada para esta cotacao.");
      return;
    }

    const { item } = localizarItemDaCotacao(cotacao);

    setPropostaEmGeracao({
      cotacao,
      item,
      margem: "20",
      mensagem: "",
    });
  }

  function atualizarMargemProposta(margem) {
    setPropostaEmGeracao((draft) => (draft ? { ...draft, margem, mensagem: "" } : draft));
  }

  async function confirmarGeracaoProposta() {
    if (!propostaEmGeracao) return;

    const { cotacao, item, margem } = propostaEmGeracao;
    const propostas = proposalService.listAll();
    const jaExiste = proposalService.hasActiveForQuotation(cotacao.id);

    if (jaExiste) {
      setPropostaEmGeracao((draft) =>
        draft ? { ...draft, mensagem: "Ja existe uma proposta ativa gerada para esta cotacao." } : draft
      );
      return;
    }

    const margemNumerica = parseNumber(margem);
    const custoUnitario = parseMoney(cotacao.unitPrice);

    if (!custoUnitario) {
      setPropostaEmGeracao((draft) =>
        draft ? { ...draft, mensagem: "Informe o preco unitario da cotacao antes de gerar a proposta." } : draft
      );
      return;
    }

    const { oportunidade } = localizarItemDaCotacao(cotacao);
    const quantidade = parseNumber(item?.quantity || "1") || 1;
    const vendaUnitaria = custoUnitario * (1 + margemNumerica / 100);
    const totalVenda = vendaUnitaria * quantidade;
    const versoesDaOportunidade = propostas.filter(
      (proposal) => proposal.opportunityId === cotacao.opportunityId
    );
    const agora = new Date().toISOString();
    const novaProposta = {
      id: createId("proposal"),
      opportunityId: cotacao.opportunityId,
      opportunityNumber: cotacao.opportunityNumber,
      version: versoesDaOportunidade.length + 1,
      status: "Rascunho",
      marginPercent: margem,
      totalValue: totalVenda.toFixed(2),
      items: [
        {
          id: createId("proposal_item"),
          opportunityItemId: cotacao.itemId,
          itemNumber: cotacao.itemNumber,
          description: item?.rawDescription || item?.description || cotacao.itemDescription || cotacao.description,
          quantity: item?.quantity || "1",
          unit: item?.unit || "",
          deliveryLocation: item?.deliveryLocation || "",
          quotationId: cotacao.id,
          supplierName: cotacao.supplierName,
          costUnitPrice: custoUnitario.toFixed(2),
          saleUnitPrice: vendaUnitaria.toFixed(2),
          marginPercent: margem,
          totalSalePrice: totalVenda.toFixed(2),
        },
      ],
      notes: `Proposta interna gerada a partir da cotacao respondida. Prazo: ${
        cotacao.deliveryDays || "Nao informado"
      }. Frete: ${cotacao.freight || "Nao informado"}. Pagamento: ${
        cotacao.paymentTerms || "Nao informado"
      }.`,
      createdAt: agora,
      updatedAt: agora,
      archivedAt: null,
    };

    proposalService.saveAll([...propostas, novaProposta]);

    try {
      await backendApi.saveProposal(novaProposta, { isNew: true });
    } catch {
      // Se a API estiver offline, a proposta fica preservada localmente.
    }

    await salvarCotacao(cotacao);

    if (oportunidade) {
      await atualizarStatusDoItem({ ...cotacao, status: "Proposta gerada" });
    }

    setPropostaEmGeracao(null);
    alert(`Proposta interna versao ${novaProposta.version} gerada.`);
  }

  return (
    <div>
      <h2>Cotacoes geradas</h2>

      <p>Controle aqui o envio das cotacoes e registre as respostas recebidas dos fornecedores.</p>
      <p className="import-message">
        Base em uso: {origemDados === "sqlite" ? "Banco SQLite" : "Navegador local"}. {mensagemIntegracao}
      </p>

      {cotacoes.length === 0 ? (
        <p>Nenhuma cotacao gerada.</p>
      ) : (
        <div className="table-scroll">
          <table className="opportunity-table">
            <thead>
              <tr>
                <th>DATA</th>
                <th>OPORTUNIDADE</th>
                <th>ITEM</th>
                <th>FORNECEDOR</th>
                <th>EMAIL</th>
                <th>STATUS</th>
                <th>ENVIO</th>
                <th>RESPOSTA</th>
                <th>ACAO</th>
              </tr>
            </thead>
            <tbody>
              {cotacoes.map((cotacao) => (
                <tr key={cotacao.id}>
                  <td>{cotacao.requestedAt || "Nao informado"}</td>
                  <td>{cotacao.opportunityNumber}</td>
                  <td>{cotacao.itemNumber || "Nao informado"}</td>
                  <td>{cotacao.supplierName}</td>
                  <td>{cotacao.email || "Nao informado"}</td>
                  <td>{cotacao.status}</td>
                  <td>{statusDoEnvio(cotacao)}</td>
                  <td>{cotacao.respondedAt ? `Respondido em ${cotacao.respondedAt}` : "Aguardando"}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => abrirCotacao(cotacao)} title="Abre a cotacao em uma janela para revisar texto, status e resposta do fornecedor.">Ver cotacao</button>
                      {!cotacao.emailSentAt && (
                        <button onClick={() => marcarEmailEnviado(cotacao)} title="Registra que o e-mail de solicitacao de cotacao foi enviado ao fornecedor.">Marcar email enviado</button>
                      )}
                      {cotacao.status === "Respondido" && (
                        <button onClick={() => abrirGeracaoProposta(cotacao)} title="Inicia a geracao de proposta interna a partir da cotacao respondida.">Gerar proposta</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {cotacaoEmEdicao && (
        <div className="modal-backdrop">
          <section className="modal-panel quotation-modal">
            <div className="modal-title-row">
              <div>
                <h3>Cotacao {cotacaoEmEdicao.opportunityNumber} / Item {cotacaoEmEdicao.itemNumber}</h3>
                <p>
                  {cotacaoEmEdicao.supplierName} | {cotacaoEmEdicao.email || "Email nao informado"}
                </p>
              </div>
              <button onClick={cancelarEdicao} title="Fecha a janela da cotacao sem salvar alteracoes pendentes.">Voltar</button>
            </div>

            <div className="quotation-status-grid">
              <label>
                Status
                <select value={cotacaoEmEdicao.status} onChange={(event) => alterarStatusNoRascunho(event.target.value)}>
                  {QUOTATION_STATUSES.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
              </label>
              <label>
                Data de envio
                <input
                  value={cotacaoEmEdicao.emailSentAt}
                  onChange={(event) => atualizarRascunho("emailSentAt", event.target.value)}
                  placeholder="Ex: 24/06/2026"
                />
              </label>
              <label>
                Data da resposta
                <input
                  value={cotacaoEmEdicao.respondedAt}
                  onChange={(event) => atualizarRascunho("respondedAt", event.target.value)}
                  placeholder="Ex: 25/06/2026"
                />
              </label>
            </div>

            <h4>Resposta do fornecedor</h4>
            <div className="quotation-response-grid">
              <label>
                Preco unitario
                <input
                  value={cotacaoEmEdicao.unitPrice}
                  onChange={(event) => atualizarRascunho("unitPrice", event.target.value)}
                  placeholder="Ex: 1250,00"
                />
              </label>
              <label>
                Prazo de entrega
                <input
                  value={cotacaoEmEdicao.deliveryDays}
                  onChange={(event) => atualizarRascunho("deliveryDays", event.target.value)}
                  placeholder="Ex: 30 dias"
                />
              </label>
              <label>
                Validade
                <input
                  value={cotacaoEmEdicao.validityDays}
                  onChange={(event) => atualizarRascunho("validityDays", event.target.value)}
                  placeholder="Ex: 10 dias"
                />
              </label>
              <label>
                Pagamento
                <input
                  value={cotacaoEmEdicao.paymentTerms}
                  onChange={(event) => atualizarRascunho("paymentTerms", event.target.value)}
                  placeholder="Ex: 28 dias"
                />
              </label>
              <label>
                Frete
                <input
                  value={cotacaoEmEdicao.freight}
                  onChange={(event) => atualizarRascunho("freight", event.target.value)}
                  placeholder="Ex: CIF / FOB / Incluso"
                />
              </label>
            </div>

            <label className="quotation-notes">
              Observacoes
              <textarea
                rows="4"
                value={cotacaoEmEdicao.notes}
                onChange={(event) => atualizarRascunho("notes", event.target.value)}
                placeholder="Registre detalhes importantes da resposta do fornecedor."
              />
            </label>

            <div className="panel-actions">
              {!cotacaoEmEdicao.emailSentAt && (
                <button onClick={() => alterarStatusNoRascunho("Email enviado")} title="Atualiza o rascunho da cotacao como e-mail enviado.">Marcar email enviado</button>
              )}
              <button onClick={registrarRespostaNoRascunho} title="Marca a cotacao como respondida e preenche a data de resposta.">Registrar resposta</button>
              {cotacaoEmEdicao.status === "Respondido" && (
                <button onClick={() => abrirGeracaoProposta(cotacaoEmEdicao)} title="Abre a confirmacao para gerar uma proposta interna desta cotacao.">Gerar proposta</button>
              )}
            </div>

            <p>
              <strong>Texto da cotacao:</strong>
            </p>
            <textarea
              rows="16"
              value={cotacaoEmEdicao.description}
              onChange={(event) => atualizarRascunho("description", event.target.value)}
            />

            <div className="modal-actions">
              <button onClick={cancelarEdicao} title="Descarta as alteracoes feitas nesta janela.">Cancelar</button>
              <button onClick={cancelarEdicao} title="Retorna para a lista de cotacoes sem salvar alteracoes pendentes.">Voltar</button>
              <button onClick={confirmarEdicao} title="Salva as alteracoes da cotacao e atualiza o status do item.">Confirmar</button>
            </div>
          </section>
        </div>
      )}

      {propostaEmGeracao && (
        <div className="modal-backdrop">
          <section className="modal-panel proposal-modal">
            <div className="modal-title-row">
              <div>
                <h3>Gerar proposta interna</h3>
                <p>
                  Oportunidade {propostaEmGeracao.cotacao.opportunityNumber} / Item{" "}
                  {propostaEmGeracao.cotacao.itemNumber}
                </p>
              </div>
              <button onClick={() => setPropostaEmGeracao(null)} title="Fecha a janela de geracao de proposta.">Voltar</button>
            </div>

            <div className="proposal-summary-grid">
              <p>
                <strong>Fornecedor:</strong> {propostaEmGeracao.cotacao.supplierName}
              </p>
              <p>
                <strong>Custo unitario:</strong>{" "}
                {formatMoney(parseMoney(propostaEmGeracao.cotacao.unitPrice))}
              </p>
              <p>
                <strong>Quantidade:</strong> {propostaEmGeracao.item?.quantity || "1"}
              </p>
              <label>
                Margem (%)
                <input
                  value={propostaEmGeracao.margem}
                  onChange={(event) => atualizarMargemProposta(event.target.value)}
                />
              </label>
            </div>

            <div className="proposal-calculation">
              <p>
                <strong>Venda unitario:</strong>{" "}
                {formatMoney(
                  parseMoney(propostaEmGeracao.cotacao.unitPrice) *
                    (1 + parseNumber(propostaEmGeracao.margem) / 100)
                )}
              </p>
              <p>
                <strong>Total:</strong>{" "}
                {formatMoney(
                  parseMoney(propostaEmGeracao.cotacao.unitPrice) *
                    (1 + parseNumber(propostaEmGeracao.margem) / 100) *
                    (parseNumber(propostaEmGeracao.item?.quantity || "1") || 1)
                )}
              </p>
            </div>

            {propostaEmGeracao.mensagem && <p className="import-message">{propostaEmGeracao.mensagem}</p>}

            <div className="modal-actions">
              <button onClick={() => setPropostaEmGeracao(null)} title="Cancela a geracao da proposta.">Cancelar</button>
              <button onClick={() => setPropostaEmGeracao(null)} title="Retorna para a lista de cotacoes sem gerar proposta.">Voltar</button>
              <button onClick={confirmarGeracaoProposta} title="Cria a proposta interna com margem e valores calculados.">Confirmar e gerar proposta</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default CotacaoGeradas;
