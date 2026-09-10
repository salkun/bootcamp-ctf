import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
  // 1. Kumpulkan semua API Key dari .env dan abaikan yang kosong
  const apiKeys = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_2,
    process.env.GEMINI_API_KEY_3
  ].filter(Boolean) as string[];

  if (apiKeys.length === 0) {
    return NextResponse.json({ valid: false, hint: "Konfigurasi server (API Key) tidak ditemukan." });
  }

  try {
    const { html, css, js, taskRequirements } = await req.json();

    const prompt = `Kamu adalah AI Validator koding. Evaluasi kode berikut berdasarkan syarat misi: ${JSON.stringify(taskRequirements)}
    
    Kode Siswa:
    [HTML]: ${html}
    [CSS]: ${css}
    [JS]: ${js}

    ATURAN KETAT:
    1. Jika kode kosong, berisi komentar bawaan saja, atau isinya ngasal/tidak nyambung dengan misi, WAJIB kembalikan valid: false.
    2. Jika memenuhi syarat logika dasar, kembalikan valid: true.
    3. Jika valid: false, berikan 'hint' (petunjuk bahasa Indonesia yang ramah, membimbing, dan tidak terlalu teknis. JANGAN beri jawaban kodenya langsung).
    
    Output WAJIB berupa JSON murni:
    { "valid": boolean, "hint": "pesan petunjuk" }`;

    // 2. Looping Fallback: Coba satu per satu API Key
    for (let i = 0; i < apiKeys.length; i++) {
      try {
        const genAI = new GoogleGenerativeAI(apiKeys[i]);
        
        // Menggunakan Flash-Lite Latest yang memiliki kuota gratis terbesar
        const model = genAI.getGenerativeModel({ model: "gemini-flash-lite-latest" });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        
        // Pencarian pola JSON secara manual untuk mengakali format kotor dari AI
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error("Format respons tidak valid, beralih ke key berikutnya...");
        }
        
        const parsedData = JSON.parse(jsonMatch[0]);
        
        // Jika sukses, langsung kembalikan respons dan hentikan loop
        return NextResponse.json(parsedData);

      } catch (keyError: unknown) {
        console.warn(`[WARNING] API Key ke-${i + 1} gagal atau terkena limit 429. Beralih...`);
        // Jika ini adalah API Key terakhir dan tetap gagal, lempar ke catch utama
        if (i === apiKeys.length - 1) throw keyError;
      }
    }

  } catch (error) {
    console.error("=== SEMUA API KEY HABIS/LIMIT ===");
    console.error(error);
    return NextResponse.json({ 
      valid: false, 
      hint: "Sistem validator sedang penuh! Tarik napas, tunggu 15 detik, dan coba kirim lagi." 
    });
  }
}