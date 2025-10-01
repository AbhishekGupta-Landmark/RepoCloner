# ANALYSIS_ID: quick-migration
# ANALYSIS_LABEL: Quick Migration Analysis
import os
import re
import json
import sys
import argparse
from typing import List, Dict
from openai import AzureOpenAI

# ========== Configuration ==========

def parse_args():
    parser = argparse.ArgumentParser(description='GPT-4 assisted Kafka to Azure Service Bus migration analysis')
    parser.add_argument('repo_url', help='Repository URL to analyze')
    parser.add_argument('repo_path', help='Local path to cloned repository')
    parser.add_argument('--model', default='gpt-4o-mini-2024-07-18', help='AI model to use')
    parser.add_argument('--api-version', default='2024-02-01', help='API version')
    parser.add_argument('--base-url', default='https://ai-proxy.lab.epam.com', help='API endpoint URL')
    parser.add_argument('--api-key', required=True, help='AI API key (required)')
    return parser.parse_args()

# Max number of characters from a file snippet to send to GPT‑4
GPT4_SNIPPET_MAX_CHARS = 2000

# ========== File Scanning ==========

def scan_project_files(root_dir: str) -> Dict[str, List[str]]:
    """Scan and classify project files."""
    files = {
        "cs_files": [],
        "csproj_files": [],
        "config_files": [],
        "test_files": [],
        "startup_files": [],
        "infra_files": [],
        "doc_files": []
    }
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            full = os.path.join(dirpath, fname)
            if fname.lower().endswith(".cs"):
                files["cs_files"].append(full)
                if "test" in fname.lower() or "tests" in dirpath.lower():
                    files["test_files"].append(full)
                if fname.lower() in ("startup.cs", "program.cs"):
                    files["startup_files"].append(full)
            elif fname.lower().endswith(".csproj"):
                files["csproj_files"].append(full)
            elif fname.lower().startswith("appsettings") and fname.lower().endswith(".json"):
                files["config_files"].append(full)
            elif fname.lower().endswith((".yaml", ".yml", ".tf", ".dockerfile")) or "docker" in fname.lower():
                files["infra_files"].append(full)
            elif fname.lower().endswith((".md", ".txt")):
                files["doc_files"].append(full)
    return files

# ========== Manual Keyword-based Detection ==========

MANUAL_KAFKA_KEYWORDS = [
    "Confluent.Kafka",
    "ProducerBuilder",
    "ConsumerBuilder",
    "Consume(",
    "Subscribe(",
    "ProduceAsync(",
    "bootstrap.servers",
    "IKafkaProducer",
    "IKafkaConsumer"
]

def detect_config_keys(file_paths: List[str]) -> List[Dict[str, object]]:
    kafka_keys = []
    kafka_key_substrings = [
        "kafka", "bootstrapservers", "groupid", "enableautocommit",
        "autooffsetreset", "sasl", "kerberos", "partitioneof"
    ]

    def flatten_dict(d, parent_key=''):
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}:{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(flatten_dict(v, new_key).items())
            else:
                items.append((new_key.lower(), v))
        return dict(items)

    for file in file_paths:
        found_keys = set()
        try:
            if file.endswith(".json"):
                with open(file, "r", encoding="utf-8") as f:
                    try:
                        raw = f.read()
                        # Remove comments if any (not valid JSON)
                        raw = re.sub(r"//.*", "", raw)
                        data = json.loads(raw)
                        flat = flatten_dict(data)

                        for key in flat:
                            if any(sub in key for sub in kafka_key_substrings):
                                found_keys.add(key)
                    except json.JSONDecodeError:
                        continue
            elif file.endswith(".cs"):
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                    for keyword in kafka_key_substrings:
                        matches = re.findall(rf'["\']([^"\']*{keyword}[^"\']*)["\']', content, re.IGNORECASE)
                        for match in matches:
                            found_keys.add(match.strip('"\''))
        except Exception:
            continue

        if found_keys:
            kafka_keys.append({
                "file": file,
                "keys_to_migrate": sorted(found_keys)
            })

    return kafka_keys

def manual_detect_kafka(content: str) -> bool:
    for kw in MANUAL_KAFKA_KEYWORDS:
        if kw in content:
            return True
    return False

# ========== GPT‑4 Assisted Detection ==========

def ask_gpt4_for_kafka_usage(code_snippet: str, client: AzureOpenAI, model: str) -> Dict[str, str]:
    """Ask GPT‑4 whether the snippet uses Kafka, and what role(s).
Returns a dict like:
 {
   "uses_kafka": "yes" / "no" / "maybe",
   "role": "producer" / "consumer" / "both" / "unknown",
   "explanation": "..."
 }
"""
    
    # Craft the prompt
    prompt = f"""You are an expert in C# messaging systems. I will give you a code snippet in C#. 
Please analyze it and tell me:
1. Does it use Kafka? (yes / no / maybe)
2. If yes or maybe, is it acting as a producer, a consumer, or both?
3. What clues in the snippet point to that role (line numbers, methods, API names, etc.)?

Here is the snippet:

{code_snippet}
"""

    resp = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": "You are a helpful assistant for code analysis."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=200
    )

    content = resp.choices[0].message.content.strip()

    # Try parsing the JSON
    try:
        parsed = json.loads(content)
        return {
            "uses_kafka": parsed.get("uses_kafka", "unknown"),
            "role": parsed.get("role", "unknown"),
            "explanation": parsed.get("explanation", ""),
            "raw_response": parsed.get("explanation", "")
        }
    except json.JSONDecodeError:
        # Fallback: if GPT's output is not valid JSON, return raw response
        return {
            "uses_kafka": "unknown",
            "role": "unknown",
            "explanation": content,
            "raw_response": content
        }

def get_snippet_from_file(file_path: str, max_chars: int) -> str:
    """Return the first up to max_chars of the file for sending to GPT4."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = f.read()
            # If very long, maybe take middle or relevant sections
            if len(data) > max_chars:
                # Maybe take first and last parts
                return data[: max_chars//2] + "\n// ... (omitted) ...\n" + data[-max_chars//2 :]
            else:
                return data
    except Exception as e:
        return ""

# ========== .csproj NuGet Parsing ==========

def parse_csproj_nugets(csproj_file: str) -> List[Dict[str,str]]:
    results = []
    try:
        with open(csproj_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Simple regex
        matches = re.findall(r"<PackageReference Include=\"([^\"]+)\" Version=\"([^\"]+)\"", content, re.IGNORECASE)
        for pkg, version in matches:
            results.append({"package": pkg, "version": version})
    except Exception as e:
        print(f"Error parsing {csproj_file}: {e}", file=sys.stderr)
    return results

# ========== Report Generation ==========

def generate_report(root_dir: str, client: AzureOpenAI, model: str) -> Dict:
    files = scan_project_files(root_dir)
    report = {
        "manual_kafka_files": [],
        "gpt4_kafka_results": [],
        "csproj_changes": [],
        "unit_test_impact": [],
        "infra_files_kafka": [],
        "doc_references": [],
        "config_files": []
    }

    # Manual detection on .cs and config files
    for f in files["cs_files"] + files["config_files"]:
        try:
            with open(f, "r", encoding="utf-8") as rf:
                content = rf.read()
        except:
            continue

        if manual_detect_kafka(content):
            report["manual_kafka_files"].append(f)

    # GPT‑4 analysis for files flagged via manual detection OR startup / wrappers
    candidates = set(report["manual_kafka_files"])
    # also consider wrappers / startup files if not already included
    for f in files["startup_files"]:
        if f not in candidates:
            candidates.add(f)
    # maybe also test files
    for f in files["test_files"]:
        if f not in candidates:
            candidates.add(f)

    for f in list(candidates):
        snippet = get_snippet_from_file(f, GPT4_SNIPPET_MAX_CHARS)
        if snippet.strip() == "":
            continue
        result = ask_gpt4_for_kafka_usage(snippet, client, model)
        report["gpt4_kafka_results"].append({
            "file": f,
            "uses_kafka": result["uses_kafka"],
            "role": result["role"],
            "explanation": result["explanation"]    
        })

    # Parse csproj changes: remove Kafka packages
    for csproj in files["csproj_files"]:
        nugets = parse_csproj_nugets(csproj)
        for item in nugets:
            pkg = item["package"]
            version = item["version"]
            if "kafka" in pkg.lower() or "confluent.kafka" in pkg.lower():
                report["csproj_changes"].append({
                    "file": csproj,
                    "remove": f"{pkg} ({version})",
                    "add": "Azure.Messaging.ServiceBus (latest)"
                })

    # Unit tests impact
    for tf in files["test_files"]:
        try:
            with open(tf, "r", encoding="utf-8") as f:
                c = f.read()
        except:
            continue
        if manual_detect_kafka(c):
            report["unit_test_impact"].append({
                "file": tf,
                "note": "Contains Kafka usage — may need mocks or refactor for Service Bus"
            })

    # Infra files
    for inf in files["infra_files"]:
        try:
            with open(inf, "r", encoding="utf-8") as f:
                c = f.read().lower()
        except:
            continue
        if "kafka" in c:
            report["infra_files_kafka"].append(inf)

    # Docs
    for doc in files["doc_files"]:
        try:
            with open(doc, "r", encoding="utf-8") as f:
                c = f.read().lower()
        except:
            continue
        if "kafka" in c or "confluent" in c:
            report["doc_references"].append(doc)

    # Config files with Kafka keys
    report["config_files"] = detect_config_keys(files["config_files"])

    return report

# ========== Main ==========

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

    # Initialize Azure OpenAI client
    try:
        # Extract base URL if full chat completions URL was provided
        base_url = args.base_url
        if '/openai/' in base_url or '/chat/completions' in base_url:
            # Extract just the base URL (e.g., https://ai-proxy.lab.epam.com)
            from urllib.parse import urlparse
            parsed = urlparse(base_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            print(f"Extracted base URL: {base_url}", file=sys.stderr)
        
        client = AzureOpenAI(
            api_key=args.api_key,
            api_version=args.api_version,
            azure_endpoint=base_url
        )
    except Exception as e:
        print(f"ERROR: Failed to initialize AI client: {e}", file=sys.stderr)
        sys.exit(1)

    # Generate report
    report = generate_report(root_dir, client, args.model)
    
    # Transform report to match the expected format
    import time
    transformed_report = {
        "meta": {
            "repoUrl": args.repo_url,
            "generatedAt": str(int(time.time() * 1000))
        },
        "inventory": [],
        "diffs": [],
        "keyChanges": []
    }
    
    # Map GPT4 kafka results to inventory
    for item in report.get("gpt4_kafka_results", []):
        if item.get("uses_kafka") == "yes" or item.get("uses_kafka") == "maybe":
            transformed_report["inventory"].append({
                "file": item.get("file", ""),
                "kafka_apis": [item.get("role", "unknown")],
                "summary": item.get("explanation", "")
            })
    
    # Map manual kafka files to inventory if not already present
    for file in report.get("manual_kafka_files", []):
        if not any(item["file"] == file for item in transformed_report["inventory"]):
            transformed_report["inventory"].append({
                "file": file,
                "kafka_apis": ["manual detection"],
                "summary": "Detected via keyword matching"
            })
    
    # Output markdown with embedded JSON (required format for backend)
    print("<!--BEGIN:REPORT_JSON-->")
    print(json.dumps(transformed_report, indent=2))
    print("<!--END:REPORT_JSON-->")
    print()
    print("# Quick Migration Analysis Report")
    print()
    print("## 1. Kafka Usage Detection")
    print()
    print("### Manual Detection")
    for file in report.get("manual_kafka_files", []):
        print(f"- {file}")
    print()
    print("### AI-Powered Analysis")
    print()
    print("| File | Uses Kafka | Role | Explanation |")
    print("|------|------------|------|-------------|")
    for item in report.get("gpt4_kafka_results", []):
        print(f"| {item.get('file', '')} | {item.get('uses_kafka', '')} | {item.get('role', '')} | {item.get('explanation', '')} |")
    print()
    print("## 2. NuGet Package Changes Required")
    print()
    for change in report.get("csproj_changes", []):
        print(f"### {change.get('file', '')}")
        print(f"- **Remove**: {change.get('remove', '')}")
        print(f"- **Add**: {change.get('add', '')}")
        print()
    print("## 3. Unit Test Impact")
    print()
    for test in report.get("unit_test_impact", []):
        print(f"- **{test.get('file', '')}**: {test.get('note', '')}")
    print()
    print("## 4. Infrastructure Files")
    print()
    for file in report.get("infra_files_kafka", []):
        print(f"- {file}")
    print()
    print("## 5. Documentation References")
    print()
    for file in report.get("doc_references", []):
        print(f"- {file}")
    print()
    print("## 6. Configuration Files")
    print()
    for config in report.get("config_files", []):
        print(f"### {config.get('file', '')}")
        print(f"Keys to migrate: {', '.join(config.get('keys_to_migrate', []))}")
        print()

if __name__ == "__main__":
    main()
