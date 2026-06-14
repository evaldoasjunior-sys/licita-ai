import { useState } from "react";
import Oportunidades from "./components/Oportunidades";
import Itens from "./components/Itens";
import Especialidades from "./components/Especialidades";
import Cotacoes from "./components/Cotacoes";
import HistoricoCotacoes from "./components/HistoricoCotacoes";

function App() {
  const [tela, setTela] = useState("oportunidades");

  return (
    <div style={{ padding: "20px", fontFamily: "Arial" }}>
      <h1>LICITA AI</h1>

      <button onClick={() => setTela("oportunidades")}>Oportunidades</button>
      <button onClick={() => setTela("itens")} style={{ marginLeft: "10px" }}>
        Itens</button>
      <button onClick={() => setTela("especialidades")} style={{ marginLeft: "10px" }}>
        Base Comercial</button>
      <button onClick={() => setTela("cotacoes")} style={{ marginLeft: "10px" }}>
        Cotações</button>
      <button onClick={() => setTela("historico")} style={{ marginLeft: "10px" }}>
        Histórico</button>
      <hr />

      {tela === "oportunidades" && <Oportunidades />}
      {tela === "itens" && <Itens />}
      {tela === "especialidades" && <Especialidades />}
      {tela === "cotacoes" && <Cotacoes />}
      {tela === "historico" && <HistoricoCotacoes />}
    </div>
  );
}

export default App;