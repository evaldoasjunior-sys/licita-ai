import { useEffect, useState } from "react";
import {
  buildOpportunitiesFromWordRows,
  readWordOpportunityRows,
} from "../domain/wordOpportunityImport";
import { backendApi } from "../services/backendApi";
import { loadOpportunitiesWithFallback } from "../services/opportunitySync";
import {
  createId,
  normalizeText,
  opportunityService,
  quotationService,
  supplierService,
} from "../services/dataServices";

function listarLinhasDasOportunidades(oportunidades) {
  return oportunidades.flatMap((op) =>
    op.items
      .filter((item) => !item.archivedAt)
      .map((item) => ({
        opportunityId: op.id,
        opportunityNumber: op.number,
        opportunityDueDate: op.dueDate,
        item,
        number: op.number,
        itemNumber: item.itemNumber,
        quantity: item.quantity,
        description: item.rawDescription || item.description,
        deliveryLocation: item.deliveryLocation,
        attachmentRequired: item.attachmentRequired,
        dueDate: op.dueDate,
        status: item.quotationStatus || op.status,
        category: item.category,
        manufacturers: item.manufacturers.map((manufacturer) => manufacturer.name).join(", "),
      }))
  );
}

function fornecedorAtendeItem(fornecedor, item) {
  const fabricantes = item.manufacturers.map((manufacturer) => normalizeText(manufacturer.name));
  const categoria = normalizeText(item.category);

  return fornecedor.specialties.some(
    (specialty) =>
      fabricantes.includes(normalizeText(specialty.manufacturer)) &&
      normalizeText(specialty.category) === categoria
  );
}

function criteriosDoItem(item) {
  return {
    fabricantes: item.manufacturers.map((manufacturer) => manufacturer.name),
    categoria: item.category || "Nao identificada",
  };
}

function formatarFabricantesReferencias(item) {
  if (item.manufacturerReferences?.length > 0) {
    return item.manufacturerReferences
      .map((reference) =>
        `${reference.manufacturer}: ${
          reference.codes.length > 0 ? reference.codes.join(", ") : "referencia nao identificada"
        }`
      )
      .join(" | ");
  }

  return item.manufacturers.map((manufacturer) => manufacturer.name).join(", ") || "Nao informado";
}

function formatarEspecificacoesItem(item) {
  if (item.standardizedSpecifications?.length > 0) {
    return item.standardizedSpecifications.join(" | ");
  }

  return item.description || "Nao informado";
}

function montarTextoCotacao(item, opportunity, fornecedor, descricaoEditada = "") {
  const descricaoOriginal = item.rawDescription || item.description;
  const descricaoParaCotacao = descricaoEditada || descricaoOriginal;

  return `Assunto: Solicitacao de Cotacao - Oportunidade ${opportunity.number} / Item ${item.itemNumber}

Prezados,

Solicitamos cotacao para o material abaixo:

Oportunidade: ${opportunity.number}
Vencimento: ${opportunity.dueDate || "Nao informado"}
Item: ${item.itemNumber}
Quantidade: ${item.quantity} ${item.unit || ""}
Local de entrega: ${item.deliveryLocation || "Nao informado"}
Categoria: ${item.category || "Nao identificada"}
Fabricante / referencia: ${formatarFabricantesReferencias(item)}
Especificacoes: ${formatarEspecificacoesItem(item)}

Descricao original:
${descricaoParaCotacao}

Fornecedor: ${fornecedor.name}
Email: ${fornecedor.email || "Nao informado"}

Favor informar:
- Preco unitario
- Prazo de entrega
- Condicoes de pagamento
- Validade da proposta
- Frete, se aplicavel

Atenciosamente,`;
}

function Oportunidades({ backendStatus, syncRevision }) {
  const [importandoWord, setImportandoWord] = useState(false);
  const [linhasImportadas, setLinhasImportadas] = useState([]);
  const [mensagemImportacao, setMensagemImportacao] = useState("");
  const [origemDados, setOrigemDados] = useState("local");
  const [mensagemIntegracao, setMensagemIntegracao] = useState("");
  const [modalFornecedores, setModalFornecedores] = useState({
    aberto: false,
    item: null,
    opportunity: null,
    fornecedores: [],
    fornecedorSelecionadoId: "",
    etapa: "selecao",
    totalFornecedores: 0,
    fornecedorPendente: null,
    descricaoEditada: "",
    descricaoOriginal: "",
    textoCotacao: "",
    mensagem: "",
    novoFornecedor: { email: "", name: "", phone: "", taxId: "" },
  });

  const [oportunidades, setOportunidades] = useState(() => opportunityService.listActive());

  function persistir(lista) {
    setOportunidades(lista.filter((op) => !op.archivedAt));
    opportunityService.saveAll(lista);

    if (origemDados === "sqlite") {
      backendApi
        .saveOpportunities(lista)
        .then((resultado) => {
          opportunityService.saveAll(resultado.data);
          setOportunidades(resultado.data.filter((op) => !op.archivedAt));
          setMensagemIntegracao("Oportunidades salvas no banco SQLite.");
        })
        .catch(() => {
          setOrigemDados("local");
          setMensagemIntegracao("Nao foi possivel salvar no SQLite. Alteracao mantida localmente.");
        });
    }
  }

  useEffect(() => {
    let ativo = true;

    async function carregarOportunidadesDoBackend() {
      const resultado = await loadOpportunitiesWithFallback({
        api: backendApi,
        localStore: opportunityService,
      });
      if (!ativo) return;

      setOrigemDados(resultado.source);
      setMensagemIntegracao(resultado.message);
      setOportunidades(resultado.opportunities.filter((op) => !op.archivedAt));
    }

    carregarOportunidadesDoBackend();

    return () => {
      ativo = false;
    };
  }, [backendStatus, syncRevision]);

  function todasOportunidades() {
    return opportunityService.listAll();
  }

  function declinarItem(row) {
    const confirmar = window.confirm(
      `Declinar o item ${row.itemNumber} da oportunidade ${row.number}? Ele sera removido da tabela.`
    );
    if (!confirmar) return;

    const agora = new Date().toISOString();
    const atualizadas = todasOportunidades().map((op) => {
      if (op.id !== row.opportunityId) return op;

      return {
        ...op,
        updatedAt: agora,
        items: op.items.map((item) =>
          item.id === row.item.id
            ? { ...item, quotationStatus: "Declinado", archivedAt: agora, updatedAt: agora }
            : item
        ),
      };
    });

    persistir(atualizadas);
  }

  async function importarWord(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportandoWord(true);
    setMensagemImportacao("");

    try {
      const rows = await readWordOpportunityRows(file);
      const atuais = todasOportunidades();
      const ativas = atuais.filter((op) => !op.archivedAt);
      const { opportunities: novasOportunidades } = buildOpportunitiesFromWordRows(rows, file.name, []);

      if (novasOportunidades.length === 0) {
        setLinhasImportadas(rows);
        setMensagemImportacao(
          `${rows.length} linha(s) lida(s). Nenhuma oportunidade valida foi importada. As oportunidades atuais continuam na tela principal.`
        );
        return;
      }

      if (ativas.length > 0) {
        const confirmarNovaImportacao = window.confirm(
          "Deseja iniciar uma nova importacao? As oportunidades atuais serao movidas para o historico de importacoes."
        );

        if (!confirmarNovaImportacao) {
          setMensagemImportacao("Importacao cancelada. As oportunidades atuais continuam na tela principal.");
          return;
        }
      }

      const agora = new Date().toISOString();
      const importBatchId = createId("import");
      const oportunidadesArquivadas = atuais.map((op) =>
        op.archivedAt
          ? op
          : {
              ...op,
              archivedAt: agora,
              updatedAt: agora,
              archiveReason: "Substituida por nova importacao",
            }
      );
      const novasComLote = novasOportunidades.map((op) => ({
        ...op,
        importBatchId,
        importFileName: file.name,
        importedAt: agora,
        rawSnapshot: { ...(op.rawSnapshot || {}), fileName: file.name, importBatchId, importedAt: agora },
      }));

      if (novasComLote.length > 0) {
        persistir([...oportunidadesArquivadas, ...novasComLote]);
      }

      setLinhasImportadas(rows);
      setMensagemImportacao(
        `${rows.length} linha(s) lida(s). ${novasComLote.length} oportunidade(s) importada(s). ${
          ativas.length
        } oportunidade(s) anterior(es) movida(s) para o historico.`
      );
    } catch (error) {
      setMensagemImportacao(error.message || "Nao foi possivel importar o arquivo Word.");
    } finally {
      setImportandoWord(false);
      event.target.value = "";
    }
  }

  function abrirBuscaFornecedor(row) {
    const fornecedores = supplierService.listActive();
    const encontrados = fornecedores.filter((fornecedor) => fornecedorAtendeItem(fornecedor, row.item));
    const opportunity = {
      id: row.opportunityId,
      number: row.opportunityNumber,
      dueDate: row.opportunityDueDate,
    };

    setModalFornecedores({
      aberto: true,
      item: row.item,
      opportunity,
      fornecedores: encontrados,
      fornecedorSelecionadoId: encontrados[0]?.id || "",
      etapa: "selecao",
      totalFornecedores: fornecedores.length,
      fornecedorPendente: null,
      descricaoEditada: row.item.rawDescription || row.item.description || "",
      descricaoOriginal: row.item.rawDescription || row.item.description || "",
      textoCotacao: "",
      mensagem: "",
      novoFornecedor: { email: "", name: "", phone: "", taxId: "" },
    });
  }

  function fecharBuscaFornecedor() {
    setModalFornecedores((atual) => ({
      ...atual,
      aberto: false,
      etapa: "selecao",
      fornecedorPendente: null,
      descricaoEditada: "",
      descricaoOriginal: "",
      mensagem: "",
      textoCotacao: "",
    }));
  }

  function atualizarNovoFornecedor(campo, valor) {
    setModalFornecedores((atual) => ({
      ...atual,
      novoFornecedor: { ...atual.novoFornecedor, [campo]: valor },
    }));
  }

  function montarNovoFornecedorParaItem() {
    if (!modalFornecedores.item || !modalFornecedores.novoFornecedor.name.trim()) return null;

    const agora = new Date().toISOString();
    const criterios = criteriosDoItem(modalFornecedores.item);
    const specialties = criterios.fabricantes.map((fabricante) => ({
      id: createId("specialty"),
      manufacturer: fabricante,
      category: criterios.categoria,
      notes: "Criado a partir da tabela de oportunidades.",
    }));
    const fornecedor = {
      id: createId("supplier"),
      name: modalFornecedores.novoFornecedor.name.trim(),
      legalName: "",
      taxId: modalFornecedores.novoFornecedor.taxId.trim(),
      email: modalFornecedores.novoFornecedor.email.trim(),
      phone: modalFornecedores.novoFornecedor.phone.trim(),
      status: "Ativo",
      notes: "",
      specialties,
      createdAt: agora,
      updatedAt: agora,
      archivedAt: null,
    };

    return fornecedor;
  }

  async function salvarFornecedorSeNovo(fornecedor) {
    if (!fornecedor?.isNew) return fornecedor;

    const fornecedorParaSalvar = { ...fornecedor };
    delete fornecedorParaSalvar.isNew;
    supplierService.saveAll([...supplierService.listAll(), fornecedorParaSalvar]);

    try {
      await backendApi.saveSupplier(fornecedorParaSalvar, { isNew: true });
    } catch {
      // A base local continua sendo a garantia operacional quando o backend nao esta ligado.
    }

    return fornecedorParaSalvar;
  }

  function atualizarTextoCotacao(textoCotacao) {
    setModalFornecedores((atual) => ({ ...atual, textoCotacao }));
  }

  function atualizarDescricaoCotacao(descricaoEditada) {
    setModalFornecedores((atual) => {
      const textoCotacao =
        atual.item && atual.opportunity && atual.fornecedorPendente
          ? montarTextoCotacao(atual.item, atual.opportunity, atual.fornecedorPendente, descricaoEditada)
          : atual.textoCotacao;

      return { ...atual, descricaoEditada, textoCotacao };
    });
  }

  async function confirmarGeracaoCotacao(fornecedorPendente = modalFornecedores.fornecedorPendente) {
    const fornecedor = await salvarFornecedorSeNovo(fornecedorPendente);
    if (!modalFornecedores.item || !modalFornecedores.opportunity || !fornecedor) return;

    const descricaoFoiAlterada =
      normalizeText(modalFornecedores.descricaoEditada) !== normalizeText(modalFornecedores.descricaoOriginal);

    if (descricaoFoiAlterada) {
      const confirmar = window.confirm("A descricao do item foi alterada. Deseja confirmar a alteracao e gerar a cotacao?");
      if (!confirmar) return;
    }

    const textoCotacao =
      modalFornecedores.textoCotacao ||
      montarTextoCotacao(
        modalFornecedores.item,
        modalFornecedores.opportunity,
        fornecedor,
        modalFornecedores.descricaoEditada
      );
    const agora = new Date().toISOString();
    const novaCotacao = {
      id: createId("quotation"),
      opportunityId: modalFornecedores.opportunity.id,
      opportunityNumber: modalFornecedores.opportunity.number,
      itemId: modalFornecedores.item.id,
      itemNumber: modalFornecedores.item.itemNumber,
      supplierId: fornecedor.id,
      supplierName: fornecedor.name,
      email: fornecedor.email,
      description: textoCotacao,
      itemDescription: modalFornecedores.descricaoEditada,
      status: "Cotacao gerada",
      requestedAt: new Date().toLocaleDateString("pt-BR"),
      emailSentAt: "",
      respondedAt: "",
      unitPrice: "",
      deliveryDays: "",
      validityDays: "",
      paymentTerms: "",
      freight: "",
      notes: "",
      createdAt: agora,
      updatedAt: agora,
      archivedAt: null,
    };
    const atualizadas = todasOportunidades().map((op) => {
      if (op.id !== modalFornecedores.opportunity.id) return op;

      return {
        ...op,
        updatedAt: agora,
        items: op.items.map((item) =>
          item.id === modalFornecedores.item.id
            ? { ...item, quotationStatus: "Cotacao gerada", updatedAt: agora }
            : item
        ),
      };
    });

    quotationService.saveAll([...quotationService.listAll(), novaCotacao]);

    try {
      await backendApi.saveQuotation(novaCotacao, { isNew: true });
    } catch {
      // Se a API estiver offline, a cotacao permanece salva localmente e pode ser enviada ao SQLite pela tela Dados.
    }

    persistir(atualizadas);
    setModalFornecedores((atual) => ({
      ...atual,
      etapa: "gerada",
      fornecedorPendente: fornecedor,
      item: { ...atual.item, quotationStatus: "Cotacao gerada" },
      mensagem: "Cotacao gerada e status do item atualizado.",
      textoCotacao,
    }));
  }

  function gerarCotacaoDoSelecionado() {
    const fornecedor =
      modalFornecedores.fornecedores.find(
        (item) => item.id === modalFornecedores.fornecedorSelecionadoId
      ) || modalFornecedores.fornecedores[0];
    const textoCotacao =
      modalFornecedores.item && modalFornecedores.opportunity && fornecedor
        ? montarTextoCotacao(
            modalFornecedores.item,
            modalFornecedores.opportunity,
            fornecedor,
            modalFornecedores.descricaoEditada
          )
        : "";

    setModalFornecedores((atual) => ({
      ...atual,
      etapa: "confirmacao",
      fornecedorPendente: fornecedor,
      mensagem: "",
      textoCotacao,
    }));
  }

  function prepararNovoFornecedorEConfirmar() {
    const fornecedor = montarNovoFornecedorParaItem();
    if (!fornecedor) return;
    const fornecedorPendente = { ...fornecedor, isNew: true };
    const textoCotacao =
      modalFornecedores.item && modalFornecedores.opportunity
        ? montarTextoCotacao(
            modalFornecedores.item,
            modalFornecedores.opportunity,
            fornecedorPendente,
            modalFornecedores.descricaoEditada
          )
        : "";

    setModalFornecedores((atual) => ({
      ...atual,
      etapa: "confirmacao",
      fornecedorPendente,
      mensagem: "",
      textoCotacao,
    }));
  }

  function voltarParaSelecaoCotacao() {
    setModalFornecedores((atual) => ({
      ...atual,
      etapa: "selecao",
      fornecedorPendente: null,
      mensagem: "",
      textoCotacao: "",
    }));
  }

  const linhasDaTabela = listarLinhasDasOportunidades(oportunidades);

  return (
    <div>
      <h2>Oportunidades retiradas da Petronect</h2>

      <p>
        Cadastre aqui as mesmas informacoes que hoje sao copiadas do PDF da Petronect para o Word:
        numero, item, quantidade, descricao, local de entrega e vencimento.
      </p>
      <p className="import-message">
        Base em uso: {origemDados === "sqlite" ? "Banco SQLite" : "Navegador local"}. {mensagemIntegracao}
      </p>

      <section className="import-panel">
        <h3>Importar arquivo Word</h3>
        <p>
          Selecione o arquivo usado hoje para copiar as oportunidades. Ao importar um novo arquivo, as oportunidades
          atuais sao movidas para o historico e a tela principal fica apenas com a ultima importacao.
        </p>

        <input accept=".docx" disabled={importandoWord} onChange={importarWord} type="file" />

        {mensagemImportacao && <p className="import-message">{mensagemImportacao}</p>}

        {linhasImportadas.length > 0 && (
          <details>
            <summary>Ver linhas lidas do Word</summary>
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
                  </tr>
                </thead>
                <tbody>
                  {linhasImportadas.map((row, index) => (
                    <tr key={`${row.number}-${row.item}-${index}`}>
                      <td>{row.number}</td>
                      <td>{row.item || "1"}</td>
                      <td>{row.quantity}</td>
                      <td>{row.description}</td>
                      <td>{row.delivery}</td>
                      <td>{row.attachment}</td>
                      <td>{row.dueDate}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </section>

      <h3>Tabela de oportunidades</h3>

      {linhasDaTabela.length === 0 ? (
        <p>Nenhuma oportunidade cadastrada.</p>
      ) : (
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
                <th>ACAO</th>
              </tr>
            </thead>
            <tbody>
              {linhasDaTabela.map((row, index) => (
                <tr key={`${row.opportunityId}-${row.itemNumber}-${index}`}>
                  <td>{row.number}</td>
                  <td>{row.itemNumber}</td>
                  <td>{row.quantity}</td>
                  <td>{row.description}</td>
                  <td>{row.deliveryLocation || "Nao informado"}</td>
                  <td>{row.attachmentRequired || ""}</td>
                  <td>{row.dueDate || "Nao informado"}</td>
                  <td>{row.status}</td>
                  <td>{row.category || "Nao identificada"}</td>
                  <td>{row.manufacturers || "Nao identificado"}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => abrirBuscaFornecedor(row)} title="Busca fornecedores compativeis e abre o fluxo para gerar cotacao deste item.">Gerar cotacao</button>
                      <button className="decline-button" onClick={() => declinarItem(row)} title="Remove este item da tabela ativa e marca como declinado.">
                        Declinar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <hr />

      {modalFornecedores.aberto && (
        <div className="modal-backdrop">
          <div className="modal-panel">
            <h3>Buscar fornecedor e gerar cotacao</h3>

            <div className="modal-summary">
              <p>
                <strong>Oportunidade:</strong> {modalFornecedores.opportunity?.number}
              </p>
              <p>
                <strong>Item:</strong> {modalFornecedores.item?.itemNumber}
              </p>
              <p>
                <strong>Fabricantes buscados:</strong>{" "}
                {modalFornecedores.item ? criteriosDoItem(modalFornecedores.item).fabricantes.join(", ") : ""}
              </p>
              <p>
                <strong>Categoria buscada:</strong>{" "}
                {modalFornecedores.item ? criteriosDoItem(modalFornecedores.item).categoria : ""}
              </p>
            </div>

            {modalFornecedores.etapa === "selecao" && (
              <>
                {modalFornecedores.fornecedores.length === 0 ? (
                  <div className="empty-search">
                    <p>Nenhum fornecedor compativel encontrado para este fabricante e categoria.</p>
                    {modalFornecedores.totalFornecedores > 0 && (
                      <p>
                        Existem {modalFornecedores.totalFornecedores} fornecedor(es) cadastrado(s), mas nenhum atende
                        essa combinacao.
                      </p>
                    )}

                    <h4>Cadastrar fornecedor para este item</h4>
                    <p>Nome do fornecedor:</p>
                    <input
                      value={modalFornecedores.novoFornecedor.name}
                      onChange={(event) => atualizarNovoFornecedor("name", event.target.value)}
                    />
                    <p>Email:</p>
                    <input
                      value={modalFornecedores.novoFornecedor.email}
                      onChange={(event) => atualizarNovoFornecedor("email", event.target.value)}
                    />
                    <p>Telefone:</p>
                    <input
                      value={modalFornecedores.novoFornecedor.phone}
                      onChange={(event) => atualizarNovoFornecedor("phone", event.target.value)}
                    />
                    <p>CNPJ:</p>
                    <input
                      value={modalFornecedores.novoFornecedor.taxId}
                      onChange={(event) => atualizarNovoFornecedor("taxId", event.target.value)}
                    />
                  </div>
                ) : (
                  <div>
                    <p>
                      <strong>Selecione o fornecedor:</strong>
                    </p>
                    {modalFornecedores.fornecedores.map((fornecedor) => (
                      <label className="supplier-option" key={fornecedor.id}>
                        <input
                          checked={modalFornecedores.fornecedorSelecionadoId === fornecedor.id}
                          name="fornecedorCotacao"
                          onChange={() =>
                            setModalFornecedores((atual) => ({
                              ...atual,
                              fornecedorSelecionadoId: fornecedor.id,
                              mensagem: "",
                              textoCotacao: "",
                            }))
                          }
                          type="radio"
                        />{" "}
                        <strong>{fornecedor.name}</strong>
                        <br />
                        Email: {fornecedor.email || "Nao informado"}
                        <br />
                        Telefone: {fornecedor.phone || "Nao informado"}
                      </label>
                    ))}
                  </div>
                )}
              </>
            )}

            {modalFornecedores.etapa === "confirmacao" && (
              <div className="confirmation-panel">
                <h4>Confirmar geracao da cotacao</h4>
                <p>
                  <strong>Fornecedor:</strong> {modalFornecedores.fornecedorPendente?.name}
                </p>
                <p>
                  <strong>Email:</strong> {modalFornecedores.fornecedorPendente?.email || "Nao informado"}
                </p>
                <p>
                  <strong>Oportunidade:</strong> {modalFornecedores.opportunity?.number}
                </p>
                <p>
                  <strong>Item:</strong> {modalFornecedores.item?.itemNumber}
                </p>
                <p>A cotacao ainda nao foi criada. Revise a descricao do item antes de confirmar.</p>
                <p>
                  <strong>Descricao do item:</strong>
                </p>
                <textarea
                  rows="7"
                  value={modalFornecedores.descricaoEditada}
                  onChange={(event) => atualizarDescricaoCotacao(event.target.value)}
                />
                <p>
                  <strong>Texto da cotacao:</strong>
                </p>
                <textarea
                  rows="14"
                  value={modalFornecedores.textoCotacao}
                  onChange={(event) => atualizarTextoCotacao(event.target.value)}
                />
              </div>
            )}

            {modalFornecedores.mensagem && <p className="success-message">{modalFornecedores.mensagem}</p>}

            {modalFornecedores.etapa === "gerada" && modalFornecedores.textoCotacao && (
              <div>
                <h4>Cotacao gerada</h4>
                <textarea
                  rows="14"
                  value={modalFornecedores.textoCotacao}
                  onChange={(event) => atualizarTextoCotacao(event.target.value)}
                />
              </div>
            )}

            <div className="modal-actions">
              <button onClick={fecharBuscaFornecedor} title="Fecha a janela sem gerar cotacao.">Cancelar</button>
              {modalFornecedores.etapa === "selecao" && (
                <>
                  {modalFornecedores.fornecedores.length === 0 ? (
                    <button
                      disabled={!modalFornecedores.novoFornecedor.name.trim()}
                      onClick={prepararNovoFornecedorEConfirmar}
                      title="Avanca para revisar a cotacao usando o novo fornecedor informado."
                    >
                      Continuar
                    </button>
                  ) : (
                    <button
                      disabled={modalFornecedores.fornecedores.length === 0}
                      onClick={gerarCotacaoDoSelecionado}
                      title="Avanca para revisar a cotacao com o fornecedor selecionado."
                    >
                      Continuar
                    </button>
                  )}
                </>
              )}
              {modalFornecedores.etapa === "confirmacao" && (
                <>
                  <button onClick={voltarParaSelecaoCotacao} title="Volta para a selecao de fornecedor sem criar cotacao.">Voltar</button>
                  <button onClick={() => confirmarGeracaoCotacao()} title="Cria a cotacao, salva o texto e atualiza o status do item.">Confirmar e gerar cotacao</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

export default Oportunidades;
