import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import zainnLogo from "@/assets/zainn-logo.png";

export default function Splash() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [animationPhase, setAnimationPhase] = useState(0);

  useEffect(() => {
    // Animation sequence: fade in -> scale -> pause -> fade out
    const timer1 = setTimeout(() => setAnimationPhase(1), 100); // Start fade in
    const timer2 = setTimeout(() => setAnimationPhase(2), 800); // Scale up
    const timer3 = setTimeout(() => setAnimationPhase(3), 1800); // Fade out

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    const timer = setTimeout(() => {
      if (!user) {
        navigate("/auth", { replace: true });
      } else if (role === "admin") {
        navigate("/admin", { replace: true });
      } else {
        navigate("/employee", { replace: true });
      }
    }, 2500);

    return () => clearTimeout(timer);
  }, [user, role, loading, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center gradient-hero overflow-hidden">
      <div 
        className={`text-center transition-all duration-700 ease-out ${
          animationPhase === 0 
            ? 'opacity-0 scale-90' 
            : animationPhase === 1 
            ? 'opacity-100 scale-95' 
            : animationPhase === 2 
            ? 'opacity-100 scale-100' 
            : 'opacity-0 scale-105'
        }`}
      >
        <div className="relative inline-flex items-center justify-center">
          {/* Animated glow rings */}
          <div 
            className={`absolute h-40 w-40 rounded-3xl border-2 border-white/10 transition-all duration-1000 ${
              animationPhase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
            style={{ animationDelay: "0.2s" }}
          />
          <div 
            className={`absolute h-36 w-36 rounded-3xl border border-white/20 transition-all duration-700 ${
              animationPhase >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
            }`}
          />
          
          {/* Pulsing glow background */}
          <div 
            className={`absolute h-32 w-32 rounded-2xl bg-primary/30 blur-xl transition-opacity duration-500 ${
              animationPhase >= 1 ? 'animate-pulse-soft' : 'opacity-0'
            }`}
          />
          
          {/* Logo Container */}
          <div 
            className={`relative h-28 w-28 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center shadow-2xl overflow-hidden transition-all duration-500 ${
              animationPhase >= 2 ? 'shadow-glow' : ''
            }`}
          >
            <img 
              src={zainnLogo} 
              alt="Zainn Logo" 
              className="h-24 w-24 object-contain"
            />
          </div>
        </div>

        <h1 
          className={`mt-8 text-4xl font-bold text-white tracking-tight transition-all duration-500 delay-300 ${
            animationPhase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Zainn
        </h1>
        <p 
          className={`mt-2 text-lg text-white/70 transition-all duration-500 delay-500 ${
            animationPhase >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          Workforce Management
        </p>

        {/* Loading indicator */}
        <div 
          className={`mt-8 flex justify-center transition-opacity duration-500 delay-700 ${
            animationPhase >= 1 ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <div className="flex gap-1.5">
            <div className="h-2 w-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "0ms" }} />
            <div className="h-2 w-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "150ms" }} />
            <div className="h-2 w-2 rounded-full bg-white/60 animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
