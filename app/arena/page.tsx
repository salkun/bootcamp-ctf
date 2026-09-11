"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface GroupData {
  id: string;
  name: string;
  game_id: string;
  score: number;
  completed_tasks: number;
  games?: { name: string } | null;
}

interface TaskData {
  task_number: number;
  title: string;
  requirements: string[] | string;
}

interface SubmissionData {
  id: string;
  task_number: number;
  validation_status: string;
  code_content: string;
  feedback?: string;
}

export default function ArenaPage() {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [gameTasks, setGameTasks] = useState<TaskData[]>([]);
  const [activeTask, setActiveTask] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissions, setSubmissions] = useState<SubmissionData[]>([]);
  const [submitMessage, setSubmitMessage] = useState("");
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");
  const [codeData, setCodeData] = useState({
    html: "<!-- Tulis HTML disini -->\n",
    css: "/* Tulis CSS disini */\n",
    js: "// Tulis JS disini\n",
  });

  const [members, setMembers] = useState([{ name: "", role: "" }]);
  const [links, setLinks] = useState({ ppt: "", video: "" });

  // Load submissions dari Supabase untuk menampilkan status tiap misi
  const loadSubmissions = useCallback(async (groupId: string, gameId: string) => {
    const { data } = await supabase
      .from("submissions")
      .select("id, task_number, validation_status, code_content, feedback")
      .eq("group_id", groupId)
      .eq("game_id", gameId)
      .order("task_number", { ascending: true });

    if (data) setSubmissions(data as SubmissionData[]);
  }, []);

  // Saat klik misi di sidebar, load data submission sebelumnya jika ada
  const handleSelectTask = useCallback(
    (taskNum: number) => {
      setActiveTask(taskNum);
      setSubmitMessage("");

      const existing = submissions.find((s) => s.task_number === taskNum);
      if (existing) {
        try {
          const parsed = JSON.parse(existing.code_content);
          if (taskNum === 1 && Array.isArray(parsed)) {
            setMembers(parsed);
          } else if (taskNum === 9 && parsed.ppt !== undefined) {
            setLinks(parsed);
          } else if (parsed.html !== undefined) {
            setCodeData(parsed);
          }
        } catch {
          // Data lama tidak bisa diparsing, biarkan default
        }
      } else {
        // Reset form ke default jika belum pernah submit
        if (taskNum === 1) {
          setMembers([{ name: "", role: "" }]);
        } else if (taskNum === 9) {
          setLinks({ ppt: "", video: "" });
        } else {
          setCodeData({
            html: "<!-- Tulis HTML disini -->\n",
            css: "/* Tulis CSS disini */\n",
            js: "// Tulis JS disini\n",
          });
        }
      }
    },
    [submissions]
  );

  useEffect(() => {
    const loadSessionData = async () => {
      const activeGroup = localStorage.getItem("activeGroup");
      if (!activeGroup) return router.push("/");
      const parsedGroup: GroupData = JSON.parse(activeGroup);

      setGroup(parsedGroup);

      const { data: tasksData } = await supabase
        .from("tasks")
        .select("*")
        .eq("game_id", parsedGroup.game_id)
        .order("task_number", { ascending: true });
      if (tasksData) setGameTasks(tasksData as TaskData[]);

      await loadSubmissions(parsedGroup.id, parsedGroup.game_id);
    };
    loadSessionData();
  }, [router, loadSubmissions]);

  if (!group)
    return (
      <div className="p-8 min-h-screen bg-brutal-bg font-bold">
        Menyiapkan Arena...
      </div>
    );

  const handleLogout = () => {
    localStorage.removeItem("activeGroup");
    router.push("/");
  };

  // Mendapatkan status submission untuk tiap misi
  const getTaskStatus = (taskNum: number) => {
    const sub = submissions.find((s) => s.task_number === taskNum);
    if (!sub) return "open";
    return sub.validation_status; // "pending" | "approved" | "rejected"
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "approved":
        return "✅";
      case "pending":
        return "⏳";
      case "rejected":
        return "❌";
      default:
        return "🔓";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "approved":
        return "Disetujui";
      case "pending":
        return "Menunggu Review";
      case "rejected":
        return "Ditolak";
      default:
        return "Belum Dikerjakan";
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setSubmitMessage("");

    try {
      let contentToSave = "";

      if (activeTask === 1) {
        if (members.some((m) => !m.name || !m.role)) {
          setSubmitMessage("⚠️ Pastikan semua nama dan peran anggota sudah diisi!");
          setIsSubmitting(false);
          return;
        }
        contentToSave = JSON.stringify(members);
      } else if (activeTask === 9) {
        if (!links.ppt || !links.video) {
          setSubmitMessage("⚠️ Link PPT dan Video tidak boleh kosong!");
          setIsSubmitting(false);
          return;
        }
        contentToSave = JSON.stringify(links);
      } else {
        contentToSave = JSON.stringify(codeData);
      }

      // Cek apakah sudah pernah submit misi ini
      const existingSub = submissions.find((s) => s.task_number === activeTask);

      if (existingSub) {
        // Update submission yang sudah ada (re-submit)
        const { error: updateError } = await supabase
          .from("submissions")
          .update({
            code_content: contentToSave,
            validation_status: "pending",
          })
          .eq("id", existingSub.id);

        if (updateError) {
          console.error("Supabase update error:", updateError);
          setSubmitMessage(`❌ Gagal update: ${updateError.message}`);
          setIsSubmitting(false);
          return;
        }
      } else {
        // Insert baru
        const { error: insertError } = await supabase.from("submissions").insert([
          {
            group_id: group.id,
            game_id: group.game_id,
            task_number: activeTask,
            code_content: contentToSave,
            validation_status: "pending",
          },
        ]);

        if (insertError) {
          console.error("Supabase insert error:", insertError);
          setSubmitMessage(`❌ Gagal mengirim: ${insertError.message}`);
          setIsSubmitting(false);
          return;
        }
      }

      // Reload submissions
      await loadSubmissions(group.id, group.game_id);

      setSubmitMessage(
        "✅ Jawaban berhasil dikirim! Menunggu validasi dari admin."
      );
    } catch (err) {
      console.error(err);
      setSubmitMessage("❌ Gagal mengirim jawaban. Coba lagi.");
    }

    setIsSubmitting(false);
  };

  const currentTaskData = gameTasks.find((t) => t.task_number === activeTask) || {
    title: "Memuat...",
    requirements: [],
  };

  const currentStatus = getTaskStatus(activeTask);
  const currentSubmission = submissions.find((s) => s.task_number === activeTask);

  // Hitung statistik
  const approvedCount = submissions.filter(
    (s) => s.validation_status === "approved"
  ).length;
  const pendingCount = submissions.filter(
    (s) => s.validation_status === "pending"
  ).length;

  return (
    <div className="min-h-screen bg-brutal-bg p-4 md:p-8 [background-size:20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]">
      <header className="flex flex-col md:flex-row justify-between items-center bg-brutal-yellow p-4 border-4 border-black shadow-brutal mb-8 transform -skew-x-2 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black uppercase">
            Arena CTF 🏁
          </h1>
          <p className="font-bold text-lg mt-2 pt-1 border-t-2 border-black">
            Tim: {group.name}
          </p>
        </div>
        <div className="bg-white border-4 border-black p-2 flex items-center gap-4">
          <span className="text-sm font-black uppercase">Status:</span>
          <span className="text-lg font-black">
            ✅ {approvedCount} &nbsp; ⏳ {pendingCount}
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="bg-brutal-pink px-6 py-3 text-lg font-black uppercase hover:bg-white skew-x-2 border-2 border-black"
        >
          Keluar
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* SIDEBAR — Semua misi bisa diklik */}
        <div className="bg-white border-4 border-black shadow-brutal p-4 max-h-[700px] overflow-y-auto">
          <h2 className="text-xl font-black uppercase mb-4 border-b-4 border-black pb-2 bg-brutal-green inline-block px-2">
            Daftar Misi
          </h2>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((task) => {
              const status = getTaskStatus(task);
              const isCurrent = task === activeTask;
              return (
                <button
                  key={task}
                  onClick={() => handleSelectTask(task)}
                  className={`w-full p-3 border-2 border-black font-bold flex justify-between items-center cursor-pointer transition-all hover:scale-[1.02] ${isCurrent
                      ? "bg-brutal-yellow scale-105 ring-4 ring-black"
                      : status === "approved"
                        ? "bg-brutal-green"
                        : status === "pending"
                          ? "bg-yellow-200"
                          : status === "rejected"
                            ? "bg-red-200"
                            : "bg-gray-100"
                    }`}
                >
                  <span>Misi {task}</span>
                  <span className="text-xl">{getStatusIcon(status)}</span>
                </button>
              );
            })}
          </div>

          {/* Tombol ke Leaderboard */}
          <button
            onClick={() => router.push("/leaderboard")}
            className="w-full mt-4 bg-brutal-blue border-2 border-black p-3 font-black uppercase text-sm hover:bg-white"
          >
            🏆 Leaderboard
          </button>
        </div>

        {/* AREA KERJA */}
        <div className="lg:col-span-3 bg-brutal-blue border-4 border-black shadow-brutal p-6 flex flex-col">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-2xl font-black uppercase bg-white border-2 border-black px-4 py-2 inline-block -rotate-1">
              🎮 {group.games?.name}
            </h2>
            <div className="text-xl font-bold bg-white border-2 border-black px-3 py-1">
              Poin: {group.score || 0}
            </div>
          </div>

          <div className="bg-white border-4 border-black p-4 mb-6 flex-grow shadow-inner">
            {/* Header Misi */}
            <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-4">
              <span className="bg-black text-white px-3 py-1 font-bold">
                MISI {activeTask}
              </span>
              <h3 className="font-bold text-xl uppercase">
                {currentTaskData.title}
              </h3>
              <span
                className={`ml-auto px-3 py-1 font-bold text-sm uppercase border-2 border-black ${currentStatus === "approved"
                    ? "bg-brutal-green"
                    : currentStatus === "pending"
                      ? "bg-yellow-200"
                      : currentStatus === "rejected"
                        ? "bg-red-200"
                        : "bg-gray-100"
                  }`}
              >
                {getStatusLabel(currentStatus)}
              </span>
            </div>

            {/* Requirements */}
            <ul className="list-disc list-inside font-bold mb-6 text-md bg-brutal-bg p-4 border-2 border-black">
              {Array.isArray(currentTaskData.requirements) ? (
                currentTaskData.requirements.map((req, i) => (
                  <li key={i}>{req}</li>
                ))
              ) : (
                <li>{currentTaskData.requirements}</li>
              )}
            </ul>

            {/* Feedback dari admin jika ditolak */}
            {currentStatus === "rejected" && currentSubmission?.feedback && (
              <div className="mb-4 p-4 bg-red-100 border-4 border-red-500 font-bold text-red-800">
                <p className="font-black uppercase mb-1">📝 Feedback Admin:</p>
                <p>{currentSubmission.feedback}</p>
              </div>
            )}

            {/* Form sesuai jenis misi */}
            {activeTask === 1 ? (
              <div className="space-y-4 bg-brutal-pink p-6 border-4 border-black">
                <h4 className="font-black text-xl uppercase">
                  Daftar Anggota
                </h4>
                {members.map((m, idx) => (
                  <div key={idx} className="flex gap-4">
                    <input
                      type="text"
                      placeholder="Nama Lengkap"
                      value={m.name}
                      onChange={(e) => {
                        const newM = [...members];
                        newM[idx].name = e.target.value;
                        setMembers(newM);
                      }}
                      className="w-full p-2 border-2 border-black font-bold"
                    />
                    <input
                      type="text"
                      placeholder="Peran"
                      value={m.role}
                      onChange={(e) => {
                        const newM = [...members];
                        newM[idx].role = e.target.value;
                        setMembers(newM);
                      }}
                      className="w-full p-2 border-2 border-black font-bold"
                    />
                  </div>
                ))}
                <button
                  onClick={() => setMembers([...members, { name: "", role: "" }])}
                  className="bg-black text-white px-4 py-2 font-bold uppercase hover:bg-gray-800"
                >
                  + Tambah Anggota
                </button>
              </div>
            ) : activeTask === 9 ? (
              <div className="space-y-6 bg-brutal-green p-6 border-4 border-black">
                <h4 className="font-black text-xl uppercase">
                  Upload Persyaratan
                </h4>
                <input
                  type="url"
                  value={links.ppt}
                  onChange={(e) => setLinks({ ...links, ppt: e.target.value })}
                  className="w-full p-3 border-2 border-black font-bold mb-4"
                  placeholder="Link Presentasi (Canva/GSlides)"
                />
                <input
                  type="url"
                  value={links.video}
                  onChange={(e) =>
                    setLinks({ ...links, video: e.target.value })
                  }
                  className="w-full p-3 border-2 border-black font-bold"
                  placeholder="Link Video Demo"
                />
              </div>
            ) : (
              <div className="border-4 border-black flex flex-col h-[400px]">
                <div className="flex bg-black">
                  <button
                    onClick={() => setActiveTab("html")}
                    className={`flex-1 py-2 font-black uppercase border-r-2 border-black ${activeTab === "html"
                        ? "bg-brutal-yellow text-black"
                        : "bg-black text-white"
                      }`}
                  >
                    HTML
                  </button>
                  <button
                    onClick={() => setActiveTab("css")}
                    className={`flex-1 py-2 font-black uppercase border-r-2 border-black ${activeTab === "css"
                        ? "bg-brutal-pink text-black"
                        : "bg-black text-white"
                      }`}
                  >
                    CSS
                  </button>
                  <button
                    onClick={() => setActiveTab("js")}
                    className={`flex-1 py-2 font-black uppercase ${activeTab === "js"
                        ? "bg-brutal-blue text-black"
                        : "bg-black text-white"
                      }`}
                  >
                    JS
                  </button>
                </div>
                <div className="flex-grow bg-[#1e1e1e] relative">
                  {activeTab === "html" && (
                    <textarea
                      value={codeData.html}
                      onChange={(e) =>
                        setCodeData({ ...codeData, html: e.target.value })
                      }
                      className="w-full h-full p-4 bg-transparent text-yellow-400 font-mono focus:outline-none resize-none"
                    />
                  )}
                  {activeTab === "css" && (
                    <textarea
                      value={codeData.css}
                      onChange={(e) =>
                        setCodeData({ ...codeData, css: e.target.value })
                      }
                      className="w-full h-full p-4 bg-transparent text-pink-400 font-mono focus:outline-none resize-none"
                    />
                  )}
                  {activeTab === "js" && (
                    <textarea
                      value={codeData.js}
                      onChange={(e) =>
                        setCodeData({ ...codeData, js: e.target.value })
                      }
                      className="w-full h-full p-4 bg-transparent text-cyan-400 font-mono focus:outline-none resize-none"
                    />
                  )}
                </div>
              </div>
            )}

            {/* Pesan submit */}
            {submitMessage && (
              <div
                className={`mt-4 p-4 border-4 font-bold ${submitMessage.startsWith("✅")
                    ? "bg-green-100 border-green-600 text-green-900"
                    : submitMessage.startsWith("⚠️")
                      ? "bg-yellow-100 border-yellow-600 text-yellow-900"
                      : "bg-red-100 border-red-600 text-red-900"
                  }`}
              >
                {submitMessage}
              </div>
            )}
          </div>

          {/* Tombol Submit */}
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || currentStatus === "approved"}
            className="bg-black text-white border-4 border-black p-4 text-2xl font-black uppercase hover:bg-brutal-green transition-colors shadow-brutal disabled:bg-gray-400"
          >
            {isSubmitting
              ? "⏳ Mengirim..."
              : currentStatus === "approved"
                ? "✅ Misi Ini Sudah Disetujui"
                : currentStatus === "pending"
                  ? "🔄 Kirim Ulang Jawaban"
                  : "Kirim Misi 🚀"}
          </button>
        </div>
      </div>
    </div>
  );
}