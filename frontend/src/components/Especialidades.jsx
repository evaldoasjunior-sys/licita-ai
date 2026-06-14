import { useState } from "react";

function Especialidades() {
  const [fornecedor, setFornecedor] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [categoria, setCategoria] = useState("");
  const [especialidades, setEspecialidades] = useState([]);

  function adicionarEspecialidade() {
    if (!fornecedor || !fabricante || !categoria) {
      alert("Preencha fornecedor, fabricante e categoria.");
      return;
    }

    const nova = {
      fornecedor,
      email,
      telefone,
      fabricante,
      categoria,
    };

    setEspecialidades([...especialidades, nova]);

    setFabricante("");
    setCategoria("");

    alert("Especialidade adicionada!");
  }

  return (
    <div>
      <h2>Base de Conhecimento Comercial</h2>

      <p>Fornecedor:</p>
      <input value={fornecedor} onChange={(e) => setFornecedor(e.target.value)} />

      <p>Email:</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />

      <p>Telefone:</p>
      <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />

      <p>Fabricante:</p>
      <input value={fabricante} onChange={(e) => setFabricante(e.target.value)} />

      <p>Categoria:</p>
      <input value={categoria} onChange={(e) => setCategoria(e.target.value)} />

      <br />
      <br />

      <button onClick={adicionarEspecialidade}>Adicionar Especialidade</button>

      <hr />

      <h3>Especialidades cadastradas</h3>

      {especialidades.map((item, index) => (
        <div key={index} style={{ border: "1px solid #ccc", padding: "10px", marginBottom: "10px" }}>
          <strong>{item.fornecedor}</strong>
          <br />
          {item.email}
          <br />
          {item.telefone}
          <br />
          <strong>{item.fabricante}</strong> | {item.categoria}
        </div>
      ))}
    </div>
  );
}

export default Especialidades;