import { useEffect, useMemo, useRef, useState } from "react";
import "./RadarVerdeSection.css";
import truckImg from "../../assets/images/truck.png";
import sheetImg from "../../assets/images/sheet.png";
import MapaBrasil from "./MapaBrasil";
import "./MapaBrasil.css";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { fetchResiduos } from "../../services/api";

const API_BASE_URL = 'http://localhost:9090/api';
const META_RECICLAGEM = 85;

function formatarEstado(estado) {
  return estado?.trim().toUpperCase() || "N/D";
}

// Determina status com base na taxa de reciclagem vs meta
function calcularStatus(taxaReciclagem, meta) {
  const progresso = meta > 0 ? (taxaReciclagem / meta) * 100 : 0;
  if (progresso < 50) return "Crítica";
  if (progresso < 80) return "Atenção";
  if (progresso < 100) return "Monitoramento";
  return "Em dia";
}

function GaugeCircle({ value, meta }) {
  const r = 70;
  const circ = 2 * Math.PI * r;
  // progressDash: posição atual (valor em % do 0..100)
  const progressPercent = Math.max(0, Math.min(Number(value) || 0, 100));
  const progressDash = (progressPercent / 100) * circ;

  // metaDash: arco que representa a meta (meta em % do 0..100)
  const metaPercent = Math.max(0, Math.min(Number(meta) || 0, 100));
  const metaDash = (metaPercent / 100) * circ;

  return (
    <div className="gauge-wrapper">
      <svg viewBox="0 0 180 180" className="gauge-svg">
        <defs>
          <linearGradient id="circGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#7BCDC5" />
            <stop offset="100%" stopColor="#3E6763" />
          </linearGradient>
        </defs>
        {/* base track */}
        <circle cx="90" cy="90" r={r} fill="none" stroke="#e8f5f3" strokeWidth="13" />

        {/* meta arc: mostra onde está a meta (ex: 85%) como arco claro */}
        <circle
          cx="90" cy="90" r={r}
          fill="none"
          stroke="#bfeee7"
          strokeWidth="13"
          strokeDasharray={`${metaDash} ${circ - metaDash}`}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "90px 90px" }}
        />

        {/* progresso atual */}
        <circle
          cx="90" cy="90" r={r}
          fill="none"
          stroke="url(#circGrad)"
          strokeWidth="13"
          strokeDasharray={`${progressDash} ${circ - progressDash}`}
          strokeLinecap="round"
          style={{ transform: "rotate(-90deg)", transformOrigin: "90px 90px" }}
        />
        <text x="90" y="82" textAnchor="middle" dominantBaseline="middle" fontSize="38" fontWeight="700" fill="#3E6763" fontFamily="Poppins, sans-serif">
          {value}%
        </text>
        <text x="90" y="108" textAnchor="middle" dominantBaseline="middle" fontSize="12" fill="#888" fontFamily="Poppins, sans-serif">
          ↗ Em evolução
        </text>
      </svg>
    </div>
  );
}

function RadarVerdeSection() {
  const [anoSelecionado, setAnoSelecionado] = useState(null);
  const [dadosEstados, setDadosEstados] = useState([]);
  const [loadingEstados, setLoadingEstados] = useState(true);
  const [erroEstados, setErroEstados] = useState(null);

  const [anoMedia, setAnoMedia] = useState(null);
  const [mediaEficiencia, setMediaEficiencia] = useState(0);
  const [loadingMedia, setLoadingMedia] = useState(true);
  const [erroMedia, setErroMedia] = useState(null);

  // Estados para Zonas de Atenção
  const metaFiltro = META_RECICLAGEM;
  const [dadosZonas, setDadosZonas] = useState([]);
  const [loadingZonas, setLoadingZonas] = useState(true);
  const [erroZonas, setErroZonas] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState("Todos");
  const [anosDisponiveis, setAnosDisponiveis] = useState([]);

  // Carregar anos disponíveis para os filtros
const primeiraCargaAnos = useRef(true);

useEffect(() => {
  let intervalId;

  async function carregarAnos() {
    try {
      const todos = await fetchResiduos();

      const anos = [...new Set(todos.map(r => Number(r.ano)))]
        .filter(Number.isFinite)
        .sort((a, b) => b - a)
        .slice(0, 3)
        .sort((a, b) => a - b);

      setAnosDisponiveis((prev) => {
        const iguais = JSON.stringify(prev) === JSON.stringify(anos);
        return iguais ? prev : anos;
      });

      // define apenas na primeira carga
      if (anos.length > 0 && primeiraCargaAnos.current) {
        setAnoSelecionado(anos[anos.length - 1]);
        primeiraCargaAnos.current = false;
      }

    } catch (e) {
      console.error("Erro ao carregar anos:", e);
    }
  }

  carregarAnos();

  intervalId = setInterval(carregarAnos, 10000);

  return () => clearInterval(intervalId);

}, []);

  // Carregar dados dos estados (ranking volume)
  useEffect(() => {
    async function carregarEstados() {
      setLoadingEstados(true);
      setErroEstados(null);
      try {
        const residuos = await fetchResiduos(anoSelecionado);

        const mapaEstados = residuos.reduce((map, registro) => {
          const estado = formatarEstado(registro.estado);
          const quantidade = Number(registro.quantidadeGerada) || 0;
          map[estado] = (map[estado] || 0) + quantidade;
          return map;
        }, {});

        const listaEstados = Object.entries(mapaEstados)
          .map(([estado, valor]) => ({ estado, valor }))
          .sort((a, b) => b.valor - a.valor);

        setDadosEstados(listaEstados);
      } catch (error) {
        setErroEstados(error.message || "Erro ao carregar dados");
      } finally {
        setLoadingEstados(false);
      }
    }

    carregarEstados();
  }, [anoSelecionado]);

  // Carregar média de eficiência
  useEffect(() => {
    async function carregarMedia() {
      setLoadingMedia(true);
      setErroMedia(null);
      try {
        const residuos = await fetchResiduos(anoMedia);
        const media = residuos.length > 0
          ? residuos.reduce((sum, reg) => sum + (Number(reg.taxaReciclagem) || 0), 0) / residuos.length
          : 0;
        setMediaEficiencia(Math.round(media));
      } catch (error) {
        setErroMedia(error.message || "Erro ao carregar média");
      } finally {
        setLoadingMedia(false);
      }
    }

    carregarMedia();
  }, [anoMedia]);

  // Carregar zonas de atenção do backend
const primeiraCarga = useRef(true);

useEffect(() => {
  let intervalId;

  async function carregarZonas() {
    if (primeiraCarga.current) {
      setLoadingZonas(true);
    }

    setErroZonas(null);

    try {
const data = await fetchResiduos(anoSelecionado);

      const zonas = data.map((registro) => {
        const status = calcularStatus(
          registro.taxaReciclagem,
          metaFiltro
        );

        const progresso =
          metaFiltro > 0
            ? Math.min(
                Math.round(
                  (registro.taxaReciclagem / metaFiltro) * 100
                ),
                100
              )
            : 0;

        let acao =
          "Manter ações e melhorar eficiência da coleta";

        if (status === "Crítica") {
          acao =
            "Priorizar infraestrutura e educação ambiental urgente";
        } else if (status === "Atenção") {
          acao =
            "Ampliar cobertura da coleta e parcerias locais";
        }

        return {
          id: registro.id,
          municipio: registro.municipio,
          estado: registro.estado,
          taxaReciclagem: registro.taxaReciclagem,
          quantidadeGerada: registro.quantidadeGerada,
          ano: registro.ano,
          status,
          progresso,
          acao,
        };
      });

      // Atualiza apenas se houver mudanças
      setDadosZonas((prev) => {
        const iguais =
          JSON.stringify(prev) === JSON.stringify(zonas);

        return iguais ? prev : zonas;
      });

    } catch (error) {
      setErroZonas(
        error.message || "Erro ao carregar zonas de atenção"
      );
    } finally {
      setLoadingZonas(false);
      primeiraCarga.current = false;
    }
  }

  // Primeira carga
  carregarZonas();

  // Atualização automática a cada 10 segundos
  intervalId = setInterval(() => {
    carregarZonas();
  }, 10000);

  function handleResiduosAtualizados() {
    carregarZonas();
  }

  window.addEventListener("residuosAtualizados", handleResiduosAtualizados);

  // Cleanup
  return () => {
    clearInterval(intervalId);
    window.removeEventListener("residuosAtualizados", handleResiduosAtualizados);
  };

}, [metaFiltro, anoSelecionado]);

  const dadosAtivos = useMemo(() => dadosEstados, [dadosEstados]);
  const totalVolume = Math.round(dadosAtivos.reduce((acc, d) => acc + d.valor, 0));
  const totalVolumeFormatado = totalVolume.toLocaleString("pt-BR");

  // Filtro por status nas zonas
  const dadosFiltrados = filtroStatus === "Todos"
    ? dadosZonas
    : dadosZonas.filter(d => d.status?.toLowerCase() === filtroStatus.toLowerCase());

  // Contadores para o Panorama Geral (baseado nos dados reais do backend)
  const contagem = {
    critica: dadosZonas.filter(d => d.status === "Crítica").length,
    atencao: dadosZonas.filter(d => d.status === "Atenção").length,
    monitoramento: dadosZonas.filter(d => d.status === "Monitoramento").length,
    emDia: dadosZonas.filter(d => d.status === "Em dia").length,
  };

  return (
    <section className="radar-section" id="radar-verde">

      <div className="radar-header">
        <h2 className="radarverde-title">radar verde</h2>
        <p className="radarverde-subtitle">Transformando indicadores em ações!</p>
      </div>

      {/* BLOCO 1 — Volume total */}
      <div id="radar-volume" className="radar-content">

        <div className="radar-left">
          <img src={truckImg} alt="Caminhão" className="radar-truck" />
          <div className="radar-volume-box">
            <span className="radar-volume-label">Volume total</span>
            <span className="radar-volume-number">
              {totalVolumeFormatado}
            </span>
            <span className="radar-volume-unit">toneladas</span>
          </div>
        </div>

        <div className="radar-chart-box">
          <div className="radar-chart-header">
            <span className="radar-chart-title">Ranking de Geração Estadual</span>
            <div className="radar-filters">
              <button
                className={`radar-filter-btn ${anoSelecionado === null ? "active" : ""}`}
                onClick={() => setAnoSelecionado(null)}
              >
                Todos
              </button>
              {anosDisponiveis.map((ano) => (
                <button
                  key={ano}
                  className={`radar-filter-btn ${anoSelecionado === ano ? "active" : ""}`}
                  onClick={() => setAnoSelecionado(ano)}
                >
                  {ano}
                </button>
              ))}
            </div>
          </div>

          <div className="ranking-container">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={dadosAtivos} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#72B7AE" />
                    <stop offset="100%" stopColor="#3E6763" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="estado" tick={{ fill: "#ccc", fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#ccc", fontSize: 13 }} tickFormatter={(value) => Math.round(value).toLocaleString("pt-BR")} axisLine={false} tickLine={false} />
                <Tooltip
                  contentStyle={{ background: "#2a1a4a", border: "none", borderRadius: 12, color: "white" }}
                  cursor={{ fill: "rgba(255,255,255,0.05)" }}
                  formatter={(value) => [Math.round(value).toLocaleString("pt-BR"), "Total (ton)"]}
                />
                <Bar dataKey="valor" fill="url(#barGradient)" radius={[8, 8, 0, 0]} label={{ position: "top", fill: "white", fontSize: 13, formatter: (value) => Math.round(value).toLocaleString("pt-BR") }} />
              </BarChart>
            </ResponsiveContainer>

            {loadingEstados && (
              <div className="ranking-overlay">
                <div className="spinner" />
              </div>
            )}

            {erroEstados && (
              <div className="ranking-overlay ranking-error-overlay">Erro ao carregar ranking</div>
            )}
          </div>
        </div>

      </div>

      {/* BLOCO 2 — Média de reciclagem */}
      <div id="radar-media" className="radar-content radar-media-row">

        <div className="radar-media-left">
          <img src={sheetImg} alt="Folha" className="radar-sheet" />
          <div className="radar-media-left-content">
            <h3 className="radar-media-titulo">Média de eficiência</h3>
            <p className="radar-media-desc">
              <strong>Percentual médio</strong> de resíduos desviados de aterros sanitários.
            </p>
          </div>
        </div>

        <div className="radar-media-card-branco">

          <div className="radar-media-topo">
            <span className="trending-up">
              <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#3E6763" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            </span>
          </div>

          {/* Botões de filtro de ano — estilo diferenciado para fundo branco */}
          <div className="radar-media-filtros-wrapper">
          <div className="radar-media-filtros-ano">
            <button
              className={`radar-filter-btn-dark ${anoMedia === null ? "active" : ""}`}
              onClick={() => setAnoMedia(null)}
            >
              Todos
            </button>
            {anosDisponiveis.map((ano) => (
              <button
                key={ano}
                className={`radar-filter-btn-dark ${anoMedia === ano ? "active" : ""}`}
                onClick={() => setAnoMedia(ano)}
              >
                {ano}
              </button>
            ))}
            </div>
          </div>

          <div className="radar-media-content">
            <div className="gauge-container">
              {/* Sempre mostra o gauge com o último valor conhecido para evitar flicker */}
              <GaugeCircle value={mediaEficiencia} meta={META_RECICLAGEM} />

              {/* Overlay de loading mantém o gauge visível por baixo */}
              {loadingMedia && (
                <div className="gauge-overlay gauge-loading-overlay">
                  <div className="spinner" />
                </div>
              )}

              {/* Overlay de erro exibido sobre o gauge sem remover o componente */}
              {erroMedia && (
                <div className="gauge-overlay gauge-error-overlay">{erroMedia}</div>
              )}
            </div>

            <div className="radar-meta-badge-dark">
              <span className="radar-meta-dot-green" />
              Meta anual: <strong>{META_RECICLAGEM}% de eficiência</strong>
            </div>
          </div>

        </div>

      </div>

      {/* BLOCO 3 — Zonas de Atenção (conectado ao backend) */}
      <div id="radar-zonas" className="radar-zonas-container">
        <div className="zonas-header-main">
          <h2 className="zonas-title">Zonas de atenção</h2>
          <p className="zonas-subtitle">Municípios classificados por status de reciclagem em relação à meta de {metaFiltro}%.</p>
        </div>

        <div className="zonas-layout-superior">
          {/* Legenda Lateral com filtro de meta */}
          <div className="zonas-legenda-box">
            {[
              { status: "Crítica", desc: "Abaixo de 50% da meta", cls: "critica" },
              { status: "Atenção", desc: "Entre 50% e 80% da meta", cls: "atencao" },
              { status: "Monitoramento", desc: "Entre 80% e 100% da meta", cls: "monitoramento" },
              { status: "Em dia", desc: "Meta atingida", cls: "emdia" }
            ].map(item => (
              <div className="legenda-item" key={item.cls}>
                <span className={`dot ${item.cls}`} />
                <div className="legenda-texto">
                  <strong>{item.status}</strong>
                  <span>{item.desc}</span>
                </div>
              </div>
            ))}

            {/* Filtro de meta */}
            <button className="btn-indicadores">
  Entenda os indicadores!
</button>
          </div>

          {/* Mapa Visual */}
          <div className="zonas-mapa-wrapper">
            <MapaBrasil
              ano={anoSelecionado}
              setAno={setAnoSelecionado}
              anos={anosDisponiveis}
              meta={META_RECICLAGEM}
            />
          </div>
        </div>

        {/* Panorama Geral com dados reais */}
        <div className="panorama-secao">
          <h3 className="sub-secao-title">Panorama geral</h3>
          {loadingZonas ? (
            <div className="novociclo-loading">Carregando dados...</div>
          ) : (
            <div className="panorama-grid">
              <div className="panorama-card bg-red">
                <div className="status-icon-circle">!</div>
                <div className="panorama-info">
                  <strong>{contagem.critica}</strong>
                  <span>Municípios críticos</span>
                </div>
              </div>
              <div className="panorama-card bg-orange">
                <div className="status-icon-circle">⚠</div>
                <div className="panorama-info">
                  <strong>{contagem.atencao}</strong>
                  <span>Em atenção</span>
                </div>
              </div>
              <div className="panorama-card bg-purple">
                <div className="status-icon-circle">Q</div>
                <div className="panorama-info">
                  <strong>{contagem.monitoramento}</strong>
                  <span>Monitoramento</span>
                </div>
              </div>
              <div className="panorama-card bg-green">
                <div className="status-icon-circle">✓</div>
                <div className="panorama-info">
                  <strong>{contagem.emDia}</strong>
                  <span>Em dia</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabela com Filtros e Progresso — dados reais do backend */}
        <div className="tabela-secao">
          <div className="tabela-header-flex">
            <div>
              <h3 className="sub-secao-title">Municípios em destaque</h3>
              {erroZonas && <p style={{ color: "#ff4d4d", fontSize: 14 }}>{erroZonas}</p>}
            </div>
            <div className="filtros-wrapper">
              <select
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="filtro-dropdown"
                value={filtroStatus}
              >
                <option value="Todos">Filtrar por Status</option>
                <option value="Crítica">Crítica</option>
                <option value="Atenção">Atenção</option>
                <option value="Monitoramento">Monitoramento</option>
                <option value="Em dia">Em dia</option>
              </select>
              <button className="btn-ver-todas" onClick={() => setFiltroStatus("Todos")}>
                Ver todos
              </button>
            </div>
          </div>

          {loadingZonas ? (
            <div className="novociclo-loading">Carregando municípios...</div>
          ) : dadosFiltrados.length === 0 ? (
            <p className="novociclo-vazio">
              {filtroStatus === "Todos"
                ? `Nenhum município encontrado.`
                : `Nenhum município com status "${filtroStatus}" encontrado.`}
            </p>
          ) : (
            <table className="radar-table">
              <thead>
                <tr>
                  <th>Município / Estado</th>
                  <th>Status</th>
                  <th>Progresso</th>
                  <th>Ação Recomendada</th>
                  <th>Taxa (%)</th>
                </tr>
              </thead>
              <tbody>
                {dadosFiltrados.map((item) => {
                  const statusCls = item.status
                    .toLowerCase()
                    .normalize("NFD")
                    .replace(/[\u0300-\u036f]/g, "")
                    .replace(/\s+/g, "");
                  return (
                    <tr key={item.id} className="tabela-row-card">
                      <td>
                        <div className="sub-nome">{item.municipio}</div>
                        <div className="sub-zona">{item.estado} · {item.ano}</div>
                      </td>
                      <td>
                        <span className={`badge-status ${statusCls}`}>{item.status}</span>
                      </td>
                      <td>
                        <div className="progress-container">
                          <span className="progress-label">{item.progresso}%</span>
                          <div className="progress-track">
                            <div
                              className={`progress-fill ${statusCls}`}
                              style={{ width: `${Math.min(item.progresso, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="acao-text">{item.acao}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: "#3E6763" }}>
                          {item.taxaReciclagem?.toFixed(1)}%
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </section>
  );
}

export default RadarVerdeSection;