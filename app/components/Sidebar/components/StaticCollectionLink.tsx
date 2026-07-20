import { observer } from "mobx-react";
import { useState, useEffect, useCallback } from "react";
import type Collection from "~/models/Collection";
import type Document from "~/models/Document";
import { useLocationSidebarContext } from "~/hooks/useLocationSidebarContext";
import useStores from "~/hooks/useStores";
import CollectionLink from "./CollectionLink";
import SidebarDisclosureContext, {
  useSidebarDisclosureState,
} from "./SidebarDisclosureContext";
import { useSidebarContext } from "./SidebarContext";

type Props = {
  collection: Collection;
  activeDocument: Document | undefined;
};

// A collection link with no drag-to-reorder affordance — used by the Auriga
// section so those collections form a fixed, non-rearrangeable group. Mirrors
// DraggableCollectionLink's expand behaviour without the react-dnd wiring.
function StaticCollectionLink({ collection, activeDocument }: Props) {
  const locationSidebarContext = useLocationSidebarContext();
  const sidebarContext = useSidebarContext();
  const { ui } = useStores();
  const [expanded, setExpanded] = useState(
    collection.id === ui.activeCollectionId &&
      sidebarContext === locationSidebarContext
  );

  const { event: disclosureEvent, onDisclosureClick } =
    useSidebarDisclosureState();

  useEffect(() => {
    if (
      collection.id === ui.activeCollectionId &&
      sidebarContext === locationSidebarContext
    ) {
      setExpanded(true);
    }
  }, [
    collection.id,
    ui.activeCollectionId,
    sidebarContext,
    locationSidebarContext,
  ]);

  const handleDisclosureClick = useCallback(
    (ev) => {
      ev?.preventDefault();
      setExpanded((e) => {
        const willExpand = !e;
        onDisclosureClick(willExpand, !!ev?.altKey);
        return willExpand;
      });
    },
    [onDisclosureClick]
  );

  return (
    <SidebarDisclosureContext.Provider value={disclosureEvent}>
      <CollectionLink
        collection={collection}
        expanded={expanded}
        activeDocument={activeDocument}
        onDisclosureClick={handleDisclosureClick}
      />
    </SidebarDisclosureContext.Provider>
  );
}

export default observer(StaticCollectionLink);
