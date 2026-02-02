import React, { useEffect, useState } from 'react';
import AdminLayout from './AdminLayout';
import { Save, Activity, Mail, Server, ShieldAlert, PauseCircle, CheckCircle2, Send, Zap } from 'lucide-react';

const ConfigInput = ({ label, confKey, value, onChange, onSave, saving, type = "text", placeholder }) => (
  <div className="mb-4">
    <label className="block text-[10px] uppercase text-neutral-500 font-bold mb-1">{label}</label>
    <div className="flex gap-2">
      <input 
        type={type} 
        value={value || ""} 
        onChange={(e) => onChange(confKey, e.target.value)}
        className="bg-neutral-900 border border-neutral-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500 flex-1 min-w-0"
        placeholder={placeholder}
      />
      <button 
          onClick={() => onSave(confKey, value)}
          className={`px-3 py-2 rounded text-white font-bold transition-colors shrink-0 ${
              saving === confKey ? 'bg-green-600' : 'bg-neutral-800 hover:bg-neutral-700'
          }`}
      >
          {saving === confKey ? <CheckCircle2 size={16} /> : <Save size={16} />}
      </button>
    </div>
  </div>
);

const ToggleCell = ({ eventType, channel, label, rules, onToggle }) => {
    const rule = rules.find(r => r.event_type === eventType);
    const channels = rule ? JSON.parse(rule.channels) : [];
    const isActive = channels.includes(channel);

    return (
        <button 
            onClick={() => onToggle(eventType, channel)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded text-[10px] font-bold uppercase border transition-all ${
                isActive 
                ? 'bg-blue-600/20 border-blue-600 text-blue-400' 
                : 'bg-neutral-900 border-neutral-800 text-neutral-600 hover:border-neutral-600'
            }`}
        >
            <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.8)]' : 'bg-neutral-700'}`}></div>
            {label}
        </button>
    );
};

// --- MAIN COMPONENT ---

const Settings = () => {
  const [settings, setSettings] = useState({});
  const [rules, setRules] = useState([]);
  const [usage, setUsage] = useState({ total_tokens: 0, ai_calls: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);

  // --- FETCH DATA ---
  const fetchData = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      if (res.ok) {
        const data = await res.json();
        const settingsMap = {};
        data.config.forEach(item => settingsMap[item.key] = item.value);
        setSettings(settingsMap);
        setRules(data.notifications);
        setUsage(data.usage);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // --- HANDLERS ---
  const handleChange = (key, val) => {
    setSettings(prev => ({ ...prev, [key]: val }));
  };

  const handleSaveConfig = async (key, value) => {
    setSaving(key);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value })
      });
      if (res.ok) setTimeout(() => setSaving(null), 1000);
    } catch (err) {
      alert("Failed to save");
      setSaving(null);
    }
  };

  const handleToggleRule = async (eventType, channel) => {
    const rule = rules.find(r => r.event_type === eventType) || { event_type: eventType, channels: "[]", enabled: 1 };
    let currentChannels = [];
    try { currentChannels = JSON.parse(rule.channels); } catch (e) {}

    let newChannels;
    if (currentChannels.includes(channel)) {
      newChannels = currentChannels.filter(c => c !== channel);
    } else {
      newChannels = [...currentChannels, channel];
    }

    const updatedRules = rules.map(r => 
      r.event_type === eventType ? { ...r, channels: JSON.stringify(newChannels) } : r
    );
    if (!rules.find(r => r.event_type === eventType)) {
        updatedRules.push({ event_type: eventType, channels: JSON.stringify(newChannels), enabled: 1 });
    }
    setRules(updatedRules);

    await fetch("/api/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event_type: eventType,
        channels: newChannels,
        enabled: true
      })
    });
  };

  const handleTestNotification = async (channel) => {
    if(!confirm(`Send test alert to ${channel}?`)) return;
    try {
        const res = await fetch("/api/admin/test-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ channel })
        });
        if(res.ok) alert("Test Sent!");
        else alert("Failed to send test.");
    } catch (e) {
        alert("Error sending test.");
    }
  };

  if (loading) return <AdminLayout><div className="text-blue-500 animate-pulse">LOADING CONFIG...</div></AdminLayout>;

  return (
    <AdminLayout>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl">
        
        {/* COL 1: CRITICAL CONTROLS */}
        <div className="space-y-6">
            
            {/* GLOBAL PAUSE */}
            <div className={`p-6 rounded-xl border ${settings.global_pause === "true" ? 'bg-red-900/10 border-red-600' : 'bg-neutral-900/50 border-neutral-800'}`}>
                <div className="flex items-center justify-between mb-4">
                    <h3 className={`font-bold ${settings.global_pause === "true" ? 'text-red-500' : 'text-white'}`}>GLOBAL PAUSE</h3>
                    <PauseCircle className={settings.global_pause === "true" ? 'text-red-500' : 'text-neutral-600'} />
                </div>
                <div className="flex items-center gap-4">
                     <button 
                        onClick={() => handleSaveConfig("global_pause", settings.global_pause === "true" ? "false" : "true")}
                        className={`flex-1 py-2 rounded font-bold text-xs uppercase tracking-wider ${
                            settings.global_pause === "true" 
                            ? 'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/50' 
                            : 'bg-green-600 hover:bg-green-500 text-white'
                        }`}
                     >
                        {settings.global_pause === "true" ? "RESUME SYSTEM" : "SYSTEM ACTIVE"}
                     </button>
                </div>
                {settings.global_pause === "true" && (
                    <div className="mt-4">
                        <ConfigInput label="Maintenance Message" confKey="global_pause_message" value={settings.global_pause_message} onChange={handleChange} onSave={handleSaveConfig} saving={saving} />
                    </div>
                )}
            </div>

            {/* AI ENGINE */}
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-2">
                    <Activity size={18} className="text-purple-400" />
                    <h3 className="font-bold text-white">AI Engine</h3>
                </div>
                <ConfigInput label="OpenAI Model" confKey="openai_model" value={settings.openai_model} onChange={handleChange} onSave={handleSaveConfig} saving={saving} placeholder="gpt-4o-mini" />
                
                {/* Fixed Layout for Numbers */}
                <div className="grid grid-cols-2 gap-4">
                    <ConfigInput label="Max Calls" confKey="rate_limit_calls" type="number" value={settings.rate_limit_calls} onChange={handleChange} onSave={handleSaveConfig} saving={saving} />
                    <ConfigInput label="Period (Sec)" confKey="rate_limit_period" type="number" value={settings.rate_limit_period} onChange={handleChange} onSave={handleSaveConfig} saving={saving} />
                </div>
            </div>

        </div>

        {/* COL 2: NOTIFICATIONS */}
        <div className="space-y-6">
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <div className="flex items-center justify-between mb-4 border-b border-neutral-800 pb-2">
                    <div className="flex items-center gap-2">
                        <Mail size={18} className="text-yellow-400" />
                        <h3 className="font-bold text-white">Email Config</h3>
                    </div>
                    <button onClick={() => handleTestNotification('smtp')} className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-gray-300 px-2 py-1 rounded flex items-center gap-1">
                        <Send size={10} /> Test
                    </button>
                </div>
                <ConfigInput label="Sender (From)" confKey="smtp_from_email" value={settings.smtp_from_email} onChange={handleChange} onSave={handleSaveConfig} saving={saving} />
                <ConfigInput label="Recipient (To)" confKey="admin_alert_email" value={settings.admin_alert_email} onChange={handleChange} onSave={handleSaveConfig} saving={saving} />
            </div>

            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-2">
                    <ShieldAlert size={18} className="text-blue-400" />
                    <h3 className="font-bold text-white">Alert Rules</h3>
                </div>
                
                <div className="space-y-4">
                    {/* RULE ROW: Rate Limit */}
                    <div className="bg-black/40 p-3 rounded border border-neutral-800">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs font-bold text-white">Rate Limit Hit</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <ToggleCell eventType="rate_limit" channel="smtp" label="Email" rules={rules} onToggle={handleToggleRule} />
                            <ToggleCell eventType="rate_limit" channel="discord" label="Discord" rules={rules} onToggle={handleToggleRule} />
                            <ToggleCell eventType="rate_limit" channel="slack" label="Slack" rules={rules} onToggle={handleToggleRule} />
                        </div>
                    </div>

                    {/* RULE ROW: System Error */}
                    <div className="bg-black/40 p-3 rounded border border-neutral-800">
                        <span className="text-xs font-bold text-white block mb-2">System Error (500)</span>
                        <div className="flex flex-wrap gap-2">
                            <ToggleCell eventType="error" channel="smtp" label="Email" rules={rules} onToggle={handleToggleRule} />
                            <ToggleCell eventType="error" channel="discord" label="Discord" rules={rules} onToggle={handleToggleRule} />
                            <ToggleCell eventType="error" channel="slack" label="Slack" rules={rules} onToggle={handleToggleRule} />
                        </div>
                    </div>
                </div>
                
                {/* Test Buttons for Webhooks */}
                <div className="mt-4 flex gap-2 justify-end border-t border-neutral-800 pt-3">
                     <button onClick={() => handleTestNotification('discord')} className="text-[10px] bg-[#5865F2]/20 text-[#5865F2] border border-[#5865F2]/50 hover:bg-[#5865F2]/30 px-2 py-1 rounded flex items-center gap-1">
                        <Zap size={10} /> Test Discord
                    </button>
                    <button onClick={() => handleTestNotification('slack')} className="text-[10px] bg-[#E01E5A]/20 text-[#E01E5A] border border-[#E01E5A]/50 hover:bg-[#E01E5A]/30 px-2 py-1 rounded flex items-center gap-1">
                        <Zap size={10} /> Test Slack
                    </button>
                </div>
            </div>
        </div>

        {/* COL 3: USAGE & INFO */}
        <div className="space-y-6">
            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <div className="flex items-center gap-2 mb-4 border-b border-neutral-800 pb-2">
                    <Server size={18} className="text-green-400" />
                    <h3 className="font-bold text-white">Cost Center</h3>
                </div>
                
                <div className="space-y-4">
                    <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-bold">Total AI Requests</span>
                        <p className="text-3xl font-mono text-white">{usage.ai_calls}</p>
                    </div>
                    <div>
                        <span className="text-[10px] text-neutral-500 uppercase font-bold">Total Tokens Consumed</span>
                        <p className="text-3xl font-mono text-green-400">{usage.total_tokens.toLocaleString()}</p>
                    </div>
                    <div className="bg-neutral-950 p-3 rounded text-[10px] text-neutral-400 border border-neutral-800">
                        <p>Estimated Cost (GPT-4o-mini):</p>
                        <p className="text-lg text-white font-bold">
                            ${((usage.total_tokens / 1000000) * 0.15).toFixed(4)}
                        </p>
                    </div>
                </div>
            </div>

            <div className="p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl">
                <ConfigInput label="Log Timezone" confKey="app_timezone" value={settings.app_timezone} onChange={handleChange} onSave={handleSaveConfig} saving={saving} placeholder="UTC" />
            </div>
        </div>

      </div>
    </AdminLayout>
  );
};

export default Settings;