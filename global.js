import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import * as topojson from "https://cdn.jsdelivr.net/npm/topojson-client@3/+esm";

const width = 800;
const height = 500;

const svg = d3.select("body")
    .append("svg")
    .attr("id", "chart")
    .attr("width", width)
    .attr("height", height);

// dropdown menu
const dropdown = d3.select("body")
    .insert("select", "#chart")
    .attr("id", "dataSelector")
    .style("margin", "10px");

const files = [
    { name: "Cloud Data (6am)", file: "data/1__11-05-2025_6am.csv" } //,
    // { name: "Cloud Data (7am)", file: "data/2__11-05-2025_7am.csv" },
    // { name: "Cloud Data (8am)", file: "data/3__11-05-2025_8am.csv" },
    // { name: "Cloud Data (9am)", file: "data/4__11-05-2025_9am.csv" },
    // { name: "Cloud Data (10am)", file: "data/5__11-05-2025_10am.csv" },
    // { name: "Cloud Data (11am)", file: "data/6__11-05-2025_11am.csv" },
    // { name: "Cloud Data (12pm)", file: "data/7__11-05-2025_12pm.csv" },
    // { name: "Cloud Data (1pm)", file: "data/8__11-05-2025_1pm.csv" },
    // { name: "Cloud Data (2pm)", file: "data/9__11-05-2025_2pm.csv" },
    // { name: "Cloud Data (3pm)", file: "data/10__11-05-2025_3pm.csv" },
    // { name: "Cloud Data (4pm)", file: "data/11__11-05-2025_4pm.csv" },
    // { name: "Cloud Data (5pm)", file: "data/12__11-05-2025_5pm.csv" },
    // { name: "Cloud Data (6pm)", file: "data/13__11-05-2025_6pm.csv" }
];

dropdown.selectAll("option")
    .data(files)
    .enter()
    .append("option")
    .attr("value", d => d.file)
    .text(d => d.name);

  const us = await d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json");
  const states = topojson.feature(us, us.objects.states).features;

  const california = states.find(d => d.id === "06");

  const projection = d3.geoMercator()
    .fitSize([width, height], california);

  const path = d3.geoPath().projection(projection);

  svg.append("path")
    .datum(california)
    .attr("d", path)
    .attr("fill", "#e0e0e0")
    .attr("stroke", "#555")
    .attr("stroke-width", 0.8);

  // render function (for CSV)
  async function renderGraph(csvFile) {
    //TODO
  }

  // re-render
  dropdown.on("change", function() {
    const selectedFile = d3.select(this).property("value");
    renderGraph(selectedFile);
  });

  // initial render
  renderGraph(files[0].file);