import { useEffect, useState } from "react";
import { backendApi } from "../services/backendApi";
import { createId, normalizeText, supplierService } from "../services/dataServices";

function Especialidades({ backendStatus, syncRevision }) {
  const [fornecedor, setFornecedor] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [categoria, setCategoria] = useState("");
  const [especialidadesFormulario, setEspecialidadesFormulario] = useState([]);
  const [buscaFabricante, setBuscaFabricante] = useState("");
  const [buscaCategoria, setBuscaCategoria] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState([]);
  const [fornecedorEditandoId, setFornecedorEditandoId] = useState("");
  const [origemDados, setOrigemDados] = useState("local");
  const [mensagemIntegracao, setMensagemIntegracao] = useState("");

  const [fornecedores, setFornecedores] = useState(() => supplierService.listActive());
  const fornecedoresVisiveis = resultadoBusca.length > 0 ? resultadoBusca : fornecedores;
  const buscaAtiva = resultadoBusca.length > 0;

  function persistir(lista) {
    setFornecedores(lista.filter((supplier) => !supplier.archivedAt));
    supplierService.saveAll(lista);
  }

  useEffect(() => {
    let ativo = true;

    async function carregarFornecedoresDoBackend() {
      try {
        const resultado = await backendApi.suppliers({ includeArchived: true });
        if (!ativo) return;

        setOrigemDados("sqlite");
        setMensagemIntegracao("Fornecedores carregados do banco SQLite.");
        setFornecedores(resultado.data.filter((supplier) => !supplier.archivedAt));
        supplierService.saveAll(resultado.data);
      } catch {
        if (!ativo) return;

        setOrigemDados("local");
        setMensagemIntegracao("Backend indisponivel. Usando fornecedores locais deste navegador.");
      }
    }

    carregarFornecedoresDoBackend();

    return () => {
      ativo = false;
    };
  }, [backendStatus, syncRevision]);

  function todosFornecedores() {
    return supplierService.listAll();
  }

  function limparFormulario() {
    setFornecedorEditandoId("");
    setFornecedor("");
    setEmail("");
    setTelefone("");
    setCnpj("");
    setFabricante("");
    setCategoria("");
    setEspecialidadesFormulario([]);
  }

  function adicionarEspecialidadeFormulario() {
    if (!fabricante.trim() || !categoria.trim()) {
      alert("Preencha fabricante e categoria para adicionar a especialidade.");
      return;
    }

    const novaEspecialidade = {
      id: createId("specialty"),
      manufacturer: fabricante.trim(),
      category: categoria.trim(),
      notes: "",
    };

    setEspecialidadesFormulario((atuais) => [...atuais, novaEspecialidade]);
    setFabricante("");
    setCategoria("");
  }

  function removerEspecialidadeFormulario(id) {
    setEspecialidadesFormulario((atuais) => atuais.filter((especialidade) => especialidade.id !== id));
  }

  async function salvarFornecedor() {
    if (!fornecedor.trim() || especialidadesFormulario.length === 0) {
      alert("Preencha fornecedor e adicione ao menos uma especialidade.");
      return;
    }

    const agora = new Date().toISOString();
    const existentes = todosFornecedores();
    const fornecedorExistente = existentes.find(
      (item) =>
        (!fornecedorEditandoId && normalizeText(item.name) === normalizeText(fornecedor)) ||
        item.id === fornecedorEditandoId
    );

    let fornecedorParaSalvar;
    let atualizados;

    if (fornecedorExistente) {
      fornecedorParaSalvar = {
        ...fornecedorExistente,
        name: fornecedor.trim(),
        taxId: cnpj.trim() || fornecedorExistente.taxId,
        email: email.trim() || fornecedorExistente.email,
        phone: telefone.trim() || fornecedorExistente.phone,
        specialties: fornecedorEditandoId
          ? especialidadesFormulario
          : [...fornecedorExistente.specialties, ...especialidadesFormulario],
        updatedAt: agora,
        archivedAt: null,
      };

      atualizados = existentes.map((item) =>
        item.id === fornecedorExistente.id ? fornecedorParaSalvar : item
      );
    } else {
      fornecedorParaSalvar = {
        id: createId("supplier"),
        name: fornecedor.trim(),
        legalName: "",
        taxId: cnpj.trim(),
        email: email.trim(),
        phone: telefone.trim(),
        status: "Ativo",
        notes: "",
        specialties: especialidadesFormulario,
        createdAt: agora,
        updatedAt: agora,
        archivedAt: null,
      };

      atualizados = [...existentes, fornecedorParaSalvar];
    }

    if (origemDados === "sqlite") {
      try {
        await backendApi.saveSupplier(fornecedorParaSalvar, { isNew: !fornecedorExistente });
        const resultado = await backendApi.suppliers({ includeArchived: true });
        persistir(resultado.data);
        setMensagemIntegracao("Fornecedor salvo no banco SQLite.");
      } catch {
        persistir(atualizados);
        setOrigemDados("local");
        setMensagemIntegracao("Nao foi possivel salvar no SQLite. Alteracao mantida localmente.");
      }
    } else {
      persistir(atualizados);
    }

    limparFormulario();
    setResultadoBusca([]);
    alert(fornecedorEditandoId ? "Fornecedor alterado!" : "Fornecedor/especialidade salvo!");
  }

  function editarFornecedor(supplier) {
    setFornecedorEditandoId(supplier.id);
    setFornecedor(supplier.name || "");
    setCnpj(supplier.taxId || "");
    setEmail(supplier.email || "");
    setTelefone(supplier.phone || "");
    setFabricante("");
    setCategoria("");
    setEspecialidadesFormulario(supplier.specialties);
  }

  async function excluirFornecedor(id) {
    const confirmar = window.confirm("Excluir este fornecedor da lista?");
    if (!confirmar) return;

    const agora = new Date().toISOString();
    const atualizados = todosFornecedores().map((item) =>
      item.id === id ? { ...item, status: "Excluido", archivedAt: agora, updatedAt: agora } : item
    );

    if (origemDados === "sqlite") {
      try {
        await backendApi.deleteSupplier(id);
        const resultado = await backendApi.suppliers({ includeArchived: true });
        persistir(resultado.data);
        setMensagemIntegracao("Fornecedor excluido do banco SQLite.");
      } catch {
        persistir(atualizados);
        setOrigemDados("local");
        setMensagemIntegracao("Nao foi possivel excluir no SQLite. Exclusao mantida localmente.");
      }
    } else {
      persistir(atualizados);
    }

    if (fornecedorEditandoId === id) limparFormulario();
    setResultadoBusca([]);
  }

  function buscarFornecedores() {
    if (!buscaFabricante.trim() && !buscaCategoria.trim()) {
      setResultadoBusca([]);
      return;
    }

    const encontrados = fornecedores.filter((supplier) =>
      supplier.specialties.some(
        (specialty) =>
          (!buscaFabricante.trim() ||
            normalizeText(specialty.manufacturer).includes(normalizeText(buscaFabricante))) &&
          (!buscaCategoria.trim() ||
            normalizeText(specialty.category).includes(normalizeText(buscaCategoria)))
      )
    );

    setResultadoBusca(encontrados);
  }

  function limparBusca() {
    setBuscaFabricante("");
    setBuscaCategoria("");
    setResultadoBusca([]);
  }

  function formatarEspecialidades(supplier) {
    if (supplier.specialties.length === 0) return "Nenhuma especialidade cadastrada";

    return supplier.specialties
      .map((specialty) => `${specialty.manufacturer || "Fabricante nao informado"} / ${specialty.category || "Categoria nao informada"}`)
      .join(" | ");
  }

  return (
    <div>
      <h2>Fornecedores</h2>

      <p>
        Cadastre fornecedores e vincule cada um aos fabricantes e categorias que ele atende. Por enquanto esta sera a
        base usada para consulta junto das oportunidades importadas.
      </p>
      <p className="import-message">
        Base em uso: {origemDados === "sqlite" ? "Banco SQLite" : "Navegador local"}. {mensagemIntegracao}
      </p>

      <div className="supplier-layout">
        <section className="supplier-panel">
          <h3>{fornecedorEditandoId ? "Alterar fornecedor" : "Cadastrar fornecedor"}</h3>

          <div className="supplier-form-grid">
            <label>
              Fornecedor
              <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />
            </label>

            <label>
              CNPJ
              <input value={cnpj} onChange={(e) => setCnpj(e.target.value)} />
            </label>

            <label>
              Email
              <input value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>

            <label>
              Telefone
              <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />
            </label>

          </div>

          <h4>Especialidades</h4>

          <div className="supplier-form-grid">
            <label>
              Fabricante atendido
              <input value={fabricante} onChange={(e) => setFabricante(e.target.value)} placeholder="Ex: EMERSON" />
            </label>

            <label>
              Categoria atendida
              <input
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                placeholder="Ex: Transmissor de Vazao"
              />
            </label>
          </div>

          <div className="panel-actions">
            <button onClick={adicionarEspecialidadeFormulario} title="Inclui o fabricante e a categoria informados na lista de especialidades do fornecedor.">Adicionar especialidade</button>
          </div>

          {especialidadesFormulario.length === 0 ? (
            <p className="supplier-count">Nenhuma especialidade adicionada.</p>
          ) : (
            <table className="specialty-edit-table">
              <thead>
                <tr>
                  <th>FABRICANTE</th>
                  <th>CATEGORIA</th>
                  <th>ACAO</th>
                </tr>
              </thead>
              <tbody>
                {especialidadesFormulario.map((especialidade) => (
                  <tr key={especialidade.id}>
                    <td>{especialidade.manufacturer}</td>
                    <td>{especialidade.category}</td>
                    <td>
                      <button
                        className="decline-button"
                        onClick={() => removerEspecialidadeFormulario(especialidade.id)}
                        title="Remove esta especialidade antes de salvar o fornecedor."
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="panel-actions">
            {fornecedorEditandoId && <button onClick={limparFormulario} title="Cancela a edicao e limpa o formulario.">Cancelar alteracao</button>}
            <button onClick={salvarFornecedor} title="Salva o fornecedor com seus dados de contato e especialidades.">
              {fornecedorEditandoId ? "Salvar alteracoes" : "Salvar fornecedor"}
            </button>
          </div>
        </section>

        <section className="supplier-panel">
          <h3>Buscar fornecedor</h3>

          <div className="supplier-form-grid compact">
            <label>
              Fabricante
              <input
                value={buscaFabricante}
                onChange={(e) => setBuscaFabricante(e.target.value)}
                placeholder="Ex: EMERSON"
              />
            </label>

            <label>
              Categoria
              <input
                value={buscaCategoria}
                onChange={(e) => setBuscaCategoria(e.target.value)}
                placeholder="Ex: Transmissor de Vazao"
              />
            </label>
          </div>

          <div className="panel-actions">
            <button onClick={buscarFornecedores} title="Filtra fornecedores pelas especialidades de fabricante e categoria.">Buscar</button>
            <button onClick={limparBusca} title="Limpa os filtros e volta a exibir todos os fornecedores ativos.">Limpar</button>
          </div>

          <p className="supplier-count">
            {buscaAtiva
              ? `${resultadoBusca.length} fornecedor(es) encontrado(s).`
              : `${fornecedores.length} fornecedor(es) cadastrado(s).`}
          </p>
        </section>
      </div>

      <h3>{buscaAtiva ? "Resultado da busca" : "Fornecedores cadastrados"}</h3>

      {fornecedoresVisiveis.length === 0 ? (
        <p>Nenhum fornecedor cadastrado.</p>
      ) : (
        <div className="table-scroll">
          <table className="supplier-table">
            <thead>
              <tr>
                <th>FORNECEDOR</th>
                <th>CNPJ</th>
                <th>EMAIL</th>
                <th>TELEFONE</th>
                <th>ESPECIALIDADES</th>
                <th>ACAO</th>
              </tr>
            </thead>
            <tbody>
              {fornecedoresVisiveis.map((supplier) => (
                <tr key={supplier.id}>
                  <td>{supplier.name}</td>
                  <td>{supplier.taxId || "Nao informado"}</td>
                  <td>{supplier.email || "Nao informado"}</td>
                  <td>{supplier.phone || "Nao informado"}</td>
                  <td>{formatarEspecialidades(supplier)}</td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => editarFornecedor(supplier)} title="Carrega este fornecedor no formulario para alteracao.">Alterar</button>
                      <button className="decline-button" onClick={() => excluirFornecedor(supplier.id)} title="Remove este fornecedor da lista ativa mantendo o registro arquivado.">
                        Excluir
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default Especialidades;
