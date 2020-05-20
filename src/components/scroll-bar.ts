/**
 * ScrollBar component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import Action from '@neuronet.io/vido/src/Action';
import { ScrollType, Row, Vido, DataChartTimeLevelDate, DataChartTime } from '../gstc';

export interface Props {
  type: 'horizontal' | 'vertical';
}

export default function ScrollBar(vido: Vido, props: Props) {
  const { onDestroy, state, api, html, StyleMap, Actions, update, schedule } = vido;

  const componentName = 'scroll-bar';

  let className, classNameInner;
  let classNameOuterActive = '',
    classNameInnerActive = '';

  onDestroy(
    state.subscribe('config.classNames', () => {
      className = api.getClass(componentName);
      classNameInner = api.getClass(componentName + '-inner');
    })
  );

  let size;
  const sizeProp = props.type === 'horizontal' ? 'height' : 'width';
  const barSizeProp = sizeProp === 'height' ? 'width' : 'height';
  const offsetProp = props.type === 'horizontal' ? 'left' : 'top';
  const styleMapOuter = new StyleMap({});
  const styleMapInner = new StyleMap({});
  let maxPos = 0;
  let smooth = false;
  let allDates: DataChartTimeLevelDate[] = [];
  let rowsId: string[] = [];
  let barSize = 0,
    chartSize = 0,
    chartSizeInner = 0,
    sub = 0;

  function getFullSize(): number {
    let fullSize = 0;
    if (props.type === 'vertical') {
      if (rowsId.length) {
        return (
          api.getRow(rowsId[rowsId.length - 1]).$data.position.top +
          api.getRow(rowsId[rowsId.length - 1]).$data.outerHeight
        );
      }
      return fullSize;
    }
    if (allDates.length) {
      return allDates[allDates.length - 1].rightPx;
    }
    return fullSize;
  }

  if (props.type === 'horizontal') {
    onDestroy(
      state.subscribe('$data.chart.time', () => {
        const time = state.get('$data.chart.time');
        if (!time.leftGlobalDate) return;
        const horizontal = state.get('config.scroll.horizontal');
        if (horizontal.area !== time.scrollWidth) {
          state.update('config.scroll.horizontal.area', time.scrollWidth);
        }
        if (time.allDates && time.allDates[time.level]) {
          const dates = time.allDates[time.level];
          const date = dates.find(date => date.leftGlobal === time.leftGlobal);
          let dataIndex = dates.indexOf(date);
          const lastPageCount = state.get('config.scroll.horizontal.lastPageCount');
          if (dataIndex > dates.length - lastPageCount) {
            dataIndex = dates.length - lastPageCount;
          }
          api.setScrollLeft(dataIndex, time, undefined, 'time');
        }
      })
    );
  }

  const cache = {
    maxPosPx: 0,
    innerSize: 0,
    sub: 0,
    scrollArea: 0
  };
  function shouldUpdate(maxPosPx, innerSize, sub, scrollArea) {
    const result =
      cache.maxPosPx !== maxPosPx ||
      cache.innerSize !== innerSize ||
      cache.sub !== sub ||
      cache.scrollArea !== scrollArea;
    if (result) {
      cache.maxPosPx = maxPos;
      cache.innerSize = innerSize;
      cache.sub = sub;
      cache.scrollArea = scrollArea;
    }
    return result;
  }

  onDestroy(
    state.subscribeAll(
      props.type === 'horizontal'
        ? [`config.scroll.${props.type}`, '$data.chart.time']
        : [
            `config.scroll.${props.type}`,
            '$data.innerHeight',
            '$data.list.rowsWithParentsExpanded;',
            '$data.list.rowsHeight'
          ],
      function scrollThing() {
        const time: DataChartTime = state.get('$data.chart.time');
        const scroll: ScrollType = state.get(`config.scroll.${props.type}`);
        const chartWidth: number = state.get('$data.chart.dimensions.width');
        const chartHeight: number = state.get('$data.innerHeight');
        smooth = scroll.smooth;
        size = scroll.size;
        chartSize = props.type === 'horizontal' ? chartWidth : chartHeight;
        chartSize = chartSize || 0;
        if (props.type === 'horizontal') {
          chartSize -= size;
        } else {
          chartSize += size;
        }
        if (chartSize < 0) chartSize = 0;
        styleMapOuter.style[sizeProp] = size + 'px';
        styleMapOuter.style[barSizeProp] = chartSize + 'px';
        if (props.type === 'vertical') {
          styleMapOuter.style.top = state.get('config.headerHeight') + 'px';
        }
        styleMapInner.style[sizeProp] = '100%';
        chartSizeInner = chartSize;
        if (props.type === 'horizontal') {
          if (time.allDates && time.allDates[time.level]) {
            allDates = time.allDates[time.level];
          } else {
            allDates = [];
          }
        } else {
          rowsId = state.get('$data.list.rowsWithParentsExpanded') || [];
        }

        const fullSize = getFullSize();
        const lastPageSize = state.get(`config.scroll.${props.type}.lastPageSize`);
        if (!lastPageSize) return;
        sub = 0;
        if (fullSize <= chartSizeInner || scroll.lastPageSize === fullSize) {
          chartSizeInner = 0;
          barSize = 0;
        } else {
          if (chartSize && fullSize) {
            barSize = chartSize * (chartSize / fullSize);
          } else {
            barSize = 0;
            chartSizeInner = 0;
          }
          if (barSize < scroll.minInnerSize) {
            sub = scroll.minInnerSize - barSize;
            barSize = scroll.minInnerSize;
          }
        }
        styleMapInner.style[barSizeProp] = barSize + 'px';
        maxPos = Math.round(chartSize - sub);
        if (shouldUpdate(maxPos, barSize, sub, chartSize)) {
          // shouldUpdate prevent infinite loop because we are watching scroll too
          state.update(`config.scroll.${props.type}`, (scroll: ScrollType) => {
            scroll.maxPosPx = maxPos;
            scroll.innerSize = barSize;
            scroll.sub = sub;
            scroll.scrollArea = chartSize;
            return scroll;
          });
        }
        update();
      }
    )
  );

  let oldPos = 0;
  onDestroy(
    state.subscribe(`config.scroll.${props.type}.posPx`, position => {
      if (position !== oldPos) {
        styleMapInner.style[offsetProp] = position + 'px';
        oldPos = position;
        update();
      }
    })
  );

  class OuterAction extends Action {
    constructor(element) {
      super();
      state.update(`$data.elements.scroll-bar--${props.type}`, element);
    }
    update() {}
    destroy() {}
  }

  class InnerAction extends Action {
    moving = false;
    initialPos = 0;
    currentPos = 0;
    cumulation = 0;
    lastDataIndex = 0;
    dataIndex = 0;
    lastDate: DataChartTimeLevelDate;
    lastRow: Row;
    bodyClassName: string;
    unsub: () => void;

    constructor(element) {
      super();
      state.update(`$data.elements.scroll-bar-inner--${props.type}`, element);
      this.bodyClassName = state.get('config.scroll.bodyClassName');
      this.pointerDown = this.pointerDown.bind(this);
      this.pointerUp = this.pointerUp.bind(this);
      const pointerMove = this.pointerMove.bind(this);
      this.pointerMove = schedule(ev => pointerMove(ev));
      //this.pointerMove = pointerMove;
      this.unsub = state.subscribe(`config.scroll.${props.type}`, this.dataChanged.bind(this));
      this.destroy = this.destroy.bind(this);
      element.addEventListener('pointerdown', this.pointerDown);
      document.addEventListener('pointermove', this.pointerMove, { passive: true });
      document.addEventListener('pointerup', this.pointerUp);
    }

    destroy(element) {
      this.unsub();
      element.removeEventListener('pointerdown', this.pointerDown);
      document.removeEventListener('pointermove', this.pointerMove);
      document.removeEventListener('pointerup', this.pointerUp);
    }

    dataChanged() {
      const scroll: ScrollType = state.get(`config.scroll.${props.type}`);
      const dataIndex: number = scroll.dataIndex;
      this.lastDataIndex = dataIndex;
      if (props.type === 'horizontal' && allDates && allDates.length) {
        const date: DataChartTimeLevelDate = allDates[dataIndex];
        if (!date) return;
        if (this.lastDate && this.lastDate.leftPercent === date.leftPercent) return;
        const pos = this.limitPosition(date.leftPercent * (chartSize - sub));
        this.currentPos = pos;
        update();
      } else if (props.type === 'vertical') {
        const rowId = rowsId[dataIndex];
        const row = api.getRow(rowId);
        if (!row) return;
        if (this.lastRow && this.lastRow.$data.position.topPercent === row.$data.position.topPercent) return;
        const pos = Math.round(row.$data.position.topPercent * (chartSize - sub));
        this.currentPos = pos + scroll.offset;
        update();
      }
    }

    limitPosition(offset: number) {
      return Math.max(Math.min(offset, maxPos), 0);
    }

    pointerDown(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      document.body.classList.add(this.bodyClassName);
      this.moving = true;
      this.initialPos = props.type === 'horizontal' ? ev.screenX : ev.screenY;
      classNameInnerActive = ' ' + api.getClass(componentName) + '-inner--active';
      classNameOuterActive = ' ' + api.getClass(componentName) + '--active';
      update();
    }

    pointerUp(ev) {
      if (this.moving) {
        ev.preventDefault();
        ev.stopPropagation();
        document.body.classList.remove(this.bodyClassName);
      }
      this.moving = false;
      this.cumulation = 0;
      classNameInnerActive = '';
      classNameOuterActive = '';
      update();
    }

    pointerMove(ev) {
      if (this.moving) {
        ev.stopPropagation();
        const current = props.type === 'horizontal' ? ev.screenX : ev.screenY;
        const diff = current - this.initialPos;
        this.cumulation += diff;
        this.currentPos = this.limitPosition(this.currentPos + diff);
        this.initialPos = current;
        const percent = this.currentPos / maxPos;
        let dataIndex = 0;
        let offset = 0;
        if (props.type === 'horizontal') {
          for (let len = allDates.length; dataIndex < len; dataIndex++) {
            const date = allDates[dataIndex];
            if (date.leftPercent >= percent) break;
          }
        } else {
          let row;
          for (let len = rowsId.length; dataIndex < len; dataIndex++) {
            row = api.getRow(rowsId[dataIndex]);
            if (row.$data.position.bottomPercent >= percent) break;
          }
          if (dataIndex !== row.length - 1 && smooth) {
            const leftPercent = percent - row.$data.position.topPercent;
            offset = Math.floor(leftPercent * getFullSize());
          }
        }
        if (!dataIndex) dataIndex = 0;
        this.dataIndex = dataIndex;
        if (props.type === 'horizontal') {
          this.lastDate = allDates[dataIndex];
          api.setScrollLeft(dataIndex, undefined, undefined, undefined);
        } else {
          this.lastRow = api.getRow(rowsId[dataIndex]);
          api.setScrollTop(dataIndex, offset);
        }
        if (dataIndex !== this.lastDataIndex) {
          this.cumulation = 0;
        }
        this.lastDataIndex = dataIndex;
      }
    }
  }

  const outerComponentActions = api.getActions(componentName);
  outerComponentActions.push(OuterAction);
  const outerActions = Actions.create(outerComponentActions, { api, state, props });
  const innerComponentActions = [InnerAction];
  const innerActions = Actions.create(innerComponentActions, { api, state, props });

  const slots = api.generateSlots(componentName, vido, props);

  return () =>
    html`
      <div
        data-actions=${outerActions}
        class=${className + ' ' + className + '--' + props.type + classNameOuterActive}
        style=${styleMapOuter}
      >
        ${slots.html('before')}
        <div
          data-actions=${innerActions}
          class=${classNameInner + ' ' + classNameInner + '--' + props.type + classNameInnerActive}
          style=${styleMapInner}
        >
          ${slots.html('inside')}
        </div>
        ${slots.html('after')}
      </div>
    `;
}
