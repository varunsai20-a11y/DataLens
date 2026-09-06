from typing import List
from .models import Recommendation, QualityIssue, OutlierReport, DatasetSummary, ColumnProfile

def generate_recommendations(
    summary: DatasetSummary,
    profiles: List[ColumnProfile],
    issues: List[QualityIssue],
    outliers: List[OutlierReport]
) -> List[Recommendation]:
    recs: List[Recommendation] = []

    # Check for empty dataset
    if summary.row_count == 0:
        recs.append(Recommendation(
            category="INGESTION",
            priority="HIGH",
            message="Dataset is empty.",
            suggestion="Verify data extraction and upstream export pipelines to ensure records are populated."
        ))
        return recs

    # Duplicate rows recommendation
    if summary.duplicate_row_count > 0:
        recs.append(Recommendation(
            category="UNIQUENESS",
            priority="HIGH" if summary.duplicate_row_percentage > 10.0 else "MEDIUM",
            message=f"Dataset contains {summary.duplicate_row_count} duplicate rows ({summary.duplicate_row_percentage}%).",
            suggestion="Review ingestion pipeline logic and apply deduplication or primary key constraints."
        ))

    # Column specific recommendations
    for issue in issues:
        if issue.type == "EMPTY_COLUMN" and issue.column:
            recs.append(Recommendation(
                category="COMPLETENESS",
                priority="HIGH",
                column=issue.column,
                message=f"Column '{issue.column}' is 100% null.",
                suggestion=f"Remove '{issue.column}' from downstream models or investigate missing upstream data source."
            ))
        elif issue.type in ("CRITICAL_MISSINGNESS", "HIGH_MISSINGNESS") and issue.column:
            recs.append(Recommendation(
                category="COMPLETENESS",
                priority="HIGH" if issue.type == "CRITICAL_MISSINGNESS" else "MEDIUM",
                column=issue.column,
                message=f"Column '{issue.column}' has {issue.affected_percentage}% missing values.",
                suggestion=f"Investigate upstream data collection for '{issue.column}' and define an appropriate imputation or default value strategy."
            ))
        elif issue.type == "CONSTANT_COLUMN" and issue.column:
            recs.append(Recommendation(
                category="VALIDITY",
                priority="LOW",
                column=issue.column,
                message=f"Column '{issue.column}' contains a constant value across all records.",
                suggestion=f"Consider dropping '{issue.column}' prior to machine learning model training as it provides zero variance."
            ))
        elif issue.type == "TYPE_INCONSISTENCY" and issue.column:
            recs.append(Recommendation(
                category="CONSISTENCY",
                priority="MEDIUM",
                column=issue.column,
                message=f"Column '{issue.column}' has numeric values stored as strings/text.",
                suggestion=f"Cast column '{issue.column}' to a numeric data type during ingestion to enable statistical operations and indexing."
            ))

    # Outlier recommendations
    for o in outliers:
        if o.outlier_percentage > 5.0:
            recs.append(Recommendation(
                category="ANOMALY",
                priority="MEDIUM",
                column=o.column,
                message=f"Column '{o.column}' has {o.outlier_count} statistical outliers ({o.outlier_percentage}% of column).",
                suggestion=f"Review domain-specific upper ({o.upper_bound}) and lower ({o.lower_bound}) thresholds for '{o.column}' and evaluate robust scaling or winsorization."
            ))

    if not recs:
        recs.append(Recommendation(
            category="HEALTH",
            priority="LOW",
            message="No significant quality defects detected.",
            suggestion="Dataset structure is clean. Proceed with downstream processing and analytical workloads."
        ))

    return recs
