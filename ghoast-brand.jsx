import { useState, useEffect, useRef } from "react";

/* ─── GHOAST BRAND SYSTEM ───────────────────────────────────────────
   Palette  : Obsidian #080810 · Slate #111120 · Violet #7B4FFF
              Cyan #00E5FF · Specter #1A1A3A · Ghost-white #E8E8FF
   Type     : Clash Display (headers) · Cabinet Grotesk (body) · DM Mono (data)
   Vibe     : Dark-humor intelligence · haunted-data aesthetic
   ─────────────────────────────────────────────────────────────────── */

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Outfit:wght@300;400;500;600;700;800;900&display=swap');

*,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
:root{
  --black:#080810;
  --slate:#111120;
  --slate2:#181830;
  --specter:#1A1A3A;
  --violet:#7B4FFF;
  --violet-lo:rgba(123,79,255,.14);
  --violet-mid:rgba(123,79,255,.35);
  --cyan:#00E5FF;
  --cyan-lo:rgba(0,229,255,.1);
  --red:#FF3E3E;
  --green:#00E676;
  --ghost:#E8E8FF;
  --muted:#7070A0;
  --grad:linear-gradient(135deg,#7B4FFF 0%,#00E5FF 100%);
  --grad-r:linear-gradient(135deg,#00E5FF 0%,#7B4FFF 100%);
  --grad-soft:linear-gradient(135deg,rgba(123,79,255,.25) 0%,rgba(0,229,255,.25) 100%);
}
html{scroll-behavior:smooth;}
body{background:var(--black);color:var(--ghost);font-family:'Outfit',sans-serif;overflow-x:hidden;}

/* ── NOISE + ORBS ── */
.noise{position:fixed;inset:0;pointer-events:none;z-index:0;opacity:.35;
  background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.08'/%3E%3C/svg%3E");}
.orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;}
.orb1{width:500px;height:500px;background:rgba(123,79,255,.1);top:-150px;right:-80px;}
.orb2{width:350px;height:350px;background:rgba(0,229,255,.06);bottom:-80px;left:-100px;}
.orb3{width:200px;height:200px;background:rgba(123,79,255,.08);top:40%;left:30%;}

/* ── NAV ── */
nav{
  position:fixed;top:0;left:0;right:0;z-index:100;
  display:flex;align-items:center;justify-content:space-between;
  padding:0 48px;height:64px;
  background:rgba(8,8,16,.8);backdrop-filter:blur(20px);
  border-bottom:1px solid rgba(123,79,255,.2);
}
.nav-logo{display:flex;align-items:center;gap:10px;cursor:pointer;}
.nav-logo-mark{
  width:32px;height:32px;border-radius:9px;background:var(--grad);
  display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 20px rgba(123,79,255,.5);
  font-family:'Outfit',sans-serif;font-weight:900;font-size:13px;color:#fff;letter-spacing:-1px;
}
.nav-wordmark{font-family:'Outfit',sans-serif;font-weight:800;font-size:20px;letter-spacing:-0.5px;}
.nav-wordmark .oa{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;position:relative;}
.nav-wordmark .oa::after{
  content:'';position:absolute;bottom:-1px;left:0;right:0;height:2px;
  background:var(--grad);border-radius:2px;opacity:.6;
}
.nav-links{display:flex;align-items:center;gap:32px;}
.nav-link{font-size:14px;font-weight:500;color:var(--muted);cursor:pointer;transition:color .2s;}
.nav-link:hover{color:var(--ghost);}
.nav-cta{
  background:var(--grad);color:#fff;border:none;padding:9px 22px;border-radius:9px;
  font-size:14px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;
  box-shadow:0 0 20px rgba(123,79,255,.35);transition:all .2s;letter-spacing:-.2px;
}
.nav-cta:hover{box-shadow:0 0 30px rgba(123,79,255,.55);transform:translateY(-1px);}

/* ── HERO ── */
.hero{
  position:relative;z-index:1;min-height:100vh;display:flex;flex-direction:column;
  align-items:center;justify-content:center;padding:120px 24px 80px;text-align:center;
}
.hero-badge{
  display:inline-flex;align-items:center;gap:8px;
  background:var(--violet-lo);border:1px solid var(--violet-mid);
  border-radius:20px;padding:6px 16px;margin-bottom:36px;
  font-size:12px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--cyan);
  animation:fadeUp .6s ease both;
}
.badge-dot{width:6px;height:6px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan);animation:pulse 1.8s ease infinite;}
@keyframes pulse{0%,100%{opacity:1;}50%{opacity:.3;}}

.hero-title{
  font-family:'Outfit',sans-serif;font-weight:900;font-size:clamp(56px,9vw,108px);
  line-height:.95;letter-spacing:-3px;margin-bottom:24px;
  animation:fadeUp .6s .1s ease both;
}
.hero-title .line1{display:block;color:var(--ghost);}
.hero-title .line2{
  display:block;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;
  position:relative;
}
.hero-title .line2::after{
  content:'';position:absolute;bottom:4px;left:50%;transform:translateX(-50%);
  width:60%;height:3px;background:var(--grad);border-radius:3px;opacity:.4;filter:blur(3px);
}
.hero-sub{
  font-size:clamp(16px,2vw,20px);font-weight:400;color:var(--muted);max-width:540px;
  line-height:1.6;margin-bottom:48px;animation:fadeUp .6s .2s ease both;
}
.hero-sub strong{color:var(--ghost);font-weight:600;}

.hero-actions{display:flex;align-items:center;gap:16px;justify-content:center;flex-wrap:wrap;animation:fadeUp .6s .3s ease both;}
.btn-primary{
  background:var(--grad);color:#fff;border:none;padding:16px 36px;border-radius:12px;
  font-size:16px;font-weight:700;cursor:pointer;font-family:'Outfit',sans-serif;letter-spacing:-.3px;
  box-shadow:0 0 40px rgba(123,79,255,.4);transition:all .2s;
}
.btn-primary:hover{box-shadow:0 0 60px rgba(123,79,255,.6);transform:translateY(-2px);}
.btn-ghost-btn{
  background:transparent;color:var(--ghost);border:1px solid rgba(255,255,255,.12);
  padding:16px 36px;border-radius:12px;font-size:16px;font-weight:600;cursor:pointer;
  font-family:'Outfit',sans-serif;transition:all .2s;
}
.btn-ghost-btn:hover{border-color:rgba(123,79,255,.5);background:var(--violet-lo);}

.hero-proof{
  margin-top:64px;display:flex;align-items:center;gap:24px;justify-content:center;
  animation:fadeUp .6s .4s ease both;
}
.proof-avatars{display:flex;}
.proof-av{
  width:32px;height:32px;border-radius:50%;border:2px solid var(--black);
  display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;
}
.proof-av+.proof-av{margin-left:-8px;}
.proof-text{font-size:13px;color:var(--muted);}
.proof-text strong{color:var(--ghost);}

/* ── GHOST COUNTER HERO WIDGET ── */
.hero-widget{
  margin-top:72px;width:100%;max-width:720px;
  background:var(--slate);border:1px solid var(--violet-mid);border-radius:20px;
  padding:32px;position:relative;overflow:hidden;
  animation:fadeUp .6s .5s ease both;
  box-shadow:0 0 60px rgba(123,79,255,.12),0 40px 80px rgba(0,0,0,.4);
}
.hero-widget::before{
  content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad);
}
.widget-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;}
.widget-title{font-size:14px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;}
.widget-live{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--cyan);font-weight:600;}
.widget-stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:28px;}
.wstat{background:var(--specter);border-radius:12px;padding:18px;text-align:center;border:1px solid rgba(123,79,255,.15);}
.wstat-val{font-family:'DM Mono',monospace;font-size:28px;font-weight:500;line-height:1;margin-bottom:4px;}
.wstat-val.vgrad{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.wstat-val.vred{color:var(--red);}
.wstat-val.vgreen{color:var(--green);}
.wstat-label{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
.widget-tiers{display:flex;flex-direction:column;gap:8px;}
.wtier{display:flex;align-items:center;gap:12px;padding:10px 14px;border-radius:10px;background:var(--specter);}
.wtier-dot{width:8px;height:8px;border-radius:50%;flex-shrink:0;}
.wtier-name{font-size:13px;flex:1;}
.wtier-bar{flex:2;height:4px;background:var(--slate2);border-radius:4px;overflow:hidden;}
.wtier-fill{height:100%;border-radius:4px;transition:width 1.2s ease;}
.wtier-count{font-family:'DM Mono',monospace;font-size:12px;color:var(--muted);width:28px;text-align:right;}
.widget-action{
  margin-top:20px;width:100%;background:var(--grad);color:#fff;border:none;
  padding:14px;border-radius:11px;font-size:15px;font-weight:700;cursor:pointer;
  font-family:'Outfit',sans-serif;box-shadow:0 0 30px rgba(123,79,255,.3);
  display:flex;align-items:center;justify-content:center;gap:8px;transition:all .2s;
}
.widget-action:hover{box-shadow:0 0 50px rgba(123,79,255,.5);transform:translateY(-1px);}

/* ── SCROLL MARQUEE ── */
.marquee-wrap{
  position:relative;z-index:1;padding:28px 0;
  border-top:1px solid rgba(123,79,255,.12);border-bottom:1px solid rgba(123,79,255,.12);
  overflow:hidden;background:rgba(8,8,16,.6);backdrop-filter:blur(8px);
}
.marquee-track{display:flex;gap:48px;width:max-content;animation:marquee 22s linear infinite;}
@keyframes marquee{from{transform:translateX(0);}to{transform:translateX(-50%);}}
.marquee-item{display:flex;align-items:center;gap:12px;white-space:nowrap;}
.marquee-icon{font-size:14px;}
.marquee-text{font-size:13px;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;}
.marquee-sep{color:var(--violet);font-size:18px;}

/* ── HOW IT WORKS ── */
.section{position:relative;z-index:1;padding:100px 48px;max-width:1200px;margin:0 auto;}
.section-badge{
  display:inline-block;background:var(--violet-lo);border:1px solid var(--violet-mid);
  border-radius:20px;padding:5px 14px;margin-bottom:20px;
  font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:var(--violet);
}
.section-title{font-family:'Outfit',sans-serif;font-weight:900;font-size:clamp(36px,5vw,56px);letter-spacing:-1.5px;line-height:1.05;margin-bottom:16px;}
.section-sub{font-size:17px;color:var(--muted);max-width:520px;line-height:1.6;}
.section-sub strong{color:var(--ghost);}

.steps{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:60px;}
.step{
  background:var(--slate);border:1px solid rgba(123,79,255,.18);border-radius:18px;
  padding:32px;position:relative;overflow:hidden;transition:all .25s;
}
.step:hover{border-color:var(--violet-mid);transform:translateY(-4px);box-shadow:0 20px 60px rgba(123,79,255,.12);}
.step::before{content:'';position:absolute;inset:0;background:var(--grad-soft);opacity:0;transition:opacity .25s;}
.step:hover::before{opacity:1;}
.step-num{
  font-family:'DM Mono',monospace;font-size:11px;font-weight:500;color:var(--violet);
  letter-spacing:.1em;margin-bottom:20px;
}
.step-icon{font-size:32px;margin-bottom:16px;}
.step-title{font-family:'Outfit',sans-serif;font-weight:700;font-size:20px;margin-bottom:10px;letter-spacing:-.3px;}
.step-desc{font-size:14px;color:var(--muted);line-height:1.65;}

/* ── TIER SECTION ── */
.tier-section{position:relative;z-index:1;padding:100px 48px;background:rgba(10,10,20,.5);}
.tier-inner{max-width:1200px;margin:0 auto;display:grid;grid-template-columns:1fr 1fr;gap:64px;align-items:center;}
.tier-list-big{display:flex;flex-direction:column;gap:12px;margin-top:40px;}
.tier-card-big{
  display:flex;align-items:center;gap:16px;padding:18px 20px;border-radius:14px;
  background:var(--slate);border:1px solid rgba(123,79,255,.15);cursor:pointer;
  transition:all .2s;
}
.tier-card-big:hover{border-color:var(--violet-mid);background:var(--specter);}
.tcb-dot{width:12px;height:12px;border-radius:50%;flex-shrink:0;}
.tcb-info{flex:1;}
.tcb-name{font-size:15px;font-weight:700;letter-spacing:-.2px;}
.tcb-desc{font-size:12px;color:var(--muted);margin-top:2px;}
.tcb-count{font-family:'DM Mono',monospace;font-size:20px;font-weight:500;}
.tier-visual{display:flex;flex-direction:column;gap:0;}
.tv-bar-row{display:flex;align-items:center;gap:16px;padding:12px 0;border-bottom:1px solid rgba(123,79,255,.08);}
.tv-label{font-size:12px;color:var(--muted);width:100px;flex-shrink:0;}
.tv-track{flex:1;height:8px;background:var(--specter);border-radius:8px;overflow:hidden;}
.tv-fill{height:100%;border-radius:8px;transition:width 1.5s cubic-bezier(.16,1,.3,1);}
.tv-num{font-family:'DM Mono',monospace;font-size:13px;width:28px;text-align:right;}

/* ── PRICING ── */
.pricing-section{position:relative;z-index:1;padding:100px 48px;}
.pricing-inner{max-width:1100px;margin:0 auto;}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:60px;}
.price-card{
  background:var(--slate);border:1px solid rgba(123,79,255,.2);border-radius:20px;
  padding:32px;position:relative;overflow:hidden;transition:all .25s;
}
.price-card:hover{transform:translateY(-4px);}
.price-card.featured{
  border-color:var(--violet);background:linear-gradient(180deg,var(--specter) 0%,var(--slate) 100%);
  box-shadow:0 0 60px rgba(123,79,255,.18);
}
.price-card.featured::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:var(--grad);}
.featured-tag{
  position:absolute;top:20px;right:20px;background:var(--grad);
  font-size:10px;font-weight:800;letter-spacing:.1em;text-transform:uppercase;
  padding:4px 10px;border-radius:20px;color:#fff;
}
.price-name{font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.12em;margin-bottom:20px;}
.price-amount{font-family:'Outfit',sans-serif;font-weight:900;font-size:48px;letter-spacing:-2px;line-height:1;}
.price-amount span{font-size:20px;font-weight:500;color:var(--muted);}
.price-period{font-size:13px;color:var(--muted);margin-top:4px;margin-bottom:28px;}
.price-divider{height:1px;background:rgba(123,79,255,.15);margin-bottom:24px;}
.price-features{display:flex;flex-direction:column;gap:10px;margin-bottom:32px;}
.pf{display:flex;align-items:center;gap:10px;font-size:14px;}
.pf-check{width:18px;height:18px;border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;}
.pf-check.on{background:var(--violet);}
.pf-check.off{background:var(--specter);}
.pf.off-item{color:var(--muted);}
.price-btn{
  width:100%;padding:14px;border-radius:11px;font-size:15px;font-weight:700;
  cursor:pointer;font-family:'Outfit',sans-serif;transition:all .2s;border:none;
}
.price-btn.primary{background:var(--grad);color:#fff;box-shadow:0 0 30px rgba(123,79,255,.3);}
.price-btn.primary:hover{box-shadow:0 0 50px rgba(123,79,255,.5);}
.price-btn.secondary{background:var(--specter);color:var(--ghost);border:1px solid rgba(123,79,255,.2);}
.price-btn.secondary:hover{border-color:var(--violet);}

/* ── GHOST STAT STRIP ── */
.stat-strip{
  position:relative;z-index:1;padding:64px 48px;
  background:linear-gradient(135deg,rgba(123,79,255,.08) 0%,rgba(0,229,255,.06) 100%);
  border-top:1px solid var(--violet-mid);border-bottom:1px solid var(--violet-mid);
}
.stat-strip-inner{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:32px;}
.sstat{text-align:center;}
.sstat-val{font-family:'DM Mono',monospace;font-size:42px;font-weight:500;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;line-height:1;}
.sstat-label{font-size:13px;color:var(--muted);margin-top:8px;letter-spacing:.05em;}

/* ── FOOTER ── */
footer{
  position:relative;z-index:1;padding:48px;
  border-top:1px solid rgba(123,79,255,.15);
  display:flex;align-items:center;justify-content:space-between;
  max-width:1200px;margin:0 auto;
}
.footer-brand{font-family:'Outfit',sans-serif;font-weight:800;font-size:18px;letter-spacing:-.5px;}
.footer-brand .oa{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.footer-links{display:flex;gap:28px;}
.footer-link{font-size:13px;color:var(--muted);cursor:pointer;transition:color .2s;}
.footer-link:hover{color:var(--ghost);}
.footer-copy{font-size:12px;color:var(--muted);}

/* ── ANIMATIONS ── */
@keyframes fadeUp{from{transform:translateY(20px);opacity:0;}to{transform:translateY(0);opacity:1;}}
@keyframes fadeIn{from{opacity:0;}to{opacity:1;}}

/* ── DASHBOARD SECTION ── */
.dash-preview{
  position:relative;z-index:1;padding:100px 48px;background:rgba(8,8,16,.7);
}
.dash-inner{max-width:1100px;margin:0 auto;}
.dash-frame{
  margin-top:56px;background:var(--slate);border:1px solid var(--violet-mid);border-radius:20px;
  overflow:hidden;box-shadow:0 0 80px rgba(123,79,255,.15),0 60px 120px rgba(0,0,0,.5);
}
.dash-topbar{
  background:var(--slate2);border-bottom:1px solid rgba(123,79,255,.15);
  padding:14px 24px;display:flex;align-items:center;gap:8px;
}
.dash-dot{width:12px;height:12px;border-radius:50%;}
.dash-body{display:grid;grid-template-columns:200px 1fr;min-height:420px;}
.dash-sidebar{
  background:rgba(8,8,16,.4);border-right:1px solid rgba(123,79,255,.12);
  padding:20px 16px;display:flex;flex-direction:column;gap:4px;
}
.ds-item{
  padding:8px 12px;border-radius:8px;font-size:13px;color:var(--muted);
  display:flex;align-items:center;gap:8px;cursor:pointer;transition:all .15s;
}
.ds-item:hover,.ds-item.active{background:var(--violet-lo);color:var(--ghost);}
.ds-item-dot{width:6px;height:6px;border-radius:50%;}
.dash-content{padding:24px;display:flex;flex-direction:column;gap:16px;}
.dc-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;}
.dcs{background:var(--specter);border-radius:10px;padding:14px;border:1px solid rgba(123,79,255,.12);}
.dcs-val{font-family:'DM Mono',monospace;font-size:22px;margin-bottom:2px;}
.dcs-val.g{background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}
.dcs-val.r{color:var(--red);}
.dcs-label{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em;}
.dc-row{display:grid;grid-template-columns:1fr 1.2fr;gap:10px;}
.dc-card{background:var(--specter);border-radius:10px;padding:16px;border:1px solid rgba(123,79,255,.12);}
.dc-card-title{font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.1em;margin-bottom:12px;}
.mini-tier{display:flex;flex-direction:column;gap:6px;}
.mt-row{display:flex;align-items:center;gap:8px;font-size:12px;}
.mt-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0;}
.mt-name{flex:1;color:var(--muted);}
.mt-bar-t{flex:1;height:3px;background:var(--slate2);border-radius:3px;overflow:hidden;}
.mt-bar-f{height:100%;border-radius:3px;}
.mt-count{font-family:'DM Mono',monospace;font-size:11px;color:var(--muted);}
.acct-list{display:flex;flex-direction:column;gap:5px;}
.acct-row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:7px;background:var(--slate2);}
.acct-av{width:26px;height:26px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;flex-shrink:0;}
.acct-name{font-size:12px;flex:1;}
.acct-handle{font-size:10px;color:var(--muted);}
.acct-tier-d{width:6px;height:6px;border-radius:50%;}
.live-bar{
  background:var(--slate2);border:1px solid rgba(0,229,255,.25);border-radius:10px;
  padding:12px 16px;display:flex;align-items:center;gap:12px;
}
.lb-dot{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 8px var(--cyan);animation:pulse 1.5s ease infinite;flex-shrink:0;}
.lb-text{font-size:12px;color:var(--muted);flex:1;}
.lb-text strong{color:var(--ghost);}
.lb-track{width:120px;height:4px;background:var(--slate);border-radius:4px;overflow:hidden;}
.lb-fill{height:100%;background:var(--grad);border-radius:4px;width:67%;}
.lb-num{font-family:'DM Mono',monospace;font-size:13px;background:var(--grad);-webkit-background-clip:text;-webkit-text-fill-color:transparent;white-space:nowrap;}
`;

// ── DATA ──────────────────────────────────────────────────────────
const TIERS = [
  { name: "Safe to Cut",    count: 47, color: "#FF3E3E", pct: 100 },
  { name: "Probably Cut",   count: 31, color: "#FF7A3E", pct: 66 },
  { name: "Your Call",      count: 23, color: "#FFD166", pct: 49 },
  { name: "Might Keep",     count: 18, color: "#7B4FFF", pct: 38 },
  { name: "Keep Following", count: 12, color: "#00E676", pct: 25 },
];

const ACCOUNTS = [
  { initials:"UE", name:"Urban Eats NYC",   handle:"@urbannyc",  followers:"12.4K", bg:"#2A0F0F", color:"#FF3E3E", tc:"#FF3E3E" },
  { initials:"FJ", name:"fitlife_journal",   handle:"@fitlife_j", followers:"890",   bg:"#2A0F0F", color:"#FF3E3E", tc:"#FF3E3E" },
  { initials:"TR", name:"Tech Roundup",      handle:"@tech.rd",   followers:"45.2K", bg:"#2A1808", color:"#FF7A3E", tc:"#FF7A3E" },
  { initials:"MV", name:"Marco Visuals",     handle:"@marcovis",  followers:"28.7K", bg:"#201A05", color:"#FFD166", tc:"#FFD166" },
];

const MARQUEE_ITEMS = [
  "Ghost the Ghosts", "Know Who's Really With You", "Clean Up · Level Up",
  "131 Ghosts Found", "Your Following List Is Lying", "Bulk Unfollow · Auto Queue",
  "Ghost the Ghosts", "Know Who's Really With You", "Clean Up · Level Up",
  "131 Ghosts Found", "Your Following List Is Lying", "Bulk Unfollow · Auto Queue",
];

const PRICING = [
  {
    name:"Free",price:"$0",period:"forever",featured:false,
    features:[
      {on:true, label:"Full ghost analysis"},
      {on:true, label:"Tier ranking & scoring"},
      {on:true, label:"View all non-followers"},
      {on:true, label:"10 manual unfollows/day"},
      {on:false,label:"Bulk unfollow queue"},
      {on:false,label:"Auto-scheduled cleanup"},
      {on:false,label:"Multi-account support"},
    ]
  },
  {
    name:"Pro",price:"$9.99",period:"/month",featured:true,
    features:[
      {on:true, label:"Everything in Free"},
      {on:true, label:"Bulk unfollow — 150/day"},
      {on:true, label:"Background queue engine"},
      {on:true, label:"Daily account snapshots"},
      {on:true, label:"CSV export"},
      {on:true, label:"Weekly auto-cleanup"},
      {on:false,label:"Multi-account support"},
    ]
  },
  {
    name:"Pro+",price:"$24.99",period:"/month",featured:false,
    features:[
      {on:true, label:"Everything in Pro"},
      {on:true, label:"3 Instagram accounts"},
      {on:true, label:"Whitelist rules"},
      {on:true, label:"Ghost follower detector"},
      {on:true, label:"Priority queue speed"},
      {on:true, label:"Engagement analytics"},
      {on:true, label:"Early access to features"},
    ]
  },
];

// ── COMPONENT ──────────────────────────────────────────────────────
export default function GhoastBrand() {
  const [countdown, setCountdown] = useState(23);
  const [activeTier, setActiveTier] = useState(null);
  const [bars, setBars] = useState(false);

  useEffect(()=>{
    const t = setInterval(()=>setCountdown(c=>c<=0?44:c-1),1000);
    setTimeout(()=>setBars(true), 600);
    return ()=>clearInterval(t);
  },[]);

  return(
    <>
      <style>{CSS}</style>
      <div className="noise"/>
      <div className="orb orb1"/><div className="orb orb2"/><div className="orb orb3"/>

      {/* NAV */}
      <nav>
        <div className="nav-logo">
          <div className="nav-logo-mark">G</div>
          <div className="nav-wordmark">Gh<span className="oa">oa</span>st</div>
        </div>
        <div className="nav-links">
          {["How it works","Pricing","For Creators"].map(l=>(
            <div key={l} className="nav-link">{l}</div>
          ))}
        </div>
        <button className="nav-cta">Start Free — It's Instant</button>
      </nav>

      {/* HERO */}
      <div className="hero">
        <div className="hero-badge"><span className="badge-dot"/>Instagram Intelligence · Now Live</div>

        <h1 className="hero-title">
          <span className="line1">See who</span>
          <span className="line2">ghosted your count.</span>
        </h1>

        <p className="hero-sub">
          Ghoast ranks every account that doesn't follow you back —
          from <strong>safe to cut</strong> to <strong>keep forever.</strong>{" "}
          Then bulk-unfollows them automatically. Your feed. Cleaned.
        </p>

        <div className="hero-actions">
          <button className="btn-primary">Scan My Account Free →</button>
          <button className="btn-ghost-btn">See how it works</button>
        </div>

        <div className="hero-proof">
          <div className="proof-avatars">
            {[["AK","#7B4FFF"],["MR","#00A8CC"],["JL","#FF6B6B"],["ST","#00C896"],["PK","#FF8C42"]].map(([i,c])=>(
              <div key={i} className="proof-av" style={{background:c}}>{i}</div>
            ))}
          </div>
          <div className="proof-text"><strong>2,400+ cleanups</strong> run this week</div>
        </div>

        {/* HERO WIDGET */}
        <div className="hero-widget">
          <div className="widget-header">
            <div className="widget-title">@alexkim · Ghost Analysis</div>
            <div className="widget-live"><span className="badge-dot"/>Live Data</div>
          </div>
          <div className="widget-stat-row">
            <div className="wstat">
              <div className="wstat-val vgrad">1,247</div>
              <div className="wstat-label">Followers</div>
            </div>
            <div className="wstat">
              <div className="wstat-val" style={{color:"var(--ghost)"}}>1,378</div>
              <div className="wstat-label">Following</div>
            </div>
            <div className="wstat">
              <div className="wstat-val vred">131</div>
              <div className="wstat-label">Ghosts Found</div>
            </div>
          </div>
          <div className="widget-tiers">
            {TIERS.map(t=>(
              <div className="wtier" key={t.name}>
                <div className="wtier-dot" style={{background:t.color,boxShadow:`0 0 6px ${t.color}88`}}/>
                <div className="wtier-name" style={{fontSize:13}}>{t.name}</div>
                <div className="wtier-bar">
                  <div className="wtier-fill" style={{width: bars?`${t.pct}%`:"0%", background:t.color}}/>
                </div>
                <div className="wtier-count">{t.count}</div>
              </div>
            ))}
          </div>
          <button className="widget-action">
            👻  Ghost the Ghosts — Start Bulk Unfollow
          </button>
        </div>
      </div>

      {/* MARQUEE */}
      <div className="marquee-wrap">
        <div className="marquee-track">
          {MARQUEE_ITEMS.map((item,i)=>(
            <div className="marquee-item" key={i}>
              <span className="marquee-text">{item}</span>
              <span className="marquee-sep">·</span>
            </div>
          ))}
        </div>
      </div>

      {/* HOW IT WORKS */}
      <div className="section">
        <div className="section-badge">How It Works</div>
        <h2 className="section-title">Three steps.<br/>Zero guesswork.</h2>
        <p className="section-sub">Ghoast does the analysis, the ranking, and the cleanup. You just decide who makes the cut.</p>
        <div className="steps">
          {[
            { icon:"🔗", num:"01", title:"Connect Your Account", desc:"Secure OAuth login. We analyze your full following list in under 60 seconds. No passwords stored — ever." },
            { icon:"👻", num:"02", title:"See Your Ghosts, Ranked", desc:"Every non-follower gets a priority score. From dead accounts and bot pages to creators you actually watch — tiered and sorted." },
            { icon:"⚡", num:"03", title:"Ghost the Ghosts", desc:"Select your Tier 1 list. Hit go. Our background queue unfollows with smart delays to protect your account — runs without you." },
          ].map(s=>(
            <div className="step" key={s.num}>
              <div className="step-num">{s.num} — Step</div>
              <div className="step-icon">{s.icon}</div>
              <div className="step-title">{s.title}</div>
              <div className="step-desc">{s.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* TIER SECTION */}
      <div className="tier-section">
        <div className="tier-inner">
          <div>
            <div className="section-badge">The Ranking System</div>
            <h2 className="section-title">Not all ghosts are equal.</h2>
            <p className="section-sub">Ghoast scores every non-follower across 5 dimensions — account type, size, engagement history, post frequency, and ratio. The result is a ranked list so obvious, the decisions make themselves.</p>
            <div className="tier-list-big">
              {TIERS.map((t,i)=>(
                <div
                  key={t.name}
                  className="tier-card-big"
                  style={activeTier===i?{borderColor:t.color,background:"var(--specter)"}:{}}
                  onMouseEnter={()=>setActiveTier(i)}
                  onMouseLeave={()=>setActiveTier(null)}
                >
                  <div className="tcb-dot" style={{background:t.color,boxShadow:`0 0 8px ${t.color}88`,width:12,height:12,borderRadius:"50%"}}/>
                  <div className="tcb-info">
                    <div className="tcb-name">{t.name}</div>
                    <div className="tcb-desc" style={{fontSize:12,color:"var(--muted)",marginTop:2}}>
                      {["Dead accounts, dormant pages, zero history",
                        "Brand pages, local biz, no engagement",
                        "Creators you watch — your call",
                        "Industry contacts, occasional interactions",
                        "Celebrities, major creators — never unfollow"][i]}
                    </div>
                  </div>
                  <div className="tcb-count" style={{color:t.color,fontFamily:"'DM Mono',monospace"}}>{t.count}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <div className="tier-visual">
              {TIERS.map(t=>(
                <div className="tv-bar-row" key={t.name}>
                  <div className="tv-label" style={{fontSize:12,color:"var(--muted)"}}>{t.name}</div>
                  <div className="tv-track">
                    <div className="tv-fill" style={{width:bars?`${t.pct}%`:"0%",background:t.color}}/>
                  </div>
                  <div className="tv-num" style={{color:t.color}}>{t.count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* STAT STRIP */}
      <div className="stat-strip">
        <div className="stat-strip-inner">
          {[
            {val:"2.4K+",  label:"Cleanups this week"},
            {val:"131",    label:"Avg ghosts per account"},
            {val:"0.31",   label:"Avg ratio improvement"},
            {val:"8 min",  label:"Avg time to full cleanup"},
          ].map(s=>(
            <div className="sstat" key={s.val}>
              <div className="sstat-val">{s.val}</div>
              <div className="sstat-label">{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* DASHBOARD PREVIEW */}
      <div className="dash-preview">
        <div className="dash-inner">
          <div style={{textAlign:"center"}}>
            <div className="section-badge" style={{display:"inline-block"}}>The Dashboard</div>
            <h2 className="section-title" style={{textAlign:"center"}}>Built for clarity.<br/>Designed for action.</h2>
          </div>
          <div className="dash-frame">
            <div className="dash-topbar">
              <div className="dash-dot" style={{background:"#FF5F57"}}/>
              <div className="dash-dot" style={{background:"#FEBC2E"}}/>
              <div className="dash-dot" style={{background:"#28C840"}}/>
              <div style={{flex:1,textAlign:"center",fontSize:12,color:"var(--muted)"}}>ghoast.app/dashboard</div>
            </div>
            <div className="dash-body">
              <div className="dash-sidebar">
                {["Overview","Ghost List","Bulk Unfollow","Growth","Settings"].map((s,i)=>(
                  <div key={s} className={`ds-item ${i===0?"active":""}`}>
                    <div className="ds-item-dot" style={{background:i===0?"var(--violet)":"var(--muted)",borderRadius:"50%"}}/>
                    {s}
                    {s==="Bulk Unfollow"&&<div style={{marginLeft:"auto",background:"var(--violet)",fontSize:9,padding:"2px 6px",borderRadius:20,fontWeight:700}}>67</div>}
                  </div>
                ))}
              </div>
              <div className="dash-content">
                <div className="live-bar">
                  <div className="lb-dot"/>
                  <div className="lb-text">Queue active — <strong>unfollowing 20 of 67</strong></div>
                  <div className="lb-track"><div className="lb-fill"/></div>
                  <div className="lb-num">next in {countdown}s</div>
                </div>
                <div className="dc-stats">
                  {[
                    {val:"1,247",label:"Followers",cls:""},
                    {val:"1,378",label:"Following",cls:""},
                    {val:"131",label:"Ghosts",cls:"r"},
                    {val:"0.90",label:"Ratio",cls:"g"},
                  ].map(s=>(
                    <div className="dcs" key={s.label}>
                      <div className={`dcs-val ${s.cls}`} style={{color:!s.cls?"var(--ghost)":undefined}}>{s.val}</div>
                      <div className="dcs-label">{s.label}</div>
                    </div>
                  ))}
                </div>
                <div className="dc-row">
                  <div className="dc-card">
                    <div className="dc-card-title">Tier Breakdown</div>
                    <div className="mini-tier">
                      {TIERS.map(t=>(
                        <div className="mt-row" key={t.name}>
                          <div className="mt-dot" style={{background:t.color}}/>
                          <div className="mt-name">{t.name}</div>
                          <div className="mt-bar-t"><div className="mt-bar-f" style={{width:`${t.pct}%`,background:t.color}}/></div>
                          <div className="mt-count">{t.count}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="dc-card">
                    <div className="dc-card-title">Ghost List</div>
                    <div className="acct-list">
                      {ACCOUNTS.map(a=>(
                        <div className="acct-row" key={a.name}>
                          <div className="acct-av" style={{background:a.bg,color:a.color}}>{a.initials}</div>
                          <div style={{flex:1}}>
                            <div className="acct-name">{a.name}</div>
                            <div className="acct-handle">{a.handle}</div>
                          </div>
                          <div style={{fontSize:10,fontFamily:"'DM Mono',monospace",color:"var(--muted)",marginRight:8}}>{a.followers}</div>
                          <div className="acct-tier-d" style={{background:a.tc,boxShadow:`0 0 5px ${a.tc}88`,borderRadius:"50%",width:6,height:6}}/>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* PRICING */}
      <div className="pricing-section">
        <div className="pricing-inner">
          <div style={{textAlign:"center"}}>
            <div className="section-badge" style={{display:"inline-block"}}>Pricing</div>
            <h2 className="section-title" style={{textAlign:"center"}}>Start free.<br/>Pay when it clicks.</h2>
            <p className="section-sub" style={{margin:"0 auto",textAlign:"center"}}>See your ghost list for free. Upgrade when you're ready to act.</p>
          </div>
          <div className="pricing-grid">
            {PRICING.map(p=>(
              <div key={p.name} className={`price-card ${p.featured?"featured":""}`}>
                {p.featured&&<div className="featured-tag">Most Popular</div>}
                <div className="price-name">{p.name}</div>
                <div className="price-amount">
                  {p.price}<span>{p.period}</span>
                </div>
                <div className="price-period">{p.featured?"Billed monthly · cancel anytime":"Free forever · no card needed"}</div>
                <div className="price-divider"/>
                <div className="price-features">
                  {p.features.map(f=>(
                    <div key={f.label} className={`pf ${f.on?"":"off-item"}`}>
                      <div className={`pf-check ${f.on?"on":"off"}`}>
                        {f.on&&<span style={{color:"#fff",fontWeight:700}}>✓</span>}
                        {!f.on&&<span style={{color:"var(--muted)"}}>–</span>}
                      </div>
                      {f.label}
                    </div>
                  ))}
                </div>
                <button className={`price-btn ${p.featured?"primary":"secondary"}`}>
                  {p.name==="Free"?"Get Started Free":"Get "+p.name}
                </button>
              </div>
            ))}
          </div>
          <div style={{textAlign:"center",marginTop:32,fontSize:14,color:"var(--muted)"}}>
            Prefer pay-as-you-go? Credit packs start at <strong style={{color:"var(--ghost)"}}>$2.99 for 100 unfollows.</strong>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer>
        <div>
          <div className="footer-brand">Gh<span className="oa">oa</span>st</div>
          <div style={{fontSize:12,color:"var(--muted)",marginTop:4}}>See who's really with you.</div>
        </div>
        <div className="footer-links">
          {["Privacy","Terms","Contact","@ghoastapp"].map(l=>(
            <div key={l} className="footer-link">{l}</div>
          ))}
        </div>
        <div className="footer-copy">© 2025 Ghoast · ghoast.app</div>
      </footer>
    </>
  );
}
