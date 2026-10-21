import { CloudSun, Info, Layers3, ShieldCheck } from "lucide-react";
import { lazy, Suspense, useState } from "react";
import { planRoutes } from "./lib/api";
import { RouteCards } from "./components/RouteCards";
import { RouteForm } from "./components/RouteForm";
import type { PlanInput, PlanResponse } from "./types";

const MapView = lazy(() => import("./components/MapView").then((module) => ({ default: module.MapView })));

function App() {
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [heatmapHour, setHeatmapHour] = useState(0);

  async function submit(input: PlanInput) {
    setLoading(true);
    setError("");
    try {
      const result = await planRoutes(input);
      setPlan(result);
      setSelectedId(result.recommended_route_id);
      setHeatmapHour(0);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Route analysis failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <aside className="control-panel">
        <header className="brand">
          <span className="brand-mark"><ShieldCheck size={21} /></span>
          <div><strong>HaulSafe</strong><span>Route intelligence</span></div>
        </header>
        <section className="panel-section intro">
          <p className="eyebrow">Pre-trip safety plan</p>
          <h1>Choose the road with the lowest weather exposure.</h1>
          <p>Compare route conditions at the time your truck is expected to reach them.</p>
        </section>
        <section className="panel-section"><RouteForm loading={loading} onSubmit={submit} /></section>
        {error && <div className="request-error" role="alert"><Info size={17} /><div><strong>Couldn’t build this plan</strong><span>{error}</span></div></div>}
        {plan && (
          <section className="panel-section results">
            <div className="section-heading"><div><p className="eyebrow">Route comparison</p><h2>Three viable corridors</h2></div><span>Safest first</span></div>
            <RouteCards routes={plan.routes} selectedId={selectedId} onSelect={setSelectedId} />
            <p className="ranking-note"><Info size={14} /> Ranked by severe miles, high miles, average risk, then travel time.</p>
          </section>
        )}
        <footer><span>Forecast data by Open-Meteo</span><span>Road data © OpenStreetMap</span></footer>
      </aside>
      <section className="map-panel">
        <Suspense fallback={<div className="map-skeleton" aria-label="Loading map" />}>
          <MapView plan={plan} selectedId={selectedId} heatmapHour={heatmapHour} onSelect={setSelectedId} />
        </Suspense>
        {!plan && !loading && (
          <div className="map-empty"><span><CloudSun size={26} /></span><h2>Your weather corridor will appear here</h2><p>Enter a trip to compare three routes against forecast conditions.</p></div>
        )}
        {loading && <div className="map-loading"><span className="radar" /><strong>Sampling forecast checkpoints</strong><p>Routing three corridors and matching weather to each ETA</p></div>}
        {plan && (
          <div className="forecast-control">
            <div className="forecast-title"><span><Layers3 size={16} /> Weather corridor</span><strong>+{heatmapHour} hr</strong></div>
            <input type="range" min="0" max="48" step="1" value={heatmapHour} onChange={(e) => setHeatmapHour(Number(e.target.value))} aria-label="Forecast hour" />
            <div className="forecast-ticks"><span>Now</span><span>12h</span><span>24h</span><span>36h</span><span>48h</span></div>
            <div className="risk-legend"><span><i className="low" /> Low</span><span><i className="moderate" /> Moderate</span><span><i className="high" /> High</span><span><i className="severe" /> Severe</span><span><i className="no-travel" /> No travel</span></div>
          </div>
        )}
      </section>
    </main>
  );
}

export default App;

