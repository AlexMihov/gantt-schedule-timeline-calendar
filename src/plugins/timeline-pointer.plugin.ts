/**
 * TimelinePointer plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import DeepState from 'deep-state-observer';
import { Api } from '../api/api';
import { Vido } from '../gstc';
import { mergeDeep } from '@neuronet.io/vido/src/helpers';

export const CELL = 'chart-timeline-grid-row-cell';
export type CELL_TYPE = 'chart-timeline-grid-row-cell';
export const ITEM = 'chart-timeline-items-row-item';
export type ITEM_TYPE = 'chart-timeline-items-row-item';
export type SELECTION_TYPE = typeof CELL | typeof ITEM;

export interface PointerEvents {
  down: PointerEvent | null;
  move: PointerEvent | null;
  up: PointerEvent | null;
}

export interface Point {
  x: number;
  y: number;
}

export type PointerState = 'up' | 'down' | 'move';

export interface CaptureEvents {
  up?: boolean;
  down?: boolean;
  move?: boolean;
}

export interface Options {
  enabled?: boolean;
  captureEvents?: CaptureEvents;
}

export interface Offset {
  top: number;
  left: number;
}

export interface PluginData extends Options {
  isMoving: boolean;
  pointerState: PointerState;
  currentTarget: HTMLElement | null;
  realTarget: HTMLElement | null;
  targetType: ITEM_TYPE | CELL_TYPE | '';
  targetData: any | null;
  events: PointerEvents;
  offset: Offset;
  initialPosition: Point;
  currentPosition: Point;
}

function generateEmptyData(options: Options = {}): PluginData {
  const result: PluginData = {
    enabled: true,
    isMoving: false,
    pointerState: 'up',
    currentTarget: null,
    realTarget: null,
    targetType: '',
    targetData: null,
    offset: { top: 0, left: 0 },
    captureEvents: {
      down: false,
      up: false,
      move: false,
    },
    initialPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    events: {
      down: null,
      move: null,
      up: null,
    },
  };
  if (options.captureEvents) {
    result.captureEvents = {
      ...result.captureEvents,
      ...options.captureEvents,
    };
  }
  return result;
}

const pluginPath = 'config.plugin.TimelinePointer';

class TimelinePointer {
  private element: HTMLElement;
  private vido: Vido;
  private api: Api;
  private state: DeepState;
  private data: PluginData;
  private unsub = [];
  private classNames = {
    cell: '',
    item: '',
  };

  constructor(options: Options, vido: Vido) {
    this.vido = vido;
    this.api = vido.api;
    this.state = vido.state;
    this.element = this.state.get(`$data.elements.chart-timeline`);
    this.pointerDown = this.pointerDown.bind(this);
    this.pointerMove = this.pointerMove.bind(this);
    this.pointerUp = this.pointerUp.bind(this);
    this.data = generateEmptyData(options);
    this.classNames.cell = this.api.getClass(CELL);
    this.classNames.item = this.api.getClass(ITEM);
    this.destroy = this.destroy.bind(this);
    this.element.addEventListener('pointerdown', this.pointerDown /*, this.data.captureEvents.down*/);
    document.addEventListener('pointerup', this.pointerUp /*, this.data.captureEvents.up*/);
    document.addEventListener('pointermove', this.pointerMove /*, this.data.captureEvents.move*/);
    this.unsub.push(this.state.subscribe(pluginPath, (value) => (this.data = value)));
    this.unsub.push(
      this.state.subscribe('config.scroll.vertical.offset', (offset) => {
        this.data.offset.left = offset;
        this.updateData();
      })
    );
  }

  public destroy() {
    this.element.removeEventListener('pointerdown', this.pointerDown);
    document.removeEventListener('pointerup', this.pointerUp);
    document.removeEventListener('pointermove', this.pointerMove);
  }

  private updateData() {
    this.state.update(pluginPath, () => ({ ...this.data }));
  }

  private getRealTarget(ev: PointerEvent) {
    let realTarget: HTMLElement = (ev.target as HTMLElement).closest('.' + this.classNames.item) as HTMLElement;
    if (realTarget) {
      return realTarget;
    }
    realTarget = (ev.target as HTMLElement).closest('.' + this.classNames.cell) as HTMLElement;
    if (realTarget) {
      return realTarget;
    }
    return null;
  }

  private getRealPosition(ev: PointerEvent): Point {
    const pos = { x: 0, y: 0 };
    if (this.element) {
      const bounding = this.element.getBoundingClientRect();
      pos.x = ev.x - bounding.x;
      pos.y = ev.y - bounding.y;
      const scrollOffsetTop = this.state.get('config.scroll.vertical.offset') || 0;
      pos.y += scrollOffsetTop;
    }
    return pos;
  }

  private pointerDown(ev: PointerEvent) {
    if (!this.data.enabled) return;
    this.data.pointerState = 'down';
    this.data.currentTarget = ev.target as HTMLElement;
    this.data.realTarget = this.getRealTarget(ev);
    if (this.data.realTarget) {
      if (this.data.realTarget.classList.contains(this.classNames.item)) {
        this.data.targetType = ITEM;
        // @ts-ignore
        this.data.targetData = this.data.realTarget.vido.item;
      } else if (this.data.realTarget.classList.contains(this.classNames.cell)) {
        this.data.targetType = CELL;
        // @ts-ignore
        this.data.targetData = this.data.realTarget.vido;
      } else {
        this.data.targetType = '';
      }
    } else {
      this.data.targetType = '';
      this.data.targetData = null;
    }
    this.data.isMoving = !!this.data.realTarget;
    this.data.events.down = ev;
    this.data.events.move = ev;
    const realPosition = this.getRealPosition(ev);
    this.data.initialPosition = realPosition;
    this.data.currentPosition = realPosition;
    this.updateData();
  }

  private pointerUp(ev: PointerEvent) {
    if (!this.data.enabled) return;
    this.data.pointerState = 'up';
    this.data.isMoving = false;
    this.data.events.up = ev;
    this.data.currentPosition = this.getRealPosition(ev);
    this.updateData();
  }

  private pointerMove(ev: PointerEvent) {
    if (!this.data.enabled || !this.data.isMoving) return;
    this.data.pointerState = 'move';
    this.data.events.move = ev;
    this.data.currentPosition = this.getRealPosition(ev);
    this.updateData();
  }
}

export function Plugin(options: Options) {
  return function initialize(vidoInstance: Vido) {
    const currentOptions = vidoInstance.state.get(pluginPath);
    if (currentOptions) {
      options = mergeDeep(mergeDeep({}, options), currentOptions);
    }
    const subs = [];
    const defaultData = generateEmptyData(options);
    // for other plugins that are initialized before elements are saved
    vidoInstance.state.update(pluginPath, defaultData);

    // initialize only if chart element is mounted
    let timelinePointerDestroy;
    subs.push(
      vidoInstance.state.subscribe('$data.elements.chart-timeline', (timelineElement: HTMLElement) => {
        if (timelineElement) {
          if (timelinePointerDestroy) timelinePointerDestroy();
          const timelinePointer = new TimelinePointer(options, vidoInstance);
          timelinePointerDestroy = timelinePointer.destroy;
        }
      })
    );
    return function destroy() {
      subs.forEach((unsub) => unsub());
      if (timelinePointerDestroy) timelinePointerDestroy();
    };
  };
}
