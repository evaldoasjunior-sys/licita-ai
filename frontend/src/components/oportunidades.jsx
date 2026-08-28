import { useCallback, useEffect, useMemo, useState } from "react";
import { buildOpportunitiesFromWordRows, readWordOpportunityRows } from "../domain/wordOpportunityImport";
import { backendApi } from "../services/backendApi";
import {
  createOpportunityDraftStore,
  createWordImportState,
  confirmImportItemUnit,
  executeOpportunityDraft,
  filterOpportunities,
  friendlyOpportunityError,
  importItemsWithoutUnit,
  itemPayload,
  opportunityPayload,
  updateImportItemUnit,
  validateItemForm,
  validateOpportunityForm,
} from "../services/opportunityManagement";
import { loadOpportunitiesWithFallback } from "../services/opportunitySync";
import { opportunityService } from "../services/dataServices";
import { OPPORTUNITY_STATUSES } from "../storage/database";

const EMPTY_OPPORTUNITY = { number: "", title: "", dueDate: "", status: OPPORTUNITY_STATUSES[0], version: 1 };
const EMPTY_ITEM = {
  itemNumber: "",
  description: "",
  quantity: "",
  unit: "",
  reference: "",
  manufacturer: "",
  deliveryLocation: "",
  deliveryDeadline: "",
  technicalNotes: "",
  version: 1,
};

function FieldError({ message }) {
  return message ? <span className="field-error">{message}</span> : null;
}

function draftLabel(draft) {
  const labels = {
    "opportunity-create": "Nova oportunidade",
    "opportunity-update": "Edicao de oportunidade",
    "opportunity-archive": "Arquivamento de oportunidade",
    "opportunity-restore": "Restauracao de oportunidade",
    "item-create": "Novo item",
    "item-update": "Edicao de item",
    "item-archive": "Arquivamento de item",
    "item-restore": "Restauracao de item",
    "word-import": "Importacao Word",
    "legacy-import": "Dados locais anteriores",
  };
  return labels[draft.type] || "Operacao pendente";
}

function Oportunidades({ backendStatus, syncRevision }) {
  const [draftStore] = useState(() => createOpportunityDraftStore(window.localStorage));
  const [opportunities, setOpportunities] = useState(() => opportunityService.listAll());
  const [drafts, setDrafts] = useState(() => draftStore.list());
  const [source, setSource] = useState("local");
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("status");
  const [busy, setBusy] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [filters, setFilters] = useState({ search: "", status: "all", deadline: "all" });
  const [expandedId, setExpandedId] = useState(null);
  const [opportunityForm, setOpportunityForm] = useState(null);
  const [opportunityErrors, setOpportunityErrors] = useState({});
  const [itemForm, setItemForm] = useState(null);
  const [itemErrors, setItemErrors] = useState({});
  const [importing, setImporting] = useState(false);
  const [importRows, setImportRows] = useState([]);

  const refreshDrafts = useCallback(() => setDrafts(draftStore.list()), [draftStore]);

  const load = useCallback(async () => {
    const result = await loadOpportunitiesWithFallback({
      api: backendApi,
      localStore: opportunityService,
      draftStore,
    });
    setOpportunities(result.opportunities);
    setSource(result.source);
    setMessage(result.message);
    setMessageKind(result.source === "sqlite" ? "status" : "warning");
    refreshDrafts();
    return result;
  }, [draftStore, refreshDrafts]);

  useEffect(() => {
    const timer = window.setTimeout(() => load(), 0);
    return () => window.clearTimeout(timer);
  }, [backendStatus, load, syncRevision]);

  const visibleOpportunities = useMemo(
    () => filterOpportunities(opportunities, { ...filters, archived: showArchived }),
    [filters, opportunities, showArchived]
  );

  function preserveDraft(draft, error) {
    const saved = draftStore.save({
      ...draft,
      payload: error?.importState || draft.payload,
      errorCode: error?.code || "offline",
      errorStatus: error?.status || null,
      lastError: friendlyOpportunityError(error),
    });
    refreshDrafts();
    return saved;
  }

  function applyConfirmedResult(draft, data) {
    if (!data) return;
    const current = opportunityService.listAll();
    if (draft.type === "word-import" || draft.type === "legacy-import") {
      const imported = (data.opportunities || [])
        .filter((entry) => entry.completed && entry.remoteOpportunity)
        .map((entry) => ({ ...entry.remoteOpportunity, items: entry.createdItems || [] }));
      const importedIds = new Set(imported.map((opportunity) => opportunity.id));
      const next = [...current.filter((opportunity) => !importedIds.has(opportunity.id)), ...imported];
      opportunityService.saveAll(next);
      setOpportunities(next);
      return;
    }
    if (draft.type.startsWith("opportunity-")) {
      const existing = current.find((opportunity) => opportunity.id === data.id);
      const next = existing
        ? current.map((opportunity) => opportunity.id === data.id ? { ...existing, ...data } : opportunity)
        : [...current, data];
      opportunityService.saveAll(next);
      setOpportunities(next);
      return;
    }
    if (draft.type.startsWith("item-")) {
      const next = current.map((opportunity) => {
        if (opportunity.id !== draft.opportunityId) return opportunity;
        const exists = (opportunity.items || []).some((item) => item.id === data.id);
        return {
          ...opportunity,
          items: exists
            ? opportunity.items.map((item) => item.id === data.id ? { ...item, ...data } : item)
            : [...(opportunity.items || []), data],
        };
      });
      opportunityService.saveAll(next);
      setOpportunities(next);
    }
  }

  async function runOperation(draft, successMessage) {
    setBusy(true);
    let result;
    try {
      result = await executeOpportunityDraft(backendApi, draft);
    } catch (error) {
      preserveDraft(draft, error);
      setMessage(friendlyOpportunityError(error));
      setMessageKind(error?.status === 409 ? "conflict" : "warning");
      setBusy(false);
      return false;
    }

    try {
      if (draft.id) draftStore.remove(draft.id);
      applyConfirmedResult(draft, result?.data);
      await load();
      setMessage(successMessage);
      setMessageKind("success");
      refreshDrafts();
      return true;
    } finally {
      setBusy(false);
    }
  }

  function openNewOpportunity() {
    setOpportunityErrors({});
    setOpportunityForm({ mode: "create", values: { ...EMPTY_OPPORTUNITY } });
  }

  function openEditOpportunity(opportunity) {
    setOpportunityErrors({});
    setOpportunityForm({
      mode: "edit",
      opportunityId: opportunity.id,
      values: {
        number: opportunity.number || "",
        title: opportunity.title || "",
        dueDate: opportunity.dueDate || "",
        status: opportunity.status || OPPORTUNITY_STATUSES[0],
        version: opportunity.version,
      },
    });
  }

  async function submitOpportunity(event) {
    event.preventDefault();
    const errors = validateOpportunityForm(opportunityForm.values);
    setOpportunityErrors(errors);
    if (Object.keys(errors).length) return;
    const editing = opportunityForm.mode === "edit";
    const completed = await runOperation(
      {
        type: editing ? "opportunity-update" : "opportunity-create",
        opportunityId: opportunityForm.opportunityId,
        payload: opportunityPayload(opportunityForm.values, { editing }),
      },
      editing ? "Oportunidade atualizada no SQLite." : "Oportunidade cadastrada no SQLite."
    );
    if (completed) setOpportunityForm(null);
  }

  async function toggleOpportunityArchive(opportunity) {
    const action = opportunity.archivedAt ? "restaurar" : "arquivar";
    if (!window.confirm(`Deseja ${action} a oportunidade ${opportunity.number}?`)) return;
    await runOperation(
      {
        type: opportunity.archivedAt ? "opportunity-restore" : "opportunity-archive",
        opportunityId: opportunity.id,
        payload: { version: opportunity.version },
      },
      `Oportunidade ${opportunity.archivedAt ? "restaurada" : "arquivada"} no SQLite.`
    );
  }

  function openNewItem(opportunity) {
    setItemErrors({});
    setItemForm({ mode: "create", opportunityId: opportunity.id, values: { ...EMPTY_ITEM } });
  }

  function openEditItem(opportunity, item) {
    setItemErrors({});
    setItemForm({
      mode: "edit",
      opportunityId: opportunity.id,
      itemId: item.id,
      values: {
        itemNumber: item.itemNumber || "",
        description: item.description || item.rawDescription || "",
        quantity: item.quantity || "",
        unit: item.unit || "",
        reference: item.reference || "",
        manufacturer: item.manufacturer || item.manufacturers?.map((entry) => entry.name).join(", ") || "",
        deliveryLocation: item.deliveryLocation || "",
        deliveryDeadline: item.deliveryDeadline || "",
        technicalNotes: item.technicalNotes || "",
        version: item.version,
      },
    });
  }

  async function submitItem(event) {
    event.preventDefault();
    const errors = validateItemForm(itemForm.values);
    setItemErrors(errors);
    if (Object.keys(errors).length) return;
    const editing = itemForm.mode === "edit";
    const completed = await runOperation(
      {
        type: editing ? "item-update" : "item-create",
        opportunityId: itemForm.opportunityId,
        itemId: itemForm.itemId,
        payload: itemPayload(itemForm.values, { editing }),
      },
      editing ? "Item atualizado no SQLite." : "Item cadastrado no SQLite."
    );
    if (completed) setItemForm(null);
  }

  async function toggleItemArchive(opportunity, item) {
    const action = item.archivedAt ? "restaurar" : "arquivar";
    if (!window.confirm(`Deseja ${action} o item ${item.itemNumber || item.id}?`)) return;
    await runOperation(
      {
        type: item.archivedAt ? "item-restore" : "item-archive",
        opportunityId: opportunity.id,
        itemId: item.id,
        payload: { version: item.version },
      },
      `Item ${item.archivedAt ? "restaurado" : "arquivado"} no SQLite.`
    );
  }

  async function importWord(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const rows = await readWordOpportunityRows(file);
      setImportRows(rows);
      const active = opportunities.filter((opportunity) => !opportunity.archivedAt);
      const result = buildOpportunitiesFromWordRows(rows, file.name, active);
      if (!result.opportunities.length) {
        setMessage(
          result.skippedNumbers.length
            ? "As oportunidades do arquivo ja existem na base ativa; nenhum registro foi alterado."
            : "Nenhuma oportunidade valida foi encontrada no arquivo."
        );
        setMessageKind("warning");
        return;
      }
      const completed = await runOperation(
        { type: "word-import", payload: createWordImportState(result.opportunities) },
        `${result.opportunities.length} oportunidade(s) importada(s) pela API granular.`
      );
      if (!completed) setMessageKind("warning");
    } catch (error) {
      setMessage(error.message || "Nao foi possivel ler o arquivo Word.");
      setMessageKind("warning");
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function retryDraft(draft) {
    const completed = await runOperation(draft, `${draftLabel(draft)} confirmado no SQLite.`);
    if (completed) {
      setOpportunityForm(null);
      setItemForm(null);
    }
  }

  function discardDraft(draft) {
    if (!window.confirm(`Descartar o rascunho "${draftLabel(draft)}"?`)) return;
    draftStore.remove(draft.id);
    refreshDrafts();
  }

  function changeDraftItemUnit(draft, opportunityIndex, itemIndex, unit) {
    const payload = updateImportItemUnit(draft.payload, opportunityIndex, itemIndex, unit);
    const pending = importItemsWithoutUnit(payload).length;
    draftStore.save({
      ...draft,
      payload,
      lastError: pending
        ? `Unidade não identificada em ${pending} item(ns).`
        : "Unidades informadas. Revise e tente novamente para gravar na API.",
    });
    refreshDrafts();
  }

  function confirmDraftItemUnit(draft, opportunityIndex, itemIndex) {
    const payload = confirmImportItemUnit(draft.payload, opportunityIndex, itemIndex);
    const pending = importItemsWithoutUnit(payload).length;
    draftStore.save({
      ...draft,
      payload,
      lastError: pending
        ? `Unidade não identificada em ${pending} item(ns).`
        : "Unidades confirmadas. Tente novamente para gravar na API.",
    });
    refreshDrafts();
  }

  return (
    <div className="opportunity-management">
      <div className="page-title-row">
        <div>
          <h2>Gestao de oportunidades e itens</h2>
          <p>O SQLite e a fonte oficial. Alteracoes so aparecem como salvas depois da confirmacao da API.</p>
        </div>
        <button disabled={busy} onClick={openNewOpportunity} type="button">Nova oportunidade</button>
      </div>

      <p className={`integration-message integration-message-${messageKind}`} role={messageKind === "warning" ? "alert" : "status"}>
        Fonte: {source === "sqlite" ? "SQLite" : "cache local de consulta"}. {message}
      </p>
      {messageKind === "conflict" && (
        <button disabled={busy} onClick={load} type="button">Recarregar dados atuais</button>
      )}

      {drafts.length > 0 && (
        <section className="draft-panel" aria-labelledby="draft-title">
          <h3 id="draft-title">Rascunhos e operacoes pendentes</h3>
          <p>Estes dados ainda nao foram confirmados pelo backend.</p>
          <ul>
            {drafts.map((draft) => (
              <li key={draft.id}>
                <span><strong>{draftLabel(draft)}</strong>{draft.lastError ? ` — ${draft.lastError}` : ""}</span>
                {importItemsWithoutUnit(draft.payload).map(({ opportunityIndex, itemIndex, item }) => (
                  <label className="unit-review-field" key={`${opportunityIndex}-${itemIndex}`}>
                    <strong className="unit-review-warning">Unidade não identificada</strong>
                    <span>{item.description}</span>
                    <input
                      aria-label={`Unidade não identificada: ${item.description}`}
                      maxLength="50"
                      onChange={(event) => changeDraftItemUnit(draft, opportunityIndex, itemIndex, event.target.value)}
                      placeholder="Informe a unidade de medida"
                      value={item.unit || ""}
                    />
                    <button
                      disabled={!item.unit?.trim()}
                      onClick={() => confirmDraftItemUnit(draft, opportunityIndex, itemIndex)}
                      type="button"
                    >
                      Confirmar unidade
                    </button>
                  </label>
                ))}
                <span className="table-actions">
                  <button disabled={busy || importItemsWithoutUnit(draft.payload).length > 0} onClick={() => retryDraft(draft)} type="button">Tentar novamente</button>
                  <button disabled={busy} onClick={() => discardDraft(draft)} type="button">Descartar</button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {opportunityForm && (
        <section className="management-form-panel" aria-labelledby="opportunity-form-title">
          <h3 id="opportunity-form-title">
            {opportunityForm.mode === "edit" ? "Editar oportunidade" : "Cadastrar oportunidade"}
          </h3>
          <form onSubmit={submitOpportunity}>
            <div className="management-form-grid">
              <label>Numero *
                <input maxLength="100" onChange={(event) => setOpportunityForm((current) => ({ ...current, values: { ...current.values, number: event.target.value } }))} value={opportunityForm.values.number} />
                <FieldError message={opportunityErrors.number} />
              </label>
              <label>Titulo
                <input maxLength="500" onChange={(event) => setOpportunityForm((current) => ({ ...current, values: { ...current.values, title: event.target.value } }))} value={opportunityForm.values.title} />
                <FieldError message={opportunityErrors.title} />
              </label>
              <label>Prazo de encerramento
                <input maxLength="50" onChange={(event) => setOpportunityForm((current) => ({ ...current, values: { ...current.values, dueDate: event.target.value } }))} placeholder="DD/MM/AAAA ou AAAA-MM-DD" value={opportunityForm.values.dueDate} />
                <FieldError message={opportunityErrors.dueDate} />
              </label>
              <label>Situacao
                <select onChange={(event) => setOpportunityForm((current) => ({ ...current, values: { ...current.values, status: event.target.value } }))} value={opportunityForm.values.status}>
                  {OPPORTUNITY_STATUSES.filter((status) => status !== "Arquivada").map((status) => <option key={status}>{status}</option>)}
                </select>
                <FieldError message={opportunityErrors.status} />
              </label>
            </div>
            <div className="panel-actions">
              <button disabled={busy} onClick={() => setOpportunityForm(null)} type="button">Cancelar</button>
              <button disabled={busy} type="submit">{busy ? "Aguardando backend..." : "Salvar no SQLite"}</button>
            </div>
          </form>
        </section>
      )}

      <section className="import-panel">
        <h3>Importar arquivo Word</h3>
        <p>A importacao cria cada oportunidade e item pela API granular, sem substituir ou arquivar os demais registros. Itens sem unidade identificada ficam como rascunho e so sao gravados depois da revisao.</p>
        <label>Arquivo Word (.docx)
          <input accept=".docx" disabled={busy || importing} onChange={importWord} type="file" />
        </label>
        {importRows.length > 0 && <p>{importRows.length} linha(s) lida(s) no ultimo arquivo.</p>}
      </section>

      <section className="management-filters" aria-label="Filtros de oportunidades">
        <label>Pesquisa
          <input onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))} placeholder="Numero, titulo, descricao, referencia ou fabricante" type="search" value={filters.search} />
        </label>
        <label>Situacao
          <select onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))} value={filters.status}>
            <option value="all">Todas</option>
            {OPPORTUNITY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
        </label>
        <label>Prazo de encerramento
          <select onChange={(event) => setFilters((current) => ({ ...current, deadline: event.target.value }))} value={filters.deadline}>
            <option value="all">Todos</option>
            <option value="overdue">Encerradas</option>
            <option value="7">Proximos 7 dias</option>
            <option value="30">Proximos 30 dias</option>
            <option value="no-date">Sem prazo</option>
          </select>
        </label>
        <label className="archive-toggle">
          <input checked={showArchived} onChange={(event) => setShowArchived(event.target.checked)} type="checkbox" />
          Mostrar arquivadas
        </label>
      </section>

      <p className="supplier-count">{visibleOpportunities.length} oportunidade(s) encontrada(s).</p>
      {visibleOpportunities.length === 0 ? <p>Nenhuma oportunidade encontrada.</p> : visibleOpportunities.map((opportunity) => (
        <article className="opportunity-card" key={opportunity.id}>
          <header>
            <div>
              <h3>{opportunity.number} {opportunity.title ? `— ${opportunity.title}` : ""}</h3>
              <p>{opportunity.status} · Encerramento: {opportunity.dueDate || "nao informado"} · Versao {opportunity.version}</p>
            </div>
            <div className="table-actions">
              {!opportunity.archivedAt && <button disabled={busy} onClick={() => openEditOpportunity(opportunity)} type="button">Editar</button>}
              <button disabled={busy} onClick={() => setExpandedId((current) => current === opportunity.id ? null : opportunity.id)} type="button">
                {expandedId === opportunity.id ? "Ocultar itens" : "Ver itens"}
              </button>
              <button className={opportunity.archivedAt ? "" : "decline-button"} disabled={busy} onClick={() => toggleOpportunityArchive(opportunity)} type="button">
                {opportunity.archivedAt ? "Restaurar" : "Arquivar"}
              </button>
            </div>
          </header>
          {expandedId === opportunity.id && (
            <section className="opportunity-items" aria-label={`Itens da oportunidade ${opportunity.number}`}>
              {!opportunity.archivedAt && <button disabled={busy} onClick={() => openNewItem(opportunity)} type="button">Novo item</button>}
              {(opportunity.items || []).length === 0 ? <p>Nenhum item cadastrado.</p> : (
                <div className="table-scroll">
                  <table className="opportunity-table management-items-table">
                    <thead><tr><th>Item</th><th>Descricao</th><th>Quantidade</th><th>Unidade</th><th>Referencia</th><th>Fabricante</th><th>Entrega</th><th>Acoes</th></tr></thead>
                    <tbody>{opportunity.items.map((item) => (
                      <tr className={item.archivedAt ? "archived-row" : ""} key={item.id}>
                        <td>{item.itemNumber || "—"}</td><td>{item.description || item.rawDescription}</td><td>{item.quantity}</td><td>{item.unit}</td><td>{item.reference || "—"}</td><td>{item.manufacturer || "—"}</td><td>{item.deliveryLocation || "—"}</td>
                        <td><div className="table-actions">
                          {!item.archivedAt && !opportunity.archivedAt && <button disabled={busy} onClick={() => openEditItem(opportunity, item)} type="button">Editar</button>}
                          {!opportunity.archivedAt && <button className={item.archivedAt ? "" : "decline-button"} disabled={busy} onClick={() => toggleItemArchive(opportunity, item)} type="button">{item.archivedAt ? "Restaurar" : "Arquivar"}</button>}
                        </div></td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </article>
      ))}

      {itemForm && (
        <div className="modal-backdrop" role="presentation">
          <section aria-labelledby="item-form-title" aria-modal="true" className="modal-panel" role="dialog">
            <div className="modal-title-row"><h3 id="item-form-title">{itemForm.mode === "edit" ? "Editar item" : "Cadastrar item"}</h3><button onClick={() => setItemForm(null)} type="button">Fechar</button></div>
            <form onSubmit={submitItem}>
              <div className="management-form-grid item-form-grid">
                <label>Numero do item<input maxLength="50" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, itemNumber: event.target.value } }))} value={itemForm.values.itemNumber} /></label>
                <label>Quantidade *<input maxLength="50" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, quantity: event.target.value } }))} value={itemForm.values.quantity} /><FieldError message={itemErrors.quantity} /></label>
                <label>Unidade de medida *<input maxLength="50" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, unit: event.target.value } }))} value={itemForm.values.unit} /><FieldError message={itemErrors.unit} /></label>
                <label>Referencia<input maxLength="500" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, reference: event.target.value } }))} value={itemForm.values.reference} /></label>
                <label>Fabricante<input maxLength="500" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, manufacturer: event.target.value } }))} value={itemForm.values.manufacturer} /></label>
                <label>Local de entrega<input maxLength="1000" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, deliveryLocation: event.target.value } }))} value={itemForm.values.deliveryLocation} /></label>
                <label>Prazo de entrega<input maxLength="500" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, deliveryDeadline: event.target.value } }))} value={itemForm.values.deliveryDeadline} /></label>
                <label className="full-width">Descricao completa *<textarea maxLength="10000" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, description: event.target.value } }))} rows="5" value={itemForm.values.description} /><FieldError message={itemErrors.description} /></label>
                <label className="full-width">Observacoes tecnicas<textarea maxLength="10000" onChange={(event) => setItemForm((current) => ({ ...current, values: { ...current.values, technicalNotes: event.target.value } }))} rows="4" value={itemForm.values.technicalNotes} /></label>
              </div>
              <p>A descricao completa e o criterio tecnico soberano; referencia e fabricante sao auxiliares.</p>
              <div className="modal-actions"><button disabled={busy} onClick={() => setItemForm(null)} type="button">Cancelar</button><button disabled={busy} type="submit">{busy ? "Aguardando backend..." : "Salvar no SQLite"}</button></div>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default Oportunidades;
