import { useState } from "react";

function HistoricoCotacoes() {
  const [fornecedor, setFornecedor] = useState("");
  const [oportunidade, setOportunidade] = useState("");
  const [status, setStatus] = useState("Aguardando resposta");

  const [cotacoes, setCotacoes] = useState(() => {
    const dados = localStorage.getItem("cotacoes");
    return dados ? JSON.parse(dados) : [];
  });

  function registrarCotacao() {
    const nova = {
      fornecedor,
      oportunidade,
      status,
      data: new Date().toLocaleDateString("pt-BR"),
    };

    const atualizadas = [...cotacoes, nova];

    setCotacoes(atualizadas);

    localStorage.setItem(
      "cotacoes",
      JSON.stringify(atualizadas)
    );

    setFornecedor("");
    setOportunidade("");
  }

  return (
    <div>
      <h2>Histórico de Cotações</h2>

      <p>Fornecedor:</p>
      <input
        value={fornecedor}
        onChange={(e) => setFornecedor(e.target.value)}
      />

      <p>Oportunidade:</p>
      <input
        value={oportunidade}
        onChange={(e) => setOportunidade(e.target.value)}
      />

      <p>Status:</p>

      <select
        value={status}
        onChange={(e) => setStatus(e.target.value)}
      >
        <option>Aguardando resposta</option>
        <option>Respondido</option>
        <option>Sem retorno</option>
        <option>Pedido emitido</option>
      </select>

      <br />
      <br />

      <button onClick={registrarCotacao}>
        Registrar Cotação
      </button>

      <hr />

      <h3>Histórico</h3>

      {cotacoes.map((c, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <strong>{c.fornecedor}</strong>

          <br />

          Oportunidade: {c.oportunidade}

          <br />

          Status: {c.status}

          <br />

          Data: {c.data}
        </div>
      ))}
    </div>
  );
}

export default HistoricoCotacoes;