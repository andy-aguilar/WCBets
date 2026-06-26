import { NavLink, Outlet } from "react-router-dom";

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="brand-lockup">
          <p className="eyebrow">ATLAS beta</p>
          <span className="brand-subtitle">
            Adaptive Team-strength and Lineup Analysis for Soccer
          </span>
        </div>
        <nav className="top-nav">
          <NavLink
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link--active" : ""}`
            }
            to="/"
          >
            Bets
          </NavLink>
          <NavLink
            className={({ isActive }) =>
              `nav-link${isActive ? " nav-link--active" : ""}`
            }
            to="/ecuador-path"
          >
            Ecuador Path
          </NavLink>
        </nav>
      </header>

      <Outlet />
    </div>
  );
}
