// HLB-FORK: cancel-reason / HLB-FORK: close-comment — the agent status menu, shared by the
// desktop header and the mobile page so both apply the same rules.
//
// Cancelled asks for a reason and Closed asks for a comment (app
// ticket.validate_cancellation, hd_ticket/closing.py). Whether to ask, how to
// word it, the closed status name and the minimum comment length all come from
// the server (company_helpdesk.api.cancel_context), so no rule is repeated here.
// The mobile page sent the bare status, and the server refused every close and
// cancel made there (review 2026-10-19).
import { useNotifyTicketUpdate } from "@/composables/realtime";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import { __ } from "@/translation";
import { HDTicketStatus } from "@/types/doctypes";
import { errorText } from "@/utils";
import { createResource } from "frappe-ui";
import { computed, h, reactive, watch, type Ref } from "vue";
import { IndicatorIcon } from "@/components/icons";

const CANCELLED = "Cancelled";

export function useTicketStatusChange(ticket: Ref<any>, onChanged: () => void) {
  const ticketStatusStore = useTicketStatusStore();
  const { notifyTicketUpdate } = useNotifyTicketUpdate(ticket.value?.name);

  // May this person cancel, and is it a decline? Asked of the server, so the
  // menu and the rule that enforces it cannot disagree.
  const cancelContext = createResource({
    url: "company_helpdesk.api.cancel_context",
    makeParams: () => ({ ticket: ticket.value?.name }),
    auto: true,
  });

  function changed() {
    onChanged();
    cancelContext.reload();
  }

  // HLB-FORK: status-sets — the allowed statuses follow the ticket and its type,
  // so a type change, or another ticket in the same page, asks again.
  watch(
    () => [ticket.value?.name, ticket.value?.doc?.ticket_type],
    (now, before) => {
      if (before && now.join() !== before.join()) cancelContext.reload();
    }
  );

  const cancelDialog = reactive({
    show: false,
    reason: "",
    error: "",
    declining: false,
  });

  function openCancelDialog() {
    cancelDialog.reason = "";
    cancelDialog.error = "";
    cancelDialog.declining = Boolean(cancelContext.data?.declining);
    cancelDialog.show = true;
  }

  function confirmCancel() {
    const reason = cancelDialog.reason.trim();
    if (!reason) return;
    cancelDialog.error = "";
    notifyTicketUpdate("Status", CANCELLED);
    ticket.value.setValue.submit(
      { status: CANCELLED, cancel_reason: reason },
      {
        onSuccess() {
          cancelDialog.show = false;
          changed();
        },
        onError(error: any) {
          cancelDialog.error = errorText(error, __("Could not cancel."));
        },
      }
    );
  }

  const closedStatus = computed(() => cancelContext.data?.closed_status);
  const closeMinLength = computed(
    () => cancelContext.data?.close_comment_min_length ?? 1
  );
  const closeDialog = reactive({ show: false, comment: "", error: "" });
  const closeWithComment = createResource({
    url: "company_helpdesk.hd_ticket.closing.close_with_comment",
    onSuccess() {
      closeDialog.show = false;
      notifyTicketUpdate("Status", closedStatus.value);
      ticket.value.reload();
      changed();
    },
    onError(error: any) {
      closeDialog.error = errorText(error, __("Could not close the ticket."));
    },
  });

  function openCloseDialog() {
    closeDialog.comment = "";
    closeDialog.error = "";
    closeDialog.show = true;
  }

  function confirmClose() {
    closeDialog.error = "";
    closeWithComment.submit({
      ticket: ticket.value.doc.name,
      comment: closeDialog.comment.trim(),
    });
  }

  function choose(status: string) {
    const current = ticket.value.doc.status;
    if (status === CANCELLED && current !== CANCELLED) {
      openCancelDialog();
      return;
    }
    if (
      status === closedStatus.value &&
      current !== closedStatus.value &&
      cancelContext.data?.close_comment
    ) {
      openCloseDialog();
      return;
    }
    if (current === status) return;
    notifyTicketUpdate("Status", status);
    ticket.value.setValue.submit({ status }, { onSuccess: changed });
  }

  // The status menu: the statuses this ticket's type uses, in the server's
  // order, and Cancelled only for people who may cancel, worded as Decline on a
  // request waiting for its approving team. A final status (Cancelled,
  // Declined) offers none: the server refuses every move out of it.
  // HLB-FORK: status-sets — the allowed list comes from cancel_context (2026-10-21).
  const allowed = computed<string[]>(() =>
    cancelContext.data?.locked ? [] : cancelContext.data?.statuses || []
  );
  const statusOptions = computed(() =>
    (ticketStatusStore.statuses.data || [])
      // The value of a status is its label_agent, as everywhere in this menu.
      .filter(
        (s: HDTicketStatus) =>
          s.enabled && allowed.value.includes(s.label_agent)
      )
      .sort(
        (a: HDTicketStatus, b: HDTicketStatus) =>
          allowed.value.indexOf(a.label_agent) -
          allowed.value.indexOf(b.label_agent)
      )
      .filter(
        (s: HDTicketStatus) =>
          s.label_agent !== CANCELLED ||
          ticket.value.doc?.status === CANCELLED ||
          cancelContext.data?.allowed
      )
      .map((o: HDTicketStatus) => ({
        label:
          o.label_agent === CANCELLED && cancelContext.data?.declining
            ? __("Decline (Cancelled)")
            : __(o.label_agent),
        value: o.label_agent,
        onClick: () => choose(o.label_agent),
        icon: () => h(IndicatorIcon, { class: o.parsed_color }),
      }))
  );

  return reactive({
    cancelContext,
    cancelDialog,
    closeDialog,
    closeWithComment,
    closeMinLength,
    statusOptions,
    confirmCancel,
    confirmClose,
  });
}

export type TicketStatusChange = ReturnType<typeof useTicketStatusChange>;
