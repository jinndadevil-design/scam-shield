/* ============================================================
   SCAM SHIELD — the tool engine (statement/credibility analyzer)
   Pure pattern-matching on scam scripts. No mind-reading.
   ============================================================ */

const DEMOS = {
  romance: `Hello my love, good morning my queen. I feel God brought us together for a reason. I am a US Army engineer currently deployed overseas on a peacekeeping mission, so I cannot video call or meet in person right now. Let's move our chat to WhatsApp where it's more private. I have never felt this way so fast. My darling, I want to share something — I have been making very good money on a crypto investment platform my colleague showed me, returns are guaranteed. If you join with me I will guide you. Start with just $500 and you will see the profit. But please keep this between us, don't tell your family yet. Trust me.`,
  invest: `🚀 CONGRATULATIONS — you've been selected for our VIP crypto signals group! Our members make guaranteed 30% returns every week, 100% risk-free. This is a limited-time opportunity, only 5 spots left, you must act now. Just deposit to our trading platform and our AI bot does the rest. To withdraw your profits you'll first need to pay a small 15% tax fee in Bitcoin. Don't miss out — easy money, act fast before this closes today!`,
  bank: `ALERT: Your bank account has been locked by the security department due to suspicious activity. To avoid permanent suspension you must verify your identity immediately. Click here: http://secure-bank-verify.info/login — failure to act within 24 hours will result in your account being closed. Do not share this message. This is your final notice.`,
  safe: `Hi, it's Sarah from the dentist — just confirming your cleaning appointment on Tuesday the 14th at 2:30pm with Dr. Lee. Our address is 12 Marine Drive. If you need to reschedule call us on the clinic number on your card. See you then!`
};

const DET = [
  {fam:"payment", tone:"danger", label:"Untraceable payment demand", weight:16, cap:2,
   why:"Gift cards, crypto and wire transfers can't be reversed or traced — the favourite tools of scammers. No real bank or government asks for these.",
   re:/\b(gift ?cards?|itunes|steam card|google play( card)?|amazon card|western union|moneygram|wire transfer|crypto(currency)?|bitcoin|btc|usdt|ethereum|prepaid card|cash app|zelle to)\b/gi},
  {fam:"payment", tone:"danger", label:"Pay-a-fee-to-get-paid", weight:18, cap:1,
   why:"Being asked to pay a 'tax', 'fee' or 'release charge' before you can withdraw or receive money is a guaranteed scam. Real money never works this way.",
   re:/\b(pay (a |the )?(small )?(tax|fee|charge|deposit)|release (fee|charge)|withdrawal (fee|tax)|clearance fee|to withdraw .* (you|first)|unlock your (funds|profit))\b/gi},
  {fam:"invest", tone:"danger", label:"Guaranteed / risk-free returns", weight:13, cap:2,
   why:"No real investment can guarantee profit. 'Guaranteed', 'risk-free' and fixed weekly returns are the language of investment fraud — the #1 scam category by money lost.",
   re:/\b(guaranteed( returns?| profit)?|risk[- ]?free|100% (safe|sure|profit)|double your money|\d{2,3}% (return|profit|weekly|daily|monthly)|fixed (daily|weekly) (return|profit)|easy money|get rich)\b/gi},
  {fam:"invest", tone:"caution", label:"'I'll guide you to invest'", weight:9, cap:2,
   why:"Strangers and online partners who offer to 'teach you to trade' or get you into a special platform are running the 'pig butchering' investment scam — the fastest-growing fraud in the world.",
   re:/\b(investment platform|trading platform|crypto (platform|investment)|signals group|i will (guide|teach|help) you (to )?(invest|trade)|join (with )?me|vip (group|signals)|trading bot|ai bot does)\b/gi},
  {fam:"romance", tone:"caution", label:"Can't-ever-meet excuse", weight:11, cap:2,
   why:"Deployed soldier, oil rig, doctor overseas, 'can't video call' — these are the top excuses scammers use to explain why they can never appear in person. A real partner can show their face.",
   re:/\b(deployed|peacekeeping|on a (oil ?rig|mission)|in the (army|military)|stationed (abroad|overseas)|working (abroad|overseas|on a rig)|can'?t (video ?call|meet|come)|cannot (video|meet)|united nations|international organization)\b/gi},
  {fam:"romance", tone:"caution", label:"Fast, intense love language", weight:7, cap:2,
   why:"'My love / my queen / soulmate / God brought us together' within days, before you've ever met, is love-bombing — building fake trust fast so you'll send money later.",
   re:/\b(my (love|queen|king|darling|soulmate|dear)|good morning my|god brought us|never felt this way|you are my (everything|destiny)|i (love|adore) you)\b/gi},
  {fam:"impersonation", tone:"danger", label:"Fake authority + account threat", weight:12, cap:2,
   why:"'Your account is locked / suspended', fake bank 'security departments', police, tax office, arrest threats — impersonating authority to create panic so you act before thinking.",
   re:/\b(account (has been |is |was )?(locked|suspended|compromised|frozen|closed)|security department|verify your (identity|account)|suspicious activity (detected|on)|irs|tax office|arrest warrant|police (will|have)|final notice|permanent suspension)\b/gi},
  {fam:"phishing", tone:"danger", label:"Suspicious link to click", weight:11, cap:2,
   why:"Links that ask you to 'log in' or 'verify' lead to fake copies of real sites built to steal your password. Never log in from a link in a message.",
   re:/\b(click here|tap here|log ?in here|verify (here|now)|https?:\/\/[^\s]*(verify|secure|login|account|confirm)[^\s]*|bit\.ly\/|tinyurl)\b/gi},
  {fam:"phishing", tone:"caution", label:"'You've won' / prize bait", weight:8, cap:2,
   why:"Lotteries you didn't enter, prizes, 'you've been selected', surprise refunds and parcels — bait to get you to click or hand over details.",
   re:/\b(you'?ve (won|been selected|been chosen)|congratulations|claim your (prize|reward|refund)|you are a winner|lucky winner|free (gift|prize)|parcel (is )?waiting|delivery (failed|pending))\b/gi},
  {fam:"pressure", tone:"caution", label:"Pressure to act immediately", weight:8, cap:2,
   why:"'Act now', 'last chance', 'expires today', a ticking clock — urgency exists to stop you checking with anyone. Real opportunities and real institutions give you time.",
   re:/\b(act now|right now|act fast|immediately|urgent(ly)?|asap|last chance|limited[- ]time|only \d+ (spots?|left)|spots? left|expires? (today|soon)|within \d+ hours?|hurry|don'?t miss out|before (this )?(closes|ends))\b/gi},
  {fam:"pressure", tone:"danger", label:"'Keep this secret'", weight:12, cap:1,
   why:"'Don't tell your family', 'keep this between us', 'this is private' — isolating you from the people who would instantly spot the scam. This is one of the strongest danger signs there is.",
   re:/\b(keep (this|it) between us|don'?t tell (anyone|your (family|husband|wife|kids|son|daughter)|anybody)|our (little )?secret|keep (this|it) (secret|private|quiet)|just between (us|you and me))\b/gi},
  {fam:"pressure", tone:"caution", label:"Move to a private channel", weight:6, cap:1,
   why:"Pushing you to WhatsApp/Telegram early — off the dating app or platform — gets you somewhere with no scam protection and no record.",
   re:/\b(move (our|the|to) (chat|conversation)|let'?s (chat|talk|move) (on|to) (whats?app|telegram|signal)|whats?app me|message me on (whats?app|telegram)|more private (here|there|app))\b/gi},
  {fam:"pressure", tone:"caution", label:"'Just trust me'", weight:5, cap:2,
   why:"Truth doesn't need a sales pitch. 'Trust me / why would I lie / I promise' is used to push past your doubt instead of giving you proof.",
   re:/\b(trust me|believe me|i swear|i promise you|why would i lie|i'?m not (a )?(scam|lying)|this is (100% )?(real|legit|genuine))\b/gi},
  {fam:"safe", tone:"safe", label:"Specific, checkable details", weight:-9, cap:4,
   why:"Real, named, checkable details — a person, place, date, time, official number you already have — are what genuine messages contain and scams avoid.",
   re:/\b(\d{1,2}[:.]\d{2}\s?(am|pm)?|on (monday|tuesday|wednesday|thursday|friday|saturday|sunday)( the \d{1,2}(st|nd|rd|th)?)?|dr\.? [A-Z][a-z]+|appointment|number on your card|official (number|website|app)|call (us|the clinic|the bank) on|our address is)\b/gi},
];

const SCAN_LINES = ["Reading the message…","Checking scam patterns…","Matching known fraud scripts…","Weighing the danger signs…","Preparing your safety verdict…"];
const TYPE_LABEL = {
  romance:"Romance / 'pig butchering' scam", invest:"Investment / crypto scam",
  impersonation:"Bank or authority impersonation", phishing:"Phishing / fake-link scam",
  payment:"Advance-fee / payment scam", pressure:"High-pressure scam tactics"
};
const ACTIONS = {
  romance:[
    {t:"dont", h:"Do NOT send money, gift cards or crypto", b:"to anyone you have only met online — no matter the story. This is how the money is lost."},
    {t:"dods", h:"Ask to video-call right now", b:"Real partners can. Scammers always have an excuse not to."},
    {t:"dods", h:"Reverse-image-search their photos", b:"Stolen photos are reused across many fake profiles — a quick search often exposes them."},
    {t:"dods", h:"Talk to a family member first", b:"Before sending anything, tell someone you trust. Scammers rely on you keeping it secret."}
  ],
  invest:[
    {t:"dont", h:"Never pay a fee to withdraw 'profits'", b:"That fee is the scam — the profits aren't real and you'll never see the money."},
    {t:"dont", h:"Don't 'invest' through someone you met online", b:"or a platform from a message. Guaranteed returns do not exist."},
    {t:"dods", h:"Check the platform on a regulator's warning list", b:"Search the name + 'scam' or your financial regulator's site before putting in a cent."},
    {t:"dods", h:"Slow down — real opportunities wait", b:"Pressure to act 'today' is designed to stop you checking."}
  ],
  impersonation:[
    {t:"dont", h:"Don't click the link or call the number in the message", b:"It leads to the scammer, not your bank."},
    {t:"dods", h:"Contact the bank yourself", b:"Use the phone number on the back of your card or the official app. Ask if anything is really wrong."},
    {t:"dods", h:"Real banks never ask for full passwords or gift cards", b:"or threaten instant closure to rush you."}
  ],
  phishing:[
    {t:"dont", h:"Do NOT click the link", b:"Even if it looks official. Links in scam messages copy real sites to steal your login."},
    {t:"dods", h:"Go to the real site or app directly", b:"Type the address yourself or use your saved app — never the link you were sent."},
    {t:"dods", h:"Never enter your password or card details from a link", b:"When in doubt, check with the company through their official channel."}
  ],
  payment:[
    {t:"dont", h:"Stop — do not pay", b:"Gift cards, crypto and wire transfers are demanded because they can't be undone. That's the whole trick."},
    {t:"dods", h:"Verify independently before any payment", b:"Contact the company or person through a number you find yourself, not one they gave you."},
    {t:"dods", h:"Tell someone you trust", b:"A second opinion stops most scams cold."}
  ],
  pressure:[
    {t:"dods", h:"Slow everything down", b:"Urgency and secrecy are pressure tactics. Anything real survives a 24-hour pause and a chat with family."},
    {t:"dods", h:"Verify through an official channel you find yourself", b:"Don't use links or numbers from the message."},
    {t:"dods", h:"When in doubt, don't send money or details", b:"You can always say 'I'll get back to you' and check first."}
  ],
  none:[
    {t:"dods", h:"No obvious scam signals — but stay alert", b:"This wasn't a guarantee it's safe. If it involves money, a link, or a stranger, verify through an official channel before acting."},
    {t:"dods", h:"Trust your gut", b:"If something still feels off, ask someone you trust before you reply or send anything."}
  ]
};

const $ = (s) => document.querySelector(s);

function analyze(text){
  const hits = []; let risk = 0; const famScore = {};
  for (const d of DET){
    d.re.lastIndex = 0; const matches = []; let m;
    while ((m = d.re.exec(text)) !== null){ matches.push({str:m[0], index:m.index}); if (matches.length>=12) break; }
    if (matches.length){
      const counted = Math.min(matches.length, d.cap);
      const contribution = d.weight * counted; risk += contribution;
      if (d.tone !== "safe") famScore[d.fam] = (famScore[d.fam]||0) + Math.abs(contribution);
      hits.push({d, matches, counted});
    }
  }
  const MECH = {payment:1, pressure:1};
  let domFam = "none", best = 0;
  for (const f in famScore){ if (MECH[f]) continue; if (famScore[f] > best){ best = famScore[f]; domFam = f; } }
  if (domFam === "none"){ if (famScore.payment) domFam = "payment"; else if (famScore.pressure) domFam = "pressure"; }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  let riskPct = Math.max(0, Math.min(100, Math.round(risk)));
  if (words < 12 && riskPct > 0) riskPct = Math.round(riskPct * 0.7);
  let level = riskPct >= 55 ? "danger" : riskPct >= 22 ? "caution" : "safe";
  const dangerHits = hits.filter(h => h.d.tone !== "safe").length;
  if (level === "safe" && dangerHits === 0) riskPct = Math.min(riskPct, 8);
  return {hits, riskPct, level, domFam, words, dangerHits};
}

function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }
function toneMark(t){ return t==="safe" ? "m-safe" : t==="caution" ? "m-caution" : "m-danger"; }
function highlightHTML(text, hits){
  const spans = [];
  hits.forEach(h => h.matches.forEach(m => spans.push({start:m.index, end:m.index+m.str.length, tone:h.d.tone})));
  spans.sort((a,b)=>a.start-b.start);
  const flat=[]; let lastEnd=-1;
  for (const s of spans){ if (s.start>=lastEnd){ flat.push(s); lastEnd=s.end; } }
  let html="", pos=0;
  for (const s of flat){ html+=esc(text.slice(pos,s.start)); html+='<mark class="'+toneMark(s.tone)+'">'+esc(text.slice(s.start,s.end))+'</mark>'; pos=s.end; }
  html+=esc(text.slice(pos)); return html;
}

function render(r, text, opts){
  opts = opts || {}; const live = !!opts.live;
  const v = $("#verdict");
  v.className = "verdict " + r.level;
  $("#vbadge").textContent = {danger:"⛔", caution:"⚠️", safe:"✅"}[r.level];
  let title, type;
  if (r.level === "danger"){ title = "Likely a scam — do not send money"; type = "This matches a " + (TYPE_LABEL[r.domFam]||"known scam") + ". Strong danger signs below."; }
  else if (r.level === "caution"){ title = "Be careful — this has scam warning signs"; type = (r.domFam!=="none" ? "Looks like it could be a " + (TYPE_LABEL[r.domFam]||"scam") + ". " : "") + "Verify before you trust it."; }
  else { title = "No clear scam signals found"; type = "Nothing obvious stood out — but this isn't a guarantee. Stay alert if money, links or strangers are involved."; }
  $("#vtitle").textContent = title; $("#vtype").textContent = type;
  $("#vriskNum").textContent = "Risk " + r.riskPct + "%";

  const fw = $("#flags"); fw.innerHTML = "";
  const danger = r.hits.filter(h=>h.d.tone!=="safe").sort((a,b)=>(b.d.weight*b.counted)-(a.d.weight*a.counted));
  const safe = r.hits.filter(h=>h.d.tone==="safe");
  const show = danger.length ? danger : safe;
  if (!show.length) fw.innerHTML = '<div class="flag safe" style="animation-delay:.05s"><div class="ficon">✓</div><div><h4>No scam wording detected</h4><p>None of the common scam tactics showed up in this text.</p></div></div>';
  show.slice(0,7).forEach((h,i)=>{
    const el = document.createElement("div");
    el.className = "flag " + h.d.tone; el.style.animationDelay = (live?0.03*i:0.07*i+0.1)+"s";
    const icon = h.d.tone==="safe" ? "✓" : h.d.tone==="danger" ? "!" : "?";
    const q = esc(h.matches[h.matches.length-1].str);
    el.innerHTML = '<div class="ficon">'+icon+'</div><div><h4>'+h.d.label+(h.matches.length>1?' <span class="xn">×'+h.matches.length+'</span>':'')+'</h4><p>'+h.d.why+'</p><span class="quote">"'+q+'"</span></div>';
    fw.appendChild(el);
  });

  const acts = (r.level==="safe" && r.dangerHits===0) ? ACTIONS.none : (ACTIONS[r.domFam] || ACTIONS.pressure);
  const dl = $("#doList"); dl.innerHTML = "";
  acts.forEach((a,i)=>{
    const el = document.createElement("div");
    el.className = "do " + (a.t==="dont"?"dont":"dods"); el.style.animationDelay = (live?0.03*i:0.07*i+0.15)+"s";
    el.innerHTML = '<span class="di">'+(a.t==="dont"?"✕":"✓")+'</span><div><b>'+a.h+'</b> — '+a.b+'</div>';
    dl.appendChild(el);
  });

  if (live){ $("#readingWrap").style.display="none"; }
  else { $("#readingWrap").style.display="block"; $("#reading").innerHTML = highlightHTML(text, r.hits); }

  const results = $("#results");
  const wasOn = results.classList.contains("on");
  results.classList.add("on");
  if (!live && !wasOn) results.scrollIntoView({behavior:"smooth", block:"start"});

  const fill = $("#vmeterFill");
  if (live){ fill.style.transition="width .5s ease"; fill.style.width = r.riskPct+"%"; }
  else { fill.style.transition="none"; fill.style.width="0%"; setTimeout(()=>{ fill.style.transition="width 1.1s cubic-bezier(.3,.8,.2,1)"; fill.style.width=r.riskPct+"%"; },30); }
}

/* ---------- tabs ---------- */
const tabLive=$("#tabLive"), tabPaste=$("#tabPaste");
function showPane(which){
  tabLive.classList.toggle("active", which==="live");
  tabPaste.classList.toggle("active", which==="paste");
  $("#paneLive").classList.toggle("active", which==="live");
  $("#panePaste").classList.toggle("active", which==="paste");
  $("#results").classList.remove("on");
}
tabPaste.addEventListener("click", ()=>{ showPane("paste"); stopListening(); });
tabLive.addEventListener("click", ()=>{ showPane("live"); if (liveText) renderLive(); });

/* ---------- paste ---------- */
const input=$("#input");
document.querySelectorAll(".chip").forEach(c=>{ c.addEventListener("click",()=>{ input.value=DEMOS[c.dataset.demo]; input.focus(); }); });
$("#clear").addEventListener("click",()=>{ input.value=""; $("#results").classList.remove("on"); input.focus(); });
$("#go").addEventListener("click",()=>{
  const text=input.value.trim();
  if (text.length<10){ input.focus(); input.placeholder="Paste a message first…"; return; }
  const scanner=$("#scanner");
  $("#results").classList.remove("on"); scanner.classList.add("on"); $("#go").disabled=true;
  let i=0; $("#scanText").textContent=SCAN_LINES[0];
  const tick=setInterval(()=>{ i++; if (i<SCAN_LINES.length) $("#scanText").textContent=SCAN_LINES[i]; },340);
  setTimeout(()=>{ clearInterval(tick); scanner.classList.remove("on"); $("#go").disabled=false; render(analyze(text), text); }, 340*SCAN_LINES.length+150);
});

/* ---------- jump to tool from CTA ---------- */
document.querySelectorAll("[data-jump-tool]").forEach(b => b.addEventListener("click", (e)=>{
  e.preventDefault();
  const tool = document.getElementById("tool");
  if (window.__lenis) window.__lenis.scrollTo(tool, { offset: -10 });
  else tool.scrollIntoView({ behavior:"smooth" });
  setTimeout(()=>$("#input") && $("#input").focus(), 700);
}));

/* ---------- live (mic) ---------- */
let recognition=null, listening=false, liveText="", interimText="";
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
function setStatus(){
  const st=$("#liveStatus");
  if (listening){ st.innerHTML='<span class="dot"></span>Listening…'; st.classList.add("listening-status"); $("#liveStage").classList.add("listening"); }
  else { st.innerHTML='<span class="dot"></span>'+(liveText?"Paused — tap to resume":"Tap to listen to a call or conversation"); st.classList.remove("listening-status"); $("#liveStage").classList.remove("listening"); }
}
function updateTranscript(){
  const t=$("#transcript");
  if (!liveText && !interimText){ t.innerHTML='<span class="placeholder">What\'s said will appear here as you listen…</span>'; return; }
  const r=analyze(liveText);
  t.innerHTML = highlightHTML(liveText, r.hits) + (interimText?' <span class="interim">'+esc(interimText)+'</span>':'');
  t.parentElement.scrollTop = t.parentElement.scrollHeight;
}
function renderLive(){ if (liveText) render(analyze(liveText), liveText, {live:true}); }
function liveIngest(chunk){ liveText=(liveText+" "+chunk).trim(); interimText=""; updateTranscript(); renderLive(); }
function startListening(){
  if (!SR){ const ns=$("#noSpeech"); ns.style.display="block"; ns.textContent="Live listening needs Chrome or Edge — your browser (or iPhone) doesn't support it. The 'Check a message' tab works everywhere."; return; }
  recognition=new SR(); recognition.continuous=true; recognition.interimResults=true; recognition.lang="en-US";
  recognition.onresult=(e)=>{ let interim=""; for (let i=e.resultIndex;i<e.results.length;i++){ const res=e.results[i]; if (res.isFinal) liveIngest(res[0].transcript.trim()); else interim+=res[0].transcript; } if (interim){ interimText=interim; updateTranscript(); } };
  recognition.onerror=(e)=>{ if (e.error==="not-allowed"||e.error==="service-not-allowed"){ listening=false; const ns=$("#noSpeech"); ns.style.display="block"; ns.textContent="Microphone blocked. Allow mic access for this site (icon in the address bar), then tap the mic again."; setStatus(); } };
  recognition.onend=()=>{ if (listening){ try{ recognition.start(); }catch(_){} } };
  try{ recognition.start(); listening=true; }catch(_){ listening=false; }
  $("#noSpeech").style.display="none"; setStatus();
}
function stopListening(){ listening=false; if (recognition){ try{ recognition.stop(); }catch(_){} } setStatus(); }
const micBtn=$("#micBtn"); if (micBtn) micBtn.addEventListener("click", ()=>{ listening?stopListening():startListening(); });
const resetLive=$("#resetLive"); if (resetLive) resetLive.addEventListener("click", ()=>{ liveText=""; interimText=""; $("#results").classList.remove("on"); updateTranscript(); setStatus(); });
setStatus();

/* expose for verification */
window.analyze = analyze; window.DEMOS = DEMOS; window.render = render;
