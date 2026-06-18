function Painel() {
  const oportunidades = (() => {
    const dados = localStorage.getItem("oportunidades");
    return dados ? JSON.parse(dados) : [];
  })();

  const cotacoes = (() => {
    const dados = localStorage.getItem("cotacoes");
    return dados ? JSON.parse(dados) : [];
  })();

  function contarCotacoes(numero, status) {
    return cotacoes.filter(
      (c) => c.oportunidade === numero && c.status === status
    ).length;
  }

  return (
    <div>
      <h2>Painel da Oportunidade</h2>

      {oportunidades.length === 0 ? (
        <p>Nenhuma oportunidade cadastrada.</p>
      ) : (
        oportunidades.map((op, index) => {
          const totalCotacoes = cotacoes.filter(
            (c) => c.oportunidade === op.numero
          ).length;

          return (
            <div
              key={index}
              style={{
                border: "1px solid #ccc",
                padding: "15px",
                marginBottom: "15px",
              }}
            >
              <h3>Oportunidade: {op.numero}</h3>

              <p>
                <strong>Status:</strong> {op.status}
              </p>

              <p>
                <strong>Vencimento:</strong> {op.vencimento}
              </p>

              <p>
                <strong>Itens cadastrados:</strong> {op.itens.length}
              </p>

              <p>
                <strong>Fornecedores consultados:</strong> {totalCotacoes}
              </p>

              <p>
                <strong>Aguardando resposta:</strong>{" "}
                {contarCotacoes(op.numero, "Aguardando resposta")}
              </p>

              <p>
                <strong>Respondidos:</strong>{" "}
                {contarCotacoes(op.numero, "Respondido")}
              </p>

              <p>
                <strong>Sem retorno:</strong>{" "}
                {contarCotacoes(op.numero, "Sem retorno")}
              </p>

              <p>
                <strong>Pedidos emitidos:</strong>{" "}
                {contarCotacoes(op.numero, "Pedido emitido")}
              </p>
            </div>
          );
        })
      )}
    </div>
  );
}

export default Painel;