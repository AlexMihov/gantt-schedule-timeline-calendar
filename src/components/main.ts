/**
 * Main component
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import ResizeObserver from 'resize-observer-polyfill';
import {
  ChartTime,
  DataChartTime,
  DataChartTimeLevel,
  ChartCalendar,
  DataChartTimeLevelDate,
  ChartCalendarLevel,
  ChartTimeDate,
  ChartTimeDates,
  ChartCalendarFormat,
  ScrollTypeHorizontal,
  ScrollType,
  Rows,
  Item,
  ItemData,
  Vido,
  Reason,
  Scroll,
  Row,
} from '../gstc';

import { Component, ComponentInstance } from '@neuronet.io/vido/src/vido';

export default function Main(vido: Vido, props = {}) {
  const { api, state, onDestroy, Actions, update, createComponent, html, StyleMap } = vido;
  const componentName = api.name;

  // Initialize plugins
  const pluginsDestroy = [];
  function destroyPlugins() {
    pluginsDestroy.forEach((destroy) => destroy());
    pluginsDestroy.length = 0;
  }
  onDestroy(
    state.subscribe('config.plugins', (plugins) => {
      // plugins was changed but it could be whole config that was changed
      // - we need to destroy actual plugins and mount them again
      destroyPlugins();
      if (typeof plugins !== 'undefined' && Array.isArray(plugins)) {
        for (const initializePlugin of plugins) {
          const destroyPlugin = initializePlugin(vido);
          if (typeof destroyPlugin === 'function') {
            pluginsDestroy.push(destroyPlugin);
          } else if (destroyPlugin && Object.prototype.hasOwnProperty.call(destroyPlugin, 'destroy')) {
            pluginsDestroy.push(destroyPlugin.destroy);
          }
        }
      }
    })
  );
  onDestroy(destroyPlugins);

  const componentSubs = [];
  let ListComponent: Component;
  componentSubs.push(state.subscribe('config.components.List', (value) => (ListComponent = value)));
  let ChartComponent: Component;
  componentSubs.push(state.subscribe('config.components.Chart', (value) => (ChartComponent = value)));

  const List: ComponentInstance = createComponent(ListComponent);
  onDestroy(() => {
    if (List) List.destroy();
  });
  const Chart: ComponentInstance = createComponent(ChartComponent);
  onDestroy(() => {
    if (Chart) Chart.destroy();
  });

  onDestroy(() => {
    componentSubs.forEach((unsub) => unsub());
  });

  let wrapper;
  onDestroy(state.subscribe('config.wrappers.Main', (value) => (wrapper = value)));

  let componentActions;
  onDestroy(state.subscribe('config.actions.main', (actions) => (componentActions = actions)));

  const styleMap = new StyleMap({});
  let rowsHeight = 0;
  let resizerActive = false;
  let lastRowsHeight = -1;
  let timeLoadedEventFired = false;

  let className = api.getClass(componentName);

  function heightChange() {
    const config = state.get('config');
    const scrollBarHeight = state.get('config.scroll.horizontal.size');
    const finalInnerHeight = config.innerHeight - scrollBarHeight;
    state
      .multi()
      .update('$data.innerHeight', finalInnerHeight)
      .update('$data.height', config.innerHeight + config.headerHeight)
      .done();
    styleMap.style['--height'] = finalInnerHeight + 'px';
    update();
  }
  onDestroy(
    state.subscribeAll(['config.innerHeight', 'config.headerHeight', 'config.scroll.horizontal.size'], heightChange)
  );

  function resizerActiveChange(active: boolean) {
    resizerActive = active;
    className = api.getClass(api.name);
    if (resizerActive) {
      className += ` ${api.name}__list-column-header-resizer--active`;
    }
    update();
  }
  onDestroy(state.subscribe('$data.list.columns.resizer.active', resizerActiveChange));

  let emptyValuesDone = false;
  function generateTree(bulk = null, eventInfo = null) {
    if (eventInfo && eventInfo.type === 'subscribe') return;
    if (bulk === 'reload') emptyValuesDone = false;
    const rows = state.get('config.list.rows');
    if (!emptyValuesDone) api.fillEmptyRowValues(rows);
    const items = state.get('config.chart.items');
    if (!emptyValuesDone) api.prepareItems(items);
    emptyValuesDone = true;
    state.update('$data.treeMap', api.makeTreeMap(rows, items));
    update();
  }

  function prepareExpandedCalculateRowHeightsAndFixOverlapped() {
    const configRows: Rows = state.get('config.list.rows');
    if (!configRows) return;
    const rowsWithParentsExpanded: string[] = api.getRowsWithParentsExpanded(configRows);
    rowsHeight = api.recalculateRowsHeightsAndFixOverlappingItems(rowsWithParentsExpanded);
    const verticalArea: number = state.get('config.scroll.vertical.area');
    api.recalculateRowsPercents(rowsWithParentsExpanded, verticalArea);
    state
      .multi()
      .update('$data.list.rowsHeight', rowsHeight, { force: true })
      .update('$data.list.rowsWithParentsExpanded', rowsWithParentsExpanded)
      .done();
    update();
  }

  function getLastPageRowsHeight(innerHeight: number, rowsWithParentsExpanded: string[]): number {
    if (rowsWithParentsExpanded.length === 0) return 0;
    let lastPageSize = 0;
    let lastPageCount = 0;
    const rows: Rows = state.get('config.list.rows');
    for (let i = rowsWithParentsExpanded.length - 1; i >= 0; i--) {
      const row = rows[rowsWithParentsExpanded[i]];
      lastPageSize += row.$data.outerHeight;
      if (lastPageSize >= innerHeight) {
        lastPageSize = lastPageSize - row.$data.outerHeight;
        break;
      }
      lastPageCount++;
    }
    state
      .multi()
      .update('config.scroll.vertical.lastPageSize', lastPageSize, { force: true })
      .update('config.scroll.vertical.lastPageCount', lastPageCount, { force: true })
      .done();
    return lastPageSize;
  }

  function calculateHeightRelatedThings() {
    const rowsWithParentsExpanded: string[] = state.get('$data.list.rowsWithParentsExpanded');
    const rowsHeight = state.get('$data.list.rowsHeight');
    if (rowsHeight === lastRowsHeight) return;
    lastRowsHeight = rowsHeight;
    const innerHeight = state.get('$data.innerHeight');
    const lastPageHeight = getLastPageRowsHeight(innerHeight, rowsWithParentsExpanded);
    state
      .multi()
      .update('config.scroll.vertical.area', rowsHeight, { force: true })
      .update('config.scroll.vertical.areaWithoutLastPage', rowsHeight - lastPageHeight, { force: true })
      .done();
  }

  function calculateVisibleRowsHeights() {
    const scrollOffset = state.get('config.scroll.vertical.offset') || 0;
    const visibleRows: string[] = state.get('$data.list.visibleRows');
    let height = 0;
    const rows: Rows = state.get('config.list.rows');
    for (const rowId of visibleRows) {
      height += api.recalculateRowHeight(rows[rowId]);
    }
    state.update('$data.list.visibleRowsHeight', height + scrollOffset);
  }

  function generateVisibleRowsAndItems() {
    const visibleRowsId = api.getVisibleRows(state.get('$data.list.rowsWithParentsExpanded'));
    const currentVisibleRowsId: string[] = state.get('$data.list.visibleRows') || [];
    let shouldUpdate = true;
    if (visibleRowsId.length !== currentVisibleRowsId.length) {
      shouldUpdate = true;
    } else if (visibleRowsId.length) {
      shouldUpdate = visibleRowsId.join(',') !== currentVisibleRowsId.join(',');
    }
    if (shouldUpdate) {
      state.update('$data.list.visibleRows', visibleRowsId);
    }
    const visibleItemsId = [];
    const rows: Rows = state.get('config.list.rows');
    for (const rowId of visibleRowsId) {
      const row = rows[rowId];
      for (const itemId of row.$data.items) {
        visibleItemsId.push(itemId);
      }
    }
    const currentVisibleItems: string[] = state.get('$data.chart.visibleItems') || [];
    if (visibleItemsId.join(',') !== currentVisibleItems.join(',')) {
      state.update('$data.chart.visibleItems', visibleItemsId);
    }
    update();
  }

  let rowsAndItems = 0;
  onDestroy(
    state.subscribeAll(['config.chart.items;', 'config.list.rows;'], (bulk, eventInfo) => {
      ++rowsAndItems;
      generateTree('reload');
      generateVisibleRowsAndItems();
      prepareExpandedCalculateRowHeightsAndFixOverlapped();
      calculateHeightRelatedThings();
      calculateVisibleRowsHeights();
      state.update('config.scroll', (scroll: Scroll) => {
        scroll.horizontal.dataIndex = 0;
        scroll.horizontal.data = null;
        scroll.horizontal.posPx = 0;
        scroll.vertical.dataIndex = 0;
        scroll.vertical.data = Object.values(state.get('config.list.rows'))[0] as Row;
        scroll.vertical.posPx = 0;
        return scroll;
      });
      if (rowsAndItems === 2 && eventInfo.type !== 'subscribe') {
        timeLoadedEventFired = false;
      }
      recalculateTimes({ name: 'reload' }); // eslint-disable-line @typescript-eslint/no-use-before-define
      if (rowsAndItems === 2) {
        rowsAndItems = 0;
      }
    })
  );

  onDestroy(
    state.subscribeAll(
      ['config.list.rows.*.parentId', 'config.chart.items.*.rowId'],
      () => {
        generateTree();
        generateVisibleRowsAndItems();
        calculateHeightRelatedThings();
        calculateVisibleRowsHeights();
      },
      { bulk: true }
    )
  );

  onDestroy(
    state.subscribeAll(
      [
        'config.list.rows.*.expanded',
        'config.chart.items.*.height',
        'config.chart.items.*.rowId',
        'config.list.rows.*.$data.outerHeight',
        'config.scroll.vertical.area',
      ],
      prepareExpandedCalculateRowHeightsAndFixOverlapped,
      { bulk: true }
    )
  );

  onDestroy(state.subscribeAll(['$data.innerHeight', '$data.list.rowsHeight'], calculateHeightRelatedThings));

  onDestroy(
    state.subscribeAll(
      [
        'config.chart.items.*.time',
        'config.chart.items.*.$data.position',
        '$data.list.visibleRows',
        'config.scroll.vertical.offset',
      ],
      calculateVisibleRowsHeights,
      {
        bulk: true,
      }
    )
  );

  onDestroy(
    state.subscribeAll(
      ['$data.list.rowsWithParentsExpanded', 'config.scroll.vertical.dataIndex', 'config.chart.items.*.rowId'],
      generateVisibleRowsAndItems,
      { bulk: true /*, ignore: ['config.chart.items.*.$data.detached', 'config.chart.items.*.selected']*/ }
    )
  );

  function getLastPageDatesWidth(chartWidth: number, allDates: DataChartTimeLevelDate[]): number {
    if (allDates.length === 0) return 0;
    let currentWidth = 0;
    let count = 0;
    for (let i = allDates.length - 1; i >= 0; i--) {
      const date = allDates[i];
      currentWidth += date.width;
      if (currentWidth >= chartWidth) {
        currentWidth = currentWidth - date.width;
        break;
      }
      count++;
    }
    state.update('config.scroll.horizontal', (horizontal: ScrollType) => {
      horizontal.lastPageSize = currentWidth;
      horizontal.lastPageCount = count;
      return horizontal;
    });
    return currentWidth;
  }

  function generatePeriodDates(
    formatting: ChartCalendarFormat,
    time: DataChartTime,
    level: ChartCalendarLevel,
    levelIndex: number
  ): DataChartTimeLevel {
    const period = formatting.period;
    let from = time.from;
    let leftDate = api.time.date(from).startOf(period);
    const rightDate = api.time.date(time.to).endOf(period);
    const dates = api.time.generatePeriodDates({
      leftDate,
      rightDate,
      level,
      levelIndex,
      period,
      time,
      callOnDate: false,
      callOnLevelDates: true,
    });
    const className = api.getClass('chart-calendar-date');
    for (const date of dates) {
      date.formatted = formatting.format({
        timeStart: date.leftGlobalDate,
        timeEnd: date.rightGlobalDate,
        vido,
        className,
        props: { date },
      });
    }
    return dates;
  }

  function triggerLoadedEvent() {
    if (timeLoadedEventFired) return;
    Promise.resolve().then(() => {
      const element = state.get('$data.elements.main');
      const parent = element.parentNode;
      const event = new Event('gstc-loaded');
      element.dispatchEvent(event);
      parent.dispatchEvent(event);
      timeLoadedEventFired = true;
    });
  }

  function limitGlobal(time: DataChartTime, oldTime: DataChartTime) {
    if (time.leftGlobal < time.from) time.leftGlobal = time.from;
    if (time.rightGlobal > time.to) time.rightGlobal = time.to;
    time.leftGlobalDate = api.time.date(time.leftGlobal).startOf(time.period);
    time.leftGlobal = time.leftGlobalDate.valueOf();
    time.rightGlobalDate = api.time.date(time.rightGlobal).endOf(time.period);
    time.rightGlobal = time.rightGlobalDate.valueOf();
    time.centerGlobal = oldTime.centerGlobal;
    time.centerGlobalDate = oldTime.centerGlobalDate;
    return time;
  }

  function setCenter(time: DataChartTime) {
    let diff = Math.floor(time.rightGlobalDate.diff(time.leftGlobalDate, 'millisecond', true) / 2);
    const lastViewDate = api.time.getRightViewDate(time);
    if (lastViewDate.width !== lastViewDate.currentView.width) {
      diff -= (lastViewDate.width - lastViewDate.currentView.width) * time.timePerPixel;
    }
    time.centerGlobalDate = time.leftGlobalDate.add(diff, 'millisecond');
    time.centerGlobal = time.centerGlobalDate.valueOf();
  }

  function guessPeriod(time: DataChartTime, levels: ChartCalendarLevel[]) {
    if (!time.zoom) return time;
    for (const level of levels) {
      const formatting = level.formats.find((format) => +time.zoom <= +format.zoomTo);
      if (formatting && level.main) {
        time.period = formatting.period;
      }
    }
    return time;
  }

  function calculateDatesPercents(allMainDates: DataChartTimeLevelDate[], chartWidth: number): number {
    const lastPageWidth = getLastPageDatesWidth(chartWidth, allMainDates);
    let totalWidth = 0;
    for (const date of allMainDates) {
      totalWidth += date.width;
    }
    const scrollWidth = totalWidth - lastPageWidth;
    for (const date of allMainDates) {
      date.leftPercent = date.leftPx / scrollWidth;
      date.rightPercent = date.rightPx / scrollWidth;
    }
    return scrollWidth;
  }

  function generateAllDates(time: DataChartTime, levels: ChartCalendarLevel[], chartWidth: number): number {
    if (!time.zoom) return 0;
    time.allDates = new Array(levels.length);

    // first of all we need to generate main dates because plugins may use it (HideWeekends for example)
    const mainLevel = levels[time.level];
    const formatting = mainLevel.formats.find((format) => +time.zoom <= +format.zoomTo);
    time.allDates[time.level] = generatePeriodDates(formatting, time, mainLevel, time.level);

    let levelIndex = 0;
    for (const level of levels) {
      if (!level.main) {
        const formatting = level.formats.find((format) => +time.zoom <= +format.zoomTo);
        time.allDates[levelIndex] = generatePeriodDates(formatting, time, level, levelIndex);
      }
      levelIndex++;
    }
    return calculateDatesPercents(time.allDates[time.level], chartWidth);
  }

  function getPeriodDates(allLevelDates: ChartTimeDates, time: DataChartTime): ChartTimeDate[] {
    if (!allLevelDates.length) return [];
    const filtered = allLevelDates.filter((date) => {
      return (
        (date.leftGlobal >= time.leftGlobal && date.leftGlobal <= time.rightGlobal) ||
        (date.rightGlobal >= time.leftGlobal && date.rightGlobal <= time.rightGlobal) ||
        (date.leftGlobal <= time.leftGlobal && date.rightGlobal >= time.rightGlobal) ||
        (date.leftGlobal >= time.leftGlobal && date.rightGlobal <= time.rightGlobal)
      );
    });
    if (!filtered.length) return [];
    let firstLeftDiff = 0;
    if (filtered[0].period !== time.period && time.leftGlobal > filtered[0].leftGlobal) {
      firstLeftDiff = api.time.getDatesDiffPx(time.leftGlobalDate, filtered[0].leftGlobalDate, time, false);
    }

    let leftPx = 0;
    const filteredLastIndex = filtered.length - 1;
    return filtered.map((date: ChartTimeDate, index: number) => {
      date.currentView = {
        leftPx,
        rightPx: date.rightPx,
        width: date.width,
      };
      if (firstLeftDiff < 0) {
        date.currentView.width = date.width + firstLeftDiff;
        date.currentView.leftPx = 0;
        firstLeftDiff = 0;
      }
      date.currentView.rightPx = date.currentView.leftPx + date.currentView.width;
      leftPx += date.currentView.width;
      if (index === filteredLastIndex && date.currentView.rightPx > time.width) {
        date.currentView.rightPx = time.width;
        date.currentView.width = date.currentView.rightPx - date.currentView.leftPx;
      }
      return date;
    });
  }

  function updateLevels(time: DataChartTime, levels: ChartCalendarLevel[]) {
    time.levels = [];
    let levelIndex = 0;
    for (const level of levels) {
      const format = level.formats.find((format) => +time.zoom <= +format.zoomTo);
      if (level.main) {
        time.format = format;
        time.level = levelIndex;
      }
      if (format) {
        let dates = getPeriodDates(time.allDates[levelIndex], time);
        time.onCurrentViewLevelDates.forEach((onCurrentViewLevelDates) => {
          dates = onCurrentViewLevelDates({ dates, format, time, level, levelIndex });
        });
        time.levels.push(dates);
      }
      levelIndex++;
    }
  }

  function calculateTotalViewDuration(time: DataChartTime) {
    let width = 0;
    let ms = 0;
    for (const date of time.allDates[time.level]) {
      width += date.width;
      ms += date.rightGlobal - date.leftGlobal;
    }
    time.totalViewDurationPx = width;
    time.totalViewDurationMs = ms;
  }

  function calculateRightGlobal(
    leftGlobal: number,
    chartWidth: number,
    allMainDates: DataChartTimeLevelDate[]
  ): number {
    const date = api.time.findDateAtTime(leftGlobal, allMainDates);
    if (!date) return leftGlobal;
    let index = allMainDates.indexOf(date);
    let rightGlobal = date.leftGlobal;
    let width = 0;
    for (let len = allMainDates.length; index < len; index++) {
      const currentDate = allMainDates[index];
      rightGlobal = currentDate.leftGlobal;
      width += currentDate.width;
      if (width >= chartWidth) break;
    }
    return rightGlobal;
  }

  function updateVisibleItems(time: DataChartTime = state.get('$data.chart.time'), multi = state.multi()) {
    const visibleItemsId: string[] = state.get('$data.chart.visibleItems');
    const visibleItems: Item[] = api.getItems(visibleItemsId);
    if (!visibleItems) return multi;
    const rows: Rows = state.get('config.list.rows');
    if (!rows) return multi;
    if (!time.levels || !time.levels[time.level]) return multi;
    const spacing = state.get('config.chart.spacing') || 0;
    for (const item of visibleItems) {
      if (!item) return;
      const row = rows[item.rowId];
      if (!row || !row.$data) continue;
      const left = api.time.getViewOffsetPxFromDates(item.$data.time.startDate, false, time);
      const right = api.time.getViewOffsetPxFromDates(item.$data.time.endDate, false, time);
      const actualTop = item.$data.position.top + item.gap.top;
      const viewTop = row.$data.position.viewTop + item.$data.position.actualTop;
      const position = item.$data.position;
      if (
        position.left === left &&
        position.right === right &&
        position.actualTop === actualTop &&
        position.viewTop === viewTop
      ) {
        continue;
      }
      multi = multi.update(
        `config.chart.items.${item.id}.$data`,
        function ($data: ItemData) {
          if (!$data) return;
          $data.position.left = left;
          $data.position.actualLeft = api.time.limitOffsetPxToView(left, time);
          $data.position.right = right;
          $data.position.actualRight = api.time.limitOffsetPxToView(right, time);
          $data.width = right - left - spacing;
          $data.actualWidth = $data.position.actualRight - $data.position.actualLeft - spacing;
          $data.position.actualTop = actualTop;
          $data.position.viewTop = viewTop;
          return $data;
        },
        {
          data: 'updateVisibleItems',
        }
      );
    }
    return multi;
  }

  onDestroy(
    state.subscribeAll(
      ['$data.list.visibleRows;', '$data.chart.visibleItems;', 'config.scroll.vertical', 'config.chart.items'],
      (bulk, eventInfo) => {
        if (eventInfo.options.data && eventInfo.options.data === 'updateVisibleItems') return;
        updateVisibleItems().done();
      },
      { bulk: true, ignore: ['config.chart.items.*.$data.detached', 'config.chart.items.*.selected'] }
    )
  );

  function recalculateTimes(reason: Reason) {
    const chartWidth: number = state.get('$data.chart.dimensions.width');
    if (!chartWidth) {
      return;
    }
    const configTime: ChartTime = state.get('config.chart.time');
    const calendar: ChartCalendar = state.get('config.chart.calendar');
    const oldTime: DataChartTime = { ...state.get('$data.chart.time') };
    let time: DataChartTime = api.mergeDeep({}, configTime);
    if ((!time.from || !time.to) && !Object.keys(state.get('config.chart.items')).length) {
      return;
    }
    time.fromDate = api.time.date(time.from);
    time.toDate = api.time.date(time.to);

    const mainLevel = calendar.levels.find((level) => level.main);
    if (!mainLevel) {
      throw new Error('Main calendar level not found (config.chart.calendar.levels).');
    }
    const mainLevelIndex = calendar.levels.indexOf(mainLevel);
    time.level = mainLevelIndex;

    if (!time.calculatedZoomMode) {
      if (time.period !== oldTime.period) {
        let periodFormat = mainLevel.formats.find((format) => format.period === time.period && format.default);
        if (periodFormat) {
          time.zoom = periodFormat.zoomTo;
        }
      }
      guessPeriod(time, calendar.levels);
    }

    let horizontalScroll: ScrollTypeHorizontal = state.get('config.scroll.horizontal');
    let scrollWidth = 0;

    // source of everything = time.timePerPixel
    if (time.calculatedZoomMode && chartWidth) {
      time.totalViewDurationMs = api.time.date(time.to).diff(time.from, 'millisecond');
      time.timePerPixel = time.totalViewDurationMs / chartWidth;
      time.zoom = Math.log(time.timePerPixel) / Math.log(2);
      guessPeriod(time, calendar.levels);
      if (
        oldTime.zoom !== time.zoom ||
        time.allDates.length === 0 ||
        reason.name === 'forceUpdate' ||
        reason.name === 'items' ||
        reason.name === 'reload'
      ) {
        scrollWidth = generateAllDates(time, calendar.levels, chartWidth);
        calculateTotalViewDuration(time);
        const all = time.allDates[time.level];
        time.to = all[all.length - 1].rightGlobal;
        time.toDate = api.time.date(time.to);
      }
      time.leftGlobal = time.from;
      time.leftGlobalDate = api.time.date(time.leftGlobal);
      time.rightGlobal = time.to;
      time.rightGlobalDate = api.time.date(time.rightGlobal);
    } else {
      time.timePerPixel = Math.pow(2, time.zoom);
      if (reason.name === 'items') {
        time.from = reason.from;
        time.to = reason.to;
        time.fromDate = api.time.date(time.from);
        time.toDate = api.time.date(time.to);
      }
      time = api.time.recalculateFromTo(time);
      if (
        oldTime.zoom !== time.zoom ||
        time.allDates.length === 0 ||
        reason.name === 'forceUpdate' ||
        reason.name === 'items' ||
        reason.name === 'reload'
      ) {
        scrollWidth = generateAllDates(time, calendar.levels, chartWidth);
        calculateTotalViewDuration(time);
        const all = time.allDates[time.level];
        time.to = all[all.length - 1].rightGlobal;
        time.toDate = api.time.date(time.to);
      } else {
        time.totalViewDurationPx = oldTime.totalViewDurationPx;
        time.totalViewDurationMs = oldTime.totalViewDurationMs;
      }
    }

    if (scrollWidth) {
      time.scrollWidth = scrollWidth;
    } else {
      time.scrollWidth = oldTime.scrollWidth;
    }

    const allMainDates = time.allDates[mainLevelIndex];

    let updateCenter = false;
    const recalculateTimesLastReason: string = state.get('$data.chart.time.recalculateTimesLastReason') || '';

    if (!time.calculatedZoomMode) {
      // If time.zoom (or time.period) has been changed
      // then we need to recalculate basing on time.centerGlobal
      // and update scroll left
      // if not then we need to calculate from scroll left
      // because change was triggered by scroll

      if ((time.zoom !== oldTime.zoom || reason.name === 'period') && oldTime.centerGlobal) {
        const chartWidthInMs = chartWidth * time.timePerPixel;
        const halfChartInMs = Math.round(chartWidthInMs / 2);
        const diff = Math.ceil(oldTime.centerGlobalDate.diff(oldTime.centerGlobal + halfChartInMs, time.period, true));
        time.leftGlobalDate = oldTime.centerGlobalDate.add(diff, time.period);
        const milliseconds = time.leftGlobalDate.valueOf();
        let date = api.time.findDateAtTime(milliseconds, allMainDates);
        if (!date) date = allMainDates[0];
        time.leftGlobal = date.leftGlobal;
        time.leftGlobalDate = date.leftGlobalDate;
        time.rightGlobal = calculateRightGlobal(time.leftGlobal, chartWidth, allMainDates);
        time.rightGlobalDate = api.time.date(time.rightGlobal).endOf(time.period);
        time.rightGlobal = time.rightGlobalDate.valueOf();
      } else {
        let date = horizontalScroll.data;
        if (!date) {
          date = allMainDates[0];
        }
        time.leftGlobalDate = date.leftGlobalDate;
        time.leftGlobal = time.leftGlobalDate.valueOf();
        time.rightGlobal = calculateRightGlobal(time.leftGlobal, chartWidth, allMainDates);
        time.rightGlobalDate = api.time.date(time.rightGlobal).endOf(time.period);
        time.rightGlobal = time.rightGlobal.valueOf();
        updateCenter =
          recalculateTimesLastReason !== 'zoom' &&
          recalculateTimesLastReason !== 'period' &&
          recalculateTimesLastReason !== 'time';
      }
    }

    limitGlobal(time, oldTime);

    time.leftInner = time.leftGlobal - time.from;
    time.rightInner = time.rightGlobal - time.from;
    time.leftPx = 0;
    time.rightPx = chartWidth;
    time.width = chartWidth;

    updateLevels(time, calendar.levels);
    if (updateCenter) setCenter(time);
    const mainLevelDates = time.levels[time.level];
    if (mainLevelDates && mainLevelDates.length) {
      time.leftPx = mainLevelDates[0].leftPx;
      time.rightPx = mainLevelDates[mainLevelDates.length - 1].leftPx;
    }

    let multi = state
      .multi()
      .update(`$data.chart.time`, time)
      .update('config.chart.time', (configTime: ChartTime) => {
        configTime.zoom = time.zoom;
        configTime.period = time.format.period;
        configTime.leftGlobal = time.leftGlobal;
        configTime.centerGlobal = time.centerGlobal;
        configTime.rightGlobal = time.rightGlobal;
        configTime.from = time.from;
        configTime.to = time.to;
        // @ts-ignore
        configTime.allDates = time.allDates;
        // @ts-ignore
        configTime.additionalSpaceAdded = time.additionalSpaceAdded;
        return configTime;
      });
    multi = updateVisibleItems(time, multi);
    multi = multi.update('$data.chart.time.recalculateTimesLastReason', reason.name);
    multi.done();
    update(() => {
      if (!timeLoadedEventFired) {
        setTimeout(triggerLoadedEvent, 0);
      }
    });
  }

  const recalculationTriggerCache = {
    initialized: false,
    zoom: 0,
    period: '',
    scrollDataIndex: 0,
    chartWidth: 0,
    from: 0,
    to: 0,
  };
  function recalculationIsNeeded() {
    const configTime = state.get('config.chart.time');
    const dataIndex = state.get('config.scroll.horizontal.dataIndex');
    const chartWidth = state.get('$data.chart.dimensions.width');
    const cache = { ...recalculationTriggerCache };
    recalculationTriggerCache.zoom = configTime.zoom;
    recalculationTriggerCache.period = configTime.period;
    recalculationTriggerCache.from = configTime.from;
    recalculationTriggerCache.to = configTime.to;
    recalculationTriggerCache.scrollDataIndex = dataIndex;
    recalculationTriggerCache.chartWidth = chartWidth;
    if (!recalculationTriggerCache.initialized) {
      recalculationTriggerCache.initialized = true;
      return { name: 'all' };
    }
    if (configTime.forceUpdate === true) {
      // prevent infinite loop because recalculate will not update this value while other things were changed
      state.update('config.chart.time.forceUpdate', false);
      return { name: 'forceUpdate' };
    }
    if (configTime.zoom !== cache.zoom) return { name: 'zoom', oldValue: cache.zoom, newValue: configTime.zoom };
    if (configTime.period !== cache.period)
      return { name: 'period', oldValue: cache.period, newValue: configTime.period };
    if (configTime.from !== cache.from) return { name: 'from', oldValue: cache.from, newValue: configTime.from };
    if (configTime.to !== cache.to) return { name: 'to', oldValue: cache.to, newValue: configTime.to };
    if (dataIndex !== cache.scrollDataIndex)
      return { name: 'scroll', oldValue: cache.scrollDataIndex, newValue: dataIndex };
    if (chartWidth !== cache.chartWidth)
      return { name: 'chartWidth', oldValue: cache.chartWidth, newValue: chartWidth };
    return { name: '' };
  }

  onDestroy(
    state.subscribeAll(
      [
        'config.chart.time',
        '$data.chart.time',
        'config.chart.calendar.levels',
        'config.scroll.horizontal.dataIndex',
        '$data.chart.dimensions.width',
      ],
      () => {
        let reason = recalculationIsNeeded();
        if (reason.name) recalculateTimes(reason);
      },
      { bulk: true }
    )
  );

  onDestroy(
    state.subscribe('config.chart.items.:itemId.time', (bulk, eventInfo) => {
      const time: DataChartTime = state.get('$data.chart.time');
      const item: Item = state.get(`config.chart.items.${eventInfo.params.itemId}`);
      if (!item) return;
      if (item.time.start < time.from || item.time.end > time.to) {
        let from = time.from,
          to = time.to;
        if (item.time.start < time.from) from = item.time.start;
        if (item.time.end > time.to) to = item.time.end;
        recalculateTimes({ name: 'items', from, to });
      }
    })
  );

  try {
    const ignoreHosts = [
      'stackblitz.io',
      'codepen.io',
      'cdpn.io',
      'codesandbox.io',
      'csb.app',
      'jsrun.pro',
      'jsrun.top',
      'jsfiddle.net',
      'jsbin.com',
    ];
    let loc = location.host;
    const locParts = loc.split('.');
    if (locParts.length > 2) {
      for (let i = 0, len = locParts.length - 2; i < len; i++) {
        locParts.shift();
      }
      loc = locParts.join('.');
    }
    const startsWith = ['192.', '127.', 'test', 'demo', 'local'];
    const endsWith = ['test', 'local', 'demo'];
    /* eslint-disable */
    function startsEnds() {
      for (let i = 0, len = startsWith.length; i < len; i++) {
        if (location.hostname.startsWith(startsWith[i])) return true;
      }
      for (let i = 0, len = endsWith.length; i < len; i++) {
        if (location.hostname.endsWith(endsWith[i])) return true;
      }
      return false;
    }
    // @ts-ignore
    function shouldSend(): boolean {
      return !ignoreHosts.includes(loc) && location.hostname !== 'localhost' && !startsEnds();
    }
    if (state.get('config.usageStatistics') === true && !localStorage.getItem('gstcus') && shouldSend()) {
      fetch('https://gstc-us.neuronet.io/', {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        redirect: 'follow',
        body: JSON.stringify({ location: { href: location.href, host: location.host } }),
      }).catch((e) => {});
      localStorage.setItem('gstcus', 'true');
    }
  } catch (e) {}
  /* eslint-enable */

  const dimensions = { width: 0, height: 0 };
  let ro;
  /**
   * Resize action
   * @param {Element} element
   */
  class ResizeAction {
    constructor(element: HTMLElement) {
      if (!ro) {
        ro = new ResizeObserver(() => {
          const width = element.clientWidth;
          const height = element.clientHeight;
          if (dimensions.width !== width || dimensions.height !== height) {
            dimensions.width = width;
            dimensions.height = height;
            state.update('$data.dimensions', dimensions);
          }
        });
        ro.observe(element);
        state.update('$data.elements.main', element);
      }
    }
    public update() {}
    public destroy(element) {
      ro.unobserve(element);
    }
  }
  if (!componentActions.includes(ResizeAction)) {
    componentActions.push(ResizeAction);
  }

  onDestroy(() => {
    ro.disconnect();
  });

  let horizontalScrollMultiplier, verticalScrollMultiplier;
  onDestroy(
    state.subscribe('config.scroll', (scroll) => {
      horizontalScrollMultiplier = scroll.horizontal.multiplier;
      verticalScrollMultiplier = scroll.vertical.multiplier;
    })
  );

  function onWheel(ev: MouseWheelEvent) {
    const normalized = api.normalizeMouseWheelEvent(ev);
    if (ev.shiftKey || normalized.x) {
      const x = normalized.x ? normalized.x : normalized.y;
      const scrollLeft = api.getScrollLeft();
      if (x > 0) {
        api.setScrollLeft(scrollLeft.dataIndex + horizontalScrollMultiplier);
      } else {
        api.setScrollLeft(scrollLeft.dataIndex - horizontalScrollMultiplier);
      }
      return;
    }
    const scrollTop = api.getScrollTop();
    if (normalized.y > 0) {
      api.setScrollTop(scrollTop.dataIndex + verticalScrollMultiplier);
    } else {
      api.setScrollTop(scrollTop.dataIndex - verticalScrollMultiplier);
    }
  }

  const actionProps = { ...props, api, state };
  const mainActions = Actions.create(componentActions, actionProps);

  const slots = api.generateSlots('main', vido, props);
  onDestroy(slots.destroy);

  return (templateProps) =>
    wrapper(
      html`
        <div
          data-info-url="https://github.com/neuronetio/gantt-schedule-timeline-calendar"
          class=${className}
          style=${styleMap}
          data-actions=${mainActions}
          @wheel=${onWheel}
        >
          ${slots.html('before', templateProps)}${List.html()}${slots.html(
            'inside',
            templateProps
          )}${Chart.html()}${slots.html('after', templateProps)}
        </div>
      `,
      { props, vido, templateProps }
    );
}
