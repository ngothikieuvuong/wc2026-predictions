import { getTournament } from "@/lib/tournament";

export const revalidate = 300; // refresh standings every 5 minutes

// FIFA dates are UTC; show Vietnam time (UTC+7) regardless of server timezone.
function viDateTime(iso: string): string {
  if (!iso) return "";
  const v = new Date(new Date(iso).getTime() + 7 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(v.getUTCHours())}:${p(v.getUTCMinutes())} ${p(v.getUTCDate())}/${p(
    v.getUTCMonth() + 1
  )}`;
}

export default async function TournamentPage() {
  const { groups, rounds, error } = await getTournament();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Giải đấu</h1>
        <p className="text-sm text-white/50">
          Bảng xếp hạng và nhánh đấu tới chung kết (cập nhật tự động).
        </p>
      </div>

      {error && (
        <div className="card text-white/50">Không tải được dữ liệu giải đấu.</div>
      )}

      {/* Group standings */}
      {groups.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
            Bảng xếp hạng
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.name} className="card p-0 overflow-hidden">
                <div className="border-b border-white/10 px-4 py-2 text-sm font-bold">
                  Bảng {g.name.replace("Group ", "")}
                </div>
                <table className="w-full text-sm">
                  <thead className="text-[11px] uppercase tracking-wider text-white/40">
                    <tr>
                      <th className="px-3 py-2 text-left font-medium">Đội</th>
                      <th className="px-2 py-2 text-center font-medium">Tr</th>
                      <th className="px-2 py-2 text-center font-medium">Hiệu</th>
                      <th className="px-3 py-2 text-center font-medium">Đ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r, i) => (
                      <tr
                        key={r.name}
                        className={`border-t border-white/5 ${
                          i < 2 ? "bg-grass/10" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          <span className="mr-2 text-white/40">{i + 1}</span>
                          {r.name}
                        </td>
                        <td className="px-2 py-2 text-center text-white/60">{r.P}</td>
                        <td className="px-2 py-2 text-center text-white/60">
                          {r.GD > 0 ? `+${r.GD}` : r.GD}
                        </td>
                        <td className="px-3 py-2 text-center font-bold">{r.Pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <p className="text-xs text-white/30">2 đội đầu mỗi bảng (xanh) đi tiếp.</p>
        </section>
      )}

      {/* Knockout bracket */}
      {rounds.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-widest text-white/50">
            Vòng loại trực tiếp
          </h2>
          {rounds.map((round) => (
            <div key={round.name} className="card space-y-2">
              <h3 className="font-bold">{round.name}</h3>
              <ul className="space-y-1.5">
                {round.matches.map((m, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-2 rounded-lg bg-black/20 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 text-right font-medium">{m.home}</span>
                    <span className="min-w-14 text-center font-bold text-white/80">
                      {m.played ? `${m.hs}–${m.as}` : "vs"}
                    </span>
                    <span className="flex-1 font-medium">{m.away}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
