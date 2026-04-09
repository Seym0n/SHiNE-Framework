import React, { useState, useEffect, useCallback } from 'react';
import { X, RefreshCw, ShieldCheck } from 'lucide-react';

interface CaptchaModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVerified: (text: string, hash: string) => void;
  error?: string;
}

const CaptchaModal = ({ isOpen, onClose, onVerified, error }: CaptchaModalProps) => {
  const [captchaSvg, setCaptchaSvg] = useState('');
  const [hash, setHash] = useState('');
  const [input, setInput] = useState('');
  const [isFetching, setIsFetching] = useState(false);

  const fetchCaptcha = useCallback(async () => {
    setIsFetching(true);
    setInput('');
    try {
      const res = await fetch('/api/generate-captcha', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ size: 6, noise: 2, ignoreChars: '0o1ilIL' }),
      });
      const data = await res.json();
      setCaptchaSvg(data.captcha);
      setHash(data.hash);
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchCaptcha();
    } else {
      setInput('');
    }
  }, [isOpen, error, fetchCaptcha]);

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    onVerified(input, hash);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-sm overflow-hidden transform transition-all">
        {/* Header */}
        <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-600 flex items-center">
          <div className="bg-blue-100 dark:bg-blue-900 p-2 rounded-full mr-3">
            <ShieldCheck className="text-blue-500 dark:text-blue-400" size={20} />
          </div>
          <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex-1">
            Human Verification
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Close"
          >
            <X size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-6 py-4">
          <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">
            Please enter the characters shown below to continue.
          </p>

          {/* Captcha image */}
          <div className="flex items-center gap-3 mb-4">
            <div
              className={`flex-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-2 flex items-center justify-center transition-opacity ${isFetching ? 'opacity-40' : 'opacity-100'}`}
              dangerouslySetInnerHTML={{ __html: captchaSvg }}
            />
            <button
              type="button"
              onClick={fetchCaptcha}
              disabled={isFetching}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-400 disabled:opacity-40"
              aria-label="Reload captcha"
            >
              <RefreshCw size={18} className={isFetching ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* Input */}
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter characters..."
            autoComplete="off"
            autoFocus
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-3"
          />

          {error && (
            <p className="text-red-500 text-sm mb-3">{error}</p>
          )}

          {/* Footer buttons */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium text-gray-700 dark:text-gray-200 transition-colors shadow-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!input.trim()}
              className={`px-5 py-1.5 rounded-lg font-medium text-white transition-all shadow-sm ${
                !input.trim()
                  ? 'bg-gray-400 cursor-not-allowed opacity-70'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              Verify
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CaptchaModal;
