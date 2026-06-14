import { useState } from "react";

function App() {
  const [numero, setNumero] = useState("");
  const [textoCompleto, setTextoCompleto] = useState("");
  const [itens, setItens] = useState([]);

  function identificarCategoria(texto) {
    const t = texto.toUpperCase();

    if (t.includes("TRANSMISSOR DE VAZÃO")) return "Transmissor de Vazão";
    if (t.includes("TRANSMISSOR DE TEMPERATURA")) return "Transmissor de Temperatura";
    if (t.includes("TRANSMISSOR DE PRESSÃO")) return "Transmissor de Pressão";
    if (t.includes("MEDIDOR DE UMIDADE")) return "Medidor de Umidade";
    if (t.includes("CONTATOR")) return "Contator";
    if (t.includes("VÁLVULA") || t.includes("VALVULA")) return "Válvula";
    if (t.includes("FUSÍVEL") || t.includes("FUSIVEL")) return "Fusível";

    return "Não identificada";
  }

  function extrairReferencias(texto) {
    const t = texto.toUpperCase();
    const referencias = [];

    const tp = t.match(/TP:\s*([A-Z0-9\s]+?)\s+([A-Z0-9\-\/\.]+)/);
    if (tp) {
      referencias.push({
        tipo: "Tp",
        fabricante: tp[1].trim(),
        codigo: tp[2].trim(),
      });
    }

    const refRegex = /REFERÊNCIA:\s*(.*?)\s*\/\s*FABRICANTE:\s*([A-Z0-9\s]+)/g;
    let match;

    while ((match = refRegex.exec(t)) !== null) {
      referencias.push({
        tipo: "Referência",
        fabricante: match[2].trim(),
        codigo: match[1].trim(),
      });
    }

    return referencias;
  }

  function quebrarEmItens() {
    if (!textoCompleto) {
      alert("Cole o texto da oportunidade.");
      return;
    }

    const linhas = textoCompleto
      .split("\n")
      .map((linha) => linha.trim())
      .filter((linha) => linha.length > 0);

    const novosItens = [];
    let itemAtual = null;

    linhas.forEach((linha) => {
      const inicioItem = linha.match(/^(\d+)\s+(\d+)\s+(.*)/);

      if (inicioItem) {
        if (itemAtual) {
          novosItens.push(itemAtual);
        }

        itemAtual = {
          item: inicioItem[1],
          quantidade: inicioItem[2],
          descricao: inicioItem[3],
        };
      } else if (itemAtual) {
        itemAtual.descricao += " " + linha;
      }
    });

    if (itemAtual) {
      novosItens.push(itemAtual);
    }

    const itensAnalisados = novosItens.map((item) => ({
      ...item,
      categoria: identificarCategoria(item.descricao),
      referencias: extrairReferencias(item.descricao),
    }));

    setItens(itensAnalisados);
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>LICITA AI</h1>
      <h2>MVP 0.8 - Importar oportunidade inteira</h2>

      <p>Número da oportunidade:</p>
      <input
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="Ex: 7003927991"
        style={{ width: "300px", padding: "8px" }}
      />

      <p>Texto completo da oportunidade:</p>
      <textarea
        rows="15"
        cols="100"
        value={textoCompleto}
        onChange={(e) => setTextoCompleto(e.target.value)}
        placeholder="Cole aqui a oportunidade inteira copiada da Petronect ou do Word"
      />

      <br />
      <br />

      <button onClick={quebrarEmItens}>Quebrar em itens</button>

      <hr />

      <h2>Itens identificados da oportunidade {numero || "(sem número)"}</h2>

      {itens.map((item, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            marginBottom: "15px",
          }}
        >
          <h3>
            Item {item.item} | Qtd {item.quantidade}
          </h3>

          <p>
            <strong>Categoria:</strong> {item.categoria}
          </p>

          <p>
            <strong>Descrição:</strong> {item.descricao}
          </p>

          <h4>Referências / Fabricantes</h4>

          {item.referencias.length === 0 ? (
            <p>Nenhuma referência identificada.</p>
          ) : (
            <ul>
              {item.referencias.map((ref, i) => (
                <li key={i}>
                  <strong>{ref.tipo}:</strong> {ref.fabricante} | {ref.codigo}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default App;