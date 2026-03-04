// ============================
// Simulador Electoral - Paso 2
// Mapa + selección única + resultados textuales (23J base)
// Datos electorales cargados desde JSON
// ============================

const statusEl = document.getElementById("status");
const provNameEl = document.getElementById("prov-name");
const provCodeEl = document.getElementById("prov-code");
const provPopulationEl = document.getElementById("prov-population");
const provTotalSeatsEl = document.getElementById("prov-total-seats");
const electionResultsTextEl = document.getElementById("election-results-text");

// Datos electorales cargados desde /data
let elections2023Data = {};

// Selección única
let selectedProvince = null; // { key, layer, feature }

// Capa GeoJSON
let geojsonLayer = null;

// Paleta fija para colores deterministas por provincia
const provinceColorPalette = [
  "#ef4444", // rojo
  "#f59e0b", // ámbar
  "#10b981", // verde
  "#3b82f6", // azul
  "#8b5cf6", // violeta
  "#ec4899", // rosa
  "#14b8a6", // turquesa
  "#f97316", // naranja
  "#84cc16", // lima
  "#6366f1", // índigo
  "#06b6d4", // cian
  "#a855f7"  // púrpura
];

// ----------------------------
// Utilidades
// ----------------------------
function fmtInt(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("es-ES").format(n);
}

function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function getProvinceKeyFromFeature(feature) {
  const code = feature?.properties?.cod_prov;
  if (code === undefined || code === null) return null;
  return String(code).padStart(2, "0");
}

// Color SIEMPRE igual para la misma provincia (por ID/código)
function getDeterministicProvinceColor(provinceKey) {
  // Si es numérico (cod_prov), usamos módulo directo
  const numeric = Number(provinceKey);
  if (!Number.isNaN(numeric)) {
    return provinceColorPalette[numeric % provinceColorPalette.length];
  }

  // Fallback hash para claves no numéricas
  let hash = 0;
  for (let i = 0; i < provinceKey.length; i++) {
    hash = ((hash << 5) - hash) + provinceKey.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % provinceColorPalette.length;
  return provinceColorPalette[idx];
}

function getElectionDataForFeature(feature) {
  const key = getProvinceKeyFromFeature(feature);
  if (!key) return null;
  return elections2023Data[key] || null;
}

// ----------------------------
// Renderizado de info textual
// ----------------------------
function clearProvinceInfo(message = "Selecciona una provincia para ver resultados.") {
  provNameEl.textContent = "—";
  provCodeEl.textContent = "—";
  provPopulationEl.textContent = "—";
  provTotalSeatsEl.textContent = "—";
  electionResultsTextEl.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function clearElectionPanel(message = "Sin datos.") {
  provPopulationEl.textContent = "—";
  provTotalSeatsEl.textContent = "—";
  electionResultsTextEl.innerHTML = `<p>${escapeHtml(message)}</p>`;
}

function renderElectionData(feature) {
  const data = getElectionDataForFeature(feature);

  if (!data) {
    clearElectionPanel("No hay datos cargados para esta provincia todavía.");
    return;
  }

  provPopulationEl.textContent = fmtInt(data.population);
  provTotalSeatsEl.textContent = fmtInt(data.totalSeats);

  const parties = [...(data.parties || [])].sort((a, b) => (b.votes || 0) - (a.votes || 0));
  const top6 = parties.slice(0, 6);

  const totalVotesShown = top6.reduce((acc, p) => acc + (Number(p.votes) || 0), 0);
  const totalSeatsShown = top6.reduce((acc, p) => acc + (Number(p.seats) || 0), 0);

  const rows = top6.map((p, idx) => {
    const votes = Number(p.votes) || 0;
    const seats = Number(p.seats) || 0;
    const pctShown = totalVotesShown > 0 ? ((votes / totalVotesShown) * 100).toFixed(2) : "0.00";

    return `
      <tr>
        <td>${idx + 1}</td>
        <td><strong>${escapeHtml(p.name || p.id || "Lista")}</strong></td>
        <td>${fmtInt(votes)}</td>
        <td>${pctShown}%</td>
        <td>${fmtInt(seats)}</td>
      </tr>
    `;
  }).join("");

  const seatBreakdown = top6
    .filter(p => (Number(p.seats) || 0) > 0)
    .map(p => `${escapeHtml(p.name || p.id || "Lista")}: ${fmtInt(Number(p.seats) || 0)}`)
    .join(" · ");

  electionResultsTextEl.innerHTML = `
    <p><strong>Fuente base de simulación:</strong> datos precargados en <code>data/elections-2023-provinces.json</code>.</p>

    <table class="results-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Lista</th>
          <th>Votos</th>
          <th>% (sobre top 6)</th>
          <th>Escaños</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="5">No hay partidos para mostrar.</td></tr>`}
      </tbody>
    </table>

    <p style="margin-top:10px;">
      <strong>Reparto (top 6):</strong> ${seatBreakdown || "Sin escaños"}<br>
      <strong>Total escaños circunscripción:</strong> ${fmtInt(data.totalSeats)}<br>
      <strong>Escaños mostrados (top 6):</strong> ${fmtInt(totalSeatsShown)}
    </p>
  `;
}

function updateInfo(feature) {
  const props = feature.properties || {};
  provNameEl.textContent = props.name || "Sin nombre";
  provCodeEl.textContent = props.cod_prov ? String(props.cod_prov).padStart(2, "0") : "—";
  renderElectionData(feature);
}

// ----------------------------
// Carga de datos electorales (JSON)
// ----------------------------
async function loadElectionData() {
  const dataPath = "data/elections-2023-provinces.json";
  console.log("Cargando datos electorales desde:", new URL(dataPath, window.location.href).href);

  const response = await fetch(dataPath);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al cargar datos electorales en ruta: ${dataPath}`);
  }

  const json = await response.json();

  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error("El JSON electoral no tiene un formato válido (se esperaba un objeto por provincias).");
  }

  elections2023Data = json;
  return elections2023Data;
}

// ----------------------------
// Mapa Leaflet
// ----------------------------
const map = L.map("map", {
  zoomControl: true,
  minZoom: 4,
  maxZoom: 10
});

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  attribution: "&copy; OpenStreetMap contributors"
}).addTo(map);

map.setView([40.2, -3.5], 5);

function defaultStyle() {
  return {
    color: "#334155",
    weight: 1,
    opacity: 1,
    fillColor: "#93c5fd",
    fillOpacity: 0.55
  };
}

function hoverStyle() {
  return {
    weight: 2,
    color: "#0f172a",
    fillOpacity: 0.8
  };
}

function selectedStyle(fillColor) {
  return {
    weight: 2.5,
    color: "#111827",
    fillColor,
    fillOpacity: 0.85
  };
}

function deselectCurrentProvince() {
  if (!selectedProvince || !geojsonLayer) return;

  geojsonLayer.resetStyle(selectedProvince.layer);
  selectedProvince = null;
}

function onEachProvince(feature, layer) {
  const name = feature.properties?.name || "Provincia";
  const provinceKey = getProvinceKeyFromFeature(feature) || name;

  layer.bindTooltip(name, {
    sticky: true,
    direction: "top",
    className: "prov-tooltip"
  });

  layer.on({
    mouseover: (e) => {
      const layerHovered = e.target;

      // Hover solo si no es la seleccionada actual
      if (!selectedProvince || selectedProvince.key !== provinceKey) {
        layerHovered.setStyle(hoverStyle());
      }

      layerHovered.bringToFront();
    },

    mouseout: (e) => {
      const layerOut = e.target;

      // Si NO es la seleccionada, vuelve al estilo base
      if (!selectedProvince || selectedProvince.key !== provinceKey) {
        geojsonLayer.resetStyle(layerOut);
      }
    },

    click: (e) => {
      const clickedLayer = e.target;
      const isSameSelected = selectedProvince && selectedProvince.key === provinceKey;

      // Si haces click en la misma provincia, la deseleccionas
      if (isSameSelected) {
        deselectCurrentProvince();
        clearProvinceInfo("Provincia deseleccionada.");
        statusEl.textContent = `Deseleccionada: ${name}.`;
        return;
      }

      // Selección única: deselecciona la anterior
      deselectCurrentProvince();

      // Selecciona la nueva con color determinista por ID
      const fillColor = getDeterministicProvinceColor(provinceKey);
      clickedLayer.setStyle(selectedStyle(fillColor));

      selectedProvince = {
        key: provinceKey,
        layer: clickedLayer,
        feature
      };

      updateInfo(feature);
      statusEl.textContent = `Seleccionada: ${name} (color fijo por ID: ${fillColor}).`;
    }
  });
}

async function loadProvinces() {
  const geojsonPath = "assets/spain-provinces.geojson";
  console.log("Cargando GeoJSON desde:", new URL(geojsonPath, window.location.href).href);

  const response = await fetch(geojsonPath);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} al cargar GeoJSON en ruta: ${geojsonPath}`);
  }

  const geojson = await response.json();

  geojsonLayer = L.geoJSON(geojson, {
    style: defaultStyle,
    onEachFeature: onEachProvince
  }).addTo(map);

  map.fitBounds(geojsonLayer.getBounds(), { padding: [20, 20] });

  return geojson;
}

// ----------------------------
// Inicialización de la app
// ----------------------------
async function init() {
  try {
    clearProvinceInfo();
    statusEl.textContent = "Cargando datos electorales...";
    await loadElectionData();

    statusEl.textContent = "Cargando mapa de provincias...";
    const geojson = await loadProvinces();

    const numProvincesWithData = Object.keys(elections2023Data).length;
    statusEl.textContent =
      `Listo. Mapa cargado (${geojson.features?.length ?? "?"} entidades) y datos electorales disponibles para ${numProvincesWithData} provincias.`;
  } catch (err) {
    console.error(err);
    statusEl.textContent = `Error de inicialización: ${err.message}`;
  }
}

init();