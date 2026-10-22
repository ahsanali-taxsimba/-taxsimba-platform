/**
 * Shared public marketing chrome — top nav + footer for unauthenticated pages.
 * TODO(seo): add canonical URLs and Open Graph tags per page.
 */
import { Link } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

const WHATSAPP_URL = process.env.REACT_APP_WHATSAPP_URL || "";

export default function PublicChrome({ children, active = "who-we-are" }) {
  const { user } = useAuth();
  const home = user
    ? user.role === "CLIENT"
      ? "/dashboard"
      : user.role === "ACCOUNTANT"
        ? "/work"
        : "/admin"
    : "/login";

  return (
    <div className="min-h-screen flex flex-col bg-[#F7F8F7] text-[#161B18]" data-testid="public-chrome">
      <header className="sticky top-0 z-40 border-b border-[#E3E7E4]/80 bg-white/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-5 md:px-8 h-16 flex items-center justify-between gap-4">
          <Link
            to={home}
            data-testid="public-brand-link"
            className="font-heading text-xl font-extrabold tracking-tight text-[#006B3C]"
          >
            TaxSimba
          </Link>
          <nav className="flex items-center gap-1 sm:gap-2 text-sm font-semibold" aria-label="Main">
            <Link
              to="/who-we-are"
              data-testid="nav-who-we-are"
              className={`px-3 py-2 rounded-lg transition-colors ${
                active === "who-we-are"
                  ? "bg-[#EAF5EE] text-[#006B3C]"
                  : "text-[#626A65] hover:bg-[#F1F8F4] hover:text-[#161B18]"
              }`}
            >
              Who We Are
            </Link>
            {user ? (
              <Link
                to={home}
                data-testid="nav-back-app"
                className="px-3 py-2 rounded-lg text-[#006B3C] hover:bg-[#F1F8F4]"
              >
                Back to app
              </Link>
            ) : (
              <Link
                to="/login"
                data-testid="nav-sign-in"
                className="px-3 py-2 rounded-lg bg-[#078A4B] text-white hover:bg-[#006B3C] transition-colors"
              >
                Sign in
              </Link>
            )}
          </nav>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#E3E7E4] bg-white mt-auto" data-testid="public-footer">
        <div className="max-w-6xl mx-auto px-5 md:px-8 py-10 grid gap-8 sm:grid-cols-3 text-sm">
          <div>
            <div className="font-heading font-extrabold text-[#006B3C] text-lg">TaxSimba</div>
            <p className="text-[#626A65] mt-2 text-xs leading-relaxed">
              UK-based accountancy firm and UK accountancy software — accountants and technology,
              together.
            </p>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest font-semibold text-[#626A65] mb-3">
              Company
            </div>
            <ul className="space-y-2">
              <li>
                <Link to="/who-we-are" className="text-[#161B18] hover:text-[#006B3C] font-medium">
                  Who We Are
                </Link>
              </li>
              <li>
                <Link to="/about-us" className="text-[#161B18] hover:text-[#006B3C] font-medium">
                  About us
                </Link>
              </li>
              <li>
                <Link to="/login" className="text-[#161B18] hover:text-[#006B3C] font-medium">
                  Client login
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-widest font-semibold text-[#626A65] mb-3">
              Contact
            </div>
            <ul className="space-y-2">
              <li>
                <a
                  href="mailto:support@taxsimba.co.uk"
                  className="text-[#161B18] hover:text-[#006B3C] font-medium"
                >
                  support@taxsimba.co.uk
                </a>
              </li>
              {WHATSAPP_URL ? (
                <li>
                  <a
                    href={WHATSAPP_URL}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#161B18] hover:text-[#006B3C] font-medium"
                  >
                    WhatsApp support
                  </a>
                </li>
              ) : (
                <li className="text-[#626A65] text-xs">
                  {/* TODO(ops): set REACT_APP_WHATSAPP_URL for live WhatsApp link */}
                  WhatsApp — coming soon
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="border-t border-[#E3E7E4] px-5 md:px-8 py-4 text-center text-[11px] text-[#626A65]">
          © {new Date().getFullYear()} TaxSimba. UK accountants · UK software.
        </div>
      </footer>
    </div>
  );
}
