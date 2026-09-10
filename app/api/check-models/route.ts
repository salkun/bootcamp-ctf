import { NextResponse } from "next/server";

// Tambahkan interface ini untuk menggantikan 'any'
interface GeminiModel {
  name: string;
  displayName: string;
  version: string;
  supportedGenerationMethods: string[];
}

export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json({ error: "API Key tidak ditemukan di file .env" }, { status: 400 });
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    
    if (!response.ok) {
      const errorData = await response.json();
      return NextResponse.json({ 
        error: "Gagal mengambil daftar model", 
        details: errorData 
      }, { status: response.status });
    }

    const data = await response.json();

    // Ganti (m: any) menjadi (m: GeminiModel)
    const availableModels = data.models.map((m: GeminiModel) => ({
      name: m.name,
      displayName: m.displayName,
      version: m.version,
      supportedGenerationMethods: m.supportedGenerationMethods
    }));

    return NextResponse.json({ 
      total: availableModels.length, 
      models: availableModels 
    });

  } catch (error) {
    console.error("Model Check Error:", error);
    return NextResponse.json({ error: "Terjadi kesalahan sistem internal" }, { status: 500 });
  }
}