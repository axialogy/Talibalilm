'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Eraser, Minus, Pen, Square, Trash2, Type } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BoardOp } from '@/lib/live/protocol';

type Tool = 'pen' | 'line' | 'rect' | 'ellipse' | 'text' | 'eraser';

const COLOURS = ['#f8fafc', '#fbbf24', '#34d399', '#60a5fa', '#f87171'];

/**
 * The whiteboard.
 *
 * Drawn as operations, never as a picture. A stroke is a short list of points;
 * the board is the sum of the strokes. That matters three times over: the wire
 * carries a few hundred bytes instead of a megabyte per frame, a late joiner
 * replays the lesson's marks and arrives at the same board, and the database
 * can store a lesson's drawing in rows that a policy can actually protect.
 *
 * While a stroke is in progress it is published unreliably — a dropped point in
 * a line somebody is still drawing is invisible, whereas a queue of retries is
 * a board that lags behind the teacher's hand. The finished stroke is sent
 * reliably, and that is the one that counts.
 *
 * Students receive and render. They cannot draw: the control channel is the
 * teacher's, and every receiver drops a board op that did not come from them.
 */
export function Whiteboard({
  canDraw,
  history,
  onOp,
  onLiveOp,
  onClear,
  incoming,
}: {
  canDraw: boolean;
  /** Replayed once on entry, so somebody joining late sees the whole board. */
  history: BoardOp[];
  onOp: (op: BoardOp) => void;
  onLiveOp: (op: BoardOp) => void;
  onClear: () => void;
  /** Ops arriving from the teacher during the lesson. */
  incoming: { ops: BoardOp[]; clearedAt: number };
}) {
  const t = useTranslations('live');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [tool, setTool] = useState<Tool>('pen');
  const [colour, setColour] = useState(COLOURS[0]!);
  const drawing = useRef(false);
  const points = useRef<number[]>([]);
  const start = useRef<{ x: number; y: number } | null>(null);

  /** Ops are stored in a 0–1 space so every screen shows the same board. */
  const paint = useCallback((ctx: CanvasRenderingContext2D, op: BoardOp, W: number, H: number) => {
    ctx.strokeStyle = op.t === 'text' ? op.color : op.color;
    ctx.fillStyle = op.color;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (op.t === 'stroke') {
      ctx.lineWidth = op.w;
      ctx.beginPath();
      for (let i = 0; i + 1 < op.pts.length; i += 2) {
        const x = op.pts[i]! * W;
        const y = op.pts[i + 1]! * H;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    } else if (op.t === 'shape') {
      ctx.lineWidth = op.lw;
      const x = op.x * W;
      const y = op.y * H;
      const w = op.w * W;
      const h = op.h * H;
      ctx.beginPath();
      if (op.kind === 'rect') ctx.rect(x, y, w, h);
      else if (op.kind === 'ellipse')
        ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w / 2), Math.abs(h / 2), 0, 0, Math.PI * 2);
      else {
        ctx.moveTo(x, y);
        ctx.lineTo(x + w, y + h);
      }
      ctx.stroke();
    } else {
      ctx.font = `${op.size * H}px system-ui, sans-serif`;
      ctx.fillText(op.s, op.x * W, op.y * H);
    }
  }, []);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const { width: W, height: H } = canvas;
    ctx.clearRect(0, 0, W, H);
    for (const op of history) paint(ctx, op, W, H);
    for (const op of incoming.ops) paint(ctx, op, W, H);
  }, [history, incoming.ops, paint]);

  // Keep the backing store matched to the element, or everything draws blurry
  // and the pointer lands somewhere other than the ink.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      redraw();
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [redraw]);

  useEffect(redraw, [redraw, incoming.clearedAt]);

  const at = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height,
    };
  };

  const width = tool === 'eraser' ? 24 : 3;
  const ink = tool === 'eraser' ? '#0b1120' : colour;

  const down = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drawing.current = true;
    const p = at(event);
    start.current = p;

    if (tool === 'text') {
      const s = window.prompt(t('boardText'));
      drawing.current = false;
      if (s?.trim())
        onOp({ t: 'text', x: p.x, y: p.y, s: s.trim().slice(0, 500), color: colour, size: 0.05 });
      return;
    }
    points.current = [p.x, p.y];
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !drawing.current) return;
    const p = at(event);
    if (tool === 'pen' || tool === 'eraser') {
      points.current.push(p.x, p.y);
      // Unreliable on purpose: this stroke is still being drawn.
      if (points.current.length % 8 === 0) {
        onLiveOp({ t: 'stroke', pts: points.current.slice(-16), color: ink, w: width });
      }
      const ctx = canvasRef.current?.getContext('2d');
      const canvas = canvasRef.current;
      if (ctx && canvas) {
        paint(
          ctx,
          { t: 'stroke', pts: points.current.slice(-4), color: ink, w: width },
          canvas.width,
          canvas.height,
        );
      }
    }
  };

  const up = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!canDraw || !drawing.current) return;
    drawing.current = false;
    const p = at(event);
    const from = start.current;
    start.current = null;

    if (tool === 'pen' || tool === 'eraser') {
      if (points.current.length >= 4) {
        onOp({ t: 'stroke', pts: points.current.slice(0, 4000), color: ink, w: width });
      }
      points.current = [];
    } else if (from) {
      const kind = tool === 'line' ? 'line' : tool === 'rect' ? 'rect' : 'ellipse';
      onOp({
        t: 'shape',
        kind,
        x: from.x,
        y: from.y,
        w: p.x - from.x,
        h: p.y - from.y,
        color: colour,
        lw: 3,
      });
    }
  };

  const toolButton = (value: Tool, Icon: typeof Pen, label: string) => (
    <button
      key={value}
      type="button"
      title={label}
      aria-pressed={tool === value}
      onClick={() => setTool(value)}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg transition-colors',
        tool === value
          ? 'bg-brand-500 text-white'
          : 'text-white/60 hover:bg-white/10 hover:text-white',
      )}
    >
      <Icon className="size-4" aria-hidden="true" />
      <span className="sr-only">{label}</span>
    </button>
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {canDraw && (
        <div className="flex flex-wrap items-center gap-1 border-b border-white/10 p-2">
          {toolButton('pen', Pen, t('boardPen'))}
          {toolButton('line', Minus, t('boardLine'))}
          {toolButton('rect', Square, t('boardRect'))}
          {toolButton('text', Type, t('boardTextTool'))}
          {toolButton('eraser', Eraser, t('boardEraser'))}

          <span className="mx-1 h-5 w-px bg-white/15" aria-hidden="true" />

          {COLOURS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => {
                setColour(c);
                if (tool === 'eraser') setTool('pen');
              }}
              aria-label={c}
              aria-pressed={colour === c && tool !== 'eraser'}
              className={cn(
                'size-5 rounded-full ring-2 transition-transform',
                colour === c && tool !== 'eraser' ? 'ring-white scale-110' : 'ring-transparent',
              )}
              style={{ backgroundColor: c }}
            />
          ))}

          <button
            type="button"
            onClick={() => {
              if (window.confirm(t('boardClearConfirm'))) onClear();
            }}
            title={t('boardClear')}
            className="ms-auto inline-flex size-8 items-center justify-center rounded-lg text-red-300 transition-colors hover:bg-red-500/20"
          >
            <Trash2 className="size-4" aria-hidden="true" />
            <span className="sr-only">{t('boardClear')}</span>
          </button>
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        className={cn(
          'min-h-0 flex-1 bg-ink',
          canDraw ? 'cursor-crosshair touch-none' : 'cursor-default',
        )}
      />
    </div>
  );
}
