import Link from "next/link";
import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[linear-gradient(120deg,_#fff0ed_0%,_#fff0e4_20%,_#fff8dc_40%,_#e9f2df_60%,_#e5f1f3_80%,_#ece9f5_100%)] text-[#173b35]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 md:px-10">
        <Link href="/" aria-label="Gigabyte home" className="flex items-center gap-3">
          <Image src="/gigabyte-logo.svg" alt="" width={42} height={42} priority />
          <span className="text-lg font-extrabold">Gigabyte</span>
        </Link>
        <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm font-semibold">
          <Link href="/about" className="hidden text-[#365a52] transition hover:text-[#e85e45] sm:inline">About</Link>
          <Link href="/feedback" className="inline-flex items-center gap-3 rounded-full bg-[#173b35] px-4 py-2.5 text-white transition hover:bg-[#e85e45] sm:px-5">
            Leave feedback <span aria-hidden="true">&rarr;</span>
          </Link>
        </nav>
      </header>

      <section className="mx-auto grid min-h-[calc(100svh-5rem)] max-w-7xl items-center gap-10 px-5 pb-12 pt-5 md:px-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:pb-16">
        <div className="max-w-2xl py-8">
          <p className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-[#e85e45]">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#e85e45]" aria-hidden="true" />
            The Gigabyte feedback desk
          </p>
          <h1 className="text-5xl font-black leading-[1.02] md:text-7xl">
            Every visit has a story.
            <span className="mt-2 block font-serif font-medium italic text-[#e85e45]">Tell us yours.</span>
          </h1>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#49665f] md:text-lg md:leading-8">
            Tell us what went well, what could be better, and what you would like us to know.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/feedback" className="inline-flex min-h-14 items-center gap-5 rounded-full bg-gradient-to-r from-[#e85e45] via-[#ee7547] to-[#f1a83f] px-6 text-sm font-bold text-white shadow-[0_12px_28px_rgba(232,94,69,0.32)] transition hover:-translate-y-0.5 hover:brightness-105 hover:shadow-[0_16px_34px_rgba(232,94,69,0.4)]">
              Start Your Feedback <span aria-hidden="true" className="text-lg">&rarr;</span>
            </Link>
            <span className="text-sm font-medium text-[#58736b]">Good or bad, we want to hear it.</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-xl lg:py-8">
          <div className="absolute -left-3 top-8 h-24 w-24 rotate-[-8deg] bg-[#f1c84b] sm:-left-6 sm:top-12" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-[2rem] bg-[#164b40] p-6 text-white shadow-[0_28px_60px_rgba(23,59,53,0.2)] sm:p-9">
            <div className="flex items-center justify-between border-b border-white/20 pb-5">
              <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#b8e7c5]">Your experience</span>
              <Image src="/gigabyte-logo.svg" alt="Gigabyte" width={42} height={42} />
            </div>
            <div className="py-8 sm:py-10">
              <p className="text-sm font-medium text-white/70">A few things you can share</p>
              <div className="mt-5 divide-y divide-white/20">
                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-lg font-semibold sm:text-xl">What brought you in?</span>
                  <span className="text-2xl text-[#f1c84b]" aria-hidden="true">01</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-lg font-semibold sm:text-xl">How did it go?</span>
                  <span className="text-2xl text-[#ff9476]" aria-hidden="true">02</span>
                </div>
                <div className="flex items-center justify-between gap-4 py-4">
                  <span className="text-lg font-semibold sm:text-xl">What can we improve?</span>
                  <span className="text-2xl text-[#b8e7c5]" aria-hidden="true">03</span>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-white/20 pt-5 text-sm">
              <span className="text-white/70">Your voice matters here.</span>
              <span className="text-xl text-[#f1c84b]" aria-hidden="true">&#9733;&#9733;&#9733;</span>
            </div>
          </div>
          <div className="absolute -bottom-3 -right-2 h-12 w-24 rotate-[5deg] bg-[#ef8062] sm:-right-5" aria-hidden="true" />
        </div>
      </section>

      <section className="border-t border-[#173b35]/10 bg-white/45">
        <div className="mx-auto grid max-w-7xl gap-5 px-5 py-7 sm:grid-cols-3 sm:gap-8 md:px-10">
          <p className="text-sm font-semibold text-[#365a52]"><span className="mr-3 font-mono text-[#e85e45]">01</span>Share your experience</p>
          <p className="text-sm font-semibold text-[#365a52]"><span className="mr-3 font-mono text-[#e85e45]">02</span>Tell us the details</p>
          <p className="text-sm font-semibold text-[#365a52]"><span className="mr-3 font-mono text-[#e85e45]">03</span>Help us do better</p>
        </div>
      </section>
    </main>
  );
}
