/**
 * ItemMovement plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import { PluginData as SelectionPluginData } from './selection.plugin';
import { Item, DataChartTime, Vido, Row, Rows } from '../gstc';
import { ITEM, Point } from './timeline-pointer.plugin';
import { Dayjs } from 'dayjs';
import { Api } from '../api/api';
import DeepState from 'deep-state-observer';
import { mergeDeep } from '@neuronet.io/vido/src/helpers';

export interface SnapArg {
  item: Item;
  time: DataChartTime;
  vido: Vido;
  movement: Movement;
}

export interface SnapStartArg extends SnapArg {
  startTime: Dayjs;
}

export interface SnapEndArg extends SnapArg {
  endTime: Dayjs;
}

export interface SnapToTime {
  start?: (snapStartArgs: SnapStartArg) => Dayjs;
  end?: (snapEndArgs: SnapEndArg) => Dayjs;
}

export interface BeforeAfterInitialItems {
  initial: Item[];
  before: Item[];
  after: Item[];
  targetData: Item;
}

export interface OnArg {
  items: BeforeAfterInitialItems;
  vido: Vido;
  state: DeepState;
  time: DataChartTime;
}

export interface Events {
  onStart?: (onArg: OnArg) => Item[];
  onMove?: (onArg: OnArg) => Item[];
  onEnd?: (onArg: OnArg) => Item[];
}

export interface Options {
  enabled?: boolean;
  className?: string;
  bodyClass?: string;
  bodyClassMoving?: string;
  events?: Events;
  snapToTime?: SnapToTime;
  debug?: boolean;
}

export interface MovementResult {
  horizontal: number;
  vertical: number;
}

export interface Movement {
  px: MovementResult;
  time: number;
}

export interface LastMovement {
  x: number;
  y: number;
  time: number;
}

export interface PluginData extends Options {
  moving: Item[];
  targetData: Item | null;
  initialItems: Item[];
  movement: Movement;
  lastMovement: LastMovement;
  position: Point;
  pointerState: 'up' | 'down' | 'move';
  state: State;
  pointerMoved: boolean;
}

export interface MovingTimes {
  startTime: Dayjs;
  endTime: Dayjs;
}

export type State = '' | 'start' | 'end' | 'move' | '';

export interface Cumulation {
  start: number;
  end: number;
}

export interface Cumulations {
  [key: string]: Cumulation;
}

export interface RelativeVerticalPosition {
  [key: string]: number;
}

function prepareOptions(options: Options): Options {
  return {
    enabled: true,
    className: '',
    bodyClass: 'gstc-item-movement',
    bodyClassMoving: 'gstc-items-moving',
    ...options
  };
}

const pluginPath = 'config.plugin.ItemMovement';

function generateEmptyPluginData(options: Options): PluginData {
  const events = {
    onStart({ items }) {
      return items.after;
    },
    onMove({ items }) {
      return items.after;
    },
    onEnd({ items }) {
      return items.after;
    }
  };
  const snapToTime = {
    start({ startTime, time }) {
      return startTime.startOf(time.period);
    },
    end({ endTime, time }) {
      return endTime.endOf(time.period);
    }
  };
  const result: PluginData = {
    debug: false,
    moving: [],
    targetData: null,
    initialItems: [],
    pointerState: 'up',
    pointerMoved: false,
    state: '',
    position: { x: 0, y: 0 },
    movement: {
      px: { horizontal: 0, vertical: 0 },
      time: 0
    },
    lastMovement: { x: 0, y: 0, time: 0 },
    events: { ...events },
    snapToTime: { ...snapToTime },
    ...options
  };
  if (options.snapToTime) {
    result.snapToTime = {
      ...snapToTime,
      ...options.snapToTime
    };
  }
  if (options.events) {
    result.events = {
      ...events,
      ...options.events
    };
  }
  return result;
}

class ItemMovement {
  private vido: Vido;
  private api: Api;
  private state: DeepState;
  private onDestroy = [];
  private selection: SelectionPluginData;
  private data: PluginData;
  private cumulations: Cumulations = {};
  private merge: (target: object, source: object) => object;
  private relativeVerticalPosition: RelativeVerticalPosition = {};

  constructor(vido: Vido) {
    this.vido = vido;
    this.api = vido.api;
    this.state = vido.state;
    this.merge = this.state.get('config.merge');
    this.destroy = this.destroy.bind(this);
    this.onDestroy.push(
      this.state.subscribe(pluginPath, data => {
        this.data = data;
        if (!data.enabled) {
          document.body.classList.remove(this.data.bodyClass);
        } else {
          document.body.classList.add(this.data.bodyClass);
        }
      })
    );
    if (!this.data.className) this.data.className = this.api.getClass('chart-timeline-items-row-item--moving');
    this.onSelectionChange = this.onSelectionChange.bind(this);
    this.onDestroy.push(this.state.subscribe('config.plugin.Selection', this.onSelectionChange));
  }

  public destroy() {
    this.onDestroy.forEach(unsub => unsub());
  }

  private updateData() {
    this.state.update(pluginPath, { ...this.data });
  }

  private clearCumulationsForItems() {
    this.cumulations = {};
  }

  private setStartCumulationForItem(item: Item, cumulation: number) {
    if (!this.cumulations[item.id]) {
      this.cumulations[item.id] = { start: 0, end: 0 };
    }
    this.cumulations[item.id].start = cumulation;
  }

  private getStartCumulationForItem(item: Item): number {
    return this.cumulations[item.id]?.start || 0;
  }

  private getItemMovingTimes(item: Item, time: DataChartTime): MovingTimes {
    const horizontal = this.data.movement.px.horizontal;
    const positionLeft = this.api.time.getViewOffsetPxFromDates(item.$data.time.startDate, false, time);
    const x = positionLeft + horizontal + this.getStartCumulationForItem(item);
    const leftGlobal = this.api.time.getTimeFromViewOffsetPx(x, time);
    const startTime = this.data.snapToTime.start({
      startTime: this.api.time.date(leftGlobal),
      item,
      time,
      movement: this.data.movement,
      vido: this.vido
    });
    const snapStartPxDiff = this.api.time.getDatesDiffPx(startTime, this.api.time.date(leftGlobal), time, true);
    this.setStartCumulationForItem(item, snapStartPxDiff);
    const startEndTimeDiff = item.$data.time.endDate.diff(item.$data.time.startDate, 'millisecond');
    // diff could be too much if we are in the middle of european summer time (daylight-saving time)
    const rightGlobal = startTime.add(startEndTimeDiff, 'millisecond').valueOf();
    const rightGlobalDate = this.api.time.date(rightGlobal);
    /* // summer time / daylight saving time bug
    const leftFmt = rightGlobalDate.format('YYYY-MM-DD HH:mm:ss');
    const rightFmt = rightGlobalDate.endOf(time.period).format('YYYY-MM-DD HH:mm:ss');
    if (leftFmt !== rightFmt) {
      console.log('no match', leftFmt, rightFmt);
    }*/
    const endTime = this.data.snapToTime.end({
      endTime: rightGlobalDate,
      item,
      time,
      movement: this.data.movement,
      vido: this.vido
    });
    return { startTime, endTime };
  }

  private findRowAtViewPosition(y: number, currentRow: Row): Row {
    const visibleRowsId: string[] = this.state.get('$data.list.visibleRows');
    const visibleRows: Row[] = this.api.getRows(visibleRowsId);
    for (const row of visibleRows) {
      const rowBottom = row.$data.position.viewTop + row.$data.outerHeight;
      if (row.$data.position.viewTop <= y && rowBottom >= y) return row;
    }
    return currentRow;
  }

  private getItemViewTop(item: Item): number {
    const rows: Rows = this.api.getAllRows();
    const row = rows[item.rowId];
    return row.$data.position.viewTop + item.$data.position.actualTop;
  }

  private saveItemsRelativeVerticalPosition() {
    for (const item of this.data.moving) {
      const relativePosition = this.data.position.y - this.getItemViewTop(item);
      this.setItemRelativeVerticalPosition(item, relativePosition);
    }
  }

  private setItemRelativeVerticalPosition(item: Item, relativePosition: number) {
    this.relativeVerticalPosition[item.id] = relativePosition;
  }

  private getItemRelativeVerticalPosition(item: Item): number {
    return this.relativeVerticalPosition[item.id];
  }

  private moveItemVertically(item: Item): Row {
    const rows: Rows = this.api.getAllRows();
    const currentRow: Row = rows[item.rowId];
    const relativePosition = this.getItemRelativeVerticalPosition(item);
    const itemShouldBeAt = this.data.position.y + relativePosition;
    return this.findRowAtViewPosition(itemShouldBeAt, currentRow);
  }

  private getEventArgument(afterItems: Item[]): OnArg {
    const configItems = this.state.get('config.chart.items');
    const before = [];
    for (const item of afterItems) {
      before.push(this.merge({}, configItems[item.id]) as Item);
    }
    return {
      items: {
        initial: this.data.initialItems,
        before,
        after: afterItems,
        targetData: this.merge({}, this.data.targetData) as Item
      },
      vido: this.vido,
      state: this.state,
      time: this.state.get('$data.chart.time')
    };
  }

  private moveItems() {
    if (!this.data.enabled) return;
    const time: DataChartTime = this.state.get('$data.chart.time');
    const moving = this.data.moving.map(item => this.merge({}, item) as Item);
    if (this.data.debug) console.log('moveItems', moving); // eslint-disable-line no-console
    for (let item of moving) {
      item.rowId = this.moveItemVertically(item).id;
      const newItemTimes = this.getItemMovingTimes(item, time);
      if (newItemTimes.startTime.valueOf() !== item.time.start || newItemTimes.endTime.valueOf() !== item.time.end) {
        item.time.start = newItemTimes.startTime.valueOf();
        item.time.end = newItemTimes.endTime.valueOf();
        item.$data.time.startDate = newItemTimes.startTime;
        item.$data.time.endDate = newItemTimes.endTime;
      }
    }
    this.dispatchEvent('onMove', moving);
  }

  private clearSelection() {
    this.data.moving = [];
    this.data.initialItems = [];
    this.data.movement.px.horizontal = 0;
    this.data.movement.px.vertical = 0;
    this.data.movement.time = 0;
    this.data.pointerState = 'up';
    this.data.pointerMoved = false;
  }

  private dispatchEvent(type: 'onStart' | 'onMove' | 'onEnd', items: Item[]) {
    items = items.map(item => this.merge({}, item) as Item);
    const modified = this.data.events[type](this.getEventArgument(items));
    let multi = this.state.multi();
    for (const item of modified) {
      multi = multi.update(`config.chart.items.${item.id}`, currentItem => {
        // items should be always references - we cannot make a copy of the object because it may lead us to troubles
        mergeDeep(currentItem, item);
        return currentItem;
      });
    }
    multi.done();
    this.data.moving = modified;
  }

  private onStart() {
    this.data.initialItems = this.data.moving.map(item => this.merge({}, item) as Item);
    this.clearCumulationsForItems();
    document.body.classList.add(this.data.bodyClassMoving);
    this.data.position = { ...this.selection.currentPosition };
    this.data.lastMovement.time = this.data.moving[0].time.start;
    this.saveItemsRelativeVerticalPosition();
    const initial = this.data.initialItems.map(item => this.merge({}, item) as Item);
    this.dispatchEvent('onStart', initial);
  }

  private onEnd() {
    const moving = this.data.moving.map(item => this.merge({}, item) as Item);
    this.dispatchEvent('onEnd', moving);
    document.body.classList.remove(this.data.bodyClassMoving);
    this.clearSelection();
    this.clearCumulationsForItems();
  }

  private onSelectionChange(data: SelectionPluginData) {
    if (!this.data.enabled) return;
    this.selection = { ...data };
    if (this.selection.targetType !== ITEM) {
      return this.clearSelection();
    }

    if (this.data.pointerState === 'up' && this.selection.pointerState === 'down') {
      this.data.state = 'start';
    } else if (
      (this.data.pointerState === 'down' || this.data.pointerState === 'move') &&
      this.selection.pointerState === 'up'
    ) {
      this.data.state = 'end';
    } else if (this.selection.pointerState === 'move') {
      this.data.state = 'move';
    } else {
      this.data.state = '';
      return this.updateData();
    }

    if (this.selection.events.move) {
      this.selection.events.move.preventDefault();
      this.selection.events.move.stopPropagation();
    }
    if (this.selection.events.down) {
      this.selection.events.down.preventDefault();
      this.selection.events.down.stopPropagation();
    }

    this.data.pointerState = this.selection.pointerState;
    this.data.targetData = { ...this.selection.targetData };

    if (this.data.state === 'end') this.onEnd(); // before this.selection.selected[ITEM] clear

    this.data.moving = this.selection.selected[ITEM].map(item => this.merge({}, item) as Item);
    if (this.data.debug) console.log('state', this.data.pointerState); // eslint-disable-line no-console

    if (this.data.state === 'start') this.onStart();

    if (this.data.state === 'move' || this.data.state === 'start') {
      this.data.lastMovement.x = this.data.movement.px.horizontal;
      this.data.lastMovement.y = this.data.movement.px.vertical;
      this.data.movement.px.horizontal = this.selection.currentPosition.x - this.data.position.x;
      this.data.movement.px.vertical = this.selection.currentPosition.y - this.data.position.y;
      this.data.movement.time = this.data.moving[0].time.start - this.data.lastMovement.time;
      this.data.position.x = this.selection.currentPosition.x;
      this.data.position.y = this.selection.currentPosition.y;
      this.data.lastMovement.time = this.data.moving[0].time.start;
    }

    if (
      this.data.state === 'move' &&
      this.data.lastMovement.x === this.data.movement.px.horizontal &&
      this.data.lastMovement.y === this.data.movement.px.vertical
    ) {
      // prevent movement if there is no movement... (performance optimization)
      return this.updateData();
    }

    if (this.data.state === 'move') this.moveItems();
    this.updateData();
  }
}

export function Plugin(options: Options = {}) {
  return function initialize(vidoInstance: Vido) {
    const currentOptions = vidoInstance.state.get(pluginPath);
    if (currentOptions) {
      options = mergeDeep({}, options, currentOptions);
    }
    vidoInstance.state.update(pluginPath, generateEmptyPluginData(prepareOptions(options)));
    const itemMovement = new ItemMovement(vidoInstance);
    return itemMovement.destroy;
  };
}
