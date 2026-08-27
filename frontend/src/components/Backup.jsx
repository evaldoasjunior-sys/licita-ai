import { useEffect, useState } from "react";
import { backendApi } from "../services/backendApi";
import { backupService } from "../services/dataServices";

function nomeDoBackup() {
  const data = new Date().toISOString().slice(0, 10);
  return `backup-licita-ai-${data}.json`;
}

function nomeDoBackupAutomatico(motivo) {
  const dataHora = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `backup-automatico-${motivo}-${dataHora}.json`;
}

function baixarBackup(dados, nomeArquivo = nomeDoBackup()) {
  const arquivo = new Blob([JSON.stringify(dados, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(arquivo);
  const link = document.createElement("a");

  link.href = url;
  link.download = nomeArquivo;
  link.click();

  URL.revokeObjectURL(url);
}

function baixarBackupLocalAutomatico(motivo) {
  baixarBackup(backupService.export(), nomeDoBackupAutomatico(motivo));
}

async function baixarBackupSqliteAutomatico(motivo) {
  const resultado = await backendApi.exportBackup();
  baixarBackup(resultado.data, nomeDoBackupAutomatico(motivo));
}

function resumoLocal() {
  const backup = backupService.export();

  return {
    opportunities: backup.opportunities.length,
    items: backup.opportunities.reduce((total, opportunity) => total + opportunity.items.length, 0),
    suppliers: backup.suppliers.length,
    quotations: backup.quotations.length,
    proposals: backup.proposals.length,
  };
}

function Backup() {
  const [mensagem, setMensagem] = useState("");
  const [confirmacaoLimpeza, setConfirmacaoLimpeza] = useState("");
  const [metricas, setMetricas] = useState(() => backupService.summary());
  const [resumoBackend, setResumoBackend] = useState(null);
  const [sincronizandoBackend, setSincronizandoBackend] = useState(false);
  const [diagnosticoSistema, setDiagnosticoSistema] = useState([]);
  const [comparativoBases, setComparativoBases] = useState([]);
  const resumoLocalAtual = resumoLocal();

  useEffect(() => {
    let ativo = true;

    backendApi
      .summary()
      .then((resultado) => {
        if (ativo) {
          setResumoBackend(resultado.data);
        }
      })
      .catch(() => {
        if (ativo) {
          setResumoBackend(null);
        }
      });

    return () => {
      ativo = false;
    };
  }, []);

  function atualizarResumo() {
    setMetricas(backupService.summary());
  }

  function exportarBackup() {
    baixarBackup(backupService.export());
    setMensagem("Backup exportado. Guarde o arquivo em local seguro.");
  }

  function importarBackup(event) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    const confirmar = window.confirm(
      "Importar este backup vai substituir os dados atuais do navegador. Deseja continuar?"
    );
    if (!confirmar) {
      event.target.value = "";
      return;
    }

    baixarBackupLocalAutomatico("antes-importacao");

    const leitor = new FileReader();

    leitor.onload = function (e) {
      try {
        const dados = JSON.parse(e.target.result);

        if (!dados || !Array.isArray(dados.opportunities)) {
          throw new Error("Formato invalido.");
        }

        backupService.import(dados);
        atualizarResumo();
        setMensagem("Backup importado com sucesso. As telas ja podem ser usadas com os dados restaurados.");
      } catch {
        setMensagem("Erro ao importar backup. Verifique se o arquivo JSON e valido.");
      } finally {
        event.target.value = "";
      }
    };

    leitor.readAsText(arquivo);
  }

  function limparDados() {
    if (confirmacaoLimpeza !== "LIMPAR") {
      setMensagem("Digite LIMPAR para confirmar a limpeza dos dados de teste.");
      return;
    }

    const confirmar = window.confirm("Esta acao vai remover todos os dados locais. Deseja continuar?");
    if (!confirmar) return;

    baixarBackupLocalAutomatico("antes-limpeza");

    backupService.clear();
    setConfirmacaoLimpeza("");
    atualizarResumo();
    setMensagem("Dados locais removidos.");
  }

  async function consultarBackend() {
    setSincronizandoBackend(true);
    try {
      const resultado = await backendApi.summary();
      setResumoBackend(resultado.data);
      setMensagem("Resumo do banco SQLite consultado com sucesso.");
    } catch {
      setMensagem("Nao foi possivel conectar ao backend. Verifique se o servidor da API esta ligado.");
    } finally {
      setSincronizandoBackend(false);
    }
  }

  async function enviarParaBackend() {
    const confirmar = window.confirm(
      "Enviar o backup local atual para o banco SQLite? Os dados atuais do backend serao substituidos."
    );
    if (!confirmar) return;

    setSincronizandoBackend(true);
    try {
      await baixarBackupSqliteAutomatico("antes-substituir-sqlite");
      const resultado = await backendApi.importBackup(backupService.export());
      setResumoBackend(resultado.data);
      setMensagem("Backup enviado para o banco SQLite com sucesso.");
    } catch {
      setMensagem("Nao foi possivel enviar o backup. Verifique se o servidor da API esta ligado.");
    } finally {
      setSincronizandoBackend(false);
    }
  }

  async function carregarDoBackend() {
    const confirmar = window.confirm(
      "Carregar os dados do SQLite para este navegador? Os dados locais atuais serao substituidos."
    );
    if (!confirmar) return;

    setSincronizandoBackend(true);
    try {
      const resultado = await backendApi.exportBackup();
      baixarBackupLocalAutomatico("antes-carregar-sqlite");
      backupService.import(resultado.data);
      atualizarResumo();
      setResumoBackend({
        opportunities: resultado.data.opportunities.length,
        items: resultado.data.opportunities.reduce((total, opportunity) => total + opportunity.items.length, 0),
        suppliers: resultado.data.suppliers.length,
        quotations: resultado.data.quotations.length,
        proposals: resultado.data.proposals.length,
      });
      setMensagem("Dados do SQLite carregados para o navegador com sucesso.");
    } catch {
      setMensagem("Nao foi possivel carregar os dados do SQLite. Verifique se o servidor da API esta ligado.");
    } finally {
      setSincronizandoBackend(false);
    }
  }

  async function exportarBackupBackend() {
    setSincronizandoBackend(true);
    try {
      const resultado = await backendApi.exportBackup();
      baixarBackup(resultado.data, nomeDoBackup().replace("backup-licita-ai", "backup-sqlite-licita-ai"));
      setMensagem("Backup do banco SQLite exportado com sucesso.");
    } catch {
      setMensagem("Nao foi possivel exportar o backup do SQLite. Verifique se o servidor da API esta ligado.");
    } finally {
      setSincronizandoBackend(false);
    }
  }

  async function verificarSistema() {
    setSincronizandoBackend(true);
    const resultados = [];

    try {
      await backendApi.health();
      resultados.push(["Backend", "OK", "API respondeu ao health check."]);
    } catch {
      resultados.push(["Backend", "Erro", "API nao respondeu. Verifique se o backend esta ligado."]);
      setDiagnosticoSistema(resultados);
      setMensagem("Diagnostico concluido com erro no backend.");
      setSincronizandoBackend(false);
      return;
    }

    try {
      const resumo = await backendApi.summary();
      setResumoBackend(resumo.data);
      resultados.push([
        "Resumo SQLite",
        "OK",
        `${resumo.data.opportunities} oportunidade(s), ${resumo.data.suppliers} fornecedor(es), ${resumo.data.quotations} cotacao(oes), ${resumo.data.proposals} proposta(s).`,
      ]);
    } catch {
      resultados.push(["Resumo SQLite", "Erro", "Nao foi possivel consultar o resumo do banco."]);
    }

    try {
      const backup = await backendApi.exportBackup();
      const totalRegistros =
        backup.data.opportunities.length +
        backup.data.suppliers.length +
        backup.data.quotations.length +
        backup.data.proposals.length;
      resultados.push(["Exportacao SQLite", "OK", `Backup do SQLite disponivel com ${totalRegistros} registro(s).`]);
    } catch {
      resultados.push(["Exportacao SQLite", "Erro", "Nao foi possivel gerar backup a partir do SQLite."]);
    }

    setDiagnosticoSistema(resultados);
    setMensagem("Diagnostico do sistema concluido.");
    setSincronizandoBackend(false);
  }

  async function compararBases() {
    setSincronizandoBackend(true);
    try {
      const [resumoSqlite, backupSqlite] = await Promise.all([
        backendApi.summary(),
        backendApi.exportBackup(),
      ]);
      const local = resumoLocal();
      const sqlite = {
        opportunities: backupSqlite.data.opportunities.length,
        items: backupSqlite.data.opportunities.reduce((total, opportunity) => total + opportunity.items.length, 0),
        suppliers: backupSqlite.data.suppliers.length,
        quotations: backupSqlite.data.quotations.length,
        proposals: backupSqlite.data.proposals.length,
      };

      setResumoBackend(resumoSqlite.data);
      setComparativoBases([
        ["Oportunidades", local.opportunities, sqlite.opportunities],
        ["Itens", local.items, sqlite.items],
        ["Fornecedores", local.suppliers, sqlite.suppliers],
        ["Cotacoes", local.quotations, sqlite.quotations],
        ["Propostas", local.proposals, sqlite.proposals],
      ]);
      setMensagem("Comparativo entre navegador local e SQLite concluido.");
    } catch {
      setMensagem("Nao foi possivel comparar as bases. Verifique se o backend esta ligado.");
    } finally {
      setSincronizandoBackend(false);
    }
  }

  return (
    <div>
      <h2>Dados e backup</h2>
      <p>Use esta tela para proteger a base local antes de testes, ajustes ou futuras migracoes.</p>

      <section className="dashboard-grid data-summary-grid">
        {metricas.map(([label, value]) => (
          <div className="dashboard-metric" key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </section>

      <section className="storage-overview">
        <div className="storage-card">
          <div>
            <h3>Navegador local</h3>
            <p>Dados em uso imediato nesta tela quando o backend nao esta conectado.</p>
          </div>
          <dl>
            <div>
              <dt>Oportunidades</dt>
              <dd>{resumoLocalAtual.opportunities}</dd>
            </div>
            <div>
              <dt>Itens</dt>
              <dd>{resumoLocalAtual.items}</dd>
            </div>
            <div>
              <dt>Fornecedores</dt>
              <dd>{resumoLocalAtual.suppliers}</dd>
            </div>
            <div>
              <dt>Cotacoes</dt>
              <dd>{resumoLocalAtual.quotations}</dd>
            </div>
            <div>
              <dt>Propostas</dt>
              <dd>{resumoLocalAtual.proposals}</dd>
            </div>
          </dl>
        </div>

        <div className="storage-card storage-card-sqlite">
          <div>
            <h3>Banco SQLite</h3>
            <p>Base persistente usada pelo backend. Consulte antes de substituir ou carregar dados.</p>
          </div>
          {resumoBackend ? (
            <dl>
              <div>
                <dt>Oportunidades</dt>
                <dd>{resumoBackend.opportunities}</dd>
              </div>
              <div>
                <dt>Itens</dt>
                <dd>{resumoBackend.items}</dd>
              </div>
              <div>
                <dt>Fornecedores</dt>
                <dd>{resumoBackend.suppliers}</dd>
              </div>
              <div>
                <dt>Cotacoes</dt>
                <dd>{resumoBackend.quotations}</dd>
              </div>
              <div>
                <dt>Propostas</dt>
                <dd>{resumoBackend.proposals}</dd>
              </div>
            </dl>
          ) : (
            <p className="storage-empty">SQLite ainda nao consultado ou backend indisponivel.</p>
          )}
        </div>
      </section>

      {mensagem && <p className="import-message">{mensagem}</p>}

      <section className="data-actions-grid">
        <div className="supplier-panel">
          <h3>Exportar backup</h3>
          <p>Baixa um arquivo JSON com oportunidades, fornecedores, cotacoes, propostas e historico.</p>
          <button onClick={exportarBackup} title="Baixa um arquivo JSON com os dados locais deste navegador.">Exportar backup</button>
        </div>

        <div className="supplier-panel">
          <h3>Importar backup</h3>
          <p>Restaura os dados a partir de um arquivo JSON. Antes de substituir, baixa um backup automatico local.</p>
          <input accept=".json,application/json" onChange={importarBackup} type="file" />
        </div>

        <div className="supplier-panel">
          <h3>Banco SQLite</h3>
          <p>Sincronize as bases somente depois de conferir os totais acima. Antes de substituir o SQLite, baixa um backup automatico do banco.</p>
          <div className="panel-actions backend-actions">
            <button disabled={sincronizandoBackend} onClick={enviarParaBackend} title="Baixa um backup automatico do SQLite e depois envia os dados locais do navegador para o banco.">
              Enviar para SQLite
            </button>
            <button disabled={sincronizandoBackend} onClick={carregarDoBackend} title="Baixa um backup automatico local e substitui os dados do navegador pelos dados gravados no SQLite.">
              Carregar do SQLite
            </button>
            <button disabled={sincronizandoBackend} onClick={exportarBackupBackend} title="Baixa um arquivo JSON gerado diretamente a partir do SQLite.">
              Exportar SQLite
            </button>
            <button disabled={sincronizandoBackend} onClick={consultarBackend} title="Consulta a quantidade de registros atualmente gravados no SQLite.">
              Consultar banco
            </button>
          </div>
          {resumoBackend && (
            <dl className="backend-summary">
              <div>
                <dt>Oportunidades</dt>
                <dd>{resumoBackend.opportunities}</dd>
              </div>
              <div>
                <dt>Itens</dt>
                <dd>{resumoBackend.items}</dd>
              </div>
              <div>
                <dt>Fornecedores</dt>
                <dd>{resumoBackend.suppliers}</dd>
              </div>
              <div>
                <dt>Cotacoes</dt>
                <dd>{resumoBackend.quotations}</dd>
              </div>
              <div>
                <dt>Propostas</dt>
                <dd>{resumoBackend.proposals}</dd>
              </div>
            </dl>
          )}
        </div>

        <div className="supplier-panel">
          <h3>Diagnostico</h3>
          <p>Verifica rapidamente se o backend, o resumo e a exportacao do SQLite estao funcionando.</p>
          <button disabled={sincronizandoBackend} onClick={verificarSistema} title="Testa a conexao com o backend, consulta o resumo e valida a exportacao do SQLite.">
            Verificar sistema
          </button>
          <button disabled={sincronizandoBackend} onClick={compararBases} title="Compara a quantidade de registros do navegador local com a quantidade gravada no SQLite.">
            Comparar bases
          </button>
          {diagnosticoSistema.length > 0 && (
            <dl className="diagnostic-list">
              {diagnosticoSistema.map(([nome, status, detalhe]) => (
                <div key={nome}>
                  <dt>
                    {nome} <strong className={status === "OK" ? "diagnostic-ok" : "diagnostic-error"}>{status}</strong>
                  </dt>
                  <dd>{detalhe}</dd>
                </div>
              ))}
            </dl>
          )}
          {comparativoBases.length > 0 && (
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>Base</th>
                  <th>Navegador</th>
                  <th>SQLite</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {comparativoBases.map(([nome, local, sqlite]) => (
                  <tr key={nome}>
                    <td>{nome}</td>
                    <td>{local}</td>
                    <td>{sqlite}</td>
                    <td className={local === sqlite ? "diagnostic-ok" : "diagnostic-error"}>
                      {local === sqlite ? "OK" : "Diferente"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="supplier-panel danger-panel">
          <h3>Limpar dados de teste</h3>
          <p>Remove todos os dados locais deste navegador. Antes de limpar, baixa um backup automatico.</p>
          <label>
            Digite LIMPAR
            <input
              value={confirmacaoLimpeza}
              onChange={(event) => setConfirmacaoLimpeza(event.target.value)}
            />
          </label>
          <button className="decline-button" onClick={limparDados} title="Remove todos os dados locais deste navegador apos confirmar com a palavra LIMPAR.">Limpar dados</button>
        </div>
      </section>
    </div>
  );
}

export default Backup;
