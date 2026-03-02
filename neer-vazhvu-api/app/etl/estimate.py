"""
Days-of-Water-Left Calculator.

Ported from src/lib/calculator/days-left.ts.
Three scenarios: pessimistic (no rain), moderate (recent inflow), optimistic (seasonal).
"""

from datetime import datetime, timezone

from app.etl.constants import MLD_TO_MCFT

MAX_DAYS = 999


def compute_days_left(
    total_storage_mcft: float,
    total_capacity_mcft: float,
    daily_consumption_mld: float,
    desalination_mld: float,
    recent_avg_inflow_mcft_per_day: float,
    seasonal_avg_inflow_mcft_per_day: float,
) -> dict:
    """
    Compute estimated days of water remaining in Chennai's reservoirs.

    Three scenarios:
    1. Pessimistic: Zero inflow, full consumption from reservoirs
    2. Moderate: Recent 7-day average inflow continues
    3. Optimistic: Historical seasonal average inflow
    """
    # Net demand on reservoirs = total demand minus desalination
    net_reservoir_demand_mcft = (daily_consumption_mld - desalination_mld) * MLD_TO_MCFT

    # Scenario 1: PESSIMISTIC — no rain, no inflow
    depletion_pessimistic = net_reservoir_demand_mcft
    if depletion_pessimistic > 0:
        pessimistic = max(0, int(total_storage_mcft / depletion_pessimistic))
    else:
        pessimistic = MAX_DAYS

    # Scenario 2: MODERATE — recent inflow trend continues
    depletion_moderate = max(
        0, net_reservoir_demand_mcft - recent_avg_inflow_mcft_per_day
    )
    if depletion_moderate > 0:
        moderate = max(0, int(total_storage_mcft / depletion_moderate))
    else:
        moderate = MAX_DAYS

    # Scenario 3: OPTIMISTIC — seasonal average inflow
    depletion_optimistic = max(
        0, net_reservoir_demand_mcft - seasonal_avg_inflow_mcft_per_day
    )
    if depletion_optimistic > 0:
        optimistic = max(0, int(total_storage_mcft / depletion_optimistic))
    else:
        optimistic = MAX_DAYS

    storage_pct = (
        (total_storage_mcft / total_capacity_mcft * 100)
        if total_capacity_mcft > 0
        else 0
    )

    return {
        "pessimistic": min(pessimistic, MAX_DAYS),
        "moderate": min(moderate, MAX_DAYS),
        "optimistic": min(optimistic, MAX_DAYS),
        "storage_pct": round(storage_pct, 2),
        "net_depletion_rate_mcft_per_day": round(depletion_moderate, 3),
        "last_updated": datetime.now(timezone.utc).isoformat(),
    }
