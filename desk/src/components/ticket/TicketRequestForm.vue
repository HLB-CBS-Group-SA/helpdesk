<template>
  <!-- HLB-FORK: request-form — a ticket type's own form, drawn from its
       DocType (company_helpdesk hd_ticket/requests.py, 2026-10-22): its
       sections, its fields, its conditions. No per-type markup here. -->
  <div class="flex flex-col gap-5">
    <div
      v-for="(section, i) in sections"
      :key="section.label || i"
      class="flex flex-col gap-3"
    >
      <span v-if="section.label" class="text-base font-medium text-ink-gray-8">
        {{ __(section.label) }}
      </span>
      <div
        class="grid grid-cols-1 gap-4 grid-flow-row-dense"
        :class="!compact && 'sm:grid-cols-3'"
      >
        <UniInput
          v-for="field in section.fields"
          :key="field.fieldname"
          :class="!compact && field.hlb_multiple && 'sm:col-span-3'"
          :field="field"
          :value="values[field.fieldname]"
          @change="(e) => emit('change', e)"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { UniInput } from "@/components";
import {
  type RequestField,
  requestSections,
} from "@/composables/useTicketRequest";
import { __ } from "@/translation";
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    fields: RequestField[];
    values: Record<string, any>;
    // Ticket values the form's conditions also read (the HR sub-type).
    context?: Record<string, any>;
    readonly?: boolean;
    // One column, for the agent sidebar.
    compact?: boolean;
    // The request exists: its set-only-once fields are fixed (app #119).
    saved?: boolean;
  }>(),
  { context: () => ({}), readonly: false, compact: false, saved: false }
);
const emit = defineEmits<{
  (e: "change", value: { fieldname: string; value: any }): void;
}>();

const sections = computed(() =>
  requestSections(
    props.fields,
    { ...props.context, ...props.values },
    props.readonly,
    props.saved
  )
);
</script>
