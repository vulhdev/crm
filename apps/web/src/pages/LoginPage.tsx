export function LoginPage() {
  return (
    <div className="flex h-screen">
      {/* Left panel — dark brand */}
      <div
        className="hidden md:flex flex-1 flex-col bg-[#0D1F2D] p-10 justify-between"
        style={{
          backgroundImage:
            "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-1 w-8 h-8">
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={`rounded-sm ${i === 0 || i === 3 ? "bg-[#1A7A6E]" : "bg-[#1A7A6E]/40"}`}
              />
            ))}
          </div>
          <span
            className="text-[#F7F6F3] font-semibold text-sm"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            CRM Platform
          </span>
        </div>

        {/* Tagline */}
        <div>
          <p
            className="text-3xl font-bold text-white/70 leading-snug"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Every customer relationship,
            <br />
            in one place.
          </p>
          <div className="flex gap-2 mt-6">
            {[40, 24, 16].map((w) => (
              <div
                key={w}
                className="h-0.5 bg-[#1A7A6E]"
                style={{ width: w }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Right panel — sign-in */}
      <div className="flex flex-1 items-center justify-center bg-[#F7F6F3]">
        <div className="w-full max-w-[380px] px-6">
          {/* Heading */}
          <h1
            className="fade-up text-[28px] font-bold text-[#141210]"
            style={{
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              animationDelay: "0ms",
            }}
          >
            CRM Platform
          </h1>

          {/* Subtitle */}
          <p
            className="fade-up text-sm text-[#6B6560] mt-2"
            style={{
              fontFamily: "'DM Sans', sans-serif",
              animationDelay: "80ms",
            }}
          >
            Sign in to manage your customers
          </p>

          {/* Google sign-in button */}
          <div className="mt-8">
            <button
              onClick={() => {
                window.location.href = "http://localhost:3000/auth/google";
              }}
              className="fade-up w-full flex items-center justify-center gap-3 h-12 px-4 bg-white border border-[#E2DED9] rounded-lg text-[#141210] text-sm font-medium hover:bg-[#F7F6F3] hover:border-[#1A7A6E] transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A7A6E]"
              style={{
                fontFamily: "'DM Sans', sans-serif",
                animationDelay: "160ms",
              }}
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Sign in with Google
            </button>
          </div>

          {/* Footer */}
          <p
            className="text-xs text-[#6B6560] text-center mt-6"
            style={{ fontFamily: "'DM Sans', sans-serif" }}
          >
            Terms of Service · Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
}
