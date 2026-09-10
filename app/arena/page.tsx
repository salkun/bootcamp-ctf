"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../lib/supabase";

interface GroupData {
  id: string; name: string; game_id: string; score: number; completed_tasks: number; games?: { name: string } | null;
}
interface TaskData {
  task_number: number; title: string; requirements: string[] | string;
}

export default function ArenaPage() {
  const [group, setGroup] = useState<GroupData | null>(null);
  const [gameTasks, setGameTasks] = useState<TaskData[]>([]);
  const [activeTask, setActiveTask] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  const [cooldown, setCooldown] = useState(0);

  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const getTaskDuration = (taskNum: number) => {
    if (taskNum === 1) return 5 * 60;
    if (taskNum === 9) return 10 * 60;
    if (taskNum > 9) return 0;
    return 15 * 60; 
  };

  const [activeTab, setActiveTab] = useState<"html" | "css" | "js">("html");
  const [codeData, setCodeData] = useState({ html: "<!-- Tulis HTML disini -->\n", css: "/* Tulis CSS disini */\n", js: "// Tulis JS disini\n" });
  
  const [members, setMembers] = useState([{ name: "", role: "" }]);
  const [links, setLinks] = useState({ ppt: "", video: "" });
  const [aiHint, setAiHint] = useState("");

  // Bungkus fungsi dengan useCallback agar aman dimasukkan ke dalam useEffect
  const proceedToNextTask = useCallback(async (scoreToAdd: number, currentTask: number, currentGroup: GroupData) => {
    const nextTask = currentTask + 1;
    const newScore = currentGroup.score + scoreToAdd;
    
    await supabase.from("groups").update({ completed_tasks: currentTask, score: newScore }).eq("id", currentGroup.id);
    
    const updatedGroup = { ...currentGroup, completed_tasks: currentTask, score: newScore };
    setGroup(updatedGroup);
    localStorage.setItem("activeGroup", JSON.stringify(updatedGroup));
    
    setActiveTask(nextTask > 9 ? 9 : nextTask);
    setTimeLeft(getTaskDuration(nextTask > 9 ? 9 : nextTask));
    setAiHint("");
    setIsSubmitting(false);
  }, []);

  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
    const loadSessionData = async () => {
      const activeGroup = localStorage.getItem("activeGroup");
      if (!activeGroup) return router.push("/");
      const parsedGroup: GroupData = JSON.parse(activeGroup);
      
      setGroup(parsedGroup);
      const currentTask = (parsedGroup.completed_tasks || 0) + 1;
      setActiveTask(currentTask);
      setTimeLeft(getTaskDuration(currentTask));

      const { data: tasksData } = await supabase.from("tasks").select("*").eq("game_id", parsedGroup.game_id).order("task_number", { ascending: true });
      if (tasksData) setGameTasks(tasksData as TaskData[]);
    };
    loadSessionData();
  }, [router, cooldown]);

  useEffect(() => {
    if (timeLeft <= 0 && group && activeTask <= 9) {
      if (timerRef.current) clearInterval(timerRef.current);
      
      if (group.completed_tasks !== activeTask) {
        alert(`⏳ WAKTU HABIS UNTUK MISI ${activeTask}! Lanjut ke misi berikutnya.`);
        
        // setTimeout 0ms digunakan untuk melepas eksekusi dari siklus render utama
        // sehingga terhindar dari error cascading renders ESLint
        setTimeout(() => {
          proceedToNextTask(0, activeTask, group);
        }, 0);
      }
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => prev - 1);
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [timeLeft, activeTask, group, proceedToNextTask]); // Dependency array sudah lengkap

  if (!group) return <div className="p-8 min-h-screen bg-brutal-bg font-bold">Menyiapkan Arena...</div>;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleLogout = () => {
    localStorage.removeItem("activeGroup");
    router.push("/");
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setAiHint("");
    const currentTaskData = gameTasks.find(t => t.task_number === activeTask);

    try {
      if (activeTask === 1) {
        if (members.some(m => !m.name || !m.role)) {
          setAiHint("HINT: Pastikan semua nama dan peran anggota sudah diisi penuh!");
          setIsSubmitting(false); return;
        }
        await supabase.from("submissions").insert([{ group_id: group.id, game_id: group.game_id, task_number: 1, code_content: JSON.stringify(members), validation_status: "approved" }]);
        proceedToNextTask(10, activeTask, group);

      } else if (activeTask === 9) {
        if (!links.ppt || !links.video) {
          setAiHint("HINT: Link PPT dan Video tidak boleh kosong ya!");
          setIsSubmitting(false); return;
        }
        setTimeout(async () => {
          await supabase.from("submissions").insert([{ group_id: group.id, game_id: group.game_id, task_number: 9, code_content: JSON.stringify(links), validation_status: "approved" }]);
          proceedToNextTask(50, activeTask, group);
        }, 3000); 

      } else {
        const response = await fetch("/api/validate-code", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ html: codeData.html, css: codeData.css, js: codeData.js, taskRequirements: currentTaskData?.requirements })
        });
        const aiResult = await response.json();
        await supabase.from("submissions").insert([{ group_id: group.id, game_id: group.game_id, task_number: activeTask, code_content: JSON.stringify(codeData), validation_status: aiResult.valid ? "approved" : "rejected" }]);

        if (aiResult.valid) {
          proceedToNextTask(20, activeTask, group);
        } else {
          setAiHint(`🤖 PESAN AI: ${aiResult.hint}`);
          setIsSubmitting(false);
          setCooldown(10);
        }
      }
    } catch (err) {
      console.error(err); // <-- Mencetak error agar variabel terpakai
      alert("❌ Gagal mengirim tugas.");
      setIsSubmitting(false);
      setCooldown(10);
    }
  };

  const currentTaskData = gameTasks.find(t => t.task_number === activeTask) || { title: "Memuat...", requirements: [] };

  return (
    <div className="min-h-screen bg-brutal-bg p-4 md:p-8 [background-size:20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]">
      <header className="flex flex-col md:flex-row justify-between items-center bg-brutal-yellow p-4 border-4 border-black shadow-brutal mb-8 transform -skew-x-2 gap-4">
        <div>
          <h1 className="text-2xl md:text-4xl font-black uppercase">Arena CTF 🏁</h1>
          <p className="font-bold text-lg mt-2 pt-1 border-t-2 border-black">Tim: {group.name}</p>
        </div>
        <div className="bg-white border-4 border-black p-2 flex items-center gap-4">
          <span className="text-xl font-black uppercase">Waktu Misi:</span>
          <span className={`text-4xl font-black font-mono ${timeLeft < 180 ? 'text-red-600 animate-pulse' : 'text-black'}`}>{formatTime(timeLeft)}</span>
        </div>
        <button onClick={handleLogout} className="bg-brutal-pink px-6 py-3 text-lg font-black uppercase hover:bg-white skew-x-2 border-2 border-black">Keluar</button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="bg-white border-4 border-black shadow-brutal p-4 max-h-[700px] overflow-y-auto">
          <h2 className="text-xl font-black uppercase mb-4 border-b-4 border-black pb-2 bg-brutal-green inline-block px-2">Progress</h2>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((task) => {
              const isCompleted = task < activeTask;
              const isCurrent = task === activeTask;
              return (
                <div key={task} className={`p-3 border-2 border-black font-bold flex justify-between items-center ${isCurrent ? 'bg-brutal-yellow scale-105' : isCompleted ? 'bg-brutal-green' : 'bg-gray-200 grayscale'}`}>
                  <span>Misi {task}</span>
                  <span className="text-xl">{isCompleted ? '✅' : isCurrent ? '🔓' : '🔒'}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-3 bg-brutal-blue border-4 border-black shadow-brutal p-6 flex flex-col">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-2xl font-black uppercase bg-white border-2 border-black px-4 py-2 inline-block -rotate-1">🎮 {group.games?.name}</h2>
            <div className="text-xl font-bold bg-white border-2 border-black px-3 py-1">Poin: {group.score || 0}</div>
          </div>
          
          <div className="bg-white border-4 border-black p-4 mb-6 flex-grow shadow-inner">
            <div className="flex items-center gap-3 mb-4 border-b-2 border-black pb-4">
              <span className="bg-black text-white px-3 py-1 font-bold">MISI {activeTask}</span>
              <h3 className="font-bold text-xl uppercase">{currentTaskData.title}</h3>
            </div>
            
            <ul className="list-disc list-inside font-bold mb-6 text-md bg-brutal-bg p-4 border-2 border-black">
              {Array.isArray(currentTaskData.requirements) ? currentTaskData.requirements.map((req, i) => <li key={i}>{req}</li>) : <li>{currentTaskData.requirements}</li>}
            </ul>

            {activeTask === 1 ? (
              <div className="space-y-4 bg-brutal-pink p-6 border-4 border-black">
                <h4 className="font-black text-xl uppercase">Daftar Anggota</h4>
                {members.map((m, idx) => (
                  <div key={idx} className="flex gap-4">
                    <input type="text" placeholder="Nama Lengkap" value={m.name} onChange={(e) => { const newM = [...members]; newM[idx].name = e.target.value; setMembers(newM); }} className="w-full p-2 border-2 border-black font-bold"/>
                    <input type="text" placeholder="Peran" value={m.role} onChange={(e) => { const newM = [...members]; newM[idx].role = e.target.value; setMembers(newM); }} className="w-full p-2 border-2 border-black font-bold"/>
                  </div>
                ))}
                <button onClick={() => setMembers([...members, { name: "", role: "" }])} className="bg-black text-white px-4 py-2 font-bold uppercase hover:bg-gray-800">+ Tambah Anggota</button>
              </div>
            ) : activeTask === 9 ? (
              <div className="space-y-6 bg-brutal-green p-6 border-4 border-black">
                <h4 className="font-black text-xl uppercase">Upload Persyaratan</h4>
                <input type="url" value={links.ppt} onChange={(e) => setLinks({...links, ppt: e.target.value})} className="w-full p-3 border-2 border-black font-bold mb-4" placeholder="Link Presentasi (Canva/GSlides)" />
                <input type="url" value={links.video} onChange={(e) => setLinks({...links, video: e.target.value})} className="w-full p-3 border-2 border-black font-bold" placeholder="Link Video Demo" />
              </div>
            ) : activeTask > 9 ? (
              <div className="flex flex-col items-center justify-center p-8 md:p-16 bg-brutal-green border-8 border-black shadow-[16px_16px_0px_0px_rgba(0,0,0,1)] text-center animate-pulse mt-8">
                <h1 className="text-5xl md:text-8xl font-black uppercase text-white tracking-widest drop-shadow-[0_4px_4px_rgba(0,0,0,1)]" style={{ WebkitTextStroke: '3px black' }}>
                  GAME OVER!
                </h1>
                <div className="bg-white border-8 border-black p-8 mt-8 transform rotate-3 shadow-brutal-lg">
                  <p className="text-2xl font-black uppercase mb-2">Total Skor Tim</p>
                  <p className="text-7xl font-black text-brutal-blue">{group.score}</p>
                </div>
                <p className="font-bold text-xl mt-8 bg-black text-white px-4 py-2 uppercase transform -skew-x-3">
                  Seluruh misi telah divalidasi oleh AI
                </p>
                <button 
                  onClick={() => router.push('/leaderboard')}
                  className="mt-12 bg-brutal-yellow border-8 border-black px-10 py-6 text-3xl font-black uppercase hover:bg-white hover:scale-105 transition-transform shadow-brutal"
                >
                  🏆 Lihat Papan Klasemen
                </button>
              </div>
            ) : (
              <div className="border-4 border-black flex flex-col h-[400px]">
                <div className="flex bg-black">
                  <button onClick={() => setActiveTab("html")} className={`flex-1 py-2 font-black uppercase border-r-2 border-black ${activeTab === "html" ? "bg-brutal-yellow text-black" : "bg-black text-white"}`}>HTML</button>
                  <button onClick={() => setActiveTab("css")} className={`flex-1 py-2 font-black uppercase border-r-2 border-black ${activeTab === "css" ? "bg-brutal-pink text-black" : "bg-black text-white"}`}>CSS</button>
                  <button onClick={() => setActiveTab("js")} className={`flex-1 py-2 font-black uppercase ${activeTab === "js" ? "bg-brutal-blue text-black" : "bg-black text-white"}`}>JS</button>
                </div>
                <div className="flex-grow bg-[#1e1e1e] relative">
                  {activeTab === "html" && <textarea value={codeData.html} onChange={(e) => setCodeData({...codeData, html: e.target.value})} className="w-full h-full p-4 bg-transparent text-yellow-400 font-mono focus:outline-none resize-none" />}
                  {activeTab === "css" && <textarea value={codeData.css} onChange={(e) => setCodeData({...codeData, css: e.target.value})} className="w-full h-full p-4 bg-transparent text-pink-400 font-mono focus:outline-none resize-none" />}
                  {activeTab === "js" && <textarea value={codeData.js} onChange={(e) => setCodeData({...codeData, js: e.target.value})} className="w-full h-full p-4 bg-transparent text-cyan-400 font-mono focus:outline-none resize-none" />}
                </div>
              </div>
            )}
            
            {aiHint && <div className="mt-4 p-4 bg-red-200 border-4 border-red-600 text-red-900 font-bold">{aiHint}</div>}
          </div>
          
          <button 
            onClick={handleSubmit} 
            disabled={isSubmitting || activeTask > 9 || cooldown > 0} 
            className="bg-black text-white border-4 border-black p-4 text-2xl font-black uppercase hover:bg-brutal-green transition-colors shadow-brutal disabled:bg-gray-400"
          >
            {isSubmitting ? '⏳ Validasi AI...' : cooldown > 0 ? `⏳ Tunggu ${cooldown} Detik` : activeTask > 9 ? '🏆 SELESAI' : 'Kirim Misi 🚀'}
          </button>
        </div>
      </div>
    </div>
  );
}