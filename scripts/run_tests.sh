"""
Final comprehensive test coverage report
"""

# Generate coverage report
pytest tests/ --cov=. --cov-report=html --cov-report=term-missing
