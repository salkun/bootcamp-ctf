"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

interface Game {
  id: string;
  name: string;
  difficulty?: string;
  base_poin?: number;
}

interface Group {
  id: string;
  name: string;
  pin: string;
  score: number;
  games?: { name: string } | null;
}

export default function AdminDashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  
  // === STATE HYDRATION FIX ===
  const [isMounted, setIsMounted] = useState(false);
  
  // === STATE LOGIN ADMIN ===
  const [isAuthenticated, setIsAuthenticated] = useState(() =>
    typeof window !== "undefined" &&
    window.sessionStorage.getItem("adminAuth") === "true"
  );
  const [authForm, setAuthForm] = useState({ username: "", password: "" });
  const [authError, setAuthError] = useState("");

  // State form Kelompok
  const [newGroupName, setNewGroupName] = useState("");
  const [selectedGame, setSelectedGame] = useState("");
  const [loadingGroup, setLoadingGroup] = useState(false);

  // State form Game
  const [newGameName, setNewGameName] = useState("");
  const [newGameDifficulty, setNewGameDifficulty] = useState("easy");
  const [newGameBasePoin, setNewGameBasePoin] = useState(20);
  const [loadingGame, setLoadingGame] = useState(false);

  const refreshGroupsData = async () => {
    const { data: groupsData } = await supabase
      .from("groups")
      .select("*, games(name)")
      .order("name", { ascending: true });
    if (groupsData) setGroups(groupsData as Group[]);
  };

  const refreshGamesData = async () => {
    const { data: gamesData } = await supabase
      .from("games")
      .select("*")
      .order("name", { ascending: true });
    if (gamesData) setGames(gamesData as Game[]);
  };

  useEffect(() => {
    // Gunakan setTimeout untuk menghindari error cascading renders dari linter
    const hydrationTimeout = setTimeout(() => {
      setIsMounted(true);
      if (sessionStorage.getItem("adminAuth") === "true") {
        setIsAuthenticated(true);
      }
    }, 0);

    const loadInitialData = async () => {
      await refreshGamesData();
      await refreshGroupsData();
    };
    loadInitialData();

    // Bersihkan timeout jika komponen unmount
    return () => clearTimeout(hydrationTimeout);
  }, []);

  // === LOGIKA LOGIN DUMMY ===
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (authForm.username === "admin" && authForm.password === "admin123") {
      setIsAuthenticated(true);
      sessionStorage.setItem("adminAuth", "true");
      setAuthError("");
    } else {
      setAuthError("AKSES DITOLAK: Username atau password salah!");
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem("adminAuth");
    setAuthForm({ username: "", password: "" });
  };  

  // Handler Tambah Kelompok
  const handleAddGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingGroup(true);

    const pin = Math.floor(1000 + Math.random() * 9000).toString();
    const sessionId = '11111111-1111-1111-1111-111111111111';

    const { error } = await supabase.from("groups").insert([
      { name: newGroupName, game_id: selectedGame, pin: pin, session_id: sessionId }
    ]);

    if (error) {
      alert("❌ Gagal menambah kelompok");
      console.error(error);
    } else {
      setNewGroupName("");
      setSelectedGame("");
      await refreshGroupsData();
    }
    setLoadingGroup(false);
  };

  const handleDeleteGroup = async (id: string) => {
    if (!confirm("Yakin ingin menghapus kelompok ini?")) return;
    await supabase.from("groups").delete().eq("id", id);
    await refreshGroupsData();
  };

  // Handler Reset Poin
  const handleResetScore = async (id: string) => {
    if (!confirm("Yakin ingin mereset skor dan progress tim ini kembali ke 0?")) return;
    
    const { error } = await supabase
      .from("groups")
      .update({ score: 0, completed_tasks: 0 })
      .eq("id", id);

    if (error) {
      alert("❌ Gagal mereset skor");
      console.error(error);
    } else {
      await refreshGroupsData();
      alert("✅ Skor berhasil direset!");
    }
  };

  // Handler Tambah Game
  const handleAddGame = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingGame(true);

    const { data: gameData, error: gameError } = await supabase
      .from("games")
      .insert([{ name: newGameName, difficulty: newGameDifficulty, base_poin: Number(newGameBasePoin) }])
      .select()
      .single();

    if (gameError || !gameData) {
      alert("❌ Gagal menambah game");
      setLoadingGame(false);
      return;
    }

    try {
      const aiResponse = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gameName: newGameName })
      });
      
      const generatedTasks = await aiResponse.json();

      if (generatedTasks.error || !Array.isArray(generatedTasks)) {
         console.error("Gagal generate:", generatedTasks);
         alert("⚠️ Game tersimpan, tapi AI gagal membuat task. Cek terminal VS Code.");
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tasksToInsert = generatedTasks.map((t: any) => ({
          game_id: gameData.id,
          task_number: t.task_number,
          title: t.title,
          requirements: t.reqs || t.requirements || ["Instruksi tidak valid"]
        }));

        await supabase.from("tasks").insert(tasksToInsert);
        alert("✅ Game dan Task otomatis AI berhasil ditambahkan!");
      }
    } catch (err) {
      console.error(err);
      alert("⚠️ Game tersimpan, tapi sistem AI gagal terhubung.");
    }

    setNewGameName("");
    setNewGameDifficulty("easy");
    setNewGameBasePoin(20);
    await refreshGamesData();
    setLoadingGame(false);
  };

  const handleDeleteGame = async (id: string) => {
    if (!confirm("Yakin ingin menghapus game ini? Pastikan tidak ada kelompok yang memakainya.")) return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) {
      alert("❌ Gagal menghapus. Mungkin game masih terikat relasi kelompok.");
    } else {
      await refreshGamesData();
    }
  };

  // === UI LOGIN ===
  if (!isMounted) return null;
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brutal-bg flex items-center justify-center p-4 [background-size:20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]">
        <form onSubmit={handleLogin} className="bg-white border-8 border-black p-8 md:p-12 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-md w-full transform -skew-x-2">
          <h1 className="text-4xl font-black uppercase mb-2 text-center">Admin Panel</h1>
          <p className="text-center font-bold mb-8 border-b-4 border-black pb-4">CTF ARENA CONTROL</p>
          
          <div className="space-y-6">
            <div>
              <label className="block font-black text-xl mb-2 uppercase">Username</label>
              <input 
                type="text" required
                value={authForm.username}
                onChange={(e) => setAuthForm({...authForm, username: e.target.value})}
                className="w-full p-4 border-4 border-black font-bold text-lg bg-brutal-pink focus:outline-none focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block font-black text-xl mb-2 uppercase">Password</label>
              <input 
                type="password" required
                value={authForm.password}
                onChange={(e) => setAuthForm({...authForm, password: e.target.value})}
                className="w-full p-4 border-4 border-black font-bold text-lg bg-brutal-yellow focus:outline-none focus:bg-white transition-colors"
              />
            </div>
          </div>

          {authError && (
            <div className="mt-6 bg-red-500 border-4 border-black p-3 text-white font-black uppercase text-center animate-pulse">
              {authError}
            </div>
          )}

          <button type="submit" className="w-full mt-8 bg-brutal-blue border-4 border-black p-4 text-2xl font-black uppercase hover:bg-brutal-green transition-colors shadow-brutal">
            Masuk Sistem 🚀
          </button>
        </form>
      </div>
    );
  }

  // === UI DASHBOARD UTAMA ===
  return (
    <div className="min-h-screen bg-brutal-bg p-8 [background-size:20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]">
      <header className="bg-black text-white p-6 border-4 border-black shadow-brutal-lg mb-8 transform -skew-x-1 flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-4xl font-black uppercase">⚙️ Control Panel Admin</h1>
          <p className="font-bold text-brutal-yellow mt-2">Manajemen Sesi Bootcamp ICT</p>
        </div>
        <button 
          onClick={handleLogout}
          className="bg-brutal-pink text-black px-8 py-3 font-black uppercase hover:bg-white border-4 border-black skew-x-2 shadow-[8px_8px_0px_0px_rgba(255,255,255,0.3)] transition-all"
        >
          Logout
        </button>
      </header>

      {/* SECTION 1: MANAJEMEN KELOMPOK */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-brutal-pink border-4 border-black shadow-brutal p-6 h-fit">
          <h2 className="text-2xl font-black uppercase mb-4 border-b-4 border-black pb-2 bg-white inline-block px-2">
            ➕ Tambah Tim
          </h2>
          <form onSubmit={handleAddGroup} className="space-y-4">
            <div>
              <label className="block font-bold mb-1">Nama Kelompok</label>
              <input 
                type="text" required value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Misal: Tim Alpha"
                className="w-full p-3 font-bold bg-white border-2 border-black"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Assign Game</label>
              <select 
                required value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                className="w-full p-3 font-bold bg-white border-2 border-black cursor-pointer"
              >
                <option value="" disabled>-- Pilih Game --</option>
                {games.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>
            <button 
              type="submit" disabled={loadingGroup}
              className="w-full bg-brutal-yellow border-4 border-black p-3 text-xl font-black uppercase hover:bg-white shadow-brutal-sm disabled:bg-gray-400"
            >
              {loadingGroup ? "Menyimpan..." : "Buat Tim & PIN"}
            </button>
          </form>
        </div>

        <div className="md:col-span-2 bg-white border-4 border-black shadow-brutal p-6">
          <h2 className="text-2xl font-black uppercase mb-4 bg-brutal-green inline-block px-2 border-2 border-black">
            📋 Daftar Peserta Aktif
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse border-4 border-black">
              <thead>
                <tr className="bg-black text-white text-left uppercase font-black text-sm">
                  <th className="p-3 border-2 border-black">Nama Tim</th>
                  <th className="p-3 border-2 border-black">Game Assigned</th>
                  <th className="p-3 border-2 border-black text-center">PIN</th>
                  <th className="p-3 border-2 border-black text-center">Skor</th>
                  <th className="p-3 border-2 border-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {groups.map((group) => (
                  <tr key={group.id} className="hover:bg-brutal-bg">
                    <td className="p-3 border-2 border-black">{group.name}</td>
                    <td className="p-3 border-2 border-black">{group.games?.name}</td>
                    <td className="p-3 border-2 border-black text-center text-2xl tracking-widest text-brutal-blue text-stroke">{group.pin}</td>
                    <td className="p-3 border-2 border-black text-center">{group.score}</td>
                    <td className="p-3 border-2 border-black text-center">
                      <div className="flex justify-center gap-2">
                        <button 
                          onClick={() => handleResetScore(group.id)} 
                          className="bg-brutal-yellow text-black px-3 py-1 border-2 border-black font-black uppercase hover:bg-white text-sm"
                        >
                          Reset
                        </button>
                        <button 
                          onClick={() => handleDeleteGroup(group.id)} 
                          className="bg-red-500 text-white px-3 py-1 border-2 border-black font-black uppercase hover:bg-red-600 text-sm"
                        >
                          Hapus
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 2: MANAJEMEN GAME */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="bg-brutal-blue border-4 border-black shadow-brutal p-6 h-fit">
          <h2 className="text-2xl font-black uppercase mb-4 border-b-4 border-black pb-2 bg-white inline-block px-2">
            🎮 Tambah Game
          </h2>
          <form onSubmit={handleAddGame} className="space-y-4">
            <div>
              <label className="block font-bold mb-1">Nama Game</label>
              <input 
                type="text" required value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Misal: Snake Game"
                className="w-full p-3 font-bold bg-white border-2 border-black"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Level</label>
                <select 
                  value={newGameDifficulty} onChange={(e) => setNewGameDifficulty(e.target.value)}
                  className="w-full p-3 font-bold bg-white border-2 border-black"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                  <option value="very hard">Very Hard</option>
                </select>
              </div>
              <div>
                <label className="block font-bold mb-1">Base Poin</label>
                <input 
                  type="number" required value={newGameBasePoin}
                  onChange={(e) => setNewGameBasePoin(Number(e.target.value))}
                  className="w-full p-3 font-bold bg-white border-2 border-black"
                />
              </div>
            </div>
            <button 
              type="submit" disabled={loadingGame}
              className="w-full bg-brutal-yellow border-4 border-black p-3 text-xl font-black uppercase hover:bg-white shadow-brutal-sm disabled:bg-gray-400"
            >
              {loadingGame ? "AI Sedang Mengetik..." : "Simpan Game"}
            </button>
          </form>
        </div>

        <div className="md:col-span-2 bg-white border-4 border-black shadow-brutal p-6">
          <h2 className="text-2xl font-black uppercase mb-4 bg-brutal-yellow inline-block px-2 border-2 border-black">
            🕹️ Daftar Game Tersedia
          </h2>
          <div className="overflow-x-auto max-h-[400px]">
            <table className="w-full border-collapse border-4 border-black">
              <thead>
                <tr className="bg-black text-white text-left uppercase font-black text-sm">
                  <th className="p-3 border-2 border-black">Nama Game</th>
                  <th className="p-3 border-2 border-black text-center">Level</th>
                  <th className="p-3 border-2 border-black text-center">Poin</th>
                  <th className="p-3 border-2 border-black text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {games.map((game) => (
                  <tr key={game.id} className="hover:bg-brutal-bg">
                    <td className="p-3 border-2 border-black">{game.name}</td>
                    <td className="p-3 border-2 border-black text-center uppercase">{game.difficulty}</td>
                    <td className="p-3 border-2 border-black text-center">{game.base_poin}</td>
                    <td className="p-3 border-2 border-black text-center">
                      <button onClick={() => handleDeleteGame(game.id)} className="bg-red-500 text-white px-3 py-1 border-2 border-black font-black uppercase hover:bg-red-600 text-sm">Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}