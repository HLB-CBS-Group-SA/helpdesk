<template>
  <!-- HLB-FORK: cancel-reason — cancelling needs a reason (app
       ticket.validate_cancellation), sent WITH the status; the ticket's own
       "Reason for cancellation" field only renders once the status already is
       Cancelled. Only offered to people who may cancel (Super Admins, or the
       approving team on a request waiting on it, where it reads as Decline).
       See customisations.manifest.json id=ui-cancel-reason. -->
  <Dialog
    v-model="change.cancelDialog.show"
    :options="{
      title: change.cancelDialog.declining
        ? __('Decline request')
        : __('Cancel ticket'),
    }"
  >
    <template #body-content>
      <p class="text-p-sm text-ink-gray-6 mb-3">
        {{
          change.cancelDialog.declining
            ? __(
                "The request is declined and cancelled, and the person who raised it is told why."
              )
            : __(
                "The ticket is cancelled, and the person who raised it is told why."
              )
        }}
      </p>
      <FormControl
        v-model="change.cancelDialog.reason"
        type="textarea"
        :label="__('Reason')"
        :disabled="ticket.setValue.loading"
      />
      <p v-if="change.cancelDialog.error" class="text-p-sm text-ink-red-7 mt-2">
        {{ change.cancelDialog.error }}
      </p>
    </template>
    <template #actions>
      <Button
        class="w-full"
        variant="solid"
        theme="red"
        :loading="ticket.setValue.loading"
        :disabled="!change.cancelDialog.reason.trim()"
        :label="
          change.cancelDialog.declining ? __('Decline') : __('Cancel ticket')
        "
        @click="change.confirmCancel"
      />
    </template>
  </Dialog>

  <!-- HLB-FORK: close-comment — closing asks what was done; the server refuses
       a close without it (app hd_ticket/closing.py, manifest ui-close-comment). -->
  <Dialog
    v-model="change.closeDialog.show"
    :options="{ title: __('Close ticket #{0}', [ticket?.doc?.name]) }"
  >
    <template #body-content>
      <p class="text-p-sm text-ink-gray-6 mb-3">
        {{
          __(
            "Say what was done. The comment is kept on the ticket as an internal comment."
          )
        }}
      </p>
      <FormControl
        v-model="change.closeDialog.comment"
        type="textarea"
        :label="__('Closing comment')"
        :disabled="change.closeWithComment.loading"
      />
      <p v-if="change.closeDialog.error" class="text-p-sm text-ink-red-7 mt-2">
        {{ change.closeDialog.error }}
      </p>
    </template>
    <template #actions>
      <Button
        class="w-full"
        variant="solid"
        :loading="change.closeWithComment.loading"
        :disabled="
          change.closeDialog.comment.trim().length < change.closeMinLength
        "
        :label="__('Close ticket')"
        @click="change.confirmClose"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// HLB-FORK: cancel-reason / HLB-FORK: close-comment — the two dialogs of the agent status
// menu, for the desktop header and the mobile page. The state and the rules
// are in composables/useTicketStatusChange.ts.
import type { TicketStatusChange } from "@/composables/useTicketStatusChange";
import { __ } from "@/translation";
import { Button, Dialog, FormControl } from "frappe-ui";

defineProps<{
  change: TicketStatusChange;
  ticket: any;
}>();
</script>
