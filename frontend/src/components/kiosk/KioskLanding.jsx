import React from 'react';
import { Monitor, CheckCircle2, Tv, RefreshCw, BrainCircuit, ExternalLink, Mail, Plane, ShieldAlert, Zap } from 'lucide-react';
import KioskInquiryModal from './KioskInquiryModal';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import SEO from '../SEO';

const FeatureCard = ({ icon: Icon, title, desc }) => (
    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 flex flex-col gap-3">
        <div className="bg-neutral-800 w-10 h-10 rounded-full flex items-center justify-center text-blue-400 mb-2">
            <Icon size={20} />
        </div>
        <h3 className="font-bold text-white text-lg">{title}</h3>
        <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
    </div>
);

const ExampleLink = ({ code, name, profile }) => (
    <Link 
        to={`/kiosk/${code}/${profile}`} 
        target="_blank"
        className="group relative block bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 hover:border-blue-500 rounded-xl p-4 transition-all duration-300"
    >
        <div className="flex justify-between items-start mb-2">
            <span className="font-black text-2xl text-white group-hover:text-blue-400 transition-colors">{code}</span>
            <ExternalLink size={16} className="text-neutral-500 group-hover:text-white" />
        </div>
        <div className="text-xs text-gray-400 uppercase tracking-widest font-bold mb-1">{name}</div>
        <div className="inline-block bg-black/50 text-neutral-500 text-[10px] px-2 py-1 rounded border border-neutral-700">
            {profile.toUpperCase()} PROFILE
        </div>
    </Link>
);

const KioskLanding = () => {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
    <KioskInquiryModal isOpen={showModal} onClose={() => setShowModal(false)} />
    <div className="max-w-6xl mx-auto pt-10 px-6 pb-20">
      <SEO 
        title="WxDecoder Kiosk Mode - Digital Aviation Weather Kiosk"
        description="Turn any TV into a live aviation weather station for your Flight School or FBO. Auto-updating METARs, TAFs, and AI Analysis."
        path="/kiosk"
      />

      {/* HERO SECTION */}
      <div className="text-center max-w-3xl mx-auto mb-12">
        
        <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            A Digital&nbsp;
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                Weather Kiosk
            </span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 leading-relaxed">
            Upgrade your Flight School or FBO lobby with an always-on, auto-updating 
            situational awareness display with weather, airspace info, and NOTAMs.
        </p>
      </div>

      {/* DEMO GIF */}
      <div className="max-w-4xl mx-auto mb-24 rounded-xl overflow-hidden border border-neutral-800 shadow-2xl shadow-blue-900/20">
         <img src="/kiosk/KANP.gif" alt="Kiosk Mode Animation" className="w-full h-auto object-cover" />
      </div>

      {/* SCREENSHOTS / LIVE PREVIEWS */}
      <div className="mb-24">
          <div className="flex items-center gap-4 mb-8 justify-center">
              <div className="h-px bg-neutral-800 flex-1 max-w-[100px]"></div>
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Live Demos & Screenshots</span>
              <div className="h-px bg-neutral-800 flex-1 max-w-[100px]"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
              
              {/* CARD 1: KANP */}
              <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-6 hover:border-blue-500/30 transition-colors group">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                      <div>
                          <h3 className="text-2xl font-black text-white leading-none">KANP</h3>
                          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">Lee Airport</p>
                      </div>
                  </div>

                  {/* Image Preview */}
                  <a href="/kiosk/KANP.webp" target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-neutral-800 relative shadow-2xl cursor-zoom-in">
                      <img src="/kiosk/KANP.webp" alt="KANP Preview" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-bold text-white uppercase tracking-wider bg-black/50 px-3 py-1 rounded border border-white/20">View 4K Screenshot</span>
                      </div>
                  </a>

                  {/* Action Button */}
                  <Link 
                      to="/kiosk/KANP/small" 
                      target="_blank"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-sm shadow-lg shadow-blue-900/20"
                  >
                      <ExternalLink size={16} /> Launch Live Demo
                  </Link>
              </div>

              {/* CARD 2: KBOS */}
              <div className="bg-neutral-900/30 border border-neutral-800 rounded-2xl p-6 flex flex-col gap-6 hover:border-blue-500/30 transition-colors group">
                  {/* Header */}
                  <div className="flex items-center gap-3">
                      <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                      <div>
                          <h3 className="text-2xl font-black text-white leading-none">KBOS</h3>
                          <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest mt-1">Logan Intl</p>
                      </div>
                  </div>

                  {/* Image Preview */}
                  <a href="/kiosk/KBOS.webp" target="_blank" rel="noopener noreferrer" className="block rounded-lg overflow-hidden border border-neutral-800 relative shadow-2xl cursor-zoom-in">
                      <img src="/kiosk/KBOS.webp" alt="KBOS Preview" className="w-full h-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-bold text-white uppercase tracking-wider bg-black/50 px-3 py-1 rounded border border-white/20">View 4K Screenshot</span>
                      </div>
                  </a>

                  {/* Action Button */}
                  <Link 
                      to="/kiosk/KBOS/small" 
                      target="_blank"
                      className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-all uppercase tracking-wider text-sm shadow-lg shadow-blue-900/20"
                  >
                      <ExternalLink size={16} /> Launch Live Demo
                  </Link>
              </div>

          </div>
      </div>

      {/* FEATURES GRID */}
      <div className="mb-24">
        <div className="flex items-center gap-4 mb-8 justify-center">
            <div className="h-px bg-neutral-800 flex-1 max-w-[100px]"></div>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Features</span>
            <div className="h-px bg-neutral-800 flex-1 max-w-[100px]"></div>
        </div>
        
        <div className="grid md:grid-cols-3 gap-6">
            <FeatureCard 
                icon={Monitor}
                title="Set & Forget Display" 
                desc="Designed for zero-touch operation. Mount a TV in your pilot lounge, load the URL, and it runs forever. No mouse, no refreshing, just live data."
            />
            <FeatureCard 
                icon={RefreshCw}
                title="Always-On Awareness" 
                desc="The system automatically polls for new METARs every 60 seconds. As soon as conditions change, the screen updates instantly."
            />
            <FeatureCard 
                icon={BrainCircuit}
                title="Safety Culture" 
                desc="Raw data is crucial, but context is key. We decode NOTAMs and analyze crosswind components against your fleet to support Go/No-Go decisions."
            />
            <FeatureCard 
                icon={Plane}
                title="Fleet Logic" 
                desc="Tailor the analysis to your aircraft. Whether you fly C172s or TBMs, the system flags crosswinds based on your specific operational limits."
            />
            <FeatureCard 
                icon={ShieldAlert}
                title="Airspace Guardian" 
                desc="Automatic proximity checks for critical airspace like the DC SFRA or P-40. Don't let a student pilot blunder into a restricted zone."
            />
            <FeatureCard 
                icon={Zap}
                title="High Reliability" 
                desc="Engineered for uptime. Our smart caching and error handling systems ensure your screen stays live, even during momentary API outages."
            />
        </div>
      </div>

      {/* USE CASES & CTA */}
      <div className="flex items-center gap-4 mb-8 justify-center">
            <div className="h-px bg-neutral-800 flex-1 max-w-[100px]"></div>
            <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Get Kiosk Mode</span>
            <div className="h-px bg-neutral-800 flex-1 max-w-[100px]"></div>
      </div>  
      <div className="grid md:grid-cols-2 gap-12 items-center bg-neutral-900/30 border border-neutral-800 rounded-3xl p-8 md:p-12">
          <div className="space-y-6">
              <h2 className="text-3xl font-bold text-white">Built for Aviation Businesses</h2>
              <ul className="space-y-4">
                  {[
                      "Flight Schools: Keep students informed before they walk out the door.",
                      "FBOs: Provide a modern, digital service for visiting crews.",
                      "Corporate Hangars: At-a-glance status for fleet operations."
                  ].map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-gray-400">
                          <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                          <span>{item}</span>
                      </li>
                  ))}
              </ul>
          </div>

          <div className="bg-neutral-800 p-8 rounded-2xl border border-neutral-700 text-center space-y-6">
              <h3 className="text-xl font-bold text-white">Get Kiosk Mode</h3>
              <p className="text-gray-400 text-sm">
                  Kiosk Mode is a premium feature requiring airport authorization to manage API costs and ensure reliability.
              </p>
              
              <button 
                className="w-full bg-white hover:bg-gray-200 text-black font-bold py-4 px-8 rounded-xl transition-all flex items-center justify-center gap-2"
                onClick={() => setShowModal(true)}
              >
                  <Mail size={18} /> Contact To Setup
              </button>
              
          </div>

      </div>
    </div>
    </>
  );
};

export default KioskLanding;