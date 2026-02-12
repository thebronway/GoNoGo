import React from 'react';
import { Monitor, CheckCircle2, Tv, RefreshCw, BrainCircuit, ExternalLink, Mail } from 'lucide-react';
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
      <div className="text-center max-w-3xl mx-auto mb-20">
        <div className="inline-flex items-center justify-center p-3 bg-blue-900/20 border border-blue-900/50 rounded-full mb-6 animate-fade-in">
            <Monitor className="w-8 h-8 text-blue-400" />
        </div>
        
        <h1 className="text-5xl md:text-6xl font-black text-white mb-6 tracking-tight leading-tight">
            The Digital <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300">
                Weather Kiosk
            </span>
        </h1>
        <p className="text-xl text-gray-400 mb-8 leading-relaxed">
            Upgrade your Flight School or FBO lobby with an always-on, auto-updating 
            situational awareness display with weather, airpace info and NOTAMs.
        </p>
      </div>

      {/* LIVE PREVIEWS */}
      <div className="mb-24">
          <div className="flex items-center gap-4 mb-6 justify-center md:justify-start">
              <div className="h-px bg-neutral-800 flex-1"></div>
              <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">Live Examples</span>
              <div className="h-px bg-neutral-800 flex-1"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
              <ExampleLink code="KANP" name="Lee Airport" profile="small" />
              <ExampleLink code="KBOS" name="Logan Intl" profile="small" />
          </div>
          <p className="text-center text-xs text-neutral-600 mt-4">
              *Clicking these will open the Kiosk display in a new tab.
          </p>
      </div>

      {/* FEATURES GRID */}
      <div className="grid md:grid-cols-3 gap-6 mb-24">
        <FeatureCard 
            icon={Tv}
            title="16:9 Optimized" 
            desc="Designed specifically for large TV screens mounted in pilot lounges or lobbies. High contrast, readable from a distance, and no mouse interaction required."
        />
        <FeatureCard 
            icon={RefreshCw}
            title="Smart Polling" 
            desc="The system checks for new METARs every minute. When a new report is published, the screen automatically refreshes the AI analysis instantly."
        />
        <FeatureCard 
            icon={BrainCircuit}
            title="Plain English" 
            desc="Raw data is crucial, but context is key. We decode the weather, analyze crosswind components against your fleet, and highlight critical NOTAMs."
        />
      </div>

      {/* USE CASES & CTA */}
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