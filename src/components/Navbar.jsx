
import React from 'react';
import { Link, useLocation } from 'react-router-dom';

function Navbar() {
  const location = useLocation();

  return (
    <nav>
      <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>
        Dashboard
      </Link>
      <Link to="/typy-ai" className={location.pathname === '/typy-ai' ? 'active' : ''}>
        Typy AI
      </Link>
      <Link to="/statystyki" className={location.pathname === '/statystyki' ? 'active' : ''}>
        Statystyki
      </Link>
      <Link to="/blog" className={location.pathname === '/blog' ? 'active' : ''}>
        Blog
      </Link> {/* Link to Blog with active class */}
    </nav>
  );
}

export default Navbar;
