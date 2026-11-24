import { useEffect, useState } from "react";
import { Activity, Play, Pause } from "lucide-react";

const LINKS = [["pipeline", "Pipeline"], ["controls", "Controls"], ["lanes", "Lanes"], ["inspect", "Inspect"], ["charts", "Charts"], ["hardware", "Hardware"], ["sweep", "Sweep"]];

export const NavBar = ({ running, onToggle, sim }) => {
  const [active, setActive] = useState("pipeline");
  useEffect(() => {
    const onScroll = () => {
      const els = LINKS.map(([id]) => document.getElementById(id)).filter(Boolean);
      if (!els.length) return;
      const atBottom = window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4;
      let cur = els[0].id;
      for (const el of els) if (el.getBoundingClientRect().top <= 120) cur = el.id;
      setActive(atBottom ? els[els.length - 1].id : cur);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <nav className="rl-nav print-hide" data-testid="sticky-nav">
      <div className="max-w-[1500px] mx-auto px-4 sm:px-6 h-12 flex items-center gap-3">
        <a href="#pipeline" className="flex items-center gap-2 mono font-bold text-slate-50 shrink-0" data-testid="nav-brand">
          <Activity size={18} className="text-cyan-300" /> ResyncLab
        </a>
        <div className="flex-1 flex gap-1 overflow-x-auto no-scrollbar">
          {LINKS.map(([id, label]) => (
            <a key={id} href={`#${id}`} className={`nav-link ${active === id ? "on" : ""}`} data-testid={`nav-link-${id}`}>{label}</a>
          ))}
        </div>
        <span className="hidden sm:flex items-center gap-2 micro shrink-0" data-testid="nav-sent">
          <span className={`led ${running ? "on" : ""}`} /> {sim.sent} pkts · {sim.dropped} lost
        </span>
        <button className={`nav-play ${running ? "on" : ""}`} onClick={onToggle} data-testid="nav-start-toggle" aria-label={running ? "Pause" : "Start"}>
          {running ? <Pause size={14} /> : <Play size={14} />}
        </button>
      </div>
    </nav>
  );
};
