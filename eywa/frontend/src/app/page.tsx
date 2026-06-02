"use client";
import { useEffect, useRef, useState } from "react";
import EywaCanvas from "@/components/EywaCanvas";
import PandoraBackground from "@/components/PandoraBackground";
import YearSlider from "@/components/YearSlider";
import { useNetwork } from "@/hooks/useNetwork";

export default function Home() {
  const [scrollRatio, setScrollRatio] = useState(0);
  const [year, setYear] = useState(2023);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data, loading } = useNetwork(year);

  useEffect(() => {
    const el = document.documentElement;
    const onScroll = () => {
      const totalH = el.scrollHeight - window.innerHeight;
      setScrollRatio(totalH > 0 ? Math.max(0, Math.min(1, window.scrollY / totalH)) : 0);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const deg = scrollRatio < 0.15 ? 0 : Math.min(1, (scrollRatio - 0.15) / 0.75);
  const aliveCount = data ? Math.round(data.summary.alive_nodes * (1 - deg * 0.85)) : 0;
  const totalCount = data?.summary.total_nodes ?? 0;
  const integrity = totalCount > 0 ? Math.round((aliveCount / totalCount) * 100) : 100;
  const healthColor = integrity > 70 ? "#00c4a7" : integrity > 40 ? "#c8a04a" : "#c0392b";

  return (
    <>
      {/* Fonts */}
      <link
        href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600&family=EB+Garamond:ital,wght@0,400;0,500;1,400&display=swap"
        rel="stylesheet"
      />

      <style>{`
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
          --void: #010810; --teal: #00c4a7; --teal-bright: #4fffd6;
          --gold: #c8a04a; --dying: #c0392b; --text: #b8d4ce; --muted: #4a7a72;
        }
        html { background: #010810; scroll-behavior: smooth; }
        body { background: transparent; color: var(--text); font-family: 'EB Garamond', Georgia, serif; overflow-x: hidden; }
        section { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 60px 40px; position: relative; z-index: 1; pointer-events: none; }
        h1 { font-family: 'Cinzel', serif; font-size: clamp(2.4rem,5vw,4rem); font-weight: 600; color: #fff; line-height: 1.1; letter-spacing: 0.02em; }
        h2 { font-family: 'Cinzel', serif; font-size: clamp(1.3rem,2.5vw,1.8rem); font-weight: 400; color: #fff; letter-spacing: 0.04em; margin-bottom: 20px; }
        p { font-size: clamp(1rem,1.5vw,1.15rem); line-height: 1.75; color: var(--text); margin-bottom: 1.2em; }
        .eyebrow { font-family: 'Cinzel', serif; font-size: 10px; letter-spacing: 0.35em; text-transform: uppercase; color: var(--teal); opacity: 0.7; margin-bottom: 20px; }
        .divider { width: 60px; height: 1px; background: var(--teal); opacity: 0.25; margin: 28px 0; }
        .pull-quote { font-size: clamp(1.1rem,2vw,1.4rem); font-style: italic; color: #d8f0ec; line-height: 1.55; border-left: 1px solid var(--teal); padding-left: 24px; margin: 28px 0; }
        .block { max-width: 520px; }
        .block-left { text-align: left; margin-left: 8%; margin-right: auto; }
        .block-right { text-align: right; margin-right: 8%; margin-left: auto; }
        .block-right .divider { margin-left: auto; }
        .block-right .pull-quote { border-left: none; border-right: 1px solid var(--gold); padding-left: 0; padding-right: 24px; }
        .block-center { text-align: center; margin: 0 auto; }
        .block-center .divider { margin: 28px auto; }
        .scroll-hint { position: absolute; bottom: 40px; left: 50%; transform: translateX(-50%); display: flex; flex-direction: column; align-items: center; gap: 8px; opacity: 0.3; animation: float 2.5s ease-in-out infinite; }
        .scroll-hint span { font-family: 'Cinzel', serif; font-size: 9px; letter-spacing: 0.4em; color: var(--teal); text-transform: uppercase; }
        .scroll-line { width: 1px; height: 40px; background: linear-gradient(to bottom, var(--teal), transparent); }
        @keyframes float { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(6px)} }
        .stat-row { display: grid; grid-template-columns: repeat(3,1fr); gap: 14px; margin-top: 32px; }
        .stat-card { border: 1px solid rgba(0,196,167,0.15); padding: 18px 14px; background: rgba(0,30,25,0.4); }
        .stat-card.species { border-color: rgba(200,160,74,0.15); background: rgba(30,20,5,0.4); }
        .stat-card.carbon { border-color: rgba(255,107,53,0.15); background: rgba(30,10,5,0.4); }
        .stat-num { font-family: 'Cinzel', serif; font-size: clamp(1.4rem,2.5vw,2rem); font-weight: 600; color: var(--teal); display: block; line-height: 1; margin-bottom: 6px; }
        .stat-card.species .stat-num { color: var(--gold); }
        .stat-card.carbon .stat-num { color: #ff6b35; }
        .stat-src { font-family: 'Cinzel', serif; font-size: 8px; letter-spacing: 0.3em; text-transform: uppercase; opacity: 0.4; margin-bottom: 10px; }
        .stat-label { font-size: 0.8rem; line-height: 1.4; opacity: 0.6; }
        input[type=range]::-webkit-slider-thumb { appearance: none; width: 14px; height: 14px; background: #00c4a7; border-radius: 50%; cursor: pointer; }
        @media (max-width:600px) { section{padding:60px 20px} .block-left,.block-right{margin:0;text-align:center} .stat-row{grid-template-columns:1fr} .pull-quote{border-left:none;border-top:1px solid var(--teal);padding-left:0;padding-top:16px;} }
      `}</style>

      {/* Pandora scene — bottom-most layer */}
      <PandoraBackground />

      {/* Data node network — on top of Pandora */}
      <EywaCanvas data={data} scrollRatio={scrollRatio} />

      <div ref={scrollRef} style={{ position: "relative", zIndex: 1, pointerEvents: "none" }}>

        {/* HERO */}
        <section>
          <div className="block block-center">
            <p className="eyebrow">A Data Visualization</p>
            <h1 style={{ marginBottom: 8 }}>Eywa</h1>
            <h1 style={{ fontFamily: "'EB Garamond', serif", fontStyle: "italic", fontWeight: 400, fontSize: "clamp(1.8rem,4vw,3rem)", color: "var(--teal-bright)", marginBottom: 28 }}>
              is dying.
            </h1>
            <p style={{ fontSize: "1.05rem", opacity: 0.7, maxWidth: 380, margin: "0 auto" }}>
              In 2009, audiences wept for a fictional forest. They left the theater and returned to a world where the same destruction was already underway.
            </p>
            <div className="divider" />
            <p style={{ fontSize: "0.9rem", opacity: 0.45, letterSpacing: "0.03em" }}>
              What you are watching is not Pandora.<br />It is Earth.
            </p>

            {/* Live health bar */}
            <div style={{ marginTop: 36, textAlign: "left", maxWidth: 360, margin: "36px auto 0" }}>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 10, letterSpacing: "0.25em", textTransform: "uppercase", opacity: 0.4, marginBottom: 10 }}>
                Network integrity
              </div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", position: "relative" }}>
                <div style={{
                  height: "100%", width: `${integrity}%`,
                  background: healthColor, boxShadow: `0 0 8px ${healthColor}`,
                  transition: "width 1s ease, background 1s ease",
                }} />
              </div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 12, color: healthColor, marginTop: 8, transition: "color 1s" }}>
                {loading ? "Connecting…" : `${integrity}% — ${aliveCount} of ${totalCount} nodes alive`}
              </div>
            </div>
          </div>
          <div className="scroll-hint" aria-hidden>
            <span>scroll</span>
            <div className="scroll-line" />
          </div>
        </section>

        {/* DATA LAYER */}
        <section>
          <div className="block block-left">
            <p className="eyebrow">Global Forest Watch</p>
            <h2>The canopy is breaking.</h2>
            <div className="divider" />
            <p>
              Since Avatar premiered, the world has lost forest cover equivalent to the land area of Libya. Tree after tree and node after node, the forests slowly die; the network thinning before anyone has a chance to look up.
            </p>
            <div className="pull-quote">
              "The forest is dying and we cannot see it because we have no Pandora. There is no interface that makes this loss visible."
            </div>
            {data && (
              <div className="stat-row">
                <div className="stat-card">
                  <div className="stat-src">Forest Watch</div>
                  <span className="stat-num">{data.summary.forest_loss_mha.toFixed(1)}M</span>
                  <div className="stat-label">hectares lost in {year}</div>
                </div>
                <div className="stat-card species">
                  <div className="stat-src">IUCN Red List</div>
                  <span className="stat-num">{(data.summary.threatened_species / 1000).toFixed(0)}k</span>
                  <div className="stat-label">species threatened</div>
                </div>
                <div className="stat-card carbon">
                  <div className="stat-src">NASA / NOAA</div>
                  <span className="stat-num">{data.summary.avg_co2_ppm.toFixed(0)}</span>
                  <div className="stat-label">ppm CO₂ in atmosphere</div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* SPECIES */}
        <section>
          <div className="block block-right">
            <p className="eyebrow">IUCN Red List</p>
            <h2>Each node is a species.</h2>
            <div className="divider" />
            <p>
              In Pandora, Eywa holds the memory of every creature within her network. When a Na'vi dies, they return to her. The grief is communal because the loss is felt by the whole system.
            </p>
            <p>
              On Earth, a species disappears and there is no large connected system that feels it. No network registers the absence because humans have not built any interface for ecological grief and so we do not grieve.
            </p>
            <div className="pull-quote">
              Avatar revealed our <em>capacity</em> and the void where the real world's interface should be.
            </div>
          </div>
        </section>

        {/* ECOTOPIA */}
        <section>
          <div className="block block-left">
            <p className="eyebrow">Callenbach · Ecotopia</p>
            <h2>Ecotopia imagined. Pandora rendered.</h2>
            <div className="divider" />
            <p>
              Ernest Callenbach's Ecotopia (1975) proposed a society restructured around ecological interdependence; one that <em>sees</em> its forest, accounts for it, mourns it when it burns.
            </p>
            <p>
              Cameron solved the interface problem for a fictional planet and grossed $2.9 billion. The question this project asks is: why couldn't we build that for the real one?
            </p>
            <p style={{ opacity: 0.55, fontSize: "0.9rem" }}>
              Click any node to see the real species, region, or measurement station it represents.
            </p>
          </div>
        </section>

        {/* DEGRADATION */}
        <section>
          <div className="block block-center">
            <p className="eyebrow" style={{ color: "#ff6b35" }}>The argument</p>
            <h2 style={{ color: "#ff9e6d" }}>The glow is going out.</h2>
            <div className="divider" style={{ background: "#ff6b35" }} />
            <p>
              What you have been watching as you scrolled is not for decoration or aesthetics. The network above is degrading. Connections are breaking, nodes are going dark, the bioluminescence is fading.
            </p>
            <p>
              This is what ecological collapse looks like when it finally has an interface.
            </p>
            <p style={{ opacity: 0.55, fontSize: "0.9rem" }}>
              The tragedy of Avatar is that we built a big cinema-grade system for grieving a fictional ecosystem and left our actual ecosystem without a single equivalent.
            </p>
            <div style={{ marginTop: 32 }}>
              <div style={{
                fontFamily: "'Cinzel', serif", fontSize: 10,
                letterSpacing: "0.25em", textTransform: "uppercase",
                opacity: 0.4, marginBottom: 10,
              }}>Network integrity — current</div>
              <div style={{ height: 1, background: "rgba(255,255,255,0.06)", maxWidth: 320, margin: "0 auto" }}>
                <div style={{
                  height: "100%", width: `${integrity}%`,
                  background: healthColor, boxShadow: `0 0 8px ${healthColor}`,
                  transition: "width 1s ease, background 1s ease",
                }} />
              </div>
              <div style={{ fontFamily: "'Cinzel', serif", fontSize: 14, color: healthColor, marginTop: 10 }}>
                {integrity}%
              </div>
            </div>
          </div>
        </section>

        {/* END */}
        <section>
          <div className="block block-center">
            <span style={{ fontSize: "2.5rem", opacity: 0.35, display: "block", marginBottom: 20 }} aria-hidden>✦</span>
            <p className="eyebrow">Eywa hears you</p>
            <h2 style={{ fontSize: "1.3rem", opacity: 0.7 }}>The network remembers what we choose not to see.</h2>
            <div className="divider" />
            <p style={{ opacity: 0.45, fontSize: "0.85rem", maxWidth: 380, margin: "0 auto" }}>
              Data: Global Forest Watch · IUCN Red List · NASA Earth Observatory<br /><br />
              Texts: James Cameron, <em>Avatar</em> (2009) · Ernest Callenbach, <em>Ecotopia</em> (1975)
            </p>
          </div>
        </section>

        {/* Bottom padding so slider doesn't cover content */}
        <div style={{ height: 120 }} />
      </div>

      {/* Year slider — always visible */}
      <YearSlider year={year} onChange={setYear} />
    </>
  );
}