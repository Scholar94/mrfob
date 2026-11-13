import React, { useMemo, useState } from "react";

const GARMENTS = {
  men: ["Two-piece suit", "Three-piece suit", "Senator outfit", "Agbada", "Corporate shirt and trouser", "Traditional attire"],
  women: ["Corporate suit", "Elegant gown", "Skirt and blouse", "Bridal dress", "Evening dress", "Traditional outfit"],
  bridal: ["Wedding gown", "Reception dress", "Wedding party outfit", "Coordinated couple attire"],
  corporate: ["Corporate uniform", "School uniform", "Staff shirts", "Institutional group outfit"]
};
const OCCASIONS = ["Work and business", "Wedding", "Traditional ceremony", "Church event", "Graduation", "Casual outing", "Corporate or group event"];
const STYLES = ["Classic and timeless", "Modern and minimalist", "Bold and distinctive", "Traditional and elegant", "Luxury and formal"];
const COLOURS = ["Black", "Navy blue", "Wine / burgundy", "White / ivory", "Royal blue", "Earth tones", "Gold accents", "Open to suggestions"];
const BUDGETS = ["Below ₦50,000", "₦50,000–₦100,000", "₦100,000–₦250,000", "₦250,000–₦500,000", "Above ₦500,000", "Discuss my budget"];

function recommend(occasion, category, style) {
  const styles = {
    "Work and business": ["A clean, well-fitted silhouette with restrained detailing", "A coordinated look with a versatile colour palette"],
    Wedding: ["A statement outfit with refined finishing and occasion-appropriate details", "A coordinated look that photographs beautifully"],
    "Traditional ceremony": ["A culturally expressive silhouette with carefully selected fabric", "Traditional detailing balanced with a modern fit"],
    "Church event": ["An elegant, comfortable design with polished finishing", "A modest, coordinated look with thoughtful colour contrast"],
    Graduation: ["A smart formal look that can be worn beyond the ceremony", "A tailored outfit with a memorable but balanced accent"],
    "Casual outing": ["A relaxed, well-finished outfit designed for comfort", "A versatile piece with simple styling details"],
    "Corporate or group event": ["A coordinated design that can be standardised across a group", "A practical uniform concept with consistent colours and finishing"]
  };
  const categoryAdvice = {
    men: ["Two-piece suit", "Senator outfit", "Agbada"],
    women: ["Corporate suit", "Elegant gown", "Skirt and blouse"],
    bridal: ["Wedding gown", "Reception dress", "Wedding party outfit"],
    corporate: ["Corporate uniform", "School uniform", "Staff shirts"]
  };
  const options = categoryAdvice[category] || categoryAdvice.men;
  const advice = styles[occasion] || styles["Work and business"];
  return [
    { title: options[0], description: advice[0] + ". " + style + " direction." },
    { title: options[1], description: advice[1] + ". Personalise the cut, fabric and finishing during consultation." },
    { title: options[2], description: "A second design direction to compare before confirming your preferred look." }
  ];
}

export default function StyleRecommendations({ createWhatsAppLink }) {
  const [occasion, setOccasion] = useState(OCCASIONS[0]);
  const [category, setCategory] = useState("men");
  const [garment, setGarment] = useState(GARMENTS.men[0]);
  const [colour, setColour] = useState(COLOURS[0]);
  const [style, setStyle] = useState(STYLES[0]);
  const [budget, setBudget] = useState(BUDGETS[1]);
  const [reference, setReference] = useState("");
  const suggestions = useMemo(() => recommend(occasion, category, style), [occasion, category, style]);
  const enquiry = "Hello MR FOP FASHIONS. Please help me develop a style concept. Occasion: " + occasion + ". Category: " + category + ". Garment: " + garment + ". Preferred colour: " + colour + ". Style: " + style + ". Budget: " + budget + ". Reference/design notes: " + (reference.trim() || "I would like guidance.") + ". Please confirm fabric availability, price and timeline after consultation.";
  return <section className="style-recommendations section-pad" id="style-recommendations">
    <div className="section-heading"><div><p className="eyebrow"><i/> FIND YOUR LOOK</p><h2>Discover a style <em>that feels like you.</em></h2></div><p>Choose your occasion and preferences to explore starting ideas. These are style suggestions, not confirmed catalogue stock or quotations.</p></div>
    <div className="style-recommendation-layout">
      <form className="style-preference-form" onSubmit={event=>event.preventDefault()}>
        <label>What is the occasion?<select value={occasion} onChange={event=>setOccasion(event.target.value)}>{OCCASIONS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Fashion category<select value={category} onChange={event=>{const next=event.target.value;setCategory(next);setGarment(GARMENTS[next][0]);}}><option value="men">Men's fashion</option><option value="women">Women's fashion</option><option value="bridal">Bridal and occasion</option><option value="corporate">Corporate and institutional</option></select></label>
        <label>Preferred garment<select value={garment} onChange={event=>setGarment(event.target.value)}>{GARMENTS[category].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Preferred colour<select value={colour} onChange={event=>setColour(event.target.value)}>{COLOURS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Personal style<select value={style} onChange={event=>setStyle(event.target.value)}>{STYLES.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Budget range<select value={budget} onChange={event=>setBudget(event.target.value)}>{BUDGETS.map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Reference design or extra details<textarea rows={3} maxLength={500} value={reference} onChange={event=>setReference(event.target.value)} placeholder="Describe a design, fabric, fit or reference image you would like to discuss."/></label>
      </form>
      <div className="style-suggestion-panel">
        <span className="style-suggestion-kicker">YOUR STARTING IDEAS</span>
        <h3>Three directions to explore</h3>
        {suggestions.map((item,index)=><article className="style-suggestion-card" key={item.title}><span>0{index+1}</span><div><strong>{item.title}</strong><p>{item.description}</p></div></article>)}
        <p className="style-suggestion-summary"><strong>Your brief:</strong> {occasion} · {garment} · {colour} · {budget}</p>
        <a className="style-consult-link" href={createWhatsAppLink ? createWhatsAppLink(enquiry) : "#contact"} target="_blank" rel="noreferrer">Discuss my style with MR FOP <span aria-hidden="true">↗</span></a>
      </div>
    </div>
  </section>;
}
