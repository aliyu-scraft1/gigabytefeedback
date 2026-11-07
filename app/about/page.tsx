import Image from "next/image";

export default function About() {
  return (
    <div className="mx-auto my-5 flex max-w-md items-center gap-x-4 rounded-xl bg-white p-6 shadow-lg outline outline-black/5 dark:bg-slate-800 dark:shadow-none dark:-outline-offset-1 dark:outline-white/10">
      <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-slate-950 ring-1 ring-slate-200">
        <Image src="/gigabyte-logo.svg" alt="Gigabyte logo" width={52} height={52} className="h-12 w-12 object-contain" />
      </div>
      <div>
        <div className="text-xl font-medium text-black dark:text-white">Gigabyte</div>
        <p className="text-gray-500 dark:text-gray-400">Your customer feedback system.</p>
      </div>
    </div>
  );
}
