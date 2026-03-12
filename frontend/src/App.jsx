import { useState, useMemo, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+"B" : n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(0)+"K" : String(n);
const COLORS = ["#FF6B35","#00E5FF","#A855F7","#22D3A0","#F59E0B","#6366F1","#EC4899","#10B981","#F97316","#8B5CF6"];
const ac = (name) => COLORS[(name||"?").charCodeAt(0) % COLORS.length];
const initials = (name) => name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "??";

export default function App() {
  const [view, setView] = useState("search");
  const [keyword, setKeyword] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ minSubs:"", maxSubs:"", country:"", engMin:"", verified:"" });
  const [selected, setSelected] = useState([]);
  const [cohorts, setCohorts] = useState([]);
  const [cohortName, setCohortName] = useState("");
  const [activeCohort, setActiveCohort] = useState(null);
  const [toast, setToast] = useState(null);
  const [sortBy, setSortBy] = useState("subscribers");

  const showToast = (msg, type="success") => { setToast({msg,type}); setTimeout(()=>setToast(null), 3000); };

  const doSearch = useCallback(async (pageToken = null) => {
    if (!keyword.trim()) return setError("Please enter a keyword");
    setError("");
    pageToken ? setLoadingMore(true) : setLoading(true);

    try {
      const params = new URLSearchParams({ keyword, maxResults: 25 });
      if (pageToken) params.append("pageToken", pageToken);
      const res = await fetch(`${API}/api/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      if (pageToken) {
        setResults(prev => [...prev, ...data.channels]);
      } else {
        setResults(data.channels || []);
        setSearched(true);
      }
      setNextPageToken(data.nextPageToken || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [keyword]);

  const filtered = useMemo(() => {
    return results.filter(k => {
      if (filters.minSubs && k.subscribers < Number(filters.minSubs) * 1000) return false;
      if (filters.maxSubs && k.subscribers > Number(filters.maxSubs) * 1000) return false;
      if (filters.country && k.country !== filters.country) return false;
      if (filters.engMin && k.engagementRate < Number(filters.engMin)) return false;
      if (filters.verified === "yes" && !k.verified) return false;
      return true;
    }).sort((a,b) => b[sortBy] - a[sortBy]);
  }, [results, filters, sortBy]);

  const toggle = (id) => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s,id]);

  const saveCohort = () => {
    if (!cohortName.trim() || selected.length === 0) return showToast("Name your cohort and select at least 1 KOL","error");
    const kols = results.filter(k => selected.includes(k.id));
    setCohorts(c => [...c, { id: Date.now(), name: cohortName.trim(), kols, notes:{}, keyword, createdAt: new Date().toLocaleDateString() }]);
    setCohortName(""); setSelected([]);
    showToast(`"${cohortName}" saved · ${kols.length} KOLs`);
  };

  const doExport = (kols, filename) => {
    const h = ["Name","Handle","Country","Language","Subscribers","Total Views","Videos","Engagement %","YouTube URL"];
    const rows = kols.map(k => [k.name, k.handle, k.country, k.language, k.subscribers, k.views, k.videos, k.engagementRate+"%", k.youtubeUrl]);
    const csv = [h,...rows].map(r => r.map(v=>`"${v||""}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = filename+".csv"; a.click();
    showToast(`Exported "${filename}.csv"`);
  };

  const removeFromCohort = (cId, kId) =>
    setCohorts(c => c.map(g => g.id===cId ? {...g, kols: g.kols.filter(k=>k.id!==kId)} : g));

  const inp = { background:"#07090F", border:"1px solid #1E293B", borderRadius:3, padding:"7px 10px", color:"#E2E8F0", fontSize:11, outline:"none", width:"100%", fontFamily:"'IBM Plex Mono',monospace" };

  // ── country options derived from results ──
  const countries = [...new Set(results.map(k=>k.country).filter(c=>c&&c!=="N/A"))].sort();

  return (
    <div style={{background:"#07090F",minHeight:"100vh",fontFamily:"'IBM Plex Mono',monospace",color:"#CBD5E1"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600;700&display=swap');
        *{box-sizing:border-box} input,select,button{font-family:'IBM Plex Mono',monospace}
        ::-webkit-scrollbar{width:4px} ::-webkit-scrollbar-thumb{background:#1E293B}
        .row:hover{background:#0F1623!important}
        .nb:hover{background:#0F1623!important}
        .eb:hover{opacity:.82!important}
        .chip:hover{border-color:#00E5FF!important;color:#00E5FF!important}
        a{color:inherit;text-decoration:none}
      `}</style>

      {toast && (
        <div style={{position:"fixed",bottom:24,right:24,zIndex:9999,padding:"11px 18px",borderRadius:4,
          background:toast.type==="error"?"#450A0A":"#052E16",
          border:`1px solid ${toast.type==="error"?"#EF4444":"#22C55E"}`,
          color:toast.type==="error"?"#FCA5A5":"#86EFAC",fontSize:12,letterSpacing:"0.05em",
          boxShadow:"0 8px 32px rgba(0,0,0,.6)"}}>
          {toast.type==="error"?"✕ ":"✓ "}{toast.msg}
        </div>
      )}

      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>
        {/* Sidebar */}
        <div style={{width:196,background:"#0A0D16",borderRight:"1px solid #1E293B",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"20px 16px",borderBottom:"1px solid #1E293B"}}>
            <div style={{fontSize:11,fontWeight:700,color:"#00E5FF",letterSpacing:"0.2em"}}>◈ KOL SOURCE</div>
            <div style={{fontSize:9,color:"#334155",marginTop:3,letterSpacing:"0.1em"}}>YOUTUBE API · LIVE</div>
          </div>
          {[
            {id:"search",icon:"⌕",label:"Search"},
            {id:"cohorts",icon:"◉",label:`Cohorts${cohorts.length>0?` (${cohorts.length})`:""}`},
          ].map(n => (
            <button key={n.id} className="nb" onClick={()=>setView(n.id)} style={{
              background:view===n.id?"#0F1929":"none",border:"none",cursor:"pointer",
              padding:"13px 16px",display:"flex",alignItems:"center",gap:10,width:"100%",textAlign:"left",
              borderLeft:view===n.id?"2px solid #00E5FF":"2px solid transparent",transition:"all 0.15s"}}>
              <span style={{fontSize:16,color:view===n.id?"#00E5FF":"#475569"}}>{n.icon}</span>
              <span style={{fontSize:11,color:view===n.id?"#E2E8F0":"#64748B",letterSpacing:"0.08em"}}>{n.label}</span>
            </button>
          ))}
          <div style={{flex:1}}/>
          <div style={{padding:16,borderTop:"1px solid #1E293B"}}>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <div style={{width:6,height:6,borderRadius:"50%",background:"#22C55E",boxShadow:"0 0 6px #22C55E"}}/>
              <span style={{fontSize:9,color:"#334155",letterSpacing:"0.08em"}}>YOUTUBE API LIVE</span>
            </div>
            <div style={{fontSize:8,color:"#1E293B",marginTop:4}}>~99 searches/day free</div>
          </div>
        </div>

        <div style={{flex:1,overflow:"auto"}}>

          {/* ─── SEARCH ─── */}
          {view==="search" && (
            <div style={{padding:28}}>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:15,fontWeight:600,color:"#F1F5F9",marginBottom:3}}>KOL Search</div>
                <div style={{fontSize:10,color:"#475569",letterSpacing:"0.1em"}}>LIVE YOUTUBE DATA · SEARCH · FILTER · EXPORT</div>
              </div>

              {/* Search bar */}
              <div style={{display:"flex",gap:10,marginBottom:14}}>
                <input value={keyword} onChange={e=>setKeyword(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  placeholder='e.g. "python tutorial", "tech review", "AI", "fitness"'
                  style={{...inp,flex:1,padding:"11px 14px",fontSize:12,border:"1px solid #1E293B",borderRadius:4}}/>
                <button onClick={()=>doSearch()} style={{
                  background:"#00E5FF",color:"#07090F",border:"none",borderRadius:4,
                  padding:"11px 28px",fontSize:11,fontWeight:700,cursor:"pointer",letterSpacing:"0.1em"}}>
                  {loading?"LOADING...":"SEARCH"}
                </button>
              </div>

              {error && (
                <div style={{background:"#450A0A",border:"1px solid #EF4444",borderRadius:4,padding:"10px 14px",marginBottom:14,fontSize:11,color:"#FCA5A5"}}>
                  ✕ {error}
                </div>
              )}

              {/* Filters */}
              <div style={{background:"#0A0D16",border:"1px solid #1E293B",borderRadius:4,padding:16,marginBottom:14}}>
                <div style={{fontSize:9,color:"#475569",letterSpacing:"0.15em",marginBottom:10}}>FILTERS</div>
                <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
                  <div>
                    <div style={{fontSize:9,color:"#475569",marginBottom:4,letterSpacing:"0.08em"}}>Min Subs (K)</div>
                    <input type="number" value={filters.minSubs} onChange={e=>setFilters(p=>({...p,minSubs:e.target.value}))} placeholder="e.g. 100" style={inp}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#475569",marginBottom:4,letterSpacing:"0.08em"}}>Max Subs (K)</div>
                    <input type="number" value={filters.maxSubs} onChange={e=>setFilters(p=>({...p,maxSubs:e.target.value}))} placeholder="e.g. 5000" style={inp}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#475569",marginBottom:4,letterSpacing:"0.08em"}}>Min Engagement %</div>
                    <input type="number" value={filters.engMin} onChange={e=>setFilters(p=>({...p,engMin:e.target.value}))} placeholder="e.g. 3" style={inp}/>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#475569",marginBottom:4,letterSpacing:"0.08em"}}>Country</div>
                    <select value={filters.country} onChange={e=>setFilters(p=>({...p,country:e.target.value}))}
                      style={{...inp,color:filters.country?"#E2E8F0":"#475569"}}>
                      <option value="">Any</option>
                      {countries.map(c=><option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{fontSize:9,color:"#475569",marginBottom:4,letterSpacing:"0.08em"}}>Verified (100K+)</div>
                    <select value={filters.verified} onChange={e=>setFilters(p=>({...p,verified:e.target.value}))}
                      style={{...inp,color:filters.verified?"#E2E8F0":"#475569"}}>
                      <option value="">Any</option>
                      <option value="yes">Verified only</option>
                    </select>
                  </div>
                  <div style={{display:"flex",alignItems:"flex-end"}}>
                    <button onClick={()=>setFilters({minSubs:"",maxSubs:"",country:"",engMin:"",verified:""})}
                      style={{background:"none",border:"1px solid #1E293B",borderRadius:3,padding:"7px 12px",fontSize:9,color:"#475569",cursor:"pointer",letterSpacing:"0.08em",width:"100%"}}>
                      ✕ CLEAR FILTERS
                    </button>
                  </div>
                </div>
              </div>

              {/* Toolbar */}
              {searched && !loading && (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10,flexWrap:"wrap",gap:8}}>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <span style={{fontSize:11,color:"#475569"}}>
                      <span style={{color:"#00E5FF",fontWeight:700}}>{filtered.length}</span> creators
                      {selected.length>0 && <span style={{color:"#F59E0B",marginLeft:10}}>· {selected.length} selected</span>}
                    </span>
                    {filtered.length>0 && (
                      <>
                        <button onClick={()=>setSelected(filtered.map(k=>k.id))}
                          style={{background:"none",border:"1px solid #1E293B",borderRadius:2,padding:"3px 8px",fontSize:9,color:"#64748B",cursor:"pointer",letterSpacing:"0.08em"}}>
                          SELECT ALL
                        </button>
                        {selected.length>0 && (
                          <button onClick={()=>setSelected([])}
                            style={{background:"none",border:"1px solid #1E293B",borderRadius:2,padding:"3px 8px",fontSize:9,color:"#475569",cursor:"pointer"}}>
                            CLEAR
                          </button>
                        )}
                      </>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                    {filtered.length>0 && (
                      <button className="eb" onClick={()=>doExport(filtered, keyword?`search-${keyword}`:"results")}
                        style={{background:"#22D3A0",color:"#07090F",border:"none",borderRadius:3,
                          padding:"6px 14px",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:"0.08em",transition:"opacity 0.15s"}}>
                        ↓ EXPORT RESULTS ({filtered.length})
                      </button>
                    )}
                    <span style={{fontSize:9,color:"#334155",letterSpacing:"0.1em"}}>SORT:</span>
                    {["subscribers","views","engagementRate"].map(s=>(
                      <button key={s} className="chip" onClick={()=>setSortBy(s)} style={{
                        background:"none",border:`1px solid ${sortBy===s?"#00E5FF":"#1E293B"}`,
                        color:sortBy===s?"#00E5FF":"#475569",fontSize:9,padding:"3px 8px",borderRadius:2,
                        cursor:"pointer",letterSpacing:"0.08em",transition:"all 0.15s"}}>
                        {s==="engagementRate"?"ENG%":s.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Save cohort bar */}
              {selected.length>0 && (
                <div style={{background:"#0A0D16",border:"1px solid #F59E0B40",borderRadius:4,
                  padding:"11px 16px",marginBottom:12,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:11,color:"#F59E0B",flexShrink:0}}>{selected.length} selected</span>
                  <input value={cohortName} onChange={e=>setCohortName(e.target.value)}
                    placeholder="Name this cohort..."
                    style={{...inp,flex:1,border:"1px solid #F59E0B40"}}/>
                  <button onClick={saveCohort}
                    style={{background:"#F59E0B",color:"#07090F",border:"none",borderRadius:3,
                      padding:"7px 16px",fontSize:10,fontWeight:700,cursor:"pointer",letterSpacing:"0.1em",flexShrink:0}}>
                    SAVE COHORT
                  </button>
                </div>
              )}

              {loading && (
                <div style={{textAlign:"center",padding:60,color:"#334155",fontSize:11,letterSpacing:"0.2em"}}>
                  SEARCHING YOUTUBE...
                </div>
              )}
              {!loading && searched && filtered.length===0 && (
                <div style={{textAlign:"center",padding:60,color:"#334155",fontSize:11}}>
                  No results — try different keyword or adjust filters
                </div>
              )}

              {/* Results table */}
              {!loading && filtered.length>0 && (
                <>
                  <div style={{border:"1px solid #1E293B",borderRadius:4,overflow:"hidden"}}>
                    <div style={{display:"grid",gridTemplateColumns:"36px 2.5fr 80px 110px 80px 60px 80px",
                      padding:"8px 16px",background:"#0A0D16",borderBottom:"1px solid #1E293B",
                      fontSize:9,color:"#334155",letterSpacing:"0.12em",gap:8,alignItems:"center"}}>
                      <div/><div>CREATOR</div><div>SUBS</div><div>VIEWS</div><div>ENG%</div><div>VIDS</div><div>CTR</div>
                    </div>
                    {filtered.map(k=>(
                      <div key={k.id} className="row" onClick={()=>toggle(k.id)} style={{
                        display:"grid",gridTemplateColumns:"36px 2.5fr 80px 110px 80px 60px 80px",
                        padding:"10px 16px",borderBottom:"1px solid #0F1420",cursor:"pointer",gap:8,
                        background:selected.includes(k.id)?"#0B1829":"#07090F",
                        borderLeft:selected.includes(k.id)?"2px solid #00E5FF":"2px solid transparent",
                        transition:"background 0.1s",alignItems:"center"}}>
                        <div style={{width:16,height:16,borderRadius:2,
                          border:`2px solid ${selected.includes(k.id)?"#00E5FF":"#1E293B"}`,
                          background:selected.includes(k.id)?"#00E5FF":"none",
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,color:"#07090F",flexShrink:0}}>
                          {selected.includes(k.id)&&"✓"}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:9,minWidth:0}}>
                          {k.avatar
                            ? <img src={k.avatar} alt="" style={{width:30,height:30,borderRadius:"50%",flexShrink:0,objectFit:"cover"}}/>
                            : <div style={{width:30,height:30,borderRadius:"50%",background:ac(k.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:9,fontWeight:700,color:"#07090F",flexShrink:0}}>{initials(k.name)}</div>
                          }
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:12,color:"#E2E8F0",fontWeight:500,display:"flex",alignItems:"center",gap:5,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                              {k.name}
                              {k.verified && <span style={{fontSize:8,color:"#3B82F6"}}>✓</span>}
                            </div>
                            <div style={{fontSize:9,color:"#334155"}}>{k.handle} · {k.country}</div>
                          </div>
                        </div>
                        <div style={{fontSize:11,color:"#94A3B8"}}>{fmt(k.subscribers)}</div>
                        <div style={{fontSize:11,color:"#64748B"}}>{fmt(k.views)}</div>
                        <div style={{fontSize:11,color:k.engagementRate>=5?"#22D3A0":k.engagementRate>=3?"#F59E0B":"#EF4444"}}>
                          {k.engagementRate}%
                        </div>
                        <div style={{fontSize:10,color:"#334155"}}>{k.videos}</div>
                        <a href={k.youtubeUrl} target="_blank" rel="noreferrer"
                          onClick={e=>e.stopPropagation()}
                          style={{fontSize:9,color:"#475569",textDecoration:"none",border:"1px solid #1E293B",
                            borderRadius:2,padding:"3px 7px",display:"inline-block"}}>
                          YT ↗
                        </a>
                      </div>
                    ))}
                  </div>

                  {/* Load more */}
                  {nextPageToken && (
                    <div style={{textAlign:"center",marginTop:16}}>
                      <button onClick={()=>doSearch(nextPageToken)} disabled={loadingMore}
                        style={{background:"none",border:"1px solid #1E293B",borderRadius:3,
                          padding:"9px 24px",fontSize:11,color:"#64748B",cursor:"pointer",letterSpacing:"0.1em"}}>
                        {loadingMore?"LOADING...":"LOAD MORE RESULTS"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!searched && (
                <div style={{textAlign:"center",padding:"60px 20px",color:"#1E293B"}}>
                  <div style={{fontSize:36,marginBottom:10}}>◈</div>
                  <div style={{fontSize:11,letterSpacing:"0.15em"}}>SEARCH YOUTUBE CREATORS</div>
                  <div style={{fontSize:9,marginTop:5}}>Enter any keyword — niche, topic, or content type</div>
                </div>
              )}
            </div>
          )}

          {/* ─── COHORTS ─── */}
          {view==="cohorts" && (
            <div style={{padding:28}}>
              <div style={{marginBottom:20}}>
                <div style={{fontSize:15,fontWeight:600,color:"#F1F5F9",marginBottom:3}}>Cohort Manager</div>
                <div style={{fontSize:10,color:"#475569",letterSpacing:"0.1em"}}>VIEW · EDIT · EXPORT YOUR SAVED GROUPS</div>
              </div>

              {cohorts.length===0 && (
                <div style={{textAlign:"center",padding:"80px 20px",color:"#1E293B"}}>
                  <div style={{fontSize:36,marginBottom:10}}>◉</div>
                  <div style={{fontSize:11,letterSpacing:"0.15em"}}>NO COHORTS YET</div>
                  <div style={{fontSize:9,marginTop:4}}>Search → select creators → Save Cohort</div>
                </div>
              )}

              <div style={{display:"flex",flexDirection:"column",gap:14}}>
                {cohorts.map(cohort=>(
                  <div key={cohort.id} style={{border:"1px solid #1E293B",borderRadius:4,overflow:"hidden"}}>
                    <div style={{background:"#0A0D16",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1E293B"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <span style={{fontSize:13,color:"#A855F7"}}>◉</span>
                        <div>
                          <div style={{fontSize:13,fontWeight:600,color:"#E2E8F0"}}>{cohort.name}</div>
                          <div style={{fontSize:9,color:"#334155",marginTop:2}}>
                            {cohort.kols.length} KOLs · keyword: "{cohort.keyword}" · {cohort.createdAt}
                          </div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:7}}>
                        <button onClick={()=>setActiveCohort(activeCohort===cohort.id?null:cohort.id)}
                          style={{background:"none",border:"1px solid #1E293B",borderRadius:3,padding:"5px 12px",fontSize:10,color:"#64748B",cursor:"pointer",letterSpacing:"0.08em"}}>
                          {activeCohort===cohort.id?"COLLAPSE":"EXPAND"}
                        </button>
                        <button className="eb" onClick={()=>doExport(cohort.kols, cohort.name)}
                          style={{background:"#22D3A0",border:"none",borderRadius:3,padding:"5px 12px",fontSize:10,fontWeight:700,color:"#07090F",cursor:"pointer",letterSpacing:"0.08em",transition:"opacity 0.15s"}}>
                          ↓ EXPORT CSV
                        </button>
                        <button onClick={()=>setCohorts(c=>c.filter(g=>g.id!==cohort.id))}
                          style={{background:"none",border:"1px solid #EF444420",borderRadius:3,padding:"5px 9px",fontSize:10,color:"#EF4444",cursor:"pointer"}}>✕</button>
                      </div>
                    </div>

                    {/* Stats strip */}
                    <div style={{padding:"9px 18px",background:"#08090F",display:"flex",gap:22,borderBottom:"1px solid #0F1420",flexWrap:"wrap"}}>
                      {[
                        {l:"AVG SUBS", v:fmt(Math.round(cohort.kols.reduce((a,k)=>a+k.subscribers,0)/cohort.kols.length))},
                        {l:"TOTAL VIEWS", v:fmt(cohort.kols.reduce((a,k)=>a+k.views,0))},
                        {l:"AVG ENG%", v:(cohort.kols.reduce((a,k)=>a+k.engagementRate,0)/cohort.kols.length).toFixed(1)+"%"},
                        {l:"COUNTRIES", v:[...new Set(cohort.kols.map(k=>k.country).filter(c=>c!=="N/A"))].join(", ")||"N/A"},
                      ].map(s=>(
                        <div key={s.l}>
                          <div style={{fontSize:8,color:"#334155",letterSpacing:"0.12em"}}>{s.l}</div>
                          <div style={{fontSize:12,color:"#94A3B8",marginTop:1}}>{s.v}</div>
                        </div>
                      ))}
                    </div>

                    {activeCohort===cohort.id && (
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"2fr 80px 80px 1fr 30px",
                          padding:"7px 18px",background:"#0A0D16",fontSize:9,color:"#334155",letterSpacing:"0.12em",gap:8}}>
                          <div>CREATOR</div><div>SUBS</div><div>ENG%</div><div>NOTES</div><div/>
                        </div>
                        {cohort.kols.map(k=>(
                          <div key={k.id} className="row" style={{
                            display:"grid",gridTemplateColumns:"2fr 80px 80px 1fr 30px",
                            padding:"9px 18px",borderBottom:"1px solid #0F1420",gap:8,alignItems:"center",background:"#07090F"}}>
                            <div style={{display:"flex",alignItems:"center",gap:9}}>
                              {k.avatar
                                ? <img src={k.avatar} alt="" style={{width:26,height:26,borderRadius:"50%",flexShrink:0,objectFit:"cover"}}/>
                                : <div style={{width:26,height:26,borderRadius:"50%",background:ac(k.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#07090F",flexShrink:0}}>{initials(k.name)}</div>
                              }
                              <div>
                                <div style={{fontSize:11,color:"#E2E8F0"}}>{k.name}</div>
                                <div style={{fontSize:9,color:"#334155"}}>{k.handle}</div>
                              </div>
                            </div>
                            <div style={{fontSize:11,color:"#94A3B8"}}>{fmt(k.subscribers)}</div>
                            <div style={{fontSize:11,color:k.engagementRate>=5?"#22D3A0":"#F59E0B"}}>{k.engagementRate}%</div>
                            <input placeholder="Add note..." value={cohort.notes?.[k.id]||""}
                              onChange={e=>{const v=e.target.value; setCohorts(c=>c.map(g=>g.id===cohort.id?{...g,notes:{...g.notes,[k.id]:v}}:g));}}
                              style={{...inp,padding:"5px 8px"}}/>
                            <button onClick={()=>removeFromCohort(cohort.id,k.id)}
                              style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:12,padding:2}}>✕</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
