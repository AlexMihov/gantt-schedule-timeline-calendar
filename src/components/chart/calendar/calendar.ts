/**
 * ChartCalendar component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { Vido } from '../../../gstc';

export default function ChartCalendar(vido: Vido, props) {
  const { api, state, onDestroy, Actions, update, reuseComponents, html, StyleMap } = vido;
  const componentName = 'chart-calendar';
  const componentActions = api.getActions(componentName);
  const actionProps = { ...props, api, state };

  const ChartCalendarDateComponent = state.get('config.components.ChartCalendarDate');

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.ChartCalendar', (value) => (wrapper = value)));

  const className = api.getClass(componentName);

  let headerHeight;
  const styleMap = new StyleMap({ height: '', ['--headerHeight' as any]: '', 'margin-left': '' });
  onDestroy(
    state.subscribe('config.headerHeight', (value) => {
      headerHeight = value;
      styleMap.style['height'] = headerHeight + 'px';
      styleMap.style['--calendar-height'] = headerHeight + 'px';
      update();
    })
  );

  const components = [[], []];
  onDestroy(
    state.subscribe(`$data.chart.time.levels`, (levels) => {
      let level = 0;
      for (const dates of levels) {
        if (!dates.length) continue;
        let currentDateFormat = 'YYYY-MM-DD HH'; // hour
        switch (dates[0].period) {
          case 'day':
            currentDateFormat = 'YYYY-MM-DD';
            break;
          case 'week':
            currentDateFormat = 'YYYY-MM-ww';
            break;
          case 'month':
            currentDateFormat = 'YYYY-MM';
            break;
          case 'year':
            currentDateFormat = 'YYYY';
            break;
        }
        const currentDate = api.time.date().format(currentDateFormat);
        reuseComponents(
          components[level],
          dates,
          (date) => date && { level, date, currentDate, currentDateFormat },
          ChartCalendarDateComponent
        );
        level++;
      }
      update();
    })
  );
  onDestroy(() => {
    components.forEach((level) => level.forEach((component) => component.destroy()));
  });

  componentActions.push((element) => {
    state.update('$data.elements.chart-calendar', element);
  });
  const actions = Actions.create(componentActions, actionProps);

  const slots = api.generateSlots(componentName, vido, props);

  return (templateProps) =>
    wrapper(
      html`
        <div class=${className} data-actions=${actions} style=${styleMap}>
          ${slots.html('before', templateProps)}
          ${components.map(
            (components, level) => html`
              <div class=${className + '-dates ' + className + `-dates--level-${level}`}>
                ${slots.html('inside', templateProps)}${components.map((m) => m.html())}
              </div>
            `
          )}
          ${slots.html('after', templateProps)}
        </div>
      `,
      { props, vido, templateProps }
    );
}
