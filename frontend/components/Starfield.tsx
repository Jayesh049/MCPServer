"use client";

import { useEffect, useRef } from "react";

type Star = {
  x: number;
  y: number;
  r: number;
  o: number;
};

function initStars(cvs: HTMLCanvasElement): Star[] {
  const w = window.innerWidth;
  const h = window.innerHeight;
  cvs.width = w;
  cvs.height = h;
  return Array.from({ length: 160 }, () => ({
    x: Math.random() * w,
    y: Math.random() * h,
    r: Math.random() * 1.2 + 0.2,
    o: Math.random() * 0.5 + 0.1
  }));
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cvsEl = canvasRef.current;
    if (!cvsEl) return;
    const cvs: HTMLCanvasElement = cvsEl;
    const ctxRaw = cvs.getContext("2d");
    if (!ctxRaw) return;
    const context: CanvasRenderingContext2D = ctxRaw;

    let stars = initStars(cvs);
    let raf = 0;

    function drawStars() {
      context.clearRect(0, 0, cvs.width, cvs.height);
      for (const s of stars) {
        s.o += (Math.random() - 0.5) * 0.02;
        s.o = Math.max(0.05, Math.min(0.6, s.o));
        context.beginPath();
        context.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(180,200,255,${s.o})`;
        context.fill();
      }
      raf = requestAnimationFrame(drawStars);
    }

    drawStars();
    const onResize = () => {
      stars = initStars(cvs);
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div id="starfield" aria-hidden>
      <canvas ref={canvasRef} id="stars" />
    </div>
  );
}
