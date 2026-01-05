
import React from 'react';

interface ApiKeyPromptProps {
  onSelect: () => void;
}

export const ApiKeyPrompt: React.FC<ApiKeyPromptProps> = ({ onSelect }) => {
  const handleSelectKey = async () => {
    // @ts-ignore
    await window.aistudio.openSelectKey();
    onSelect();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="bg-slate-900 border border-slate-700 p-8 rounded-2xl max-w-md w-full shadow-2xl">
        <h2 className="text-2xl font-bold mb-4 text-white">High-Quality Editing Enabled</h2>
        <p className="text-slate-400 mb-6 leading-relaxed">
          To use <strong>Gemini 3 Pro Image Preview</strong> for advanced editing and internet-based background swapping, you need to select an API key from a paid GCP project.
        </p>
        <div className="space-y-4">
          <button
            onClick={handleSelectKey}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 px-6 rounded-xl transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-blue-500/20"
          >
            Select API Key
          </button>
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="block text-center text-sm text-slate-500 hover:text-slate-300 transition-colors"
          >
            Learn more about billing
          </a>
        </div>
      </div>
    </div>
  );
};
