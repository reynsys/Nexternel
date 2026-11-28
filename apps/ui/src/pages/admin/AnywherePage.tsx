import { Stack } from "@mui/material";
import { PageHeader } from "../../components/PageHeader";
import { AnywhereCard } from "./settings/AnywhereCard";

/** Extensions → Nexternel Anywhere: open Nexternel away from home (a paid service), with its name. */
export function AnywherePage() {
  return (
    <Stack spacing={3}>
      <PageHeader title="Nexternel Anywhere" />
      <AnywhereCard />
    </Stack>
  );
}
