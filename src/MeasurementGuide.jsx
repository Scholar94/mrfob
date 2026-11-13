import React from "react";

const guides = {
  "General body profile": {
    title: "General body profile",
    focus: ["Chest / bust", "Natural waist", "Full hip / seat"],
    steps: ["Chest or bust: wrap the tape around the fullest part of the chest, keeping it level across the back.", "Waist: measure around the natural waistline; do not hold your breath or pull the stomach in.", "Hip: measure around the fullest part of the hips and seat, with feet together."]
  },
  "Men’s shirt": {
    title: "Men’s shirt",
    focus: ["Chest", "Neck", "Shoulder", "Sleeve", "Shirt length", "Across back"],
    steps: ["Chest: measure around the fullest part, under the arms, with the tape level.", "Neck: measure around the base of the neck, leaving comfortable ease.", "Shoulder: measure from one shoulder point to the other across the back.", "Sleeve: measure from the shoulder point, over a slightly bent elbow, to the wrist.", "Shirt length: measure from the high shoulder point down to the required hem.", "Across back: measure horizontally between the back armhole points."]
  },
  "Trousers": {
    title: "Trousers",
    focus: ["Waist", "Hip", "Thigh", "Inseam", "Outseam", "Rise"],
    steps: ["Waist: measure at the position where the trousers will sit, not automatically at the natural waist.", "Hip: measure around the fullest seat/hip area.", "Thigh: measure around the fullest part of one upper thigh.", "Inseam: measure from the crotch point to the desired trouser hem.", "Outseam: measure from the waistband top to the desired hem along the side.", "Front and back rise: measure from the crotch seam to the top of the waistband, front and back respectively."]
  },
  "Dress / Gown": {
    title: "Dress / Gown",
    focus: ["Bust", "Under bust", "Waist", "Hip", "Shoulder", "Dress length"],
    steps: ["Bust: measure around the fullest bust point without compressing the body.", "Under bust: measure directly beneath the bust, keeping the tape horizontal.", "Waist and hip: measure the natural waist and fullest hip/seat respectively.", "Shoulder: measure between the shoulder points across the back.", "Dress length: measure from the agreed shoulder or neckline starting point to the required hem. Confirm the exact starting point with the designer."]
  },
  "Skirt": {
    title: "Skirt",
    focus: ["Waist", "Hip", "Waist to hip", "Skirt length"],
    steps: ["Waist: measure at the intended skirt waistband position.", "Hip: measure around the fullest part of the seat/hip.", "Waist to hip: measure vertically from the waistline to the fullest hip level.", "Skirt length: measure from the agreed waistband position to the required hem."]
  },
  "Jacket": {
    title: "Jacket",
    focus: ["Chest", "Waist", "Shoulder", "Sleeve", "Across back", "Jacket length"],
    steps: ["Chest: measure around the fullest chest with the arms relaxed.", "Waist: measure around the body at the jacket's intended waist level.", "Shoulder and across back: measure between shoulder points and across the back respectively.", "Sleeve: measure from shoulder point over a slightly bent elbow to the wrist.", "Jacket length: measure from the agreed high shoulder/neck point to the required hem."]
  },
  "Blouse": {
    title: "Blouse",
    focus: ["Bust", "Waist", "Shoulder", "Sleeve", "Armhole", "Blouse length"],
    steps: ["Bust: measure around the fullest bust point, keeping the tape level.", "Waist: measure around the natural waistline.", "Shoulder: measure between shoulder points across the back.", "Sleeve: measure from shoulder point to the desired sleeve end.", "Armhole: measure around the shoulder joint/armhole path without pulling tight.", "Blouse length: measure from the agreed shoulder or neckline point to the desired hem."]
  }
};

function TapeLines({ type }) {
  if (type === "Trousers" || type === "Skirt") {
    return <g className="measurement-tape-lines">
      <path d="M70 75 Q110 86 150 75 M72 104 Q110 116 148 104 M84 82 L84 195 M136 82 L136 195" />
      <text x="154" y="77">Waist</text><text x="154" y="106">Hip</text>
      {type === "Trousers" && <><path d="M84 126 L84 207 M136 126 L136 207 M84 207 L104 207 M136 207 L116 207" /><text x="150" y="151">Rise</text><text x="150" y="190">Leg</text></>}
      {type === "Skirt" && <><path d="M84 145 L136 145 M110 146 L110 210" /><text x="145" y="149">Length</text></>}
    </g>;
  }
  return <g className="measurement-tape-lines">
    <path d="M67 78 Q110 96 153 78 M77 119 Q110 131 143 119 M78 150 Q110 164 142 150" />
    <text x="157" y="80">Chest / bust</text><text x="147" y="121">Waist</text><text x="146" y="153">Hip</text>
    {(type === "Men’s shirt" || type === "Jacket") && <><path d="M69 54 L151 54 M69 54 L55 88 M151 54 L165 88" /><text x="157" y="51">Shoulder</text></>}
    {type === "Dress / Gown" && <><path d="M80 97 Q110 107 140 97 M110 96 L110 224" /><text x="146" y="99">Under bust</text><text x="116" y="218">Length</text></>}
    {type === "Blouse" && <><path d="M63 78 L46 128 M157 78 L174 128 M110 150 L110 204" /><text x="151" y="207">Length</text></>}
  </g>;
}

export default function MeasurementGuide({ garmentType = "General body profile" }) {
  const guide = guides[garmentType] || guides["General body profile"];
  const lower = garmentType === "Trousers" || garmentType === "Skirt";
  return <aside className="measurement-guide" aria-label={guide.title + " measurement guide"}>
    <div className="measurement-guide-art">
      <svg viewBox="0 0 230 250" role="img" aria-labelledby="garmentGuideTitle garmentGuideDesc">
        <title id="garmentGuideTitle">{guide.title} measurement diagram</title>
        <desc id="garmentGuideDesc">Schematic showing approximate tape-measure paths for the selected garment profile. Confirm exact points with a professional designer.</desc>
        {lower ? <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          {garmentType === "Trousers" ? <path d="M77 28 L143 28 L150 78 L139 222 L116 222 L110 105 L104 222 L81 222 L70 78 Z" /> : <path d="M80 28 L140 28 L166 220 L54 220 Z" />}
        </g> : <g fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="110" cy="23" r="15" />
          <path d="M94 43 Q76 47 66 72 L48 126 M126 43 Q144 47 154 72 L172 126 M66 72 Q72 112 78 151 L82 225 M154 72 Q148 112 142 151 L138 225 M94 43 L85 79 Q110 91 135 79 L126 43 M85 79 Q78 109 82 132 Q110 143 138 132 Q142 109 135 79 M82 132 Q110 144 138 132" />
        </g>}
        <TapeLines type={garmentType}/>
      </svg>
    </div>
    <div className="measurement-guide-copy">
      <strong>{guide.title} — where to measure</strong>
      <p>Use a flexible tape, keep it level and comfortably snug, and stand naturally. The drawing is a placement aid, not a body-shape or sizing standard.</p>
      <ul>{guide.steps.map((step,index)=><li key={index}>{step}</li>)}</ul>
      <div className="measurement-guide-focus"><b>Key points in this profile:</b> {guide.focus.join(" · ")}</div>
      <small>Have another person help where possible. Confirm all measurements, ease and exact garment reference points with an MR FOP designer before cutting or production.</small>
    </div>
  </aside>;
}
