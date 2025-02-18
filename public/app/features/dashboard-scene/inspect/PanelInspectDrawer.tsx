import React from 'react';
import { useLocation } from 'react-router-dom';

import { locationUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import {
  SceneComponentProps,
  SceneObjectBase,
  SceneObjectState,
  sceneGraph,
  VizPanel,
  SceneObjectRef,
} from '@grafana/scenes';
import { Alert, Drawer, Tab, TabsBar } from '@grafana/ui';
import { supportsDataQuery } from 'app/features/dashboard/components/PanelEditor/utils';

import { InspectDataTab } from './InspectDataTab';
import { InspectJsonTab } from './InspectJsonTab';
import { InspectQueryTab } from './InspectQueryTab';
import { InspectStatsTab } from './InspectStatsTab';
import { SceneInspectTab } from './types';

interface PanelInspectDrawerState extends SceneObjectState {
  tabs?: SceneInspectTab[];
  panelRef: SceneObjectRef<VizPanel>;
  pluginNotLoaded?: boolean;
  canEdit?: boolean;
}

export class PanelInspectDrawer extends SceneObjectBase<PanelInspectDrawerState> {
  static Component = PanelInspectRenderer;

  constructor(state: PanelInspectDrawerState) {
    super(state);

    this.buildTabs(0);
  }

  /**
   * We currently have no async await to get the panel plugin from the VizPanel.
   * That is why there is a retry argument here and a setTimeout, to try again a bit later.
   */
  buildTabs(retry: number) {
    const panelRef = this.state.panelRef;
    const panel = panelRef.resolve();
    const plugin = panel.getPlugin();
    const tabs: SceneInspectTab[] = [];

    if (!plugin) {
      if (retry < 2000) {
        setTimeout(() => this.buildTabs(retry + 100), 100);
      } else {
        this.setState({ pluginNotLoaded: true });
      }
    }

    if (supportsDataQuery(plugin)) {
      tabs.push(new InspectDataTab({ panelRef }));
      tabs.push(new InspectStatsTab({ panelRef }));
      tabs.push(new InspectQueryTab({ panelRef }));
    }

    tabs.push(new InspectJsonTab({ panelRef, onClose: this.onClose }));

    this.setState({ tabs });
  }

  getDrawerTitle() {
    const panel = this.state.panelRef.resolve();
    return sceneGraph.interpolate(panel, `Inspect: ${panel.state.title}`);
  }

  onClose = () => {
    locationService.partial({ inspect: null, inspectTab: null });
  };
}

function PanelInspectRenderer({ model }: SceneComponentProps<PanelInspectDrawer>) {
  const { tabs, pluginNotLoaded } = model.useState();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);

  if (!tabs) {
    return null;
  }

  const urlTab = queryParams.get('inspectTab');
  const currentTab = tabs.find((tab) => tab.getTabValue() === urlTab) ?? tabs[0];

  return (
    <Drawer
      title={model.getDrawerTitle()}
      scrollableContent
      onClose={model.onClose}
      size="md"
      tabs={
        <TabsBar>
          {tabs.map((tab) => {
            return (
              <Tab
                key={tab.state.key!}
                label={tab.getTabLabel()}
                active={tab === currentTab}
                href={locationUtil.getUrlForPartial(location, { inspectTab: tab.getTabValue() })}
              />
            );
          })}
        </TabsBar>
      }
    >
      {pluginNotLoaded && (
        <Alert title="Panel plugin not loaded">
          Make sure the panel you want to inspect is visible and has been displayed before opening inspect.
        </Alert>
      )}
      {currentTab && currentTab.Component && <currentTab.Component model={currentTab} />}
    </Drawer>
  );
}
