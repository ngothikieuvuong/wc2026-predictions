import { getTournament } from "@/lib/tournament";
import Bracket from "@/components/Bracket";
import PageHeader from "@/components/PageHeader";

export const revalidate = 300; // refresh bracket every 5 minutes

export default async function SoDoPage() {
  const { rounds, error } = await getTournament();
  return (
    <div className="space-y-5">
      <PageHeader
        title="Sơ đồ"
        subtitle="Vòng loại trực tiếp — Round of 32 đến Chung kết."
      />
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
