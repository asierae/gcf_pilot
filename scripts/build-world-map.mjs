/**
 * Generates `src/assets/world-countries.geo.json` for the admin world map.
 *
 * One-off generator; the output is committed so the app has no runtime
 * dependency on TopoJSON. To regenerate:
 *   npm install --no-save world-atlas topojson-client i18n-iso-countries
 *   node scripts/build-world-map.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { feature } from "topojson-client";
import countries from "i18n-iso-countries";

const topology = JSON.parse(
  readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"),
);

const collection = feature(topology, topology.objects.countries);

const round = (value) => Math.round(value * 100) / 100;
const cleanGeometry = (geometry) => {
  if (geometry.type === "Polygon") {
    return {
      type: "Polygon",
      coordinates: geometry.coordinates.map((ring) =>
        ring.map(([lng, lat]) => [round(lng), round(lat)]),
      ),
    };
  }
  if (geometry.type === "MultiPolygon") {
    return {
      type: "MultiPolygon",
      coordinates: geometry.coordinates.map((polygon) =>
        polygon.map((ring) =>
          ring.map(([lng, lat]) => [round(lng), round(lat)]),
        ),
      ),
    };
  }
  return geometry;
};

const features = collection.features
  .map((item) => {
    const numeric = String(item.id ?? "").padStart(3, "0");
    const code = /^\d{3}$/.test(numeric)
      ? countries.numericToAlpha2(numeric)
      : null;
    return {
      type: "Feature",
      id: code ?? null,
      properties: { name: item.properties?.name ?? "" },
      geometry: cleanGeometry(item.geometry),
    };
  })
  .filter((item) => item.geometry);

const output = { type: "FeatureCollection", features };
const path = "src/assets/world-countries.geo.json";
writeFileSync(path, JSON.stringify(output));
const codes = features.filter((item) => item.id).length;
console.log(`Wrote ${path}: ${features.length} shapes, ${codes} with ISO codes`);
