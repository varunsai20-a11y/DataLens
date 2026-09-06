import unittest
import json
import requests

class TestDataEngineInfra(unittest.TestCase):
    BASE_URL = "http://localhost:5000"

    def test_health(self):
        response = requests.get(f"{self.BASE_URL}/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], "UP")

    def test_ready(self):
        # Note: This test requires the engine to be running locally
        try:
            response = requests.get(f"{self.BASE_URL}/ready")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.json()['status'], "READY")
        except requests.exceptions.ConnectionError:
            self.skipTest("Data Engine not running")

if __name__ == '__main__':
    unittest.main()
