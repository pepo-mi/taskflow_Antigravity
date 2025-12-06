import requests
import csv
from io import StringIO
import json

# Fetch the CSV file
url = "https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Supabase%20Performance%20Security%20Lints%20%28kiwmyyahgznxcmwuzjcq%29-Y7KJd0EZ1q6LTQQTL2CxmNURb1mSrg.csv"

print("[v0] Fetching Supabase lints CSV...")
response = requests.get(url)
response.raise_for_status()

# Parse CSV
csv_data = StringIO(response.text)
reader = csv.DictReader(csv_data)

# Categorize issues
security_issues = []
performance_issues = []
other_issues = []

print("\n" + "="*80)
print("SUPABASE PERFORMANCE & SECURITY ANALYSIS")
print("="*80 + "\n")

for row in reader:
    categories = row.get('categories', '[]')
    level = row.get('level', 'INFO')
    
    issue = {
        'name': row.get('name', ''),
        'title': row.get('title', ''),
        'level': level,
        'facing': row.get('facing', ''),
        'categories': categories,
        'description': row.get('description', ''),
        'detail': row.get('detail', ''),
        'remediation': row.get('remediation', ''),
    }
    
    if 'SECURITY' in categories:
        security_issues.append(issue)
    elif 'PERFORMANCE' in categories:
        performance_issues.append(issue)
    else:
        other_issues.append(issue)

# Print Security Issues
print(f"🔒 SECURITY ISSUES ({len(security_issues)})")
print("-" * 80)
for i, issue in enumerate(security_issues, 1):
    print(f"\n{i}. [{issue['level']}] {issue['title']}")
    print(f"   Description: {issue['description']}")
    print(f"   Detail: {issue['detail']}")
    print(f"   Fix: {issue['remediation']}")

# Print Performance Issues
print(f"\n\n⚡ PERFORMANCE ISSUES ({len(performance_issues)})")
print("-" * 80)
for i, issue in enumerate(performance_issues, 1):
    print(f"\n{i}. [{issue['level']}] {issue['title']}")
    print(f"   Description: {issue['description']}")
    print(f"   Detail: {issue['detail']}")
    print(f"   Fix: {issue['remediation']}")

# Print Other Issues
if other_issues:
    print(f"\n\n📋 OTHER ISSUES ({len(other_issues)})")
    print("-" * 80)
    for i, issue in enumerate(other_issues, 1):
        print(f"\n{i}. [{issue['level']}] {issue['title']}")
        print(f"   Description: {issue['description']}")
        print(f"   Detail: {issue['detail']}")
        print(f"   Fix: {issue['remediation']}")

# Summary
print("\n\n" + "="*80)
print("SUMMARY")
print("="*80)
print(f"Total Issues: {len(security_issues) + len(performance_issues) + len(other_issues)}")
print(f"  - Security: {len(security_issues)}")
print(f"  - Performance: {len(performance_issues)}")
print(f"  - Other: {len(other_issues)}")

# Count by severity
error_count = sum(1 for issues in [security_issues, performance_issues, other_issues] 
                  for issue in issues if issue['level'] == 'ERROR')
warn_count = sum(1 for issues in [security_issues, performance_issues, other_issues] 
                 for issue in issues if issue['level'] == 'WARN')
info_count = sum(1 for issues in [security_issues, performance_issues, other_issues] 
                 for issue in issues if issue['level'] == 'INFO')

print(f"\nBy Severity:")
print(f"  - ERROR: {error_count}")
print(f"  - WARN: {warn_count}")
print(f"  - INFO: {info_count}")

print("\n" + "="*80)
print("[v0] Analysis complete!")
