import { observer } from "mobx-react";
import { transparentize } from "polished";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import styled from "styled-components";
import { EditorStyleHelper } from "@shared/editor/styles/EditorStyleHelper";
import { depths, hideScrollbars, s } from "@shared/styles";
import breakpoint from "styled-components-breakpoint";
import { useDocumentContext } from "~/components/DocumentContext";
import type Document from "~/models/Document";
import { client } from "~/utils/ApiClient";

// Auriga document/section attributes, displayed in the same rail as the table
// of contents (the two are mutually exclusive — see UiStore.set). Document-
// level properties render at the top; section-level properties follow in
// document order, matched to headings by their text.

type PropertiesData = {
  found: boolean;
  document: Record<string, unknown>;
  sections: Record<string, Record<string, unknown>>;
};

function formatValue(value: unknown): string {
  if (value === null || value === undefined) {
    return "—";
  }
  if (Array.isArray(value)) {
    return value.map(formatValue).join(", ");
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value);
}

function PropertyRows({ attrs }: { attrs: Record<string, unknown> }) {
  return (
    <Rows>
      {Object.entries(attrs).map(([key, value]) => (
        <Row key={key}>
          <Key>{key}</Key>
          <Value>{formatValue(value)}</Value>
        </Row>
      ))}
    </Rows>
  );
}

function Properties({ document }: { document: Document }) {
  const { t } = useTranslation();
  const { headings } = useDocumentContext();
  const [data, setData] = useState<PropertiesData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(false);
    void client
      .post("/auriga.properties", { id: document.id })
      .then((res) => {
        if (!cancelled) {
          setData((res?.data as PropertiesData) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [document.id]);

  const documentAttrs = data?.document ?? {};
  const sections = data?.sections ?? {};
  const hasDocumentAttrs = Object.keys(documentAttrs).length > 0;
  const hasSections = Object.keys(sections).length > 0;

  // Order section groups by their position in the document; unmatched
  // section keys (heading renamed since ingestion, etc.) render at the end.
  const orderedSections: Array<{
    key: string;
    id: string | null;
    attrs: Record<string, unknown>;
  }> = [];
  const remaining = new Map(Object.entries(sections));
  for (const heading of headings) {
    const match = remaining.get(heading.title.trim());
    if (match) {
      orderedSections.push({ key: heading.title.trim(), id: heading.id, attrs: match });
      remaining.delete(heading.title.trim());
    }
  }
  for (const [key, attrs] of remaining) {
    orderedSections.push({ key, id: null, attrs });
  }

  return (
    <StickyWrapper>
      <Heading>{t("Properties")}</Heading>
      {error ? (
        <Empty>{t("Something went wrong")}</Empty>
      ) : data === null ? (
        <Empty>{t("Loading")}…</Empty>
      ) : !data.found || (!hasDocumentAttrs && !hasSections) ? (
        <Empty>{t("No properties")}</Empty>
      ) : (
        <>
          {hasDocumentAttrs && <PropertyRows attrs={documentAttrs} />}
          {orderedSections.map((section) => (
            <Section key={section.key}>
              <SectionHeading>
                {section.id ? (
                  <a href={`#${section.id}`}>{section.key}</a>
                ) : (
                  section.key
                )}
              </SectionHeading>
              <PropertyRows attrs={section.attrs} />
            </Section>
          ))}
        </>
      )}
    </StickyWrapper>
  );
}

// Mirrors the Contents (table of contents) wrapper so the panel swaps
// seamlessly into the same rail.
const StickyWrapper = styled.div`
  display: none;
  position: sticky;
  top: 90px;
  max-height: calc(100vh - 90px);
  width: ${EditorStyleHelper.tocWidth}px;

  ${hideScrollbars()}

  padding: 0 16px;
  overflow-y: auto;
  border-radius: 8px;
  background: ${s("background")};

  @supports (backdrop-filter: blur(20px)) {
    backdrop-filter: blur(20px);
    background: ${(props) => transparentize(0.2, props.theme.background)};
  }

  ${breakpoint("tablet")`
    display: block;
    z-index: ${depths.toc};
  `};
`;

const Heading = styled.h3`
  font-size: 13px;
  font-weight: 600;
  color: ${s("textTertiary")};
  letter-spacing: 0.03em;
  margin-top: 10px;
`;

const Empty = styled.p`
  font-size: 14px;
  color: ${s("textTertiary")};
`;

const Section = styled.div`
  margin-top: 12px;
`;

const SectionHeading = styled.h4`
  font-size: 13px;
  font-weight: 600;
  margin: 0 0 4px;
  word-break: break-word;

  a {
    color: ${s("text")};

    &:hover {
      color: ${s("accent")};
    }
  }
`;

const Rows = styled.dl`
  margin: 0;
  font-size: 13px;
`;

const Row = styled.div`
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
`;

const Key = styled.dt`
  flex: none;
  max-width: 45%;
  color: ${s("textTertiary")};
  word-break: break-word;
`;

const Value = styled.dd`
  margin: 0;
  color: ${s("text")};
  word-break: break-word;
`;

export default observer(Properties);
