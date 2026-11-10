import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }
  try {
    const file = await readFile(join(process.cwd(), "tests", "fixtures", "reader-fixture.pdf"));
    return new NextResponse(file, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(file.byteLength),
        "Cache-Control": "no-store",
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": 'inline; filename="orbit-reader-qa-fixture.pdf"',
      },
    });
  } catch {
    return new NextResponse("Reader QA fixture is missing.", { status: 404 });
  }
}
