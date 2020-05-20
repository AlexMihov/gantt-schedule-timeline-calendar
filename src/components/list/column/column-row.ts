/**
 * ListColumnRow component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { ColumnData, Row, Vido } from '../../../gstc';

/**
 * Bind element action
 */
class BindElementAction {
  constructor(element, data) {
    let elements = data.state.get('$data.elements.list-column-rows');
    let shouldUpdate = false;
    if (typeof elements === 'undefined') {
      shouldUpdate = true;
      elements = [];
    }
    if (!elements.includes(element)) {
      elements.push(element);
      shouldUpdate = true;
    }
    if (shouldUpdate) data.state.update('$data.elements.list-column-rows', elements);
  }
  public destroy(element, data) {
    data.state.update('$data.elements.list-column-rows', elements => {
      return elements.filter(el => el !== element);
    });
  }
}

export interface Props {
  row: Row;
  column: ColumnData;
}

export default function ListColumnRow(vido: Vido, props: Props) {
  const {
    api,
    state,
    onDestroy,
    Detach,
    Actions,
    update,
    html,
    createComponent,
    onChange,
    StyleMap,
    unsafeHTML
  } = vido;

  const componentName = 'list-column-row';
  const actionProps = { ...props, api, state };
  let shouldDetach = false;
  const detach = new Detach(() => shouldDetach);

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ListColumnRow', value => (wrapper = value)));

  let ListColumnRowExpanderComponent;
  onDestroy(
    state.subscribe('config.components.ListColumnRowExpander', value => (ListColumnRowExpanderComponent = value))
  );

  const styleMap = new StyleMap(
    props.column.expander
      ? {
          height: '',
          top: '',
          ['--height' as any]: '',
          ['--expander-padding-width' as any]: '',
          ['--expander-size' as any]: ''
        }
      : {
          height: '',
          top: '',
          ['--height' as any]: ''
        },
    true
  );
  const ListColumnRowExpander = createComponent(ListColumnRowExpanderComponent, { row: props.row });

  let className = api.getClass(componentName);
  let classNameContent = api.getClass(componentName + '-content');
  let classNameCurrent = api.getClass(componentName);

  const slots = api.generateSlots(componentName, vido, props);

  function onPropsChange(changedProps: Props, options) {
    if (options.leave || !changedProps || changedProps.row === undefined || changedProps.column === undefined) {
      shouldDetach = true;
      slots.change(changedProps, options);
      update();
      return;
    }
    shouldDetach = false;
    props = changedProps;
    for (const prop in props) {
      actionProps[prop] = props[prop];
    }
    if (!props.column || !props.row || !props.row.$data) {
      shouldDetach = true;
      slots.change(changedProps, options);
      update();
      return;
    }
    if (props.column === undefined || props.row === undefined) return;
    const additional = `${props.row.id}-${props.column.id}`;
    className = api.getClass(componentName, additional);
    classNameContent = api.getClass(componentName + '-content', additional);
    classNameCurrent = api.getClass(componentName);
    const expander = state.get('config.list.expander');
    // @ts-ignore
    styleMap.setStyle({}); // we must reset style because of user specified styling
    styleMap.style['height'] = props.row.$data.outerHeight + 'px';
    styleMap.style['--height'] = props.row.$data.outerHeight + 'px';
    if (props.column.expander) {
      styleMap.style['--expander-padding-width'] = expander.padding * (props.row.$data.parents.length + 1) + 'px';
    }
    const rows = state.get('config.list.rows');
    for (const parentId of props.row.$data.parents) {
      const parent = rows[parentId];
      if (typeof parent.style === 'object' && parent.style.constructor.name === 'Object') {
        if (typeof parent.style.children === 'object') {
          const childrenStyle = parent.style.children;
          for (const name in childrenStyle) {
            styleMap.style[name] = childrenStyle[name];
          }
        }
      }
    }
    if (
      typeof props.row.style === 'object' &&
      props.row.style.constructor.name === 'Object' &&
      typeof props.row.style.current === 'object'
    ) {
      const rowCurrentStyle = props.row.style.current;
      for (const name in rowCurrentStyle) {
        styleMap.style[name] = rowCurrentStyle[name];
      }
    }
    if (props.row.classNames && props.row.classNames.length) {
      classNameCurrent = api.getClass(componentName, additional) + ' ' + props.row.classNames.join(' ');
    } else {
      classNameCurrent = className;
    }
    if (ListColumnRowExpander) {
      ListColumnRowExpander.change(props);
    }
    slots.change(changedProps, options);
    update();
  }
  onChange(onPropsChange);

  onDestroy(() => {
    if (ListColumnRowExpander) ListColumnRowExpander.destroy();
  });
  const componentActions = api.getActions(componentName);

  function getHtml() {
    if (props.row === undefined) return null;
    if (typeof props.column.data === 'function') return unsafeHTML(props.column.data({ row: props.row, vido }));
    if (typeof props.row[props.column.data] === 'function')
      return unsafeHTML(props.row[props.column.data]({ row: props.row, vido }));
    return unsafeHTML(props.row[props.column.data]);
  }

  function getText() {
    if (props.row === undefined) return null;
    if (typeof props.column.data === 'function') return props.column.data({ row: props.row, vido });
    if (typeof props.row[props.column.data] === 'function')
      return props.row[props.column.data]({ row: props.row, vido });
    return props.row[props.column.data];
  }

  if (!componentActions.includes(BindElementAction)) componentActions.push(BindElementAction);
  const actions = Actions.create(componentActions, actionProps);

  return templateProps =>
    wrapper(
      html`
        <div detach=${detach} class=${classNameCurrent} style=${styleMap} data-actions=${actions}>
          ${props.column.expander ? ListColumnRowExpander.html() : null}
          <div class=${classNameContent}>
            ${slots.html('before', templateProps)}${props.column.isHTML ? getHtml() : getText()}${slots.html(
              'after',
              templateProps
            )}
          </div>
        </div>
      `,
      { vido, props, templateProps }
    );
}
