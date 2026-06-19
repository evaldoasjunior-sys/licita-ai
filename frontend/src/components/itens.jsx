import { useState } from "react";

function Itens() {
  const [resultado, setResultado] = useState([]);
  const [itemSelecionado, setItemSelecionado] = useState(null);

  const oportunidades = (() => {
    const dados = localStorage.getItem("oportunidades");
    return dados ? JSON.parse(dados) : [];
  })();

  function buscarFornecedores(item, numeroOportunidade) {
    const dados = localStorage.getItem("fornecedores");
    const fornecedores = dados ? JSON.parse(dados) : [];

    const encontrados = fornecedores.filter((f) =>
      f.especialidades.some(
        (esp) =>
          esp.fabricante.toUpperCase() === item.fabricante.toUpperCase() &&
          esp.categoria.toUpperCase() === item.categoria.toUpperCase()
      )
    );

    setItemSelecionado({
      ...item,
      oportunidade: numeroOportunidade,
    });

    setResultado(encontrados);
  }

function prepararCotacao(fornecedor) {
  localStorage.setItem(
    "cotacaoAtual",
    JSON.stringify({
      oportunidade: itemSelecionado.oportunidade,
      item: itemSelecionado.itemNumero,
      fornecedor: fornecedor.nome,
      email: fornecedor.email,
      fabricante: itemSelecionado.fabricante,
      categoria: itemSelecionado.categoria,
      descricao: `Item ${itemSelecionado.itemNumero} - Qtd ${itemSelecionado.quantidade}

${itemSelecionado.descricao}`,
    })
  );

  alert("Cotação preparada. Agora abra a tela Cotações.");
}

  return (
    <div>
      <h2>Itens das Oportunidades</h2>

      {oportunidades.length === 0 ? (
        <p>Nenhuma oportunidade cadastrada.</p>
      ) : (
        oportunidades.map((op, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #ccc",
              padding: "15px",
              marginBottom: "15px",
            }}
          >
            <h3>Oportunidade {op.numero}</h3>

            {op.itens.length === 0 ? (
              <p>Nenhum item cadastrado nesta oportunidade.</p>
            ) : (
              op.itens.map((item, i) => (
                <div
                  key={i}
                  style={{
                    border: "1px solid #ddd",
                    padding: "10px",
                    marginBottom: "10px",
                  }}
                >
                  <p><strong>Item:</strong> {item.itemNumero}</p>
                  <p><strong>Quantidade:</strong> {item.quantidade}</p>
                  <p><strong>Fabricante:</strong> {item.fabricante}</p>
                  <p><strong>Categoria:</strong> {item.categoria}</p>
                  <p><strong>Descrição:</strong> {item.descricao}</p>

                  <button onClick={() => buscarFornecedores(item, op.numero)}>
                    Buscar fornecedores
                  </button>
                </div>
              ))
            )}
          </div>
        ))
      )}

      <hr />

      <h3>Resultado da busca</h3>

      {itemSelecionado && (
        <p>
          Item selecionado: {itemSelecionado.fabricante} |{" "}
          {itemSelecionado.categoria}
        </p>
      )}

      {resultado.length === 0 ? (
        <p>Nenhum fornecedor encontrado.</p>
      ) : (
        resultado.map((f, index) => (
          <div
            key={index}
            style={{
              border: "1px solid #999",
              padding: "10px",
              marginBottom: "10px",
            }}
          >
            <strong>{f.nome}</strong>
            <br />
            {f.email}
            <br />
            {f.telefone}

            <br />
            <br />

            <button onClick={() => prepararCotacao(f)}>
              Gerar Cotação
            </button>
          </div>
        ))
      )}
    </div>
  );
}

export default Itens;