import React, { useEffect, useState } from "react";
import {
  ArrowUpRight, Menu, X, Scissors, Sparkles, GraduationCap, Ruler,
  ShieldCheck, Heart, Phone, MessageCircle, CheckCircle2, Play, UserRound
} from "lucide-react";
import Portal from "./Portal.jsx";

const wa = "https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to make an enquiry.");
const collections = [
  { name: "Bespoke Menswear", tag: "Precision in every stitch", type: "MEN", image: "https://images.unsplash.com/photo-1593032465175-481ac7f401a0?auto=format&fit=crop&w=1000&q=85" },
  { name: "Women's Elegance", tag: "Designed around you", type: "WOMEN", image: "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=1000&q=85" },
  { name: "Bridal & Occasion", tag: "For your unforgettable moments", type: "BRIDAL", image: "https://images.unsplash.com/photo-1594552072238-b8a33785b7a7?auto=format&fit=crop&w=1000&q=85" },
  { name: "African Heritage", tag: "Tradition, tailored beautifully", type: "TRADITIONAL", image: "https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=1000&q=85" }
];
const services = [
  { icon: Scissors, title: "Bespoke Clothing Design", copy: "Made-to-measure pieces shaped around your style, occasion and personality." },
  { icon: Sparkles, title: "Industrial Tailoring", copy: "Professional garment production for institutions, businesses and groups." },
  { icon: GraduationCap, title: "Fashion Institute", copy: "Practical fashion education for people ready to build a skill and a future." }
];

export default function App() {
  const [menu, setMenu] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [musicNotice, setMusicNotice] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  async function install() {
    if (!installPrompt) { alert("Open your browser menu and choose Add to Home screen or Install app."); return; }
    installPrompt.prompt(); await installPrompt.userChoice; setInstallPrompt(null);
  }
  const close = () => setMenu(false);
  return <div className="site-shell">
    <div className="announcement"><span>CRAFTED WITH PURPOSE SINCE 2010</span><span>IJEBU ODE, OGUN STATE · NIGERIA</span></div>
    <header className="header">
      <a className="brand" href="#home"><span className="brand-mark">M<span>F</span></span><span className="brand-copy"><b>MR FOP</b><small>FASHIONS COMPANY</small></span></a>
      <button className="mobile-menu" onClick={() => setMenu(!menu)} aria-label="Toggle navigation">{menu ? <X/> : <Menu/>}</button>
      <nav className={menu ? "nav nav-open" : "nav"}>
        <a href="#collections" onClick={close}>Collections</a><a href="#services" onClick={close}>What We Do</a>
        <a href="#institute" onClick={close}>Fashion Institute</a><a href="#story" onClick={close}>Our Story</a>
        <a href="#contact" onClick={close}>Contact</a>
        <button className="account-cta" onClick={() => {setPortalOpen(true);close();}}><UserRound size={15}/> My Account</button>
        <a className="nav-cta" href={wa} target="_blank" rel="noreferrer">Book a Consultation <ArrowUpRight size={15}/></a>
      </nav>
    </header>
    <main>
      <section className="hero" id="home">
        <div className="hero-photo"/><div className="hero-shade"/>
        <div className="hero-content"><p className="eyebrow light"><i/> THE ART OF PERSONAL STYLE</p>
          <h1>Wear your<br/><em>confidence.</em></h1>
          <p className="hero-lede">Distinctive fashion. Thoughtful craftsmanship. A fit that feels like it was made for you — because it was.</p>
          <div className="hero-actions"><a className="button button-gold" href="#collections">Explore our collections <ArrowUpRight size={17}/></a><a className="text-link" href="#story">Discover our story →</a></div>
        </div>
        <div className="hero-caption"><span>01 / 04</span><span>THE MR FOP SIGNATURE</span></div>
        <div className="hero-seal"><span>EST.</span><b>2010</b><small>IJEBU ODE</small></div>
      </section>
      <section className="welcome section-pad" id="story">
        <div className="welcome-label"><span className="eyebrow">A HOUSE BUILT ON CRAFT</span><i/></div>
        <div><h2>Welcome to a world where <em>every detail matters.</em></h2>
          <p className="intro">MR FOP FASHIONS COMPANY NIGERIA LIMITED is a fashion design and industrial tailoring company established in 2010. We bring creativity, precision and professional service together to help every client feel brand new.</p>
          <div className="welcome-bottom"><p>From bespoke menswear and women's elegance to bridal creations, traditional attire and professional training, we make style personal.</p><a className="round-link" href="#services" aria-label="Explore services"><ArrowUpRight/></a></div>
        </div>
      </section>
      <section className="collections section-pad" id="collections">
        <div className="section-heading"><div><p className="eyebrow"><i/> MADE FOR YOUR MOMENTS</p><h2>Find your <em>signature.</em></h2></div><p>Explore expressions of style, made with care and finished with intention.</p></div>
        <div className="collection-grid">{collections.map(item => <a className="collection-card" href={wa} target="_blank" rel="noreferrer" key={item.name}>
          <img src={item.image} alt={item.name} loading="lazy"/><div className="collection-overlay"/><span className="collection-type">{item.type}</span>
          <div className="collection-info"><div><h3>{item.name}</h3><p>{item.tag}</p></div><span className="collection-arrow"><ArrowUpRight/></span></div>
        </a>)}</div>
      </section>
      <section className="quote-band"><div className="quote-mark">“</div><p>Our mission is simple: to make every customer feel <em>brand new and happy</em> through excellence and professional service.</p><span>THE MR FOP PROMISE</span></section>
      <section className="services section-pad" id="services">
        <div className="section-heading"><div><p className="eyebrow"><i/> OUR EXPERTISE</p><h2>Craft. Create. <em>Become.</em></h2></div><p>One fashion house. Three ways to bring your vision to life.</p></div>
        <div className="service-grid">{services.map(({icon: Icon, title, copy}, i) => <article className="service-card" key={title}><span className="service-number">0{i+1}</span><div className="service-icon"><Icon size={25}/></div><h3>{title}</h3><p>{copy}</p><a href={i === 2 ? "#institute" : wa} target={i === 2 ? undefined : "_blank"} rel="noreferrer" className="service-link">Discover more <ArrowUpRight size={16}/></a></article>)}</div>
      </section>
      <section className="institute" id="institute"><div className="institute-photo"><img src="https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=85" alt="Fashion design and creative training" loading="lazy"/></div>
        <div className="institute-content"><p className="eyebrow light"><i/> LEARN A SKILL. BUILD A FUTURE.</p><h2>Turn your passion<br/>into <em>your profession.</em></h2>
          <p>Our Fashion Institute is the learning arm of MR FOP FASHIONS. Whether you are starting from the beginning or developing your craft, take the next step with practical fashion training.</p>
          <div className="training-points"><span><CheckCircle2/> Online learning pathway</span><span><CheckCircle2/> Onsite practical training</span><span><CheckCircle2/> Guided professional development</span></div>
          <a href={wa} target="_blank" rel="noreferrer" className="button button-gold">Enquire about training <ArrowUpRight size={17}/></a>
        </div>
      </section>
      <section className="promise section-pad"><div><p className="eyebrow"><i/> WHY MR FOP</p><h2>Good style is seen.<br/><em>Great fit is felt.</em></h2></div>
        <div className="promise-items"><article><ShieldCheck/><h3>Professional Craft</h3><p>Careful workmanship and attention to the details that make a difference.</p></article><article><Ruler/><h3>Personal Fit</h3><p>Thoughtful measurement and design choices built around the individual.</p></article><article><Heart/><h3>Customer Happiness</h3><p>Service shaped around listening, trust and lasting relationships.</p></article></div>
      </section>
      <section className="contact section-pad" id="contact"><div><p className="eyebrow light"><i/> YOUR NEXT LOOK STARTS HERE</p><h2>Let's create<br/><em>something remarkable.</em></h2></div>
        <div className="contact-side"><p>Tell us what you have in mind. Our team will be happy to guide you through styles, measurements, appointments and training enquiries.</p><a className="button button-gold" href={wa} target="_blank" rel="noreferrer">Start a conversation <ArrowUpRight size={17}/></a><div className="contact-detail"><Phone size={15}/> +234 805 547 2913</div></div>
      </section>
    </main>
    <footer className="footer"><div className="footer-main"><a className="brand brand-footer" href="#home"><span className="brand-mark">M<span>F</span></span><span className="brand-copy"><b>MR FOP</b><small>FASHIONS COMPANY</small></span></a><p>Distinctive fashion and professional training.<br/>Making you feel brand new since 2010.</p><a className="footer-wa" href={wa} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} MR FOP FASHIONS COMPANY NIGERIA LIMITED</span><span>RC 1089546 · IJEBU ODE, OGUN STATE</span><a href="#home">BACK TO TOP ↑</a></div>
    </footer>
    <button className="music-toggle" onClick={() => setMusicNotice(true)}><Play size={14}/> BRAND MUSIC</button>
    <button className="install-button" onClick={install}>Install app <ArrowUpRight size={16}/></button>
    <a className="whatsapp-float" href={wa} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><MessageCircle size={25}/></a>
    {musicNotice && <div className="modal-backdrop" onClick={() => setMusicNotice(false)}><div className="music-modal" onClick={e => e.stopPropagation()}><button onClick={() => setMusicNotice(false)} aria-label="Close">×</button><h3>MR FOP Brand Music</h3><p>The official company theme song will be connected when you upload the audio file. Browser audio requires a visitor interaction before playback.</p></div></div>}
    {portalOpen && <Portal onClose={() => setPortalOpen(false)}/>}
  </div>;
}