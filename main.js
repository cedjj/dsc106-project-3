import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const files = [
  {label: '6 AM',  file: '1__11-05-2025_6am.csv'},
  {label: '7 AM',  file: '2__11-05-2025_7am.csv'},
  {label: '8 AM',  file: '3__11-05-2025_8am.csv'},
  {label: '9 AM',  file: '4__11-05-2025_9am.csv'},
  {label: '10 AM', file: '5__11-05-2025_10am.csv'},
  {label: '11 AM', file: '6__11-05-2025_11am.csv'},
  {label: '12 PM', file: '7__11-05-2025_12pm.csv'},
  {label: '1 PM',  file: '8__11-05-2025_1pm.csv'},
  {label: '2 PM',  file: '9__11-05-2025_2pm.csv'},
  {label: '3 PM',  file: '10__11-05-2025_3pm.csv'},
  {label: '4 PM',  file: '11__11-05-2025_4pm.csv'},
  {label: '5 PM',  file: '12__11-05-2025_5pm.csv'},
  {label: '6 PM',  file: '13__11-05-2025_6pm.csv'},
];

const CITIES = [
  {name: "Los Angeles", lon: -118.2426, lat: 34.0549},
  {name: "San Diego", lon: -117.1611, lat: 32.7157},
  {name: "San Jose", lon: -121.8863, lat: 37.3382},
  {name: "San Francisco", lon: -122.4194, lat: 37.7749},
  {name: "Sacramento", lon: -121.4944, lat: 38.5781},
];

const acmColor = d3.scaleOrdinal()
  .domain([0, 1, 2, 3])
  .range(["#f4d27a", "#f09b5d", "#e24e34", "#a11c2c"]);

let activeZoom = false;
const PANES = [];

const sharedZoom = d3.zoom()
  .scaleExtent([1, 12])
  .on("zoom", onZoom);

function onZoom(event) {
  if (activeZoom) return;
  activeZoom = true;
  const t = event.transform;
  PANES.forEach(pane => {
    pane.g.attr("transform", t);
    pane.svg.property("__zoom", t);
  });
  activeZoom = false;
}

let caFeature = null;
const csvCache = new Map();

const selectLeft  = d3.select("#selectLeft");
const selectRight = d3.select("#selectRight");

selectLeft.selectAll("option")
  .data(files).join("option")
  .attr("value", d => d.file)
  .text(d => d.label);

selectRight.selectAll("option")
  .data(files).join("option")
  .attr("value", d => d.file)
  .text(d => d.label);

selectLeft.property("value", files[0].file);
selectRight.property("value", files[1].file);

function createPane({ chartId, titleId }) {
  const width  = document.querySelector(`#${chartId}`).clientWidth;
  const height = document.querySelector(`#${chartId}`).clientHeight;

  const svg = d3.select(`#${chartId}`).append("svg")
    .attr("viewBox", [0, 0, width, height])
    .attr("width", "100%")
    .attr("height", "100%");

  const g = svg.append("g");
  const landLayer  = g.append("g");
  const pointLayer = g.append("g");
  const cityLayer  = g.append("g").attr("class", "city-layer");

  const tooltip = d3.select("body").append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  const projection = d3.geoMercator();
  const path = d3.geoPath(projection);

  function drawBasemap() {
    projection.fitSize([width, height], caFeature);

    const defs = svg.append("defs");
    const cp = defs.append("clipPath").attr("id", `${chartId}-clip`);
    cp.append("path").datum(caFeature).attr("d", path);
    pointLayer.attr("clip-path", `url(#${chartId}-clip)`);
    cityLayer.attr("clip-path", `url(#${chartId}-clip)`);

    landLayer.append("path")
      .datum(caFeature)
      .attr("fill", "none")
      .attr("stroke", "white")
      .attr("stroke-width", 4)
      .attr("d", path);

    landLayer.append("path")
      .datum(caFeature)
      .attr("class", "land")
      .attr("d", path);

    landLayer.append("path")
      .datum(caFeature)
      .attr("class", "coastline")
      .attr("d", path)
      .raise();

    svg.call(sharedZoom);

    sharedZoom
      .translateExtent([[0, 0], [width, height]])
      .extent([[0, 0], [width, height]]);

    drawCities(CITIES);
  }

  function drawCities(cities) {
    const data = cities.filter(c => Number.isFinite(c.lat) && Number.isFinite(c.lon));

    const dots = cityLayer.selectAll("circle.city")
      .data(data, d => d.name);

    dots.join(
      enter => enter.append("circle")
        .attr("class", "city")
        .attr("r", 3.5)
        .attr("cx", d => projection([d.lon, d.lat])[0])
        .attr("cy", d => projection([d.lon, d.lat])[1]),
      update => update
        .attr("cx", d => projection([d.lon, d.lat])[0])
        .attr("cy", d => projection([d.lon, d.lat])[1]),
      exit => exit.remove()
    );

    const labels = cityLayer.selectAll("text.city-label")
      .data(data, d => d.name);

    labels.join(
      enter => enter.append("text")
        .attr("class", "city-label")
        .attr("x", d => projection([d.lon, d.lat])[0] + 6)
        .attr("y", d => projection([d.lon, d.lat])[1] + 3)
        .text(d => d.name),
      update => update
        .attr("x", d => projection([d.lon, d.lat])[0] + 6)
        .attr("y", d => projection([d.lon, d.lat])[1] + 3),
      exit => exit.remove()
    );
  }

  function drawPoints(rows) {
    const clean = rows.filter(d => d.lon && d.lat && d.ACM !== undefined && d.ACM !== null);

    const circles = pointLayer.selectAll("circle.point")
      .data(clean, d => `${d.lon},${d.lat}`);

    circles.join(
      enter => enter.append("circle")
        .attr("class", "point")
        .attr("cx", d => projection([d.lon, d.lat])[0])
        .attr("cy", d => projection([d.lon, d.lat])[1])
        .attr("r", 3.5)
        .attr("fill", d => acmColor(d.ACM))
        .on("mouseenter", function (event, d) {
          d3.select(this).attr("stroke", "#111").attr("stroke-width", 1.1);
          tooltip.style("opacity", 1).html(`
            <div><strong>ACM:</strong> ${d.ACM}</div>
            <div><strong>Coords:</strong> (${d.lat}, ${d.lon})</div>
          `);
        })
        .on("mousemove", (event) => {
          tooltip.style("left", (event.pageX + 12) + "px")
                 .style("top",  (event.pageY + 12) + "px");
        })
        .on("mouseleave", function () {
          d3.select(this).attr("stroke-width", 0.3);
          tooltip.style("opacity", 0);
        }),
      update => update.attr("fill", d => acmColor(d.ACM)),
      exit => exit.remove()
    );
  }

  svg.on("dblclick", () => {
    PANES.forEach(p => p.svg.transition().duration(300)
      .call(sharedZoom.transform, d3.zoomIdentity));
  });

  const api = {
    svg, g, width, height, drawBasemap, drawPoints,
    setTitle(text) { d3.select(`#${titleId}`).text(`Hour: ${text}`); }
  };

  PANES.push(api);
  return api;
}


function renderSharedLegend() {
  const host = d3.select('#sharedLegend').html('');
  host.append('span').attr('class', 'title').text('ACM Category:');

  const labels = ['Clear', 'Probably Clear', 'Probably Cloudy', 'Cloudy'];

  acmColor.domain().forEach((k, i) => {
    const item = host.append('span').attr('class', 'item');
    item.append('span').attr('class', 'swatch').style('background', acmColor(k));
    item.append('span').text(labels[i]);
  });
}

const leftPane  = createPane({ chartId: "chartLeft",  titleId: "titleLeft" });
const rightPane = createPane({ chartId: "chartRight", titleId: "titleRight" });

renderSharedLegend();

d3.json("california.geojson").then(geo => {
  caFeature = geo.type === "FeatureCollection" ? geo.features[0] : geo;
  leftPane.drawBasemap();
  rightPane.drawBasemap();
  loadAndRender(selectLeft.property("value"), leftPane);
  loadAndRender(selectRight.property("value"), rightPane);
});

selectLeft.on("change", function() {
  loadAndRender(this.value, leftPane);
});
selectRight.on("change", function() {
  loadAndRender(this.value, rightPane);
});

function loadAndRender(file, pane) {
  const label = files.find(h => h.file === file)?.label ?? file;
  pane.setTitle(label);

  if (csvCache.has(file)) {
    pane.drawPoints(csvCache.get(file));
    return;
  }
  d3.csv(file, d3.autoType).then(rows => {
    csvCache.set(file, rows);
    pane.drawPoints(rows);
  }).catch(err => {
    console.error(`Failed to load ${file}`, err);
    alert(`Failed to load ${file}. Check filename and server.`);
  });
}
