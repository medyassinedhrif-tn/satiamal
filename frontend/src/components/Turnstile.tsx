"use client";

import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: { sitekey: string; callback: (token: string) => void; "expired-callback": () => void }) => string;
      remove: (widgetId: string) => void;
    };
  }
}

export function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    if (!key || !container.current) return;
    const script = document.querySelector<HTMLScriptElement>("#turnstile-script") ?? document.createElement("script");
    script.id = "turnstile-script";
    script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.defer = true;
    const render = () => {
      if (window.turnstile && container.current && !widget.current) {
        widget.current = window.turnstile.render(container.current, {
          sitekey: key,
          callback: onToken,
          "expired-callback": () => onToken(""),
        });
      }
    };
    script.addEventListener("load", render);
    if (!document.querySelector("#turnstile-script")) document.head.appendChild(script);
    render();
    return () => {
      script.removeEventListener("load", render);
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [onToken]);

  if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) return null;
  return <div ref={container} className="min-h-16" />;
}
