from datetime import datetime

from app.etl.estimate import MAX_DAYS, compute_days_left


def test_compute_days_left_nominal_values():
    result = compute_days_left(
        total_storage_mcft=1000,
        total_capacity_mcft=2000,
        daily_consumption_mld=100,
        desalination_mld=20,
        recent_avg_inflow_mcft_per_day=1.0,
        seasonal_avg_inflow_mcft_per_day=3.0,
    )

    assert result["pessimistic"] == 353
    assert result["moderate"] == 547
    assert result["optimistic"] == MAX_DAYS
    assert result["storage_pct"] == 50.0
    assert result["net_depletion_rate_mcft_per_day"] == 1.825

    # Ensure generated timestamp is valid ISO-8601
    datetime.fromisoformat(result["last_updated"])


def test_compute_days_left_when_desalination_exceeds_consumption():
    result = compute_days_left(
        total_storage_mcft=1200,
        total_capacity_mcft=0,
        daily_consumption_mld=150,
        desalination_mld=200,
        recent_avg_inflow_mcft_per_day=0,
        seasonal_avg_inflow_mcft_per_day=0,
    )

    assert result["pessimistic"] == MAX_DAYS
    assert result["moderate"] == MAX_DAYS
    assert result["optimistic"] == MAX_DAYS
    assert result["storage_pct"] == 0
    assert result["net_depletion_rate_mcft_per_day"] == 0
