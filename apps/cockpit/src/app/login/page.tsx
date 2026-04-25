import { GoogleSignInButton } from "@/components/google-sign-in-button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen">
      {/* ── Left panel: product illustration ── */}
      <div className="relative hidden lg:flex lg:w-1/2 flex-col overflow-hidden bg-[#08090d]">
        {/* Grid */}
        <div className="absolute inset-0"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
              linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)`,
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full bg-indigo-600/20 blur-[80px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-56 h-56 rounded-full bg-emerald-500/15 blur-[60px] pointer-events-none" />

        {/* Logo */}
        <div className="relative z-10 p-10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
              <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
                <rect x="2" y="2" width="5" height="5" rx="1" fill="white" />
                <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.5" />
                <rect x="9" y="9" width="5" height="5" rx="1" fill="white" />
              </svg>
            </div>
            <span className="text-white font-semibold tracking-tight text-sm">SaaS Maker</span>
          </div>
        </div>

        {/* Floating cards */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-10">
          <div className="relative w-full max-w-xs">

            {/* Feedback card */}
            <div className="absolute -top-20 -left-4 w-56 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-2xl"
              style={{ animation: "floatA 6s ease-in-out infinite" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Feedback</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </div>
              <p className="text-xs text-white/70 mb-3 leading-relaxed">"Dark mode would be a killer feature for power users…"</p>
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 rounded-full bg-indigo-500/40 text-[9px] text-white flex items-center justify-center font-medium">A</div>
                <span className="text-[11px] text-white/40">alex@acme.io · feature</span>
              </div>
            </div>

            {/* Analytics card */}
            <div className="absolute -top-4 right-0 w-48 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-2xl"
              style={{ animation: "floatB 7s ease-in-out infinite" }}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Analytics</span>
              </div>
              <div className="flex items-end gap-1 h-12">
                {[30, 55, 40, 70, 50, 85, 65].map((h, i) => (
                  <div key={i} className="flex-1 rounded-sm bg-indigo-500/40"
                    style={{ height: `${h}%`, opacity: i === 5 ? 1 : 0.5 + i * 0.08 }} />
                ))}
              </div>
              <p className="text-[10px] text-emerald-400 mt-2">↑ 24% this week</p>
            </div>

            {/* Waitlist card */}
            <div className="absolute top-28 -left-8 w-44 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-2xl"
              style={{ animation: "floatC 5.5s ease-in-out infinite" }}>
              <span className="text-xs font-medium text-white/50 uppercase tracking-wider">Waitlist</span>
              <div className="mt-2">
                <span className="text-3xl font-bold text-white">2,847</span>
              </div>
              <div className="flex -space-x-1.5 mt-2">
                {["#6366f1","#10b981","#f59e0b","#ef4444"].map((c, i) => (
                  <div key={i} className="w-5 h-5 rounded-full border border-white/10" style={{ background: c }} />
                ))}
                <div className="w-5 h-5 rounded-full border border-white/10 bg-white/10 text-[8px] text-white flex items-center justify-center">+</div>
              </div>
            </div>

            {/* Testimonial card */}
            <div className="absolute top-36 right-2 w-52 rounded-xl border border-white/10 bg-white/5 backdrop-blur-sm p-4 shadow-2xl"
              style={{ animation: "floatD 8s ease-in-out infinite" }}>
              <div className="flex gap-0.5 mb-2">
                {[1,2,3,4,5].map(i => (
                  <svg key={i} className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <p className="text-[11px] text-white/70 leading-relaxed">"Saved us weeks of backend work. Plug and play."</p>
              <p className="text-[10px] text-white/30 mt-2">— Maria S., Founder</p>
            </div>

            {/* Changelog pill */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm px-4 py-2 shadow-xl flex items-center gap-2"
              style={{ animation: "floatA 6.5s ease-in-out infinite 1s" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
              <span className="text-[11px] text-white/60">v2.1.0 shipped — Vector search</span>
            </div>

          </div>
        </div>

        {/* Bottom tagline */}
        <div className="relative z-10 p-10 pb-12">
          <p className="text-2xl font-semibold text-white leading-tight tracking-tight">
            The backend you<br />
            <span className="text-indigo-400">never have to build.</span>
          </p>
          <p className="text-sm text-white/40 mt-2">
            Feedback · Waitlist · Testimonials · Analytics
          </p>
        </div>

        {/* CSS animations */}
        <style>{`
          @keyframes floatA {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-10px); }
          }
          @keyframes floatB {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-14px); }
          }
          @keyframes floatC {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-8px); }
          }
          @keyframes floatD {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-12px); }
          }
        `}</style>
      </div>

      {/* ── Right panel: login ── */}
      <div className="flex w-full lg:w-1/2 flex-col items-center justify-center bg-white dark:bg-[#08090d] px-8">
        {/* Mobile logo */}
        <div className="lg:hidden mb-10 flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-indigo-500 flex items-center justify-center">
            <svg viewBox="0 0 16 16" fill="none" className="w-4 h-4">
              <rect x="2" y="2" width="5" height="5" rx="1" fill="white" />
              <rect x="9" y="2" width="5" height="5" rx="1" fill="white" opacity="0.5" />
              <rect x="2" y="9" width="5" height="5" rx="1" fill="white" opacity="0.5" />
              <rect x="9" y="9" width="5" height="5" rx="1" fill="white" />
            </svg>
          </div>
          <span className="font-semibold tracking-tight text-sm">SaaS Maker</span>
        </div>

        <div className="w-full max-w-sm text-center">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
            Welcome back
          </h1>
          <p className="mt-2 text-sm text-gray-500 dark:text-white/40">
            Sign in to your dashboard
          </p>

          <div className="mt-8">
            <GoogleSignInButton />
          </div>

          <p className="mt-6 text-xs text-gray-400 dark:text-white/20">
            By signing in you agree to our{" "}
            <a href="https://sassmaker.com/terms" className="underline hover:text-gray-600 dark:hover:text-white/40">Terms</a>
            {" "}and{" "}
            <a href="https://sassmaker.com/privacy" className="underline hover:text-gray-600 dark:hover:text-white/40">Privacy Policy</a>
          </p>
        </div>
      </div>
    </div>
  );
}
