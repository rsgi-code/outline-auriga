import { observer } from "mobx-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type Collection from "~/models/Collection";
import Flex from "~/components/Flex";
import PaginatedList from "~/components/PaginatedList";
import useStores from "~/hooks/useStores";
import { StyledError } from "./Collections";
import Header from "./Header";
import PlaceholderCollections from "./PlaceholderCollections";
import Relative from "./Relative";
import SidebarContext from "./SidebarContext";
import StaticCollectionLink from "./StaticCollectionLink";

// The "Auriga" sidebar section: collections projected from the Auriga
// knowledge store, shown below the normal "Collections" section as a fixed,
// read-only group — no "+ New collection" action and no drag-to-reorder.
function AurigaCollections() {
  const { documents, collections } = useStores();
  const { t } = useTranslation();
  const orderedCollections = collections.aurigaActive;

  const params = useMemo(() => ({ limit: 100 }), []);

  if (orderedCollections.length === 0) {
    return null;
  }

  return (
    <SidebarContext.Provider value="collections">
      <Flex column>
        <Header id="auriga-collections" title={t("Auriga")}>
          <Relative>
            <PaginatedList<Collection>
              options={params}
              aria-label={t("Auriga")}
              items={orderedCollections}
              loading={<PlaceholderCollections />}
              renderError={(props) => <StyledError {...props} />}
              renderItem={(item) => (
                <StaticCollectionLink
                  key={item.id}
                  collection={item}
                  activeDocument={documents.active}
                />
              )}
            />
          </Relative>
        </Header>
      </Flex>
    </SidebarContext.Provider>
  );
}

export default observer(AurigaCollections);
