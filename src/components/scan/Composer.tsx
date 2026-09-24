import { useEffect, useRef, useState } from 'react';
import type { Decision } from '../../data/types';
import type { PipelineRun } from '../../lib/pipeline';
import { Icon } from '../Icon';
import { RiskBadge } from '../RiskBadge';
import { RehydrationView } from '../RehydrationView';
import { SimTag, tint } from '../ui';
import { DECISION_META } from '../DecisionBar';

export type RunPhase = 'compose' | 'running' | 'decide' | 'done';

/** Generic mock AI chat. The user's message is intercepted by VeilAI before it can leave. */
export function Composer({
  run,
  phase,
  sessionSent,
  decision,
  onSend,
  autoType,
  paused,
}: {
  run: PipelineRun;
  phase: RunPhase;
  sessionSent: number;
  decision: Decision | null;
  onSend: () => void;
  autoType: boolean;
  paused: boolean;
}) {
  const s = run.scenario;
  const session = s.messages;
  const draftFull = session ? (sessionSent < session.length ? `${session[sessionSent].instruction} ${session[sessionSent].content}` : '') : phase === 'compose' ? s.instruction : '';
  const hasAttachment = !session && !!s.content && phase === 'compose';
  const [typed, setTyped] = useState(autoType ? 0 : draftFull.length);
  const bodyRef = useRef<HTMLDivElement>(null);

  // Demo mode types the prompt, then sends it.
  useEffect(() => {
    if (!autoType) {
      setTyped(draftFull.length);
      return;
    }
    setTyped(0);
  }, [draftFull, autoType]);

  useEffect(() => {
    if (!autoType || paused || !draftFull) return;
    if (typed < draftFull.length) {
      const t = setTimeout(() => setTyped((n) => Math.min(draftFull.length, n + 2)), 22);
      return () => clearTimeout(t);
    }
    const t = setTimeout(onSend, 550);
    return () => clearTimeout(t);
  }, [typed, draftFull, autoType, paused, onSend]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: 'smooth' });
  }, [phase, sessionSent, decision]);

  const canSend = !!draftFull && phase === 'compose';

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-ink font-mono text-[10px] font-bold text-bg">AI</span>
          <div className="leading-tight">
            <div className="text-[12.5px] font-semibold">External assistant</div>
            <div className="font-mono text-[10.5px] text-ink-3">{s.destinationTool}</div>
          </div>
        </div>
        <SimTag label="MOCK CHAT" />
      </div>

      <div ref={bodyRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        {!session && phase === 'compose' && (
          <div className="mt-6 text-center text-[12px] text-ink-3">
            <Icon name="shield" size={22} className="mx-auto mb-2 text-line-2" />
            Messages are checked on this device before they are sent.
          </div>
        )}

        {session &&
          session.slice(0, sessionSent).map((m, i) => (
            <div key={i} className="rise space-y-1">
              <UserBubble text={`${m.instruction} ${m.content}`} />
              <div className="flex items-center justify-end gap-1.5 text-[10.5px] text-ink-3">
                <RiskBadge level={m.riskLevel} size="sm" />
                {i < session.length - 1 ? 'alone: sent unchanged' : 'alone, but see session'}
              </div>
            </div>
          ))}

        {session && sessionSent >= session.length && s.mosaicWarning && (
          <div className="rise rounded-lg border px-3 py-2 text-[12px]" style={{ borderColor: tint('var(--high)', 50), background: tint('var(--high)', 8) }}>
            <div className="mb-1 flex items-center gap-1.5 font-semibold" style={{ color: 'var(--high)' }}>
              <Icon name="alert" size={13} /> Mosaic risk · session escalated to <RiskBadge level={s.riskLevel} size="sm" />
            </div>
            <div className="text-ink-2">{s.mosaicWarning}</div>
          </div>
        )}

        {!session && phase !== 'compose' && (
          <div className="rise">
            <UserBubble text={s.instruction} attachment={s.content || undefined} />
          </div>
        )}

        {phase !== 'compose' && (!session || sessionSent >= session.length) && (
          <InterceptRow phase={phase} decision={decision} blocked={!!s.blocked} />
        )}

        {phase === 'done' && decision && <ReplyBubble run={run} decision={decision} />}
      </div>

      <div className="border-t border-line p-2.5">
        <div className={`rounded-xl border bg-panel px-3 py-2 transition ${canSend ? 'border-line-2' : 'border-line opacity-60'}`}>
          <div className="min-h-[38px] text-[12.5px] leading-snug">
            {draftFull ? (
              <>
                {draftFull.slice(0, typed)}
                {typed < draftFull.length && <span className="ml-px inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-accent" />}
              </>
            ) : (
              <span className="text-ink-3">{session ? 'Session complete' : 'Sent'}</span>
            )}
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            {hasAttachment ? (
              <span className="flex items-center gap-1 rounded-md border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[10.5px] text-ink-2">
                <Icon name="doc" size={11} /> pasted content · {s.content.split('\n').length} line{s.content.split('\n').length === 1 ? '' : 's'}
              </span>
            ) : session && sessionSent < session.length ? (
              <span className="font-mono text-[10.5px] text-ink-3">
                message {sessionSent + 1} of {session.length}
              </span>
            ) : (
              <span />
            )}
            <button
              type="button"
              onClick={onSend}
              disabled={!canSend}
              className="flex h-7 items-center gap-1.5 rounded-lg bg-ink px-2.5 text-[12px] font-medium text-bg transition hover:opacity-90 disabled:opacity-30"
              aria-label="Send message"
            >
              Send <Icon name="send" size={12} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UserBubble({ text, attachment }: { text: string; attachment?: string }) {
  return (
    <div className="ml-6 rounded-2xl rounded-br-md bg-ink px-3 py-2 text-[12.5px] text-bg">
      <div>{text}</div>
      {attachment && <pre className="mt-2 max-h-[120px] overflow-auto whitespace-pre rounded-lg bg-white/10 p-2 font-mono text-[10.5px] leading-relaxed text-bg/85">{attachment}</pre>}
    </div>
  );
}

function InterceptRow({ phase, decision, blocked }: { phase: RunPhase; decision: Decision | null; blocked: boolean }) {
  const label =
    phase === 'running'
      ? 'VeilAI · analysing on device'
      : phase === 'decide'
        ? 'VeilAI · awaiting your decision'
        : decision
          ? `VeilAI · ${blocked ? 'Blocked' : DECISION_META[decision].label}`
          : '';
  return (
    <div className="flex items-center justify-end gap-1.5 text-[10.5px]">
      <span
        className={`flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 font-mono ${phase === 'done' ? (decision === 'BLOCK' ? 'border-critical/50 text-critical' : 'border-safe/50 text-safe') : 'border-accent/40 text-accent'}`}
      >
        <Icon name="shield" size={11} />
        {label}
        {phase === 'running' && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />}
      </span>
    </div>
  );
}

function ReplyBubble({ run, decision }: { run: PipelineRun; decision: Decision }) {
  if (decision === 'BLOCK')
    return (
      <div className="rise rounded-xl border-2 px-3 py-2 text-[12px]" style={{ borderColor: 'var(--critical)' }}>
        <div className="flex items-center gap-1.5 font-semibold text-critical">
          <Icon name="alert" size={13} /> Nothing was sent.
        </div>
        <div className="mt-0.5 text-ink-2">{run.scenario.explanation.recommended}</div>
      </div>
    );
  if (decision === 'ANSWER_LOCALLY')
    return (
      <div className="rise overflow-hidden rounded-xl border" style={{ borderColor: tint('var(--safe)', 45) }}>
        <div className="flex items-center gap-1.5 px-3 py-1.5 font-mono text-[10.5px] font-semibold text-safe" style={{ background: tint('var(--safe)', 10) }}>
          <Icon name="cpu" size={11} /> On-device Qwen · nothing left this device
        </div>
        <div className="whitespace-pre-wrap px-3 py-2 text-[12.5px] leading-relaxed">{run.localAnswer}</div>
      </div>
    );
  if (!run.rehydrated) return null;
  return (
    <div className="rise mr-4 rounded-2xl rounded-bl-md border border-line bg-panel-2 px-3 py-2">
      <RehydrationView result={run.rehydrated} className="!text-[12.5px]" />
      <div className="mt-1.5 flex items-center gap-1 font-mono text-[10px] text-safe">
        <Icon name="lock" size={10} /> Restored on this device
      </div>
    </div>
  );
}
