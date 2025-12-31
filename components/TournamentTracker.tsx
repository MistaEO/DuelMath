
import React, { useState } from 'react';
import { TournamentReport, TournamentMetadata } from '../types';

interface TournamentTrackerProps {
  reports: TournamentReport[];
  setReports: React.Dispatch<React.SetStateAction<TournamentReport[]>>;
  metadata: TournamentMetadata;
  setMetadata: React.Dispatch<React.SetStateAction<TournamentMetadata>>;
}

export const TournamentTracker: React.FC<TournamentTrackerProps> = ({ 
  reports, 
  setReports, 
  metadata, 
  setMetadata 
}) => {
  const [isAdding, setIsAdding] = useState(false);
  
  // Form State for Round (Transient, doesn't need to persist outside form)
  const [round, setRound] = useState(reports.length + 1);
  const [matchup, setMatchup] = useState('');
  const [wonDiceRoll, setWonDiceRoll] = useState(true);
  const [result, setResult] = useState<'win' | 'loss'>('win');
  const [notes, setNotes] = useState('');

  const handleAddReport = (e: React.FormEvent) => {
    e.preventDefault();
    const newReport: TournamentReport = {
      id: Date.now().toString(),
      round,
      matchup,
      wonDiceRoll,
      result,
      notes,
      timestamp: Date.now()
    };
    
    const updated = [...reports, newReport].sort((a, b) => a.round - b.round);
    setReports(updated);
    setIsAdding(false);
    
    // Reset form for next round
    setRound(updated.length + 1);
    setMatchup('');
    setWonDiceRoll(true);
    setResult('win');
    setNotes('');
  };

  const deleteReport = (id: string) => {
    setReports(reports.filter(r => r.id !== id));
  };

  const exportPDF = () => {
    window.print();
  };

  const downloadTextReport = () => {
    const header = `TOURNAMENT REPORT: ${metadata.eventName || 'Unnamed Event'}\n`;
    const subHeader = `DECK: ${metadata.deckName || 'N/A'}\n`;
    const record = `FINAL RECORD: ${getRecord()}\n`;
    const dateLine = `DATE: ${new Date().toLocaleDateString()}\n`;
    const separator = "------------------------------------------\n";
    
    const body = reports.map(r => (
      `ROUND ${r.round}: ${r.matchup}\n` +
      `RESULT: ${r.result.toUpperCase()} (${r.wonDiceRoll ? 'Won' : 'Lost'} Dice Roll)\n` +
      (r.notes ? `NOTES: ${r.notes}\n` : "") +
      `\n`
    )).join(separator);

    const blob = new Blob([header + subHeader + dateLine + record + separator + body], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report_${metadata.eventName || 'tournament'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const copyForDiscord = () => {
    const header = `**Event:** ${metadata.eventName || 'Tournament Report'}\n`;
    const subHeader = `**Deck:** ${metadata.deckName || 'N/A'}\n`;
    const record = `**Record:** ${getRecord()}\n\n`;
    const rounds = reports.map(r => 
      `**R${r.round} vs ${r.matchup}**: ${r.result === 'win' ? '✅ WIN' : '❌ LOSS'} (${r.wonDiceRoll ? 'Won' : 'Lost'} Roll)`
    ).join('\n');
    
    navigator.clipboard.writeText(header + subHeader + record + rounds).then(() => {
      alert("Report copied to clipboard!");
    });
  };

  const getRecord = () => {
    const wins = reports.filter(r => r.result === 'win').length;
    const losses = reports.filter(r => r.result === 'loss').length;
    return `${wins} - ${losses}`;
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      <style>{`
        @media print {
          @page { margin: 1.5cm; }
          html, body, #root, main, .min-h-screen, .flex-1 {
            height: auto !important;
            overflow: visible !important;
            display: block !important;
            background: white !important;
            color: black !important;
          }
          nav, aside, header, .no-print, button, .no-print-input { display: none !important; }
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; background: white !important; }
          .report-card {
            border: 1px solid #e2e8f0 !important;
            background: white !important;
            color: black !important;
            margin-bottom: 1.5rem !important;
            page-break-inside: avoid !important;
            border-radius: 8px;
            padding: 20px;
          }
          .text-white, .text-slate-200, .text-slate-300, .text-slate-400 { color: #1a202c !important; }
          .notes-box { background-color: #f7fafc !important; border: 1px solid #edf2f7 !important; color: #4a5568 !important; }
          .meta-header { display: block !important; border-bottom: 2px solid #000; margin-bottom: 1rem; padding-bottom: 1rem; }
        }
      `}</style>

      {/* Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl font-bold text-white mb-1">Tournament Tracker</h1>
          <p className="text-slate-400 text-sm">Log your rounds and analyze your performance.</p>
        </div>
        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button 
            onClick={() => setIsAdding(true)}
            className="flex-1 lg:flex-none px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg transition-all shadow-lg uppercase tracking-wider text-[10px]"
          >
            + Log Round
          </button>
          <button 
            onClick={downloadTextReport}
            disabled={reports.length === 0}
            className="flex-1 lg:flex-none px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-white font-bold rounded-lg transition-all uppercase tracking-wider text-[10px]"
          >
            Download .TXT
          </button>
          <button 
            onClick={copyForDiscord}
            disabled={reports.length === 0}
            className="flex-1 lg:flex-none px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg transition-all uppercase tracking-wider text-[10px]"
          >
            Copy Discord
          </button>
          <button 
            onClick={exportPDF}
            disabled={reports.length === 0}
            className="flex-1 lg:flex-none px-4 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 disabled:opacity-50 text-white font-bold rounded-lg transition-all uppercase tracking-wider text-[10px]"
          >
            PDF (Print)
          </button>
        </div>
      </div>

      {/* Tournament Metadata Form */}
      <div className="bg-slate-800/60 border border-slate-700 rounded-xl p-5 no-print shadow-xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-widest">Tournament Name</label>
            <input 
              type="text" 
              placeholder="e.g. YCS Las Vegas 2024"
              value={metadata.eventName}
              onChange={e => setMetadata(prev => ({ ...prev, eventName: e.target.value }))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none text-sm"
            />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1.5 tracking-widest">Deck Used</label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Deck Name (e.g. Tenpai Dragon)"
                value={metadata.deckName}
                onChange={e => setMetadata(prev => ({ ...prev, deckName: e.target.value }))}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {reports.length > 0 && (
        <div className="bg-slate-800/40 border border-slate-700 rounded-xl p-4 flex items-center justify-between no-print">
          <div className="flex items-center gap-4">
            <div className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Current Standing</div>
            <div className="text-2xl font-black text-cyan-400 tracking-tighter">{getRecord()}</div>
          </div>
          <div className="text-slate-500 text-[10px] font-medium uppercase">{reports.length} Rounds Logged</div>
        </div>
      )}

      {isAdding && (
        <div className="bg-slate-800 rounded-xl border border-cyan-500/30 p-6 shadow-2xl animate-in fade-in slide-in-from-top-4 no-print">
          <form onSubmit={handleAddReport} className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Round</label>
                <input 
                  type="number" 
                  value={round} 
                  onChange={e => setRound(parseInt(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none"
                  required
                />
              </div>
              <div className="col-span-1 sm:col-span-3">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Matchup (Opponent Deck)</label>
                <input 
                  type="text" 
                  value={matchup} 
                  onChange={e => setMatchup(e.target.value)}
                  placeholder="e.g. Snake-Eye Fire King"
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Dice Roll / Coin Flip</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setWonDiceRoll(true)}
                    className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${wonDiceRoll ? 'bg-cyan-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-700'}`}
                  >
                    Won
                  </button>
                  <button 
                    type="button"
                    onClick={() => setWonDiceRoll(false)}
                    className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${!wonDiceRoll ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-700'}`}
                  >
                    Lost
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-2">Match Result</label>
                <div className="flex gap-2">
                  <button 
                    type="button"
                    onClick={() => setResult('win')}
                    className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${result === 'win' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-700'}`}
                  >
                    Win
                  </button>
                  <button 
                    type="button"
                    onClick={() => setResult('loss')}
                    className={`flex-1 py-2 rounded-lg font-bold text-[10px] uppercase transition-all ${result === 'loss' ? 'bg-red-600 text-white' : 'bg-slate-900 text-slate-500 border border-slate-700'}`}
                  >
                    Loss
                  </button>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notes</label>
              <textarea 
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Key moments, misplays, or sideboard choices..."
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white focus:border-cyan-500 outline-none h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button 
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-4 py-2 text-slate-400 hover:text-white font-bold uppercase text-[10px]"
              >
                Cancel
              </button>
              <button 
                type="submit"
                className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg uppercase text-[10px] shadow-lg"
              >
                Finalize Report
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Print View Output */}
      <div className="print-area space-y-4">
        <div className="hidden print:block mb-8 meta-header">
          <h1 className="text-4xl font-black text-black uppercase tracking-tighter">
            {metadata.eventName || 'Tournament Report'}
          </h1>
          <div className="mt-2 text-lg font-bold text-black border-t border-black pt-1">
            DECK: {metadata.deckName || 'N/A'}
          </div>
          <div className="flex justify-between mt-4 text-sm font-bold text-black italic">
            <span>FINAL RECORD: {getRecord()}</span>
            <span>DATE: {new Date().toLocaleDateString()}</span>
          </div>
        </div>

        {reports.length === 0 && !isAdding && (
          <div className="text-center py-20 bg-slate-800/30 rounded-2xl border border-slate-800 no-print">
            <div className="text-slate-600 mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <p className="text-slate-500 font-medium italic">No rounds logged yet.</p>
          </div>
        )}

        {reports.map((report) => (
          <div 
            key={report.id} 
            className={`report-card relative bg-slate-800/60 border rounded-xl p-5 shadow-sm transition-all hover:bg-slate-800 ${
              report.result === 'win' ? 'border-emerald-500/30' : 'border-red-500/30'
            }`}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg ${
                   report.result === 'win' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'
                }`}>
                  {report.round}
                </div>
                <div>
                  <h3 className="font-bold text-white text-lg">{report.matchup}</h3>
                  <div className="flex gap-2 text-[10px] mt-0.5 uppercase font-bold">
                    <span className={report.wonDiceRoll ? 'text-cyan-400' : 'text-red-400'}>
                      {report.wonDiceRoll ? 'Won Dice Roll' : 'Lost Dice Roll'}
                    </span>
                    <span className="text-slate-500 no-print">•</span>
                    <span className={
                      report.result === 'win' ? 'text-emerald-400' : 'text-red-400'
                    }>
                      {report.result.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => deleteReport(report.id)}
                className="no-print p-2 text-slate-600 hover:text-red-400 transition-colors"
                title="Delete Report"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
            
            {report.notes && (
              <div className="notes-box bg-black/20 rounded-lg p-3 text-slate-300 text-xs italic border-l-2 border-slate-700">
                "{report.notes}"
              </div>
            )}
            
            <div className="mt-3 text-[9px] text-slate-600 uppercase font-bold tracking-widest hidden print:block">
              Recorded: {new Date(report.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
