import { ArrowDownUp, Clock3, Navigation, PackageOpen } from "lucide-react";
import { useState } from "react";
import { localDateTime } from "../lib/format";
import type { Place, PlanInput } from "../types";
import { PlaceSearch } from "./PlaceSearch";

type Props = { loading: boolean; onSubmit: (input: PlanInput) => void };

export function RouteForm({ loading, onSubmit }: Props) {
  const [departureBounds] = useState(() => {
    const now = new Date();
    return {
      initial: localDateTime(new Date(now.getTime() + 60 * 60_000)),
      min: localDateTime(now),
      max: localDateTime(new Date(now.getTime() + 48 * 3600_000)),
    };
  });
  const [origin, setOrigin] = useState<Place | null>(null);
  const [destination, setDestination] = useState<Place | null>(null);
  const [departure, setDeparture] = useState(departureBounds.initial);
  const [load, setLoad] = useState("34000");
  const [interval, setInterval] = useState<10 | 25 | 50>(25);
  const [error, setError] = useState("");

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const loadLbs = Number(load.replaceAll(",", ""));
    if (!origin || !destination) return setError("Select an origin and destination from the suggestions.");
    if (!Number.isInteger(loadLbs) || loadLbs < 1 || loadLbs > 80_000) return setError("Load weight must be between 1 and 80,000 lb.");
    if (new Date(departure) < new Date()) return setError("Departure time cannot be in the past.");
    setError("");
    onSubmit({ origin, destination, departure_time: new Date(departure).toISOString(), load_lbs: loadLbs, sample_interval_miles: interval });
  }

  return (
    <form className="route-form" onSubmit={submit}>
      <div className="location-stack">
        <PlaceSearch label="Origin" placeholder="City, state or address" value={origin} onChange={setOrigin} />
        <button
          type="button"
          className="swap-button"
          aria-label="Swap origin and destination"
          onClick={() => { const previous = origin; setOrigin(destination); setDestination(previous); }}
        ><ArrowDownUp size={15} /></button>
        <PlaceSearch label="Destination" placeholder="City, state or address" value={destination} onChange={setDestination} />
      </div>
      <div className="form-grid">
        <label>
          <span className="field-label"><Clock3 size={14} /> Departure</span>
          <input className="plain-input" type="datetime-local" min={departureBounds.min} max={departureBounds.max} value={departure} onChange={(e) => setDeparture(e.target.value)} required />
        </label>
        <label>
          <span className="field-label"><PackageOpen size={14} /> Load weight</span>
          <div className="unit-input"><input inputMode="numeric" value={load} onChange={(e) => setLoad(e.target.value)} /><span>lb</span></div>
        </label>
      </div>
      <fieldset className="interval-field">
        <legend>Weather checkpoints</legend>
        {[10, 25, 50].map((miles) => (
          <label key={miles}><input type="radio" name="interval" checked={interval === miles} onChange={() => setInterval(miles as 10 | 25 | 50)} /><span>{miles} mi</span></label>
        ))}
      </fieldset>
      {error && <p className="form-error" role="alert">{error}</p>}
      <button className="primary-button" type="submit" disabled={loading}>
        {loading ? <><span className="spinner light" /> Analyzing corridors…</> : <><Navigation size={17} /> Compare safe routes</>}
      </button>
    </form>
  );
}

