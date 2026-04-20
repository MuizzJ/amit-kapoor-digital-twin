'use client'

import { useState, useEffect } from 'react'

const navLinks = ['Essays', 'Books', 'Speaking', 'About']

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <nav
      className={`sticky top-0 z-50 bg-white transition-shadow duration-300 ${
        scrolled ? 'shadow-sm' : ''
      } border-b border-gray-200`}
    >
      <div className="flex justify-between items-center px-8 md:px-16 py-4">
        {/* Logo */}
        <div>
          <span className="text-sm md:text-base font-black tracking-[-0.5px] text-[#0a0a0a] uppercase">
            Dr. Amit Kapoor
          </span>
          <p className="text-[9px] text-gray-400 tracking-[3px] mt-0.5 uppercase hidden md:block">
            Economist · Strategist · Author
          </p>
        </div>

        {/* Desktop Nav */}
        <div className="hidden md:flex items-center gap-8">
          {navLinks.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              className="text-[11px] tracking-[1.5px] text-gray-500 hover:text-accent uppercase transition-colors duration-150 font-medium"
            >
              {item}
            </a>
          ))}
          <a
            href="mailto:amit@amitkapoor.com"
            className="bg-accent text-white text-[11px] tracking-[1.5px] uppercase px-5 py-2.5 hover:bg-[#0a0a0a] transition-colors duration-200 font-semibold"
          >
            Contact
          </a>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden flex flex-col gap-1.5 p-1"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          <span className={`block w-6 h-0.5 bg-[#0a0a0a] transition-all duration-200 ${menuOpen ? 'rotate-45 translate-y-2' : ''}`} />
          <span className={`block w-6 h-0.5 bg-[#0a0a0a] transition-all duration-200 ${menuOpen ? 'opacity-0' : ''}`} />
          <span className={`block w-6 h-0.5 bg-[#0a0a0a] transition-all duration-200 ${menuOpen ? '-rotate-45 -translate-y-2' : ''}`} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-gray-100 px-8 py-4 flex flex-col gap-4">
          {navLinks.map((item) => (
            <a
              key={item}
              href={`#${item.toLowerCase()}`}
              onClick={() => setMenuOpen(false)}
              className="text-sm tracking-[1.5px] text-gray-600 uppercase font-medium"
            >
              {item}
            </a>
          ))}
          <a
            href="mailto:amit@amitkapoor.com"
            className="bg-accent text-white text-xs tracking-[1.5px] uppercase px-4 py-3 text-center font-semibold"
          >
            Contact
          </a>
        </div>
      )}
    </nav>
  )
}
