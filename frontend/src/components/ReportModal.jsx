import React, { useState } from 'react';
import { X, Send, AlertCircle, CheckCircle2 } from 'lucide-react';

const ReportModal = ({ isOpen, onClose, contextData = null }) => {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [faxNumber, setFaxNumber] = useState(""); // Honeypot
  const [status, setStatus] = useState("idle"); // idle, sending, success, error

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");

    try {
      const payload = {
        message,
        email,
        fax_number: faxNumber, // If bot fills this, backend rejects it
        context: contextData
      };

      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        setStatus("success");
        setTimeout(() => {
            onClose();
            setStatus("idle");
            setMessage("");
        }, 2000);
      } else {
        setStatus("error");
      }
    } catch (err) {
      console.error(err);
      setStatus("error");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-xl shadow-2xl relative overflow-hidden">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-800 flex justify-between items-center bg-neutral-900/50">
          <h3 className="font-bold text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-blue-500" />
            Report an Issue
          </h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Success State */}
        {status === "success" ? (
            <div className="p-12 flex flex-col items-center text-center space-y-4">
                <div className="w-16 h-16 bg-green-900/20 rounded-full flex items-center justify-center text-green-500">
                    <CheckCircle2 size={32} />
                </div>
                <h4 className="text-xl font-bold text-white">Report Sent</h4>
                <p className="text-neutral-400">Thank you for helping us improve GoNoGo.</p>
            </div>
        ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                
                {/* Context Note */}
                {contextData && (
                    <div className="bg-blue-900/10 border border-blue-900/30 rounded p-3 text-xs text-blue-300 mb-4">
                        <strong>Note:</strong> A snapshot of the current airport data ({contextData.airport}) will be included to help us debug the issue.
                    </div>
                )}

                {/* Message */}
                <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Description of Issue</label>
                    <textarea 
                        required
                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none min-h-[120px]"
                        placeholder="Describe the bug, hallucination, or feedback..."
                        value={message}
                        onChange={e => setMessage(e.target.value)}
                    />
                </div>

                {/* Email */}
                <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Your Email (Optional)</label>
                    <input 
                        type="email"
                        className="w-full bg-black border border-neutral-700 rounded-lg p-3 text-sm text-white focus:border-blue-500 focus:outline-none"
                        placeholder="For follow-up questions..."
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                    />
                </div>

                {/* HONEYPOT (Hidden) */}
                <div className="hidden">
                    <input type="text" name="fax_number" value={faxNumber} onChange={e => setFaxNumber(e.target.value)} tabIndex="-1" autoComplete="off" />
                </div>

                {/* Actions */}
                <div className="pt-2 flex justify-end gap-3">
                    <button 
                        type="button" 
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-bold text-neutral-500 hover:text-white transition-colors"
                    >
                        CANCEL
                    </button>
                    <button 
                        type="submit"
                        disabled={status === "sending"}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-bold rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                    >
                        {status === "sending" ? "SENDING..." : (
                            <>
                                <Send size={16} /> SEND REPORT
                            </>
                        )}
                    </button>
                </div>
            </form>
        )}
      </div>
    </div>
  );
};

export default ReportModal;