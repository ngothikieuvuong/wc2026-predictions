import { getTournament } from "@/lib/tournament";
import { getTopScorers } from "@/lib/scorers";
import GiaiTabs from "@/components/GiaiTabs";

export const revalidate = 300; // refresh standings every 5 minutes

export default async function TournamentPage() {
  const [{ groups, groupFixtures, rounds, error }, top] = await Promise.all([
    getTournament(),
    getTopScorers().catch(() => ({ scorers: [], assists: [] })),
  ]);
  return (
    <GiaiTabs
      groups={groups}
      groupFixtures={groupFixtures}
      rounds={rounds}
      scorers={top.scorers}
      assists={top.assists}
      error={error}
    />
  );
}
