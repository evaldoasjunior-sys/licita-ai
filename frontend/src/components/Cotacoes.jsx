import { useState } from "react";

function Cotacoes() {
  const [oportunidade, setOportunidade] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [email, setEmail] = useState("");
  const [descricao, setDescricao] = useState("");
  const [emailGerado, setEmailGerado] = useState("");

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