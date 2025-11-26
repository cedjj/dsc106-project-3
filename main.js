const COUNTIES_GEOJSON = "data/ca_counties_wgs84.geojson";
const CLOUD_CSV = "data/cloud_cover_county_multiday.csv";

const timelineSvg = d3.select("#timeline-map-svg");
const compareLeftSvg = d3.select("#compare-left-map-svg");
const compareRightSvg = d3.select("#compare-right-map-svg");
const tooltip = d3.select("#tooltip");

const timelineSlider = d3.select("#timeline-slider");
const timelineLabel = d3.select("#timeline-label");

const leftSelect = d3.select("#compare-left-select");
const rightSelect = d3.select("#compare-right-select");

const legendTimeline = d3.select("#legend");
const legendCompare = d3.select("#legend-compare");
const modeTimelineBtn = d3.select("#mode-timeline-btn");
const modeCompareBtn = d3.select("#mode-compare-btn");
const timelineSection = d3.select("#timeline-mode");
const compareSection = d3.select("#compare-mode");
const timelineSelectedLabel = d3.select("#timeline-selected-label");
const compareLeftSelectedLabel = d3.select("#compare-left-selected-label");
const compareRightSelectedLabel = d3.select("#compare-right-selected-label");


// VARS
let projection, path;
let colorScale;
let timelines;
let timeByIndex = new Map();
let dataByTimeIndex = new Map();
let minIndex = 0;
let maxIndex = 0;


// COMPARISON
let timelineCurrentIndex = null;
let compareLeftIndex = null;
let compareRightIndex = null;

// FOR ZOOM AND HIGHLIGHTS
let timelineGroup;
let compareLeftGroup;
let compareRightGroup;

// COUNTY
let timelineCounties;
let compareLeftCounties;
let compareRightCounties;
let compareHoverCounty = null;
let timelineHoverCounty = null;

const majorCities = [
  { name: "Los Angeles",   lon: -118.2437, lat: 34.0522 },
  { name: "San Diego",     lon: -117.1611, lat: 32.7157 },
  { name: "San Jose",      lon: -121.8863, lat: 37.3382 },
  { name: "San Francisco", lon: -122.4194, lat: 37.7749 },
  { name: "Sacramento",    lon: -121.4944, lat: 38.5816 },
  { name: "Fresno",        lon: -119.7871, lat: 36.7378 },
  { name: "Bakersfield",   lon: -119.0187, lat: 35.3733 },
  { name: "Irvine",     lon: -117.8265, lat: 33.6846 },
];

// WHAT IS SELECTED
const selectionState = {
  timeline: {
    selectedCounty: null,
    group: null,
    paths: null
  },
  compareLeft: {
    selectedCounty: null,
    group: null,
    paths: null
  },
  compareRight: {
    selectedCounty: null,
    group: null,
    paths: null
  }
};

// PREPERATION OF THE DATA 
Promise.all([
  d3.json(COUNTIES_GEOJSON),
  d3.csv(CLOUD_CSV)
]).then(([geojson, csvData]) => {
  prepareData(csvData);
  setupProjection(geojson);
  setupColorScale(csvData);
  drawMaps(geojson);
  buildLegends();
  setupTimelineMode();
  setupCompareMode();
  setupModeToggle();

  setMode("timeline");
}).catch(err => {
  console.error("Error loading data:", err);
});

// PREPARE DATA
function prepareData(csvData) {
  csvData.forEach(d => {
    d.index = +d.index;
    d.local_hour = +d.local_hour;
    d.cloud_coverage = +d.cloud_coverage;
    d.n_points = +d.n_points;
  });

  dataByTimeIndex = new Map();
  timeByIndex = new Map();

  csvData.forEach(d => {
    if (!dataByTimeIndex.has(d.index)) {
      dataByTimeIndex.set(d.index, new Map());
    }
    dataByTimeIndex.get(d.index).set(d.CountyName, d);

    if (!timeByIndex.has(d.index)) {
      timeByIndex.set(d.index, {
        index: d.index,
        datetime_local: d.datetime_local,
        date_str: d.date_str,
        hour_str: d.hour_str
      });
    }
  });

  timelines = Array.from(timeByIndex.values()).sort((a, b) => a.index - b.index);
  minIndex = d3.min(timelines, d => d.index);
  maxIndex = d3.max(timelines, d => d.index);
}

// map projection
const mapWidth = 700;
const mapHeight = 550;

function setupProjection(geojson) {
  projection = d3.geoMercator().fitSize([mapWidth, mapHeight], geojson);
  path = d3.geoPath(projection);

  [timelineSvg, compareLeftSvg, compareRightSvg].forEach(svg => {
    svg
      .attr("viewBox", `0 0 ${mapWidth} ${mapHeight}`)
      .attr("preserveAspectRatio", "xMidYMid meet");
  });
}

// colors
function setupColorScale(csvData) {
  const extent = d3.extent(csvData, d => d.cloud_coverage);
  const [minCov, maxCov] = extent;
  const domain = (minCov === maxCov)
    ? [minCov - 0.01, maxCov + 0.01]
    : extent;

  colorScale = d3.scaleQuantize()
    .domain(domain)
    .range(d3.schemeBlues[5]);
}

// draw map
function drawMaps(geojson) {
  
  // Timeline map
  timelineGroup = timelineSvg.append("g");
  timelineCounties = timelineGroup
    .selectAll("path")
    .data(geojson.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#000")
    .attr("stroke-width", 0.4)
    .attr("fill", "#eee");
  
  const timelineCities = timelineGroup.selectAll("circle.city")
    .data(majorCities)
    .enter()
    .append("circle")
    .attr("class", "city")
    .attr("cx", d => projection([d.lon, d.lat])[0])
    .attr("cy", d => projection([d.lon, d.lat])[1])
    .attr("r", 3.5);

  const timelineCityLabels = timelineGroup.selectAll("text.city-label")
    .data(majorCities)
    .enter()
    .append("text")
    .attr("class", "city-label")
    .attr("x", d => projection([d.lon, d.lat])[0] + 5)
    .attr("y", d => projection([d.lon, d.lat])[1] - 3)
    .text(d => d.name);

  // Compare left
  compareLeftGroup = compareLeftSvg.append("g");
  compareLeftCounties = compareLeftGroup
    .selectAll("path")
    .data(geojson.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#000")
    .attr("stroke-width", 0.4)
    .attr("fill", "#eee");

  const compareLeftCities = compareLeftGroup.selectAll("circle.city")
    .data(majorCities)
    .enter()
    .append("circle")
    .attr("class", "city")
    .attr("cx", d => projection([d.lon, d.lat])[0])
    .attr("cy", d => projection([d.lon, d.lat])[1])
    .attr("r", 3.5);

  const compareLeftCityLabels = compareLeftGroup.selectAll("text.city-label")
    .data(majorCities)
    .enter()
    .append("text")
    .attr("class", "city-label")
    .attr("x", d => projection([d.lon, d.lat])[0] + 5)
    .attr("y", d => projection([d.lon, d.lat])[1] - 3)
    .text(d => d.name);

  // Compare right
  compareRightGroup = compareRightSvg.append("g");
  compareRightCounties = compareRightGroup
    .selectAll("path")
    .data(geojson.features)
    .enter()
    .append("path")
    .attr("d", path)
    .attr("stroke", "#000")
    .attr("stroke-width", 0.4)
    .attr("fill", "#eee");

  const compareRightCities = compareRightGroup.selectAll("circle.city")
    .data(majorCities)
    .enter()
    .append("circle")
    .attr("class", "city")
    .attr("cx", d => projection([d.lon, d.lat])[0])
    .attr("cy", d => projection([d.lon, d.lat])[1])
    .attr("r", 3.5);

  const compareRightCityLabels = compareRightGroup.selectAll("text.city-label")
    .data(majorCities)
    .enter()
    .append("text")
    .attr("class", "city-label")
    .attr("x", d => projection([d.lon, d.lat])[0] + 5)
    .attr("y", d => projection([d.lon, d.lat])[1] - 3)
    .text(d => d.name);

  selectionState.timeline.group = timelineGroup;
  selectionState.timeline.paths = timelineCounties;

  selectionState.compareLeft.group = compareLeftGroup;
  selectionState.compareLeft.paths = compareLeftCounties;

  selectionState.compareRight.group = compareRightGroup;
  selectionState.compareRight.paths = compareRightCounties;
}

// legends
function buildLegends() {
  buildLegendInto(legendTimeline);
  buildLegendInto(legendCompare);
}

function buildLegendInto(container) {
  container.html("");

  container.append("div")
    .attr("class", "legend-title")
    .text("Cloud coverage (county %)");

  const legendData = colorScale.range().map(c => {
    const [from, to] = colorScale.invertExtent(c);
    return { color: c, from, to };
  }).filter(d => d.from != null && d.to != null);

  legendData.forEach(d => {
    const row = container.append("div").attr("class", "legend-row");
    row.append("div")
      .attr("class", "legend-swatch")
      .style("background-color", d.color);
    row.append("div")
      .text(`${(d.from * 100).toFixed(0)}–${(d.to * 100).toFixed(0)}%`);
  });

  container.append("p")
    .style("margin-top", "8px")
    .style("font-size", "11px")
    .style("color", "#666")
    .text("Each color bin shows a range of county level cloud cover.");
}

// timeline n others
function setupTimelineMode() {
  timelineSlider
    .attr("min", minIndex)
    .attr("max", maxIndex)
    .attr("step", 1)
    .property("value", minIndex);

  timelineCurrentIndex = minIndex;
  updateTimelineLabel();
  updateTimelineMap();

  buildTimelineTicks();

  attachTooltip(timelineCounties, () => timelineCurrentIndex, "timeline");
  attachClickZoom("timeline");

  timelineSlider.on("input", (event) => {
    timelineCurrentIndex = +event.target.value;
    updateTimelineLabel();
    updateTimelineMap();
  });

  updateSelectedLabel("timeline");
}

function updateTimelineLabel() {
  const tInfo = timeByIndex.get(timelineCurrentIndex);
  if (!tInfo) {
    timelineLabel.text("N/A");
    return;
  }
  timelineLabel.text(`${tInfo.date_str}, ${tInfo.hour_str}`);
}

function updateTimelineMap() {
  timelineCounties.attr("fill", d => {
    const countyName = d.properties.CountyName;
    const cov = getCoverage(countyName, timelineCurrentIndex);
    return cov != null ? colorScale(cov) : "#ddd";
  });
  applyHighlight("timeline");
}

// seperate day tick

function buildTimelineTicks() {
  const container = d3.select("#timeline-ticks");
  if (container.empty()) return;

  container.html("");

  if (!timelines || timelines.length === 0) return;

  const groups = d3.groups(timelines, d => d.date_str);
  const span = (maxIndex - minIndex) || 1;

  for (let i = 0; i < groups.length - 1; i++) {
    const nextEntries = groups[i + 1][1];
    const boundaryIdx = nextEntries[0].index;

    const pct = ((boundaryIdx - minIndex) / span) * 100;

    container.append("div")
      .attr("class", "timeline-boundary")
      .style("left", pct + "%");
  }

  groups.forEach(([dateStr, arr]) => {
    const startIdx = arr[0].index;
    const endIdx = arr[arr.length - 1].index;
    const midIdx = (startIdx + endIdx) / 2;

    const pct = ((midIdx - minIndex) / span) * 100;

    const tick = container.append("div")
      .attr("class", "timeline-tick")
      .style("left", pct + "%");

    tick.append("div")
      .attr("class", "timeline-tick-label")
      .text(dateStr);
  });
}


// compareison
function setupCompareMode() {
  // dd
  leftSelect.selectAll("option")
    .data(timelines)
    .enter()
    .append("option")
    .attr("value", d => d.index)
    .text(d => `${d.date_str} — ${d.hour_str}`);

  rightSelect.selectAll("option")
    .data(timelines)
    .enter()
    .append("option")
    .attr("value", d => d.index)
    .text(d => `${d.date_str} — ${d.hour_str}`);

  
  compareLeftIndex = timelines[0].index;
  compareRightIndex = timelines[timelines.length - 1].index;
  leftSelect.property("value", compareLeftIndex);
  rightSelect.property("value", compareRightIndex);

  // tt
  attachTooltip(compareLeftCounties, () => compareLeftIndex, "compareLeft");
  attachTooltip(compareRightCounties, () => compareRightIndex, "compareRight");
  attachClickZoom("compareLeft");
  attachClickZoom("compareRight");



  updateCompareLeftMap();
  updateCompareRightMap();

  leftSelect.on("change", (event) => {
    compareLeftIndex = +event.target.value;
    updateCompareLeftMap();
  });

  rightSelect.on("change", (event) => {
    compareRightIndex = +event.target.value;
    updateCompareRightMap();
  });

  updateSelectedLabel("compareLeft");
  updateSelectedLabel("compareRight");
}

function updateCompareLeftMap() {
  compareLeftCounties.attr("fill", d => {
    const countyName = d.properties.CountyName;
    const cov = getCoverage(countyName, compareLeftIndex);
    return cov != null ? colorScale(cov) : "#ddd";
  });
  applyHighlight("compareLeft");
}

function updateCompareRightMap() {
  compareRightCounties.attr("fill", d => {
    const countyName = d.properties.CountyName;
    const cov = getCoverage(countyName, compareRightIndex);
    return cov != null ? colorScale(cov) : "#ddd";
  });
  applyHighlight("compareRight");
}







// toggle
function setupModeToggle() {
  modeTimelineBtn.on("click", () => setMode("timeline"));
  modeCompareBtn.on("click", () => setMode("compare"));
}

function setMode(mode) {
  if (mode === "timeline") {
    timelineSection.classed("hidden", false);
    compareSection.classed("hidden", true);
    modeTimelineBtn.classed("active", true);
    modeCompareBtn.classed("active", false);
  } else {
    timelineSection.classed("hidden", true);
    compareSection.classed("hidden", false);
    modeTimelineBtn.classed("active", false);
    modeCompareBtn.classed("active", true);
  }
}

// get coverage
function getCoverage(countyName, timeIndex) {
  const countyMap = dataByTimeIndex.get(timeIndex);
  if (!countyMap) return null;
  const row = countyMap.get(countyName);
  if (!row) return null;
  return row.cloud_coverage;
}

// toolltip 
function attachTooltip(selection, getCurrentIndex, mapKey) {
  selection
    .on("mousemove", (event, d) => {
      const countyName = d.properties.CountyName;
      const timeIndex = getCurrentIndex();
      const cov = getCoverage(countyName, timeIndex);
      const tInfo = timeByIndex.get(timeIndex);

      const covPct = cov != null ? (cov * 100).toFixed(1) + "%" : "N/A";
      const dateText = tInfo ? tInfo.date_str : "N/A";
      const hourText = tInfo ? tInfo.hour_str : "";

      tooltip
        .style("opacity", 1)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY + 10) + "px")
        .html(
          `<strong>${countyName}</strong><br>` +
          `${dateText}, ${hourText}<br>` +
          `Cloud cover: ${covPct}`
        );




      //highlgiht
      if (mapKey === "timeline") {
        timelineHoverCounty = countyName;
        applyHighlight("timeline");
      }

      if (mapKey === "compareLeft" || mapKey === "compareRight") {
        compareHoverCounty = countyName;
        applyHighlight("compareLeft");
        applyHighlight("compareRight");
      }
    })



    .on("mouseleave", () => {
      tooltip.style("opacity", 0);

      if (mapKey === "timeline") {
        timelineHoverCounty = null;
        applyHighlight("timeline");
      }

      if (mapKey === "compareLeft" || mapKey === "compareRight") {
        compareHoverCounty = null;
        applyHighlight("compareLeft");
        applyHighlight("compareRight");
      }
    });
}

// click zoom
function attachClickZoom(mapKey) {
  const state = selectionState[mapKey];
  const group = state.group;
  const paths = state.paths;

  const zoomScale = 3;

  paths.on("click", function (event, d) {
    const countyName = d.properties.CountyName;

    if (state.selectedCounty === countyName) {
      state.selectedCounty = null;
      group.transition()
        .duration(400)
        .attr("transform", null);
    } else {
      state.selectedCounty = countyName;
      const [cx, cy] = d3.geoPath(projection).centroid(d);
      const translateX = mapWidth / 2;
      const translateY = mapHeight / 2;



      group.transition()
        .duration(500)
        .attr(
          "transform",
          `translate(${translateX},${translateY}) scale(${zoomScale}) translate(${-cx},${-cy})`

        );


    }

    updateSelectedLabel(mapKey);
    applyHighlight(mapKey);
  });
}


// highlight selected
function applyHighlight(mapKey) {
  const state = selectionState[mapKey];
  const selected = state.selectedCounty;
  const paths = state.paths;
  if (!paths) return;

  let hoverCounty = null;
  if (mapKey === "timeline") {
    hoverCounty = timelineHoverCounty;
  } else if (mapKey === "compareLeft" || mapKey === "compareRight") {
    hoverCounty = compareHoverCounty;
  }

  paths
    .attr("opacity", 1)
    .attr("stroke-width", d => {
      const name = d.properties.CountyName;
      const isSelected = selected && name === selected;
      const isHovered = hoverCounty && name === hoverCounty;

      if (isSelected) return 1.6;
      if (isHovered) return 1.0;
      return 0.4;
    });
}



function updateSelectedLabel(mapKey) {
  const selected = selectionState[mapKey].selectedCounty;
  let labelSel;

  if (mapKey === "timeline") {
    labelSel = timelineSelectedLabel;
  } else if (mapKey === "compareLeft") {
    labelSel = compareLeftSelectedLabel;
  } else if (mapKey === "compareRight") {
    labelSel = compareRightSelectedLabel;
  } else {
    return;
  }

  labelSel.text(selected ? selected : "none");
}
