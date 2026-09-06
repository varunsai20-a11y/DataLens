import pandas as pd
import numpy as np
from typing import Tuple, List, Dict, Any
from .models import DatasetSummary, ColumnProfile

def infer_column_type(series: pd.Series) -> str:
    # Drop nulls for type inference
    non_null = series.dropna()
    if len(non_null) == 0:
        return "empty"

    # Check for boolean
    if pd.api.types.is_bool_dtype(series):
        return "boolean"

    # Check for datetime
    if pd.api.types.is_datetime64_any_dtype(series):
        return "datetime"

    # Check for integer
    if pd.api.types.is_integer_dtype(series):
        return "integer"

    # Check for float
    if pd.api.types.is_float_dtype(series):
        return "float"

    # Try datetime parse for string
    if pd.api.types.is_string_dtype(series) or pd.api.types.is_object_dtype(series):
        # Sample check for boolean strings
        sample = non_null.head(100).astype(str).str.strip().str.lower()
        if sample.isin(["true", "false", "yes", "no", "1", "0", "t", "f"]).all():
            return "boolean_string"

        # Try converting sample to numeric
        try:
            pd.to_numeric(non_null.head(50))
            return "numeric_string"
        except (ValueError, TypeError):
            pass

        # Try converting sample to datetime
        try:
            pd.to_datetime(non_null.head(50))
            return "datetime"
        except (ValueError, TypeError, UserWarning):
            pass

        return "string"

    return str(series.dtype)

def profile_dataset(df: pd.DataFrame) -> Tuple[DatasetSummary, List[ColumnProfile]]:
    row_count = len(df)
    col_count = len(df.columns)
    total_cells = row_count * col_count

    # Calculate duplicate rows
    duplicate_rows = int(df.duplicated().sum())
    duplicate_row_percentage = round((duplicate_rows / row_count * 100.0), 2) if row_count > 0 else 0.0

    # Total missing cells
    total_missing_cells = int(df.isna().sum().sum())
    total_missing_percentage = round((total_missing_cells / total_cells * 100.0), 2) if total_cells > 0 else 0.0

    # Memory usage
    memory_usage_bytes = int(df.memory_usage(deep=True).sum())

    summary = DatasetSummary(
        row_count=row_count,
        column_count=col_count,
        duplicate_row_count=duplicate_rows,
        duplicate_row_percentage=duplicate_row_percentage,
        total_cells=total_cells,
        total_missing_cells=total_missing_cells,
        total_missing_percentage=total_missing_percentage,
        memory_usage_bytes=memory_usage_bytes
    )

    column_profiles: List[ColumnProfile] = []

    for col in df.columns:
        series = df[col]
        missing_cnt = int(series.isna().sum())
        missing_pct = round((missing_cnt / row_count * 100.0), 2) if row_count > 0 else 0.0
        unique_cnt = int(series.nunique(dropna=True))
        uniqueness_pct = round((unique_cnt / row_count * 100.0), 2) if row_count > 0 else 0.0
        inferred = infer_column_type(series)

        profile = ColumnProfile(
            name=str(col),
            dtype=str(series.dtype),
            inferred_type=inferred,
            total_count=row_count,
            missing_count=missing_cnt,
            missing_percentage=missing_pct,
            unique_count=unique_cnt,
            uniqueness_percentage=uniqueness_pct
        )

        # Numerical statistics
        if pd.api.types.is_numeric_dtype(series) and not pd.api.types.is_bool_dtype(series):
            valid_nums = series.dropna()
            if len(valid_nums) > 0:
                profile.min = float(valid_nums.min())
                profile.max = float(valid_nums.max())
                profile.mean = round(float(valid_nums.mean()), 4)
                profile.median = round(float(valid_nums.median()), 4)
                profile.std = round(float(valid_nums.std()), 4) if len(valid_nums) > 1 else 0.0
                profile.q1 = round(float(valid_nums.quantile(0.25)), 4)
                profile.q3 = round(float(valid_nums.quantile(0.75)), 4)
        else:
            # Top values bounded to 10
            val_counts = series.value_counts(dropna=True).head(10)
            top_vals: List[Dict[str, Any]] = []
            for val, count in val_counts.items():
                top_vals.append({
                    "value": str(val),
                    "count": int(count),
                    "percentage": round(float(count) / row_count * 100.0, 2) if row_count > 0 else 0.0
                })
            profile.top_values = top_vals

        column_profiles.append(profile)

    return summary, column_profiles
