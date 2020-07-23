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
  GridCell,
  GridRows,
  GridRow,
  GridCells,
  DataItems,
  ItemData,
  ItemDataUpdate,
  ChartTime,
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
  if (appendix) return `${simple} ${simple}--${appendix.replace(':', '-')}`;
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
  return (this.state = new State(prepareState(userConfig), {
    delimeter: '.',
    maxSimultaneousJobs: 1000,
    Promise: userConfig.Promise,
  }));
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
  public plugins: any = {};
  private iconsCache: IconsCache = {};
  private unsubscribes: Unsubscribes = [];

  constructor(state: DeepState) {
    this.state = state;
    this.time = new Time(this.state, this);
    this.unsubscribes.push(this.state.subscribe('config.debug', (dbg) => (this.debug = dbg)));
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

  private getActions(name: string) {
    if (!this.allActions.includes(name)) this.allActions.push(name);
    let actions = this.state.get('config.actions.' + name);
    if (typeof actions === 'undefined') {
      actions = [];
    }
    return actions.slice();
  }

  public isItemInViewport(item: Item, leftGlobal: number = undefined, rightGlobal: number = undefined) {
    if (!leftGlobal || !rightGlobal) {
      const time: ChartTime = this.state.get('config.chart.time');
      leftGlobal = time.leftGlobal;
      rightGlobal = time.rightGlobal;
    }
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

  public getRow(rowId: string): Row {
    return this.state.get(`config.list.rows.${rowId}`) as Row;
  }

  public getRows(rowsId: string[]): Row[] {
    if (!rowsId.length) return [];
    const configRows: Rows = this.getAllRows();
    const rows = [];
    for (const rowId of rowsId) {
      if (configRows[rowId]) rows.push(configRows[rowId]);
    }
    return rows;
  }

  public getAllRows(): Rows {
    return this.state.get('config.list.rows');
  }

  public getItem(itemId: string): Item {
    return this.state.get(`config.chart.items.${itemId}`) as Item;
  }

  public getItems(itemsId: string[] = []): Item[] {
    if (!itemsId.length) return Object.values(this.getAllItems());
    const items = [];
    const configItems: Items = this.getAllItems();
    for (const itemId of itemsId) {
      if (configItems[itemId]) items.push(configItems[itemId]);
    }
    return items;
  }

  public getAllItems(): Items {
    return this.state.get('config.chart.items');
  }

  public getItemData(itemId: string): ItemData {
    return this.state.get(`$data.chart.items.${itemId}`);
  }

  public getItemsData(): DataItems {
    return this.state.get(`$data.chart.items`);
  }

  public setItemData(itemId: string, data: ItemDataUpdate) {
    this.state.update(`$data.chart.items.${itemId}`, (currentData: ItemData) => {
      for (const key in data) {
        currentData[key] = data[key];
      }
      return currentData;
    });
  }

  public setItemsData(data: DataItems) {
    this.state.update('$data.chart.items', data);
  }

  private prepareLinkedItems(item: Item, items: Items) {
    const allLinkedIds = this.getAllLinkedItemsIds(item, items);
    for (const linkedItemId of allLinkedIds) {
      const linkedItem = items[linkedItemId];
      if (!linkedItem) throw new Error(`Linked item not found [id:'${linkedItemId}'] found in item [id:'${item.id}']`);
      linkedItem.linkedWith = allLinkedIds.filter((linkedItemId) => linkedItemId !== linkedItem.id);
    }
  }

  private prepareItems(items: Items) {
    const defaultItemHeight = this.state.get('config.chart.item.height');
    const itemsData = this.getItemsData();
    for (let itemId in items) {
      const item = items[itemId];
      itemId = String(itemId);
      item.id = itemId;
      if (itemsData[itemId]) return items; // do not iterate whole items if $data is present
      this.prepareLinkedItems(item, items);
      item.time.start = +item.time.start;
      item.time.end = +item.time.end;
      item.id = String(item.id);
      const defaultItem: DefaultItem = this.state.get('config.chart.item');
      if (typeof item.height !== 'number') item.height = defaultItemHeight;
      if (!itemsData[item.id])
        itemsData[item.id] = {
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
      itemsData[item.id].time = {
        startDate: this.time.date(item.time.start),
        endDate: this.time.date(item.time.end),
      };
      itemsData[item.id].actualHeight = item.height;
      if (typeof item.top !== 'number') item.top = 0;
      if (!item.gap) item.gap = {};
      if (typeof item.gap.top !== 'number') item.gap.top = defaultItem.gap.top;
      if (typeof item.gap.bottom !== 'number') item.gap.bottom = defaultItem.gap.bottom;
      if (typeof item.minWidth !== 'number') item.minWidth = defaultItem.minWidth;
      itemsData[item.id].outerHeight = itemsData[item.id].actualHeight + item.gap.top + item.gap.bottom;
      itemsData[item.id].position.actualTop = itemsData[item.id].position.top + item.gap.top;
    }
    this.setItemsData(itemsData);
    return items;
  }

  private fillEmptyRowValues(rows: Rows) {
    const defaultHeight = this.state.get('config.list.row.height');
    let top = 0;
    for (let rowId in rows) {
      const row = rows[rowId];
      rowId = String(rowId);
      row.id = rowId;
      if (row.$data) return rows; // do not iterate whole tree when $data is present
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

  private itemsOnTheSameLevel(item1: Item, item2: Item) {
    const item1Data = this.getItemData(item1.id);
    const item2Data = this.getItemData(item2.id);
    const item1Bottom = item1Data.position.top + item1Data.outerHeight;
    const item2Bottom = item2Data.position.top + item2Data.outerHeight;
    if (item2Data.position.top <= item1Data.position.top && item2Bottom > item1Data.position.top) return true;
    if (item2Data.position.top >= item1Data.position.top && item2Data.position.top < item1Bottom) return true;
    if (item2Data.position.top >= item1Data.position.top && item2Bottom < item1Bottom) return true;
    return false;
  }

  private itemsOverlaps(item1: Item, item2: Item): boolean {
    if (this.itemsOnTheSameLevel(item1, item2)) {
      if (item2.time.start >= item1.time.start && item2.time.start <= item1.time.end) return true;
      if (item2.time.end >= item1.time.start && item2.time.end <= item1.time.end) return true;
      if (item2.time.start >= item1.time.start && item2.time.end <= item1.time.end) return true;
      if (item2.time.start <= item1.time.start && item2.time.end >= item1.time.end) return true;
      return false;
    }
    return false;
  }

  private itemOverlapsWithOthers(item: Item, items: Item[]): Item {
    for (let i = 0, len = items.length; i < len; i++) {
      const item2 = items[i];
      const nonZeroTime = item2.time.start && item.time.start && item2.time.end && item.time.end;
      if (item.id !== item2.id && this.itemsOverlaps(item, item2) && nonZeroTime) return item2;
    }
    return null;
  }

  private fixOverlappedItems(rowItems: Item[]) {
    if (rowItems.length === 0) return;
    let index = 0;
    for (let item of rowItems) {
      const itemData = this.getItemData(item.id);
      itemData.position.top = item.top;
      itemData.position.actualTop = itemData.position.top + item.gap.top;
      let overlaps = this.itemOverlapsWithOthers(item, rowItems);
      if (index && overlaps) {
        const overlapsData = this.getItemData(overlaps.id);
        while ((overlaps = this.itemOverlapsWithOthers(item, rowItems))) {
          itemData.position.top += overlapsData.outerHeight;
          itemData.position.actualTop = itemData.position.top + item.gap.top;
        }
      }
      this.setItemData(item.id, itemData);
      index++;
    }
  }

  private recalculateRowHeight(row: Row, fixOverlapped = false): number {
    if (!row.$data) return 0;
    let actualHeight = 0;
    if (fixOverlapped) {
      const rowItems = this.getItems(row.$data.items);
      this.fixOverlappedItems(rowItems);
      row.$data.items = rowItems.map((item) => item.id);
    }
    const itemsData = this.getItemsData();
    for (const item of this.getItems(row.$data.items)) {
      const itemData = itemsData[item.id];
      actualHeight = Math.max(actualHeight, itemData.position.top + itemData.outerHeight);
    }
    if (actualHeight < row.height) actualHeight = row.height;
    row.$data.actualHeight = actualHeight;
    row.$data.outerHeight = row.$data.actualHeight + row.gap.top + row.gap.bottom;
    return row.$data.outerHeight;
  }

  private recalculateRowsHeightsAndFixOverlappingItems(rowsId: string[]): number {
    let top = 0;
    const rows: Rows = this.getAllRows();
    for (const rowId of rowsId) {
      const row = rows[rowId];
      this.recalculateRowHeight(row, true);
      row.$data.position.top = top;
      top += row.$data.outerHeight;
    }
    return top;
  }

  private recalculateRowsPercents(rowsId: string[], verticalAreaHeight: number) {
    let top = 0;
    const rows: Rows = this.getAllRows();
    for (const rowId of rowsId) {
      const row = rows[rowId];
      if (verticalAreaHeight <= 0) {
        row.$data.position.topPercent = 0;
        row.$data.position.bottomPercent = 0;
      } else {
        row.$data.position.topPercent = top ? top / verticalAreaHeight : 0;
        row.$data.position.bottomPercent = (top + row.$data.outerHeight) / verticalAreaHeight;
      }
      top += row.$data.outerHeight;
    }
  }

  private generateParents(rows: Rows | Items, parentName = 'parentId') {
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

  private fastTree(rowParents, node, parents = []) {
    const children = rowParents[node.id];
    node.$data.parents = parents;
    if (typeof children === 'undefined') {
      node.$data.children = [];
      return node;
    }
    if (node.id !== '') {
      parents = [...parents, node.id];
    }
    node.$data.children = Object.values(children).map((child: Item | Row) => child.id);
    for (const childrenId in children) {
      const child = children[childrenId];
      this.fastTree(rowParents, child, parents);
    }
    return node;
  }

  private makeTreeMap(rows: Rows, items: Items) {
    const itemParents: Items = this.generateParents(items, 'rowId');
    for (const rowId in rows) {
      if (!rows[rowId].$data) return;
      rows[rowId].$data.items.length = 0;
      if (itemParents[rowId] !== undefined) {
        for (const parent of Object.values(itemParents[rowId])) {
          rows[rowId].$data.items.push(parent.id);
        }
      }
    }
    const rowParents = this.generateParents(rows);
    const tree = { id: '', $data: { children: [], parents: [], items: [] } };
    return this.fastTree(rowParents, tree);
  }

  private getRowsWithParentsExpanded(rows: Rows) {
    const rowsWithParentsExpanded = [];
    next: for (const rowId in rows) {
      if (!rows[rowId].$data || !rows[rowId].$data.parents) return [];
      for (const parentId of rows[rowId].$data.parents) {
        const parent = rows[parentId];
        if (!parent || !parent.expanded) {
          continue next;
        }
      }
      rowsWithParentsExpanded.push(rowId);
    }
    return rowsWithParentsExpanded;
  }

  private getVisibleRows(rowsWithParentsExpanded: string[]): string[] {
    if (this.debug) console.log('getVisibleRows #1', { rowsWithParentsExpanded }); // eslint-disable-line no-console
    if (rowsWithParentsExpanded.length === 0) return [];
    const visibleRows = [];
    const verticalScroll = this.state.get('config.scroll.vertical');
    let topRow = verticalScroll.data;
    if (this.debug) console.log('getVisibleRows #2', { topRow }); // eslint-disable-line no-console
    if (!topRow) topRow = rowsWithParentsExpanded[0];
    let innerHeight = this.state.get('$data.innerHeight');
    if (this.debug) console.log('getVisibleRows #3', { innerHeight }); // eslint-disable-line no-console
    if (!innerHeight) return [];
    const rows: Rows = this.getAllRows();
    innerHeight += verticalScroll.offset || 0;
    let strictTopRow = rowsWithParentsExpanded.find((rowId) => rowId === topRow.id);
    let index = rowsWithParentsExpanded.indexOf(strictTopRow);
    if (this.debug) console.log('getVisibleRows #4', { index }); // eslint-disable-line no-console
    if (index === undefined) return [];
    let currentRowsOffset = 0;
    for (let len = rowsWithParentsExpanded.length; index < len; index++) {
      const rowId = rowsWithParentsExpanded[index];
      const row = rows[rowId];
      if (!row || !row.$data) {
        if (this.debug) console.log('getVisibleItems NO-ROW', { row, rowId, rows, index, rowsWithParentsExpanded }); // eslint-disable-line no-console
        return [];
      }
      if (currentRowsOffset <= innerHeight) {
        row.$data.position.viewTop = currentRowsOffset;
        visibleRows.push(row.id);
      }
      currentRowsOffset += row.$data.outerHeight;
      if (currentRowsOffset >= innerHeight) {
        break;
      }
    }
    if (this.debug) console.log('getVisibleRows #5 final', { visibleRows, innerHeight, topRow, index }); // eslint-disable-line no-console
    return visibleRows;
  }

  private normalizeMouseWheelEvent(event: MouseWheelEvent): WheelResult {
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

  public scrollToTime(
    toTime: number,
    centered = true,
    time: DataChartTime = this.state.get('$data.chart.time')
  ): number {
    if (!time.allDates) return 0;
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

  public setScrollLeft(
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

  public getScrollLeft(): ScrollTypeHorizontal {
    return this.state.get('config.scroll.horizontal');
  }

  public setScrollTop(dataIndex: number | undefined, offset: number = 0) {
    if (dataIndex === undefined) {
      dataIndex = 0;
    }
    const rowsId: string[] = this.state.get('$data.list.rowsWithParentsExpanded');
    const rows = this.getRows(rowsId);
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

  public getScrollTop(): ScrollTypeVertical {
    return this.state.get('config.scroll.vertical');
  }

  public getGridCells(cellIds: string[] = undefined): GridCell[] {
    const allCells: GridCells = this.state.get('$data.chart.grid.cells');
    if (typeof cellIds !== 'undefined') {
      return allCells ? Object.values(allCells).filter((cell) => cellIds.includes(cell.id)) : [];
    }
    if (!allCells) return [];
    return Object.values(allCells);
  }

  public getGridRows(rowIds: string[] = undefined): GridRow[] {
    const allRows: GridRows = this.state.get('$data.chart.grid.rows');
    if (typeof rowIds !== 'undefined') {
      return allRows ? Object.values(allRows).filter((row) => rowIds.includes(row.row.id)) : [];
    }
    if (!allRows) return [];
    return Object.values(allRows);
  }

  public getGridCell(cellId: string): GridCell {
    return this.state.get(`$data.chart.grid.cells.${cellId}`);
  }

  public getGridRow(rowId: string): GridRow {
    return this.state.get(`$data.chart.grid.rows.${rowId}`);
  }

  private getSVGIconSrc(svg) {
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
