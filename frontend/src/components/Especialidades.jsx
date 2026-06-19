import { useEffect, useState } from "react";

function Especialidades() {
  const [fornecedor, setFornecedor] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [categoria, setCategoria] = useState("");

  const [fornecedores, setFornecedores] = useState(() => {
    const dadosSalvos = localStorage.getItem("fornecedores");
    return dadosSalvos ? JSON.parse(dadosSalvos) : [];
  });

  const [buscaFabricante, setBuscaFabricante] = useState("");
  const [buscaCategoria, setBuscaCategoria] = useState("");
  const [resultadoBusca, setResultadoBusca] = useState([]);

  useEffect(() => {
    localStorage.setItem("fornecedores", JSON.stringify(fornecedores));
  }, [fornecedores]);

  function adicionarEspecialidade() {
    if (!fornecedor || !fabricante || !categoria) {
      alert("Preencha fornecedor, fabricante e categoria.");
      return;
    }

    const novaEspecialidade = { fabricante, categoria };

    const existe = fornecedores.some(
      (f) => f.nome.toUpperCase() === fornecedor.toUpperCase()
    );

    if (existe) {
      setFornecedores(
        fornecedores.map((f) =>
          f.nome.toUpperCase() === fornecedor.toUpperCase()
            ? {
                ...f,
                email: email || f.email,
                telefone: telefone || f.telefone,
                especialidades: [...f.especialidades, novaEspecialidade],
              }
            : f
        )
      );
    } else {
      setFornecedores([
        ...fornecedores,
        {
          nome: fornecedor,
          email,
          telefone,
          especialidades: [novaEspecialidade],
        },
      ]);
    }

    setFabricante("");
    setCategoria("");

    alert("Especialidade adicionada!");
  }

  function excluirFornecedor(nomeFornecedor) {
    const confirmar = window.confirm(
      `Tem certeza que deseja excluir o fornecedor ${nomeFornecedor}?`
    );

    if (!confirmar) return;

    const atualizados = fornecedores.filter(
      (f) => f.nome !== nomeFornecedor
    );

    setFornecedores(atualizados);
    setResultadoBusca([]);
  }

  function buscarFornecedores() {
    const encontrados = fornecedores.filter((f) =>
      f.especialidades.some(
        (esp) =>
          esp.fabricante.toUpperCase() === buscaFabricante.toUpperCase() &&
          esp.categoria.toUpperCase() === buscaCategoria.toUpperCase()
      )
    );

    setResultadoBusca(encontrados);
  }

  return (
    <div>
      <h2>Base de Conhecimento Comercial</h2>

      <p>Fornecedor:</p>
      <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />

      <p>Email:</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />

      <p>Telefone:</p>
      <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />

      <p>Fabricante:</p>
      <input value={fabricante} onChange={(e) => setFabricante(e.target.value)} />

      <p>Categoria:</p>
      <input value={categoria} onChange={(e) => setCategoria(e.target.value)} />

      <br /><br />

      <button onClick={adicionarEspecialidade}>Adicionar Especialidade</button>

      <hr />

      <h3>Buscar fornecedor</h3>

      <p>Fabricante:</p>
      <input
        value={buscaFabricante}
        onChange={(e) => setBuscaFabricante(e.target.value)}
        placeholder="Ex: EMERSON"
      />

      <p>Categoria:</p>
      <input
        value={buscaCategoria}
        onChange={(e) => setBuscaCategoria(e.target.value)}
        placeholder="Ex: Transmissor de Vazão"
      />

      <br /><br />

      <button onClick={buscarFornecedores}>Buscar</button>

      <h4>Resultado da busca</h4>

      {resultadoBusca.length === 0 ? (
        <p>Nenhum fornecedor encontrado.</p>
      ) : (
        resultadoBusca.map((f, index) => (
          <div
            key={index}
            style={{ border: "1px solid #999", padding: "10px", marginBottom: "10px" }}
          >
            <strong>{f.nome}</strong><br />
            {f.email}<br />
            {f.telefone}
          </div>
        ))
      )}

      <hr />

      <h3>Fornecedores cadastrados</h3>

      {fornecedores.length === 0 ? (
        <p>Nenhum fornecedor cadastrado.</p>
      ) : (
        fornecedores.map((f, index) => (
          <div
            key={index}
            style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px" }}
          >
            <strong>{f.nome}</strong><br />
            {f.email}<br />
            {f.telefone}

            <br /><br />

            <button onClick={() => excluirFornecedor(f.nome)}>
              Excluir Fornecedor
            </button>

            <h4>Especialidades</h4>

            <ul>
              {f.especialidades.map((esp, i) => (
                <li key={i}>
                  {esp.fabricante} | {esp.categoria}
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}

export default Especialidades;