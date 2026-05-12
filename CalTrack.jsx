import { useState, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  ReferenceLine, Cell, LineChart, Line
} from "recharts";

/* ─────────────── CONSTANTS ─────────────── */
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS_SHORT = ["Su","Mo","Tu","We","Th","Fr","Sa"];

/* ─────────────── HELPERS ─────────────── */
const dateKey = d => {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
};
const todayKey = () => dateKey(new Date());
const parseDate = str => new Date(str + 'T12:00:00');

function calcTDEE({ weight, height, age, sex = 'male', activity = 1.375 }) {
  const bmr = sex === 'male'
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161;
  return Math.round(bmr * activity);
}

function getTimeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}

function activityLabel(val) {
  const map = { 1.2: 'Sedentary', 1.375: 'Light', 1.55: 'Moderate', 1.725: 'Very Active' };
  return map[val] || 'Moderate';
}

/* ─────────────── STORAGE ─────────────── */
const store = {
  async get(key) {
    try {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    } catch { return null; }
  },
  async set(key, val) {
    try { await window.storage.set(key, JSON.stringify(val)); }
    catch (e) { console.error('storage:', e); }
  }
};

/* ─────────────── CLAUDE API ─────────────── */
async function fetchCalories(name, isWorkout = false) {
  const prompt = isWorkout
    ? `Calories burned for: "${name}" (average adult, 30 min unless stated). Reply ONLY with JSON: {"calories":NUMBER,"note":"brief"}`
    : `Calories in: "${name}" (typical serving). Reply ONLY with JSON: {"calories":NUMBER,"note":"serving size"}`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 150,
      messages: [{ role: "user", content: prompt }]
    })
  });
  const data = await res.json();
  const text = data.content.map(c => c.text || "").join("").replace(/```json|```/g,"").trim();
  return JSON.parse(text);
}

/* ─────────────── DESIGN TOKENS ─────────────── */
const C = {
  bg:         '#08090d',
  surface:    '#0f1016',
  card:       '#16171f',
  cardHover:  '#1c1d28',
  border:     '#23243a',
  accent:     '#5bf5a0',
  accentDim:  'rgba(91,245,160,0.1)',
  orange:     '#ff8c42',
  orangeDim:  'rgba(255,140,66,0.12)',
  red:        '#ff5c5c',
  redDim:     'rgba(255,92,92,0.12)',
  blue:       '#5b9ef5',
  text:       '#eef0f8',
  muted:      '#8891a8',
  subtle:     '#3d4260',
};

const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Epilogue:wght@700;800;900&display=swap');
  *{box-sizing:border-box;margin:0;padding:0;}
  body,html{background:${C.bg};font-family:'Space Grotesk',sans-serif;color:${C.text};-webkit-font-smoothing:antialiased;}
  ::-webkit-scrollbar{width:3px;}
  ::-webkit-scrollbar-thumb{background:${C.border};border-radius:2px;}
  input,textarea{outline:none;background:${C.card};color:${C.text};border:1.5px solid ${C.border};
    border-radius:12px;padding:11px 14px;font-family:'Space Grotesk',sans-serif;font-size:14px;
    width:100%;transition:border-color 0.2s,box-shadow 0.2s;}
  input:focus,textarea:focus{border-color:${C.accent};box-shadow:0 0 0 3px ${C.accentDim};}
  input[type=number]::-webkit-inner-spin-button{opacity:0;}
  button{cursor:pointer;font-family:'Space Grotesk',sans-serif;}
  @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
  .fade-up{animation:fadeUp 0.3s ease forwards;}
`;

/* ─────────────── SHARED COMPONENTS ─────────────── */
function Btn({ children, onClick, variant = 'primary', style = {}, disabled = false, small = false }) {
  const base = {
    padding: small ? '7px 14px' : '11px 20px',
    borderRadius: 12, border: 'none',
    fontSize: small ? 13 : 14, fontWeight: 600,
    transition: 'all 0.15s', display: 'inline-flex',
    alignItems: 'center', justifyContent: 'center', gap: 6,
    opacity: disabled ? 0.45 : 1,
  };
  const variants = {
    primary:   { background: C.accent, color: '#060810' },
    secondary: { background: C.card, color: C.text, border: `1.5px solid ${C.border}` },
    ghost:     { background: 'transparent', color: C.muted },
    danger:    { background: C.redDim, color: C.red, border: `1.5px solid ${C.red}44` },
    orange:    { background: C.orangeDim, color: C.orange, border: `1.5px solid ${C.orange}44` },
  };
  return (
    <button onClick={onClick} disabled={disabled} style={{ ...base, ...variants[variant], ...style }}>
      {children}
    </button>
  );
}

function Card({ children, style = {} }) {
  return (
    <div style={{ background: C.card, borderRadius: 16, border: `1.5px solid ${C.border}`, ...style }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontFamily: 'Epilogue', fontWeight: 800, fontSize: 15, letterSpacing: '0.05em',
      textTransform: 'uppercase', color: C.muted, marginBottom: 12 }}>
      {children}
    </div>
  );
}

function BottomNav({ active, onNav }) {
  const tabs = [
    { id: 'calendar', icon: '▦', label: 'Calendar' },
    { id: 'analytics', icon: '◈', label: 'Stats' },
    { id: 'profile',  icon: '◉', label: 'Profile' },
  ];
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 430, background: C.surface,
      borderTop: `1.5px solid ${C.border}`, display: 'flex',
      padding: '10px 0 18px', zIndex: 100,
    }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onNav(t.id)} style={{
          flex: 1, background: 'none', border: 'none', padding: '6px 0',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
          color: active === t.id ? C.accent : C.subtle, transition: 'color 0.2s',
        }}>
          <span style={{ fontSize: 22, lineHeight: 1 }}>{t.icon}</span>
          <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t.label}
          </span>
        </button>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   MAIN APP
═══════════════════════════════════════════════════════ */
export default function App() {
  const [view, setView]               = useState('loading');
  const [profile, setProfile]         = useState(null);
  const [dayData, setDayData]         = useState({});
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [calMonth, setCalMonth]       = useState(new Date());

  useEffect(() => {
    (async () => {
      const [p, d] = await Promise.all([store.get('profile'), store.get('dayData')]);
      if (d) setDayData(d);
      if (p) { setProfile(p); setView('calendar'); }
      else setView('onboarding');
    })();
  }, []);

  const saveProfile = async (p) => {
    setProfile(p);
    await store.set('profile', p);
    setView('calendar');
  };

  const updateDay = async (dateStr, updater) => {
    setDayData(prev => {
      const next = {
        ...prev,
        [dateStr]: updater(prev[dateStr] || { meals: [], workouts: [], weight: null })
      };
      store.set('dayData', next);
      return next;
    });
  };

  const getDayStats = (dateStr) => {
    const d = dayData[dateStr] || { meals: [], workouts: [] };
    const consumed = (d.meals   || []).reduce((s, m) => s + (m.calories  || 0), 0);
    const burned   = (d.workouts|| []).reduce((s, w) => s + (w.calories  || 0), 0);
    const goal     = profile?.goalCalories || 2000;
    const net      = consumed - burned;
    const diff     = net - goal;
    return { consumed, burned, goal, net, diff, surplus: diff > 0 };
  };

  if (view === 'loading') return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background: C.bg }}>
      <style>{GLOBAL_CSS}</style>
      <div style={{ fontFamily:'Epilogue', fontSize:32, fontWeight:900, color:C.accent }}>CalTrack</div>
    </div>
  );

  return (
    <div style={{ maxWidth:430, margin:'0 auto', minHeight:'100vh', background:C.bg, position:'relative' }}>
      <style>{GLOBAL_CSS}</style>
      {view === 'onboarding' && <OnboardingScreen onComplete={saveProfile} />}
      {view === 'calendar'   && (
        <CalendarScreen
          profile={profile} dayData={dayData} calMonth={calMonth}
          setCalMonth={setCalMonth} getDayStats={getDayStats}
          onSelectDate={d => { setSelectedDate(d); setView('day'); }}
          onNav={setView}
        />
      )}
      {view === 'day' && (
        <DayScreen
          date={selectedDate}
          dayData={dayData[selectedDate] || { meals:[], workouts:[], weight:null }}
          profile={profile} getDayStats={getDayStats}
          updateDay={updateDay} onBack={() => setView('calendar')}
        />
      )}
      {view === 'analytics' && (
        <AnalyticsScreen dayData={dayData} profile={profile} getDayStats={getDayStats} onNav={setView} />
      )}
      {view === 'profile' && (
        <ProfileScreen profile={profile} dayData={dayData} onSave={saveProfile} onNav={setView} />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ONBOARDING
═══════════════════════════════════════════════════════ */
function OnboardingScreen({ onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    name:'', age:'', height:'', weight:'', sex:'male', activity:1.375, goalCalories:''
  });
  const set = (k, v) => setData(p => ({ ...p, [k]: v }));

  const tdee = data.age && data.height && data.weight
    ? calcTDEE({ ...data, weight:+data.weight, height:+data.height, age:+data.age })
    : null;

  const steps = [
    {
      emoji: '👋', title: "What's your name?",
      body: <input placeholder="Your name" value={data.name} onChange={e=>set('name',e.target.value)} autoFocus />,
      valid: data.name.trim().length > 0
    },
    {
      emoji: '📏', title: "About you",
      body: (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', gap:8 }}>
            {['male','female'].map(s => (
              <button key={s} onClick={() => set('sex', s)} style={{
                flex:1, padding:'12px', borderRadius:12,
                border:`2px solid ${data.sex===s ? C.accent : C.border}`,
                background: data.sex===s ? C.accentDim : C.card,
                color: data.sex===s ? C.accent : C.muted,
                fontWeight:600, fontSize:14, textTransform:'capitalize', transition:'all 0.2s'
              }}>{s}</button>
            ))}
          </div>
          <input type="number" placeholder="Age (years)" value={data.age} onChange={e=>set('age',e.target.value)} />
          <input type="number" placeholder="Height (cm)" value={data.height} onChange={e=>set('height',e.target.value)} />
          <input type="number" placeholder="Weight (kg)" value={data.weight} onChange={e=>set('weight',e.target.value)} />
        </div>
      ),
      valid: data.age && data.height && data.weight
    },
    {
      emoji: '🎯', title: "Activity & Goal",
      body: (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {[
            { label:'🛋️  Sedentary',    val:1.2,   sub:'Desk job, no exercise' },
            { label:'🚶  Light',          val:1.375, sub:'1–3 days/week' },
            { label:'🏃  Moderate',       val:1.55,  sub:'3–5 days/week' },
            { label:'💪  Very Active',    val:1.725, sub:'6–7 days/week' },
          ].map(a => (
            <button key={a.val} onClick={() => set('activity', a.val)} style={{
              padding:'13px 16px', borderRadius:12, textAlign:'left',
              border:`2px solid ${data.activity===a.val ? C.accent : C.border}`,
              background: data.activity===a.val ? C.accentDim : C.card,
              display:'flex', justifyContent:'space-between', alignItems:'center', transition:'all 0.2s'
            }}>
              <span style={{ fontWeight:600, color:C.text }}>{a.label}</span>
              <span style={{ fontSize:12, color:C.muted }}>{a.sub}</span>
            </button>
          ))}
          {tdee && (
            <Card style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:12, color:C.muted, marginBottom:3 }}>Your estimated daily need (TDEE)</div>
              <div style={{ fontFamily:'Epilogue', fontSize:28, fontWeight:900, color:C.accent }}>
                {tdee} <span style={{ fontSize:14, color:C.muted }}>kcal/day</span>
              </div>
            </Card>
          )}
          <div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:6 }}>Override calorie goal (optional)</div>
            <input type="number" placeholder={`Default: ${tdee || 2000} kcal`} value={data.goalCalories}
              onChange={e=>set('goalCalories',e.target.value)} />
          </div>
        </div>
      ),
      valid: true
    }
  ];

  const finish = () => {
    const t = tdee || 2000;
    onComplete({
      ...data, age:+data.age, height:+data.height, weight:+data.weight,
      goalCalories: data.goalCalories ? +data.goalCalories : t,
      startDate: todayKey()
    });
  };

  return (
    <div style={{ minHeight:'100vh', display:'flex', flexDirection:'column', padding:'60px 24px 40px' }}>
      <div style={{ fontFamily:'Epilogue', fontSize:32, fontWeight:900, color:C.accent, marginBottom:40 }}>
        CalTrack
      </div>
      <div style={{ display:'flex', gap:5, marginBottom:36 }}>
        {steps.map((_,i) => (
          <div key={i} style={{
            height:4, borderRadius:2, flex: i===step ? 2.5 : 1,
            background: i<=step ? C.accent : C.border, transition:'all 0.35s'
          }} />
        ))}
      </div>
      <div style={{ fontSize:32, marginBottom:8 }}>{steps[step].emoji}</div>
      <h2 style={{ fontFamily:'Epilogue', fontSize:26, fontWeight:800, marginBottom:24, lineHeight:1.25 }}>
        {steps[step].title}
      </h2>
      <div style={{ flex:1, overflow:'auto' }}>{steps[step].body}</div>
      <div style={{ marginTop:28, display:'flex', gap:10 }}>
        {step > 0 && (
          <Btn variant="secondary" onClick={() => setStep(s=>s-1)}>← Back</Btn>
        )}
        <Btn onClick={step < steps.length-1 ? ()=>setStep(s=>s+1) : finish}
          disabled={!steps[step].valid} style={{ flex:1 }}>
          {step === steps.length-1 ? "Let's go 🚀" : "Continue →"}
        </Btn>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   CALENDAR SCREEN
═══════════════════════════════════════════════════════ */
function CalendarScreen({ profile, dayData, calMonth, setCalMonth, getDayStats, onSelectDate, onNav }) {
  const year  = calMonth.getFullYear();
  const month = calMonth.getMonth();

  const firstDay     = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month+1, 0).getDate();
  const cells = [];
  for (let i=0; i<firstDay; i++) cells.push(null);
  for (let d=1; d<=daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const todayStr = todayKey();

  const getDotColor = d => {
    if (!d) return null;
    const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const day = dayData[key];
    if (!day || (!day.meals?.length && !day.workouts?.length)) return null;
    return getDayStats(key).surplus ? C.red : C.accent;
  };

  // Streak
  const streak = (() => {
    let count=0, d=new Date();
    while (true) {
      const k = dateKey(d);
      if (!dayData[k]?.meals?.length) break;
      count++; d.setDate(d.getDate()-1);
    }
    return count;
  })();

  const todayStats = getDayStats(todayStr);
  const netColor = todayStats.consumed===0 ? C.muted : todayStats.surplus ? C.red : C.accent;

  return (
    <div style={{ paddingBottom:90 }}>
      {/* Header */}
      <div style={{ padding:'52px 20px 20px', background:C.surface, borderBottom:`1.5px solid ${C.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:13, color:C.muted }}>Good {getTimeOfDay()},</div>
            <div style={{ fontFamily:'Epilogue', fontSize:28, fontWeight:900 }}>{profile?.name} 👋</div>
          </div>
          {streak > 0 && (
            <div style={{ background:C.orangeDim, border:`1.5px solid ${C.orange}44`, borderRadius:14,
              padding:'10px 14px', textAlign:'center' }}>
              <div style={{ fontSize:22 }}>🔥</div>
              <div style={{ fontSize:11, color:C.orange, fontWeight:700 }}>{streak}d streak</div>
            </div>
          )}
        </div>

        {/* Today quick card */}
        <div onClick={() => onSelectDate(todayStr)} className="fade-up" style={{
          marginTop:16, background:C.card, borderRadius:16, padding:'16px 18px',
          border:`1.5px solid ${C.border}`, cursor:'pointer', display:'flex',
          justifyContent:'space-between', alignItems:'center',
          transition:'border-color 0.2s', borderColor: C.accent+'55'
        }}>
          <div>
            <div style={{ fontSize:11, color:C.muted, fontWeight:600, letterSpacing:'0.05em', textTransform:'uppercase' }}>Today's net</div>
            <div style={{ fontFamily:'Epilogue', fontSize:34, fontWeight:900, color:netColor, lineHeight:1.1 }}>
              {todayStats.net > 0 ? '+' : ''}{todayStats.net}
            </div>
            <div style={{ fontSize:12, color:C.muted }}>goal: {todayStats.goal} kcal</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:13, color:C.text }}>🍽 {todayStats.consumed} eaten</div>
            <div style={{ fontSize:13, color:C.orange }}>🏃 {todayStats.burned} burned</div>
            <div style={{ marginTop:10, fontSize:12, color:C.accent, fontWeight:600 }}>Tap to log →</div>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div style={{ padding:'20px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()-1))}
            style={{ background:C.card, border:`1.5px solid ${C.border}`, color:C.text,
              borderRadius:10, width:38, height:38, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <span style={{ fontFamily:'Epilogue', fontWeight:800, fontSize:18 }}>{MONTHS[month]} {year}</span>
          <button onClick={() => setCalMonth(m => new Date(m.getFullYear(), m.getMonth()+1))}
            style={{ background:C.card, border:`1.5px solid ${C.border}`, color:C.text,
              borderRadius:10, width:38, height:38, fontSize:18, display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:8 }}>
          {DAYS_SHORT.map(d => (
            <div key={d} style={{ textAlign:'center', fontSize:11, color:C.subtle, padding:'4px 0',
              fontWeight:700, letterSpacing:'0.05em' }}>{d}</div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:5 }}>
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday  = key === todayStr;
            const isFuture = key > todayStr;
            const dot      = getDotColor(d);
            return (
              <button key={i} onClick={() => !isFuture && onSelectDate(key)} style={{
                aspectRatio:'1', borderRadius:12,
                border: isToday ? `2px solid ${C.accent}` : `1.5px solid transparent`,
                background: isToday ? C.accentDim : C.card,
                display:'flex', flexDirection:'column', alignItems:'center',
                justifyContent:'center', gap:3, cursor: isFuture ? 'default' : 'pointer',
                opacity: isFuture ? 0.25 : 1, transition:'all 0.15s'
              }}>
                <span style={{ fontSize:13, fontWeight: isToday?700:400,
                  color: isToday ? C.accent : C.text }}>{d}</span>
                {dot && <div style={{ width:5, height:5, borderRadius:'50%', background:dot }} />}
              </button>
            );
          })}
        </div>

        <div style={{ display:'flex', gap:18, marginTop:16, justifyContent:'center' }}>
          {[{c:C.accent,l:'Deficit'},{c:C.red,l:'Surplus'}].map(x=>(
            <div key={x.l} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:7, height:7, borderRadius:'50%', background:x.c }} />
              <span style={{ fontSize:11, color:C.muted }}>{x.l}</span>
            </div>
          ))}
        </div>
      </div>

      <BottomNav active="calendar" onNav={onNav} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   DAY SCREEN
═══════════════════════════════════════════════════════ */
function DayScreen({ date, dayData: day, profile, getDayStats, updateDay, onBack }) {
  const [mealFlow,    setMealFlow]    = useState(null); // null | 'input' | 'confirm'
  const [workoutFlow, setWorkoutFlow] = useState(null);
  const [mealName,    setMealName]    = useState('');
  const [wName,       setWName]       = useState('');
  const [wCals,       setWCals]       = useState('');
  const [pending,     setPending]     = useState(null);
  const [pendingW,    setPendingW]    = useState(null);
  const [loading,     setLoading]     = useState(false);
  const [wInput,      setWInput]      = useState(day.weight ? String(day.weight) : '');
  const [weightSaved, setWeightSaved] = useState(!!day.weight);

  const stats = getDayStats(date);
  const d     = parseDate(date);
  const dateDisplay = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
  const netColor = stats.consumed===0 ? C.muted : stats.surplus ? C.red : C.accent;
  const pct = Math.min((stats.net / stats.goal) * 100, 100);

  const lookupMeal = async () => {
    if (!mealName.trim()) return;
    setLoading(true);
    try {
      const r = await fetchCalories(mealName);
      setPending({ name: mealName, calories: r.calories, note: r.note });
      setMealFlow('confirm');
    } catch { setPending({ name: mealName, calories: 0, note: 'Enter manually' }); setMealFlow('confirm'); }
    setLoading(false);
  };

  const confirmMeal = async () => {
    await updateDay(date, prev => ({
      ...prev, meals: [...(prev.meals||[]), { id:Date.now(), ...pending }]
    }));
    setMealName(''); setPending(null); setMealFlow(null);
  };

  const lookupWorkout = async () => {
    if (!wName.trim()) return;
    if (wCals) { setPendingW({ name:wName, calories:+wCals, note:'Manual entry' }); setWorkoutFlow('confirm'); return; }
    setLoading(true);
    try {
      const r = await fetchCalories(wName, true);
      setPendingW({ name:wName, calories:r.calories, note:r.note });
      setWorkoutFlow('confirm');
    } catch { setPendingW({ name:wName, calories:0, note:'Enter manually' }); setWorkoutFlow('confirm'); }
    setLoading(false);
  };

  const confirmWorkout = async () => {
    await updateDay(date, prev => ({
      ...prev, workouts: [...(prev.workouts||[]), { id:Date.now(), ...pendingW }]
    }));
    setWName(''); setWCals(''); setPendingW(null); setWorkoutFlow(null);
  };

  const removeItem = async (type, id) =>
    updateDay(date, prev => ({ ...prev, [type]: (prev[type]||[]).filter(i=>i.id!==id) }));

  const saveWeight = async () => {
    if (!wInput) return;
    await updateDay(date, prev => ({ ...prev, weight: +wInput }));
    setWeightSaved(true);
  };

  return (
    <div style={{ paddingBottom:40, minHeight:'100vh' }}>
      {/* Header */}
      <div style={{ padding:'52px 20px 20px', background:C.surface, borderBottom:`1.5px solid ${C.border}` }}>
        <button onClick={onBack} style={{ background:'none', border:'none', color:C.muted,
          fontSize:13, marginBottom:14, display:'flex', alignItems:'center', gap:6, fontWeight:600 }}>
          ← Calendar
        </button>
        <div style={{ fontFamily:'Epilogue', fontSize:22, fontWeight:800 }}>{dateDisplay}</div>

        {/* Stats row */}
        <div style={{ marginTop:14, display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
          {[
            { label:'🍽 Eaten',  val:stats.consumed, color:C.text },
            { label:'🏃 Burned', val:stats.burned,   color:C.orange },
            { label:'⚡ Net',    val:stats.net,       color:netColor },
          ].map(s=>(
            <Card key={s.label} style={{ padding:'12px 10px', textAlign:'center' }}>
              <div style={{ fontSize:10, color:C.muted, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontFamily:'Epilogue', fontSize:20, fontWeight:900, color:s.color }}>{s.val}</div>
            </Card>
          ))}
        </div>

        {/* Goal bar */}
        <div style={{ marginTop:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:C.muted, marginBottom:5, fontWeight:600 }}>
            <span>GOAL: {stats.goal} KCAL</span>
            <span style={{ color:netColor }}>{stats.surplus?'SURPLUS':'DEFICIT'}: {Math.abs(stats.diff)} KCAL</span>
          </div>
          <div style={{ height:5, background:C.border, borderRadius:3, overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:3, width:`${pct}%`,
              background: stats.surplus ? C.red : C.accent, transition:'width 0.5s ease' }} />
          </div>
        </div>
      </div>

      <div style={{ padding:'20px', display:'flex', flexDirection:'column', gap:28 }}>

        {/* Weight */}
        <div>
          <SectionTitle>⚖️ Today's Weight</SectionTitle>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            <input type="number" placeholder="kg" value={wInput} onChange={e=>setWInput(e.target.value)} style={{ flex:1 }} />
            <Btn onClick={saveWeight} disabled={!wInput}>{weightSaved ? '✓ Saved' : 'Log'}</Btn>
          </div>
          {day.weight && <div style={{ fontSize:12, color:C.muted, marginTop:6 }}>Current: {day.weight} kg</div>}
        </div>

        {/* Meals */}
        <div>
          <SectionTitle>🍽 Meals</SectionTitle>
          {(day.meals||[]).map(m => (
            <LogRow key={m.id} name={m.name} note={m.note}
              value={`${m.calories} kcal`} color={C.text}
              onDelete={()=>removeItem('meals',m.id)} />
          ))}

          {mealFlow === null && (
            <Btn variant="secondary" onClick={()=>setMealFlow('input')} style={{ width:'100%', marginTop:4 }}>
              + Add Meal
            </Btn>
          )}
          {mealFlow === 'input' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }} className="fade-up">
              <input placeholder="e.g. 2 eggs + toast with butter" value={mealName}
                onChange={e=>setMealName(e.target.value)}
                onKeyDown={e=>e.key==='Enter' && lookupMeal()} autoFocus />
              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="ghost" onClick={()=>{setMealFlow(null);setMealName('');}}>Cancel</Btn>
                <Btn onClick={lookupMeal} disabled={loading||!mealName.trim()} style={{ flex:1 }}>
                  {loading ? <><span style={{ animation:'pulse 1s infinite' }}>🔍</span> Looking up…</> : '🔍 Find calories'}
                </Btn>
              </div>
            </div>
          )}
          {mealFlow === 'confirm' && pending && (
            <ConfirmCard item={pending} setItem={setPending}
              onConfirm={confirmMeal} onCancel={()=>{setMealFlow(null);setMealName('');setPending(null);}} />
          )}
        </div>

        {/* Workouts */}
        <div>
          <SectionTitle>🏃 Workouts</SectionTitle>
          {(day.workouts||[]).map(w => (
            <LogRow key={w.id} name={w.name} note={w.note}
              value={`-${w.calories} kcal`} color={C.orange}
              onDelete={()=>removeItem('workouts',w.id)} />
          ))}

          {workoutFlow === null && (
            <Btn variant="orange" onClick={()=>setWorkoutFlow('input')} style={{ width:'100%', marginTop:4 }}>
              + Add Workout
            </Btn>
          )}
          {workoutFlow === 'input' && (
            <div style={{ display:'flex', flexDirection:'column', gap:10, marginTop:4 }} className="fade-up">
              <input placeholder="e.g. 30 min run" value={wName}
                onChange={e=>setWName(e.target.value)} autoFocus />
              <input type="number" placeholder="Calories burned (or leave blank for AI estimate)" value={wCals}
                onChange={e=>setWCals(e.target.value)} />
              <div style={{ display:'flex', gap:8 }}>
                <Btn variant="ghost" onClick={()=>{setWorkoutFlow(null);setWName('');setWCals('');}}>Cancel</Btn>
                <Btn variant="orange" onClick={lookupWorkout} disabled={loading||!wName.trim()} style={{ flex:1 }}>
                  {loading ? <><span style={{ animation:'pulse 1s infinite' }}>🔍</span> Estimating…</> : wCals ? '✓ Log it' : '🔍 Estimate'}
                </Btn>
              </div>
            </div>
          )}
          {workoutFlow === 'confirm' && pendingW && (
            <ConfirmCard item={pendingW} setItem={setPendingW} labelText="Calories burned" accentColor={C.orange}
              onConfirm={confirmWorkout} onCancel={()=>{setWorkoutFlow(null);setWName('');setWCals('');setPendingW(null);}} />
          )}
        </div>
      </div>
    </div>
  );
}

function LogRow({ name, note, value, color, onDelete }) {
  return (
    <div className="fade-up" style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'12px 14px', background:C.card, borderRadius:13,
      border:`1.5px solid ${C.border}`, marginBottom:8
    }}>
      <div style={{ flex:1, overflow:'hidden' }}>
        <div style={{ fontSize:14, fontWeight:500, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{name}</div>
        {note && <div style={{ fontSize:11, color:C.muted }}>{note}</div>}
      </div>
      <div style={{ fontSize:14, fontWeight:700, color, marginLeft:12, marginRight:12, whiteSpace:'nowrap' }}>{value}</div>
      <button onClick={onDelete} style={{ background:'none', border:'none', color:C.subtle, fontSize:20, lineHeight:1, padding:'0 2px' }}>×</button>
    </div>
  );
}

function ConfirmCard({ item, setItem, labelText='Calories', accentColor=C.accent, onConfirm, onCancel }) {
  return (
    <Card style={{ padding:16, borderColor:`${accentColor}44`, marginTop:4 }} className="fade-up">
      <div style={{ fontWeight:600, marginBottom:3 }}>{item.name}</div>
      {item.note && <div style={{ fontSize:12, color:C.muted, marginBottom:12 }}>{item.note}</div>}
      <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14 }}>
        <div style={{ fontSize:12, color:C.muted, whiteSpace:'nowrap' }}>{labelText}:</div>
        <input type="number" value={item.calories}
          onChange={e=>setItem(p=>({...p,calories:+e.target.value}))}
          style={{ width:90, textAlign:'center', color:accentColor, fontWeight:700, fontSize:20 }} />
        <div style={{ fontSize:12, color:C.muted }}>kcal</div>
      </div>
      <div style={{ display:'flex', gap:8 }}>
        <Btn variant="ghost" onClick={onCancel}>Cancel</Btn>
        <Btn onClick={onConfirm} style={{ flex:1 }}>✓ Add it</Btn>
      </div>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════
   ANALYTICS SCREEN
═══════════════════════════════════════════════════════ */
function AnalyticsScreen({ dayData, profile, getDayStats, onNav }) {
  const [range, setRange] = useState('week');
  const days = range === 'week' ? 7 : 30;

  const chartData = Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const key = dateKey(d);
    const stats = getDayStats(key);
    const hasData = (dayData[key]?.meals?.length||0) > 0 || (dayData[key]?.workouts?.length||0) > 0;
    return {
      date: key,
      label: range === 'week'
        ? d.toLocaleDateString('en-US',{weekday:'short'})
        : d.getDate().toString(),
      net:      hasData ? stats.net      : null,
      consumed: hasData ? stats.consumed : 0,
      burned:   hasData ? stats.burned   : 0,
      diff:     hasData ? stats.diff     : null,
    };
  });

  const weightData = chartData
    .map(d => ({ label: d.label, weight: dayData[d.date]?.weight || null }))
    .filter(d => d.weight !== null);

  const goal    = profile?.goalCalories || 2000;
  const logged  = chartData.filter(d => d.net !== null);
  const avgNet  = logged.length ? Math.round(logged.reduce((s,d)=>s+d.net,0)/logged.length) : 0;
  const totDef  = logged.reduce((s,d)=>s+(d.diff<0?Math.abs(d.diff):0),0);
  const totSur  = logged.reduce((s,d)=>s+(d.diff>0?d.diff:0),0);
  const avgCon  = logged.length ? Math.round(logged.reduce((s,d)=>s+d.consumed,0)/logged.length) : 0;
  const netColor = avgNet > goal ? C.red : C.accent;

  return (
    <div style={{ paddingBottom:90, minHeight:'100vh' }}>
      <div style={{ padding:'52px 20px 20px', background:C.surface, borderBottom:`1.5px solid ${C.border}` }}>
        <div style={{ fontFamily:'Epilogue', fontSize:28, fontWeight:900 }}>Analytics</div>
        <div style={{ display:'flex', gap:8, marginTop:14 }}>
          {['week','month'].map(r=>(
            <button key={r} onClick={()=>setRange(r)} style={{
              padding:'8px 20px', borderRadius:20, border:'none', fontSize:13, fontWeight:700,
              background: range===r ? C.accent : C.card,
              color: range===r ? '#060810' : C.muted, transition:'all 0.2s'
            }}>{r==='week'?'This Week':'This Month'}</button>
          ))}
        </div>
      </div>

      <div style={{ padding:20 }}>
        {/* Summary grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:22 }}>
          {[
            { label:'Avg net/day',    val:`${avgNet>0?'+':''}${avgNet}`, unit:'kcal', color:netColor },
            { label:'Avg consumed',   val:avgCon,                        unit:'kcal', color:C.text },
            { label:'Total deficit',  val:totDef,                        unit:'kcal', color:C.accent },
            { label:'Total surplus',  val:totSur,                        unit:'kcal', color:C.red },
          ].map(s=>(
            <Card key={s.label} style={{ padding:'14px 16px' }}>
              <div style={{ fontSize:10, color:C.muted, fontWeight:700, letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>{s.label}</div>
              <div style={{ fontFamily:'Epilogue', fontSize:24, fontWeight:900, color:s.color }}>{s.val}</div>
              <div style={{ fontSize:11, color:C.subtle }}>{s.unit}</div>
            </Card>
          ))}
        </div>

        {/* Net calories bar chart */}
        <Card style={{ padding:'16px', marginBottom:16 }}>
          <div style={{ fontFamily:'Epilogue', fontWeight:800, marginBottom:4 }}>Net Calories / Day</div>
          <div style={{ fontSize:11, color:C.muted, marginBottom:14 }}>Dashed line = goal ({goal} kcal)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={chartData} margin={{ top:5, right:5, bottom:0, left:-22 }}>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:C.subtle }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.subtle }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:12 }}
                labelStyle={{ color:C.muted }}
                formatter={v=>[v===null?'—':`${v} kcal`,'Net']}
              />
              <ReferenceLine y={goal} stroke={C.accent} strokeDasharray="4 3" strokeWidth={1.5} />
              <Bar dataKey="net" radius={[6,6,0,0]}>
                {chartData.map((d,i)=>(
                  <Cell key={i}
                    fill={d.net===null ? C.border : d.net > goal ? C.red : C.accent}
                    fillOpacity={d.net===null ? 0.25 : 0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Consumed vs burned */}
        <Card style={{ padding:'16px', marginBottom:16 }}>
          <div style={{ fontFamily:'Epilogue', fontWeight:800, marginBottom:14 }}>Eaten vs Burned</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} margin={{ top:5, right:5, bottom:0, left:-22 }}>
              <XAxis dataKey="label" tick={{ fontSize:10, fill:C.subtle }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize:10, fill:C.subtle }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:12 }}
                labelStyle={{ color:C.muted }}
              />
              <Bar dataKey="consumed" name="Eaten"  fill={C.accent}  fillOpacity={0.7} radius={[4,4,0,0]} />
              <Bar dataKey="burned"   name="Burned" fill={C.orange}  fillOpacity={0.7} radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Weight trend */}
        {weightData.length > 1 ? (
          <Card style={{ padding:'16px' }}>
            <div style={{ fontFamily:'Epilogue', fontWeight:800, marginBottom:3 }}>Weight Trend</div>
            <div style={{ fontSize:12, color:C.muted, marginBottom:14 }}>
              {weightData[0].weight} kg → {weightData[weightData.length-1].weight} kg &nbsp;
              <span style={{ color: weightData[weightData.length-1].weight < weightData[0].weight ? C.accent : C.red }}>
                ({(weightData[weightData.length-1].weight-weightData[0].weight>=0?'+':'')}{(weightData[weightData.length-1].weight-weightData[0].weight).toFixed(1)} kg)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={140}>
              <LineChart data={weightData} margin={{ top:5, right:5, bottom:0, left:-22 }}>
                <XAxis dataKey="label" tick={{ fontSize:10, fill:C.subtle }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize:10, fill:C.subtle }} axisLine={false} tickLine={false} domain={['auto','auto']} />
                <Tooltip contentStyle={{ background:C.surface, border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:12 }} />
                <Line type="monotone" dataKey="weight" stroke={C.orange} strokeWidth={2.5}
                  dot={{ fill:C.orange, r:5, strokeWidth:0 }} activeDot={{ r:7 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        ) : (
          <Card style={{ padding:'28px', textAlign:'center' }}>
            <div style={{ fontSize:28, marginBottom:8 }}>⚖️</div>
            <div style={{ color:C.muted, fontSize:13 }}>Log your weight daily to see your trend here</div>
          </Card>
        )}
      </div>

      <BottomNav active="analytics" onNav={onNav} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   PROFILE SCREEN
═══════════════════════════════════════════════════════ */
function ProfileScreen({ profile, dayData, onSave, onNav }) {
  const [editing, setEditing] = useState(false);
  const [data, setData]       = useState({ ...profile });
  const set = (k,v) => setData(p=>({...p,[k]:v}));

  const handleSave = () => {
    const t = calcTDEE({ ...data, weight:+data.weight, height:+data.height, age:+data.age });
    onSave({ ...data, age:+data.age, height:+data.height, weight:+data.weight,
      goalCalories: data.goalCalories ? +data.goalCalories : t });
    setEditing(false);
  };

  const weightEntries = Object.entries(dayData)
    .filter(([,d])=>d.weight)
    .sort(([a],[b])=>b.localeCompare(a))
    .slice(0,15)
    .map(([date,d])=>({ date, weight:d.weight }));

  const latestWeight  = weightEntries[0]?.weight || profile.weight;
  const weightChange  = +(latestWeight - profile.weight).toFixed(1);
  const wChangeColor  = weightChange < 0 ? C.accent : weightChange > 0 ? C.red : C.muted;

  return (
    <div style={{ paddingBottom:90, minHeight:'100vh' }}>
      <div style={{ padding:'52px 20px 20px', background:C.surface, borderBottom:`1.5px solid ${C.border}` }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div style={{ fontFamily:'Epilogue', fontSize:28, fontWeight:900 }}>Profile</div>
          <Btn variant="secondary" small onClick={()=>setEditing(!editing)}>
            {editing ? 'Cancel' : '✏️ Edit'}
          </Btn>
        </div>
      </div>

      <div style={{ padding:20 }}>
        {!editing ? (
          <>
            <Card style={{ padding:20, marginBottom:24 }}>
              <div style={{ fontFamily:'Epilogue', fontSize:30, fontWeight:900, marginBottom:3 }}>{profile.name}</div>
              <div style={{ color:C.muted, fontSize:13, marginBottom:20 }}>
                {profile.sex} · {profile.age} yrs · {activityLabel(profile.activity)}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
                {[
                  { label:'Height',         val:`${profile.height} cm` },
                  { label:'Starting weight',val:`${profile.weight} kg` },
                  { label:'Current weight', val:`${latestWeight} kg`, color:wChangeColor },
                  { label:'Weight change',  val:`${weightChange>=0?'+':''}${weightChange} kg`, color:wChangeColor },
                  { label:'Daily goal',     val:`${profile.goalCalories} kcal` },
                  { label:'TDEE',           val:`${calcTDEE(profile)} kcal` },
                ].map(s=>(
                  <div key={s.label}>
                    <div style={{ fontSize:10, color:C.subtle, fontWeight:700, letterSpacing:'0.05em',
                      textTransform:'uppercase', marginBottom:3 }}>{s.label}</div>
                    <div style={{ fontWeight:600, fontSize:15, color:s.color||C.text }}>{s.val}</div>
                  </div>
                ))}
              </div>
            </Card>

            <SectionTitle>⚖️ Weight Log</SectionTitle>
            {weightEntries.length === 0 ? (
              <div style={{ color:C.muted, fontSize:13 }}>
                No weight logged yet. Tap any calendar day and log your weight there.
              </div>
            ) : weightEntries.map(e=>(
              <div key={e.date} style={{
                display:'flex', justifyContent:'space-between', padding:'12px 14px',
                background:C.card, borderRadius:12, marginBottom:8, border:`1.5px solid ${C.border}`
              }}>
                <span style={{ color:C.muted, fontSize:13 }}>
                  {parseDate(e.date).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
                </span>
                <span style={{ fontWeight:700 }}>{e.weight} kg</span>
              </div>
            ))}
          </>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {[
              { label:'Name',              key:'name',         type:'text' },
              { label:'Age',               key:'age',          type:'number' },
              { label:'Height (cm)',        key:'height',       type:'number' },
              { label:'Starting weight (kg)',key:'weight',     type:'number' },
              { label:'Daily calorie goal', key:'goalCalories', type:'number',
                placeholder:`TDEE: ${calcTDEE({ ...data, weight:+data.weight, height:+data.height, age:+data.age })}` },
            ].map(f=>(
              <div key={f.key}>
                <div style={{ fontSize:12, color:C.muted, fontWeight:600, marginBottom:6 }}>{f.label}</div>
                <input type={f.type} value={data[f.key]||''} placeholder={f.placeholder||''}
                  onChange={e=>set(f.key, e.target.value)} />
              </div>
            ))}
            <Btn onClick={handleSave}>Save Changes</Btn>
          </div>
        )}
      </div>

      <BottomNav active="profile" onNav={onNav} />
    </div>
  );
}
