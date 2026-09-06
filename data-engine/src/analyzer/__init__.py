import os
import pandas as pd
from typing import Dict, Any
from .models import AnalysisReport, DatasetSummary, QualityScore, ScoreDimensions
from .profiler import profile_dataset
from .quality import detect_quality_issues
from .outliers import detect_outliers
from .scoring import calculate_quality_score
from .recommendations import generate_recommendations

ANALYSIS_VERSION = "1.0.0"

def analyze_file(file_path: str) -> Dict[str, Any]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    # Check if file is empty
    if os.path.getsize(file_path) == 0:
        summary = DatasetSummary(
            row_count=0,
            column_count=0,
            duplicate_row_count=0,
            duplicate_row_percentage=0.0,
            total_cells=0,
            total_missing_cells=0,
            total_missing_percentage=0.0,
            memory_usage_bytes=0
        )
        report = AnalysisReport(
            analysis_version=ANALYSIS_VERSION,
            summary=summary,
            columns=[],
            quality_issues=detect_quality_issues(pd.DataFrame(), summary, []),
            outliers=[],
            score=calculate_quality_score(summary, [], [], []),
            recommendations=generate_recommendations(summary, [], [], [])
        )
        return report.to_dict()

    ext = os.path.splitext(file_path)[1].lower()
    try:
        if ext in ('.parquet', '.pq'):
            df = pd.read_parquet(file_path)
        else:
            df = pd.read_csv(file_path, low_memory=False)
    except Exception as e:
        raise ValueError(f"Failed to parse dataset file ({ext}): {str(e)}")

    summary, profiles = profile_dataset(df)
    issues = detect_quality_issues(df, summary, profiles)
    outliers = detect_outliers(df, profiles)
    score = calculate_quality_score(summary, profiles, issues, outliers)
    recommendations = generate_recommendations(summary, profiles, issues, outliers)

    report = AnalysisReport(
        analysis_version=ANALYSIS_VERSION,
        summary=summary,
        columns=profiles,
        quality_issues=issues,
        outliers=outliers,
        score=score,
        recommendations=recommendations
    )

    return report.to_dict()
