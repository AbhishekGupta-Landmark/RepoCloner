#!/usr/bin/env python3
"""
Migration Report Parser
Extracts structured data from markdown migration reports
"""

import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field

@dataclass
class KafkaUsageItem:
    file: str
    apis_used: str
    summary: str

@dataclass
class CodeDiff:
    file: str
    diff_content: str
    language: str = "diff"
    description: str = ""
    key_changes: List[str] = field(default_factory=list)
    notes: List[str] = field(default_factory=list)

@dataclass
class MigrationReport:
    title: str
    kafka_inventory: List[KafkaUsageItem]
    code_diffs: List[CodeDiff]
    sections: Dict[str, Any]

class MigrationReportParser:
    def __init__(self):
        self.current_section = None
        self.sections = {}
        
    def parse_report(self, markdown_content: str) -> MigrationReport:
        """
        Parse a markdown migration report into structured data
        """
        lines = markdown_content.split('\n')
        
        # Extract title
        title = self._extract_title(lines)
        
        # Parse sections
        kafka_inventory = self._parse_kafka_inventory(markdown_content)
        code_diffs = self._parse_code_diffs(markdown_content)
        sections = self._parse_all_sections(markdown_content)
        
        return MigrationReport(
            title=title,
            kafka_inventory=kafka_inventory,
            code_diffs=code_diffs,
            sections=sections
        )
    
    def _extract_title(self, lines: List[str]) -> str:
        """Extract the main title from markdown"""
        for line in lines:
            if line.startswith('# '):
                return line[2:].strip()
        return "Unknown Report"
    
    def _parse_kafka_inventory(self, content: str) -> List[KafkaUsageItem]:
        """
        Parse the Kafka Usage Inventory table
        """
        inventory = []
        
        # Find the inventory section
        inventory_pattern = r'## 1\. Kafka Usage Inventory\s*\n\n(.*?)(?=\n## |\n# |\Z)'
        match = re.search(inventory_pattern, content, re.DOTALL)
        
        if not match:
            return inventory
            
        inventory_section = match.group(1)
        
        # Parse table rows (skip header and separator)
        lines = inventory_section.split('\n')
        in_table = False
        
        for line in lines:
            line = line.strip()
            if line.startswith('|') and '---' in line:
                in_table = True
                continue
            elif line.startswith('|') and in_table and line.count('|') >= 4:
                # Parse table row
                columns = [col.strip() for col in line.split('|')[1:-1]]  # Remove empty first/last
                if len(columns) >= 3:
                    inventory.append(KafkaUsageItem(
                        file=columns[0],
                        apis_used=columns[1],
                        summary=columns[2]
                    ))
            elif not line.startswith('|') and in_table:
                break
                
        return inventory
    
    def _parse_code_diffs(self, content: str) -> List[CodeDiff]:
        """
        Parse code migration diffs with key changes and notes extraction
        """
        diffs = []
        
        # Find the code diffs section
        diff_pattern = r'## (?:2\. )?Code Migration Diffs\s*\n(.*?)(?=\n## |\n# |\Z)'
        match = re.search(diff_pattern, content, re.DOTALL)
        
        if not match:
            return diffs
            
        diff_section = match.group(1)
        
        # Find individual file diffs with optional descriptions
        # Pattern matches: ### filename\n[optional description]\n```diff\n...\n```
        file_pattern = r'### ([^\n]+)\n(.*?)```diff\n(.*?)\n```'
        file_matches = re.finditer(file_pattern, diff_section, re.DOTALL)
        
        for file_match in file_matches:
            file_name = file_match.group(1).strip()
            description_part = file_match.group(2).strip()
            diff_content = file_match.group(3).strip()
            
            # Extract description (text between filename and ```diff)
            description = description_part if description_part and not description_part.startswith('```') else ""
            
            # Extract and filter key changes and notes from diff content
            clean_diff, key_changes, notes = self._extract_key_changes_and_notes(diff_content)
            
            diffs.append(CodeDiff(
                file=file_name,
                diff_content=clean_diff,
                language="diff",
                description=description,
                key_changes=key_changes,
                notes=notes
            ))
            
        return diffs
    
    def _parse_all_sections(self, content: str) -> Dict[str, Any]:
        """
        Parse all sections and their content
        """
        sections = {}
        
        # Split by main headers (##)
        section_pattern = r'## ([^#\n]+)\n(.*?)(?=\n## |\n# |\Z)'
        matches = re.finditer(section_pattern, content, re.DOTALL)
        
        for match in matches:
            header = match.group(1).strip()
            section_content = match.group(2).strip()
            
            # Process section based on type
            if "inventory" in header.lower():
                sections[header] = {
                    "type": "table",
                    "content": section_content,
                    "parsed_data": self._parse_kafka_inventory(content)
                }
            elif "diff" in header.lower():
                sections[header] = {
                    "type": "code_diffs", 
                    "content": section_content,
                    "parsed_data": self._parse_code_diffs(content)
                }
            else:
                sections[header] = {
                    "type": "text",
                    "content": section_content
                }
                
        return sections
    
    def _extract_key_changes_and_notes(self, diff_content: str) -> tuple[str, List[str], List[str]]:
        """
        Extract key changes and notes from diff content, removing them from the diff.
        Returns: (clean_diff_content, key_changes_list, notes_list)
        """
        lines = diff_content.split('\n')
        clean_lines = []
        key_changes = []
        notes = []
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check for "Key changes:" section
            if line.lower() == "key changes:" or line.lower() == "+ key changes:":
                # Skip the "Key changes:" line itself
                i += 1
                # Collect following lines until we hit a diff line or end
                while i < len(lines):
                    next_line = lines[i]
                    # Stop if we hit actual diff content (lines starting with +, -, @, or diff markers)
                    if (next_line.startswith(('+', '-', '@@', 'diff --git', 'index ', '--- ', '+++ ')) and 
                        not next_line.strip().lower().startswith('+ ')):
                        break
                    # Stop if we hit a Note section
                    if next_line.strip().lower().startswith('note:') or next_line.strip().lower().startswith('+ note:'):
                        break
                    if next_line.strip():  # Only add non-empty lines
                        # Clean the + prefix if it exists
                        clean_line = next_line[1:].strip() if next_line.startswith('+') else next_line.strip()
                        if clean_line:  # Only add non-empty cleaned lines
                            key_changes.append(clean_line)
                    i += 1
                continue
            
            # Check for "Note:" section
            elif line.lower().startswith("note:") or line.lower().startswith("+ note:"):
                # Extract the note text (everything after "Note:")
                note_text = line
                if note_text.lower().startswith("+ note:"):
                    note_text = note_text[7:].strip()  # Remove "+ Note:"
                elif note_text.lower().startswith("note:"):
                    note_text = note_text[5:].strip()  # Remove "Note:"
                
                if note_text:  # Only add non-empty note
                    notes.append(note_text)
                
                # Continue to next line (don't include this line in clean diff)
                i += 1
                continue
            
            # Regular diff line - keep it
            clean_lines.append(lines[i])
            i += 1
        
        return '\n'.join(clean_lines), key_changes, notes
    
    def to_json_serializable(self, report: MigrationReport) -> Dict[str, Any]:
        """
        Convert report to JSON-serializable dictionary
        """
        return {
            "title": report.title,
            "kafka_inventory": [
                {
                    "file": item.file,
                    "apis_used": item.apis_used,
                    "summary": item.summary
                }
                for item in report.kafka_inventory
            ],
            "code_diffs": [
                {
                    "file": diff.file,
                    "diff_content": diff.diff_content,
                    "language": diff.language,
                    "description": diff.description
                }
                for diff in report.code_diffs
            ],
            "sections": report.sections,
            "stats": {
                "total_files_with_kafka": len(report.kafka_inventory),
                "total_files_with_diffs": len(report.code_diffs),
                "sections_count": len(report.sections)
            }
        }

# Example usage function
def parse_migration_report_file(file_path: str) -> Dict[str, Any]:
    """
    Parse a migration report markdown file and return structured data
    """
    parser = MigrationReportParser()
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    report = parser.parse_report(content)
    return parser.to_json_serializable(report)

# Example usage with sample content
if __name__ == "__main__":
    # Test with sample markdown
    sample_md = """
# Kafka → Azure Service Bus Migration Report

## 1. Kafka Usage Inventory

| File | APIs Used | Summary |
|------|-----------|---------|
| Api/ConsumerWrapper.cs | Confluent.Kafka, Consumer<string,string> | Kafka consumer wrapper |
| Api/ProducerWrapper.cs | Confluent.Kafka, Producer | Kafka producer wrapper |

## 2. Code Migration Diffs

### api/consumerwrapper.cs
```diff
-    using Confluent.Kafka;
+    using Azure.Messaging.ServiceBus;
```

### api/producerwrapper.cs  
```diff
-    private Producer<string,string> _producer;
+    private ServiceBusSender _sender;
```
"""
    
    parser = MigrationReportParser()
    report = parser.parse_report(sample_md)
    result = parser.to_json_serializable(report)
    
    print("📊 Parsed Report Structure:")
    print(f"Title: {result['title']}")
    print(f"Kafka files: {result['stats']['total_files_with_kafka']}")
    print(f"Code diffs: {result['stats']['total_files_with_diffs']}")
    
    print("\n📋 Kafka Inventory:")
    for item in result['kafka_inventory']:
        print(f"  - {item['file']}: {item['apis_used']}")
        
    print("\n🔧 Code Diffs:")
    for diff in result['code_diffs']:
        print(f"  - {diff['file']}")