import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  try {
    const { gameName } = await req.json();
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: "gemini-3.5-flash" });

    const prompt = `Sebagai instruktur IT, susun 7 tahapan task progresif untuk membuat game "${gameName}" menggunakan HTML, CSS, dan JavaScript. Instruksi harus ringkas untuk siswa SMP. 
    Format output WAJIB berupa JSON array murni tanpa backtick markdown. Nomor task HARUS dimulai dari angka 2 hingga 8. 
    Struktur persis seperti ini:
    [
      { "task_number": 2, "title": "Setup Kerangka HTML", "reqs": ["Instruksi 1", "Instruksi 2"] }
    ]`;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // DEBUG: Menampilkan balasan mentah AI di Terminal VS Code
    console.log("=== BALASAN MENTAH AI ===");
    console.log(text);
    console.log("=========================");

    // Pembersihan teks super aman dari sisa markdown AI
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    const jsonStart = text.indexOf('[');
    const jsonEnd = text.lastIndexOf(']');
    
    if (jsonStart === -1 || jsonEnd === -1) {
      console.error("Gagal menemukan pola Array JSON dari balasan AI.");
      return NextResponse.json({ error: "Format AI tidak sesuai" }, { status: 400 });
    }

    const cleanJsonText = text.substring(jsonStart, jsonEnd + 1);
    type AITask = {
      task_number: number;
      title: string;
      reqs?: string[];
      requirements?: string[];
    };

    const aiTasks: AITask[] = JSON.parse(cleanJsonText);

    // Sisipkan Task 1 dan 9, pastikan key 'reqs' seragam agar tidak ditolak database
    const finalTasks = [
      { task_number: 1, title: "Registrasi Pasukan", reqs: ["Masukkan nama lengkap semua anggota tim", "Tentukan peran masing-masing (contoh: Hacker, Hustler, Hipster)"] },
      ...aiTasks.map((t: AITask) => ({
        task_number: t.task_number,
        title: t.title,
        reqs: t.reqs || t.requirements || ["Instruksi tidak ditemukan"] // Antisipasi jika AI salah memberikan nama properti
      })),
      { task_number: 9, title: "Misi Terakhir: Laporan Tempur", reqs: ["Masukkan link presentasi proyek (PPT/Canva)", "Masukkan link video demonstrasi hasil game kalian"] }
    ];

    return NextResponse.json(finalTasks);

  } catch (error) {
    // DEBUG: Menampilkan error spesifik di Terminal VS Code
    console.error("=== ERROR DI BACKEND API ===");
    console.error(error);
    return NextResponse.json({ error: "Gagal memproses AI" }, { status: 500 });
  }
}