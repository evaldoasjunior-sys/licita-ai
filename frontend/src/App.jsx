import { useState } from "react";

function App() {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fornecedores, setFornecedores] = useState([]);

  function salvarFornecedor() {
    if (!nome || !email) {
      alert("Preencha nome e email.");
      return;
    }

    const novoFornecedor = {
      nome,
      email,
      telefone,
    };

    setFornecedores([...fornecedores, novoFornecedor]);

    setNome("");
    setEmail("");
    setTelefone("");

    alert("Fornecedor cadastrado!");
  }

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>LICITA AI</h1>

      <h2>Cadastro de Fornecedores</h2>

      <p>Nome:</p>
      <input
        value={nome}
        onChange={(e) => setNome(e.target.value)}
        style={{ width: "300px" }}
      />

      <p>Email:</p>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        style={{ width: "300px" }}
      />

      <p>Telefone:</p>
      <input
        value={telefone}
        onChange={(e) => setTelefone(e.target.value)}
        style={{ width: "300px" }}
      />

      <br />
      <br />

      <button onClick={salvarFornecedor}>
        Salvar Fornecedor
      </button>

      <hr />

      <h2>Fornecedores Cadastrados</h2>

      {fornecedores.map((f, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ccc",
            padding: "10px",
            marginBottom: "10px",
          }}
        >
          <strong>{f.nome}</strong>
          <br />
          {f.email}
          <br />
          {f.telefone}
        </div>
      ))}
    </div>
  );
}

export default App;