function Backup() {
  function exportarBackup() {
    const dados = {
      oportunidades: JSON.parse(localStorage.getItem("oportunidades") || "[]"),
      fornecedores: JSON.parse(localStorage.getItem("fornecedores") || "[]"),
      cotacoes: JSON.parse(localStorage.getItem("cotacoes") || "[]"),
    };

    const arquivo = new Blob([JSON.stringify(dados, null, 2)], {
      type: "application/json",
    });

    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");

    link.href = url;
    link.download = "backup-licita-ai.json";
    link.click();

    URL.revokeObjectURL(url);
  }

  function importarBackup(event) {
    const arquivo = event.target.files[0];

    if (!arquivo) return;

    const leitor = new FileReader();

    leitor.onload = function (e) {
      try {
        const dados = JSON.parse(e.target.result);

        localStorage.setItem(
          "oportunidades",
          JSON.stringify(dados.oportunidades || [])
        );

        localStorage.setItem(
          "fornecedores",
          JSON.stringify(dados.fornecedores || [])
        );

        localStorage.setItem(
          "cotacoes",
          JSON.stringify(dados.cotacoes || [])
        );

        alert("Backup importado com sucesso! Atualize a página com F5.");
      } catch (erro) {
        alert("Erro ao importar backup. Verifique se o arquivo é válido.");
      }
    };

    leitor.readAsText(arquivo);
  }

  return (
    <div>
      <h2>Backup e Restauração</h2>

      <p>Use esta tela para salvar uma cópia dos dados do LICITA AI.</p>

      <button onClick={exportarBackup}>Exportar Backup</button>

      <br />
      <br />

      <p>Importar backup:</p>
      <input type="file" accept=".json" onChange={importarBackup} />
    </div>
  );
}

export default Backup;