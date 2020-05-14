/**
 * Chart component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import ResizeObserver from 'resize-observer-polyfill';
import { Vido } from '../../gstc';

export default function Chart(vido: Vido, props = {}) {
  const { api, state, onDestroy, Actions, html, createComponent } = vido;
  const componentName = 'chart';

  const componentSubs = [];
  let ChartCalendarComponent;
  componentSubs.push(state.subscribe('config.components.ChartCalendar', (value) => (ChartCalendarComponent = value)));
  let ChartTimelineComponent;
  componentSubs.push(state.subscribe('config.components.ChartTimeline', (value) => (ChartTimelineComponent = value)));
  let ScrollBarComponent;
  componentSubs.push(state.subscribe('config.components.ScrollBar', (value) => (ScrollBarComponent = value)));

  const ChartCalendar = createComponent(ChartCalendarComponent);
  onDestroy(ChartCalendar.destroy);
  const ChartTimeline = createComponent(ChartTimelineComponent);
  onDestroy(ChartTimeline.destroy);
  const ScrollBarHorizontal = createComponent(ScrollBarComponent, { type: 'horizontal' });
  onDestroy(ScrollBarHorizontal.destroy);
  const ScrollBarVertical = createComponent(ScrollBarComponent, { type: 'vertical' });
  onDestroy(ScrollBarVertical.destroy);

  onDestroy(() => {
    componentSubs.forEach((unsub) => unsub());
  });

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.Chart', (value) => (wrapper = value)));

  const className = api.getClass(componentName);
  const componentActions = api.getActions(componentName);

  let calculatedZoomMode = false;
  onDestroy(state.subscribe('config.chart.time.calculatedZoomMode', (zoomMode) => (calculatedZoomMode = zoomMode)));

  function onWheelHandler(event: WheelEvent) {
    if (event.type === 'wheel') {
      // TODO
    }
  }

  const onWheel = {
    handleEvent: onWheelHandler,
    passive: false,
    capture: false,
  };

  let chartWidth = 0;
  let ro;
  componentActions.push(function bindElement(element) {
    if (!ro) {
      ro = new ResizeObserver(() => {
        const width = element.clientWidth;
        const height = element.clientHeight;
        const innerWidth = width - state.get('config.scroll.horizontal.size');
        if (chartWidth !== width) {
          chartWidth = width;
          state.update('$data.chart.dimensions', { width, innerWidth, height });
        }
      });
      ro.observe(element);
      state.update('$data.elements.chart', element);
    }
  });

  onDestroy(() => {
    ro.disconnect();
  });

  const actions = Actions.create(componentActions, { api, state });

  const slots = api.generateSlots(componentName, vido, props);

  return (templateProps) =>
    wrapper(
      html`
        <div class=${className} data-actions=${actions} @wheel=${onWheel}>
          ${slots.html('before', templateProps)}${ChartCalendar.html()}${slots.html(
            'inside',
            templateProps
          )}${ChartTimeline.html()}${ScrollBarVertical.html()}${calculatedZoomMode
            ? null
            : ScrollBarHorizontal.html()}${slots.html('after', templateProps)}
        </div>
      `,
      { vido, props: {}, templateProps }
    );
}
