import maplibregl, { type Map as MapInstance, type MapGeoJSONFeature } from "maplibre-gl";
import { useEffect, useRef } from "react";
import type { PlanResponse } from "../types";

type Props = { plan: PlanResponse | null; selectedId: string; heatmapHour: number; onSelect: (id: string) => void };

const STYLE: maplibregl.StyleSpecification = {
  version: 8,
  sources: { osm: { type: "raster", tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"], tileSize: 256, attribution: "© OpenStreetMap contributors" } },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#edf0ea" } },
    { id: "osm", type: "raster", source: "osm", paint: { "raster-saturation": -0.75, "raster-contrast": -0.08, "raster-brightness-min": 0.22, "raster-brightness-max": 0.92 } },
  ],
};

export function MapView({ plan, selectedId, heatmapHour, onSelect }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;

  useEffect(() => {
    if (!container.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: container.current, style: STYLE, center: [-98.5, 39.5], zoom: 3.2, minZoom: 2 });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-right");
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !plan) return;
    const render = () => {
      const routeData: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: plan.routes.map((route) => ({ type: "Feature", geometry: route.geometry, properties: { id: route.id, selected: route.id === selectedId ? 1 : 0 } })),
      };
      const checkpointData: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: plan.routes.flatMap((route) => route.checkpoints.map((point, index) => ({
          type: "Feature" as const,
          geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] },
          properties: { ...point.weather, ...point.risk, routeId: route.id, routeName: route.name, eta: point.eta, mile: point.distance_miles, selected: route.id === selectedId ? 1 : 0, heatRisk: point.forecast_risk[heatmapHour], checkpoint: index + 1 },
        }))),
      };

      const updateSource = (id: string, data: GeoJSON.FeatureCollection) => {
        const source = map.getSource(id) as maplibregl.GeoJSONSource | undefined;
        if (source) source.setData(data); else map.addSource(id, { type: "geojson", data });
      };
      updateSource("routes", routeData);
      updateSource("checkpoints", checkpointData);

      if (!map.getLayer("routes-casing")) {
        map.addLayer({ id: "routes-casing", type: "line", source: "routes", paint: { "line-color": "#ffffff", "line-width": ["case", ["==", ["get", "selected"], 1], 8, 5], "line-opacity": 0.8 } });
        map.addLayer({ id: "routes-line", type: "line", source: "routes", paint: { "line-color": ["case", ["==", ["get", "selected"], 1], "#174d3b", "#718078"], "line-width": ["case", ["==", ["get", "selected"], 1], 5, 2.5], "line-opacity": ["case", ["==", ["get", "selected"], 1], 1, 0.65] } });
        map.addLayer({ id: "weather-heat", type: "heatmap", source: "checkpoints", maxzoom: 11, paint: { "heatmap-weight": ["interpolate", ["linear"], ["get", "heatRisk"], 0, 0, 4, 1], "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 2, 0.7, 9, 1.5], "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 2, 16, 9, 34], "heatmap-opacity": 0.48, "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(68,133,94,0)", 0.25, "#79a96b", 0.5, "#e1b84f", 0.72, "#e97a3d", 0.9, "#b93838", 1, "#7b1e2b"] } });
        map.addLayer({ id: "checkpoint-dots", type: "circle", source: "checkpoints", filter: ["==", ["get", "selected"], 1], paint: { "circle-radius": 5, "circle-color": ["match", ["get", "level"], 0, "#4b8b61", 1, "#d6a835", 2, "#e87531", 3, "#c53b38", 4, "#721c2a", "#777"], "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
        map.on("click", "routes-line", (event) => { const feature = event.features?.[0] as MapGeoJSONFeature | undefined; if (feature?.properties?.id) onSelect(feature.properties.id); });
        map.on("click", "checkpoint-dots", (event) => {
          const p = event.features?.[0]?.properties;
          if (!p) return;
          new maplibregl.Popup({ offset: 10, closeButton: false })
            .setLngLat((event.features?.[0].geometry as GeoJSON.Point).coordinates as [number, number])
            .setHTML(`<div class="map-popup"><strong>${p.routeName} · mile ${Math.round(p.mile)}</strong><span class="risk-text risk-${p.level}">${p.label}</span><dl><dt>ETA</dt><dd>${new Date(p.eta).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" })}</dd><dt>Wind</dt><dd>${p.wind_mph} mph</dd><dt>Rain</dt><dd>${p.rain_in_hr} in/hr</dd><dt>Snow</dt><dd>${p.snow_in_hr} in/hr</dd></dl></div>`)
            .addTo(map);
        });
        map.on("mouseenter", "routes-line", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "routes-line", () => { map.getCanvas().style.cursor = ""; });
      }

      const bounds = new maplibregl.LngLatBounds();
      plan.routes.forEach((route) => route.geometry.coordinates.forEach((coordinate) => bounds.extend(coordinate as [number, number])));
      map.fitBounds(bounds, { padding: { top: 80, right: 60, bottom: 80, left: 60 }, duration: 900, maxZoom: 9 });
    };
    if (map.isStyleLoaded()) render(); else map.once("load", render);
  }, [plan]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !plan || !map.getSource("routes")) return;
    const routeData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: plan.routes.map((route) => ({ type: "Feature", geometry: route.geometry, properties: { id: route.id, selected: route.id === selectedId ? 1 : 0 } })) };
    const checkpointData: GeoJSON.FeatureCollection = { type: "FeatureCollection", features: plan.routes.flatMap((route) => route.checkpoints.map((point) => ({ type: "Feature" as const, geometry: { type: "Point" as const, coordinates: [point.longitude, point.latitude] }, properties: { ...point.weather, ...point.risk, routeId: route.id, routeName: route.name, eta: point.eta, mile: point.distance_miles, selected: route.id === selectedId ? 1 : 0, heatRisk: point.forecast_risk[heatmapHour] } }))) };
    (map.getSource("routes") as maplibregl.GeoJSONSource).setData(routeData);
    (map.getSource("checkpoints") as maplibregl.GeoJSONSource).setData(checkpointData);
  }, [selectedId, heatmapHour, plan]);

  return <div ref={container} className="map" aria-label="Interactive map of route options and weather risks" />;
}

