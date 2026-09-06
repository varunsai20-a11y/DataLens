from typing import List
from .models import QualityScore, ScoreDimensions, DatasetSummary, QualityIssue, OutlierReport, ColumnProfile

def calculate_quality_score(
    summary: DatasetSummary,
    profiles: List[ColumnProfile],
    issues: List[QualityIssue],
    outliers: List[OutlierReport]
) -> QualityScore:
    if summary.row_count == 0 or summary.column_count == 0:
        dims = ScoreDimensions(
            completeness=0.0,
            validity=0.0,
            uniqueness=0.0,
            consistency=0.0,
            outlier_quality=0.0
        )
        return QualityScore(overall=0.0, dimensions=dims, grade="F")

    # 1. Completeness Dimension (0 - 100)
    # Penalty scaled by total missingness percentage
    missing_pct = summary.total_missing_percentage
    completeness = max(0.0, min(100.0, 100.0 - (missing_pct * 1.5)))

    # 2. Validity Dimension (0 - 100)
    # Penalize empty columns, constant columns, and critical issues
    validity_penalty = 0.0
    for issue in issues:
        if issue.type == "EMPTY_COLUMN":
            validity_penalty += 20.0
        elif issue.type == "CRITICAL_MISSINGNESS":
            validity_penalty += 10.0
        elif issue.type == "CONSTANT_COLUMN":
            validity_penalty += 5.0
    validity = max(0.0, min(100.0, 100.0 - validity_penalty))

    # 3. Uniqueness Dimension (0 - 100)
    # Penalize duplicate rows
    dupe_pct = summary.duplicate_row_percentage
    uniqueness = max(0.0, min(100.0, 100.0 - (dupe_pct * 2.0)))

    # 4. Consistency Dimension (0 - 100)
    # Penalize type inconsistencies
    consistency_penalty = 0.0
    for issue in issues:
        if issue.type == "TYPE_INCONSISTENCY":
            consistency_penalty += 10.0
    consistency = max(0.0, min(100.0, 100.0 - consistency_penalty))

    # 5. Outlier Quality Dimension (0 - 100)
    # Calculate percentage of values that are statistical outliers
    num_cols = sum(1 for p in profiles if p.min is not None and p.max is not None)
    total_outlier_count = sum(o.outlier_count for o in outliers)
    total_numeric_values = num_cols * summary.row_count

    if total_numeric_values > 0:
        outlier_rate = (total_outlier_count / total_numeric_values) * 100.0
        outlier_quality = max(0.0, min(100.0, 100.0 - (outlier_rate * 2.5)))
    else:
        outlier_quality = 100.0

    # Weighted Overall Score
    overall = (
        (completeness * 0.30) +
        (validity * 0.20) +
        (uniqueness * 0.20) +
        (consistency * 0.15) +
        (outlier_quality * 0.15)
    )

    overall = round(overall, 2)
    dimensions = ScoreDimensions(
        completeness=round(completeness, 2),
        validity=round(validity, 2),
        uniqueness=round(uniqueness, 2),
        consistency=round(consistency, 2),
        outlier_quality=round(outlier_quality, 2)
    )

    if overall >= 90.0:
        grade = "A"
    elif overall >= 80.0:
        grade = "B"
    elif overall >= 70.0:
        grade = "C"
    elif overall >= 60.0:
        grade = "D"
    else:
        grade = "F"

    return QualityScore(overall=overall, dimensions=dimensions, grade=grade)
