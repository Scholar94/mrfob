import React, { useEffect, useRef, useState } from "react";
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

const collectionCategories = [
  { title: "Men's collection", intro: "Tailored options across formal, traditional and everyday dressing.", items: ["3-piece suits", "2-piece suits", "Waistcoats", "Designer shirts", "Premium trousers", "Senator wears", "Agbada", "Native attire", "Traditional caps", "Corporate clothing", "Casual wear"] },
  { title: "Women's collection", intro: "A considered range for professional dressing, celebrations and everyday style.", items: ["Corporate suits", "Gowns", "Evening dresses", "Bridal dresses", "Wedding reception dresses", "Skirt and blouse", "Native outfits", "Corporate dresses", "Casual dresses", "Special occasion outfits"] },
  { title: "Bridal & special occasions", intro: "Discuss coordinated looks and occasion-specific garments with the fashion team.", items: ["Bridal dresses", "Wedding reception dresses", "Wedding party clothing", "Special occasion outfits", "Customized clothing"] }
];
const services = [
  { icon: Scissors, title: "Bespoke Clothing Design", copy: "Made-to-measure pieces shaped around your style, occasion and personality." },
  { icon: Sparkles, title: "Industrial Tailoring", copy: "Professional garment production for institutions, businesses and groups." },
  { icon: GraduationCap, title: "Fashion Institute", copy: "Practical fashion education for people ready to build a skill and a future." }
];

export default function App() {
  const [menu, setMenu] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installMessage, setInstallMessage] = useState("");
  const [musicNotice, setMusicNotice] = useState(false);
  const [portalOpen, setPortalOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState("");
  const dialogRef = useRef(null);
  const returnFocusRef = useRef(null);
  useEffect(() => {
    const handler = e => { e.preventDefault(); setInstallPrompt(e); };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);
  useEffect(() => {
    if (!policyOpen && !musicNotice) return;
    returnFocusRef.current = document.activeElement;
    const dialog = dialogRef.current;
    const focusable = () => dialog?.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])') || [];
    focusable()[0]?.focus();
    function handleDialogKeyDown(event) {
      if (event.key === "Escape") {
        event.preventDefault();
        setPolicyOpen("");
        setMusicNotice(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = Array.from(focusable());
      if (!items.length) { event.preventDefault(); dialog?.focus(); return; }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && (document.activeElement === first || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !dialog?.contains(document.activeElement))) {
        event.preventDefault(); first.focus();
      }
    }
    document.addEventListener("keydown", handleDialogKeyDown);
    return () => {
      document.removeEventListener("keydown", handleDialogKeyDown);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [policyOpen, musicNotice]);
  async function install() {
    if (!installPrompt) {
      setInstallMessage("To install MR FOP FASHIONS, open your browser menu and choose Install app or Add to Home screen. The exact wording depends on your browser.");
      return;
    }
    try {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      setInstallMessage(choice?.outcome === "accepted" ? "The installation prompt was accepted. Follow your browser instructions to finish." : "Installation was not completed. You can try again from your browser menu.");
    } catch (error) {
      setInstallMessage("The installation prompt is unavailable right now. Please use your browser menu to install or add this site to your home screen.");
    } finally {
      setInstallPrompt(null);
    }
  }
  function handleIndustrialEnquiry(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const message = [
      "Hello MR FOP FASHIONS, I would like to discuss an institutional or group tailoring project.",
      "",
      "Contact person: " + data.get("contactName"),
      "Organisation/group: " + data.get("organisation"),
      "Project type: " + data.get("projectType"),
      "Estimated quantity: " + data.get("quantity"),
      "Project location: " + data.get("projectLocation"),
      "Preferred timeline: " + (data.get("timeline") || "To be discussed"),
      "Project details: " + data.get("projectDetails"),
      "",
      "Please guide me on the next steps, quotation requirements and consultation."
    ].join("\\n");
    window.open("https://wa.me/2348055472913?text=" + encodeURIComponent(message), "_blank", "noopener,noreferrer");
    form.reset();
  }
  const close = () => setMenu(false);
  return <div className="site-shell">
    <div className="announcement"><span>CRAFTED WITH PURPOSE SINCE 2010</span><span>IJEBU ODE, OGUN STATE · NIGERIA</span></div>
    <header className="header">
      <a className="brand" href="#home"><span className="brand-mark">M<span>F</span></span><span className="brand-copy"><b>MR FOP</b><small>FASHIONS COMPANY</small></span></a>
      <button className="mobile-menu" type="button" onClick={() => setMenu(!menu)} aria-label={menu ? "Close navigation" : "Open navigation"} aria-expanded={menu} aria-controls="primary-navigation">{menu ? <X/> : <Menu/>}</button>
      <nav id="primary-navigation" className={menu ? "nav nav-open" : "nav"}>
        <a href="#collections" onClick={close}>Collections</a><a href="#services" onClick={close}>What We Do</a><a href="#how-to-order" onClick={close}>How to Order</a>
        <a href="#institute" onClick={close}>Fashion Institute</a><a href="#about" onClick={close}>About</a><a href="#story" onClick={close}>Our Story</a>
        <a href="#contact" onClick={close}>Contact</a>
        <button className="account-cta" onClick={() => {setPortalOpen(true);close();}}><UserRound size={15}/> My Account</button>
        <a className="nav-cta" href={wa} target="_blank" rel="noreferrer">Book a Consultation <ArrowUpRight size={15}/></a>
      </nav>
    </header>
    <a className="skip-link" href="#main-content">Skip to main content</a>
    <main id="main-content" tabIndex="-1">
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
      <section className="about-company section-pad" id="about">
        <div className="about-company-heading"><p className="eyebrow"><i/> OUR COMPANY · RC 1089546</p><h2>Built on service.<br/><em>Driven by excellence.</em></h2><p>Established in 2010, MR FOP FASHIONS COMPANY NIGERIA LIMITED brings clothing design, industrial tailoring and professional fashion training together under one company.</p></div>
        <div className="about-company-details">
          <article><span>OUR MISSION</span><p>To make customers feel brand new and happy always through excellent and professional services.</p></article>
          <article><span>OUR VISION</span><p>To be recognized as a leading service delivery company providing maximum customer satisfaction.</p></article>
          <article><span>WHAT WE DO</span><p>Clothing designing and industrial tailoring, alongside the MR FOP FASHIONS Fashion Institute and professional fashion training.</p></article>
        </div>
      </section>
      <section className="collections section-pad" id="collections">
        <div className="section-heading"><div><p className="eyebrow"><i/> MADE FOR YOUR MOMENTS</p><h2>Find your <em>signature.</em></h2></div><p>Explore expressions of style, made with care and finished with intention.</p></div>
        <div className="collection-grid">{collections.map(item => <a className="collection-card" href={wa} target="_blank" rel="noreferrer" key={item.name}>
          <img src={item.image} alt={item.name} loading="lazy"/><div className="collection-overlay"/><span className="collection-type">{item.type}</span>
          <div className="collection-info"><div><h3>{item.name}</h3><p>{item.tag}</p></div><span className="collection-arrow"><ArrowUpRight/></span></div>
        </a>)}</div>
      </section>

      <section className="collection-categories section-pad" id="collection-categories">
        <div className="section-heading"><div><p className="eyebrow"><i/> EXPLORE THE DETAILS</p><h2>Collections with <em>character.</em></h2></div><p>Choose a category to start a conversation with our team. Specific styles, fabrics, availability, pricing and timelines are confirmed during consultation.</p></div>
        <div className="category-grid">{collectionCategories.map(group => <article className="category-panel" key={group.title}>
          <div className="category-panel-heading"><span>MR FOP · COLLECTIONS</span><h3>{group.title}</h3><p>{group.intro}</p></div>
          <ul>{group.items.map(item => <li key={item}><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to enquire about " + item + ". Please guide me on the available options.")} target="_blank" rel="noreferrer">{item}<ArrowUpRight size={14}/></a></li>)}</ul>
        </article>)}</div>
        <p className="category-disclaimer">This is a service and style category guide, not a live inventory or a confirmation that every design is currently available.</p>
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
      <section className="industrial section-pad" id="industrial">
        <div className="section-heading"><div><p className="eyebrow"><i/> MADE FOR TEAMS AND ORGANISATIONS</p><h2>Industrial & <em>corporate tailoring.</em></h2></div><p>Professional clothing solutions for organisations, teams and coordinated groups. Share your requirements with our team for a tailored discussion.</p></div>
        <div className="industrial-grid">
          <article><span>01</span><h3>Corporate uniforms</h3><p>Coordinated workwear shaped around your organisation's identity, staff roles and practical needs.</p><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to enquire about corporate uniforms for our organisation.")} target="_blank" rel="noreferrer">Discuss corporate uniforms <ArrowUpRight size={15}/></a></article>
          <article><span>02</span><h3>School uniforms</h3><p>Enquire about schoolwear requirements, garment specifications, sizing arrangements and coordinated orders.</p><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to discuss school uniform production.")} target="_blank" rel="noreferrer">Discuss school uniforms <ArrowUpRight size={15}/></a></article>
          <article><span>03</span><h3>Institutional clothing</h3><p>Uniform and clothing enquiries for institutions, associations and organised teams, subject to project review.</p><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to enquire about institutional clothing.")} target="_blank" rel="noreferrer">Discuss institutional orders <ArrowUpRight size={15}/></a></article>
          <article><span>04</span><h3>Wedding party clothing</h3><p>Coordinate clothing enquiries for wedding parties and groups, with styles and quantities discussed together.</p><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to enquire about wedding party clothing.")} target="_blank" rel="noreferrer">Plan wedding party outfits <ArrowUpRight size={15}/></a></article>
          <article><span>05</span><h3>Customized group orders</h3><p>Discuss matching or individually customized garments, group measurements, fabric choices and project details.</p><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to discuss customized clothing for a group.")} target="_blank" rel="noreferrer">Discuss a group order <ArrowUpRight size={15}/></a></article>
          <article><span>06</span><h3>Production coordination</h3><p>Review specifications, quantities, fitting arrangements and proposed timelines before any project is accepted.</p><a href={"https://wa.me/2348055472913?text=" + encodeURIComponent("Hello MR FOP FASHIONS, I would like to discuss production coordination for a tailoring project.")} target="_blank" rel="noreferrer">Plan your production <ArrowUpRight size={15}/></a></article>
        </div>
        <div className="industrial-enquiry">
          <div className="industrial-enquiry-intro"><p className="eyebrow"><i/> START A PROJECT DISCUSSION</p><h3>Tell us what your team <em>needs.</em></h3><p>Share the initial details below. Your message will open in WhatsApp for you to review and send. This form does not submit or store information on this website.</p></div>
          <form className="industrial-enquiry-form" onSubmit={handleIndustrialEnquiry}>
            <label>Contact person's name<input name="contactName" autoComplete="name" required maxLength="100" placeholder="Your full name"/></label>
            <label>Organisation or group<input name="organisation" required maxLength="120" placeholder="School, company, association or group"/></label>
            <label>Project type<select name="projectType" required defaultValue=""><option value="" disabled>Select a project type</option><option>Corporate uniforms</option><option>School uniforms</option><option>Institutional clothing</option><option>Wedding-party clothing</option><option>Customized group orders</option><option>Other tailoring project</option></select></label>
            <label>Estimated quantity<input name="quantity" required maxLength="60" placeholder="e.g. 25 sets or to be confirmed"/></label>
            <label>Project location<input name="projectLocation" required maxLength="120" placeholder="Town / State"/></label>
            <label>Preferred timeline<input name="timeline" maxLength="100" placeholder="When would you like to discuss or start?"/></label>
            <label className="industrial-enquiry-wide">Project details<textarea name="projectDetails" required minLength="10" maxLength="1200" rows="4" placeholder="Describe garment types, sizes, fabrics, branding or any other requirements."/></label>
            <div className="industrial-enquiry-submit"><p>Review and send the prepared enquiry in WhatsApp. Pricing and timelines are confirmed only after company review.</p><button className="button button-gold" type="submit">Prepare WhatsApp enquiry <ArrowUpRight size={17}/></button></div>
          </form>
        </div>
        <p className="industrial-note">Every institutional or group project is subject to a requirements review and written confirmation of scope, pricing and schedule. Enquiry does not constitute order acceptance.</p>
      </section>
      <section className="how-to-order section-pad" id="how-to-order">
        <div className="section-heading"><div><p className="eyebrow"><i/> YOUR JOURNEY WITH MR FOP</p><h2>From first idea to <em>final fitting.</em></h2></div><p>A simple, guided process helps us understand what you need before a garment or project is confirmed.</p></div>
        <div className="order-steps">
          <article><span>01</span><h3>Tell us your idea</h3><p>Choose a collection or describe the garment, occasion, quantity and style you have in mind.</p></article>
          <article><span>02</span><h3>Discuss details</h3><p>Our team can discuss fabric, colour, measurements, reference designs and whether an in-person fitting is needed.</p></article>
          <article><span>03</span><h3>Review your quotation</h3><p>For a custom request, we review the requirements and provide a quotation for your approval. A request is not a confirmed price or completion date.</p></article>
          <article><span>04</span><h3>Confirm and create</h3><p>After the agreed details and payment arrangements are confirmed, the order can move into production.</p></article>
          <article><span>05</span><h3>Fitting and collection</h3><p>We coordinate any required fitting, agreed adjustments and collection or delivery arrangements with you.</p></article>
        </div>
        <div className="order-steps-action"><p>Ready to discuss a bespoke or group order?</p><a className="button button-gold" href={wa} target="_blank" rel="noreferrer">Discuss your order <ArrowUpRight size={17}/></a></div>
      </section>
      <section className="faq section-pad" id="faq">
        <div className="section-heading"><div><p className="eyebrow"><i/> GOOD TO KNOW</p><h2>Frequently asked <em>questions.</em></h2></div><p>Helpful information before you place a request or visit the fashion house.</p></div>
        <div className="faq-list">
          <details><summary>How do I place a bespoke clothing order?</summary><p>Open My Account to submit a custom order request, or contact the team on WhatsApp. Share the garment type, fabric and colour preferences, quantity, measurement arrangement and your preferred date. The team will review the request and provide a quotation where applicable.</p></details>
          <details><summary>Is the price or completion date confirmed when I submit a request?</summary><p>No. A submitted request is an enquiry for review. The price, production schedule and collection or delivery arrangements must be discussed and confirmed by the company before the order is treated as confirmed.</p></details>
          <details><summary>Can I book an appointment for measurements or fitting?</summary><p>Yes. Use My Account to request an appointment and select your preferred date and time. Your appointment remains pending until the company confirms it or proposes an alternative.</p></details>
          <details><summary>Do I need to visit the fashion house?</summary><p>It depends on the garment and the measurement information available. Some requests may require an in-person measurement or fitting. The team will advise you during the order discussion.</p></details>
          <details><summary>Do you handle uniforms and group orders?</summary><p>Yes. You can enquire about corporate uniforms, coordinated group clothing and bulk tailoring. Project specifications, quantities, pricing and proposed timelines are reviewed before acceptance.</p></details>
          <details><summary>How can I enquire about fashion training?</summary><p>Contact the team through WhatsApp or submit a Fashion Institute enquiry from your customer account. Course availability, mode, fees and admission details should be confirmed directly with the institute.</p></details>
        </div>
      </section>
      <section className="promise section-pad"><div><p className="eyebrow"><i/> WHY MR FOP</p><h2>Good style is seen.<br/><em>Great fit is felt.</em></h2></div>
        <div className="promise-items"><article><ShieldCheck/><h3>Professional Craft</h3><p>Careful workmanship and attention to the details that make a difference.</p></article><article><Ruler/><h3>Personal Fit</h3><p>Thoughtful measurement and design choices built around the individual.</p></article><article><Heart/><h3>Customer Happiness</h3><p>Service shaped around listening, trust and lasting relationships.</p></article></div>
      </section>
      <section className="contact section-pad" id="contact"><div><p className="eyebrow light"><i/> YOUR NEXT LOOK STARTS HERE</p><h2>Let's create<br/><em>something remarkable.</em></h2></div>
        <div className="contact-side"><p>Tell us what you have in mind. Our team will be happy to guide you through styles, measurements, appointments and training enquiries.</p><a className="button button-gold" href={wa} target="_blank" rel="noreferrer">Start a conversation <ArrowUpRight size={17}/></a><a className="contact-detail" href="tel:+2348055472913"><Phone size={15}/> +234 805 547 2913</a><a className="contact-detail" href="mailto:mrfopvi@gmail.com"><MessageCircle size={15}/> mrfopvi@gmail.com</a><div className="contact-detail contact-address"><span>VISIT US</span><p>Bonojo Road, Eka Junction, via Blooms Pharmacy Store,<br/>Ijebu Ode, Ogun State, Nigeria.</p></div><div className="contact-detail contact-address"><span>OPENING HOURS</span><p>Monday – Saturday · 9:00 AM – 6:00 PM (WAT)</p></div></div>
      </section>
    </main>
    <section className="location section-pad" id="location">
      <div className="section-heading"><div><p className="eyebrow"><i/> FIND THE FASHION HOUSE</p><h2>Visit us in <em>Ijebu Ode.</em></h2></div><p>We welcome enquiries and scheduled visits. Please contact the team before travelling to confirm appointment availability.</p></div>
      <div className="location-grid">
        <div className="location-map"><iframe title="MR FOP FASHIONS location on Google Maps" src="https://www.google.com/maps?q=Bonojo%20Road%2C%20Eka%20Junction%2C%20via%20Blooms%20Pharmacy%20Store%2C%20Ijebu%20Ode%2C%20Ogun%20State%2C%20Nigeria&output=embed" loading="lazy" referrerPolicy="no-referrer-when-downgrade" allowFullScreen/></div>
        <div className="location-details"><p className="eyebrow"><i/> OUR STUDIO</p><h3>MR FOP FASHIONS COMPANY NIGERIA LIMITED</h3><p>Bonojo Road, Eka Junction, via Blooms Pharmacy Store, Ijebu Ode, Ogun State, Nigeria.</p><div><strong>Opening hours</strong><span>Monday – Saturday · 9:00 AM – 6:00 PM (WAT)</span></div><div><strong>Telephone</strong><span>+234 805 547 2913</span></div><a className="button button-gold" href="https://www.google.com/maps/search/?api=1&query=Bonojo%20Road%2C%20Eka%20Junction%2C%20via%20Blooms%20Pharmacy%20Store%2C%20Ijebu%20Ode%2C%20Ogun%20State%2C%20Nigeria" target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={17}/></a></div>
      </div>
    </section>
    <footer className="footer"><div className="footer-main"><a className="brand brand-footer" href="#home"><span className="brand-mark">M<span>F</span></span><span className="brand-copy"><b>MR FOP</b><small>FASHIONS COMPANY</small></span></a><p>Distinctive fashion and professional training.<br/>Making you feel brand new since 2010.</p><a className="footer-wa" href={wa} target="_blank" rel="noreferrer"><MessageCircle/> WhatsApp</a></div>
      <div className="footer-bottom"><span>© {new Date().getFullYear()} MR FOP FASHIONS COMPANY NIGERIA LIMITED</span><span>RC 1089546 · IJEBU ODE, OGUN STATE</span><div className="footer-legal"><button onClick={() => setPolicyOpen("privacy")}>Privacy notice</button><button onClick={() => setPolicyOpen("terms")}>Terms of service</button><a href="#home">BACK TO TOP ↑</a></div></div>
    </footer>
    <button className="music-toggle" type="button" onClick={() => setMusicNotice(true)} aria-haspopup="dialog" aria-expanded={musicNotice}> <Play size={14}/> BRAND MUSIC</button>
    <button className="install-button" type="button" onClick={install}>Install app <ArrowUpRight size={16}/></button>
    {installMessage && <p className="install-feedback" role="status" aria-live="polite">{installMessage}</p> }
    <a className="whatsapp-float" href={wa} target="_blank" rel="noreferrer" aria-label="Chat on WhatsApp"><MessageCircle size={25}/></a>

    {policyOpen && <div className="modal-backdrop policy-backdrop" onClick={() => setPolicyOpen("")}><section ref={dialogRef} className="policy-modal" role="dialog" aria-modal="true" aria-labelledby="policy-title" onClick={e => e.stopPropagation()}>
      <button className="policy-close" onClick={() => setPolicyOpen("")} aria-label="Close policy">×</button>
      <p className="eyebrow"><i/> MR FOP FASHIONS COMPANY NIGERIA LIMITED</p>
      <h2 id="policy-title">{policyOpen === "privacy" ? "Privacy notice" : "Terms of service"}</h2>
      <p className="policy-updated">Last reviewed: 13 November 2026 · Please contact us if you need clarification.</p>
      {policyOpen === "privacy" ? <>
        <h3>1. Information we may collect</h3>
        <p>When you use our customer or Fashion Institute portal, we may process the details you provide, such as your name, email address, telephone number, delivery/contact address, order requests, garment measurements, appointment requests, course applications, learning activity, support messages and payment declarations. Staff records and business transaction records may also be processed for administration.</p>
        <h3>2. Why we use information</h3>
        <p>We use information to respond to enquiries, prepare and manage clothing orders, review measurements, arrange appointments, administer training, verify payments, provide customer support, maintain business records and protect the platform. A request submitted online is not automatically an accepted order or confirmed appointment.</p>
        <h3>3. Measurements and account security</h3>
        <p>Garment measurements can be personal and should be accurate and relevant to the service requested. Keep your sign-in credentials private and sign out on shared devices. Do not submit another person's information unless you are authorised to do so. Access to portal records is intended to be restricted by account ownership and staff permissions.</p>
        <h3>4. Service providers and external links</h3>
        <p>The portal uses Firebase services for account authentication and cloud data storage. Our public site may link to or embed Google Maps and open WhatsApp. Those services are operated by their respective providers and their own privacy terms apply when you use them. We do not claim that information sent directly to those external services is stored only by MR FOP FASHIONS.</p>
        <h3>5. Payments</h3>
        <p>Bank-transfer declarations are reviewed by authorised staff. Do not send card PINs, passwords or one-time passcodes. Payment information shown in the portal reflects records entered or verified by the company; it is not a connection to your bank account.</p>
        <h3>6. Access, correction and data requests</h3>
        <p>You can download a JSON copy of the customer information currently made available through your signed-in portal. That export is not a complete company backup and may not include external files, private staff notes or internal records. To request correction, discuss a privacy concern or ask about deletion, contact us using the details below. Some business, payment or legal records may need to be retained where applicable.</p>
        <h3>7. Contact</h3>
        <p>MR FOP FASHIONS COMPANY NIGERIA LIMITED · Bonojo Road, Eka Junction, via Blooms Pharmacy Store, Ijebu Ode, Ogun State, Nigeria · +234 805 547 2913 · mrfopvi@gmail.com.</p>
        <p className="policy-note">This notice describes the current platform at a practical level. It is not a statement that every privacy compliance, retention, consent or deletion process has been independently audited.</p>
      </> : <>
        <h3>1. Enquiries and order acceptance</h3>
        <p>Website and portal submissions are requests for discussion. A clothing order becomes confirmed only after the company has reviewed and agreed the garment specification, quotation, payment arrangement and production schedule. Prices and availability are not guaranteed by an enquiry alone.</p>
        <h3>2. Measurements and garment specifications</h3>
        <p>Customers should provide careful, current measurements and clear design instructions. The company may request an in-person measurement or fitting where needed. Online measurement entries are customer-supplied information and are not automatically professionally verified.</p>
        <h3>3. Quotations, payments and records</h3>
        <p>Review the itemised quotation and agreed scope before approving. A transfer declaration remains pending until the company verifies receipt. Only payments recorded as verified by the company should be treated as credited in the portal. Any deposit, balance, refund or cancellation arrangement should be agreed with the company in writing before payment.</p>
        <h3>4. Production, fitting and collection</h3>
        <p>Production stages and expected dates are provided as operational updates. A displayed target date is not an unconditional guarantee. Fitting, alterations, collection and delivery arrangements should be confirmed with the company.</p>
        <h3>5. Fashion Institute</h3>
        <p>Course information, intake dates, fees, admission and access conditions are subject to the published course details and confirmation by the Institute. Paid access is tied to the enrolled learner's account. Learners must not share credentials, redistribute protected learning materials or submit work on behalf of another person.</p>
        <h3>6. Acceptable use</h3>
        <p>Use accurate information, respect other users and staff, and do not attempt to access another person's account, records or learning materials, interfere with the service, or upload unlawful or harmful content.</p>
        <h3>7. Changes and contact</h3>
        <p>We may update these terms as the service changes. Material order, payment or training arrangements should be confirmed directly with the company. Contact MR FOP FASHIONS COMPANY NIGERIA LIMITED at +234 805 547 2913 or mrfopvi@gmail.com, or visit Bonojo Road, Eka Junction, Ijebu Ode, Ogun State, Nigeria.</p>
        <p className="policy-note">These are operational website terms, not a substitute for a separately negotiated order, course agreement or professional legal advice. No unconfirmed refund or cancellation policy is created by this page.</p>
      </>}
    </section></div>}
    {musicNotice && <div className="modal-backdrop" onClick={() => setMusicNotice(false)}><section ref={dialogRef} className="music-modal" role="dialog" aria-modal="true" aria-labelledby="brand-music-title" onClick={e => e.stopPropagation()}><button type="button" onClick={() => setMusicNotice(false)} aria-label="Close brand music notice">×</button><h3 id="brand-music-title">MR FOP Brand Music</h3><p>The official company theme song will be connected when you upload the audio file. Browser audio requires a visitor interaction before playback.</p></section></div>}
    {portalOpen && <Portal onClose={() => setPortalOpen(false)}/>}
  </div>;
}