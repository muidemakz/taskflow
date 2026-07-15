import { ChevronRight, DoorClosed } from 'lucide-react';
import ProgressBar from '../ProgressBar';

export default function GateCard({ gate, onOpen, onCloseGate }) {
  const { total, done, pct } = gate.progress;
  return (
    <div className="card flex flex-col p-4">
      <button className="flex w-full items-center justify-between gap-2 text-left" onClick={() => onOpen(gate)}>
        <h3 className="font-semibold">{gate.name}</h3>
        <ChevronRight size={16} className="shrink-0 text-slate-400" />
      </button>
      <div className="mt-3">
        <ProgressBar value={pct} />
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-muted">{done}/{total} done</span>
          <span className="font-semibold text-primary">{pct}%</span>
        </div>
      </div>
      <button className="btn-ghost mt-3 w-full justify-center" onClick={() => onCloseGate(gate)}>
        <DoorClosed size={15} /> Close gate
      </button>
    </div>
  );
}
