<template>
  <!-- HLB-FORK: my-board — a Kanban view of the tickets assigned to me (#57).
       One column per open status. A card moves to another status by drag,
       or from its menu. Finished tickets (status category Resolved) are not
       shown. Each agent picks which columns show, and their order, under
       "Columns" (#93); the choice is kept in this browser.
       Opened from a saved view (`?view=`), the board also applies that view's
       filters and shows its name: the seeded private view "My tasks" is this
       board for Personal Tasks only, and can be pinned to the sidebar like any
       private view (app #81). Each view keeps its own column choice. -->
  <div class="flex flex-col h-full">
    <LayoutHeader>
      <template #left-header>
        <div class="text-lg-medium text-ink-gray-9">
          {{ boardView?.label || __("My board") }}
        </div>
      </template>
      <template #right-header>
        <NestedPopover placement="bottom-end">
          <template #target>
            <Button :label="__('Columns')" variant="subtle">
              <template #prefix>
                <ColumnsIcon class="h-4" />
              </template>
            </Button>
          </template>
          <template #body>
            <div
              class="my-2 p-1.5 min-w-56 rounded-lg bg-surface-elevation-2 shadow-2xl ring-1 ring-black ring-opacity-5"
            >
              <Draggable
                :model-value="settingsRows"
                item-key="status"
                :delay="isTouchScreenDevice() ? 200 : 0"
                @update:model-value="setOrder"
              >
                <template #item="{ element }">
                  <div
                    class="flex cursor-grab items-center gap-2 rounded px-2 py-1.5 text-base text-ink-gray-8 hover:bg-surface-gray-2"
                  >
                    <DragIcon class="h-3.5 shrink-0" />
                    <FormControl
                      type="checkbox"
                      :label="element.status"
                      :model-value="element.shown"
                      @update:model-value="(v) => setShown(element.status, v)"
                    />
                  </div>
                </template>
              </Draggable>
              <div
                class="mt-1.5 flex gap-1 border-t border-outline-elevation-2 pt-1.5"
              >
                <Button
                  class="flex-1"
                  variant="ghost"
                  :label="__('Show all')"
                  @click="showAllColumns"
                />
                <Button
                  class="flex-1"
                  variant="ghost"
                  :label="__('Reset')"
                  @click="resetColumns"
                />
              </div>
            </div>
          </template>
        </NestedPopover>
        <Button
          :label="__('Refresh')"
          variant="subtle"
          icon-left="lucide-refresh-ccw"
          :loading="tickets.loading"
          @click="tickets.reload()"
        />
      </template>
    </LayoutHeader>
    <div
      v-if="truncated"
      class="border-b border-outline-gray-2 px-4 py-2 text-sm text-ink-gray-6"
    >
      {{
        __(
          "Showing the first {0} tickets. Narrow the board with a saved view to see the rest.",
          [PAGE_LENGTH]
        )
      }}
    </div>
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
        <div
          v-if="!columns.length && openStatuses.length"
          class="self-center px-4 text-sm text-ink-gray-5"
        >
          {{ __("Every column is hidden. Choose some under Columns.") }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { LayoutHeader } from "@/components";
import { ColumnsIcon, DragIcon, IndicatorIcon } from "@/components/icons";
import NestedPopover from "@/components/NestedPopover.vue";
import { useAuthStore } from "@/stores/auth";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import { __ } from "@/translation";
import { HDTicketStatus } from "@/types/doctypes";
import { isTouchScreenDevice } from "@/utils";
import { useStorage } from "@vueuse/core";
import {
  Button,
  createListResource,
  createResource,
  Dropdown,
  FormControl,
  toast,
} from "frappe-ui";
import { storeToRefs } from "pinia";
import { useView } from "@/composables/useView";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import Draggable from "vuedraggable";

type BoardTicket = {
  name: string;
  subject: string;
  status: string;
  priority: string;
  raised_by: string;
};

const router = useRouter();
const route = useRoute();
const { userId } = storeToRefs(useAuthStore());
const { views } = useView("HD Ticket");
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

// The saved view the board was opened from, if any. The views resource has
// already parsed its `filters` into an object (useView.ts).
const viewName = computed(() => (route.query.view as string) || "");
const boardView = computed(() =>
  viewName.value
    ? views.data?.find((v: { name: string }) => v.name === viewName.value)
    : null
);

// `_assign` holds a JSON list of user ids, so match the id with its quotes:
// unquoted, ann@ would also match joann@ (C-06). A view's filters narrow the
// board; they never widen it, because the board's own two conditions are
// applied last.
const PAGE_LENGTH = 500;
const boardFilters = computed(() => ({
  ...(boardView.value?.filters || {}),
  _assign: ["like", `%"${userId.value}"%`],
  status_category: ["!=", "Resolved"],
}));
const tickets = createListResource({
  doctype: "HD Ticket",
  fields: ["name", "subject", "status", "priority", "raised_by"],
  filters: boardFilters,
  orderBy: "modified desc",
  pageLength: PAGE_LENGTH,
});
// A full page means there may be more; say so rather than hide them silently.
const truncated = computed(
  () => (tickets.data?.length || 0) >= PAGE_LENGTH
);
// A list resource reads its filters only when it fetches, so load explicitly:
// once the view (if any) has loaded, and again when the filters change, such
// as when moving between My board and a view of it. Waiting for the views
// keeps the unfiltered board from showing first.
watch(
  () =>
    viewName.value && !views.data ? null : JSON.stringify(boardFilters.value),
  (key) => key && tickets.reload(),
  { immediate: true }
);

// ---- which columns show, and in what order (#93), per agent, in this browser.
// Until an agent chooses, the board uses the order the team agreed. A status
// not named here goes after these, in HD Ticket Status order. Unassigned is
// hidden at first: assigning a ticket moves it out of Unassigned, so on a
// board of my assigned tickets that column is almost always empty.
const DEFAULT_ORDER = [
  "Not yet started",
  "In progress",
  "Pending approval",
  "Awaiting feedback",
  "Meeting planned",
  "Pending Procurement",
  "Escalated",
  "Unassigned",
];
const DEFAULT_HIDDEN = ["Unassigned"];

const boardSettings = useStorage<{ order: string[]; hidden: string[] }>(
  () =>
    `hlb-my-board-columns:${userId.value}` +
    (viewName.value ? `:${viewName.value}` : ""),
  { order: [], hidden: [...DEFAULT_HIDDEN] },
  localStorage,
  { mergeDefaults: true }
);

const sameStatus = (a: string, b: string) =>
  a.toLowerCase() === b.toLowerCase();

const orderedStatuses = computed<HDTicketStatus[]>(() => {
  const order = boardSettings.value.order.length
    ? boardSettings.value.order
    : DEFAULT_ORDER;
  const rank = (s: HDTicketStatus) => {
    const i = order.findIndex((name) => sameStatus(name, s.label_agent));
    return i === -1 ? order.length : i;
  };
  // Array.sort is stable, so unranked statuses keep the store's order.
  return [...openStatuses.value].sort((a, b) => rank(a) - rank(b));
});

function isHidden(status: string): boolean {
  return boardSettings.value.hidden.some((name) => sameStatus(name, status));
}

const settingsRows = computed(() =>
  orderedStatuses.value.map((s) => ({
    status: s.label_agent,
    shown: !isHidden(s.label_agent),
  }))
);

function setOrder(rows: { status: string }[]) {
  boardSettings.value.order = rows.map((r) => r.status);
}

// Sets, never toggles: frappe-ui's Checkbox emits update:modelValue twice per
// click (defineModel and an explicit emit), so a toggle undid itself (#93).
function setShown(status: string, shown: boolean) {
  const hidden = boardSettings.value.hidden.filter(
    (name) => !sameStatus(name, status)
  );
  boardSettings.value.hidden = shown ? hidden : [...hidden, status];
}

function showAllColumns() {
  boardSettings.value.hidden = [];
}

function resetColumns() {
  boardSettings.value = { order: [], hidden: [...DEFAULT_HIDDEN] };
}

const columns = computed(() =>
  orderedStatuses.value
    .filter((s) => !isHidden(s.label_agent))
    .map((s) => ({
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
  return orderedStatuses.value
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
