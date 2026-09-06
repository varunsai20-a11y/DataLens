# DataLens Data Pipeline Specification

## 1. Pipeline Overview
The data pipeline is the core engine of DataLens. It transforms a raw data file into a structured quality report.

### Pipeline Sequence
`Dataset File` $\rightarrow$ `Profiling` $\rightarrow$ `Quality Analysis` $\rightarrow$ `Anomaly Detection` $\rightarrow$ `Quality Scoring` $\rightarrow$ `AI Recommendation` $\rightarrow$ `Final Result`

## 2. Pipeline Stages

### 2.1 Stage 1: Dataset Profiling (Deterministic)
- **Objective**: Understand the basic shape and distribution of the data.
- **Operations**:
  - Type inference for every column.
  - Basic stats: Count, Unique, Nulls, Min, Max, Mean, Median, StdDev, Quantiles.
  - Distribution analysis: Histogram bins for numerical data.

### 2.2 Stage 2: Quality Analysis (Deterministic)
- **Objective**: Identify objective failures in data integrity.
- **Checks**:
  - **Missing Value Detection**: Calculate percentage of nulls per column.
  - **Duplicate Detection**: Count exact row duplicates.
  - **Invalid Value Detection**: Identify values outside expected ranges (e.g., negative age).
  - **Constant Column Detection**: Identify columns where all values are identical.
  - **Cardinality Analysis**: Flag high-cardinality columns that might be IDs or low-cardinality columns that should be categories.

### 2.3 Stage 3: Anomaly Detection (Statistical)
- **Objective**: Find "weird" data points that don't fit the pattern.
- **Methods**:
  - **Outlier Detection**: Use Z-score (for Gaussian distributions) or IQR (for non-Gaussian).
  - **Statistical Anomaly**: Use Isolation Forest or Local Outlier Factor for multi-dimensional anomalies.
  - **Data Drift**: Use the Kolmogorov-Smirnov (K-S) test to compare distributions between two dataset versions.

### 2.4 Stage 4: Quality Scoring (Algorithmic)
- **Objective**: Provide a single, human-readable health metric.
- **Logic**:
  - Start with $100\%$.
  - Deduct points based on weighted penalties:
    - Missingness penalty: $\text{percentage\_missing} \times \text{weight}_{nulls}$
    - Duplicate penalty: $\text{percentage\_duplicates} \times \text{weight}_{dupes}$
    - Anomaly penalty: $\text{outlier\_count} \times \text{weight}_{outliers}$
  - Final Score = $\max(0, 100 - \text{total\_penalties})$.

### 2.5 Stage 5: AI Recommendation (Generative)
- **Objective**: Explain the *why* and *how* to fix.
- **Process**:
  - Input: The JSON output of Stages 1-4.
  - LLM Prompt: "Given these statistical findings [JSON], provide 3 actionable, human-readable recommendations to improve data quality."
  - Output: A list of recommendations stored in the `analysis_results` table.

## 3. Data Engine Implementation (Python/Flask)
- **Library Stack**: `Pandas` for manipulation, `NumPy` for math, `Scikit-learn` for anomaly detection.
- **Memory Management**:
  - Use chunking for very large files.
  - Explicitly delete large dataframes after computation.
  - Use `dtype` optimization during load.

## 4. Determinism Guarantee
To prevent "AI Hallucinations" in data reports:
- **NO** LLM is used to calculate percentages, means, or outlier counts.
- **ONLY** the AI Recommendation stage uses generative AI.
- All metrics must be derived from Pandas/NumPy.
