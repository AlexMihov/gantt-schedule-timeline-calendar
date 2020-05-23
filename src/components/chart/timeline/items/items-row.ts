/**
 * ChartTimelineItemsRow component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { Row, Vido, Item } from '../../../../gstc';

/**
 * Bind element action
 * @param {Element} element
 * @param {any} data
 */
class BindElementAction {
  constructor(element, data) {
    let shouldUpdate = false;
    let rows = data.state.get('$data.elements.chart-timeline-items-rows');
    if (typeof rows === 'undefined') {
      rows = [];
      shouldUpdate = true;
    }
    if (!rows.includes(element)) {
      rows.push(element);
      shouldUpdate = true;
    }
    if (shouldUpdate) data.state.update('$data.elements.chart-timeline-items-rows', rows, { only: null });
  }
  public destroy(element, data) {
    data.state.update('$data.elements.chart-timeline-items-rows', rows => {
      return rows.filter(el => el !== element);
    });
  }
}

export interface Props {
  row: Row;
}

export default function ChartTimelineItemsRow(vido: Vido, props: Props) {
  const { api, state, onDestroy, Detach, Actions, update, html, onChange, reuseComponents, StyleMap } = vido;
  const actionProps = { ...props, api, state };
  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ChartTimelineItemsRow', value => (wrapper = value)));

  let ItemComponent;
  onDestroy(state.subscribe('config.components.ChartTimelineItemsRowItem', value => (ItemComponent = value)));

  let classNameCurrent = '';

  const itemComponents = [],
    styleMap = new StyleMap({ width: '', height: '' }, true);

  let shouldDetach = false;
  const detach = new Detach(() => shouldDetach);

  function updateDom() {
    const chart = state.get('$data.chart');
    shouldDetach = false;
    styleMap.style.width = chart.dimensions.width + 'px';
    if (!props) {
      shouldDetach = true;
      return;
    }
    styleMap.style.height = props.row.$data.outerHeight + 'px';
    styleMap.style['--row-height'] = props.row.$data.outerHeight + 'px';
  }

  function updateRow(row) {
    if (!row || !row.$data) {
      shouldDetach = true;
      reuseComponents(itemComponents, [], () => null, ItemComponent, false);
      return update();
    }
    const itemsId: string[] = row.$data.items;
    if (itemsId === undefined) {
      shouldDetach = true;
      reuseComponents(itemComponents, [], () => null, ItemComponent, false);
      return update();
    }
    const items: Item[] = api.getItems(itemsId);
    reuseComponents(itemComponents, items, item => ({ row, item }), ItemComponent, false);
    updateDom();
    update();
  }

  const componentName = 'chart-timeline-items-row';
  let className = api.getClass(componentName);

  const slots = api.generateSlots(componentName, vido, props);

  function onPropsChange(changedProps: Props, options) {
    if (options.leave || !changedProps || changedProps.row === undefined) {
      shouldDetach = true;
      reuseComponents(itemComponents, [], () => null, ItemComponent, false);
      slots.change(changedProps, options);
      return update();
    }
    props = changedProps;
    className = api.getClass(componentName, props.row.id);
    for (const prop in props) {
      actionProps[prop] = props[prop];
    }
    if (props.row.classNames && props.row.classNames.length) {
      classNameCurrent = className + ' ' + props.row.classNames.join(' ');
    } else {
      classNameCurrent = className;
    }
    updateRow(props.row);
    slots.change(changedProps, options);
  }
  onChange(onPropsChange);

  onDestroy(state.subscribe('$data.chart.dimensions.width', () => updateRow(props.row)));

  onDestroy(() => {
    itemComponents.forEach(item => item.destroy());
  });

  const componentActions = api.getActions(componentName);
  componentActions.push(BindElementAction);

  const actions = Actions.create(componentActions, actionProps);

  return templateProps =>
    wrapper(
      html`
        <div detach=${detach} class=${classNameCurrent} data-actions=${actions} style=${styleMap}>
          ${slots.html('before', templateProps)}${itemComponents.map(i => i.html())}${slots.html(
            'after',
            templateProps
          )}
        </div>
      `,
      { props, vido, templateProps }
    );
}
