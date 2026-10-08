from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import subprocess
import tempfile
import os
import json
import shutil
import asyncio
import glob
import serial.tools.list_ports
import serial

app = FastAPI(title="Hardware Gatekeeper API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ARDUINO_CLI = os.path.join(os.path.dirname(__file__), "arduino-cli", "arduino-cli.exe")

BOARD_MAP = {
    "arduino:avr:uno": {
        "name": "Arduino Uno",
        "vid_pid": ["2341:0043", "2341:0001", "1A86:7523"],
    },
    "arduino:avr:nano": {
        "name": "Arduino Nano",
        "vid_pid": ["2341:0043", "1A86:7523"],
    },
    "arduino:avr:mega": {
        "name": "Arduino Mega",
        "vid_pid": ["2341:0042", "2341:0010"],
    },
    "esp32:esp32:esp32": {
        "name": "ESP32 Dev Module",
        "vid_pid": ["10C4:EA60", "1A86:55D4"],
    },
    "esp32:esp32:esp32s3": {
        "name": "ESP32-S3",
        "vid_pid": ["303A:1001"],
    },
    "esp32:esp32:esp32c3": {
        "name": "ESP32-C3",
        "vid_pid": ["303A:1001"],
    },
}

_cores_installed = False

async def ensure_cores():
    global _cores_installed
    if _cores_installed:
        return
    try:
        subprocess.run([ARDUINO_CLI, "config", "init", "--overwrite"], capture_output=True, timeout=30)
        subprocess.run([ARDUINO_CLI, "core", "update-index"], capture_output=True, timeout=60)
        subprocess.run([ARDUINO_CLI, "core", "install", "arduino:avr"], capture_output=True, timeout=120)
        subprocess.run([ARDUINO_CLI, "config", "add", "board_manager.additional_urls", "https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json"], capture_output=True, timeout=30)
        subprocess.run([ARDUINO_CLI, "core", "update-index"], capture_output=True, timeout=60)
        subprocess.run([ARDUINO_CLI, "core", "install", "esp32:esp32"], capture_output=True, timeout=300)
        _cores_installed = True
    except Exception as e:
        print(f"Core installation warning: {e}")

class ComponentInstance(BaseModel):
    id: str
    type: str
    x: float
    y: float

class Wire(BaseModel):
    model_config = ConfigDict(populate_by_name=True)
    from_pin: str = Field(alias="from")
    to_pin: str = Field(alias="to")

class Circuit(BaseModel):
    components: List[ComponentInstance]
    wiring: List[Wire]

def _split_endpoint(value: str):
    if not isinstance(value, str) or ":" not in value:
        return (None, None)
    component_id, pin = value.split(":", 1)
    return component_id.strip(), pin.strip()

def _is_ground(pin: str) -> bool:
    return pin.lower().startswith("gnd") or pin.lower() == "ground"

def _is_power(pin: str) -> bool:
    return pin.lower() in frozenset({"3.3v", "24v", "5v", "12v", "vcc", "3v3", "vbatt", "battery+", "vin"})

def _pin_kind(component_type: str, pin: str):
    component = COMPONENTS_DB.get(component_type.lower(), {})
    return component.get("pins", {}).get(pin)

class CompileRequest(BaseModel):
    code: str
    board: str

class FlashRequest(BaseModel):
    code: str
    board: str
    port: str

class InstallLibRequest(BaseModel):
    library: str

COMPONENTS_DB = {
    "esp32": {
        "type": "mcu",
        "logic_voltage": 3.3,
        "pins": {
            "5V": "power_out",
            "3V3": "power_out",
            "GND": "gnd",
            "D2": "digital_io",
            "D4": "digital_io",
        },
    },
    "led": {
        "type": "output",
        "logic_voltage": 3.3,
        "pins": {
            "A": "power_in",
            "C": "gnd",
        },
    },
    "resistor": {
        "type": "passive",
        "pins": {
            "1": "passive",
            "2": "passive",
        },
    },
    "dht22": {
        "type": "sensor",
        "logic_voltage": 3.3,
        "pins": {
            "VCC": "power_in",
            "GND": "gnd",
            "DATA": "digital_io",
        },
    },
}

@app.get("/")
def read_root():
    return {"message": "Gatekeeper API is running", "flash_enabled": True}

@app.post("/validate-circuit")
async def validate_circuit(circuit: Circuit):
    if len(circuit.components) > 512 or len(circuit.wiring) > 2048:
        return {"status": "error", "errors": ["Circuit exceeds the validation limits."]}
    
    instances = {comp.id: comp.type for comp in circuit.components}
    errors = []
    warnings = []
    
    if len(instances) != len(circuit.components):
        errors.append("Component ids must be unique.")
    
    for wire in circuit.wiring:
        from_comp_id, from_pin = _split_endpoint(wire.from_pin)
        to_comp_id, to_pin = _split_endpoint(wire.to_pin)
        
        if not from_comp_id or not from_pin or not to_comp_id or not to_pin:
            errors.append(f"Invalid wire format: {wire.from_pin} -> {wire.to_pin}. Must be 'comp_id:pin'")
            continue
        
        if from_comp_id not in instances:
            errors.append(f"Component '{from_comp_id}' not found in BOM.")
            continue
        
        if to_comp_id not in instances:
            errors.append(f"Component '{to_comp_id}' not found in BOM.")
            continue
        
        if from_comp_id == to_comp_id and from_pin.lower() == to_pin.lower():
            errors.append(f"Invalid self-connection: {wire.from_pin} -> {wire.to_pin}")
        
        if (_is_power(from_pin) and _is_ground(to_pin)) or (_is_ground(from_pin) and _is_power(to_pin)):
            errors.append(f"SHORT CIRCUIT DETECTED: Connected {wire.from_pin} directly to {wire.to_pin}")
        
        from_kind = _pin_kind(instances[from_comp_id], from_pin)
        to_kind = _pin_kind(instances[to_comp_id], to_pin)
        
        if from_kind == "power_out" and to_kind == "power_out":
            errors.append(f"POWER CONTENTION: Two power outputs are directly connected: {wire.from_pin} -> {wire.to_pin}")
        
        if from_kind is None or to_kind is None:
            warnings.append(f"Pin model not found for {wire.from_pin} or {wire.to_pin}; verify the custom component contract.")
            
    if errors:
        return {"status": "error", "errors": errors, "warnings": warnings}
    return {"status": "success", "message": "Circuit passed Gatekeeper validation!", "warnings": warnings}

@app.get("/flash/status")
async def flash_status():
    if not os.path.exists(ARDUINO_CLI):
        return {"ready": False, "error": "arduino-cli not found. Please download it."}
    try:
        result = subprocess.run([ARDUINO_CLI, "version"], capture_output=True, text=True, timeout=10)
        version = result.stdout.strip()
    except Exception as e:
        return {"ready": False, "error": str(e)}
    try:
        result = subprocess.run([ARDUINO_CLI, "core", "list", "--format", "json"], capture_output=True, text=True, timeout=15)
        cores = json.loads(result.stdout) if result.stdout.strip() else []
    except Exception:
        cores = []
    return {"ready": True, "version": version, "cores": cores}

@app.get("/flash/boards")
async def detect_boards():
    ports = []
    for port_info in serial.tools.list_ports.comports():
        vid_pid = f"{port_info.vid:04X}:{port_info.pid:04X}" if port_info.vid and port_info.pid else None
        detected_board = None
        detected_fqbn = None
        if vid_pid:
            for fqbn, info in BOARD_MAP.items():
                if vid_pid in info["vid_pid"]:
                    detected_board = info["name"]
                    detected_fqbn = fqbn
                    break
        ports.append({
            "port": port_info.device,
            "description": port_info.description,
            "vid_pid": vid_pid,
            "manufacturer": port_info.manufacturer,
            "board": detected_board,
            "fqbn": detected_fqbn
        })
    return {"ports": ports}

@app.post("/flash/install-core")
async def install_core():
    await ensure_cores()
    return {"status": "success", "message": "Cores installed"}

@app.post("/flash/install-library")
async def install_library(req: InstallLibRequest):
    try:
        result = subprocess.run([ARDUINO_CLI, "lib", "install", req.library], capture_output=True, text=True, timeout=120)
        if result.returncode != 0:
            return {"status": "error", "error": result.stderr}
        return {"status": "success", "message": f"Installed {req.library}"}
    except Exception as e:
        return {"status": "error", "error": str(e)}

@app.post("/flash/compile")
async def compile_code(req: CompileRequest):
    if not os.path.exists(ARDUINO_CLI):
        raise HTTPException(status_code=500, detail="arduino-cli not found")
    tmp_dir = tempfile.mkdtemp(prefix="hw_studio_")
    sketch_name = "sketch"
    sketch_dir = os.path.join(tmp_dir, sketch_name)
    os.makedirs(sketch_dir, exist_ok=True)
    ino_path = os.path.join(sketch_dir, f"{sketch_name}.ino")
    with open(ino_path, "w", encoding="utf-8") as f:
        f.write(req.code)
    build_dir = os.path.join(tmp_dir, "build")
    os.makedirs(build_dir, exist_ok=True)
    try:
        result = subprocess.run(
            [ARDUINO_CLI, "compile", "--fqbn", req.board, "--output-dir", build_dir, sketch_dir],
            capture_output=True,
            text=True,
            timeout=120
        )
        if result.returncode != 0:
            stderr = result.stderr
            missing_libs = []
            import re
            for line in stderr.split("\n"):
                if "No such file or directory" in line and "#include" in line:
                    m = re.search(r'#include\s*[<"]([^>"]+)[>"]', line)
                    if m:
                        missing_libs.append(m.group(1).split("/")[0].replace(".h", ""))
            return {
                "status": "error",
                "error": stderr,
                "stdout": result.stdout,
                "missing_libraries": missing_libs,
                "binary_path": None
            }
        bin_files = glob.glob(os.path.join(build_dir, "*.bin")) + glob.glob(os.path.join(build_dir, "*.hex"))
        if not bin_files:
            return {
                "status": "error",
                "error": "Compilation succeeded but no binary found",
                "stdout": result.stdout
            }
        binary_path = bin_files[0]
        binary_size = os.path.getsize(binary_path)
        return {
            "status": "success",
            "stdout": result.stdout,
            "binary_path": binary_path,
            "binary_size": binary_size,
            "binary_name": os.path.basename(binary_path),
            "build_dir": build_dir,
            "tmp_dir": tmp_dir
        }
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return {"status": "error", "error": "Compilation timed out (120s)"}
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return {"status": "error", "error": str(e)}

@app.post("/flash/upload")
async def upload_to_board(req: FlashRequest):
    if not os.path.exists(ARDUINO_CLI):
        raise HTTPException(status_code=500, detail="arduino-cli not found")
    tmp_dir = tempfile.mkdtemp(prefix="hw_studio_")
    sketch_name = "sketch"
    sketch_dir = os.path.join(tmp_dir, sketch_name)
    os.makedirs(sketch_dir, exist_ok=True)
    ino_path = os.path.join(sketch_dir, f"{sketch_name}.ino")
    with open(ino_path, "w", encoding="utf-8") as f:
        f.write(req.code)
    try:
        result = subprocess.run(
            [ARDUINO_CLI, "compile", "--upload", "--fqbn", req.board, "--port", req.port, sketch_dir],
            capture_output=True,
            text=True,
            timeout=180
        )
        if result.returncode != 0:
            shutil.rmtree(tmp_dir, ignore_errors=True)
            return {"status": "error", "error": result.stderr, "stdout": result.stdout}
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return {"status": "success", "stdout": result.stdout, "message": f"Successfully uploaded to {req.port}"}
    except subprocess.TimeoutExpired:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return {"status": "error", "error": "Upload timed out (180s)"}
    except Exception as e:
        shutil.rmtree(tmp_dir, ignore_errors=True)
        return {"status": "error", "error": str(e)}

@app.get("/flash/serial-monitor")
async def serial_monitor(port: str, baud: int = 9600):
    async def generate():
        ser = None
        try:
            ser = serial.Serial(port, baud, timeout=1)
            while True:
                if ser.in_waiting > 0:
                    data = ser.readline().decode("utf-8", errors="replace").strip()
                    if data:
                        yield f"data: {json.dumps({'line': data})}\n\n"
                await asyncio.sleep(0.05)
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"
        finally:
            if ser:
                try:
                    ser.close()
                except Exception:
                    pass
    return StreamingResponse(generate(), media_type="text/event-stream")
