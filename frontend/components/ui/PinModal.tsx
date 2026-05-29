'use client';

import { useState, useEffect } from 'react';

interface PinModalProps {
  onSuccess: (pin: string) => void;
  onCancel?: () => void;
  title?: string;
}

export default function PinModal({
  onSuccess,
  onCancel,
  title = 'PIN eingeben',
}: PinModalProps) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [shake, setShake] = useState(false);

  const handleDigit = (digit: string) => {
    if (pin.length >= 4) return;
    const newPin = pin + digit;
    setPin(newPin);
    setError(false);

    if (newPin.length === 4) {
      // Auto-submit when 4 digits entered
      setTimeout(() => {
        onSuccess(newPin);
      }, 100);
    }
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
    setError(false);
  };

  const handleClear = () => {
    setPin('');
    setError(false);
  };

  // Handle keyboard input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape' && onCancel) {
        onCancel();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pin]);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className={`
          bg-slate-800 border border-slate-700 rounded-2xl p-6 w-full max-w-xs shadow-2xl
          ${shake ? 'animate-bounce' : ''}
        `}
      >
        <h2 className="text-xl font-bold text-center text-slate-100 mb-6">{title}</h2>

        {/* PIN dots */}
        <div className="flex justify-center gap-4 mb-6">
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={`
                w-4 h-4 rounded-full border-2 transition-all duration-150
                ${i < pin.length
                  ? 'bg-indigo-500 border-indigo-500 scale-110'
                  : 'bg-transparent border-slate-500'
                }
                ${error ? 'border-red-500 bg-red-500' : ''}
              `}
            />
          ))}
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center mb-4">Falscher PIN</p>
        )}

        {/* Number pad */}
        <div className="grid grid-cols-3 gap-3 mb-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
            <button
              key={digit}
              onClick={() => handleDigit(String(digit))}
              className="
                h-14 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500
                text-xl font-semibold text-slate-100 transition-colors
                border border-slate-600 active:scale-95
              "
            >
              {digit}
            </button>
          ))}

          {/* Bottom row: clear, 0, delete */}
          <button
            onClick={handleClear}
            className="
              h-14 rounded-xl bg-slate-700/50 hover:bg-slate-700 active:bg-slate-600
              text-sm text-slate-400 transition-colors border border-slate-600/50
              active:scale-95
            "
          >
            C
          </button>

          <button
            onClick={() => handleDigit('0')}
            className="
              h-14 rounded-xl bg-slate-700 hover:bg-slate-600 active:bg-slate-500
              text-xl font-semibold text-slate-100 transition-colors
              border border-slate-600 active:scale-95
            "
          >
            0
          </button>

          <button
            onClick={handleDelete}
            className="
              h-14 rounded-xl bg-slate-700/50 hover:bg-slate-700 active:bg-slate-600
              text-slate-400 transition-colors border border-slate-600/50
              active:scale-95 text-lg
            "
          >
            ⌫
          </button>
        </div>

        {onCancel && (
          <button
            onClick={onCancel}
            className="
              w-full py-3 rounded-xl text-slate-400 hover:text-slate-200
              hover:bg-slate-700/50 transition-colors text-sm
            "
          >
            Abbrechen
          </button>
        )}
      </div>
    </div>
  );
}
