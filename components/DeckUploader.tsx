import React, { useRef } from 'react';

interface DeckUploaderProps {
  onUpload: (fileContent: string) => void;
}

export const DeckUploader: React.FC<DeckUploaderProps> = ({ onUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      onUpload(content);
    };
    reader.readAsText(file);
  };

  return (
    <div className="p-6 border-2 border-dashed border-slate-700 rounded-xl bg-slate-800/50 hover:bg-slate-800 transition-colors text-center cursor-pointer group"
         onClick={() => fileInputRef.current?.click()}>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept=".ydk,.txt" 
        className="hidden" 
      />
      <div className="flex flex-col items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-cyan-400 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
        <span className="text-slate-300 font-medium">Click to upload .ydk file</span>
        <span className="text-slate-500 text-sm">or drag and drop</span>
      </div>
    </div>
  );
};