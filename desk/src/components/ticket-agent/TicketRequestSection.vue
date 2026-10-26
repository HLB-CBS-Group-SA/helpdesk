<template>
  <!-- HLB-FORK: request-form — the ticket type's own form on the agent's
       ticket page (company_helpdesk hd_ticket/requests.py, 2026-10-22). The
       server says which fields this agent may edit; set-only-once fields are
       fixed once the request exists (app #119). -->
  <ErrorMessage
    v-if="request.error"
    class="px-4 py-2"
    :message="errorText(request.error, __('Could not load the request form.'))"
  />
  <Section
    v-else-if="request.data"
    :label="__(request.data.doctype)"
    v-model:opened="opened"
  >
    <div class="pb-2 pt-0.5">
      <TicketRequestForm
        :fields="request.data.fields"
        :values="request.data.values"
        :context="context"
        :readonly="!request.data.can_write || save.loading"
        :compact="compact"
        saved
        @change="onChange"
      />
    </div>
  </Section>
</template>

<script setup lang="ts">
import Section from "@/components/Section.vue";
import TicketRequestForm from "@/components/ticket/TicketRequestForm.vue";
import { __ } from "@/translation";
import { errorText } from "@/utils";
import { createResource, ErrorMessage, toast } from "frappe-ui";
import { ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    ticketId: string;
    // Ticket values the form's conditions read (the HR sub-type).
    context?: Record<string, any>;
    compact?: boolean;
  }>(),
  { context: () => ({}), compact: false }
);
const emit = defineEmits<{ (e: "changed"): void }>();

const opened = ref(true);

const request = createResource({
  url: "company_helpdesk.api.ticket_request",
  method: "GET",
  makeParams: () => ({ ticket: props.ticketId }),
  auto: true,
});
watch(
  () => props.ticketId,
  () => request.reload()
);

const save = createResource({
  url: "company_helpdesk.api.save_ticket_request",
  onSuccess(data: any) {
    request.data = data;
    emit("changed");
  },
  onError(error: any) {
    toast.error(errorText(error, __("The change was not saved.")));
    request.reload();
  },
});

function onChange(e: { fieldname: string; value: any }) {
  if (request.data?.values?.[e.fieldname] === e.value) return;
  save.submit({ ticket: props.ticketId, values: { [e.fieldname]: e.value } });
}

defineExpose({ reload: () => request.reload() });
</script>
