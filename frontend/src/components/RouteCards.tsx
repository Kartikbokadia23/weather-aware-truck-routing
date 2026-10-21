import { AlertOctagon, Check, Clock3, Route as RouteIcon } from "lucide-react";
import { duration } from "../lib/format";
import type { PlannedRoute } from "../types";

type Props = { routes: PlannedRoute[]; selectedId: string; onSelect: (id: string) => void };

export function RouteCards({ routes, selectedId, onSelect }: Props) {
  return (
    <div className="route-list" aria-label="Route alternatives">
      {routes.map((route) => {
        const selected = selectedId === route.id;
        return (
          <button key={route.id} type="button" className={`route-card ${selected ? "selected" : ""}`} onClick={() => onSelect(route.id)} aria-pressed={selected}>
            <div className="route-card-head">
              <span className="route-name">{route.name}</span>
              {route.recommended && <span className="recommended"><Check size={12} /> Safest</span>}
            </div>
            <div className="route-metrics">
              <span><RouteIcon size={14} /> {route.summary.distance_miles.toLocaleString()} mi</span>
              <span><Clock3 size={14} /> {duration(route.summary.duration_minutes)}</span>
            </div>
            <div className="risk-miles">
              <span><i className="dot severe" /> {route.summary.severe_miles} severe mi</span>
              <span><i className="dot high" /> {route.summary.high_miles} high mi</span>
            </div>
            {route.summary.no_travel && <span className="no-travel"><AlertOctagon size={13} /> No-travel conditions detected</span>}
          </button>
        );
      })}
    </div>
  );
}

