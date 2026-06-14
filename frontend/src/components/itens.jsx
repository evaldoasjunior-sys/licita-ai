import { useState } from "react";

function Itens() {
  const [fabricante, setFabricante] = useState("");
  const [categoria, setCategoria] = useState("");
  const [resultado, setResultado] = useState([]);

  function buscarFornecedores() {
    const dados = localStorage.getItem("fornecedores");

    if (!dados) {
      setResultado([]);
      return;
    }

    const fornecedores = JSON.parse(dados);

    const encontrados = fornecedores.filter((f) =>
      f.especialidades.some(
        (esp) =>
          esp.fabricante.toUpperCase() === fabricante.toUpperCase() &&
          esp.categoria.toUpperCase() === categoria.toUpperCase()
      )
    );

    setResultado(encontrados);
  }

  return (
    <div>
      <h2>Busca de Fornecedores por Item</h2>

      <p>Fabricante:</p>
      <input
        value={fabricante}
        onChange={(e) => setFabricante(e.target.value)}
        placeholder="Ex: EMERSON"
      />

      <p>Categoria:</p>
      <input
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
        placeholder="Ex: Transmissor de Vazão"
      />

      <br />
      <br />

      <button onClick={buscarFornecedores}>
        Buscar Fornecedores
      </button>

      <hr />

      <h3>Fornecedores encontrados</h3>

      {resultado.length === 0 ? (
        <p>Nenhum fornecedor encontrado.</p>
      ) : (
        resultado.map((f, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            <strong>{f.nome}</strong>
            <br />
            {f.email}
            <br />
            {f.telefone}
          </div>
        ))
      )}
    </div>
  );
}

export default Itens;