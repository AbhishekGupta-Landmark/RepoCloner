#!/usr/bin/env python3
"""
Test Report Statistics Extractor
Extracts test statistics from markdown test coverage reports
"""

import re
from typing import Tuple


def extract_test_stats(md_path: str) -> Tuple[int, int, int, int]:
    """
    Extracts test statistics from the markdown report.
    Returns: (total_found, coverage_percent, new_added, new_coverage_percent)
    """
    total_found = 0
    new_added = 0
    coverage_percent = 0
    new_coverage_percent = 0
    
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Extract all summary lines for test cases found and new test cases added
    found_matches = re.findall(r'Test Cases Found\s*[:=]\s*(\d+)', content)
    new_matches = re.findall(r'New Test Cases Added\s*[:=]\s*(\d+)', content)

    # Also match lines like: **Test Cases Found**: 0
    found_matches += re.findall(r'\*\*Test Cases Found\*\*:\s*(\d+)', content)
    new_matches += re.findall(r'\*\*New Test Cases Added\*\*:\s*(\d+)', content)

    # Also match lines like: - **Test Cases Found**: 0
    found_matches += re.findall(r'-\s*\*\*Test Cases Found\*\*:\s*(\d+)', content)
    new_matches += re.findall(r'-\s*\*\*New Test Cases Added\*\*:\s*(\d+)', content)

    # Also match lines like: **Total Original Test Cases**: **9**
    found_matches += re.findall(r'Total Original Test Cases\*\*:\s*\*\*(\d+)', content)
    # Also match: **Total New Test Cases Added**: **16**
    new_matches += re.findall(r'Total New Test Cases Added\*\*:\s*\*\*(\d+)', content)

    # Sum all found and new test cases
    total_found = sum(int(x) for x in found_matches)
    new_added = sum(int(x) for x in new_matches)

    # Calculate coverage percentages
    total_tests = total_found + new_added
    if total_tests > 0:
        coverage_percent = int(round(100 * total_found / total_tests))
        new_coverage_percent = int(round(100 * new_added / total_tests))
    
    return total_found, coverage_percent, new_added, new_coverage_percent
