import { useState, useEffect, useRef } from "react";
import { X, AlertCircle } from "lucide-react";

interface InputDialogProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  defaultValue?: string;
  error?: string;
  confirmText?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export default function InputDialog({
  isOpen,
  title,
  placeholder,
  defaultValue = "",
  error,
  confirmText = "Erstellen",
  onConfirm,
  onCancel,
}: InputDialogProps) {
  const [value, setValue] = useState(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setValue(defaultValue);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen, defaultValue]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-sidebar border border-dark-border rounded-lg shadow-2xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-dark-border">
          <h2 className="text-lg font-medium text-white">{title}</h2>
          <button
            onClick={onCancel}
            className="p-1 rounded hover:bg-dark-hover text-dark-text-muted hover:text-dark-text transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className={`w-full bg-dark-panel border rounded-lg px-3 py-2 text-dark-text placeholder-dark-text-muted focus:outline-none transition-colors ${
              error ? "border-red-500 focus:border-red-500" : "border-dark-border focus:border-dark-accent"
            }`}
            autoFocus
          />

          {error && (
            <div className="flex items-center gap-2 mt-2 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm text-dark-text-muted hover:text-dark-text transition-colors"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={!value.trim()}
              className="px-4 py-2 bg-dark-accent text-white text-sm rounded-lg hover:bg-dark-accent-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {confirmText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
