import React from 'react'
import Navbar from '@/components/Navbar'
import VoiceWidget from '@/components/VoiceWidget'

const featuredEssay = {
  title: "Recalibrating India's National Accounts",
  excerpt:
    "A deep dive into how India measures growth — and why the methodology matters for policy decisions in a rapidly evolving economy.",
  category: 'ECONOMICS',
  date: 'APR 2026',
  readTime: '12 min read',
  image: 'https://amitkapoor.com/wp-content/uploads/2026/04/Recalibrating_Indias_Accounts-480x270.jpg',
  href: 'https://amitkapoor.com/recalibrating-indias-national-accounts/',
}

const essays = [
  {
    title: "AI Growth Beyond Metros",
    category: 'TECHNOLOGY',
    date: 'Mar 2026',
    readTime: '8 min',
    excerpt: 'How artificial intelligence is reshaping the competitiveness landscape for emerging economies.',
    image: 'https://amitkapoor.com/wp-content/uploads/2026/03/AI_Growth_Beyond_metros-480x270.jpeg',
    href: 'https://amitkapoor.com/ai-growth-beyond-metros/',
  },
  {
    title: "Indian Cities Don't Lack Infrastructure",
    category: 'URBAN POLICY',
    date: 'Mar 2026',
    readTime: '6 min',
    excerpt: "India's secondary cities are the engine of tomorrow's growth — if we invest in them today.",
    image: 'https://amitkapoor.com/wp-content/uploads/2026/03/Indian_Cities_dont_lack_infra-480x270.jpg',
    href: 'https://amitkapoor.com/indian-cities-dont-lack-infra/',
  },
  {
    title: 'AI in Indian Agriculture',
    category: 'AGRICULTURE',
    date: 'Mar 2026',
    readTime: '10 min',
    excerpt: 'Structural reforms needed to unlock productivity gains and improve farmer livelihoods.',
    image: 'https://amitkapoor.com/wp-content/uploads/2026/03/AI_in_Indian_Agriculture-480x270.jpg',
    href: 'https://amitkapoor.com/ai-in-indian-agriculture/',
  },
  {
    title: 'Mind the Capital Gap',
    category: 'ECONOMICS',
    date: 'Mar 2026',
    readTime: '7 min',
    excerpt: "Understanding the structural capital deficit that constrains India's growth potential.",
    image: 'https://amitkapoor.com/wp-content/uploads/2026/03/Mind_the_capital_gap-480x270.jpg',
    href: 'https://amitkapoor.com/mind-the-capital-gap/',
  },
  {
    title: 'Climate: The Double-Edged Sword',
    category: 'CLIMATE',
    date: 'Mar 2026',
    readTime: '9 min',
    excerpt: 'Why climate change presents both a crisis and a competitive opportunity for India.',
    image: 'https://amitkapoor.com/wp-content/uploads/2026/03/Climate_Double_Edge_Sword-480x270.jpg',
    href: 'https://amitkapoor.com/climate-the-double-edged-sword/',
  },
  {
    title: "Why Social Progress Will Define India's Next Decade",
    category: 'SOCIAL POLICY',
    date: 'Mar 2026',
    readTime: '11 min',
    excerpt: 'Moving beyond GDP as the sole measure of national success.',
    image: 'https://amitkapoor.com/wp-content/uploads/2026/03/Why_Social_Progress_will_Define-480x270.jpg',
    href: 'https://amitkapoor.com/why-social-progress-will-define-indias-next-decade/',
  },
]

const books = [
  {
    title: 'The Age of Awakening',
    subtitle: "The story of the Indian economy since Independence — a sweeping account of growth, policy, and transformation.",
    cover: 'https://competitiveness.in/wp-content/uploads/2018/09/The_age_of_awakening-1038x1011.jpg',
    href: 'https://competitiveness.in/the-age-of-awakening',
    publisher: 'Penguin Random House',
  },
  {
    title: 'Riding the Tiger',
    subtitle: 'A strategic guide to competitiveness for emerging market leaders and policymakers.',
    cover: 'https://covers.openlibrary.org/b/id/14513231-L.jpg',
    href: 'https://amitkapoor.com',
    publisher: 'Bloomsbury',
  },
  {
    title: 'Making of New India',
    subtitle: 'Transformation under the Modi Government — a multi-author account of policy and progress.',
    cover: null,
    coverStyle: { background: 'linear-gradient(160deg,#1a237e 0%,#283593 60%,#e65100 100%)' },
    coverText: 'MAKING OF NEW INDIA',
    href: 'https://amitkapoor.com',
    publisher: 'Wisdom Tree',
  },
]

const affiliations = [
  {
    name: 'Future of States',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/fos-logo-color-672x261.jpg',
    href: 'https://futureofstates.in',
  },
  {
    name: 'Institute for Competitiveness',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/IFC_Logo-672x241.jpg',
    href: 'https://competitiveness.in',
  },
  {
    name: 'India Council on Competitiveness',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/indian_council_on_competitiveness.png',
    href: 'https://compete.org.in',
  },
  {
    name: 'Social Progress India',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/SPI_logo.jpg',
    href: 'https://socialprogress.in',
  },
  {
    name: 'Porter Prize',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/PorterPrize.png',
    href: 'https://porterprize.in',
  },
  {
    name: 'Thinkers',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/Thinkers_Logo-300x54.jpg',
    href: 'https://thinkers.in',
  },
  {
    name: 'Bike IT',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/BikeIT-672x448.jpg',
    href: 'https://bikeit.in',
  },
  {
    name: 'Shared Value Initiative India',
    logo: 'https://amitkapoor.com/wp-content/uploads/2016/01/SVII_Logo.jpg',
    href: 'https://sharedvalue.in',
  },
]

const speaking = [
  { venue: 'Kennedy School of Government', location: 'Harvard', year: '2025' },
  { venue: 'World Economic Forum', location: 'Davos', year: '2025' },
  { venue: 'Stanford Graduate School of Business', location: 'Palo Alto', year: '2024' },
  { venue: 'India Economic Summit', location: 'New Delhi', year: '2024' },
]

export default function Home() {
  return (
    <main className="min-h-screen bg-white">
      <Navbar />

      {/* ── HERO ── */}
      <section className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] min-h-[520px] border-b border-gray-200">
        <div className="flex flex-col justify-center px-8 md:px-16 py-16 border-b md:border-b-0 md:border-r border-gray-200">
          <p className="text-[10px] tracking-[4px] text-accent font-bold mb-8 uppercase">
            Harvard · Stanford · WEF · Thinkers50
          </p>
          <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-black leading-[0.95] tracking-tight text-[#0a0a0a] mb-8">
            The<br />
            Economics<br />
            of{' '}
            <span className="text-accent italic underline decoration-accent decoration-[3px] underline-offset-4">
              Tomorrow,
            </span>
            <br />
            Today.
          </h1>
          <p className="text-sm md:text-base text-gray-500 max-w-sm leading-relaxed mb-10 font-light">
            Author of <em>The Age of Awakening</em> and <em>Riding the Tiger</em>. Researching
            competitiveness, social progress, and India&apos;s economic future.
          </p>
          <div className="flex flex-wrap gap-4">
            <a
              href="#essays"
              className="bg-[#0a0a0a] text-white text-[11px] tracking-[2px] uppercase px-6 py-3 hover:bg-accent transition-colors duration-200 font-semibold"
            >
              Read Essays
            </a>
            <a
              href="#books"
              className="border border-accent text-accent text-[11px] tracking-[2px] uppercase px-6 py-3 hover:bg-accent hover:text-white transition-colors duration-200 font-semibold"
            >
              View Books
            </a>
          </div>
        </div>

        {/* Featured essay — right dark panel */}
        <a
          href={featuredEssay.href}
          target="_blank"
          rel="noopener noreferrer"
          className="group bg-[#0a0a0a] flex flex-col justify-between px-8 md:px-12 py-12 hover:bg-[#111] transition-colors duration-200"
        >
          <p className="text-[10px] tracking-[3px] text-accent uppercase font-bold">Featured Essay</p>
          <div className="my-6">
            {/* Thumbnail */}
            <div className="relative w-full h-40 mb-5 overflow-hidden">
              <img
                src={featuredEssay.image}
                alt={featuredEssay.title}
                className="w-full h-full object-cover opacity-70 group-hover:opacity-90 group-hover:scale-105 transition-all duration-500"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
              <span className="absolute bottom-3 left-0 text-[10px] tracking-[2px] text-accent/80 uppercase font-bold px-0">
                {featuredEssay.category}
              </span>
            </div>
            <h2 className="font-display text-xl md:text-2xl font-bold text-white leading-tight mb-3 group-hover:text-accent transition-colors duration-200">
              {featuredEssay.title}
            </h2>
            <p className="text-xs text-gray-400 leading-relaxed">{featuredEssay.excerpt}</p>
          </div>
          <div className="flex justify-between items-center pt-5 border-t border-white/10">
            <span className="text-[10px] text-gray-600 tracking-[2px] uppercase">
              {featuredEssay.date} · {featuredEssay.readTime}
            </span>
            <span className="text-[11px] tracking-[2px] text-accent uppercase font-semibold group-hover:text-white transition-colors">
              Read →
            </span>
          </div>
        </a>
      </section>

      {/* ── LATEST ESSAYS ── */}
      <section id="essays" className="px-8 md:px-16 py-16">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[11px] tracking-[4px] text-accent font-bold uppercase">Latest Essays</h2>
          <a
            href="https://amitkapoor.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] tracking-[2px] text-gray-400 uppercase hover:text-[#0a0a0a] transition-colors font-medium"
          >
            View All →
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-gray-100">
          {essays.map((essay, i) => (
            <a
              key={i}
              href={essay.href}
              target="_blank"
              rel="noopener noreferrer"
              className="essay-card group cursor-pointer bg-white hover:bg-gray-50 transition-colors duration-200 flex flex-col"
            >
              {/* Thumbnail */}
              <div className="relative h-44 overflow-hidden">
                <img
                  src={essay.image}
                  alt={essay.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
              {/* Content */}
              <div className="p-6 flex flex-col flex-1">
                <p className="text-[10px] tracking-[2px] text-accent font-bold uppercase mb-3">
                  {essay.category}
                </p>
                <h3 className="font-display text-base font-bold text-[#0a0a0a] leading-tight group-hover:text-accent transition-colors duration-200 mb-3 flex-1">
                  {essay.title}
                </h3>
                <p className="text-xs text-gray-400 leading-relaxed mb-5 line-clamp-2">{essay.excerpt}</p>
                <div className="flex justify-between items-center mt-auto">
                  <span className="text-[10px] text-gray-400 tracking-[1px]">{essay.date}</span>
                  <span className="text-[10px] text-gray-400">{essay.readTime}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── BOOKS ── */}
      <section id="books" className="bg-gray-50 px-8 md:px-16 py-14 border-t border-gray-200">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[11px] tracking-[4px] text-accent font-bold uppercase">Books</h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {books.map((book, i) => (
            <a
              key={i}
              href={book.href}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex gap-5 items-start bg-white p-5 border border-gray-100 hover:border-accent/30 hover:shadow-md transition-all duration-200"
            >
              {/* Cover image */}
              <div className="flex-shrink-0 w-20 h-28 shadow-lg overflow-hidden">
                {book.cover ? (
                  <img
                    src={book.cover}
                    alt={book.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div
                    className="w-full h-full flex items-end justify-center p-2"
                    style={book.coverStyle as React.CSSProperties}
                  >
                    <span className="text-white text-[8px] font-bold text-center leading-tight tracking-wide">
                      {book.coverText}
                    </span>
                  </div>
                )}
              </div>
              {/* Info */}
              <div className="flex flex-col">
                <p className="text-[9px] tracking-[2px] text-gray-400 uppercase mb-1">{book.publisher}</p>
                <h3 className="font-display font-bold text-[#0a0a0a] text-sm leading-snug group-hover:text-accent transition-colors mb-2">
                  {book.title}
                </h3>
                <p className="text-[11px] text-gray-400 leading-relaxed mb-4 line-clamp-3">
                  {book.subtitle}
                </p>
                <span className="mt-auto text-[10px] tracking-[1.5px] text-accent uppercase font-semibold group-hover:text-[#0a0a0a] transition-colors">
                  Order →
                </span>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* ── SPEAKING ── */}
      <section id="speaking" className="px-8 md:px-16 py-14 border-t border-gray-200">
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-[11px] tracking-[4px] text-accent font-bold uppercase">Speaking</h2>
          <a
            href="mailto:amit@amitkapoor.com"
            className="text-[11px] tracking-[2px] text-gray-400 uppercase hover:text-[#0a0a0a] transition-colors font-medium"
          >
            Book Amit →
          </a>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-gray-100">
          {speaking.map((s, i) => (
            <div key={i} className="bg-white p-6 hover:bg-gray-50 transition-colors">
              <p className="text-[10px] tracking-[2px] text-gray-400 uppercase mb-2">{s.year}</p>
              <p className="font-display font-bold text-sm text-[#0a0a0a] leading-snug mb-1">{s.venue}</p>
              <p className="text-xs text-gray-400">{s.location}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── ABOUT ── */}
      <section id="about" className="bg-[#0a0a0a] px-8 md:px-16 py-16 border-t border-gray-900">
        <div className="max-w-3xl">
          <h2 className="text-[11px] tracking-[4px] text-accent font-bold uppercase mb-8">About</h2>
          <p className="font-display text-2xl md:text-3xl font-bold text-white leading-tight mb-6">
            Dr. Amit Kapoor is an economist, strategist, and thought leader in competitiveness and
            social progress.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed mb-4">
            He is the Honorary Chairman of the Institute for Competitiveness, India, and teaches
            at Harvard Business School, the Indian School of Business, and XLRI. His work spans
            economic competitiveness, social progress, and data-driven policy.
          </p>
          <p className="text-sm text-gray-400 leading-relaxed mb-8">
            Recognised by Thinkers50 as one of the most influential business thinkers, Amit has
            advised governments, corporations, and international organisations on strategy and
            competitiveness across more than 30 countries.
          </p>
          <a
            href="mailto:amit@amitkapoor.com"
            className="inline-block bg-accent text-white text-[11px] tracking-[2px] uppercase px-6 py-3 hover:bg-white hover:text-[#0a0a0a] transition-colors duration-200 font-semibold"
          >
            Get in Touch
          </a>
        </div>
      </section>

      {/* ── AFFILIATED ORGANISATIONS (logos) ── */}
      <section className="px-8 md:px-16 py-14 border-t border-gray-200">
        <h2 className="text-[11px] tracking-[4px] text-accent font-bold uppercase mb-10">
          Affiliated Organisations
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-8 gap-8 items-center">
          {affiliations.map((org, i) => (
            <a
              key={i}
              href={org.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center grayscale hover:grayscale-0 opacity-60 hover:opacity-100 transition-all duration-300"
              title={org.name}
            >
              <img
                src={org.logo}
                alt={org.name}
                className="max-h-12 max-w-full object-contain"
              />
            </a>
          ))}
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#0a0a0a] px-8 md:px-16 py-8 border-t border-white/5">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="font-display font-bold text-white text-lg tracking-tight">
              Dr. Amit Kapoor
            </span>
            <p className="text-[10px] text-gray-600 mt-1 tracking-[2px] uppercase">
              Economist · Strategist · Author
            </p>
          </div>
          <div className="flex flex-col md:flex-row gap-2 md:gap-8 text-[10px] text-gray-600 tracking-[1px]">
            <a href="mailto:amit@amitkapoor.com" className="hover:text-accent transition-colors">
              amit@amitkapoor.com
            </a>
            <a
              href="https://twitter.com/kautiliya"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-accent transition-colors"
            >
              @kautiliya
            </a>
            <span>© 2026 Amit Kapoor</span>
          </div>
        </div>
      </footer>

      {/* Voice Agent Widgets */}
      <VoiceWidget />
    </main>
  )
}
