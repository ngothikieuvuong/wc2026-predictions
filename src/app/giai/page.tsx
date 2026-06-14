import { getTournament } from "@/lib/tournament";
import GiaiTabs from "@/components/GiaiTabs";

export const revalidate = 300; // refresh standings every 5 minutes

export default async function TournamentPage() {
  const { groups, groupFixtures, rounds, error } = await getTournament();
  return (
    <GiaiTabs
      groups={groups}
      groupFixtures={groupFixtures}
      rounds={rounds}
      error={error}
    />
  );
}
