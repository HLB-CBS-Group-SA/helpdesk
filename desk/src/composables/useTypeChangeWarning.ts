// HLB-FORK: type-change-warning — ask before a ticket's type changes (owner,
// 2026-10-19). Which fields belong to which type comes from the server
// (company_helpdesk hd_ticket/types.py intake_config), never a copy here.
import { globalStore } from "@/stores/globalStore";
import { __ } from "@/translation";
import { createResource } from "frappe-ui";

type IntakeConfig = Record<
  string,
  { subtype_field: string | null; owned: string[] }
>;

const intakeConfig = createResource({
  url: "company_helpdesk.hd_ticket.types.intake_config",
  method: "GET",
  cache: ["hlb", "intake_config"],
  auto: true,
});

function owns(entries: string[], fieldname: string): boolean {
  return entries.some(
    (e) => fieldname === e || (e.endsWith("_") && fieldname.startsWith(e))
  );
}

/** The fields of `ticketType` that hold an answer in `values`. */
export function answersOf(
  ticketType: string,
  values: Record<string, any>
): string[] {
  const owned =
    (intakeConfig.data as IntakeConfig | undefined)?.[ticketType]?.owned || [];
  return Object.keys(values).filter(
    (f) => owns(owned, f) && ![null, undefined, "", 0].includes(values[f])
  );
}

/** Ask "Change the ticket type?"; `onConfirm` runs only on the button. */
export function confirmTypeChange(message: string, onConfirm: () => void) {
  const { $dialog } = globalStore();
  $dialog({
    title: __("Change the ticket type?"),
    message,
    actions: [
      {
        label: __("Change type"),
        variant: "solid",
        onClick(close: () => void) {
          onConfirm();
          close();
        },
      },
    ],
  });
}
