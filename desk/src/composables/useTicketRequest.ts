// HLB-FORK: request-form — a ticket type's own form is its own DocType
// (company_helpdesk hd_ticket/requests.py, owner 2026-10-22). The server sends
// the form's fields (api.request_form, api.ticket_request); this turns them
// into the shape UniInput draws, and groups them by the DocType's sections.
// A condition that cannot be evaluated HIDES its field: upstream's
// evaluateDependsOnValue shows it, which is how every type's fields once
// showed on the wrong ticket.
import type { Field } from "@/types";

export type RequestField = {
  fieldname: string;
  label?: string;
  fieldtype: string;
  options?: string;
  reqd?: 0 | 1;
  read_only?: 0 | 1;
  set_only_once?: 0 | 1;
  depends_on?: string;
  mandatory_depends_on?: string;
  description?: string;
  placeholder?: string;
  hlb_multiple?: 0 | 1;
  url_method?: string;
};

export type RequestSection = { label: string; fields: Field[] };

const LAYOUT = new Set(["Section Break", "Column Break", "Tab Break"]);

/** Whether a field's condition holds; false when it cannot be read. */
export function holds(
  expression: string | undefined,
  doc: Record<string, any>
): boolean {
  if (!expression) return true;
  const code = expression.startsWith("eval:")
    ? expression.slice(5)
    : `doc.${expression}`;
  try {
    return Boolean(new Function("doc", `return (${code});`)(doc));
  } catch {
    return false;
  }
}

/**
 * The form's fields as UniInput fields, in sections, against these values.
 * `saved`: the request exists, so a set-only-once field is fixed (app #119).
 */
export function requestSections(
  fields: RequestField[],
  doc: Record<string, any>,
  readonly: boolean,
  saved = false
): RequestSection[] {
  const sections: RequestSection[] = [{ label: "", fields: [] }];
  for (const f of fields || []) {
    if (f.fieldtype === "Section Break") {
      sections.push({ label: f.label || "", fields: [] });
      continue;
    }
    if (LAYOUT.has(f.fieldtype)) continue;
    const shown = holds(f.depends_on, doc);
    const fixed = Boolean(
      readonly || f.read_only || (saved && f.set_only_once)
    );
    sections[sections.length - 1].fields.push({
      fieldname: f.fieldname,
      fieldtype: f.fieldtype,
      label: f.label || f.fieldname,
      options: f.options || "",
      required: Boolean(
        f.reqd || (f.mandatory_depends_on && holds(f.mandatory_depends_on, doc))
      )
        ? 1
        : 0,
      placeholder: f.placeholder || null,
      url_method: f.url_method,
      hlb_multiple: f.hlb_multiple,
      display_via_depends_on: shown ? "1" : "",
      disabled: fixed,
      readonly: fixed,
    } as Field);
  }
  return sections.filter((s) => s.fields.some((f) => f.display_via_depends_on));
}

/** The first required field that is showing and empty, for Submit's message. */
export function missingRequired(
  fields: RequestField[],
  doc: Record<string, any>
): Field | undefined {
  return requestSections(fields, doc, false)
    .flatMap((s) => s.fields)
    .find(
      (f) =>
        f.required &&
        f.display_via_depends_on &&
        [null, undefined, ""].includes(doc[f.fieldname])
    );
}
