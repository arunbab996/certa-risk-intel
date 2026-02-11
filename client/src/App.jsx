import React, { useState } from 'react';
import { 
  LayoutDashboard, History, Bell, Search, ExternalLink, Loader2, Globe, X, Shield, Gavel, 
  FileText, Newspaper, Megaphone, CheckCircle2, AlertTriangle, Sparkles, Bookmark, Plus, 
  Trash2, RefreshCw, Users, ArrowUpRight, Zap, Database, Scale, Globe2, MessageCircle, Twitter 
} from 'lucide-react';
import certaLogo from './assets/certa.svg';
import gavinPic from './assets/gavin.jpg'; 

// --- CONFIGURATION ---
// ⚠️ IMPORTANT: Replace this with your actual Render URL (keep /api at the end)
const API_BASE = 'https://certa-risk-intel-production.up.railway.app/api';

// --- HELPER COMPONENTS ---

const NavItem = ({ icon: Icon, label, active, onClick }) => (
  <button 
    onClick={onClick} 
    className={`w-full flex items-center gap-3 px-4 py-2.5 text-xs font-semibold rounded-lg transition-all duration-200 ${active ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
  >
    <Icon className={`w-4 h-4 ${active ? 'text-blue-400' : 'text-slate-400'}`} />
    {label}
  </button>
);

const RiskScore = ({ score, severity }) => {
    if (!severity || severity === 'None' || !score) return null;
    
    let colorClass = 'text-emerald-600';
    if (score > 90) colorClass = 'text-red-700'; // Critical
    else if (score > 75) colorClass = 'text-red-600'; // High
    else if (score > 40) colorClass = 'text-orange-600'; // Medium
    
    return (
        <div className="flex flex-col items-end min-w-[50px]">
            <div className={`text-xl font-black ${colorClass} tracking-tight`}>{score}</div>
            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Score</div>
        </div>
    );
};

const getRiskBadgeStyle = (type) => {
    const t = (type || '').toLowerCase();
    if (t.includes('fraud') || t.includes('financial')) return 'bg-red-50 text-red-700 border-red-100';
    if (t.includes('litigation') || t.includes('legal')) return 'bg-orange-50 text-orange-700 border-orange-100';
    if (t.includes('environmental') || t.includes('esg')) return 'bg-emerald-50 text-emerald-700 border-emerald-100';
    if (t.includes('labor') || t.includes('employment')) return 'bg-blue-50 text-blue-700 border-blue-100';
    if (t.includes('regulatory')) return 'bg-purple-50 text-purple-700 border-purple-100';
    if (t.includes('sanctions') || t.includes('corruption')) return 'bg-slate-800 text-white border-slate-700';
    return 'bg-slate-100 text-slate-600 border-slate-200';
};

const SourceTypeBadge = ({ type }) => {
    const safeType = type || 'News';
    const styles = { 
        'Legal': 'bg-purple-50 text-purple-700 border-purple-100', 
        'Regulatory': 'bg-blue-50 text-blue-700 border-blue-100', 
        'Blog': 'bg-orange-50 text-orange-700 border-orange-100', 
        'News': 'bg-slate-50 text-slate-600 border-slate-200' 
    };
    const Icon = { 'Legal': Gavel, 'Regulatory': FileText, 'Blog': Megaphone, 'News': Newspaper }[safeType] || Newspaper;
    
    return (
        <span className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${styles[safeType] || styles['News']}`}>
            <Icon className="w-3 h-3" /> {safeType}
        </span>
    );
};

const SourceLogo = ({ domain, sourceName }) => {
  const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
  return (
    <div className="w-8 h-8 rounded-md bg-white border border-slate-200 flex items-center justify-center overflow-hidden p-0.5 shrink-0 relative shadow-sm">
      <img src={logoUrl} alt={sourceName} className="w-full h-full object-contain relative z-10" onError={(e) => { e.target.style.display = 'none'; }} />
      <Globe className="w-4 h-4 text-slate-300 absolute z-0" />
    </div>
  );
};

const AuditModal = ({ isOpen, onClose, onConfirm, type }) => {
    const [reason, setReason] = useState('');
    if (!isOpen) return null;
    
    const reasons = type === 'Dismiss' 
        ? ["False Positive (Wrong Person)", "Risk Already Managed", "Source Not Credible", "Outdated Information", "Business Operational Noise"] 
        : ["Confirmed Adverse Media", "Escalated for Level 2 Review", "Requires Legal Opinion", "Regulatory Filing Match"];
    
    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-xl shadow-2xl p-6 w-[400px] border border-slate-200">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">{type === 'Dismiss' ? 'Dismiss Finding' : 'Confirm Risk'}</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors"><X className="w-4 h-4"/></button>
                </div>
                <div className="space-y-2 mb-4">
                    {reasons.map(r => (
                        <label key={r} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 cursor-pointer border border-transparent hover:border-slate-200 transition-all">
                            <input type="radio" name="reason" value={r} onChange={(e) => setReason(e.target.value)} className="w-3.5 h-3.5 accent-blue-600" />
                            <span className="text-xs text-slate-700 font-medium">{r}</span>
                        </label>
                    ))}
                </div>
                <div className="flex justify-end gap-2">
                    <button onClick={onClose} className="px-3 py-1.5 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-md transition-colors">Cancel</button>
                    <button 
                        onClick={() => onConfirm(reason)} 
                        disabled={!reason} 
                        className={`px-4 py-1.5 text-xs font-bold text-white rounded-md shadow-sm transition-colors ${type === 'Dismiss' ? 'bg-slate-800 hover:bg-slate-900' : 'bg-red-600 hover:bg-red-700'}`}
                    >
                        Submit Decision
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APPLICATION ---

export default function App() {
  const [view, setView] = useState('landing'); 
  const [historyLog, setHistoryLog] = useState([]);
  const [query, setQuery] = useState(''); 
  const [results, setResults] = useState([]);
  const [relatedEntities, setRelatedEntities] = useState([]);
  const [executiveBrief, setExecutiveBrief] = useState(''); 
  const [tweets, setTweets] = useState([]); // Social Signal State
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('adverse');
  const [decisions, setDecisions] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [actionType, setActionType] = useState('');
  
  const [watchlist, setWatchlist] = useState([
      { id: 1, name: 'Waymo', added: '2024-02-01', newHits: 3, status: 'Active' },
      { id: 2, name: 'OpenAI', added: '2024-01-15', newHits: 0, status: 'Active' },
      { id: 3, name: 'Tesla', added: '2023-11-20', newHits: 1, status: 'Review Needed' }
  ]);
  const [newWatchItem, setNewWatchItem] = useState('');

  const addToWatchlist = (e) => {
      e.preventDefault();
      if (!newWatchItem) return;
      setWatchlist([...watchlist, { id: Date.now(), name: newWatchItem, added: new Date().toISOString().split('T')[0], newHits: 0, status: 'Active' }]);
      setNewWatchItem('');
  };

  const removeFromWatchlist = (id) => setWatchlist(watchlist.filter(item => item.id !== id));
  
  const runWatchlistScan = (name) => {
      setQuery(name);
      setView('dashboard');
      handleScan(null, name);
  };

  const fetchHistory = async () => {
      try {
          const res = await fetch(`${API_BASE}/history`);
          const data = await res.json();
          setHistoryLog(data);
          setView('history');
      } catch (err) { console.error(err); }
  };

  const handleScan = async (e, overrideQuery) => {
    if (e) e.preventDefault();
    const searchTerm = overrideQuery || query;
    if (!searchTerm || loading) return; 
    
    setLoading(true); setResults([]); setRelatedEntities([]); setExecutiveBrief(''); setTweets([]);
    if (view === 'landing') setView('dashboard');

    try {
      const res = await fetch(`${API_BASE}/scan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchTerm }) 
      });
      const data = await res.json();
      
      // Safety Checks: Ensure data exists before setting state
      setResults(data?.data || []);
      setRelatedEntities(data?.related || []);
      setExecutiveBrief(data?.brief || '');
      setTweets(data?.tweets || []); 
    } catch (err) { 
        console.error("Fetch Error:", err);
        alert("Connection Error. Ensure Backend is live on Railway."); 
    } finally { 
        setLoading(false); 
    }
  };

  const openAuditModal = (item, type) => { setSelectedItem(item); setActionType(type); setModalOpen(true); };

  const submitAudit = async (reason) => {
      await fetch(`${API_BASE}/action`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articleUrl: selectedItem?.url, action: actionType, reason, user: "Gavin Belson", query: query })
      });
      setDecisions(prev => ({ ...prev, [selectedItem?.url]: actionType }));
      setModalOpen(false);
  };

  const adverseCount = (results || []).filter(r => r?.analysis?.isAdverse).length;
  const displayResults = activeTab === 'adverse' ? (results || []).filter(r => r?.analysis?.isAdverse) : (results || []);

  // --- RENDER LANDING PAGE ---
  if (view === 'landing') {
    return (
        <div className="min-h-screen bg-slate-50 relative flex flex-col items-center justify-center overflow-hidden selection:bg-blue-100">
            <div className="absolute inset-0 z-0 opacity-50" style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
            <div className="absolute inset-0 z-0 bg-gradient-to-b from-transparent via-white/70 to-white"></div>

            <header className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
                 <img src={certaLogo} className="h-7 w-auto" alt="Certa"/>
                 <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                        <p className="text-xs font-bold text-slate-900">Gavin Belson</p>
                        <p className="text-[10px] text-slate-500">Hooli Inc.</p>
                    </div>
                    <div className="h-9 w-9 rounded-full bg-white border border-slate-200 overflow-hidden shadow-sm">
                        <img src={gavinPic} className="w-full h-full object-cover" />
                    </div>
                 </div>
            </header>
            
            <div className="relative z-10 w-full max-w-3xl mx-auto flex flex-col items-center justify-center px-4 -mt-6">
                <div className="flex flex-col items-center gap-4 mb-10 text-center animate-fade-in-up">
                     <h1 className="text-5xl md:text-6xl font-black text-slate-900 tracking-tight leading-tight">Strategic Risk <br/> <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-700 to-sky-500">Intelligence</span></h1>
                     <p className="text-slate-500 text-lg md:text-xl max-w-xl leading-relaxed mt-2 font-medium">AI-powered screening across global news, legal filings, and regulatory databases.</p>
                </div>

                <div className="w-full relative group animate-fade-in-up delay-100">
                    <div className="absolute -inset-1 bg-gradient-to-r from-blue-400 to-sky-400 rounded-2xl blur opacity-20 group-hover:opacity-30 transition duration-1000"></div>
                    <form onSubmit={handleScan} className="relative">
                        <div className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-600 transition-colors">
                            <Sparkles className="w-6 h-6" />
                        </div>
                        <input 
                            type="text" 
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Enter company or individual name..." 
                            className="w-full h-20 pl-16 pr-32 bg-white border border-slate-200 rounded-2xl shadow-xl shadow-blue-900/5 text-xl text-slate-900 font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
                            autoFocus
                        />
                        <div className="absolute right-3 top-3 bottom-3">
                            <button type="submit" disabled={!query} className="h-full px-8 bg-blue-700 hover:bg-blue-800 text-white rounded-xl flex items-center justify-center transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-blue-200 font-bold tracking-wide">
                                Scan Risk
                            </button>
                        </div>
                    </form>
                </div>

                <div className="flex items-center gap-8 mt-12 text-slate-400 animate-fade-in-up delay-200">
                    <div className="flex items-center gap-2"><Globe2 className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Global News</span></div>
                    <div className="w-px h-4 bg-slate-300"></div>
                    <div className="flex items-center gap-2"><Scale className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Legal Dockets</span></div>
                    <div className="w-px h-4 bg-slate-300"></div>
                    <div className="flex items-center gap-2"><Database className="w-4 h-4" /><span className="text-xs font-semibold uppercase tracking-wider">Regulatory</span></div>
                </div>

                <div className="flex flex-wrap justify-center gap-3 mt-8 animate-fade-in-up delay-300">
                    {/* UPDATED: Removed Stripe, Added Elon Musk */}
                    {["Renault", "Waymo", "OpenAI", "Elon Musk"].map(term => (
                        <button key={term} onClick={() => { setQuery(term); handleScan(null, term); }} className="px-5 py-2.5 bg-white hover:bg-slate-50 border border-slate-200 rounded-full text-sm font-bold text-slate-600 transition-all hover:border-blue-300 hover:text-blue-600 hover:shadow-md">{term}</button>
                    ))}
                </div>
            </div>

            <div className="absolute bottom-6 w-full text-center">
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Powered by Certa AI Engine • v2.1 Enterprise</p>
            </div>
        </div>
    );
  }

  // --- i DASHBOARD ---
  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 selection:bg-blue-100">
      <AuditModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onConfirm={submitAudit} type={actionType} />
      
      <aside className="w-60 bg-white border-r border-slate-200 fixed h-full hidden md:flex flex-col z-40">
        <div className="px-5 h-14 flex items-center border-b border-slate-100 cursor-pointer" onClick={() => setView('landing')}>
            <img src={certaLogo} alt="Certa" className="h-6 w-auto" />
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem icon={LayoutDashboard} label="Adverse Media" active={view === 'dashboard'} onClick={() => setView('dashboard')} />
          <NavItem icon={Bookmark} label="Saved Searches" active={view === 'saved'} onClick={() => setView('saved')} />
          <NavItem icon={History} label="Screening History" active={view === 'history'} onClick={fetchHistory} />
        </nav>
        <div className="p-4 border-t border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-full overflow-hidden border border-slate-200"><img src={gavinPic} alt="User" className="h-full w-full object-cover" /></div>
                <div><p className="text-xs font-bold text-slate-900">Gavin Belson</p><p className="text-[10px] text-slate-500">Hooli Inc.</p></div>
            </div>
        </div>
      </aside>

      <main className="flex-1 md:ml-60 transition-all flex flex-col min-h-screen">
        <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
            <div className="flex-1 max-w-2xl">
                {view === 'dashboard' && (
                <form onSubmit={(e) => handleScan(e)} className="relative flex items-center w-full group">
                    <Search className="absolute left-3 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input type="text" value={query} onChange={e => setQuery(e.target.value)} className="w-full pl-9 pr-20 py-1.5 bg-slate-100 border-transparent focus:bg-white focus:border-blue-500 focus:ring-1 focus:ring-blue-500 rounded-md text-sm transition-all outline-none placeholder-slate-400" placeholder="Search entity..." />
                     <div className="absolute right-1 top-1 bottom-1 flex items-center">
                        <button type="submit" disabled={loading} className="bg-slate-900 hover:bg-slate-800 text-white p-1 rounded transition-colors disabled:opacity-50">{loading ? <Loader2 className="w-3.5 h-3.5 animate-spin"/> : <Search className="w-3.5 h-3.5"/>}</button>
                    </div>
                </form>
                )}
            </div>
            <div className="flex items-center gap-4 ml-4"><button className="text-slate-400 hover:text-slate-600"><Bell className="w-4 h-4" /></button></div>
        </header>

        <div className="p-6 max-w-full mx-auto w-full flex-1 bg-slate-50/50">
            {view === 'dashboard' && (
                <>
                {loading && (
                    <div className="flex flex-col items-center justify-center mt-20 animate-pulse">
                         <div className="w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-4"><Loader2 className="w-6 h-6 text-blue-600 animate-spin"/></div>
                         <h3 className="text-slate-900 font-semibold">Scanning Global Sources...</h3>
                         <p className="text-slate-500 text-sm mt-1">Analyzing legal, regulatory, and news databases for "{query}"</p>
                    </div>
                )}
                {!loading && (
                <div className="animate-fade-in-up">
                     
                     {/* EXECUTIVE BRIEF */}
                     {executiveBrief && (
                        <div className="mb-6 p-5 bg-gradient-to-r from-slate-900 to-blue-900 rounded-xl shadow-lg text-white border border-slate-700">
                            <div className="flex items-start gap-4">
                                <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm"><Zap className="w-6 h-6 text-yellow-400" /></div>
                                <div>
                                    <h3 className="text-sm font-bold uppercase tracking-wider text-blue-200 mb-1">AI Executive Brief</h3>
                                    <p className="text-sm leading-relaxed font-medium text-slate-100">{executiveBrief}</p>
                                </div>
                            </div>
                        </div>
                     )}

                     <div className="flex items-center gap-4 mb-6">
                        <div className="px-4 py-2 bg-white border border-slate-200 rounded-lg shadow-sm flex items-center gap-3"><span className="text-[10px] font-bold text-slate-400 uppercase">Total Scanned</span><span className="text-lg font-bold text-slate-900">{results?.length || 0}</span></div>
                        <div className="px-4 py-2 bg-white border border-red-100 rounded-lg shadow-sm flex items-center gap-3"><span className="text-[10px] font-bold text-red-400 uppercase">High Risk</span><span className="text-lg font-bold text-red-600">{adverseCount}</span></div>
                    </div>
                    
                    {/* RELATED ENTITIES */}
                    {relatedEntities?.length > 0 && (
                        <div className="mb-6 p-4 bg-blue-50 border border-blue-100 rounded-lg flex items-center gap-4">
                            <div className="p-2 bg-white rounded-full border border-blue-100 text-blue-600"><Users className="w-5 h-5" /></div>
                            <div className="flex-1">
                                <h3 className="text-sm font-bold text-blue-900">Found Associated Individuals</h3>
                                <p className="text-xs text-blue-700 mt-0.5">Adverse media often hides in executive profiles. We recommend scanning these related entities:</p>
                            </div>
                            <div className="flex gap-2">
                                {relatedEntities.map((ent, i) => (
                                    <button key={i} onClick={() => runWatchlistScan(ent.name)} className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-blue-700 text-xs font-bold rounded-md border border-blue-200 hover:bg-blue-600 hover:text-white hover:border-blue-600 transition-all shadow-sm">
                                        {ent.name} <ArrowUpRight className="w-3 h-3" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex items-center gap-6 border-b border-slate-200 mb-6">
                        <button onClick={() => setActiveTab('adverse')} className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'adverse' ? 'border-red-500 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>Adverse Findings <span className="bg-red-50 text-red-600 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-red-100">{adverseCount}</span></button>
                        <button onClick={() => setActiveTab('all')} className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all ${activeTab === 'all' ? 'border-blue-600 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>All Intelligence <span className="bg-slate-50 text-slate-600 px-2 py-0.5 rounded-full text-[10px] font-extrabold border border-slate-100">{results?.length || 0}</span></button>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {displayResults.length === 0 && (
                             <div className="col-span-2 text-center py-10 text-slate-400 text-sm font-medium">No intelligence found for this entity.</div>
                    )}
                    {displayResults.map((item, idx) => {
                        const ai = item?.analysis || {};
                        const decision = decisions[item?.url];
                        const extraSources = item?.relatedSources || [];
                        
                        return (
                            <div key={idx} className={`bg-white rounded-lg p-5 border transition-all hover:shadow-md ${decision ? 'opacity-50 grayscale border-slate-100' : 'border-slate-200 hover:border-blue-200'}`}>
                            <div className="flex gap-4 items-start h-full">
                                <div className="flex flex-col items-center gap-2">
                                    <SourceLogo domain={item?.domain} sourceName={item?.source} />
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col h-full">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <h3 className="text-sm font-bold text-slate-900 leading-snug hover:text-blue-600 cursor-pointer line-clamp-2"><a href={item?.url} target="_blank" rel="noreferrer">{item?.title}</a></h3>
                                        <ExternalLink className="w-3 h-3 text-slate-300 shrink-0"/>
                                    </div>
                                    <div className="flex items-center gap-2 mb-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                        <SourceTypeBadge type={item?.sourceType || 'News'} /><span>•</span><span>{item?.date ? new Date(item.date).toLocaleDateString() : 'Recent'}</span>
                                    </div>
                                    <p className="text-slate-600 text-xs leading-relaxed mb-4 line-clamp-3 flex-1 font-medium">{ai?.summary || item?.content}</p>
                                    
                                    {/* RELATED SOURCES SECTION */}
                                    {extraSources?.length > 0 && (
                                        <div className="mb-4 pt-3 border-t border-slate-50">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full border border-blue-100">
                                                    +{extraSources.length} Verified Sources
                                                </span>
                                            </div>
                                            <div className="space-y-1">
                                                {extraSources.map((s, i) => (
                                                    <a key={i} href={s.url} target="_blank" rel="noreferrer" className="block text-[10px] text-slate-500 hover:text-blue-600 truncate transition-colors border-l-2 border-slate-100 pl-2 hover:border-blue-400">
                                                        {s.source}: {s.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-50 mt-auto">
                                        <div className="flex flex-wrap gap-1.5">
                                            {ai?.isAdverse ? <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-red-50 text-red-700 border border-red-100"><AlertTriangle className="w-2.5 h-2.5"/> Risk</span> : <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-100"><CheckCircle2 className="w-2.5 h-2.5"/> Safe</span>}
                                            {ai?.riskTypes?.slice(0, 2).map(t => (<span key={t} className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase border ${getRiskBadgeStyle(t)}`}>{t}</span>))}
                                        </div>
                                        {!decision ? (
                                            <div className="flex gap-2">
                                                <button onClick={() => openAuditModal(item, 'Confirm')} className="text-[10px] font-bold px-3 py-1.5 bg-white text-red-600 border border-red-100 rounded hover:bg-red-50 transition-colors">Confirm</button>
                                                <button onClick={() => openAuditModal(item, 'Dismiss')} className="text-[10px] font-bold px-3 py-1.5 bg-white text-slate-600 border border-slate-200 rounded hover:bg-slate-50 transition-colors">Dismiss</button>
                                            </div>
                                        ) : (
                                            <div className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Shield className="w-3 h-3"/> {decision}</div>
                                        )}
                                    </div>
                                </div>
                                <RiskScore score={ai?.riskScore || 0} severity={ai?.severity} />
                            </div>
                            </div>
                        );
                    })}
                    </div>

                    {/* LIVE SOCIAL MONITOR */}
                    {tweets?.length > 0 && (
                        <div className="mt-8 pt-6 border-t border-slate-200 animate-fade-in-up">
                            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><MessageCircle className="w-4 h-4 text-blue-500"/> Live Social Signal <span className="text-[10px] font-normal text-slate-400 uppercase ml-2 bg-slate-100 px-2 py-0.5 rounded-full">Beta</span></h3>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {tweets.map((t, i) => (
                                    <div key={i} className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col gap-3 hover:shadow-md transition-all">
                                        <div className="flex justify-between items-start">
                                            <div className="flex items-center gap-2">
                                                <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-500 text-xs">{t.name.charAt(0)}</div>
                                                <div>
                                                    <p className="text-xs font-bold text-slate-900">{t.name}</p>
                                                    <p className="text-[10px] text-slate-400">{t.handle}</p>
                                                </div>
                                            </div>
                                            <Twitter className="w-3 h-3 text-slate-300" />
                                        </div>
                                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{t.content}</p>
                                        <div className="flex items-center justify-between pt-2 border-t border-slate-50">
                                            <span className="text-[10px] text-slate-400">{t.date}</span>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${t.sentiment === 'positive' ? 'text-emerald-600 bg-emerald-50' : t.sentiment === 'negative' ? 'text-red-600 bg-red-50' : 'text-slate-500 bg-slate-100'}`}>{t.sentiment}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                )}
                </>
            )}

            {/* SAVED SEARCHES */}
            {view === 'saved' && (
                <div className="space-y-6 animate-fade-in-up">
                    <div className="flex items-center justify-between">
                        <div><h2 className="text-lg font-bold text-slate-900">Saved Searches</h2><p className="text-xs text-slate-500">Monitor key entities for real-time risk alerts.</p></div>
                        <form onSubmit={addToWatchlist} className="flex gap-2">
                            <input type="text" value={newWatchItem} onChange={(e) => setNewWatchItem(e.target.value)} placeholder="Track new entity..." className="px-3 py-1.5 text-xs border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 outline-none w-48" />
                            <button type="submit" disabled={!newWatchItem} className="px-3 py-1.5 bg-slate-900 text-white rounded-md text-xs font-bold hover:bg-slate-800 disabled:opacity-50"><Plus className="w-3.5 h-3.5" /></button>
                        </form>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {watchlist.map(item => (
                            <div key={item.id} className="bg-white rounded-lg border border-slate-200 p-5 shadow-sm hover:shadow-md transition-all group">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">{item.name.charAt(0)}</div>
                                        <div><h3 className="font-bold text-slate-900">{item.name}</h3><p className="text-[10px] text-slate-500">Added: {item.added}</p></div>
                                    </div>
                                    {item.newHits > 0 && <span className="bg-red-50 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-red-100 flex items-center gap-1 animate-pulse"><div className="w-1.5 h-1.5 bg-red-500 rounded-full"></div> {item.newHits} New Hits</span>}
                                </div>
                                <div className="flex items-center justify-between pt-4 border-t border-slate-50">
                                    <button onClick={() => removeFromWatchlist(item.id)} className="text-slate-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4"/></button>
                                    <button onClick={() => runWatchlistScan(item.name)} className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-md text-xs font-bold hover:bg-blue-100 transition-colors"><RefreshCw className="w-3.5 h-3.5" /> Scan Now</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* HISTORY */}
            {view === 'history' && (
                <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 text-xs uppercase tracking-wide">
                            <tr><th className="px-6 py-3">Time</th><th className="px-6 py-3">User</th><th className="px-6 py-3">Entity</th><th className="px-6 py-3">Action</th><th className="px-6 py-3">Reason</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {historyLog.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-50/50">
                                    <td className="px-6 py-3 text-xs text-slate-500">{new Date(log.timestamp).toLocaleDateString()}</td>
                                    <td className="px-6 py-3 text-xs font-bold text-slate-900 flex items-center gap-2"><div className="w-5 h-5 rounded-full bg-slate-200 overflow-hidden"><img src={gavinPic} className="w-full h-full object-cover" /></div>{log.user}</td>
                                    <td className="px-6 py-3 text-xs font-bold text-slate-700">{log.query}</td>
                                    <td className="px-6 py-3"><span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${log.action === 'Confirm' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-100 text-slate-600 border-slate-200'}`}>{log.action}</span></td>
                                    <td className="px-6 py-3 text-xs text-slate-600">{log.reason}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
      </main>
    </div>
  );
}