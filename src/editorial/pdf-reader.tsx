"use client";

import { useCallback, useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    pdfjsLib?: {
      GlobalWorkerOptions: { workerSrc: string };
      getDocument: (options: { url: string; withCredentials?: boolean }) => { promise: Promise<PDFDocument> };
    };
  }
}
type PDFDocument = {
  numPages: number;
  getPage: (page: number) => Promise<PDFPage>;
  destroy: () => Promise<void>;
};
type PDFPage = {
  getViewport: (options: { scale: number }) => { width: number; height: number };
  render: (options: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void>; cancel: () => void };
};

const PDFJS_VERSION = "3.11.174";
const PDFJS_SCRIPT = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/" + PDFJS_VERSION + "/pdf.worker.min.js";

function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise<NonNullable<Window["pdfjsLib"]>>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-pdfjs="true"]');
    if (existing) {
      existing.addEventListener("load", () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error("PDF.js did not initialise.")), { once: true });
      existing.addEventListener("error", () => reject(new Error("PDF.js could not be loaded.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = PDFJS_SCRIPT;
    script.async = true;
    script.dataset.pdfjs = "true";
    script.onload = () => window.pdfjsLib ? resolve(window.pdfjsLib) : reject(new Error("PDF.js did not initialise."));
    script.onerror = () => reject(new Error("PDF.js could not be loaded. Check your connection and try again."));
    document.head.appendChild(script);
  });
}

type Props = { url: string; title: string; downloadName: string };

export function PdfReader({ url, title, downloadName }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const documentRef = useRef<PDFDocument | null>(null);
  const renderRef = useRef<{ cancel: () => void } | null>(null);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState<"width" | "page" | "manual">("width");
  const [stageWidth, setStageWidth] = useState(900);
  const [stageHeight, setStageHeight] = useState(760);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) { setStageWidth(rect.width); setStageHeight(rect.height); }
    });
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(""); setPage(1); setPageCount(0);
    loadPdfJs()
      .then((pdfjs) => {
        pdfjs.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        return pdfjs.getDocument({ url, withCredentials: false }).promise;
      })
      .then((pdf) => {
        if (!active) { void pdf.destroy(); return; }
        documentRef.current = pdf;
        setPageCount(pdf.numPages); setLoading(false);
      })
      .catch((reason: unknown) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "The edition could not be opened.");
        setLoading(false);
      });
    return () => {
      active = false; renderRef.current?.cancel();
      const current = documentRef.current; documentRef.current = null;
      if (current) void current.destroy();
    };
  }, [url]);

  useEffect(() => {
    let active = true;
    const renderPage = async () => {
      const pdf = documentRef.current, canvas = canvasRef.current, stage = stageRef.current;
      if (!pdf || !canvas || !stage || !pageCount) return;
      renderRef.current?.cancel();
      try {
        const pdfPage = await pdf.getPage(page);
        if (!active) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const availableWidth = Math.max(260, stageWidth - 48);
        const availableHeight = Math.max(320, stageHeight - 48);
        const fitWidthScale = availableWidth / natural.width;
        const fitPageScale = Math.min(fitWidthScale, availableHeight / natural.height);
        const scale = fit === "width" ? fitWidthScale : fit === "page" ? fitPageScale : zoom;
        const viewport = pdfPage.getViewport({ scale });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(viewport.width * ratio);
        canvas.height = Math.floor(viewport.height * ratio);
        canvas.style.width = Math.floor(viewport.width) + "px";
        canvas.style.height = Math.floor(viewport.height) + "px";
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        const task = pdfPage.render({ canvasContext: context, viewport });
        renderRef.current = task;
        await task.promise;
      } catch (reason) {
        if (active && !(reason instanceof Error && reason.name === "RenderingCancelledException")) setError("A page could not be rendered. Please reload the edition.");
      }
    };
    void renderPage();
    return () => { active = false; renderRef.current?.cancel(); };
  }, [page, pageCount, fit, zoom, stageWidth, stageHeight]);

  const previous = useCallback(() => setPage((value) => Math.max(1, value - 1)), []);
  const next = useCallback(() => setPage((value) => Math.min(pageCount || 1, value + 1)), [pageCount]);
  const zoomIn = useCallback(() => { setFit("manual"); setZoom((value) => Math.min(2.5, Math.round((value + 0.1) * 10) / 10)); }, []);
  const zoomOut = useCallback(() => { setFit("manual"); setZoom((value) => Math.max(0.5, Math.round((value - 0.1) * 10) / 10)); }, []);
  const fitWidth = useCallback(() => setFit("width"), []);
  const fitPage = useCallback(() => setFit("page"), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable=true], button, a")) return;
      if (event.key === "ArrowLeft" || event.key === "PageUp") { event.preventDefault(); previous(); }
      if (event.key === "ArrowRight" || event.key === "PageDown") { event.preventDefault(); next(); }
      if (event.key === "+" || event.key === "=") { event.preventDefault(); zoomIn(); }
      if (event.key === "-") { event.preventDefault(); zoomOut(); }
      if (event.key === "0") { event.preventDefault(); fitWidth(); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, zoomIn, zoomOut, fitWidth]);

  const fullscreen = async () => {
    if (!stageRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await stageRef.current.requestFullscreen();
    } catch { setError("Fullscreen is not available in this browser."); }
  };
  const downloadUrl = url + (url.includes("?") ? "&" : "?") + "download=" + encodeURIComponent(downloadName);

  return (
    <section className="oo-reader" aria-label="PDF edition reader">
      <div className="oo-reader-toolbar">
        <div className="oo-reader-group">
          <button type="button" onClick={previous} disabled={loading || page <= 1} aria-label="Previous page">←</button>
          <label className="oo-page-field"><span className="sr-only">Page number</span><input aria-label="Page number" type="number" min={1} max={pageCount || 1} value={page} disabled={!pageCount} onChange={(event) => {
            const value = Number(event.target.value);
            if (Number.isInteger(value) && value >= 1 && value <= pageCount) setPage(value);
          }}/><span>/ {pageCount || "—"}</span></label>
          <button type="button" onClick={next} disabled={loading || page >= pageCount} aria-label="Next page">→</button>
        </div>
        <div className="oo-reader-group">
          <button type="button" onClick={zoomOut} disabled={loading} aria-label="Zoom out">−</button>
          <span className="oo-zoom-label">{fit === "manual" ? Math.round(zoom * 100) + "%" : fit === "width" ? "Fit width" : "Fit page"}</span>
          <button type="button" onClick={zoomIn} disabled={loading} aria-label="Zoom in">+</button>
        </div>
        <div className="oo-reader-group">
          <button type="button" onClick={fitWidth} disabled={loading} aria-pressed={fit === "width"}>Fit width</button>
          <button type="button" onClick={fitPage} disabled={loading} aria-pressed={fit === "page"}>Fit page</button>
          <button type="button" onClick={() => void fullscreen()} aria-label="Toggle fullscreen">⛶</button>
          <a className="oo-reader-download" href={downloadUrl}>Download ↓</a>
        </div>
      </div>
      <div className="oo-reader-stage" ref={stageRef} tabIndex={0} aria-label={title + ". Use left and right arrow keys to change pages."}>
        {loading && <p className="oo-reader-status" role="status">Preparing your edition…</p>}
        {error && <div className="oo-reader-error" role="alert"><strong>Unable to display this edition</strong><p>{error}</p><a href={url} target="_blank" rel="noreferrer">Open the PDF directly ↗</a></div>}
        <canvas ref={canvasRef} className="oo-reader-canvas" aria-label={"Page " + page + " of " + pageCount}/>
      </div>
      <p className="oo-reader-hint">Keyboard: ← → to turn pages · + / − to zoom · 0 to fit width</p>
    </section>
  );
}
