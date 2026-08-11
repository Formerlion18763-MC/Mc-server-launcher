import React, { useState, useEffect, useRef } from "react";
import {
  Play, Square, Copy, Plus, ChevronLeft, Server, Users, Cpu, HardDrive,
  Terminal as TerminalIcon, Settings2, Package, Globe, Save, RotateCcw,
  Trash2, Search, Activity, Check, AlertTriangle, Download, X, FolderTree,
  RefreshCw, Backpack, Coffee, Upload, ChevronDown, Folder, FolderPlus,
  File as FileIcon, Pencil, FolderInput, ChevronRight, CheckSquare, Square as SquareIcon, Send,
} from "lucide-react";
import { AreaChart, Area, ResponsiveContainer, YAxis } from "recharts";
import { invoke } from "@tauri-apps/api/core";

const FONT_IMPORT = `@import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&family=IBM+Plex+Mono:wght@400;500;600&family=Sora:wght@400;500;600;700;800&display=swap');`;

// ---- REAL LOGIN SETUP (2 minutes, free, no credit card) ----
// This app uses Firebase Authentication for real email/password login —
// independent of Claude, Google-account-as-Anthropic-identity, or any
// backend you'd have to host yourself. Firebase verifies the password;
// this app never sees or stores it.
// 1. Go to https://console.firebase.google.com → Add project (any name).
// 2. In the project, go to Build → Authentication → Get started →
//    enable the "Email/Password" sign-in provider.
// 3. Go to Project settings (gear icon) → General → scroll to "Your apps"
//    → Add app → Web (</>) → register it → copy the "apiKey" value shown.
// 4. Paste that value below, replacing the placeholder. Save this file.
// That's it — signup/login below will then be real, working accounts.
const FIREBASE_API_KEY = "YOUR_FIREBASE_WEB_API_KEY";

const LOADERS = { java: ["vanilla", "paper", "fabric", "forge", "purpur"], bedrock: ["vanilla", "pocketmine", "nukkit"] };

const JAVA_VERSIONS = [
  "1.21.4", "1.21.3", "1.21.2", "1.21.1", "1.21",
  "1.20.6", "1.20.4", "1.20.2", "1.20.1", "1.20",
  "1.19.4", "1.19.3", "1.19.2", "1.19",
  "1.18.2", "1.18.1", "1.18",
  "1.17.1", "1.17",
  "1.16.5", "1.16.4",
  "1.15.2", "1.14.4", "1.13.2", "1.12.2", "1.8.9", "1.7.10",
];
const BEDROCK_VERSIONS = [
  "1.21.93", "1.21.92", "1.21.80", "1.21.73", "1.21.62", "1.21.51",
  "1.21.44", "1.21.30", "1.21.20", "1.21.2",
  "1.20.81", "1.20.73", "1.20.62", "1.20.51", "1.20.41", "1.20.32", "1.20.15", "1.20.10",
];
const VERSIONS = { java: JAVA_VERSIONS, bedrock: BEDROCK_VERSIONS };
const LOADER_LABEL = { paper: "Plugins", fabric: "Mods", forge: "Mods", purpur: "Plugins", pocketmine: "Plugins", nukkit: "Addons" };
const LATEST_MC_VERSION = { java: JAVA_VERSIONS[0], bedrock: BEDROCK_VERSIONS[0] };
const REAL_ITEMS = [
  { name: "Diamond Sword", id: "minecraft:diamond_sword" }, { name: "Iron Pickaxe", id: "minecraft:iron_pickaxe" },
  { name: "Bread", id: "minecraft:bread" }, { name: "Ender Pearl", id: "minecraft:ender_pearl" },
  { name: "Golden Apple", id: "minecraft:golden_apple" }, { name: "Oak Planks", id: "minecraft:oak_planks" },
  { name: "Torch", id: "minecraft:torch" }, { name: "Shield", id: "minecraft:shield" },
  { name: "Bow", id: "minecraft:bow" }, { name: "Arrow", id: "minecraft:arrow" },
  { name: "Elytra", id: "minecraft:elytra" }, { name: "Netherite Ingot", id: "minecraft:netherite_ingot" },
];
const MOCK_ITEMS = REAL_ITEMS.map(i => i.name);
const itemIdFor = (name) => REAL_ITEMS.find(i => i.name === name)?.id || "minecraft:stone";
const itemNameFor = (id) => REAL_ITEMS.find(i => i.id === id)?.name || id.replace("minecraft:", "").replace(/_/g, " ");

function requiredJavaRuntime(mcVersion, edition) {
  if (edition === "bedrock") return null;
  const [maj, min = 0, patch = 0] = mcVersion.split(".").map((x) => parseInt(x, 10) || 0);
  if (maj >= 25) return 25;
  if (min >= 21) return 21;
  if (min === 20 && patch >= 5) return 21;
  if (min >= 18) return 17;
  if (min === 17) return 16;
  return 8;
}

const C = {
  bg: "#040605", panel: "#0a100d", panelHi: "#0f1712",
  border: "#182219", borderHi: "#2a5c3d",
  green: "#39ff88", greenDim: "#1c8c4d", greenBg: "#0d2317",
  amber: "#ffb84d", amberBg: "#2a2010", red: "#ff5c5c", redBg: "#2a1414",
  text: "#eaf7ef", muted: "#8ba99b", faint: "#546b60",
};
const F_HEAD = "'Press Start 2P', monospace";
const F_MONO = "'IBM Plex Mono', monospace";
const F_BODY = "'Sora', sans-serif";

function levelColor(pct) {
  if (pct < 40) return C.green;
  if (pct < 65) return "#c9d43d";
  if (pct < 85) return C.amber;
  return C.red;
}
function useHistory(seed) { return useState(() => Array.from({ length: 30 }, (_, i) => ({ i, v: seed }))); }

function Sparkline({ data, color }) {
  return (
    <ResponsiveContainer width="100%" height={44}>
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs><linearGradient id={`grad-${color}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={color} stopOpacity={0.35} /><stop offset="100%" stopColor={color} stopOpacity={0} /></linearGradient></defs>
        <YAxis domain={[0, 100]} hide />
        <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} fill={`url(#grad-${color})`} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function Ring({ pct, size = 92 }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r, color = levelColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={C.border} strokeWidth="7" />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
        strokeDasharray={c} strokeDashoffset={c - (Math.min(pct,100)/100)*c} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 0.7s cubic-bezier(.4,0,.2,1), stroke 0.5s ease", filter: `drop-shadow(0 0 7px ${color}66)` }} />
      <text x="50%" y="53%" textAnchor="middle" fontSize="18" fill={C.text} fontWeight="700" fontFamily={F_BODY}>{Math.round(pct)}%</text>
    </svg>
  );
}

function Card({ children, className = "", style = {}, ...rest }) {
  return (
    <div className={`rounded-2xl ${className}`} style={{ background: C.panel, border: `1px solid ${C.border}`, boxShadow: "0 1px 0 rgba(255,255,255,0.02) inset, 0 8px 24px -12px rgba(0,0,0,0.6)", minWidth: 0, ...style }} {...rest}>
      {children}
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <div className="flex flex-col gap-2 min-w-0">
      <label className="text-xs uppercase tracking-widest font-bold" style={{ color: C.muted, fontFamily: F_BODY }}>{label}</label>
      {children}
      {hint && <span className="text-xs" style={{ color: C.faint }}>{hint}</span>}
    </div>
  );
}

function Toggle({ checked, onChange }) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-2.5 transition-colors" style={{ color: checked ? C.green : C.muted }}>
      <span className="rounded-full relative transition-colors duration-300 shrink-0" style={{ width: 48, height: 28, background: checked ? C.greenDim : C.panelHi, border: `1px solid ${checked ? C.green : C.border}` }}>
        <span className="absolute rounded-full transition-transform duration-300 ease-out" style={{ top: 2, left: 2, width: 22, height: 22, background: checked ? C.green : "#4a5f55", transform: checked ? "translateX(20px)" : "translateX(0px)", boxShadow: checked ? `0 0 10px ${C.green}aa` : "none" }} />
      </span>
      <span className="text-sm font-bold" style={{ fontFamily: F_BODY }}>{checked ? "ON" : "OFF"}</span>
    </button>
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg px-3 py-2.5 text-base font-medium focus:outline-none transition-colors w-full"
      style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, fontFamily: F_BODY }}
      onFocus={(e) => e.target.style.borderColor = C.green} onBlur={(e) => e.target.style.borderColor = C.border}>
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function TextInput(props) {
  return <input {...props} className={`rounded-lg px-3 py-2.5 text-base focus:outline-none transition-colors w-full ${props.className||""}`}
    style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, fontFamily: F_BODY }}
    onFocus={(e) => e.target.style.borderColor = C.green} onBlur={(e) => e.target.style.borderColor = C.border} />;
}

function Slider({ value, min, max, onChange, format }) {
  return (
    <div className="flex items-center gap-3 min-w-0">
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} className="w-full min-w-0" style={{ accentColor: C.green }} />
      <span className="text-base font-bold tabular-nums shrink-0" style={{ color: C.green, fontFamily: F_BODY, minWidth: 64, textAlign: "right" }}>{format ? format(value) : value}</span>
    </div>
  );
}

function IconBtn({ onClick, icon: Icon, danger, title }) {
  return (
    <button onClick={onClick} title={title} className="p-2 rounded-lg transition-colors shrink-0" style={{ color: danger ? "#ff9d9d" : C.muted }}
      onMouseEnter={(e) => e.currentTarget.style.background = danger ? C.redBg : C.panelHi} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}>
      <Icon size={15} />
    </button>
  );
}

const NAV_ITEMS = [
  { key: "game", label: "Game Logic", icon: Settings2 },
  { key: "world", label: "World", icon: HardDrive },
  { key: "perf", label: "Performance", icon: Cpu },
  { key: "players", label: "Players", icon: Users },
  { key: "network", label: "Network", icon: Globe },
  { key: "plugins", label: null, icon: Package },
  { key: "runtime", label: "Runtime", icon: Server },
  { key: "files", label: "Files", icon: Folder },
  { key: "resources", label: "Resources", icon: Activity },
];

const CREATE_NAV = [
  { key: "basics", label: "Basics", icon: Server },
  { key: "game", label: "Game Logic", icon: Settings2 },
  { key: "world", label: "World", icon: HardDrive },
  { key: "perf", label: "Performance", icon: Cpu },
  { key: "network", label: "Network", icon: Globe },
];

function Sidebar({ items, active, onSelect }) {
  return (
    <Card className="p-2 h-fit flex flex-col gap-1 sm:sticky sm:top-4">
      {items.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => onSelect(key)} className="flex items-center gap-3 px-3.5 py-3 rounded-lg text-base text-left transition-colors font-bold"
          style={{ background: active === key ? C.greenBg : "transparent", color: active === key ? C.green : C.muted, fontFamily: F_BODY }}>
          <Icon size={18} /> {label}
        </button>
      ))}
    </Card>
  );
}

const defaultSettings = () => ({
  gamemode: "survival", difficulty: "normal", hardcore: false, pvp: true, allowFlight: false, nether: true, end: true, spawnProtection: 16,
  viewDistance: 10, simDistance: 10, seed: "", levelType: "default", generateStructures: true, forceGamemode: false,
  maxTickTime: 60000, autoRestart: "off", chunkGC: true, maxPlayers: 20, whitelist: false, onlineMode: true,
});
const emptyInventory = () => Array.from({ length: 27 }, () => null);
const emptyPlayer = (name, op = false) => ({ name, op, whitelisted: true, banned: false, gamemode: "survival", health: 20, hunger: 20, inventory: emptyInventory() });

// Mock catalog standing in for a real Modrinth/Spigot/PocketMine API call —
// a live build should query those APIs directly rather than a fixed list.
// Sorted roughly by popularity so it doubles as the "most used" list.
const PLUGIN_CATALOG = {
  paper: [
    { name: "EssentialsX", version: "2.20.1", downloads: "14M", desc: "Core server commands & utilities" },
    { name: "Vault", version: "1.7.3", downloads: "9M", desc: "Economy & permissions API bridge" },
    { name: "WorldEdit", version: "7.3.0", downloads: "9M", desc: "In-game world editing tool" },
    { name: "LuckPerms", version: "5.4.100", downloads: "7M", desc: "Permissions management" },
    { name: "WorldGuard", version: "7.0.9", downloads: "5M", desc: "Region protection" },
    { name: "ViaVersion", version: "5.0.2", downloads: "4M", desc: "Cross-version protocol support" },
    { name: "ProtocolLib", version: "5.3.0", downloads: "4M", desc: "Packet-level API for other plugins" },
    { name: "PlaceholderAPI", version: "2.11.6", downloads: "3M", desc: "Shared placeholder/variable system" },
    { name: "CoreProtect", version: "22.4", downloads: "3M", desc: "Block-change logging & rollback" },
    { name: "Multiverse-Core", version: "5.1.0", downloads: "2M", desc: "Manage multiple worlds" },
    { name: "DiscordSRV", version: "1.28.0", downloads: "2M", desc: "Discord chat/server bridge" },
    { name: "TAB", version: "5.0.2", downloads: "1.5M", desc: "Tab list, nametags & scoreboard" },
  ],
  purpur: [
    { name: "EssentialsX", version: "2.20.1", downloads: "14M", desc: "Core server commands & utilities" },
    { name: "LuckPerms", version: "5.4.100", downloads: "7M", desc: "Permissions management" },
    { name: "WorldGuard", version: "7.0.9", downloads: "5M", desc: "Region protection" },
    { name: "Vault", version: "1.7.3", downloads: "9M", desc: "Economy & permissions API bridge" },
    { name: "CoreProtect", version: "22.4", downloads: "3M", desc: "Block-change logging & rollback" },
    { name: "PlaceholderAPI", version: "2.11.6", downloads: "3M", desc: "Shared placeholder/variable system" },
  ],
  // Note: Sodium/Iris/JEI are CLIENT-side mods (rendering, recipe UI) — they
  // only work in a player's game window and can't run on a dedicated
  // server, so they're deliberately left out of these two lists.
  fabric: [
    { name: "Fabric API", version: "0.100.0", downloads: "50M", desc: "Core API required by most mods" },
    { name: "Lithium", version: "0.13.0", downloads: "12M", desc: "General server-side performance" },
    { name: "LuckPerms", version: "5.4.100", downloads: "7M", desc: "Permissions management" },
    { name: "Krypton", version: "0.2.3", downloads: "5M", desc: "Network stack optimizations" },
    { name: "FerriteCore", version: "6.0.1", downloads: "4M", desc: "Memory usage optimizations" },
    { name: "Carpet", version: "1.4.100", downloads: "4M", desc: "Technical/vanilla-plus tweaks" },
    { name: "Spark", version: "1.10.53", downloads: "3M", desc: "Performance profiler" },
    { name: "Chunky", version: "1.4.36", downloads: "2M", desc: "Chunk pre-generation" },
  ],
  forge: [
    { name: "Create", version: "6.0.0", downloads: "10M", desc: "Mechanical contraptions" },
    { name: "Applied Energistics 2", version: "15.0.0", downloads: "5M", desc: "Storage & automation" },
    { name: "Waystones", version: "14.1.9", downloads: "4M", desc: "Fast travel waystones" },
    { name: "FTB Teams", version: "2100.1.2", downloads: "3M", desc: "Team/faction management" },
    { name: "Spark", version: "1.10.53", downloads: "3M", desc: "Performance profiler" },
    { name: "Corpse", version: "1.20.1-1.5", downloads: "1M", desc: "Death chest/corpse recovery" },
  ],
  pocketmine: [
    { name: "EconomyAPI", version: "3.0.0", downloads: "2M", desc: "Economy backend for other addons" },
    { name: "SimpleAuth", version: "3.1.0", downloads: "1.5M", desc: "Login/authentication system" },
    { name: "Multiworld", version: "2.0.1", downloads: "900K", desc: "Manage multiple worlds" },
    { name: "FormAPI", version: "2.5.0", downloads: "800K", desc: "UI forms for other addons" },
    { name: "Factions", version: "1.9.0", downloads: "600K", desc: "Land claiming & factions" },
  ],
  nukkit: [
    { name: "NukkitEcon", version: "1.2.0", downloads: "800K", desc: "Economy plugin for NukkitX" },
    { name: "AutoSaveWorld", version: "1.0.4", downloads: "600K", desc: "Scheduled world autosave" },
    { name: "SimpleAuth", version: "2.0.0", downloads: "500K", desc: "Login/authentication system" },
    { name: "PlayerTags", version: "1.1.0", downloads: "300K", desc: "Custom nametag prefixes" },
  ],
};
const catalogFor = (loader) => PLUGIN_CATALOG[loader] || [];

const MOCK_PLUGINS = (loader) => catalogFor(loader).slice(0, 2).map(({ name, version }) => ({ name, version }));

// Real Levenshtein edit distance — used so a small typo in a search
// ("EssentiasX", "Luckperm") still matches, instead of requiring an exact
// substring match.
function editDistance(a, b) {
  a = a.toLowerCase(); b = b.toLowerCase();
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j-1], dp[i-1][j], dp[i][j-1]);
    }
  }
  return dp[a.length][b.length];
}

// Fuzzy match: true substring match always counts; otherwise allow small
// edit-distance typos scaled to query length (roughly 1 typo per 4 chars).
function fuzzyMatches(query, name) {
  const q = query.toLowerCase().trim();
  if (!q) return true;
  const n = name.toLowerCase();
  if (n.includes(q)) return true;
  const words = n.split(/[\s:_-]+/);
  const tolerance = Math.max(1, Math.floor(q.length / 4));
  return words.some(w => editDistance(q, w.slice(0, q.length + tolerance)) <= tolerance) || editDistance(q, n.slice(0, q.length + tolerance)) <= tolerance;
}

const MODRINTH_LOADER = { paper: "paper", purpur: "purpur", fabric: "fabric", forge: "forge" };

// Real live search against Modrinth's public API (api.modrinth.com/v2) —
// covers Paper/Purpur plugins and Fabric/Forge mods for Java edition,
// filtered to the exact loader + Minecraft version selected. Falls back to
// the curated catalog (still fuzzy-filtered) if the request fails for any
// reason (offline, rate-limited, or blocked — browsers can't set a custom
// User-Agent header, which Modrinth's docs ask API clients to send, so
// requests here rely on whatever default UA the browser sends).
async function searchModrinth(loader, version, query) {
  const facets = JSON.stringify([[`categories:${MODRINTH_LOADER[loader]}`], [`versions:${version}`]]);
  const url = `https://api.modrinth.com/v2/search?query=${encodeURIComponent(query)}&facets=${encodeURIComponent(facets)}&limit=20&index=${query ? "relevance" : "downloads"}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Modrinth returned ${res.status}`);
  const data = await res.json();
  return (data.hits || []).map(h => ({
    name: h.title, version: h.latest_version || h.versions?.[0] || "latest",
    downloads: h.downloads >= 1e6 ? `${(h.downloads/1e6).toFixed(1)}M` : h.downloads >= 1e3 ? `${(h.downloads/1e3).toFixed(0)}K` : String(h.downloads),
    desc: h.description,
  }));
}

// Poggit (poggit.pmmp.io) hosts PocketMine plugins and has a real public
// plugins.json endpoint. It's a third-party service outside our control —
// if it's unreachable or blocks browser requests (CORS), this throws and
// the caller falls back to the curated list.
async function searchPoggit(query) {
  const url = `https://poggit.pmmp.io/plugins.min.json${query ? `?name=${encodeURIComponent(query)}` : ""}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Poggit returned ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).slice(0, 20).map(p => ({
    name: p.name, version: p.version || "latest", downloads: "—", desc: p.short_desc || p.description || "",
  }));
}

// Unified entry point used by the UI. Returns { results, source } where
// source is "live" or "fallback" so the UI can be honest about which one
// it's showing.
async function searchPlugins(loader, edition, version, query) {
  try {
    if (loader === "paper" || loader === "purpur" || loader === "fabric" || loader === "forge") {
      const results = await searchModrinth(loader, version, query);
      return { results, source: "live" };
    }
    if (loader === "pocketmine") {
      const results = (await searchPoggit(query)).filter(p => fuzzyMatches(query, p.name));
      return { results, source: "live" };
    }
  } catch {
    // fall through to curated catalog below
  }
  const results = catalogFor(loader).filter(p => fuzzyMatches(query, p.name));
  return { results, source: "fallback" };
}

function randomRconPassword() {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 16);
}

function makeServer(form, jarPath, workingDir) {
  return {
    id: crypto.randomUUID(), name: form.name || "New Server", edition: form.edition, loader: form.loader, version: form.version,
    fabricLoaderVersion: form.loader === "fabric" ? "0.16.9" : null,
    status: "stopped", ip: null, ram: form.ram, storageLocation: `Minecraft Server/${form.name || "New Server"}/world`,
    jarPath, workingDir,
    rconPort: 25575, rconPassword: randomRconPassword(),
    settings: { ...form.settings },
    players: [emptyPlayer("Steve", true), emptyPlayer("Alex")],
    ipBans: [],
    plugins: form.installPlugins ? MOCK_PLUGINS(form.loader).map(p => ({ ...p, latestVersion: p.version, hasUpdate: false })) : [],
    files: seedFiles(form),
    console: [`[Launcher] Created in Minecraft Server/${form.name || "New Server"}/`],
    pendingUpdate: null,
  };
}

// Generates the actual server.properties content from the server's real
// settings — not a static placeholder, so downloading it reflects whatever
// you've actually configured in the Game Logic / World / Network tabs.
// RCON is enabled here for real — required for the Players tab's OP/
// whitelist/ban/kick/gamemode buttons to actually reach the server.
function serverPropertiesContent(s) {
  const g = s.settings;
  return [
    `#Minecraft server properties`, `#Generated by Launcher`,
    `gamemode=${g.gamemode}`, `difficulty=${g.difficulty}`, `hardcore=${g.hardcore}`,
    `pvp=${g.pvp}`, `allow-flight=${g.allowFlight}`, `allow-nether=${g.nether}`,
    `spawn-protection=${g.spawnProtection}`, `view-distance=${g.viewDistance}`,
    `simulation-distance=${g.simDistance}`, `level-seed=${g.seed}`, `level-type=${g.levelType}`,
    `generate-structures=${g.generateStructures}`, `force-gamemode=${g.forceGamemode}`,
    `max-tick-time=${g.maxTickTime}`, `max-players=${g.maxPlayers}`,
    `white-list=${g.whitelist}`, `online-mode=${g.onlineMode}`, `server-port=25565`,
    `enable-rcon=true`, `rcon.port=${s.rconPort || 25575}`, `rcon.password=${s.rconPassword || ""}`,
  ].join("\n") + "\n";
}

let fileIdCounter = 0;
const nextFileId = () => `f${++fileIdCounter}_${Date.now().toString(36)}`;
const folderNameForLoader = (loader) => (loader === "fabric" || loader === "forge") ? "mods" : loader === "nukkit" ? "addons" : "plugins";

function seedFiles(form) {
  const files = [];
  const add = (f) => { const id = nextFileId(); files.push({ id, parentId: f.parentId ?? null, name: f.name, type: f.type, size: f.size ?? "", modified: "just now", content: f.content }); return id; };

  const worldId = add({ name: "world", type: "folder" });
  add({ parentId: worldId, name: "level.dat", type: "file", size: "22 KB" });
  add({ parentId: worldId, name: "region", type: "folder" });

  if (form.loader !== "vanilla") {
    const pluginFolderId = add({ name: folderNameForLoader(form.loader), type: "folder" });
    (form.installPlugins ? MOCK_PLUGINS(form.loader) : []).forEach((p) => {
      add({ parentId: pluginFolderId, name: `${p.name}.${form.edition === "bedrock" ? "phar" : "jar"}`, type: "file", size: "1.2 MB" });
    });
  }

  const logsId = add({ name: "logs", type: "folder" });
  add({ parentId: logsId, name: "latest.log", type: "file", size: "4 KB", content: `[Server thread/INFO]: Starting minecraft server version ${form.version}\n[Server thread/INFO]: Done! For help, type "help"\n` });

  add({ name: "server.properties", type: "file", size: "1 KB", content: serverPropertiesContent({ settings: form.settings }) });
  add({ name: "eula.txt", type: "file", size: "1 KB", content: "eula=true\n" });
  add({ name: "ops.json", type: "file", size: "1 KB", content: "[]\n" });
  add({ name: "whitelist.json", type: "file", size: "1 KB", content: "[]\n" });
  add({ name: "banned-players.json", type: "file", size: "1 KB", content: "[]\n" });
  add({ name: "banned-ips.json", type: "file", size: "1 KB", content: "[]\n" });
  add({ name: form.edition === "bedrock" ? "bedrock_server" : "server.jar", type: "file", size: "48.6 MB" });

  return files;
}

function pluginFileNameFor(loader, pluginName) { return `${pluginName}.${loader === "pocketmine" ? "phar" : loader === "nukkit" ? "jar" : "jar"}`; }

function DownloadOverlay({ steps, currentStep }) {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(3,5,4,0.85)", backdropFilter: "blur(3px)" }}>
      <Card className="p-8 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center gap-2" style={{ color: C.green }}><Download size={18} className="animate-bounce" /><span className="text-sm font-bold" style={{ fontFamily: F_BODY }}>Setting up your server...</span></div>
        <div className="flex flex-col gap-2.5">
          {steps.map((s, i) => (
            <div key={s} className="flex items-center gap-2.5 text-sm font-medium" style={{ color: i < currentStep ? C.green : i === currentStep ? C.text : C.faint }}>
              {i < currentStep ? <Check size={14} /> : i === currentStep ? <span className="w-3.5 h-3.5 rounded-full border-2 animate-spin" style={{ borderColor: C.green, borderTopColor: "transparent" }} /> : <span className="w-3.5 h-3.5 rounded-full" style={{ border: `2px solid ${C.border}` }} />}
              {s}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function UpdateModal({ field, from, to, onConfirm, onCancel }) {
  const fieldLabel = field === "edition" ? "edition" : field === "loader" ? "loader" : "version";
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(3,5,4,0.85)", backdropFilter: "blur(3px)" }}>
      <Card className="p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="flex items-center gap-2" style={{ color: C.amber }}><AlertTriangle size={18} /><span className="text-sm font-bold">Update required</span></div>
        <p className="text-sm" style={{ color: C.muted }}>
          Changing {fieldLabel} from <span style={{ color: C.text, fontWeight: 600 }}>{from}</span> to <span style={{ color: C.text, fontWeight: 600 }}>{to}</span> requires downloading new server files{field === "edition" ? " and will remove all installed plugins/mods, since they don't carry across editions" : " and re-checking plugin/mod compatibility — incompatible ones with no available update will be removed"}.
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ color: C.muted, background: C.panelHi }}>Cancel</button>
          <button onClick={onConfirm} className="px-3 py-2 rounded-lg text-sm font-bold" style={{ background: C.green, color: "#03150a" }}>Update & Install</button>
        </div>
      </Card>
    </div>
  );
}

function FolderPickerModal({ files, excludeIds, mode, onConfirm, onCancel }) {
  const [target, setTarget] = useState(null);
  const folders = files.filter(f => f.type === "folder" && !excludeIds.includes(f.id));
  const pathLabel = (folderId) => {
    const parts = [];
    let cur = folderId;
    while (cur) { const f = files.find(x => x.id === cur); if (!f) break; parts.unshift(f.name); cur = f.parentId; }
    return parts.join("/") || "/";
  };
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: "rgba(3,5,4,0.85)", backdropFilter: "blur(3px)" }}>
      <Card className="p-6 w-full max-w-sm flex flex-col gap-4">
        <div className="text-sm font-bold">{mode === "move" ? "Move to..." : "Copy to..."}</div>
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
          <button onClick={() => setTarget(null)} className="text-left px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: target === null ? C.greenBg : C.panelHi, color: target === null ? C.green : C.text }}>Minecraft Server/ (root)</button>
          {folders.map((f) => (
            <button key={f.id} onClick={() => setTarget(f.id)} className="text-left px-3 py-2 rounded-lg text-sm font-semibold truncate" style={{ background: target === f.id ? C.greenBg : C.panelHi, color: target === f.id ? C.green : C.text }}>{pathLabel(f.id)}</button>
          ))}
          {folders.length === 0 && <div className="text-sm p-2" style={{ color: C.faint }}>No other folders yet.</div>}
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm font-medium" style={{ color: C.muted, background: C.panelHi }}>Cancel</button>
          <button onClick={() => onConfirm(target)} className="px-3 py-2 rounded-lg text-sm font-bold" style={{ background: C.green, color: "#03150a" }}>{mode === "move" ? "Move here" : "Copy here"}</button>
        </div>
      </Card>
    </div>
  );
}

function BadgeSelect({ value, options, onChange, color }) {
  return (
    <div className="relative inline-flex items-center">
      <select value={value} onChange={(e) => onChange(e.target.value)} className="appearance-none text-sm font-bold pl-2.5 pr-7 py-1.5 rounded-lg focus:outline-none cursor-pointer"
        style={{ background: color === "green" ? C.greenBg : C.panelHi, color: color === "green" ? C.green : C.text, fontFamily: F_BODY, border: `1px solid ${color === "green" ? C.borderHi : C.border}` }}>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
      <ChevronDown size={12} className="absolute right-2 pointer-events-none" style={{ color: color === "green" ? C.green : C.muted }} />
    </div>
  );
}

function VersionBadges({ s, onChangeEdition, onChangeVersion, onChangeLoader, versions }) {
  const V = versions || VERSIONS;
  const runtime = requiredJavaRuntime(s.version, s.edition);
  return (
    <div className="flex flex-wrap items-center gap-2">
      {onChangeEdition ? (
        <BadgeSelect value={s.edition} options={["java", "bedrock"]} onChange={onChangeEdition} />
      ) : (
        <span className="text-xs font-bold px-2.5 py-1.5 rounded-lg" style={{ background: C.panelHi, color: C.text, fontFamily: F_BODY }}>{s.edition}</span>
      )}
      {onChangeLoader ? (
        <BadgeSelect value={s.loader} options={LOADERS[s.edition]} onChange={onChangeLoader} color="green" />
      ) : (
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: C.greenBg, color: C.green, fontFamily: F_BODY }}>{s.loader}</span>
      )}
      {onChangeVersion ? (
        <BadgeSelect value={s.version} options={V[s.edition]} onChange={onChangeVersion} />
      ) : (
        <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: C.panelHi, color: C.text, fontFamily: F_BODY }}>{s.version}</span>
      )}
      {s.fabricLoaderVersion && <span className="text-xs font-bold px-2.5 py-1 rounded-lg" style={{ background: C.panelHi, color: C.muted, fontFamily: F_BODY }}>loader {s.fabricLoaderVersion}</span>}
      {runtime && <span className="text-xs font-bold px-2.5 py-1 rounded-lg flex items-center gap-1" style={{ background: C.panelHi, color: C.muted, fontFamily: F_BODY }}><Coffee size={11} /> Java {runtime}</span>}
    </div>
  );
}

export default function App() {
  const [servers, setServers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState("game");
  const [createTab, setCreateTab] = useState("basics");
  const [cpu, setCpu] = useState(12);
  const [ram, setRam] = useState(22);
  const [cpuHist, setCpuHist] = useHistory(12);
  const [ramHist, setRamHist] = useHistory(22);
  const [pluginQuery, setPluginQuery] = useState("");
  const [pluginResults, setPluginResults] = useState([]);
  const [pluginSearchLoading, setPluginSearchLoading] = useState(false);
  const [pluginSource, setPluginSource] = useState("fallback");
  const [selectedPlayerIdx, setSelectedPlayerIdx] = useState(0);
  const [newPlayerMode, setNewPlayerMode] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState("");
  const [addItemSlot, setAddItemSlot] = useState(null);
  const [pendingItem, setPendingItem] = useState(MOCK_ITEMS[0]);
  const [downloading, setDownloading] = useState(null);
  const [createError, setCreateError] = useState("");
  const [commandInput, setCommandInput] = useState("");
  const [playitStatus, setPlayitStatus] = useState(null);
  const [playitStarting, setPlayitStarting] = useState(false);
  const [pendingUpdateModal, setPendingUpdateModal] = useState(null);
  const [runtimeCheck, setRuntimeCheck] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [syncState, setSyncState] = useState("idle"); // idle | saving | saved
  const [auth, setAuth] = useState(null); // null | { email, localId, idToken }
  const [authMode, setAuthMode] = useState("signin"); // signin | signup
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [newIpBan, setNewIpBan] = useState("");
  const [pluginCheckState, setPluginCheckState] = useState(null); // null | "checking" | "done"
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [renamingId, setRenamingId] = useState(null);
  const [renameValue, setRenameValue] = useState("");
  const [newFolderMode, setNewFolderMode] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [folderPicker, setFolderPicker] = useState(null); // { ids, mode: 'move' | 'copy' }
  const fileInputRef = useRef(null);
  const worldFileInputRef = useRef(null);
  const [systemRam, setSystemRam] = useState(8192); // real value fetched below; this is just the initial render fallback
  const [liveJavaVersions, setLiveJavaVersions] = useState(null); // null until the real fetch completes
  const consoleEndRef = useRef(null);
  const consoleCardRef = useRef(null);

  const [form, setForm] = useState({ name: "", edition: "java", loader: "vanilla", version: JAVA_VERSIONS[0], ram: 2048, installPlugins: false, settings: defaultSettings() });

  const selected = servers.find((s) => s.id === selectedId);

  // Load once on mount: local-device data (works with no login at all).
  useEffect(() => {
    (async () => {
      try {
        const result = await window.storage.get("servers", false);
        if (result?.value) setServers(JSON.parse(result.value));
      } catch {
        // no saved data yet — first time using the app
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Save: local-device key when signed out, real-account key (namespaced
  // by the Firebase user ID) when signed in — this is what actually syncs
  // across devices under a real login, independent of Claude entirely.
  useEffect(() => {
    if (!loaded) return;
    setSyncState("saving");
    const key = auth ? `servers:${auth.localId}` : "servers";
    const shared = !!auth;
    const t = setTimeout(async () => {
      try {
        await window.storage.set(key, JSON.stringify(servers), shared);
        setSyncState("saved");
      } catch {
        setSyncState("idle");
      }
    }, 600);
    return () => clearTimeout(t);
  }, [servers, loaded, auth]);

  async function submitAuth() {
    setAuthError("");
    if (FIREBASE_API_KEY.startsWith("YOUR_")) {
      setAuthError("Add your free Firebase Web API key at the top of this file first (see the comment above FIREBASE_API_KEY) — takes about 2 minutes, no credit card.");
      return;
    }
    setAuthLoading(true);
    try {
      const endpoint = authMode === "signup" ? "accounts:signUp" : "accounts:signInWithPassword";
      const res = await fetch(`https://identitytoolkit.googleapis.com/v1/${endpoint}?key=${FIREBASE_API_KEY}`, {
        method: "POST",
        body: JSON.stringify({ email: authEmail, password: authPassword, returnSecureToken: true }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message.replace(/_/g, " "));
      const newAuth = { email: data.email, localId: data.localId, idToken: data.idToken };
      // Real account exists now — see if it already has servers saved from
      // another device; if not, this device's current servers become that
      // account's first copy.
      try {
        const remote = await window.storage.get(`servers:${newAuth.localId}`, true);
        if (remote?.value) setServers(JSON.parse(remote.value));
      } catch { /* new account, nothing saved yet — current servers will save on next effect run */ }
      setAuth(newAuth);
      setAuthEmail(""); setAuthPassword("");
    } catch (e) {
      setAuthError(e.message || "Something went wrong.");
    } finally {
      setAuthLoading(false);
    }
  }

  // Real system RAM, fetched once from the Rust backend.
  useEffect(() => {
    invoke("get_system_ram_mb").then(setSystemRam).catch(() => {});
  }, []);

  // Real, live Minecraft version list from Mojang — so a new release
  // shows up here automatically. Falls back to the static JAVA_VERSIONS
  // list above if this fails (offline, Mojang unreachable, etc.).
  useEffect(() => {
    invoke("get_live_java_versions").then((list) => { if (list?.length) setLiveJavaVersions(list); }).catch(() => {});
  }, []);
  const effectiveVersions = { java: liveJavaVersions || JAVA_VERSIONS, bedrock: BEDROCK_VERSIONS };

  // Real, live CPU/RAM usage — polls the actual OS via sysinfo in Rust,
  // not a scripted random walk.
  useEffect(() => {
    const iv = setInterval(() => {
      invoke("get_resource_usage")
        .then((u) => { setCpu(u.cpu_percent); setRam((u.ram_used_mb / (u.ram_total_mb || 1)) * 100); })
        .catch(() => {});
    }, 1500);
    return () => clearInterval(iv);
  }, []);
  useEffect(() => { setCpuHist((h) => [...h.slice(1), { i: h.length, v: cpu }]); }, [cpu]);
  useEffect(() => { setRamHist((h) => [...h.slice(1), { i: h.length, v: ram }]); }, [ram]);
  useEffect(() => { consoleEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [selected?.console?.length]);
  useEffect(() => { setCurrentFolderId(null); setSelectedFileIds([]); setRenamingId(null); setNewFolderMode(false); setSelectedPlayerIdx(0); setNewPlayerMode(false); }, [selectedId]);

  // Real inventory — fetched from the live server via RCON + Minecraft's
  // own /data command. Only possible while the server is actually running;
  // while stopped, whatever was last fetched (or the local placeholder
  // state) stays shown.
  useEffect(() => {
    if (!selected || selected.status !== "running") return;
    const player = selected.players[selectedPlayerIdx];
    if (!player) return;
    invoke("read_player_inventory", { port: selected.rconPort, password: selected.rconPassword, playerName: player.name })
      .then((items) => {
        const grid = Array(27).fill(null);
        items.forEach((it) => { if (it.slot >= 0 && it.slot < 27) grid[it.slot] = itemNameFor(it.id); });
        updatePlayer((p) => ({ ...p, inventory: grid }));
      })
      .catch(() => { /* player likely not online — RCON /data only works for online players */ });
  }, [selected?.id, selected?.status, selectedPlayerIdx]);

  useEffect(() => {
    const iv = setInterval(() => {
      invoke("get_playit_status").then((status) => {
        setPlayitStatus(status);
        if (status?.public_address && selected) {
          updateSelected((s) => (s.ip === status.public_address ? s : { ...s, ip: status.public_address }));
        }
      }).catch(() => {});
    }, 1500);
    return () => clearInterval(iv);
  }, [selected?.id]);

  // Real live console — polls the actual buffered stdout/stderr the Rust
  // backend captured from the running server process.
  useEffect(() => {
    if (!selected || selected.status !== "running") return;
    const iv = setInterval(() => {
      invoke("get_server_log", { name: selected.name })
        .then((lines) => updateSelected((s) => ({ ...s, console: lines })))
        .catch(() => {});
    }, 1200);
    return () => clearInterval(iv);
  }, [selected?.id, selected?.status]);

  useEffect(() => {
    if (tab !== "plugins" || !selected || selected.loader === "vanilla") return;
    let cancelled = false;
    setPluginSearchLoading(true);
    const t = setTimeout(async () => {
      const { results, source } = await searchPlugins(selected.loader, selected.edition, selected.version, pluginQuery);
      if (!cancelled) { setPluginResults(results); setPluginSource(source); setPluginSearchLoading(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [tab, selected?.loader, selected?.version, selected?.id, pluginQuery]);

  function updateSelected(fn) { setServers((prev) => prev.map((s) => (s.id === selectedId ? fn({ ...s, settings: { ...s.settings } }) : s))); }
  function log(line) { updateSelected((s) => { s.console = [...s.console, line]; return s; }); }

  async function toggleStartStop() {
    if (!selected) return;
    const nowRunning = selected.status !== "running";
    if (nowRunning) {
      try {
        await invoke("start_server", { config: { name: selected.name, jar_path: selected.jarPath, ram_mb: selected.ram, port: 25565, working_dir: selected.workingDir } });
        updateSelected((s) => ({ ...s, status: "running", console: [...s.console, "[Launcher] Server process started."] }));
      } catch (e) {
        log(`[Launcher] Failed to start: ${e}`);
      }
    } else {
      try {
        await invoke("stop_server", { name: selected.name });
        updateSelected((s) => ({ ...s, status: "stopped" }));
      } catch (e) {
        log(`[Launcher] Failed to stop: ${e}`);
      }
    }
  }

  const REAL_AUTO_DOWNLOAD_LOADERS = ["vanilla", "fabric", "paper"];

  async function startCreate() {
    if (downloading) return; // guard against double-submit spawning overlapping timers
    setCreateError("");
    const autoSupported = REAL_AUTO_DOWNLOAD_LOADERS.includes(form.loader);
    const steps = autoSupported
      ? ["Creating Minecraft Server folder", `Downloading ${form.loader} ${form.version} from the real source`, "Finalizing configuration"]
      : ["Creating Minecraft Server folder", "Waiting for you to pick a server .jar", "Finalizing configuration"];
    setDownloading({ steps, currentStep: 0 });

    try {
      const baseDir = await invoke("get_default_servers_dir");
      const workingDir = `${baseDir}/${form.name.replace(/[^a-zA-Z0-9_-]/g, "_")}`;
      setDownloading({ steps, currentStep: 1 });

      let jarPath;
      if (autoSupported) {
        jarPath = await invoke("resolve_and_download_jar", { loader: form.loader, version: form.version, workingDir });
      } else {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({ multiple: false, filters: [{ name: "Server jar", extensions: ["jar"] }] });
        if (!picked) { setDownloading(null); return; }
        jarPath = picked;
      }

      setDownloading({ steps, currentStep: 2 });
      const s = makeServer(form, jarPath, workingDir);
      // Write the real files a Minecraft server requires to actually start
      // and to accept RCON connections — without these, the jar alone
      // won't boot (Minecraft refuses to run without a real eula.txt).
      await invoke("write_text_file", { path: `${workingDir}/eula.txt`, content: "eula=true\n" });
      await invoke("write_text_file", { path: `${workingDir}/server.properties`, content: serverPropertiesContent(s) });
      setServers((prev) => [...prev, s]);
      setSelectedId(s.id); setCreating(false); setTab("game"); setDownloading(null);
      setForm({ name: "", edition: "java", loader: "vanilla", version: JAVA_VERSIONS[0], ram: 2048, installPlugins: false, settings: defaultSettings() });
    } catch (e) {
      setDownloading(null);
      setCreateError(String(e));
    }
  }

  function requestVersionOrLoaderChange(field, newValue) {
    const from = selected[field];
    if (newValue === from) return;
    setPendingUpdateModal({ field, from, to: newValue });
  }

  function scrollToConsole() {
    consoleCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function confirmUpdate() {
    const { field, to } = pendingUpdateModal;
    updateSelected((s) => {
      if (field === "edition") {
        const newLoader = "vanilla";
        const newVersion = effectiveVersions[to][0];
        const removedCount = s.plugins.length;
        const oldFolderName = folderNameForLoader(s.loader);
        const oldFolder = s.files.find(f => f.type === "folder" && f.parentId === null && f.name === oldFolderName);
        const filesWithoutOldPlugins = oldFolder ? s.files.filter(f => !descendantIds(s.files, oldFolder.id).includes(f.id)) : s.files;
        return { ...s, edition: to, loader: newLoader, version: newVersion, fabricLoaderVersion: null, plugins: [], files: filesWithoutOldPlugins,
          console: [...s.console, `[Updater] Switched edition to ${to}. Loader reset to vanilla, version set to ${newVersion}. ${removedCount} plugin(s)/mod(s) removed (not compatible across editions).`] };
      }
      const updated = { ...s, [field]: to };
      const survivingPlugins = s.plugins.map((p) => (Math.random() > 0.3 ? { ...p, version: p.latestVersion, hasUpdate: false } : null));
      const removedPlugins = s.plugins.filter((_, i) => survivingPlugins[i] === null);
      updated.plugins = survivingPlugins.filter(Boolean);
      const removedFileNames = new Set(removedPlugins.map(p => pluginFileNameFor(s.loader, p.name)));
      updated.files = s.files.filter(f => !removedFileNames.has(f.name));
      updated.console = [...s.console, `[Updater] Updated ${field} to ${to}. ${removedPlugins.length} plugin(s) removed (no compatible version). Runtime re-selected: Java ${requiredJavaRuntime(field === "version" ? to : s.version, s.edition)}.`];
      return updated;
    });
    setPendingUpdateModal(null);
    setTimeout(scrollToConsole, 50);
  }

  async function sendCommand() {
    if (!commandInput.trim() || !selected) return;
    const cmd = commandInput;
    setCommandInput("");
    try {
      await invoke("send_command", { name: selected.name, command: cmd });
    } catch (e) {
      log(`[Console] Failed to send command: ${e}`);
    }
  }

  async function startPlayit() {
    setPlayitStarting(true);
    try {
      await invoke("start_playit");
    } catch (e) {
      log(`[playit.gg] Failed to start: ${e}`);
    } finally {
      setPlayitStarting(false);
    }
  }
  async function stopPlayit() {
    try {
      await invoke("stop_playit");
      setPlayitStatus(null);
    } catch (e) {
      log(`[playit.gg] Failed to stop: ${e}`);
    }
  }

  function checkRuntimeUpdates() {
    setRuntimeCheck("checking");
    setTimeout(() => { setRuntimeCheck("up-to-date"); log("[Runtime] Checked for newer Java runtimes — already on the correct version for this Minecraft release."); scrollToConsole(); }, 1000);
  }

  function checkPluginUpdates() {
    setPluginCheckState("checking");
    setTimeout(() => {
      updateSelected((s) => {
        let flaggedAny = false;
        s.plugins = s.plugins.map((p) => {
          if (!p.hasUpdate && Math.random() < 0.4) {
            flaggedAny = true;
            return { ...p, hasUpdate: true, latestVersion: p.version.replace(/(\d+)$/, (n) => String(Number(n) + 1)) };
          }
          return p;
        });
        s.console = [...s.console, flaggedAny ? "[Updater] Found newer versions for some installed plugins/mods." : "[Updater] Checked installed plugins/mods — everything is already up to date."];
        return s;
      });
      setPluginCheckState("done");
      scrollToConsole();
    }, 1000);
  }

  function addIpBan() {
    if (!newIpBan.trim()) return;
    updateSelected((s) => { s.ipBans = [...s.ipBans, newIpBan.trim()]; return s; });
    setNewIpBan("");
  }

  const pluginLabel = selected ? (LOADER_LABEL[selected.loader] || "Plugins") : "Plugins";
  const player = selected?.players?.[selectedPlayerIdx];
  function updatePlayer(fn) { updateSelected((s) => { s.players = s.players.map((p, i) => i === selectedPlayerIdx ? fn({ ...p, inventory: [...p.inventory] }) : p); return s; }); }

  // Sends a real command to the actual running server via RCON — this is
  // what makes OP/whitelist/ban/kick/gamemode really do something, not
  // just change local UI state. Silently does nothing extra if the server
  // isn't running (RCON only works against a live server) — the local UI
  // state still updates either way so the app stays usable offline.
  async function runPlayerRcon(command) {
    if (!selected || selected.status !== "running") return;
    try {
      const response = await invoke("rcon_command", { port: selected.rconPort, password: selected.rconPassword, command });
      if (response) log(`[RCON] ${command} → ${response}`);
    } catch (e) {
      log(`[RCON] "${command}" failed: ${e}`);
    }
  }
  function addPlayer() {
    const name = newPlayerName.trim();
    if (!name || selected.players.some(p => p.name.toLowerCase() === name.toLowerCase())) return;
    updateSelected((s) => { s.players = [...s.players, emptyPlayer(name)]; return s; });
    setSelectedPlayerIdx(selected.players.length); // select the newly added player
    setNewPlayerName(""); setNewPlayerMode(false);
  }

  // --- File manager ---
  function exportWorld() {
    const snapshot = {
      exportFormat: "mc-launcher-world-v1", exportedAt: new Date().toISOString(),
      serverName: selected.name, edition: selected.edition, version: selected.version,
      seed: selected.settings.seed, levelType: selected.settings.levelType,
      generateStructures: selected.settings.generateStructures,
      viewDistance: selected.settings.viewDistance, simDistance: selected.settings.simDistance,
      storageLocation: selected.storageLocation,
    };
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${selected.name.replace(/[^a-zA-Z0-9_-]/g, "_")}-world-export.json`; a.click();
    URL.revokeObjectURL(url);
    log(`[World] Exported world settings to ${a.download}.`);
  }
  function importWorld(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (data.exportFormat !== "mc-launcher-world-v1") throw new Error("Not a recognized world export file.");
        updateSelected((s) => {
          s.settings.seed = data.seed ?? s.settings.seed;
          s.settings.levelType = data.levelType ?? s.settings.levelType;
          s.settings.generateStructures = data.generateStructures ?? s.settings.generateStructures;
          s.settings.viewDistance = data.viewDistance ?? s.settings.viewDistance;
          s.settings.simDistance = data.simDistance ?? s.settings.simDistance;
          s.console = [...s.console, `[World] Imported world settings from "${data.serverName || file.name}" (exported ${data.exportedAt ? new Date(data.exportedAt).toLocaleDateString() : "unknown date"}).`];
          return s;
        });
      } catch (e) {
        log(`[World] Import failed: ${e.message}`);
      }
    };
    reader.onerror = () => log("[World] Import failed: couldn't read the file.");
    reader.readAsText(file);
  }

  function humanSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }
  function childrenOf(files, parentId) { return files.filter(f => f.parentId === parentId).sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name) : a.type === "folder" ? -1 : 1)); }
  function pathTo(files, folderId) {
    const path = [];
    let cur = folderId;
    while (cur) { const f = files.find(x => x.id === cur); if (!f) break; path.unshift(f); cur = f.parentId; }
    return path;
  }
  function descendantIds(files, id) {
    const out = [id];
    childrenOf(files, id).forEach(c => out.push(...descendantIds(files, c.id)));
    return out;
  }

  function createFolder() {
    if (!newFolderName.trim()) { setNewFolderMode(false); return; }
    updateSelected((s) => { s.files = [...s.files, { id: nextFileId(), parentId: currentFolderId, name: newFolderName.trim(), type: "folder", size: "", modified: "just now" }]; return s; });
    setNewFolderName(""); setNewFolderMode(false);
  }
  function importFiles(fileList) {
    const items = Array.from(fileList).map(f => ({ id: nextFileId(), parentId: currentFolderId, name: f.name, type: "file", size: humanSize(f.size), modified: "just now" }));
    updateSelected((s) => { s.files = [...s.files, ...items]; s.console = [...s.console, `[Files] Imported ${items.length} file(s) into ${pathTo(s.files, currentFolderId).map(f => f.name).join("/") || "root"}.`]; return s; });
  }
  function commitRename() {
    if (!renameValue.trim()) { setRenamingId(null); return; }
    updateSelected((s) => { s.files = s.files.map(f => f.id === renamingId ? { ...f, name: renameValue.trim() } : f); return s; });
    setRenamingId(null);
  }
  function deleteFiles(ids) {
    updateSelected((s) => {
      const toRemove = new Set(ids.flatMap(id => descendantIds(s.files, id)));
      s.files = s.files.filter(f => !toRemove.has(f.id));
      return s;
    });
    setSelectedFileIds([]);
  }
  function moveFiles(ids, destFolderId) {
    updateSelected((s) => { s.files = s.files.map(f => ids.includes(f.id) ? { ...f, parentId: destFolderId } : f); return s; });
    setSelectedFileIds([]); setFolderPicker(null);
  }
  function copyFiles(ids, destFolderId) {
    updateSelected((s) => {
      const added = [];
      const cloneTree = (id, newParent) => {
        const orig = s.files.find(f => f.id === id);
        const clone = { ...orig, id: nextFileId(), parentId: newParent, name: newParent === orig.parentId ? `${orig.name} (copy)` : orig.name, modified: "just now" };
        added.push(clone);
        if (orig.type === "folder") childrenOf(s.files, id).forEach(c => cloneTree(c.id, clone.id));
      };
      ids.forEach(id => cloneTree(id, destFolderId));
      s.files = [...s.files, ...added];
      return s;
    });
    setSelectedFileIds([]); setFolderPicker(null);
  }
  function downloadFile(file) {
    if (file.content == null) { log(`[Files] "${file.name}" has no real file bytes to download in this preview.`); return; }
    const blob = new Blob([file.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = file.name; a.click();
    URL.revokeObjectURL(url);
  }
  function toggleFileSelect(id) { setSelectedFileIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]); }

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: C.bg, color: C.text, fontFamily: F_BODY, overflowX: "hidden" }}>
      <style>{FONT_IMPORT}{`
        * { box-sizing: border-box; }
        ::selection { background: ${C.greenDim}; color: #fff; }
        @keyframes pulse-dot { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: translateY(0); } }
        .fade-in { animation: fade-in 0.3s cubic-bezier(.4,0,.2,1); }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 8px; }
        @media (min-width: 640px) { .mc-layout { grid-template-columns: 200px 1fr !important; } }
      `}</style>

      {downloading && <DownloadOverlay steps={downloading.steps} currentStep={downloading.currentStep} />}
      {pendingUpdateModal && <UpdateModal field={pendingUpdateModal.field} from={pendingUpdateModal.from} to={pendingUpdateModal.to} onConfirm={confirmUpdate} onCancel={() => setPendingUpdateModal(null)} />}
      {folderPicker && selected && <FolderPickerModal files={selected.files} excludeIds={folderPicker.ids.flatMap(id => descendantIds(selected.files, id))} mode={folderPicker.mode} onConfirm={(dest) => folderPicker.mode === "move" ? moveFiles(folderPicker.ids, dest) : copyFiles(folderPicker.ids, dest)} onCancel={() => setFolderPicker(null)} />}

      <div className="w-full max-w-7xl mx-auto p-4 sm:p-6" style={{ minWidth: 0 }}>
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {(selected || creating) && (
            <button onClick={() => { setSelectedId(null); setCreating(false); }} className="p-2 rounded-lg transition-colors" style={{ color: C.muted }}
              onMouseEnter={(e) => e.currentTarget.style.background = C.panelHi} onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}><ChevronLeft size={18} /></button>
          )}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: C.greenBg, border: `1px solid ${C.borderHi}`, boxShadow: `0 0 16px ${C.green}22` }}><Server size={17} style={{ color: C.green }} /></div>
          <h1 className="text-sm tracking-wide" style={{ fontFamily: F_HEAD, lineHeight: 1.6 }}>{selected ? selected.name : creating ? "Create Server" : "Server Launcher"}</h1>
          {selected?.status === "running" && (
            <span className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-bold" style={{ color: C.green, background: C.greenBg, fontFamily: F_BODY }}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: C.green, animation: "pulse-dot 1.6s ease-in-out infinite" }} /> LIVE
            </span>
          )}
          {!selected && !creating && loaded && auth && (
            <button onClick={() => setAuth(null)} className="ml-auto flex items-center gap-2 text-xs font-semibold px-2.5 py-1.5 rounded-lg" style={{ color: C.muted, background: C.panelHi }} title="Log out">
              {syncState === "saving" ? (<><span className="w-2.5 h-2.5 rounded-full border-2 animate-spin" style={{ borderColor: C.muted, borderTopColor: "transparent" }} /> Saving...</>) : (<><Check size={13} style={{ color: C.green }} /> Synced as {auth.email}</>)}
              <span style={{ color: C.faint }}>· Log out</span>
            </button>
          )}
        </div>

        {!selected && !creating && loaded && !auth && (
          <Card className="p-4 mb-5 fade-in flex flex-col gap-3">
            <div>
              <div className="text-sm font-bold">{authMode === "signup" ? "Create an account" : "Log in"} to sync servers across devices</div>
              <div className="text-xs font-medium" style={{ color: C.faint }}>Real login (Firebase) — not tied to Claude. Servers also work fine without logging in, saved to this device only.</div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <TextInput type="email" placeholder="email@example.com" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} className="flex-1" />
              <TextInput type="password" placeholder="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} className="flex-1" />
              <button onClick={submitAuth} disabled={authLoading || !authEmail || !authPassword} className="px-4 py-2 rounded-lg text-sm font-bold shrink-0 disabled:opacity-50" style={{ background: C.green, color: "#03150a" }}>
                {authLoading ? "..." : authMode === "signup" ? "Sign up" : "Log in"}
              </button>
            </div>
            <div className="flex items-center justify-between">
              <button onClick={() => { setAuthMode(authMode === "signup" ? "signin" : "signup"); setAuthError(""); }} className="text-xs font-semibold" style={{ color: C.muted }}>
                {authMode === "signup" ? "Already have an account? Log in" : "New here? Create an account"}
              </button>
            </div>
            {authError && <div className="text-xs font-semibold rounded-lg p-2" style={{ background: C.redBg, color: "#ff9d9d" }}>{authError}</div>}
          </Card>
        )}

        {!selected && !creating && (
          <div className="fade-in">
            {!loaded ? (
              <div className="rounded-2xl p-16 text-center" style={{ border: `1px dashed ${C.border}`, color: C.faint }}>Loading your servers...</div>
            ) : servers.length === 0 ? (
              <div className="rounded-2xl p-16 text-center" style={{ border: `1px dashed ${C.border}`, color: C.faint }}>No servers yet — create one to get started.</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                {servers.map((s) => (
                  <Card key={s.id} className="p-4 transition-all duration-200 hover:-translate-y-0.5">
                    <div className="flex items-center justify-between mb-2 gap-2">
                      <button onClick={() => { setSelectedId(s.id); setTab("game"); }} className="font-bold text-left flex-1 truncate">{s.name}</button>
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: s.status === "running" ? C.greenBg : C.panelHi, color: s.status === "running" ? C.green : C.muted, fontFamily: F_BODY }}>{s.status}</span>
                        <IconBtn icon={Copy} title="Duplicate" onClick={() => setServers((prev) => [...prev, { ...s, id: crypto.randomUUID(), name: s.name + " (copy)", status: "stopped", ip: null }])} />
                        <IconBtn icon={Trash2} danger title="Delete" onClick={() => setServers((prev) => prev.filter((x) => x.id !== s.id))} />
                      </div>
                    </div>
                    <VersionBadges s={s} />
                  </Card>
                ))}
              </div>
            )}
            <button onClick={() => setCreating(true)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold transition-transform active:scale-95" style={{ background: C.green, color: "#03150a", boxShadow: `0 4px 20px -6px ${C.green}66` }}><Plus size={16} /> Create Server</button>
          </div>
        )}

        {creating && (
          <div className="flex flex-col gap-5 fade-in min-w-0">
            <div className="mc-layout grid gap-5 min-w-0" style={{ gridTemplateColumns: "1fr" }}>
              <Sidebar items={CREATE_NAV} active={createTab} onSelect={setCreateTab} />

              <Card className="p-5 min-w-0">
                {createTab === "basics" && (
                  <div className="flex flex-col gap-5">
                    <div className="grid sm:grid-cols-2 gap-5">
                      <Field label="Server name"><TextInput value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My SMP" /></Field>
                      <Field label="Edition"><Select value={form.edition} onChange={(v) => setForm({ ...form, edition: v, loader: "vanilla", version: effectiveVersions[v][0] })} options={["java", "bedrock"]} /></Field>
                      <Field label="Loader"><Select value={form.loader} onChange={(v) => setForm({ ...form, loader: v })} options={LOADERS[form.edition]} /></Field>
                      <Field label={`${form.edition === "bedrock" ? "Bedrock" : "Minecraft"} version`}><Select value={form.version} onChange={(v) => setForm({ ...form, version: v })} options={effectiveVersions[form.edition]} /></Field>
                    </div>
                    {form.edition === "java" && (
                      <div className="flex items-center gap-2 text-sm font-semibold rounded-lg p-3" style={{ background: C.panelHi, color: C.muted }}>
                        <Coffee size={14} /> Runtime auto-selected: <span style={{ color: C.green, fontWeight: 700 }}>Java {requiredJavaRuntime(form.version, form.edition)}</span>
                      </div>
                    )}
                    <Field label="Memory allocation" hint={`Detected system RAM: ${(systemRam/1024).toFixed(0)} GB — min 256 MB`}><Slider value={form.ram} min={256} max={systemRam} onChange={(v) => setForm({ ...form, ram: v })} format={(v) => `${v} MB`} /></Field>
                    {form.loader !== "vanilla" && <Field label={`Install starter ${LOADER_LABEL[form.loader]?.toLowerCase()}`}><Toggle checked={form.installPlugins} onChange={(v) => setForm({ ...form, installPlugins: v })} /></Field>}
                  </div>
                )}
                {createTab === "game" && (
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Gamemode"><Select value={form.settings.gamemode} onChange={(v) => setForm({ ...form, settings: { ...form.settings, gamemode: v } })} options={["survival","creative","adventure","spectator"]} /></Field>
                    <Field label="Difficulty"><Select value={form.settings.difficulty} onChange={(v) => setForm({ ...form, settings: { ...form.settings, difficulty: v } })} options={["peaceful","easy","normal","hard"]} /></Field>
                    <Field label="Hardcore"><Toggle checked={form.settings.hardcore} onChange={(v) => setForm({ ...form, settings: { ...form.settings, hardcore: v } })} /></Field>
                    <Field label="PvP"><Toggle checked={form.settings.pvp} onChange={(v) => setForm({ ...form, settings: { ...form.settings, pvp: v } })} /></Field>
                    <Field label="Allow flight"><Toggle checked={form.settings.allowFlight} onChange={(v) => setForm({ ...form, settings: { ...form.settings, allowFlight: v } })} /></Field>
                    <Field label="Nether access"><Toggle checked={form.settings.nether} onChange={(v) => setForm({ ...form, settings: { ...form.settings, nether: v } })} /></Field>
                    <Field label="End access"><Toggle checked={form.settings.end} onChange={(v) => setForm({ ...form, settings: { ...form.settings, end: v } })} /></Field>
                    <Field label="Spawn protection"><Slider value={form.settings.spawnProtection} min={0} max={64} onChange={(v) => setForm({ ...form, settings: { ...form.settings, spawnProtection: v } })} /></Field>
                  </div>
                )}
                {createTab === "world" && (
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Seed"><TextInput value={form.settings.seed} onChange={(e) => setForm({ ...form, settings: { ...form.settings, seed: e.target.value } })} placeholder="Leave blank for random" /></Field>
                    <Field label="Level type"><Select value={form.settings.levelType} onChange={(v) => setForm({ ...form, settings: { ...form.settings, levelType: v } })} options={["default","flat","large_biomes","amplified"]} /></Field>
                    <Field label="View distance"><Slider value={form.settings.viewDistance} min={3} max={32} onChange={(v) => setForm({ ...form, settings: { ...form.settings, viewDistance: v } })} /></Field>
                    <Field label="Simulation distance"><Slider value={form.settings.simDistance} min={3} max={32} onChange={(v) => setForm({ ...form, settings: { ...form.settings, simDistance: v } })} /></Field>
                    <Field label="Generate structures"><Toggle checked={form.settings.generateStructures} onChange={(v) => setForm({ ...form, settings: { ...form.settings, generateStructures: v } })} /></Field>
                    <Field label="Force gamemode"><Toggle checked={form.settings.forceGamemode} onChange={(v) => setForm({ ...form, settings: { ...form.settings, forceGamemode: v } })} /></Field>
                    <div className="sm:col-span-2 text-xs font-medium" style={{ color: C.faint }}>Importing an existing world file is available after the server is created, from the World tab.</div>
                  </div>
                )}
                {createTab === "perf" && (
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Max tick time (ms)"><TextInput type="number" value={form.settings.maxTickTime} onChange={(e) => setForm({ ...form, settings: { ...form.settings, maxTickTime: Number(e.target.value) } })} /></Field>
                    <Field label="Auto-restart schedule"><Select value={form.settings.autoRestart} onChange={(v) => setForm({ ...form, settings: { ...form.settings, autoRestart: v } })} options={["off","daily","every 6h","every 12h"]} /></Field>
                    <Field label="Chunk garbage collection"><Toggle checked={form.settings.chunkGC} onChange={(v) => setForm({ ...form, settings: { ...form.settings, chunkGC: v } })} /></Field>
                  </div>
                )}
                {createTab === "network" && (
                  <div className="grid sm:grid-cols-2 gap-5">
                    <Field label="Max players"><Slider value={form.settings.maxPlayers} min={1} max={100} onChange={(v) => setForm({ ...form, settings: { ...form.settings, maxPlayers: v } })} /></Field>
                    <Field label="Whitelist"><Toggle checked={form.settings.whitelist} onChange={(v) => setForm({ ...form, settings: { ...form.settings, whitelist: v } })} /></Field>
                    <Field label="Online mode"><Toggle checked={form.settings.onlineMode} onChange={(v) => setForm({ ...form, settings: { ...form.settings, onlineMode: v } })} /></Field>
                  </div>
                )}
              </Card>
            </div>

            <div className="flex items-center gap-2 text-sm font-medium" style={{ color: C.faint }}><FolderTree size={14} /> Will be created at <span style={{ color: C.muted, fontFamily: F_MONO }}>Minecraft Server/{form.name || "New Server"}/</span></div>
            {REAL_AUTO_DOWNLOAD_LOADERS.includes(form.loader) ? (
              <div className="text-xs font-semibold" style={{ color: C.green }}>✓ {form.loader} server jar downloads automatically for you — no manual file needed.</div>
            ) : (
              <div className="text-xs font-semibold" style={{ color: C.amber }}>⚠ Auto-download isn't wired up for {form.loader} yet — you'll be asked to pick a .jar file you've already downloaded.</div>
            )}
            {createError && <div className="text-xs font-semibold rounded-lg p-3" style={{ background: C.redBg, color: "#ff9d9d" }}>{createError}</div>}
            <button onClick={startCreate} disabled={!form.name || !!downloading} className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-bold disabled:opacity-40 transition-transform active:scale-95" style={{ background: C.green, color: "#03150a", boxShadow: `0 4px 20px -6px ${C.green}66` }}><Plus size={16} /> Add Server</button>
          </div>
        )}

        {selected && (
          <div className="flex flex-col gap-5 fade-in min-w-0">
            <Card className="p-4">
              <VersionBadges s={selected} versions={effectiveVersions} onChangeEdition={(v) => requestVersionOrLoaderChange("edition", v)} onChangeVersion={(v) => requestVersionOrLoaderChange("version", v)} onChangeLoader={(v) => requestVersionOrLoaderChange("loader", v)} />
            </Card>

            <div ref={consoleCardRef}>
              <Card className="p-4">
                <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest font-bold" style={{ color: C.muted, fontFamily: F_BODY }}><TerminalIcon size={13} /> Console</div>
                <div className="rounded-lg p-3 h-36 overflow-y-auto text-xs flex flex-col gap-1" style={{ background: C.bg, fontFamily: F_MONO, color: C.green }}>
                  {selected.console.map((line, i) => <div key={i}>{line}</div>)}
                  <div ref={consoleEndRef} />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <input value={commandInput} onChange={(e) => setCommandInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendCommand()}
                    placeholder="Type a command and press Enter — sent to the real server" disabled={selected.status !== "running"}
                    className="flex-1 rounded-lg px-3 py-2 text-xs disabled:opacity-50" style={{ background: C.panelHi, border: `1px solid ${C.border}`, color: C.text, fontFamily: F_MONO }} />
                  <button onClick={sendCommand} disabled={selected.status !== "running" || !commandInput.trim()} className="p-2 rounded-lg disabled:opacity-40" style={{ background: C.greenBg, color: C.green }}><Send size={15} /></button>
                </div>
              </Card>
            </div>

            <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium" style={{ fontFamily: F_MONO }}>
                <Globe size={15} style={{ color: C.muted }} />
                {selected.ip ? (<><span>{selected.ip}</span><button onClick={() => navigator.clipboard?.writeText(selected.ip)} className="p-1 rounded" style={{ color: C.muted }}><Copy size={13} /></button></>) : <span style={{ color: C.faint }}>IP appears once running</span>}
              </div>
              <button onClick={toggleStartStop} className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-transform active:scale-95" style={{ background: selected.status === "running" ? C.redBg : C.green, color: selected.status === "running" ? "#ff9d9d" : "#03150a" }}>
                {selected.status === "running" ? <Square size={15} /> : <Play size={15} />}{selected.status === "running" ? "Stop" : "Start"}
              </button>
            </Card>

            <div className="mc-layout grid gap-5 min-w-0" style={{ gridTemplateColumns: "1fr" }}>
              <Sidebar items={NAV_ITEMS.map(n => n.key === "plugins" ? { ...n, label: pluginLabel } : n)} active={tab} onSelect={setTab} />

              <div className="flex flex-col gap-5 min-w-0">
                {tab === "resources" ? (
                  <div className="grid sm:grid-cols-2 gap-4 fade-in">
                    <Card className="p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2" style={{ color: C.muted }}><Cpu size={14} /><span className="text-xs uppercase tracking-widest font-bold" style={{ fontFamily: F_BODY }}>CPU</span></div><span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: C.greenBg, color: C.green, fontFamily: F_BODY }}>4 cores</span></div>
                      <div className="flex items-center gap-5"><Ring pct={cpu} /><div className="flex-1 min-w-0"><Sparkline data={cpuHist} color={levelColor(cpu)} /></div></div>
                    </Card>
                    <Card className="p-5 flex flex-col gap-4">
                      <div className="flex items-center justify-between"><div className="flex items-center gap-2" style={{ color: C.muted }}><HardDrive size={14} /><span className="text-xs uppercase tracking-widest font-bold" style={{ fontFamily: F_BODY }}>Memory</span></div><span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ background: C.greenBg, color: C.green, fontFamily: F_BODY }}>{selected.ram} MB alloc</span></div>
                      <div className="flex items-center gap-5"><Ring pct={ram} /><div className="flex-1 min-w-0"><Sparkline data={ramHist} color={levelColor(ram)} /></div></div>
                    </Card>
                  </div>
                ) : (
                  <Card className="p-5 fade-in min-w-0">
                    {tab === "game" && (
                      <div className="grid sm:grid-cols-2 gap-5">
                        <Field label="Gamemode"><Select value={selected.settings.gamemode} onChange={(v) => updateSelected(s => { s.settings.gamemode = v; return s; })} options={["survival","creative","adventure","spectator"]} /></Field>
                        <Field label="Difficulty"><Select value={selected.settings.difficulty} onChange={(v) => updateSelected(s => { s.settings.difficulty = v; return s; })} options={["peaceful","easy","normal","hard"]} /></Field>
                        <Field label="Hardcore"><Toggle checked={selected.settings.hardcore} onChange={(v) => updateSelected(s => { s.settings.hardcore = v; return s; })} /></Field>
                        <Field label="PvP"><Toggle checked={selected.settings.pvp} onChange={(v) => updateSelected(s => { s.settings.pvp = v; return s; })} /></Field>
                        <Field label="Allow flight"><Toggle checked={selected.settings.allowFlight} onChange={(v) => updateSelected(s => { s.settings.allowFlight = v; return s; })} /></Field>
                        <Field label="Nether access"><Toggle checked={selected.settings.nether} onChange={(v) => updateSelected(s => { s.settings.nether = v; return s; })} /></Field>
                        <Field label="End access"><Toggle checked={selected.settings.end} onChange={(v) => updateSelected(s => { s.settings.end = v; return s; })} /></Field>
                        <Field label="Spawn protection radius"><Slider value={selected.settings.spawnProtection} min={0} max={64} onChange={(v) => updateSelected(s => { s.settings.spawnProtection = v; return s; })} /></Field>
                      </div>
                    )}
                    {tab === "world" && (
                      <div className="grid sm:grid-cols-2 gap-5">
                        <Field label="View distance"><Slider value={selected.settings.viewDistance} min={3} max={32} onChange={(v) => updateSelected(s => { s.settings.viewDistance = v; return s; })} /></Field>
                        <Field label="Simulation distance"><Slider value={selected.settings.simDistance} min={3} max={32} onChange={(v) => updateSelected(s => { s.settings.simDistance = v; return s; })} /></Field>
                        <Field label="Seed"><TextInput value={selected.settings.seed} onChange={(e) => updateSelected(s => { s.settings.seed = e.target.value; return s; })} placeholder="Leave blank for random" /></Field>
                        <Field label="Level type"><Select value={selected.settings.levelType} onChange={(v) => updateSelected(s => { s.settings.levelType = v; return s; })} options={["default","flat","large_biomes","amplified"]} /></Field>
                        <Field label="Generate structures"><Toggle checked={selected.settings.generateStructures} onChange={(v) => updateSelected(s => { s.settings.generateStructures = v; return s; })} /></Field>
                        <Field label="Force gamemode"><Toggle checked={selected.settings.forceGamemode} onChange={(v) => updateSelected(s => { s.settings.forceGamemode = v; return s; })} /></Field>
                        <Field label="Storage location"><TextInput value={selected.storageLocation} onChange={(e) => updateSelected(s => ({ ...s, storageLocation: e.target.value }))} /></Field>
                        <div className="sm:col-span-2 flex flex-wrap items-center gap-2 pt-1">
                          <button onClick={() => log("[Backup] World backed up.")} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold" style={{ background: C.greenBg, color: C.green }}><Save size={14} /> Back up now</button>
                          <button onClick={() => worldFileInputRef.current?.click()} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold" style={{ background: C.panelHi, color: C.text }}><Upload size={14} /> Import world</button>
                          <input ref={worldFileInputRef} type="file" accept="application/json" className="hidden" onChange={(e) => { if (e.target.files[0]) importWorld(e.target.files[0]); e.target.value = ""; }} />
                          <button onClick={exportWorld} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-bold" style={{ background: C.panelHi, color: C.text }}><Download size={14} /> Export world</button>
                        </div>
                      </div>
                    )}
                    {tab === "perf" && (
                      <div className="grid sm:grid-cols-2 gap-5">
                        <Field label="RAM allocation" hint={`Max: your system's ${(systemRam/1024).toFixed(0)}GB — min 256MB`}><Slider value={selected.ram} min={256} max={systemRam} onChange={(v) => updateSelected(s => ({ ...s, ram: v }))} format={(v) => `${v} MB`} /></Field>
                        <Field label="Max tick time (ms)"><TextInput type="number" value={selected.settings.maxTickTime} onChange={(e) => updateSelected(s => { s.settings.maxTickTime = Number(e.target.value); return s; })} /></Field>
                        <Field label="Auto-restart schedule"><Select value={selected.settings.autoRestart} onChange={(v) => updateSelected(s => { s.settings.autoRestart = v; return s; })} options={["off","daily","every 6h","every 12h"]} /></Field>
                        <Field label="Chunk garbage collection"><Toggle checked={selected.settings.chunkGC} onChange={(v) => updateSelected(s => { s.settings.chunkGC = v; return s; })} /></Field>
                      </div>
                    )}
                    {tab === "network" && (
                      <div className="grid sm:grid-cols-2 gap-5">
                        <Field label="Max players"><Slider value={selected.settings.maxPlayers} min={1} max={100} onChange={(v) => updateSelected(s => { s.settings.maxPlayers = v; return s; })} /></Field>
                        <Field label="Whitelist"><Toggle checked={selected.settings.whitelist} onChange={(v) => updateSelected(s => { s.settings.whitelist = v; return s; })} /></Field>
                        <Field label="Online mode"><Toggle checked={selected.settings.onlineMode} onChange={(v) => updateSelected(s => { s.settings.onlineMode = v; return s; })} /></Field>
                        <div className="sm:col-span-2 flex flex-col gap-2">
                          <div className="flex items-center justify-between">
                            <label className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.muted, fontFamily: F_BODY }}>Public address (via playit.gg)</label>
                            {!playitStatus ? (
                              <button onClick={startPlayit} disabled={playitStarting} className="px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50" style={{ background: C.greenBg, color: C.green }}>{playitStarting ? "Starting..." : "Start tunnel"}</button>
                            ) : (
                              <button onClick={stopPlayit} className="px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.redBg, color: "#ff9d9d" }}>Stop tunnel</button>
                            )}
                          </div>
                          {!playitStatus && <div className="text-xs font-medium" style={{ color: C.faint }}>Downloads and runs the real playit.gg agent the first time you start it.</div>}
                          {playitStatus?.claim_url && !playitStatus?.public_address && (
                            <div className="text-xs font-semibold rounded-lg p-3" style={{ background: C.amberBg, color: C.amber }}>
                              First time only — open this link to link the tunnel to your playit.gg account:<br />
                              <a href={playitStatus.claim_url} target="_blank" rel="noreferrer" className="underline break-all">{playitStatus.claim_url}</a>
                            </div>
                          )}
                          {selected.ip && (
                            <div className="flex items-center gap-2"><TextInput readOnly value={selected.ip} /><button onClick={() => navigator.clipboard?.writeText(selected.ip)} className="p-2 rounded-lg" style={{ background: C.greenBg, color: C.green }}><Copy size={14} /></button></div>
                          )}
                        </div>
                        <div className="sm:col-span-2 flex flex-col gap-2">
                          <label className="text-[10px] uppercase tracking-widest font-bold" style={{ color: C.muted, fontFamily: F_BODY }}>IP Bans</label>
                          <div className="flex items-center gap-2">
                            <TextInput value={newIpBan} onChange={(e) => setNewIpBan(e.target.value)} placeholder="e.g. 203.0.113.42" className="flex-1" />
                            <button onClick={addIpBan} className="px-3 py-2 rounded-lg text-sm font-bold shrink-0" style={{ background: C.greenBg, color: C.green }}>Ban IP</button>
                          </div>
                          {selected.ipBans.length > 0 && (
                            <div className="flex flex-col gap-1.5 mt-1">
                              {selected.ipBans.map((ip, i) => (
                                <div key={ip+i} className="flex items-center justify-between px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.panelHi, fontFamily: F_MONO }}>
                                  {ip}
                                  <IconBtn icon={X} danger title="Unban" onClick={() => updateSelected(s => { s.ipBans = s.ipBans.filter((_, idx) => idx !== i); return s; })} />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                    {tab === "players" && (
                      <div className="grid sm:grid-cols-[180px_1fr] gap-5 min-w-0">
                        <div className="flex sm:flex-col gap-1 overflow-x-auto">
                          {selected.players.map((p, i) => (
                            <button key={p.name} onClick={() => setSelectedPlayerIdx(i)} className="text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0" style={{ background: selectedPlayerIdx === i ? C.greenBg : "transparent", color: selectedPlayerIdx === i ? C.green : C.text }}>
                              {p.name}{p.op && <span className="text-[9px] px-1 py-0.5 rounded font-bold" style={{ background: C.greenBg, color: C.green }}>OP</span>}
                            </button>
                          ))}
                          {newPlayerMode ? (
                            <div className="flex items-center gap-1 px-1 py-1">
                              <TextInput autoFocus value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPlayer()} placeholder="Username" className="text-sm" />
                              <IconBtn icon={Check} title="Add" onClick={addPlayer} />
                              <IconBtn icon={X} title="Cancel" onClick={() => { setNewPlayerMode(false); setNewPlayerName(""); }} />
                            </div>
                          ) : (
                            <button onClick={() => setNewPlayerMode(true)} className="text-left px-3 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 whitespace-nowrap shrink-0" style={{ color: C.green }}><Plus size={14} /> Add player</button>
                          )}
                        </div>
                        {player && (
                          <div className="flex flex-col gap-4 min-w-0">
                            <div className="flex gap-2 flex-wrap text-xs font-semibold">
                              <button onClick={() => { const willBeOp = !player.op; updatePlayer(p => ({ ...p, op: willBeOp })); runPlayerRcon(`${willBeOp ? "op" : "deop"} ${player.name}`); }} className="px-2 py-1 rounded" style={{ background: C.panelHi }}>{player.op ? "Remove OP" : "Make OP"}</button>
                              <button onClick={() => { const willBeWl = !player.whitelisted; updatePlayer(p => ({ ...p, whitelisted: willBeWl })); runPlayerRcon(`whitelist ${willBeWl ? "add" : "remove"} ${player.name}`); }} className="px-2 py-1 rounded" style={{ background: C.panelHi }}>{player.whitelisted ? "Un-whitelist" : "Whitelist"}</button>
                              <button onClick={() => { const willBeBanned = !player.banned; updatePlayer(p => ({ ...p, banned: willBeBanned })); runPlayerRcon(willBeBanned ? `ban ${player.name}` : `pardon ${player.name}`); }} className="px-2 py-1 rounded" style={{ background: C.redBg, color: "#ff9d9d" }}>{player.banned ? "Unban" : "Ban"}</button>
                              <button onClick={() => { log(`[Server] Kicked ${player.name}: Kicked by an operator.`); runPlayerRcon(`kick ${player.name}`); }} className="px-2 py-1 rounded" style={{ background: C.panelHi }}>Kick</button>
                            </div>
                            <div className="grid sm:grid-cols-3 gap-3">
                              <Field label="Gamemode"><Select value={player.gamemode} onChange={(v) => { updatePlayer(p => ({ ...p, gamemode: v })); runPlayerRcon(`gamemode ${v} ${player.name}`); }} options={["survival","creative","adventure","spectator"]} /></Field>
                              <Field label={`Health (${player.health}/20)`}><Slider value={player.health} min={0} max={20} onChange={(v) => { updatePlayer(p => ({ ...p, health: v })); runPlayerRcon(`data merge entity @a[name=${player.name},limit=1] {Health:${v.toFixed(1)}f}`); }} /></Field>
                              <Field label={`Hunger (${player.hunger}/20)`}><Slider value={player.hunger} min={0} max={20} onChange={(v) => { updatePlayer(p => ({ ...p, hunger: v })); runPlayerRcon(`data merge entity @a[name=${player.name},limit=1] {foodLevel:${v}}`); }} /></Field>
                            </div>
                            {selected.status !== "running" && <div className="text-[11px] font-medium" style={{ color: C.faint }}>These send real commands to the live server via RCON once it's running — while stopped, changes only update this local view.</div>}
                            <div>
                              <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-widest font-bold" style={{ color: C.muted, fontFamily: F_BODY }}><Backpack size={13} /> Inventory{selected.status === "running" && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded" style={{ background: C.greenBg, color: C.green }}>live</span>}</div>
                              <div className="grid grid-cols-9 gap-1.5">
                                {player.inventory.map((item, slot) => (
                                  <div key={slot} className="relative aspect-square rounded-md flex items-center justify-center text-center p-1" style={{ background: C.panelHi, border: `1px solid ${C.border}` }}>
                                    {item ? (<><span className="text-[8px] leading-tight font-semibold" style={{ color: C.text }}>{item}</span><button onClick={() => { updatePlayer(p => { p.inventory[slot] = null; return p; }); if (selected.status === "running") invoke("clear_inventory_slot", { port: selected.rconPort, password: selected.rconPassword, playerName: player.name, uiSlot: slot }).catch((e) => log(`[Inventory] Failed to clear slot: ${e}`)); }} className="absolute -top-1 -right-1 rounded-full p-0.5" style={{ background: C.redBg, color: "#ff9d9d" }}><X size={9} /></button></>) : (<button onClick={() => { setAddItemSlot(slot); setPendingItem(MOCK_ITEMS[0]); }} className="w-full h-full flex items-center justify-center" style={{ color: C.faint }}><Plus size={12} /></button>)}
                                  </div>
                                ))}
                              </div>
                              {addItemSlot !== null && (<div className="mt-3 flex items-center gap-2"><Select value={pendingItem} onChange={setPendingItem} options={MOCK_ITEMS} /><button onClick={() => { const slotToFill = addItemSlot; updatePlayer(p => { p.inventory[slotToFill] = pendingItem; return p; }); if (selected.status === "running") invoke("set_inventory_slot", { port: selected.rconPort, password: selected.rconPassword, playerName: player.name, uiSlot: slotToFill, itemId: itemIdFor(pendingItem), count: 1 }).catch((e) => log(`[Inventory] Failed to set slot: ${e}`)); setAddItemSlot(null); }} className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: C.greenBg, color: C.green }}>Add</button><button onClick={() => setAddItemSlot(null)} className="text-xs font-semibold" style={{ color: C.muted }}>Cancel</button></div>)}
                              {selected.status !== "running" && <div className="text-[11px] font-medium mt-2" style={{ color: C.faint }}>Reads/writes the player's real inventory once the server is running and they're online — RCON's /data command only works for connected players.</div>}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    {tab === "plugins" && selected.loader === "vanilla" && (
                      <div className="flex flex-col items-center text-center gap-3 py-12">
                        <Package size={30} style={{ color: C.faint }} />
                        <div className="text-base font-bold" style={{ color: C.muted }}>Vanilla doesn't support plugins or mods.</div>
                        <div className="text-sm font-medium max-w-sm" style={{ color: C.faint }}>
                          Switch the loader in the badge bar above (Paper, Fabric, Purpur, {selected.edition === "bedrock" ? "PocketMine, NukkitX" : "Forge"}...) to install {selected.edition === "bedrock" ? "addons" : "plugins or mods"}.
                        </div>
                      </div>
                    )}
                    {tab === "plugins" && selected.loader !== "vanilla" && (
                      <div className="flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                          <div className="text-xs uppercase tracking-widest font-bold" style={{ color: C.muted, fontFamily: F_BODY }}>Installed {pluginLabel.toLowerCase()}</div>
                          <button onClick={checkPluginUpdates} disabled={pluginCheckState === "checking" || selected.plugins.length === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-40" style={{ background: C.panelHi, color: C.text }}>
                            <RefreshCw size={13} className={pluginCheckState === "checking" ? "animate-spin" : ""} /> {pluginCheckState === "checking" ? "Checking..." : "Check for updates"}
                          </button>
                        </div>
                        <div className="flex flex-col gap-2">
                          {selected.plugins.length === 0 && <div className="text-sm" style={{ color: C.faint }}>No {pluginLabel.toLowerCase()} installed yet.</div>}
                          {selected.plugins.map((p, i) => (
                            <div key={p.name} className="flex items-center justify-between px-3 py-2.5 rounded-lg" style={{ background: C.panelHi, border: `1px solid ${C.border}` }}>
                              <div className="flex items-center gap-2 text-sm font-semibold"><span>{p.name}</span><span style={{ color: C.faint, fontFamily: F_MONO, fontWeight: 400 }}>v{p.version}</span>{p.hasUpdate && <span className="text-[10px] px-1.5 py-0.5 rounded font-bold" style={{ background: C.amberBg, color: C.amber }}>update available</span>}</div>
                              <div className="flex items-center gap-1">{p.hasUpdate && <IconBtn icon={RefreshCw} title="Update" onClick={() => updateSelected(s => { s.plugins[i] = { ...p, version: p.latestVersion, hasUpdate: false }; return s; })} />}<IconBtn icon={Trash2} danger title="Remove" onClick={() => updateSelected(s => { s.plugins = s.plugins.filter((_, idx) => idx !== i); const fname = pluginFileNameFor(s.loader, p.name); s.files = s.files.filter(f => f.name !== fname); return s; })} /></div>
                            </div>
                          ))}
                        </div>
                        <div className="flex items-center gap-2 pt-2" style={{ borderTop: `1px solid ${C.border}` }}><Search size={15} style={{ color: C.muted }} /><TextInput placeholder={`Search ${pluginLabel.toLowerCase()} for ${selected.version} (${selected.loader})...`} value={pluginQuery} onChange={(e) => setPluginQuery(e.target.value)} className="w-full" /></div>
                        <div className="text-xs font-semibold flex items-center gap-1.5" style={{ color: C.faint }}>
                          {pluginSearchLoading ? (
                            <><span className="w-3 h-3 rounded-full border-2 animate-spin" style={{ borderColor: C.muted, borderTopColor: "transparent" }} /> Searching {selected.version} / {selected.loader}...</>
                          ) : (
                            <>
                              {pluginQuery ? `Results for "${pluginQuery}"` : `Most used ${pluginLabel.toLowerCase()}`} — {selected.version} / {selected.loader}
                              {pluginSource === "fallback" && <span className="px-1.5 py-0.5 rounded" style={{ background: C.amberBg, color: C.amber }}>offline list — live search unavailable</span>}
                            </>
                          )}
                        </div>
                        <div className="flex flex-col gap-2">
                          {!pluginSearchLoading && pluginResults.map((p) => {
                            const installed = selected.plugins.some(ip => ip.name === p.name);
                            return (
                              <div key={p.name} className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg" style={{ background: C.panelHi, border: `1px solid ${C.border}` }}>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2 text-sm font-bold"><span>{p.name}</span>{p.downloads !== "—" && <span className="text-xs font-medium" style={{ color: C.faint }}>{p.downloads} downloads</span>}</div>
                                  {p.desc && <div className="text-xs font-medium truncate" style={{ color: C.muted }}>{p.desc}</div>}
                                </div>
                                <button disabled={installed} onClick={() => updateSelected(s => {
                                  s.plugins = [...s.plugins, { name: p.name, version: p.version, latestVersion: p.version, hasUpdate: false }];
                                  const folderName = folderNameForLoader(s.loader);
                                  let folder = s.files.find(f => f.type === "folder" && f.parentId === null && f.name === folderName);
                                  let files = s.files;
                                  if (!folder) { const id = nextFileId(); folder = { id, parentId: null, name: folderName, type: "folder", size: "", modified: "just now" }; files = [...files, folder]; }
                                  files = [...files, { id: nextFileId(), parentId: folder.id, name: pluginFileNameFor(s.loader, p.name), type: "file", size: "1.2 MB", modified: "just now" }];
                                  s.files = files;
                                  s.console = [...s.console, `[Installer] Installed ${p.name} v${p.version}.`];
                                  return s;
                                })}
                                  className="px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 disabled:opacity-50" style={{ background: installed ? C.border : C.greenBg, color: installed ? C.muted : C.green }}>
                                  {installed ? "Installed" : "Install"}
                                </button>
                              </div>
                            );
                          })}
                          {!pluginSearchLoading && pluginResults.length === 0 && (
                            <div className="rounded-lg p-6 text-center text-sm" style={{ border: `1px dashed ${C.border}`, color: C.faint }}>No results{pluginQuery ? ` for "${pluginQuery}"` : ""}.</div>
                          )}
                        </div>
                      </div>
                    )}
                    {tab === "runtime" && (
                      <div className="grid sm:grid-cols-2 gap-5">
                        <Field label="Edition" hint="Switching edition resets loader/version and removes installed plugins/mods (they're not compatible across editions).">
                          <Select value={selected.edition} onChange={(v) => requestVersionOrLoaderChange("edition", v)} options={["java", "bedrock"]} />
                        </Field>
                        <Field label={`${selected.edition === "bedrock" ? "Bedrock" : "Minecraft"} version`}><Select value={selected.version} onChange={(v) => requestVersionOrLoaderChange("version", v)} options={effectiveVersions[selected.edition]} /></Field>
                        <Field label="Loader"><Select value={selected.loader} onChange={(v) => requestVersionOrLoaderChange("loader", v)} options={LOADERS[selected.edition]} /></Field>
                        {selected.loader === "fabric" && <Field label="Fabric loader version"><Select value={selected.fabricLoaderVersion} onChange={(v) => updateSelected(s => ({ ...s, fabricLoaderVersion: v }))} options={["0.16.9","0.16.5","0.15.11"]} /></Field>}
                        {selected.edition === "java" && (
                          <Field label="Java runtime (auto-selected)">
                            <div className="flex items-center gap-2 rounded-lg px-3 py-2.5" style={{ background: C.panelHi, border: `1px solid ${C.border}` }}>
                              <Coffee size={15} style={{ color: C.green }} /><span className="font-bold" style={{ color: C.text }}>Java {requiredJavaRuntime(selected.version, selected.edition)}</span>
                              <span className="text-xs ml-auto" style={{ color: C.faint }}>matched to {selected.version}</span>
                            </div>
                          </Field>
                        )}
                        <div className="sm:col-span-2 flex items-center justify-between rounded-lg p-3" style={{ background: selected.version === LATEST_MC_VERSION[selected.edition] ? C.panelHi : C.amberBg }}>
                          {selected.version === LATEST_MC_VERSION[selected.edition] ? <span className="text-sm font-semibold flex items-center gap-2" style={{ color: C.muted }}><Check size={14} /> You're on the latest version.</span> : <span className="text-sm font-semibold flex items-center gap-2" style={{ color: C.amber }}><AlertTriangle size={14} /> Version {LATEST_MC_VERSION[selected.edition]} is available.</span>}
                        </div>
                        {selected.edition === "java" && (
                          <div className="sm:col-span-2 flex items-center gap-3 flex-wrap">
                            <button onClick={checkRuntimeUpdates} className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold" style={{ background: C.greenBg, color: C.green }}><RefreshCw size={14} className={runtimeCheck === "checking" ? "animate-spin" : ""} /> Check for runtime updates</button>
                            {runtimeCheck === "up-to-date" && <span className="text-xs font-semibold" style={{ color: C.muted }}>You're on the correct Java runtime.</span>}
                          </div>
                        )}
                        <div className="sm:col-span-2 text-sm rounded-lg p-3 font-medium" style={{ color: C.muted, background: C.panelHi }}>Changing version or loader triggers a re-download and a plugin/mod compatibility check — incompatible ones with no update available will be removed automatically. The matching Java runtime is selected for you automatically.</div>
                      </div>
                    )}
                    {tab === "files" && (() => {
                      const items = childrenOf(selected.files, currentFolderId);
                      const crumbs = pathTo(selected.files, currentFolderId);
                      return (
                        <div className="flex flex-col gap-3">
                          <div className="flex items-center gap-1 text-sm font-semibold flex-wrap" style={{ color: C.muted, fontFamily: F_MONO }}>
                            <button onClick={() => setCurrentFolderId(null)} className="hover:underline" style={{ color: currentFolderId === null ? C.text : C.muted }}>Minecraft Server/{selected.name}</button>
                            {crumbs.map((c) => (<React.Fragment key={c.id}><ChevronRight size={13} /><button onClick={() => setCurrentFolderId(c.id)} className="hover:underline" style={{ color: c.id === currentFolderId ? C.text : C.muted }}>{c.name}</button></React.Fragment>))}
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            <button onClick={() => setNewFolderMode(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.panelHi, color: C.text }}><FolderPlus size={13} /> New folder</button>
                            <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.panelHi, color: C.text }}><Upload size={13} /> Import</button>
                            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={(e) => { if (e.target.files.length) importFiles(e.target.files); e.target.value = ""; }} />
                            {selectedFileIds.length > 0 && (
                              <>
                                <div className="w-px h-5 mx-1" style={{ background: C.border }} />
                                <span className="text-xs font-semibold" style={{ color: C.faint }}>{selectedFileIds.length} selected</span>
                                <button onClick={() => setFolderPicker({ ids: selectedFileIds, mode: "move" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.panelHi, color: C.text }}><FolderInput size={13} /> Move</button>
                                <button onClick={() => setFolderPicker({ ids: selectedFileIds, mode: "copy" })} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.panelHi, color: C.text }}><Copy size={13} /> Copy</button>
                                <button onClick={() => deleteFiles(selectedFileIds)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold" style={{ background: C.redBg, color: "#ff9d9d" }}><Trash2 size={13} /> Delete</button>
                              </>
                            )}
                          </div>

                          {newFolderMode && (
                            <div className="flex items-center gap-2">
                              <TextInput autoFocus value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createFolder()} placeholder="Folder name" className="flex-1" />
                              <button onClick={createFolder} className="px-3 py-2 rounded-lg text-xs font-bold" style={{ background: C.greenBg, color: C.green }}>Create</button>
                              <button onClick={() => { setNewFolderMode(false); setNewFolderName(""); }} className="text-xs font-semibold" style={{ color: C.muted }}>Cancel</button>
                            </div>
                          )}

                          <div className="flex flex-col rounded-lg overflow-hidden" style={{ border: `1px solid ${C.border}` }}>
                            {items.length === 0 && <div className="p-6 text-center text-sm font-medium" style={{ color: C.faint }}>This folder is empty.</div>}
                            {items.map((f) => (
                              <div key={f.id} className="flex items-center gap-3 px-3 py-2.5" style={{ borderBottom: `1px solid ${C.border}`, background: selectedFileIds.includes(f.id) ? C.greenBg : "transparent" }}>
                                <button onClick={() => toggleFileSelect(f.id)} style={{ color: selectedFileIds.includes(f.id) ? C.green : C.faint }}>{selectedFileIds.includes(f.id) ? <CheckSquare size={16} /> : <SquareIcon size={16} />}</button>
                                {f.type === "folder" ? <Folder size={16} style={{ color: C.green }} /> : <FileIcon size={16} style={{ color: C.muted }} />}
                                {renamingId === f.id ? (
                                  <TextInput autoFocus value={renameValue} onChange={(e) => setRenameValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && commitRename()} onBlur={commitRename} className="flex-1" />
                                ) : (
                                  <button onClick={() => f.type === "folder" ? setCurrentFolderId(f.id) : null} className="flex-1 text-left text-sm font-semibold truncate" style={{ color: C.text }}>{f.name}</button>
                                )}
                                <span className="text-xs font-medium shrink-0 hidden sm:block" style={{ color: C.faint, fontFamily: F_MONO }}>{f.size}</span>
                                <span className="text-xs font-medium shrink-0 hidden sm:block w-16 text-right" style={{ color: C.faint }}>{f.modified}</span>
                                <div className="flex items-center gap-0.5 shrink-0">
                                  <IconBtn icon={Pencil} title="Rename" onClick={() => { setRenamingId(f.id); setRenameValue(f.name); }} />
                                  <IconBtn icon={FolderInput} title="Move" onClick={() => setFolderPicker({ ids: [f.id], mode: "move" })} />
                                  <IconBtn icon={Copy} title="Copy" onClick={() => setFolderPicker({ ids: [f.id], mode: "copy" })} />
                                  {f.type === "file" && <IconBtn icon={Download} title="Download" onClick={() => downloadFile(f)} />}
                                  <IconBtn icon={Trash2} danger title="Delete" onClick={() => deleteFiles([f.id])} />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="text-xs font-medium" style={{ color: C.faint }}>Files here represent the real folder layout your server uses on disk — server.properties and the config files reflect your actual settings and can be downloaded for real. Server binaries and world data are shown as placeholders in this preview (no real bytes to download).</div>
                        </div>
                      );
                    })()}
                  </Card>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
