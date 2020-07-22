/**
 * ChartTimelineItems component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { Vido } from '../../../../gstc';

export default function ChartTimelineItems(vido: Vido, props = {}) {
  const { api, state, onDestroy, Actions, update, html, reuseComponents, StyleMap } = vido;
  const componentName = 'chart-timeline-items';
  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ChartTimelineItems', (value) => (wrapper = value)));
  let componentActions;
  onDestroy(state.subscribe(`config.actions.${componentName}`, (actions) => (componentActions = actions)));

  let ItemsRowComponent;
  onDestroy(state.subscribe('config.components.ChartTimelineItemsRow', (value) => (ItemsRowComponent = value)));

  const className = api.getClass(componentName);

  const styleMap = new StyleMap({}, true);
  function calculateStyle() {
    const width = state.get('$data.chart.dimensions.width');
    const height = state.get('$data.innerHeight');
    const scrollOffset = state.get('config.scroll.vertical.offset') || 0;
    styleMap.style.width = width + 'px';
    styleMap.style.height = height + scrollOffset + 'px';
    //styleMap.style['margin-top'] = -scrollOffset + 'px';
  }
  onDestroy(
    state.subscribeAll(
      ['$data.innerHeight', '$data.chart.dimensions.width', 'config.scroll.vertical.offset'],
      calculateStyle
    )
  );

  const rowsComponents = [];
  function createRowComponents() {
    const visibleRowsId = state.get('$data.list.visibleRows') || [];
    const visibleRows = api.getRows(visibleRowsId);
    reuseComponents(rowsComponents, visibleRows, (row) => ({ row }), ItemsRowComponent, false);
    update();
  }
  onDestroy(
    state.subscribeAll(
      [
        '$data.list.visibleRows;',
        'config.list.rows',
        'config.components.ChartTimelineItemsRow',
        'config.chart.items.*.rowId',
      ],
      createRowComponents,
      { bulk: true }
    )
  );
  onDestroy(() => {
    rowsComponents.forEach((row) => row.destroy());
  });

  const actions = Actions.create(componentActions, { api, state });

  const slots = api.generateSlots(componentName, vido, props);

  return (templateProps) =>
    wrapper(
      html`
        <div class=${className} style=${styleMap} data-actions=${actions}>
          ${slots.html('before', templateProps)}${rowsComponents.map((r) => r.html())}${slots.html(
            'after',
            templateProps
          )}
        </div>
      `,
      { props, vido, templateProps }
    );
}
