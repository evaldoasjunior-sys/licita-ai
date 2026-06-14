import { useState } from "react";

function App() {
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState(null);

  function analisarDescricao() {
    const texto = descricao.toUpperCase();

    const fabricanteCodigo = texto.match(/TP:\s*([A-Z0-9]+)\s+([A-Z0-9\-]+)/);

    setResultado({
      fabricante: fabricanteCodigo ? fabricanteCodigo[1] : "Não identificado",
      codigo: fabricanteCodigo ? fabricanteCodigo[2] : "Não identificado",
      categoria: texto.includes("FUSÍVEL") || texto.includes("FUSIVEL") ? "Fusível" : "Não identificada",
    });
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>LICITA AI</h1>
      <h2>Nova Oportunidade</h2>

      <label>Número da oportunidade:</label><br />
      <input type="text" placeholder="Ex: 7004613037" style={{ width: "300px", padding: "8px" }} />

      <br /><br />

      <label>Descrição:</label><br />
      <textarea
        rows="10"
        cols="80"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Cole aqui a descrição da Petronect"
      />

      <br /><br />

      <button onClick={analisarDescricao}>Analisar</button>

      {resultado && (
        <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "15px", width: "500px" }}>
          <h3>Resultado da análise</h3>
          <p><strong>Fabricante:</strong> {resultado.fabricante}</p>
          <p><strong>Código:</strong> {resultado.codigo}</p>
          <p><strong>Categoria:</strong> {resultado.categoria}</p>
        </div>
      )}
    </div>
  );
}

export default App;