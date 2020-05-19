/**
 * Api functions
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0
 */

import defaultConfigFn from '../default-config';
import { Time } from './time';
import State from 'deep-state-observer';
//import State from '../../../deep-state-observer';
import DeepState from 'deep-state-observer';
//import DeepState from '../../../deep-state-observer';
import dayjs from 'dayjs';
import {
  Config,
  Period,
  DataChartTime,
  ScrollTypeHorizontal,
  Row,
  Item,
  Vido,
  Items,
  DefaultItem,
  DataChartTimeLevelDate,
  ScrollTypeVertical,
  Rows,
} from '../gstc';
import { generateSlots } from './slots';
import { lithtml } from '@neuronet.io/vido/src/vido';
import helpers from '@neuronet.io/vido/src/helpers';
const mergeDeep = helpers.mergeDeep;

const lib = 'gstc';

export function getClass(name: string, appendix: string = '') {
  let simple = `${lib}__${name}`;
  if (name === lib) {
    simple = lib;
  }
  if (appendix) return `${simple} ${simple}--${appendix.replace(/[^\w]+/gi, '-')}`;
  return simple;
}

export function getId(name: string, id: string) {
  let simple = `${lib}__${name}`;
  if (name === lib) {
    simple = lib;
  }
  return `${simple}--${id}`;
}

function mergeActions(userConfig: Config, defaultConfig: Config, merge) {
  const defaultConfigActions = merge({}, defaultConfig.actions);
  const userActions = merge({}, userConfig.actions);
  let allActionNames = [...Object.keys(defaultConfigActions), ...Object.keys(userActions)];
  allActionNames = allActionNames.filter((i) => allActionNames.includes(i));
  const actions = {};
  for (const actionName of allActionNames) {
    actions[actionName] = [];
    if (typeof defaultConfigActions[actionName] !== 'undefined' && Array.isArray(defaultConfigActions[actionName])) {
      actions[actionName] = [...defaultConfigActions[actionName]];
    }
    if (typeof userActions[actionName] !== 'undefined' && Array.isArray(userActions[actionName])) {
      actions[actionName] = [...actions[actionName], ...userActions[actionName]];
    }
  }
  delete userConfig.actions;
  delete defaultConfig.actions;
  return actions;
}

export function prepareState(userConfig: Config) {
  let merge = function merge(target: object, source: object) {
    return helpers.mergeDeep(target, source);
  };
  if (typeof userConfig.merge === 'function') merge = userConfig.merge;
  const defaultConfig: Config = defaultConfigFn();
  const actions = mergeActions(userConfig, defaultConfig, merge);
  const state = { config: merge(defaultConfig, userConfig) };
  state.config.actions = actions;
  return state;
}

export function stateFromConfig(userConfig: Config) {
  // @ts-ignore
  return (this.state = new State(prepareState(userConfig), { delimeter: '.', maxSimultaneousJobs: 1000 }));
}

export async function wasmStateFromConfig(userConfig: Config, wasmFile: string = './wildcard_matcher_bg.wasm') {
  // @ts-ignore
  this.state = new State(prepareState(userConfig), { delimeter: '.', maxSimultaneousJobs: 1000 });
  await this.state.loadWasmMatcher(wasmFile);
  return this.state;
}

export const publicApi = {
  name: lib,
  stateFromConfig,
  wasmStateFromConfig,
  merge: mergeDeep,
  lithtml,
  date(time) {
    return time ? dayjs(time) : dayjs();
  },
  setPeriod(period: Period): number {
    this.state.update('config.chart.time.period', period);
    return this.state.get('config.chart.time.zoom');
  },
  dayjs,
};

export interface WheelResult {
  x: number;
  y: number;
  z: number;
  event: MouseWheelEvent;
}

export interface IconsCache {
  [key: string]: string;
}

export type Unsubscribes = (() => void)[];

export class Api {
  public name = lib;
  public debug = false;
  public state: DeepState;
  public time: Time;
  public vido: Vido;
  private iconsCache: IconsCache = {};
  private unsubscribes: Unsubscribes = [];

  constructor(state: DeepState) {
    this.state = state;
    this.time = new Time(this.state, this);
    if (this.debug) {
      // @ts-ignore
      window.state = state;
    }
  }

  setVido(Vido: Vido) {
    this.vido = Vido;
  }

  log(...args) {
    if (this.debug) {
      // eslint-disable-next-line no-console
      console.log.call(console, ...args);
    }
  }

  generateSlots = generateSlots;
  mergeDeep = mergeDeep;
  getClass = getClass;
  getId = getId;
  allActions = [];

  getActions(name: string) {
    if (!this.allActions.includes(name)) this.allActions.push(name);
    let actions = this.state.get('config.actions.' + name);
    if (typeof actions === 'undefined') {
      actions = [];
    }
    return actions.slice();
  }

  isItemInViewport(item: Item, leftGlobal: number, rightGlobal: number) {
    return item.time.start <= rightGlobal && item.time.end >= leftGlobal;
  }

  getAllLinkedItemsIds(item: Item, items: Items, allLinked: string[] = []) {
    if (item.linkedWith && item.linkedWith.length) {
      if (!allLinked.includes(item.id)) allLinked.push(item.id);
      for (const linkedItemId of item.linkedWith) {
        if (allLinked.includes(linkedItemId)) continue;
        allLinked.push(linkedItemId);
        const linkedItem = items[linkedItemId];
        if (!linkedItem)
          throw new Error(`Linked item not found [id:'${linkedItemId}'] found in item [id:'${item.id}']`);
        if (linkedItem.linkedWith && linkedItem.linkedWith.length)
          this.getAllLinkedItemsIds(linkedItem, items, allLinked);
      }
    }
    return allLinked;
  }

  prepareLinkedItems(item: Item, items: Items) {
    const allLinkedIds = this.getAllLinkedItemsIds(item, items);
    for (const linkedItemId of allLinkedIds) {
      const linkedItem = items[linkedItemId];
      if (!linkedItem) throw new Error(`Linked item not found [id:'${linkedItemId}'] found in item [id:'${item.id}']`);
      linkedItem.linkedWith = allLinkedIds.filter((linkedItemId) => linkedItemId !== linkedItem.id);
    }
  }

  prepareItems(items: Items) {
    const defaultItemHeight = this.state.get('config.chart.item.height');
    for (const itemId in items) {
      const item = items[itemId];
      this.prepareLinkedItems(item, items);
      item.time.start = +item.time.start;
      item.time.end = +item.time.end;
      item.id = String(item.id);
      //if (typeof item.selected !== 'boolean') item.selected = false;
      const defaultItem: DefaultItem = this.state.get('config.chart.item');
      if (typeof item.height !== 'number') item.height = defaultItemHeight;
      if (!item.$data)
        item.$data = {
          actualHeight: 0,
          outerHeight: 0,
          time: null,
          position: {
            left: 0,
            actualLeft: 0,
            right: 0,
            actualRight: 0,
            top: item.top || 0,
            actualTop: item.top || 0,
            viewTop: 0,
          },
          width: -1,
          actualWidth: -1,
          detached: false,
        };
      item.$data.time = {
        startDate: this.time.date(item.time.start),
        endDate: this.time.date(item.time.end),
      };
      item.$data.actualHeight = item.height;
      if (typeof item.top !== 'number') item.top = 0;
      if (!item.gap) item.gap = {};
      if (typeof item.gap.top !== 'number') item.gap.top = defaultItem.gap.top;
      if (typeof item.gap.bottom !== 'number') item.gap.bottom = defaultItem.gap.bottom;
      if (typeof item.minWidth !== 'number') item.minWidth = defaultItem.minWidth;
      item.$data.outerHeight = item.$data.actualHeight + item.gap.top + item.gap.bottom;
      item.$data.position.actualTop = item.$data.position.top + item.gap.top;
    }
    return items;
  }

  fillEmptyRowValues(rows: Rows) {
    const defaultHeight = this.state.get('config.list.row.height');
    let top = 0;
    for (const rowId in rows) {
      const row = rows[rowId];
      if (!row.$data)
        row.$data = {
          parents: [],
          children: [],
          position: {
            top: 0,
            topPercent: 0,
            bottomPercent: 0,
            viewTop: 0,
          },
          items: [],
          actualHeight: 0,
          outerHeight: 0,
        };
      if (typeof row.height !== 'number') {
        row.height = defaultHeight;
      }
      row.$data.actualHeight = row.height;
      if (typeof row.expanded !== 'boolean') {
        row.expanded = false;
      }
      row.$data.position.top = top;
      if (typeof row.gap !== 'object') row.gap = {};
      if (typeof row.gap.top !== 'number') row.gap.top = 0;
      if (typeof row.gap.bottom !== 'number') row.gap.bottom = 0;
      row.$data.outerHeight = row.$data.actualHeight + row.gap.top + row.gap.bottom;
      top += row.$data.outerHeight;
    }
    return rows;
  }

  itemsOnTheSameLevel(item1: Item, item2: Item) {
    const item1Bottom = item1.$data.position.top + item1.$data.outerHeight;
    const item2Bottom = item2.$data.position.top + item2.$data.outerHeight;
    if (item2.$data.position.top <= item1.$data.position.top && item2Bottom > item1.$data.position.top) return true;
    if (item2.$data.position.top >= item1.$data.position.top && item2.$data.position.top < item1Bottom) return true;
    if (item2.$data.position.top >= item1.$data.position.top && item2Bottom < item1Bottom) return true;
    return false;
  }

  itemsOverlaps(item1: Item, item2: Item): boolean {
    if (this.itemsOnTheSameLevel(item1, item2)) {
      if (item2.time.start >= item1.time.start && item2.time.start <= item1.time.end) return true;
      if (item2.time.end >= item1.time.start && item2.time.end <= item1.time.end) return true;
      if (item2.time.start >= item1.time.start && item2.time.end <= item1.time.end) return true;
      if (item2.time.start <= item1.time.start && item2.time.end >= item1.time.end) return true;
      return false;
    }
    return false;
  }

  itemOverlapsWithOthers(item: Item, items: Item[]): Item {
    for (let i = 0, len = items.length; i < len; i++) {
      const item2 = items[i];
      const nonZeroTime = item2.time.start && item.time.start && item2.time.end && item.time.end;
      if (item.id !== item2.id && this.itemsOverlaps(item, item2) && nonZeroTime) return item2;
    }
    return null;
  }

  fixOverlappedItems(rowItems: Item[]) {
    if (rowItems.length === 0) return;
    let index = 0;
    for (let item of rowItems) {
      item.$data.position.top = item.top;
      item.$data.position.actualTop = item.$data.position.top + item.gap.top;
      let overlaps = this.itemOverlapsWithOthers(item, rowItems);
      if (index && overlaps) {
        while ((overlaps = this.itemOverlapsWithOthers(item, rowItems))) {
          item.$data.position.top += overlaps.$data.outerHeight;
          item.$data.position.actualTop = item.$data.position.top + item.gap.top;
        }
      }
      index++;
    }
  }

  sortItemsByPositionTop(rowItems: Item[]): Item[] {
    return rowItems.sort((itemA, itemB) => {
      return itemA.$data.position.top - itemB.$data.position.top;
    });
  }

  recalculateRowHeight(row: Row, fixOverlapped = false): number {
    let actualHeight = 0;
    if (fixOverlapped) {
      this.fixOverlappedItems(row.$data.items);
      row.$data.items = this.sortItemsByPositionTop(row.$data.items);
    }
    for (const item of row.$data.items) {
      actualHeight = Math.max(actualHeight, item.$data.position.top + item.$data.outerHeight);
    }
    if (actualHeight < row.height) actualHeight = row.height;
    row.$data.actualHeight = actualHeight;
    row.$data.outerHeight = row.$data.actualHeight + row.gap.top + row.gap.bottom;
    return row.$data.outerHeight;
  }

  recalculateRowsHeightsAndFixOverlappingItems(rows: Row[]): number {
    let top = 0;
    for (const row of rows) {
      this.recalculateRowHeight(row, true);
      row.$data.position.top = top;
      top += row.$data.outerHeight;
    }
    return top;
  }

  recalculateRowsPercents(rows: Row[], verticalAreaHeight: number): Row[] {
    let top = 0;
    for (const row of rows) {
      if (verticalAreaHeight <= 0) {
        row.$data.position.topPercent = 0;
        row.$data.position.bottomPercent = 0;
      } else {
        row.$data.position.topPercent = top ? top / verticalAreaHeight : 0;
        row.$data.position.bottomPercent = (top + row.$data.outerHeight) / verticalAreaHeight;
      }
      top += row.$data.outerHeight;
    }
    return rows;
  }

  generateParents(rows, parentName = 'parentId') {
    const parents = {};
    for (const rowId in rows) {
      const row = rows[rowId];
      const parentId = row[parentName] !== undefined && row[parentName] !== null ? row[parentName] : '';
      if (parents[parentId] === undefined) {
        parents[parentId] = {};
      }
      parents[parentId][row.id] = row;
    }
    return parents;
  }

  fastTree(rowParents, node, parents = []) {
    const children = rowParents[node.id];
    node.$data.parents = parents;
    if (typeof children === 'undefined') {
      node.$data.children = [];
      return node;
    }
    if (node.id !== '') {
      parents = [...parents, node.id];
    }
    node.$data.children = Object.values(children);
    for (const childrenId in children) {
      const child = children[childrenId];
      this.fastTree(rowParents, child, parents);
    }
    return node;
  }

  makeTreeMap(rows: Rows, items: Items) {
    const itemParents = this.generateParents(items, 'rowId');
    for (const rowId in rows) {
      if (!rows[rowId].$data) return;
      rows[rowId].$data.items = itemParents[rowId] !== undefined ? Object.values(itemParents[rowId]) : [];
    }
    const rowParents = this.generateParents(rows);
    const tree = { id: '', $data: { children: [], parents: [], items: [] } };
    return this.fastTree(rowParents, tree);
  }

  getRowsWithParentsExpanded(rows: Rows) {
    const rowsWithParentsExpanded = [];
    next: for (const rowId in rows) {
      if (!rows[rowId].$data || !rows[rowId].$data.parents) return [];
      for (const parentId of rows[rowId].$data.parents) {
        const parent = rows[parentId];
        if (!parent || !parent.expanded) {
          continue next;
        }
      }
      rowsWithParentsExpanded.push(rows[rowId]);
    }
    return rowsWithParentsExpanded;
  }

  getVisibleRows(rowsWithParentsExpanded: Row[]): Row[] {
    if (rowsWithParentsExpanded.length === 0) return [];
    const visibleRows = [];
    const verticalScroll = this.state.get('config.scroll.vertical');
    let topRow = verticalScroll.data;
    if (!topRow) topRow = rowsWithParentsExpanded[0];
    let innerHeight = this.state.get('$data.innerHeight');
    if (!innerHeight) return [];
    innerHeight += verticalScroll.offset || 0;
    let strictTopRow = rowsWithParentsExpanded.find((row) => row.id === topRow.id);
    let index = rowsWithParentsExpanded.indexOf(strictTopRow);
    if (index === undefined) return [];
    let currentRowsOffset = 0;
    for (let len = rowsWithParentsExpanded.length; index <= len; index++) {
      const row = rowsWithParentsExpanded[index];
      if (row === undefined) continue;
      if (currentRowsOffset <= innerHeight) {
        row.$data.position.viewTop = currentRowsOffset;
        visibleRows.push(row);
      }
      currentRowsOffset += row.$data.outerHeight;
      if (currentRowsOffset >= innerHeight) {
        break;
      }
    }
    return visibleRows;
  }

  normalizeMouseWheelEvent(event: MouseWheelEvent): WheelResult {
    let x = event.deltaX || 0;
    let y = event.deltaY || 0;
    let z = event.deltaZ || 0;
    const mode = event.deltaMode;
    const lineHeight = this.state.get('config.list.rowHeight');
    let scale = 1;
    switch (mode) {
      case 1:
        if (lineHeight) {
          scale = lineHeight;
        }
        break;
      case 2:
        // @ts-ignore
        scale = window.height;
        break;
    }
    x *= scale;
    y *= scale;
    z *= scale;
    return { x, y, z, event };
  }

  scrollToTime(toTime: number, centered = true, time: DataChartTime = this.state.get('$data.chart.time')): number {
    if (centered) {
      const chartWidth = this.state.get('$data.chart.dimensions.width');
      const halfChartTime = (chartWidth / 2) * time.timePerPixel;
      toTime = toTime - halfChartTime;
    }
    const data = this.time.findDateAtTime(toTime, time.allDates[time.level]);
    let dataIndex = time.allDates[time.level].indexOf(data);
    if (dataIndex === -1) return 0;
    return this.setScrollLeft(dataIndex, time).posPx;
  }

  setScrollLeft(
    dataIndex: number | undefined,
    time: DataChartTime = this.state.get('$data.chart.time'),
    multi = undefined,
    recalculateTimesLastReason = 'scroll'
  ) {
    if (dataIndex === undefined) {
      dataIndex = 0;
    }
    let hadMulti = true;
    if (multi === undefined) {
      hadMulti = false;
      multi = this.state.multi();
    }
    const allDates = time.allDates[time.level];
    if (!allDates) return;
    const date: DataChartTimeLevelDate = allDates[dataIndex];
    if (!date) return;
    let result;
    multi = multi.update('config.scroll.horizontal', (scrollHorizontal: ScrollTypeHorizontal) => {
      scrollHorizontal.data = { ...date };
      const max = time.allDates[time.level].length - scrollHorizontal.lastPageCount;
      if (dataIndex > max) {
        dataIndex = max;
      }
      scrollHorizontal.dataIndex = dataIndex;
      scrollHorizontal.posPx = this.time.calculateScrollPosPxFromTime(
        scrollHorizontal.data.leftGlobal,
        time,
        scrollHorizontal
      );
      const maxPos = scrollHorizontal.maxPosPx - scrollHorizontal.innerSize;
      if (scrollHorizontal.posPx > maxPos) scrollHorizontal.posPx = maxPos;
      result = scrollHorizontal;
      return scrollHorizontal;
    });
    if (recalculateTimesLastReason) {
      multi = multi.update('$data.chart.time.recalculateTimesLastReason', recalculateTimesLastReason);
    }
    if (hadMulti) return multi;
    multi.done();
    return result;
  }

  getScrollLeft(): ScrollTypeHorizontal {
    return this.state.get('config.scroll.horizontal');
  }

  setScrollTop(dataIndex: number | undefined, offset: number = 0) {
    if (dataIndex === undefined) {
      dataIndex = 0;
    }
    const rows: Row[] = this.state.get('$data.list.rowsWithParentsExpanded');
    if (!rows[dataIndex] && dataIndex !== 0) dataIndex = 0;
    if (!rows[dataIndex]) return;
    this.state.update('config.scroll.vertical', (scrollVertical: ScrollTypeVertical) => {
      const lastItemIndex = rows.length - scrollVertical.lastPageCount;
      if (dataIndex + scrollVertical.lastPageCount > rows.length) {
        dataIndex = lastItemIndex;
      }
      if (dataIndex === lastItemIndex) {
        offset = 0;
      }
      scrollVertical.data = rows[dataIndex];
      scrollVertical.offset = offset;
      scrollVertical.posPx =
        rows[dataIndex].$data.position.topPercent * scrollVertical.maxPosPx +
        Math.floor(scrollVertical.scrollArea * (offset / scrollVertical.area));
      scrollVertical.dataIndex = dataIndex;
      return scrollVertical;
    });
  }

  getScrollTop(): ScrollTypeVertical {
    return this.state.get('config.scroll.vertical');
  }

  getSVGIconSrc(svg) {
    if (typeof this.iconsCache[svg] === 'string') return this.iconsCache[svg];
    this.iconsCache[svg] = 'data:image/svg+xml;base64,' + btoa(svg);
    return this.iconsCache[svg];
  }

  /**
   * Destroy things to release memory
   */
  destroy() {
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes = [];
    if (this.debug) {
      // @ts-ignore
      delete window.state;
    }
  }
}
