import * as React from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { s } from "@shared/styles";
import Button from "~/components/Button";
import Flex from "~/components/Flex";
import { StyledButton } from "~/components/FilterOptions";
import Text from "~/components/Text";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/primitives/Popover";
import { client } from "~/utils/ApiClient";

// Property conditions for Auriga-backed advanced search. Serialized as JSON
// into the `properties` query-string param; the Outline server maps them to
// Auriga's structured filter syntax.

export type PropertyCondition = {
  field: string;
  op: string;
  value?: string | number | boolean | Array<string | number>;
};

type AurigaField = {
  field: string;
  type: string; // keyword | integer | float | bool | datetime | text | uuid
};

export function parsePropertyConditions(raw: string): PropertyCondition[] {
  if (!raw) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (c): c is PropertyCondition =>
        !!c && typeof c.field === "string" && typeof c.op === "string"
    );
  } catch {
    return [];
  }
}

const OPS_BY_TYPE: Record<string, Array<{ op: string; label: string }>> = {
  keyword: [
    { op: "is", label: "is" },
    { op: "not", label: "is not" },
    { op: "any", label: "is any of" },
    { op: "is_empty", label: "is empty" },
    { op: "is_null", label: "is null" },
  ],
  uuid: [
    { op: "is", label: "is" },
    { op: "not", label: "is not" },
  ],
  integer: [
    { op: "is", label: "=" },
    { op: "gt", label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt", label: "<" },
    { op: "lte", label: "≤" },
    { op: "is_null", label: "is null" },
  ],
  float: [
    { op: "is", label: "=" },
    { op: "gt", label: ">" },
    { op: "gte", label: "≥" },
    { op: "lt", label: "<" },
    { op: "lte", label: "≤" },
    { op: "is_null", label: "is null" },
  ],
  datetime: [
    { op: "gte", label: "on or after" },
    { op: "gt", label: "after" },
    { op: "lte", label: "on or before" },
    { op: "lt", label: "before" },
  ],
  bool: [{ op: "is", label: "is" }],
  text: [{ op: "contains", label: "contains" }],
};

const NO_VALUE_OPS = new Set(["is_empty", "is_null"]);

function typeOf(fields: AurigaField[], field: string): string {
  return fields.find((f) => f.field === field)?.type ?? "keyword";
}

function coerceValue(
  type: string,
  op: string,
  raw: string
): PropertyCondition["value"] {
  if (NO_VALUE_OPS.has(op)) {
    return undefined;
  }
  if (op === "any") {
    return raw
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
  }
  if (type === "integer" || type === "float") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  }
  if (type === "bool") {
    return raw === "true";
  }
  return raw;
}

function conditionSummary(conditions: PropertyCondition[]): string | null {
  if (conditions.length === 0) {
    return null;
  }
  const first = conditions[0];
  const value = Array.isArray(first.value)
    ? first.value.join(", ")
    : (first.value ?? "");
  const head = `${first.field} ${first.op} ${value}`.trim();
  return conditions.length > 1
    ? `${head} +${conditions.length - 1}`
    : head;
}

type Props = {
  conditions: PropertyCondition[];
  onChange: (conditions: PropertyCondition[]) => void;
};

function PropertyFilter({ conditions, onChange }: Props) {
  const { t } = useTranslation();
  const [fields, setFields] = React.useState<AurigaField[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    if (loaded) {
      return;
    }
    void client
      .post("/auriga.info")
      .then((res) => {
        setFields((res?.data?.fields as AurigaField[]) ?? []);
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [loaded]);

  const update = (index: number, patch: Partial<PropertyCondition>) => {
    const next = conditions.map((c, i) =>
      i === index ? { ...c, ...patch } : c
    );
    onChange(next);
  };

  const handleFieldChange = (index: number, field: string) => {
    const type = typeOf(fields, field);
    const ops = OPS_BY_TYPE[type] ?? OPS_BY_TYPE.keyword;
    update(index, { field, op: ops[0].op, value: undefined });
  };

  const handleOpChange = (index: number, op: string) => {
    const condition = conditions[index];
    update(index, {
      op,
      value: NO_VALUE_OPS.has(op) ? undefined : condition.value,
    });
  };

  const handleValueChange = (index: number, raw: string) => {
    const condition = conditions[index];
    const type = typeOf(fields, condition.field);
    update(index, { value: coerceValue(type, condition.op, raw) });
  };

  const addCondition = () => {
    const field = fields[0]?.field ?? "";
    const type = typeOf(fields, field);
    const ops = OPS_BY_TYPE[type] ?? OPS_BY_TYPE.keyword;
    onChange([...conditions, { field, op: ops[0].op }]);
  };

  const removeCondition = (index: number) => {
    onChange(conditions.filter((_, i) => i !== index));
  };

  const summary = conditionSummary(conditions);

  return (
    <Popover modal={false}>
      <PopoverTrigger>
        <StyledButton neutral disclosure>
          {summary ?? t("Properties")}
        </StyledButton>
      </PopoverTrigger>
      <PopoverContent
        aria-label={t("Property filters")}
        width={420}
        side="bottom"
        align="start"
      >
        <Flex column gap={8}>
          {fields.length === 0 ? (
            <Text type="secondary" size="small">
              {loaded
                ? t("No filterable properties are configured")
                : `${t("Loading")}…`}
            </Text>
          ) : (
            <>
              {conditions.map((condition, index) => {
                const type = typeOf(fields, condition.field);
                const ops = OPS_BY_TYPE[type] ?? OPS_BY_TYPE.keyword;
                const valueText = Array.isArray(condition.value)
                  ? condition.value.join(", ")
                  : String(condition.value ?? "");
                return (
                  <Flex key={index} align="center" gap={4}>
                    <Select
                      value={condition.field}
                      onChange={(ev) =>
                        handleFieldChange(index, ev.target.value)
                      }
                    >
                      {fields.map((f) => (
                        <option key={f.field} value={f.field}>
                          {f.field}
                        </option>
                      ))}
                    </Select>
                    <Select
                      value={condition.op}
                      onChange={(ev) => handleOpChange(index, ev.target.value)}
                    >
                      {ops.map((o) => (
                        <option key={o.op} value={o.op}>
                          {o.label}
                        </option>
                      ))}
                    </Select>
                    {NO_VALUE_OPS.has(condition.op) ? null : type ===
                      "bool" ? (
                      <Select
                        value={String(condition.value ?? "true")}
                        onChange={(ev) =>
                          handleValueChange(index, ev.target.value)
                        }
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </Select>
                    ) : (
                      <ValueInput
                        value={valueText}
                        placeholder={
                          condition.op === "any"
                            ? t("Comma-separated values")
                            : type === "datetime"
                              ? "2026-01-01"
                              : t("Value")
                        }
                        onChange={(ev) =>
                          handleValueChange(index, ev.target.value)
                        }
                      />
                    )}
                    <RemoveButton
                      neutral
                      borderOnHover
                      onClick={() => removeCondition(index)}
                      aria-label={t("Remove condition")}
                    >
                      ×
                    </RemoveButton>
                  </Flex>
                );
              })}
              <div>
                <Button neutral onClick={addCondition}>
                  {t("Add condition")}
                </Button>
              </div>
            </>
          )}
        </Flex>
      </PopoverContent>
    </Popover>
  );
}

const Select = styled.select`
  background: ${s("background")};
  color: ${s("text")};
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  height: 28px;
  font-size: 14px;
  max-width: 130px;
`;

const ValueInput = styled.input`
  background: ${s("background")};
  color: ${s("text")};
  border: 1px solid ${s("inputBorder")};
  border-radius: 4px;
  height: 28px;
  font-size: 14px;
  padding: 0 6px;
  flex: 1;
  min-width: 80px;
`;

const RemoveButton = styled(Button)`
  flex: none;
`;

export default PropertyFilter;
