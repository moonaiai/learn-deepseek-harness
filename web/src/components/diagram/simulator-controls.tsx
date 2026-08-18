import { Pause, Play, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const SPEEDS = [0.5, 1, 2, 4];

export function SimulatorControls({
  isPlaying,
  speed,
  isComplete,
  onPlay,
  onPause,
  onReset,
  onSetSpeed,
}: {
  isPlaying: boolean;
  speed: number;
  isComplete: boolean;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
  onSetSpeed: (speed: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[--color-border] px-3 py-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onReset}
          aria-label="Reset"
          className="rounded-lg p-2 text-[--color-text-muted] transition-colors hover:bg-[--color-surface-hover] hover:text-[--color-text]"
        >
          <RotateCcw size={14} />
        </button>
        <button
          type="button"
          onClick={isPlaying ? onPause : onPlay}
          disabled={isComplete && !isPlaying}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="rounded-lg bg-blue-600 p-2 text-white transition-colors hover:bg-blue-500 disabled:opacity-40"
        >
          {isPlaying ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
      <div className="flex items-center gap-1 rounded-lg border border-[--color-border] p-0.5 text-xs">
        {SPEEDS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onSetSpeed(s)}
            className={cn(
              "rounded-md px-2 py-1 font-mono transition-colors",
              speed === s
                ? "bg-blue-500 text-white"
                : "text-[--color-text-muted] hover:bg-[--color-surface-hover]",
            )}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  );
}
