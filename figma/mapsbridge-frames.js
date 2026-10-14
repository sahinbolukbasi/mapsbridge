// MapsBridge — Gerçek Uygulama Tasarımı
// Tüm sayfalar gerçek kaynak koddan alınmıştır

// ── Renk Paleti (Gerçek CSS Değerlerinden) ──────────────────────────────────
const C = {
  // Light Theme
  bg:       { r:.973, g:.969, b:.957 },   // #f8f7f4
  surface:  { r:1,    g:1,    b:1    },   // #ffffff
  surfAlt:  { r:.949, g:.953, b:.945 },   // #f2f3f1
  border:   { r:.867, g:.886, b:.855 },   // #dde2da
  text:     { r:.125, g:.180, b:.161 },   // #202e29
  muted:    { r:.369, g:.427, b:.396 },   // #5e6d65
  brand:    { r:.157, g:.412, b:.329 },   // #286954
  brandDk:  { r:.004, g:.212, b:.157 },   // #013628
  em:       { r:.063, g:.725, b:.506 },   // #10b981 emerald
  emLight:  { r:.204, g:.831, b:.604 },   // #34d399
  emBg:     { r:.925, g:.992, b:.961 },   // #ecfdf5
  // Dark Theme (AI page)
  dkBg:     { r:.039, g:.059, b:.114 },   // #0a0f1d
  dkSurf:   { r:.067, g:.098, b:.153 },   // #111927
  dkSurf2:  { r:.082, g:.122, b:.188 },   // #141f30
  dkText:   { r:.973, g:.980, b:.988 },   // #f8fafc
  dkMuted:  { r:.580, g:.639, b:.718 },   // #94a3b8
  dkBorder: { r:.118, g:.161, b:.227 },   // #1e293b
  dkEm:     { r:.063, g:.725, b:.506 },   // #10b981
  // Utils
  white:    { r:1, g:1, b:1 },
  red:      { r:.729, g:.098, b:.098 },   // #ba1a1a
  gBlue:    { r:.259, g:.522, b:.957 },   // Google Blue #4285F4
  none:     null,
};

let FONT = "Inter";

// ── Primitive Helpers ────────────────────────────────────────────────────────
function rect(p,x,y,w,h,col,r,op){
  const n=figma.createRectangle();
  n.x=x; n.y=y; n.resize(w,h);
  n.fills=col?[{type:"SOLID",color:col,opacity:op||1}]:[];
  if(r)n.cornerRadius=r;
  p.appendChild(n); return n;
}

function fr(p,x,y,w,h,col,r,clips){
  const n=figma.createFrame();
  n.x=x; n.y=y; n.resize(w,h);
  n.fills=col?[{type:"SOLID",color:col}]:[];
  if(r)n.cornerRadius=r;
  n.clipsContent=clips!==false;
  p.appendChild(n); return n;
}

function tx(p,x,y,str,size,wt,col,maxW){
  const n=figma.createText();
  const style=wt>=700?"Bold":wt>=600?"SemiBold":wt>=500?"Medium":"Regular";
  try{n.fontName={family:FONT,style};}catch{n.fontName={family:FONT,style:"Regular"};}
  n.fontSize=size||14;
  n.characters=String(str);
  if(col)n.fills=[{type:"SOLID",color:col}];
  if(maxW){n.textAutoResize="HEIGHT";n.resize(maxW,500);}
  n.x=x; n.y=y;
  p.appendChild(n); return n;
}

function cX(n,p){n.x=(p.width-n.width)/2;}
function cY(n,p){n.y=(p.height-n.height)/2;}
function cXY(n,p){cX(n,p);cY(n,p);}
function stroke(n,col,w){n.strokes=[{type:"SOLID",color:col}];n.strokeWeight=w||1;n.strokeAlign="INSIDE";}
function shadow(n,a,dy,blur){n.effects=[{type:"DROP_SHADOW",color:{r:0,g:0,b:0,a:a||.08},offset:{x:0,y:dy||4},radius:blur||16,visible:true,blendMode:"NORMAL"}];}

// ── Component: Pill/Badge ────────────────────────────────────────────────────
function pill(p,x,y,w,h,bg,label,lCol,fs){
  const f=fr(p,x,y,w,h,bg,999);
  if(label){const t2=tx(f,0,0,label,fs||11,600,lCol||C.white);cXY(t2,f);}
  return f;
}

// ── Component: Button ────────────────────────────────────────────────────────
function btn(p,x,y,w,h,bg,label,lCol,strokeCol,radius){
  const f=fr(p,x,y,w,h,bg,radius||10);
  if(strokeCol)stroke(f,strokeCol,1.5);
  if(label){const t2=tx(f,0,0,label,13,600,lCol||C.white);cXY(t2,f);}
  return f;
}

// ── Component: Input Field ───────────────────────────────────────────────────
function input(p,x,y,w,placeholder,focused,dark){
  const bg=dark?C.dkSurf2:C.surface;
  const bd=dark?C.dkBorder:C.border;
  const ph=dark?C.dkMuted:C.muted;
  const f=fr(p,x,y,w,48,bg,10);
  stroke(f,focused?(dark?C.dkEm:C.em):bd,1);
  tx(f,48,15,placeholder,13,400,ph);
  rect(f,14,14,20,20,focused?(dark?C.dkEm:C.em),4);
  return f;
}

// ── Component: Web NavBar ────────────────────────────────────────────────────
// Matches header-nav.tsx: logo + 5 nav links + login+register OR profile pill + lang toggle
function webNavbar(p,w,loggedIn){
  const nav=fr(p,0,0,w,68,C.surface,0,false);
  nav.name="NavBar";
  stroke(nav,C.border,1);
  shadow(nav,.05,1,8);

  // Logo
  const logo=fr(nav,24,14,160,40,C.none,8,false);
  // Icon circle
  const ic=fr(logo,0,6,28,28,C.emBg,8);
  tx(ic,4,4,"⊕",16,700,C.brand);
  // Brand text
  const bText=tx(logo,34,10,"Maps",16,700,C.text);
  const bText2=tx(logo,34+bText.width,10,"Bridge",16,700,C.em);

  // Nav links (Keşfet, Seyahat Masası, AI Asistan, Mobil Uygulamalar, Topluluk)
  const links=["Keşfet","Seyahat Masası","AI Asistan","Mobil Uygulamalar","Topluluk"];
  let lx=210;
  links.forEach((lbl,i)=>{
    const lf=fr(nav,lx,16,0,36,C.none,8,false);
    const lt=tx(lf,12,9,lbl,13,i===0?600:400,i===0?C.brand:C.muted);
    lf.resize(lt.width+24,36);
    if(i===0){lf.fills=[{type:"SOLID",color:C.emBg}];}
    lx+=lf.width+4;
  });
  if(loggedIn){
    ["Mesajlar","Rotalarım"].forEach(lbl=>{
      const lf=fr(nav,lx,16,0,36,C.none,8,false);
      const lt=tx(lf,12,9,lbl,13,400,C.muted);
      lf.resize(lt.width+24,36);
      lx+=lf.width+4;
    });
  }

  // Right side
  if(loggedIn){
    // Profile pill
    const pp=fr(nav,w-220,10,178,48,C.bg,10);
    stroke(pp,C.border,1);
    const av=fr(pp,8,8,32,32,C.emBg,999);
    tx(av,6,6,"JD",11,700,C.brand);
    // green online dot
    rect(pp,38,34,10,10,C.em,999);
    tx(pp,50,8,"Ahmet Y.",13,600,C.text);
    tx(pp,50,24,"PRO KAŞİF",10,700,C.em);
    // chevron
    tx(pp,148,14,"∨",14,400,C.muted);
  } else {
    // Login + Register
    btn(nav,w-204,16,88,36,C.none,"Giriş yap",C.brand,C.border);
    btn(nav,w-108,16,84,36,C.em,"Üye ol",C.white);
  }
  // Language toggle
  const ltBtn=fr(nav,w-220+(loggedIn?-12:208),16,56,36,C.surfAlt,8);
  tx(ltBtn,10,9,"TR",12,600,C.muted);
  tx(ltBtn,28,9,"↔",12,400,C.muted);

  return nav;
}

// ── Component: Section Header ────────────────────────────────────────────────
function sectionHeader(p,x,y,w,eyebrow,title,desc){
  const f=fr(p,x,y,w,110,C.none,0,false);
  const eb=fr(f,0,0,0,26,C.emBg,999);
  const et=tx(eb,12,5,eyebrow,12,500,C.brand);
  eb.resize(et.width+24,26);
  const t1=tx(f,0,36,title,28,700,C.text,w);
  const t2=tx(f,0,74,desc,14,400,C.muted,w);
  t2;
  p.appendChild(f);
  return f;
}

// ── Web Screen: Ana Sayfa (Home) ─────────────────────────────────────────────
function webHome(){
  const W=1440, H=3800;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Web — Ana Sayfa";
  webNavbar(f,W,false);

  // ── Hero Section ──
  const hero=fr(f,0,68,W,720,C.surface,0,false);
  hero.name="Hero";
  // Ambient glows
  const g1=rect(hero,100,80,560,400,C.emBg,999,.5);
  g1.effects=[{type:"LAYER_BLUR",radius:120,visible:true}];
  const g2=rect(hero,W-460,120,400,360,{r:.941,g:.976,b:.91},999,.4);
  g2.effects=[{type:"LAYER_BLUR",radius:100,visible:true}];

  // Left column
  const left=fr(hero,80,80,600,560,C.none,0,false);
  // Badge
  const badge=fr(left,0,0,300,30,C.emBg,999);
  rect(badge,12,10,10,10,C.em,999);
  tx(badge,30,7,"Yeni Nesil Akıllı Seyahat Platformu",11,600,C.brand);
  // Headline
  tx(left,0,46,"Seyahatini",48,700,C.text,580);
  tx(left,0,98,"Akıllıca Planla",48,700,C.em,580);
  // Sub
  tx(left,0,160,"Yapay zeka destekli rota planlama, çok günlük harita masası,",15,400,C.muted,580);
  tx(left,0,182,"6 haneli paylaşım kodu ile MapsBridge'i kullanmaya başla.",15,400,C.muted,580);
  // CTA buttons
  const cta1=btn(left,0,224,200,50,C.em,"Ücretsiz Başla ⚡",C.white);
  const cta2=fr(left,212,224,180,50,C.surface,10);
  stroke(cta2,C.border,1.5);
  tx(cta2,14,16,"▶ Nasıl Çalışır?",14,500,C.brand);
  // Search bar
  const sb=fr(left,0,294,580,56,C.surface,12);
  stroke(sb,C.border,1.5);
  shadow(sb,.08,2,12);
  const sIcon=fr(sb,12,12,32,32,C.emBg,999);
  tx(sIcon,6,6,"✦",14,600,C.em);
  tx(sb,52,19,"İstanbul'da 3 günlük rota oluştur...",13,400,C.muted);
  btn(sb,450,8,120,40,C.em,"Rota Oluştur",C.white,null,8);
  // Trust tags
  ["✓ Kredi kartı gerekmez","✓ 60 saniyede hazır","✓ Offline çalışır"].forEach((tag,i)=>{
    tx(left,i===0?0:i===1?170:330,366,tag,12,500,C.muted);
  });

  // Right column — mockup card
  const mock=fr(hero,740,60,620,600,C.surface,16);
  mock.name="ProductMockup";
  stroke(mock,C.border,1);
  shadow(mock,.12,8,32);
  // Tab bar
  const tabs=fr(mock,0,0,620,52,C.bg,0,false);
  ["🧠 AI Asistan","🗺️ Harita Masası","📱 Paylaşım"].forEach((tab,i)=>{
    const active=i===1;
    const tf=fr(tabs,16+i*200,8,188,36,active?C.surface:C.none,8);
    if(active)shadow(tf,.08,2,8);
    tx(tf,16,10,tab,13,active?600:400,active?C.text:C.muted);
  });
  // Map canvas area
  const mapArea=fr(mock,16,60,588,280,C.bg,12);
  rect(mapArea,0,0,588,280,{r:.851,g:.882,b:.949},0,.3);
  // Route line
  const rl=figma.createLine();
  rl.x=80; rl.y=180; rl.resize(420,0);
  rl.strokes=[{type:"SOLID",color:C.em}];
  rl.strokeWeight=2;
  mapArea.appendChild(rl);
  // Waypoints
  [[100,100,"1","Colosseum"],[220,60,"2","Pantheon"],[380,150,"3","Trastevere"]].forEach(([x,y,n,lbl])=>{
    const wp=fr(mapArea,Number(x)-14,Number(y)-14,28,28,C.em,999);
    tx(wp,6,5,String(n),12,700,C.white);
    const wl=fr(mapArea,Number(x)-30,Number(y)+18,100,22,C.surface,4);
    shadow(wl,.1,2,6);
    tx(wl,6,4,String(lbl),10,600,C.text);
  });
  // Share badge
  const share=fr(mapArea,380,20,120,26,C.surface,8);
  shadow(share,.1,2,6);
  tx(share,8,5,"📤 Kod: RM-841",10,600,C.brand);
  // Itinerary below map
  tx(mock,16,350,"Roma — 3 Günlük Klasik Tur",16,700,C.text);
  tx(mock,16,374,"Colosseum · Pantheon · Trastevere · Vatikan",13,400,C.muted);
  // Timeline stops
  [[0,"09:30","Colosseum","Antik amfi tiyatro"],[1,"13:15","Pantheon","Roma'nın gözü"],[2,"18:00","Trastevere","Otantik mahalle"]].forEach(([i,time,name,desc])=>{
    const sy=400+Number(i)*58;
    rect(mock,16,sy+8,4,40,C.em,2);
    tx(mock,28,sy,String(name),13,600,C.text);
    tx(mock,28,sy+18,String(desc),12,400,C.muted);
    const tb=fr(mock,500,sy,80,24,C.emBg,6);
    tx(tb,8,5,String(time),11,700,C.em);
  });
  btn(mock,16,560,170,40,C.em,"📤 Kodu Paylaş",C.white,null,8);
  btn(mock,196,560,160,40,C.surface,"🗺️ Haritada Aç",C.brand,C.border,8);

  // ── Trust Strip ──
  const ts=fr(f,0,788,W,100,C.surface,0,false);
  ts.name="TrustStrip";
  stroke(ts,C.border,1);
  tx(ts,80,20,"NEDEN MAPSBRIDGE",11,700,C.em);
  tx(ts,80,38,"Seyahat planlamanın geleceği burada",18,700,C.text);
  [[0,"4","Temel Modül"],[1,"120+","Ülke"],[2,"60sn","Ort. Plan Süresi"],[3,"%100","Offline Hazır"]].forEach(([i,val,lbl])=>{
    const mx=700+Number(i)*180;
    tx(ts,mx,18,String(val),28,700,Number(i)===2?C.em:C.text);
    tx(ts,mx,54,String(lbl),12,400,C.muted);
  });

  // ── Features Bento Grid ──
  const bentoY=888;
  tx(f,80,bentoY+20,"PLATFORM",11,700,C.em);
  tx(f,80,bentoY+40,"Akıllı Seyahat Sistemi",28,700,C.text);
  tx(f,80,bentoY+76,"Üç güçlü modülü tek platformda buluşturan seyahat deneyimi.",14,400,C.muted,600);

  // Feature cards in bento grid
  const bCards=[
    {x:80,y:bentoY+140,w:800,h:200,title:"AI Rota Motoru",sub:"AWS Bedrock",desc:"Seyahat profiline, bütçene ve ilgi alanlarına göre optimize rotalar."},
    {x:900,y:bentoY+140,w:460,h:200,title:"Çok Günlü Harita Masası",sub:"OSRM Optimize",desc:"Günlere ve gruplara göre sürükle-bırak rota organizasyonu."},
    {x:80,y:bentoY+360,w:460,h:200,title:"6 Haneli Paylaşım Kodu",sub:"Sıfır Kurulum",desc:"RM-841 gibi kodlarla rotaları anında paylaş."},
    {x:560,y:bentoY+360,w:800,h:200,title:"Gizlilik & Offline Mod",sub:"Şifreli Depolama",desc:"Konum takibi yok, veriler cihazında şifreli."},
  ];
  bCards.forEach(bc=>{
    const bf=fr(f,bc.x,bc.y,bc.w,bc.h,C.surface,16);
    stroke(bf,C.border,1);
    shadow(bf,.06,2,16);
    const icon=fr(bf,20,20,44,44,C.emBg,12);
    tx(icon,10,10,"✦",20,700,C.em);
    tx(bf,76,24,bc.title,16,700,C.text);
    const st=fr(bf,76,44,0,20,C.emBg,6);
    const stTx=tx(st,8,3,bc.sub,10,700,C.em);
    st.resize(stTx.width+16,20);
    tx(bf,20,84,bc.desc,13,400,C.muted,bc.w-40);
  });

  // ── How It Works (4 Steps) ──
  const hiw=bentoY+600;
  tx(f,80,hiw+20,"NASIL ÇALIŞIR",11,700,C.em);
  tx(f,80,hiw+40,"4 Adımda Planla, Paylaş, Keşfet",28,700,C.text);

  [["1","💬","AI ile Konuş","Nereye gitmek istediğini söyle.","AI önerileri hazırlandı"],
   ["2","🧠","Rota Oluşturulur","Yapay zeka yerler, süreler ve güzergahı planlar.","OSRM optimize"],
   ["3","✏️","Özelleştir","Durakları sürükle, günlere böl, grup oluştur.","Drag & Drop"],
   ["4","📤","Paylaş","RM-841 kodunu gönder, hepsi hazır.","Kod: RM-841"]
  ].forEach(([num,icon,title,desc,chip],i)=>{
    const sx=80+i*340;
    const sc=fr(f,sx,hiw+120,316,220,C.surface,16);
    stroke(sc,C.border,1);
    shadow(sc,.05,2,12);
    // step number circle
    const snum=fr(sc,16,16,36,36,C.emBg,999);
    tx(snum,8,8,String(num),16,700,C.em);
    // icon badge
    const sib=fr(sc,60,16,40,40,C.bg,10);
    tx(sib,8,8,String(icon),18,400,C.text);
    tx(sc,16,68,String(title),15,700,C.text);
    tx(sc,16,90,String(desc),12,400,C.muted,280);
    // chip
    const chipF=fr(sc,16,150,0,24,C.emBg,6);
    const chipT=tx(chipF,8,4,String(chip),10,600,C.brand);
    chipF.resize(chipT.width+16,24);
  });

  // ── Comparison Section ──
  const cmp=hiw+380;
  tx(f,80,cmp+20,"KARŞILAŞTIRMA",11,700,C.em);
  tx(f,80,cmp+40,"Neden MapsBridge?",28,700,C.text);
  const cCard=fr(f,80,cmp+100,1280,300,C.surface,16);
  stroke(cCard,C.border,1);
  shadow(cCard,.06,2,16);
  // Traditional column
  const tc=fr(cCard,0,0,620,300,{r:.999,g:.980,b:.980},12,false);
  tx(tc,24,24,"✕ Geleneksel Planlama",18,700,{r:.576,g:.098,b:.098});
  tx(tc,24,56,"Manuel araştırma, kayıp zamanlar, güncel olmayan bilgiler.",13,400,{r:.576,g:.098,b:.098},560);
  ["Google'da saatler geçirir","Kopyala-yapıştır kaosuna döner","Güncellenemeyen PDF'ler","Grup koordinasyonunda kaos"].forEach((item,i)=>{
    tx(tc,24,100+i*40,"✗ "+item,13,400,{r:.576,g:.098,b:.098},560);
  });
  tx(tc,24,264,"Ortalama hazırlık süresi: 4-6 saat",12,600,{r:.576,g:.098,b:.098});
  // MapsBridge column
  const mc2=fr(cCard,640,0,640,300,{r:.949,g:.996,b:.973},12,false);
  tx(mc2,24,24,"✓ MapsBridge ile",18,700,C.brand);
  tx(mc2,24,56,"AI destekli rota, gerçek zamanlı senkronizasyon, offline çalışma.",13,400,C.brand,580);
  ["60 saniyede eksiksiz rota","AI optimize edilmiş güzergah","6 kodla anında paylaşım","Çevrimdışı tam destek"].forEach((item,i)=>{
    tx(mc2,24,100+i*40,"✓ "+item,13,400,C.brand,580);
  });
  tx(mc2,24,264,"Ortalama hazırlık süresi: 60 saniye",12,700,C.em);

  // ── Community Section ──
  const comm=cmp+440;
  const csec=fr(f,0,comm,W,480,C.bg,0,false);
  csec.name="CommunitySection";
  tx(csec,80,40,"TOPLULUK",11,700,C.em);
  tx(csec,80,60,"Canlı Gezgin Topluluğu",28,700,C.text);
  tx(csec,80,96,"Gerçek seyahat deneyimleri, doğrulanmış rotalar.",14,400,C.muted,500);

  // Community post cards
  const posts=[
    {user:"Emre D.",handle:"@emredoğan",time:"2s","loc":"İstanbul, TR",cap:"Boğaz'ın büyüsünü yaşamak için... harika 3 günlük rota!",likes:"124",comments:"18"},
    {user:"Ceren Y.",handle:"@cerenyılmaz",time:"5dk","loc":"Roma, İtalya",cap:"Colosseum sabah 8'de çok daha sakin. Kesinlikle öneririm!",likes:"89",comments:"12"},
    {user:"Mert K.",handle:"@mertkaya",time:"1s","loc":"Kapadokya, TR",cap:"Balon turu + peri bacaları + yerel şarap. Mükemmel kombinasyon.",likes:"203",comments:"31"},
  ];
  posts.forEach((post,i)=>{
    const px=80+i*420;
    const pc=fr(csec,px,140,400,270,C.surface,12);
    stroke(pc,C.border,1);
    shadow(pc,.06,2,12);
    // Author
    const av2=fr(pc,16,16,36,36,C.emBg,999);
    tx(av2,10,10,(post.user.slice(0,2)),13,700,C.brand);
    tx(pc,60,16,post.user,14,600,C.text);
    tx(pc,60,34,post.handle+" · "+post.time,11,400,C.muted);
    // Location pill
    const loc=fr(pc,16,64,0,22,C.bg,6);
    const locT=tx(loc,8,4,"📍 "+post.loc,10,500,C.muted);
    loc.resize(locT.width+16,22);
    // Caption
    tx(pc,16,96,post.cap,13,400,C.text,360);
    // Route pill
    const rp=fr(pc,16,160,368,44,C.bg,8);
    stroke(rp,C.border,1);
    tx(rp,12,6,"🗺️",18,400,C.em);
    tx(rp,40,6,"Rota · 5 Durak",12,600,C.text);
    const code=fr(rp,290,10,70,24,C.em,6);
    tx(code,8,5,"RM-841",10,700,C.white);
    // Footer
    tx(pc,16,216,"♥ "+post.likes,12,500,C.muted);
    tx(pc,70,216,"💬 "+post.comments,12,500,C.muted);
    btn(pc,280,210,100,28,C.emBg,"Rotayı Aç",C.brand,null,6);
  });

  // ── CTA Section ──
  const ctaSec=comm+520;
  const ctaCard=fr(f,80,ctaSec,1280,200,C.brand,24);
  shadow(ctaCard,.15,8,32);
  rect(ctaCard,0,0,600,200,C.brandDk,24,.4);
  tx(ctaCard,60,30,"HEMEN BAŞLA",11,700,{r:.506,g:.878,b:.718});
  tx(ctaCard,60,50,"Rotanı Planlamaya Başla",36,700,C.white,620);
  tx(ctaCard,60,102,"Ücretsiz hesap aç, AI asistanla ilk rotanı oluştur.",15,400,{r:.769,g:.914,b:.855},600);
  btn(ctaCard,60,148,200,48,C.em,"Ücretsiz Başla →",C.white,null,10);
  btn(ctaCard,272,148,180,48,{r:.18,g:.47,b:.37},"Kodu Gir",C.white,null,10);

  // Footer
  const footer=fr(f,0,ctaSec+250,W,200,C.text,0,false);
  footer.name="Footer";
  // Logo area
  const fl=fr(footer,80,40,200,40,C.none,0,false);
  tx(fl,0,0,"Maps",20,700,C.white);
  tx(fl,54,0,"Bridge",20,700,C.emLight);
  tx(footer,80,90,"Akıllı seyahat platformu.",13,400,C.dkMuted);
  // Links columns
  [["Ürün","AI Asistan","Harita Masası","Topluluk"],
   ["Şirket","Blog","Gizlilik","Kullanım Koşulları"],
   ["Destek","SSS","Nasıl Çalışır?","İletişim"]].forEach((col,ci)=>{
    const cx=380+ci*200;
    tx(footer,cx,36,col[0],12,700,C.white);
    col.slice(1).forEach((item,ii)=>{
      tx(footer,cx,58+ii*22,item,12,400,C.dkMuted);
    });
  });
  tx(footer,80,170,"© 2024 MapsBridge. Tüm hakları saklıdır.",12,400,C.dkMuted);

  return f;
}

// ── Web Screen: Login ────────────────────────────────────────────────────────
function webLogin(){
  const W=1440, H=900;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Web — Giriş Yap";
  webNavbar(f,W,false);

  // Split layout
  // Left: Form panel
  const left=fr(f,0,68,720,832,C.surface,0,false);
  left.name="LoginFormPanel";

  // Glow bg
  const glow=rect(left,60,100,500,400,C.emBg,999,.3);
  glow.effects=[{type:"LAYER_BLUR",radius:80,visible:true}];

  const form=fr(left,160,80,440,750,C.none,0,false);
  // Badge
  const wb=fr(form,0,0,200,28,C.emBg,999);
  rect(wb,10,10,8,8,C.em,999);
  tx(wb,26,7,"TEKRAR HOŞ GELDİN",10,700,C.brand);
  // Title
  tx(form,0,44,"Giriş yap.",36,700,C.text);
  tx(form,0,90,"Kişisel rotalarına, kayıtlı duraklarına ve seyahat",14,400,C.muted,440);
  tx(form,0,110,"arkadaşlarına kaldığın yerden devam et.",14,400,C.muted,440);

  // Google btn
  const gbtn=fr(form,0,148,440,52,C.surface,10);
  stroke(gbtn,C.border,1.5);
  shadow(gbtn,.06,2,8);
  // Google G logo (4-color)
  const gG=fr(gbtn,12,12,28,28,C.none,4,false);
  rect(gG,0,0,14,14,C.gBlue,2);
  rect(gG,14,0,14,14,{r:.204,g:.659,b:.325},2);
  rect(gG,0,14,14,14,{r:.984,g:.737,b:.020},2);
  rect(gG,14,14,14,14,{r:.918,g:.263,b:.208},2);
  tx(gbtn,52,17,"Google ile Giriş Yap",14,600,C.text);

  // Apple btn
  const abtn=fr(form,0,208,440,52,C.text,10);
  tx(abtn,16,17," Apple ile Giriş Yap",14,600,C.white);

  // Divider
  rect(form,0,276,210,1,C.border);
  tx(form,164,267,"veya e-posta ile",12,400,C.muted);
  rect(form,246,276,194,1,C.border);

  // Email field
  tx(form,0,302,"E-posta",13,600,C.text);
  const ef=fr(form,0,322,440,52,C.surface,10);
  stroke(ef,C.border,1.5);
  tx(ef,16,17,"ornek@alanadi.com",13,400,C.muted);

  // Password field
  const pwRow=fr(form,0,390,440,20,C.none,0,false);
  tx(pwRow,0,0,"Şifre",13,600,C.text);
  tx(pwRow,350,0,"Şifremi unuttum",12,600,C.em);
  const pf=fr(form,0,416,440,52,C.surface,10);
  stroke(pf,C.border,1.5);
  tx(pf,16,17,"••••••••",16,400,C.muted);
  // Eye icon
  rect(pf,396,16,20,20,C.muted,4,.6);

  // Remember me
  rect(form,0,480,16,16,C.emBg,4);
  rect(form,4,484,8,8,C.em,2);
  tx(form,24,479,"Beni bu cihazda hatırla",13,400,C.muted);

  // Submit
  const sub=btn(form,0,514,440,52,C.em,"Giriş yap →",C.white,null,10);

  // Register CTA
  const regBox=fr(form,0,584,440,100,C.bg,12);
  stroke(regBox,C.border,1);
  const rTop=fr(regBox,0,0,440,32,C.none,0,false);
  tx(rTop,16,8,"HESABIN YOK MU?",11,700,C.brand);
  tx(rTop,340,8,"Ücretsiz üye ol →",12,600,C.em);
  tx(regBox,16,38,"Adresini ve rotalarını birkaç saniyede paylaşmaya başla.",13,500,C.text,400);
  tx(regBox,16,60,"✓ Kayıt tamamen ücretsiz. Gizli takip yoktur.",12,400,C.muted,400);

  // Right: Hero panel (Kapadokya bg simulation)
  const right=fr(f,720,68,720,832,C.none,0,false);
  right.name="LoginHeroPanel";
  // Background gradient (simulating Kapadokya)
  rect(right,0,0,720,832,{r:.161,g:.290,b:.361},0,.85);
  rect(right,0,0,720,832,{r:.004,g:.059,b:.035},0,.4);
  // Gradient overlay bottom
  const grad=figma.createRectangle();
  grad.x=0; grad.y=480; grad.resize(720,352);
  grad.fills=[{type:"GRADIENT_LINEAR",gradientTransform:[[0,1,0],[0,-1,1]],gradientStops:[{position:0,color:{r:.004,g:.035,b:.022,a:.9}},{position:1,color:{r:.004,g:.035,b:.022,a:0}}]}];
  right.appendChild(grad);

  // Top pill
  const topP=fr(right,20,24,440,40,C.surface,999);
  shadow(topP,.15,4,12);
  tx(topP,16,12,"🧭 Son Ziyaret:",12,600,C.text);
  tx(topP,110,12,"Roma Rönesans & Antik Miras",12,400,C.muted);
  const codePill=fr(topP,370,10,60,20,{r:.855,g:.980,b:.921},999);
  tx(codePill,8,4,"RM-841",9,700,C.brand);

  // Metrics card
  const metricsBox=fr(right,20,680,330,80,{r:1,g:1,b:1,a:.15},12);
  metricsBox.fills=[{type:"SOLID",color:C.surface,opacity:.15}];
  stroke(metricsBox,{r:1,g:1,b:1},1);
  // Semi-transparent glass
  tx(metricsBox,20,12,"140K+",28,700,C.white);
  tx(metricsBox,20,44,"Kayıtlı Gezgin",12,400,{r:.8,g:.9,b:.85});
  tx(metricsBox,170,12,"500K+",28,700,C.emLight);
  tx(metricsBox,170,44,"Canlı Keşif Noktası",12,400,{r:.8,g:.9,b:.85});

  // Testimonial card
  const testBox=fr(right,20,570,600,100,C.surface,12);
  shadow(testBox,.2,4,16);
  testBox.fills=[{type:"SOLID",color:C.surface,opacity:.9}];
  // Stars
  ["★","★","★","★","★"].forEach((_,si)=>{tx(testBox,16+si*18,12,"★",14,700,C.em);});
  tx(testBox,16,36,'"MapsBridge sayesinde İtalya seyahatimiz tek bir aksama olmadan',12,400,C.text,560);
  tx(testBox,16,52,"tamamlandı. 6 haneli kodla tüm grup anında aynı haritadaydı.\"",12,400,C.text,560);
  tx(testBox,16,76,"— Elif D.",12,700,C.text);
  tx(testBox,440,76,"📍 Toskana & Roma Rotası",11,400,C.muted);

  return f;
}

// ── Web Screen: AI Asistan (Dark) ────────────────────────────────────────────
function webAI(){
  const W=1440, H=900;
  const f=fr(figma.currentPage,0,0,W,H,C.dkBg,0,false);
  f.name="Web — AI Asistan";
  // Dark navbar
  const nav=fr(f,0,0,W,68,C.dkSurf,0,false);
  stroke(nav,C.dkBorder,1);
  tx(nav,24,26,"Maps",16,700,C.dkText);
  tx(nav,70,26,"Bridge",16,700,C.dkEm);
  ["Keşfet","Seyahat Masası","AI Asistan","Topluluk"].forEach((lbl,i)=>{
    const active=i===2;
    const lf=fr(nav,200+i*140,16,130,36,active?{r:.063,g:.725,b:.506,a:.15}:C.none,8);
    lf.fills=active?[{type:"SOLID",color:C.dkEm,opacity:.15}]:[];
    tx(lf,12,10,lbl,13,active?600:400,active?C.dkEm:C.dkMuted);
  });
  btn(nav,W-200,16,80,36,C.dkEm,"Giriş yap",C.white,null,8);

  // Left sidebar
  const sidebar=fr(f,0,68,260,832,C.dkSurf,0,false);
  sidebar.name="AISidebar";
  stroke(sidebar,C.dkBorder,1);
  // New chat btn
  const newBtn=fr(sidebar,12,16,236,40,C.dkEm,8);
  tx(newBtn,16,12,"+ Yeni Sohbet",14,600,C.white);
  // Section label
  tx(sidebar,12,68,"Sohbetlerin",11,700,C.dkMuted);
  // Session items
  ["Roma 3 gün sanat & lezzet","Paris müze & cafe turu","İstanbul Boğaz rotası","Barcelona Gaudi & tapas","Yeni bir seyahat..."].forEach((s,i)=>{
    const active=i===0;
    const sf=fr(sidebar,8,90+i*52,244,44,active?C.dkSurf2:C.none,8);
    if(active)stroke(sf,C.dkBorder,1);
    tx(sf,12,8,s,12,active?600:400,active?C.dkText:C.dkMuted,200);
    tx(sf,12,28,active?"Aktif":"2 gün önce",10,400,C.dkMuted);
  });
  // Quota card
  const quota=fr(sidebar,8,360,244,100,C.dkSurf2,12);
  stroke(quota,C.dkBorder,1);
  tx(quota,12,12,"💰 245 Kredi",14,700,C.dkEm);
  tx(quota,12,34,"Danışmanlık ücretsiz",12,400,C.dkMuted,220);
  tx(quota,12,52,"Sohbet 1 · Rota 5 kredi",11,400,C.dkMuted,220);
  btn(quota,12,72,120,24,C.dkEm,"+ Kredi Yükle",C.white,null,6);

  // Center chat section
  const chat=fr(f,260,68,820,832,C.dkBg,0,false);
  chat.name="AIChatSection";

  // Chat header
  const ch=fr(chat,0,0,820,64,C.dkSurf,0,false);
  stroke(ch,C.dkBorder,1);
  tx(ch,20,12,"Seyahatini birlikte tasarlayalım",16,700,C.dkText);
  tx(ch,20,36,"Önce seni tanıyalım, sonra yerleri araştırıp planlayalım.",12,400,C.dkMuted);
  btn(ch,660,14,140,36,C.dkSurf2,"Rota Paneli Aç",C.dkMuted,C.dkBorder,8);

  // Active trip banner
  const atb=fr(chat,0,64,820,48,{r:.063,g:.725,b:.506,a:.1},0,false);
  atb.fills=[{type:"SOLID",color:C.dkEm,opacity:.1}];
  stroke(atb,C.dkEm,1);
  tx(atb,16,14,"🗺️ Aktif Rota:",12,700,C.dkEm);
  tx(atb,100,14,"Roma Rönesans Turu · İtalya · 3 Gün · 8 Durak",12,400,C.dkText);
  btn(atb,620,12,100,24,C.none,".MD Manifestosu",C.dkEm,C.dkEm,6);
  btn(atb,728,12,76,24,C.dkEm,"Haritada Aç",C.white,null,6);

  // Welcome hub / messages area
  const feed=fr(chat,0,112,820,560,C.dkBg,0,false);

  // Destination grid title
  tx(feed,20,20,"🛫 Popüler Destinasyonlar",13,700,C.dkText);
  const destinations=[
    ["🇮🇹","Roma","İtalya"],["🇫🇷","Paris","Fransa"],["🇹🇷","İstanbul","Türkiye"],["🇪🇸","Barcelona","İspanya"],
    ["🇳🇱","Amsterdam","Hollanda"],["🇹🇷","Kapadokya","Türkiye"],["🇬🇧","Londra","İngiltere"],["🇯🇵","Tokyo","Japonya"],
  ];
  destinations.forEach(([flag,city,country],i)=>{
    const dx=20+i%4*196;
    const dy=44+Math.floor(i/4)*68;
    const dc=fr(feed,dx,dy,186,58,C.dkSurf,10);
    stroke(dc,C.dkBorder,1);
    tx(dc,12,10,String(flag),22,400,C.dkText);
    tx(dc,48,10,String(city),13,600,C.dkText);
    tx(dc,48,28,String(country),11,400,C.dkMuted);
  });

  // Activity starters
  tx(feed,20,190,"🔍 Ne Yapmak İstersin?",13,700,C.dkText);
  [["🍽️","Yerel Lezzetler"],["🏨","Otel & Konaklama"],["☕","Kahve & Mekan"],
   ["📷","Fotoğraf Rotası"],["💰","Bütçe Gezisi"],["🌙","Gece Hayatı"]].forEach(([icon,lbl],i)=>{
    const ax=20+i%3*260;
    const ay=216+Math.floor(i/3)*64;
    const ac=fr(feed,ax,ay,248,56,C.dkSurf,8);
    stroke(ac,C.dkBorder,1);
    tx(ac,12,10,String(icon),22,400,C.dkText);
    tx(ac,48,10,String(lbl),13,600,C.dkText);
    tx(ac,48,28,"Öneri iste →",11,400,C.dkMuted);
  });

  // Sample chat messages
  // User message
  const ub=fr(feed,200,350,600,44,C.dkEm,12);
  ub.fills=[{type:"SOLID",color:C.brand,opacity:.8}];
  tx(ub,12,13,"Roma'da 3 günlük sanat ve lezzet odaklı bir rota oluştur",13,400,C.white,560);
  // AI response
  const ab=fr(feed,20,410,700,120,C.dkSurf2,12);
  stroke(ab,C.dkBorder,1);
  const aiBadge=fr(ab,12,12,120,20,{r:.063,g:.725,b:.506,a:.2},6);
  aiBadge.fills=[{type:"SOLID",color:C.dkEm,opacity:.2}];
  tx(aiBadge,8,4,"✦ AWS Bedrock",10,700,C.dkEm);
  tx(ab,12,40,"Roma için 3 günlük özel rota hazırladım! Colosseum, Pantheon ve",12,400,C.dkText,660);
  tx(ab,12,58,"Trastevere'yi kapsayan, yürüyüş ve metro ağırlıklı bir güzergah.",12,400,C.dkText,660);
  const routeBadge=fr(ab,12,84,200,28,C.dkSurf,8);
  stroke(routeBadge,C.dkBorder,1);
  tx(routeBadge,8,7,"🗺️ Roma Turu · 3 Gün · 9 Durak",11,600,C.dkEm);
  btn(ab,580,84,100,28,C.dkEm,"Rotayı Aç",C.white,null,6);

  // Composer area
  const comp=fr(chat,0,672,820,160,C.dkSurf,0,false);
  comp.name="ComposerArea";
  stroke(comp,C.dkBorder,1);
  // Route mode pills
  [["🌿","Sakin rota"],["🗺️","Klasik rota"],["✨","Kaşif rota"]].forEach(([icon,lbl],i)=>{
    const active=i===1;
    const pf=fr(comp,20+i*140,12,128,28,active?C.dkEm:C.dkSurf2,999);
    if(!active)stroke(pf,C.dkBorder,1);
    tx(pf,12,7,icon+" "+lbl,11,active?600:400,active?C.white:C.dkMuted);
  });
  // Training consent
  rect(comp,20,50,12,12,C.dkSurf2,3);
  tx(comp,38,49,"Bu mesajımın model geliştirme için kullanılmasına izin veriyorum.",11,400,C.dkMuted,640);
  // Input
  const inp=fr(comp,20,72,700,56,C.dkSurf2,10);
  stroke(inp,C.dkBorder,1.5);
  tx(inp,16,20,"Nereye gitmek istiyorsun, otel veya mekan önerisi mi lazım?",13,400,C.dkMuted);
  btn(comp,730,72,72,32,C.none,"🎤 Ses",C.dkMuted,C.dkBorder,8);
  btn(comp,730,110,72,32,C.dkEm,"Gönder",C.white,null,8);
  // Credits info
  const credBar=fr(comp,20,136,400,20,C.none,0,false);
  tx(credBar,0,0,"⚡ 245 Kredi",12,600,C.dkEm);
  tx(credBar,80,0,"· Sorular ücretsiz · Rota 5 kredi",11,400,C.dkMuted);

  // Right route panel
  const rp=fr(f,1080,68,360,832,C.dkSurf,0,false);
  rp.name="AIRoutePanel";
  stroke(rp,C.dkBorder,1);
  // Panel header
  const rph=fr(rp,0,0,360,52,C.dkSurf2,0,false);
  stroke(rph,C.dkBorder,1);
  tx(rph,16,16,"Oluşturulan Rota",14,700,C.dkText);
  btn(rph,300,12,48,28,C.none,"Kapat",C.dkMuted,C.dkBorder,6);
  // Route title
  tx(rp,16,60,"Roma Rönesans Turu",16,700,C.dkText);
  tx(rp,16,82,"İtalya · 3 gün · 9 durak",12,400,C.dkMuted);
  // Day tabs
  ["1. Gün","2. Gün","3. Gün"].forEach((d,i)=>{
    const active=i===0;
    const dt=fr(rp,16+i*110,108,100,30,active?C.dkEm:C.dkSurf2,8);
    tx(dt,12,8,d,12,active?600:400,active?C.white:C.dkMuted);
  });
  // Tab type tabs
  ["🗺️ Duraklar","🏨 Konaklama","✨ Keşif","🛡️ Güvenlik"].forEach((d,i)=>{
    const active=i===0;
    const dt=fr(rp,16+i*82,146,74,26,active?{r:.063,g:.725,b:.506,a:.2}:C.none,6);
    dt.fills=active?[{type:"SOLID",color:C.dkEm,opacity:.2}]:[];
    tx(dt,6,6,d,9,active?600:400,active?C.dkEm:C.dkMuted);
  });
  // Stops
  [["Colosseum","Antik amfi tiyatro","09:30"],
   ["Palatino Tepesi","Tarihi kalıntılar","11:00"],
   ["Öğle Yemeği: Hostaria","Yerel İtalyan mutfağı","13:00"],
   ["Forum Romanum","Antik Roma merkezi","14:30"],
   ["Trastevere","Otantik mahalle yürüyüşü","18:00"]].forEach(([name,desc,time],i)=>{
    const sy=180+i*90;
    rect(rp,24,sy,4,60,C.em,2);
    tx(rp,36,sy,String(name),13,600,C.dkText);
    tx(rp,36,sy+18,String(desc),11,400,C.dkMuted,280);
    const tf2=fr(rp,240,sy,100,22,{r:.063,g:.725,b:.506,a:.15},6);
    tf2.fills=[{type:"SOLID",color:C.dkEm,opacity:.15}];
    tx(tf2,8,5,String(time),10,700,C.dkEm);
    tx(rp,36,sy+38,"~1.2 km sonraki durağa",10,400,C.dkMuted);
  });
  // Footer actions
  const rfooter=fr(rp,0,780,360,52,C.dkSurf2,0,false);
  stroke(rfooter,C.dkBorder,1);
  btn(rfooter,16,10,160,32,C.dkEm,"🗺️ Haritada Aç",C.white,null,6);
  btn(rfooter,184,10,80,32,C.none,"Kopyala",C.dkMuted,C.dkBorder,6);
  btn(rfooter,272,10,72,32,C.none,"İndir",C.dkMuted,C.dkBorder,6);

  return f;
}

// ── Web Screen: Community ────────────────────────────────────────────────────
function webCommunity(){
  const W=1440, H=1200;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Web — Topluluk";
  webNavbar(f,W,true);

  // Layout: 860px main feed + 320px sidebar, centered
  const layout=fr(f,80,100,1280,1100,C.none,0,false);

  // Main feed
  const feed=fr(layout,0,0,860,1100,C.none,0,false);
  feed.name="CommunityFeed";

  // Feed header
  const fh=fr(feed,0,0,860,60,C.none,0,false);
  tx(fh,0,10,"Topluluk",24,700,C.text);
  rect(fh,130,20,10,10,C.em,999); // live dot
  btn(fh,760,12,88,36,C.em,"✏️ Paylaş",C.white,null,8);

  // Stories bar
  const stories=fr(feed,0,68,860,100,C.surface,12);
  stroke(stories,C.border,1);
  const storyData=[
    {init:"ED",name:"Emre D.",tag:"📸 Canlı"},
    {init:"CY",name:"Ceren Y.",tag:"İtalya"},
    {init:"MK",name:"Mert K.",tag:"Kapadokya"},
    {init:"AS",name:"Ayşe S.",tag:"🔴 Canlı"},
    {init:"BD",name:"Burak D.",tag:"Amsterdam"},
  ];
  storyData.forEach((st,i)=>{
    const sx=16+i*160;
    const av3=fr(stories,sx,12,48,48,C.emBg,999);
    stroke(av3,C.em,2.5);
    tx(av3,12,12,st.init,16,700,C.brand);
    tx(stories,sx+8,68,st.name,10,500,C.text);
    const stPill=fr(stories,sx+4,84,64,14,st.tag.includes("🔴")||st.tag.includes("Canlı")?C.em:C.emBg,999);
    tx(stPill,4,2,st.tag,8,600,st.tag.includes("🔴")||st.tag.includes("Canlı")?C.white:C.brand);
  });

  // Post cards
  const postData=[
    {user:"Emre Doğan",handle:"@emredogan",time:"2 saat",loc:"İstanbul, Türkiye",cap:"Boğaz kenarında sabah koşusu rotası paylaştım. Galata Köprüsü'nden Ortaköy'e kadar muhteşem manzaralar eşliğinde 8 km.",likes:"247",comments:"34",code:"MB-729"},
    {user:"Ceren Yılmaz",handle:"@cerenyilmaz",time:"5 saat",loc:"Roma, İtalya",cap:"Colosseum'u sabah 8'de ziyaret etmek en iyi karar oldu. Kalabalıktan önce, ışık mükemmeldi.",likes:"183",comments:"21",code:"RM-841"},
    {user:"Mert Kaya",handle:"@mertkaya",time:"1 gün",loc:"Kapadokya, Türkiye",cap:"Balon turu + Peri Bacaları + Zelve Açık Hava Müzesi. Üç günlük rota 47 kişi tarafından kullanıldı!",likes:"512",comments:"67",code:"KP-334"},
  ];
  postData.forEach((post,i)=>{
    const py=184+i*300;
    const pc=fr(feed,0,py,860,282,C.surface,16);
    stroke(pc,C.border,1);
    shadow(pc,.06,2,16);
    // Author
    const av4=fr(pc,16,16,44,44,C.emBg,999);
    tx(av4,10,12,post.user.split(" ").map(w=>w[0]).join(""),14,700,C.brand);
    tx(pc,68,16,post.user,15,600,C.text);
    const verBadge=fr(pc,68+tx(pc,68,35,post.handle+" · "+post.time,12,400,C.muted).width+72+8,16,20,20,C.emBg,999);
    tx(verBadge,3,3,"✓",10,700,C.em);
    // Location
    const locP2=fr(pc,16,72,0,24,C.bg,999);
    const locT2=tx(locP2,8,5,"📍 "+post.loc,11,500,C.muted);
    locP2.resize(locT2.width+16,24);
    // Caption
    tx(pc,16,106,post.cap,14,400,C.text,816);
    // Route pill
    const rp2=fr(pc,16,180,440,52,C.bg,12);
    stroke(rp2,C.border,1);
    tx(rp2,14,6,"🗺️",22,400,C.em);
    tx(rp2,48,6,"Seyahat Rotası",13,600,C.text);
    tx(rp2,48,24,"5 durak · 2.3 km · Yürüyüş",11,400,C.muted);
    const rc=fr(rp2,360,14,68,24,C.em,6);
    tx(rc,8,5,post.code,10,700,C.white);
    // Footer
    const pf2=fr(pc,0,244,860,38,C.bg,0,false);
    stroke(pf2,C.border,1);
    tx(pf2,16,11,"♥ "+post.likes,13,500,C.muted);
    tx(pf2,80,11,"💬 "+post.comments,13,500,C.muted);
    btn(pf2,700,7,144,24,C.emBg,"🗺️ Rotayı Aç",C.brand,null,6);
  });

  // Sidebar
  const sb2=fr(layout,880,0,340,1000,C.none,0,false);
  sb2.name="CommunitySidebar";

  // Categories card
  const cat=fr(sb2,0,0,340,240,C.surface,16);
  stroke(cat,C.border,1);
  shadow(cat,.05,2,12);
  const catHd=fr(cat,0,0,340,48,C.bg,0,false);
  tx(catHd,16,16,"🔍 Kategoriler",14,700,C.text);
  const cats=["🏛️ Tarih & Kültür","🍽️ Gastronomi","🌲 Doğa & Vadi","📷 Fotoğrafçılık","🎒 Sırt Çantalı","🏙️ Şehir Keşfi"];
  cats.forEach((c,i)=>{
    const cx2=i%2===0?16:180;
    const cy2=56+Math.floor(i/2)*52;
    const cf=fr(cat,cx2,cy2,148,40,C.bg,20);
    stroke(cf,C.border,1);
    tx(cf,10,12,c,12,400,C.text);
  });

  // Quick links card
  const links2=fr(sb2,0,256,340,200,C.surface,16);
  stroke(links2,C.border,1);
  shadow(links2,.05,2,12);
  tx(links2,16,16,"⚡ Hızlı Bağlantılar",14,700,C.text);
  [["🤖","AI Seyahat Asistanı","/ai/"],["🗺️","Seyahat Masası","/desk/"],["👤","Profilim","/profile/"]].forEach(([icon,lbl],i)=>{
    const lf2=fr(links2,16,52+i*48,308,40,C.bg,8);
    stroke(lf2,C.border,1);
    tx(lf2,12,12,icon+" "+lbl,13,500,C.text);
    tx(lf2,260,12,"→",13,400,C.muted);
  });

  // Share CTA card
  const cta3=fr(sb2,0,472,340,200,C.brand,16);
  tx(cta3,16,20,"🌍",32,400,C.white);
  tx(cta3,16,64,"Rotanı Paylaş",18,700,C.white);
  tx(cta3,16,90,"Kendi gezi rotalarını toplulukla paylaş, diğer gezginlere ilham ver.",13,400,{r:.8,g:.95,b:.88},308);
  btn(cta3,16,150,200,40,C.em,"Paylaşım Yap",C.white,null,8);

  return f;
}

// ── Web Screen: Profile ──────────────────────────────────────────────────────
function webProfile(){
  const W=1440, H=1100;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Web — Profil";
  webNavbar(f,W,true);

  // Cover photo
  const cover=fr(f,0,68,W,240,C.brand,0,false);
  rect(cover,0,0,W,240,C.brandDk,0,.4);
  rect(cover,0,0,W,240,{r:.004,g:.059,b:.157},0,.2);

  // Avatar + profile info
  const avBig=fr(f,100,240,100,100,C.emBg,999);
  stroke(avBig,C.surface,4);
  tx(avBig,24,26,"JD",32,700,C.brand);
  rect(f,196,320,16,16,C.em,999); // online dot

  tx(f,218,260,"Ahmet Yılmaz",24,700,C.text);
  const proBadge=fr(f,218,292,90,22,C.em,6);
  tx(proBadge,10,4,"PRO KAŞİF",10,700,C.white);
  tx(f,316,292,"@ahmetyilmaz",13,400,C.muted);
  tx(f,218,322,"Seyahat fotoğrafçısı ve rota tutkunu. 47 ülke, 200+ rota.",14,400,C.muted,600);

  // Stats bar
  const stats=fr(f,218,360,600,40,C.none,0,false);
  [["12","Rota"],["247","Takipçi"],["89","Takip"],["1.2K","Beğeni"]].forEach(([val,lbl],i)=>{
    tx(stats,i*148,0,String(val),18,700,C.text);
    tx(stats,i*148,22,String(lbl),12,400,C.muted);
  });

  // Action buttons
  btn(f,840,278,120,40,C.em,"✏️ Profili Düzenle",C.white,null,8);
  btn(f,968,278,100,40,C.surface,"Paylaş",C.brand,C.border,8);

  // Tabs
  const tabs2=fr(f,80,430,1280,48,C.surface,0,false);
  stroke(tabs2,C.border,1);
  const tabNames=["Rotalar","Paylaşımlar","Koleksiyonlar","Analitik","Satışlar","Aktivite"];
  tabNames.forEach((tab,i)=>{
    const active=i===0;
    const tf3=fr(tabs2,i*214,0,0,48,C.none,0,false);
    const tt=tx(tf3,12,15,tab,14,active?600:400,active?C.em:C.muted);
    tf3.resize(tt.width+24,48);
    if(active){
      rect(tf3,0,44,tf3.width,3,C.em,1);
    }
  });

  // Trip grid (3 columns)
  const trips=[
    {title:"Roma Rönesans Turu",dest:"İtalya",days:"3",stops:"9",code:"RM-841"},
    {title:"İstanbul Boğaz Rotası",dest:"Türkiye",days:"2",stops:"7",code:"IST-229"},
    {title:"Kapadokya Gezi",dest:"Türkiye",days:"2",stops:"5",code:"KP-334"},
    {title:"Paris Müze & Cafe",dest:"Fransa",days:"4",stops:"12",code:"PR-567"},
    {title:"Amsterdam Bisiklet",dest:"Hollanda",days:"2",stops:"8",code:"AM-891"},
    {title:"Barcelona Gaudi",dest:"İspanya",days:"3",stops:"10",code:"BC-445"},
  ];
  trips.forEach((trip,i)=>{
    const tx2=80+i%3*420, ty=500+Math.floor(i/3)*280;
    const tc2=fr(f,tx2,ty,400,260,C.surface,16);
    stroke(tc2,C.border,1);
    shadow(tc2,.06,2,16);
    // Map thumb
    const mt=fr(tc2,0,0,400,140,C.bg,12,false);
    rect(mt,0,0,400,140,{r:.851,g:.882,b:.949},0,.3);
    // route line sim
    const rline=figma.createLine();
    rline.x=40; rline.y=80; rline.resize(320,0);
    rline.strokes=[{type:"SOLID",color:C.em}];
    rline.strokeWeight=2;
    mt.appendChild(rline);
    [50,150,280,360].forEach((px,pi)=>{
      const wp2=fr(mt,px-8,60,16,16,C.em,999);
      tx(wp2,4,2,String(pi+1),8,700,C.white);
    });
    // Public badge
    const pub=fr(mt,8,8,60,20,C.em,6);
    tx(pub,6,4,"Herkese Açık",8,600,C.white);
    const codeB=fr(mt,320,8,72,22,C.surface,6);
    tx(codeB,6,5,trip.code,9,700,C.brand);
    // Info
    tx(tc2,16,152,trip.title,15,600,C.text);
    tx(tc2,16,174,"📍 "+trip.dest+" · "+trip.days+" gün · "+trip.stops+" durak",12,400,C.muted);
    btn(tc2,16,210,120,32,C.emBg,"🗺️ Haritada Aç",C.brand,null,6);
    btn(tc2,148,210,80,32,C.surface,"Paylaş",C.muted,C.border,6);
  });

  return f;
}

// ── Web Screen: Register ─────────────────────────────────────────────────────
function webRegister(){
  const W=1440, H=1000;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Web — Kayıt Ol";
  webNavbar(f,W,false);

  const card=fr(f,320,80,800,900,C.surface,20);
  stroke(card,C.border,1);
  shadow(card,.1,8,32);

  tx(card,40,40,"Hesap oluştur.",30,700,C.text);
  tx(card,40,80,"Ücretsiz başla, seyahat planlamana hemen başla.",14,400,C.muted,720);

  // Social buttons
  const gb2=fr(card,40,120,350,52,C.surface,10);
  stroke(gb2,C.border,1.5);
  tx(gb2,16,17,"G Google ile Kayıt Ol",14,600,C.text);
  const ab2=fr(card,410,120,350,52,C.text,10);
  tx(ab2,16,17," Apple ile Kayıt Ol",14,600,C.white);

  // Divider
  rect(card,40,186,720,1,C.border);
  tx(card,330,178,"veya",12,400,C.muted);

  // Form fields (2 col)
  ["Ad","Soyad"].forEach((label,i)=>{
    tx(card,40+i*372,204,label,13,600,C.text);
    const inf=fr(card,40+i*372,224,348,48,C.surface,10);
    stroke(inf,C.border,1.5);
    tx(inf,16,15,"Örnek "+label,13,400,C.muted);
  });

  tx(card,40,288,"E-posta",13,600,C.text);
  const ef2=fr(card,40,308,720,48,C.surface,10);
  stroke(ef2,C.border,1.5);
  tx(ef2,16,15,"ornek@alanadi.com",13,400,C.muted);

  tx(card,40,372,"Şifre",13,600,C.text);
  const pf2=fr(card,40,392,720,48,C.surface,10);
  stroke(pf2,C.border,1.5);
  tx(pf2,16,15,"En az 8 karakter, büyük harf ve rakam",13,400,C.muted);
  // Password strength
  [C.em,C.em,C.em,C.border,C.border].forEach((col,i)=>{
    rect(card,40+i*148,448,140,4,col,2);
  });
  tx(card,40,460,"Güçlü",11,600,C.em);

  // Plans
  tx(card,40,490,"Planını seç",14,700,C.text);
  const plans=[
    {name:"Gezgin",price:"Ücretsiz",features:["5 Rota / Ay","Temel AI","Topluluk"]},
    {name:"Kaşif",price:"9₺/ay",features:["Sınırsız Rota","Gelişmiş AI","Öncelikli Destek"],popular:true},
    {name:"Pro Kaşif",price:"19₺/ay",features:["Tümü Dahil","Tur Rehberi Araçları","API Erişimi"]},
  ];
  plans.forEach((plan,i)=>{
    const px=40+i*240, pc2=fr(card,px,512,228,200,plan.popular?C.emBg:C.bg,12);
    stroke(pc2,plan.popular?C.em:C.border,plan.popular?2:1);
    if(plan.popular){
      const popBadge=fr(pc2,60,0,110,22,C.em,999);
      tx(popBadge,20,4,"En Popüler",10,700,C.white);
    }
    tx(pc2,16,28,plan.name,15,700,C.text);
    tx(pc2,16,50,plan.price,20,700,plan.popular?C.em:C.text);
    plan.features.forEach((feat,fi)=>{
      tx(pc2,16,78+fi*26,"✓ "+feat,12,400,C.muted,200);
    });
  });

  // Terms + submit
  tx(card,40,730,"☑ Kullanım koşullarını ve gizlilik politikasını kabul ediyorum.",13,400,C.muted,720);
  btn(card,40,760,720,52,C.em,"Hesap Oluştur →",C.white,null,10);
  tx(card,240,824,"Zaten hesabın var mı?",13,400,C.muted);
  tx(card,400,824,"Giriş yap",13,600,C.em);

  return f;
}

// ── Mobile Shared: Status Bar ────────────────────────────────────────────────
function statusBar(p,dark){
  const bg=dark?C.dkSurf:C.surface;
  const sb3=fr(p,0,0,390,44,bg,0,false);
  tx(sb3,16,14,"9:41",15,600,dark?C.dkText:C.text);
  tx(sb3,310,14,"●●●",12,400,dark?C.dkText:C.text);
  tx(sb3,340,14,"WiFi",12,400,dark?C.dkText:C.text);
  tx(sb3,372,14,"🔋",14,400,dark?C.dkText:C.text);
  return sb3;
}

// ── Mobile Shared: Bottom Tab Bar ────────────────────────────────────────────
// Matches MobileNav in header-nav.tsx: Harita, Topluluk, AI Asistan, Mesajlar, Profil (logged in)
function mobileTabBar(p,h,active,dark){
  const bg=dark?C.dkSurf:C.surface;
  const brd=dark?C.dkBorder:C.border;
  const tb=fr(p,0,h-84,390,84,bg,0,false);
  stroke(tb,brd,1);
  const tabs3=[
    {icon:"⊕",label:"Harita"},
    {icon:"👥",label:"Topluluk"},
    {icon:"✦",label:"AI",special:true},
    {icon:"💬",label:"Mesajlar"},
    {icon:"👤",label:"Profil"},
  ];
  tabs3.forEach((tab,i)=>{
    const isActive=i===active;
    const tf4=fr(tb,i*78,0,78,76,C.none,0,false);
    if(tab.special){
      // AI tab is special
      const circle=fr(tf4,15,8,48,48,C.em,999);
      shadow(circle,.2,4,12);
      tx(circle,12,12,"✦",20,700,C.white);
      tx(tf4,8,58,tab.label,10,600,C.em);
    } else {
      tx(tf4,24,14,tab.icon,22,400,isActive?(dark?C.dkEm:C.em):(dark?C.dkMuted:C.muted));
      tx(tf4,16,38,tab.label,10,isActive?600:400,isActive?(dark?C.dkEm:C.em):(dark?C.dkMuted:C.muted));
      if(isActive){
        rect(tf4,28,8,24,4,C.em,2);
      }
    }
  });
  return tb;
}

// ── Mobile Screen: Welcome / Onboarding ──────────────────────────────────────
function mobileWelcome(){
  const W=390,H=844;
  const f=fr(figma.currentPage,0,0,W,H,C.brand,0,false);
  f.name="Mobile — Hoş Geldin";
  rect(f,0,0,W,H,C.brandDk,0,.3);
  // Glow
  const gw=rect(f,80,200,230,230,C.em,999,.15);
  gw.effects=[{type:"LAYER_BLUR",radius:60,visible:true}];

  // Logo
  const logo2=fr(f,145,100,100,100,C.emBg,999);
  tx(logo2,20,28,"⊕",40,700,C.brand);
  tx(f,140,214,"Maps",22,700,C.white);
  tx(f,194,214,"Bridge",22,700,C.emLight);
  tx(f,70,250,"Akıllı Seyahat Platformu",15,400,{r:.8,g:.95,b:.88},250);

  // Onboarding cards
  [["🧠","AI ile Rota Planla","Seyahat profiline göre kişisel rotalar"],
   ["🗺️","Harita Masası","Çok günlü sürükle-bırak planlama"],
   ["📤","6 Haneli Kod","Anında paylaş, konum olmadan"]
  ].forEach(([icon,title,desc],i)=>{
    const cy=360+i*108;
    const card=fr(f,24,cy,342,96,{r:1,g:1,b:1,a:.08},16);
    card.fills=[{type:"SOLID",color:C.white,opacity:.08}];
    stroke(card,{r:1,g:1,b:1},1);
    const ib=fr(card,12,12,48,48,C.emBg,12);
    ib.fills=[{type:"SOLID",color:C.em,opacity:.2}];
    tx(ib,10,10,String(icon),22,400,C.white);
    tx(card,70,16,String(title),15,700,C.white);
    tx(card,70,38,String(desc),12,400,{r:.8,g:.95,b:.88},240);
    tx(card,70,62,"→",14,400,C.emLight);
  });

  // Buttons
  btn(f,24,742,342,48,C.em,"Ücretsiz Başla",C.white,null,12);
  btn(f,24,798,342,36,C.none,"Zaten hesabım var →",{r:.8,g:.95,b:.88},C.none);

  return f;
}

// ── Mobile Screen: Home / Map Desk ───────────────────────────────────────────
function mobileMap(){
  const W=390,H=844;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Mobile — Harita Masası";
  statusBar(f,false);

  // Header
  const mh=fr(f,0,44,W,56,C.surface,0,false);
  stroke(mh,C.border,1);
  tx(mh,16,18,"Seyahat Masası",18,700,C.text);
  // add btn
  btn(mh,322,10,56,36,C.em,"+",C.white,null,8);
  // search icon
  rect(mh,280,16,24,24,C.emBg,6);

  // Trip selector tabs
  const tripTabs=fr(f,0,100,W,44,C.bg,0,false);
  ["Roma 3 Gün","Paris 4 Gün","+ Yeni"].forEach((tab,i)=>{
    const active=i===0;
    const tf5=fr(tripTabs,8+i*128,4,120,36,active?C.em:C.surface,10);
    if(!active)stroke(tf5,C.border,1);
    tx(tf5,8,10,tab,12,active?600:400,active?C.white:C.muted);
  });

  // Map area
  const map=fr(f,0,144,W,340,C.bg,0,false);
  rect(map,0,0,W,340,{r:.851,g:.882,b:.949},0,.3);
  // Grid lines
  for(let i=0;i<5;i++){
    rect(map,0,i*68,W,1,{r:1,g:1,b:1},0,.3);
    rect(map,i*78,0,1,340,{r:1,g:1,b:1},0,.3);
  }
  // Route
  const rl2=figma.createLine();
  rl2.x=60; rl2.y=180; rl2.resize(260,0);
  rl2.strokes=[{type:"SOLID",color:C.em}];
  rl2.strokeWeight=3;
  map.appendChild(rl2);
  // Waypoints
  [[80,120,"1"],[160,80,"2"],[240,140,"3"],[300,200,"4"]].forEach(([x,y,n])=>{
    const wp3=fr(map,Number(x)-14,Number(y)-14,28,28,C.em,999);
    tx(wp3,8,5,String(n),12,700,C.white);
  });
  // Map controls
  const zc=fr(map,340,10,40,80,C.surface,8);
  shadow(zc,.1,2,8);
  tx(zc,12,8,"＋",16,700,C.text);
  rect(zc,8,40,24,1,C.border);
  tx(zc,12,48,"−",16,700,C.text);

  // Pin list
  const pinList=fr(f,0,484,W,280,C.none,0,false);
  const pinHd=fr(pinList,0,0,W,44,C.surface,0,false);
  stroke(pinHd,C.border,1);
  tx(pinHd,16,14,"1. Gün — 4 Durak",14,600,C.text);
  tx(pinHd,300,14,"Düzenle",13,400,C.em);

  [["Colosseum","Tarih · 09:30","tarih"],
   ["Pantheon","Tarih · 11:00","tarih"],
   ["Öğle: Hostaria","Yemek · 13:00","yemek"],
   ["Forum Romanum","Tarih · 14:30","tarih"]].forEach(([name,sub,cat],i)=>{
    const py2=48+i*58;
    const pc3=fr(pinList,0,py2,W,52,C.surface,0,false);
    stroke(pc3,C.border,1);
    const dot=fr(pc3,16,16,20,20,C.em,999);
    tx(dot,5,3,String(i+1),11,700,C.white);
    tx(pc3,44,10,String(name),14,600,C.text);
    tx(pc3,44,28,String(sub),12,400,C.muted);
    rect(pc3,W-24,20,10,10,C.muted,5,.4);
  });

  mobileTabBar(f,H,0,false);
  return f;
}

// ── Mobile Screen: AI Chat ────────────────────────────────────────────────────
function mobileAI(){
  const W=390,H=844;
  const f=fr(figma.currentPage,0,0,W,H,C.dkBg,0,false);
  f.name="Mobile — AI Asistan";
  statusBar(f,true);

  // Header
  const mh2=fr(f,0,44,W,56,C.dkSurf,0,false);
  stroke(mh2,C.dkBorder,1);
  const logo3=fr(mh2,16,12,32,32,{r:.063,g:.725,b:.506,a:.2},999);
  logo3.fills=[{type:"SOLID",color:C.dkEm,opacity:.2}];
  tx(logo3,8,8,"✦",14,700,C.dkEm);
  tx(mh2,56,18,"AI Asistan",16,700,C.dkText);
  tx(mh2,56,34,"AWS Bedrock",11,400,C.dkMuted);
  btn(mh2,320,12,54,32,C.dkSurf2,"+ Yeni",C.dkMuted,C.dkBorder,8);

  // Chat area
  const ca=fr(f,0,100,W,560,C.dkBg,0,false);
  // Welcome state
  tx(ca,16,24,"Nereye gitmek istersin?",18,700,C.dkText,358);
  tx(ca,16,52,"Bir şehir seç veya istediğini söyle.",13,400,C.dkMuted,358);

  // Destination chips
  [["🇮🇹","Roma"],["🇫🇷","Paris"],["🇹🇷","İstanbul"],
   ["🇪🇸","Barcelona"],["🇳🇱","Amsterdam"],["🇹🇷","Kapadokya"]].forEach(([flag,city],i)=>{
    const cx2=16+i%3*120, cy2=96+Math.floor(i/2)*64;
    const cc=fr(ca,cx2,cy2,110,56,C.dkSurf,10);
    stroke(cc,C.dkBorder,1);
    tx(cc,10,8,String(flag),22,400,C.dkText);
    tx(cc,44,10,String(city),12,600,C.dkText);
    tx(cc,44,26,"→",11,400,C.dkMuted);
  });

  // Sample chat
  const ub2=fr(ca,60,240,306,44,C.brand,12);
  ub2.fills=[{type:"SOLID",color:C.brand,opacity:.8}];
  tx(ub2,12,13,"Roma'da 3 günlük rota",13,400,C.white,260);

  const ab2=fr(ca,16,300,340,120,C.dkSurf,12);
  stroke(ab2,C.dkBorder,1);
  tx(ab2,12,12,"Roma için 3 günlük özel rota hazırladım!",13,600,C.dkText,314);
  tx(ab2,12,34,"Colosseum'dan başlayıp Trastevere'de biten",12,400,C.dkText,314);
  tx(ab2,12,52,"mükemmel bir güzergah oluşturdum.",12,400,C.dkText,314);
  const rb=fr(ab2,12,74,200,36,C.dkSurf2,8);
  stroke(rb,C.dkBorder,1);
  tx(rb,10,10,"🗺️ Rotayı Aç (9 Durak)",12,600,C.dkEm);

  // Route mode selector
  const rms=fr(f,0,660,W,44,C.dkSurf,0,false);
  stroke(rms,C.dkBorder,1);
  [["🌿","Sakin"],["🗺️","Klasik"],["✨","Kaşif"]].forEach(([icon,lbl],i)=>{
    const active=i===1;
    const rm=fr(rms,8+i*124,6,118,32,active?C.dkEm:C.dkSurf2,999);
    tx(rm,12,9,icon+" "+lbl,12,active?600:400,active?C.white:C.dkMuted);
  });

  // Input
  const inp2=fr(f,0,704,W,56,C.dkSurf,0,false);
  stroke(inp2,C.dkBorder,1);
  const inpF=fr(inp2,8,8,290,40,C.dkSurf2,10);
  stroke(inpF,C.dkBorder,1);
  tx(inpF,12,12,"Nereye gitmek istiyorsun?",13,400,C.dkMuted);
  btn(inp2,306,8,40,40,C.none,"🎤",C.dkMuted,C.dkBorder,8);
  const sendBtn=fr(inp2,354,8,28,40,C.dkEm,8);
  tx(sendBtn,6,14,"→",14,700,C.white);

  // Bottom nav (dark)
  mobileTabBar(f,H,2,true);
  return f;
}

// ── Mobile Screen: Community ──────────────────────────────────────────────────
function mobileCommunity(){
  const W=390,H=844;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Mobile — Topluluk";
  statusBar(f,false);

  // Header
  const mh3=fr(f,0,44,W,56,C.surface,0,false);
  stroke(mh3,C.border,1);
  tx(mh3,16,18,"Topluluk",20,700,C.text);
  rect(mh3,138,26,10,10,C.em,999); // live dot
  btn(mh3,322,12,52,32,C.em,"✏️",C.white,null,8);

  // Stories
  const storiesM=fr(f,0,100,W,90,C.surface,0,false);
  stroke(storiesM,C.border,1);
  const sm=[["ED","Emre"],["CY","Ceren"],["MK","Mert"],["AS","Ayşe"]];
  sm.forEach((s,i)=>{
    const sx2=16+i*90;
    const av5=fr(storiesM,sx2,8,48,48,C.emBg,999);
    stroke(av5,C.em,2);
    tx(av5,12,12,s[0],16,700,C.brand);
    tx(storiesM,sx2+4,62,s[1],10,400,C.muted);
  });

  // Post cards (mobile)
  const mPostY=198;
  [["Emre Doğan","@emredogan","İstanbul, TR","Boğaz sabah koşusu rotası, 8 km, harika manzaralar!"],
   ["Ceren Yılmaz","@cerenyilmaz","Roma, İtalya","Colosseum sabah 8'de, çok sakin ve muhteşem."]
  ].forEach(([name,handle,loc,cap],i)=>{
    const py3=mPostY+i*250;
    const pc4=fr(f,8,py3,374,238,C.surface,16);
    stroke(pc4,C.border,1);
    shadow(pc4,.06,2,12);
    const av6=fr(pc4,12,12,36,36,C.emBg,999);
    tx(av6,8,8,name.split(" ").map(w=>w[0]).join(""),13,700,C.brand);
    tx(pc4,56,12,name,14,600,C.text);
    tx(pc4,56,30,handle+" · 2s",11,400,C.muted);
    const locPM=fr(pc4,12,58,0,22,C.bg,999);
    const locTM=tx(locPM,8,4,"📍 "+loc,10,500,C.muted);
    locPM.resize(locTM.width+16,22);
    tx(pc4,12,90,cap,13,400,C.text,350);
    // Route pill
    const rp3=fr(pc4,12,150,280,40,C.bg,8);
    stroke(rp3,C.border,1);
    tx(rp3,10,4,"🗺️",18,400,C.em);
    tx(rp3,38,4,"5 Duraq · Yürüyüş",12,600,C.text);
    tx(rp3,38,22,"3.2 km · 2 saat",10,400,C.muted);
    const codeM=fr(rp3,220,10,52,20,C.em,6);
    tx(codeM,6,4,"MB-229",9,700,C.white);
    // Likes
    const pf3=fr(pc4,0,198,374,40,C.bg,0,false);
    tx(pf3,12,12,"♥ 124",13,500,C.muted);
    tx(pf3,70,12,"💬 18",13,500,C.muted);
    btn(pf3,260,8,100,24,C.emBg,"Rotayı Aç",C.brand,null,6);
  });

  mobileTabBar(f,H,1,false);
  return f;
}

// ── Mobile Screen: Profile ────────────────────────────────────────────────────
function mobileProfile(){
  const W=390,H=844;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Mobile — Profil";
  statusBar(f,false);

  // Cover
  const cover2=fr(f,0,44,W,120,C.brand,0,false);
  rect(cover2,0,0,W,120,C.brandDk,0,.3);

  // Avatar
  const av7=fr(f,24,120,80,80,C.emBg,999);
  stroke(av7,C.surface,3);
  tx(av7,18,22,"AY",26,700,C.brand);
  rect(f,98,180,14,14,C.em,999);

  tx(f,120,132,"Ahmet Yılmaz",18,700,C.text);
  const proBM=fr(f,120,156,80,20,C.em,6);
  tx(proBM,8,4,"PRO KAŞİF",9,700,C.white);
  tx(f,120,182,"@ahmetyilmaz",12,400,C.muted);

  // Stats
  const statsM=fr(f,0,220,W,60,C.surface,0,false);
  stroke(statsM,C.border,1);
  [["12","Rota"],["247","Takipçi"],["89","Takip"],["1.2K","Beğeni"]].forEach(([val,lbl],i)=>{
    const sx3=i*98;
    tx(statsM,sx3+28,12,String(val),16,700,C.text);
    tx(statsM,sx3+28,32,String(lbl),10,400,C.muted);
    if(i<3)rect(statsM,sx3+96,16,1,28,C.border);
  });

  // Action btns
  btn(f,16,292,170,40,C.em,"✏️ Profili Düzenle",C.white,null,8);
  btn(f,196,292,170,40,C.surface,"Paylaş",C.brand,C.border,8);

  // Tabs
  const tabsM=fr(f,0,344,W,44,C.surface,0,false);
  stroke(tabsM,C.border,1);
  ["Rotalar","Paylaşımlar","Koleksiyonlar"].forEach((tab,i)=>{
    const active=i===0;
    const tf6=fr(tabsM,i*130,0,130,44,C.none,0,false);
    tx(tf6,14,15,tab,13,active?600:400,active?C.em:C.muted);
    if(active)rect(tf6,0,40,130,3,C.em,1);
  });

  // Trip cards (2 col)
  [["Roma Turu","3G · 9D"],["İstanbul","2G · 7D"],["Kapadokya","2G · 5D"],["Paris","4G · 12D"]].forEach(([title,meta],i)=>{
    const tx3=16+i%2*190, ty2=400+Math.floor(i/2)*200;
    const tc3=fr(f,tx3,ty2,178,188,C.surface,12);
    stroke(tc3,C.border,1);
    shadow(tc3,.05,2,8);
    // Map thumb
    rect(tc3,0,0,178,100,{r:.851,g:.882,b:.949},8,.3);
    const rt=figma.createLine();
    rt.x=20; rt.y=60; rt.resize(130,0);
    rt.strokes=[{type:"SOLID",color:C.em}];
    rt.strokeWeight=2;
    tc3.appendChild(rt);
    [[30,40],[80,30],[140,55]].forEach(([x,y])=>{
      const wp4=fr(tc3,Number(x)-8,Number(y)-8,16,16,C.em,999);
      tx(wp4,4,2,"•",8,700,C.white);
    });
    tx(tc3,12,108,String(title),13,600,C.text);
    tx(tc3,12,126,String(meta),11,400,C.muted);
    btn(tc3,12,148,100,28,C.emBg,"Aç",C.brand,null,6);
  });

  mobileTabBar(f,H,4,false);
  return f;
}

// ── Mobile Screen: Login ──────────────────────────────────────────────────────
function mobileLogin(){
  const W=390,H=844;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Mobile — Giriş Yap";
  statusBar(f,false);

  // Back header
  const bh=fr(f,0,44,W,52,C.surface,0,false);
  stroke(bh,C.border,1);
  tx(bh,16,18,"←",18,400,C.brand);
  tx(bh,100,18,"Giriş yap",16,700,C.text);

  // Logo
  const lbl=fr(f,155,116,80,80,C.emBg,999);
  tx(lbl,18,22,"⊕",32,700,C.brand);
  tx(f,135,206,"Maps",18,700,C.text);
  tx(f,181,206,"Bridge",18,700,C.em);
  // Welcome badge
  const wb2=fr(f,96,240,198,24,C.emBg,999);
  rect(wb2,10,8,8,8,C.em,999);
  tx(wb2,26,5,"TEKRAR HOŞ GELDİN",10,700,C.brand);

  // Social buttons
  const gm=fr(f,24,280,342,52,C.surface,12);
  stroke(gm,C.border,1.5);
  const gG2=fr(gm,14,12,28,28,C.none,4,false);
  rect(gG2,0,0,14,14,C.gBlue,2);
  rect(gG2,14,0,14,14,{r:.204,g:.659,b:.325},2);
  rect(gG2,0,14,14,14,{r:.984,g:.737,b:.020},2);
  rect(gG2,14,14,14,14,{r:.918,g:.263,b:.208},2);
  tx(gm,54,18,"Google ile Giriş Yap",14,600,C.text);

  const am=fr(f,24,340,342,52,C.text,12);
  tx(am,16,18," Apple ile Giriş Yap",14,600,C.white);

  // Divider
  rect(f,24,406,140,1,C.border);
  tx(f,172,398,"veya",12,400,C.muted);
  rect(f,224,406,142,1,C.border);

  // Form
  tx(f,24,424,"E-posta",13,600,C.text);
  const ef3=fr(f,24,444,342,52,C.surface,10);
  stroke(ef3,C.border,1.5);
  tx(ef3,16,17,"ornek@alanadi.com",13,400,C.muted);

  tx(f,24,510,"Şifre",13,600,C.text);
  tx(f,300,510,"Şifremi unuttum",12,600,C.em);
  const pf3=fr(f,24,530,342,52,C.surface,10);
  stroke(pf3,C.border,1.5);
  tx(pf3,16,17,"••••••••",16,400,C.muted);

  // Remember me
  rect(f,24,598,16,16,C.emBg,3);
  tx(f,48,597,"Beni hatırla",13,400,C.muted);

  btn(f,24,628,342,52,C.em,"Giriş yap →",C.white,null,12);
  tx(f,90,696,"Hesabın yok mu?",13,400,C.muted);
  tx(f,230,696,"Ücretsiz üye ol →",13,600,C.em);

  return f;
}

// ── Component Library ─────────────────────────────────────────────────────────
function componentLibrary(){
  const W=1440,H=1200;
  const f=fr(figma.currentPage,0,0,W,H,C.bg,0,false);
  f.name="Component Library";

  // Title
  tx(f,80,40,"MapsBridge — Design System & Component Library",24,700,C.text);
  tx(f,80,74,"Gerçek uygulamadan çıkarılmış tasarım tokenları ve bileşenler",14,400,C.muted);

  // Colors
  tx(f,80,120,"Renk Paleti",16,700,C.text);
  const colors=[
    {name:"Brand (#286954)",col:C.brand},{name:"Emerald (#10b981)",col:C.em},
    {name:"EmBg (#ecfdf5)",col:C.emBg},{name:"Bg (#f8f7f4)",col:C.bg},
    {name:"Surface (#ffffff)",col:C.surface},{name:"Border (#dde2da)",col:C.border},
    {name:"Text (#202e29)",col:C.text},{name:"Muted (#5e6d65)",col:C.muted},
    {name:"Dark Bg (#0a0f1d)",col:C.dkBg},{name:"Dark Surf (#111927)",col:C.dkSurf},
    {name:"Dark Em (#10b981)",col:C.dkEm},{name:"Dark Muted (#94a3b8)",col:C.dkMuted},
  ];
  colors.forEach((c,i)=>{
    const cx3=80+i%6*220, cy3=148+Math.floor(i/6)*110;
    rect(f,cx3,cy3,80,60,c.col,8);
    tx(f,cx3,cy3+68,c.name,11,400,C.muted,190);
  });

  // Typography
  tx(f,80,400,"Tipografi",16,700,C.text);
  [["Display · 48px · Bold","Display",48,700],
   ["Headline · 28px · Bold","Headline",28,700],
   ["Title · 20px · SemiBold","Title",20,600],
   ["Body · 14px · Regular","Body",14,400],
   ["Caption · 11px · Medium","Caption",11,500],
  ].forEach(([label,sample,size,wt],i)=>{
    tx(f,80,430+i*56,String(label),12,400,C.muted);
    tx(f,300,425+i*56,String(sample),Number(size),Number(wt),C.text);
  });

  // Buttons
  tx(f,80,720,"Butonlar",16,700,C.text);
  btn(f,80,750,160,48,C.em,"Primary CTA",C.white,null,10);
  btn(f,252,750,160,48,C.surface,"Secondary",C.brand,C.border,10);
  btn(f,424,750,160,48,C.bg,"Ghost",C.muted,C.border,10);
  btn(f,596,750,160,48,C.brand,"Brand Fill",C.white,null,10);
  // Small variants
  btn(f,80,812,100,36,C.em,"Small Prim",C.white,null,8);
  btn(f,192,812,100,36,C.surface,"Small Sec",C.brand,C.border,8);
  pill(f,304,812,80,28,C.emBg,"Pill",C.brand,10);
  pill(f,396,812,80,28,C.em,"Active",C.white,10);
  pill(f,488,812,80,28,C.text,"Dark",C.white,10);

  // Inputs
  tx(f,80,870,"Input Alanları",16,700,C.text);
  input(f,80,900,320,"Varsayılan input",false,false);
  input(f,420,900,320,"Odaklı input (brand border)",true,false);
  input(f,760,900,320,"Dark mod input",false,true);

  // Nav components
  tx(f,80,980,"Navigasyon Bileşenleri",16,700,C.text);
  // Mini navbar preview
  const miniNav=fr(f,80,1010,860,60,C.surface,8);
  stroke(miniNav,C.border,1);
  shadow(miniNav,.06,2,8);
  tx(miniNav,16,22,"Maps",14,700,C.text);
  tx(miniNav,52,22,"Bridge",14,700,C.em);
  ["Keşfet","Harita","AI","Topluluk"].forEach((l,i)=>{
    const active=i===0;
    const lf3=fr(miniNav,120+i*140,12,128,36,active?C.emBg:C.none,8);
    tx(lf3,12,10,l,12,active?600:400,active?C.brand:C.muted);
  });
  btn(miniNav,680,14,76,32,C.none,"Giriş",C.brand,C.border,8);
  btn(miniNav,764,14,76,32,C.em,"Üye ol",C.white,null,8);

  // Mobile tab bar preview
  const miniTab=fr(f,80,1090,390,70,C.surface,8);
  stroke(miniTab,C.border,1);
  ["⊕ Harita","👥 Topluluk","✦ AI","💬 Mesaj","👤 Profil"].forEach((item,i)=>{
    const active=i===2;
    const tf7=fr(miniTab,8+i*74,8,66,54,C.none,8);
    const parts=item.split(" ");
    tx(tf7,8,4,parts[0],active?20:16,active?700:400,active?C.em:C.muted);
    tx(tf7,6,28,parts[1]||"",9,active?600:400,active?C.em:C.muted);
  });

  return f;
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
async function main(){
  figma.notify("⏳ Yükleniyor...",{timeout:5000});
  try{
    await Promise.all([
      figma.loadFontAsync({family:"Inter",style:"Regular"}),
      figma.loadFontAsync({family:"Inter",style:"Medium"}),
      figma.loadFontAsync({family:"Inter",style:"SemiBold"}),
      figma.loadFontAsync({family:"Inter",style:"Bold"}),
    ]);
    FONT="Inter";
    figma.notify("✓ Inter yüklendi",{timeout:1500});
  }catch(e){
    try{
      await Promise.all([
        figma.loadFontAsync({family:"Roboto",style:"Regular"}),
        figma.loadFontAsync({family:"Roboto",style:"Medium"}),
        figma.loadFontAsync({family:"Roboto",style:"Bold"}),
      ]);
      FONT="Roboto";
      figma.notify("✓ Roboto yüklendi",{timeout:1500});
    }catch(e2){
      figma.notify("❌ Font yüklenemedi: "+(e2.message||String(e2)),{error:true,timeout:6000});
      figma.closePlugin(); return;
    }
  }

  const page=figma.createPage();
  page.name="MapsBridge — Tüm Tasarımlar";
  await figma.setCurrentPageAsync(page);

  figma.notify("🖥 Web sayfaları oluşturuluyor...",{timeout:8000});

  // Web sayfaları — tek sıra (y=0), aralarında 120px boşluk
  const webPages=[webHome,webLogin,webAI,webCommunity,webProfile,webRegister];
  let wx=0;
  const wFrames=[];
  for(const fn of webPages){
    const fr2=fn();
    fr2.x=wx;
    fr2.y=0;
    wFrames.push(fr2);
    wx+=fr2.width+120;
  }

  figma.notify("📱 Mobil sayfalar oluşturuluyor...",{timeout:8000});

  // Mobile sayfalar — tek sıra (y=1400), aralarında 80px boşluk
  const mobileFns=[mobileWelcome,mobileMap,mobileAI,mobileCommunity,mobileProfile,mobileLogin];
  let mx=0;
  const mFrames=[];
  for(const fn of mobileFns){
    const fr3=fn();
    fr3.x=mx;
    fr3.y=1400;
    mFrames.push(fr3);
    mx+=fr3.width+80;
  }

  figma.notify("🎨 Component library oluşturuluyor...",{timeout:5000});

  // Component library (y=2400)
  const cl=componentLibrary();
  cl.x=0;
  cl.y=2600;

  figma.viewport.scrollAndZoomIntoView([...wFrames,...mFrames,cl]);
  figma.notify("✅ Tamamlandı! 6 web + 6 mobil + component library hazır. Gerçek uygulama tasarımı!",{timeout:8000});
  figma.closePlugin();
}

main().catch(err=>{
  figma.notify("❌ Hata: "+(err.message||String(err)),{error:true,timeout:8000});
  figma.closePlugin();
});
