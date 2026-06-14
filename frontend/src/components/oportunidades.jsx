import { useState } from "react";

function Oportunidades() {
  const [numero, setNumero] = useState("");
  const [vencimento, setVencimento] = useState("");
  const [status, setStatus] = useState("Em análise");
  const [itemNumero, setItemNumero] = useState("");
  const [quantidade, setQuantidade] = useState("");
  const [descricao, setDescricao] = useState("");

  const [oportunidades, setOportunidades] = useState(() => {
    const dados = localStorage.getItem("oportunidades");
    return dados ? JSON.parse(dados) : [];
  });

  function salvarOportunidades(lista) {
    setOportunidades(lista);
    localStorage.setItem("oportunidades", JSON.stringify(lista));
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
    setStatus("Em análise");

    alert("Oportunidade criada!");
  }

  function adicionarItem(numeroOportunidade) {
    if (!itemNumero || !quantidade || !descricao) {
      alert("Preencha item, quantidade e descrição.");
      return;
    }

    const novoItem = {
      itemNumero,
      quantidade,
      descricao,
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

      <p>Status:</p>
      <select value={status} onChange={(e) => setStatus(e.target.value)}>
        <option>Em análise</option>
        <option>Sem interesse</option>
        <option>Com interesse</option>
        <option>Cotação enviada</option>
        <option>Aguardando resposta</option>
        <option>Finalizada</option>
      </select>

      <br />
      <br />

      <button onClick={criarOportunidade}>Criar oportunidade</button>

      <hr />

      <h3>Oportunidades cadastradas</h3>

      {oportunidades.map((op, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ccc",
            padding: "15px",
            marginBottom: "15px",
          }}
        >
          <h3>{op.numero}</h3>
          <p><strong>Vencimento:</strong> {op.vencimento}</p>
          <p><strong>Status:</strong> {op.status}</p>

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
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Cole aqui a descrição do item"
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
                  Item {item.itemNumero} | Qtd {item.quantidade} | {item.descricao}
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

export default Oportunidades;