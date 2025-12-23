# C++ Linked List Memory Visualizer

A full-stack educational tool that parses C++ code to animate the relationship between the **Stack** (pointers) and the **Heap** (nodes). 



## The "Magic" Behind the Project
Unlike standard visualizers that use simple "Add/Remove" buttons, this project contains a **custom-built Python interpreter** designed to simulate how a C-style compiler manages memory in real-time.

### 🛠️ Key Technical Features
* **Code Parsing & Tokenization:** Uses Regex-based pattern matching in Python to interpret C++ syntax, including `new Node()`, pointer reassignment, and `while` loops.
* **Virtual Memory Management:** Tracks a simulated **Stack** (local variables) and **Heap** (dynamic memory addresses like `0x1`, `0x2`) to show exactly how memory is allocated.
* **Step-Through Debugging:** Generates a "Trace Log" of the entire execution, allowing users to move **forward and backward** through their code's execution timeline.
* **Scope & Function Handling:** Supports function calls and reference parameters (`Node* &head`), simulating scope pushes and pops to clear local stack variables.

---

## Architecture

| Component | Responsibility |
| :--- | :--- |
| **Frontend (React)** | Code editor interface, SVG-based node rendering, and state playback controls. |
| **Backend (Flask)** | Receives C++ strings, executes the simulation logic, and returns a JSON "snapshot" of memory for every line. |
| **Visualization** | Dynamic arrow (pointer) generation to represent `next` links in the heap. |



---

## Supported C++ Syntax
The backend simulator currently supports:
* **Allocation:** `Node* p = new Node(10);`
* **Traversal:** `curr = curr->next;`
* **Link Updates:** `head->next->next = newNode;`
* **Loops:** `while(curr != nullptr) { ... }`
* **Functions:** Custom function definitions with pointer-reference support.

---

## Getting Started

### Prerequisites
* **Python 3.x**
* **Node.js & npm**

### 1. Clone the Repo
```bash
git clone [https://github.com/shannonlee0/linked-list-visualizer.git](https://github.com/shannonlee0/linked-list-visualizer.git)
cd linked-list-visualizer
