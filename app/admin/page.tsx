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
  game_id?: string;
  games?: { name: string } | null;
}

interface Task {
  id?: string;
  game_id: string;
  task_number: number;
  title: string;
  requirements: string[] | string;
}

interface Submission {
  id: string;
  group_id: string;
  game_id: string;
  task_number: number;
  code_content: string;
  validation_status: string;
  feedback?: string;
  submitted_at?: string;
  groups?: { name: string; game_id?: string } | null;
}

type FilterStatus = "all" | "pending" | "approved" | "rejected";

export default function AdminDashboard() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [games, setGames] = useState<Game[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  // === STATE HYDRATION FIX ===
  const [isMounted, setIsMounted] = useState(false);

  // === STATE LOGIN ADMIN ===
  const [isAuthenticated, setIsAuthenticated] = useState(
    () =>
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

  // State Tasks / Hint
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);

  // State Validasi
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Helper parser requirements / hint
  const parseRequirements = (reqs: unknown): string[] => {
    if (!reqs) return [];
    if (Array.isArray(reqs)) return reqs.map((r) => String(r));
    if (typeof reqs === "string") {
      try {
        const parsed = JSON.parse(reqs);
        if (Array.isArray(parsed)) return parsed.map((r) => String(r));
        return [parsed];
      } catch {
        return [reqs];
      }
    }
    return [String(reqs)];
  };

  // Skor per misi
  const getScoreForTask = (taskNum: number) => {
    if (taskNum === 1) return 10;
    if (taskNum === 9) return 50;
    return 20;
  };

  // Dapatkan info task (judul & requirements / hint)
  const getTaskInfo = (
    gameId?: string,
    taskNumber?: number
  ): { title: string; requirements: string[] } => {
    if (!taskNumber) return { title: "Misi", requirements: [] };

    const found =
      tasks.find(
        (t) => (t.game_id === gameId || !gameId) && t.task_number === taskNumber
      ) || tasks.find((t) => t.task_number === taskNumber);

    if (found) {
      return {
        title: found.title,
        requirements: parseRequirements(found.requirements),
      };
    }

    if (taskNumber === 1) {
      return {
        title: "Registrasi Pasukan",
        requirements: [
          "Masukkan nama lengkap semua anggota tim",
          "Tentukan peran masing-masing (contoh: Hacker, Hustler, Hipster)",
        ],
      };
    }
    if (taskNumber === 9) {
      return {
        title: "Misi Terakhir: Laporan Tempur",
        requirements: [
          "Masukkan link presentasi proyek (PPT/Canva)",
          "Masukkan link video demonstrasi hasil game kalian",
        ],
      };
    }

    return {
      title: `Misi ${taskNumber}`,
      requirements: ["Petunjuk dan kriteria pengerjaan sesuai instruksi di arena."],
    };
  };

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

  const refreshTasksData = async () => {
    const { data: tasksData, error } = await supabase
      .from("tasks")
      .select("*")
      .order("task_number", { ascending: true });
    if (error) {
      console.error("Error fetching tasks:", error);
    }
    if (tasksData) setTasks(tasksData as Task[]);
  };

  const refreshSubmissions = async () => {
    const { data, error } = await supabase
      .from("submissions")
      .select("*, groups(name, game_id)")
      .order("submitted_at", { ascending: false });
    if (error) {
      console.error("Error fetching submissions:", error);
    }
    if (data) setSubmissions(data as unknown as Submission[]);
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
      await refreshTasksData();
      await refreshSubmissions();
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
    const sessionId = "11111111-1111-1111-1111-111111111111";

    const { error } = await supabase
      .from("groups")
      .insert([
        {
          name: newGroupName,
          game_id: selectedGame,
          pin: pin,
          session_id: sessionId,
        },
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
    if (
      !confirm("Yakin ingin mereset skor dan progress tim ini kembali ke 0?")
    )
      return;

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
      .insert([
        {
          name: newGameName,
          difficulty: newGameDifficulty,
          base_poin: Number(newGameBasePoin),
        },
      ])
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
        body: JSON.stringify({ gameName: newGameName }),
      });

      const generatedTasks = await aiResponse.json();

      if (generatedTasks.error || !Array.isArray(generatedTasks)) {
        console.error("Gagal generate:", generatedTasks);
        alert(
          "⚠️ Game tersimpan, tapi AI gagal membuat task. Cek terminal VS Code."
        );
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const tasksToInsert = generatedTasks.map((t: any) => ({
          game_id: gameData.id,
          task_number: t.task_number,
          title: t.title,
          requirements:
            t.reqs || t.requirements || ["Instruksi tidak valid"],
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
    await refreshTasksData();
    setLoadingGame(false);
  };

  const handleDeleteGame = async (id: string) => {
    if (
      !confirm(
        "Yakin ingin menghapus game ini? Pastikan tidak ada kelompok yang memakainya."
      )
    )
      return;
    const { error } = await supabase.from("games").delete().eq("id", id);
    if (error) {
      alert("❌ Gagal menghapus. Mungkin game masih terikat relasi kelompok.");
    } else {
      await refreshGamesData();
    }
  };

  // === HANDLER VALIDASI SUBMISSION ===
  const openSubmissionModal = async (sub: Submission) => {
    setSelectedSubmission(sub);
    setRejectFeedback("");
    setShowModal(true);
    setLoadingTask(true);
    setSelectedTask(null);

    const gameId =
      sub.game_id ||
      sub.groups?.game_id ||
      groups.find((g) => g.id === sub.group_id)?.game_id;

    let task = tasks.find(
      (t) => (t.game_id === gameId || !gameId) && t.task_number === sub.task_number
    );

    if (!task && gameId) {
      const { data } = await supabase
        .from("tasks")
        .select("*")
        .eq("game_id", gameId)
        .eq("task_number", sub.task_number)
        .maybeSingle();

      if (data) {
        task = data as Task;
      }
    }

    if (!task) {
      const anyTask = tasks.find((t) => t.task_number === sub.task_number);
      if (anyTask) {
        task = anyTask;
      } else {
        const info = getTaskInfo(gameId, sub.task_number);
        task = {
          game_id: gameId || "",
          task_number: sub.task_number,
          title: info.title,
          requirements: info.requirements,
        };
      }
    }

    setSelectedTask(task);
    setLoadingTask(false);
  };

  const handleApprove = async () => {
    if (!selectedSubmission) return;
    setActionLoading(true);

    // Update status submission
    await supabase
      .from("submissions")
      .update({ validation_status: "approved", feedback: null })
      .eq("id", selectedSubmission.id);

    // Tambah skor ke grup
    const targetGroup = groups.find(
      (g) => g.id === selectedSubmission.group_id
    );
    if (targetGroup) {
      const scoreToAdd = getScoreForTask(selectedSubmission.task_number);
      const newScore = (targetGroup.score || 0) + scoreToAdd;
      const completedCount =
        submissions.filter(
          (s) =>
            s.group_id === selectedSubmission.group_id &&
            s.validation_status === "approved" &&
            s.id !== selectedSubmission.id
        ).length + 1;

      await supabase
        .from("groups")
        .update({ score: newScore, completed_tasks: completedCount })
        .eq("id", selectedSubmission.group_id);
    }

    await refreshSubmissions();
    await refreshGroupsData();
    setShowModal(false);
    setSelectedSubmission(null);
    setActionLoading(false);
  };

  const handleReject = async () => {
    if (!selectedSubmission) return;
    if (!rejectFeedback.trim()) {
      alert("Tulis feedback/alasan penolakan terlebih dahulu!");
      return;
    }
    setActionLoading(true);

    await supabase
      .from("submissions")
      .update({
        validation_status: "rejected",
        feedback: rejectFeedback.trim(),
      })
      .eq("id", selectedSubmission.id);

    await refreshSubmissions();
    setShowModal(false);
    setSelectedSubmission(null);
    setRejectFeedback("");
    setActionLoading(false);
  };

  // Filter submissions
  const filteredSubmissions =
    filterStatus === "all"
      ? submissions
      : submissions.filter((s) => s.validation_status === filterStatus);

  // === Render konten submission di modal ===
  const renderSubmissionContent = (sub: Submission) => {
    try {
      const parsed = JSON.parse(sub.code_content);

      // Misi 1: Daftar anggota
      if (sub.task_number === 1 && Array.isArray(parsed)) {
        return (
          <div className="space-y-2">
            <h4 className="font-black uppercase text-lg">Daftar Anggota Tim</h4>
            {parsed.map(
              (m: { name: string; role: string }, i: number) => (
                <div
                  key={i}
                  className="flex gap-4 bg-brutal-bg p-2 border-2 border-black"
                >
                  <span className="font-bold">
                    {i + 1}. {m.name}
                  </span>
                  <span className="text-gray-600">— {m.role}</span>
                </div>
              )
            )}
          </div>
        );
      }

      // Misi 9: Links
      if (sub.task_number === 9 && parsed.ppt !== undefined) {
        return (
          <div className="space-y-3">
            <h4 className="font-black uppercase text-lg">Link Submission</h4>
            <div className="bg-brutal-bg p-3 border-2 border-black">
              <p className="font-bold">📊 Presentasi:</p>
              <a
                href={parsed.ppt}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all"
              >
                {parsed.ppt}
              </a>
            </div>
            <div className="bg-brutal-bg p-3 border-2 border-black">
              <p className="font-bold">🎬 Video:</p>
              <a
                href={parsed.video}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 underline break-all"
              >
                {parsed.video}
              </a>
            </div>
          </div>
        );
      }

      // Misi 2-8: Kode HTML/CSS/JS
      if (parsed.html !== undefined) {
        return (
          <div className="space-y-3">
            <h4 className="font-black uppercase text-lg">Kode Siswa</h4>
            <div>
              <p className="font-black text-sm uppercase mb-1 text-yellow-700">
                HTML
              </p>
              <pre className="bg-[#1e1e1e] text-yellow-400 p-3 border-2 border-black font-mono text-sm overflow-auto max-h-[200px] whitespace-pre-wrap">
                {parsed.html}
              </pre>
            </div>
            <div>
              <p className="font-black text-sm uppercase mb-1 text-pink-700">
                CSS
              </p>
              <pre className="bg-[#1e1e1e] text-pink-400 p-3 border-2 border-black font-mono text-sm overflow-auto max-h-[200px] whitespace-pre-wrap">
                {parsed.css}
              </pre>
            </div>
            <div>
              <p className="font-black text-sm uppercase mb-1 text-cyan-700">
                JS
              </p>
              <pre className="bg-[#1e1e1e] text-cyan-400 p-3 border-2 border-black font-mono text-sm overflow-auto max-h-[200px] whitespace-pre-wrap">
                {parsed.js}
              </pre>
            </div>
          </div>
        );
      }

      return <pre className="font-mono text-sm whitespace-pre-wrap">{sub.code_content}</pre>;
    } catch {
      return <pre className="font-mono text-sm whitespace-pre-wrap">{sub.code_content}</pre>;
    }
  };

  // === UI LOGIN ===
  if (!isMounted) return null;
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-brutal-bg flex items-center justify-center p-4 [background-size:20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]">
        <form
          onSubmit={handleLogin}
          className="bg-white border-8 border-black p-8 md:p-12 shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-md w-full transform -skew-x-2"
        >
          <h1 className="text-4xl font-black uppercase mb-2 text-center">
            Admin Panel
          </h1>
          <p className="text-center font-bold mb-8 border-b-4 border-black pb-4">
            CTF ARENA CONTROL
          </p>

          <div className="space-y-6">
            <div>
              <label className="block font-black text-xl mb-2 uppercase">
                Username
              </label>
              <input
                type="text"
                required
                value={authForm.username}
                onChange={(e) =>
                  setAuthForm({ ...authForm, username: e.target.value })
                }
                className="w-full p-4 border-4 border-black font-bold text-lg bg-brutal-pink focus:outline-none focus:bg-white transition-colors"
              />
            </div>
            <div>
              <label className="block font-black text-xl mb-2 uppercase">
                Password
              </label>
              <input
                type="password"
                required
                value={authForm.password}
                onChange={(e) =>
                  setAuthForm({ ...authForm, password: e.target.value })
                }
                className="w-full p-4 border-4 border-black font-bold text-lg bg-brutal-yellow focus:outline-none focus:bg-white transition-colors"
              />
            </div>
          </div>

          {authError && (
            <div className="mt-6 bg-red-500 border-4 border-black p-3 text-white font-black uppercase text-center animate-pulse">
              {authError}
            </div>
          )}

          <button
            type="submit"
            className="w-full mt-8 bg-brutal-blue border-4 border-black p-4 text-2xl font-black uppercase hover:bg-brutal-green transition-colors shadow-brutal"
          >
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
          <h1 className="text-4xl font-black uppercase">
            ⚙️ Control Panel Admin
          </h1>
          <p className="font-bold text-brutal-yellow mt-2">
            Manajemen Sesi Bootcamp ICT
          </p>
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
                type="text"
                required
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                placeholder="Misal: Tim Alpha"
                className="w-full p-3 font-bold bg-white border-2 border-black"
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Assign Game</label>
              <select
                required
                value={selectedGame}
                onChange={(e) => setSelectedGame(e.target.value)}
                className="w-full p-3 font-bold bg-white border-2 border-black cursor-pointer"
              >
                <option value="" disabled>
                  -- Pilih Game --
                </option>
                {games.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={loadingGroup}
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
                  <th className="p-3 border-2 border-black text-center">
                    PIN
                  </th>
                  <th className="p-3 border-2 border-black text-center">
                    Skor
                  </th>
                  <th className="p-3 border-2 border-black text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {groups.map((group) => (
                  <tr key={group.id} className="hover:bg-brutal-bg">
                    <td className="p-3 border-2 border-black">{group.name}</td>
                    <td className="p-3 border-2 border-black">
                      {group.games?.name}
                    </td>
                    <td className="p-3 border-2 border-black text-center text-2xl tracking-widest text-brutal-blue text-stroke">
                      {group.pin}
                    </td>
                    <td className="p-3 border-2 border-black text-center">
                      {group.score}
                    </td>
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
        <div className="bg-brutal-blue border-4 border-black shadow-brutal p-6 h-fit">
          <h2 className="text-2xl font-black uppercase mb-4 border-b-4 border-black pb-2 bg-white inline-block px-2">
            🎮 Tambah Game
          </h2>
          <form onSubmit={handleAddGame} className="space-y-4">
            <div>
              <label className="block font-bold mb-1">Nama Game</label>
              <input
                type="text"
                required
                value={newGameName}
                onChange={(e) => setNewGameName(e.target.value)}
                placeholder="Misal: Snake Game"
                className="w-full p-3 font-bold bg-white border-2 border-black"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-bold mb-1">Level</label>
                <select
                  value={newGameDifficulty}
                  onChange={(e) => setNewGameDifficulty(e.target.value)}
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
                  type="number"
                  required
                  value={newGameBasePoin}
                  onChange={(e) => setNewGameBasePoin(Number(e.target.value))}
                  className="w-full p-3 font-bold bg-white border-2 border-black"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={loadingGame}
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
                  <th className="p-3 border-2 border-black text-center">
                    Level
                  </th>
                  <th className="p-3 border-2 border-black text-center">
                    Poin
                  </th>
                  <th className="p-3 border-2 border-black text-center">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="font-bold">
                {games.map((game) => (
                  <tr key={game.id} className="hover:bg-brutal-bg">
                    <td className="p-3 border-2 border-black">{game.name}</td>
                    <td className="p-3 border-2 border-black text-center uppercase">
                      {game.difficulty}
                    </td>
                    <td className="p-3 border-2 border-black text-center">
                      {game.base_poin}
                    </td>
                    <td className="p-3 border-2 border-black text-center">
                      <button
                        onClick={() => handleDeleteGame(game.id)}
                        className="bg-red-500 text-white px-3 py-1 border-2 border-black font-black uppercase hover:bg-red-600 text-sm"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* SECTION 3: VALIDASI SUBMISSION */}
      <div className="bg-white border-4 border-black shadow-brutal p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <h2 className="text-2xl font-black uppercase bg-brutal-pink inline-block px-3 py-1 border-2 border-black">
            📝 Validasi Submission
          </h2>

          {/* Filter Tabs */}
          <div className="flex gap-2 flex-wrap">
            {(
              [
                { key: "all", label: "Semua", count: submissions.length },
                {
                  key: "pending",
                  label: "⏳ Pending",
                  count: submissions.filter(
                    (s) => s.validation_status === "pending"
                  ).length,
                },
                {
                  key: "approved",
                  label: "✅ Approved",
                  count: submissions.filter(
                    (s) => s.validation_status === "approved"
                  ).length,
                },
                {
                  key: "rejected",
                  label: "❌ Rejected",
                  count: submissions.filter(
                    (s) => s.validation_status === "rejected"
                  ).length,
                },
              ] as { key: FilterStatus; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className={`px-4 py-2 border-2 border-black font-bold text-sm uppercase transition-all ${filterStatus === f.key
                    ? "bg-black text-white"
                    : "bg-brutal-bg hover:bg-gray-200"
                  }`}
              >
                {f.label} ({f.count})
              </button>
            ))}
          </div>
        </div>

        {/* Tabel Submissions */}
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full border-collapse border-4 border-black">
            <thead>
              <tr className="bg-black text-white text-left uppercase font-black text-sm sticky top-0">
                <th className="p-3 border-2 border-black">Tim</th>
                <th className="p-3 border-2 border-black text-center">Misi</th>
                <th className="p-3 border-2 border-black text-center">
                  Status
                </th>
                <th className="p-3 border-2 border-black text-center">
                  Tanggal
                </th>
                <th className="p-3 border-2 border-black text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="font-bold">
              {filteredSubmissions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center text-gray-500 border-2 border-black"
                  >
                    Belum ada submission.
                  </td>
                </tr>
              ) : (
                filteredSubmissions.map((sub) => (
                  <tr key={sub.id} className="hover:bg-brutal-bg">
                    <td className="p-3 border-2 border-black">
                      {sub.groups?.name || "—"}
                    </td>
                    <td className="p-3 border-2 border-black">
                      <div className="flex flex-col gap-1">
                        <span className="bg-black text-white px-2 py-0.5 text-xs font-mono font-bold w-fit">
                          Misi {sub.task_number}
                        </span>
                        <span className="text-xs font-bold text-gray-800 line-clamp-1">
                          {
                            getTaskInfo(
                              sub.game_id ||
                                sub.groups?.game_id ||
                                groups.find((g) => g.id === sub.group_id)?.game_id,
                              sub.task_number
                            ).title
                          }
                        </span>
                      </div>
                    </td>
                    <td className="p-3 border-2 border-black text-center">
                      <span
                        className={`px-3 py-1 text-sm uppercase font-black border-2 border-black inline-block ${sub.validation_status === "approved"
                            ? "bg-brutal-green"
                            : sub.validation_status === "pending"
                              ? "bg-yellow-200"
                              : sub.validation_status === "rejected"
                                ? "bg-red-200"
                                : "bg-gray-200"
                          }`}
                      >
                        {sub.validation_status}
                      </span>
                    </td>
                    <td className="p-3 border-2 border-black text-center text-sm">
                      {sub.submitted_at
                        ? new Date(sub.submitted_at).toLocaleString("id-ID", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                        : "—"}
                    </td>
                    <td className="p-3 border-2 border-black text-center">
                      <button
                        onClick={() => openSubmissionModal(sub)}
                        className="bg-brutal-blue text-black px-4 py-1 border-2 border-black font-black uppercase hover:bg-white text-sm"
                      >
                        Lihat & Review
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL REVIEW SUBMISSION */}
      {showModal && selectedSubmission && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6">
            {/* Modal Header */}
            <div className="flex justify-between items-center mb-6 border-b-4 border-black pb-4">
              <div>
                <h3 className="text-2xl font-black uppercase">
                  Review Submission
                </h3>
                <p className="font-bold text-gray-700">
                  Tim: <span className="font-black text-black">{selectedSubmission.groups?.name || "—"}</span> &nbsp;|&nbsp; Misi {selectedSubmission.task_number}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSubmission(null);
                }}
                className="bg-black text-white px-4 py-2 font-black text-xl hover:bg-red-500 border-2 border-black cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Status saat ini */}
            <div className="mb-6 flex flex-wrap items-center gap-3">
              <span
                className={`px-4 py-1.5 font-black uppercase text-sm border-2 border-black inline-block ${
                  selectedSubmission.validation_status === "approved"
                    ? "bg-brutal-green"
                    : selectedSubmission.validation_status === "pending"
                      ? "bg-yellow-200"
                      : "bg-red-200"
                }`}
              >
                Status: {selectedSubmission.validation_status}
              </span>
              <span className="font-black text-sm bg-brutal-yellow px-3 py-1.5 border-2 border-black">
                Skor jika approve: +{getScoreForTask(selectedSubmission.task_number)} Poin
              </span>
            </div>

            {/* 1. SECTION HINT & SYARAT MISI */}
            <div className="mb-6 border-4 border-black bg-amber-50 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-brutal-yellow border-b-4 border-black p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💡</span>
                  <span className="font-black text-lg uppercase tracking-wide">
                    HINT / PETUNJUK & SYARAT MISI
                  </span>
                </div>
                <span className="bg-black text-white px-2 py-0.5 text-xs font-mono font-black uppercase">
                  Misi {selectedSubmission.task_number}
                </span>
              </div>
              <div className="p-4 space-y-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-xs font-black uppercase text-gray-500">Judul Misi:</span>
                  <h4 className="font-black text-lg uppercase text-black">
                    {loadingTask ? (
                      "Memuat judul misi..."
                    ) : (
                      selectedTask?.title || `Misi ${selectedSubmission.task_number}`
                    )}
                  </h4>
                </div>

                <div>
                  <p className="text-xs font-black uppercase text-gray-600 mb-2">
                    Syarat & Instruksi yang Diberikan ke Siswa (Hint):
                  </p>
                  {loadingTask ? (
                    <div className="bg-white p-3 border-2 border-black font-bold text-gray-400 italic animate-pulse">
                      Mengambil instruksi misi...
                    </div>
                  ) : (
                    <ul className="list-disc list-inside space-y-1.5 bg-white p-3 border-2 border-black font-bold text-sm text-gray-900">
                      {selectedTask && parseRequirements(selectedTask.requirements).length > 0 ? (
                        parseRequirements(selectedTask.requirements).map((req, i) => (
                          <li key={i} className="leading-relaxed">
                            <span className="text-black">{req}</span>
                          </li>
                        ))
                      ) : (
                        <li className="text-gray-500 italic">Tidak ada petunjuk khusus untuk misi ini.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>

            {/* 2. SECTION JAWABAN SISWA */}
            <div className="mb-6 border-4 border-black bg-white shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">
              <div className="bg-brutal-blue border-b-4 border-black p-3 flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📥</span>
                  <span className="font-black text-lg uppercase tracking-wide">
                    JAWABAN / KODE DARI SISWA
                  </span>
                </div>
                <span className="bg-black text-white px-2 py-0.5 text-xs font-mono font-bold">
                  {selectedSubmission.groups?.name || "Siswa"}
                </span>
              </div>
              <div className="p-4 bg-brutal-bg">
                {renderSubmissionContent(selectedSubmission)}
              </div>
            </div>

            {/* Feedback yang sudah ada */}
            {selectedSubmission.feedback && (
              <div className="mb-4 p-3 bg-red-100 border-2 border-red-500 font-bold text-red-800">
                <p className="font-black text-sm uppercase mb-1">
                  Feedback Sebelumnya:
                </p>
                <p>{selectedSubmission.feedback}</p>
              </div>
            )}

            {/* Area feedback untuk reject */}
            {selectedSubmission.validation_status !== "approved" && (
              <div className="mb-6">
                <label className="block font-black uppercase mb-2">
                  Feedback (wajib untuk reject):
                </label>
                <textarea
                  value={rejectFeedback}
                  onChange={(e) => setRejectFeedback(e.target.value)}
                  placeholder="Tulis alasan penolakan atau catatan untuk siswa..."
                  className="w-full p-3 border-4 border-black font-bold h-24 resize-none focus:outline-none"
                />
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-4 flex-wrap">
              {selectedSubmission.validation_status !== "approved" && (
                <>
                  <button
                    onClick={handleApprove}
                    disabled={actionLoading}
                    className="flex-1 bg-brutal-green border-4 border-black p-4 text-xl font-black uppercase hover:bg-green-400 shadow-brutal disabled:bg-gray-400 transition-colors"
                  >
                    {actionLoading ? "⏳ Memproses..." : "✅ Approve"}
                  </button>
                  <button
                    onClick={handleReject}
                    disabled={actionLoading}
                    className="flex-1 bg-red-400 border-4 border-black p-4 text-xl font-black uppercase hover:bg-red-500 shadow-brutal disabled:bg-gray-400 transition-colors"
                  >
                    {actionLoading ? "⏳ Memproses..." : "❌ Reject"}
                  </button>
                </>
              )}
              <button
                onClick={() => {
                  setShowModal(false);
                  setSelectedSubmission(null);
                }}
                className="flex-1 bg-gray-200 border-4 border-black p-4 text-xl font-black uppercase hover:bg-white shadow-brutal transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}