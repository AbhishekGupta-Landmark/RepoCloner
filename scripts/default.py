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
    
    # AI API key with EPAM fallback
    ai_api_key = os.environ.get("AI_API_KEY")
    base_url = os.environ.get("AI_ENDPOINT_URL", "https://api.openai.com/v1/chat/completions")
    model = os.environ.get("AI_MODEL", "gpt-4")
    api_version = os.environ.get("AI_API_VERSION", "2024-02-15-preview")
    
    if not ai_api_key:
        # Fallback to EPAM AI proxy if no app-configured AI key
        ai_api_key = os.environ.get("EPAM_AI_API_KEY")
        if ai_api_key:
            print("🔧 Using EPAM AI proxy credentials from environment")
            # Set EPAM-specific defaults
            base_url = "https://ai-proxy.lab.epam.com/openai/deployments/claude-3-5-haiku@20241022/chat/completions"
            model = "claude-3-5-haiku@20241022"
            api_version = "3.5 Haiku"
    
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
        
        # For deployment-based URLs (Azure OpenAI, EPAM proxy), don't include model in payload
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
        
        # Use EPAM-specific Api-Key header format (not standard OpenAI Bearer token)
        if 'epam' in self.base_url.lower():
            headers = {"Content-Type": "application/json", "Api-Key": self.api_key}
        else:
            # Standard OpenAI format for other providers
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
        
        # Add API version header ONLY for Azure OpenAI (not EPAM proxy - it uses URL params)
        api_version = getattr(self, 'api_version', None)
        if api_version and 'azure' in self.base_url.lower() and 'epam' not in self.base_url.lower():
            headers["api-version"] = api_version
            
        # Special handling for EPAM proxy - may need additional headers
        if 'epam' in self.base_url.lower():
            # Add any additional headers needed for EPAM proxy
            headers["User-Agent"] = "RepoCloner-AI-Analysis/1.0"
            
        try:
            # For EPAM proxy, use the URL as-is since it already contains properly formatted parameters
            print(f"🌐 Making API request to: {self.base_url}")
            print(f"🔧 Headers: {{'Content-Type': 'application/json', 'Authorization': 'Bearer ***'}}")
            print(f"📋 Payload: {payload}")
            
            resp = requests.post(self.base_url, headers=headers, json=payload, timeout=120)
            
            print(f"🔍 Response Status: {resp.status_code}")
            print(f"📄 Response Headers: ***")
            
            if resp.status_code != 200:
                print(f"❌ Error Response Body: {resp.text}")
                resp.raise_for_status()
            
            data = resp.json()
            print(f"✅ Success! Response keys: {list(data.keys())}")
            content = data["choices"][0]["message"]["content"]
        except requests.exceptions.RequestException as e:
            error_details = f"Status: {getattr(e.response, 'status_code', 'Unknown')}, Response: {getattr(e.response, 'text', 'No response body')}"
            raise Exception(f"API request failed: {e}. Details: {error_details}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            raise
            
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

# Static analysis fallback implemented - reports generated even when AI fails

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
            
            # Extract description from BEFORE the fenced block
            description_before = s[:match.start()].strip()
            
            # ALSO check for description INSIDE the fenced block but BEFORE diff headers
            content_lines = content.splitlines()
            diff_start_in_block = None
            
            for i, line in enumerate(content_lines):
                # Find where actual diff starts
                if re.match(r"^(diff --git|index\s|---\s[^\-]|\+\+\+\s[^\+]|@@\s)", line):
                    diff_start_in_block = i
                    break
            
            if diff_start_in_block is not None and diff_start_in_block > 0:
                # There's text before the diff in the code block
                description_inside = "\n".join(content_lines[:diff_start_in_block]).strip()
                clean_diff = "\n".join(content_lines[diff_start_in_block:]).strip()
                
                # Combine descriptions
                full_description = f"{description_before}\n{description_inside}".strip() if description_before else description_inside
                return full_description, clean_diff
            else:
                # No text before diff
                return description_before, content
    
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
        Generate a unified diff patch that replaces Kafka usage with Azure.Messaging.ServiceBus.
        
        IMPORTANT FORMATTING RULES:
        1. First, write a brief description of what changes are needed (1-2 sentences)
        2. Then write ONLY the diff block starting with --- or @@ headers
        3. Do NOT include any explanation text inside the diff block
        4. The diff must contain only diff syntax: ---, +++, @@, -, +, and unchanged lines
        
        Requirements:
        - Cover producers, consumers, config, and error handling
        - Keep namespaces, classes, and non-Kafka code intact
        - If no Kafka usage is present, return an empty diff
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
    
    # Prepare structured JSON data
    inventory = state.get("kafka_inventory", [])
    diffs = state.get("code_diffs", [])
    
    structured_diffs = []
    all_key_changes = set()  # Use set to avoid duplicates
    all_notes = set()
    
    for diff in diffs:
        file_name = diff.get("file", "")
        if file_name.lower() == "readme.md":
            continue
            
        file_diff = diff.get("diff_content", "") or diff.get("diff", "")
        description = diff.get("description", "")
        
        print(f"🔍 Processing {file_name}:")
        print(f"   Description length: {len(description)}")
        print(f"   Diff length: {len(file_diff)}")
        print(f"   Description preview: {description[:100] if description else 'NONE'}")
        
        # Extract key changes from BOTH description and diff
        key_changes_for_file = []
        
        # Method 1: Extract from description (more reliable)
        if description:
            desc_lower = description.lower()
            if 'replace' in desc_lower or 'replac' in desc_lower:
                if 'kafka' in desc_lower and ('azure' in desc_lower or 'service bus' in desc_lower):
                    key_changes_for_file.append(f"Migrated from Kafka to Azure Service Bus in {file_name}")
            if 'consumer' in desc_lower and 'servicebus' in desc_lower.replace(' ', ''):
                key_changes_for_file.append(f"Replaced Kafka Consumer with Azure Service Bus receiver in {file_name}")
            if 'producer' in desc_lower and 'servicebus' in desc_lower.replace(' ', ''):
                key_changes_for_file.append(f"Replaced Kafka Producer with Azure Service Bus sender in {file_name}")
        
        # Method 2: Analyze diff for specific changes
        if file_diff:
            has_azure_import = False
            has_kafka_removal = False
            has_servicebus_client = False
            has_servicebus_sender = False
            has_servicebus_receiver = False
            
            lines = file_diff.split('\n')
            for line in lines:
                stripped = line.strip()
                # Check added lines
                if stripped.startswith('+') and not stripped.startswith('+++'):
                    if 'Azure.Messaging.ServiceBus' in stripped:
                        has_azure_import = True
                    if 'ServiceBusClient' in stripped:
                        has_servicebus_client = True
                    if 'ServiceBusSender' in stripped:
                        has_servicebus_sender = True
                    if 'ServiceBusReceiver' in stripped or 'ServiceBusProcessor' in stripped:
                        has_servicebus_receiver = True
                # Check removed lines
                elif stripped.startswith('-') and not stripped.startswith('---'):
                    if 'Confluent.Kafka' in stripped or 'kafka' in stripped.lower():
                        has_kafka_removal = True
            
            # Generate key changes based on what we found
            if has_azure_import and has_kafka_removal:
                key_changes_for_file.append(f"Replaced Kafka library with Azure.Messaging.ServiceBus in {file_name}")
            if has_servicebus_sender:
                key_changes_for_file.append(f"Introduced ServiceBusSender for message publishing in {file_name}")
            if has_servicebus_receiver:
                key_changes_for_file.append(f"Introduced ServiceBus receiver/processor for message consumption in {file_name}")
            if has_servicebus_client:
                key_changes_for_file.append(f"Added ServiceBusClient for connection management in {file_name}")
        
        # Add unique key changes to the global set
        for change in key_changes_for_file:
            all_key_changes.add(change)
        
        # Fallback: If no key changes detected but we have a diff, add a generic one
        if not key_changes_for_file and file_diff and len(file_diff.strip()) > 20:
            fallback_change = f"Code migration changes in {file_name}"
            all_key_changes.add(fallback_change)
            print(f"   ⚠️  Using fallback key change: {fallback_change}")
        
        print(f"   ✅ Key changes extracted: {len(key_changes_for_file)}")
        
        structured_diffs.append({
            "path": file_name,
            "diff": file_diff,
            "description": description
        })
    
    import json
    import time
    
    key_changes_list = list(all_key_changes)
    print(f"\n📊 FINAL KEY CHANGES COUNT: {len(key_changes_list)}")
    for kc in key_changes_list:
        print(f"   - {kc}")
    
    json_data = {
        "meta": {
            "repoUrl": state.get("repo_url", ""),
            "generatedAt": str(int(time.time() * 1000))
        },
        "keyChanges": key_changes_list,
        "notes": list(all_notes),
        "diffs": structured_diffs,
        "inventory": inventory
    }

    with open(report_path, "w", encoding="utf-8") as f:
        # Embed JSON for backend to extract
        f.write("<!--BEGIN:REPORT_JSON-->\n")
        f.write(json.dumps(json_data, indent=2, ensure_ascii=False))
        f.write("\n<!--END:REPORT_JSON-->\n\n")
        
        # Header
        f.write("# Kafka → Azure Service Bus Migration Report\n\n")

        # 1. Kafka Usage Inventory
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
            print(f"\n❌ AI Analysis failed: {str(e)}")
            print("🔄 Falling back to static analysis...")
    else:
        print("⚠️ No AI credentials provided, using static analysis")
    
    # Generate static fallback report if AI failed
    if not report_generated:
        print("🔄 Generating static analysis fallback report...")
        try:
            # Static analysis - scan for Kafka files without AI
            kafka_files = []
            code_diffs = []
            
            # Find files that likely contain Kafka usage
            for root, dirs, files in os.walk(args.repo_path):
                if ".git" in dirs:
                    dirs.remove(".git")
                for file in files:
                    if file.endswith(('.cs', '.java', '.js', '.ts', '.py')):
                        file_path = os.path.join(root, file)
                        try:
                            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                                content = f.read()
                                if any(keyword.lower() in content.lower() for keyword in ['kafka', 'producer', 'consumer', 'confluent']):
                                    relative_path = os.path.relpath(file_path, args.repo_path)
                                    kafka_files.append({
                                        'file': relative_path,
                                        'kafka_apis': ['Kafka Producer', 'Kafka Consumer', 'Confluent.Kafka'],
                                        'summary': 'Kafka usage detected in static analysis'
                                    })
                                    code_diffs.append({
                                        'file': relative_path,
                                        'diff_content': f'''- // Original Kafka implementation\n+ // Recommended Azure Service Bus migration:\n+ using Azure.Messaging.ServiceBus;\n+ // Replace Kafka producers with ServiceBusClient\n+ // Replace Kafka consumers with ServiceBusReceiver\n+ // Update configuration to use Service Bus connection strings''',
                                        'description': 'Static analysis detected Kafka usage - recommended Azure Service Bus migration',
                                        'language': 'diff'
                                    })
                        except Exception:
                            continue
            
            # Generate static migration report
            with open(report_path, "w", encoding="utf-8") as f:
                f.write("# Kafka → Azure Service Bus Migration Report\n\n")
                f.write("*Generated by static analysis*\n\n")
                
                # Kafka inventory section
                f.write("## 1. Kafka Usage Inventory\n\n")
                if kafka_files:
                    f.write("Files in your repository that use Kafka APIs:\n\n")
                    f.write("| File | APIs Used | Summary |\n")
                    f.write("|------|-----------|---------|\n")
                    for item in kafka_files:
                        apis = ', '.join(item.get('kafka_apis', []))
                        f.write(f"| {item['file']} | {apis} | {item['summary']} |\n")
                else:
                    f.write("No Kafka usage detected in static analysis.\n")
                f.write("\n")
                
                # Code migrations section
                f.write("## 2. Code Migration Diffs\n\n")
                if code_diffs:
                    for diff in code_diffs:
                        f.write(f"### {diff['file']}\n")
                        
                        # Write description above the code block if it exists
                        if diff.get('description'):
                            f.write(f"{diff['description']}\n\n")
                        
                        f.write("```diff\n")
                        f.write(diff.get('diff_content', diff.get('diff', '')))
                        f.write("\n```\n\n")
                else:
                    f.write("No migration recommendations available from static analysis.\n")
                    f.write("Enable AI analysis for detailed migration guidance.\n\n")
            
            print(f"✅ Static analysis report generated: {report_filename}")
            analysis_type = "Static Analysis Fallback"
            report_generated = True
            
        except Exception as e:
            print(f"❌ Static analysis fallback failed: {str(e)}")
    
    # Final status
    if report_generated:
        print(f"✅ Analysis complete - Report available: {report_filename}")
        print(f"📊 Analysis type: {analysis_type}")
        sys.exit(0)
    else:
        print("❌ Both AI and static analysis failed - no report generated")
        sys.exit(1)