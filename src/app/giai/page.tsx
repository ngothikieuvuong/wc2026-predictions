import { getTournament } from "@/lib/tournament";
import GiaiTabs from "@/components/GiaiTabs";

export const revalidate = 300; // refresh standings every 5 minutes

export default async function TournamentPage() {
  const { groups, rounds, error } = await getTournament();
  return <GiaiTabs groups={groups} rounds={rounds} error={error} />;
}
