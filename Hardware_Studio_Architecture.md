# Hardware Studio - Full System Architecture & Context

## 1. Executive Summary
Hardware Studio is an AI-powered Electronic Design Automation (EDA) and embedded software development platform. It allows users to build physical circuits, design professional PCBs, and flash C++ code directly to microcontrollers (Arduino, ESP32) using natural language prompts.

**Core Capabilities:**
1. **AI Circuit Generation:** Convert text prompts into interactive 2D breadboard/schematic layouts.
2. **Professional PCB Design:** Generate multi-layer PCB layouts with EDA-standard rendering.
3. **1-Click Hardware Flashing:** Compile and upload AI-generated code directly to physical boards via Web USB / Local Backend.
4. **Interactive Canvas Chat:** Ask questions or modify the circuit directly from the canvas interface.

---

## 2. Technology Stack
*   **Frontend:** Next.js 14 (App Router), React, TypeScript, Tailwind CSS, Framer Motion.
*   **Hardware Rendering:** `@wokwi/elements` (Web Components for realistic electronic parts).
*   **Backend:** FastAPI (Python), Uvicorn.
*   **Hardware Toolchain:** `arduino-cli`, `pyserial`.
*   **AI Engine:** Google Gemini API (`generativelanguage.googleapis.com`) utilizing JSON-structured prompt engineering.

---

## 3. Directory Structure
```text
Hardware Studio (Root)
│
├── src/
│   ├── app/
│   │   ├── page.tsx                 # Main Dashboard (Circuit Builder)
│   │   ├── globals.css              # Global styles & Tailwind
│   │   └── pcb-designer/
│   │       └── page.tsx             # Professional PCB Layout Engine
│   │
│   ├── components/
│   │   ├── CircuitCanvas.tsx        # 2D Interactive Circuit Renderer
│   │   ├── PCBCanvas.tsx            # Altium-style PCB Renderer
│   │   ├── ChatBox.tsx              # Main AI Chat Interface
│   │   ├── FlashPanel.tsx           # Hardware Flashing & Serial Monitor
│   │   └── Terminal.tsx             # System Terminal UI
│   │
│   └── lib/                         # Utilities (if any)
│
├── backend/
│   ├── main.py                      # FastAPI Backend Server
│   ├── requirements.txt             # Python dependencies (fastapi, pyserial)
│   └── arduino-cli/                 # Local Arduino CLI binary & cores
│
└── public/                          # Static assets
```

---

## 4. Key Files & Components (Detailed Breakdown)

### A. Frontend Core (`src/components/`)

#### `CircuitCanvas.tsx`
*   **Purpose:** Renders the 2D interactive circuit.
*   **How it works:**
    *   Takes `data.steps` (JSON) and accumulates components and wires up to the `currentStep`.
    *   Maps AI component IDs to Wokwi Web Components (e.g., `arduino_uno` -> `<wokwi-arduino-uno>`).
    *   **Drag & Drop:** Uses Framer Motion `<motion.div drag>`. Updates wire endpoints in real-time using `requestAnimationFrame` (`handleDrag`).
    *   **Smart Wires:** Calculates SVG Bezier curves between component pins. Uses dynamic tension and offset based on X/Y distances to prevent wire overlapping and simulate gravity/sag.
    *   **Inline Chat:** Contains a local AI chat interface (`canvasChatOpen`). Has a powerful prompt that understands current canvas state, coordinates, and can output JSON to modify, move, or add components.

#### `ChatBox.tsx`
*   **Purpose:** The main sidebar AI communicator.
*   **How it works:**
    *   Contains the **Master System Prompt** (The "LEGENDARY Engineer" prompt).
    *   Forces the LLM to output a strict `<tutorial>` JSON schema.
    *   Parses AI output for `<cmd>` (terminal commands) and `<tutorial>` (circuit steps).
    *   **Rules Enforced:** 1 wire per step, complete circuits only (no truncation), deep engineering reasoning for every component.

#### `FlashPanel.tsx`
*   **Purpose:** Bridges the web app to physical hardware.
*   **How it works:**
    *   Polls backend `GET /flash/boards` to auto-detect connected USB devices.
    *   Takes AI-generated C++ code from the canvas.
    *   Calls `POST /flash/compile` to build the binary.
    *   Calls `POST /flash/upload` to flash the board.
    *   Connects to `GET /flash/serial-monitor` via Server-Sent Events (SSE) to show live printouts from the microcontroller.

#### `PCBCanvas.tsx`
*   **Purpose:** Professional EDA-style printed circuit board view.
*   **How it works:**
    *   Renders dark green FR-4 substrate, gold plated traces, mounting holes.
    *   Supports multiple layers (Top Copper, Bottom Copper, Silkscreen, Drill).
    *   Draws professional component footprints (QFP, SOIC, DIP, SMD pads).

### B. App Pages (`src/app/`)

#### `page.tsx` (Main Dashboard)
*   **State Management:** Holds the `WorkspaceState` which contains an array of `tabs`.
*   **Branching Logic:** Supports Git-like workflow:
    *   `NEW_PROJECT`: Wipes canvas, starts fresh at step 0.
    *   `UPDATE_CURRENT`: Appends new steps to the active tab.
    *   `NEW_TAB`: Clones the main assembly and creates a "sub-module" tab for focused work (e.g., building a robotic arm's wrist without breaking the main chassis).
    *   `MERGE_TAB`: Merges a sub-module back into the main project.
*   **Layout:** Navbar, Left Chat Sidebar, Main Canvas Area, Bottom Flash Drawer, Bottom Terminal Drawer.

### C. Backend Engine (`backend/`)

#### `main.py`
*   **Purpose:** Hardware interaction API running on `localhost:8000`.
*   **Key Endpoints:**
    *   `/validate-circuit`: AI safety check for short circuits.
    *   `/flash/status`: Checks if `arduino-cli` is installed and lists installed cores (`arduino:avr`, `esp32:esp32`).
    *   `/flash/boards`: Uses `pyserial.tools.list_ports` to find connected Arduino/ESP32 devices by checking Vendor ID (VID) and Product ID (PID).
    *   `/flash/compile`: Writes C++ to a temp `.ino` file, runs `arduino-cli compile`. Parses stderr to detect missing libraries and auto-installs them.
    *   `/flash/upload`: Runs `arduino-cli upload` to flash the binary to the specific COM port.
    *   `/flash/serial-monitor`: Opens a serial connection via `pyserial` and yields live text streams.

---

## 5. The AI Communication Protocol (JSON Schema)

When the AI wants to build or modify a circuit, it outputs this exact JSON structure:

```json
{
  "action": "NEW_PROJECT",
  "project_name": "Smart Fan",
  "steps": [
    {
      "phase": "Design",
      "instruction": "Place ESP32",
      "detail": "ESP32 provides 3.3V logic and WiFi capabilities.",
      "add_components": [
        { "id": "mcu1", "type": "esp32", "x": 100, "y": 200 }
      ],
      "add_wiring": []
    },
    {
      "phase": "Wiring",
      "instruction": "Connect DHT22 VCC",
      "detail": "Powering sensor with 3.3V from ESP32",
      "add_components": [],
      "add_wiring": [
        { "from": "mcu1:3V3", "to": "dht1:VCC", "color": "red" }
      ]
    },
    {
      "phase": "Coding",
      "instruction": "Read Temperature",
      "code": "void setup() { ... }",
      "code_language": "cpp"
    }
  ]
}
```

### Action Types Explained:
1. `NEW_PROJECT`: Wipes current state, sets step index to 0. Used for complete new builds.
2. `UPDATE_CURRENT`: Appends `steps` to the existing array. Automatically advances the UI to show the new steps. Used when user asks "add an LED to this".
3. `NEW_TAB`: Copies current circuit into a new workspace tab, then appends steps.
4. `MERGE_TAB`: Replaces the main tab's data with the current tab's data.

---

## 6. Known Mechanics & Workflows

1. **Wire Rendering:** Wires are NOT straight lines. They use SVG `<path>` with Bezier curves (`C` command). The code calculates `tension` and `sag` based on horizontal vs vertical distance to make wires look realistic and prevent overlapping.
2. **Animation:** Components use `<motion.div>` for spring-based entrance animations. Wires animate their drawing process using CSS `stroke-dasharray` and `stroke-dashoffset`.
3. **Auto-Library Management:** If a user asks for code using `#include <DHT.h>`, the backend will fail compiling initially, detect the missing library from the C++ compiler output, run `arduino-cli lib install DHT`, and retry the compilation seamlessly.

## 7. Future Roadmap / Extensibility
*   **3D Positioning:** The Inline Chat prompt is now tuned to distribute components spatially across the 2500x2500 canvas to mimic physical layered designs (e.g., Robot chassis at bottom, arms in middle).
*   **PCB Trace Routing:** PCBCanvas is prepped to accept trace routes via AI.
*   **Third-Party Boards:** Can easily be expanded to STM32, Teensy, or Raspberry Pi Pico by installing the respective `arduino-cli` core in the backend.
