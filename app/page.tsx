"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    // Cek PIN ke database Supabase
    const { data, error: dbError } = await supabase
      .from("groups")
      .select("*, games(name)")
      .eq("pin", pin)
      .single();

    if (dbError || !data) {
      setError("❌ PIN salah atau kelompok tidak ditemukan!");
      setLoading(false);
      return;
    }

    // Simpan data sesi ke localStorage untuk dipakai di halaman game
    localStorage.setItem("activeGroup", JSON.stringify(data));
    
    // Arahkan ke halaman arena CTF
    router.push("/arena");
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-brutal-bg bg-[radial-gradient(#000_1px,transparent_1px)] [background-size:20px_20px]">
      <div className="bg-brutal-yellow border-4 border-black shadow-brutal-lg p-8 w-full max-w-md transform rotate-1 hover:rotate-0 transition-transform duration-300">
        <div className="border-b-4 border-black pb-4 mb-6">
          <h1 className="text-4xl font-black uppercase tracking-tighter">
            CTF Bootcamp
          </h1>
          <p className="text-xl font-bold mt-2">Login Kelompok 🚀</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xl font-bold mb-2 uppercase">
              Masukkan PIN
            </label>
            <input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              className="w-full text-center text-4xl p-4 tracking-widest bg-white focus:bg-brutal-pink transition-colors placeholder:text-gray-300"
              placeholder="••••"
              required
            />
          </div>

          {error && (
            <div className="bg-brutal-pink border-2 border-black p-3 font-bold text-center animate-bounce">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brutal-green p-4 text-2xl font-black uppercase hover:bg-brutal-blue disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            {loading ? "Mengecek..." : "Masuk Arena"}
          </button>
        </form>
      </div>
    </main>
  );
}