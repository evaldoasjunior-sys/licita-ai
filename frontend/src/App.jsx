import { useState } from "react";

function App() {
  const [numero, setNumero] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [oportunidades, setOportunidades] = useState([]);

  function adicionarOportunidade() {
    if (!numero || !vencimento) {
      alert("Preencha número e vencimento.");
      return;
    }

    const nova = {
      id: Date.now(),
      numero,
      vencimento,
      status: "Em análise",
    };

    setOportunidades([...oportunidades, nova]);

    setNumero("");
    setVencimento("");
  }

  function alterarStatus(id, novoStatus) {
    const atualizadas = oportunidades.map((op) =>
      op.id === id ? { ...op, status: novoStatus } : op
    );

    setOportunidades(atualizadas);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>LICITA AI</h1>

      <h2>Nova Oportunidade</h2>

      <p>Número:</p>
      <input
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="7003927991"
      />

      <p>Vencimento:</p>
      <input
        value={vencimento}
        onChange={(e) => setVencimento(e.target.value)}
        placeholder="21/09/2026"
      />

      <br />
      <br />

      <button onClick={adicionarOportunidade}>
        Adicionar Oportunidade
      </button>

      <hr />

      <h2>Oportunidades</h2>

      {oportunidades.map((op) => (
        <div
          key={op.id}
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            marginBottom: "15px",
          }}
        >
          <h3>{op.numero}</h3>

          <p>
            <strong>Vencimento:</strong> {op.vencimento}
          </p>

          <p>
            <strong>Status:</strong> {op.status}
          </p>

          <button
            onClick={() =>
              alterarStatus(op.id, "Sem Interesse")
            }
          >
            Sem Interesse
          </button>

          <button
            onClick={() =>
              alterarStatus(op.id, "Com Interesse")
            }
            style={{ marginLeft: "10px" }}
          >
            Com Interesse
          </button>

          <button
            onClick={() =>
              alterarStatus(op.id, "Cotação Enviada")
            }
            style={{ marginLeft: "10px" }}
          >
            Cotação Enviada
          </button>
        </div>
      ))}
    </div>
  );
}

export default App;