import { notFound } from "next/navigation";
import Link from "next/link";
import { PdfReader } from "@/src/editorial/pdf-reader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reader QA Preview" };

export default function ReaderPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="oo-reader-page">
      <div className="oo-reader-heading">
        <Link href="/issues" className="oo-eyebrow">← The archive</Link>
        <p className="oo-eyebrow">LOCAL DEVELOPMENT · QA FIXTURE</p>
        <h1>PDF reader preview</h1>
        <p className="oo-reader-description">A synthetic three-page test document. It is not an issue, is not stored in Supabase, and is never exposed in production.</p>
      </div>
      <PdfReader url="/api/dev/reader-fixture" title="PDF reader QA fixture" downloadName="orbit-reader-qa-fixture.pdf" />
    </main>
  );
}
