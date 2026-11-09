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

  <!-- HLB-FORK: due-date-status — Scheduled task, Meeting planned, Suspended and
       Delayed need a reason and a date, sent with the status (app hd_ticket/due_date.py, #192). -->
  <Dialog
    v-model="change.dueDialog.show"
    :options="{ title: __('Move to {0}', [__(change.dueDialog.status)]) }"
  >
    <template #body-content>
      <p class="text-p-sm text-ink-gray-6 mb-3">
        {{
          __(
            "The SLA clock is held, and the ticket is due on this date. The reason is kept on the ticket as an internal comment."
          )
        }}
      </p>
      <FormControl
        v-model="change.dueDialog.reason"
        type="textarea"
        :label="__('Reason / Meeting details')"
        :disabled="ticket.setValue.loading"
      />
      <div class="mt-3">
        <div class="mb-1.5 text-xs text-ink-gray-5">
          {{ __("Due date / Meeting date") }}
        </div>
        <DateTimePicker
          :value="change.dueDialog.date"
          :format="dateTimeFormat"
          :disabled="ticket.setValue.loading"
          @change="(v: string) => (change.dueDialog.date = v)"
        />
      </div>
      <p v-if="change.dueDialog.error" class="text-p-sm text-ink-red-7 mt-2">
        {{ change.dueDialog.error }}
      </p>
    </template>
    <template #actions>
      <Button
        class="w-full"
        variant="solid"
        :loading="ticket.setValue.loading"
        :disabled="
          change.dueDialog.reason.trim().length < change.dueReasonMinLength ||
          !change.dueDialog.date
        "
        :label="__('Move to {0}', [__(change.dueDialog.status)])"
        @click="change.confirmDue"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// HLB-FORK: cancel-reason / close-comment / due-date-status — the dialogs of the agent
// status menu, for the desktop header and the mobile page. The state and the
// rules are in composables/useTicketStatusChange.ts.
import type { TicketStatusChange } from "@/composables/useTicketStatusChange";
import { __ } from "@/translation";
import { Button, DateTimePicker, Dialog, FormControl } from "frappe-ui";

defineProps<{
  change: TicketStatusChange;
  ticket: any;
}>();

// Same format as the ticket sidebar's date fields (components/TicketField.vue).
const dateTimeFormat = `${window.date_format.toUpperCase()} ${
  window.time_format
}`;
</script>
