import React, { useState } from 'react';
import { X, Send, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';

const KioskInquiryModal = ({ isOpen, onClose }) => {
  const [form, setForm] = useState({ name: '', email: '', org: '', icaos: '' });
  const [status, setStatus] = useState("idle");

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("sending");
    try {
      await api.post("/api/contact/kiosk-inquiry", form);
      setStatus("success");
      setTimeout(() => { onClose(); setStatus("idle"); setForm({ name: '', email: '', org: '', icaos: '' }); }, 2000);
    } catch (e) {
      alert("Failed to send. Please try again.");
      setStatus("idle");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-neutral-900 border border-neutral-800 w-full max-w-md rounded-xl shadow-2xl relative">
        <button onClick={onClose} className="absolute top-4 right-4 text-neutral-500 hover:text-white"><X size={20} /></button>
        
        {status === "success" ? (
           <div className="p-12 flex flex-col items-center text-center space-y-4">
             <CheckCircle2 size={48} className="text-green-500" />
             <h3 className="text-xl font-bold text-white">Inquiry Sent</h3>
             <p className="text-gray-400">We will be in touch shortly.</p>
           </div>
        ) : (
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
                <h2 className="text-xl font-bold text-white mb-6">Setup Kiosk Mode</h2>
                <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Contact Name</label>
                    <input required className="w-full bg-black border border-neutral-700 rounded p-3 text-white focus:border-blue-500 outline-none" 
                        value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Email</label>
                    <input required type="email" className="w-full bg-black border border-neutral-700 rounded p-3 text-white focus:border-blue-500 outline-none" 
                        value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Flight School / FBO Name</label>
                    <input required className="w-full bg-black border border-neutral-700 rounded p-3 text-white focus:border-blue-500 outline-none" 
                        value={form.org} onChange={e => setForm({...form, org: e.target.value})} />
                </div>
                <div>
                    <label className="block text-xs font-bold text-neutral-500 uppercase mb-1">Requested ICAO / LID(s)</label>
                    <input required className="w-full bg-black border border-neutral-700 rounded p-3 text-white focus:border-blue-500 outline-none" placeholder="e.g. KBOS, 2W5"
                        value={form.icaos} onChange={e => setForm({...form, icaos: e.target.value})} />
                </div>
                <button type="submit" disabled={status === "sending"} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 mt-4">
                    {status === "sending" ? "SENDING..." : <><Send size={18} /> SEND REQUEST</>}
                </button>
            </form>
        )}
      </div>
    </div>
  );
};

export default KioskInquiryModal;