/**
 * Selection plugin
 *
 * @copyright Rafal Pospiech <https://neuronet.io>
 * @author    Rafal Pospiech <neuronet.io@gmail.com>
 * @package   gantt-schedule-timeline-calendar
 * @license   AGPL-3.0 (https://github.com/neuronetio/gantt-schedule-timeline-calendar/blob/master/LICENSE)
 * @link      https://github.com/neuronetio/gantt-schedule-timeline-calendar
 */

import {
  PluginData as TimelinePointerPluginData,
  ITEM,
  ITEM_TYPE,
  CELL,
  CELL_TYPE,
  Point,
  PointerState,
} from './timeline-pointer.plugin';

import { Item, GridCell, Items, Vido, htmlResult, Wrapper, ItemData, GridRow, GridRows, GridCells } from '../gstc';
import DeepState from 'deep-state-observer';
import { Api } from '../api/api';
import { StyleMap, lithtml } from '@neuronet.io/vido/src/vido';
import { mergeDeep } from '@neuronet.io/vido/src/helpers';

export type ModKey = 'shift' | 'ctrl' | 'alt' | '';

export interface Options {
  enabled?: boolean;
  cells?: boolean;
  items?: boolean;
  rows?: boolean;
  showOverlay?: boolean;
  rectangularSelection?: boolean;
  multipleSelection?: boolean;
  selectKey?: ModKey;
  multiKey?: ModKey;
  selectedClassName?: string;
  selectingClassName?: string;
  canSelect?: (type, state, all) => any[];
  canDeselect?: (type, state, all) => any[];
}

export interface SelectionItems {
  [key: string]: Item[];
}

export interface SelectState {
  selecting?: SelectionItems;
  selected?: SelectionItems;
}

function prepareOptions(options: Options) {
  const defaultOptions: Options = {
    enabled: true,
    cells: true,
    items: true,
    rows: false,
    showOverlay: true,
    rectangularSelection: true,
    multipleSelection: true,
    selectedClassName: 'gstc__cell-selected',
    selectingClassName: 'gstc__cell-selecting',
    canSelect(type, currently /*, all*/) {
      return currently;
    },
    canDeselect(/*type, currently, all*/) {
      return [];
    },
  };
  options = { ...defaultOptions, ...options } as Options;
  return options;
}

const pluginPath = 'config.plugin.Selection';

export interface Area {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Selection {
  [ITEM]: string[];
  [CELL]: string[];
}

export interface SelectedCell {
  rowId: string;
  cellId: string;
}

export interface PointerEvents {
  down: PointerEvent | null;
  move: PointerEvent | null;
  up: PointerEvent | null;
}

export interface PluginData extends Options {
  enabled: boolean;
  isSelecting: boolean;
  showOverlay: boolean;
  pointerState: PointerState;
  initialPosition: Point;
  currentPosition: Point;
  selectionAreaLocal: Area;
  selectionAreaGlobal: Area;
  selected: Selection;
  selecting: Selection;
  automaticallySelected: Selection;
  previouslyAutomaticallySelected: Selection;
  events: PointerEvents;
  targetType: ITEM_TYPE | CELL_TYPE | '';
  targetData: any;
}

function generateEmptyData(options: Options): PluginData {
  return {
    enabled: true,
    showOverlay: true,
    isSelecting: false,
    pointerState: 'up',
    selectKey: '',
    multiKey: 'shift',
    multipleSelection: true,
    targetType: '',
    targetData: null,
    initialPosition: { x: 0, y: 0 },
    currentPosition: { x: 0, y: 0 },
    selectionAreaLocal: { x: 0, y: 0, width: 0, height: 0 },
    selectionAreaGlobal: { x: 0, y: 0, width: 0, height: 0 },
    selecting: {
      [ITEM]: [],
      [CELL]: [],
    },
    selected: {
      [ITEM]: [],
      [CELL]: [],
    },
    automaticallySelected: {
      [ITEM]: [],
      [CELL]: [],
    },
    previouslyAutomaticallySelected: {
      [ITEM]: [],
      [CELL]: [],
    },
    events: {
      down: null,
      move: null,
      up: null,
    },
    ...options,
  };
}

class SelectionPlugin {
  private data: PluginData;
  private poitnerData: TimelinePointerPluginData;
  private vido: Vido;
  private state: DeepState;
  private api: Api;
  private onDestroy = [];
  private oldWrapper: Wrapper;
  private html: typeof lithtml.html;
  private wrapperClassName: string;
  private wrapperStyleMap: StyleMap;
  private merge: (target: object, source: object) => object;

  constructor(vido: Vido, options: Options) {
    this.vido = vido;
    this.state = vido.state;
    this.api = vido.api;
    this.merge = this.state.get('config.merge');
    this.state.update(pluginPath, generateEmptyData(options));
    this.data = generateEmptyData(options);
    this.wrapperClassName = this.api.getClass('chart-selection');
    this.wrapperStyleMap = new vido.StyleMap({ display: 'none' });
    this.html = vido.html;
    this.wrapper = this.wrapper.bind(this);
    this.destroy = this.destroy.bind(this);
    this.setWrapper();
    this.onCellCreate = this.onCellCreate.bind(this);
    this.state.update('config.chart.grid.cell.onCreate', (onCreate) => {
      if (!onCreate.includes(this.onCellCreate)) onCreate.push(this.onCellCreate);
      return onCreate;
    });
    this.onDestroy.push(
      this.state.subscribe('config.plugin.TimelinePointer', (timelinePointerData) => {
        this.poitnerData = timelinePointerData;
        this.onPointerData();
      })
    );
    this.updateData();
    this.onDestroy.push(
      this.state.subscribe(pluginPath, (value) => {
        this.data = value;
      })
    );
    this.updateCellSelectionClassName = this.updateCellSelectionClassName.bind(this);
    this.selectedCellAction = this.selectedCellAction.bind(this);
    this.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
      if (!actions.includes(this.selectedCellAction)) actions.push(this.selectedCellAction);
      return actions;
    });
    // watch and update items/cells that are inside selection
    // remove ones that no longer exist
    // for cells we cannot do that because cells are created dynamically
    this.onDestroy.push(
      this.state.subscribe(
        'config.chart.items',
        (items: Items) => {
          this.data.selected[ITEM] = this.data.selected[ITEM].filter((itemId) => !!items[itemId]);
          this.data.selecting[ITEM] = this.data.selecting[ITEM].filter((itemId) => !!items[itemId]);
        },
        {
          ignore: ['$data.chart.items.*.detached', 'config.chart.items.*.selected', 'config.chart.items.*.selecting'],
        }
      )
    );
  }

  private setWrapper() {
    this.state.update('config.wrappers.ChartTimelineItems', (oldWrapper: Wrapper) => {
      if (!this.oldWrapper) this.oldWrapper = oldWrapper;
      return this.wrapper;
    });
  }

  public destroy() {
    this.state.update('config.wrappers.ChartTimelineItems', this.oldWrapper);
    this.state.update('config.actions.chart-timeline-grid-row-cell', (actions) => {
      return actions.filter((action) => action !== this.selectedCellAction);
    });
    this.state.update('config.chart.grid.cell.onCreate', (onCreate) => {
      return onCreate.filter((onCreateFn) => onCreateFn !== this.onCellCreate);
    });
    this.oldWrapper = null;
    this.onDestroy.forEach((unsub) => unsub());
  }

  private updateData() {
    this.state.update(pluginPath, { ...this.data });
    this.vido.update(); // draw selection area overlay
  }

  private modKeyPressed(modKey: ModKey, ev: PointerEvent): boolean {
    switch (modKey) {
      case 'shift':
        return ev.shiftKey;
      case 'alt':
        return ev.altKey;
      case 'ctrl':
        return ev.ctrlKey;
    }
  }

  private canSelect(): boolean {
    let result = this.data.enabled;
    const downEvent = this.poitnerData.events.down;
    if (downEvent && this.data.selectKey) result = result && this.modKeyPressed(this.data.selectKey, downEvent);
    return result;
  }

  private getSelectionAreaLocal(): Area {
    const area = { x: 0, y: 0, width: 0, height: 0 };
    const initial = { ...this.poitnerData.initialPosition };
    const current = { ...this.poitnerData.currentPosition };
    const width = current.x - initial.x;
    const height = current.y - initial.y;
    if (width >= 0) {
      area.x = initial.x;
      area.width = width;
    } else {
      area.x = current.x;
      area.width = Math.abs(width);
    }
    if (height >= 0) {
      area.y = initial.y;
      area.height = height;
    } else {
      area.y = current.y;
      area.height = Math.abs(height);
    }
    return area;
  }

  private translateAreaLocalToGlobal(localArea: Area): Area {
    const leftPx: number = this.state.get('$data.chart.time.leftPx');
    const topPx: number = this.state.get('config.scroll.vertical.posPx');
    return { ...localArea, x: localArea.x + leftPx, y: localArea.y + topPx };
  }

  private collectLinkedItems(item: Item, current: string[] = []): string[] {
    if (item.linkedWith && item.linkedWith.length) {
      const items: Items = this.api.getAllItems();
      for (const linkedItemId of item.linkedWith) {
        const linkedItem: Item = items[linkedItemId];
        if (!current.includes(linkedItem.id)) {
          current.push(linkedItem.id);
          // we don't need to go further because linkedWith property already contains all we need
        }
      }
    }
    return current;
  }

  private getSelected(item: Item): { selected: string[]; automaticallySelected: string[] } {
    let selected: string[];
    let automaticallySelected: string[] = this.data.automaticallySelected[ITEM].slice();
    const linked = this.collectLinkedItems(item, [item.id]);
    if (this.data.selected[ITEM].find((selectedItemId) => selectedItemId === item.id)) {
      // if we want to start movement or something - just return currently selected
      selected = this.data.selected[ITEM];
      if (automaticallySelected.find((autoId) => autoId === item.id)) {
        // item under the pointer was automaticallySelected so we must remove it from here
        // - it is not automaticallySelected right now
        // we need to replace current item with one that is linked but doesn't lay down
        // in automaticallySelected currently - we need to switch them
        // first of all we need to find out which item is linked with current but
        // not inside automaticallySelected
        const actualAutoIds = automaticallySelected;
        const replaceWith = selected.find((selId) => item.linkedWith.includes(selId) && !actualAutoIds.includes(selId));
        automaticallySelected = automaticallySelected.filter((currentItemId) => currentItemId !== item.id);
        automaticallySelected.push(replaceWith);
      } else {
        automaticallySelected = this.data.automaticallySelected[ITEM];
      }
    } else {
      if (this.isMulti()) {
        selected = Array.from(new Set([...this.data.selected[ITEM], ...linked]));
      } else {
        selected = linked;
      }
      automaticallySelected = linked.filter((currentItemId) => currentItemId !== item.id);
    }
    selected = selected.map((itemId) => {
      item = this.api.getItem(itemId);
      item.selected = true;
      return itemId;
    });
    return { selected, automaticallySelected };
  }

  private isItemVerticallyInsideArea(itemData: ItemData, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaBottom = area.y + area.height;
    const itemTop = itemData.position.viewTop;
    const itemBottom = itemTop + itemData.actualHeight;
    return (
      (itemTop >= area.y && itemTop <= areaBottom) ||
      (itemBottom >= area.y && itemBottom <= areaBottom) ||
      (itemTop >= area.y && itemBottom <= areaBottom) ||
      (itemTop <= area.y && itemBottom >= areaBottom)
    );
  }

  private isItemHorizontallyInsideArea(itemData: ItemData, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaRight = area.x + area.width;
    return (
      (itemData.position.actualLeft >= area.x && itemData.position.actualLeft <= areaRight) ||
      (itemData.position.actualRight >= area.x && itemData.position.actualRight <= areaRight) ||
      (itemData.position.actualLeft <= area.x && itemData.position.actualRight >= areaRight) ||
      (itemData.position.actualLeft >= area.x && itemData.position.actualRight <= areaRight)
    );
  }

  private isMulti(): boolean {
    const move = this.poitnerData.events.move;
    return move && this.data.multiKey && this.modKeyPressed(this.data.multiKey, move);
  }

  private getItemsUnderSelectionArea(
    areaLocal: Area
  ): { selectedItems: string[]; automaticallySelectedItems: string[] } {
    const visibleItemsId: string[] = this.state.get('$data.chart.visibleItems');
    const visibleItems: Item[] = this.api.getItems(visibleItemsId);
    let selectedItems = [];
    const automaticallySelectedItems = [];
    for (let item of visibleItems) {
      item = this.merge({}, item) as Item;
      const itemData = this.api.getItemData(item.id);
      if (
        this.isItemVerticallyInsideArea(itemData, areaLocal) &&
        this.isItemHorizontallyInsideArea(itemData, areaLocal)
      ) {
        if (!selectedItems.find((selectedItemId) => selectedItemId === item.id)) selectedItems.push(item.id);
        const linked = this.collectLinkedItems(item, [item.id]);
        for (let linkedItemId of linked) {
          const linkedItem = this.api.getItem(linkedItemId);
          if (!selectedItems.find((selectedItemId) => selectedItemId === linkedItem.id)) {
            selectedItems.push(linkedItem.id);
            automaticallySelectedItems.push(linkedItem.id);
          }
        }
      }
    }
    selectedItems = selectedItems.map((itemId) => {
      const item = this.api.getItem(itemId);
      item.selected = true;
      return itemId;
    });
    return { selectedItems, automaticallySelectedItems };
  }

  private isCellVerticallyInsideArea(cell: GridCell, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaBottom = area.y + area.height;
    const top = cell.top;
    const bottom = top + cell.row.$data.actualHeight;
    return (
      (top >= area.y && top <= areaBottom) ||
      (bottom >= area.y && bottom <= areaBottom) ||
      (top >= area.y && bottom <= areaBottom) ||
      (top <= area.y && bottom >= areaBottom)
    );
  }

  private isCellHorizontallyInsideArea(cell: GridCell, area: Area): boolean {
    if (!area.width || !area.height) return false;
    const areaRight = area.x + area.width;
    const left = cell.time.currentView.leftPx;
    const right = cell.time.currentView.rightPx;
    return (
      (left >= area.x && left <= areaRight) ||
      (right >= area.x && right <= areaRight) ||
      (left <= area.x && right >= areaRight) ||
      (left >= area.x && right <= areaRight)
    );
  }

  private getCellsUnderSelectionArea(areaLocal: Area): { selectedCells: string[] } {
    const cells: GridCells = this.state.get('$data.chart.grid.cells');
    const selectedCells = [];
    for (const cellId in cells) {
      const cell = cells[cellId];
      if (this.isCellVerticallyInsideArea(cell, areaLocal) && this.isCellHorizontallyInsideArea(cell, areaLocal)) {
        if (!selectedCells.find((selectedCell: string) => selectedCell === cell.id)) selectedCells.push(cell.id);
      }
    }
    return { selectedCells };
  }

  private updateItems(multi = undefined) {
    if (!multi) multi = this.state.multi();
    multi = multi.update('config.chart.items.*.selected', false);
    multi = multi.update('config.chart.items.*.selecting', false);
    const itemsId = Array.from(new Set([...this.data.selecting[ITEM], ...this.data.selected[ITEM]]));
    for (const itemId of itemsId) {
      const selecting = this.data.selecting[ITEM].includes(itemId);
      const selected = this.data.selected[ITEM].includes(itemId);
      multi = multi.update(`config.chart.items.${itemId}.selecting`, selecting);
      multi = multi.update(`config.chart.items.${itemId}.selected`, selected);
    }
    return multi;
  }

  private updateCells(multi = undefined) {
    if (!multi) multi = this.state.multi();
    multi.update('$data.chart.grid.cells', (cells: GridCells) => {
      for (const cellId in cells) {
        const cell = cells[cellId];
        cell.selected = this.data.selected[CELL].includes(cell.id);
        cell.selecting = this.data.selecting[CELL].includes(cell.id);
      }
      return cells;
    });
    return multi;
  }

  private deselectItems() {
    this.data.selected[ITEM].length = 0;
    this.data.selecting[ITEM].length = 0;
    this.updateItems();
  }

  private deselectCells() {
    this.data.selecting[CELL].length = 0;
    this.data.selected[CELL].length = 0;
    this.updateCells();
  }

  private selectMultipleCells(multi) {
    const { selectedCells } = this.getCellsUnderSelectionArea(this.data.selectionAreaLocal);
    if (selectedCells.length === 0) {
      this.data.selecting[CELL].length = 0;
      if (!this.isMulti()) this.data.selected[CELL].length = 0;
    } else {
      this.data.selecting[CELL] = selectedCells;
    }
    const allCells: GridCell[] = this.api.getGridCells();
    const currentlySelectingCellsStr = allCells
      .filter((cell) => cell.selecting)
      .map((cell) => cell.id)
      .join('|');
    const selectingCellsStr = this.data.selecting[CELL].join('|');
    if (currentlySelectingCellsStr !== selectingCellsStr) multi = this.updateCells(multi);
    return multi;
  }

  private selectMultipleItems(multi) {
    const { selectedItems, automaticallySelectedItems } = this.getItemsUnderSelectionArea(this.data.selectionAreaLocal);
    this.data.automaticallySelected[ITEM] = automaticallySelectedItems;
    if (selectedItems.length === 0) {
      this.data.selecting[ITEM].length = 0;
      if (this.isMulti()) this.data.selected[ITEM].length = 0;
    } else {
      this.data.selecting[ITEM] = selectedItems;
    }
    const allItems: Item[] = this.api.getItems();
    const currentlySelectingItemsStr = allItems
      .filter((item) => item.selecting)
      .map((item) => item.id)
      .join('|');
    const selectingItemsStr = this.data.selecting[ITEM].join('|');
    if (currentlySelectingItemsStr !== selectingItemsStr) multi = this.updateItems(multi);
    return multi;
  }

  private selectMultipleCellsAndItems() {
    if (!this.canSelect()) return;
    if (!this.data.multipleSelection) {
      this.deselectItems();
      this.deselectCells();
      return;
    }
    this.data.isSelecting = true;
    this.data.selectionAreaLocal = this.getSelectionAreaLocal();
    this.data.selectionAreaGlobal = this.translateAreaLocalToGlobal(this.data.selectionAreaLocal);
    let multi = this.state.multi();
    multi = this.selectMultipleItems(multi);
    multi = this.selectMultipleCells(multi);
    multi.done();
  }

  private selectItemsIndividually() {
    this.data.isSelecting = false;
    this.data.selectionAreaLocal = this.getSelectionAreaLocal();
    this.data.currentPosition = this.poitnerData.currentPosition;
    this.data.initialPosition = this.poitnerData.initialPosition;
    if (!this.canSelect()) return;
    const item: Item = this.merge({}, this.poitnerData.targetData) as Item;
    let { selected, automaticallySelected } = this.getSelected(item);
    if (selected.length > 1 && !this.data.multipleSelection) {
      selected = [item.id];
      automaticallySelected = [];
    }
    this.data.selected[ITEM] = selected;
    this.data.automaticallySelected[ITEM] = automaticallySelected;
    let multi = this.state.multi();
    multi = this.updateItems(multi);
    multi.done();
  }

  private finishSelection() {
    if (this.isMulti()) {
      this.data.selected[CELL] = Array.from(new Set([...this.data.selected[CELL], ...this.data.selecting[CELL]]));
      this.data.selected[ITEM] = Array.from(new Set([...this.data.selected[ITEM], ...this.data.selecting[ITEM]]));
      this.data.selecting[CELL].length = 0;
      this.data.selecting[ITEM].length = 0;
      let multi = this.state.multi();
      multi = this.updateItems(multi);
      multi = this.updateCells(multi);
      multi.done();
      return;
    }
    this.data.selected[CELL] = [...this.data.selecting[CELL]];
    this.data.selected[ITEM] = [...this.data.selecting[ITEM]];
    this.data.selecting[CELL].length = 0;
    this.data.selecting[ITEM].length = 0;
    let multi = this.state.multi();
    multi = this.updateItems(multi);
    multi = this.updateCells(multi);
    multi.done();
  }

  private onPointerData() {
    if (this.poitnerData.isMoving && this.poitnerData.targetType === CELL && this.data.rectangularSelection) {
      this.selectMultipleCellsAndItems();
    } else if (this.poitnerData.isMoving && this.poitnerData.targetType === CELL && !this.data.rectangularSelection) {
      this.deselectItems();
    } else if (this.poitnerData.isMoving && this.poitnerData.targetType === ITEM) {
      this.selectItemsIndividually();
    } else if (!this.poitnerData.isMoving) {
      if (this.data.isSelecting) this.finishSelection();
      this.data.isSelecting = false;
    }
    if (this.poitnerData.isMoving && this.poitnerData.targetType !== CELL && this.poitnerData.targetType !== ITEM) {
      this.deselectItems();
    }
    this.data.events = this.poitnerData.events;
    this.data.pointerState = this.poitnerData.pointerState;
    this.data.targetType = this.poitnerData.targetType;
    this.data.targetData = this.poitnerData.targetData;
    this.updateData();
  }

  private wrapper(input: htmlResult, props?: any) {
    if (!this.oldWrapper) return input;
    const oldContent = this.oldWrapper(input, props);
    let shouldDetach = true;
    if (
      this.canSelect() &&
      this.data.isSelecting &&
      this.data.showOverlay &&
      this.data.multipleSelection &&
      this.data.rectangularSelection
    ) {
      this.wrapperStyleMap.style.display = 'block';
      this.wrapperStyleMap.style.left = this.data.selectionAreaLocal.x + 'px';
      this.wrapperStyleMap.style.top = this.data.selectionAreaLocal.y + 'px';
      this.wrapperStyleMap.style.width = this.data.selectionAreaLocal.width + 'px';
      this.wrapperStyleMap.style.height = this.data.selectionAreaLocal.height + 'px';
      shouldDetach = false;
    }
    const area = this.html`<div class=${this.wrapperClassName} style=${this.wrapperStyleMap}></div>`;
    return this.html`${oldContent}${shouldDetach ? null : area}`;
  }

  private updateCellSelectionClassName(element: HTMLElement, cell: GridCell) {
    if (cell.selected) {
      element.classList.add(this.data.selectedClassName);
      element.classList.remove(this.data.selectingClassName);
    } else {
      element.classList.remove(this.data.selectedClassName);
    }
    if (cell.selecting) {
      element.classList.add(this.data.selectingClassName);
      element.classList.remove(this.data.selectedClassName);
    } else {
      element.classList.remove(this.data.selectingClassName);
    }
  }

  private selectedCellAction(element: HTMLElement, data: GridCell) {
    this.updateCellSelectionClassName(element, data);
    return {
      update: this.updateCellSelectionClassName,
      destroy: this.updateCellSelectionClassName,
    };
  }

  private onCellCreate(cell: GridCell) {
    cell.selected = !!this.data.selected[CELL].find((selectedCellId) => selectedCellId === cell.id);
    cell.selecting = !!this.data.selecting[CELL].find((selectedCellId) => selectedCellId === cell.id);
    return cell;
  }
}

export function Plugin(options: Options = {}) {
  options = prepareOptions(options);
  return function initialize(vidoInstance: Vido) {
    const currentOptions = vidoInstance.state.get(pluginPath);
    if (currentOptions) {
      options = mergeDeep({}, options, currentOptions);
    }
    const selectionPlugin = new SelectionPlugin(vidoInstance, options);
    return selectionPlugin.destroy;
  };
}
