import { useState } from "react";

function Oportunidades() {
  const [numero, setNumero] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [status, setStatus] = useState("Não analisada");
  const [itemNumero, setItemNumero] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [descricao, setDescricao] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [categoria, setCategoria] = useState("");

  const [oportunidades, setOportunidades] = useState(() => {
    const dados = localStorage.getItem("oportunidades");
    return dados ? JSON.parse(dados) : [];
  });

  function salvarOportunidades(lista) {
    setOportunidades(lista);
    localStorage.setItem("oportunidades", JSON.stringify(lista));
  }

  function sugerirClassificacao(texto) {
    const t = texto.toUpperCase();

    let fabricanteSugerido = "";
    let categoriaSugerida = "";

    if (t.includes("EMERSON")) fabricanteSugerido = "EMERSON";
    else if (t.includes("WEG")) fabricanteSugerido = "WEG";
    else if (t.includes("SKF")) fabricanteSugerido = "SKF";
    else if (t.includes("SIEMENS")) fabricanteSugerido = "SIEMENS";
    else if (t.includes("ABB")) fabricanteSugerido = "ABB";
    else if (t.includes("SCHNEIDER")) fabricanteSugerido = "SCHNEIDER";
    else if (t.includes("YOKOGAWA")) fabricanteSugerido = "YOKOGAWA";
    else if (t.includes("SMAR")) fabricanteSugerido = "SMAR";

    if (
      t.includes("TRANSMISSOR DE VAZÃO") ||
      t.includes("TRANSMISSOR DE VAZAO")
    ) {
      categoriaSugerida = "Transmissor de Vazão";
    } else if (
      t.includes("TRANSMISSOR DE PRESSÃO") ||
      t.includes("TRANSMISSOR DE PRESSAO")
    ) {
      categoriaSugerida = "Transmissor de Pressão";
    } else if (t.includes("TRANSMISSOR DE TEMPERATURA")) {
      categoriaSugerida = "Transmissor de Temperatura";
    } else if (t.includes("ROLAMENTO")) {
      categoriaSugerida = "Rolamento";
    } else if (t.includes("CONTATOR")) {
      categoriaSugerida = "Contator";
    } else if (t.includes("INVERSOR")) {
      categoriaSugerida = "Inversor de Frequência";
    } else if (t.includes("VÁLVULA") || t.includes("VALVULA")) {
      categoriaSugerida = "Válvula";
    }

    setFabricante(fabricanteSugerido);
    setCategoria(categoriaSugerida);
  }

  function criarOportunidade() {
    if (!numero) {
      alert("Informe o número da oportunidade.");
      return;
    }

    const nova = {
      numero,
      vencimento,
      status,
      itens: [],
    };

    salvarOportunidades([...oportunidades, nova]);

    setNumero("");
    setVencimento("");
    setStatus("Não analisada");

    alert("Oportunidade criada!");
  }

  function alterarStatus(numeroOportunidade, novoStatus) {
    const atualizadas = oportunidades.map((op) =>
      op.numero === numeroOportunidade
        ? { ...op, status: novoStatus }
        : op
    );

    salvarOportunidades(atualizadas);
  }

  function adicionarItem(numeroOportunidade) {
    if (!itemNumero || !quantidade || !descricao || !fabricante || !categoria) {
      alert("Preencha item, quantidade, descrição, fabricante e categoria.");
      return;
    }

    const novoItem = {
      itemNumero,
      quantidade,
      descricao,
      fabricante,
      categoria,
    };

    const atualizadas = oportunidades.map((op) =>
      op.numero === numeroOportunidade
        ? { ...op, itens: [...op.itens, novoItem] }
        : op
    );

    salvarOportunidades(atualizadas);

    setItemNumero("");
    setQuantidade("");
    setDescricao("");
    setFabricante("");
    setCategoria("");

    alert("Item adicionado!");
  }

  return (
    <div>
      <h2>Oportunidades</h2>

      <h3>Criar oportunidade</h3>

      <p>Número:</p>
      <input
        value={numero}
        onChange={(e) => setNumero(e.target.value)}
        placeholder="Ex: 7003927991"
      />

      <p>Vencimento:</p>
      <input
        value={vencimento}
        onChange={(e) => setVencimento(e.target.value)}
        placeholder="Ex: 21/09/2026"
      />

      <p>Status inicial:</p>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option>Não analisada</option>
        <option>Em análise</option>
        <option>Interessante</option>
        <option>Cotando</option>
        <option>Proposta enviada</option>
        <option>Encerrada</option>
      </select>

      <br />
      <br />

      <button onClick={criarOportunidade}>Criar oportunidade</button>

      <hr />

      <h3>Oportunidades cadastradas</h3>

      {oportunidades.length === 0 ? (
        <p>Nenhuma oportunidade cadastrada.</p>
      ) : (
        oportunidades.map((op, index) => (
          <div
            key={index}
            style={{
              border:
                op.status === "Não analisada"
                  ? "2px solid #000"
                  : "1px solid #ccc",
              padding: "15px",
              marginBottom: "15px",
              fontWeight: op.status === "Não analisada" ? "bold" : "normal",
            }}
          >
            <h3>{op.numero}</h3>

            <p>
              <strong>Vencimento:</strong> {op.vencimento}
            </p>

            <p>
              <strong>Status:</strong>
            </p>

            <select
              value={op.status}
              onChange={(e) => alterarStatus(op.numero, e.target.value)}
            >
              <option>Não analisada</option>
              <option>Em análise</option>
              <option>Interessante</option>
              <option>Cotando</option>
              <option>Proposta enviada</option>
              <option>Encerrada</option>
            </select>

            <h4>Adicionar item nesta oportunidade</h4>

            <p>Nº do item:</p>
            <input
              value={itemNumero}
              onChange={(e) => setItemNumero(e.target.value)}
              placeholder="Ex: 1"
            />

            <p>Quantidade:</p>
            <input
              value={quantidade}
              onChange={(e) => setQuantidade(e.target.value)}
              placeholder="Ex: 2"
            />

            <p>Descrição:</p>
            <textarea
              rows="6"
              cols="80"
              value={descricao}
              onChange={(e) => {
                setDescricao(e.target.value);
                sugerirClassificacao(e.target.value);
              }}
              placeholder="Cole aqui a descrição do item"
            />

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

            <button onClick={() => adicionarItem(op.numero)}>
              Adicionar item
            </button>

            <h4>Itens</h4>

            {op.itens.length === 0 ? (
              <p>Nenhum item cadastrado.</p>
            ) : (
              <ul>
                {op.itens.map((item, i) => (
                  <li key={i}>
                    Item {item.itemNumero} | Qtd {item.quantidade} |{" "}
                    {item.fabricante} | {item.categoria} | {item.descricao}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))
      )}
    </div>
  );
}

export default Oportunidades;