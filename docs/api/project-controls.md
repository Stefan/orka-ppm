# Project Controls API

ETC and EAC calculation endpoints.

## Endpoints

- `GET /project-controls/etc/{project_id}?method=bottom_up` - Calculate ETC
- `GET /project-controls/eac/{project_id}?method=current_performance` - Calculate EAC

ETC methods: bottom_up, performance_based, parametric
EAC methods: current_performance, budget_performance, management_forecast
