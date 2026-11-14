import React, { useEffect, useState } from "react";
import { ArrowUpRight, Sparkles } from "lucide-react";

const SESSION_KEY = "mrfop-welcome-seen";

export default function WelcomeExperience() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      if (!window.sessionStorage.getItem(SESSION_KEY)) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function enterSite() {
    try { window.sessionStorage.setItem(SESSION_KEY, "1"); } catch {}
    setOpen(false);
  }

  if (!open) return null;
  return <div className="welcome-experience" role="dialog" aria-modal="true" aria-labelledby="welcome-experience-title">
    <div className="welcome-experience-glow" aria-hidden="true"/>
    <div className="welcome-experience-content">
      <img src="/mrfob/mr-fop-website-logo.webp" alt="MR FOP FASHIONS" />
      <p className="welcome-experience-eyebrow"><Sparkles size={14}/> EST. 2010 · IJEBU ODE, NIGERIA</p>
      <h2 id="welcome-experience-title">WELCOME TO<br/><em>MR FOP FASHIONS</em></h2>
      <p>Distinctive fashion, bespoke tailoring and practical fashion education — crafted with purpose.</p>
      <button type="button" onClick={enterSite}>Explore the experience <ArrowUpRight size={17}/></button>
      <small>MR FOP FASHIONS COMPANY NIGERIA LIMITED</small>
    </div>
  </div>;
}
