import { useEffect, useState } from "react";
import Backup from "./components/Backup";
import CotacaoGeradas from "./components/CotacaoGeradas";
import Especialidades from "./components/Especialidades";
import HistoricoImportacoes from "./components/HistoricoImportacoes";
import Oportunidades from "./components/oportunidades";
import Painel from "./components/painel";
import Propostas from "./components/Propostas";
import { backendApi } from "./services/backendApi";
import { checkBackendAndSync } from "./services/backendConnection";
import { SYNC_QUEUE_CHANGE_EVENT } from "./services/syncQueue";
import "./App.css";

const telas = [
  ["painel", "Painel"],
  ["oportunidades", "Oportunidades"],
  ["historico-importacoes", "Historico de importacoes"],
  ["fornecedores", "Fornecedores"],
  ["cotacoes", "Cotacao"],
  ["propostas", "Propostas"],
  ["dados", "Dados"],
];

function App() {
  const [tela, setTela] = useState("painel");
  const [atalho, setAtalho] = useState(null);
  const [backendStatus, setBackendStatus] = useState("verificando");
  const [ultimaVerificacao, setUltimaVerificacao] = useState("");
  const [pendenciasSincronizacao, setPendenciasSincronizacao] = useState(() => backendApi.pendingSyncCount());
  const [revisaoSincronizacao, setRevisaoSincronizacao] = useState(0);

  async function consultarBackend() {
    const resultado = await checkBackendAndSync(backendApi);

    setBackendStatus(resultado.status);
    setPendenciasSincronizacao(resultado.sync.pending);
    setUltimaVerificacao(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));

    if (resultado.sync.synchronized > 0) {
      setRevisaoSincronizacao((atual) => atual + 1);
    }
  }

  function verificarBackend() {
    setBackendStatus("verificando");
    consultarBackend();
  }

  useEffect(() => {
    function atualizarPendencias() {
      setPendenciasSincronizacao(backendApi.pendingSyncCount());
    }

    const primeiraVerificacao = window.setTimeout(consultarBackend, 0);
    const intervalo = window.setInterval(consultarBackend, 30000);
    window.addEventListener(SYNC_QUEUE_CHANGE_EVENT, atualizarPendencias);

    return () => {
      window.clearTimeout(primeiraVerificacao);
      window.clearInterval(intervalo);
      window.removeEventListener(SYNC_QUEUE_CHANGE_EVENT, atualizarPendencias);
    };
  }, []);

  function navegarPara(telaDestino, destino = null) {
    setTela(telaDestino);
    setAtalho(destino);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>LICITA AI</h1>
          <p>MVP inicial: importar oportunidades do Word e manter a base de fornecedores.</p>
        </div>
        <div
          className={`system-status system-status-${backendStatus}`}
          title={
            backendStatus === "online"
              ? `Backend conectado. ${pendenciasSincronizacao} alteracao(oes) aguardando sincronizacao.`
              : backendStatus === "offline"
                ? "Backend indisponivel. O sistema continua usando os dados locais do navegador."
                : "Verificando conexao com o backend SQLite."
          }
        >
          <strong>{backendStatus === "online" ? "SQLite conectado" : backendStatus === "offline" ? "Modo local" : "Verificando"}</strong>
          <span>
            {backendStatus === "online" ? "Banco ativo" : backendStatus === "offline" ? "Navegador" : "Aguarde"}
            {pendenciasSincronizacao > 0 ? ` | ${pendenciasSincronizacao} pendente(s)` : ""}
            {ultimaVerificacao ? ` | ${ultimaVerificacao}` : ""}
          </span>
          <button onClick={verificarBackend} title="Verifica novamente se o backend SQLite esta conectado.">
            Atualizar
          </button>
        </div>
      </header>

      <section className="workflow-strip" aria-label="Fluxo principal">
        <span>Painel</span>
        <span>Arquivo Word</span>
        <span>Tabela de oportunidades</span>
        <span>Historico de importacoes</span>
        <span>Base de fornecedores</span>
        <span>Cotacoes geradas</span>
        <span>Propostas internas</span>
        <span>Backup</span>
      </section>

      <nav className="main-nav">
        {telas.map(([id, label]) => (
          <button
            className={tela === id ? "active" : ""}
            key={id}
            onClick={() => navegarPara(id)}
            title={`Abrir a tela ${label}.`}
          >
            {label}
          </button>
        ))}
      </nav>

      <hr />

      {tela === "painel" && <Painel backendStatus={backendStatus} onNavigate={navegarPara} syncRevision={revisaoSincronizacao} />}
      {tela === "oportunidades" && <Oportunidades backendStatus={backendStatus} syncRevision={revisaoSincronizacao} />}
      {tela === "historico-importacoes" && <HistoricoImportacoes backendStatus={backendStatus} syncRevision={revisaoSincronizacao} />}
      {tela === "fornecedores" && <Especialidades backendStatus={backendStatus} syncRevision={revisaoSincronizacao} />}
      {tela === "cotacoes" && <CotacaoGeradas atalho={atalho} backendStatus={backendStatus} syncRevision={revisaoSincronizacao} />}
      {tela === "propostas" && <Propostas atalho={atalho} backendStatus={backendStatus} syncRevision={revisaoSincronizacao} />}
      {tela === "dados" && <Backup />}
    </div>
  );
}

export default App;
