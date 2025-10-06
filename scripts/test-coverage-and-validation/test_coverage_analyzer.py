#!/usr/bin/env python3
"""
AI Test Coverage Analyzer
Analyzes C# source code and generates comprehensive test coverage reports using AI
"""

import os
import sys
import argparse
import requests
from typing import List, Dict, Optional

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    import codecs
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


def find_cs_files(root: str) -> List[str]:
    """Find all C# source files excluding test files"""
    cs_files = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d.lower() not in ("bin", "obj", "migrations")]
        for f in files:
            if f.endswith(".cs") and not (f.endswith("Tests.cs") or f.endswith("Test.cs")):
                cs_files.append(os.path.join(dirpath, f))
    return cs_files


def find_test_files(root: str) -> List[str]:
    """Find all test files"""
    test_files = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d.lower() not in ("bin", "obj", "migrations")]
        for f in files:
            if f.endswith("Tests.cs") or f.endswith("Test.cs"):
                test_files.append(os.path.join(dirpath, f))
    return test_files


def read_file(path: str) -> str:
    """Read file content safely"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def call_llm(messages: List[Dict], api_key: str, base_url: str) -> str:
    """Call AI API to analyze code"""
    headers = {
        "Content-Type": "application/json",
        "Api-Key": api_key
    }
    payload = {
        "messages": messages,
        "temperature": 0,
    }
    resp = requests.post(base_url, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def analyze_and_generate_tests(source_path: str, test_path: Optional[str], api_key: str, base_url: str, root_dir: str) -> str:
    """Analyze source code and generate test cases using AI"""
    source_code = read_file(source_path)
    test_code = read_file(test_path) if test_path else "No test file found."
    
    relative_source = os.path.relpath(source_path, root_dir)
    
    prompt = (
        "You are an expert C# developer and test engineer. "
        "Analyze the following C# source code and its test file (if any). "
        "Identify missing or weakly tested logic, and generate xUnit or NUnit test cases to improve coverage. "
        "If no test file exists, generate a new one. "
        "Be thorough and include edge cases and error handling. "
        "Focus on business logic, integration points, and error scenarios.\n\n"
        f"Source file:\n{source_code}\n\n"
        f"Test file:\n{test_code}\n"
        "\n---\n"
        "Additionally, after generating the tests, count the total number of test cases present, "
        "count how many test cases are newly added (AI generated), and provide a summary report with these counts. "
        "Format the summary as follows (replace N with the actual numbers):\n"
        "- **Test Cases Found**: N\n"
        "- **New Test Cases Added**: N\n"
        "- **Summary**: <your summary here>\n"
    )
    
    messages = [{"role": "user", "content": prompt}]
    return call_llm(messages, api_key, base_url)


def map_sources_to_tests(cs_files: List[str], test_files: List[str]) -> Dict[str, Optional[str]]:
    """Map source files to their corresponding test files"""
    mapping = {}
    test_file_set = {os.path.basename(f): f for f in test_files}
    
    for src in cs_files:
        base = os.path.basename(src)
        test_name1 = base.replace('.cs', 'Tests.cs')
        test_name2 = base.replace('.cs', 'Test.cs')
        mapping[src] = test_file_set.get(test_name1) or test_file_set.get(test_name2)
    
    return mapping


def generate_markdown_report(report: List[Dict], output_path: str, repo_url: str, root_dir: str):
    """Generate markdown test coverage report"""
    import time
    
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("# AI Test Coverage Report\n\n")
        f.write(f"**Repository:** {repo_url}\n\n")
        f.write(f"**Generated:** {time.strftime('%Y-%m-%d %H:%M:%S')}\n\n")
        f.write("---\n\n")
        
        # Summary section
        total_found = 0
        total_new = 0
        for entry in report:
            analysis = entry['generated_tests']
            import re
            found_match = re.search(r'\*\*Test Cases Found\*\*:\s*(\d+)', analysis)
            new_match = re.search(r'\*\*New Test Cases Added\*\*:\s*(\d+)', analysis)
            if found_match:
                total_found += int(found_match.group(1))
            if new_match:
                total_new += int(new_match.group(1))
        
        f.write("## Summary\n\n")
        f.write(f"- **Total Files Analyzed:** {len(report)}\n")
        f.write(f"- **Total Original Test Cases:** {total_found}\n")
        f.write(f"- **Total New Test Cases Added:** {total_new}\n")
        f.write(f"- **Total Test Cases After Improvements:** {total_found + total_new}\n\n")
        f.write("---\n\n")
        
        # File-by-file analysis
        for entry in report:
            source_rel = os.path.relpath(entry['source'], root_dir)
            test_rel = os.path.relpath(entry['test'], root_dir) if entry['test'] else 'None'
            
            f.write(f"## {source_rel}\n")
            f.write(f"**Test file:** {test_rel}\n\n")
            f.write("### Analysis and Generated Tests\n")
            f.write("```csharp\n")
            f.write(entry['generated_tests'])
            f.write("\n```\n\n")
    
    print(f"✅ Test Coverage Report generated: {output_path}")


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='AI Test Coverage Analyzer for C# projects')
    parser.add_argument('--repo-path', required=True, help='Path to the cloned repository')
    parser.add_argument('--repo-url', required=True, help='Repository URL')
    parser.add_argument('--api-key', required=True, help='AI API key')
    parser.add_argument('--base-url', required=True, help='AI API base URL')
    parser.add_argument('--model', help='AI model name (optional)')
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Fail fast if AI is not configured
    if not args.api_key:
        print("ERROR: AI API key is required. Cannot proceed without AI configuration.", file=sys.stderr)
        sys.exit(1)
    
    root_dir = args.repo_path
    if not os.path.isdir(root_dir):
        print(f"ERROR: Provided path is not a directory or doesn't exist: {root_dir}", file=sys.stderr)
        sys.exit(1)
    
    try:
        print(f"🔍 Scanning repository: {root_dir}")
        cs_files = find_cs_files(root_dir)
        test_files = find_test_files(root_dir)
        
        print(f"📁 Found {len(cs_files)} source files")
        print(f"🧪 Found {len(test_files)} test files")
        
        mapping = map_sources_to_tests(cs_files, test_files)
        
        report = []
        for idx, (src, test) in enumerate(mapping.items(), 1):
            print(f"🤖 Analyzing {idx}/{len(mapping)}: {os.path.relpath(src, root_dir)} ...")
            
            try:
                generated_tests = analyze_and_generate_tests(src, test, args.api_key, args.base_url, root_dir)
                test_path = test or os.path.join(os.path.dirname(src), os.path.basename(src).replace('.cs', 'Tests.cs'))
                
                report.append({
                    "source": src,
                    "test": test_path,
                    "generated_tests": generated_tests
                })
            except Exception as e:
                error_msg = str(e)
                if "connection" in error_msg.lower() or "network" in error_msg.lower() or "timeout" in error_msg.lower():
                    print(f"ERROR: Network connection failed. Please check your VPN connection and try again. Details: {e}", file=sys.stderr)
                else:
                    print(f"ERROR: AI API call failed for {src}: {e}", file=sys.stderr)
                # Continue with other files even if one fails
                continue
        
        # Generate markdown report
        import time
        analysis_id = str(int(time.time() * 1000))
        md_report = os.path.join(root_dir, f"test-coverage-report-{analysis_id}.md")
        
        generate_markdown_report(report, md_report, args.repo_url, root_dir)
        
        print(f"✅ Analysis complete. Generated report: {md_report}")
        
    except Exception as e:
        # Catch all errors including network/VPN failures
        error_msg = str(e)
        if "connection" in error_msg.lower() or "network" in error_msg.lower() or "timeout" in error_msg.lower():
            print(f"ERROR: Network connection failed. Please check your VPN connection and try again. Details: {e}", file=sys.stderr)
        else:
            print(f"ERROR: Test coverage analysis failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
