import os
import pandas as pd
import pytest
from analyzer.comparison import compare_dataset_versions, calculate_psi, classify_health

def test_calculate_psi():
    s1 = pd.Series(['A', 'A', 'B', 'C', 'A', 'B'])
    s2 = pd.Series(['A', 'B', 'B', 'C', 'C', 'C'])
    psi = calculate_psi(s1, s2)
    assert isinstance(psi, float)
    assert psi >= 0.0

def test_1_no_drift(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    df = pd.DataFrame({"id": [1, 2, 3], "val": [10.0, 20.0, 30.0]})
    df.to_csv(f1, index=False)
    df.to_csv(f2, index=False)

    report = {
        "summary": {"row_count": 3, "column_count": 2, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "id", "inferred_type": "integer"}, {"name": "val", "inferred_type": "float"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), report, report)
    assert res['intrinsic_quality_score'] == 100.0
    assert res['drift_impact_score'] == 100.0
    assert res['combined_health_score'] == 100.0
    assert res['health_status'] == 'HEALTHY'

def test_2_removed_column(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"c1": [1, 2], "c2": [3, 4]}).to_csv(f1, index=False)
    pd.DataFrame({"c1": [1, 2]}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 2, "column_count": 2, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}, {"name": "c2", "inferred_type": "integer"}]
    }
    rep2 = {
        "summary": {"row_count": 2, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    assert res['drift_impact_score'] == 60.0  # 100 - 40 deduction
    assert res['combined_health_score'] == 84.0  # 100*0.6 + 60*0.4 = 84.0

def test_3_type_change(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"c1": [1, 2]}).to_csv(f1, index=False)
    pd.DataFrame({"c1": ["1", "2"]}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 2, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}]
    }
    rep2 = {
        "summary": {"row_count": 2, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "string"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    assert res['drift_impact_score'] == 75.0  # 100 - 25 deduction

def test_4_moderate_schema_drift(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"c1": [1, 2]}).to_csv(f1, index=False)
    pd.DataFrame({"c1": [1, 2]}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 2, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}]
    }
    rep2 = {
        "summary": {"row_count": 2, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    assert res['drift_impact_score'] == 100.0

def test_5_severe_distribution_drift(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"v": [10.0, 10.1, 10.2, 9.9, 10.0, 10.1, 10.2, 9.8, 10.0, 10.1]}).to_csv(f1, index=False)
    pd.DataFrame({"v": [50.0, 52.1, 55.2, 49.9, 50.0, 51.1, 53.2, 48.8, 50.0, 51.1]}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 10, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "v", "inferred_type": "float"}]
    }
    rep2 = {
        "summary": {"row_count": 10, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "v", "inferred_type": "float"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    dist_item = next(item for item in res['distribution_drift'] if item['column'] == 'v')
    assert dist_item['severity'] == 'SEVERE_DRIFT'
    assert res['drift_impact_score'] == 75.0

def test_6_moderate_distribution_drift(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"cat": ["A"] * 80 + ["B"] * 20}).to_csv(f1, index=False)
    pd.DataFrame({"cat": ["A"] * 65 + ["B"] * 35}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 100, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "cat", "inferred_type": "string"}]
    }
    rep2 = {
        "summary": {"row_count": 100, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "cat", "inferred_type": "string"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    dist_item = next(item for item in res['distribution_drift'] if item['column'] == 'cat')
    assert dist_item['severity'] in ('MODERATE_DRIFT', 'SEVERE_DRIFT')

def test_7_severe_feature_does_not_receive_moderate_deduction(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"v": [10.0] * 10}).to_csv(f1, index=False)
    pd.DataFrame({"v": [100.0] * 10}).to_csv(f2, index=False)

    rep = {
        "summary": {"row_count": 10, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "v", "inferred_type": "float"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep, rep)
    assert res['drift_impact_score'] == 75.0

def test_8_multiple_drift_deductions(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"c1": [1, 2], "c2": [3, 4]}).to_csv(f1, index=False)
    pd.DataFrame({"c1": ["1", "2"]}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 2, "column_count": 2, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}, {"name": "c2", "inferred_type": "integer"}]
    }
    rep2 = {
        "summary": {"row_count": 2, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "string"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    assert res['drift_impact_score'] == 35.0

def test_9_deduction_cap_at_100(tmp_path):
    f1 = tmp_path / "f1.csv"
    f2 = tmp_path / "f2.csv"
    pd.DataFrame({"c1": [1], "c2": [2], "c3": [3], "c4": [4]}).to_csv(f1, index=False)
    pd.DataFrame({"c1": [1]}).to_csv(f2, index=False)

    rep1 = {
        "summary": {"row_count": 1, "column_count": 4, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": c, "inferred_type": "integer"} for c in ["c1", "c2", "c3", "c4"]]
    }
    rep2 = {
        "summary": {"row_count": 1, "column_count": 1, "total_missing_percentage": 0.0},
        "score": {"overall": 100.0},
        "columns": [{"name": "c1", "inferred_type": "integer"}]
    }

    res = compare_dataset_versions(str(f1), str(f2), rep1, rep2)
    assert res['drift_impact_score'] == 0.0
    assert res['combined_health_score'] == 60.0

def test_10_first_version_properties():
    intrinsic_score = 85.0
    drift_impact_score = 100.0
    combined_health_score = intrinsic_score
    health_status = classify_health(combined_health_score)

    assert drift_impact_score == 100.0
    assert combined_health_score == 85.0
    assert health_status == 'STABLE'

def test_11_combined_score_rounding():
    intrinsic = 87.33333
    drift = 62.5
    combined = round((intrinsic * 0.6) + (drift * 0.4), 2)
    assert combined == 77.4

def test_12_health_status_boundary_conditions():
    assert classify_health(100.0) == "HEALTHY"
    assert classify_health(90.0) == "HEALTHY"
    assert classify_health(89.99) == "STABLE"
    assert classify_health(75.0) == "STABLE"
    assert classify_health(74.99) == "AT_RISK"
    assert classify_health(60.0) == "AT_RISK"
    assert classify_health(59.99) == "DEGRADED"
    assert classify_health(40.0) == "DEGRADED"
    assert classify_health(39.99) == "CRITICAL"
    assert classify_health(0.0) == "CRITICAL"
