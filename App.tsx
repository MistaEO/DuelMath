
import React, { useState, useEffect, useMemo } from 'react';
import { parseYDK, analyzeDeck } from './services/ygoService';
import { 
  calculateProbabilities, 
  calculateSwissStandings, 
  calculateTopXProbability, 
  calculateMultivariateHyper,
  SwissStanding,
  HyperGroup
} from './services/mathUtils';
import { DeckUploader } from './components/DeckUploader';
import { ProbabilityChart } from './components/ProbabilityChart';
import { DeckStats } from './components/DeckStats';
import { DeckBuilder } from './components/DeckBuilder';
import { TournamentTracker } from './components/TournamentTracker';
import { AppView, Card, DeckAnalysis, TournamentReport, TournamentMetadata } from './types';

const App: React.FC = () => {
  const [view, setView] = useState<AppView>(AppView.DASHBOARD);
  const [deckAnalysis, setDeckAnalysis] = useState<DeckAnalysis | null>(null);
  const [originalDeckAnalysis, setOriginalDeckAnalysis] = useState<DeckAnalysis | null>(null);
  const [loadingDeck, setLoadingDeck] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Persistence Keys
  const STORAGE_REPORTS = 'duelmath_reports';
  const STORAGE_META = 'duelmath_metadata';
  const STORAGE_DECK = 'duelmath_cached_ydk';

  // Probability State
  const [selectedCards, setSelectedCards] = useState<Set<string>>(new Set());
  const [handSize, setHandSize] = useState(5);
  const [probResults, setProbResults] = useState<any[]>([]);

  // Side Decking State
  const [isSideDeckMode, setIsSideDeckMode] = useState(false);
  const [swapOutIndices, setSwapOutIndices] = useState<Set<number>>(new Set());
  const [swapInIndices, setSwapInIndices] = useState<Set<number>>(new Set());

  // Swiss Calculator State
  const [swissPlayers, setSwissPlayers] = useState<number>(64);
  const [swissRounds, setSwissRounds] = useState<number>(6);
  const [swissResults, setSwissResults] = useState<SwissStanding[]>([]);
  
  // Top X Probability State
  const [targetRank, setTargetRank] = useState<number>(8);
  const [currentWins, setCurrentWins] = useState<number>(0);
  const [currentLosses, setCurrentLosses] = useState<number>(0);
  const [topXProbability, setTopXProbability] = useState<number | null>(null);

  // Hyper Calculator State
  const [hyperDeckSize, setHyperDeckSize] = useState(40);
  const [hyperHandSize, setHyperHandSize] = useState(5);
  const [hyperGroups, setHyperGroups] = useState<HyperGroup[]>([
    { id: '1', name: 'Starters', countInDeck: 9, minDesired: 1, maxDesired: 5 }
  ]);
  const [hyperResult, setHyperResult] = useState<number | null>(null);

  // Tournament Tracker State
  const [tournamentReports, setTournamentReports] = useState<TournamentReport[]>([]);
  const [tournamentMetadata, setTournamentMetadata] = useState<TournamentMetadata>({
    eventName: '',
    deckName: '',
  });

  // Load Persisted Data
  useEffect(() => {
    const savedReports = localStorage.getItem(STORAGE_REPORTS);
    const savedMeta = localStorage.getItem(STORAGE_META);
    const savedDeck = localStorage.getItem(STORAGE_DECK);

    if (savedReports) setTournamentReports(JSON.parse(savedReports));
    if (savedMeta) setTournamentMetadata(JSON.parse(savedMeta));
    if (savedDeck) handleDeckUpload(savedDeck, false); // false = don't re-save
  }, []);

  // Save Tournament Data on Change
  useEffect(() => {
    localStorage.setItem(STORAGE_REPORTS, JSON.stringify(tournamentReports));
  }, [tournamentReports]);

  useEffect(() => {
    localStorage.setItem(STORAGE_META, JSON.stringify(tournamentMetadata));
  }, [tournamentMetadata]);

  // Handlers
  const handleDeckUpload = async (content: string, shouldCache = true) => {
    setLoadingDeck(true);
    try {
      if (shouldCache) localStorage.setItem(STORAGE_DECK, content);
      const rawDeck = parseYDK(content);
      const analysis = await analyzeDeck(rawDeck);
      setDeckAnalysis(analysis);
      setOriginalDeckAnalysis({
        ...analysis,
        mainDetails: [...analysis.mainDetails],
        sideDetails: [...analysis.sideDetails],
        extraDetails: [...analysis.extraDetails]
      });
      setSelectedCards(new Set());
      setSwapOutIndices(new Set());
      setSwapInIndices(new Set());
      setIsSideDeckMode(false);
    } catch (e) {
      console.error(e);
      alert("Error parsing deck");
    } finally {
      setLoadingDeck(false);
    }
  };

  const handleResetDeck = () => {
    if (originalDeckAnalysis) {
      setDeckAnalysis({
        ...originalDeckAnalysis,
        mainDetails: [...originalDeckAnalysis.mainDetails],
        sideDetails: [...originalDeckAnalysis.sideDetails],
        extraDetails: [...originalDeckAnalysis.extraDetails]
      });
      setSwapInIndices(new Set());
      setSwapOutIndices(new Set());
      setIsSideDeckMode(false);
      setProbResults([]);
      setSelectedCards(new Set()); 
    }
  };

  const toggleCardSelection = (cardName: string) => {
    const next = new Set(selectedCards);
    if (next.has(cardName)) next.delete(cardName);
    else next.add(cardName);
    setSelectedCards(next);
  };

  const clearTargets = () => setSelectedCards(new Set());

  const toggleIndividualSwap = (index: number, isSide: boolean) => {
    if (isSide) {
      const next = new Set(swapInIndices);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setSwapInIndices(next);
    } else {
      const next = new Set(swapOutIndices);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      setSwapOutIndices(next);
    }
  };

  const confirmSwap = () => {
    if (!deckAnalysis || swapInIndices.size !== swapOutIndices.size) return;
    const movingOut = Array.from(swapOutIndices).map(idx => deckAnalysis.mainDetails[idx]);
    const movingIn = Array.from(swapInIndices).map(idx => deckAnalysis.sideDetails[idx]);
    const finalMain = deckAnalysis.mainDetails.filter((_, idx) => !swapOutIndices.has(idx)).concat(movingIn);
    const finalSide = deckAnalysis.sideDetails.filter((_, idx) => !swapInIndices.has(idx)).concat(movingOut);
    setDeckAnalysis({
      ...deckAnalysis,
      mainDetails: finalMain,
      sideDetails: finalSide,
      counts: { ...deckAnalysis.counts, main: finalMain.length, side: finalSide.length }
    });
    setSwapInIndices(new Set());
    setSwapOutIndices(new Set());
    setIsSideDeckMode(false);
  };

  const targetCopiesFound = useMemo(() => {
    if (!deckAnalysis || selectedCards.size === 0) return 0;
    return deckAnalysis.mainDetails.filter(c => selectedCards.has(c.name)).length;
  }, [deckAnalysis, selectedCards]);

  useEffect(() => {
    if (!deckAnalysis || selectedCards.size === 0 || handSize <= 0) {
      setProbResults([]);
      return;
    }
    const results = calculateProbabilities(deckAnalysis.mainDetails.length, targetCopiesFound, handSize);
    setProbResults(results);
  }, [deckAnalysis, selectedCards, handSize, targetCopiesFound]);

  const handleSwissCalculate = () => {
    if (swissPlayers <= 0 || swissRounds <= 0) {
      setSwissResults([]);
      setTopXProbability(null);
      return;
    }
    const results = calculateSwissStandings(swissPlayers, swissRounds);
    setSwissResults(results);
    const prob = calculateTopXProbability(swissPlayers, swissRounds, targetRank, currentWins, currentLosses);
    setTopXProbability(prob);
  };

  const handleHyperCalculate = () => {
    const result = calculateMultivariateHyper(hyperDeckSize, hyperHandSize, hyperGroups);
    setHyperResult(parseFloat(result.toFixed(2)));
  };

  const addHyperGroup = () => {
    setHyperGroups([...hyperGroups, { 
      id: Date.now().toString(), 
      name: `Group ${hyperGroups.length + 1}`, 
      countInDeck: 9, 
      minDesired: 1, 
      maxDesired: 5 
    }]);
  };

  const removeHyperGroup = (id: string) => setHyperGroups(hyperGroups.filter(g => g.id !== id));
  const updateHyperGroup = (id: string, updates: Partial<HyperGroup>) => {
    setHyperGroups(hyperGroups.map(g => g.id === id ? { ...g, ...updates } : g));
  };

  useEffect(() => { handleHyperCalculate(); }, [hyperDeckSize, hyperHandSize, hyperGroups]);
  useEffect(() => { if (view === AppView.SWISS_CALCULATOR) handleSwissCalculate(); }, [view]);

  const groupedMain = useMemo(() => {
    if (!deckAnalysis) return { monsters: [], spells: [], traps: [] };
    const grouped: Record<string, { card: Card; count: number; indices: number[] }> = {};
    deckAnalysis.mainDetails.forEach((card, idx) => {
      if (grouped[card.name]) {
        grouped[card.name].count++;
        grouped[card.name].indices.push(idx);
      } else {
        grouped[card.name] = { card, count: 1, indices: [idx] };
      }
    });
    const all = Object.values(grouped);
    const sortFn = (a: { card: Card }, b: { card: Card }) => a.card.name.localeCompare(b.card.name);
    return {
      monsters: all.filter(item => item.card.type.includes('Monster')).sort(sortFn),
      spells: all.filter(item => item.card.type.includes('Spell')).sort(sortFn),
      traps: all.filter(item => item.card.type.includes('Trap')).sort(sortFn)
    };
  }, [deckAnalysis]);

  const flatMain = useMemo(() => {
    if (!deckAnalysis) return { monsters: [], spells: [], traps: [] };
    const items = deckAnalysis.mainDetails.map((card, idx) => ({ card, idx }));
    const sortFn = (a: any, b: any) => a.card.name.localeCompare(b.card.name);
    return {
      monsters: items.filter(i => i.card.type.includes('Monster')).sort(sortFn),
      spells: items.filter(i => i.card.type.includes('Spell')).sort(sortFn),
      traps: items.filter(i => i.card.type.includes('Trap')).sort(sortFn)
    };
  }, [deckAnalysis]);

  const flatSide = useMemo(() => {
    if (!deckAnalysis) return { monsters: [], spells: [], traps: [] };
    const items = deckAnalysis.sideDetails.map((card, idx) => ({ card, idx }));
    const sortFn = (a: any, b: any) => a.card.name.localeCompare(b.card.name);
    return {
      monsters: items.filter(i => i.card.type.includes('Monster')).sort(sortFn),
      spells: items.filter(i => i.card.type.includes('Spell')).sort(sortFn),
      traps: items.filter(i => i.card.type.includes('Trap')).sort(sortFn)
    };
  }, [deckAnalysis]);

  const renderBanStatus = (card: Card) => {
    const status = card.banlist_info?.ban_tcg;
    if (!status) return null;
    let bgColor = "bg-slate-700";
    let text = status === 'Forbidden' ? "0" : status === 'Limited' ? "1" : "2";
    if (status === 'Forbidden') bgColor = "bg-red-600";
    else if (status === 'Limited') bgColor = "bg-amber-500";
    else if (status === 'Semi-Limited') bgColor = "bg-blue-500";
    return (
      <div className={`absolute top-0.5 left-0.5 ${bgColor} text-white w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black shadow-lg z-10 border border-white/30`}>
        {text}
      </div>
    );
  };

  const renderGroupedGrid = (items: { card: Card; count: number; indices: number[] }[]) => (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {items.map((group) => {
         const { card, count } = group;
         const isSelected = selectedCards.has(card.name);
         return (
           <div 
             key={`grouped-${card.id}`}
             onClick={() => toggleCardSelection(card.name)}
             className={`relative group cursor-pointer transition-all rounded shadow-sm overflow-hidden border-2 ${isSelected ? 'border-cyan-400 ring-1 ring-cyan-400/20' : 'border-transparent hover:border-slate-600'}`}
           >
             <img src={card.card_images[0].image_url_small} alt={card.name} className="w-full object-cover aspect-[2/3]" />
             {renderBanStatus(card)}
             <div className="absolute top-0 right-0 bg-black/80 text-[10px] text-white font-bold px-1.5 py-0.5 rounded-bl">x{count}</div>
           </div>
         );
      })}
    </div>
  );

  const renderFlatGrid = (items: { card: Card; idx: number }[], isSide: boolean = false) => (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-2">
      {items.map((item) => {
         const { card, idx } = item;
         const isSwapping = isSide ? swapInIndices.has(idx) : swapOutIndices.has(idx);
         return (
           <div 
             key={isSide ? `side-flat-${idx}` : `main-flat-${idx}`}
             onClick={() => toggleIndividualSwap(idx, isSide)}
             className={`relative group cursor-pointer transition-all rounded shadow-sm overflow-hidden border-2 ${isSwapping ? 'border-amber-400 ring-1 ring-amber-400/20' : 'border-slate-700/50 hover:border-slate-500'}`}
           >
             <img src={card.card_images[0].image_url_small} alt={card.name} className="w-full object-cover aspect-[2/3]" />
             {renderBanStatus(card)}
           </div>
         );
      })}
    </div>
  );

  const NavItems = ({ onSelect }: { onSelect?: () => void }) => (
    <>
      <button 
        onClick={() => { setView(AppView.DASHBOARD); onSelect?.(); }}
        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === AppView.DASHBOARD ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-slate-900 text-slate-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" /></svg>
        Deck Analysis
      </button>
      <button 
        onClick={() => { setView(AppView.DECK_BUILDER); onSelect?.(); }}
        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === AppView.DECK_BUILDER ? 'bg-amber-500/10 text-amber-400' : 'hover:bg-slate-900 text-slate-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
        Deck Builder
      </button>
      <button 
        onClick={() => { setView(AppView.TOURNAMENT_TRACKER); onSelect?.(); }}
        className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === AppView.TOURNAMENT_TRACKER ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-900 text-slate-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
        Tournament Tracker
      </button>
      <button 
         onClick={() => { setView(AppView.HYPER_CALC); onSelect?.(); }}
         className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === AppView.HYPER_CALC ? 'bg-cyan-500/10 text-cyan-400' : 'hover:bg-slate-900 text-slate-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
        Hypergeometric Calculator
      </button>
      <button 
         onClick={() => { setView(AppView.SWISS_CALCULATOR); onSelect?.(); }}
         className={`w-full text-left px-4 py-3 rounded-lg flex items-center gap-3 transition-colors ${view === AppView.SWISS_CALCULATOR ? 'bg-emerald-500/10 text-emerald-400' : 'hover:bg-slate-900 text-slate-400'}`}
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" /></svg>
        Swiss Calculator
      </button>
    </>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 flex flex-col md:flex-row text-xs font-sans">
      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-50 bg-slate-950 border-b border-slate-800 no-print">
        <div className="flex items-center justify-between px-4 h-14">
          <h2 className="text-xl font-bold text-cyan-400 tracking-tight">DuelMath</h2>
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-400"><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg></button>
        </div>
        <div className={`overflow-hidden transition-all bg-slate-900 border-b border-slate-800 ${isMobileMenuOpen ? 'max-h-[600px] py-4' : 'max-h-0'}`}>
          <nav className="px-4 space-y-1"><NavItems onSelect={() => setIsMobileMenuOpen(false)} /></nav>
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-slate-950 border-r border-slate-800 flex-shrink-0 flex-col no-print">
        <div className="p-6">
          <h2 className="text-2xl font-bold text-cyan-400 tracking-tight">DuelMath</h2>
        </div>
        
        <nav className="px-4 space-y-2 mt-4 flex-1">
          <NavItems />
        </nav>
      </aside>

      <main className="flex-1 overflow-auto p-4 md:p-8">
        {view === AppView.DASHBOARD && (
          <div className="max-w-[1800px] mx-auto space-y-6 w-full">
            <header className="mb-4">
              <h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Deck Analysis</h1>
              <p className="text-slate-400 text-sm">Import your YDK file to calculate drawing probabilities.</p>
            </header>
            
            <DeckUploader onUpload={handleDeckUpload} />
            
            {loadingDeck && <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-400"></div></div>}
            
            {!deckAnalysis && !loadingDeck && (
              <div className="flex flex-col items-center justify-center py-20 bg-slate-800/20 border border-slate-700/40 rounded-2xl gap-4">
                <div className="text-slate-500 italic text-sm">No deck loaded.</div>
                <div className="flex gap-4">
                  <button onClick={() => setView(AppView.DECK_BUILDER)} className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-full font-bold uppercase tracking-wider text-[10px]">Go to Builder</button>
                  <button onClick={() => setView(AppView.HYPER_CALC)} className="px-6 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-full font-bold uppercase tracking-wider text-[10px]">Quick Calculator</button>
                </div>
              </div>
            )}

            {deckAnalysis && !loadingDeck && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-in fade-in duration-500">
                <div className="lg:col-span-8 xl:col-span-9 space-y-6">
                  <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5 flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <h2 className="text-lg font-bold text-white">Main Deck ({deckAnalysis.counts.main})</h2>
                      <div className="flex gap-2">
                        {originalDeckAnalysis && <button onClick={handleResetDeck} className="px-3 py-1.5 bg-slate-700 text-slate-200 text-[10px] font-bold rounded uppercase">Reset</button>}
                        <button onClick={() => setIsSideDeckMode(!isSideDeckMode)} className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all ${isSideDeckMode ? 'bg-red-500/20 text-red-400 border border-red-500/50' : 'bg-amber-500/20 text-amber-400 border border-amber-500/50'}`}>{isSideDeckMode ? 'Cancel' : 'Access Side Deck'}</button>
                      </div>
                    </div>
                    {isSideDeckMode && <div className="mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg flex justify-between items-center"><p className="text-slate-400 text-[10px]">Click individual cards to swap. <b>{swapOutIndices.size} Out ↔ {swapInIndices.size} In</b></p><button disabled={swapInIndices.size !== swapOutIndices.size || swapInIndices.size === 0} onClick={confirmSwap} className="px-4 py-1.5 bg-emerald-600 disabled:opacity-30 text-white text-[10px] font-bold rounded uppercase transition-all">Confirm</button></div>}
                    <div className="space-y-6">
                      {isSideDeckMode ? (
                        <>
                          {flatMain.monsters.length > 0 && <div><h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Monsters</h3>{renderFlatGrid(flatMain.monsters, false)}</div>}
                          {flatMain.spells.length > 0 && <div><h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Spells</h3>{renderFlatGrid(flatMain.spells, false)}</div>}
                          {flatMain.traps.length > 0 && <div><h3 className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-2">Traps</h3>{renderFlatGrid(flatMain.traps, false)}</div>}
                        </>
                      ) : (
                        <>
                          {groupedMain.monsters.length > 0 && <div><h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-2">Monsters</h3>{renderGroupedGrid(groupedMain.monsters)}</div>}
                          {groupedMain.spells.length > 0 && <div><h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-2">Spells</h3>{renderGroupedGrid(groupedMain.spells)}</div>}
                          {groupedMain.traps.length > 0 && <div><h3 className="text-[10px] font-bold text-pink-500 uppercase tracking-widest mb-2">Traps</h3>{renderGroupedGrid(groupedMain.traps)}</div>}
                        </>
                      )}
                    </div>
                  </div>
                  {isSideDeckMode && <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-5"><h2 className="text-lg font-bold text-white mb-4">Side Deck ({deckAnalysis.counts.side})</h2><div className="space-y-4">{flatSide.monsters.length > 0 && <div><h3 className="text-[10px] font-bold text-amber-500 uppercase mb-2">Monsters</h3>{renderFlatGrid(flatSide.monsters, true)}</div>}{flatSide.spells.length > 0 && <div><h3 className="text-[10px] font-bold text-emerald-500 uppercase mb-2">Spells</h3>{renderFlatGrid(flatSide.spells, true)}</div>}{flatSide.traps.length > 0 && <div><h3 className="text-[10px] font-bold text-pink-500 uppercase mb-2">Traps</h3>{renderFlatGrid(flatSide.traps, true)}</div>}</div></div>}
                </div>
                <div className="lg:col-span-4 xl:col-span-3 space-y-6">
                  <DeckStats cards={deckAnalysis.mainDetails} />
                  <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 lg:sticky lg:top-8 shadow-xl">
                    <h2 className="text-lg font-bold text-white mb-4">Probability</h2>
                    <div className="mb-4">
                      <label className="text-xs font-medium text-slate-400 block mb-2">Hand Size</label>
                      <input type="number" min={1} value={handSize || ''} onChange={(e) => setHandSize(parseInt(e.target.value) || 0)} className="w-full bg-slate-700 text-white rounded px-3 py-1.5 border border-slate-600 outline-none text-sm" />
                    </div>
                    <div className="mb-4">
                      <div className="text-xs text-slate-400 mb-2 flex justify-between items-center">
                        <span>Targets</span>
                        {selectedCards.size > 0 && <button onClick={clearTargets} className="text-[9px] px-1.5 py-0.5 rounded bg-slate-700 text-slate-400 uppercase font-bold">Clear</button>}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {Array.from(selectedCards).map(name => (<span key={name} className="inline-flex px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-300 border border-cyan-800 text-[10px] font-medium">{name}</span>))}
                        {selectedCards.size === 0 && <span className="text-slate-600 italic text-[10px]">Select cards in Main Deck...</span>}
                      </div>
                    </div>
                    {probResults.length > 0 && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-1 text-center text-[10px] font-bold text-slate-500 uppercase">
                          <div>Copies</div>
                          <div>Exact</div>
                          <div>At Least</div>
                        </div>
                        {probResults.map((row) => (
                          <div key={row.drawCount} className="grid grid-cols-3 gap-1 text-center py-1 border-b border-slate-700/30 text-xs">
                            <div className="text-slate-300">{row.drawCount}</div>
                            <div className="text-slate-400">{row.exact.toFixed(1)}%</div>
                            <div className="text-cyan-400 font-bold">{row.cumulativeAtLeast.toFixed(1)}%</div>
                          </div>
                        ))}
                        <ProbabilityChart data={probResults} />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {view === AppView.DECK_BUILDER && <div className="max-w-[1800px] mx-auto pb-8"><header className="mb-6"><h1 className="text-2xl md:text-3xl font-bold text-white mb-1">Deck Builder</h1></header><DeckBuilder /></div>}
        {view === AppView.TOURNAMENT_TRACKER && <TournamentTracker reports={tournamentReports} setReports={setTournamentReports} metadata={tournamentMetadata} setMetadata={setTournamentMetadata} />}
        {view === AppView.HYPER_CALC && (
          <div className="max-w-[1600px] mx-auto space-y-8 w-full">
            <header className="mb-6"><h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Hypergeometric Calculator</h1></header>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              <div className="lg:col-span-8 xl:col-span-9 space-y-6"><div className="bg-slate-800 rounded-xl border border-slate-700 p-6"><div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6"><div><label className="block text-sm font-medium text-slate-400 mb-2">Deck Size (0-60)</label><input type="number" value={hyperDeckSize || ''} onChange={(e) => setHyperDeckSize(Math.min(60, parseInt(e.target.value) || 0))} className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 outline-none" /></div><div><label className="block text-sm font-medium text-slate-400 mb-2">Hand Size</label><input type="number" value={hyperHandSize || ''} onChange={(e) => setHyperHandSize(parseInt(e.target.value) || 0)} className="w-full bg-slate-700 text-white rounded-lg px-4 py-2 border border-slate-600 outline-none" /></div></div><div className="space-y-4"><div className="flex justify-between items-center"><h3 className="text-sm font-bold text-white uppercase tracking-wider">Card Groups</h3><button onClick={addHyperGroup} className="text-xs px-3 py-1 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-medium">+ Add Group</button></div><div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{hyperGroups.map((group) => (<div key={group.id} className="p-4 bg-slate-900/50 rounded-lg border border-slate-700 space-y-4"><div className="flex gap-4 items-center"><input type="text" value={group.name} onChange={(e) => updateHyperGroup(group.id, { name: e.target.value })} className="flex-1 bg-transparent border-b border-slate-700 outline-none text-white font-medium" /><button onClick={() => removeHyperGroup(group.id)} className="text-slate-500 hover:text-red-400"><svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" /></svg></button></div><div className="grid grid-cols-3 gap-2"><div><label className="text-[10px] text-slate-500 uppercase">Copies</label><input type="number" value={group.countInDeck || ''} onChange={(e) => updateHyperGroup(group.id, { countInDeck: parseInt(e.target.value) || 0 })} className="w-full bg-slate-800 text-white text-sm rounded p-2 border border-slate-700" /></div><div><label className="text-[10px] text-slate-500 uppercase">Min</label><input type="number" value={group.minDesired || ''} onChange={(e) => updateHyperGroup(group.id, { minDesired: parseInt(e.target.value) || 0 })} className="w-full bg-slate-800 text-white text-sm rounded p-2 border border-slate-700" /></div><div><label className="text-[10px] text-slate-500 uppercase">Max</label><input type="number" value={group.maxDesired || ''} onChange={(e) => updateHyperGroup(group.id, { maxDesired: parseInt(e.target.value) || 0 })} className="w-full bg-slate-800 text-white text-sm rounded p-2 border border-slate-700" /></div></div></div>))}</div></div></div></div>
              <div className="lg:col-span-4 xl:col-span-3 space-y-6"><div className="bg-slate-800 rounded-xl border border-slate-700 p-6 sticky top-8 shadow-2xl"><h2 className="text-xl font-bold text-white mb-2">Result</h2><p className="text-xs text-slate-400 mb-6">Probability of satisfying <strong>ALL</strong> group constraints simultaneously.</p>{hyperResult !== null && (<div className="space-y-4"><div className="text-center p-6 bg-slate-900 rounded-xl border border-cyan-500/20"><div className="text-5xl font-black text-cyan-400 mb-2">{hyperResult.toFixed(2)}%</div><div className="text-[10px] text-slate-500 uppercase font-bold">Compound Chance</div></div><div className="p-4 bg-slate-900/30 rounded-lg border border-slate-800 text-[10px] text-slate-400 space-y-2"><div className="font-bold text-slate-300 uppercase mb-1">Constraints:</div>{hyperGroups.map(group => (<div key={group.id} className="flex justify-between items-center"><span>{group.name}:</span><span className="text-cyan-500 font-mono">{group.minDesired}-{group.maxDesired}x</span></div>))}</div></div>)}</div></div>
            </div>
          </div>
        )}
        {view === AppView.SWISS_CALCULATOR && (
          <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row gap-8 w-full">
            <div className="flex-1"><header className="mb-6"><h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Swiss Calculator</h1></header><div className="bg-slate-800 rounded-xl border border-slate-700 p-6 mb-8"><div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6"><div><label className="block text-sm font-medium text-slate-400 mb-2">Total Players</label><input type="number" value={swissPlayers || ''} onChange={(e) => setSwissPlayers(parseInt(e.target.value) || 0)} className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 border border-slate-600 outline-none" /></div><div><label className="block text-sm font-medium text-slate-400 mb-2">Rounds</label><input type="number" value={swissRounds || ''} onChange={(e) => setSwissRounds(parseInt(e.target.value) || 0)} className="w-full bg-slate-700 text-white rounded-lg px-4 py-3 border border-slate-600 outline-none" /></div></div><button onClick={handleSwissCalculate} className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-all uppercase tracking-widest text-sm shadow-lg">Update Estimations</button></div>{swissResults.length > 0 && (<div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden text-center"><div className="grid grid-cols-3 gap-4 bg-slate-900/50 p-4 border-b border-slate-700 font-semibold text-slate-300"><div>Record</div><div>W - L</div><div>Avg Projected</div></div><div className="divide-y divide-slate-700/50 max-h-[600px] overflow-y-auto custom-scrollbar">{swissResults.map((standing, index) => (<div key={index} className="grid grid-cols-3 gap-4 p-4 hover:bg-slate-700/30 transition-colors"><div className="font-mono">{standing.wins}-{standing.losses}</div><div>{standing.wins}W - {standing.losses}L</div><div className="font-bold text-emerald-400">{standing.count.toFixed(1)}</div></div>))}</div></div>)}</div>
            <div className="w-full lg:w-96 space-y-6"><div className="bg-slate-800 rounded-xl border border-slate-700 p-6 sticky top-8 shadow-2xl"><h2 className="text-xl font-bold text-white mb-4">Top X Odds</h2><div className="space-y-4 mb-6"><div><label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Target Rank (X)</label><input type="number" value={targetRank || ''} onChange={(e) => setTargetRank(parseInt(e.target.value) || 1)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" /></div><div className="grid grid-cols-2 gap-3"><div><label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Wins</label><input type="number" value={currentWins || ''} onChange={(e) => setCurrentWins(parseInt(e.target.value) || 0)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" /></div><div><label className="block text-[10px] font-medium text-slate-500 uppercase mb-1">Losses</label><input type="number" value={currentLosses || ''} onChange={(e) => setCurrentLosses(parseInt(e.target.value) || 0)} className="w-full bg-slate-700 text-white rounded px-3 py-2 border border-slate-600" /></div></div></div><button onClick={handleSwissCalculate} className="w-full py-2.5 bg-emerald-600 text-white font-bold rounded transition-all text-xs uppercase tracking-widest shadow-md">Calculate Chance</button>{topXProbability !== null && <div className="mt-8 text-center p-4 bg-emerald-950/20 rounded border border-emerald-500/20 animate-in zoom-in-95 duration-300"><div className="text-[10px] text-slate-500 uppercase font-bold mb-1">Top {targetRank} Chance</div><div className="text-4xl font-black text-emerald-400">{topXProbability.toFixed(1)}%</div></div>}</div></div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
