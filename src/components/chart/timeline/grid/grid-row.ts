/**
 * ChartTimelineGridRow component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { GridRow, Vido, GridCell } from '../../../../gstc';
import { Component, ComponentInstance } from '@neuronet.io/vido/src/vido';
import { ListenerFunctionEventInfo } from 'deep-state-observer';

/**
 * Bind element action
 */
class BindElementAction {
  constructor(element, data) {
    let shouldUpdate = false;
    let rows = data.state.get('$data.elements.chart-timeline-grid-rows');
    if (typeof rows === 'undefined') {
      rows = [];
      shouldUpdate = true;
    }
    if (!rows.includes(element)) {
      rows.push(element);
      shouldUpdate = true;
    }
    if (shouldUpdate) data.state.update('$data.elements.chart-timeline-grid-rows', rows, { only: null });
  }
  public destroy(element, data) {
    data.state.update('$data.elements.chart-timeline-grid-rows', (rows) => {
      return rows.filter((el) => el !== element);
    });
  }
}

export default function ChartTimelineGridRow(vido: Vido, props: GridRow) {
  const { api, state, onDestroy, Detach, Actions, update, html, reuseComponents, onChange, StyleMap } = vido;
  const componentName = 'chart-timeline-grid-row';
  const actionProps = {
    ...props,
    api,
    state,
  };
  let wrapper;
  onDestroy(
    state.subscribe('config.wrappers.ChartTimelineGridRow', (value) => {
      wrapper = value;
      update();
    })
  );

  let GridCellComponent;
  onDestroy(
    state.subscribe('config.components.ChartTimelineGridRowCell', (component) => (GridCellComponent = component))
  );

  const componentActions = api.getActions(componentName);
  let className = api.getClass(componentName);

  const styleMap = new StyleMap(
    {
      width: props.width + 'px',
      height: props.row.height + 'px',
    },
    true
  );

  let shouldDetach = false;
  const detach = new Detach(() => shouldDetach);

  const slots = api.generateSlots(componentName, vido, props);

  const rowsCellsComponents = [];

  function onPropsChange(changedProps, options) {
    if (options.leave || changedProps.row === undefined) {
      shouldDetach = true;
      reuseComponents(rowsCellsComponents, [], (cell) => cell, GridCellComponent, false);
      slots.change(changedProps, options);
      update();
      return;
    }
    shouldDetach = false;
    props = changedProps;
    className = api.getClass(componentName, props.row.id);
    const cells = api.getGridCells(props.cells);
    reuseComponents(rowsCellsComponents, cells, (cell) => cell, GridCellComponent, false);
    styleMap.setStyle({});
    styleMap.style.height = props.row.$data.outerHeight + 'px';
    styleMap.style.width = props.width + 'px';
    const rows = state.get('config.list.rows');
    for (const parentId of props.row.$data.parents) {
      const parent = rows[parentId];
      const childrenStyle = parent?.style?.grid?.row?.children;
      if (childrenStyle)
        for (const name in childrenStyle) {
          styleMap.style[name] = childrenStyle[name];
        }
    }
    const currentStyle = props?.row?.style?.grid?.row?.current;
    if (currentStyle)
      for (const name in currentStyle) {
        styleMap.style[name] = currentStyle[name];
      }
    for (const prop in props) {
      actionProps[prop] = props[prop];
    }
    slots.change(changedProps, options);
    update();
  }
  onChange(onPropsChange);

  onDestroy(function destroy() {
    rowsCellsComponents.forEach((rowCell) => rowCell.destroy());
  });

  if (componentActions.indexOf(BindElementAction) === -1) {
    componentActions.push(BindElementAction);
  }

  const actions = Actions.create(componentActions, actionProps);

  return (templateProps) => {
    return wrapper(
      html`
        <div detach=${detach} class=${className} data-actions=${actions} style=${styleMap}>
          ${slots.html('before', templateProps)}${rowsCellsComponents.map((r) => r.html())}
          ${slots.html('after', templateProps)}
        </div>
      `,
      { vido, props, templateProps }
    );
  };
}
