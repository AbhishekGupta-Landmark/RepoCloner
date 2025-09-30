import os
import re
import json
import requests
import subprocess
import sys
from typing import TypedDict, List, Dict, Any, Optional
from urllib.parse import quote, urlparse, parse_qs, urlencode, urlunparse
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration

import argparse

# Parse command line arguments for AI configuration
def parse_args():
    parser = argparse.ArgumentParser(description='AI-powered repository analysis for Kafka to Azure Service Bus migration')
    parser.add_argument('repo_url', help='Repository URL to analyze')
    parser.add_argument('repo_path', help='Local path to clone/analyze repository')
    
    # AI API key (required - no fallbacks)
    ai_api_key = os.environ.get("AI_API_KEY")
    base_url = os.environ.get("AI_ENDPOINT_URL", "https://api.openai.com/v1/chat/completions")
    model = os.environ.get("AI_MODEL", "gpt-4")
    api_version = os.environ.get("AI_API_VERSION", "2024-02-15-preview")
    
    parser.add_argument('--model', default=model, help='AI model to use')
    parser.add_argument('--api-version', default=api_version, help='API version')
    parser.add_argument('--base-url', default=base_url, help='API endpoint URL')
    parser.add_argument('--api-key', default=ai_api_key, help='AI API key (required)')
    return parser.parse_args()

# Safe defaults - no hardcoded credentials
DEFAULT_MODEL = "gpt-4"
DEFAULT_API_VERSION = "2024-02-15-preview"
DEFAULT_BASE_URL = "https://api.openai.com/v1/chat/completions"

class RepoAnalysisState(TypedDict):
    repo_url: str
    repo_path: str
    code_chunks: List[str]
    messages: List[BaseMessage]
    analysis: str
    kafka_inventory: List[dict]
    code_diffs: List[dict]
    # AI configuration (optional)
    model: str
    api_version: str
    base_url: str
    api_key: str

class ApiKeyOnlyChatModel(BaseChatModel):
    model_name: str
    base_url: str
    api_key: str
    api_version: Optional[str] = None

    def _generate(self, messages: List[BaseMessage], stop=None, run_manager=None, **kwargs):
        role_map = {"human": "user", "ai": "assistant", "system": "system"}
        
        # Standard OpenAI API payload
        payload = {
            "messages": [
                {"role": role_map.get(m.type, m.type), "content": m.content}
                for m in messages
            ],
            "temperature": 0,
        }
        
        # Only add model name for direct OpenAI API calls (not deployment-based URLs)
        if 'deployments' not in self.base_url.lower():
            payload["model"] = self.model_name
        
        # Standard OpenAI Authorization header
        headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
        
        # Add API version header for Azure OpenAI or EPAM proxy
        api_version = getattr(self, 'api_version', None)
        if api_version and ('azure' in self.base_url.lower() or 'epam' in self.base_url.lower()):
            headers["api-version"] = api_version
            
        try:
            print(f"🌐 Making API request to: {self.base_url}")
            print(f"🔧 Headers: {{'Content-Type': 'application/json', 'Authorization': 'Bearer ***'}}")
            print(f"📋 Payload keys: {list(payload.keys())}")
            print(f"📋 Messages count: {len(payload.get('messages', []))}")
            
            # Use separate connect and read timeouts for better reliability
            print(f"⏰ Starting API request with timeout (30s connect, 90s read)...")
            resp = requests.post(
                self.base_url, 
                headers=headers, 
                json=payload, 
                timeout=(30, 90)  # (connect_timeout, read_timeout)
            )
            
            print(f"🔍 Response Status: {resp.status_code}")
            print(f"📏 Response Length: {len(resp.text)} chars")
            
            if resp.status_code != 200:
                print(f"❌ Error Response Body: {resp.text[:1000]}...")  # Truncate long responses
                resp.raise_for_status()
            
            print(f"📄 Attempting to parse JSON response...")
            try:
                data = resp.json()
                print(f"✅ JSON parsed successfully! Response keys: {list(data.keys())}")
            except ValueError as json_err:
                print(f"❌ JSON parsing failed: {json_err}")
                print(f"📄 Raw response: {resp.text[:500]}...")
                raise Exception(f"Invalid JSON response from AI service: {json_err}")
            
            # Check response format
            if "choices" not in data:
                print(f"❌ Missing 'choices' in response. Available keys: {list(data.keys())}")
                raise Exception(f"Invalid response format: missing 'choices' field")
            
            if not data["choices"] or len(data["choices"]) == 0:
                print(f"❌ Empty choices array in response")
                raise Exception(f"Invalid response format: empty choices array")
            
            if "message" not in data["choices"][0]:
                print(f"❌ Missing 'message' in first choice. Available keys: {list(data['choices'][0].keys())}")
                raise Exception(f"Invalid response format: missing 'message' in choice")
            
            content = data["choices"][0]["message"]["content"]
            print(f"✅ Successfully extracted content! Length: {len(content)} chars")
        except requests.exceptions.Timeout as e:
            error_msg = f"⏱️ API request timed out: {e}"
            print(error_msg, file=sys.stderr)
            print(error_msg)
            raise Exception(f"AI API request timed out after 90 seconds. The service may be experiencing issues.")
        except requests.exceptions.ConnectionError as e:
            error_msg = f"🌐 Connection error: {e}"
            print(error_msg, file=sys.stderr)
            print(error_msg)
            raise Exception(f"Cannot connect to AI service. Please check your network connection.")
        except requests.exceptions.RequestException as e:
            error_details = f"Status: {getattr(e.response, 'status_code', 'Unknown')}, Response: {getattr(e.response, 'text', 'No response body')[:500]}"
            error_msg = f"❌ Request exception: {e}\n{error_details}"
            print(error_msg, file=sys.stderr)
            print(error_msg)
            raise Exception(f"API request failed: {e}. Details: {error_details}")
        except KeyError as e:
            error_msg = f"❌ Invalid API response format: {e}"
            print(error_msg, file=sys.stderr)
            print(error_msg)
            raise Exception(f"Invalid response format from AI service. Missing expected field: {e}")
        except Exception as e:
            error_msg = f"❌ Unexpected error: {e}"
            print(error_msg, file=sys.stderr)
            print(error_msg)
            raise Exception(f"Unexpected error during API request: {e}")
            
        ai_msg = AIMessage(content=content)
        return ChatResult(generations=[ChatGeneration(message=ai_msg)])

    @property
    def _llm_type(self) -> str:
        return "api-key-only-chat"

def clone_repo(state: RepoAnalysisState):
    repo_url = state["repo_url"]
    local_path = state["repo_path"]

    # Check if repository files already exist (cloned by main application)
    if os.path.exists(local_path) and os.listdir(local_path):
        print(f"Repository files already exist at {local_path} (cloned by main application)")
        return state
    
    if os.path.exists(os.path.join(local_path, ".git")):
        print(f"Repository already exists at {local_path}, checking for updates...")

        remote_commit = subprocess.check_output(
            ["git", "ls-remote", repo_url, "HEAD"]
        ).decode().split()[0]

        local_commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=local_path
        ).decode().strip()

        if local_commit == remote_commit:
            print("Local repository is already up-to-date with origin.")
        else:
            print("Local repo is outdated, pulling latest changes...")
            subprocess.run(["git", "pull"], cwd=local_path, check=True)
    else:
        print(f"Cloning repository into {local_path}...")
        os.makedirs(local_path, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", repo_url, local_path], check=True)

    return state

def get_updated_state_with_code_chunks(state: RepoAnalysisState) -> RepoAnalysisState:
    repo_path = state["repo_path"]
    chunks = []
    EXCLUDED_EXTENSIONS = (".png", ".jpg", ".exe", ".dll", ".bin")

    max_chunk_size = 4000
    for root, dirs, files in os.walk(repo_path):
        if ".git" in dirs:
            dirs.remove(".git")
        for f in files:
            path = os.path.join(root, f)
            if f.lower().endswith(EXCLUDED_EXTENSIONS):
                continue
            try:
                with open(path, "rb") as test_fp:
                    start = test_fp.read(1024)
                    if b'\0' in start:
                        continue
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    for i in range(0, len(content), max_chunk_size):
                        chunk = content[i:i+max_chunk_size]
                        chunks.append(f"File: {os.path.relpath(path, repo_path)}\n{chunk}")
            except (IOError, OSError):
                continue

    print(f"📊 Total chunks loaded: {len(chunks)}")
    print(f"🔍 Phase 2: Starting AI-powered analysis...")
    return {**state, "code_chunks": chunks}

def analyze_code(state: RepoAnalysisState):
    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key'),
        api_version=state.get('api_version')
    )
    summaries = []
    for chunk in state["code_chunks"]:
        prompt = f"Summarize the purpose and functionality of this code:\n\n{chunk}"
        resp = llm.invoke([HumanMessage(content=prompt)])
        summaries.append(resp.content)

    analysis = "\n\n".join(summaries)
    return {**state, "analysis": analysis}

def scan_for_kafka_usage_ai(state: RepoAnalysisState) -> RepoAnalysisState:
    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key'),
        api_version=state.get('api_version')
    )
    inventory: List[Dict[str, Any]] = []
    code_chunks = state["code_chunks"]

    print(f"Scanning {len(code_chunks)} chunks for Kafka usage via AI...")

    for idx, chunk in enumerate(code_chunks):
        prompt = (
            "You are analyzing a .NET Core repository. "
            "Does this code use Kafka (e.g., Confluent.Kafka, Kafka APIs, producers, consumers, topics, partitions)? "
            "If yes, return a JSON object with fields: "
            "{'file': 'relative/path', 'kafka_apis': [...], 'summary': '...'}.\n"
            "If not, return {}.\n\n"
            f"Code chunk:\n{chunk}"
        )
        resp = llm.invoke([HumanMessage(content=prompt)])
        text = getattr(resp, "content", "") or str(resp)

        match = re.search(r"\{.*\}", text, flags=re.S)
        if match:
            try:
                data = json.loads(match.group(0))
                if data and "file" in data:
                    inventory.append(data)
            except Exception:
                pass

        if idx % 20 == 0:
            print(f"Processed {idx}/{len(code_chunks)} chunks")

    print(f"AI-identified Kafka usage in {len(inventory)} files.")
    return {**state, "kafka_inventory": inventory}

# AI-powered analysis - requires valid API configuration

def extract_description_and_diff(raw: str) -> tuple[str, str]:
    """
    Extract description and diff content from AI response.
    Returns (description, diff_content) tuple.
    """
    s = raw.strip()
    
    # Find all fenced code blocks
    fenced_blocks = list(re.finditer(r"```(\w+)?\s*\n([\s\S]*?)\n```", s, re.I))
    
    # Look for diff/patch blocks first
    for match in fenced_blocks:
        language = match.group(1) or ""
        content = match.group(2).strip()
        
        # Check if this is a diff block by language or content
        if (language.lower() in ["diff", "patch"] or 
            re.search(r"^(diff --git|---\s|\+\+\+\s|@@)", content, re.M)):
            description = s[:match.start()].strip()
            return description, content
    
    # If no suitable fenced block, look for diff markers with stronger validation
    lines = s.splitlines()
    diff_start = None
    
    for i, line in enumerate(lines):
        # Only treat as diff start if we see proper diff headers
        if re.match(r"^(diff --git|index\s|---\s[^\-]|\+\+\+\s[^\+])", line):
            diff_start = i
            break
        # Look for hunk headers
        elif re.match(r"^@@\s", line):
            diff_start = i
            break
    
    # If we found a proper diff start, split there
    if diff_start is not None:
        description = "\n".join(lines[:diff_start]).strip()
        diff_content = "\n".join(lines[diff_start:]).strip()
        return description, diff_content
    
    # If no diff markers found, treat entire response as description
    return s, ""

def extract_key_changes_and_notes_from_text(text: str) -> tuple[List[str], List[str]]:
    """
    Extract Key Changes and Notes from markdown text using structured parsing.
    Returns (key_changes, notes) tuple.
    """
    key_changes = []
    notes = []
    
    # Look for "Key changes:" or "Key Changes:" section (case insensitive)
    key_changes_match = re.search(r'(?:^|\n)#+?\s*Key\s+[Cc]hanges?:?\s*\n((?:[-*]\s+.+(?:\n|$))+)', text, re.I | re.M)
    if key_changes_match:
        # Extract bullet points from the list
        bullets = re.findall(r'[-*]\s+(.+)', key_changes_match.group(1))
        key_changes.extend([b.strip() for b in bullets if b.strip()])
    
    # Look for "Note:" or "Notes:" section (case insensitive)
    notes_match = re.search(r'(?:^|\n)#+?\s*Notes?:?\s*\n((?:[-*]\s+.+(?:\n|$))+)', text, re.I | re.M)
    if notes_match:
        # Extract bullet points from the list
        bullets = re.findall(r'[-*]\s+(.+)', notes_match.group(1))
        notes.extend([b.strip() for b in bullets if b.strip()])
    
    # Also check for inline patterns like "Note: text" at end of diff blocks
    inline_note_matches = re.findall(r'(?:^|\n)Note:\s*(.+?)(?:\n|$)', text, re.I)
    for note_text in inline_note_matches:
        if note_text.strip() and note_text.strip() not in notes:
            notes.append(note_text.strip())
    
    return key_changes, notes

def generate_code_diffs(state: RepoAnalysisState) -> RepoAnalysisState:
    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key'),
        api_version=state.get('api_version')
    )
    inventory = state.get("kafka_inventory", [])
    repo_path = state["repo_path"]

    diffs = []
    for item in inventory:
        file_rel = item.get("file")
        if not file_rel:
            continue
        file_abs = os.path.join(repo_path, file_rel)

        if not os.path.exists(file_abs):
            continue

        try:
            with open(file_abs, "r", encoding="utf-8", errors="ignore") as fp:
                file_content = fp.read()
        except Exception:
            continue

        prompt = f"""
        You are a .NET Core expert.
        File: {file_rel}

        Original code:
        {file_content}


        Task:
        - Show a unified diff patch (`diff` style) that replaces Kafka usage with Azure.Messaging.ServiceBus.
        - Cover producers, consumers, config, and error handling.
        - Keep namespaces, classes, and non-Kafka code intact.
        - If no Kafka usage is present, return an empty diff.
        """
        resp = llm.invoke([HumanMessage(content=prompt)])
        
        # Extract description and diff content separately
        content = resp.content if isinstance(resp.content, str) else str(resp.content)
        description, diff_content = extract_description_and_diff(content)
        
        diffs.append({
            "file": file_rel,
            "diff_content": diff_content,
            "description": description,
            "language": "diff"
        })
    
    print(f"Generated diffs for {len(diffs)} files.")

    return {**state, "code_diffs": diffs}

def generate_report_streaming(state: RepoAnalysisState, report_path="migration-report.md"):
    """
    Streaming-style report generator to avoid token limit issues.
    Writes each section to disk incrementally instead of building one huge prompt.
    """

    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key')
    )
    
    # Prepare structured data for JSON export
    inventory = state.get("kafka_inventory", [])
    diffs = state.get("code_diffs", [])
    
    # Extract key changes and notes from all diff descriptions
    all_key_changes = []
    all_notes = []
    structured_diffs = []
    
    for diff in diffs:
        file_name = diff.get("file", "")
        if file_name.lower() == "readme.md":
            continue
            
        file_diff = diff.get("diff_content", "") or diff.get("diff", "")
        description = diff.get("description", "")
        
        # Extract key changes and notes from description
        key_changes, notes = extract_key_changes_and_notes_from_text(description)
        all_key_changes.extend(key_changes)
        all_notes.extend(notes)
        
        # Also check in diff content itself (AI sometimes puts them there)
        if file_diff:
            key_changes_diff, notes_diff = extract_key_changes_and_notes_from_text(file_diff)
            all_key_changes.extend(key_changes_diff)
            all_notes.extend(notes_diff)
            
            # CRITICAL: Remove description lines from diff content
            # Look for the first actual diff marker (---, +++, @@, or diff --git)
            lines = file_diff.split('\n')
            diff_start_idx = 0
            for i, line in enumerate(lines):
                if line.startswith('---') or line.startswith('+++') or line.startswith('@@') or line.startswith('diff --git'):
                    diff_start_idx = i
                    break
            
            # Keep only the actual diff content
            if diff_start_idx > 0:
                file_diff = '\n'.join(lines[diff_start_idx:])
        
        structured_diffs.append({
            "path": file_name,
            "diff": file_diff,
            "description": description
        })
    
    # Create JSON report with structured data
    import time
    json_data = {
        "meta": {
            "repoUrl": state.get("repo_url", ""),
            "generatedAt": str(int(time.time() * 1000))
        },
        "keyChanges": list(set(all_key_changes)),  # Remove duplicates
        "notes": list(set(all_notes)),  # Remove duplicates
        "diffs": structured_diffs,
        "inventory": inventory
    }
    
    # Write JSON file first
    json_path = report_path.replace('.md', '.json')
    with open(json_path, "w", encoding="utf-8") as jf:
        json.dump(json_data, jf, indent=2, ensure_ascii=False)
    print(f"✅ Structured JSON report written to {json_path}")

    with open(report_path, "w", encoding="utf-8") as f:
        # Embed JSON for parsing resilience (hidden HTML comment)
        f.write("<!--BEGIN:REPORT_JSON-->\n")
        f.write(json.dumps(json_data, indent=2, ensure_ascii=False))
        f.write("\n<!--END:REPORT_JSON-->\n\n")
        # Header
        f.write("# Kafka → Azure Service Bus Migration Report\n\n")

        # 1. Kafka Usage Inventory
        inventory = state.get("kafka_inventory", [])
        f.write("## 1. Kafka Usage Inventory\n\n")
        f.write("| File | APIs Used | Summary |\n")
        f.write("|------|-----------|---------|\n")
        for item in inventory:
            f.write(f"| {item.get('file')} | {', '.join(item.get('kafka_apis', []))} | {item.get('summary', '')} |\n")
        f.write("\n")

        # 2. Code Migration Diffs (all files, no token explosion)
        f.write("## 2. Code Migration Diffs\n\n")
        diffs = state.get("code_diffs", [])
        for diff in diffs:
            file_name = diff.get("file", "")
            file_diff = diff.get("diff_content", "") or diff.get("diff", "")
            description = diff.get("description", "")

            # Ignore README.md or other excluded files
            if file_name.lower() == "readme.md":
                continue

            f.write(f"### {file_name}\n")
            
            # Write description above the code block if it exists
            if description:
                f.write(f"{description}\n\n")
            
            # Only write diff block if there's actual diff content
            if file_diff:
                f.write("```diff\n")
                f.write(file_diff.strip() + "\n")
                f.write("```\n\n")
            else:
                f.write("*No diff content generated*\n\n")


    print(f"✅ Streaming migration report written to {report_path}")

    # Update state with a final message
    return {**state, "messages": state["messages"] + [AIMessage(content=f"Migration report generated at {report_path}.")]}

# Build workflow
graph = StateGraph(RepoAnalysisState)
graph.add_node("clone_repo", clone_repo)
graph.add_node("load_source_code", get_updated_state_with_code_chunks)
graph.add_node("analyze_code", analyze_code)
graph.add_node("scan_for_kafka_usage_ai", scan_for_kafka_usage_ai)
graph.add_node("generate_code_diffs", generate_code_diffs)
graph.add_node("generate_report", generate_report_streaming)

graph.set_entry_point("clone_repo")
graph.add_edge("clone_repo", "load_source_code")
graph.add_edge("load_source_code", "analyze_code")
graph.add_edge("analyze_code", "scan_for_kafka_usage_ai")
graph.add_edge("scan_for_kafka_usage_ai", "generate_code_diffs")
graph.add_edge("generate_code_diffs", "generate_report")
graph.add_edge("generate_report", END)

app = graph.compile()

# Run
def run_analysis(question: str = "Provide a summary of the repository and its Kafka usage."):
    initial_state: RepoAnalysisState = {
        "repo_url": "https://github.com/srigumm/dotnetcore-kafka-integration",
        "repo_path": "./cloned_repo",
        "code_chunks": [],
        "analysis": "",
        "kafka_inventory": [],
        "code_diffs": [],
        "messages": [HumanMessage(content=question)],
        "model": DEFAULT_MODEL,
        "api_version": DEFAULT_API_VERSION,
        "base_url": DEFAULT_BASE_URL,
        "api_key": "",
    }
    result = app.invoke(initial_state)
    print("\nAI Proxy Response:\n", result["messages"][-1].content)

# Main execution with proper argument parsing
if __name__ == "__main__":
    import time
    args = parse_args()
    
    # CRITICAL: Delete all old migration report files to prevent fallback reports from being picked up
    print(f"🧹 Cleaning up old migration reports...")
    try:
        for file in os.listdir(args.repo_path):
            if file.startswith('migration-report-') and file.endswith('.md'):
                old_report_path = os.path.join(args.repo_path, file)
                os.remove(old_report_path)
                print(f"🗑️  Deleted old report: {file}")
    except Exception as cleanup_error:
        print(f"⚠️  Cleanup warning: {cleanup_error}")
    
    # Generate unique report filename
    analysis_id = str(int(time.time() * 1000))
    report_filename = f"migration-report-{analysis_id}.md"
    report_path = os.path.join(args.repo_path, report_filename)
    
    print(f"🚀 Starting migration analysis...")
    print(f"📁 Repository URL: {args.repo_url}")
    print(f"📂 Repository Path: {args.repo_path}")
    print(f"🤖 Using Model: {args.model}")
    print(f"🔧 Using API Version: {args.api_version}")
    print(f"🌐 Using Endpoint: {args.base_url}")
    print(f"📊 Phase 1: Repository validation and code loading...")
    
    report_generated = False
    analysis_type = "Static Analysis"
    
    # Try AI analysis if we have credentials
    print(f"🔧 DEBUG: API key present: {bool(args.api_key)}")
    print(f"🔧 DEBUG: Base URL present: {bool(args.base_url)}")
    print(f"🔧 DEBUG: API key value check: {args.api_key != 'test'}")
    print(f"🔧 DEBUG: Base URL value check: {args.base_url != 'test'}")
    
    if args.api_key and args.base_url and args.api_key != "test" and args.base_url != "test":
        try:
            print("🤖 Attempting AI analysis...")
            result = app.invoke({
                "repo_url": args.repo_url,
                "repo_path": args.repo_path,
                "code_chunks": [],
                "analysis": "",
                "kafka_inventory": [],
                "code_diffs": [],
                "messages": [HumanMessage(content="Analyze this repository for Kafka usage and generate migration report.")],
                # AI configuration from command-line arguments
                "model": args.model,
                "api_version": args.api_version,
                "base_url": args.base_url,
                "api_key": args.api_key
            })
            
            print("\n✅ AI Migration analysis completed!")
            print(f"📄 REPORT_GENERATED: {report_filename}")
            analysis_type = "AI Analysis"
            report_generated = True
        
        except Exception as e:
            error_msg = f"\n❌ AI Analysis failed: {str(e)}"
            print(error_msg, file=sys.stderr)  # Print to stderr so it gets captured
            print(error_msg)  # Also print to stdout for console visibility
    else:
        print("⚠️ No AI credentials provided")
    
    
    # Final status
    if report_generated:
        print(f"✅ Analysis complete - Report available: {report_filename}")
        print(f"📊 Analysis type: {analysis_type}")
        sys.exit(0)
    else:
        print("❌ AI analysis failed or not configured - no report generated")
        sys.exit(1)