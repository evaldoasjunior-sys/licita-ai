import { useState } from "react";

function Especialidades() {
  const [fornecedor, setFornecedor] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [fabricante, setFabricante] = useState("");
  const [categoria, setCategoria] = useState("");
  const [fornecedores, setFornecedores] = useState([]);

  function adicionarEspecialidade() {
    if (!fornecedor || !fabricante || !categoria) {
      alert("Preencha fornecedor, fabricante e categoria.");
      return;
    }

    const novaEspecialidade = {
      fabricante,
      categoria,
    };

    const fornecedorExistente = fornecedores.find(
      (f) => f.nome.toUpperCase() === fornecedor.toUpperCase()
    );

    if (fornecedorExistente) {
      const atualizados = fornecedores.map((f) => {
        if (f.nome.toUpperCase() === fornecedor.toUpperCase()) {
          return {
            ...f,
            email: email || f.email,
            telefone: telefone || f.telefone,
            especialidades: [...f.especialidades, novaEspecialidade],
          };
        }

        return f;
      });

      setFornecedores(atualizados);
    } else {
      const novoFornecedor = {
        nome: fornecedor,
        email,
        telefone,
        especialidades: [novaEspecialidade],
      };

      setFornecedores([...fornecedores, novoFornecedor]);
    }

    setFabricante("");
    setCategoria("");

    alert("Especialidade adicionada!");
  }

  return (
    <div>
      <h2>Base de Conhecimento Comercial</h2>

      <p>Fornecedor:</p>
      <input
        value={fornecedor}
        onChange={(e) => setFornecedor(e.target.value)}
      />

      <p>Email:</p>
      <input value={email} onChange={(e) => setEmail(e.target.value)} />

      <p>Telefone:</p>
      <input value={telefone} onChange={(e) => setTelefone(e.target.value)} />

      <p>Fabricante:</p>
      <input
        value={fabricante}
        onChange={(e) => setFabricante(e.target.value)}
      />

      <p>Categoria:</p>
      <input
        value={categoria}
        onChange={(e) => setCategoria(e.target.value)}
      />

      <br />
      <br />

      <button onClick={adicionarEspecialidade}>
        Adicionar Especialidade
      </button>

      <hr />

      <h3>Fornecedores cadastrados</h3>

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

          <h4>Especialidades</h4>

          <ul>
            {f.especialidades.map((esp, i) => (
              <li key={i}>
                {esp.fabricante} | {esp.categoria}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

export default Especialidades;