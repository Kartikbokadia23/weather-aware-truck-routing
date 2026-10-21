export type Place = {
  id: number;
  label: string;
  latitude: number;
  longitude: number;
};

export type Weather = { wind_mph: number; rain_in_hr: number; snow_in_hr: number };
export type Risk = { level: number; label: string; drivers: string[] };

export type Checkpoint = {
  latitude: number;
  longitude: number;
  distance_miles: number;
  eta: string;
  weather: Weather;
  risk: Risk;
  forecast_risk: number[];
};

export type RouteSummary = {
  distance_miles: number;
  duration_minutes: number;
  severe_miles: number;
  high_miles: number;
  average_risk: number;
  no_travel: boolean;
};

export type PlannedRoute = {
  id: string;
  name: string;
  geometry: GeoJSON.LineString;
  checkpoints: Checkpoint[];
  summary: RouteSummary;
  recommended: boolean;
};

export type PlanResponse = {
  routes: PlannedRoute[];
  recommended_route_id: string;
  generated_at: string;
};

export type PlanInput = {
  origin: Place;
  destination: Place;
  departure_time: string;
  load_lbs: number;
  sample_interval_miles: 10 | 25 | 50;
};

