import React from "react";
import { ArrowLeft, ArrowUpRight, GraduationCap, MapPin, MessageCircle, Phone, Mail, Clock, Scissors } from "lucide-react";
import FabricCatalogue from "./FabricCatalogue.jsx";
import NewsletterSignup from "./NewsletterSignup.jsx";

const fallbackFaqs = [
  ["How do I place a bespoke order?", "Contact our team or create a customer account, submit your garment request and reference details, then review the quotation before confirming."],
  ["Can I book a measurement appointment?", "Yes. Create an account and use the appointment section to request a date and time. The team will confirm availability."],
  ["Do you offer fashion training?", "Yes. The MR FOP Fashion Institute offers practical training enquiries and course applications. Contact the team for current intake details."],
  ["How do I pay for an order?", "The team will provide the approved payment instructions with your quotation. Submit a transfer declaration in your account; staff must verify the payment before it is marked as paid."],
  ["Where is the studio located?", "Our studio is in Ijebu Ode, Ogun State, Nigeria. Use the contact page for directions and opening hours."]
];

const courseList = [
  ["Fashion Design Fundamentals", "Design principles, style development, sketching and creative presentation."],
  ["Pattern Drafting and Garment Construction", "Practical pattern development, cutting, sewing and finishing techniques."],
  ["Professional Tailoring", "Measurement, fitting, garment assembly, alterations and quality control."],
  ["Fashion Entrepreneurship", "Customer service, costing, production planning and building a fashion business."]
];

export default function PublicRoutePage({ path, collections = [], companyProfile = {}, publicFaqs = [] }) {
  const companyName = companyProfile.companyName || "MR FOP FASHIONS COMPANY NIGERIA LIMITED";
  const phone = companyProfile.phone || "+234 805 547 2913";
  const email = companyProfile.email || "mrfopvi@gmail.com";
  const address = companyProfile.address || "Bonojo Road, Eka Junction, via Blooms Pharmacy Store, Ijebu Ode, Ogun State, Nigeria";
  const hours = companyProfile.openingHours || "Monday – Saturday · 9:00 AM – 6:00 PM (WAT)";
  const waNumber = phone.replace(/\D/g, "").replace(/^0/, "234");
  const whatsapp = "https://wa.me/" + waNumber;
  const selectedCollection = collections.find(item => path === "/collections/" + String(item.type || "").toLowerCase());
  const titleMap = {
    "/about": "About MR FOP FASHIONS",
    "/collections": "Explore our collections",
    "/collections/men": "Bespoke menswear",
    "/collections/women": "Women's elegance",
    "/collections/bridal": "Bridal and occasion wear",
    "/collections/traditional": "African heritage",
    "/collections/corporate": "Corporate and industrial tailoring",
    "/fabric-gallery": "Fabric gallery",
    "/fashion-institute": "MR FOP Fashion Institute",
    "/courses": "Courses and practical training",
    "/admissions": "Admissions",
    "/contact": "Visit or contact our studio",
    "/faq": "Frequently asked questions"
  };
  const title = titleMap[path] || "MR FOP FASHIONS";
  const faqs = publicFaqs.length ? publicFaqs.map(item => [item.question || item.title, item.answer || item.response]).filter(row => row[0] && row[1]) : fallbackFaqs;

  function collectionCards(items) {
    return <div className="standalone-collection-grid">{items.map(item => <article className="standalone-collection-card" key={item.type}>
      <img src={item.image} alt={item.name} loading="lazy"/>
      <div><span>{item.type}</span><h3>{item.name}</h3><p>{item.tag}</p><a href={"/mrfob/collections/" + item.type.toLowerCase()}>Explore collection <ArrowUpRight size={15}/></a></div>
    </article>)}</div>;
  }

  return <div className="standalone-site">
    <div className="standalone-topline">CRAFTED WITH PURPOSE SINCE 2010 <span>IJEBU ODE, OGUN STATE · NIGERIA</span></div>
    <header className="standalone-header">
      <a className="standalone-brand" href="/mrfob/"><img src="/mrfob/mr-fop-website-logo.webp" alt="MR FOP FASHIONS"/></a>
      <nav aria-label="Page navigation">
        <a href="/mrfob/">Home</a><a href="/mrfob/collections">Collections</a><a href="/mrfob/fabric-gallery">Fabrics</a><a href="/mrfob/courses">Courses</a><a href="/mrfob/about">About</a><a href="/mrfob/contact">Contact</a>
      </nav>
      <div className="standalone-actions"><a href="/mrfob/login">Sign in</a><a className="standalone-primary" href="/mrfob/register">Create account</a></div>
    </header>
    <main className="standalone-main">
      <div className="standalone-breadcrumb"><a href="/mrfob/">Home</a><span>/</span><span>{title}</span></div>
      <section className="standalone-hero">
        <p className="eyebrow"><i/> MR FOP FASHIONS COMPANY NIGERIA LIMITED</p>
        <h1>{title}</h1>
        <p>Distinctive fashion. Thoughtful craftsmanship. Professional practical training.</p>
        <div><a className="button button-gold" href={whatsapp} target="_blank" rel="noreferrer">Speak with our team <MessageCircle size={16}/></a><a className="standalone-text-link" href="/mrfob/">Return to homepage</a></div>
      </section>

      {path === "/about" && <section className="standalone-content two-column">
        <div><p className="eyebrow">OUR STORY</p><h2>Confidence, carefully crafted.</h2><p>MR FOP FASHIONS brings together bespoke clothing, professional garment production and practical fashion education. We believe a well-made garment should reflect the person wearing it and the purpose for which it was made.</p><p>From individual designs to group and institutional orders, our team focuses on thoughtful consultation, clear production steps and careful finishing.</p></div>
        <aside><h3>Our company</h3><p><strong>Mission</strong><br/>{companyProfile.mission || "To deliver distinctive fashion and practical training through craftsmanship, service and continuous learning."}</p><p><strong>Vision</strong><br/>{companyProfile.vision || "To grow a trusted Nigerian fashion brand and learning environment known for quality and integrity."}</p><p><strong>Established</strong><br/>2010 · Ijebu Ode, Ogun State</p></aside>
      </section>}

      {path === "/collections" && <section className="standalone-content"><p className="eyebrow">MADE FOR YOUR MOMENTS</p><h2>Find the collection that fits your occasion.</h2>{collectionCards(collections)}</section>}
      {selectedCollection && <section className="standalone-content two-column">
        <img className="standalone-feature-image" src={selectedCollection.image} alt={selectedCollection.name}/>
        <div><p className="eyebrow">{selectedCollection.type} COLLECTION</p><h2>{selectedCollection.name}</h2><p>{selectedCollection.tag}. Work with our team to discuss your preferred style, fabric, fit and finishing details.</p><ul><li>Personal consultation</li><li>Garment and fabric guidance</li><li>Measurement and fitting arrangements</li><li>Quotation before production begins</li></ul><a className="button button-gold" href={whatsapp} target="_blank" rel="noreferrer">Discuss a design <ArrowUpRight size={16}/></a></div>
      </section>}

      {path === "/fabric-gallery" && <section className="standalone-content"><p className="eyebrow">TEXTURE · COLOUR · CHARACTER</p><h2>Explore available fabric selections.</h2><p>Availability and final pricing are confirmed by our team when your design is discussed.</p><FabricCatalogue/></section>}

      {path === "/fashion-institute" && <section className="standalone-content two-column">
        <div><p className="eyebrow">LEARN A PRACTICAL SKILL</p><h2>Build your fashion skills with guided practice.</h2><p>The MR FOP Fashion Institute is designed around practical learning, guided instruction and the development of useful garment-making skills. Course schedules, intake capacity and fees are confirmed by the Institute team.</p><a className="button button-gold" href="/mrfob/admissions">Explore admissions <ArrowUpRight size={16}/></a></div>
        <aside><GraduationCap size={38}/><h3>Practical learning pathway</h3><p>Learn foundational concepts, practise techniques, complete guided tasks and receive feedback from assigned instructors.</p></aside>
      </section>}

      {path === "/courses" && <section className="standalone-content"><p className="eyebrow">COURSE AREAS</p><h2>Practical training pathways.</h2><div className="standalone-course-grid">{courseList.map(([name, description]) => <article key={name}><Scissors/><h3>{name}</h3><p>{description}</p></article>)}</div><p className="standalone-note">Course availability, duration, schedule and fees are confirmed by the Institute before an application is admitted.</p><a className="button button-gold" href="/mrfob/admissions">Apply for admission <ArrowUpRight size={16}/></a></section>}

      {path === "/admissions" && <section className="standalone-content two-column">
        <div><p className="eyebrow">START YOUR APPLICATION</p><h2>Admission process</h2><ol><li>Review the available course areas.</li><li>Create a customer account or sign in.</li><li>Submit your course and intake enquiry.</li><li>Wait for the Institute team to review capacity and admission status.</li><li>Follow the official payment instructions and wait for payment verification before lesson access is granted.</li></ol><a className="button button-gold" href="/mrfob/register">Create an account <ArrowUpRight size={16}/></a></div>
        <aside><GraduationCap size={38}/><h3>Need guidance?</h3><p>Contact the Institute team to confirm the current intake, course details and application requirements before making payment.</p><a href={whatsapp} target="_blank" rel="noreferrer">Ask on WhatsApp <ArrowUpRight size={15}/></a></aside>
      </section>}

      {path === "/contact" && <section className="standalone-content"><div className="standalone-contact-grid">
        <article><MapPin/><h3>Visit the studio</h3><p>{address}</p><a href={"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(address)} target="_blank" rel="noreferrer">Get directions <ArrowUpRight size={15}/></a></article>
        <article><Phone/><h3>Telephone</h3><p>{phone}</p><a href={"tel:"+phone.replace(/[^+0-9]/g,"")}>Call our team</a></article>
        <article><Mail/><h3>Email</h3><p>{email}</p><a href={"mailto:"+email}>Send an email</a></article>
        <article><Clock/><h3>Opening hours</h3><p>{hours}</p></article>
      </div></section>}

      {path === "/faq" && <section className="standalone-content"><p className="eyebrow">HELP AND GUIDANCE</p><h2>Answers to common questions.</h2><div className="standalone-faq-list">{faqs.map(([question, answer], index) => <details key={question || index}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>}
    </main>
    <footer className="standalone-footer"><div><strong>{companyName}</strong><p>{address}</p></div><div><a href="/mrfob/privacy">Privacy</a><a href="/mrfob/terms">Terms</a><a href="/mrfob/contact">Contact</a></div></footer>
    <NewsletterSignup/>
  </div>;
}
