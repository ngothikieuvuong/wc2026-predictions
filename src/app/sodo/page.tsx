import Link from "next/link";
import { getTournament } from "@/lib/tournament";
import Bracket from "@/components/Bracket";
import PageHeader from "@/components/PageHeader";

export const revalidate = 300; // refresh bracket every 5 minutes

export default async function SoDoPage() {
  const { rounds, error } = await getTournament();
  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <PageHeader
          title="Sơ đồ"
          subtitle="Vòng loại trực tiếp — Round of 32 đến Chung kết."
        />
        <Link
          href="/giai"
          className="mt-1 shrink-0 rounded-full border border-white/15 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/70 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
        >
          📅 Xem lịch
        </Link>
      </div>
      {error || rounds.length === 0 ? (
        <div className="card text-white/50">Chưa có sơ đồ vòng loại.</div>
      ) : (
        <div className="card overflow-hidden">
          <Bracket rounds={rounds} />
          <p className="mt-2 text-center text-[11px] text-white/30">
            Kéo ngang để xem hết · tên đội tự điền sau khi xong vòng bảng.
          </p>
        </div>
      )}
    </div>
  );
}
