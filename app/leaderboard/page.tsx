"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabase";

type LeaderboardEntry = {
  name: string;
  score: number;
  completed_tasks: number;
  games: { name: string } | null;
};

export default function LeaderboardPage() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      const { data, error } = await supabase
        .from("groups")
        .select("name, score, completed_tasks, games(name)")
        .order("score", { ascending: false })
        .order("completed_tasks", { ascending: false });

      if (data) setLeaderboard(data);
    };

    // Ambil data pertama kali
    fetchLeaderboard();

    // Auto-refresh setiap 5 detik untuk layar proyektor
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-brutal-bg p-8 [background-size:20px_20px] bg-[radial-gradient(#000_1px,transparent_1px)]">
      <div className="max-w-5xl mx-auto">
        <header className="bg-brutal-pink p-6 border-4 border-black shadow-brutal-lg mb-10 text-center transform -skew-y-1">
          <h1 className="text-5xl font-black uppercase tracking-widest">🏆 Live Leaderboard</h1>
          <p className="text-xl font-bold mt-2 bg-white inline-block px-4 py-1 border-2 border-black">
            Bootcamp ICT CTF
          </p>
        </header>

        <div className="space-y-4">
          {leaderboard.map((group, index) => (
            <div 
              key={index}
              className={`flex items-center justify-between p-6 border-4 border-black shadow-brutal transition-transform hover:-translate-y-1 ${
                index === 0 ? 'bg-brutal-yellow scale-105' : 
                index === 1 ? 'bg-gray-200' : 
                index === 2 ? 'bg-orange-300' : 'bg-white'
              }`}
            >
              <div className="flex items-center gap-6">
                <span className="text-4xl font-black w-12 text-center">
                  {index === 0 ? '👑' : `#${index + 1}`}
                </span>
                <div>
                  <h2 className="text-3xl font-black uppercase">{group.name}</h2>
                  <p className="font-bold text-lg text-gray-700">🎮 {group.games?.name}</p>
                </div>
              </div>

              <div className="flex gap-8 text-right">
                <div className="bg-brutal-bg border-2 border-black p-3 text-center min-w-[120px]">
                  <p className="text-sm font-bold uppercase mb-1">Progress</p>
                  <p className="text-2xl font-black">{group.completed_tasks} / 5</p>
                </div>
                <div className="bg-brutal-green border-2 border-black p-3 text-center min-w-[120px]">
                  <p className="text-sm font-bold uppercase mb-1">Poin</p>
                  <p className="text-3xl font-black">{group.score}</p>
                </div>
              </div>
            </div>
          ))}

          {leaderboard.length === 0 && (
            <div className="bg-white border-4 border-black p-10 text-center shadow-brutal">
              <h2 className="text-2xl font-bold animate-pulse">Memuat klasemen...</h2>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}