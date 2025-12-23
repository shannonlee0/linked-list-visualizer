from flask import Flask, request, jsonify
from flask_cors import CORS
import re
import copy

# --- INITIALIZE FLASK APP ---
app = Flask(__name__)
CORS(app)

class LinkedListSimulator:
    def __init__(self):
        self.stack = {} 
        self.heap = {}  
        self.addr_counter = 1
        self.trace_log = []
        self.functions = {}
        self.scope_stack = [] 

    def _get_new_addr(self):
        addr = f"0x{self.addr_counter}"
        self.addr_counter += 1
        return addr

    def log_step(self, line_of_code):
        snapshot = {
            "code": line_of_code,
            "stack": copy.deepcopy(self.stack),
            "heap": copy.deepcopy(self.heap)
        }
        self.trace_log.append(snapshot)

    def parse_functions_manual(self, func_code):
        # Finds: void name(type name) { body }
        pattern = re.compile(r"void\s+(\w+)\s*\(([^)]+)\)\s*\{([^}]+)\}", re.DOTALL)
        matches = pattern.findall(func_code)
        
        for name, params, body in matches:
            is_ref = '&' in params
            param_name = params.replace('Node*', '').replace('&', '').strip()
            
            clean_body = []
            for l in body.strip().split('\n'):
                cleaned = l.strip().replace(';', '')
                if cleaned:
                    clean_body.append(cleaned)

            self.functions[name] = {
                'is_ref': is_ref,
                'param_name': param_name,
                'body': clean_body
            }

    def execute(self, cpp_code):
        self.log_step("Ready")
        
        if "// MAIN" in cpp_code:
            parts = cpp_code.split("// MAIN")
            definitions = parts[0]
            main_code = parts[1]
        else:
            definitions = ""
            main_code = cpp_code

        self.parse_functions_manual(definitions)
        
        raw_lines = main_code.replace('}', '\n}').replace('{', '{\n').split('\n')
        lines = [l.strip().replace(';', '') for l in raw_lines if l.strip()]

        i = 0
        loop_stack = [] 

        while i < len(lines):
            line = lines[i].strip().replace(';', '')
            original_line = line
            
            # --- 0. SCOPE MANAGEMENT ---
            if line == "__PUSH_SCOPE__":
                self.scope_stack.append(list(self.stack.keys()))
                i += 1; continue
            if line == "__POP_SCOPE__":
                if self.scope_stack:
                    original_keys = set(self.scope_stack.pop())
                    current_keys = list(self.stack.keys())
                    for k in current_keys:
                        if k not in original_keys: del self.stack[k]
                self.log_step("Function Return (Stack Cleared)")
                i += 1; continue
            if line.startswith('//') or line.startswith('/*'):
                i += 1; continue

            # --- A. LOOP LOGIC ---
            match_while = re.search(r"while\s*\(\s*(\w+)\s*!=\s*(nullptr|NULL)\s*\)", line)
            if match_while:
                cond_var = match_while.group(1)
                current_addr = self.stack.get(cond_var)
                if current_addr is None:
                    temp_i = i + 1
                    while temp_i < len(lines) and lines[temp_i] != '}': temp_i += 1
                    i = temp_i + 1; continue
                else:
                    loop_stack.append((i, cond_var))
                    self.log_step(f"Loop Check: {cond_var} != nullptr (TRUE)")
                    i += 1; continue

            if line == '}':
                if loop_stack:
                    start_index, cond_var = loop_stack[-1]
                    current_addr = self.stack.get(cond_var)
                    if current_addr is not None: i = start_index; continue
                    else:
                        loop_stack.pop()
                        self.log_step(f"Loop Check: {cond_var} == nullptr (FALSE)")
                        i += 1; continue

            # --- B. FUNCTION CALLS ---
            match_call = re.search(r"^(\w+)\((\w+)\)$", line)
            if match_call:
                func_name = match_call.group(1)
                arg_name = match_call.group(2)
                if func_name in self.functions:
                    func_data = self.functions[func_name]
                    param_name = func_data['param_name']
                    inlined_lines = ["__PUSH_SCOPE__"]
                    if func_data['is_ref']:
                        for body_line in func_data['body']:
                            new_line = re.sub(r"\b" + param_name + r"\b", arg_name, body_line)
                            inlined_lines.append(new_line)
                    else:
                        local_var = f"{func_name}_{param_name}"
                        inlined_lines.append(f"Node* {local_var} = {arg_name}")
                        for body_line in func_data['body']:
                            new_line = re.sub(r"\b" + param_name + r"\b", local_var, body_line)
                            inlined_lines.append(new_line)
                    inlined_lines.append("__POP_SCOPE__")
                    for l in reversed(inlined_lines): lines.insert(i + 1, l)
                    self.log_step(f"Called {func_name}")
                    i += 1; continue

            # --- C. STANDARD OPERATIONS ---
            
            # 1. Allocation: Node* p = new Node(10)
            match_alloc = re.search(r"Node\s*\*\s*(\w+)\s*=\s*new\s+Node\((\d*)\)", line)
            if match_alloc:
                var_name = match_alloc.group(1)
                val = int(match_alloc.group(2)) if match_alloc.group(2) else 0
                new_addr = self._get_new_addr()
                self.heap[new_addr] = {"val": val, "next": None}
                self.stack[var_name] = new_addr
                self.log_step(original_line)
                i += 1; continue

            # 1B. Reassignment: p = new Node(10)
            match_reassign = re.search(r"^(\w+)\s*=\s*new\s+Node\((\d*)\)", line)
            if match_reassign:
                var_name = match_reassign.group(1)
                val = int(match_reassign.group(2)) if match_reassign.group(2) else 0
                new_addr = self._get_new_addr()
                self.heap[new_addr] = {"val": val, "next": None}
                self.stack[var_name] = new_addr
                self.log_step(original_line)
                i += 1; continue

            # 2. POINTER COPY: Node* curr = head->next->next (UPDATED)
            # We explicitly exclude "new" to avoid conflict with allocation
            match_decl_copy = re.search(r"Node\s*\*\s*(\w+)\s*=\s*([a-zA-Z0-9_\->]+)", line)
            if match_decl_copy:
                lhs = match_decl_copy.group(1)
                rhs = match_decl_copy.group(2)
                
                if "new" not in rhs:
                    final_addr = None
                    
                    if rhs == "nullptr" or rhs == "NULL":
                        final_addr = None
                    elif "->" in rhs:
                        # TRAVERSAL LOGIC for "head->next->next"
                        path = rhs.split('->')
                        curr_addr = self.stack.get(path[0])
                        valid_path = True
                        for step in path[1:]:
                            if curr_addr and self.heap[curr_addr]['next']:
                                curr_addr = self.heap[curr_addr]['next']
                            else:
                                valid_path = False
                                break
                        if valid_path: final_addr = curr_addr
                    else:
                        # Simple "curr = head"
                        final_addr = self.stack.get(rhs)

                    self.stack[lhs] = final_addr
                    self.log_step(original_line)
                    i += 1; continue

            # 3. CHAINED LINK UPDATE: list->next->next = ...
            if "->next" in line and "=" in line:
                parts = line.split('=')
                lhs = parts[0].strip()
                rhs = parts[1].strip()
                if lhs.endswith('->next'):
                    target_addr = None
                    match_new = re.search(r"new\s+Node\((\d*)\)", rhs)
                    if match_new:
                        val = int(match_new.group(1)) if match_new.group(1) else 0
                        target_addr = self._get_new_addr()
                        self.heap[target_addr] = {"val": val, "next": None}
                    elif rhs == "nullptr" or rhs == "NULL": target_addr = None
                    elif rhs in self.stack: target_addr = self.stack[rhs]

                    parent_path_str = lhs[:-6] 
                    path = parent_path_str.split('->')
                    curr_addr = self.stack.get(path[0])
                    valid_path = True
                    for step in path[1:]:
                        if curr_addr and self.heap[curr_addr]['next']:
                            curr_addr = self.heap[curr_addr]['next']
                        else:
                            valid_path = False; break
                    if valid_path and curr_addr:
                        self.heap[curr_addr]['next'] = target_addr
                        self.log_step(original_line)
                        i += 1; continue

            # 4. Traversal
            match_traverse = re.search(r"(\w+)\s*=\s*(\w+)->next", line)
            if match_traverse:
                lhs, rhs = match_traverse.groups()
                curr_addr = self.stack.get(rhs)
                if curr_addr and self.heap[curr_addr]["next"]:
                    self.stack[lhs] = self.heap[curr_addr]["next"]
                else: self.stack[lhs] = None
                self.log_step(original_line)
                i += 1; continue

            # 5. Assignment
            match_assign = re.search(r"^(\w+)\s*=\s*(\w+)$", line)
            if match_assign:
                lhs, rhs = match_assign.groups()
                if rhs == "new": 
                     new_addr = self._get_new_addr()
                     self.heap[new_addr] = {"val": 0, "next": None}
                     self.stack[lhs] = new_addr
                else: self.stack[lhs] = self.stack.get(rhs) if (rhs != "nullptr" and rhs != "NULL") else None
                self.log_step(original_line)
                i += 1; continue
            
            # 6. Data Update
            if "->data" in line or "->val" in line:
                parts = line.split('=')
                lhs = parts[0].strip().replace('->val', '->data')
                val_str = parts[1].strip().replace(';', '') 
                value = int(val_str)
                path = lhs.split('->') 
                curr = self.stack.get(path[0])
                valid = True
                for step in path[1:-1]: 
                    if curr and self.heap[curr]['next']: curr = self.heap[curr]['next']
                    else: valid = False
                if valid and curr: self.heap[curr]['val'] = value
                self.log_step(original_line)
                i += 1; continue

            i += 1

        return self.trace_log

@app.route('/run', methods=['POST'])
def run_simulation():
    data = request.json
    sim = LinkedListSimulator()
    trace = sim.execute(data.get('code', ''))
    return jsonify(trace)

if __name__ == '__main__':
    app.run(port=5001, debug=True)