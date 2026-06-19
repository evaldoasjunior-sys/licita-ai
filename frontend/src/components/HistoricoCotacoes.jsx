import { useState } from "react";

function HistoricoCotacoes() {
  const [fornecedor, setFornecedor] = useState("");
  const [oportunidade, setOportunidade] = useState("");
  const [item, setItem] = useState("");
  const [status, setStatus] = useState("Aguardando resposta");

  const [cotacoes, setCotacoes] = useState(() => {
    const dados = localStorage.getItem("cotacoes");
    return dados ? JSON.parse(dados) : [];
  });

  function salvarCotacoes(lista) {
    setCotacoes(lista);
    localStorage.setItem("cotacoes", JSON.stringify(lista));
  }

  function registrarCotacao() {
    if (!fornecedor || !oportunidade) {
      alert("Preencha fornecedor e oportunidade.");
      return;
    }

    const nova = {
      fornecedor,
      oportunidade,
      item,
      status,
      data: new Date().toLocaleDateString("pt-BR"),
    };

    salvarCotacoes([...cotacoes, nova]);

    setFornecedor("");
    setOportunidade("");
    setItem("");
    setStatus("Aguardando resposta");

    alert("Cotação registrada!");
  }

  function alterarStatus(index, novoStatus) {
    const atualizadas = cotacoes.map((cotacao, i) =>
      i === index ? { ...cotacao, status: novoStatus } : cotacao
    );

    salvarCotacoes(atualizadas);
  }

  return (
    <div>
      <h2>Histórico de Cotações</h2>

      <p>Fornecedor:</p>
      <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />

      <p>Oportunidade:</p>
      <input value={oportunidade} onChange={(e) => setOportunidade(e.target.value)} />

      <p>Item:</p>
      <input value={item} onChange={(e) => setItem(e.target.value)} />

      <p>Status inicial:</p>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option>Aguardando resposta</option>
        <option>Respondido</option>
        <option>Sem retorno</option>
        <option>Não participaremos</option>
        <option>Cotado</option>
        <option>Pedido emitido</option>
      </select>

      <br /><br />

      <button onClick={registrarCotacao}>Registrar Cotação</button>

      <hr />

      <h3>Histórico</h3>

      {cotacoes.length === 0 ? (
        <p>Nenhuma cotação registrada.</p>
      ) : (
        cotacoes.map((c, index) => (
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
            Item: {c.item || "Não informado"}
            <br />
            Data: {c.data}

            <p><strong>Status:</strong></p>

            <select
              value={c.status}
              onChange={(e) => alterarStatus(index, e.target.value)}
            >
              <option>Aguardando resposta</option>
              <option>Respondido</option>
              <option>Sem retorno</option>
              <option>Não participaremos</option>
              <option>Cotado</option>
              <option>Pedido emitido</option>
            </select>
          </div>
        ))
      )}
    </div>
  );
}

export default HistoricoCotacoes;