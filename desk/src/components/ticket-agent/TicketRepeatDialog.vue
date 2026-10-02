<!-- HLB-FORK: ticket-repeat — repeat this ticket on a schedule (app #81).
     frappe's Auto Repeat copies the ticket on each due date. Set here through
     company_helpdesk api.get_repeat / set_repeat / stop_repeat, which check
     that the agent may change this ticket, so nobody needs Desk or rights on
     Auto Repeat. The ticket itself stays as it is: each copy is a new ticket. -->
<template>
  <Dialog v-model="show" :options="{ title: __('Repeat ticket #{0}', [ticket]) }">
    <template #body-content>
      <p class="text-p-sm text-ink-gray-6 mb-4">
        {{
          __(
            "A copy of this ticket is raised on each date. Copies of a Personal Task stay yours alone."
          )
        }}
      </p>
      <div class="flex flex-col gap-4">
        <FormControl
          v-model="form.frequency"
          type="select"
          :label="__('How often')"
          :options="frequencies"
        />
        <FormControl
          v-model="form.start_date"
          type="date"
          :label="__('First copy on')"
        />
        <FormControl
          v-model="form.end_date"
          type="date"
          :label="__('Stop after (optional)')"
        />
      </div>
      <p
        v-if="repeat.data?.next_schedule_date"
        class="text-p-sm text-ink-gray-6 mt-3"
      >
        {{ __("Next copy: {0}", [repeat.data.next_schedule_date]) }}
      </p>
      <p v-if="error" class="text-p-sm text-ink-red-3 mt-2">{{ error }}</p>
    </template>
    <template #actions>
      <div class="flex w-full gap-2">
        <Button
          v-if="repeat.data"
          class="flex-1"
          variant="subtle"
          :label="__('Stop repeating')"
          :loading="saving"
          @click="stop"
        />
        <Button
          class="flex-1"
          variant="solid"
          :label="repeat.data ? __('Save') : __('Repeat')"
          :loading="saving"
          :disabled="!form.frequency || !form.start_date"
          @click="save"
        />
      </div>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { __ } from "@/translation";
import {
  Button,
  call,
  createResource,
  Dialog,
  FormControl,
  toast,
} from "frappe-ui";
import { reactive, ref, watch } from "vue";

const props = defineProps<{ ticket: string }>();
const show = defineModel<boolean>({ default: false });

const frequencies = [
  "Daily",
  "Weekly",
  "Fortnightly",
  "Monthly",
  "Quarterly",
  "Half-yearly",
  "Yearly",
].map((f) => ({ label: __(f), value: f }));

const form = reactive({ frequency: "Monthly", start_date: "", end_date: "" });
const saving = ref(false);
const error = ref("");

const repeat = createResource({
  url: "company_helpdesk.api.get_repeat",
  method: "GET",
  makeParams: () => ({ ticket: props.ticket }),
  onSuccess(data: any) {
    form.frequency = data?.frequency || "Monthly";
    form.start_date = data?.start_date || "";
    form.end_date = data?.end_date || "";
  },
});

watch(show, (open) => {
  if (!open) return;
  error.value = "";
  repeat.reload();
});

function errorText(err: any, fallback: string): string {
  // frappe-ui rejects with an Error; never hand the object to a toast.
  return err?.messages?.[0] || err?.message || fallback;
}

function save() {
  saving.value = true;
  error.value = "";
  call("company_helpdesk.api.set_repeat", {
    ticket: props.ticket,
    frequency: form.frequency,
    start_date: form.start_date,
    end_date: form.end_date || null,
  })
    .then(() => {
      toast.success(__("This ticket now repeats."));
      show.value = false;
    })
    .catch((err: any) => {
      error.value = errorText(err, __("Could not set the repeat."));
    })
    .finally(() => (saving.value = false));
}

function stop() {
  saving.value = true;
  error.value = "";
  call("company_helpdesk.api.stop_repeat", { ticket: props.ticket })
    .then(() => {
      toast.success(__("This ticket no longer repeats."));
      show.value = false;
    })
    .catch((err: any) => {
      error.value = errorText(err, __("Could not stop the repeat."));
    })
    .finally(() => (saving.value = false));
}
</script>
