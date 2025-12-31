import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../types';
import { searchCards, fetchCardData, parseYDK } from '../services/ygoService';

type SectionType = 'main' | 'extra' | 'side' | 'considerations';

interface DragInfo {
  card: Card;
  sourceSection?: SectionType | 'search';
  sourceIndex?: number;
}

export const DeckBuilder: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<Card[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  
  const [mainDeck, setMainDeck] = useState<Card[]>([]);
  const [extraDeck, setExtraDeck] = useState<Card[]>([]);
  const [sideDeck, setSideDeck] = useState<Card[]>([]);
  const [considerations, setConsiderations] = useState<Card[]>([]);

  const [draggedItem, setDraggedItem] = useState<DragInfo | null>(null);

  const importInputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  useEffect(() => {
    const delayDebounceFn = setTimeout(async () => {
      if (searchTerm.length >= 3) {
        setIsSearching(true);
        const results = await searchCards(searchTerm);
        setSearchResults(results);
        setIsSearching(false);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchTerm]);

  const isExtraDeckCard = (card: Card) => {
    const types = ['Fusion', 'Synchro', 'XYZ', 'Link', 'Token'];
    return types.some(t => card.type.toUpperCase().includes(t.toUpperCase()));
  };

  const checkDeckLimit = (card: Card) => {
    const countInDeck = [...mainDeck, ...extraDeck, ...sideDeck].filter(c => c.name === card.name).length;
    
    // Respect Banlist status
    const banStatus = card.banlist_info?.ban_tcg;
    if (banStatus === 'Forbidden') return false;
    if (banStatus === 'Limited' && countInDeck >= 1) return false;
    if (banStatus === 'Semi-Limited' && countInDeck >= 2) return false;
    
    return countInDeck < 3;
  };

  const addCard = (card: Card, target: 'auto' | SectionType = 'auto') => {
    if (target === 'considerations') {
      setConsiderations([...considerations, card]);
      return;
    }

    if (!checkDeckLimit(card)) return;

    if (target === 'side') {
      if (sideDeck.length < 15) setSideDeck([...sideDeck, card]);
      return;
    }

    if (isExtraDeckCard(card)) {
      if (extraDeck.length < 15) setExtraDeck([...extraDeck, card]);
    } else {
      if (mainDeck.length < 60) setMainDeck([...mainDeck, card]);
    }
  };

  const removeCard = (index: number, section: SectionType) => {
    if (section === 'main') setMainDeck(mainDeck.filter((_, i) => i !== index));
    if (section === 'extra') setExtraDeck(extraDeck.filter((_, i) => i !== index));
    if (section === 'side') setSideDeck(sideDeck.filter((_, i) => i !== index));
    if (section === 'considerations') setConsiderations(considerations.filter((_, i) => i !== index));
  };

  const setSectionData = (section: SectionType, data: Card[]) => {
    if (section === 'main') setMainDeck(data);
    if (section === 'extra') setExtraDeck(data);
    if (section === 'side') setSideDeck(data);
    if (section === 'considerations') setConsiderations(data);
  };

  const getSectionData = (section: SectionType): Card[] => {
    if (section === 'main') return mainDeck;
    if (section === 'extra') return extraDeck;
    if (section === 'side') return sideDeck;
    if (section === 'considerations') return considerations;
    return [];
  };

  // Right-click management
  const handleSearchResultContextMenu = (e: React.MouseEvent, card: Card) => {
    e.preventDefault();
    if (e.shiftKey) {
      addCard(card, 'side');
    } else if (e.ctrlKey || e.metaKey) {
      addCard(card, 'considerations');
    } else {
      addCard(card, 'auto');
    }
  };

  const handleDeckCardContextMenu = (e: React.MouseEvent, index: number, section: SectionType) => {
    e.preventDefault();
    removeCard(index, section);
  };

  // Drag and Drop Handlers
  const onDragStart = (card: Card, section: SectionType | 'search', index?: number) => {
    setDraggedItem({ card, sourceSection: section, sourceIndex: index });
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const onDropOnSection = (targetSection: SectionType) => {
    if (!draggedItem) return;

    const { card, sourceSection, sourceIndex } = draggedItem;

    if (sourceSection === targetSection) {
      if (sourceIndex !== undefined) {
        const newData = [...getSectionData(targetSection)];
        newData.splice(sourceIndex, 1);
        newData.push(card);
        setSectionData(targetSection, newData);
      }
      return;
    }

    if (targetSection !== 'considerations' && !checkDeckLimit(card)) return;

    if (targetSection === 'extra' && !isExtraDeckCard(card)) return;
    if (targetSection === 'main' && isExtraDeckCard(card)) return;
    if (targetSection === 'extra' && extraDeck.length >= 15) return;
    if (targetSection === 'main' && mainDeck.length >= 60) return;
    if (targetSection === 'side' && sideDeck.length >= 15) return;

    if (sourceSection && sourceSection !== 'search' && sourceIndex !== undefined) {
      removeCard(sourceIndex, sourceSection);
    }

    setSectionData(targetSection, [...getSectionData(targetSection), card]);
    setDraggedItem(null);
  };

  const onDropOnCard = (e: React.DragEvent, targetSection: SectionType, targetIndex: number) => {
    e.stopPropagation();
    if (!draggedItem) return;

    const { card, sourceSection, sourceIndex } = draggedItem;

    if (sourceSection === targetSection) {
      if (sourceIndex === undefined) return;
      const newData = [...getSectionData(targetSection)];
      newData.splice(sourceIndex, 1);
      newData.splice(targetIndex, 0, card);
      setSectionData(targetSection, newData);
    } else {
      if (targetSection !== 'considerations' && !checkDeckLimit(card)) return;
      
      if (targetSection === 'extra' && !isExtraDeckCard(card)) return;
      if (targetSection === 'main' && isExtraDeckCard(card)) return;
      if (targetSection === 'extra' && extraDeck.length >= 15) return;
      if (targetSection === 'main' && mainDeck.length >= 60) return;
      if (targetSection === 'side' && sideDeck.length >= 15) return;

      if (sourceSection && sourceSection !== 'search' && sourceIndex !== undefined) {
        removeCard(sourceIndex, sourceSection);
      }
      
      const newData = [...getSectionData(targetSection)];
      newData.splice(targetIndex, 0, card);
      setSectionData(targetSection, newData);
    }
    setDraggedItem(null);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const deckData = parseYDK(content);
        
        const [main, extra, side] = await Promise.all([
          fetchCardData(deckData.main),
          fetchCardData(deckData.extra),
          fetchCardData(deckData.side)
        ]);

        setMainDeck(main);
        setExtraDeck(extra);
        setSideDeck(side);
        setConsiderations([]); 
      } catch (err) {
        console.error("Import failed", err);
        alert("Failed to parse .ydk file.");
      } finally {
        setIsImporting(false);
        if (importInputRef.current) importInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const exportYDK = () => {
    const content = [
      '#created by DuelMath',
      '#main',
      ...mainDeck.map(c => c.id),
      '#extra',
      ...extraDeck.map(c => c.id),
      '!side',
      ...sideDeck.map(c => c.id)
    ].join('\n');

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'deck.ydk';
    link.click();
  };

  const renderBanStatus = (card: Card) => {
    const status = card.banlist_info?.ban_tcg;
    if (!status) return null;

    let bgColor = "bg-slate-700";
    let text = "";

    if (status === 'Forbidden') {
      bgColor = "bg-red-600";
      text = "0";
    } else if (status === 'Limited') {
      bgColor = "bg-amber-500";
      text = "1";
    } else if (status === 'Semi-Limited') {
      bgColor = "bg-blue-500";
      text = "2";
    } else {
      return null;
    }

    return (
      <div className={`absolute top-1 left-1 ${bgColor} text-white w-7 h-7 rounded-full flex items-center justify-center text-[16px] font-black shadow-[0_4px_12px_rgba(0,0,0,0.6)] z-20 border-2 border-white/40 ring-2 ring-black/20`}>
        {text}
      </div>
    );
  };

  const renderCardGrid = (cards: Card[], section: SectionType) => (
    <div 
      className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 2xl:grid-cols-12 gap-2 min-h-[100px] p-2 bg-slate-900/20 rounded-lg border-2 border-transparent hover:border-slate-700/50 transition-colors"
      onDragOver={onDragOver}
      onDrop={() => onDropOnSection(section)}
    >
      {cards.map((card, idx) => (
        <div 
          key={`${section}-${idx}`} 
          draggable
          onDragStart={() => onDragStart(card, section, idx)}
          onDrop={(e) => onDropOnCard(e, section, idx)}
          onContextMenu={(e) => handleDeckCardContextMenu(e, idx, section)}
          className="relative group rounded overflow-hidden shadow-lg border border-slate-700 bg-slate-800 cursor-grab active:cursor-grabbing transform transition-transform hover:scale-105 z-0 hover:z-10"
        >
          <img src={card.card_images[0].image_url_small} alt={card.name} className="w-full aspect-[2/3] object-cover pointer-events-none" />
          {renderBanStatus(card)}
          <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 p-1">
            <button onClick={() => removeCard(idx, section)} className="w-full py-1 bg-red-600 hover:bg-red-500 text-white text-[9px] font-bold rounded">REMOVE</button>
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-[calc(100vh-120px)] gap-6">
      {/* Search Sidebar */}
      <div className="w-full lg:w-80 flex flex-col bg-slate-800/50 rounded-xl border border-slate-700 overflow-hidden shrink-0">
        <div className="p-4 border-b border-slate-700 bg-slate-800">
          <h2 className="text-sm font-bold text-cyan-400 mb-1 uppercase tracking-widest">Card Search</h2>
          <p className="text-[9px] text-slate-500 mb-3 font-medium uppercase tracking-tight">
            Right-click to quick add: <br/>
            <span className="text-cyan-600">Click</span>: Main/Extra • <span className="text-amber-600">Shift</span>: Side • <span className="text-violet-600">Ctrl</span>: Aside
          </p>
          <div className="relative">
            <input 
              type="text" 
              placeholder="Search cards..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 text-white rounded-lg pl-10 pr-4 py-2 text-sm border border-slate-700 focus:border-cyan-500 outline-none"
            />
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 absolute left-3 top-2.5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
          {isSearching ? (
            <div className="flex justify-center p-8"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-cyan-400"></div></div>
          ) : searchResults.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {searchResults.map((card) => (
                <div 
                  key={card.id} 
                  draggable
                  onDragStart={() => onDragStart(card, 'search')}
                  onContextMenu={(e) => handleSearchResultContextMenu(e, card)}
                  className="relative group rounded overflow-hidden border border-slate-700 hover:border-cyan-500 transition-all cursor-grab active:cursor-grabbing"
                >
                  <img src={card.card_images[0].image_url_small} alt={card.name} className="w-full aspect-[2/3] object-cover pointer-events-none" />
                  {renderBanStatus(card)}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col gap-1.5 items-center justify-center p-2 transition-opacity">
                    <button onClick={() => addCard(card)} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white text-[9px] font-bold py-1 rounded shadow-lg uppercase">+ Deck</button>
                    <button onClick={() => addCard(card, 'side')} className="w-full bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold py-1 rounded shadow-lg uppercase">+ Side</button>
                    <button onClick={() => addCard(card, 'considerations')} className="w-full bg-violet-600 hover:bg-violet-500 text-white text-[9px] font-bold py-1 rounded shadow-lg uppercase">+ Aside</button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-slate-500 italic text-xs">
              {searchTerm.length < 3 ? 'Type at least 3 characters to search...' : 'No cards found.'}
            </div>
          )}
        </div>
      </div>

      {/* Builder Workspace */}
      <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-8 pb-12">
        <header className="flex flex-col sm:flex-row justify-between items-center bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-xl sticky top-0 z-20 gap-4">
          <div className="flex gap-8">
            <div className="text-center">
              <div className="text-xl font-black text-white">{mainDeck.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Main</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-white">{extraDeck.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Extra</div>
            </div>
            <div className="text-center">
              <div className="text-xl font-black text-white">{sideDeck.length}</div>
              <div className="text-[10px] text-slate-400 uppercase font-bold">Side</div>
            </div>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <button 
              onClick={() => { setMainDeck([]); setExtraDeck([]); setSideDeck([]); setConsiderations([]); }}
              className="px-3 py-2 text-[10px] font-bold text-slate-400 hover:text-red-400 uppercase transition-colors"
            >
              Clear
            </button>
            <button 
              onClick={() => importInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest transition-all disabled:opacity-50"
            >
              {isImporting ? 'Loading...' : 'Import .YDK'}
            </button>
            <input type="file" ref={importInputRef} onChange={handleImport} accept=".ydk" className="hidden" />
            <button 
              onClick={exportYDK}
              className="px-5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-[10px] font-bold rounded-lg uppercase tracking-widest shadow-lg transition-all"
            >
              Export .YDK
            </button>
          </div>
        </header>

        <section>
          <div className="flex items-center justify-between mb-3 ml-1 border-b border-amber-500/20 pb-1">
            <div className="flex items-center gap-2">
              <h3 className="text-[10px] font-bold text-amber-500 uppercase tracking-[0.2em]">Main Deck ({mainDeck.length}/60)</h3>
              <span className="text-[8px] text-slate-500 uppercase font-bold">• Right-click card to remove</span>
            </div>
            <span className="text-[8px] text-slate-500 uppercase font-bold">Drag cards here to add or reorder</span>
          </div>
          {renderCardGrid(mainDeck, 'main')}
        </section>

        <div className="grid grid-cols-1 gap-8">
          <section>
            <h3 className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-3 ml-1 border-b border-emerald-500/20 pb-1">Extra Deck ({extraDeck.length}/15)</h3>
            {renderCardGrid(extraDeck, 'extra')}
          </section>
          <section>
            <h3 className="text-[10px] font-bold text-pink-500 uppercase tracking-[0.2em] mb-3 ml-1 border-b border-pink-500/20 pb-1">Side Deck ({sideDeck.length}/15)</h3>
            {renderCardGrid(sideDeck, 'side')}
          </section>
          
          <section>
            <div className="flex items-center gap-3 mb-3 ml-1 border-b border-violet-500/20 pb-1">
              <h3 className="text-[10px] font-bold text-violet-400 uppercase tracking-[0.2em]">Additional Considerations ({considerations.length})</h3>
              <span className="text-[8px] bg-violet-500/10 text-violet-400 px-1.5 rounded border border-violet-500/20 uppercase font-bold">Internal Reference</span>
            </div>
            {renderCardGrid(considerations, 'considerations')}
          </section>
        </div>
      </div>
    </div>
  );
};