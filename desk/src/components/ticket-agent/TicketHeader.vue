<template>
  <LayoutHeader>
    <template #left-header>
      <div class="flex flex-col truncate">
        <Breadcrumbs :items="breadcrumbs" class="breadcrumbs -ms-0.5">
          <template #prefix="{ item }">
            <Icon
              v-if="item.icon"
              :icon="item.icon"
              class="me-1 h-4 flex items-center justify-center self-center"
            />
          </template>
        </Breadcrumbs>
      </div>
    </template>
    <template #right-header>
      <div class="flex gap-2 items-center">
        <MultipleAvatar
          :avatars="JSON.stringify(viewers)"
          size="md"
          :hide-name="true"
        />
        <!-- Custom Actions -->
        <div v-if="normalActions.length" class="flex gap-2">
          <Button v-for="action in normalActions" v-bind="action">
            <template v-if="action.icon" #prefix>
              <FeatherIcon :name="action.icon" class="h-4 w-4" />
            </template>
          </Button>
        </div>
        <div v-if="groupedWithLabelActions.length">
          <div v-for="g in groupedWithLabelActions" :key="g.label">
            <Dropdown v-slot="{ open }" :options="g.action">
              <Button :label="__(g.label)">
                <template #suffix>
                  <FeatherIcon
                    :name="open ? 'chevron-up' : 'chevron-down'"
                    class="h-4"
                  />
                </template>
              </Button>
            </Dropdown>
          </div>
        </div>
        <!-- Status -->
        <Dropdown :options="statusChange.statusOptions" placement="right">
          <template #default="{ open }">
            <Button :label="__(ticket.doc.status)" ref="statusRef">
              <template #prefix>
                <IndicatorIcon
                  :class="
                    ticketStatusStore.getStatus(ticket.doc.status)?.parsed_color
                  "
                />
              </template>
            </Button>
          </template>
        </Dropdown>
        <!-- Core Actions + Custom Actions -->
        <Dropdown
          v-if="groupedActions[0]?.items?.length >= 1"
          :options="groupedActions"
          placement="right"
        >
          <Button icon="lucide-more-horizontal" />
        </Dropdown>
      </div>
    </template>
  </LayoutHeader>
  <TicketMergeModal
    :ticket="ticket.doc"
    v-if="showMergeModal"
    v-model="showMergeModal"
    @update="ticket.reload()"
  />
  <TicketSubjectModal v-model="showSubjectDialog" />
  <!-- HLB-FORK: ticket-repeat — see TicketRepeatDialog.vue. -->
  <TicketRepeatDialog
    v-if="ticket?.doc?.name"
    v-model="showRepeatDialog"
    :ticket="String(ticket.doc.name)"
  />

  <!-- HLB-FORK: cancel-reason / HLB-FORK: close-comment — the reason and closing-comment
       dialogs, shared with the mobile page. See TicketStatusDialogs.vue. -->
  <TicketStatusDialogs :change="statusChange" :ticket="ticket" />

  <!-- HLB-FORK: delete-reason — the single-ticket Delete asks why, like the
       list's bulk Delete does, and goes through the same endpoint. Upstream's
       plain confirm called helpdesk.api.ticket.delete_ticket, which
       company_helpdesk's on_trash guard refuses (no reason given); the refusal
       then reached toast.error() as an Error object and rendered as an empty
       bubble (#52). Offered to Super Admins only. -->
  <Dialog
    v-model="deleteDialog.show"
    :options="{ title: __('Delete ticket #{0}', [ticket?.doc?.name]) }"
  >
    <template #body-content>
      <p class="text-p-sm text-ink-gray-6 mb-3">
        {{
          __(
            "This cannot be undone, so say why — the reason is kept after the ticket is gone."
          )
        }}
      </p>
      <FormControl
        v-model="deleteDialog.reason"
        type="textarea"
        :label="__('Reason for deletion')"
        :placeholder="__('e.g. Spam received by email / duplicate of #0123')"
        :disabled="deleteDialog.loading"
      />
      <p v-if="deleteDialog.error" class="text-p-sm text-ink-red-7 mt-2">
        {{ deleteDialog.error }}
      </p>
    </template>
    <template #actions>
      <Button
        class="w-full"
        variant="solid"
        theme="red"
        icon-left="trash-2"
        :loading="deleteDialog.loading"
        :disabled="deleteDialog.reason.trim().length < 5"
        :label="__('Delete')"
        @click="confirmDelete"
      />
    </template>
  </Dialog>
</template>

<script setup lang="ts">
import { MultipleAvatar } from "@/components";
import LayoutHeader from "@/components/LayoutHeader.vue";
import TicketMergeModal from "@/components/ticket/TicketMergeModal.vue";
// HLB-FORK: ticket-repeat
import TicketRepeatDialog from "@/components/ticket-agent/TicketRepeatDialog.vue";
import TicketStatusDialogs from "@/components/ticket-agent/TicketStatusDialogs.vue";
import { useTicketStatusChange } from "@/composables/useTicketStatusChange";
import { showMergeModal } from "@/pages/ticket/modalStates";
import { setupCustomizations } from "@/composables/formCustomisation";
import { useShortcut } from "@/composables/shortcuts";
import { useView } from "@/composables/useView";
import { globalStore } from "@/stores/globalStore";
import { useTicketStatusStore } from "@/stores/ticketStatus";
import { __ } from "@/translation";
import {
  ActivitiesSymbol,
  CustomizationSymbol,
  TicketSymbol,
  View,
} from "@/types";
import { getIcon } from "@/utils";
// HLB-FORK: error-text
import { errorText } from "@/utils";
import {
  Breadcrumbs,
  Button,
  call,
  createResource,
  // HLB-FORK: cancel-reason
  Dialog,
  Dropdown,
  FormControl,
  toast,
} from "frappe-ui";
import {
  computed,
  ComputedRef,
  h,
  inject,
  onMounted,
  PropType,
  reactive,
  ref,
  useTemplateRef,
  watchEffect,
} from "vue";
import { useRoute, useRouter } from "vue-router";
import LucideMerge from "~icons/lucide/merge";
// HLB-FORK: ticket-repeat
import LucideRepeat from "~icons/lucide/repeat";
import { IndicatorIcon } from "../icons";
import TicketSubjectModal from "./TicketSubjectModal.vue";
const { $dialog } = globalStore();

defineProps({
  viewers: {
    type: Array as PropType<string[]>,
    required: true,
  },
});

const route = useRoute();
const router = useRouter();
const { findView } = useView("HD Ticket");
const ticketStatusStore = useTicketStatusStore();

const ticket = inject(TicketSymbol)!;
const customizations = inject(CustomizationSymbol)!;
const activities = inject(ActivitiesSymbol)!;
const showSubjectDialog = ref(false);


// HLB-FORK: cancel-reason / HLB-FORK: close-comment — the status menu and its two
// dialogs, shared with the mobile page (composables/useTicketStatusChange.ts).
const statusChange = useTicketStatusChange(ticket, () =>
  activities.value.reload()
);
const cancelContext = statusChange.cancelContext;

const breadcrumbs = computed(() => {
  let items = [{ label: __("Tickets"), route: { name: "TicketsAgent" } }];
  if (route.query.view) {
    const currView: ComputedRef<View> = findView(route.query.view as string);
    if (currView) {
      items.push({
        label: __(currView.value?.label),
        icon: getIcon(currView.value?.icon),
        route: { name: "TicketsAgent", query: { view: currView.value?.name } },
      });
    }
  }
  items.push({
    label: ticket.value.doc?.subject,
    onClick: () => {
      showSubjectDialog.value = true;
    },
  });
  return items;
});

function updateField(fieldname: string, value: string, callback = () => {}) {
  const doc = ticket.value;
  doc.setValue.submit({
    [fieldname]: value,
  });
  callback();
}

// HLB-FORK: ticket-repeat
const showRepeatDialog = ref(false);

// HLB-FORK: delete-reason — see the dialog in the template.
const deleteDialog = reactive({
  show: false,
  reason: "",
  error: "",
  loading: false,
});

function handleDeleteTicket() {
  deleteDialog.reason = "";
  deleteDialog.error = "";
  deleteDialog.loading = false;
  deleteDialog.show = true;
}

function confirmDelete() {
  const reason = deleteDialog.reason.trim();
  if (reason.length < 5) return;
  deleteDialog.loading = true;
  deleteDialog.error = "";
  call("company_helpdesk.setup.deletion.delete_with_reason", {
    tickets: JSON.stringify([ticket?.value?.doc.name]),
    reason,
  })
    .then((result: { deleted: string[]; failed: { error: string }[] }) => {
      if (result?.deleted?.length) {
        deleteDialog.show = false;
        toast.success(__("Ticket deleted."));
        router.push({ name: "TicketsAgent" });
        return;
      }
      deleteDialog.error =
        result?.failed?.[0]?.error || __("Could not delete the ticket.");
    })
    .catch((error: any) => {
      deleteDialog.error = errorText(error, __("Could not delete the ticket."));
    })
    .finally(() => {
      deleteDialog.loading = false;
    });
}

const ticketCount = createResource({
  url: "frappe.client.get_count",
  makeParams: () => ({
    doctype: "HD Ticket",
    filters: {
      status_category: ["!=", "Resolved"],
      is_merged: 0,
    },
  }),
  auto: true,
});
const showMergeOption = computed(() => {
  return (
    !ticket?.value?.doc?.is_merged &&
    ["Open", "Paused"].includes(ticket?.value?.doc?.status_category) &&
    ticketCount.data > 1
  );
});
const defaultActions = computed(() => {
  let items = [];

  if (showMergeOption.value) {
    items.push({
      label: __("Merge Ticket"),
      icon: LucideMerge,
      condition: () => !ticket.value.doc.is_merged,
      onClick: () => (showMergeModal.value = true),
    });
  }
  // HLB-FORK: ticket-repeat — raise a copy of this ticket on a schedule (#81).
  items.push({
    label: __("Repeat"),
    icon: LucideRepeat,
    onClick: () => (showRepeatDialog.value = true),
  });

  return [
    {
      group: __("Default actions"),
      hideLabel: true,
      items,
    },
  ];
});

const deleteAction = computed(() => {
  // HLB-FORK: delete-reason — Super Admins only (#52), as the server decides.
  if (!cancelContext.data?.can_delete) return [];
  return [
    {
      group: __("Default actions"),
      hideLabel: true,
      items: [
        {
          label: __("Delete"),
          component: h(Button, {
            label: __("Delete"),
            variant: "ghost",
            iconLeft: "trash-2",
            theme: "red",
            style: "width: 100%; justify-content: flex-start;",
            onClick: handleDeleteTicket,
          }),
        },
      ],
    },
  ];
});

const actions = ref<any[]>([]);
const normalActions = computed(() => {
  return actions.value.filter((action) => !action.group);
});

const groupedWithLabelActions = computed(() => {
  let _actions = [];

  actions.value
    .filter((action) => action.buttonLabel && action.group)
    .forEach((action) => {
      let groupIndex = _actions.findIndex(
        (a) => a.label === action.buttonLabel
      );
      if (groupIndex > -1) {
        _actions[groupIndex].action.push(action);
      } else {
        _actions.push({
          label: __(action.buttonLabel),
          action: [action],
        });
      }
    });
  return _actions;
});

const groupedActions = computed(() => {
  let _actions = [];
  _actions = _actions.concat(defaultActions.value);
  _actions = _actions.concat(
    actions.value.filter((action) => action.group && !__(action.buttonLabel))
  );
  _actions = _actions.concat(deleteAction.value);
  return _actions;
});

const customizationCtx = computed(() => ({
  doc: ticket?.value?.doc,
  call,
  router,
  toast,
  $dialog: globalStore().$dialog,
  updateField,
  createToast: toast.create,
}));

// to manage the correct  customization context for actions, happens because of navigation between tickets using buttons
watchEffect(async () => {
  if (customizations.value?.data) {
    await setupCustomizations(
      customizations.value.data,
      customizationCtx.value
    );

    actions.value = [...(customizations.value?.data?._customActions || [])];
  }
});

const statusRef = useTemplateRef("statusRef");

onMounted(() => {
  useShortcut("s", () => {
    statusRef.value?.$el?.click();
  });
});
</script>

<style>
.breadcrumbs button {
  background-color: inherit !important;
  &:hover,
  &:focus {
    background-color: inherit !important;
  }
}
</style>
