import { useState, useEffect } from "react";
import { Lock, Eye, EyeOff, LogOut } from "lucide-react";

// Change this to your desired password
const APP_PASSWORD = "Godsjar";
const STORAGE_KEY = "ks-digital-os-auth";
const SESSION_HOURS = 24; // Auto-logout after this many hours

function isSessionValid(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return false;
    const { timestamp } = JSON.parse(stored);
    const elapsed = Date.now() - timestamp;
    return elapsed < SESSION_HOURS * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function setSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ timestamp: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

export function useAuth() {
  const [authenticated, setAuthenticated] = useState(() => isSessionValid());

  const logout = () => {
    clearSession();
    setAuthenticated(false);
  };

  const login = () => {
    setSession();
    setAuthenticated(true);
  };

  return { authenticated, login, logout };
}

interface AuthGateProps {
  onAuthenticated: () => void;
}

export function AuthGate({ onAuthenticated }: AuthGateProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState(false);
  const [shaking, setShaking] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === APP_PASSWORD) {
      setError(false);
      onAuthenticated();
    } else {
      setError(true);
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }
  };

  return (
    <div className="min-h-screen bg-[#faf9f6] flex items-center justify-center font-['Inter',sans-serif]">
      <div className="w-full max-w-[380px] px-6">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-[#2d4a3e] rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-lg">
            <Lock size={24} className="text-white/80" />
          </div>
          <h1 className="font-['Instrument_Serif'] text-[32px] text-[#2d4a3e] tracking-tight leading-none">
            Kind Supply Digital
          </h1>
          <p className="text-[13px] text-[#8a9e96] mt-1.5">Organization Sheet</p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit}>
          <div
            className={`relative mb-4 ${shaking ? "animate-[shake_0.5s_ease-in-out]" : ""}`}
          >
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError(false);
              }}
              placeholder="Enter password"
              autoFocus
              className={`w-full px-4 py-3 pr-11 text-[14px] rounded-xl border-2 bg-white focus:outline-none transition-colors ${
                error
                  ? "border-[#b86b5a] focus:border-[#b86b5a]"
                  : "border-[#e2e8e0] focus:border-[#4a7c6a]"
              }`}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8a9e96] hover:text-[#2d4a3e] transition-colors"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          {error && (
            <p className="text-[12px] text-[#b86b5a] mb-3 pl-1">
              Incorrect password. Try again.
            </p>
          )}

          <button
            type="submit"
            className="w-full py-3 bg-[#2d4a3e] text-white text-[14px] rounded-xl hover:bg-[#3d5a4e] transition-colors shadow-sm"
          >
            Unlock
          </button>
        </form>

        <p className="text-center text-[11px] text-[#8a9e96] mt-6">
          Session expires after {SESSION_HOURS} hours
        </p>
      </div>

      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `}</style>
    </div>
  );
}

export function LogoutButton({ onLogout }: { onLogout: () => void }) {
  return (
    <button
      onClick={onLogout}
      className="flex items-center gap-1.5 text-[12px] text-white/35 hover:text-white/70 transition-colors"
      title="Sign out"
    >
      <LogOut size={13} />
      Sign out
    </button>
  );
}
