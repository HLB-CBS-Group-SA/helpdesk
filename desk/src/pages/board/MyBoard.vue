<template>
  <!-- HLB-FORK: my-board — a Kanban view of the tickets assigned to me (#57).
       One column per open status, in HD Ticket Status order. A card moves
       to another status by drag, or from its menu. Finished tickets
       (status category Resolved) are not shown. -->
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <div class="text-lg-medium text-ink-gray-9">{{ __("My board") }}</div>
      </template>
      <template #right-header>
        <Button
          :label="__('Refresh')"
          variant="subtle"
          icon-left="lucide-refresh-ccw"
          :loading="tickets.loading"
          @click="tickets.reload()"
        />
      </template>
    </LayoutHeader>
    <div class="flex-1 overflow-x-auto overflow-y-hidden">
      <div class="flex h-full gap-3 p-3 md:p-4 w-max">
        <div
          v-for="column in columns"
          :key="column.status"
          class="flex flex-col w-72 shrink-0 rounded-lg bg-surface-gray-2"
          :class="{ 'ring-2 ring-outline-gray-4': dragOver === column.status }"
          @dragover.prevent="dragOver = column.status"
          @dragleave="dragOver = null"
          @drop.prevent="onDrop(column.status)"
        >
          <div class="flex items-center gap-2 px-3 py-2.5">
            <IndicatorIcon :class="column.color" />
            <span class="text-base-medium text-ink-gray-8 truncate">
              {{ column.status }}
            </span>
            <span class="ml-auto text-sm text-ink-gray-5">
              {{ column.tickets.length }}
            </span>
          </div>
          <div class="flex-1 overflow-y-auto px-2 pb-2 space-y-2">
            <div
              v-for="t in column.tickets"
              :key="t.name"
              draggable="true"
              class="group rounded-md bg-surface-white p-2.5 shadow-sm cursor-pointer hover:ring-1 hover:ring-outline-gray-3"
              @dragstart="dragged = t.name"
              @dragend="dragged = null"
              @click="openTicket(t.name)"
            >
              <div class="flex items-start gap-2">
                <span class="text-sm text-ink-gray-5 shrink-0">
                  #{{ t.name }}
                </span>
                <div class="ml-auto" @click.stop>
                  <Dropdown :options="moveOptions(t)" placement="right">
                    <Button
                      variant="ghost"
                      size="sm"
                      icon="more-horizontal"
                      :aria-label="__('Move to')"
                    />
                  </Dropdown>
                </div>
              </div>
              <div class="mt-1 text-base text-ink-gray-8 line-clamp-2">
                {{ t.subject }}
              </div>
              <div class="mt-2 flex items-center gap-2 text-sm text-ink-gray-5">
                <span class="truncate">{{ t.raised_by }}</span>
                <span v-if="t.priority" class="ml-auto shrink-0">
                  {{ t.priority }}
                </span>
              </div>
            </div>
            <div
              v-if="!column.tickets.length"
              class="px-1 py-4 text-center text-sm text-ink-gray-4"
            >
              {{ __("Nothing here") }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LayoutHeader } from "@/components";
import { IndicatorIcon } from "@/components/icons";
import { useAuthStore } from "@/stores/auth";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import { __ } from "@/translation";
import { HDTicketStatus } from "@/types/doctypes";
import {
  Button,
  createListResource,
  createResource,
  Dropdown,
  toast,
} from "frappe-ui";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { useRouter } from "vue-router";

type BoardTicket = {
  name: string;
  subject: string;
  status: string;
  priority: string;
  raised_by: string;
};

const router = useRouter();
const { userId } = storeToRefs(useAuthStore());
const ticketStatusStore = useTicketStatusStore();

const dragged = ref<string | null>(null);
const dragOver = ref<string | null>(null);

// Open statuses only. Moving a ticket to Cancelled needs a reason and Closed
// is the resolution path, so both stay on the ticket page, where they are
// handled properly.
const openStatuses = computed<HDTicketStatus[]>(
  () =>
    ticketStatusStore.statuses.data?.filter(
      (s: HDTicketStatus) => s.enabled && s.category !== "Resolved"
    ) || []
);

// `_assign` holds a JSON list of user ids; the list filter matches it with
// `like`, the same way the ticket list's "Assigned to" filter does.
const tickets = createListResource({
  doctype: "HD Ticket",
  fields: ["name", "subject", "status", "priority", "raised_by"],
  filters: computed(() => ({
    _assign: ["like", `%${userId.value}%`],
    status_category: ["!=", "Resolved"],
  })),
  orderBy: "modified desc",
  pageLength: 500,
  auto: true,
});

const columns = computed(() =>
  openStatuses.value.map((s) => ({
    status: s.label_agent,
    // parsed_color is added by the status store's transform, not the doctype.
    color: (s as HDTicketStatus & { parsed_color: string }).parsed_color,
    tickets: (tickets.data || []).filter(
      (t: BoardTicket) => t.status === s.label_agent
    ),
  }))
);

const setStatus = createResource({
  url: "frappe.client.set_value",
  onSuccess() {
    tickets.reload();
  },
  onError(error: any) {
    // frappe-ui rejects with an Error; never hand the object to a toast.
    toast.error(
      error?.messages?.[0] || error?.message || __("Could not move the ticket.")
    );
    tickets.reload();
  },
});

function move(name: string, status: string) {
  const ticket = tickets.data?.find((t: BoardTicket) => t.name === name);
  if (!ticket || ticket.status === status) return;
  ticket.status = status; // show it in the new column while the save runs
  setStatus.submit({
    doctype: "HD Ticket",
    name,
    fieldname: "status",
    value: status,
  });
}

function onDrop(status: string) {
  dragOver.value = null;
  if (dragged.value) move(dragged.value, status);
  dragged.value = null;
}

function moveOptions(t: BoardTicket) {
  return openStatuses.value
    .filter((s) => s.label_agent !== t.status)
    .map((s) => ({
      label: __("Move to {0}", s.label_agent),
      onClick: () => move(t.name, s.label_agent),
    }));
}

function openTicket(name: string) {
  router.push({ name: "TicketAgent", params: { ticketId: name } });
}
</script>
