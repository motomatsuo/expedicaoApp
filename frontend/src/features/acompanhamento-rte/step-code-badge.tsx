'use client';

import { STEP_CODE_DESCRIPTIONS } from '@/features/acompanhamento-rte/code-descriptions';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

type StepCodeBadgeProps = {
  code: number;
};

export function StepCodeBadge({ code }: StepCodeBadgeProps) {
  const desc = STEP_CODE_DESCRIPTIONS[code];
  const wrapRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });

  const measure = useCallback(() => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords({ top: r.bottom + 6, left: r.left + r.width / 2 });
  }, []);

  const cancelScheduledClose = useCallback(() => {
    if (closeTimerRef.current != null) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const scheduleClose = useCallback(() => {
    cancelScheduledClose();
    closeTimerRef.current = setTimeout(() => setOpen(false), 120);
  }, [cancelScheduledClose]);

  const show = useCallback(() => {
    cancelScheduledClose();
    measure();
    setOpen(true);
  }, [cancelScheduledClose, measure]);

  useEffect(() => {
    if (!open) return;
    const onScrollOrResize = () => measure();
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [open, measure]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current?.contains(e.target as Node)) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest?.('[data-step-code-tooltip]')) return;
      setOpen(false);
    };
    document.addEventListener('click', onDocClick, true);
    return () => document.removeEventListener('click', onDocClick, true);
  }, [open]);

  useEffect(() => () => cancelScheduledClose(), [cancelScheduledClose]);

  const badgeShell =
    'shrink-0 rounded-md border border-gray-200/80 bg-gradient-to-b from-gray-50 to-gray-100/90 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-gray-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]';

  if (!desc) {
    return <span className={badgeShell}>{code}</span>;
  }

  const tooltip =
    open &&
    typeof document !== 'undefined' &&
    createPortal(
      <div
        data-step-code-tooltip
        role="tooltip"
        className="pointer-events-auto fixed z-[300] max-w-[min(18rem,calc(100vw-1rem))] -translate-x-1/2 rounded-md border border-gray-700 bg-gray-900 px-2.5 py-2 text-left text-[10px] font-medium leading-snug text-gray-100 shadow-xl"
        style={{ top: coords.top, left: coords.left }}
        onMouseEnter={cancelScheduledClose}
        onMouseLeave={() => setOpen(false)}
      >
        {desc}
      </div>,
      document.body,
    );

  return (
    <>
      <span
        ref={wrapRef}
        className="group relative inline-flex shrink-0"
        onMouseEnter={show}
        onMouseLeave={scheduleClose}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => {
            if (!v) measure();
            return !v;
          });
        }}
      >
        <span
          className={`${badgeShell} ring-gray-900/5 transition-shadow group-hover:shadow-sm`}
        >
          {code}
        </span>
      </span>
      {tooltip}
    </>
  );
}
