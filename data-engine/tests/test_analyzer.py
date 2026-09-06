import unittest
import os
import tempfile
import pandas as pd
import numpy as np
import sys

# Add src to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'src')))

from analyzer import analyze_file
from analyzer.profiler import profile_dataset
from analyzer.quality import detect_quality_issues
from analyzer.outliers import detect_outliers
from analyzer.scoring import calculate_quality_score

class TestDatasetAnalyzer(unittest.TestCase):

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self):
        for f in os.listdir(self.temp_dir):
            os.remove(os.path.join(self.temp_dir, f))
        os.rmdir(self.temp_dir)

    def _create_csv(self, filename: str, data: dict) -> str:
        df = pd.DataFrame(data)
        path = os.path.join(self.temp_dir, filename)
        df.to_csv(path, index=False)
        return path

    def test_clean_dataset_analysis(self):
        path = self._create_csv("clean.csv", {
            "id": list(range(1, 101)),
            "age": [20 + (i % 50) for i in range(100)],
            "salary": [30000 + (i * 500) for i in range(100)],
            "department": ["Engineering" if i % 2 == 0 else "Marketing" for i in range(100)]
        })

        report = analyze_file(path)
        self.assertEqual(report["summary"]["row_count"], 100)
        self.assertEqual(report["summary"]["column_count"], 4)
        self.assertEqual(report["summary"]["duplicate_row_count"], 0)
        self.assertGreaterEqual(report["score"]["overall"], 95.0)
        self.assertEqual(report["score"]["grade"], "A")

    def test_missing_values_detection_and_penalty(self):
        clean_path = self._create_csv("clean.csv", {
            "a": list(range(100)),
            "b": list(range(100))
        })
        clean_report = analyze_file(clean_path)

        # Dataset with 40% missingness in column 'b'
        b_vals = [i if i < 60 else None for i in range(100)]
        dirty_path = self._create_csv("dirty.csv", {
            "a": list(range(100)),
            "b": b_vals
        })
        dirty_report = analyze_file(dirty_path)

        self.assertGreater(clean_report["score"]["overall"], dirty_report["score"]["overall"])
        self.assertGreater(
            clean_report["score"]["dimensions"]["completeness"],
            dirty_report["score"]["dimensions"]["completeness"]
        )
        issue_types = [issue["type"] for issue in dirty_report["quality_issues"]]
        self.assertIn("HIGH_MISSINGNESS", issue_types)

    def test_duplicate_rows_detection(self):
        path = self._create_csv("duplicates.csv", {
            "a": [1, 1, 1, 1, 2],
            "b": [10, 10, 10, 10, 20]
        })
        report = analyze_file(path)
        self.assertEqual(report["summary"]["duplicate_row_count"], 3)
        issue_types = [issue["type"] for issue in report["quality_issues"]]
        self.assertIn("DUPLICATE_ROWS", issue_types)
        self.assertLess(report["score"]["dimensions"]["uniqueness"], 100.0)

    def test_constant_column_detection(self):
        path = self._create_csv("constant.csv", {
            "id": list(range(50)),
            "country": ["USA"] * 50
        })
        report = analyze_file(path)
        issue_types = [issue["type"] for issue in report["quality_issues"]]
        self.assertIn("CONSTANT_COLUMN", issue_types)

    def test_outlier_detection(self):
        # Normal distribution with 3 extreme outliers
        values = list(np.random.normal(50, 5, 100))
        values[0] = 500.0  # Extreme outlier
        values[1] = 600.0  # Extreme outlier
        path = self._create_csv("outliers.csv", {"metric": values})

        report = analyze_file(path)
        self.assertGreaterEqual(len(report["outliers"]), 1)
        outlier_col = report["outliers"][0]
        self.assertEqual(outlier_col["column"], "metric")
        self.assertGreaterEqual(outlier_col["outlier_count"], 2)

    def test_empty_csv_handling(self):
        empty_path = os.path.join(self.temp_dir, "empty.csv")
        with open(empty_path, "w") as f:
            pass  # 0 bytes

        report = analyze_file(empty_path)
        self.assertEqual(report["summary"]["row_count"], 0)
        self.assertEqual(report["score"]["overall"], 0.0)

    def test_cleaner_dataset_scores_better(self):
        clean_path = self._create_csv("clean.csv", {
            "id": list(range(100)),
            "val": [10.0 + i for i in range(100)]
        })
        corrupted_path = self._create_csv("corrupted.csv", {
            "id": [1] * 100,  # Duplicate
            "val": [None] * 50 + [100000.0] * 50  # Missing + Outliers
        })

        clean_report = analyze_file(clean_path)
        corrupted_report = analyze_file(corrupted_path)

        self.assertGreater(clean_report["score"]["overall"], corrupted_report["score"]["overall"])

if __name__ == '__main__':
    unittest.main()
