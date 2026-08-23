import re

def extract_members(file_path, interface_name):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Find the interface definition
    match = re.search(f'export interface {interface_name} extends [^{{]*{{(.*?)\n}}', content, re.DOTALL)
    if not match:
        match = re.search(f'export interface {interface_name} {{(.*?)\n}}', content, re.DOTALL)
        
    if not match:
        print(f"Interface {interface_name} not found.")
        return []
        
    body = match.group(1)
    
    # Extract members (methods and properties)
    # Simple regex to find lines like:
    #   methodName(...): returnType;
    #   propertyName: type;
    members = set()
    for line in body.split('\n'):
        line = line.strip()
        if not line or line.startswith('//') or line.startswith('/*') or line.startswith('*'):
            continue
        # Check for properties or methods
        m = re.match(r'^([a-zA-Z0-9_]+)\s*[<:\(]', line)
        if m:
            members.add(m.group(1))
            
    return sorted(list(members))

file_path = '/Users/ashwinkaliappan/playwright-agi-training/upstream/playwright/packages/playwright-core/types/types.d.ts'
for iface in ['Frame', 'Route', 'Request', 'Response']:
    members = extract_members(file_path, iface)
    print(f"--- {iface} ---")
    print("\n".join(members))
