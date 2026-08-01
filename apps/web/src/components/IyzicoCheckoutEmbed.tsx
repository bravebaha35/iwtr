"use client";

import { useEffect, useRef } from "react";

// iyzico's checkoutFormContent is HTML containing a <script> tag that renders
// their hosted payment widget into the page. Browsers never execute <script>
// tags inserted via innerHTML (including React's dangerouslySetInnerHTML) —
// only ones created with document.createElement and appended — so this
// manually re-creates each script node to actually run it. This is the
// standard workaround for embedding a third-party "widget" script in React,
// not iyzico-specific.
export function IyzicoCheckoutEmbed({ checkoutFormContent }: { checkoutFormContent: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = checkoutFormContent;

    const scripts = Array.from(container.querySelectorAll("script"));
    for (const oldScript of scripts) {
      const newScript = document.createElement("script");
      for (const attr of Array.from(oldScript.attributes)) {
        newScript.setAttribute(attr.name, attr.value);
      }
      newScript.text = oldScript.text;
      oldScript.replaceWith(newScript);
    }

    return () => {
      container.innerHTML = "";
    };
  }, [checkoutFormContent]);

  return <div ref={containerRef} />;
}
