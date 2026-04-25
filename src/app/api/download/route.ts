import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const audioUrl = request.nextUrl.searchParams.get("url");
    const fileName = request.nextUrl.searchParams.get("name") || "songmaker-track.mp3";

    if (!audioUrl) {
      return NextResponse.json(
        { error: "Missing audio URL" },
        { status: 400 }
      );
    }

    // Fetch audio dari external URL
    const response = await fetch(audioUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch audio: ${response.statusText}` },
        { status: response.status }
      );
    }

    const buffer = await response.arrayBuffer();

    // Return sebagai downloadable file
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Failed to download audio" },
      { status: 500 }
    );
  }
}
