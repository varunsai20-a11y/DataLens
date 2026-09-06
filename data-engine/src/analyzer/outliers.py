import pandas as pd
import numpy as np
from typing import List
from .models import OutlierReport, ColumnProfile

def detect_outliers(df: pd.DataFrame, profiles: List[ColumnProfile]) -> List[OutlierReport]:
    reports: List[OutlierReport] = []

    for p in profiles:
        if p.min is None or p.max is None or p.q1 is None or p.q3 is None:
            continue

        series = df[p.name].dropna()
        if len(series) < 5:  # Not enough data for meaningful outlier detection
            continue

        # IQR method
        q1 = p.q1
        q3 = p.q3
        iqr = q3 - q1

        if iqr == 0:
            # If IQR is 0, we can fall back to Z-score if std > 0
            if p.std and p.std > 0 and p.mean is not None:
                z_scores = np.abs((series - p.mean) / p.std)
                outliers = series[z_scores > 3.0]
                outlier_cnt = int(len(outliers))
                if outlier_cnt > 0:
                    outlier_pct = round(outlier_cnt / len(series) * 100.0, 2)
                    sample_vals = [float(x) for x in outliers.head(10).tolist()]
                    reports.append(OutlierReport(
                        column=p.name,
                        method="Z_SCORE",
                        outlier_count=outlier_cnt,
                        outlier_percentage=outlier_pct,
                        lower_bound=round(float(p.mean - 3 * p.std), 4),
                        upper_bound=round(float(p.mean + 3 * p.std), 4),
                        sample_outliers=sample_vals
                    ))
            continue

        lower_bound = q1 - 1.5 * iqr
        upper_bound = q3 + 1.5 * iqr

        outliers = series[(series < lower_bound) | (series > upper_bound)]
        outlier_cnt = int(len(outliers))

        if outlier_cnt > 0:
            outlier_pct = round(outlier_cnt / len(series) * 100.0, 2)
            sample_vals = [float(x) for x in outliers.head(10).tolist()]
            reports.append(OutlierReport(
                column=p.name,
                method="IQR",
                outlier_count=outlier_cnt,
                outlier_percentage=outlier_pct,
                lower_bound=round(float(lower_bound), 4),
                upper_bound=round(float(upper_bound), 4),
                sample_outliers=sample_vals
            ))

    return reports
