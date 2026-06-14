import { useEffect, useState } from "react";

function Cotacoes() {
  const [oportunidade, setOportunidade] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [email, setEmail] = useState("");
  const [descricao, setDescricao] = useState("");
  const [emailGerado, setEmailGerado] = useState("");

  useEffect(() => {
    const dados = localStorage.getItem("cotacaoAtual");

    if (dados) {
      const cotacao = JSON.parse(dados);

      setFornecedor(cotacao.fornecedor || "");
      setEmail(cotacao.email || "");
      setDescricao(cotacao.descricao || "");
    }
  }, []);

  function registrarNoHistorico() {
    const dados = localStorage.getItem("cotacoes");
    const cotacoes = dados ? JSON.parse(dados) : [];

    const novaCotacao = {
      fornecedor,
      email,
      oportunidade,
      status: "Aguardando resposta",
      data: new Date().toLocaleDateString("pt-BR"),
    };

    localStorage.setItem("cotacoes", JSON.stringify([...cotacoes, novaCotacao]));
  }

  function gerarEmail() {
    const texto = `Assunto: Solicitação de Cotação - Oportunidade ${oportunidade}

Prezados,

Solicitamos cotação para o material abaixo:

${descricao}

Favor informar:
- Preço unitário
- Prazo de entrega
- Condições de pagamento
- Validade da proposta
- Frete, se aplicável

Atenciosamente,`;

    setEmailGerado(texto);
    registrarNoHistorico();

    alert("E-mail gerado e cotação registrada no histórico!");
  }

  return (
    <div>
      <h2>Gerador de E-mail de Cotação</h2>

      <p>Oportunidade:</p>
      <input value={oportunidade} onChange={(e) => setOportunidade(e.target.value)} />

      <p>Fornecedor:</p>
      <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />

      <p>Email do fornecedor:</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />

      <p>Descrição completa do item:</p>
      <textarea
        rows="10"
        cols="90"
        value={descricao}
        onChange={(e) => setDescricao(e.target.value)}
      />

      <br /><br />

      <button onClick={gerarEmail}>Gerar E-mail</button>

      {emailGerado && (
        <div>
          <h3>E-mail gerado</h3>
          <textarea rows="15" cols="90" value={emailGerado} readOnly />
        </div>
      )}
    </div>
  );
}

export default Cotacoes;