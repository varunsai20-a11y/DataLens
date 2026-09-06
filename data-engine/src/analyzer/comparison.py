import os
import math
import numpy as np
import pandas as pd
from typing import Dict, Any, List
from scipy import stats

def calculate_psi(base_series: pd.Series, target_series: pd.Series, epsilon: float = 0.0001) -> float:
    """Calculate Population Stability Index (PSI) for categorical data."""
    base_counts = base_series.value_counts(normalize=True)
    target_counts = target_series.value_counts(normalize=True)

    all_categories = set(base_counts.index).union(set(target_counts.index))
    psi_value = 0.0

    for cat in all_categories:
        actual_pct = target_counts.get(cat, 0.0) + epsilon
        expected_pct = base_counts.get(cat, 0.0) + epsilon
        psi_value += (actual_pct - expected_pct) * np.log(actual_pct / expected_pct)

    return float(np.round(psi_value, 4))

def load_dataset(file_path: str, max_samples: int = 50000) -> pd.DataFrame:
    """Load dataset with deterministic bounded sampling for large files."""
    if not os.path.exists(file_path):
        return pd.DataFrame()

    ext = os.path.splitext(file_path)[1].lower()
    if ext in ('.parquet', '.pq'):
        df = pd.read_parquet(file_path)
    else:
        df = pd.read_csv(file_path, low_memory=False)

    if len(df) > max_samples:
        df = df.sample(n=max_samples, random_state=42)

    return df

def classify_health(score: float) -> str:
    if score >= 90.0:
        return "HEALTHY"
    elif score >= 75.0:
        return "STABLE"
    elif score >= 60.0:
        return "AT_RISK"
    elif score >= 40.0:
        return "DEGRADED"
    else:
        return "CRITICAL"

def compare_dataset_versions(
    base_file_path: str,
    target_file_path: str,
    base_report: Dict[str, Any],
    target_report: Dict[str, Any]
) -> Dict[str, Any]:

    base_summary = base_report.get('summary', {})
    target_summary = target_report.get('summary', {})
    base_score = base_report.get('score', {}).get('overall', 0)
    target_score = target_report.get('score', {}).get('overall', 0)

    # 1. Summary Metrics Comparison
    metrics_summary = {
        "base_row_count": base_summary.get('row_count', 0),
        "target_row_count": target_summary.get('row_count', 0),
        "row_count_delta": target_summary.get('row_count', 0) - base_summary.get('row_count', 0),
        "base_column_count": base_summary.get('column_count', 0),
        "target_column_count": target_summary.get('column_count', 0),
        "column_count_delta": target_summary.get('column_count', 0) - base_summary.get('column_count', 0),
        "base_quality_score": base_score,
        "target_quality_score": target_score,
        "quality_score_delta": round(float(target_score - base_score), 2),
        "base_missing_percentage": base_summary.get('total_missing_percentage', 0.0),
        "target_missing_percentage": target_summary.get('total_missing_percentage', 0.0),
        "missing_percentage_delta": round(float(target_summary.get('total_missing_percentage', 0.0) - base_summary.get('total_missing_percentage', 0.0)), 2),
    }

    # 2. Schema Drift Detection
    base_cols = {col['name']: col for col in base_report.get('columns', [])}
    target_cols = {col['name']: col for col in target_report.get('columns', [])}

    schema_drift: List[Dict[str, Any]] = []

    # Detect Added Columns
    for col_name, col in target_cols.items():
        if col_name not in base_cols:
            schema_drift.append({
                "column": col_name,
                "change_type": "ADDED",
                "base_type": None,
                "target_type": col.get('inferred_type', col.get('dtype', 'unknown')),
                "severity": "LOW",
                "message": f"Column '{col_name}' was added in target version."
            })

    # Detect Removed Columns
    for col_name, col in base_cols.items():
        if col_name not in target_cols:
            schema_drift.append({
                "column": col_name,
                "change_type": "REMOVED",
                "base_type": col.get('inferred_type', col.get('dtype', 'unknown')),
                "target_type": None,
                "severity": "CRITICAL",
                "message": f"Column '{col_name}' was removed in target version (BREAKING CHANGE)."
            })

    # Detect Data Type Mutations
    for col_name in base_cols:
        if col_name in target_cols:
            base_type = base_cols[col_name].get('inferred_type', base_cols[col_name].get('dtype'))
            target_type = target_cols[col_name].get('inferred_type', target_cols[col_name].get('dtype'))
            if base_type != target_type:
                schema_drift.append({
                    "column": col_name,
                    "change_type": "TYPE_CHANGED",
                    "base_type": base_type,
                    "target_type": target_type,
                    "severity": "HIGH",
                    "message": f"Column '{col_name}' type changed from {base_type} to {target_type}."
                })

    # 3. Distribution Drift Detection
    distribution_drift: List[Dict[str, Any]] = []
    
    base_df = load_dataset(base_file_path)
    target_df = load_dataset(target_file_path)

    common_columns = [col for col in base_cols if col in target_cols]

    for col in common_columns:
        if col not in base_df.columns or col not in target_df.columns:
            continue

        base_series = base_df[col].dropna()
        target_series = target_df[col].dropna()

        if len(base_series) == 0 or len(target_series) == 0:
            continue

        is_numeric = pd.api.types.is_numeric_dtype(base_series) and pd.api.types.is_numeric_dtype(target_series)

        if is_numeric:
            ks_res = stats.ks_2samp(base_series, target_series)
            ks_stat = round(float(ks_res.statistic), 4)
            p_val = round(float(ks_res.pvalue), 4)

            if p_val < 0.05 and ks_stat > 0.25:
                severity = "SEVERE_DRIFT"
            elif p_val < 0.05 and ks_stat > 0.10:
                severity = "MODERATE_DRIFT"
            else:
                severity = "NO_DRIFT"

            distribution_drift.append({
                "column": col,
                "feature_type": "numeric",
                "method": "Kolmogorov-Smirnov (KS) test",
                "statistic": ks_stat,
                "p_value": p_val,
                "psi_score": None,
                "severity": severity,
                "sample_size_base": len(base_series),
                "sample_size_target": len(target_series),
                "interpretation": f"KS statistic={ks_stat}, p-value={p_val}. Classified as {severity}."
            })
        else:
            psi_score = calculate_psi(base_series, target_series)

            if psi_score > 0.25:
                severity = "SEVERE_DRIFT"
            elif psi_score > 0.10:
                severity = "MODERATE_DRIFT"
            else:
                severity = "NO_DRIFT"

            distribution_drift.append({
                "column": col,
                "feature_type": "categorical",
                "method": "Population Stability Index (PSI)",
                "statistic": psi_score,
                "p_value": None,
                "psi_score": psi_score,
                "severity": severity,
                "sample_size_base": len(base_series),
                "sample_size_target": len(target_series),
                "interpretation": f"PSI score={psi_score}. Classified as {severity}."
            })

    # 4. Calculate Health & Drift Impact Scores
    total_deduction = 0.0

    for item in schema_drift:
        sev = item.get('severity')
        change_type = item.get('change_type')
        if sev == 'CRITICAL' or change_type == 'REMOVED':
            total_deduction += 40.0
        elif sev == 'HIGH' or change_type == 'TYPE_CHANGED':
            total_deduction += 25.0
        elif sev == 'MODERATE':
            total_deduction += 10.0

    for item in distribution_drift:
        sev = item.get('severity')
        if sev == 'SEVERE_DRIFT':
            total_deduction += 25.0
        elif sev == 'MODERATE_DRIFT':
            total_deduction += 10.0

    drift_impact_score = round(max(0.0, 100.0 - total_deduction), 2)
    intrinsic_quality_score = float(target_score)
    combined_health_score = round((intrinsic_quality_score * 0.6) + (drift_impact_score * 0.4), 2)

    health_status = classify_health(combined_health_score)

    metrics_summary["intrinsic_quality_score"] = intrinsic_quality_score
    metrics_summary["drift_impact_score"] = drift_impact_score
    metrics_summary["combined_health_score"] = combined_health_score
    metrics_summary["health_status"] = health_status

    return {
        "metrics_summary": metrics_summary,
        "schema_drift": schema_drift,
        "distribution_drift": distribution_drift,
        "intrinsic_quality_score": intrinsic_quality_score,
        "drift_impact_score": drift_impact_score,
        "combined_health_score": combined_health_score,
        "health_status": health_status,
    }
