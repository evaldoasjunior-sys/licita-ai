import { useState } from "react";

function App() {
  const [numero, setNumero] = useState("");
  const [descricao, setDescricao] = useState("");
  const [resultado, setResultado] = useState(null);
  const [salvos, setSalvos] = useState([]);

  function analisarDescricao() {
    const texto = descricao.toUpperCase();
    const fabricanteCodigo = texto.match(/TP:\s*([A-Z0-9]+)\s+([A-Z0-9\-]+)/);

    setResultado({
      oportunidade: numero || "Não informado",
      fabricante: fabricanteCodigo ? fabricanteCodigo[1] : "Não identificado",
      codigo: fabricanteCodigo ? fabricanteCodigo[2] : "Não identificado",
      categoria:
        texto.includes("FUSÍVEL") || texto.includes("FUSIVEL")
          ? "Fusível NH"
          : "Não identificada",
      status: "Aguardando Cotação",
    });
  }

  function salvarResultado() {
    if (!resultado) return;
    setSalvos([...salvos, resultado]);
    alert("Oportunidade salva no MVP!");
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>LICITA AI</h1>
      <h2>Nova Oportunidade</h2>

      <label>Número da oportunidade:</label>
      <br />
      <input
        type="text"
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="Ex: 7004613037"
        style={{ width: "300px", padding: "8px" }}
      />

      <br />
      <br />

      <label>Descrição:</label>
      <br />
      <textarea
        rows="10"
        cols="80"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
        placeholder="Cole aqui a descrição da Petronect"
      />

      <br />
      <br />

      <button onClick={analisarDescricao}>Analisar</button>

      {resultado && (
        <div style={{ marginTop: "20px", border: "1px solid #ccc", padding: "15px", width: "500px" }}>
          <h3>Resultado da análise</h3>
          <p><strong>Oportunidade:</strong> {resultado.oportunidade}</p>
          <p><strong>Categoria:</strong> {resultado.categoria}</p>
          <p><strong>Fabricante:</strong> {resultado.fabricante}</p>
          <p><strong>Código:</strong> {resultado.codigo}</p>
          <p><strong>Status:</strong> {resultado.status}</p>

          <button onClick={salvarResultado}>Salvar</button>
        </div>
      )}

      {salvos.length > 0 && (
        <div style={{ marginTop: "30px" }}>
          <h3>Oportunidades salvas nesta sessão</h3>
          <ul>
            {salvos.map((item, index) => (
              <li key={index}>
                {item.oportunidade} - {item.fabricante} - {item.codigo} - {item.status}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;