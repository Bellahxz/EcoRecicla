import { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { fetchResiduos } from "../../services/api";

const statusColors = {
  "Crítica": "#ff4d4d",
  "Atenção": "#ffa500",
  "Monitoramento": "#a855f7",
  "Em dia": "#22c55e",
};

const DEFAULT_ANOS = [2020, 2021, 2022];
const STATES_GEOJSON_URL =
  "https://raw.githubusercontent.com/codeforamerica/click_that_hood/master/public/data/brazil-states.geojson";

function calcularStatus(taxaReciclagem, meta) {
  const progresso = meta > 0 ? (taxaReciclagem / meta) * 100 : 0;
  if (progresso < 50) return "Crítica";
  if (progresso < 80) return "Atenção";
  if (progresso < 100) return "Monitoramento";
  return "Em dia";
}

function getSigla(feature) {
  const p = feature.properties || {};
  return (
    p.UF || p.SIGLA || p.sigla || p.SIGLA_UF || p.cd_uf || p.cd_geocuf || ""
  )
    .toString()
    .trim()
    .toUpperCase();
}

function getNome(feature) {
  const p = feature.properties || {};
  return (
    p.name || p.NM_MUNICIPIO || p.NM_UF || p.nome || p.NAME || "Estado"
  ).toString();
}

export default function MapaBrasil({ ano, setAno, anos = [], meta = 85 }) {
  const svgRef = useRef(null);
  const [estadoMedia, setEstadoMedia] = useState({});
  const [tooltip, setTooltip] = useState({ visible: false, x: 0, y: 0, data: null });

  useEffect(() => {
    async function carregarEstados() {
      try {
        const registros = await fetchResiduos(ano);

        const agregados = registros.reduce((acc, registro) => {
          const estado = registro.estado?.toString().trim().toUpperCase();
          if (!estado) return acc;

          const taxa = Number(registro.taxaReciclagem) || 0;
          const item = acc[estado] || { somaTaxa: 0, quantidade: 0, totalMunicipios: 0 };

          item.somaTaxa += taxa;
          item.quantidade += 1;
          item.totalMunicipios += 1;
          acc[estado] = item;
          return acc;
        }, {});

        const resultado = Object.entries(agregados).reduce((map, [estado, data]) => {
          const media = data.quantidade > 0 ? data.somaTaxa / data.quantidade : 0;
          map[estado] = {
            estado,
            mediaTaxaReciclagem: media,
            status: calcularStatus(media, meta),
            totalMunicipios: data.totalMunicipios,
          };
          return map;
        }, {});

        setEstadoMedia(resultado);
      } catch (error) {
        console.error("Erro ao carregar médias de estados:", error);
        setEstadoMedia({});
      }
    }

    carregarEstados();
  }, [ano, meta]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const width = svgRef.current.clientWidth || 600;
    const height = 480;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    fetch(STATES_GEOJSON_URL)
      .then((r) => r.json())
      .then((geojson) => {
        const projection = d3.geoMercator().fitSize([width, height], geojson);
        const path = d3.geoPath().projection(projection);

        svg
          .selectAll(".mapa-estado")
          .data(geojson.features)
          .join("path")
          .attr("class", "mapa-estado")
          .attr("d", path)
          .attr("fill", (feature) => {
            const sigla = getSigla(feature);
            const info = estadoMedia[sigla];
            return info ? statusColors[info.status] : "#e0e0e0";
          })
          .attr("stroke", "#ffffff")
          .attr("stroke-width", 0.8)
          .style("cursor", "pointer")
          .style("transition", "all 0.2s")
          .on("mousemove", function (event, feature) {
            const sigla = getSigla(feature);
            const info = estadoMedia[sigla];
            const [x, y] = d3.pointer(event, svgRef.current);

            setTooltip({
              visible: true,
              x,
              y,
              data: info
                ? {
                    estado: sigla,
                    nome: getNome(feature),
                    status: info.status,
                    mediaTaxaReciclagem: info.mediaTaxaReciclagem,
                    totalMunicipios: info.totalMunicipios,
                  }
                : {
                    estado: sigla,
                    nome: getNome(feature),
                    status: "Sem dados",
                    mediaTaxaReciclagem: null,
                    totalMunicipios: 0,
                  },
            });

            d3.select(this).attr("opacity", 0.8).attr("stroke-width", 1.4).raise();
          })
          .on("mouseleave", function () {
            setTooltip({ visible: false, x: 0, y: 0, data: null });
            d3.select(this).attr("opacity", 1).attr("stroke-width", 0.8);
          });

      })
      .catch((error) => {
        console.error("Erro ao carregar GeoJSON do mapa:", error);
      });
  }, [estadoMedia, ano]);

  const listaAnos = anos.length > 0 ? anos : DEFAULT_ANOS;

  return (
    <div className="mapa-brasil-wrapper">
      <div className="mapa-brasil-filtros">
        {listaAnos.map((a) => (
          <button
            key={a}
            className={`mapa-ano-btn  ${ano === a ? "active" : ""}`}
            onClick={() => setAno(a)}
          >
            {a}
          </button>
        ))}
      </div>

      <div style={{ position: "relative" }}>
        <svg ref={svgRef} style={{ width: "100%", height: "auto", display: "block" }} />

        {tooltip.visible && tooltip.data && (
          <div
            className="mapa-tooltip"
            style={{ left: tooltip.x + 20, top: tooltip.y - 20 }}
          >
            <span className="tooltip-municipio">{tooltip.data.nome}</span>
            <div
              className="tooltip-status"
              style={{ color: statusColors[tooltip.data.status] || "#666" }}
            >
              <span style={{ fontSize: "18px" }}>•</span> {tooltip.data.status}
            </div>
            {tooltip.data.mediaTaxaReciclagem !== null ? (
              <div className="tooltip-ton">
                Média: {tooltip.data.mediaTaxaReciclagem.toFixed(1)}% ({tooltip.data.totalMunicipios} municípios)
              </div>
            ) : (
              <div className="tooltip-ton">Sem dados cadastrados</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}