from dataclasses import dataclass, asdict, field
from typing import List, Dict, Any, Optional

@dataclass
class ColumnProfile:
    name: str
    dtype: str
    inferred_type: str
    total_count: int
    missing_count: int
    missing_percentage: float
    unique_count: int
    uniqueness_percentage: float
    # Numerical statistics
    min: Optional[float] = None
    max: Optional[float] = None
    mean: Optional[float] = None
    median: Optional[float] = None
    std: Optional[float] = None
    q1: Optional[float] = None
    q3: Optional[float] = None
    # Categorical statistics
    top_values: Optional[List[Dict[str, Any]]] = None

@dataclass
class QualityIssue:
    type: str
    severity: str  # CRITICAL, HIGH, MEDIUM, LOW
    column: Optional[str]
    affected_rows: int
    affected_percentage: float
    message: str
    details: Dict[str, Any] = field(default_factory=dict)

@dataclass
class OutlierReport:
    column: str
    method: str
    outlier_count: int
    outlier_percentage: float
    lower_bound: float
    upper_bound: float
    sample_outliers: List[float]

@dataclass
class ScoreDimensions:
    completeness: float
    validity: float
    uniqueness: float
    consistency: float
    outlier_quality: float

@dataclass
class QualityScore:
    overall: float
    dimensions: ScoreDimensions
    grade: str

@dataclass
class Recommendation:
    category: str
    priority: str  # HIGH, MEDIUM, LOW
    message: str
    suggestion: str
    column: Optional[str] = None

@dataclass
class DatasetSummary:
    row_count: int
    column_count: int
    duplicate_row_count: int
    duplicate_row_percentage: float
    total_cells: int
    total_missing_cells: int
    total_missing_percentage: float
    memory_usage_bytes: int

@dataclass
class AnalysisReport:
    analysis_version: str
    summary: DatasetSummary
    columns: List[ColumnProfile]
    quality_issues: List[QualityIssue]
    outliers: List[OutlierReport]
    score: QualityScore
    recommendations: List[Recommendation]

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
