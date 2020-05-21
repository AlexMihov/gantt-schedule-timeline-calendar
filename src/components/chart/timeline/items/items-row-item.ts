/**
 * ChartTimelineItemsRowItem component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { Row, Item, Vido, Rows, DataChartTime } from '../../../../gstc';

/**
 * Bind element action
 */
class BindElementAction {
  constructor(element, data) {
    let shouldUpdate = false;
    let items = data.state.get('$data.elements.chart-timeline-items-row-items');
    if (typeof items === 'undefined') {
      items = [];
      shouldUpdate = true;
    }
    if (!items.includes(element)) {
      items.push(element);
      shouldUpdate = true;
    }
    if (shouldUpdate) data.state.update('$data.elements.chart-timeline-items-row-items', items, { only: null });
  }
  public destroy(element, data) {
    data.state.update('$data.elements.chart-timeline-items-row-items', items => {
      return items.filter(el => el !== element);
    });
  }
}

export interface Props {
  row: Row;
  item: Item;
}

export default function ChartTimelineItemsRowItem(vido: Vido, props: Props) {
  const { api, state, onDestroy, Detach, Actions, update, html, svg, onChange, unsafeHTML, StyleMap } = vido;

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ChartTimelineItemsRowItem', value => (wrapper = value)));

  let itemId = props.item.id;

  let itemLeftPx = 0,
    itemWidthPx = 0,
    leave = false,
    classNameCurrent = '';
  const styleMap = new StyleMap({ width: '', height: '', left: '', top: '' }),
    leftCutStyleMap = new StyleMap({}),
    rightCutStyleMap = new StyleMap({}),
    actionProps = {
      item: props.item,
      row: props.row,
      left: itemLeftPx,
      width: itemWidthPx,
      api,
      state
    };

  const componentName = 'chart-timeline-items-row-item';
  let className, labelClassName;
  className = api.getClass(componentName);
  labelClassName = api.getClass(componentName + '-label');

  let shouldDetach = false;

  function updateItem(time: DataChartTime = state.get('$data.chart.time')) {
    if (leave || time.levels.length === 0 || !time.levels[time.level] || time.levels[time.level].length === 0) {
      shouldDetach = true;
      if (props.item) props.item.$data.detached = shouldDetach;
      //if (props.item) state.update(`config.chart.items.${props.item.id}.$data.detached`, true);
      return update();
    }
    if (!props.item) {
      shouldDetach = true;
      return update();
    }
    itemLeftPx = props.item.$data.position.actualLeft;
    itemWidthPx = props.item.$data.actualWidth;
    if (props.item.time.end <= time.leftGlobal || props.item.time.start >= time.rightGlobal || itemWidthPx <= 0) {
      shouldDetach = true;
      props.item.$data.detached = shouldDetach;
      //state.update(`config.chart.items.${props.item.id}.$data.detached`, true);
      return update();
    }
    classNameCurrent = className;
    if (props.item.time.start < time.leftGlobal) {
      leftCutStyleMap.style.display = 'block';
      classNameCurrent += ' ' + api.getClass(componentName + '--left-cut', props.row.id + '-' + props.item.id);
    } else {
      leftCutStyleMap.style.display = 'none';
    }
    if (props.item.$data.position.right > time.width) {
      rightCutStyleMap.style.display = 'block';
      classNameCurrent += ' ' + api.getClass(componentName + '--right-cut', props.row.id + '-' + props.item.id);
    } else {
      rightCutStyleMap.style.display = 'none';
    }
    if (props.item.classNames && props.item.classNames.length) {
      classNameCurrent += ' ' + props.item.classNames.join(' ');
    }
    if (props.item.selected) {
      classNameCurrent += ' ' + api.getClass(componentName) + '--selected';
    }
    const oldWidth = styleMap.style.width;
    const oldLeft = styleMap.style.left;
    const oldTop = styleMap.style.top;
    const oldHeight = styleMap.style.height;
    styleMap.setStyle({});
    const inViewPort = api.isItemInViewport(props.item, time.leftGlobal, time.rightGlobal);
    shouldDetach = !inViewPort;
    props.item.$data.detached = shouldDetach;
    //state.update(`config.chart.items.${props.item.id}.$data.detached`, shouldDetach);
    if (inViewPort) {
      // update style only when visible to prevent browser's recalculate style
      styleMap.style.width = itemWidthPx + 'px';
      styleMap.style.left = itemLeftPx + 'px';
      styleMap.style.top = props.item.$data.position.actualTop + 'px';
      styleMap.style.height = props.item.$data.actualHeight + 'px';
    } else {
      styleMap.style.width = oldWidth;
      styleMap.style.left = oldLeft;
      styleMap.style.top = oldTop;
      styleMap.style.height = oldHeight;
    }
    const rows: Rows = api.getAllRows();
    for (const parentId of props.row.$data.parents) {
      const parent = rows[parentId];
      const childrenStyle = parent?.style?.items?.item?.children;
      if (childrenStyle) styleMap.setStyle({ ...styleMap.style, ...childrenStyle });
    }
    const currentRowItemsStyle = props?.row?.style?.items?.item?.current;
    if (currentRowItemsStyle) styleMap.setStyle({ ...styleMap.style, ...currentRowItemsStyle });
    const currentStyle = props?.item?.style;
    if (currentStyle) styleMap.setStyle({ ...styleMap.style, ...currentStyle });
    actionProps.left = itemLeftPx;
    actionProps.width = itemWidthPx;
    update();
  }

  const cutterClassName = api.getClass(componentName + '-cut');
  const cutterLeft = () => html`
    <div class=${cutterClassName} style=${leftCutStyleMap}>
      ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 18 16" width="16">
        <path fill-opacity="0.5" fill="#ffffff" d="m5,3l-5,5l5,5l0,-10z" />
      </svg>`}
    </div>
  `;
  const cutterRight = () => html`
    <div class=${cutterClassName} style=${rightCutStyleMap}>
      ${svg`<svg xmlns="http://www.w3.org/2000/svg" height="16" viewBox="0 0 4 16" width="16">
        <path transform="rotate(-180 2.5,8) " fill-opacity="0.5" fill="#ffffff" d="m5,3l-5,5l5,5l0,-10z" />
      </svg>`}
    </div>
  `;

  const slots = api.generateSlots(componentName, vido, props);

  let itemSub = state.subscribe(`config.chart.items.${itemId}`, () => onPropsChange(props, {})); // eslint-disable-line @typescript-eslint/no-use-before-define
  function onPropsChange(changedProps, options) {
    if (options.leave || changedProps.row === undefined || changedProps.item === undefined) {
      leave = true;
      shouldDetach = true;
      if (props.item) {
        props.item.$data.detached = shouldDetach;
      }
      //if (props.item) state.update(`config.chart.items.${props.item.id}.$data.detached`, true);
      //props = changedProps;
      slots.change(changedProps, options);
      return update();
    } else {
      shouldDetach = false;
      //state.update(`config.chart.items.${props.item.id}.$data.detached`, false);
      props.item.$data.detached = shouldDetach;
      leave = false;
    }
    props = changedProps;
    if (props.item.id !== itemId) {
      itemId = props.item.id;
      if (itemSub) itemSub();
      itemSub = state.subscribe(`config.chart.items.${itemId}`, () => onPropsChange(props, options));
    }
    className = api.getClass(componentName, props.row.id + '-' + props.item.id);
    labelClassName = api.getClass(componentName + '-label', props.row.id + '-' + props.item.id);
    actionProps.item = props.item;
    actionProps.row = props.row;
    updateItem();
    slots.change(changedProps, options);
    update();
  }
  onChange(onPropsChange);
  onDestroy(() => {
    if (itemSub) itemSub();
  });

  const componentActions = api.getActions(componentName);

  onDestroy(state.subscribe('$data.chart.time', updateItem));

  componentActions.push(BindElementAction);
  const actions = Actions.create(componentActions, actionProps);
  const detach = new Detach(() => shouldDetach);

  function getText() {
    if (!props.item || !props.item.label) return null;
    if (typeof props.item.label === 'function') return props.item.label({ item: props.item, vido });
    return props.item.label;
  }

  function getHtml() {
    if (!props.item || !props.item.label) return null;
    if (typeof props.item.label === 'function') return unsafeHTML(props.item.label({ item: props.item, vido }));
    return unsafeHTML(props.item.label);
  }

  function getTitle() {
    if (!props.item) return null;
    return props.item.isHTML || typeof props.item.label === 'function' ? '' : props.item.label;
  }

  function getContent() {
    if (!props.item) return null;
    return props.item.isHTML ? getHtml() : getText();
  }

  return templateProps =>
    wrapper(
      html`
        <div detach=${detach} class=${classNameCurrent} data-actions=${actions} style=${styleMap}>
          ${cutterLeft()}${slots.html('before', templateProps)}
          <div class=${labelClassName} title=${getTitle()}>
            ${slots.html('inside', templateProps)}${getContent()}
          </div>
          ${slots.html('after', templateProps)}${cutterRight()}
        </div>
      `,
      { vido, props, templateProps }
    );
}
