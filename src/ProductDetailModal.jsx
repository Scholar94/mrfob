import React, { useEffect, useRef, useState } from "react";

export default function ProductDetailModal({ product, onClose, onRequest, favourite = false, onToggleFavourite }) {
  const [activeImage, setActiveImage] = useState("");
  const closeRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const images = [...new Set([product?.imageUrl, ...(product?.galleryImages || [])].filter(value => typeof value === "string" && /^https:\/\//i.test(value)))].slice(0, 9);

  useEffect(() => {
    if (!product) return undefined;
    returnFocusRef.current = document.activeElement;
    closeRef.current?.focus();
    function onKeyDown(event) {
      if (event.key === "Escape") { event.preventDefault(); onCloseRef.current(); }
      if (event.key === "Tab") {
        const dialog = document.getElementById("product-detail-dialog");
        const focusable = Array.from(dialog?.querySelectorAll('button:not([disabled]),a[href]') || []);
        if (!focusable.length) return;
        if (event.shiftKey && document.activeElement === focusable[0]) { event.preventDefault(); focusable.at(-1).focus(); }
        else if (!event.shiftKey && document.activeElement === focusable.at(-1)) { event.preventDefault(); focusable[0].focus(); }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
    };
  }, [product?.id]);

  useEffect(() => { setActiveImage(images[0] || ""); }, [product?.id]);

  if (!product) return null;
  const available = Number(product.stock || 0) > 0;
  return <div className="product-detail-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}>
    <section id="product-detail-dialog" className="product-detail-dialog" role="dialog" aria-modal="true" aria-labelledby="product-detail-title" tabIndex="-1">
      <button ref={closeRef} type="button" className="product-detail-close" onClick={onClose} aria-label="Close product details">×</button>
      <div className="product-detail-layout">
        <div className="product-detail-gallery">
          {activeImage ? <img className="product-detail-main-image" src={activeImage} alt={product.name + " product view"}/> : <div className="product-detail-no-image">Product image not available</div>}
          {images.length > 1 && <div className="product-detail-thumbnails" aria-label="Product image views">{images.map((image,index)=><button type="button" key={image} onClick={()=>setActiveImage(image)} className={activeImage===image?"active":""} aria-label={"Show product view "+(index+1)} aria-pressed={activeImage===image}><img src={image} alt=""/></button>)}</div>}
        </div>
        <div className="product-detail-copy">
          <span className="product-detail-category">{product.category || "MR FOP catalogue"}</span>
          <h2 id="product-detail-title">{product.name}</h2>
          <p>{product.description || "Contact the MR FOP team for product details and customisation guidance."}</p>
          <strong className="product-detail-price">₦{Number(product.price || 0).toLocaleString("en-NG")}</strong>
          <span className={available ? "product-detail-stock in-stock" : "product-detail-stock out-stock"}>{available ? "Currently listed as in stock" : "Currently listed as out of stock"}</span>
          {product.availableColors?.length > 0 && <div><b>Available colours</b><p>{product.availableColors.join(", ")}</p></div>}
          {product.fabricOptions?.length > 0 && <div><b>Fabric options</b><p>{product.fabricOptions.join(", ")}</p></div>}
          {product.customizationOptions?.length > 0 && <div><b>Customisation options</b><p>{product.customizationOptions.join(", ")}</p></div>}
          <p className="product-detail-disclaimer">Catalogue details and stock are indicative and may change. The team will confirm availability, final specifications, price and delivery arrangements in your quotation before an order is accepted.</p>
          <div className="product-detail-actions">
            <button type="button" className="portal-submit" onClick={()=>onRequest(product)}>Request this design</button>
            <button type="button" className="portal-submit secondary" onClick={()=>onToggleFavourite(product)}>{favourite ? "♥ Remove saved design" : "♡ Save design"}</button>
          </div>
        </div>
      </div>
    </section>
  </div>;
}
