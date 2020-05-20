/**
 * ListColumn component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { Vido, ColumnData } from '../../../gstc';

/**
 * Bind element action
 */
class BindElementAction {
  constructor(element, data) {
    let shouldUpdate = false;
    let elements = data.state.get('$data.elements.list-columns');
    if (typeof elements === 'undefined') {
      elements = [];
      shouldUpdate = true;
    }
    if (!elements.includes(element)) {
      elements.push(element);
      shouldUpdate = true;
    }
    if (shouldUpdate) data.state.update('$data.elements.list-columns', elements);
  }
  public destroy(element, data) {
    data.state.update('$data.elements.list-columns', elements => {
      return elements.filter(el => el !== element);
    });
  }
}

export interface Props {
  column: ColumnData;
}

export default function ListColumn(vido: Vido, props: Props) {
  const { api, state, onDestroy, onChange, Actions, update, createComponent, reuseComponents, html, StyleMap } = vido;

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ListColumn', value => (wrapper = value)));

  const componentsSub = [];
  let ListColumnRowComponent;
  componentsSub.push(state.subscribe('config.components.ListColumnRow', value => (ListColumnRowComponent = value)));
  let ListColumnHeaderComponent;
  componentsSub.push(
    state.subscribe('config.components.ListColumnHeader', value => (ListColumnHeaderComponent = value))
  );

  const actionProps = { ...props, api, state };

  const componentName = 'list-column';
  const rowsComponentName = componentName + '-rows';
  const rowsOffsetName = componentName + '-rows-offset';
  const componentActions = api.getActions(componentName);
  const rowsActions = api.getActions(rowsComponentName);
  let className, classNameContainer, classNameOffset, calculatedWidth;

  const widthStyleMap = new StyleMap({ width: '', ['--width' as any]: '' });
  const containerStyleMap = new StyleMap({ width: '', height: '' });
  const offsetStyleMap = new StyleMap({ 'margin-top': '0px' });

  let width;
  function calculateStyle() {
    const list = state.get('config.list');
    calculatedWidth = list.columns.data[props.column.id].width * list.columns.percent * 0.01;
    width = calculatedWidth;
    const height = state.get('$data.innerHeight');
    widthStyleMap.style.width = width + 'px';
    widthStyleMap.style['--width'] = width + 'px';
    containerStyleMap.style.height = height + 'px';
  }
  onDestroy(
    state.subscribeAll(
      [
        'config.list.columns.percent',
        'config.list.columns.resizer.width',
        '$data.chart.dimensions.width',
        '$data.innerHeight',
        '$data.list.width',
        '$data.list.visibleRowsHeight'
      ],
      calculateStyle,
      { bulk: true }
    )
  );

  const ListColumnHeader = createComponent(ListColumnHeaderComponent, props);
  onDestroy(ListColumnHeader.destroy);

  const slots = api.generateSlots(componentName, vido, props);

  const visibleRows = [];
  function visibleRowsChange() {
    const val: string[] = state.get('$data.list.visibleRows') || [];
    const rows = api.getRows(val);
    reuseComponents(
      visibleRows,
      rows,
      row => row && { column: props.column, row, width },
      ListColumnRowComponent,
      false
    );
  }

  onChange(changedProps => {
    props = changedProps;
    className = api.getClass(componentName, props.column.id);
    classNameOffset = api.getClass(rowsOffsetName, props.column.id);
    classNameContainer = api.getClass(rowsComponentName, props.column.id);
    for (const prop in props) {
      actionProps[prop] = props[prop];
    }
    calculateStyle();
    ListColumnHeader.change(props);
    visibleRowsChange();
    slots.change(changedProps);
  });

  onDestroy(
    state.subscribeAll(
      [
        '$data.list.visibleRows;',
        '$data.list.visibleRowsHeight',
        'config.chart.items.*.height',
        'config.chart.items.*.rowId',
        'config.chart.items.*.time'
      ],
      visibleRowsChange
    )
  );

  onDestroy(
    state.subscribe('config.scroll.vertical.offset', offset => {
      offsetStyleMap.style['transform'] = `translateY(-${offset || 0}px)`;
      update();
    })
  );

  onDestroy(() => {
    visibleRows.forEach(row => row.destroy());
    componentsSub.forEach(unsub => unsub());
  });

  componentActions.push(BindElementAction);
  const headerActions = Actions.create(componentActions, { column: props.column, state: state, api: api });
  const rowActions = Actions.create(rowsActions, { api, state });

  return templateProps =>
    wrapper(
      html`
        <div class=${className} data-actions=${headerActions} style=${widthStyleMap}>
          ${ListColumnHeader.html()}
          <div class=${classNameContainer} style=${containerStyleMap} data-actions=${rowActions}>
            <div class=${classNameOffset} style=${offsetStyleMap}>
              ${slots.html('before', templateProps)}${visibleRows.map(row => row.html())}${slots.html(
                'after',
                templateProps
              )}
            </div>
          </div>
        </div>
      `,
      { vido, props, templateProps }
    );
}
