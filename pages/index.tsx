import { useEffect, useRef, useState, useMemo } from "react";

type Persona = "Rowdy Pub" | "Respectful Analysts" | "Talk Radio";
type Side = "A" | "B" | null;

interface StatItem { label: string; value: string | number; }
interface Topic { title: string; sides: [string, string]; facts: StatItem[]; derived: StatItem[]; }

const crowdLines: Record<Persona, string[]> = {
  "Rowdy Pub": ["Bosh! Say it with your chest!", "Bottle jobs!", "Stats don't lie... or do they?", "He's cooked!", "Net spend tax incoming!"],
  "Respectful Analysts": ["Interesting point on age profile.", "Please cite a source.", "Small sample size caveat.", "Consider fixture congestion.", "Good structure."],
  "Talk Radio": ["Hot take alert!", "Cut the waffle—winner?", "Phones are melting!", "Producer says keep it moving!", "Not for purists!"]
};
const modPrompts = [
  "Moderator: Opening statements—keep it tight.",
  "Value vs. cost: who got more per euro?",
  "Counter the tactical fit argument with an example.",
  "Consider injury history—does it change your view?",
  "Resale value in 2–3 years?",
  "Compare to last season—progress or repeat mistakes?"
];
function rand<T>(arr: T[]) { return arr[Math.floor(Math.random() * arr.length)]; }

/** Persona-driven brand colors for the “on air” chrome */
function usePersonaTheme(persona: Persona) {
  return useMemo(() => {
    switch (persona) {
      case "Rowdy Pub":
        return {
          a: "#ef4444", // red-500
          b: "#f97316", // orange-500
          c: "#22c55e", // green-500
          accent: "#facc15" // yellow-400
        };
      case "Respectful Analysts":
        return {
          a: "#22d3ee", // cyan-400
          b: "#60a5fa", // blue-400
          c: "#a78bfa", // violet-400
          accent: "#93c5fd" // blue-300
        };
      case "Talk Radio":
        return {
          a: "#f43f5e", // rose-500
          b: "#eab308", // amber-500
          c: "#06b6d4", // cyan-500
          accent: "#fde047" // yellow-300
        };
    }
  }, [persona]);
}

export default function Home() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [i, setI] = useState(0);
  const topic = topics[i];
  const [persona, setPersona] = useState<Persona>("Rowdy Pub");
  const [joinedSide, setJoinedSide] = useState<Side>(null);
  const [round, setRound] = useState(0);
  const [used, setUsed] = useState<string[]>([]);
  const [crowd, setCrowd] = useState<string[]>([]);
  const [mod, setMod] = useState<string[]>([]);
  const [t, setT] = useState(45);
  const [len, setLen] = useState(45);
  const [verdict, setVerdict] = useState("");
  const [thumbUrl, setThumbUrl] = useState<string>("");
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const theme = usePersonaTheme(persona);

  useEffect(() => {
    fetch("/topics.json", { cache: "no-store" })
      .then(r => r.json())
      .then((j: Topic[]) => {
        setTopics(j);
        const url = new URL(window.location.href);
        const idx = parseInt(url.searchParams.get("topic") || "0", 10);
        setI(Number.isFinite(idx) && idx >= 0 && idx < j.length ? idx : 0);
      })
      .catch(() => setTopics([]));
  }, []);

  useEffect(() => {
    if (round <= 0 || round === 99) return;
    const crowdId = setInterval(() => setCrowd(f => [rand(crowdLines[persona]), ...f].slice(0, 7)), 2500);
    const timerId = setInterval(() => setT(x => (x <= 1 ? 0 : x - 1)), 1000);
    return () => { clearInterval(crowdId); clearInterval(timerId); };
  }, [round, persona]);

  useEffect(() => { if (t === 0 && (round === 1 || round === 2)) endRound(); }, [t]);

  const start = () => {
    setRound(1); setUsed([]); setCrowd([]); setMod([modPrompts[0]]); setT(len); setVerdict(""); setThumbUrl("");
  };
  const endRound = () => {
    if (round >= 2) {
      setRound(99);
      const tilt = used.length * 2 * (joinedSide === "A" ? 1 : -1);
      const base = Math.floor(Math.random() * 100);
      const final = base + tilt;
      const a = final >= 50 ? 100 - final : final;
      const b = 100 - a;
      const winner = a > b ? topic.sides[0] : topic.sides[1];
      setVerdict(`Winner: ${winner}. Best moment: ${crowd[0] || "—"}`);
      setMod(m => [...m, "Moderator: Verdict time—simulated audience has spoken."]);
      return;
    }
    setRound(r => r + 1);
    setT(len);
    setMod(m => [rand(modPrompts.slice(1)), ...m].slice(0, 7));
  };

  const drop = (s: StatItem) => {
    if (!joinedSide) return;
    const key = `${s.label}:${s.value}`;
    if (used.includes(key)) return;
    setUsed(u => [...u, key]);
    setCrowd(f => [`Stat drop by ${joinedSide === "A" ? topic.sides[0] : topic.sides[1]} → ${key}`, ...f].slice(0, 7));
  };

  // ---- Thumbnail generator helpers ----
  function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number) {
    const words = text.split(" ");
    let line = "";
    const lines: string[] = [];
    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + " ";
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        lines.push(line.trim());
        line = words[n] + " ";
      } else {
        line = testLine;
      }
    }
    lines.push(line.trim());
    lines.forEach((l, idx) => ctx.fillText(l, x, y + idx * lineHeight));
  }
  const makeThumbnail = () => {
    if (!topic) return;
    const W = 1280, H = 720;
    const canvas = canvasRef.current || document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d")!;
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, "#0f172a"); g.addColorStop(1, "#111827");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = theme.a; ctx.fillRect(40, 40, 130, 42);
    ctx.fillStyle = "#000"; ctx.font = "bold 20px system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText("ON AIR", 78, 67);
    ctx.save(); ctx.translate(W - 280, 60); ctx.rotate(-6 * Math.PI / 180);
    ctx.fillStyle = theme.accent; ctx.fillRect(0, 0, 260, 50);
    ctx.fillStyle = "#000"; ctx.font = "bold 22px system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText("YOU’RE THE PUNDIT", 20, 32); ctx.restore();
    ctx.fillStyle = "#fff"; ctx.font = "bold 56px system-ui, -apple-system, Segoe UI, Roboto";
    wrapText(ctx, topic.title.toUpperCase(), 40, 150, W - 80, 62);
    ctx.fillStyle = "rgba(34,197,94,0.8)"; ctx.fillRect(40, H - 220, 520, 120);
    ctx.fillStyle = "rgba(59,130,246,0.85)"; ctx.fillRect(W - 560, H - 220, 520, 120);
    ctx.fillStyle = "#000"; ctx.font = "bold 34px system-ui, -apple-system, Segoe UI, Roboto";
    ctx.fillText(topic.sides[0], 60, H - 145);
    ctx.fillText(topic.sides[1], W - 540, H - 145);
    ctx.font = "20px system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillStyle = "#e5e7eb";
    const chips = (crowd.slice(0,3).length ? crowd.slice(0,3) : ["Let him cook!", "Talk to me nice!", "We ball."]);
    chips.forEach((c, idx) => ctx.fillText(`• ${c}`, 40, H - 260 - idx * 26));
    if (verdict) {
      const winner = verdict.replace("Winner: ", "").split(".")[0];
      ctx.save(); ctx.translate(W / 2, H - 40); ctx.rotate(-2 * Math.PI / 180);
      ctx.fillStyle = "#22c55e"; ctx.fillRect(-360, -48, 720, 64);
      ctx.fillStyle = "#000"; ctx.font = "bold 30px system-ui, -apple-system, Segoe UI, Roboto"; ctx.textAlign = "center";
      ctx.fillText(`WINNER: ${winner}`, 0, -8); ctx.restore();
    }
    ctx.fillStyle = "#a3a3a3"; ctx.font = "16px system-ui, -apple-system, Segoe UI, Roboto"; ctx.fillText(`Arena · ${persona}`, 40, H - 24);
    const url = canvas.toDataURL("image/png");
    setThumbUrl(url); canvasRef.current = canvas;
  };
  const downloadThumb = () => {
    if (!thumbUrl) return;
    const a = document.createElement("a");
    a.href = thumbUrl; a.download = `arena-thumb-${Date.now()}.png`; a.click();
  };

  return (
    <div className="relative min-h-screen bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* --- LAYERED BACKGROUND (meme/YouTube vibe) --- */}
      {/* Dot grid */}
      <div className="pointer-events-none absolute inset-0 bg-dotgrid vignette" />
      {/* Gradient blobs that change with persona */}
      <div
        className="pointer-events-none absolute -top-24 -left-24 w-[60vw] h-[60vw] rounded-full blur-3xl opacity-30"
        style={{ background: `radial-gradient(circle at 30% 30%, ${theme.a}, transparent 60%)` }}
      />
      <div
        className="pointer-events-none absolute -bottom-32 -right-24 w-[55vw] h-[55vw] rounded-full blur-3xl opacity-25"
        style={{ background: `radial-gradient(circle at 70% 70%, ${theme.b}, transparent 60%)` }}
      />
      <div
        className="pointer-events-none absolute top-1/3 -right-24 w-[40vw] h-[40vw] rounded-full blur-[100px] opacity-20"
        style={{ background: `radial-gradient(circle at 50% 50%, ${theme.c}, transparent 60%)` }}
      />
      {/* Noise film */}
      <div className="pointer-events-none absolute inset-0 bg-noise" />

      {/* --- HEADER: “On Air” + Ticker + Stickers --- */}
      <header className="sticky top-0 z-20">
        <div className="backdrop-blur-md bg-neutral-900/60 border-b border-neutral-800">
          <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div
                className="px-2 py-1 rounded-md text-black text-xs font-extrabold uppercase tracking-wider glow"
                style={{ background: theme.a }}
              >
                Live
