import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main" className="container-page py-24 text-center sm:py-32">
        <p className="eyebrow">Page not found</p>
        <h1 className="mt-3 text-4xl sm:text-5xl">This page could not be found</h1>
        <p className="mx-auto mt-4 max-w-md text-muted">The page may have moved. You can browse all volumes of the series below.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/books" className="btn-primary">Browse the books</Link>
          <Link href="/" className="btn-outline">Home</Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
