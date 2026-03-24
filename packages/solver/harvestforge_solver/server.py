"""
HarvestForge Optimization Solver
FastAPI service wrapping OR-Tools for fleet assignment optimization.
"""

from fastapi import FastAPI
from pydantic import BaseModel
from typing import Optional
import time

app = FastAPI(
    title="HarvestForge Solver",
    version="3.0.0",
    description="Constraint-based fleet optimization engine",
)


class OptimizeRequest(BaseModel):
    org_id: str
    plan_date: str
    machines: list[dict]
    fields: list[dict]
    rules: list[dict]
    weights: list[dict]
    current_positions: list[dict]
    constraints: Optional[dict] = None


class OptimizeResponse(BaseModel):
    assignments: list[dict]
    score: float
    solver_time_ms: int
    warnings: list[str] = []


class ReplanRequest(BaseModel):
    org_id: str
    current_plan: dict
    trigger: str
    trigger_ref_id: Optional[str] = None
    machines: list[dict]
    fields: list[dict]
    rules: list[dict]
    weights: list[dict]
    current_positions: list[dict]
    preserve_assignments: list[str] = []
    exclude_machines: list[str] = []


@app.get("/health")
async def health():
    return {"status": "healthy", "solver": "or-tools", "version": "3.0.0"}


@app.post("/optimize", response_model=OptimizeResponse)
async def optimize(req: OptimizeRequest):
    """Generate optimized daily assignments using OR-Tools CP-SAT solver."""
    start = time.time()

    # TODO: Implement full OR-Tools optimization
    # Stub: round-robin assignment for development
    assignments = []
    for i, field in enumerate(req.fields):
        if i < len(req.machines):
            assignments.append({
                "machine_id": req.machines[i].get("id"),
                "field_id": field.get("id"),
                "sequence_order": i + 1,
                "optimizer_score": 85.0 - (i * 2),
                "route_distance_mi": 15.0 + (i * 5),
                "route_eta_min": 20 + (i * 8),
            })

    solver_time_ms = int((time.time() - start) * 1000)

    return OptimizeResponse(
        assignments=assignments,
        score=sum(a["optimizer_score"] for a in assignments) / max(len(assignments), 1),
        solver_time_ms=solver_time_ms,
        warnings=[],
    )


@app.post("/replan")
async def replan(req: ReplanRequest):
    """Quick Replan: re-optimize around a disruption."""
    start = time.time()
    solver_time_ms = int((time.time() - start) * 1000)
    return {
        "proposed_changes": [],
        "score": 82.0,
        "solver_time_ms": solver_time_ms,
        "delta": {"miles_change": 0, "hours_change": 0, "fuel_change_pct": 0},
    }


@app.post("/simulate")
async def simulate(req: dict):
    """What-If Simulator: model scenarios without affecting active plan."""
    start = time.time()
    solver_time_ms = int((time.time() - start) * 1000)
    return {
        "simulated_score": 79.0,
        "delta": {
            "completion_date_change_days": 0, "idle_time_change_hrs": 0,
            "miles_change": 0, "crew_overtime_hrs": 0, "convoy_disruptions": 0,
        },
        "affected_assignments": [],
        "solver_time_ms": solver_time_ms,
    }
