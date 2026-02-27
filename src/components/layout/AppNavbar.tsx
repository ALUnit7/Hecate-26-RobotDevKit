import { Link, useLocation } from "react-router-dom";
import { FiArrowLeft, FiHome } from "react-icons/fi";

export function AppNavbar() {
  const location = useLocation();
  const isHome = location.pathname === "/";

  return (
    <div className="h-10 flex items-center px-3 bg-zinc-900 border-b border-zinc-800 shrink-0">
      {!isHome && (
        <Link
          to="/"
          className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200 transition-colors mr-3"
        >
          <FiArrowLeft className="w-3.5 h-3.5" />
          <FiHome className="w-3.5 h-3.5" />
        </Link>
      )}
      <span className="text-xs font-semibold text-zinc-300 tracking-wide">
        H26RDK
      </span>
      {!isHome && (
        <span className="text-xs text-zinc-600 ml-2">
          / {location.pathname.slice(1).replace(/-/g, " ")}
        </span>
      )}
    </div>
  );
}
