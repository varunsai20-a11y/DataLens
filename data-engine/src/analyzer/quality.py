import pandas as pd
import numpy as np
from typing import List
from .models import QualityIssue, ColumnProfile, DatasetSummary

def detect_quality_issues(df: pd.DataFrame, summary: DatasetSummary, profiles: List[ColumnProfile]) -> List[QualityIssue]:
    issues: List[QualityIssue] = []
    row_count = summary.row_count

    if row_count == 0:
        issues.append(QualityIssue(
            type="EMPTY_DATASET",
            severity="CRITICAL",
            column=None,
            affected_rows=0,
            affected_percentage=100.0,
            message="The dataset contains zero rows.",
            details={}
        ))
        return issues

    # 1. Duplicate rows
    if summary.duplicate_row_count > 0:
        severity = "HIGH" if summary.duplicate_row_percentage > 20.0 else ("MEDIUM" if summary.duplicate_row_percentage > 5.0 else "LOW")
        issues.append(QualityIssue(
            type="DUPLICATE_ROWS",
            severity=severity,
            column=None,
            affected_rows=summary.duplicate_row_count,
            affected_percentage=summary.duplicate_row_percentage,
            message=f"Found {summary.duplicate_row_count} duplicate rows ({summary.duplicate_row_percentage}% of dataset).",
            details={"duplicate_count": summary.duplicate_row_count}
        ))

    for p in profiles:
        # 2. Empty columns (100% missing)
        if p.missing_percentage == 100.0:
            issues.append(QualityIssue(
                type="EMPTY_COLUMN",
                severity="CRITICAL",
                column=p.name,
                affected_rows=row_count,
                affected_percentage=100.0,
                message=f"Column '{p.name}' is completely empty (100% null values).",
                details={"missing_count": p.missing_count}
            ))
            continue

        # 3. Missing values
        if p.missing_percentage >= 50.0:
            issues.append(QualityIssue(
                type="CRITICAL_MISSINGNESS",
                severity="CRITICAL",
                column=p.name,
                affected_rows=p.missing_count,
                affected_percentage=p.missing_percentage,
                message=f"Column '{p.name}' has critical missingness ({p.missing_percentage}% null values).",
                details={"missing_count": p.missing_count}
            ))
        elif p.missing_percentage >= 20.0:
            issues.append(QualityIssue(
                type="HIGH_MISSINGNESS",
                severity="HIGH",
                column=p.name,
                affected_rows=p.missing_count,
                affected_percentage=p.missing_percentage,
                message=f"Column '{p.name}' has high missingness ({p.missing_percentage}% null values).",
                details={"missing_count": p.missing_count}
            ))
        elif p.missing_percentage >= 5.0:
            issues.append(QualityIssue(
                type="MODERATE_MISSINGNESS",
                severity="MEDIUM",
                column=p.name,
                affected_rows=p.missing_count,
                affected_percentage=p.missing_percentage,
                message=f"Column '{p.name}' has moderate missingness ({p.missing_percentage}% null values).",
                details={"missing_count": p.missing_count}
            ))

        # 4. Constant columns (cardinality == 1)
        if p.unique_count == 1 and p.missing_count < row_count:
            issues.append(QualityIssue(
                type="CONSTANT_COLUMN",
                severity="MEDIUM",
                column=p.name,
                affected_rows=row_count - p.missing_count,
                affected_percentage=round((row_count - p.missing_count) / row_count * 100.0, 2),
                message=f"Column '{p.name}' contains a constant value across all non-null rows.",
                details={"unique_values": 1}
            ))

        # 5. Suspicious high cardinality in text/object columns (like UUID or ID in categorical fields)
        if p.inferred_type == "string" and row_count > 50 and p.uniqueness_percentage > 95.0:
            issues.append(QualityIssue(
                type="HIGH_CARDINALITY",
                severity="LOW",
                column=p.name,
                affected_rows=p.unique_count,
                affected_percentage=p.uniqueness_percentage,
                message=f"Column '{p.name}' has very high cardinality ({p.uniqueness_percentage}% unique values). Check if this is an identifier.",
                details={"unique_count": p.unique_count}
            ))

        # 6. Type inconsistency / numeric strings
        if p.inferred_type == "numeric_string":
            issues.append(QualityIssue(
                type="TYPE_INCONSISTENCY",
                severity="MEDIUM",
                column=p.name,
                affected_rows=row_count - p.missing_count,
                affected_percentage=round((row_count - p.missing_count) / row_count * 100.0, 2),
                message=f"Column '{p.name}' contains numeric values stored as text/strings.",
                details={"suggested_type": "numeric"}
            ))

    return issues
