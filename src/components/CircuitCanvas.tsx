'use client';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import { Move, CheckCircle2, ChevronLeft, ChevronRight, ChevronUp, Play, ZoomIn, ZoomOut, Maximize, Send, Loader2, MessageCircle, X, SkipBack, Search, Zap } from 'lucide-react';
import { requestAgent } from '@/lib/agent/client';
// system-prompt not used here; canvas chat uses contextPrompt directly
import { extractTutorialResponse, cleanAgentText } from '@/lib/agent/protocol';
import { buildHardwareStudioSystemPrompt } from '@/lib/agent/system-prompt';

export interface ComponentInstance {
  id: string;
  type: string;
  x: number;
  y: number;
}

export interface Wire {
  from: string;
  to: string;
  color?: string;
}

export interface TutorialStep {
  insert_after_step?: number;
  replace_step?: number;
  instruction: string;
  detail?: string;
  verify?: string;
  code?: string;
  code_language?: string;
  phase?: string;
  add_components?: any[];
  add_wiring?: any[];
  remove_components?: string[];
  remove_wiring?: Array<string | { from: string; to: string }>;
}

export interface TutorialData {
  action?: 'NEW_PROJECT' | 'UPDATE_CURRENT' | 'NEW_TAB' | 'MERGE_TAB';
  target_tab?: string;
  project_name?: string;
  description?: string;
  blueprint_svg?: string;
  steps: TutorialStep[];
}

interface CircuitCanvasProps {
  data: TutorialData | null;
  currentStep: number;
  onStepChange: (step: number) => void;
  allTabs?: any[];
  apiKeys?: string[];
  model?: string;
  onUpdateCircuit?: (data: any) => void;
  onCompileRequest?: (code: string) => void;
}


const getWireStats = (color: string, pin1: string, pin2: string) => {
  const isPower = color === '#ef4444' || pin1.includes('5V') || pin1.includes('3.3V') || pin1.includes('VIN');
  const isGnd = color === '#000000' || pin1.includes('GND') || pin2.includes('GND');
  const isSDA = pin1.includes('SDA') || pin2.includes('SDA');
  const isSCL = pin1.includes('SCL') || pin2.includes('SCL');
  const isPWM = color === '#f97316' || pin1.includes('~') || pin2.includes('~') || pin1.includes('PWM');
  
  if (isGnd) return { 'Voltage': '0V (Ref)', 'Current': 'Return Path', 'Type': 'Ground' };
  if (isPower) {
    const v = pin1.includes('3.3V') ? '3.3V' : (pin1.includes('9V') ? '9.0V' : '5.0V');
    return { 'Voltage': v, 'Max Current': '~500mA', 'Type': 'Power Supply' };
  }
  if (isSDA) return { 'Logic Level': '3.3V / 5V', 'Protocol': 'I2C Data', 'Frequency': '100-400 kHz' };
  if (isSCL) return { 'Logic Level': '3.3V / 5V', 'Protocol': 'I2C Clock', 'Frequency': '100-400 kHz' };
  if (isPWM) return { 'Voltage': '0-5V (Pulsed)', 'Frequency': '~490 Hz', 'Type': 'PWM Signal' };
  
  return { 'Voltage': '0-5V (Logic)', 'Max Current': '< 40mA', 'Type': 'Digital/Analog Signal' };
};

const getComponentStats = (type: string) => {
  const t = (type || '').toLowerCase();
  if (t.includes('uno') || t.includes('nano')) return { 'Operating Voltage': '5V', 'Input Voltage': '7-12V', 'Clock Speed': '16 MHz', 'Logic Level': '5V' };
  if (t.includes('esp32')) return { 'Operating Voltage': '3.3V', 'Clock Speed': '160-240 MHz', 'Wireless': 'Wi-Fi + BLE' };
  if (t.includes('motor_driver') || t.includes('l298n')) return { 'Logic Voltage': '5V', 'Motor Voltage': '5-35V', 'Max Current': '2A per channel' };
  if (t.includes('servo')) return { 'Operating Voltage': '4.8-6.0V', 'Control': 'PWM (50Hz)' };
  if (t.includes('ultrasonic') || t.includes('hc-sr04')) return { 'Operating Voltage': '5V', 'Current': '15mA', 'Frequency': '40 kHz', 'Range': '2-400cm' };
  if (t.includes('dht')) return { 'Operating Voltage': '3.3-5V', 'Current': '2.5mA max', 'Signal': 'Digital (1-wire)' };
  if (t.includes('led')) return { 'Forward Voltage': '1.8-3.3V', 'Rec. Current': '20mA' };
  if (t.includes('resistor')) return { 'Power Rating': '1/4 Watt', 'Tolerance': '±5%' };
  if (t.includes('battery')) return { 'Voltage': t.includes('9v') ? '9V' : '3.7V', 'Type': 'Power Source' };
  if (t.includes('oled') || t.includes('lcd')) return { 'Operating Voltage': '3.3-5V', 'Interface': 'I2C / SPI', 'Current': '~20mA' };
  return { 'Status': 'Passive / Generic', 'Voltage': 'Circuit Dependent' };
};

function highlightCode(code: string) {
  return code
    .replace(/(\/\/[^\n]*)/g, '<span style="color:#6A9955">$1</span>')
    .replace(/(\b(int|void|const|char|bool|float|double|long|unsigned)\b)/g, '<span style="color:#569CD6">$1</span>')
    .replace(/(\b(if|else|for|while|return|switch|case|break|continue)\b)/g, '<span style="color:#C586C0">$1</span>')
    .replace(/(\b(OUTPUT|INPUT|HIGH|LOW|true|false)\b)/g, '<span style="color:#4FC1FF">$1</span>')
    .replace(/(\b(digitalWrite|digitalRead|analogWrite|analogRead|pinMode|delay|Serial|begin|print|println)\b)/g, '<span style="color:#DCDCAA">$1</span>')
    .replace(/(\b(setup|loop)\b)/g, '<span style="color:#DCDCAA">$1</span>')
    .replace(/(#include\s+<[^>]+>|#include\s+"[^"]+")/g, '<span style="color:#C586C0">$1</span>')
    .replace(/("[^"]*")/g, '<span style="color:#CE9178">$1</span>')
    .replace(/(\b\d+\b)/g, '<span style="color:#B5CEA8">$1</span>');
}

function CodePreviewModal({ code, language, onClose }: { code: string; language: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 md:p-12">
      <div className="bg-[#1e1e1e] border border-gray-700 w-full h-full max-w-6xl max-h-full rounded-xl shadow-2xl flex flex-col overflow-hidden">
        <div className="h-10 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[#cccccc] text-[11px] font-mono tracking-wider uppercase">{language === 'cpp' ? 'main.cpp' : 'code.ino'}</span>
          </div>
          <div className="flex items-center gap-4">
             <button onClick={() => navigator.clipboard.writeText(code)} className="text-gray-400 hover:text-white transition-colors flex items-center gap-1.5" title="Copy code">
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
               <span className="text-xs">Copy</span>
             </button>
             <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors" title="Close">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12"></path></svg>
             </button>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-6 bg-[#1e1e1e]">
          <pre 
            className="text-[13px] leading-relaxed font-mono text-[#d4d4d4] whitespace-pre-wrap"
            dangerouslySetInnerHTML={{ __html: highlightCode(code) }}
          />
        </div>
      </div>
    </div>
  );
}

export function CircuitCanvas({ data, currentStep: currentStepIndex, onStepChange: setCurrentStepIndex, apiKeys, model, onUpdateCircuit, onCompileRequest, allTabs }: CircuitCanvasProps) {
  const [previewCode, setPreviewCode] = useState<{code: string, language: string} | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [wirePaths, setWirePaths] = useState<{ id: string, path: string, color: string, fromX: number, fromY: number, fromPin: string, labelX: number, labelY: number, labelText: string, fromComp: string, toComp: string }[]>([]);
  const [wokwiLoaded, setWokwiLoaded] = useState(false);
  const [expandedPanel, setExpandedPanel] = useState(false);
  const [dockPosition, setDockPosition] = useState<'bottom-right' | 'top-left'>('bottom-right');
  const dragControls = useDragControls();
  const [selectedComponentId, setSelectedComponentId] = useState<string | null>(null);
  const [selectedWireId, setSelectedWireId] = useState<string | null>(null);
  const [canvasChatOpen, setCanvasChatOpen] = useState(false);
  const [canvasChatInput, setCanvasChatInput] = useState('');
  const [canvasChatMessages, setCanvasChatMessages] = useState<{role: string, text: string}[]>([]);
  const [canvasChatLoading, setCanvasChatLoading] = useState(false);
  const canvasChatRef = useRef<HTMLDivElement>(null);

  const [isBoardConnected, setIsBoardConnected] = useState(false);

  useEffect(() => {
    const checkBoard = async () => {
      try {
        const res = await fetch('http://localhost:8000/flash/boards');
        const data = await res.json();
        setIsBoardConnected(data.ports && data.ports.some((p: any) => p.board));
      } catch {
        setIsBoardConnected(false);
      }
    };
    checkBoard();
    const interval = setInterval(checkBoard, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    canvasChatRef.current?.scrollTo({ top: canvasChatRef.current.scrollHeight, behavior: 'smooth' });
  }, [canvasChatMessages]);

  const handleCanvasChat = useCallback(async () => {
    if (!canvasChatInput.trim() || !apiKeys || apiKeys.length === 0 || !model) return;
    const userMsg = canvasChatInput.trim();
    setCanvasChatMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setCanvasChatInput('');
    setCanvasChatLoading(true);

    // Build context about current circuit state
    const currentComponents = data?.steps?.slice(0, currentStepIndex + 1)
      .flatMap(s => s.add_components || []).map(c => `${c.id} (${c.type}) at x:${c.x} y:${c.y}`).join('\n  ') || 'none';
    const currentWires = data?.steps?.slice(0, currentStepIndex + 1)
      .flatMap(s => s.add_wiring || []).map(w => `${w.from} → ${w.to} [${w.color}]`).join('\n  ') || 'none';
    const currentStepInfo = data?.steps?.[currentStepIndex];
    const allStepsJSON = JSON.stringify(data?.steps?.slice(0, currentStepIndex + 1)?.map(s => ({
      phase: s.phase, instruction: s.instruction,
      components: s.add_components?.map(c => ({ id: c.id, type: c.type, x: c.x, y: c.y })),
      wires: s.add_wiring?.map(w => ({ from: w.from, to: w.to, color: w.color }))
    })) || []);

    
      const promptComponents = data?.steps?.slice(0, currentStepIndex + 1)
        .flatMap(s => s.add_components || []) || [];
      const promptWires = data?.steps?.slice(0, currentStepIndex + 1)
        .flatMap(s => s.add_wiring || []) || [];
        
      const systemPrompt = buildHardwareStudioSystemPrompt({
        surface: 'canvas',
        projectName: data?.project_name,
        currentStep: currentStepIndex,
        totalSteps: data?.steps?.length || 0,
        components: promptComponents,
        wires: promptWires,
      });






    try {
      const agentReply = await requestAgent({
        apiKeys: apiKeys || [],
        model,
        systemPrompt: systemPrompt,
        contents: [
          ...canvasChatMessages.map(m => ({
            role: m.role === 'user' ? 'user' as const : 'model' as const,
            parts: [{ text: m.text }]
          })),
          { role: 'user' as const, parts: [{ text: userMsg }] }
        ],
        temperature: 0.2,
        maxOutputTokens: 32768,
      });
      const replyText = agentReply.text;

      // 1. Check for navigation command first
      const navMatch = /<nav\s+step="(\d+)"\s*\/>/.exec(replyText);
      if (navMatch) {
        const targetStep = parseInt(navMatch[1], 10);
        const maxStep = (data?.steps?.length || 1) - 1;
        const safeStep = Math.max(0, Math.min(targetStep, maxStep));
        setCurrentStepIndex(safeStep);
        const cleanReply = replyText.replace(/<nav\s+step="\d+"\s*\/>/g, '').replace(/<work>[\s\S]*?<\/work>/g, '').trim();
        setCanvasChatMessages(prev => [...prev, { role: 'assistant', text: cleanReply || `✅ Step ${safeStep + 1} par aa gaye!` }]);
        setCanvasChatLoading(false);
        return; // Don't process further
      }

      // 2. Apply only a complete, validated tutorial payload.
      const tutorial = extractTutorialResponse(replyText);
      if (tutorial.plan && onUpdateCircuit) {
        onUpdateCircuit(tutorial.plan);
        setCanvasChatMessages(prev => [...prev, { role: 'assistant', text: tutorial.cleanText || 'Circuit updated.' }]);
      } else {
        const cleanReply = tutorial.cleanText || cleanAgentText(replyText).trim();
        const reason = tutorial.errors.length ? ` Canvas unchanged: ${tutorial.errors.join(' ')}` : '';
        setCanvasChatMessages(prev => [...prev, { role: 'assistant', text: `${cleanReply || 'No canvas update was returned.'}${reason}` }]);
      }
    } catch (e: any) {
      const msg = e.message || '';
      // Auto-retry once on transient errors (service unavailable, rate limit, network)
      if (msg.includes('unavailable') || msg.includes('503') || msg.includes('429') || msg.includes('network')) {
        setCanvasChatMessages(prev => [...prev, { role: 'assistant', text: '⏳ Service busy, retrying in 2s...' }]);
        await new Promise(r => setTimeout(r, 2000));
        try {
          const retryReply = await requestAgent({
            apiKeys: apiKeys || [], model,
            systemPrompt: systemPrompt,
            contents: [
              ...canvasChatMessages.map(m => ({
                role: m.role === 'user' ? 'user' as const : 'model' as const,
                parts: [{ text: m.text }]
              })),
              { role: 'user' as const, parts: [{ text: canvasChatInput }] }
            ],
            maxOutputTokens: 32768,
          });
          const cleanReply = cleanAgentText(retryReply.text).trim();
          // Remove the "retrying..." message and add the real reply
          setCanvasChatMessages(prev => [...prev.slice(0, -1), { role: 'assistant', text: cleanReply || '✅ Done!' }]);
          setCanvasChatLoading(false);
          return;
        } catch {
          // Retry also failed
        }
      }
      setCanvasChatMessages(prev => [...prev, { role: 'assistant', text: `Error: ${msg}. Please try again.` }]);
    }
    setCanvasChatLoading(false);
  }, [canvasChatInput, apiKeys, model, data, currentStepIndex, canvasChatMessages, onUpdateCircuit]);

  useEffect(() => {
    import('@wokwi/elements').then(() => {
      setWokwiLoaded(true);
    }).catch(error => {
      console.error('Wokwi elements unavailable; using canvas SVG fallbacks.', error);
      setWokwiLoaded(true);
    });
  }, []);

  // Compute accumulated state up to current step
  const accumulatedState = useMemo(() => {
    if (!data) return { components: [], wiring: [], instruction: '' };
    
    const compMap = new Map<string, any>();
    
    // Pre-populate with components from all OTHER tabs so cross-tab wiring works
    if (allTabs) {
      allTabs.forEach(tab => {
        if (tab.name !== data?.project_name && tab.components) {
          tab.components.forEach((c: any) => {
            // Add with a subtle ghost flag so we know it's external
            compMap.set(c.id, { ...c, isExternal: true });
          });
        }
      });
    }
    const wireMap = new Map<string, any>();
    let instruction = '';

    for (let i = 0; i <= currentStepIndex && i < data.steps.length; i++) {
      const step = data.steps[i];
      
      // Handle removals first
      if (step.remove_components) {
        step.remove_components.forEach(id => {
          compMap.delete(id);
          // Also remove any wiring connected to this component
          for (const [key, w] of Array.from(wireMap.entries())) {
            if (w.from.startsWith(id + ':') || w.to.startsWith(id + ':')) {
              wireMap.delete(key);
            }
          }
        });
      }
      
      if (step.remove_wiring) {
        step.remove_wiring.forEach(item => {
          if (typeof item === 'string') {
            for (const [key, w] of Array.from(wireMap.entries())) {
              if (w.from === item || w.to === item) wireMap.delete(key);
            }
          } else if (item && typeof item === 'object' && item.from && item.to) {
            wireMap.delete(`${item.from}-${item.to}`);
          }
        });
      }

      if (step.add_components) {
        step.add_components.forEach(c => compMap.set(c.id, c));
      }
      if (step.add_wiring) {
        step.add_wiring.forEach(w => wireMap.set(`${w.from}-${w.to}`, w));
      }
      if (i === currentStepIndex) {
        instruction = step.instruction;
      }
    }

    return {
      components: Array.from(compMap.values()),
      wiring: Array.from(wireMap.values()),
      instruction
    };
  }, [data, currentStepIndex]);

  // Helper to find a pin robustly
  const findPin = (pinInfo: any[], pinName: string) => {
    if (!pinInfo) return null;
    const nameUpper = pinName.toUpperCase();
    
    // Exact match
    let pin = pinInfo.find(p => p.name.toUpperCase() === nameUpper);
    if (pin) return pin;

    // Alias mapping for ESP32 and common conventions
    const aliases: Record<string, string[]> = {
      '5V': ['VIN', 'VCC', '5V.1', '5V.2'],
      '3V3': ['3.3V', '3V', '3V3.1'],
      'GND': ['GND.1', 'GND.2', 'GND.3']
    };

    if (aliases[nameUpper]) {
      for (const alias of aliases[nameUpper]) {
        pin = pinInfo.find(p => p.name.toUpperCase() === alias);
        if (pin) return pin;
      }
    }
    
    // Partial match as last resort (e.g. GND matches GND.1)
    return pinInfo.find(p => p.name.toUpperCase().includes(nameUpper));
  };

  const updateWires = () => {
    if (!containerRef.current) return;
    const paths: typeof wirePaths = [];

    const getPinOffset = (el: any, compType: string, pinName: string, rect: {width: number, height: number}) => {
      let pin = findPin(el.pinInfo || [], pinName);
      let scaleX = 1;
      let scaleY = 1;
      let offsetX = 0;
      let offsetY = 0;
      
      if (!pin) {
        const hardcoded: Record<string, any> = {
          'esp32': { viewBox: { w: 107, h: 201 }, pins: { 'VIN': { x: 5, y: 158.5 }, '3V3': { x: 101.3, y: 158.5 }, 'GND.1': { x: 101.3, y: 149 }, 'GND.2': { x: 5, y: 149 } } },
          'led': { viewBox: { w: 40, h: 50 }, pins: { 'A': { x: 25, y: 42 }, 'C': { x: 15, y: 42 } } }
        };
        const fallbackComp = hardcoded[compType];
        if (fallbackComp) {
           pin = findPin(Object.keys(fallbackComp.pins).map(k => ({ name: k, ...fallbackComp.pins[k] })), pinName);
           if (pin) { scaleX = rect.width / fallbackComp.viewBox.w; scaleY = rect.height / fallbackComp.viewBox.h; }
        }
      } else {
         if (el.shadowRoot) {
           const svg = el.shadowRoot.querySelector('svg');
           if (svg && svg.viewBox && svg.viewBox.baseVal && svg.viewBox.baseVal.width > 0) {
             scaleX = rect.width / svg.viewBox.baseVal.width;
             scaleY = rect.height / svg.viewBox.baseVal.height;
             offsetX = svg.viewBox.baseVal.x;
             offsetY = svg.viewBox.baseVal.y;
           }
         }
      }
      
      if (!pin) {
        const pUpper = pinName.toUpperCase();
        if (compType.includes('motor') || compType.includes('dc_motor')) {
            const isPos = pUpper.includes('+') || pUpper.includes('POS') || pUpper === '1';
            return { x: 18 * (rect.width/100), y: (isPos ? 20 : 60) * (rect.height/80) };
        }
        if (compType.includes('battery') || compType.includes('9v')) {
            const isPos = pUpper.includes('+') || pUpper.includes('VCC') || pUpper.includes('POS');
            return { x: (isPos ? 27 : 43) * (rect.width/70), y: 10 * (rect.height/100) };
        }
        if (compType.includes('l298n') || compType.includes('driver')) {
            const isOut = pUpper.includes('OUT');
            const idx = (parseInt(pUpper.replace(/[^0-9]/g, '')) || 1) - 1;
            const px = isOut ? (17 + (idx%4)*20) : (18 + (idx%6)*22);
            return { x: px * (rect.width/160), y: (isOut ? 7 : 105) * (rect.height/120) };
        }
        if (compType.includes('ir_sensor') || compType.includes('ir_line')) {
            let px = 41;
            if (pUpper.includes('VCC') || pUpper.includes('5V')) px = 21;
            if (pUpper.includes('OUT') || pUpper.includes('SIG')) px = 61;
            return { x: px * (rect.width/80), y: 44 * (rect.height/50) };
        }
        
        if (compType.includes('lm386') || compType.includes('lm') || compType.includes('op_amp') || compType.includes('ic_')) {
            let pinNum = parseInt(pUpper.replace(/[^0-9]/g, ''));
            if (pUpper === 'VCC') pinNum = 6;
            if (pUpper === 'GND') pinNum = 4;
            if (pUpper === 'IN' || pUpper === 'IN1') pinNum = 2;
            if (pUpper === 'IN2') pinNum = 3;
            if (pUpper === 'OUT') pinNum = 5;
            
            if (pinNum >= 1 && pinNum <= 8) {
                const isLeft = pinNum <= 4;
                const idx = isLeft ? (pinNum - 1) : (8 - pinNum);
                return { 
                    x: (isLeft ? 11 : 89) * (rect.width/100), 
                    y: (18 + idx * 12) * (rect.height/80) 
                };
            }
        }
        
        let hash = 0;
        for (let i = 0; i < pUpper.length; i++) hash += pUpper.charCodeAt(i);
        if (pUpper === 'GND' || pUpper === 'VCC' || pUpper === '5V') hash = (hash % 6) + 6; 
        
        const slot = hash % 12;
        const isTop = slot < 6;
        const index = slot % 6;
        const px = 21 + index * 20;
        const py = isTop ? 7 : 83;
        
        return { x: px * (rect.width/140), y: py * (rect.height/90) };
      }
      
      return { x: (pin.x - offsetX) * scaleX, y: (pin.y - offsetY) * scaleY };
    };

    accumulatedState.wiring.forEach((wire, idx) => {
      const [fromId, fromPin] = wire.from.split(':');
      const [toId, toPin] = wire.to.split(':');

      const fromEl = document.getElementById(`comp-${fromId}`);
      const toEl = document.getElementById(`comp-${toId}`);
      const fromCompData = accumulatedState.components.find(c => c.id === fromId);
      const toCompData = accumulatedState.components.find(c => c.id === toId);

      if (fromEl && toEl && fromCompData && toCompData) {
        const fromRect = { width: fromEl.offsetWidth, height: fromEl.offsetHeight };
        const toRect = { width: toEl.offsetWidth, height: toEl.offsetHeight };

        const fromCoords = getPinOffset(fromEl, fromCompData.type, fromPin, fromRect);
        const toCoords = getPinOffset(toEl, toCompData.type, toPin, toRect);

        // Read real-time translation from Framer Motion's transform
        const getRealPos = (el: HTMLElement, baseComp: any) => {
          let tx = 0, ty = 0;
          const style = window.getComputedStyle(el);
          const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? undefined : style.transform);
          tx = matrix.m41;
          ty = matrix.m42;
          return { x: baseComp.x + tx, y: baseComp.y + ty, rotate: baseComp.rotate || 0 };
        };

        const realFrom = getRealPos(fromEl, fromCompData);
        const realTo = getRealPos(toEl, toCompData);

        // Calculate absolute point considering rotation around center
        const getRotatedPoint = (rect: {width: number, height: number}, coords: {x: number, y: number}, realPos: {x: number, y: number, rotate: number}) => {
            const cx = rect.width / 2;
            const cy = rect.height / 2;
            const dx = coords.x - cx;
            const dy = coords.y - cy;
            const angle = (realPos.rotate * Math.PI) / 180;
            const rx = dx * Math.cos(angle) - dy * Math.sin(angle);
            const ry = dx * Math.sin(angle) + dy * Math.cos(angle);
            return {
                x: realPos.x + cx + rx,
                y: realPos.y + cy + ry
            };
        };

        const fromPt = getRotatedPoint(fromRect, fromCoords, realFrom);
        const toPt = getRotatedPoint(toRect, toCoords, realTo);

        const x1 = fromPt.x;
        const y1 = fromPt.y;
        const x2 = toPt.x;
        const y2 = toPt.y;

        const dx = x2 - x1;
        const dy = y2 - y1;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Smart Bezier routing - curves that look like real wires
        let path: string;
        const tension = Math.min(dist * 0.4, 120); // Control point distance scales with wire length
        
        if (Math.abs(dy) < 50) {
          // Mostly horizontal — gentle downward arc
          const sag = 15 + (idx % 3) * 8; // slight stagger to avoid overlap
          const midX = (x1 + x2) / 2;
          path = `M ${x1} ${y1} C ${midX} ${y1 + sag}, ${midX} ${y2 + sag}, ${x2} ${y2}`;
        } else if (Math.abs(dx) < 50) {
          // Mostly vertical — gentle sideways arc
          const sway = 15 + (idx % 3) * 8;
          const midY = (y1 + y2) / 2;
          path = `M ${x1} ${y1} C ${x1 + sway} ${midY}, ${x2 + sway} ${midY}, ${x2} ${y2}`;
        } else {
          // Diagonal — smooth S-curve
          const cx1 = x1 + dx * 0.25;
          const cy1 = y1 + dy * 0.05;
          const cx2 = x2 - dx * 0.25;
          const cy2 = y2 - dy * 0.05;
          path = `M ${x1} ${y1} C ${cx1} ${cy1 + tension * 0.3}, ${cx2} ${cy2 - tension * 0.3}, ${x2} ${y2}`;
        }

        paths.push({
          id: `wire-${idx}`,
          path,
          color: wire.color || '#888',
          fromX: x1, fromY: y1, fromPin: fromPin,
          labelX: x2, labelY: y2, labelText: toPin,
          fromComp: fromId,
          toComp: toId
        });
      }
    });
    setWirePaths(paths);
  };

  // RAF-throttled drag handler for smooth real-time wire updates
  const dragRAF = useRef<number>(0);
  const handleDrag = () => {
    if (dragRAF.current) cancelAnimationFrame(dragRAF.current);
    dragRAF.current = requestAnimationFrame(() => {
      updateWires();
    });
  };

  const handleDragEnd = () => {
    // Final wire update after drag completes
    setTimeout(() => updateWires(), 0);
    setTimeout(() => updateWires(), 50);
  };

  // Wire update on state changes + periodic sync during component animations
  useEffect(() => {
    updateWires();
    const t1 = setTimeout(() => updateWires(), 150);
    const t2 = setTimeout(() => updateWires(), 400);
    const t3 = setTimeout(() => updateWires(), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [accumulatedState.components, accumulatedState.wiring, wokwiLoaded, currentStepIndex]);

  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const startPanRef = useRef({ x: 0, y: 0 });
  const [mousePos, setMousePos] = useState({ x: -1000, y: -1000 });

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).id === 'workspace-bg' || (e.target as HTMLElement).tagName === 'svg') {
      setIsPanning(true);
      startPanRef.current = { x: e.clientX - transform.x, y: e.clientY - transform.y };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
    }
    if (isPanning) {
      setTransform(prev => ({ ...prev, x: e.clientX - startPanRef.current.x, y: e.clientY - startPanRef.current.y }));
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (isPanning) {
      setIsPanning(false);
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey || true) {
        // We always want to prevent default scroll when inside canvas
        // so the user can zoom without scrolling the whole page
        e.preventDefault();
      }
      const zoomSensitivity = 0.0015;
      const delta = -e.deltaY * zoomSensitivity;
      setTransform(prev => {
        const newScale = Math.min(Math.max(0.1, prev.scale * (1 + delta)), 5);
        return { ...prev, scale: newScale };
      });
    };

    el.addEventListener('wheel', handleNativeWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleNativeWheel);
  }, []);

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#1e1e1e] rounded-xl overflow-hidden border border-gray-800 shadow-2xl flex flex-col select-none">
      <style>{`
        @keyframes dashHologram {
          to { stroke-dashoffset: -1000; }
        }
        .blueprint-hologram path, 
        .blueprint-hologram circle, 
        .blueprint-hologram rect {
          animation: dashHologram 30s linear infinite;
        }
        
        @keyframes wireFlow {
          to { stroke-dashoffset: -28; }
        }
        .wire-flow {
          animation: wireFlow 1s linear infinite;
        }
      `}</style>

      <div 
        id="workspace-bg"
        className="absolute inset-0 pointer-events-auto touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}

        onClick={() => { setSelectedComponentId(null); setSelectedWireId(null); }}
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.15) 1px, transparent 1px)',
          backgroundSize: `${20 * transform.scale}px ${20 * transform.scale}px`,
          backgroundPosition: `${transform.x}px ${transform.y}px`,
          cursor: isPanning ? 'grabbing' : 'grab'
        }} 
      />

      {/* Mouse Hover Glow Effect */}
      <div 
        className="absolute inset-0 pointer-events-none z-0"
        style={{
          background: `radial-gradient(400px circle at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.04), transparent 40%)`
        }}
      />

      {/* Workspace Area - Zoomable/Pannable */}
      <div className="absolute inset-0 pointer-events-none">
        <div 
          className="absolute origin-top-left pointer-events-none"
          style={{ transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`, width: '4000px', height: '4000px' }}
        >
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
            {/* Blueprint Hologram Layer (Behind components and wires) */}
            {data?.blueprint_svg && (
              <g 
                className="blueprint-hologram"
                dangerouslySetInnerHTML={{ __html: data.blueprint_svg }} 
                style={{ opacity: 0.8 }}
              />
            )}
            
            <AnimatePresence>
              {wirePaths.map(wire => {
                const isSelected = selectedComponentId === wire.fromComp || selectedComponentId === wire.toComp || selectedWireId === wire.id;
                const isDimmed = (selectedComponentId !== null || selectedWireId !== null) && !isSelected;
                return (
              <motion.g 
                key={wire.id} 
                initial={{ opacity: 0 }} 
                animate={{ opacity: isDimmed ? 0.05 : 1 }} 
                exit={{ opacity: 0 }}
                style={{ transition: 'opacity 0.2s' }}
              >
                {/* Clickable invisible hit area */}
                <path
                  d={wire.path}
                  stroke="transparent"
                  strokeWidth={20}
                  fill="none"
                  className="pointer-events-auto cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); setSelectedWireId(wire.id); setSelectedComponentId(null); }}
                />
                {/* Wire trace background */}
                <path
                  d={wire.path}
                  stroke={wire.color}
                  strokeWidth={2}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  opacity={0.5}
                />
                {/* Flowing current dash */}
                <path
                  d={wire.path}
                  stroke={wire.color}
                  strokeWidth={2.5}
                  fill="none"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  strokeDasharray="6 8"
                  className="wire-flow"
                />
                
                {/* Source pin: glow + dot + label */}
                <circle cx={wire.fromX} cy={wire.fromY} r="6" fill={wire.color} opacity="0.15" />
                <circle cx={wire.fromX} cy={wire.fromY} r="4" fill={wire.color} stroke="#0a0a0a" strokeWidth="1.5" />
                <text x={wire.fromX + 7} y={wire.fromY - 6} fill={wire.color} fontSize="8" fontFamily="monospace" fontWeight="bold" opacity="0.9">
                  {wire.fromPin}
                </text>
                
                {/* Target pin: glow + dot + label */}
                <circle cx={wire.labelX} cy={wire.labelY} r="6" fill={wire.color} opacity="0.15" />
                <circle cx={wire.labelX} cy={wire.labelY} r="4" fill={wire.color} stroke="#0a0a0a" strokeWidth="1.5" />
                <text x={wire.labelX + 7} y={wire.labelY - 6} fill={wire.color} fontSize="8" fontFamily="monospace" fontWeight="bold" opacity="0.9">
                  {wire.labelText}
                </text>
              </motion.g>
              );
            })}
          </AnimatePresence>
        </svg>

        <AnimatePresence>
          {wokwiLoaded && accumulatedState.components.map(comp => {
            // Full mapping of user-friendly names -> wokwi element tags
            const wokwiMap: Record<string, string> = {
              'esp32': 'wokwi-esp32-devkit-v1',
              'arduino_uno': 'wokwi-arduino-uno',
              'arduino': 'wokwi-arduino-uno',
              'arduino_mega': 'wokwi-arduino-mega',
              'arduino_nano': 'wokwi-arduino-nano',
              'led': 'wokwi-led',
              'rgb_led': 'wokwi-rgb-led',
              'led_ring': 'wokwi-led-ring',
              'led_bar': 'wokwi-led-bar-graph',
              'neopixel': 'wokwi-neopixel',
              'neopixel_matrix': 'wokwi-neopixel-matrix',
              'resistor': 'wokwi-resistor',
              'potentiometer': 'wokwi-potentiometer',
              'slide_potentiometer': 'wokwi-slide-potentiometer',
              'dht22': 'wokwi-dht22',
              'hc-sr04': 'wokwi-hc-sr04',
              'hcsr04': 'wokwi-hc-sr04',
              'ultrasonic': 'wokwi-hc-sr04',
              'pir': 'wokwi-pir-motion-sensor',
              'pir_sensor': 'wokwi-pir-motion-sensor',
              'ntc': 'wokwi-ntc-temperature-sensor',
              'photoresistor': 'wokwi-photoresistor-sensor',
              'ldr': 'wokwi-photoresistor-sensor',
              'gas_sensor': 'wokwi-gas-sensor',
              'mq2': 'wokwi-gas-sensor',
              'flame_sensor': 'wokwi-flame-sensor',
              'heart_sensor': 'wokwi-heart-beat-sensor',
              'sound_sensor': 'wokwi-big-sound-sensor',
              'ir_receiver': 'wokwi-ir-receiver',
              'ir_remote': 'wokwi-ir-remote',
              'servo': 'wokwi-servo',
              'stepper': 'wokwi-stepper-motor',
              'stepper_motor': 'wokwi-stepper-motor',
              'buzzer': 'wokwi-buzzer',
              'pushbutton': 'wokwi-pushbutton',
              'button': 'wokwi-pushbutton',
              'slide_switch': 'wokwi-slide-switch',
              'dip_switch': 'wokwi-dip-switch-8',
              'keypad': 'wokwi-membrane-keypad',
              'rotary_encoder': 'wokwi-ky-040',
              'lcd': 'wokwi-lcd1602',
              'lcd1602': 'wokwi-lcd1602',
              'lcd2004': 'wokwi-lcd2004',
              'oled': 'wokwi-ssd1306',
              'ssd1306': 'wokwi-ssd1306',
              'tft': 'wokwi-ili9341',
              'ili9341': 'wokwi-ili9341',
              '7segment': 'wokwi-7segment',
              'rtc': 'wokwi-ds1307',
              'ds1307': 'wokwi-ds1307',
              'mpu6050': 'wokwi-mpu6050',
              'accelerometer': 'wokwi-mpu6050',
              'hx711': 'wokwi-hx711',
              'load_cell': 'wokwi-hx711',
              'sd_card': 'wokwi-microsd-card',
              'relay': 'wokwi-ks2e-m-dc5',
              'joystick': 'wokwi-analog-joystick',
              'tilt_switch': 'wokwi-tilt-switch',
            };

            const rawIdentity = [comp.type, comp.id, comp.label, comp.value, comp.custom?.description]
              .filter(Boolean).join(' ').toLowerCase();
            let renderType = String(comp.type || 'custom').toLowerCase();
            if (renderType === 'custom' || renderType.startsWith('custom_')) {
              if (/arduino.{0,20}(uno|r3)|\buno\b/.test(rawIdentity)) renderType = 'arduino_uno';
              else if (/\besp32\b/.test(rawIdentity)) renderType = 'esp32';
              else if (/l298n?|motor driver|h-bridge/.test(rawIdentity)) renderType = 'l298n';
              else if (/(ir|infrared|tcrt5000).{0,28}(sensor|reflective|line)|ir_sensor/.test(rawIdentity)) renderType = 'ir_sensor';
              else if (/(dc|gear|drive).{0,16}motor|motor_(left|right)/.test(rawIdentity)) renderType = 'dc_motor';
              else if (/battery|aa pack/.test(rawIdentity)) renderType = 'battery';
              else if (/chassis|frame/.test(rawIdentity)) renderType = 'chassis';
              else if (/servo/.test(rawIdentity)) renderType = 'servo';
            }
            const wokwiTag = wokwiMap[renderType];
            const useWokwiElement = Boolean(wokwiTag && typeof customElements !== 'undefined' && customElements.get(wokwiTag));
            const scaleVal = renderType === 'led' ? 2 : (renderType === 'esp32' || renderType === 'arduino_uno' || renderType === 'arduino') ? 1.3 : 1;

            const isCompDimmed = selectedComponentId !== null && selectedComponentId !== comp.id;

            return (
              <motion.div
                key={comp.id}
                id={`comp-${comp.id}`}
                drag
                dragMomentum={false}
                dragElastic={0}
                onDrag={handleDrag}
                onDragEnd={handleDragEnd}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedComponentId(comp.id === selectedComponentId ? null : comp.id);
                }}
                initial={{ opacity: 0, scale: 0.5, y: 20 }}
                animate={{ opacity: isCompDimmed ? 0.3 : 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ type: 'spring', bounce: 0.3 }}
                className="absolute cursor-move pointer-events-auto"
                style={{ 
                  left: comp.x, 
                  top: comp.y, 
                  transformOrigin: 'center center',
                  scale: scaleVal,
                }}
              >
                {useWokwiElement ? (
                  (() => {
                    const Tag = wokwiTag as any;
                    if (renderType === 'led') return <Tag color="red" />;
                    if (renderType === 'rgb_led') return <Tag />;
                    if (renderType === 'resistor') return <Tag value="220" />;
                    return <Tag />;
                  })()
                ) : (
                  /* Unique SVG per component type */
                  (() => {
                    const t = renderType;
                    
                    // PCA9685 Servo Driver
                    if (t.includes('pca9685') || t.includes('driver_board')) return (
                      <svg width="120" height="70" viewBox="0 0 120 70">
                        <rect x="5" y="5" width="110" height="60" rx="4" fill="#0d47a1" stroke="#1565c0" strokeWidth="2"/>
                        <rect x="30" y="15" width="60" height="40" rx="2" fill="#1a1a1a" stroke="#333" strokeWidth="1"/>
                        <text x="60" y="38" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">PCA9685</text>
                        {/* 16 servo headers (PWM, VCC, GND) */}
                        {[...Array(8)].map((_,i) => <g key={`t${i}`}><rect x={35+i*7} y="6" width="3" height="3" fill="yellow"/><rect x={35+i*7} y="10" width="3" height="3" fill="red"/><rect x={35+i*7} y="14" width="3" height="3" fill="black"/></g>)}
                        {[...Array(8)].map((_,i) => <g key={`b${i}`}><rect x={35+i*7} y="52" width="3" height="3" fill="black"/><rect x={35+i*7} y="56" width="3" height="3" fill="red"/><rect x={35+i*7} y="60" width="3" height="3" fill="yellow"/></g>)}
                        <text x="60" y="65" fill="#90caf9" fontSize="6" textAnchor="middle">{comp.id}</text>
                        {/* Power/I2C Pins */}
                        <circle cx="15" cy="20" r="3" fill="#e74c3c"/><text x="15" y="15" fill="white" fontSize="5" textAnchor="middle">V+</text>
                        <circle cx="15" cy="50" r="3" fill="#333" stroke="white" strokeWidth="0.5"/><text x="15" y="60" fill="white" fontSize="5" textAnchor="middle">GND</text>
                        <circle cx="105" cy="25" r="2" fill="#f1c40f"/><text x="112" y="27" fill="white" fontSize="5">SDA</text>
                        <circle cx="105" cy="35" r="2" fill="#f1c40f"/><text x="112" y="37" fill="white" fontSize="5">SCL</text>
                      </svg>
                    );

                    // Servo Motors (SG90 / MG996R)
                    if (t.includes('servo') || t.includes('sg90') || t.includes('mg996r')) return (
                      <svg width="80" height="70" viewBox="0 0 80 70">
                        <rect x="20" y="15" width="40" height="40" rx="3" fill={t.includes('mg996') ? "#111" : "#0288d1"} stroke="#01579b" strokeWidth="1.5"/>
                        <rect x="15" y="25" width="50" height="10" fill={t.includes('mg996') ? "#222" : "#03a9f4"}/>
                        <circle cx="40" cy="20" r="12" fill="#fff" stroke="#ccc" strokeWidth="2"/>
                        <circle cx="40" cy="20" r="4" fill="#333"/>
                        <line x1="40" y1="20" x2="40" y2="8" stroke="#333" strokeWidth="2"/>
                        {/* Wires */}
                        <path d="M 60 45 Q 70 45 70 55" fill="none" stroke="#e74c3c" strokeWidth="2"/>
                        <path d="M 60 48 Q 72 48 72 55" fill="none" stroke="#333" strokeWidth="2"/>
                        <path d="M 60 51 Q 74 51 74 55" fill="none" stroke="#f39c12" strokeWidth="2"/>
                        <text x="40" y="48" fill="white" fontSize="8" textAnchor="middle" fontWeight="bold">{t.includes('mg996') ? 'MG996R' : 'SG90'}</text>
                        <text x="40" y="65" fill="#81d4fa" fontSize="6" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );

                    // Physical joint placeholders (wrist, finger mechanism)
                    if (t.includes('joint') || t.includes('mechanism') || t.includes('finger')) return (
                      <svg width="100" height="40" viewBox="0 0 100 40">
                        <rect x="5" y="5" width="90" height="30" rx="15" fill="#263238" stroke="#546e7a" strokeWidth="2" strokeDasharray="4 2"/>
                        <circle cx="20" cy="20" r="6" fill="#546e7a"/>
                        <circle cx="80" cy="20" r="6" fill="#546e7a"/>
                        <line x1="26" y1="20" x2="74" y2="20" stroke="#546e7a" strokeWidth="2"/>
                        <text x="50" y="17" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">{t.replace(/_/g,' ').toUpperCase()}</text>
                        <text x="50" y="27" fill="#90a4ae" fontSize="6" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );

                    // DC Motor - circular with shaft
                    if (t.includes('motor') || t.includes('dc_motor')) return (
                      <svg width="100" height="80" viewBox="0 0 100 80">
                        <rect x="10" y="15" width="60" height="50" rx="6" fill="#4a4a4a" stroke="#888" strokeWidth="2"/>
                        <circle cx="40" cy="40" r="18" fill="#333" stroke="#aaa" strokeWidth="1.5"/>
                        <circle cx="40" cy="40" r="5" fill="#ccc"/>
                        <rect x="70" y="32" width="25" height="16" rx="3" fill="#999" stroke="#666" strokeWidth="1"/>
                        <circle cx="18" cy="20" r="4" fill="#e74c3c" stroke="white" strokeWidth="1"/><text x="18" y="14" fill="#e74c3c" fontSize="7" textAnchor="middle">+</text>
                        <circle cx="18" cy="60" r="4" fill="#333" stroke="white" strokeWidth="1"/><text x="18" y="54" fill="white" fontSize="7" textAnchor="middle">-</text>
                        <text x="40" y="75" fill="white" fontSize="8" textAnchor="middle" fontFamily="monospace">{comp.id}</text>
                      </svg>
                    );
                    // Battery
                    if (t.includes('battery') || t.includes('9v')) return (
                      <svg width="70" height="100" viewBox="0 0 70 100">
                        <rect x="15" y="20" width="40" height="70" rx="4" fill="#2c3e50" stroke="#e74c3c" strokeWidth="2"/>
                        <rect x="22" y="10" width="10" height="14" rx="2" fill="#e74c3c"/><text x="27" y="8" fill="#e74c3c" fontSize="10" textAnchor="middle">+</text>
                        <rect x="38" y="10" width="10" height="14" rx="2" fill="#333" stroke="#888" strokeWidth="1"/><text x="43" y="8" fill="white" fontSize="10" textAnchor="middle">-</text>
                        <text x="35" y="55" fill="white" fontSize="9" textAnchor="middle" fontWeight="bold">9V</text>
                        <text x="35" y="96" fill="#aaa" fontSize="7" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );
                    // L298N Motor Driver
                    if (t.includes('l298n') || t.includes('motor_driver') || t.includes('driver')) return (
                      <svg width="160" height="120" viewBox="0 0 160 120">
                        <rect x="5" y="10" width="150" height="95" rx="4" fill="#1a237e" stroke="#5c6bc0" strokeWidth="2"/>
                        <rect x="15" y="20" width="30" height="20" rx="2" fill="#333" stroke="#888" strokeWidth="1"/>
                        <text x="30" y="34" fill="white" fontSize="7" textAnchor="middle">IC</text>
                        {/* Heatsink */}
                        <rect x="55" y="18" width="50" height="35" rx="1" fill="#444" stroke="#666" strokeWidth="1"/>
                        {[0,1,2,3,4].map(i => <rect key={i} x={58+i*10} y="18" width="4" height="35" fill="#555"/>)}
                        {/* Terminal blocks */}
                        {['OUT1','OUT2','OUT3','OUT4'].map((p,i) => <g key={p}><rect x={10+i*20} y="2" width="14" height="10" fill="#27ae60" stroke="#1a1a1a" strokeWidth="1" rx="1"/><text x={17+i*20} y="9" fill="white" fontSize="5" textAnchor="middle">{p}</text></g>)}
                        {['IN1','IN2','ENA','IN3','IN4','ENB'].map((p,i) => <g key={p}><rect x={10+i*22} y="100" width="16" height="10" fill="#e67e22" stroke="#1a1a1a" strokeWidth="1" rx="1"/><text x={18+i*22} y="107" fill="white" fontSize="5" textAnchor="middle">{p}</text></g>)}
                        <text x="80" y="75" fill="white" fontSize="11" textAnchor="middle" fontWeight="bold">L298N</text>
                        <text x="80" y="90" fill="#7986cb" fontSize="7" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );
                    // IR Sensor
                    if (t.includes('ir_sensor') || t.includes('ir_line')) return (
                      <svg width="80" height="50" viewBox="0 0 80 50">
                        <rect x="5" y="5" width="70" height="35" rx="4" fill="#1b5e20" stroke="#4caf50" strokeWidth="1.5"/>
                        <circle cx="25" cy="22" r="8" fill="#111" stroke="#4caf50" strokeWidth="1"/><circle cx="25" cy="22" r="3" fill="#4caf50"/>
                        <circle cx="55" cy="22" r="8" fill="#111" stroke="#e53935" strokeWidth="1"/><circle cx="55" cy="22" r="3" fill="#e53935"/>
                        {['VCC','GND','OUT'].map((p,i) => <g key={p}><rect x={15+i*20} y="38" width="12" height="8" fill="#ffd54f" rx="1"/><text x={21+i*20} y="49" fill="#333" fontSize="5" textAnchor="middle">{p}</text></g>)}
                        <text x="40" y="14" fill="white" fontSize="7" textAnchor="middle">IR SENSOR</text>
                      </svg>
                    );
                    // Robot Chassis
                    if (t.includes('chassis') || t.includes('frame') || t.includes('body')) return (
                      <svg width="160" height="100" viewBox="0 0 160 100">
                        <rect x="20" y="15" width="120" height="65" rx="20" fill="#37474f" stroke="#78909c" strokeWidth="2"/>
                        <circle cx="35" cy="85" r="12" fill="#555" stroke="#888" strokeWidth="2"/><circle cx="35" cy="85" r="4" fill="#333"/>
                        <circle cx="125" cy="85" r="12" fill="#555" stroke="#888" strokeWidth="2"/><circle cx="125" cy="85" r="4" fill="#333"/>
                        <circle cx="80" cy="10" r="6" fill="#333" stroke="#78909c" strokeWidth="1"/>
                        <text x="80" y="52" fill="white" fontSize="10" textAnchor="middle" fontWeight="bold">CHASSIS</text>
                        <text x="80" y="65" fill="#90a4ae" fontSize="7" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );
                    // Speaker
                    if (t.includes('speaker') || t.includes('spk')) return (
                      <svg width="90" height="90" viewBox="0 0 90 90">
                        <circle cx="45" cy="45" r="40" fill="#2c3e50" stroke="#7f8c8d" strokeWidth="2"/>
                        <circle cx="45" cy="45" r="30" fill="#34495e" stroke="#95a5a6" strokeWidth="1"/>
                        <circle cx="45" cy="45" r="15" fill="#1a252f" stroke="#7f8c8d" strokeWidth="1"/>
                        <circle cx="45" cy="45" r="5" fill="#555"/>
                        {/* Concentric rings */}
                        <circle cx="45" cy="45" r="22" fill="none" stroke="#4a6fa5" strokeWidth="0.5" opacity="0.6"/>
                        <circle cx="45" cy="45" r="35" fill="none" stroke="#4a6fa5" strokeWidth="0.5" opacity="0.4"/>
                        {/* Terminals */}
                        <rect x="20" y="82" width="10" height="8" rx="1" fill="#e74c3c"/><text x="25" y="96" fill="#e74c3c" fontSize="6" textAnchor="middle">+</text>
                        <rect x="60" y="82" width="10" height="8" rx="1" fill="#555" stroke="#888" strokeWidth="0.5"/><text x="65" y="96" fill="#aaa" fontSize="6" textAnchor="middle">-</text>
                        <text x="45" y="50" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">SPK</text>
                      </svg>
                    );
                    // Capacitor
                    if (t.includes('capacitor') || t.includes('cap')) return (
                      <svg width="60" height="70" viewBox="0 0 60 70">
                        <rect x="10" y="15" width="40" height="40" rx="4" fill="#0d47a1" stroke="#42a5f5" strokeWidth="1.5"/>
                        <text x="30" y="32" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">CAP</text>
                        <text x="30" y="44" fill="#90caf9" fontSize="6" textAnchor="middle">{comp.id}</text>
                        {/* Pins with labels */}
                        <rect x="15" y="5" width="6" height="12" rx="1" fill="#ffb74d" stroke="#e65100" strokeWidth="0.5"/>
                        <text x="18" y="4" fill="#ffb74d" fontSize="6" textAnchor="middle">1</text>
                        <rect x="39" y="5" width="6" height="12" rx="1" fill="#ffb74d" stroke="#e65100" strokeWidth="0.5"/>
                        <text x="42" y="4" fill="#ffb74d" fontSize="6" textAnchor="middle">2</text>
                        <rect x="15" y="53" width="6" height="12" rx="1" fill="#ffb74d" stroke="#e65100" strokeWidth="0.5"/>
                        <rect x="39" y="53" width="6" height="12" rx="1" fill="#ffb74d" stroke="#e65100" strokeWidth="0.5"/>
                      </svg>
                    );
                    // LM386 or any IC
                    if (t.includes('lm386') || t.includes('lm') || t.includes('op_amp') || t.includes('ic_')) return (
                      <svg width="100" height="80" viewBox="0 0 100 80">
                        <rect x="15" y="10" width="70" height="55" rx="3" fill="#1a1a2e" stroke="#e94560" strokeWidth="1.5"/>
                        <circle cx="25" cy="18" r="3" fill="none" stroke="#e94560" strokeWidth="1"/>
                        {/* Left pins 1-4 */}
                        {[1,2,3,4].map((p,i) => <g key={`l${p}`}><rect x="5" y={16+i*12} width="12" height="4" rx="1" fill="#c0c0c0" stroke="#888" strokeWidth="0.5"/><text x="3" y={20+i*12} fill="#aaa" fontSize="5" textAnchor="end">{p}</text></g>)}
                        {/* Right pins 8-5 */}
                        {[8,7,6,5].map((p,i) => <g key={`r${p}`}><rect x="83" y={16+i*12} width="12" height="4" rx="1" fill="#c0c0c0" stroke="#888" strokeWidth="0.5"/><text x="97" y={20+i*12} fill="#aaa" fontSize="5">{p}</text></g>)}
                        <text x="50" y="42" fill="white" fontSize="9" textAnchor="middle" fontWeight="bold">{t.replace(/_/g,' ').toUpperCase()}</text>
                        <text x="50" y="56" fill="#e94560" fontSize="6" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );
                    // Transistor
                    if (t.includes('transistor') || t.includes('mosfet') || t.includes('bjt')) return (
                      <svg width="60" height="70" viewBox="0 0 60 70">
                        <rect x="15" y="10" width="30" height="40" rx="3" fill="#263238" stroke="#78909c" strokeWidth="1.5"/>
                        <text x="30" y="32" fill="white" fontSize="7" textAnchor="middle" fontWeight="bold">Q</text>
                        {['B','C','E'].map((p,i) => <g key={p}><rect x={10+i*16} y="48" width="8" height="12" rx="1" fill="#c0c0c0"/><text x={14+i*16} y="66" fill="#aaa" fontSize="6" textAnchor="middle">{p}</text></g>)}
                        <text x="30" y="8" fill="#78909c" fontSize="6" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );
                    // Audio source / microphone
                    if (t.includes('audio') || t.includes('microphone') || t.includes('mic')) return (
                      <svg width="60" height="70" viewBox="0 0 60 70">
                        <circle cx="30" cy="28" r="18" fill="#263238" stroke="#4dd0e1" strokeWidth="1.5"/>
                        <rect x="25" y="18" width="10" height="20" rx="5" fill="#4dd0e1" opacity="0.7"/>
                        <rect x="28" y="46" width="4" height="10" fill="#4dd0e1"/>
                        <rect x="22" y="54" width="16" height="3" rx="1" fill="#4dd0e1"/>
                        {['1','2'].map((p,i) => <g key={p}><rect x={15+i*22} y="60" width="8" height="8" rx="1" fill="#ffb74d"/><text x={19+i*22} y="72" fill="#ffb74d" fontSize="6" textAnchor="middle">{p}</text></g>)}
                      </svg>
                    );
                    // Raspberry Pi
                    if (t.includes('raspberry') || t.includes('rpi') || t.includes('pi_4') || t.includes('pi_3')) return (
                      <svg width="220" height="150" viewBox="0 0 220 150">
                        {/* Main PCB board */}
                        <rect x="10" y="10" width="200" height="130" rx="10" fill="#2e7d32" stroke="#1b5e20" strokeWidth="2"/>
                        
                        {/* GPIO Pins Header */}
                        <rect x="25" y="15" width="150" height="15" fill="#111" stroke="#333" strokeWidth="1"/>
                        {[...Array(20)].map((_, i) => (
                          <g key={`gpio1-${i}`}>
                            <rect x={28 + i * 7.3} y="17" width="3" height="4" fill="#ffd700"/>
                            <rect x={28 + i * 7.3} y="24" width="3" height="4" fill="#ffd700"/>
                          </g>
                        ))}
                        <text x="100" y="12" fill="white" fontSize="6" textAnchor="middle">GPIO PINS</text>
                        
                        {/* CPU / SoC */}
                        <rect x="95" y="55" width="35" height="35" rx="2" fill="#263238" stroke="#37474f" strokeWidth="1"/>
                        <text x="112.5" y="70" fill="#78909c" fontSize="6" textAnchor="middle">BROADCOM</text>
                        <text x="112.5" y="80" fill="white" fontSize="5" textAnchor="middle">ARM CORTEX</text>

                        {/* RAM */}
                        <rect x="145" y="60" width="20" height="25" rx="1" fill="#263238" stroke="#37474f" strokeWidth="1"/>

                        {/* USB Ports */}
                        <rect x="180" y="40" width="30" height="35" rx="2" fill="#b0bec5" stroke="#78909c" strokeWidth="1"/>
                        <rect x="180" y="80" width="30" height="35" rx="2" fill="#b0bec5" stroke="#78909c" strokeWidth="1"/>
                        <text x="195" y="60" fill="#111" fontSize="8" textAnchor="middle" fontWeight="bold">USB</text>
                        <text x="195" y="100" fill="#111" fontSize="8" textAnchor="middle" fontWeight="bold">USB</text>
                        
                        {/* Ethernet */}
                        <rect x="175" y="15" width="35" height="20" rx="2" fill="#cfd8dc" stroke="#90a4ae" strokeWidth="1"/>
                        <text x="192.5" y="27" fill="#111" fontSize="6" textAnchor="middle" fontWeight="bold">ETH</text>

                        {/* HDMI & USB-C Power */}
                        <rect x="70" y="130" width="25" height="15" fill="#cfd8dc"/>
                        <text x="82.5" y="140" fill="#111" fontSize="5" textAnchor="middle">HDMI 1</text>
                        <rect x="105" y="130" width="25" height="15" fill="#cfd8dc"/>
                        <text x="117.5" y="140" fill="#111" fontSize="5" textAnchor="middle">HDMI 2</text>
                        
                        <rect x="25" y="130" width="18" height="12" fill="#424242"/>
                        <text x="34" y="125" fill="white" fontSize="5" textAnchor="middle">POWER</text>

                        {/* Raspberry Pi Logo Motif */}
                        <circle cx="45" cy="80" r="12" fill="#e91e63"/>
                        <path d="M 40 70 Q 45 60 50 70" fill="#4caf50"/>

                        <text x="100" y="45" fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">Raspberry Pi 4</text>
                        <text x="100" y="125" fill="#c8e6c9" fontSize="8" textAnchor="middle">{comp.id}</text>
                      </svg>
                    );

                    // Generic fallback - shows actual component name, not "CUSTOM SVG"
                    const fallbackName = comp.label || comp.custom?.description || comp.value || t;
                    const label = String(fallbackName).replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    return (
                      <svg width="140" height="90" viewBox="0 0 140 90">
                        <defs>
                          <linearGradient id={`grad-${comp.id}`} x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#1e3a5f"/>
                            <stop offset="100%" stopColor="#0d1b2a"/>
                          </linearGradient>
                        </defs>
                        <rect x="5" y="10" width="130" height="65" rx="6" fill={`url(#grad-${comp.id})`} stroke="#3498db" strokeWidth="2"/>
                        <rect x="5" y="10" width="130" height="18" rx="6" fill="#3498db" opacity="0.15"/>
                        <text x="70" y="24" fill="#7fb3d3" fontSize="7" fontFamily="monospace" textAnchor="middle">{comp.id}</text>
                        <text x="70" y="48" fill="white" fontSize={label.length > 14 ? "8" : "11"} fontFamily="monospace" textAnchor="middle" fontWeight="bold">{label}</text>
                        {[0,1,2,3,4,5].map(i => <rect key={`t${i}`} x={18+i*20} y="2" width="6" height="10" rx="1" fill="#c0c0c0" stroke="#888" strokeWidth="0.5"/>)}
                        {[0,1,2,3,4,5].map(i => <rect key={`b${i}`} x={18+i*20} y="73" width="6" height="10" rx="1" fill="#c0c0c0" stroke="#888" strokeWidth="0.5"/>)}
                      </svg>
                    );
                  })()
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        </div>
      </div>

      {/* Zoom Controls - Bottom Left Corner */}
      <div className="absolute bottom-4 left-4 z-30 flex items-center gap-1 bg-[#111]/80 backdrop-blur-md border border-gray-700 rounded-lg p-1 shadow-lg">
        <button onClick={() => setTransform(p => ({ ...p, scale: Math.min(5, p.scale + 0.2) }))} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors" title="Zoom In">
          <ZoomIn size={16} />
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1"></div>
        <button onClick={() => setTransform({ x: 0, y: 0, scale: 1 })} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors" title="Reset View">
          <Maximize size={16} />
        </button>
        <div className="w-px h-4 bg-gray-700 mx-1"></div>
        <button onClick={() => setTransform(p => ({ ...p, scale: Math.max(0.1, p.scale - 0.2) }))} className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-md transition-colors" title="Zoom Out">
          <ZoomOut size={16} />
        </button>
      </div>

      {/* Step Controller */}
      {data && data.steps.length > 0 && (
        <motion.div 
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          drag
          dragControls={dragControls}
          dragListener={false}
          dragMomentum={false}
          className={`absolute ${dockPosition === 'bottom-right' ? 'bottom-10 right-6 items-end' : 'top-4 left-4 items-start'} z-30 flex flex-col gap-2 max-h-[calc(100vh-32px)] pointer-events-none`}
        >
          {/* We wrap children in a pointer-events-auto div to allow interaction while keeping the wrapper strictly for layout */}
          {/* Expanded step detail panel (toggle) */}
          <AnimatePresence>
            {(selectedComponentId || selectedWireId) && (
              <motion.div
                initial={{ opacity: 0, y: 10, x: 20 }}
                animate={{ opacity: 1, y: 0, x: 0 }}
                exit={{ opacity: 0, y: 10, x: 20 }}
                className="bg-[#111]/95 backdrop-blur-md border border-blue-500/30 rounded-xl p-3 w-[260px] shadow-2xl mb-2 pointer-events-auto"
              >
                <div className="flex items-center justify-between mb-2 pb-2 border-b border-gray-800">
                  <h3 className="text-xs font-bold text-blue-400 flex items-center gap-1.5">
                    <Search size={14} /> Inspect: {selectedWireId ? 'Wire Connection' : selectedComponentId}
                  </h3>
                  <button onClick={() => { setSelectedComponentId(null); setSelectedWireId(null); }} className="text-gray-500 hover:text-white">
                    <X size={14} />
                  </button>
                </div>
                
                <div className="max-h-[200px] overflow-y-auto space-y-1.5 pr-1">
                  {selectedWireId ? (
                    (() => {
                      const w = wirePaths.find(w => w.id === selectedWireId);
                      if (!w) return null;
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center justify-between bg-gray-900/50 p-3 rounded-lg border border-gray-700">
                            <div className="flex flex-col text-left">
                              <span className="text-[10px] text-gray-500 truncate max-w-[80px]" title={w.fromComp}>{w.fromComp}</span>
                              <span className="text-xs font-mono font-bold text-gray-300">{w.fromPin}</span>
                            </div>
                            <div className="flex-1 px-4 flex items-center justify-center relative">
                              <div className="w-full h-px border-t border-dashed border-gray-600"></div>
                              <div className="absolute w-2 h-2 rounded-full" style={{ backgroundColor: w.color }}></div>
                            </div>
                            <div className="flex flex-col text-right">
                              <span className="text-[10px] text-gray-500 truncate max-w-[80px]" title={w.toComp}>{w.toComp}</span>
                              <span className="text-xs font-mono font-bold text-gray-300">{w.labelText}</span>
                            </div>
                          </div>
                          
                          <div className="bg-[#1a1a2e]/60 rounded-lg p-2.5 border border-blue-900/30">
                            <h4 className="text-[9px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">Estimated Telemetry</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(getWireStats(w.color, w.fromPin, w.labelText)).map(([k, v]) => (
                                <div key={k} className="flex flex-col">
                                  <span className="text-[9px] text-gray-500">{k}</span>
                                  <span className="text-[10px] text-gray-300 font-medium">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                    <div className="flex flex-col gap-3">
                      {(() => {
                        const compDef = data?.steps.flatMap(s => s.add_components || []).find(c => c.id === selectedComponentId);
                        if (!compDef) return null;
                        return (
                          <div className="bg-[#1a1a2e]/60 rounded-lg p-2.5 border border-blue-900/30">
                            <h4 className="text-[9px] uppercase tracking-wider text-blue-400 font-bold mb-1.5">Component Specs</h4>
                            <div className="grid grid-cols-2 gap-2">
                              {Object.entries(getComponentStats(compDef.type)).map(([k, v]) => (
                                <div key={k} className="flex flex-col">
                                  <span className="text-[9px] text-gray-500">{k}</span>
                                  <span className="text-[10px] text-gray-300 font-medium">{v}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })()}
                      
                      <div className="space-y-1.5">
                        <h4 className="text-[9px] uppercase tracking-wider text-gray-400 font-bold px-1">Connections</h4>
                        {wirePaths.filter(w => w.fromComp === selectedComponentId || w.toComp === selectedComponentId).length === 0 ? (
                          <div className="text-[10px] text-gray-500 italic py-2 text-center">No wires connected in this step</div>
                        ) : (
                          wirePaths.filter(w => w.fromComp === selectedComponentId || w.toComp === selectedComponentId).map(w => {
                            const isSource = w.fromComp === selectedComponentId;
                            const myPin = isSource ? w.fromPin : w.labelText;
                            const otherComp = isSource ? w.toComp : w.fromComp;
                            const otherPin = isSource ? w.labelText : w.fromPin;
                            
                            return (
                              <div key={w.id} className="text-[10px] flex items-center justify-between bg-gray-900/50 px-2 py-1.5 rounded">
                                <span className="font-mono text-gray-300 font-bold">{myPin}</span>
                                <div className="flex-1 border-b border-dashed border-gray-700 mx-2"></div>
                                <span className="text-gray-400 truncate max-w-[100px]" title={`${otherComp}:${otherPin}`}>
                                  {otherComp}:<span className="font-mono text-gray-300">{otherPin}</span>
                                </span>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {expandedPanel && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="bg-[#111]/95 backdrop-blur-md border border-gray-700 rounded-xl p-4 w-[300px] max-h-[50vh] overflow-y-auto shadow-2xl pointer-events-auto"
              >
                <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">All Steps</h3>
                <div className="space-y-1.5">
                  {data.steps.map((step, i) => {
                    const isComp = step.add_components && step.add_components.length > 0;
                    const isWire = step.add_wiring && step.add_wiring.length > 0;
                    const isDone = i < currentStepIndex;
                    const isCurrent = i === currentStepIndex;
                    return (
                      <button
                        key={i}
                        onClick={() => setCurrentStepIndex(i)}
                        className={`w-full text-left flex items-start gap-2 p-2 rounded-lg text-xs transition-all ${
                          isCurrent ? 'bg-blue-600/20 border border-blue-500/50 text-white' :
                          isDone ? 'text-gray-400 hover:bg-gray-800/50' : 'text-gray-600 hover:bg-gray-800/30'
                        }`}
                      >
                        <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5" style={{
                          background: isDone ? '#22c55e' : isCurrent ? '#3b82f6' : '#333',
                          color: 'white'
                        }}>
                          {isDone ? '✓' : i + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            {step.phase && <span className="text-[8px] font-bold uppercase text-gray-500 bg-gray-800 px-1 rounded">{step.phase}</span>}
                            {step.code && <span className="text-[8px] text-green-500">{'</>'}</span>}
                          </div>
                          <span className="block truncate">{step.instruction || `Step ${i+1}`}</span>
                          <span className="text-[10px] text-gray-500 mt-0.5 flex gap-2">
                            {isComp && <span>🔧 {step.add_components?.length || 0} part{(step.add_components?.length || 0) > 1 ? 's' : ''}</span>}
                            {isWire && <span>🔌 {step.add_wiring?.length || 0} wire{(step.add_wiring?.length || 0) > 1 ? 's' : ''}</span>}
                            {step.code && <span>💻 code</span>}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Compact step bar */}
          <div className="bg-[#111]/95 backdrop-blur-md border border-gray-700 rounded-xl shadow-2xl flex items-center gap-2 px-3 py-2 pointer-events-auto">
            <button 
              onPointerDown={(e) => dragControls.start(e)}
              style={{ touchAction: 'none' }}
              title="Drag Panel"
              className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 mr-1 cursor-grab active:cursor-grabbing pointer-events-auto"
            >
              <Move size={14} />
            </button>
            <button 
              onClick={() => setCurrentStepIndex(0)}
              disabled={currentStepIndex === 0}
              title="Restart from Step 1"
              className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <SkipBack size={14} />
            </button>
            <button 
              onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
              disabled={currentStepIndex === 0}
              className="p-1.5 bg-gray-800 rounded-lg hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Step progress dots */}
            <button 
              onClick={() => setExpandedPanel(!expandedPanel)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-gray-800/50 transition-colors"
            >
              <span className="text-xs font-bold text-white">{currentStepIndex + 1}/{data.steps.length}</span>
              <ChevronUp size={12} className={`text-gray-500 transition-transform ${expandedPanel ? 'rotate-180' : ''}`} />
            </button>
            
            <button 
              onClick={() => setCurrentStepIndex(Math.min(data.steps.length - 1, currentStepIndex + 1))}
              disabled={currentStepIndex === data.steps.length - 1}
              title="Next step"
              aria-label="Next step"
              className="p-1.5 bg-white rounded-lg hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-black"
            >
              <ChevronRight size={14} />
            </button>
            
            {(() => {
              const currentStep = data.steps[currentStepIndex];
              if (!currentStep) return null;
              
              let hasCode = !!currentStep.code;
              let extractedCode = currentStep.code ? currentStep.code.replace(/\\n/g, '\n') : '';
              
              if (!hasCode && currentStep.detail) {
                const codeRegex = /```(\w*)\s*([\s\S]*?)```/g;
                let match;
                while ((match = codeRegex.exec(currentStep.detail)) !== null) {
                  hasCode = true;
                  extractedCode = match[2].trim();
                }
              }

              if (!hasCode) return null;

              return (
                <button 
                  onClick={() => {
                    if (extractedCode && onCompileRequest) {
                      onCompileRequest(extractedCode);
                    } else {
                      alert('No code found on this step.');
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold text-xs transition-all duration-300 ${
                    isBoardConnected
                      ? 'bg-black text-white shadow-[0_0_15px_rgba(255,255,255,0.3)] hover:shadow-[0_0_20px_rgba(255,255,255,0.5)] border border-gray-700'
                      : 'bg-gray-800 text-gray-500 hover:bg-gray-700 border border-gray-800'
                  }`}
                  title={isBoardConnected ? 'Arduino detected!' : 'Connect an Arduino via USB'}
                >
                  <Zap size={12} className={isBoardConnected ? 'text-yellow-400' : ''} /> Flash to Board
                </button>
              );
            })()}
          </div>
          
          {/* Current step info panel */}
          {(() => {
            const step = data.steps[currentStepIndex];
            if (!step) return null;
            const pc = 'bg-gray-800 text-gray-200 border-gray-700';
            return (
              <div className="bg-[#111]/95 backdrop-blur-sm border border-gray-800 rounded-xl px-3 py-2.5 max-w-[340px] shadow-lg space-y-2 pointer-events-auto">
                {/* Phase badge + instruction */}
                <div className="flex items-start gap-2">
                  {step.phase && (
                    <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border flex-shrink-0 ${pc}`}>
                      {step.phase}
                    </span>
                  )}
                  <p className="text-xs text-gray-200 font-medium leading-relaxed">{step.instruction}</p>
                </div>
                
                                {(() => {
                  // The AI sometimes buries markdown code blocks inside step.detail. We need to extract them.
                  const detailText = step.detail || '';
                  const codeBlockRegex = /```(\w*)\s*([\s\S]*?)```/g;
                  let match;
                  let lastIndex = 0;
                  const parts = [];
                  let extractedCode = step.code ? step.code.replace(/\\n/g, '\n') : null;
                  let extractedLang = step.code_language || 'cpp';

                  while ((match = codeBlockRegex.exec(detailText)) !== null) {
                    if (match.index > lastIndex) {
                      parts.push(<span key={lastIndex}>{detailText.slice(lastIndex, match.index)}</span>);
                    }
                    extractedCode = match[2].trim();
                    extractedLang = match[1] || 'cpp';
                    lastIndex = match.index + match[0].length;
                  }
                  if (lastIndex < detailText.length) {
                    parts.push(<span key={lastIndex}>{detailText.slice(lastIndex)}</span>);
                  }

                  return (
                    <div className="max-h-[300px] overflow-y-auto pr-1">
                      {parts.length > 0 && (
                        <p className="text-[11px] text-gray-500 leading-relaxed border-l-2 border-gray-700 pl-2 whitespace-pre-wrap">
                          {parts}
                        </p>
                      )}
                      
                      {extractedCode && (
                        <div className="bg-[#0a0a0a] rounded-lg p-2 border border-gray-800 shadow-inner mt-2">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[9px] text-gray-400 font-mono uppercase tracking-wider bg-gray-900 px-1.5 py-0.5 rounded border border-gray-700">{extractedLang}</span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => setPreviewCode({ code: extractedCode!, language: extractedLang })}
                                className="flex items-center gap-1 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 px-2 py-1 rounded text-[9px] font-medium transition-colors border border-blue-500/30"
                                title="Preview code in editor"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                                Preview
                              </button>
                              <button
                                onClick={() => navigator.clipboard.writeText(extractedCode!)}
                                className="flex items-center gap-1 bg-gray-800 hover:bg-gray-700 text-gray-300 px-2 py-1 rounded text-[9px] font-medium transition-colors border border-gray-700"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                                Copy
                              </button>
                            </div>
                          </div>
                          <pre className="text-[10px] font-mono text-gray-300 max-h-[160px] overflow-y-auto overflow-x-auto whitespace-pre-wrap p-1 bg-black/40 rounded">
                            <code dangerouslySetInnerHTML={{ __html: highlightCode(extractedCode) }} />
                          </pre>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                {/* Verification */}
                {step.verify && (
                  <div className="flex items-start gap-1.5 text-[11px] text-gray-300 bg-gray-900 rounded-lg px-2 py-1.5 border border-gray-700">
                    <span className="flex-shrink-0 mt-0.5 text-gray-400"><CheckCircle2 size={12}/></span>
                    <span>{step.verify}</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Inline Canvas Chat */}
          <AnimatePresence>
            {canvasChatOpen && (
              <motion.div
                initial={{ opacity: 0, y: 10, height: 0 }}
                animate={{ opacity: 1, y: 0, height: 'auto' }}
                exit={{ opacity: 0, y: 10, height: 0 }}
                className="bg-[#0d1117]/95 backdrop-blur-md border border-blue-500/30 rounded-xl max-w-[380px] shadow-2xl overflow-hidden"
              >
                {/* Chat Messages */}
                <div ref={canvasChatRef} className="max-h-[200px] overflow-y-auto p-2 space-y-2">
                  {canvasChatMessages.length === 0 && (
                    <p className="text-[10px] text-gray-600 text-center py-3">
                      Ask anything about this circuit, or request changes...
                    </p>
                  )}
                  {canvasChatMessages.map((msg, i) => (
                    <div key={i} className={`text-[11px] leading-relaxed px-2 py-1.5 rounded-lg ${
                      msg.role === 'user' 
                        ? 'bg-blue-600/20 text-blue-300 ml-6' 
                        : 'bg-gray-800/50 text-gray-300 mr-4'
                    }`}>
                      {msg.text}
                    </div>
                  ))}
                  {canvasChatLoading && (
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 px-2">
                      <Loader2 size={10} className="animate-spin" /> Thinking...
                    </div>
                  )}
                </div>
                {/* Chat Input */}
                <div className="flex items-center gap-1.5 p-1.5 border-t border-gray-800/50">
                  <input
                    value={canvasChatInput}
                    onChange={e => setCanvasChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleCanvasChat()}
                    placeholder="Ask or change anything..."
                    className="flex-1 bg-transparent text-xs text-white placeholder-gray-600 outline-none px-2 py-1.5"
                    disabled={canvasChatLoading || !apiKeys || apiKeys.length === 0}
                  />
                  <button
                    onClick={handleCanvasChat}
                    disabled={!canvasChatInput.trim() || canvasChatLoading || !apiKeys || apiKeys.length === 0}
                    className="p-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send size={10} />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Chat Toggle Button */}
          <button
            onClick={() => setCanvasChatOpen(!canvasChatOpen)}
            className={`self-end p-2 rounded-full transition-all shadow-lg ${
              canvasChatOpen 
                ? 'bg-blue-600 text-white ring-2 ring-blue-400/30' 
                : 'bg-[#1a1a2e]/90 text-gray-400 hover:text-blue-400 hover:bg-[#1a1a2e] border border-gray-700/50'
            }`}
            title="Canvas AI Chat"
          >
            {canvasChatOpen ? <X size={14} /> : <MessageCircle size={14} />}
          </button>
        </motion.div>
      )}

      {/* VS Code-like Code Preview Overlay */}
      <AnimatePresence>
        {previewCode && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-[200] bg-[#1e1e1e] flex flex-col"
          >
            {/* Title Bar */}
            <div className="flex items-center justify-between h-9 bg-[#252526] border-b border-[#3c3c3c] px-3 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-[#f14c4c] cursor-pointer" onClick={() => setPreviewCode(null)}></div>
                  <div className="w-3 h-3 rounded-full bg-[#e2b93d]"></div>
                  <div className="w-3 h-3 rounded-full bg-[#23d18b]"></div>
                </div>
                <span className="text-[11px] text-gray-400 font-medium ml-2">
                  {data?.project_name || 'sketch'}.{previewCode.language === 'python' ? 'py' : previewCode.language === 'cpp' ? 'ino' : previewCode.language}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigator.clipboard.writeText(previewCode.code)}
                  className="flex items-center gap-1.5 text-[10px] text-gray-400 hover:text-white bg-[#333] hover:bg-[#444] px-2.5 py-1 rounded transition-colors"
                >
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  Copy All
                </button>
                <button
                  onClick={() => setPreviewCode(null)}
                  className="text-gray-400 hover:text-white p-1 rounded hover:bg-[#444] transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Breadcrumb Bar */}
            <div className="flex items-center h-6 bg-[#252526] border-b border-[#3c3c3c] px-3 text-[10px] text-gray-500 gap-1 shrink-0">
              <span className="text-gray-400">{data?.project_name || 'Project'}</span>
              <span>›</span>
              <span className="text-gray-400">src</span>
              <span>›</span>
              <span className="text-blue-400">
                {data?.project_name?.replace(/\s+/g, '_').toLowerCase() || 'sketch'}.{previewCode.language === 'python' ? 'py' : previewCode.language === 'cpp' ? 'ino' : previewCode.language}
              </span>
            </div>

            {/* Code Editor Area */}
            <div className="flex-1 overflow-auto font-mono text-[12px] leading-[20px]">
              <table className="w-full border-collapse">
                <tbody>
                  {previewCode.code.split('\n').map((line, i) => (
                    <tr key={i} className="hover:bg-[#2a2d2e]">
                      <td className="text-right pr-4 pl-4 text-gray-600 select-none w-[50px] text-[11px] border-r border-[#3c3c3c] bg-[#1e1e1e] sticky left-0">
                        {i + 1}
                      </td>
                      <td className="pl-4 pr-8 whitespace-pre text-gray-300">
                        <span dangerouslySetInnerHTML={{ __html: highlightCode(line) }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Status Bar */}
            <div className="flex items-center justify-between h-6 bg-[#007acc] px-3 text-[10px] text-white/90 shrink-0">
              <div className="flex items-center gap-3">
                <span>{previewCode.language.toUpperCase()}</span>
                <span>{previewCode.code.split('\n').length} lines</span>
              </div>
              <div className="flex items-center gap-3">
                <span>UTF-8</span>
                <span>Spaces: 2</span>
                <span>Kaktus IDE</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!data && (
        <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-medium text-sm">
          Ask the agent to build a circuit...
        </div>
      )}
    </div>
  );
}
