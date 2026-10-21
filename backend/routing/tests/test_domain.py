from routing.domain import Risk, WeatherReading, classify_weather, route_rank, sample_line, summarize


def test_threshold_boundaries_are_inclusive_of_higher_band():
    risk, components = classify_weather(WeatherReading(25, 0.10, 0.5), 20_000)
    assert risk == Risk.MODERATE
    assert set(components.values()) == {Risk.MODERATE}


def test_heavy_load_escalates_high_wind_to_severe():
    risk, components = classify_weather(WeatherReading(35, 0, 0), 40_001)
    assert risk == Risk.SEVERE
    assert components["wind"] == Risk.SEVERE


def test_load_over_thirty_thousand_blocks_severe_wind():
    risk, _ = classify_weather(WeatherReading(45, 0, 0), 30_001)
    assert risk == Risk.NO_TRAVEL


def test_fifty_five_mph_is_no_travel_for_any_load():
    risk, _ = classify_weather(WeatherReading(55, 0, 0), 1)
    assert risk == Risk.NO_TRAVEL


def test_sampling_includes_origin_regular_intervals_and_destination():
    checkpoints = sample_line([[-100, 40], [-99, 40]], 25)
    assert checkpoints[0]["distance_miles"] == 0
    assert 2 < len(checkpoints) < 5
    assert checkpoints[-1]["longitude"] == -99


def test_route_rank_is_lexicographic_in_brief_order():
    safest = {"severe_miles": 0, "high_miles": 50, "average_risk": 2, "duration_minutes": 500}
    faster_but_severe = {"severe_miles": 1, "high_miles": 0, "average_risk": 0, "duration_minutes": 100}
    assert route_rank(safest) < route_rank(faster_but_severe)


def test_summary_assigns_segment_miles_to_starting_checkpoint():
    checkpoints = [
        {"distance_miles": 0, "risk": {"level": Risk.HIGH.value}},
        {"distance_miles": 10, "risk": {"level": Risk.SEVERE.value}},
        {"distance_miles": 20, "risk": {"level": Risk.LOW.value}},
    ]
    result = summarize(checkpoints, 25, 3600)
    assert result["high_miles"] == 10
    assert result["severe_miles"] == 10
    assert result["duration_minutes"] == 60

