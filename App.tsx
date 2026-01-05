import React, { useState, useEffect, useRef } from 'react';
import { AppState, ImageHistoryItem, WorkspaceState } from './types';
import { GeminiService } from './services/geminiService';
import { ApiKeyPrompt } from './components/ApiKeyPrompt';

const STYLES = [
  { id: 'realistic', label: 'Realistic', icon: '📸' },
  { id: 'cinematic', label: 'Cinematic', icon: '🎬' },
  { id: 'studio', label: 'Studio Portrait', icon: '💡' },
  { id: 'vintage', label: 'Vintage', icon: '🎞️' },
  { id: 'professional', label: 'Professional Headshot', icon: '👔' },
  { id: 'fantasy', label: 'Fantasy World', icon: '✨' },
];

const ASPECT_RATIOS = [
  { id: '1:1', label: '1:1', icon: 'square' },
  { id: '16:9', label: '16:9', icon: 'rectangle-landscape' },
  { id: '9:16', label: '9:16', icon: 'rectangle-portrait' },
  { id: '4:3', label: '4:3', icon: 'photo' },
  { id: '3:4', label: '3:4', icon: 'photo' },
];

const QUICK_ACTIONS = [
  { 
    label: 'Colorize', 
    icon: '🎨',
    prompt: 'If this image is black and white, apply high-quality, realistic colorization. Reconstruct natural skin tones, environment colors, and material textures as if it were originally shot in color.' 
  },
  { 
    label: 'Enhance', 
    icon: '💎',
    prompt: 'Sharpen details, reduce noise, and upscale for high quality. Make the image look crisp and professionally captured.' 
  },
  { 
    label: 'Fix Light', 
    icon: '☀️',
    prompt: 'Improve color balance, fix harsh shadows, and apply professional studio-grade lighting to the subject.' 
  },
  { 
    label: 'Swap BG', 
    icon: '🌍',
    prompt: 'Intelligently replace the background with a cinematic and dramatic environment that fits the subject perfectly.' 
  },
];

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    currentImage: null,
    editedImage: null,
    isProcessing: false,
    error: null,
    history: [],
    showApiKeySelector: true,
    searchEnabled: true,
    selectedStyle: 'realistic',
    selectedAspectRatio: '1:1',
    selectedBlur: 0,
    undoStack: [],
    redoStack: []
  });

  const [mainPrompt, setMainPrompt] = useState('');
  const [secondaryPrompt, setSecondaryPrompt] = useState('');
  const [explanation, setExplanation] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      // @ts-ignore
      if (window.aistudio && typeof window.aistudio.hasSelectedApiKey === 'function') {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        setState(prev => ({ ...prev, showApiKeySelector: !hasKey }));
      }
    };
    checkKey();
  }, []);

  const getCurrentWorkspace = (): WorkspaceState => ({
    currentImage: state.currentImage,
    editedImage: state.editedImage,
    explanation: explanation
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const currentWS = getCurrentWorkspace();
        setState(prev => ({
          ...prev,
          currentImage: reader.result as string,
          editedImage: null,
          error: null,
          undoStack: prev.currentImage ? [...prev.undoStack, currentWS].slice(-20) : prev.undoStack,
          redoStack: []
        }));
        setExplanation('');
      };
      reader.readAsDataURL(file);
    }
  };

  const getBlurInstruction = (level: number) => {
    if (level === 0) return "Maintain background sharpness and detail.";
    if (level < 3) return "Apply a subtle, natural depth of field to the background.";
    if (level < 7) return "Apply a soft, professional bokeh background blur to separate the subject.";
    return "Apply a deep, intense cinematic bokeh background blur, isolating the subject completely with shallow depth of field.";
  };

  const handleEdit = async (forcedPrompt?: string) => {
    const primary = forcedPrompt || mainPrompt;
    if (!state.currentImage || (!primary.trim() && !secondaryPrompt.trim())) return;

    const currentWS = getCurrentWorkspace();
    setState(prev => ({ ...prev, isProcessing: true, error: null }));

    const blurInstruction = getBlurInstruction(state.selectedBlur);
    const combinedPrompt = `${primary}. ${secondaryPrompt.trim() ? `Fine-tuning: ${secondaryPrompt}.` : ''} ${blurInstruction}`;

    try {
      const { imageUrl, explanation: textExpl, sources } = await GeminiService.editImage(
        state.currentImage,
        combinedPrompt,
        state.searchEnabled,
        state.selectedStyle,
        state.selectedAspectRatio
      );

      const newItem: ImageHistoryItem = {
        id: Date.now().toString(),
        originalUrl: state.currentImage,
        editedUrl: imageUrl,
        prompt: combinedPrompt,
        explanation: textExpl,
        timestamp: Date.now(),
        sources: sources.length > 0 ? sources : undefined
      };

      setState(prev => ({
        ...prev,
        editedImage: imageUrl,
        isProcessing: false,
        history: [newItem, ...prev.history],
        undoStack: [...prev.undoStack, currentWS].slice(-20),
        redoStack: []
      }));
      setExplanation(textExpl);
      setMainPrompt('');
      setSecondaryPrompt('');
    } catch (err: any) {
      if (err.message === 'KEY_RESET_REQUIRED') {
        setState(prev => ({ ...prev, showApiKeySelector: true, isProcessing: false }));
      } else {
        setState(prev => ({ ...prev, error: err.message || 'An unexpected error occurred', isProcessing: false }));
      }
    }
  };

  const handleUndo = () => {
    if (state.undoStack.length === 0) return;
    
    const newUndoStack = [...state.undoStack];
    const prevWS = newUndoStack.pop()!;
    const currentWS = getCurrentWorkspace();

    setState(prev => ({
      ...prev,
      currentImage: prevWS.currentImage,
      editedImage: prevWS.editedImage,
      undoStack: newUndoStack,
      redoStack: [currentWS, ...prev.redoStack].slice(0, 20)
    }));
    setExplanation(prevWS.explanation);
  };

  const handleRedo = () => {
    if (state.redoStack.length === 0) return;

    const newRedoStack = [...state.redoStack];
    const nextWS = newRedoStack.shift()!;
    const currentWS = getCurrentWorkspace();

    setState(prev => ({
      ...prev,
      currentImage: nextWS.currentImage,
      editedImage: nextWS.editedImage,
      undoStack: [...prev.undoStack, currentWS].slice(-20),
      redoStack: newRedoStack
    }));
    setExplanation(nextWS.explanation);
  };

  const resetAll = () => {
    setState(prev => ({ 
      ...prev, 
      currentImage: null, 
      editedImage: null, 
      error: null, 
      selectedBlur: 0,
      undoStack: [],
      redoStack: []
    }));
    setMainPrompt('');
    setSecondaryPrompt('');
    setExplanation('');
  };

  const handleReloadFromHistory = (item: ImageHistoryItem) => {
    const currentWS = getCurrentWorkspace();
    setState(prev => ({
      ...prev,
      currentImage: item.editedUrl,
      editedImage: null,
      error: null,
      undoStack: [...prev.undoStack, currentWS].slice(-20),
      redoStack: []
    }));
    setExplanation('');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-blue-500/30">
      {state.showApiKeySelector && (
        <ApiKeyPrompt onSelect={() => setState(prev => ({ ...prev, showApiKeySelector: false }))} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 glass-panel border-b border-white/5 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="hidden sm:block">
            <h1 className="text-xl font-extrabold tracking-tighter text-white">PICREBU <span className="text-blue-500">AI</span></h1>
            <p className="text-[9px] text-slate-500 font-bold uppercase tracking-[0.3em]">Intelligent Rebuild Engine</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Undo / Redo Controls */}
          <div className="flex items-center bg-slate-900/80 rounded-xl p-1 border border-white/10 shadow-inner">
            <button 
              onClick={handleUndo}
              disabled={state.undoStack.length === 0 || state.isProcessing}
              className={`p-2 rounded-lg transition-all ${state.undoStack.length > 0 && !state.isProcessing ? 'text-slate-200 hover:bg-slate-800 hover:text-blue-400 active:scale-90' : 'text-slate-700 cursor-not-allowed'}`}
              title="Undo Action"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </button>
            <div className="w-[1px] h-4 bg-white/5 mx-0.5"></div>
            <button 
              onClick={handleRedo}
              disabled={state.redoStack.length === 0 || state.isProcessing}
              className={`p-2 rounded-lg transition-all ${state.redoStack.length > 0 && !state.isProcessing ? 'text-slate-200 hover:bg-slate-800 hover:text-blue-400 active:scale-90' : 'text-slate-700 cursor-not-allowed'}`}
              title="Redo Action"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 10h-10a8 8 0 00-8 8v2M21 10l-6 6m6-6l-6-6" />
              </svg>
            </button>
          </div>

          <label className="hidden lg:flex items-center gap-3 cursor-pointer group px-3 bg-slate-900/50 py-2 rounded-xl border border-white/5">
            <span className="text-[10px] font-black text-slate-500 group-hover:text-slate-300 transition-colors uppercase tracking-widest">Web Research</span>
            <div className={`w-9 h-5 rounded-full transition-all relative ${state.searchEnabled ? 'bg-blue-600' : 'bg-slate-800'}`}>
              <input 
                type="checkbox" 
                className="hidden" 
                checked={state.searchEnabled} 
                onChange={() => setState(p => ({ ...p, searchEnabled: !p.searchEnabled }))}
              />
              <div className={`absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform ${state.searchEnabled ? 'translate-x-4' : ''}`} />
            </div>
          </label>

          <button 
            onClick={() => setState(p => ({ ...p, showApiKeySelector: true }))}
            className="text-[10px] font-black bg-slate-900 border border-white/5 hover:border-blue-500/50 hover:bg-slate-800 text-slate-500 hover:text-white px-4 py-2.5 rounded-xl transition-all uppercase tracking-widest"
          >
            Config
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 p-6 lg:p-10">
        <div className="lg:col-span-8 space-y-6">
          {!state.currentImage ? (
            <div 
              onClick={() => fileInputRef.current?.click()}
              className="group border-2 border-dashed border-slate-800 hover:border-blue-500/50 bg-slate-900/30 rounded-[3rem] p-24 flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-slate-900/50 shadow-2xl"
            >
              <div className="w-24 h-24 bg-slate-800 rounded-[2rem] flex items-center justify-center mb-8 shadow-2xl group-hover:scale-110 transition-transform group-hover:rotate-6">
                <svg className="w-12 h-12 text-slate-500 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className="text-2xl font-black text-white mb-3 tracking-tight">Reconstruct Vision</h3>
              <p className="text-slate-500 text-center max-w-sm leading-relaxed text-sm font-medium">
                Upload a photo to begin intelligent restoration, styling, and cinematic background expansion.
              </p>
              <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" className="hidden" />
            </div>
          ) : (
            <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Input Source</p>
                    <button onClick={resetAll} className="text-[10px] font-black text-red-500 hover:text-red-400 transition-colors uppercase tracking-widest">Discard</button>
                  </div>
                  <div className="aspect-square bg-slate-900/50 rounded-[2.5rem] overflow-hidden border border-white/5 shadow-inner flex items-center justify-center relative group">
                    <img src={state.currentImage} alt="Original" className="w-full h-full object-contain p-2" />
                    <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] px-2">Rebuilt Asset</p>
                  <div className="aspect-square bg-slate-900 rounded-[2.5rem] overflow-hidden border border-white/5 flex items-center justify-center relative shadow-2xl glow-border">
                    {state.isProcessing ? (
                      <div className="flex flex-col items-center gap-6">
                        <div className="relative">
                          <div className="w-20 h-20 border-4 border-blue-500/10 border-t-blue-500 rounded-full animate-spin"></div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-10 h-10 bg-blue-500/5 rounded-full animate-ping"></div>
                          </div>
                        </div>
                        <div className="text-center">
                          <p className="text-blue-500 font-black text-[10px] tracking-[0.2em] animate-pulse uppercase">Neural Processing</p>
                          <p className="text-slate-600 text-[9px] mt-1 font-bold">Synthesizing Pixels...</p>
                        </div>
                      </div>
                    ) : state.editedImage ? (
                      <img src={state.editedImage} alt="Edited" className="w-full h-full object-contain p-2" />
                    ) : (
                      <div className="text-slate-700 flex flex-col items-center gap-5 text-center px-12 opacity-30">
                        <svg className="w-20 h-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                        <p className="text-xs font-black uppercase tracking-widest leading-relaxed">System Ready<br/>Execute Command</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-5">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Artistic Core</p>
                  <div className="grid grid-cols-3 gap-2">
                    {STYLES.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setState(p => ({ ...p, selectedStyle: s.id }))}
                        className={`flex flex-col items-center justify-center gap-2 py-4 rounded-2xl border transition-all duration-300 ${state.selectedStyle === s.id ? 'bg-blue-600 border-blue-500 text-white shadow-xl shadow-blue-500/20 scale-[1.02]' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-slate-700'}`}
                      >
                        <span className="text-xl">{s.icon}</span>
                        <span className="text-[9px] font-black uppercase tracking-tighter">{s.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="space-y-5">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] px-2">Canvas Ratio</p>
                    <div className="flex flex-wrap gap-2">
                      {ASPECT_RATIOS.map((ratio) => (
                        <button
                          key={ratio.id}
                          onClick={() => setState(p => ({ ...p, selectedAspectRatio: ratio.id }))}
                          className={`flex-1 flex items-center justify-center px-4 py-3 rounded-xl border transition-all duration-300 ${state.selectedAspectRatio === ratio.id ? 'bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'bg-slate-900/50 border-white/5 text-slate-400 hover:border-slate-700'}`}
                        >
                          <span className="text-[10px] font-black tracking-widest">{ratio.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4 bg-slate-900/40 p-5 rounded-[2rem] border border-white/5 shadow-inner">
                    <div className="flex items-center justify-between px-1">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Blur Intensity</p>
                      <span className="text-[10px] font-black text-blue-500 bg-blue-500/10 px-2 py-0.5 rounded-md border border-blue-500/20">
                        {state.selectedBlur === 0 ? 'Off' : `${state.selectedBlur}/10`}
                      </span>
                    </div>
                    <input 
                      type="range" 
                      min="0" 
                      max="10" 
                      step="1" 
                      value={state.selectedBlur} 
                      onChange={(e) => setState(p => ({ ...p, selectedBlur: parseInt(e.target.value) }))} 
                      className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500" 
                    />
                    <div className="flex justify-between text-[8px] text-slate-600 font-black uppercase tracking-widest">
                      <span>Sharp</span>
                      <span>Cinematic</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-white/5 p-8 rounded-[3rem] space-y-8 shadow-2xl">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div> Main Instruction
                    </p>
                    <textarea 
                      value={mainPrompt} 
                      onChange={(e) => setMainPrompt(e.target.value)} 
                      placeholder="Describe the environment reconstruction..." 
                      className="w-full bg-slate-950 border border-white/5 rounded-[1.5rem] p-6 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 min-h-[140px] resize-none text-sm transition-all shadow-inner font-medium leading-relaxed" 
                    />
                  </div>
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest px-2 flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div> Tuning Layer
                    </p>
                    <textarea 
                      value={secondaryPrompt} 
                      onChange={(e) => setSecondaryPrompt(e.target.value)} 
                      placeholder="Add specific lighting or texture details..." 
                      className="w-full bg-slate-950 border border-blue-500/10 rounded-[1.5rem] p-6 text-white placeholder:text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/40 min-h-[140px] resize-none text-sm transition-all shadow-inner font-medium leading-relaxed" 
                    />
                  </div>
                </div>

                {state.error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-[11px] font-bold uppercase tracking-wider animate-in fade-in zoom-in">
                    Error: {state.error}
                  </div>
                )}

                <div className="flex flex-col xl:flex-row gap-5">
                  <button 
                    onClick={() => handleEdit()} 
                    disabled={state.isProcessing || (!mainPrompt.trim() && !secondaryPrompt.trim())} 
                    className="flex-[1.5] bg-white hover:bg-slate-100 disabled:bg-slate-800 disabled:text-slate-600 text-slate-950 font-black py-5 rounded-[1.5rem] transition-all flex items-center justify-center gap-3 uppercase tracking-[0.1em] shadow-2xl active:scale-[0.98] group"
                  >
                    {state.isProcessing ? (
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin"></div>
                        <span>Processing...</span>
                      </div>
                    ) : (
                      <>
                        <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        <span>Initiate Rebuild</span>
                      </>
                    )}
                  </button>
                  <div className="flex flex-wrap flex-1 gap-2">
                    {QUICK_ACTIONS.map((action, i) => (
                      <button 
                        key={i} 
                        onClick={() => handleEdit(action.prompt)} 
                        disabled={state.isProcessing} 
                        className={`flex-1 min-w-[100px] text-[9px] font-black py-4 px-2 rounded-2xl border border-white/5 transition-all uppercase tracking-widest flex items-center justify-center gap-2 ${action.label === 'Colorize' ? 'bg-blue-600/10 text-blue-400 border-blue-500/30 hover:bg-blue-600 hover:text-white' : 'bg-slate-800/80 text-slate-400 hover:bg-slate-700 hover:text-white'}`}
                      >
                        <span className="text-sm">{action.icon}</span>
                        {action.label}
                      </button>
                    ))}
                  </div>
                </div>

                {explanation && !state.isProcessing && (
                  <div className="mt-4 p-8 bg-blue-500/[0.03] border border-blue-500/10 rounded-[2.5rem] animate-in slide-in-from-bottom-4 duration-1000">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <svg className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.3em]">PICREBU Semantic Reasoning</p>
                    </div>
                    <p className="text-[13px] text-slate-400 leading-relaxed italic font-medium">"{explanation}"</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-4 space-y-6">
          <div className="glass-panel rounded-[3rem] p-8 h-fit max-h-[calc(100vh-160px)] flex flex-col shadow-2xl">
            <h2 className="text-[10px] font-black text-white mb-8 flex items-center gap-3 uppercase tracking-[0.3em] px-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              History
            </h2>
            <div className="space-y-6 overflow-y-auto pr-3 custom-scrollbar flex-1">
              {state.history.length === 0 ? (
                <div className="text-center py-24 px-6 opacity-20 flex flex-col items-center gap-4">
                  <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-[10px] uppercase font-black tracking-[0.3em]">Memory Bank Empty</p>
                </div>
              ) : (
                state.history.map((item) => (
                  <div key={item.id} className="group relative bg-slate-900 border border-white/5 rounded-[2rem] p-5 hover:border-blue-500/40 transition-all duration-500 cursor-pointer hover:translate-x-1" onClick={() => handleReloadFromHistory(item)}>
                    <div className="flex gap-3 mb-4">
                      <div className="w-1/2 aspect-square rounded-[1.2rem] overflow-hidden bg-slate-950 border border-white/5"><img src={item.originalUrl} className="w-full h-full object-cover opacity-30 grayscale group-hover:opacity-50 transition-all duration-700" /></div>
                      <div className="w-1/2 aspect-square rounded-[1.2rem] overflow-hidden bg-slate-950 border border-white/10 shadow-xl group-hover:scale-105 transition-transform duration-500"><img src={item.editedUrl} className="w-full h-full object-cover" /></div>
                    </div>
                    <div className="flex justify-between items-center px-1">
                      <p className="text-[9px] text-slate-500 line-clamp-1 italic font-bold">"{item.prompt}"</p>
                      <span className="text-[8px] text-slate-700 font-black">{new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-indigo-900/10 to-blue-900/10 border border-blue-500/5 rounded-[2.5rem] p-8 relative overflow-hidden group">
            <div className="absolute -right-8 -bottom-8 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-1000"></div>
            <h3 className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Intelligence Tip
            </h3>
            <p className="text-[11px] text-slate-400 leading-relaxed font-medium">
              Use <span className="text-slate-200">"Colorize"</span> for family portraits from the 1900s to see how the engine reconstructs accurate historical pigments.
            </p>
          </div>
        </div>
      </main>

      <footer className="mt-20 py-16 border-t border-white/5 text-center bg-black/40">
        <div className="flex flex-col items-center gap-6">
          <p className="text-[9px] font-black text-slate-700 uppercase tracking-[1em] hover:text-slate-500 transition-colors cursor-default">PICREBU • ADVANCED MULTIMODAL V1.2</p>
          <div className="flex gap-8 text-[8px] font-black text-slate-800 uppercase tracking-widest">
            <span>Neural Reconstruction</span>
            <span>Gemini 3 Pro Vision</span>
            <span>Stable Reasoning</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;