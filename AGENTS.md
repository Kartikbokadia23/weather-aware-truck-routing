# Project guidance

- Keep the product focused on the assessment brief: route alternatives, time-aware weather, risk/load rules, recommendation, and map visualization.
- Treat risk calculations as domain logic. Changes require focused unit tests.
- Keep provider-specific HTTP code behind `backend/routing/services` modules.
- Use `pnpm` for frontend dependency management.
- Never commit provider keys or deployment credentials.
- Before committing, run the narrowest relevant tests plus frontend typecheck/build when UI code changes.

