import { useState, useMemo, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:3001";

const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "ja", label: "Japanese" },
  { code: "ko", label: "Korean" },
  { code: "zh", label: "Chinese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "id", label: "Indonesian" },
  { code: "th", label: "Thai" },
  { code: "ru", label: "Russian" },
  { code: "tr", label: "Turkish" },
  { code: "it", label: "Italian" },
];

const fmt = (n) => n >= 1e9 ? (n/1e9).toFixed(1)+"B" : n >= 1e6 ? (n/1e6).toFixed(1)+"M" : n >= 1e3 ? (n/1e3).toFixed(0)+"K" : String(n||0);
const COLORS = ["#FF6B35","#00E5FF","#A855F7","#22D3A0","#F59E0B","#6366F1","#EC4899","#10B981","#F97316","#8B5CF6"];
const ac = (name) => COLORS[(name||"?").charCodeAt(0) % COLORS.length];
const initials = (name) => name?.split(" ").map(w=>w[0]).join("").slice(0,2).toUpperCase() || "??";

// Activity status helper
const activityStatus = (daysSince, avgDays) => {
  if (daysSince == null) return { label: "Unknown", color: "#334155", bg: "#0F172A", dot: "#334155" };
  if (daysSince > 365) return { label: "Dead", color: "#EF4444", bg: "#2D0A0A", dot: "#EF4444" };
  if (daysSince > 90)  return { label: `${Math.round(daysSince/30)}mo ago`, color: "#F59E0B", bg: "#1C1009", dot: "#F59E0B" };
  if (daysSince > 30)  return { label: `${Math.round(daysSince/7)}wk ago`, color: "#F59E0B", bg: "#1C1009", dot: "#F59E0B" };
  if (daysSince > 7)   return { label: `${daysSince}d ago`, color: "#22D3A0", bg: "#052E16", dot: "#22D3A0" };
  return { label: daysSince === 0 ? "Today" : `${daysSince}d ago`, color: "#22D3A0", bg: "#052E16", dot: "#22D3A0" };
};

const freqLabel = (avgDays) => {
  if (!avgDays) return null;
  if (avgDays <= 1)  return "Daily";
  if (avgDays <= 3)  return "2-3x/wk";
  if (avgDays <= 7)  return "Weekly";
  if (avgDays <= 14) return "Biweekly";
  if (avgDays <= 31) return "Monthly";
  return "Rarely";
};

export default function App() {
  const [view, setView] = useState("search");
  const [keyword, setKeyword] = useState("");
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState([]);
  const [nextPageToken, setNextPageToken] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ minSubs:"", maxSubs:"", language:"", engMin:"", hideDead: true });
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
      const params = new URLSearchParams({ keyword, maxResults: 100 });
      if (pageToken) params.append("pageToken", pageToken);
      if (filters.language) params.append("language", filters.language);
      const res = await fetch(`${API}/api/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");
      if (pageToken) setResults(prev => [...prev, ...data.channels]);
      else { setResults(data.channels || []); setSearched(true); }
      setNextPageToken(data.nextPageToken || null);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); setLoadingMore(false); }
  }, [keyword, filters.language]);

  const filtered = useMemo(() => {
    return results.filter(k => {
      if (filters.minSubs && k.subscribers < Number(filters.minSubs) * 1000) return false;
      if (filters.maxSubs && k.subscribers > Number(filters.maxSubs) * 1000) return false;
      if (filters.engMin && k.engagementRate < Number(filters.engMin)) return false;
      if (filters.hideDead && k.daysSincePost != null && k.daysSincePost > 180) return false;
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
    const h = ["Name","Handle","Language","Subscribers","Total Views","Videos","Engagement %","YouTube URL"];
    const rows = kols.map(k => [k.name, k.handle, k.language, k.subscribers, k.views, k.videos, k.engagementRate+"%", k.youtubeUrl]);
    const csv = [h,...rows].map(r => r.map(v=>`"${v||""}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download = filename+".csv"; a.click();
    showToast(`Exported "${filename}.csv"`);
  };

  const removeFromCohort = (cId, kId) =>
    setCohorts(c => c.map(g => g.id===cId ? {...g, kols: g.kols.filter(k=>k.id!==kId)} : g));

  return (
    <div style={{background:"#0C0F1A",minHeight:"100vh",fontFamily:"'Inter',system-ui,sans-serif",color:"#C8D0E0"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
        * { box-sizing:border-box; }
        input,select,button { font-family:'Inter',system-ui,sans-serif; }
        ::-webkit-scrollbar { width:5px; }
        ::-webkit-scrollbar-thumb { background:#1E2A3A; border-radius:4px; }
        .row:hover { background:#131929 !important; }
        .nb:hover { background:#131929 !important; }
        .eb:hover { filter:brightness(1.1); }
        .chip:hover { border-color:#38BDF8 !important; color:#38BDF8 !important; }
        a { color:inherit; text-decoration:none; }
      `}</style>

      {toast && (
        <div style={{position:"fixed",bottom:28,right:28,zIndex:9999,padding:"13px 20px",borderRadius:8,
          background:toast.type==="error"?"#2D0A0A":"#0A2218",
          border:`1px solid ${toast.type==="error"?"#EF4444":"#22C55E"}`,
          color:toast.type==="error"?"#FCA5A5":"#86EFAC",fontSize:13,
          boxShadow:"0 8px 32px rgba(0,0,0,.5)"}}>
          {toast.type==="error"?"✕  ":"✓  "}{toast.msg}
        </div>
      )}

      <div style={{display:"flex",height:"100vh",overflow:"hidden"}}>

        {/* Sidebar */}
        <div style={{width:220,background:"#080B14",borderRight:"1px solid #1A2235",display:"flex",flexDirection:"column",flexShrink:0}}>
          <div style={{padding:"24px 20px 20px",borderBottom:"1px solid #1A2235"}}>
            <div style={{fontSize:17,fontWeight:700,color:"#F1F5F9",letterSpacing:"-0.3px",display:"flex",alignItems:"center",gap:8}}>
              <span style={{color:"#38BDF8",fontSize:20}}>◈</span> KOL Source
            </div>
            <div style={{fontSize:11,color:"#334155",marginTop:4}}>YouTube Creator Search</div>
          </div>
          <div style={{padding:"10px 0"}}>
            {[
              {id:"search",icon:"🔍",label:"Search"},
              {id:"cohorts",icon:"📁",label:`Cohorts${cohorts.length>0?`  (${cohorts.length})`:""}`},
            ].map(n=>(
              <button key={n.id} className="nb" onClick={()=>setView(n.id)} style={{
                background:view===n.id?"#0F1929":"none",border:"none",cursor:"pointer",
                padding:"12px 20px",display:"flex",alignItems:"center",gap:12,width:"100%",textAlign:"left",
                borderLeft:view===n.id?"3px solid #38BDF8":"3px solid transparent",transition:"all 0.15s"}}>
                <span style={{fontSize:16}}>{n.icon}</span>
                <span style={{fontSize:14,fontWeight:view===n.id?600:400,color:view===n.id?"#F1F5F9":"#64748B"}}>{n.label}</span>
              </button>
            ))}
          </div>
          <div style={{flex:1}}/>
          <div style={{padding:"16px 20px",borderTop:"1px solid #1A2235"}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <div style={{width:7,height:7,borderRadius:"50%",background:"#22C55E",boxShadow:"0 0 6px #22C55E"}}/>
              <span style={{fontSize:12,color:"#475569"}}>Live · YouTube API</span>
            </div>
            <div style={{fontSize:11,color:"#1E293B",marginTop:4}}>~99 free searches/day</div>
          </div>
        </div>

        <div style={{flex:1,overflow:"auto",background:"#0C0F1A"}}>

          {/* SEARCH */}
          {view==="search" && (
            <div style={{padding:"32px 36px",maxWidth:1100}}>
              <div style={{marginBottom:28}}>
                <h1 style={{fontSize:22,fontWeight:700,color:"#F1F5F9",margin:"0 0 6px",letterSpacing:"-0.3px"}}>Find YouTube Creators</h1>
                <p style={{fontSize:13,color:"#64748B",margin:0}}>Search by keyword · filter by language, subscribers & engagement</p>
              </div>

              {/* Search bar */}
              <div style={{display:"flex",gap:10,marginBottom:18}}>
                <input value={keyword} onChange={e=>setKeyword(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&doSearch()}
                  placeholder='e.g. "fitness" · "crypto" · "cooking" · "beauty"'
                  style={{flex:1,background:"#111827",border:"1px solid #1E2A3A",borderRadius:8,
                    padding:"13px 18px",color:"#F1F5F9",fontSize:14,outline:"none"}}/>
                <button onClick={()=>doSearch()} style={{
                  background:"#38BDF8",color:"#0A0F1A",border:"none",borderRadius:8,
                  padding:"13px 28px",fontSize:13,fontWeight:700,cursor:"pointer",minWidth:110}}>
                  {loading?"Searching...":"Search"}
                </button>
              </div>

              {error && (
                <div style={{background:"#2D0A0A",border:"1px solid #EF4444",borderRadius:8,
                  padding:"12px 16px",marginBottom:16,fontSize:13,color:"#FCA5A5"}}>✕  {error}</div>
              )}

              {/* Filters */}
              <div style={{background:"#080B14",border:"1px solid #1A2235",borderRadius:10,padding:"18px 20px",marginBottom:20}}>
                <div style={{fontSize:11,fontWeight:600,color:"#475569",letterSpacing:"0.08em",textTransform:"uppercase",marginBottom:14}}>Filters</div>
                <div style={{display:"grid",gridTemplateColumns:"2fr 1fr 1fr 1fr",gap:12}}>
                  <div>
                    <label style={{fontSize:12,color:"#64748B",display:"block",marginBottom:6,fontWeight:500}}>Language</label>
                    <select value={filters.language} onChange={e=>setFilters(p=>({...p,language:e.target.value}))}
                      style={{width:"100%",background:"#0C0F1A",border:"1px solid #1E2A3A",borderRadius:6,
                        padding:"9px 12px",color:filters.language?"#F1F5F9":"#64748B",fontSize:13,outline:"none"}}>
                      <option value="">Any language</option>
                      {LANGUAGES.map(l=><option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12,color:"#64748B",display:"block",marginBottom:6,fontWeight:500}}>Min Subs (K)</label>
                    <input type="number" value={filters.minSubs} onChange={e=>setFilters(p=>({...p,minSubs:e.target.value}))}
                      placeholder="e.g. 10"
                      style={{width:"100%",background:"#0C0F1A",border:"1px solid #1E2A3A",borderRadius:6,
                        padding:"9px 12px",color:"#F1F5F9",fontSize:13,outline:"none"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,color:"#64748B",display:"block",marginBottom:6,fontWeight:500}}>Max Subs (K)</label>
                    <input type="number" value={filters.maxSubs} onChange={e=>setFilters(p=>({...p,maxSubs:e.target.value}))}
                      placeholder="e.g. 5000"
                      style={{width:"100%",background:"#0C0F1A",border:"1px solid #1E2A3A",borderRadius:6,
                        padding:"9px 12px",color:"#F1F5F9",fontSize:13,outline:"none"}}/>
                  </div>
                  <div>
                    <label style={{fontSize:12,color:"#64748B",display:"block",marginBottom:6,fontWeight:500}}>Min Eng %</label>
                    <input type="number" value={filters.engMin} onChange={e=>setFilters(p=>({...p,engMin:e.target.value}))}
                      placeholder="e.g. 3"
                      style={{width:"100%",background:"#0C0F1A",border:"1px solid #1E2A3A",borderRadius:6,
                        padding:"9px 12px",color:"#F1F5F9",fontSize:13,outline:"none"}}/>
                  </div>
                </div>
                <div style={{marginTop:14,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <label style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer"}}>
                    <div onClick={()=>setFilters(p=>({...p,hideDead:!p.hideDead}))}
                      style={{width:32,height:18,borderRadius:9,background:filters.hideDead?"#22D3A0":"#1E2A3A",
                        position:"relative",transition:"background 0.2s",cursor:"pointer",flexShrink:0}}>
                      <div style={{width:14,height:14,borderRadius:"50%",background:"#fff",
                        position:"absolute",top:2,left:filters.hideDead?16:2,transition:"left 0.2s"}}/>
                    </div>
                    <span style={{fontSize:12,color:filters.hideDead?"#22D3A0":"#475569",fontWeight:500}}>
                      Hide inactive accounts (6+ months)
                    </span>
                  </label>
                  <button onClick={()=>setFilters({minSubs:"",maxSubs:"",language:"",engMin:"",hideDead:true})}
                    style={{background:"none",border:"none",cursor:"pointer",fontSize:12,color:"#334155",padding:0}}>
                    ✕  Clear all filters
                  </button>
                </div>
              </div>

              {/* Toolbar */}
              {searched && !loading && (
                <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:14,flexWrap:"wrap",gap:10}}>
                  <div style={{display:"flex",alignItems:"center",gap:12}}>
                    <span style={{fontSize:14,color:"#94A3B8"}}>
                      <span style={{color:"#38BDF8",fontWeight:700,fontSize:16}}>{filtered.length}</span>
                      <span style={{marginLeft:5}}>creators found</span>
                      {selected.length>0 && <span style={{color:"#F59E0B",marginLeft:12}}>· {selected.length} selected</span>}
                    </span>
                    {filtered.length>0 && (
                      <div style={{display:"flex",gap:6}}>
                        <button onClick={()=>setSelected(filtered.map(k=>k.id))}
                          style={{background:"none",border:"1px solid #1E2A3A",borderRadius:5,
                            padding:"4px 10px",fontSize:11,color:"#64748B",cursor:"pointer",fontWeight:500}}>
                          Select all
                        </button>
                        {selected.length>0 && (
                          <button onClick={()=>setSelected([])}
                            style={{background:"none",border:"1px solid #1E2A3A",borderRadius:5,
                              padding:"4px 10px",fontSize:11,color:"#475569",cursor:"pointer"}}>Clear</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div style={{display:"flex",alignItems:"center",gap:8}}>
                    {filtered.length>0 && (
                      <button className="eb" onClick={()=>doExport(filtered,keyword?`search-${keyword}`:"results")}
                        style={{background:"#22D3A0",color:"#051A12",border:"none",borderRadius:6,
                          padding:"8px 16px",fontSize:12,fontWeight:700,cursor:"pointer"}}>
                        ↓ Export ({filtered.length})
                      </button>
                    )}
                    <div style={{display:"flex",alignItems:"center",gap:4,background:"#080B14",border:"1px solid #1A2235",borderRadius:6,padding:"4px 6px"}}>
                      <span style={{fontSize:11,color:"#475569",paddingLeft:4}}>Sort:</span>
                      {[["subscribers","Subs"],["views","Views"],["engagementRate","Eng%"]].map(([s,l])=>(
                        <button key={s} className="chip" onClick={()=>setSortBy(s)} style={{
                          background:sortBy===s?"#0F1929":"none",
                          border:`1px solid ${sortBy===s?"#38BDF8":"transparent"}`,
                          color:sortBy===s?"#38BDF8":"#475569",fontSize:11,padding:"4px 9px",borderRadius:5,
                          cursor:"pointer",fontWeight:sortBy===s?600:400,transition:"all 0.15s"}}>
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Save cohort bar */}
              {selected.length>0 && (
                <div style={{background:"#0D1117",border:"1px solid #F59E0B40",borderRadius:8,
                  padding:"12px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
                  <span style={{fontSize:13,color:"#F59E0B",flexShrink:0,fontWeight:600}}>{selected.length} selected</span>
                  <input value={cohortName} onChange={e=>setCohortName(e.target.value)}
                    placeholder="Name this cohort..."
                    style={{flex:1,background:"#080B14",border:"1px solid #F59E0B40",borderRadius:6,
                      padding:"9px 14px",color:"#F1F5F9",fontSize:13,outline:"none"}}/>
                  <button onClick={saveCohort}
                    style={{background:"#F59E0B",color:"#0A0700",border:"none",borderRadius:6,
                      padding:"9px 20px",fontSize:12,fontWeight:700,cursor:"pointer",flexShrink:0}}>
                    Save Cohort
                  </button>
                </div>
              )}

              {loading && <div style={{textAlign:"center",padding:80,color:"#334155",fontSize:14}}>Searching YouTube...</div>}
              {!loading && searched && filtered.length===0 && (
                <div style={{textAlign:"center",padding:80,color:"#334155",fontSize:14}}>No results — try a different keyword or adjust filters</div>
              )}

              {/* Results table */}
              {!loading && filtered.length>0 && (
                <>
                  <div style={{border:"1px solid #1A2235",borderRadius:10,overflow:"hidden"}}>
                    <div style={{display:"grid",gridTemplateColumns:"44px 2.5fr 90px 110px 85px 55px 120px 60px",
                      padding:"11px 20px",background:"#080B14",borderBottom:"1px solid #1A2235",
                      fontSize:11,fontWeight:600,color:"#475569",letterSpacing:"0.05em",textTransform:"uppercase",gap:8,alignItems:"center"}}>
                      <div/><div>Creator</div><div>Subscribers</div><div>Total Views</div><div>Engagement</div><div>Videos</div><div>Activity</div><div>Link</div>
                    </div>
                    {filtered.map(k=>(
                      <div key={k.id} className="row" onClick={()=>toggle(k.id)} style={{
                        display:"grid",gridTemplateColumns:"44px 2.5fr 90px 110px 85px 55px 120px 60px",
                        padding:"13px 20px",borderBottom:"1px solid #0F1520",cursor:"pointer",gap:8,
                        background:selected.includes(k.id)?"#0D1829":"#0C0F1A",
                        borderLeft:selected.includes(k.id)?"3px solid #38BDF8":"3px solid transparent",
                        transition:"background 0.1s",alignItems:"center"}}>
                        <div style={{width:18,height:18,borderRadius:4,
                          border:`2px solid ${selected.includes(k.id)?"#38BDF8":"#1E2A3A"}`,
                          background:selected.includes(k.id)?"#38BDF8":"none",
                          display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,color:"#0A0F1A",flexShrink:0}}>
                          {selected.includes(k.id)&&"✓"}
                        </div>
                        <div style={{display:"flex",alignItems:"center",gap:12,minWidth:0}}>
                          {k.avatar
                            ? <img src={k.avatar} alt="" style={{width:38,height:38,borderRadius:"50%",flexShrink:0,objectFit:"cover",border:"2px solid #1A2235"}}/>
                            : <div style={{width:38,height:38,borderRadius:"50%",background:ac(k.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(k.name)}</div>
                          }
                          <div style={{minWidth:0}}>
                            <div style={{fontSize:14,color:"#F1F5F9",fontWeight:600,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",display:"flex",alignItems:"center",gap:6}}>
                              {k.name}
                              {k.verified && <span style={{fontSize:11,color:"#38BDF8"}}>✓</span>}
                            </div>
                            <div style={{fontSize:12,color:"#475569",marginTop:1,display:"flex",alignItems:"center",gap:8}}>
                              <span>{k.handle}</span>
                              {k.language && k.language!=="N/A" && (
                                <span style={{background:"#0F1929",border:"1px solid #1E2A3A",borderRadius:4,padding:"1px 6px",fontSize:10,color:"#64748B"}}>
                                  {LANGUAGES.find(l=>l.code===k.language)?.label || k.language}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div style={{fontSize:14,color:"#E2E8F0",fontWeight:600}}>{fmt(k.subscribers)}</div>
                        <div style={{fontSize:13,color:"#94A3B8"}}>{fmt(k.views)}</div>
                        <div style={{fontSize:13,fontWeight:600,
                          color:k.engagementRate>=5?"#22D3A0":k.engagementRate>=3?"#F59E0B":"#94A3B8"}}>
                          {k.engagementRate}%
                        </div>
                        <div style={{fontSize:13,color:"#64748B"}}>{fmt(k.videos)}</div>
                        {(() => {
                          const s = activityStatus(k.daysSincePost, k.avgDaysBetweenPosts);
                          const freq = freqLabel(k.avgDaysBetweenPosts);
                          return (
                            <div style={{display:"flex",flexDirection:"column",gap:3}}>
                              <div style={{display:"flex",alignItems:"center",gap:5}}>
                                <div style={{width:6,height:6,borderRadius:"50%",background:s.dot,flexShrink:0}}/>
                                <span style={{fontSize:11,color:s.color,fontWeight:600,whiteSpace:"nowrap"}}>{s.label}</span>
                              </div>
                              {freq && <span style={{fontSize:10,color:"#334155",whiteSpace:"nowrap"}}>{freq}</span>}
                            </div>
                          );
                        })()}
                        <a href={k.youtubeUrl} target="_blank" rel="noreferrer"
                          onClick={e=>e.stopPropagation()}
                          style={{fontSize:11,color:"#64748B",border:"1px solid #1E2A3A",
                            borderRadius:5,padding:"4px 10px",display:"inline-block",textAlign:"center"}}>
                          View ↗
                        </a>
                      </div>
                    ))}
                  </div>
                  {nextPageToken && (
                    <div style={{textAlign:"center",marginTop:18}}>
                      <button onClick={()=>doSearch(nextPageToken)} disabled={loadingMore}
                        style={{background:"none",border:"1px solid #1E2A3A",borderRadius:7,
                          padding:"11px 28px",fontSize:13,color:"#64748B",cursor:"pointer",fontWeight:500}}>
                        {loadingMore?"Loading...":"Load more results"}
                      </button>
                    </div>
                  )}
                </>
              )}

              {!searched && (
                <div style={{textAlign:"center",padding:"80px 20px"}}>
                  <div style={{fontSize:48,marginBottom:16}}>🔍</div>
                  <div style={{fontSize:16,color:"#334155",fontWeight:600,marginBottom:8}}>Search for YouTube creators</div>
                  <div style={{fontSize:13,color:"#1E293B"}}>Enter any keyword — niche, topic, or content type</div>
                </div>
              )}
            </div>
          )}

          {/* COHORTS */}
          {view==="cohorts" && (
            <div style={{padding:"32px 36px",maxWidth:1100}}>
              <div style={{marginBottom:28}}>
                <h1 style={{fontSize:22,fontWeight:700,color:"#F1F5F9",margin:"0 0 6px",letterSpacing:"-0.3px"}}>Cohort Manager</h1>
                <p style={{fontSize:13,color:"#64748B",margin:0}}>View, edit and export your saved creator groups</p>
              </div>
              {cohorts.length===0 && (
                <div style={{textAlign:"center",padding:"80px 20px"}}>
                  <div style={{fontSize:48,marginBottom:16}}>📁</div>
                  <div style={{fontSize:16,color:"#334155",fontWeight:600,marginBottom:8}}>No cohorts yet</div>
                  <div style={{fontSize:13,color:"#1E293B"}}>Search → select creators → Save Cohort</div>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {cohorts.map(cohort=>(
                  <div key={cohort.id} style={{border:"1px solid #1A2235",borderRadius:10,overflow:"hidden"}}>
                    <div style={{background:"#080B14",padding:"16px 22px",display:"flex",alignItems:"center",justifyContent:"space-between",borderBottom:"1px solid #1A2235"}}>
                      <div style={{display:"flex",alignItems:"center",gap:12}}>
                        <span style={{fontSize:22}}>📁</span>
                        <div>
                          <div style={{fontSize:15,fontWeight:700,color:"#F1F5F9"}}>{cohort.name}</div>
                          <div style={{fontSize:12,color:"#475569",marginTop:2}}>{cohort.kols.length} creators · "{cohort.keyword}" · {cohort.createdAt}</div>
                        </div>
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>setActiveCohort(activeCohort===cohort.id?null:cohort.id)}
                          style={{background:"none",border:"1px solid #1E2A3A",borderRadius:7,padding:"7px 16px",fontSize:12,color:"#64748B",cursor:"pointer",fontWeight:500}}>
                          {activeCohort===cohort.id?"Collapse":"Expand"}
                        </button>
                        <button className="eb" onClick={()=>doExport(cohort.kols,cohort.name)}
                          style={{background:"#22D3A0",border:"none",borderRadius:7,padding:"7px 16px",fontSize:12,fontWeight:700,color:"#051A12",cursor:"pointer"}}>
                          ↓ Export CSV
                        </button>
                        <button onClick={()=>setCohorts(c=>c.filter(g=>g.id!==cohort.id))}
                          style={{background:"none",border:"1px solid #EF444430",borderRadius:7,padding:"7px 12px",fontSize:13,color:"#EF4444",cursor:"pointer"}}>✕</button>
                      </div>
                    </div>
                    <div style={{padding:"12px 22px",background:"#090C15",display:"flex",gap:28,borderBottom:"1px solid #0F1520",flexWrap:"wrap"}}>
                      {[
                        {l:"Avg Subscribers",v:fmt(Math.round(cohort.kols.reduce((a,k)=>a+k.subscribers,0)/cohort.kols.length))},
                        {l:"Total Views",v:fmt(cohort.kols.reduce((a,k)=>a+k.views,0))},
                        {l:"Avg Engagement",v:(cohort.kols.reduce((a,k)=>a+k.engagementRate,0)/cohort.kols.length).toFixed(1)+"%"},
                        {l:"Creators",v:cohort.kols.length},
                      ].map(s=>(
                        <div key={s.l}>
                          <div style={{fontSize:11,color:"#334155",fontWeight:500,marginBottom:3}}>{s.l}</div>
                          <div style={{fontSize:16,color:"#E2E8F0",fontWeight:700}}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    {activeCohort===cohort.id && (
                      <div>
                        <div style={{display:"grid",gridTemplateColumns:"2.5fr 100px 90px 1fr 36px",
                          padding:"10px 22px",background:"#080B14",fontSize:11,fontWeight:600,color:"#475569",letterSpacing:"0.05em",textTransform:"uppercase",gap:12}}>
                          <div>Creator</div><div>Subscribers</div><div>Engagement</div><div>Notes</div><div/>
                        </div>
                        {cohort.kols.map(k=>(
                          <div key={k.id} style={{display:"grid",gridTemplateColumns:"2.5fr 100px 90px 1fr 36px",
                            padding:"12px 22px",borderBottom:"1px solid #0F1520",gap:12,alignItems:"center",background:"#0C0F1A"}}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              {k.avatar
                                ? <img src={k.avatar} alt="" style={{width:32,height:32,borderRadius:"50%",flexShrink:0,objectFit:"cover"}}/>
                                : <div style={{width:32,height:32,borderRadius:"50%",background:ac(k.name),display:"flex",alignItems:"center",justifyContent:"center",fontSize:10,fontWeight:700,color:"#fff",flexShrink:0}}>{initials(k.name)}</div>
                              }
                              <div>
                                <div style={{fontSize:13,color:"#E2E8F0",fontWeight:600}}>{k.name}</div>
                                <div style={{fontSize:11,color:"#475569"}}>{k.handle}</div>
                              </div>
                            </div>
                            <div style={{fontSize:13,color:"#E2E8F0",fontWeight:600}}>{fmt(k.subscribers)}</div>
                            <div style={{fontSize:13,fontWeight:600,color:k.engagementRate>=5?"#22D3A0":k.engagementRate>=3?"#F59E0B":"#94A3B8"}}>{k.engagementRate}%</div>
                            <input placeholder="Add a note..." value={cohort.notes?.[k.id]||""}
                              onChange={e=>{const v=e.target.value;setCohorts(c=>c.map(g=>g.id===cohort.id?{...g,notes:{...g.notes,[k.id]:v}}:g));}}
                              style={{background:"#080B14",border:"1px solid #1A2235",borderRadius:6,padding:"7px 12px",color:"#E2E8F0",fontSize:12,outline:"none",width:"100%"}}/>
                            <button onClick={()=>removeFromCohort(cohort.id,k.id)}
                              style={{background:"none",border:"none",color:"#334155",cursor:"pointer",fontSize:14,padding:4}}>✕</button>
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