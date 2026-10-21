# Loom walkthrough outline (5-7 minutes)

## 0:00-0:35 - Problem and outcome

“HaulSafe helps a commercial driver compare three routes using the conditions expected when the truck reaches each part of the trip. The key distinction is time-aware checkpoint weather rather than a single current-weather lookup.”

Show the initial workspace and identify the trip inputs, map, and forecast control.

## 0:35-2:05 - Product walkthrough

1. Search and select an origin and destination.
2. Choose a departure within 48 hours, set a load over 30,000 lb, and select a checkpoint interval.
3. Submit and point out the explicit analysis state.
4. Compare distance, duration, severe miles, high miles, and the recommended badge.
5. Select another route and show that map emphasis and checkpoint dots update.
6. Open one checkpoint to show mile marker, ETA, wind, rain, snowfall, and risk.
7. Move the forecast slider from 0 to 48 hours and show the corridor heatmap change.

## 2:05-3:25 - Correctness

Open `backend/routing/domain.py`.

- Explain that threshold boundaries enter the higher band.
- Show the 55 mph universal No Travel rule, the 45 mph / 30,000 lb rule, and the 35 mph / 40,000 lb rule.
- Explain that fixed-distance interpolation includes both route endpoints.
- Show that ranking is the tuple `(severe miles, high miles, average risk, duration)`, preserving the brief's priority rather than hiding it behind weights.

## 3:25-4:25 - Data flow and performance

Open `backend/routing/views.py` and the provider services.

- OSRM supplies road alternatives; waypoint fallbacks still go through the routing engine.
- Checkpoint ETAs use distance progress over provider travel time.
- Open-Meteo calls are batched in groups of 40 with bounded parallelism.
- One response carries the ETA risk and 49 heatmap values per checkpoint, so the slider has no network delay.
- Mention validation, upstream timeouts, and the 400-checkpoint guardrail.

## 4:25-5:10 - Tests and quality

Run:

```bash
.venv/bin/pytest backend
cd frontend && pnpm typecheck && pnpm lint && pnpm build
```

Briefly show boundary tests and explain the separation between domain logic and provider code.

## 5:10-5:50 - Deployment and tradeoffs

Show the hosted app and README.

- No provider keys are needed for the demo.
- Public services have no SLA; production would add contracted truck routing, durable caching, throttling, and monitoring.
- The app is a weather planning aid, not an authority for road closures or truck restrictions.

End with the GitHub repository, hosted application, and Loom links on screen.
